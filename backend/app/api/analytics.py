from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any

from app.db.database import get_db
from app.db.models import HRUser, Employee, Attendance, AttendanceStatus
from app.core.security import get_current_user
from app.api.settings import get_settings_data

router = APIRouter(prefix="/api/analytics", tags=["admin-analytics"])

def parse_time_str(t_str: str) -> Optional[datetime]:
    """Parse time string HH:MM:SS or HH:MM into a time object."""
    if not t_str:
        return None
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p"):
        try:
            return datetime.strptime(t_str.strip(), fmt)
        except ValueError:
            continue
    return None

def calc_duration_hours(checkin_str: str, checkout_str: str) -> Optional[float]:
    """Calculate working duration in hours between checkin and checkout."""
    t_in = parse_time_str(checkin_str)
    t_out = parse_time_str(checkout_str)
    if not t_in or not t_out:
        return None
    
    delta = t_out - t_in
    duration = delta.total_seconds() / 3600.0
    if duration < 0:
        # Handle overnight shift (checkout is next day)
        duration += 24.0
    if 0.1 <= duration <= 20.0:
        return round(duration, 2)
    return None


@router.get("/overview")
async def get_admin_analytics_overview(
    range_filter: Optional[str] = Query("30d"), # '7d', '14d', '30d', 'month', '90d'
    dept: Optional[str] = Query(None),
    hr_user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Advanced Analytics & Trends endpoint for Admin portal.
    Computes:
    - 30-day attendance trend (Present vs Late vs Absent)
    - Weekly heatmap calendar matrix
    - Top performers & chronic absentees
    - Peak arrival time histogram
    - Avg working hours per employee & company-wide duration stats
    """
    hr_user_id = int(hr_user_id)
    today = date.today()
    settings = get_settings_data(hr_user_id)
    working_days_cfg = settings.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"])

    # 1. Determine date range
    if range_filter == "7d":
        days_count = 7
    elif range_filter == "14d":
        days_count = 14
    elif range_filter == "month":
        days_count = today.day
    elif range_filter == "90d":
        days_count = 90
    else: # default 30d
        days_count = 30

    start_date = today - timedelta(days=days_count - 1)
    start_date_str = start_date.strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")

    # 2. Fetch all employees for this tenant
    emp_query = select(Employee).where(Employee.hr_user_id == hr_user_id)
    if dept and dept.lower() != "all":
        emp_query = emp_query.where(
            or_(Employee.department == dept, Employee.domain == dept)
        )
    emp_res = await db.execute(emp_query)
    employees = emp_res.scalars().all()
    total_employees_count = len(employees)
    employee_dict = {e.employee_id: e for e in employees}

    # 3. Fetch attendance records within the date range
    att_query = select(Attendance).where(
        Attendance.hr_user_id == hr_user_id,
        Attendance.date >= start_date_str,
        Attendance.date <= today_str
    ).order_by(Attendance.date.asc())
    
    att_res = await db.execute(att_query)
    attendance_records = att_res.scalars().all()

    # Filter by dept if specified
    if dept and dept.lower() != "all":
        attendance_records = [
            r for r in attendance_records
            if r.employee_id in employee_dict
        ]

    # 4. Group attendance by Date
    att_by_date: Dict[str, List[Attendance]] = {}
    att_by_emp: Dict[str, List[Attendance]] = {}
    
    for rec in attendance_records:
        d = rec.date
        if d not in att_by_date:
            att_by_date[d] = []
        att_by_date[d].append(rec)

        emp_key = rec.employee_id or rec.name
        if emp_key not in att_by_emp:
            att_by_emp[emp_key] = []
        att_by_emp[emp_key].append(rec)

    # -------------------------------------------------------------
    # FEATURE 1: 30-Day Attendance Trend (Present vs Late vs Absent)
    # -------------------------------------------------------------
    trends = []
    total_present_sum = 0
    total_late_sum = 0
    total_absent_sum = 0
    active_days_count = 0

    for i in range(days_count):
        curr_date = start_date + timedelta(days=i)
        curr_date_str = curr_date.strftime("%Y-%m-%d")
        day_records = att_by_date.get(curr_date_str, [])
        day_of_week = curr_date.strftime("%a")
        is_working_day = day_of_week in working_days_cfg

        present_count = 0
        late_count = 0

        for r in day_records:
            if r.checkin:
                if r.status == AttendanceStatus.late or r.status == 'late':
                    late_count += 1
                else:
                    present_count += 1

        total_checked_in = present_count + late_count
        absent_count = max(0, total_employees_count - total_checked_in) if is_working_day else 0
        
        rate = round((total_checked_in / total_employees_count) * 100, 1) if (total_employees_count > 0 and is_working_day) else (100.0 if not is_working_day else 0.0)

        if is_working_day or len(day_records) > 0:
            total_present_sum += present_count
            total_late_sum += late_count
            total_absent_sum += absent_count
            active_days_count += 1

        trends.append({
            "date": curr_date_str,
            "display_date": curr_date.strftime("%b %d"),
            "day": day_of_week,
            "is_working_day": is_working_day,
            "present": present_count,
            "late": late_count,
            "total_attended": total_checked_in,
            "absent": absent_count,
            "total_employees": total_employees_count,
            "rate": rate
        })

    # -------------------------------------------------------------
    # FEATURE 2: Weekly Heatmap Calendar Matrix
    # -------------------------------------------------------------
    # Group trends by Day of Week
    dow_stats = {d: {"present": 0, "total": 0, "count": 0, "late": 0} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
    for t in trends:
        d = t["day"]
        if d in dow_stats and t["is_working_day"]:
            dow_stats[d]["present"] += t["total_attended"]
            dow_stats[d]["total"] += t["total_employees"]
            dow_stats[d]["late"] += t["late"]
            dow_stats[d]["count"] += 1

    dow_summary = []
    for d, st in dow_stats.items():
        avg_rate = round((st["present"] / st["total"]) * 100, 1) if st["total"] > 0 else 0.0
        dow_summary.append({
            "day": d,
            "avg_rate": avg_rate,
            "total_present": st["present"],
            "total_late": st["late"],
            "days_recorded": st["count"]
        })

    # Find best & lowest attendance day
    working_dow = [x for x in dow_summary if x["day"] in working_days_cfg and x["days_recorded"] > 0]
    best_day = max(working_dow, key=lambda x: x["avg_rate"]) if working_dow else None
    lowest_day = min(working_dow, key=lambda x: x["avg_rate"]) if working_dow else None

    # -------------------------------------------------------------
    # FEATURE 3: Top Performers & Chronic Absentees Widgets
    # -------------------------------------------------------------
    working_days_in_period = sum(1 for t in trends if t["is_working_day"])
    emp_stats = []

    for emp in employees:
        records = att_by_emp.get(emp.employee_id, [])
        days_on_time = 0
        days_late = 0
        working_durations = []
        checkin_minutes = []

        for r in records:
            if r.checkin:
                if r.status == AttendanceStatus.late or r.status == 'late':
                    days_late += 1
                else:
                    days_on_time += 1
                
                # Checkin time to minutes from midnight for average checkin time
                t_in = parse_time_str(r.checkin)
                if t_in:
                    checkin_minutes.append(t_in.hour * 60 + t_in.minute)

                # Duration
                if r.checkout:
                    dur = calc_duration_hours(r.checkin, r.checkout)
                    if dur:
                        working_durations.append(dur)

        total_attended = days_on_time + days_late
        total_days_base = max(1, working_days_in_period)
        absent_days = max(0, total_days_base - total_attended)
        
        att_pct = round((total_attended / total_days_base) * 100, 1)
        punctuality_pct = round((days_on_time / total_attended) * 100, 1) if total_attended > 0 else 0.0

        avg_hours = round(sum(working_durations) / len(working_durations), 1) if len(working_durations) > 0 else None
        total_hours = round(sum(working_durations), 1)

        avg_checkin_str = None
        if checkin_minutes:
            avg_m = int(sum(checkin_minutes) / len(checkin_minutes))
            avg_h = avg_m // 60
            avg_min = avg_m % 60
            avg_checkin_str = f"{avg_h:02d}:{avg_min:02d}"

        emp_stats.append({
            "employee_id": emp.employee_id,
            "name": emp.name,
            "department": emp.department or emp.domain or "General",
            "position": emp.position or "Staff",
            "email": emp.email,
            "profile_picture": emp.profile_picture,
            "days_present": days_on_time,
            "days_late": days_late,
            "total_attended": total_attended,
            "days_absent": absent_days,
            "attendance_pct": min(100.0, att_pct),
            "punctuality_pct": punctuality_pct,
            "avg_hours": avg_hours,
            "total_hours": total_hours,
            "avg_checkin": avg_checkin_str,
            "shifts_recorded": len(records),
            "checkout_count": len(working_durations)
        })

    # Sort Top Performers: Highest attendance %, then highest punctuality %, lowest late
    top_performers = sorted(
        [e for e in emp_stats if e["total_attended"] > 0],
        key=lambda x: (x["attendance_pct"], x["punctuality_pct"], -x["days_late"]),
        reverse=True
    )[:8]

    # Sort Chronic Absentees: Lowest attendance %, highest absent days, highest late count
    chronic_absentees = sorted(
        emp_stats,
        key=lambda x: (-x["days_absent"], -x["days_late"], x["attendance_pct"])
    )[:8]

    # -------------------------------------------------------------
    # FEATURE 4: Peak Arrival Time Histogram
    # -------------------------------------------------------------
    time_slots = [
        {"id": "early", "label": "Early (< 08:30)", "range": "< 08:30 AM", "count": 0, "pct": 0, "status": "early"},
        {"id": "slot_0830", "label": "08:30 - 09:00", "range": "08:30 - 09:00 AM", "count": 0, "pct": 0, "status": "on_time"},
        {"id": "slot_0900", "label": "09:00 - 09:30", "range": "09:00 - 09:30 AM", "count": 0, "pct": 0, "status": "on_time"},
        {"id": "slot_0930", "label": "09:30 - 10:00", "range": "09:30 - 10:00 AM", "count": 0, "pct": 0, "status": "on_time"},
        {"id": "slot_1000", "label": "10:00 - 10:30", "range": "10:00 - 10:30 AM", "count": 0, "pct": 0, "status": "late"},
        {"id": "late_after", "label": "Late (10:30+)", "range": "10:30 AM+", "count": 0, "pct": 0, "status": "late"}
    ]

    total_checkins_with_time = 0
    all_checkin_minutes = []

    for r in attendance_records:
        if r.checkin:
            t = parse_time_str(r.checkin)
            if t:
                total_checkins_with_time += 1
                mins = t.hour * 60 + t.minute
                all_checkin_minutes.append(mins)

                if mins < 8 * 60 + 30:
                    time_slots[0]["count"] += 1
                elif mins < 9 * 60:
                    time_slots[1]["count"] += 1
                elif mins < 9 * 60 + 30:
                    time_slots[2]["count"] += 1
                elif mins < 10 * 60:
                    time_slots[3]["count"] += 1
                elif mins < 10 * 60 + 30:
                    time_slots[4]["count"] += 1
                else:
                    time_slots[5]["count"] += 1

    for slot in time_slots:
        slot["pct"] = round((slot["count"] / total_checkins_with_time) * 100, 1) if total_checkins_with_time > 0 else 0.0

    peak_slot = max(time_slots, key=lambda x: x["count"]) if total_checkins_with_time > 0 else time_slots[2]

    # -------------------------------------------------------------
    # FEATURE 5: Average Working Hours & Durations
    # -------------------------------------------------------------
    all_durations = []
    checkout_records_count = 0
    overtime_count = 0

    for r in attendance_records:
        if r.checkin and r.checkout:
            dur = calc_duration_hours(r.checkin, r.checkout)
            if dur:
                all_durations.append(dur)
                checkout_records_count += 1
                if dur >= 9.0:
                    overtime_count += 1

    company_avg_hours = round(sum(all_durations) / len(all_durations), 1) if all_durations else 8.0
    total_company_hours = round(sum(all_durations), 1)
    checkout_compliance_pct = round((checkout_records_count / len(attendance_records)) * 100, 1) if len(attendance_records) > 0 else 0.0

    # Overall Summary KPI Card Numbers
    overall_attended_sum = total_present_sum + total_late_sum
    overall_attendance_rate = round((overall_attended_sum / (total_employees_count * max(1, active_days_count))) * 100, 1) if (total_employees_count > 0 and active_days_count > 0) else 0.0
    overall_punctuality_rate = round((total_present_sum / overall_attended_sum) * 100, 1) if overall_attended_sum > 0 else 100.0

    return {
        "status": "success",
        "range_filter": range_filter,
        "days_count": days_count,
        "date_range": {
            "start": start_date_str,
            "end": today_str
        },
        "summary": {
            "total_employees": total_employees_count,
            "total_records": len(attendance_records),
            "overall_attendance_rate": overall_attendance_rate,
            "overall_punctuality_rate": overall_punctuality_rate,
            "total_present": total_present_sum,
            "total_late": total_late_sum,
            "total_absent": total_absent_sum,
            "company_avg_hours": company_avg_hours,
            "total_company_hours": total_company_hours,
            "checkout_compliance_pct": checkout_compliance_pct,
            "overtime_shifts_count": overtime_count,
            "best_day": best_day,
            "lowest_day": lowest_day,
            "peak_arrival": {
                "label": peak_slot["label"],
                "range": peak_slot["range"],
                "count": peak_slot["count"],
                "pct": peak_slot["pct"]
            }
        },
        "trends": trends,
        "weekly_heatmap": {
            "dow_summary": dow_summary,
            "weeks_grid": trends
        },
        "top_performers": top_performers,
        "chronic_absentees": chronic_absentees,
        "working_hours_leaderboard": sorted(
            [e for e in emp_stats if e["avg_hours"] is not None],
            key=lambda x: (x["avg_hours"] or 0),
            reverse=True
        )[:10],
        "arrival_histogram": time_slots
    }
