"""
Employee Self-Service Portal API Router
Provides comprehensive personal dashboard, attendance activity, track records,
leave management (balances, requests, approvals), attendance dispute queries,
analytics, and profile settings for authenticated employees.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_, desc, update, delete
from datetime import datetime, date, timedelta
import calendar
from werkzeug.security import check_password_hash, generate_password_hash

from app.db.database import get_db
from app.db.models import Employee, Attendance, AttendanceStatus, AttendanceQuery, LeaveRequest, HRUser
from app.core.security import get_current_employee, get_current_user
from app.core.ws_manager import manager
from app.api.settings import get_settings_data

router = APIRouter(prefix="/api/employee", tags=["employee-portal"])


# -------------------------------------------------------------
# Pydantic Request Models
# -------------------------------------------------------------

class LeaveApplyRequest(BaseModel):
    leave_type: str = "Casual Leave" # Casual Leave, Sick Leave, Paid / Annual Leave, Unpaid Leave
    start_date: str # YYYY-MM-DD
    end_date: str   # YYYY-MM-DD
    reason: str

class LeaveReviewRequest(BaseModel):
    action: str # "approve" or "reject"
    review_notes: Optional[str] = None

class EmployeeQueryRequest(BaseModel):
    date: str # YYYY-MM-DD
    reason_category: str = "Missed Scan"
    explanation: str
    checkin_time: Optional[str] = "09:00:00"
    checkout_time: Optional[str] = "18:00:00"

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------

def parse_duration(checkin_str: Optional[str], checkout_str: Optional[str]) -> str:
    if not checkin_str:
        return "--"
    if not checkout_str:
        return "In Progress"
    try:
        t1 = datetime.strptime(checkin_str, "%H:%M:%S")
        t2 = datetime.strptime(checkout_str, "%H:%M:%S")
        diff = t2 - t1
        secs = int(diff.total_seconds())
        if secs < 0:
            return "--"
        hrs = secs // 3600
        mins = (secs % 3600) // 60
        return f"{hrs}h {mins}m"
    except Exception:
        return "--"

def parse_duration_hours(checkin_str: Optional[str], checkout_str: Optional[str]) -> float:
    if not checkin_str or not checkout_str:
        return 0.0
    try:
        t1 = datetime.strptime(checkin_str, "%H:%M:%S")
        t2 = datetime.strptime(checkout_str, "%H:%M:%S")
        diff = t2 - t1
        secs = int(diff.total_seconds())
        if secs < 0:
            return 0.0
        return round(secs / 3600.0, 2)
    except Exception:
        return 0.0


# -------------------------------------------------------------
# 1. Employee Profile Endpoint
# -------------------------------------------------------------

@router.get("/profile")
async def get_employee_profile(
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    hr_user_id = current_emp["hr_user_id"]

    q = select(Employee).where(
        Employee.employee_id == emp_id,
        Employee.hr_user_id == hr_user_id
    )
    res = await db.execute(q)
    emp = res.scalars().first()

    if not emp:
        # Fallback without hr_user_id filter
        q2 = select(Employee).where(Employee.employee_id == emp_id)
        res2 = await db.execute(q2)
        emp = res2.scalars().first()

    if not emp:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # Get HR Company Name
    company_name = "Organization"
    try:
        settings = get_settings_data(emp.hr_user_id)
        company_name = settings.get("companyName", "Organization")
    except Exception:
        pass

    return {
        "status": "success",
        "employee": {
            "employee_id": emp.employee_id,
            "name": emp.name,
            "domain": emp.domain,
            "department": emp.department or "General Operations",
            "position": emp.position or "Staff Member",
            "email": emp.email or "",
            "phone": emp.phone or "",
            "profile_picture": emp.profile_picture,
            "registered_date": emp.registered_date.strftime("%Y-%m-%d") if emp.registered_date else None,
            "company_name": company_name
        }
    }


# -------------------------------------------------------------
# 2. Comprehensive Employee Dashboard
# -------------------------------------------------------------

@router.get("/dashboard")
async def get_employee_dashboard(
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    hr_user_id = current_emp["hr_user_id"]
    today_str = date.today().strftime("%Y-%m-%d")
    current_year_month = date.today().strftime("%Y-%m")

    # 1. Fetch Employee Details
    emp_q = select(Employee).where(Employee.employee_id == emp_id)
    emp_res = await db.execute(emp_q)
    emp = emp_res.scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # 2. Today's Attendance Record
    today_q = select(Attendance).where(
        Attendance.employee_id == emp_id,
        Attendance.date == today_str
    )
    today_rec = (await db.execute(today_q)).scalars().first()

    today_status_data = {
        "date": today_str,
        "has_record": bool(today_rec and today_rec.checkin),
        "checkin": today_rec.checkin if today_rec else None,
        "checkout": today_rec.checkout if today_rec else None,
        "duration": parse_duration(today_rec.checkin, today_rec.checkout) if today_rec else "--",
        "status": today_rec.status.value if (today_rec and today_rec.status) else ("absent" if date.today().weekday() < 5 else "weekend")
    }

    # 3. Monthly Attendance Statistics
    month_q = select(Attendance).where(
        Attendance.employee_id == emp_id,
        Attendance.date.like(f"{current_year_month}%")
    ).order_by(Attendance.date.desc())
    month_recs = (await db.execute(month_q)).scalars().all()

    present_count = 0
    late_count = 0
    total_hours = 0.0

    for rec in month_recs:
        st = rec.status.value if rec.status else ""
        if rec.checkin:
            present_count += 1
            if st == "late":
                late_count += 1
            total_hours += parse_duration_hours(rec.checkin, rec.checkout)

    # Determine passed working days this month up to today (excluding weekends)
    today_day = date.today().day
    current_year = date.today().year
    current_month = date.today().month
    working_days_so_far = 0
    for d in range(1, today_day + 1):
        try:
            curr_d = date(current_year, current_month, d)
            if curr_d.weekday() < 5:  # Monday to Friday
                working_days_so_far += 1
        except Exception:
            pass

    working_days_so_far = max(working_days_so_far, 1)
    absent_count = max(0, working_days_so_far - present_count)
    attendance_rate = min(100.0, round((present_count / working_days_so_far) * 100, 1))
    punctuality_rate = min(100.0, round(((present_count - late_count) / max(1, present_count)) * 100, 1))

    # 4. Leave Balance & Status Summary
    TOTAL_ANNUAL_LEAVE = 24  # Standard annual allowance
    leaves_q = select(LeaveRequest).where(LeaveRequest.employee_id == emp_id)
    all_leaves = (await db.execute(leaves_q)).scalars().all()

    taken_leaves = sum(l.days_count for l in all_leaves if l.status == "approved")
    pending_leaves = sum(l.days_count for l in all_leaves if l.status == "pending")
    remaining_balance = max(0, TOTAL_ANNUAL_LEAVE - taken_leaves)

    # 5. Recent Activity (Latest 5 records)
    recent_activity = []
    for rec in month_recs[:5]:
        recent_activity.append({
            "id": rec.id,
            "date": rec.date,
            "day": datetime.strptime(rec.date, "%Y-%m-%d").strftime("%A"),
            "checkin": rec.checkin,
            "checkout": rec.checkout,
            "duration": parse_duration(rec.checkin, rec.checkout),
            "status": rec.status.value if rec.status else "present"
        })

    # Company info
    company_name = "Company"
    try:
        settings = get_settings_data(emp.hr_user_id)
        company_name = settings.get("companyName", "Company")
    except Exception:
        pass

    return {
        "status": "success",
        "employee": {
            "employee_id": emp.employee_id,
            "name": emp.name,
            "department": emp.department or "Operations",
            "position": emp.position or "Staff Member",
            "profile_picture": emp.profile_picture,
            "company_name": company_name
        },
        "today": today_status_data,
        "monthly_summary": {
            "month_label": date.today().strftime("%B %Y"),
            "working_days": working_days_so_far,
            "present_days": present_count,
            "late_days": late_count,
            "absent_days": absent_count,
            "attendance_rate": attendance_rate,
            "punctuality_rate": punctuality_rate,
            "total_hours": round(total_hours, 1),
            "avg_hours_per_day": round(total_hours / max(1, present_count), 1)
        },
        "leave_summary": {
            "total_quota": TOTAL_ANNUAL_LEAVE,
            "taken": taken_leaves,
            "pending": pending_leaves,
            "balance": remaining_balance
        },
        "recent_activity": recent_activity
    }


# -------------------------------------------------------------
# 3. Monthly Detailed Attendance Records & Calendar View
# -------------------------------------------------------------

@router.get("/attendance")
async def get_employee_attendance(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format, e.g. 2026-10"),
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    if not month:
        month = date.today().strftime("%Y-%m")

    # Fetch all records for the requested month
    q = select(Attendance).where(
        Attendance.employee_id == emp_id,
        Attendance.date.like(f"{month}%")
    ).order_by(Attendance.date.asc())
    records = (await db.execute(q)).scalars().all()

    record_by_date = {r.date: r for r in records}

    # Generate full calendar day breakdown for this month
    try:
        year_num, month_num = map(int, month.split("-"))
    except Exception:
        year_num, month_num = date.today().year, date.today().month

    num_days = calendar.monthrange(year_num, month_num)[1]
    today_str = date.today().strftime("%Y-%m-%d")

    # Also check if any approved leave exists on these dates
    leaves_q = select(LeaveRequest).where(
        LeaveRequest.employee_id == emp_id,
        LeaveRequest.status == "approved"
    )
    approved_leaves = (await db.execute(leaves_q)).scalars().all()

    def is_on_leave(dt_str: str) -> Optional[str]:
        for l in approved_leaves:
            if l.start_date <= dt_str <= l.end_date:
                return l.leave_type
        return None

    calendar_days = []
    total_present = 0
    total_late = 0
    total_absent = 0
    total_hours = 0.0

    for d in range(1, num_days + 1):
        day_str = f"{year_num:04d}-{month_num:02d}-{d:02d}"
        curr_date = date(year_num, month_num, d)
        day_of_week = curr_date.strftime("%A")
        is_weekend = curr_date.weekday() >= 5
        is_future = day_str > today_str

        leave_title = is_on_leave(day_str)
        rec = record_by_date.get(day_str)

        if rec and rec.checkin:
            st = rec.status.value if rec.status else "present"
            total_present += 1
            if st == "late":
                total_late += 1
            dur_hrs = parse_duration_hours(rec.checkin, rec.checkout)
            total_hours += dur_hrs

            calendar_days.append({
                "date": day_str,
                "day_number": d,
                "day_of_week": day_of_week,
                "is_weekend": is_weekend,
                "is_future": is_future,
                "has_record": True,
                "checkin": rec.checkin,
                "checkout": rec.checkout,
                "duration": parse_duration(rec.checkin, rec.checkout),
                "duration_hours": dur_hrs,
                "status": st
            })
        elif leave_title:
            calendar_days.append({
                "date": day_str,
                "day_number": d,
                "day_of_week": day_of_week,
                "is_weekend": is_weekend,
                "is_future": is_future,
                "has_record": True,
                "checkin": None,
                "checkout": None,
                "duration": "--",
                "duration_hours": 0.0,
                "status": "on_leave",
                "leave_type": leave_title
            })
        elif is_weekend:
            calendar_days.append({
                "date": day_str,
                "day_number": d,
                "day_of_week": day_of_week,
                "is_weekend": True,
                "is_future": is_future,
                "has_record": False,
                "checkin": None,
                "checkout": None,
                "duration": "--",
                "duration_hours": 0.0,
                "status": "weekend"
            })
        elif is_future:
            calendar_days.append({
                "date": day_str,
                "day_number": d,
                "day_of_week": day_of_week,
                "is_weekend": False,
                "is_future": True,
                "has_record": False,
                "checkin": None,
                "checkout": None,
                "duration": "--",
                "duration_hours": 0.0,
                "status": "upcoming"
            })
        else:
            total_absent += 1
            calendar_days.append({
                "date": day_str,
                "day_number": d,
                "day_of_week": day_of_week,
                "is_weekend": False,
                "is_future": False,
                "has_record": False,
                "checkin": None,
                "checkout": None,
                "duration": "--",
                "duration_hours": 0.0,
                "status": "absent"
            })

    return {
        "status": "success",
        "month": month,
        "month_label": datetime(year_num, month_num, 1).strftime("%B %Y"),
        "summary": {
            "total_days": num_days,
            "present_days": total_present,
            "late_days": total_late,
            "absent_days": total_absent,
            "total_hours": round(total_hours, 1),
            "attendance_rate": round((total_present / max(1, total_present + total_absent)) * 100, 1)
        },
        "days": calendar_days
    }


# -------------------------------------------------------------
# 4. Analytics, Attendance Track Record & Insights
# -------------------------------------------------------------

@router.get("/analytics")
async def get_employee_analytics(
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    today = date.today()

    # 1. 6-Month Historical Monthly Trend
    monthly_trends = []
    for i in range(5, -1, -1):
        target_month_date = today.replace(day=1) - timedelta(days=i * 28)
        y = target_month_date.year
        m = target_month_date.month
        month_key = f"{y:04d}-{m:02d}"
        month_name = target_month_date.strftime("%b %Y")

        q = select(Attendance).where(
            Attendance.employee_id == emp_id,
            Attendance.date.like(f"{month_key}%")
        )
        recs = (await db.execute(q)).scalars().all()
        p_count = sum(1 for r in recs if r.checkin)
        l_count = sum(1 for r in recs if r.checkin and r.status and r.status.value == "late")
        hrs = sum(parse_duration_hours(r.checkin, r.checkout) for r in recs)

        # Estimate working days in that month
        max_d = calendar.monthrange(y, m)[1]
        wk_days = sum(1 for d in range(1, max_d + 1) if date(y, m, d).weekday() < 5)
        rate = round((p_count / max(1, wk_days)) * 100, 1)
        rate = min(100.0, rate)

        monthly_trends.append({
            "month": month_key,
            "month_name": month_name,
            "present": p_count,
            "late": l_count,
            "total_hours": round(hrs, 1),
            "attendance_rate": rate
        })

    # 2. Arrival Time Punctuality Distribution (Last 90 days)
    ninety_days_ago = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    recent_q = select(Attendance).where(
        Attendance.employee_id == emp_id,
        Attendance.date >= ninety_days_ago,
        Attendance.checkin.isnot(None)
    )
    recent_recs = (await db.execute(recent_q)).scalars().all()

    punctuality_breakdown = {
        "early": 0,       # Before 09:00
        "on_time": 0,     # 09:00 - 09:30
        "grace_late": 0,  # 09:30 - 10:00
        "severe_late": 0  # After 10:00
    }

    day_of_week_distribution = {"Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0}

    for r in recent_recs:
        try:
            dt = datetime.strptime(r.date, "%Y-%m-%d")
            day_name = dt.strftime("%A")
            if day_name in day_of_week_distribution:
                day_of_week_distribution[day_name] += 1

            if r.checkin:
                t_parts = list(map(int, r.checkin.split(":")))
                total_min = t_parts[0] * 60 + t_parts[1]
                if total_min < 540: # < 09:00
                    punctuality_breakdown["early"] += 1
                elif total_min <= 570: # 09:00 - 09:30
                    punctuality_breakdown["on_time"] += 1
                elif total_min <= 600: # 09:30 - 10:00
                    punctuality_breakdown["grace_late"] += 1
                else: # > 10:00
                    punctuality_breakdown["severe_late"] += 1
        except Exception:
            pass

    # 3. Overall Reliability Rating
    total_punches = len(recent_recs)
    on_time_total = punctuality_breakdown["early"] + punctuality_breakdown["on_time"]
    punctuality_score = round((on_time_total / max(1, total_punches)) * 100, 1)

    if punctuality_score >= 95:
        badge = "⭐ Elite Punctuality (Top 5%)"
    elif punctuality_score >= 85:
        badge = "🎯 Highly Consistent & Reliable"
    elif punctuality_score >= 70:
        badge = "⏱️ Good Punctuality"
    else:
        badge = "⚠️ Needs Attendance Improvement"

    return {
        "status": "success",
        "monthly_trends": monthly_trends,
        "punctuality_breakdown": punctuality_breakdown,
        "day_of_week_distribution": day_of_week_distribution,
        "summary": {
            "total_records_analyzed": total_punches,
            "punctuality_score": punctuality_score,
            "performance_badge": badge
        }
    }


# -------------------------------------------------------------
# 5. Leave Management: Balances & Applications
# -------------------------------------------------------------

@router.get("/leaves")
async def get_employee_leaves(
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]

    # Defined yearly allowances
    LEAVE_QUOTAS = {
        "Casual Leave": 10,
        "Sick Leave": 8,
        "Paid / Annual Leave": 6,
        "Unpaid Leave": 0
    }

    q = select(LeaveRequest).where(
        LeaveRequest.employee_id == emp_id
    ).order_by(LeaveRequest.applied_at.desc())
    requests = (await db.execute(q)).scalars().all()

    taken_by_type = {}
    pending_by_type = {}
    for r in requests:
        lt = r.leave_type
        if r.status == "approved":
            taken_by_type[lt] = taken_by_type.get(lt, 0) + r.days_count
        elif r.status == "pending":
            pending_by_type[lt] = pending_by_type.get(lt, 0) + r.days_count

    leave_categories = []
    for ltype, quota in LEAVE_QUOTAS.items():
        taken = taken_by_type.get(ltype, 0)
        pending = pending_by_type.get(ltype, 0)
        bal = max(0, quota - taken)
        leave_categories.append({
            "type": ltype,
            "quota": quota,
            "taken": taken,
            "pending": pending,
            "balance": bal
        })

    requests_list = []
    for r in requests:
        requests_list.append({
            "id": r.id,
            "leave_type": r.leave_type,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "days_count": r.days_count,
            "reason": r.reason,
            "status": r.status,
            "applied_at": r.applied_at.strftime("%Y-%m-%d %H:%M") if r.applied_at else "",
            "reviewed_by": r.reviewed_by,
            "review_notes": r.review_notes,
            "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M") if r.reviewed_at else None
        })

    return {
        "status": "success",
        "categories": leave_categories,
        "requests": requests_list
    }


@router.post("/leaves/apply")
async def apply_for_leave(
    data: LeaveApplyRequest,
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    hr_user_id = current_emp["hr_user_id"]

    try:
        s_date = datetime.strptime(data.start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(data.end_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if e_date < s_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")

    # Calculate days count (inclusive)
    days_count = (e_date - s_date).days + 1

    # Fetch employee's full name and department
    emp_q = select(Employee).where(Employee.employee_id == emp_id)
    emp_obj = (await db.execute(emp_q)).scalars().first()
    emp_name = emp_obj.name if emp_obj else current_emp.get("name", emp_id)
    dept = emp_obj.department if emp_obj else "General"

    new_leave = LeaveRequest(
        employee_id=emp_id,
        hr_user_id=hr_user_id,
        employee_name=emp_name,
        department=dept,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days_count=days_count,
        reason=data.reason.strip(),
        status="pending"
    )

    db.add(new_leave)
    await db.commit()
    await db.refresh(new_leave)

    # Broadcast notification to HR admins over WebSocket
    try:
        await manager.broadcast({
            "type": "LEAVE_REQUEST_SUBMITTED",
            "leave_id": new_leave.id,
            "employee_id": emp_id,
            "employee_name": emp_name,
            "leave_type": data.leave_type,
            "days_count": days_count,
            "start_date": data.start_date,
            "end_date": data.end_date
        })
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Leave application for {days_count} day(s) submitted successfully. Awaiting HR review.",
        "leave_id": new_leave.id
    }


@router.delete("/leaves/{leave_id}")
async def cancel_leave_request(
    leave_id: int,
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]

    q = select(LeaveRequest).where(
        LeaveRequest.id == leave_id,
        LeaveRequest.employee_id == emp_id
    )
    res = await db.execute(q)
    leave = res.scalars().first()

    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending leave requests can be cancelled.")

    await db.delete(leave)
    await db.commit()

    return {"status": "success", "message": "Leave application cancelled successfully."}


# -------------------------------------------------------------
# 6. Attendance Disputes & Correction Queries
# -------------------------------------------------------------

@router.get("/queries")
async def get_employee_queries(
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    q = select(AttendanceQuery).where(
        AttendanceQuery.employee_id == emp_id
    ).order_by(AttendanceQuery.created_at.desc())
    queries = (await db.execute(q)).scalars().all()

    results = []
    for item in queries:
        results.append({
            "id": item.id,
            "date": item.date,
            "checkin_time": item.checkin_time,
            "checkout_time": item.checkout_time,
            "reason_category": item.reason_category,
            "explanation": item.explanation,
            "status": item.status,
            "hr_notes": item.hr_notes,
            "resolved_by": item.resolved_by,
            "created_at": item.created_at.strftime("%Y-%m-%d %H:%M") if item.created_at else "",
            "resolved_at": item.resolved_at.strftime("%Y-%m-%d %H:%M") if item.resolved_at else None
        })

    return {"status": "success", "queries": results}


@router.post("/queries/submit")
async def submit_employee_query(
    data: EmployeeQueryRequest,
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    hr_user_id = current_emp["hr_user_id"]

    emp_q = select(Employee).where(Employee.employee_id == emp_id)
    emp_obj = (await db.execute(emp_q)).scalars().first()
    emp_name = emp_obj.name if emp_obj else current_emp.get("name", emp_id)
    dept = emp_obj.department if emp_obj else "Operations"

    query_obj = AttendanceQuery(
        hr_user_id=hr_user_id,
        employee_id=emp_id,
        employee_name=emp_name,
        department=dept,
        date=data.date,
        checkin_time=data.checkin_time,
        checkout_time=data.checkout_time,
        reason_category=data.reason_category,
        explanation=data.explanation,
        status="pending"
    )

    db.add(query_obj)
    await db.commit()

    return {"status": "success", "message": "Attendance dispute query submitted to HR for review."}


# -------------------------------------------------------------
# 7. Password Change & Profile Management
# -------------------------------------------------------------

@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    new_pwd = data.new_password.strip()

    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    q = select(Employee).where(Employee.employee_id == emp_id)
    emp = (await db.execute(q)).scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Verify current password
    is_valid = False
    if emp.password_hash:
        is_valid = check_password_hash(emp.password_hash, data.current_password)
    else:
        # Default password check
        default_pwd = f"{emp.employee_id}@123"
        is_valid = (data.current_password in [default_pwd, emp.employee_id, "password123", "admin123"])

    if not is_valid:
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    emp.password_hash = generate_password_hash(new_pwd)
    await db.commit()

    return {"status": "success", "message": "Password changed successfully. Use your new password on next sign in."}


@router.put("/profile")
async def update_employee_profile(
    data: ProfileUpdateRequest,
    current_emp: dict = Depends(get_current_employee),
    db: AsyncSession = Depends(get_db)
):
    emp_id = current_emp["employee_id"]
    q = select(Employee).where(Employee.employee_id == emp_id)
    emp = (await db.execute(q)).scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if data.email is not None:
        emp.email = data.email.strip()
    if data.phone is not None:
        emp.phone = data.phone.strip()

    await db.commit()
    return {"status": "success", "message": "Profile contact details updated."}


# -------------------------------------------------------------
# 8. HR Endpoints to Manage Leaves
# -------------------------------------------------------------

@router.get("/hr/leaves")
async def hr_list_leaves(
    status: Optional[str] = Query(None, description="pending, approved, rejected"),
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """HR Endpoint to view and manage all employee leave requests."""
    q = select(LeaveRequest).where(LeaveRequest.hr_user_id == hr_user_id)
    if status:
        q = q.where(LeaveRequest.status == status)
    q = q.order_by(LeaveRequest.applied_at.desc())
    recs = (await db.execute(q)).scalars().all()

    results = []
    for r in recs:
        results.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": r.employee_name,
            "department": r.department,
            "leave_type": r.leave_type,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "days_count": r.days_count,
            "reason": r.reason,
            "status": r.status,
            "applied_at": r.applied_at.strftime("%Y-%m-%d %H:%M") if r.applied_at else "",
            "reviewed_by": r.reviewed_by,
            "review_notes": r.review_notes,
            "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M") if r.reviewed_at else None
        })

    return {"status": "success", "leaves": results}


@router.post("/hr/leaves/{leave_id}/review")
async def hr_review_leave(
    leave_id: int,
    data: LeaveReviewRequest,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """HR Endpoint to approve or reject an employee leave request."""
    q = select(LeaveRequest).where(
        LeaveRequest.id == leave_id,
        LeaveRequest.hr_user_id == hr_user_id
    )
    leave = (await db.execute(q)).scalars().first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    action = data.action.lower()
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'.")

    # Fetch HR user's name
    user_q = select(HRUser).where(HRUser.id == hr_user_id)
    hr_user = (await db.execute(user_q)).scalars().first()
    reviewer_name = hr_user.username if hr_user else "HR Admin"

    leave.status = "approved" if action == "approve" else "rejected"
    leave.reviewed_by = reviewer_name
    leave.review_notes = data.review_notes
    leave.reviewed_at = datetime.utcnow()

    await db.commit()

    return {
        "status": "success", 
        "message": f"Leave request for {leave.employee_name} has been {leave.status}."
    }
