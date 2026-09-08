from fastapi import APIRouter, Depends, HTTPException
from werkzeug.security import check_password_hash
from app.db.database import get_db
from app.schemas.models import LoginRequest
from app.core.security import create_access_token
from mysql.connector.connection import MySQLConnection

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
def login(request: LoginRequest, db: MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, password_hash, role, status FROM hr_users WHERE username = %s", (request.username,))
    user = cursor.fetchone()

    # Check if user exists
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Check if account is disabled
    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Your account has been disabled by the Super Admin. Access denied.")

    # Allow default admin credentials for convenience
    if request.username == "admin" and request.password in ["admin123", "password123", "admin"]:
        user_id = user["id"]
        role = user["role"]
        token = create_access_token(data={"user_id": user_id, "role": role})
        return {
            "status": "success",
            "token": token,
            "role": role
        }

    user_id = user["id"]
    db_password_hash = user["password_hash"]
    role = user["role"]
    
    try:
        if check_password_hash(db_password_hash, request.password):
            token = create_access_token(data={"user_id": user_id, "role": role})
            return {
                "status": "success",
                "token": token,
                "role": role
            }
    except Exception:
        pass
        
    raise HTTPException(status_code=401, detail="Incorrect password")


