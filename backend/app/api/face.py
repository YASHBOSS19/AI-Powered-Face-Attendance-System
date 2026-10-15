from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import os
import cv2
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.schemas.models import DatasetCreateRequest, RecognizeRequest
from app.core.utils import decode_base64_image
from app.core.face_engine import get_faces, extract_multi_condition_embeddings
from app.core.liveness import check_liveness
from app.core.embedding_db import add_embedding, add_embeddings_batch, clear_embeddings_for_name, match_embedding
from app.core.storage import upload_image
from app.db.database import get_db
from app.db.models import FaceEmbedding, Employee, HRUser, SystemAlert
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
    """
    Enroll employee faces with automatic multi-angle bilateral symmetry (horizontal flip)
    and multi-condition illumination equalization (CLAHE) to handle any lighting or angle.
    """
    added_images = 0
    total_embeddings = 0
    failed = 0
    
    # Refresh/clear prior embeddings for this employee name to prevent duplicate accumulation
    await clear_embeddings_for_name(db, hr_user_id, data.name)

    for img_b64 in data.images:
        try:
            bgr = decode_base64_image(img_b64)
            # Extract base, mirrored (opposite yaw angle), and CLAHE (illumination normalized) embeddings
            embs = extract_multi_condition_embeddings(bgr)
            if not embs:
                failed += 1
                continue
            await add_embeddings_batch(db, hr_user_id, data.name, embs)
            added_images += 1
            total_embeddings += len(embs)
        except Exception as e:
            print(f"Error enrolling image for {data.name}: {e}")
            failed += 1

    status = "success" if added_images else "error"
    return {
        "status": status,
        "message": f"Successfully enrolled {added_images} image(s) generating {total_embeddings} multi-angle & multi-condition biometric vectors. (Failed: {failed})",
        "added": added_images,
        "total_embeddings": total_embeddings,
        "failed": failed,
        "multi_angle_supported": True
    }

@router.post("/recognize")
async def recognize(data: RecognizeRequest, db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    """
    Recognize faces in incoming camera frame with multi-condition (low-light, harsh shadows, backlight)
    and multi-angle (yaw turns, head tilt roll) compensation.
    """
    try:
        bgr = decode_base64_image(data.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image base64")

    faces = get_faces(bgr, multi_condition=True, multi_angle=True)
    results = []
    
    # Check if the authenticated user is a SUPER_ADMIN
    user_q = select(HRUser).where(HRUser.id == hr_user_id)
    user_res = await db.execute(user_q)
    user_obj = user_res.scalars().first()
    is_super_admin = bool(user_obj and user_obj.role == 'SUPER_ADMIN')

    for face_item in faces:
        emb = face_item[0]
        bbox = face_item[1]
        meta = getattr(face_item, 'meta', {})

        pose_info = meta.get("pose", {
            "yaw": 0.0, "pitch": 0.0, "roll": 0.0, "angle_desc": "Frontal"
        })
        lighting_info = meta.get("lighting", {
            "luminance": 120.0, "contrast": 50.0, "condition": "Optimal Lighting"
        })

        # Anti-Spoofing & Liveness Verification (Prevents photo hard copy proxy scanning)
        liveness = check_liveness(bgr, bbox, meta.get("landmark_3d_68"))

        if not liveness.get("is_live", False):
            spoof_type = liveness.get("spoof_type", "PHOTO_HARD_COPY")
            rejection_reason = liveness.get("rejection_reason", "Proxy photo scan detected and blocked.")

            # Broadcast real-time security alert over WebSocket to all kiosks & admin consoles
            await manager.broadcast({
                "type": "SPOOF_ATTACK_DETECTED",
                "message": rejection_reason,
                "spoof_type": spoof_type,
                "print_score": liveness.get("print_score", 0.0),
                "liveness_score": liveness.get("liveness_score", 0.0),
                "box": bbox
            })

            # Record security incident in SystemAlert audit log
            try:
                alert_obj = SystemAlert(
                    tenant_id=hr_user_id,
                    type="PROXY_ATTACK_ATTEMPT",
                    severity="critical",
                    title="Photo Proxy Attendance Blocked",
                    message=f"Proxy attendance attempt blocked at scanner. {rejection_reason}",
                    data={"bbox": bbox, "liveness": liveness}
                )
                db.add(alert_obj)
                await db.commit()
            except Exception as e:
                print(f"[!] Warning: failed to save spoof audit alert: {e}")

            results.append({
                "name": "unknown",
                "employee_id": None,
                "profile_picture": None,
                "confidence": 0.0,
                "box": bbox,
                "status": "spoof_detected",
                "is_live": False,
                "liveness": liveness,
                "today_status": {"has_record": False, "checkin": None, "checkout": None, "status": "blocked"},
                "pose": pose_info,
                "lighting": lighting_info
            })
            continue

        # Multi-condition query representation (raw embedding + CLAHE illumination-equalized embedding)
        candidate_embs = [emb]
        clahe_emb = meta.get('clahe_emb')
        if clahe_emb is not None:
            candidate_embs.append(clahe_emb)

        name, score = await match_embedding(
            db, hr_user_id, emb, 
            threshold=data.threshold, 
            is_super_admin=is_super_admin,
            query_embs=candidate_embs
        )
        status = "unknown"
        today_info = {"has_record": False, "checkin": None, "checkout": None, "status": None}
        emp_id = None
        profile_pic = None
        
        if name != "unknown":
            raw_matched_name = name
            emp_id = None
            
            if is_super_admin:
                query = select(FaceEmbedding.employee_id).where(FaceEmbedding.embedding_name == raw_matched_name)
            else:
                query = select(FaceEmbedding.employee_id).where(FaceEmbedding.embedding_name == raw_matched_name, FaceEmbedding.hr_user_id == hr_user_id)
            result = await db.execute(query)
            emp_row = result.scalars().first()
            
            if emp_row:
                emp_id = emp_row

            if not emp_id:
                if is_super_admin:
                    q = select(Employee.employee_id, Employee.name).where(
                        Employee.name.like(f"{raw_matched_name}%")
                    ).order_by(Employee.employee_id.desc()).limit(1)
                else:
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

            effective_hr_user_id = hr_user_id
            if emp_id:
                if is_super_admin:
                    q = select(Employee).where(Employee.employee_id == emp_id)
                else:
                    q = select(Employee).where(Employee.employee_id == emp_id, Employee.hr_user_id == hr_user_id)
                res = await db.execute(q)
                emp_obj = res.scalars().first()
                if emp_obj:
                    name = emp_obj.name
                    profile_pic = emp_obj.profile_picture
                    effective_hr_user_id = emp_obj.hr_user_id
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
                    
            today_info = await get_today_status(db, name=name, hr_user_id=effective_hr_user_id, employee_id=emp_id)
            status = today_info["status"] or "matched"
        else:
            await manager.broadcast({
                "type": "UNKNOWN_FACE",
                "image": data.image,
                "box": bbox
            })
            
        pose_info = meta.get("pose", {
            "yaw": 0.0, "pitch": 0.0, "roll": 0.0, "angle_desc": "Frontal"
        })
        lighting_info = meta.get("lighting", {
            "luminance": 120.0, "contrast": 50.0, "condition": "Optimal Lighting"
        })

        results.append({
            "name": name,
            "employee_id": emp_id,
            "profile_picture": profile_pic,
            "confidence": float(score) if score != -1 else 0.0,
            "box": bbox,
            "status": status,
            "is_live": True,
            "liveness": liveness,
            "today_status": today_info,
            "pose": pose_info,
            "lighting": lighting_info
        })

    return {
        "status": "success",
        "faces": results
    }

