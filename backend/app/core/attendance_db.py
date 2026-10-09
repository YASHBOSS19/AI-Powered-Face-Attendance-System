import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func, or_, and_, case
from app.db.models import HRUser, Employee, Attendance, AttendanceStatus

async def get_today_status(db: AsyncSession, name: str, hr_user_id: int, employee_id: str = None):
    """Get today's attendance status for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    name = name.strip()
    
    query = select(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        Attendance.date == today_str
    )
    if employee_id:
        query = query.where(or_(Attendance.employee_id == employee_id, Attendance.name == name))
    else:
        query = query.where(Attendance.name == name)
        
    result = await db.execute(query)
    record = result.scalars().first()
    
    if record:
        return {
            "has_record": True,
            "checkin": record.checkin,
            "checkout": record.checkout,
            "status": record.status.value if record.status else None
        }
    return {
        "has_record": False,
        "checkin": None,
        "checkout": None,
        "status": None
    }

async def record_checkin(db: AsyncSession, name: str, hr_user_id: int, employee_id: str = None):
    """Perform check-in for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    now_time_str = datetime.now().strftime("%H:%M:%S")
    current_hour = datetime.now().hour
    status_val = AttendanceStatus.present if current_hour < 10 else AttendanceStatus.late

    name = name.strip()

    domain = 'Unknown'
    if employee_id:
        emp_query = select(Employee.domain).where(
            Employee.employee_id == employee_id,
            Employee.hr_user_id == hr_user_id
        )
        emp_res = await db.execute(emp_query)
        emp_domain = emp_res.scalars().first()
        if emp_domain:
            domain = emp_domain

    existing = await get_today_status(db, name, hr_user_id, employee_id)
    if existing["has_record"]:
        return {
            "success": True,
            "message": f"Already checked in today at {existing['checkin']}",
            "already_checked_in": True,
            "checkin": existing["checkin"],
            "checkout": existing["checkout"],
            "status": existing["status"]
        }

    new_attendance = Attendance(
        employee_id=employee_id if employee_id else name,
        hr_user_id=hr_user_id,
        name=name,
        domain=domain,
        date=today_str,
        checkin=now_time_str,
        status=status_val
    )
    db.add(new_attendance)
    await db.commit()
    await db.refresh(new_attendance)

    return {
        "success": True,
        "message": f"Checked in successfully at {now_time_str}",
        "already_checked_in": False,
        "checkin": now_time_str,
        "checkout": None,
        "status": status_val.value
    }

async def record_checkout(db: AsyncSession, name: str, hr_user_id: int, employee_id: str = None):
    """Perform check-out for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    now_time_str = datetime.now().strftime("%H:%M:%S")

    name = name.strip()

    domain = 'Unknown'
    if employee_id:
        emp_query = select(Employee.domain).where(
            Employee.employee_id == employee_id,
            Employee.hr_user_id == hr_user_id
        )
        emp_res = await db.execute(emp_query)
        emp_domain = emp_res.scalars().first()
        if emp_domain:
            domain = emp_domain

    existing = await get_today_status(db, name, hr_user_id, employee_id)
    if existing["has_record"]:
        # Update existing
        query = update(Attendance).where(
            Attendance.hr_user_id == hr_user_id,
            Attendance.date == today_str
        )
        if employee_id:
            query = query.where(or_(Attendance.employee_id == employee_id, Attendance.name == name))
        else:
            query = query.where(Attendance.name == name)
            
        query = query.values(checkout=now_time_str)
        await db.execute(query)
        await db.commit()

        return {
            "success": True,
            "message": f"Checked out successfully at {now_time_str}",
            "checkin": existing["checkin"],
            "checkout": now_time_str,
            "status": existing["status"]
        }
    else:
        current_hour = datetime.now().hour
        status_val = AttendanceStatus.present if current_hour < 10 else AttendanceStatus.late
        
        new_attendance = Attendance(
            employee_id=employee_id if employee_id else name,
            hr_user_id=hr_user_id,
            name=name,
            domain=domain,
            date=today_str,
            checkin=now_time_str,
            checkout=now_time_str,
            status=status_val
        )
        db.add(new_attendance)
        await db.commit()
        await db.refresh(new_attendance)

        return {
            "success": True,
            "message": f"Checked out at {now_time_str}",
            "checkin": now_time_str,
            "checkout": now_time_str,
            "status": status_val.value
        }

async def mark_attendance(db: AsyncSession, name: str, hr_user_id: int, employee_id: str = None):
    res = await record_checkin(db, name, hr_user_id, employee_id)
    return not res.get("already_checked_in", False)

async def auto_mark_absent(db: AsyncSession, hr_user_id: int):
    today_str = date.today().strftime("%Y-%m-%d")
    query = update(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        Attendance.date < today_str,
        Attendance.checkout == None,
        Attendance.status != AttendanceStatus.absent
    ).values(status=AttendanceStatus.absent)
    await db.execute(query)
    await db.commit()

async def get_attendance_report(db: AsyncSession, hr_user_id: int, date_from: str = None, date_to: str = None):
    if not date_from:
        date_from = date.today().replace(day=1).strftime("%Y-%m-%d")
    if not date_to:
        date_to = date.today().strftime("%Y-%m-%d")
        
    await auto_mark_absent(db, hr_user_id)
    
    # Left join Employee with Attendance
    query = select(
        Employee.employee_id,
        Employee.name,
        Employee.domain,
        Employee.department,
        Employee.profile_picture,
        func.sum(case((Attendance.status.in_([AttendanceStatus.present, AttendanceStatus.late]), 1), else_=0)).label('days_present'),
        func.sum(case((Attendance.status == AttendanceStatus.late, 1), else_=0)).label('days_late'),
        func.sum(case((Attendance.status == AttendanceStatus.absent, 1), else_=0)).label('days_absent')
    ).outerjoin(
        Attendance,
        and_(
            or_(Employee.employee_id == Attendance.employee_id, Employee.name == Attendance.name),
            Attendance.hr_user_id == hr_user_id,
            Attendance.date.between(date_from, date_to)
        )
    ).where(Employee.hr_user_id == hr_user_id).group_by(Employee.employee_id).order_by(Employee.department, Employee.name)

    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "employee_id": r.employee_id,
            "name": r.name,
            "domain": r.domain,
            "department": r.department,
            "profile_picture": r.profile_picture,
            "days_present": int(r.days_present or 0),
            "days_late": int(r.days_late or 0),
            "days_absent": int(r.days_absent or 0)
        }
        for r in rows
    ]

async def get_employee_attendance(db: AsyncSession, hr_user_id: int, employee_id: str = None, name: str = None, date_from: str = None, date_to: str = None):
    query = select(Attendance).where(Attendance.hr_user_id == hr_user_id)
    
    if employee_id and name:
        query = query.where(or_(Attendance.employee_id == employee_id, Attendance.name == name))
    elif employee_id:
        query = query.where(or_(Attendance.employee_id == employee_id, Attendance.name == employee_id))
    elif name:
        query = query.where(or_(Attendance.name == name, Attendance.employee_id == name))
        
    if date_from and date_to:
        query = query.where(Attendance.date.between(date_from, date_to))
    elif date_from:
        query = query.where(Attendance.date >= date_from)
    elif date_to:
        query = query.where(Attendance.date <= date_to)
        
    query = query.order_by(Attendance.date.desc(), Attendance.checkin.desc())
    
    result = await db.execute(query)
    rows = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "employee_id": r.employee_id,
            "name": r.name,
            "domain": r.domain,
            "date": r.date,
            "checkin": r.checkin,
            "checkout": r.checkout,
            "status": r.status.value if r.status else None
        }
        for r in rows
    ]

async def get_today_attendance_summary(db: AsyncSession, hr_user_id: int):
    today_str = date.today().strftime("%Y-%m-%d")
    
    emp_count_q = select(func.count()).select_from(Employee).where(Employee.hr_user_id == hr_user_id)
    emp_count_res = await db.execute(emp_count_q)
    total_employees = emp_count_res.scalar() or 0

    records_q = select(Attendance, Employee).outerjoin(
        Employee, 
        and_(
            or_(Attendance.employee_id == Employee.employee_id, Attendance.name == Employee.name),
            Employee.hr_user_id == hr_user_id
        )
    ).where(
        Attendance.date == today_str,
        Attendance.hr_user_id == hr_user_id
    ).order_by(Attendance.checkin.desc())
    
    records_res = await db.execute(records_q)
    today_records = []
    
    for att, emp in records_res.all():
        dept = emp.department if emp and emp.department else (emp.domain if emp and emp.domain else 'General')
        pos = emp.position if emp else None
        prof_pic = emp.profile_picture if emp else None
        today_records.append({
            "id": att.id,
            "employee_id": att.employee_id,
            "name": att.name,
            "domain": att.domain,
            "date": att.date,
            "checkin": att.checkin,
            "checkout": att.checkout,
            "status": att.status.value if att.status else None,
            "department": dept,
            "position": pos,
            "profile_picture": prof_pic
        })

    present_today = len(today_records)
    on_time_count = sum(1 for r in today_records if r["status"] == "present")
    late_count = sum(1 for r in today_records if r["status"] == "late")
    absent_count = max(0, total_employees - present_today)

    dept_q = select(
        func.coalesce(Employee.department, Employee.domain, 'General').label('dept_name'),
        func.count(func.distinct(Employee.employee_id)).label('total_emp')
    ).where(Employee.hr_user_id == hr_user_id).group_by('dept_name')
    
    dept_res = await db.execute(dept_q)
    
    dept_summary = []
    for row in dept_res.all():
        d_name = row.dept_name
        d_total = row.total_emp
        d_present = sum(1 for r in today_records if r["department"] == d_name)
        dept_summary.append({
            "department": d_name,
            "total": d_total,
            "present": d_present,
            "rate": round((d_present / d_total * 100), 1) if d_total > 0 else 0
        })

    return {
        "today_date": today_str,
        "total_employees": total_employees,
        "present_today": present_today,
        "on_time_count": on_time_count,
        "late_count": late_count,
        "absent_count": absent_count,
        "today_records": today_records,
        "department_summary": dept_summary
    }

async def update_attendance(db: AsyncSession, record_id: int, hr_user_id: int, checkin: str, checkout: str, status: str):
    status_enum = AttendanceStatus(status) if status else None
    
    query = update(Attendance).where(
        Attendance.id == record_id,
        Attendance.hr_user_id == hr_user_id
    ).values(
        checkin=checkin,
        checkout=checkout,
        status=status_enum
    )
    result = await db.execute(query)
    await db.commit()
    return result.rowcount > 0

async def delete_attendance(db: AsyncSession, record_id: int, hr_user_id: int):
    query = delete(Attendance).where(
        Attendance.id == record_id,
        Attendance.hr_user_id == hr_user_id
    )
    result = await db.execute(query)
    await db.commit()
    return result.rowcount > 0

async def create_manual_attendance(
    db: AsyncSession,
    hr_user_id: int,
    employee_id: str,
    date_str: str,
    checkin: Optional[str] = "09:00:00",
    checkout: Optional[str] = None,
    status: str = "present",
    note: Optional[str] = None
):
    """Create or regularize a manual attendance entry for an employee on any date."""
    # 1. Fetch employee to get accurate name and domain/department
    emp_q = select(Employee).where(
        Employee.employee_id == employee_id,
        Employee.hr_user_id == hr_user_id
    )
    emp_res = await db.execute(emp_q)
    emp = emp_res.scalars().first()
    if not emp:
        # Fallback if employee_id passed as name
        emp_q = select(Employee).where(
            Employee.name == employee_id,
            Employee.hr_user_id == hr_user_id
        )
        emp_res = await db.execute(emp_q)
        emp = emp_res.scalars().first()

    emp_name = emp.name if emp else None
    if not emp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Employee '{employee_id}' was not found in your directory.")
    
    emp_domain = emp.department if emp.department else (emp.domain if emp.domain else "General")
    
    status_lower = status.lower() if status else "present"
    status_enum = AttendanceStatus(status_lower) if status_lower in ["present", "late", "absent"] else AttendanceStatus.present

    # 2. Check if a record already exists on that date
    existing_q = select(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        or_(Attendance.employee_id == employee_id, Attendance.name == emp_name),
        Attendance.date == date_str
    )
    existing_res = await db.execute(existing_q)
    existing = existing_res.scalars().first()

    if existing:
        if checkin:
            existing.checkin = checkin
        if checkout:
            existing.checkout = checkout
        existing.status = status_enum
        await db.commit()
        await db.refresh(existing)
        return {
            "id": existing.id,
            "employee_id": existing.employee_id,
            "name": existing.name,
            "date": existing.date,
            "checkin": existing.checkin,
            "checkout": existing.checkout,
            "status": existing.status.value if existing.status else None,
            "is_updated": True
        }

    # 3. Create new attendance entry
    new_record = Attendance(
        employee_id=emp.employee_id if emp else employee_id,
        hr_user_id=hr_user_id,
        name=emp_name,
        domain=emp_domain,
        date=date_str,
        checkin=checkin,
        checkout=checkout,
        status=status_enum
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    return {
        "id": new_record.id,
        "employee_id": new_record.employee_id,
        "name": new_record.name,
        "date": new_record.date,
        "checkin": new_record.checkin,
        "checkout": new_record.checkout,
        "status": new_record.status.value if new_record.status else None,
        "is_updated": False
    }