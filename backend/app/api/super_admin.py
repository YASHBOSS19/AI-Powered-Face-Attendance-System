from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any
from app.db.database import get_db
from app.core.security import get_current_super_admin, create_access_token
from mysql.connector.connection import MySQLConnection
from werkzeug.security import generate_password_hash
from pydantic import BaseModel

router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str

def log_audit_action(db: MySQLConnection, admin_id: int, admin_username: str, action: str, resource: str, details: str = ""):
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO audit_logs (admin_id, admin_username, action, resource, details)
        VALUES (%s, %s, %s, %s, %s)
    """, (admin_id, admin_username, action, resource, details))
    db.commit()

from app.api.settings import get_settings_data, save_settings_data

@router.get("/users")
def list_users(db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.status, u.role, u.created_at, u.last_login,
               (SELECT COUNT(*) FROM employees e WHERE e.hr_user_id = u.id) AS employee_count,
               (SELECT COUNT(*) FROM attendance a WHERE a.hr_user_id = u.id) AS attendance_count,
               (SELECT COUNT(*) FROM face_embeddings f WHERE f.hr_user_id = u.id) AS face_count
        FROM hr_users u
        WHERE u.role = 'HR'
        ORDER BY u.id DESC
    """)
    users = cursor.fetchall()
    
    # Attach settings (logo, company name, working days)
    for u in users:
        settings = get_settings_data(u["id"])
        u["logo_url"] = settings.get("logoUrl", "")
        u["company_name"] = settings.get("companyName", u["full_name"] or "My Company")
        u["working_days"] = settings.get("workingDays", [])
        u["late_threshold_time"] = settings.get("lateThresholdTime", "10:00")
        
    return {"status": "success", "users": users}

@router.get("/users/{user_id}")
def get_user_details(user_id: int, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    import json
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT id, username, full_name, email, phone, status, role, permissions, created_at, last_login
        FROM hr_users 
        WHERE id = %s AND role = 'HR'
    """, (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    if user.get("permissions"):
        try:
            user["permissions"] = json.loads(user["permissions"])
        except Exception:
            user["permissions"] = ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]
    else:
        user["permissions"] = ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]

    # Get counts
    cursor.execute("SELECT COUNT(*) AS count FROM employees WHERE hr_user_id = %s", (user_id,))
    user["employee_count"] = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) AS count FROM attendance WHERE hr_user_id = %s", (user_id,))
    user["attendance_count"] = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) AS count FROM face_embeddings WHERE hr_user_id = %s", (user_id,))
    user["face_count"] = cursor.fetchone()["count"]
    
    # Get settings (logo, etc.)
    settings = get_settings_data(user_id)
    user["settings"] = settings
    user["logo_url"] = settings.get("logoUrl", "")
    user["company_name"] = settings.get("companyName", user["full_name"] or "My Company")
    user["industry"] = settings.get("industry", "")
    user["working_days"] = settings.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"])
    user["late_threshold_time"] = settings.get("lateThresholdTime", "10:00")
    if not user.get("phone") and settings.get("phone"):
        user["phone"] = settings.get("phone")
    
    # Get sample / recent employees
    cursor.execute("""
        SELECT employee_id, name, domain, department, position, registered_date 
        FROM employees 
        WHERE hr_user_id = %s 
        ORDER BY registered_date DESC 
        LIMIT 10
    """, (user_id,))
    user["recent_employees"] = cursor.fetchall()
    
    return {"status": "success", "user": user}

import base64
import os
import uuid
import cv2
import numpy as np
from typing import List, Optional

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    working_days: Optional[List[str]] = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    late_threshold_time: Optional[str] = "10:00"
    status: Optional[str] = "active"
    permissions: Optional[List[str]] = None

@router.post("/users")
def create_user(user: UserCreate, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    
    # Check if username or email already exists
    cursor.execute("SELECT id FROM hr_users WHERE username = %s", (user.username,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different username.")
        
    hashed = generate_password_hash(user.password)
    company_name = user.company_name or user.full_name or "My Company"
    status_val = user.status if user.status in ["active", "disabled"] else "active"
    try:
        import json
        perms_json = json.dumps(user.permissions) if user.permissions else json.dumps(["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"])
        
        cursor.execute("""
            INSERT INTO hr_users (username, password_hash, role, full_name, email, phone, status, permissions, created_by, created_by_username)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user.username, 
            hashed, 
            'HR', 
            company_name, 
            user.email, 
            user.phone, 
            status_val, 
            perms_json, 
            super_admin.get('user_id'), 
            super_admin.get('username', 'superadmin')
        ))
        db.commit()
        new_id = cursor.lastrowid
        
        # Handle logo if provided
        logo_url = ""
        if user.logo_base64:
            try:
                logos_dir = "static/logos"
                os.makedirs(logos_dir, exist_ok=True)
                header, encoded = user.logo_base64.split(",", 1) if "," in user.logo_base64 else ("", user.logo_base64)
                img_bytes = base64.b64decode(encoded)
                logo_filename = f"logo_{new_id}_{uuid.uuid4().hex[:8]}.png"
                logo_path = os.path.join(logos_dir, logo_filename)
                with open(logo_path, "wb") as f:
                    f.write(img_bytes)
                logo_url = f"/api/static/logos/{logo_filename}"
            except Exception as img_err:
                print(f"Warning: Failed to save logo during user creation: {img_err}")

        # Initialize tenant settings with complete configuration
        from app.api.settings import save_settings_data
        save_settings_data(new_id, {
            "companyName": company_name,
            "logoUrl": logo_url,
            "workingDays": user.working_days if user.working_days else ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "lateThresholdTime": user.late_threshold_time or "10:00",
            "industry": user.industry or "",
            "phone": user.phone or ""
        })
        
        # Log action
        log_audit_action(db, super_admin['user_id'], 'superadmin', 'CREATE_USER', f'hr_users:{new_id}', f'Created HR admin {user.username} ({company_name})')
        
        return {
            "status": "success", 
            "message": f"HR Admin workspace for '{company_name}' created successfully!",
            "user_id": new_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class UserUpdate(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    working_days: Optional[List[str]] = None
    late_threshold_time: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None
    permissions: Optional[List[str]] = None

@router.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, username, full_name, email, phone, role, status FROM hr_users WHERE id = %s AND role = 'HR'", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="HR Admin not found")
            
        company_name = data.company_name or user["full_name"]
        email = data.email or user["email"]
        
        # Update MySQL hr_users
        update_fields = ["full_name = %s", "email = %s"]
        params = [company_name, email]
        
        if data.phone is not None:
            update_fields.append("phone = %s")
            params.append(data.phone)
            
        if data.status in ["active", "disabled"]:
            update_fields.append("status = %s")
            params.append(data.status)
            
        if data.permissions is not None:
            import json
            update_fields.append("permissions = %s")
            params.append(json.dumps(data.permissions))
            
        if data.password and data.password.strip():
            update_fields.append("password_hash = %s")
            params.append(generate_password_hash(data.password.strip()))
            
        params.append(user_id)
        
        sql = f"UPDATE hr_users SET {', '.join(update_fields)} WHERE id = %s"
        cursor.execute(sql, tuple(params))
        db.commit()
        
        # Update tenant settings JSON
        current_settings = get_settings_data(user_id)
        if data.company_name:
            current_settings["companyName"] = data.company_name
        if data.phone is not None:
            current_settings["phone"] = data.phone
        if data.industry is not None:
            current_settings["industry"] = data.industry
        if data.working_days is not None:
            current_settings["workingDays"] = data.working_days
        if data.late_threshold_time is not None:
            current_settings["lateThresholdTime"] = data.late_threshold_time
            
        # If new logo base64 provided
        if data.logo_base64:
            try:
                logos_dir = "static/logos"
                os.makedirs(logos_dir, exist_ok=True)
                header, encoded = data.logo_base64.split(",", 1) if "," in data.logo_base64 else ("", data.logo_base64)
                img_bytes = base64.b64decode(encoded)
                logo_filename = f"logo_{user_id}_{uuid.uuid4().hex[:8]}.png"
                logo_path = os.path.join(logos_dir, logo_filename)
                with open(logo_path, "wb") as f:
                    f.write(img_bytes)
                current_settings["logoUrl"] = f"/api/static/logos/{logo_filename}"
            except Exception as img_err:
                print(f"Warning: Failed to save updated logo: {img_err}")
                
        save_settings_data(user_id, current_settings)
        
        admin_id = int(super_admin.get('user_id', 23))
        admin_uname = super_admin.get('username', 'superadmin')
        log_audit_action(db, admin_id, admin_uname, 'UPDATE_USER', f'hr_users:{user_id}', f'Updated organization details for {user["username"]} ({company_name})')
        
        return {"status": "success", "message": "Organization details updated successfully", "settings": current_settings}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("UPDATE_USER ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT username FROM hr_users WHERE id = %s AND role = 'HR'", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found or cannot delete super admin")
        
    try:
        cursor.execute("DELETE FROM hr_users WHERE id = %s", (user_id,))
        db.commit()
        
        log_audit_action(db, super_admin['user_id'], 'superadmin', 'DELETE_USER', f'hr_users:{user_id}', f'Deleted HR admin {user["username"]}')
        
        return {"status": "success", "message": "User deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class UserStatusUpdate(BaseModel):
    status: str  # "active" or "disabled"

@router.put("/users/{user_id}/status")
def update_user_status(user_id: int, data: UserStatusUpdate, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    if data.status not in ["active", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed values: 'active', 'disabled'")
        
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role, status FROM hr_users WHERE id = %s AND role = 'HR'", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="HR Admin not found")
        
    cursor.execute("UPDATE hr_users SET status = %s WHERE id = %s", (data.status, user_id))
    db.commit()
    
    action_type = "DISABLE_USER" if data.status == "disabled" else "ENABLE_USER"
    log_audit_action(db, super_admin['user_id'], 'superadmin', action_type, f'hr_users:{user_id}', f'{action_type.replace("_", " ").title()} for {user["username"]}')
    
    return {"status": "success", "message": f"User status updated to {data.status}", "new_status": data.status}

@router.post("/impersonate/{user_id}")
def impersonate_user(user_id: int, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role, status FROM hr_users WHERE id = %s AND role = 'HR'", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found or invalid role")
        
    if user.get("status") == "disabled":
        raise HTTPException(status_code=400, detail="Cannot impersonate a disabled account. Please enable it first.")
        
    # Generate token for this user
    token = create_access_token(data={"user_id": user["id"], "role": user["role"], "impersonated_by": super_admin['user_id']})
    
    log_audit_action(db, super_admin['user_id'], 'superadmin', 'IMPERSONATE', f'hr_users:{user_id}', f'Impersonated user {user["username"]}')
    
    return {
        "status": "success",
        "token": token,
        "role": user["role"],
        "username": user["username"]
    }

@router.get("/audit-logs")
def get_audit_logs(db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100")
    logs = cursor.fetchall()
    return {"status": "success", "logs": logs}
