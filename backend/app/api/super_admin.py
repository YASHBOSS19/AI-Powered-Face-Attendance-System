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

@router.get("/users")
def list_users(db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, full_name, email, status, role, created_at, last_login FROM hr_users WHERE role = 'HR'")
    users = cursor.fetchall()
    return {"status": "success", "users": users}

@router.post("/users")
def create_user(user: UserCreate, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    
    # Check if exists
    cursor.execute("SELECT id FROM hr_users WHERE username = %s", (user.username,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Username already exists")
        
    hashed = generate_password_hash(user.password)
    
    try:
        cursor.execute("""
            INSERT INTO hr_users (username, password_hash, role, full_name, email, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user.username, hashed, 'HR', user.full_name, user.email, 'active'))
        db.commit()
        new_id = cursor.lastrowid
        
        # Log action
        log_audit_action(db, super_admin['user_id'], 'superadmin', 'CREATE_USER', f'hr_users:{new_id}', f'Created HR admin {user.username}')
        
        return {"status": "success", "message": "User created successfully"}
    except Exception as e:
        db.rollback()
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

@router.post("/impersonate/{user_id}")
def impersonate_user(user_id: int, db: MySQLConnection = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role FROM hr_users WHERE id = %s AND role = 'HR'", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found or invalid role")
        
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
