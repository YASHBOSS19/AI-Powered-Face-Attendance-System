import os
import json
import shutil
import uuid
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Depends
from werkzeug.security import generate_password_hash

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

from app.db.database import get_db
from mysql.connector.connection import MySQLConnection

@router.get("/")
async def get_settings(hr_user_id: int = Depends(get_current_user), db: MySQLConnection = Depends(get_db)):
    settings_data = get_settings_data(hr_user_id)
    
    # Also fetch user record from MySQL
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, email, phone, full_name, role, status, created_at, last_login FROM hr_users WHERE id = %s", (hr_user_id,))
    user_row = cursor.fetchone()
    
    if user_row:
        settings_data["username"] = user_row["username"]
        if user_row.get("email"):
            settings_data["email"] = user_row["email"]
        if user_row.get("phone"):
            settings_data["phone"] = user_row["phone"]
        settings_data["role"] = user_row.get("role", "HR")
        settings_data["status"] = user_row.get("status", "active")
        settings_data["createdAt"] = str(user_row["created_at"]) if user_row.get("created_at") else ""
        if not settings_data.get("companyName"):
            settings_data["companyName"] = user_row.get("full_name") or "My Company"
            
    return settings_data

@router.post("/")
async def update_settings(request: Request, hr_user_id: int = Depends(get_current_user), db: MySQLConnection = Depends(get_db)):
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
        cursor = db.cursor()
        update_cols = []
        params = []
        if "companyName" in data and data["companyName"]:
            update_cols.append("full_name = %s")
            params.append(data["companyName"])
        if "email" in data and data["email"] is not None:
            update_cols.append("email = %s")
            params.append(data["email"])
        if "phone" in data and data["phone"] is not None:
            update_cols.append("phone = %s")
            params.append(data["phone"])
        if "new_password" in data and data["new_password"]:
            update_cols.append("password_hash = %s")
            params.append(generate_password_hash(data["new_password"]))
            
        if update_cols:
            params.append(hr_user_id)
            cursor.execute(f"UPDATE hr_users SET {', '.join(update_cols)} WHERE id = %s", tuple(params))
            db.commit()
    except Exception as e:
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