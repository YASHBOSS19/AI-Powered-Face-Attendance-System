import os
import json
import shutil
import uuid
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form

router = APIRouter()
SETTINGS_FILE = "settings.json"
LOGOS_DIR = "static/logos"

os.makedirs(LOGOS_DIR, exist_ok=True)

def get_settings_data():
    if not os.path.exists(SETTINGS_FILE):
        return {
            "companyName": "Vivekananda Global University",
            "logoUrl": "",
            "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "lateThresholdTime": "10:00"
        }
    with open(SETTINGS_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {
                "companyName": "Vivekananda Global University",
                "logoUrl": "",
                "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
                "lateThresholdTime": "10:00"
            }

def save_settings_data(data):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@router.get("/")
async def get_settings():
    return get_settings_data()

@router.post("/")
async def update_settings(request: Request):
    data = await request.json()
    
    current_settings = get_settings_data()
    
    # Update only allowed fields
    if "companyName" in data:
        current_settings["companyName"] = data["companyName"]
    if "workingDays" in data:
        current_settings["workingDays"] = data["workingDays"]
    if "lateThresholdTime" in data:
        current_settings["lateThresholdTime"] = data["lateThresholdTime"]
    if "logoUrl" in data:
        current_settings["logoUrl"] = data["logoUrl"]
        
    save_settings_data(current_settings)
    return {"status": "success", "settings": current_settings}

@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    new_filename = f"logo_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(LOGOS_DIR, new_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    logo_url = f"/api/static/logos/{new_filename}"
    
    current_settings = get_settings_data()
    current_settings["logoUrl"] = logo_url
    save_settings_data(current_settings)
    
    return {"status": "success", "logoUrl": logo_url}