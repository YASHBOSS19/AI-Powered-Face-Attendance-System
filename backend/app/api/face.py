from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import os
import cv2
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.schemas.models import DatasetCreateRequest, RecognizeRequest
from app.core.utils import decode_base64_image
from app.core.face_engine import get_faces
from app.core.embedding_db import add_embedding, match_embedding
from app.core.storage import upload_image
from app.db.database import get_db
from app.db.models import FaceEmbedding, Employee
from app.core.attendance_db import mark_attendance, get_today_status
from app.core.ws_manager import manager
from app.core.security import get_current_user

router = APIRouter(prefix="/api", tags=["face"])

DATASET_DIR = "dataset"
os.makedirs(DATASET_DIR, exist_ok=True)

@router.post("/dataset/create")
async def dataset_create(data: DatasetCreateRequest, hr_user_id: int = Depends(get_current_user)):
    person_dir = os.path.join(DATASET_DIR, str(hr_user_id), data.name)

    saved = skipped = 0
    for idx, img_b64 in enumerate(data.images):
        try:
            bgr = decode_base64_image(img_b64)
            filename = f"{data.name}_{idx+1}.jpg"
            
            # Convert BGR image to bytes
            is_success, buffer = cv2.imencode(".jpg", bgr)
            if not is_success:
                raise Exception("Failed to encode image")
            img_bytes = buffer.tobytes()
            
            # Upload using the storage utility
            upload_image(img_bytes, filename, hr_user_id, data.name)
            
            saved += 1
        except Exception as e:
            print(f"Error saving image: {e}")
            skipped += 1

    return {
        "status": "success",
        "name": data.name,
        "saved": saved,
        "skipped": skipped,
        "path": person_dir
    }

@router.post("/enroll")
async def enroll(data: DatasetCreateRequest, db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    added = failed = 0
    for img_b64 in data.images:
        try:
            bgr = decode_base64_image(img_b64)
            faces = get_faces(bgr)
            if not faces:
                failed += 1
                continue
            emb, _ = faces[0]
            await add_embedding(db, hr_user_id, data.name, emb)
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
async def recognize(data: RecognizeRequest, db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    try:
        bgr = decode_base64_image(data.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image base64")

    faces = get_faces(bgr)
    results = []
    
    for emb, bbox in faces:
        name, score = await match_embedding(db, hr_user_id, emb, threshold=data.threshold)
        status = "unknown"
        today_info = {"has_record": False, "checkin": None, "checkout": None, "status": None}
        emp_id = None
        
        if name != "unknown":
            raw_matched_name = name
            emp_id = None
            
            query = select(FaceEmbedding.employee_id).where(FaceEmbedding.embedding_name == raw_matched_name, FaceEmbedding.hr_user_id == hr_user_id)
            result = await db.execute(query)
            emp_row = result.scalars().first()
            
            if emp_row:
                emp_id = emp_row

            if not emp_id:
                q = select(Employee.employee_id, Employee.name).where(
                    Employee.hr_user_id == hr_user_id,
                    Employee.name.like(f"{raw_matched_name}%")
                ).order_by(Employee.employee_id.desc()).limit(1)
                res = await db.execute(q)
                emp_row = res.first()
                if emp_row:
                    emp_id = emp_row.employee_id
                    name = emp_row.name

            if not emp_id:
                import re
                match = re.match(r'^(EMP[_-]?\d+)', raw_matched_name, re.IGNORECASE)
                if match:
                    emp_id = match.group(1)

            profile_pic = None
            if emp_id:
                q = select(Employee).where(Employee.employee_id == emp_id, Employee.hr_user_id == hr_user_id)
                res = await db.execute(q)
                emp_obj = res.scalars().first()
                if emp_obj:
                    name = emp_obj.name
                    profile_pic = emp_obj.profile_picture
                elif raw_matched_name.startswith(emp_id):
                    clean_n = raw_matched_name[len(emp_id):].lstrip('_ ').replace('_', ' ').strip()
                    if clean_n:
                        name = clean_n
            else:
                if "_" in raw_matched_name:
                    parts = raw_matched_name.split("_")
                    if len(parts) >= 3 and parts[0] == "EMP":
                        emp_id = f"{parts[0]}_{parts[1]}"
                        name = " ".join(parts[2:])
                    elif len(parts) >= 2:
                        emp_id = parts[0]
                        name = " ".join(parts[1:])
                    
            today_info = await get_today_status(db, name=name, hr_user_id=hr_user_id, employee_id=emp_id)
            status = today_info["status"] or "matched"
        else:
            await manager.broadcast({
                "type": "UNKNOWN_FACE",
                "image": data.image,
                "box": bbox
            })
            
        results.append({
            "name": name,
            "employee_id": emp_id,
            "profile_picture": profile_pic if matched else None,
            "confidence": float(score) if score != -1 else 0.0,
            "box": bbox,
            "status": status,
            "today_status": today_info
        })

    return {
        "status": "success",
        "faces": results
    }
