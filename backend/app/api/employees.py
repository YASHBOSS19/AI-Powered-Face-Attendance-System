from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.schemas.models import EmployeeRegistration, FaceLinkRequest
from app.db.models import Employee, FaceEmbedding, Attendance, SystemAlert
from app.core.security import get_current_user
from app.core.storage import save_to_r2_or_local
from app.api.settings import get_settings_data
from pydantic import BaseModel
import csv
import json
import codecs
import re
from typing import Optional, Dict
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import os
import shutil
from pathlib import Path
import json

router = APIRouter(prefix="/api/employees", tags=["employees"])

@router.get("/export-json")
async def export_json(db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    # Get employees
    emp_query = select(Employee).where(Employee.hr_user_id == hr_user_id)
    emp_res = await db.execute(emp_query)
    employees = emp_res.scalars().all()
    
    # Get attendance
    att_query = select(Attendance).where(Attendance.hr_user_id == hr_user_id)
    att_res = await db.execute(att_query)
    attendance = att_res.scalars().all()
    
    attendance_by_emp = {}
    for record in attendance:
        emp_id = record.employee_id
        if emp_id not in attendance_by_emp:
            attendance_by_emp[emp_id] = []
        
        attendance_by_emp[emp_id].append({
            "id": record.id,
            "date": record.date,
            "checkin": record.checkin,
            "checkout": record.checkout,
            "status": record.status.value if record.status else None
        })
        
    export_data = {
        "platform": "Identifi HR Portal",
        "employees": []
    }
    
    for emp in employees:
        emp_data = {
            "employee_id": emp.employee_id,
            "name": emp.name,
            "domain": emp.domain,
            "department": emp.department,
            "position": emp.position,
            "profile_picture": emp.profile_picture
        }
        emp_data["attendance_logs"] = attendance_by_emp.get(emp.employee_id, [])
        export_data["employees"].append(emp_data)
        
    json_str = json.dumps(export_data, indent=2, default=str)
    
    return Response(
        content=json_str, 
        media_type="application/json", 
        headers={"Content-Disposition": "attachment; filename=platform_data_export.json"}
    )

@router.get("")
async def list_employees(db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    query = select(Employee, FaceEmbedding.embedding_name).outerjoin(
        FaceEmbedding, 
        (Employee.employee_id == FaceEmbedding.employee_id) & (Employee.hr_user_id == FaceEmbedding.hr_user_id)
    ).where(Employee.hr_user_id == hr_user_id)
    
    result = await db.execute(query)
    
    employees_list = []
    for emp, embedding_name in result.all():
        employees_list.append({
            "employee_id": emp.employee_id,
            "name": emp.name,
            "domain": emp.domain,
            "department": emp.department,
            "position": emp.position,
            "email": emp.email,
            "phone": emp.phone,
            "custom_fields": emp.custom_fields,
            "registered_date": str(emp.registered_date) if emp.registered_date else None,
            "embedding_name": embedding_name,
            "profile_picture": emp.profile_picture
        })
        
    return {"status": "success", "count": len(employees_list), "employees": employees_list}

async def check_and_create_limit_alerts(db: AsyncSession, hr_user_id: int):
    try:
        from datetime import datetime, timedelta
        settings = get_settings_data(hr_user_id)
        max_limit = settings.get("maxEmployees", 50)
        plan_name = settings.get("planName", "Growth / Basic")
        emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == hr_user_id))
        total_emp = emp_res.scalar() or 0
        company_name = settings.get("companyName", f"Tenant #{hr_user_id}")
        usage_pct = round((total_emp / max_limit) * 100, 1) if max_limit > 0 else 0

        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)

        if total_emp >= max_limit:
            rec_q = select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "LIMIT_EXCEEDED",
                SystemAlert.created_at >= last_24h
            )
            rec = (await db.execute(rec_q)).scalars().first()
            if not rec:
                db.add(SystemAlert(
                    tenant_id=hr_user_id,
                    type="LIMIT_EXCEEDED",
                    severity="critical",
                    title="Subscription Seat Limit Reached",
                    message=f"Tenant '{company_name}' has reached 100% employee capacity ({total_emp}/{max_limit} seats) under the {plan_name} plan. Additional employee registrations are blocked until upgraded.",
                    data={"current": total_emp, "limit": max_limit, "pct": usage_pct, "plan": plan_name}
                ))
                await db.commit()
        elif total_emp >= int(0.8 * max_limit):
            rec_q = select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "LIMIT_WARNING",
                SystemAlert.created_at >= last_24h
            )
            rec = (await db.execute(rec_q)).scalars().first()
            if not rec:
                db.add(SystemAlert(
                    tenant_id=hr_user_id,
                    type="LIMIT_WARNING",
                    severity="warning",
                    title="Subscription Capacity Warning (≥80%)",
                    message=f"Tenant '{company_name}' is nearing employee capacity limit ({total_emp}/{max_limit} seats, {usage_pct}% used) under the {plan_name} plan.",
                    data={"current": total_emp, "limit": max_limit, "pct": usage_pct, "plan": plan_name}
                ))
                await db.commit()
    except Exception as e:
        print(f"Notice: Limit alert check exception: {e}")

@router.post("/register")
async def register_employee(
    employee_id: str = Form(...),
    name: str = Form(...),
    domain: str = Form(...),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    custom_fields: Optional[str] = Form(None),
    profile_picture: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db), 
    hr_user_id: int = Depends(get_current_user)
):
    # Parse custom fields
    parsed_custom_fields = None
    if custom_fields:
        try:
            parsed_custom_fields = json.loads(custom_fields)
        except Exception:
            pass

    # 1. Check Tenant Subscription & Seat Capacity Limit
    settings = get_settings_data(hr_user_id)
    max_employees = settings.get("maxEmployees", 50)
    plan_name = settings.get("planName", "Growth / Basic")
    
    emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == hr_user_id))
    current_count = emp_res.scalar() or 0
    
    if current_count >= max_employees:
        # Trigger Limit Exceeded alert
        await check_and_create_limit_alerts(db, hr_user_id)
        raise HTTPException(
            status_code=403, 
            detail=f"Employee seat capacity limit reached ({current_count}/{max_employees}) for your '{plan_name}' subscription plan. Please contact your Super Administrator to upgrade your plan."
        )

    profile_picture_url = None
    if profile_picture:
        filename = f"{employee_id}_{profile_picture.filename}"
        file_content = await profile_picture.read()
        profile_picture_url = save_to_r2_or_local(
            file_bytes=file_content,
            filename=filename,
            subfolder="profiles",
            content_type=profile_picture.content_type or "image/jpeg"
        )

    try:
        new_emp = Employee(
            employee_id=employee_id,
            hr_user_id=hr_user_id,
            name=name,
            domain=domain,
            department=department,
            position=position,
            email=email,
            phone=phone,
            custom_fields=parsed_custom_fields,
            profile_picture=profile_picture_url
        )
        db.add(new_emp)
        await db.commit()
        
        # Check if tenant is nearing or at limit
        await check_and_create_limit_alerts(db, hr_user_id)
        
        return {
            "status": "success", 
            "message": "Employee registered successfully",
            "capacity": {
                "current": current_count + 1,
                "max": max_employees,
                "plan": plan_name
            }
        }
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Employee ID already exists")

@router.post("/link-face")
async def link_face(data: FaceLinkRequest, db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    try:
        query = select(FaceEmbedding).where(FaceEmbedding.employee_id == data.employee_id, FaceEmbedding.hr_user_id == hr_user_id)
        result = await db.execute(query)
        existing = result.scalars().first()
        
        if existing:
            existing.embedding_name = data.embedding_name
        else:
            new_link = FaceEmbedding(
                employee_id=data.employee_id,
                hr_user_id=hr_user_id,
                embedding_name=data.embedding_name
            )
            db.add(new_link)
            
        await db.commit()
        return {"status": "success", "message": "Face linked successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-upload")
async def bulk_upload(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    db: AsyncSession = Depends(get_db),
    hr_user_id: int = Depends(get_current_user)
):
    try:
        col_mapping = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Check available seats before processing
    settings = get_settings_data(hr_user_id)
    max_employees = settings.get("maxEmployees", 50)
    plan_name = settings.get("planName", "Growth / Basic")
    
    emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == hr_user_id))
    current_count = emp_res.scalar() or 0
    available_seats = max(0, max_employees - current_count)
    
    if available_seats <= 0:
        await check_and_create_limit_alerts(db, hr_user_id)
        raise HTTPException(
            status_code=403,
            detail=f"Cannot import employees: Seat capacity limit reached ({current_count}/{max_employees}) for your '{plan_name}' subscription plan. Please contact your Super Administrator to upgrade your plan."
        )

    content = await file.read()
    csv_reader = csv.DictReader(codecs.iterdecode(content.splitlines(), 'utf-8'))
    
    success_count = 0
    skipped_count = 0
    limit_hit = False

    mapped_csv_headers = set(v for k, v in col_mapping.items() if v and isinstance(v, str))

    for row in csv_reader:
        if success_count >= available_seats:
            limit_hit = True
            break

        emp_id_col = col_mapping.get('employee_id')
        name_col = col_mapping.get('name')
        
        if not emp_id_col or not name_col:
            continue
            
        emp_id = row.get(emp_id_col, "").strip()
        name = row.get(name_col, "").strip()
        
        if not emp_id or not name:
            skipped_count += 1
            continue

        domain = row.get(col_mapping.get('domain', ''), "").strip()
        department = row.get(col_mapping.get('department', ''), "").strip()
        position = row.get(col_mapping.get('position', ''), "").strip()

        custom_fields_dict = {}
        for csv_header, value in row.items():
            if csv_header and csv_header not in mapped_csv_headers:
                val = value.strip() if value else ""
                if val:
                    custom_fields_dict[csv_header] = val

        try:
            new_emp = Employee(
                employee_id=emp_id,
                hr_user_id=hr_user_id,
                name=name,
                domain=domain,
                department=department,
                position=position,
                custom_fields=custom_fields_dict if custom_fields_dict else None
            )
            db.add(new_emp)
            await db.commit()
            success_count += 1
        except IntegrityError:
            await db.rollback()
            skipped_count += 1

    if success_count > 0 or limit_hit:
        await check_and_create_limit_alerts(db, hr_user_id)

    msg = f"Successfully imported {success_count} employees."
    if limit_hit:
        msg += f" Import paused: Plan seat capacity limit ({max_employees} seats for {plan_name}) reached."

    return {
        "status": "success", 
        "message": msg,
        "success_count": success_count,
        "skipped_count": skipped_count,
        "limit_reached": limit_hit or (current_count + success_count >= max_employees),
        "total_employees": current_count + success_count,
        "max_employees": max_employees,
        "plan_name": plan_name
    }

@router.post("/sql-upload")
async def sql_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    hr_user_id: int = Depends(get_current_user)
):
    if not (file.filename.endswith('.sql') or file.filename.endswith('.db')):
        raise HTTPException(status_code=400, detail="Only SQL dump files are allowed (.sql or .db)")

    # Check available seats before processing
    settings = get_settings_data(hr_user_id)
    max_employees = settings.get("maxEmployees", 50)
    plan_name = settings.get("planName", "Growth / Basic")
    
    emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == hr_user_id))
    current_count = emp_res.scalar() or 0
    available_seats = max(0, max_employees - current_count)
    
    if available_seats <= 0:
        await check_and_create_limit_alerts(db, hr_user_id)
        raise HTTPException(
            status_code=403,
            detail=f"Cannot import employees: Seat capacity limit reached ({current_count}/{max_employees}) for your '{plan_name}' subscription plan. Please contact your Super Administrator to upgrade your plan."
        )

    content = await file.read()
    text = content.decode('utf-8', errors='ignore')
    
    success_count = 0
    skipped_count = 0
    limit_hit = False
    
    for match in re.finditer(r"INSERT INTO `?employees`?.*?VALUES\s*(.+?);", text, re.IGNORECASE | re.DOTALL):
        if limit_hit:
            break
        values_str = match.group(1)
        
        for tuple_match in re.finditer(r"\((.*?)\)", values_str):
            if success_count >= available_seats:
                limit_hit = True
                break

            inner_vals = tuple_match.group(1)
            strings = re.findall(r"'([^']*)'", inner_vals)
            
            if len(strings) >= 2:
                emp_id = strings[0]
                name = strings[1]
                domain = strings[2] if len(strings) > 2 else ""
                dept = strings[3] if len(strings) > 3 else ""
                pos = strings[4] if len(strings) > 4 else ""
                
                try:
                    new_emp = Employee(
                        employee_id=emp_id,
                        hr_user_id=hr_user_id,
                        name=name,
                        domain=domain,
                        department=dept,
                        position=pos
                    )
                    db.add(new_emp)
                    await db.commit()
                    success_count += 1
                except IntegrityError:
                    await db.rollback()
                    skipped_count += 1
                    
    if success_count > 0 or limit_hit:
        await check_and_create_limit_alerts(db, hr_user_id)

    msg = f"Successfully imported {success_count} employees."
    if limit_hit:
        msg += f" Import paused: Plan seat capacity limit ({max_employees} seats for {plan_name}) reached."

    return {
        "status": "success", 
        "message": msg,
        "success_count": success_count,
        "skipped_count": skipped_count,
        "limit_reached": limit_hit or (current_count + success_count >= max_employees),
        "total_employees": current_count + success_count,
        "max_employees": max_employees,
        "plan_name": plan_name
    }

class EmployeeUpdateRequest(BaseModel):
    name: str
    domain: str
    department: str
    position: str
    email: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[Dict[str, str]] = None

@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    name: str = Form(...),
    domain: str = Form(...),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    custom_fields: Optional[str] = Form(None),
    profile_picture: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db), 
    hr_user_id: int = Depends(get_current_user)
):
    query = select(Employee).where(Employee.employee_id == employee_id, Employee.hr_user_id == hr_user_id)
    result = await db.execute(query)
    emp = result.scalars().first()
    
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    parsed_custom_fields = None
    if custom_fields:
        try:
            parsed_custom_fields = json.loads(custom_fields)
        except Exception:
            pass

    if profile_picture:
        filename = f"{employee_id}_{profile_picture.filename}"
        file_content = await profile_picture.read()
        emp.profile_picture = save_to_r2_or_local(
            file_bytes=file_content,
            filename=filename,
            subfolder="profiles",
            content_type=profile_picture.content_type or "image/jpeg"
        )

    emp.name = name
    emp.domain = domain
    emp.department = department
    emp.position = position
    emp.email = email
    emp.phone = phone
    if custom_fields:
        emp.custom_fields = parsed_custom_fields
    
    await db.commit()
    
    return {"status": "success", "message": "Employee updated successfully"}

@router.delete("/{employee_id}")
async def delete_employee(employee_id: str, db: AsyncSession = Depends(get_db), hr_user_id: int = Depends(get_current_user)):
    # Relationships with cascade="all, delete-orphan" will handle FaceEmbedding and Attendance cleanup
    query = delete(Employee).where(Employee.employee_id == employee_id, Employee.hr_user_id == hr_user_id)
    result = await db.execute(query)
    await db.commit()
    
    if result.rowcount > 0:
        return {"status": "success", "message": "Employee deleted successfully"}
    raise HTTPException(status_code=404, detail="Employee not found")
