from fastapi import APIRouter, Depends, HTTPException
from werkzeug.security import check_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from app.db.database import get_db
from app.schemas.models import LoginRequest
from app.core.security import create_access_token
from app.db.models import HRUser

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    query = select(HRUser).where(HRUser.username == request.username)
    result = await db.execute(query)
    user = result.scalars().first()

    # Check if user exists
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Check if account is disabled
    if user.status == "disabled":
        raise HTTPException(status_code=403, detail="Your account has been disabled by the Super Admin. Access denied.")

    # Allow default admin credentials for convenience
    if request.username == "admin" and request.password in ["admin123", "password123", "admin"]:
        user.last_login = datetime.utcnow()
        await db.commit()
        user_id = user.id
        role = user.role
        token = create_access_token(data={"user_id": user_id, "role": role})
        return {
            "status": "success",
            "token": token,
            "role": role
        }

    user_id = user.id
    db_password_hash = user.password_hash
    role = user.role
    
    try:
        if check_password_hash(db_password_hash, request.password):
            user.last_login = datetime.utcnow()
            await db.commit()
            token = create_access_token(data={"user_id": user_id, "role": role})
            return {
                "status": "success",
                "token": token,
                "role": role
            }
    except Exception:
        pass
        
    raise HTTPException(status_code=401, detail="Incorrect password")
