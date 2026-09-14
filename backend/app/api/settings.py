import os
import json
import shutil
import uuid
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Depends
from werkzeug.security import generate_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from app.db.database import get_db
from app.db.models import HRUser
from app.core.security import get_current_user

router = APIRouter()
LOGOS_DIR = "static/logos"

os.makedirs(LOGOS_DIR, exist_ok=True)

def get_settings_file(hr_user_id: int):
    return f"settings_{hr_user_id}.json"

def get_settings_data(hr_user_id: int):
    settings_file = get_settings_file(hr_user_id)
    default_data = {
        "companyName": "My Company",
        "industry": "Technology & IT",
        "email": "",
        "phone": "",
        "logoUrl": "",
        "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "lateThresholdTime": "10:00",
        "modules": ["overview", "employees", "kiosk", "reports", "unknown_identity"]
    }
    if not os.path.exists(settings_file):
        # Fallback to general settings.json if exists (migration)
        if hr_user_id == 1 and os.path.exists("settings.json"):
            try:
                with open("settings.json", "r") as f:
                    data = json.load(f)
                merged = {**default_data, **data}
                save_settings_data(hr_user_id, merged)
                return merged
            except:
                pass
        return default_data
    with open(settings_file, "r") as f:
        try:
            data = json.load(f)
            return {**default_data, **data}
        except json.JSONDecodeError:
            return default_data

def save_settings_data(hr_user_id: int, data: dict):
    settings_file = get_settings_file(hr_user_id)
    with open(settings_file, "w") as f:
        json.dump(data, f, indent=2)

@router.get("/")
async def get_settings(hr_user_id: int = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings_data = get_settings_data(hr_user_id)
    
    # Fetch user record from MySQL
    query = select(HRUser).where(HRUser.id == hr_user_id)
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if user_row:
        settings_data["username"] = user_row.username
        if user_row.email:
            settings_data["email"] = user_row.email
        if user_row.phone:
            settings_data["phone"] = user_row.phone
        settings_data["role"] = user_row.role or "HR"
        settings_data["status"] = user_row.status or "active"
        settings_data["createdAt"] = str(user_row.created_at) if user_row.created_at else ""
        if not settings_data.get("companyName"):
            settings_data["companyName"] = user_row.full_name or "My Company"
            
    return settings_data

@router.post("/")
async def update_settings(request: Request, hr_user_id: int = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await request.json()
    current_settings = get_settings_data(hr_user_id)
    
    # Update allowed fields in JSON
    if "companyName" in data:
        current_settings["companyName"] = data["companyName"]
    if "industry" in data:
        current_settings["industry"] = data["industry"]
    if "email" in data:
        current_settings["email"] = data["email"]
    if "phone" in data:
        current_settings["phone"] = data["phone"]
    if "workingDays" in data:
        current_settings["workingDays"] = data["workingDays"]
    if "lateThresholdTime" in data:
        current_settings["lateThresholdTime"] = data["lateThresholdTime"]
    if "logoUrl" in data:
        current_settings["logoUrl"] = data["logoUrl"]
    if "modules" in data:
        current_settings["modules"] = data["modules"]
        
    save_settings_data(hr_user_id, current_settings)
    
    # Sync DB fields (full_name, email, phone, password_hash)
    try:
        query = select(HRUser).where(HRUser.id == hr_user_id)
        result = await db.execute(query)
        user_row = result.scalars().first()
        
        if user_row:
            if "companyName" in data and data["companyName"]:
                user_row.full_name = data["companyName"]
            if "email" in data and data["email"] is not None:
                user_row.email = data["email"]
            if "phone" in data and data["phone"] is not None:
                user_row.phone = data["phone"]
            if "new_password" in data and data["new_password"]:
                user_row.password_hash = generate_password_hash(data["new_password"])
                
            await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Warning: Failed to update hr_users DB row: {e}")
        
    return {"status": "success", "settings": current_settings}

@router.post("/logo")
async def upload_logo(file: UploadFile = File(...), hr_user_id: int = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    new_filename = f"logo_{hr_user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(LOGOS_DIR, new_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    logo_url = f"/api/static/logos/{new_filename}"
    
    current_settings = get_settings_data(hr_user_id)
    current_settings["logoUrl"] = logo_url
    save_settings_data(hr_user_id, current_settings)
    
    return {"status": "success", "logoUrl": logo_url}