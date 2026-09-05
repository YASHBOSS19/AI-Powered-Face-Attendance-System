from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
import cv2

from app.schemas.models import DatasetCreateRequest, RecognizeRequest
from app.core.utils import decode_base64_image
from app.core.face_engine import get_faces
from app.core.embedding_db import add_embedding, match_embedding
from app.db.database import get_db_context
from app.core.attendance_db import mark_attendance, get_today_status
from app.core.ws_manager import manager

router = APIRouter(prefix="/api", tags=["face"])

# The dataset will be in the backend directory since we moved it
DATASET_DIR = "dataset"
os.makedirs(DATASET_DIR, exist_ok=True)

@router.post("/dataset/create")
def dataset_create(data: DatasetCreateRequest):
    person_dir = os.path.join(DATASET_DIR, data.name)
    os.makedirs(person_dir, exist_ok=True)

    saved = skipped = 0
    for idx, img_b64 in enumerate(data.images):
        try:
            bgr = decode_base64_image(img_b64)
            save_path = os.path.join(person_dir, f"{data.name}_{idx+1}.jpg")
            cv2.imwrite(save_path, bgr)
            saved += 1
        except Exception:
            skipped += 1

    return {
        "status": "success",
        "name": data.name,
        "saved": saved,
        "skipped": skipped,
        "path": person_dir
    }

@router.post("/enroll")
def enroll(data: DatasetCreateRequest):
    added = failed = 0
    for img_b64 in data.images:
        try:
            bgr = decode_base64_image(img_b64)
            faces = get_faces(bgr)
            if not faces:
                failed += 1
                continue
            emb, _ = faces[0]
            add_embedding(data.name, emb)
            added += 1
        except Exception:
            failed += 1

    status = "success" if added else "error"
    return {
        "status": status,
        "message": f"Added {added} embeddings. Failed {failed}.",
        "added": added,
        "failed": failed
    }

@router.post("/recognize")
async def recognize(data: RecognizeRequest):
    try:
        bgr = decode_base64_image(data.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image base64")

    faces = get_faces(bgr)
    results = []
    
    for emb, bbox in faces:
        name, score = match_embedding(emb, threshold=data.threshold)
        status = "unknown"
        today_info = {"has_record": False, "checkin": None, "checkout": None, "status": None}
        emp_id = None
        
        if name != "unknown":
            raw_matched_name = name
            emp_id = None
            
            # Fetch the actual updated name from the MySQL DB
            with get_db_context() as conn:
                cursor = conn.cursor(dictionary=True)
                
                # 1. First check if exact embedding_name exists in face_embeddings
                cursor.execute("SELECT employee_id FROM face_embeddings WHERE embedding_name = %s", (raw_matched_name,))
                emb_row = cursor.fetchone()
                if emb_row:
                    emp_id = emb_row["employee_id"]

                # 2. If not found, match by employee_id prefix from employees table
                if not emp_id:
                    cursor.execute("SELECT employee_id, name FROM employees WHERE %s LIKE CONCAT(employee_id, '%%') ORDER BY LENGTH(employee_id) DESC LIMIT 1", (raw_matched_name,))
                    emp_row = cursor.fetchone()
                    if emp_row:
                        emp_id = emp_row["employee_id"]
                        name = emp_row["name"]

                # 3. Fallback regex to capture EMP_123 or EMP123
                if not emp_id:
                    import re
                    match = re.match(r'^(EMP[_-]?\d+)', raw_matched_name, re.IGNORECASE)
                    if match:
                        emp_id = match.group(1)

                # 4. If emp_id is found, query the official employee name
                if emp_id:
                    cursor.execute("SELECT name FROM employees WHERE employee_id = %s", (emp_id,))
                    row = cursor.fetchone()
                    if row:
                        name = row["name"]
                    elif raw_matched_name.startswith(emp_id):
                        clean_n = raw_matched_name[len(emp_id):].lstrip('_ ').replace('_', ' ').strip()
                        if clean_n:
                            name = clean_n
                else:
                    # Fallback pattern for EMP_114_Harshitchhipa
                    if "_" in raw_matched_name:
                        parts = raw_matched_name.split("_")
                        if len(parts) >= 3 and parts[0] == "EMP":
                            emp_id = f"{parts[0]}_{parts[1]}"
                            name = " ".join(parts[2:])
                        elif len(parts) >= 2:
                            emp_id = parts[0]
                            name = " ".join(parts[1:])
                        
            today_info = get_today_status(name=name, employee_id=emp_id)
            status = today_info["status"] or "matched"
        else:
            # Broadcast unknown face alert to HR panel
            await manager.broadcast({
                "type": "UNKNOWN_FACE",
                "image": data.image,
                "box": bbox
            })
            
        results.append({
            "name": name,
            "employee_id": emp_id,
            "confidence": float(score) if score != -1 else 0.0,
            "box": bbox,
            "status": status,
            "today_status": today_info
        })

    return {
        "status": "success",
        "faces": results
    }
