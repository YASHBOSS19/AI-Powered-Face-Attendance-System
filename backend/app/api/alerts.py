from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, func, and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any

from app.db.database import get_db
from app.db.models import HRUser, Employee, Attendance, SystemAlert, AttendanceStatus
from app.core.security import get_current_user
from app.api.settings import get_settings_data
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/alerts", tags=["admin-alerts"])

async def evaluate_smart_alerts(db: AsyncSession, hr_user_id: int):
    """
    Evaluates real-time condition-based smart alerts for the tenant:
    1. Low attendance rate alert (< 70% today)
    2. Habitual late-comers flag (>= 3 late arrivals in last 30 days)
    3. Subscription seat limit warning (>= 80% or >= 100%)
    """
    now = datetime.utcnow()
    today_str = date.today().strftime("%Y-%m-%d")
    today_start = datetime.combine(date.today(), datetime.min.time())
    last_30_days = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
    last_24h = now - timedelta(hours=24)

    # 1. Fetch total employees count
    emp_count_res = await db.execute(
        select(func.count(Employee.employee_id)).where(Employee.hr_user_id == hr_user_id)
    )
    total_employees = emp_count_res.scalar() or 0

    # 2. Fetch tenant settings & plan capacity
    settings = get_settings_data(hr_user_id)
    max_limit = settings.get("maxEmployees", 50)
    plan_name = settings.get("planName", "Basic Plan")
    company_name = settings.get("companyName", f"Company #{hr_user_id}")
    usage_pct = round((total_employees / max_limit) * 100, 1) if max_limit > 0 else 0

    # -------------------------------------------------------------
    # ALERT 1: Low Attendance Rate Alert (< 70% Today)
    # -------------------------------------------------------------
    today_att_query = select(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        Attendance.date == today_str
    )
    today_att_res = await db.execute(today_att_query)
    today_records = today_att_res.scalars().all()
    present_today = len([r for r in today_records if r.checkin is not None])
    
    attendance_rate = round((present_today / total_employees) * 100, 1) if total_employees > 0 else 100.0

    if total_employees > 0 and attendance_rate < 70.0:
        # Check if alert already generated today
        existing_att_alert = (await db.execute(
            select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "LOW_ATTENDANCE",
                SystemAlert.created_at >= today_start
            )
        )).scalars().first()

        is_critical = attendance_rate < 50.0
        severity = "critical" if is_critical else "warning"
        title = f"Critical: Low Attendance Rate ({attendance_rate}%)" if is_critical else f"Warning: Low Attendance Rate ({attendance_rate}%)"
        absent_count = max(0, total_employees - present_today)
        message = (
            f"Today's attendance rate is currently at {attendance_rate}% ({present_today}/{total_employees} staff present). "
            f"{absent_count} employee(s) have not checked in. Expected threshold is 70%."
        )

        alert_data = {
            "rate": attendance_rate,
            "present": present_today,
            "total": total_employees,
            "absent": absent_count,
            "threshold": 70,
            "date": today_str
        }

        if not existing_att_alert:
            new_alert = SystemAlert(
                tenant_id=hr_user_id,
                type="LOW_ATTENDANCE",
                severity=severity,
                title=title,
                message=message,
                data=alert_data,
                is_read=False
            )
            db.add(new_alert)
            await db.commit()
        else:
            # Update data with latest live numbers
            existing_att_alert.title = title
            existing_att_alert.message = message
            existing_att_alert.severity = severity
            existing_att_alert.data = alert_data
            await db.commit()

    # -------------------------------------------------------------
    # ALERT 2: Habitual Late-Comers Flag (>= 3 times in last 30 days)
    # -------------------------------------------------------------
    late_query = select(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        Attendance.date >= last_30_days,
        or_(
            Attendance.status == AttendanceStatus.late,
            Attendance.status == 'late'
        )
    ).order_by(Attendance.date.desc())
    late_res = await db.execute(late_query)
    late_records = late_res.scalars().all()

    # Aggregate by employee
    late_by_emp: Dict[str, List[Attendance]] = {}
    for rec in late_records:
        emp_id = rec.employee_id or rec.name
        if emp_id not in late_by_emp:
            late_by_emp[emp_id] = []
        late_by_emp[emp_id].append(rec)

    # Fetch employee metadata for flagged staff
    flagged_employees = []
    for emp_id, records in late_by_emp.items():
        if len(records) >= 3:
            emp_info = (await db.execute(
                select(Employee).where(
                    Employee.employee_id == emp_id,
                    Employee.hr_user_id == hr_user_id
                )
            )).scalars().first()

            dept = emp_info.department if emp_info and emp_info.department else (emp_info.domain if emp_info else "General")
            emp_name = emp_info.name if emp_info else records[0].name

            flagged_employees.append({
                "employee_id": emp_id,
                "name": emp_name,
                "department": dept,
                "profile_picture": emp_info.profile_picture if emp_info else None,
                "late_count": len(records),
                "severity": "critical" if len(records) >= 5 else "warning",
                "recent_dates": [{"date": r.date, "checkin": r.checkin} for r in records[:5]],
                "latest_late_date": records[0].date,
                "latest_checkin": records[0].checkin
            })

    flagged_employees.sort(key=lambda x: x["late_count"], reverse=True)

    if len(flagged_employees) > 0:
        existing_late_alert = (await db.execute(
            select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "HABITUAL_LATE",
                SystemAlert.created_at >= today_start
            )
        )).scalars().first()

        max_lates = flagged_employees[0]["late_count"]
        severity = "critical" if max_lates >= 5 else "warning"
        title = f"Habitual Late-Comers Flagged ({len(flagged_employees)} Staff)"
        message = (
            f"{len(flagged_employees)} employee(s) have logged 3 or more late check-ins in the past 30 days. "
            f"Top flagged: {flagged_employees[0]['name']} ({flagged_employees[0]['late_count']} times)."
        )

        alert_data = {
            "flagged_count": len(flagged_employees),
            "flagged_employees": flagged_employees
        }

        if not existing_late_alert:
            new_alert = SystemAlert(
                tenant_id=hr_user_id,
                type="HABITUAL_LATE",
                severity=severity,
                title=title,
                message=message,
                data=alert_data,
                is_read=False
            )
            db.add(new_alert)
            await db.commit()
        else:
            existing_late_alert.title = title
            existing_late_alert.message = message
            existing_late_alert.severity = severity
            existing_late_alert.data = alert_data
            await db.commit()

    # -------------------------------------------------------------
    # ALERT 3: Seat Capacity Limit Warning (>= 80% or >= 100%)
    # -------------------------------------------------------------
    if total_employees >= max_limit:
        rec = (await db.execute(
            select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "LIMIT_EXCEEDED",
                SystemAlert.created_at >= last_24h
            )
        )).scalars().first()

        if not rec:
            db.add(SystemAlert(
                tenant_id=hr_user_id,
                type="LIMIT_EXCEEDED",
                severity="critical",
                title="Subscription Seat Limit Reached",
                message=f"Your workforce has reached 100% plan capacity ({total_employees}/{max_limit} seats) under the {plan_name}. Additional employee registrations are blocked.",
                data={"current": total_employees, "limit": max_limit, "pct": usage_pct, "remaining": 0, "plan": plan_name},
                is_read=False
            ))
            await db.commit()
    elif total_employees >= int(0.8 * max_limit):
        rec = (await db.execute(
            select(SystemAlert).where(
                SystemAlert.tenant_id == hr_user_id,
                SystemAlert.type == "LIMIT_WARNING",
                SystemAlert.created_at >= last_24h
            )
        )).scalars().first()

        if not rec:
            db.add(SystemAlert(
                tenant_id=hr_user_id,
                type="LIMIT_WARNING",
                severity="warning",
                title="Seat Capacity Warning (≥80%)",
                message=f"Your workforce is nearing employee seat capacity ({total_employees}/{max_limit} seats, {usage_pct}% used) under the {plan_name}. {max_limit - total_employees} seat(s) remaining.",
                data={"current": total_employees, "limit": max_limit, "pct": usage_pct, "remaining": max_limit - total_employees, "plan": plan_name},
                is_read=False
            ))
            await db.commit()

    return {
        "attendance_rate": attendance_rate,
        "present_today": present_today,
        "total_employees": total_employees,
        "flagged_employees": flagged_employees,
        "seat_usage": {
            "current": total_employees,
            "limit": max_limit,
            "pct": usage_pct,
            "plan": plan_name,
            "remaining": max(0, max_limit - total_employees)
        }
    }


@router.get("")
async def get_admin_alerts(
    filter_type: Optional[str] = Query(None), # all, unread, attendance, late, limits, critical
    severity: Optional[str] = Query(None),
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all smart alerts and notifications for the HR Admin.
    """
    hr_user_id = int(hr_user_id)
    eval_metrics = await evaluate_smart_alerts(db, hr_user_id)

    # Build query for tenant alerts
    query = select(SystemAlert).where(SystemAlert.tenant_id == hr_user_id)

    if severity:
        query = query.where(SystemAlert.severity == severity)

    if filter_type == "unread":
        query = query.where(SystemAlert.is_read == False)
    elif filter_type == "attendance":
        query = query.where(SystemAlert.type == "LOW_ATTENDANCE")
    elif filter_type == "late":
        query = query.where(SystemAlert.type == "HABITUAL_LATE")
    elif filter_type == "limits":
        query = query.where(SystemAlert.type.in_(["LIMIT_WARNING", "LIMIT_EXCEEDED"]))
    elif filter_type == "critical":
        query = query.where(SystemAlert.severity == "critical")

    query = query.order_by(SystemAlert.created_at.desc(), SystemAlert.id.desc()).limit(100)
    res = await db.execute(query)
    alerts = res.scalars().all()

    # Calculate summary metrics
    all_tenant_alerts = (await db.execute(
        select(SystemAlert).where(SystemAlert.tenant_id == hr_user_id)
    )).scalars().all()

    unread_count = len([a for a in all_tenant_alerts if not a.is_read])
    critical_count = len([a for a in all_tenant_alerts if a.severity == "critical"])
    warning_count = len([a for a in all_tenant_alerts if a.severity == "warning"])
    attendance_alerts_count = len([a for a in all_tenant_alerts if a.type == "LOW_ATTENDANCE"])
    late_alerts_count = len([a for a in all_tenant_alerts if a.type == "HABITUAL_LATE"])
    limits_alerts_count = len([a for a in all_tenant_alerts if a.type in ["LIMIT_WARNING", "LIMIT_EXCEEDED"]])

    alerts_list = [
        {
            "id": a.id,
            "type": a.type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "data": a.data,
            "is_read": a.is_read,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in alerts
    ]

    return {
        "status": "success",
        "summary": {
            "total_alerts": len(all_tenant_alerts),
            "unread_count": unread_count,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "attendance_alerts_count": attendance_alerts_count,
            "late_alerts_count": late_alerts_count,
            "limits_alerts_count": limits_alerts_count,
            "attendance_rate": eval_metrics["attendance_rate"],
            "present_today": eval_metrics["present_today"],
            "total_employees": eval_metrics["total_employees"],
            "habitual_late_count": len(eval_metrics["flagged_employees"]),
            "seat_usage": eval_metrics["seat_usage"]
        },
        "watchlist": eval_metrics["flagged_employees"],
        "alerts": alerts_list
    }


@router.get("/summary")
async def get_alerts_summary(
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lightweight summary for notification bell icon & popup drawer in header.
    """
    hr_user_id = int(hr_user_id)
    eval_metrics = await evaluate_smart_alerts(db, hr_user_id)

    res = await db.execute(
        select(SystemAlert)
        .where(SystemAlert.tenant_id == hr_user_id)
        .order_by(SystemAlert.created_at.desc(), SystemAlert.id.desc())
        .limit(10)
    )
    alerts = res.scalars().all()

    all_tenant_alerts = (await db.execute(
        select(SystemAlert.id, SystemAlert.is_read, SystemAlert.severity)
        .where(SystemAlert.tenant_id == hr_user_id)
    )).all()

    unread_count = len([a for a in all_tenant_alerts if not a.is_read])
    critical_count = len([a for a in all_tenant_alerts if a.severity == "critical"])

    return {
        "status": "success",
        "unread_count": unread_count,
        "critical_count": critical_count,
        "total_count": len(all_tenant_alerts),
        "attendance_rate": eval_metrics["attendance_rate"],
        "habitual_late_count": len(eval_metrics["flagged_employees"]),
        "seat_usage": eval_metrics["seat_usage"],
        "latest_alerts": [
            {
                "id": a.id,
                "type": a.type,
                "severity": a.severity,
                "title": a.title,
                "message": a.message,
                "is_read": a.is_read,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in alerts[:6]
        ]
    }


@router.put("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a specific alert as read."""
    hr_user_id = int(hr_user_id)
    res = await db.execute(
        select(SystemAlert).where(
            SystemAlert.id == alert_id,
            SystemAlert.tenant_id == hr_user_id
        )
    )
    alert = res.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_read = True
    await db.commit()
    return {"status": "success", "message": "Alert marked as read"}


@router.put("/mark-all-read")
async def mark_all_alerts_read(
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all alerts for the current tenant as read."""
    hr_user_id = int(hr_user_id)
    await db.execute(
        update(SystemAlert)
        .where(SystemAlert.tenant_id == hr_user_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "success", "message": "All alerts marked as read"}


@router.delete("/{alert_id}")
async def dismiss_alert(
    alert_id: int,
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Dismiss / delete an alert."""
    hr_user_id = int(hr_user_id)
    res = await db.execute(
        select(SystemAlert).where(
            SystemAlert.id == alert_id,
            SystemAlert.tenant_id == hr_user_id
        )
    )
    alert = res.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
    return {"status": "success", "message": "Alert dismissed successfully"}
