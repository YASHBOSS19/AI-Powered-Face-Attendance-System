from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, func, desc

from app.db.database import get_db
from app.db.models import HRUser, Employee, Attendance, AttendanceQuery, AuditLog, SystemAlert, AttendanceStatus
from app.core.security import get_current_user
from app.core.attendance_db import create_manual_attendance
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/attendance-queries", tags=["attendance-queries"])

class AttendanceQueryCreateRequest(BaseModel):
    employee_id: str
    date: str  # YYYY-MM-DD
    checkin_time: Optional[str] = "09:00:00"
    checkout_time: Optional[str] = None
    reason_category: Optional[str] = "Model Failed to Scan"
    explanation: str

class AttendanceQueryApproveRequest(BaseModel):
    approved_checkin: Optional[str] = None
    approved_checkout: Optional[str] = None
    status: Optional[str] = "present"  # "present" or "late"
    hr_notes: Optional[str] = None

class AttendanceQueryRejectRequest(BaseModel):
    hr_notes: str

@router.get("/verify-employee")
async def verify_employee(
    query: str = Query(..., description="Employee ID or name or email"),
    date_str: Optional[str] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public self-service endpoint: verify employee existence,
    profile picture, department, and current attendance status on a specific date.
    """
    clean_q = query.strip()
    emp_q = select(Employee).where(
        or_(
            Employee.employee_id == clean_q,
            Employee.name.ilike(f"%{clean_q}%"),
            Employee.email == clean_q
        )
    )
    result = await db.execute(emp_q)
    emp = result.scalars().first()

    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"Employee '{query}' was not found in the employee directory. Please verify your ID or name."
        )

    # Check attendance on date if provided
    att_info = None
    if date_str:
        att_q = select(Attendance).where(
            Attendance.hr_user_id == emp.hr_user_id,
            or_(Attendance.employee_id == emp.employee_id, Attendance.name == emp.name),
            Attendance.date == date_str
        )
        att_res = await db.execute(att_q)
        att_rec = att_res.scalars().first()
        if att_rec:
            att_info = {
                "has_record": True,
                "checkin": att_rec.checkin,
                "checkout": att_rec.checkout,
                "status": att_rec.status.value if att_rec.status else None
            }
        else:
            att_info = {
                "has_record": False,
                "status": "absent",
                "message": f"No scan record found for {date_str} (Marked Absent)"
            }

    return {
        "status": "success",
        "employee": {
            "employee_id": emp.employee_id,
            "name": emp.name,
            "department": emp.department or emp.domain or "General",
            "position": emp.position,
            "email": emp.email,
            "profile_picture": emp.profile_picture,
            "hr_user_id": emp.hr_user_id
        },
        "attendance": att_info
    }

@router.post("")
async def submit_attendance_query(
    req: AttendanceQueryCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Public self-service endpoint: Allows any employee whose scan failed, camera malfunctioned,
    or was marked absent to submit an attendance dispute query to HR.
    """
    clean_emp_id = req.employee_id.strip()
    if not req.explanation or not req.explanation.strip():
        raise HTTPException(status_code=400, detail="Please provide a clear explanation for HR.")

    # 1. Fetch employee to ensure valid identity
    emp_q = select(Employee).where(
        or_(
            Employee.employee_id == clean_emp_id,
            Employee.name == clean_emp_id
        )
    )
    emp_res = await db.execute(emp_q)
    emp = emp_res.scalars().first()

    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"Employee '{req.employee_id}' does not exist in the system. Please verify your Employee ID."
        )

    clean_checkin = req.checkin_time.strip() if req.checkin_time else "09:00:00"
    clean_checkout = req.checkout_time.strip() if req.checkout_time else None
    reason_cat = req.reason_category or "Model Failed to Scan"

    # 2. Check if a pending query already exists for this date
    existing_q = select(AttendanceQuery).where(
        AttendanceQuery.employee_id == emp.employee_id,
        AttendanceQuery.date == req.date,
        AttendanceQuery.status == "pending"
    )
    existing_res = await db.execute(existing_q)
    existing_pending = existing_res.scalars().first()

    if existing_pending:
        # Update existing pending query
        existing_pending.checkin_time = clean_checkin
        existing_pending.checkout_time = clean_checkout
        existing_pending.reason_category = reason_cat
        existing_pending.explanation = req.explanation.strip()
        existing_pending.created_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing_pending)
        query_item = existing_pending
        action_msg = "Your existing pending query was updated and notified to HR."
    else:
        # Create new query
        new_q = AttendanceQuery(
            hr_user_id=emp.hr_user_id,
            employee_id=emp.employee_id,
            employee_name=emp.name,
            department=emp.department or emp.domain or "General",
            date=req.date,
            checkin_time=clean_checkin,
            checkout_time=clean_checkout,
            reason_category=reason_cat,
            explanation=req.explanation.strip(),
            status="pending"
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        query_item = new_q
        action_msg = "Attendance query submitted to HR successfully."

    # 3. Create a SystemAlert for HR
    try:
        alert = SystemAlert(
            tenant_id=emp.hr_user_id,
            type="ATTENDANCE_QUERY",
            severity="warning",
            title=f"Attendance Dispute: {emp.name}",
            message=f"{emp.name} ({emp.employee_id}) reported missed attendance for {req.date}. Reason: {reason_cat}. Note: {req.explanation.strip()[:100]}",
            data={
                "query_id": query_item.id,
                "employee_id": emp.employee_id,
                "employee_name": emp.name,
                "date": req.date,
                "reason_category": reason_cat
            }
        )
        db.add(alert)
        await db.commit()
    except Exception as alert_err:
        print("[!] Could not create dispute alert:", alert_err)

    # 4. Broadcast live WebSocket message
    try:
        await manager.broadcast({
            "type": "NEW_ATTENDANCE_QUERY",
            "query_id": query_item.id,
            "employee_id": emp.employee_id,
            "employee_name": emp.name,
            "department": emp.department or emp.domain or "General",
            "date": req.date,
            "checkin_time": query_item.checkin_time,
            "reason_category": reason_cat,
            "explanation": query_item.explanation,
            "status": "pending",
            "created_at": query_item.created_at.isoformat() if query_item.created_at else None
        })
    except Exception as ws_err:
        print("[!] Could not broadcast dispute WS:", ws_err)

    return {
        "status": "success",
        "message": action_msg,
        "query": {
            "id": query_item.id,
            "employee_id": query_item.employee_id,
            "employee_name": query_item.employee_name,
            "department": query_item.department,
            "date": query_item.date,
            "checkin_time": query_item.checkin_time,
            "checkout_time": query_item.checkout_time,
            "reason_category": query_item.reason_category,
            "explanation": query_item.explanation,
            "status": query_item.status,
            "created_at": str(query_item.created_at)
        }
    }

@router.get("/employee/{employee_id}")
async def get_employee_queries(
    employee_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public self-service endpoint: Allows an employee to check the resolution status
    of their submitted queries using their Employee ID.
    """
    clean_id = employee_id.strip()
    q = select(AttendanceQuery).where(
        or_(
            AttendanceQuery.employee_id == clean_id,
            AttendanceQuery.employee_name == clean_id
        )
    ).order_by(desc(AttendanceQuery.created_at))

    res = await db.execute(q)
    rows = res.scalars().all()

    return {
        "status": "success",
        "count": len(rows),
        "queries": [
            {
                "id": r.id,
                "employee_id": r.employee_id,
                "employee_name": r.employee_name,
                "department": r.department,
                "date": r.date,
                "checkin_time": r.checkin_time,
                "checkout_time": r.checkout_time,
                "reason_category": r.reason_category,
                "explanation": r.explanation,
                "status": r.status,
                "hr_notes": r.hr_notes,
                "resolved_by": r.resolved_by,
                "created_at": str(r.created_at) if r.created_at else None,
                "resolved_at": str(r.resolved_at) if r.resolved_at else None
            }
            for r in rows
        ]
    }

@router.get("")
async def list_queries(
    status: Optional[str] = Query(None, description="'all', 'pending', 'approved', 'rejected'"),
    search: Optional[str] = Query(None, description="Search employee name, ID or reason"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    HR / Admin endpoint: List all attendance queries with counts, search, and filters.
    """
    # Base query for counts
    count_base = select(AttendanceQuery).where(
        or_(AttendanceQuery.hr_user_id == hr_user_id, AttendanceQuery.hr_user_id == 0)
    )
    all_res = await db.execute(count_base)
    all_items = all_res.scalars().all()

    total_count = len(all_items)
    pending_count = sum(1 for q in all_items if q.status == "pending")
    approved_count = sum(1 for q in all_items if q.status == "approved")
    rejected_count = sum(1 for q in all_items if q.status == "rejected")

    # Filtered query
    stmt = select(AttendanceQuery).where(
        or_(AttendanceQuery.hr_user_id == hr_user_id, AttendanceQuery.hr_user_id == 0)
    )

    if status and status.lower() != "all":
        stmt = stmt.where(AttendanceQuery.status == status.lower())

    if date_from and date_to:
        stmt = stmt.where(AttendanceQuery.date.between(date_from, date_to))
    elif date_from:
        stmt = stmt.where(AttendanceQuery.date >= date_from)
    elif date_to:
        stmt = stmt.where(AttendanceQuery.date <= date_to)

    if search and search.strip():
        s = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                AttendanceQuery.employee_name.ilike(s),
                AttendanceQuery.employee_id.ilike(s),
                AttendanceQuery.department.ilike(s),
                AttendanceQuery.reason_category.ilike(s),
                AttendanceQuery.explanation.ilike(s)
            )
        )

    stmt = stmt.order_by(
        # Show pending first, then by created_at desc
        desc(AttendanceQuery.status == "pending"),
        desc(AttendanceQuery.created_at)
    )

    res = await db.execute(stmt)
    records = res.scalars().all()

    return {
        "status": "success",
        "counts": {
            "total": total_count,
            "pending": pending_count,
            "approved": approved_count,
            "rejected": rejected_count
        },
        "queries": [
            {
                "id": r.id,
                "hr_user_id": r.hr_user_id,
                "employee_id": r.employee_id,
                "employee_name": r.employee_name,
                "department": r.department,
                "date": r.date,
                "checkin_time": r.checkin_time,
                "checkout_time": r.checkout_time,
                "reason_category": r.reason_category,
                "explanation": r.explanation,
                "status": r.status,
                "hr_notes": r.hr_notes,
                "resolved_by": r.resolved_by,
                "created_at": str(r.created_at) if r.created_at else None,
                "resolved_at": str(r.resolved_at) if r.resolved_at else None
            }
            for r in records
        ]
    }

@router.post("/{query_id}/approve")
async def approve_query(
    query_id: int,
    req: AttendanceQueryApproveRequest,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    HR / Admin action: Approves the attendance query and marks the employee as Present
    (or Late) for that date. Updates attendance DB and broadcasts live WebSocket event.
    """
    # 1. Fetch query
    q_stmt = select(AttendanceQuery).where(AttendanceQuery.id == query_id)
    res = await db.execute(q_stmt)
    query_item = res.scalars().first()

    if not query_item:
        raise HTTPException(status_code=404, detail="Attendance query not found")

    # 2. Fetch HR user details for logging
    hr_res = await db.execute(select(HRUser).where(HRUser.id == hr_user_id))
    hr_user = hr_res.scalars().first()
    hr_name = hr_user.username if hr_user else "HR Admin"

    # Determine checkin, checkout, status
    checkin_val = req.approved_checkin or query_item.checkin_time or "09:00:00"
    checkout_val = req.approved_checkout or query_item.checkout_time
    status_val = req.status.lower() if req.status in ["present", "late"] else "present"
    notes_val = req.hr_notes or f"Approved by {hr_name}: Regularized missed scan ({query_item.reason_category})"

    # 3. Create or regularize attendance record in database
    target_hr_user_id = query_item.hr_user_id if query_item.hr_user_id is not None else hr_user_id
    att_record = await create_manual_attendance(
        db=db,
        hr_user_id=target_hr_user_id,
        employee_id=query_item.employee_id,
        date_str=query_item.date,
        checkin=checkin_val,
        checkout=checkout_val,
        status=status_val,
        note=notes_val
    )

    # 4. Update AttendanceQuery record
    query_item.status = "approved"
    query_item.hr_notes = notes_val
    query_item.resolved_by = hr_name
    query_item.resolved_at = datetime.utcnow()
    if req.approved_checkin:
        query_item.checkin_time = req.approved_checkin
    if req.approved_checkout:
        query_item.checkout_time = req.approved_checkout

    # 5. Log in AuditLog
    audit = AuditLog(
        admin_id=hr_user_id,
        admin_username=hr_name,
        action="APPROVE_ATTENDANCE_QUERY",
        resource=f"{query_item.employee_name} ({query_item.employee_id})",
        details=f"Approved query #{query_item.id} for {query_item.date}. Attendance marked as {status_val.upper()} ({checkin_val}). Remarks: {notes_val}"
    )
    db.add(audit)

    # 6. Add success alert
    try:
        success_alert = SystemAlert(
            tenant_id=target_hr_user_id,
            type="ATTENDANCE_QUERY_APPROVED",
            severity="success",
            title=f"Dispute Resolved: {query_item.employee_name}",
            message=f"Attendance query #{query_item.id} for {query_item.employee_name} on {query_item.date} was approved by {hr_name}. Attendance set to {status_val.upper()}."
        )
        db.add(success_alert)
    except Exception:
        pass

    await db.commit()
    await db.refresh(query_item)

    # 7. Broadcast live WebSocket events
    await manager.broadcast({
        "type": "ATTENDANCE_MARKED",
        "name": query_item.employee_name,
        "employee_id": query_item.employee_id,
        "status": status_val,
        "checkin": checkin_val,
        "checkout": checkout_val,
        "date": query_item.date,
        "query_id": query_item.id
    })

    await manager.broadcast({
        "type": "ATTENDANCE_QUERY_RESOLVED",
        "query_id": query_item.id,
        "status": "approved",
        "employee_id": query_item.employee_id,
        "employee_name": query_item.employee_name,
        "date": query_item.date,
        "resolved_by": hr_name
    })

    return {
        "status": "success",
        "message": f"Query approved successfully! Attendance for {query_item.employee_name} marked as {status_val.upper()}.",
        "query": {
            "id": query_item.id,
            "status": query_item.status,
            "hr_notes": query_item.hr_notes,
            "resolved_by": query_item.resolved_by,
            "resolved_at": str(query_item.resolved_at)
        },
        "attendance": att_record
    }

@router.post("/{query_id}/reject")
async def reject_query(
    query_id: int,
    req: AttendanceQueryRejectRequest,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    HR / Admin action: Rejects the attendance query with remarks.
    """
    if not req.hr_notes or not req.hr_notes.strip():
        raise HTTPException(status_code=400, detail="Please provide a reason / remark for rejecting the query.")

    q_stmt = select(AttendanceQuery).where(AttendanceQuery.id == query_id)
    res = await db.execute(q_stmt)
    query_item = res.scalars().first()

    if not query_item:
        raise HTTPException(status_code=404, detail="Attendance query not found")

    hr_res = await db.execute(select(HRUser).where(HRUser.id == hr_user_id))
    hr_user = hr_res.scalars().first()
    hr_name = hr_user.username if hr_user else "HR Admin"

    # Update query
    query_item.status = "rejected"
    query_item.hr_notes = req.hr_notes.strip()
    query_item.resolved_by = hr_name
    query_item.resolved_at = datetime.utcnow()

    # Log in AuditLog
    audit = AuditLog(
        admin_id=hr_user_id,
        admin_username=hr_name,
        action="REJECT_ATTENDANCE_QUERY",
        resource=f"{query_item.employee_name} ({query_item.employee_id})",
        details=f"Rejected query #{query_item.id} for {query_item.date}. Reason: {req.hr_notes.strip()}"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(query_item)

    # Broadcast WebSocket event
    await manager.broadcast({
        "type": "ATTENDANCE_QUERY_RESOLVED",
        "query_id": query_item.id,
        "status": "rejected",
        "employee_id": query_item.employee_id,
        "employee_name": query_item.employee_name,
        "date": query_item.date,
        "resolved_by": hr_name
    })

    return {
        "status": "success",
        "message": f"Query rejected. Employee notified in tracking log.",
        "query": {
            "id": query_item.id,
            "status": query_item.status,
            "hr_notes": query_item.hr_notes,
            "resolved_by": query_item.resolved_by,
            "resolved_at": str(query_item.resolved_at)
        }
    }

@router.delete("/{query_id}")
async def delete_query(
    query_id: int,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    HR / Admin action: Delete an attendance query record.
    """
    q_stmt = select(AttendanceQuery).where(AttendanceQuery.id == query_id)
    res = await db.execute(q_stmt)
    query_item = res.scalars().first()

    if not query_item:
        raise HTTPException(status_code=404, detail="Attendance query not found")

    await db.delete(query_item)
    await db.commit()

    return {"status": "success", "message": "Attendance query deleted successfully."}
