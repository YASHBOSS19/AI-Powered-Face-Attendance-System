from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from werkzeug.security import generate_password_hash
from pydantic import BaseModel
import base64
import os
import uuid
import json

from app.db.database import get_db
from app.db.models import HRUser, AuditLog, Employee, Attendance, FaceEmbedding
from app.core.security import get_current_super_admin, create_access_token
from app.api.settings import get_settings_data, save_settings_data

router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])

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

async def log_audit_action(db: AsyncSession, admin_id: int, admin_username: str, action: str, resource: str, details: str = ""):
    new_log = AuditLog(
        admin_id=admin_id,
        admin_username=admin_username,
        action=action,
        resource=resource,
        details=details
    )
    db.add(new_log)
    await db.commit()

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.role == 'HR').order_by(HRUser.id.desc())
    result = await db.execute(query)
    hr_users = result.scalars().all()
    
    users = []
    for u in hr_users:
        # Get counts
        emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == u.id))
        emp_count = emp_res.scalar() or 0
        
        att_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == u.id))
        att_count = att_res.scalar() or 0
        
        face_res = await db.execute(select(func.count(FaceEmbedding.id)).where(FaceEmbedding.hr_user_id == u.id))
        face_count = face_res.scalar() or 0
        
        settings = get_settings_data(u.id)
        
        users.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "status": u.status,
            "role": u.role,
            "created_at": u.created_at,
            "last_login": u.last_login,
            "employee_count": emp_count,
            "attendance_count": att_count,
            "face_count": face_count,
            "logo_url": settings.get("logoUrl", ""),
            "company_name": settings.get("companyName", u.full_name or "My Company"),
            "working_days": settings.get("workingDays", []),
            "late_threshold_time": settings.get("lateThresholdTime", "10:00")
        })
        
    return {"status": "success", "users": users}

@router.get("/users/{user_id}")
async def get_user_details(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    u = result.scalars().first()
    
    if not u:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    perms = u.permissions if u.permissions else ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]

    emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == user_id))
    emp_count = emp_res.scalar() or 0
    
    att_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == user_id))
    att_count = att_res.scalar() or 0
    
    face_res = await db.execute(select(func.count(FaceEmbedding.id)).where(FaceEmbedding.hr_user_id == user_id))
    face_count = face_res.scalar() or 0
    
    settings = get_settings_data(user_id)
    
    user_dict = {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "phone": settings.get("phone") or u.phone,
        "status": u.status,
        "role": u.role,
        "permissions": perms,
        "created_at": u.created_at,
        "last_login": u.last_login,
        "employee_count": emp_count,
        "attendance_count": att_count,
        "face_count": face_count,
        "settings": settings,
        "logo_url": settings.get("logoUrl", ""),
        "company_name": settings.get("companyName", u.full_name or "My Company"),
        "industry": settings.get("industry", ""),
        "working_days": settings.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"]),
        "late_threshold_time": settings.get("lateThresholdTime", "10:00")
    }
    
    # Get recent employees
    recent_q = select(Employee).where(Employee.hr_user_id == user_id).order_by(Employee.registered_date.desc()).limit(10)
    recent_res = await db.execute(recent_q)
    recent_emps = recent_res.scalars().all()
    
    user_dict["recent_employees"] = [{
        "employee_id": e.employee_id,
        "name": e.name,
        "domain": e.domain,
        "department": e.department,
        "position": e.position,
        "registered_date": str(e.registered_date) if e.registered_date else None
    } for e in recent_emps]
    
    return {"status": "success", "user": user_dict}


@router.post("/users")
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.username == user.username)
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different username.")
        
    hashed = generate_password_hash(user.password)
    company_name = user.company_name or user.full_name or "My Company"
    status_val = user.status if user.status in ["active", "disabled"] else "active"
    perms = user.permissions if user.permissions else ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]
    
    try:
        new_hr = HRUser(
            username=user.username,
            password_hash=hashed,
            role='HR',
            full_name=company_name,
            email=user.email,
            phone=user.phone,
            status=status_val,
            permissions=perms,
            created_by=super_admin.get('user_id'),
            created_by_username=super_admin.get('username', 'superadmin')
        )
        db.add(new_hr)
        await db.commit()
        await db.refresh(new_hr)
        new_id = new_hr.id
        
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

        # Initialize tenant settings
        save_settings_data(new_id, {
            "companyName": company_name,
            "logoUrl": logo_url,
            "workingDays": user.working_days if user.working_days else ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "lateThresholdTime": user.late_threshold_time or "10:00",
            "industry": user.industry or "",
            "phone": user.phone or ""
        })
        
        await log_audit_action(db, super_admin['user_id'], 'superadmin', 'CREATE_USER', f'hr_users:{new_id}', f'Created HR admin {user.username} ({company_name})')
        
        return {
            "status": "success", 
            "message": f"HR Admin workspace for '{company_name}' created successfully!",
            "user_id": new_id
        }
    except Exception as e:
        await db.rollback()
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
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    try:
        query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
        result = await db.execute(query)
        user_row = result.scalars().first()
        
        if not user_row:
            raise HTTPException(status_code=404, detail="HR Admin not found")
            
        company_name = data.company_name or user_row.full_name
        email = data.email or user_row.email
        
        user_row.full_name = company_name
        user_row.email = email
        
        if data.phone is not None:
            user_row.phone = data.phone
            
        if data.status in ["active", "disabled"]:
            user_row.status = data.status
            
        if data.permissions is not None:
            user_row.permissions = data.permissions
            
        if data.password and data.password.strip():
            user_row.password_hash = generate_password_hash(data.password.strip())
            
        await db.commit()
        
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
        await log_audit_action(db, admin_id, admin_uname, 'UPDATE_USER', f'hr_users:{user_id}', f'Updated organization details for {user_row.username} ({company_name})')
        
        return {"status": "success", "message": "Organization details updated successfully", "settings": current_settings}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found or cannot delete super admin")
        
    try:
        username = user_row.username
        await db.delete(user_row)
        await db.commit()
        
        await log_audit_action(db, super_admin['user_id'], 'superadmin', 'DELETE_USER', f'hr_users:{user_id}', f'Deleted HR admin {username}')
        
        return {"status": "success", "message": "User deleted successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class UserStatusUpdate(BaseModel):
    status: str  # "active" or "disabled"

@router.put("/users/{user_id}/status")
async def update_user_status(user_id: int, data: UserStatusUpdate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    if data.status not in ["active", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed values: 'active', 'disabled'")
        
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="HR Admin not found")
        
    user_row.status = data.status
    await db.commit()
    
    action_type = "DISABLE_USER" if data.status == "disabled" else "ENABLE_USER"
    await log_audit_action(db, super_admin['user_id'], 'superadmin', action_type, f'hr_users:{user_id}', f'{action_type.replace("_", " ").title()} for {user_row.username}')
    
    return {"status": "success", "message": f"User status updated to {data.status}", "new_status": data.status}

@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found or invalid role")
        
    if user_row.status == "disabled":
        raise HTTPException(status_code=400, detail="Cannot impersonate a disabled account. Please enable it first.")
        
    token = create_access_token(data={"user_id": user_row.id, "role": user_row.role, "impersonated_by": super_admin['user_id']})
    
    await log_audit_action(db, super_admin['user_id'], 'superadmin', 'IMPERSONATE', f'hr_users:{user_id}', f'Impersonated user {user_row.username}')
    
    return {
        "status": "success",
        "token": token,
        "role": user_row.role,
        "username": user_row.username
    }

@router.get("/audit-logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    logs_list = [{
        "id": l.id,
        "admin_id": l.admin_id,
        "admin_username": l.admin_username,
        "action": l.action,
        "resource": l.resource,
        "details": l.details,
        "timestamp": str(l.timestamp) if l.timestamp else None
    } for l in logs]
    
    return {"status": "success", "logs": logs_list}
