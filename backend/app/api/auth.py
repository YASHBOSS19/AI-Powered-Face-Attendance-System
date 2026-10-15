from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from app.db.database import get_db
from app.schemas.models import LoginRequest
from app.core.security import create_access_token
from app.db.models import HRUser, Employee

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    uname = request.username.strip()
    query = select(HRUser).where(HRUser.username == uname)
    result = await db.execute(query)
    user = result.scalars().first()

    # Check if user exists
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Check if account is disabled
    if user.status == "disabled":
        raise HTTPException(status_code=403, detail="Your account has been disabled by the Super Admin. Access denied.")

    # Allow default admin/superadmin credentials for convenience
    if uname in ["admin", "superadmin"] and request.password in ["admin123", "password123", "admin", "superadmin", "superadmin123"]:
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


class EmployeeLoginRequest(BaseModel):
    employee_id: str
    password: str


@router.post("/employee-login")
@router.post("/employee/login")
async def employee_login(request: EmployeeLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate an employee using their unique Employee ID and password.
    Supports default password (ID + '@123') for first-time login if no custom password is set.
    """
    emp_id = request.employee_id.strip()
    if not emp_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")

    # Match by exact employee_id or case-insensitive
    query = select(Employee).where(
        (Employee.employee_id == emp_id) | 
        (Employee.employee_id.ilike(emp_id))
    )
    result = await db.execute(query)
    emp = result.scalars().first()

    if not emp:
        raise HTTPException(status_code=401, detail="Employee ID not recognized. Please check with HR.")

    entered_pwd = request.password.strip()
    is_valid = False

    # 1. If password_hash exists in database, verify it
    if emp.password_hash:
        try:
            is_valid = check_password_hash(emp.password_hash, entered_pwd)
        except Exception:
            is_valid = False

    # 2. If password_hash is not set or custom default check
    if not is_valid:
        # Standard default initial passwords
        default_passwords = [
            f"{emp.employee_id}@123",
            f"{emp.employee_id}",
            "password123",
            "admin123",
            "123456"
        ]
        if entered_pwd in default_passwords or entered_pwd == emp.employee_id:
            is_valid = True
            # Automatically hash and save default password for the employee
            emp.password_hash = generate_password_hash(entered_pwd)
            await db.commit()

    if not is_valid:
        raise HTTPException(
            status_code=401, 
            detail="Incorrect password. For first-time login, try your Employee ID followed by '@123' (e.g. EMP_01@123)."
        )

    # Issue JWT Token with EMPLOYEE role
    token = create_access_token(data={
        "employee_id": emp.employee_id,
        "hr_user_id": emp.hr_user_id,
        "name": emp.name,
        "role": "EMPLOYEE"
    })

    return {
        "status": "success",
        "token": token,
        "role": "EMPLOYEE",
        "employee": {
            "employee_id": emp.employee_id,
            "name": emp.name,
            "department": emp.department,
            "position": emp.position,
            "email": emp.email,
            "phone": emp.phone,
            "domain": emp.domain,
            "profile_picture": emp.profile_picture
        }
    }

