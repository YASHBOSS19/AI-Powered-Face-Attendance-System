from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, delete, update
from werkzeug.security import generate_password_hash, check_password_hash
from pydantic import BaseModel
import base64
import os
import uuid
import json
import math
from datetime import datetime, timedelta

from app.db.database import get_db
from app.db.models import HRUser, AuditLog, Employee, Attendance, FaceEmbedding, SystemAlert
from app.core.security import get_current_super_admin, create_access_token
from app.core.storage import save_to_r2_or_local
from app.api.settings import get_settings_data, save_settings_data

router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])

GLOBAL_PLANS_FILE = "global_subscription_plans.json"

DEFAULT_SUBSCRIPTION_PLANS = [
    {
        "id": "free",
        "name": "Free Plan",
        "tagline": "Essential biometric attendance for small teams & testing",
        "max_employees": 10,
        "price_monthly": 0,
        "price_annual": 0,
        "badge_color": "slate",
        "badge_label": "Free Starter",
        "features": [
            "Up to 10 Employee Seats",
            "Real-Time Face Kiosk Check-In",
            "Core Staff Profiles & Directory",
            "Daily Check-In & Out Logs",
            "Standard Community Support"
        ],
        "default_modules": ["overview", "employees", "kiosk"]
    },
    {
        "id": "basic",
        "name": "Basic Plan",
        "tagline": "Full biometric tracking & reporting for growing businesses",
        "max_employees": 50,
        "price_monthly": 49,
        "price_annual": 470,
        "badge_color": "blue",
        "badge_label": "Most Popular",
        "is_popular": True,
        "features": [
            "Up to 50 Employee Seats (Configurable)",
            "Face Biometric AI Vector Recognition",
            "Interactive Kiosk + Gate Access",
            "Department Attendance Reports & CSV Export",
            "Unknown Identity Intruder Capture & Alerts",
            "Automatic Headcount Limit Warnings (≥80%)"
        ],
        "default_modules": ["overview", "employees", "kiosk", "reports", "unknown_identity"]
    },
    {
        "id": "enterprise",
        "name": "Enterprise Plan",
        "tagline": "Unlimited scale, turnstile hardware relay, audit trail & dedicated SLA",
        "max_employees": 500,
        "price_monthly": 299,
        "price_annual": 2870,
        "badge_color": "amber",
        "badge_label": "Enterprise Scale",
        "is_recommended": True,
        "features": [
            "500+ Employee Seats (Custom Expandable)",
            "Dedicated Biometric Vector Indexing",
            "Hardware Turnstile Gate Relay Control",
            "Advanced System Thresholds & Settings",
            "Complete Platform Audit Trail Logs",
            "Custom Late Thresholds & 24/7 Priority SLA"
        ],
        "default_modules": ["overview", "employees", "kiosk", "reports", "unknown_identity", "gate", "settings"]
    }
]

SUBSCRIPTION_PLANS = DEFAULT_SUBSCRIPTION_PLANS

def get_global_subscription_plans() -> list:
    if os.path.exists(GLOBAL_PLANS_FILE):
        try:
            with open(GLOBAL_PLANS_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) >= 3:
                    return data
        except Exception as e:
            print(f"Warning: Failed to read {GLOBAL_PLANS_FILE}: {e}")
    return [dict(p) for p in DEFAULT_SUBSCRIPTION_PLANS]

def save_global_subscription_plans(plans: list):
    with open(GLOBAL_PLANS_FILE, "w") as f:
        json.dump(plans, f, indent=2)

class PlanUpdateItem(BaseModel):
    id: str  # 'free', 'basic', 'enterprise'
    name: str
    tagline: Optional[str] = ""
    max_employees: int
    price_monthly: float
    price_annual: float
    badge_color: Optional[str] = "slate"
    badge_label: Optional[str] = None
    is_popular: Optional[bool] = False
    is_recommended: Optional[bool] = False
    features: Optional[List[str]] = []
    default_modules: Optional[List[str]] = []

class UpdatePlansRequest(BaseModel):
    plans: List[PlanUpdateItem]

@router.get("/plans")
async def get_subscription_plans(
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    plans = get_global_subscription_plans()
    
    # Calculate tenant counts per plan
    tenants_res = await db.execute(select(HRUser).where(HRUser.role == 'HR'))
    all_tenants = tenants_res.scalars().all()
    
    counts_map = {p["id"]: {"total": 0, "active": 0} for p in plans}
    for t in all_tenants:
        s_data = get_settings_data(t.id)
        pid = s_data.get("planId") or "basic"
        if pid not in counts_map:
            pid = "enterprise" if (s_data.get("maxEmployees", 50) >= 500) else "basic" if (s_data.get("maxEmployees", 50) >= 50) else "free"
        if pid in counts_map:
            counts_map[pid]["total"] += 1
            if t.status != "disabled":
                counts_map[pid]["active"] += 1

    plans_with_counts = []
    for p in plans:
        item = dict(p)
        item["tenant_count"] = counts_map.get(p["id"], {}).get("total", 0)
        item["active_tenant_count"] = counts_map.get(p["id"], {}).get("active", 0)
        plans_with_counts.append(item)
        
    return {
        "status": "success",
        "plans": plans_with_counts,
        "default_plans": DEFAULT_SUBSCRIPTION_PLANS
    }

@router.put("/plans")
async def update_subscription_plans(
    req: UpdatePlansRequest,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    if len(req.plans) < 3:
        raise HTTPException(status_code=400, detail="All 3 core plans (Free, Basic, Enterprise) must be provided.")
        
    plan_ids = {p.id for p in req.plans}
    if not {"free", "basic", "enterprise"}.issubset(plan_ids):
        raise HTTPException(status_code=400, detail="Plan IDs must include 'free', 'basic', and 'enterprise'.")
        
    for p in req.plans:
        if p.max_employees <= 0:
            raise HTTPException(status_code=400, detail=f"Employee seat limit for plan '{p.name}' must be greater than 0.")
            
    plans_data = [p.dict() for p in req.plans]
    save_global_subscription_plans(plans_data)
    
    admin_id = int(super_admin.get('user_id', 23))
    admin_uname = super_admin.get('username', 'superadmin')
    summary_str = ", ".join([f"{p['name']} ({p['max_employees']} seats, ${p['price_monthly']}/mo)" for p in plans_data])
    await log_audit_action(
        db, 
        admin_id, 
        admin_uname, 
        'UPDATE_GLOBAL_PLANS', 
        'system:subscription_plans', 
        f"Customized global subscription tiers: {summary_str}"
    )
    
    return {
        "status": "success",
        "message": "Global subscription plan tiers updated successfully!",
        "plans": plans_data
    }

@router.post("/plans/reset")
async def reset_subscription_plans(
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    default_copy = [dict(p) for p in DEFAULT_SUBSCRIPTION_PLANS]
    save_global_subscription_plans(default_copy)
    
    admin_id = int(super_admin.get('user_id', 23))
    admin_uname = super_admin.get('username', 'superadmin')
    await log_audit_action(
        db, 
        admin_id, 
        admin_uname, 
        'RESET_GLOBAL_PLANS', 
        'system:subscription_plans', 
        "Reset global subscription plan tiers back to system factory defaults."
    )
    
    return {
        "status": "success",
        "message": "Subscription plans reset to factory defaults successfully!",
        "plans": default_copy
    }

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    working_days: Optional[List[str]] = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    late_threshold_time: Optional[str] = "10:00"
    status: Optional[str] = "active"
    permissions: Optional[List[str]] = None
    plan_id: Optional[str] = "basic"
    plan_name: Optional[str] = None
    billing_cycle: Optional[str] = "monthly"
    max_employees: Optional[int] = 50
    plan_expires_at: Optional[str] = None

async def log_audit_action(db: AsyncSession, admin_id: int, admin_username: str, action: str, resource: str, details: str = ""):
    new_log = AuditLog(
        admin_id=admin_id,
        admin_username=admin_username,
        action=action,
        resource=resource,
        details=details
    )
    db.add(new_log)
    await db.commit()

@router.get("/analytics/overview")
async def get_global_analytics(
    range_filter: str = "all",
    db: AsyncSession = Depends(get_db), 
    super_admin: dict = Depends(get_current_super_admin)
):
    # 1. Total Tenants
    tenants_res = await db.execute(select(HRUser).where(HRUser.role == 'HR'))
    all_tenants = tenants_res.scalars().all()
    total_tenants = len(all_tenants)
    active_tenants = sum(1 for t in all_tenants if t.status == 'active')
    disabled_tenants = sum(1 for t in all_tenants if t.status == 'disabled')
    
    # 2. Total Employees
    emp_count_res = await db.execute(select(func.count(Employee.employee_id)))
    total_employees = emp_count_res.scalar() or 0
    
    # 3. Total Attendance Records
    att_count_res = await db.execute(select(func.count(Attendance.id)))
    total_attendance = att_count_res.scalar() or 0
    
    # 4. Total Face Embeddings
    face_count_res = await db.execute(select(func.count(FaceEmbedding.id)))
    total_faces = face_count_res.scalar() or 0
    
    # 5. Today's Attendance stats
    today_str = datetime.now().strftime("%Y-%m-%d")
    today_q = select(Attendance.status, func.count(Attendance.id)).where(Attendance.date == today_str).group_by(Attendance.status)
    today_res = await db.execute(today_q)
    today_status_map = {status: count for status, count in today_res.all()}
    today_present = today_status_map.get("present", 0)
    today_late = today_status_map.get("late", 0)
    today_absent = today_status_map.get("absent", 0)
    today_total = today_present + today_late + today_absent
    
    # 6. Overall Punctuality
    present_total_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.status == 'present'))
    present_total = present_total_res.scalar() or 0
    late_total_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.status == 'late'))
    late_total = late_total_res.scalar() or 0
    punctuality_rate = round((present_total / (present_total + late_total) * 100), 1) if (present_total + late_total) > 0 else 100.0

    # 7. Attendance Trends by Date
    date_filter = None
    if range_filter == '7d':
        date_filter = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    elif range_filter == '14d':
        date_filter = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    elif range_filter == '30d':
        date_filter = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    elif range_filter == '60d':
        date_filter = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        
    trend_q = select(Attendance.date, Attendance.status, func.count(Attendance.id))
    if date_filter:
        trend_q = trend_q.where(Attendance.date >= date_filter)
    trend_q = trend_q.group_by(Attendance.date, Attendance.status).order_by(Attendance.date.asc())
    trend_res = await db.execute(trend_q)
    
    trends_dict = {}
    for d, st, cnt in trend_res.all():
        if d not in trends_dict:
            try:
                parsed_d = datetime.strptime(d, "%Y-%m-%d")
                day_name = parsed_d.strftime("%a")
                formatted_label = parsed_d.strftime("%b %d")
            except Exception:
                day_name = ""
                formatted_label = d
            trends_dict[d] = {
                "date": d,
                "label": formatted_label,
                "day_name": day_name,
                "present": 0,
                "late": 0,
                "absent": 0,
                "total": 0
            }
        status_key = str(st).lower()
        if status_key in ["present", "late", "absent"]:
            trends_dict[d][status_key] += cnt
        trends_dict[d]["total"] += cnt

    attendance_trends = list(trends_dict.values())
    
    # 8. Tenant Leaderboard & Subscription Breakdown
    tenant_stats = []
    tenant_lookup = {}
    plan_distribution = {"free": 0, "basic": 0, "enterprise": 0, "custom": 0}
    total_allocated_seats = 0
    all_global_plans = get_global_subscription_plans()

    for t in all_tenants:
        settings = get_settings_data(t.id)
        c_name = settings.get("companyName") or t.full_name or t.username
        logo = settings.get("logoUrl") or ""
        tenant_lookup[t.id] = {"name": c_name, "logo": logo, "username": t.username}
        
        # Plan info
        plan_id = settings.get("planId") or ("enterprise" if settings.get("maxEmployees", 50) >= 500 else "basic" if settings.get("maxEmployees", 50) >= 50 else "free")
        plan_name = settings.get("planName") or (next((p["name"] for p in all_global_plans if p["id"] == plan_id), "Basic Plan"))
        max_emp = settings.get("maxEmployees", 50)
        billing_cycle = settings.get("billingCycle", "monthly")
        sub_status = settings.get("subscriptionStatus", "active")
        
        if plan_id in plan_distribution:
            plan_distribution[plan_id] += 1
        else:
            plan_distribution["custom"] += 1

        total_allocated_seats += max_emp

        # emp count
        t_emp = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == t.id))
        emp_c = t_emp.scalar() or 0
        
        # face count
        t_face = await db.execute(select(func.count(FaceEmbedding.id)).where(FaceEmbedding.hr_user_id == t.id))
        face_c = t_face.scalar() or 0
        
        # att count
        t_att = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == t.id))
        att_c = t_att.scalar() or 0
        
        # today att
        t_today = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == t.id, Attendance.date == today_str))
        today_c = t_today.scalar() or 0
        
        # present count
        t_pres = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == t.id, Attendance.status == 'present'))
        pres_c = t_pres.scalar() or 0
        
        # late count
        t_late = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == t.id, Attendance.status == 'late'))
        late_c = t_late.scalar() or 0
        
        usage_pct = round((emp_c / max_emp) * 100, 1) if max_emp > 0 else 0.0

        tenant_stats.append({
            "id": t.id,
            "company_name": c_name,
            "username": t.username,
            "logo_url": logo,
            "status": t.status,
            "plan_id": plan_id,
            "plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "subscription_status": sub_status,
            "max_employees": max_emp,
            "seats_available": max(0, max_emp - emp_c),
            "capacity_used_pct": usage_pct,
            "is_limit_warning": emp_c >= int(0.8 * max_emp),
            "is_limit_exceeded": emp_c >= max_emp,
            "created_at": str(t.created_at) if t.created_at else None,
            "employee_count": emp_c,
            "face_count": face_c,
            "attendance_count": att_c,
            "today_attendance": today_c,
            "on_time_count": pres_c,
            "late_count": late_c,
            "punctuality_pct": round((pres_c / (pres_c + late_c) * 100), 1) if (pres_c + late_c) > 0 else 100.0,
            "biometric_enrollment_pct": round((face_c / emp_c * 100), 1) if emp_c > 0 else 0.0
        })

    tenant_stats.sort(key=lambda x: x["employee_count"], reverse=True)

    # 9. Department distribution
    dept_q = select(Employee.department, func.count(Employee.employee_id)).group_by(Employee.department)
    dept_res = await db.execute(dept_q)
    dept_dist = []
    for dept_name, count in dept_res.all():
        clean_dept = (dept_name or "").strip() or "Unassigned"
        dept_dist.append({
            "department": clean_dept,
            "count": count,
            "percentage": round((count / total_employees * 100), 1) if total_employees > 0 else 0.0
        })
    dept_dist.sort(key=lambda x: x["count"], reverse=True)

    # 10. Hourly Peak Checkin Distribution (Across all records)
    hour_q = select(Attendance.checkin).where(Attendance.checkin.isnot(None))
    hour_res = await db.execute(hour_q)
    hour_counts = {f"{h:02d}:00": 0 for h in range(6, 21)}
    for (chk,) in hour_res.all():
        if chk and ":" in chk:
            try:
                hour_part = int(chk.split(":")[0])
                if 6 <= hour_part <= 20:
                    slot_key = f"{hour_part:02d}:00"
                    hour_counts[slot_key] += 1
            except Exception:
                pass
    hourly_distribution = [{"hour": k, "count": v} for k, v in hour_counts.items()]

    # 11. Recent Global Activity
    recent_q = select(Attendance).order_by(Attendance.id.desc()).limit(10)
    recent_res = await db.execute(recent_q)
    recent_records = []
    for r in recent_res.scalars().all():
        t_info = tenant_lookup.get(r.hr_user_id, {})
        status_val = r.status.value if hasattr(r.status, "value") else str(r.status)
        recent_records.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "name": r.name,
            "company_name": t_info.get("name", f"Tenant #{r.hr_user_id}"),
            "logo_url": t_info.get("logo", ""),
            "date": r.date,
            "checkin": r.checkin,
            "checkout": r.checkout,
            "status": status_val
        })

    seat_utilization_pct = round((total_employees / total_allocated_seats * 100), 1) if total_allocated_seats > 0 else 0.0

    return {
        "status": "success",
        "summary": {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "disabled_tenants": disabled_tenants,
            "total_employees": total_employees,
            "total_allocated_seats": total_allocated_seats,
            "total_utilized_seats": total_employees,
            "seat_utilization_pct": seat_utilization_pct,
            "plan_distribution": plan_distribution,
            "total_attendance": total_attendance,
            "total_faces": total_faces,
            "today_present": today_present,
            "today_late": today_late,
            "today_absent": today_absent,
            "today_total": today_total,
            "punctuality_rate": punctuality_rate,
            "biometric_adoption_pct": round((total_faces / total_employees * 100), 1) if total_employees > 0 else 0.0
        },
        "trends": attendance_trends,
        "tenants": tenant_stats,
        "departments": dept_dist,
        "hourly_distribution": hourly_distribution,
        "recent_activity": recent_records
    }

class SuperAdminProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class SuperAdminPasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@router.get("/profile")
async def get_super_admin_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    admin_id = int(super_admin.get("user_id"))
    query = select(HRUser).where(HRUser.id == admin_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Super Admin account not found")

    # Audit stats for this super admin
    audit_count_res = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.admin_id == admin_id)
    )
    total_actions = audit_count_res.scalar() or 0

    last_action_res = await db.execute(
        select(AuditLog).where(AuditLog.admin_id == admin_id).order_by(AuditLog.timestamp.desc()).limit(1)
    )
    last_action = last_action_res.scalars().first()

    # Session details
    exp_ts = super_admin.get("exp")
    now_ts = datetime.utcnow().timestamp()
    time_remaining_sec = max(0, int(exp_ts - now_ts)) if exp_ts else None
    expires_at_str = datetime.utcfromtimestamp(exp_ts).isoformat() if exp_ts else None

    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")

    return {
        "status": "success",
        "profile": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name or "System Super Admin",
            "email": user.email or "",
            "phone": user.phone or "",
            "role": user.role,
            "status": user.status,
            "created_at": str(user.created_at) if user.created_at else None,
            "last_login": str(user.last_login) if user.last_login else None
        },
        "session": {
            "client_ip": client_ip,
            "user_agent": user_agent,
            "expires_at": expires_at_str,
            "time_remaining_seconds": time_remaining_sec,
            "algorithm": "HS256",
            "role": user.role
        },
        "security": {
            "total_audit_actions": total_actions,
            "last_action_type": last_action.action if last_action else None,
            "last_action_time": str(last_action.timestamp) if last_action and last_action.timestamp else None,
            "last_action_details": last_action.details if last_action else None
        }
    }

@router.put("/profile")
async def update_super_admin_profile(
    data: SuperAdminProfileUpdate,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    admin_id = int(super_admin.get("user_id"))
    query = select(HRUser).where(HRUser.id == admin_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Super Admin account not found")

    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.email is not None:
        user.email = data.email.strip()
    if data.phone is not None:
        user.phone = data.phone.strip()

    await db.commit()
    await db.refresh(user)

    await log_audit_action(
        db, admin_id, user.username, "UPDATE_PROFILE", f"hr_users:{admin_id}",
        f"Super Admin updated profile details (name: {user.full_name}, email: {user.email})"
    )

    return {
        "status": "success",
        "message": "Super Admin profile updated successfully",
        "profile": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "status": user.status
        }
    }

@router.put("/change-password")
async def change_super_admin_password(
    data: SuperAdminPasswordChange,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    admin_id = int(super_admin.get("user_id"))
    query = select(HRUser).where(HRUser.id == admin_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Super Admin account not found")

    # 1. Verify current password
    if not check_password_hash(user.password_hash, data.current_password):
        raise HTTPException(status_code=400, detail="Current password does not match. Please verify and try again.")

    # 2. Verify confirmation
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    # 3. Minimum length
    if len(data.new_password.strip()) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")

    # 4. Cannot reuse identical password
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password cannot be the same as your current password.")

    # 5. Update hash
    new_hashed = generate_password_hash(data.new_password.strip())
    user.password_hash = new_hashed
    await db.commit()

    # 6. Audit log
    await log_audit_action(
        db, admin_id, user.username, "CHANGE_PASSWORD", f"hr_users:{admin_id}",
        "Super Admin successfully updated account password"
    )

    # 7. Issue refreshed token
    new_token = create_access_token(data={"user_id": user.id, "role": user.role})

    return {
        "status": "success",
        "message": "Super Admin password changed successfully!",
        "token": new_token
    }

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.role == 'HR').order_by(HRUser.id.desc())
    result = await db.execute(query)
    hr_users = result.scalars().all()
    
    users = []
    for u in hr_users:
        # Get counts
        emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == u.id))
        emp_count = emp_res.scalar() or 0
        
        att_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == u.id))
        att_count = att_res.scalar() or 0
        
        face_res = await db.execute(select(func.count(FaceEmbedding.id)).where(FaceEmbedding.hr_user_id == u.id))
        face_count = face_res.scalar() or 0
        
        settings = get_settings_data(u.id)
        max_emp = settings.get("maxEmployees", 50)
        usage_pct = round((emp_count / max_emp) * 100, 1) if max_emp > 0 else 0
        
        all_global_plans = get_global_subscription_plans()
        plan_id = settings.get("planId") or ("enterprise" if max_emp >= 500 else "basic" if max_emp >= 50 else "free")
        plan_name = settings.get("planName") or (next((p["name"] for p in all_global_plans if p["id"] == plan_id), "Basic Plan"))
        billing_cycle = settings.get("billingCycle", "monthly")
        sub_status = settings.get("subscriptionStatus", "active")
        
        users.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "status": u.status,
            "role": u.role,
            "created_at": u.created_at,
            "last_login": u.last_login,
            "employee_count": emp_count,
            "attendance_count": att_count,
            "face_count": face_count,
            "plan_id": plan_id,
            "plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "subscription_status": sub_status,
            "max_employees": max_emp,
            "seats_available": max(0, max_emp - emp_count),
            "capacity_used_pct": usage_pct,
            "is_limit_warning": emp_count >= int(0.8 * max_emp),
            "is_limit_exceeded": emp_count >= max_emp,
            "logo_url": settings.get("logoUrl", ""),
            "company_name": settings.get("companyName", u.full_name or "My Company"),
            "working_days": settings.get("workingDays", []),
            "late_threshold_time": settings.get("lateThresholdTime", "10:00")
        })
        
    return {"status": "success", "users": users}

@router.get("/users/{user_id}")
async def get_user_details(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    u = result.scalars().first()
    
    if not u:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    perms = u.permissions if u.permissions else ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]

    emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == user_id))
    emp_count = emp_res.scalar() or 0
    
    att_res = await db.execute(select(func.count(Attendance.id)).where(Attendance.hr_user_id == user_id))
    att_count = att_res.scalar() or 0
    
    face_res = await db.execute(select(func.count(FaceEmbedding.id)).where(FaceEmbedding.hr_user_id == user_id))
    face_count = face_res.scalar() or 0
    
    settings = get_settings_data(user_id)
    max_emp = settings.get("maxEmployees", 50)
    usage_pct = round((emp_count / max_emp) * 100, 1) if max_emp > 0 else 0
    
    all_global_plans = get_global_subscription_plans()
    plan_id = settings.get("planId") or ("enterprise" if max_emp >= 500 else "basic" if max_emp >= 50 else "free")
    plan_name = settings.get("planName") or (next((p["name"] for p in all_global_plans if p["id"] == plan_id), "Basic Plan"))
    billing_cycle = settings.get("billingCycle", "monthly")
    sub_status = settings.get("subscriptionStatus", "active")
    
    user_dict = {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "phone": settings.get("phone") or u.phone,
        "status": u.status,
        "role": u.role,
        "permissions": perms,
        "created_at": u.created_at,
        "last_login": u.last_login,
        "employee_count": emp_count,
        "attendance_count": att_count,
        "face_count": face_count,
        "plan_id": plan_id,
        "plan_name": plan_name,
        "billing_cycle": billing_cycle,
        "subscription_status": sub_status,
        "max_employees": max_emp,
        "seats_available": max(0, max_emp - emp_count),
        "capacity_used_pct": usage_pct,
        "is_limit_warning": emp_count >= int(0.8 * max_emp),
        "is_limit_exceeded": emp_count >= max_emp,
        "settings": settings,
        "logo_url": settings.get("logoUrl", ""),
        "company_name": settings.get("companyName", u.full_name or "My Company"),
        "industry": settings.get("industry", ""),
        "working_days": settings.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"]),
        "late_threshold_time": settings.get("lateThresholdTime", "10:00")
    }
    
    # Get recent employees
    recent_q = select(Employee).where(Employee.hr_user_id == user_id).order_by(Employee.registered_date.desc()).limit(10)
    recent_res = await db.execute(recent_q)
    recent_emps = recent_res.scalars().all()
    
    user_dict["recent_employees"] = [{
        "employee_id": e.employee_id,
        "name": e.name,
        "domain": e.domain,
        "department": e.department,
        "position": e.position,
        "registered_date": str(e.registered_date) if e.registered_date else None
    } for e in recent_emps]
    
    return {"status": "success", "user": user_dict}


@router.post("/users")
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.username == user.username)
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different username.")
        
    hashed = generate_password_hash(user.password)
    company_name = user.company_name or user.full_name or "My Company"
    status_val = user.status if user.status in ["active", "disabled"] else "active"
    perms = user.permissions if user.permissions else ["overview", "employees", "reports", "kiosk", "gate", "settings", "unknown_identity"]
    
    # Plan determination
    global_plans = get_global_subscription_plans()
    plan_id = user.plan_id or "basic"
    matched_plan = next((p for p in global_plans if p["id"] == plan_id), None)
    plan_name = user.plan_name or (matched_plan["name"] if matched_plan else "Basic Plan")
    billing_cycle = user.billing_cycle or "monthly"
    
    if user.max_employees is not None and user.max_employees > 0:
        max_emp_val = user.max_employees
    elif matched_plan:
        max_emp_val = matched_plan["max_employees"]
    else:
        max_emp_val = 50

    try:
        new_hr = HRUser(
            username=user.username,
            password_hash=hashed,
            role='HR',
            full_name=company_name,
            email=user.email,
            phone=user.phone,
            status=status_val,
            permissions=perms,
            created_by=super_admin.get('user_id'),
            created_by_username=super_admin.get('username', 'superadmin')
        )
        db.add(new_hr)
        await db.commit()
        await db.refresh(new_hr)
        new_id = new_hr.id
        
        # Handle logo if provided
        logo_url = ""
        if user.logo_base64:
            try:
                header, encoded = user.logo_base64.split(",", 1) if "," in user.logo_base64 else ("", user.logo_base64)
                img_bytes = base64.b64decode(encoded)
                logo_filename = f"logo_{new_id}_{uuid.uuid4().hex[:8]}.png"
                logo_url = save_to_r2_or_local(
                    file_bytes=img_bytes,
                    filename=logo_filename,
                    subfolder="logos",
                    content_type="image/png"
                )
            except Exception as img_err:
                print(f"Warning: Failed to save logo during user creation: {img_err}")

        # Initialize tenant settings with subscription metadata
        save_settings_data(new_id, {
            "companyName": company_name,
            "logoUrl": logo_url,
            "workingDays": user.working_days if user.working_days else ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "lateThresholdTime": user.late_threshold_time or "10:00",
            "industry": user.industry or "",
            "phone": user.phone or "",
            "planId": plan_id,
            "planName": plan_name,
            "billingCycle": billing_cycle,
            "subscriptionStatus": "active",
            "maxEmployees": max_emp_val,
            "planStartedAt": datetime.utcnow().isoformat(),
            "planExpiresAt": user.plan_expires_at
        })
        
        # Create alert for Super Admin
        new_alert = SystemAlert(
            tenant_id=new_id,
            type='NEW_TENANT',
            severity='info',
            title='New Tenant Registered',
            message=f"Tenant '{company_name}' (@{user.username}) registered under '{plan_name}' Plan with {max_emp_val} employee seats.",
            data={
                "tenant_id": new_id,
                "username": user.username,
                "company_name": company_name,
                "plan_id": plan_id,
                "plan_name": plan_name,
                "billing_cycle": billing_cycle,
                "max_employees": max_emp_val
            }
        )
        db.add(new_alert)
        await db.commit()
        
        admin_id = int(super_admin.get('user_id', 23))
        admin_uname = super_admin.get('username', 'superadmin')
        await log_audit_action(db, admin_id, admin_uname, 'CREATE_USER', f'hr_users:{new_id}', f'Created HR admin {user.username} ({company_name}) under {plan_name} plan ({max_emp_val} seats)')
        
        return {
            "status": "success", 
            "message": f"HR Admin workspace for '{company_name}' created successfully on {plan_name} plan ({max_emp_val} seats)!",
            "user_id": new_id
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


class UserUpdate(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    working_days: Optional[List[str]] = None
    late_threshold_time: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None
    permissions: Optional[List[str]] = None
    plan_id: Optional[str] = None
    plan_name: Optional[str] = None
    billing_cycle: Optional[str] = None
    subscription_status: Optional[str] = None
    max_employees: Optional[int] = None
    plan_expires_at: Optional[str] = None

@router.put("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    try:
        query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
        result = await db.execute(query)
        user_row = result.scalars().first()
        
        if not user_row:
            raise HTTPException(status_code=404, detail="HR Admin not found")
            
        company_name = data.company_name or user_row.full_name
        email = data.email or user_row.email
        
        user_row.full_name = company_name
        user_row.email = email
        
        if data.phone is not None:
            user_row.phone = data.phone
            
        old_status = user_row.status
        if data.status in ["active", "disabled"] and data.status != old_status:
            user_row.status = data.status
            status_alert = SystemAlert(
                tenant_id=user_id,
                type='STATUS_CHANGE',
                severity='warning' if data.status == 'disabled' else 'info',
                title='Tenant Status Changed',
                message=f"Tenant '{company_name}' status changed to '{data.status}'.",
                data={"tenant_id": user_id, "company_name": company_name, "old_status": old_status, "new_status": data.status}
            )
            db.add(status_alert)
            
        if data.permissions is not None:
            user_row.permissions = data.permissions
            
        if data.password and data.password.strip():
            user_row.password_hash = generate_password_hash(data.password.strip())
            
        await db.commit()
        
        # Update tenant settings JSON
        current_settings = get_settings_data(user_id)
        old_plan = current_settings.get("planName", "Growth / Basic")
        old_max = current_settings.get("maxEmployees", 50)
        
        if data.company_name:
            current_settings["companyName"] = data.company_name
        if data.phone is not None:
            current_settings["phone"] = data.phone
        if data.industry is not None:
            current_settings["industry"] = data.industry
        if data.working_days is not None:
            current_settings["workingDays"] = data.working_days
        if data.late_threshold_time is not None:
            current_settings["lateThresholdTime"] = data.late_threshold_time
            
        # Plan & subscription updates
        global_plans = get_global_subscription_plans()
        plan_changed = False
        if data.plan_id is not None:
            current_settings["planId"] = data.plan_id
            matched = next((p for p in global_plans if p["id"] == data.plan_id), None)
            if data.plan_name:
                current_settings["planName"] = data.plan_name
            elif matched:
                current_settings["planName"] = matched["name"]
            plan_changed = True
            
        if data.billing_cycle is not None:
            current_settings["billingCycle"] = data.billing_cycle
        if data.subscription_status is not None:
            current_settings["subscriptionStatus"] = data.subscription_status
        if data.plan_expires_at is not None:
            current_settings["planExpiresAt"] = data.plan_expires_at
            
        if data.max_employees is not None and data.max_employees > 0:
            current_settings["maxEmployees"] = data.max_employees
            if data.max_employees != old_max:
                plan_changed = True
        elif data.plan_id is not None and (data.max_employees is None or data.max_employees <= 0):
            matched = next((p for p in global_plans if p["id"] == data.plan_id), None)
            if matched:
                current_settings["maxEmployees"] = matched["max_employees"]
                plan_changed = True
            
        # If new logo base64 provided
        if data.logo_base64:
            try:
                header, encoded = data.logo_base64.split(",", 1) if "," in data.logo_base64 else ("", data.logo_base64)
                img_bytes = base64.b64decode(encoded)
                logo_filename = f"logo_{user_id}_{uuid.uuid4().hex[:8]}.png"
                saved_logo_url = save_to_r2_or_local(
                    file_bytes=img_bytes,
                    filename=logo_filename,
                    subfolder="logos",
                    content_type="image/png"
                )
                current_settings["logoUrl"] = saved_logo_url
            except Exception as img_err:
                print(f"Warning: Failed to save updated logo: {img_err}")
                
        save_settings_data(user_id, current_settings)
        
        admin_id = int(super_admin.get('user_id', 23))
        admin_uname = super_admin.get('username', 'superadmin')
        
        new_plan = current_settings.get("planName", "Growth / Basic")
        new_max = current_settings.get("maxEmployees", 50)
        
        if plan_changed:
            audit_msg = f"Subscription plan changed for {user_row.username}: from {old_plan} ({old_max} seats) to {new_plan} ({new_max} seats)"
            action_code = "UPDATE_PLAN"
        else:
            audit_msg = f"Updated organization details for {user_row.username} ({company_name})"
            action_code = "UPDATE_USER"

        await log_audit_action(db, admin_id, admin_uname, action_code, f'hr_users:{user_id}', audit_msg)
        
        return {"status": "success", "message": "Organization & subscription details updated successfully", "settings": current_settings}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found or cannot delete super admin")
        
    try:
        username = user_row.username
        await db.delete(user_row)
        await db.commit()
        
        await log_audit_action(db, super_admin['user_id'], 'superadmin', 'DELETE_USER', f'hr_users:{user_id}', f'Deleted HR admin {username}')
        
        return {"status": "success", "message": "User deleted successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class UserStatusUpdate(BaseModel):
    status: str  # "active" or "disabled"

@router.put("/users/{user_id}/status")
async def update_user_status(user_id: int, data: UserStatusUpdate, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    if data.status not in ["active", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed values: 'active', 'disabled'")
        
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="HR Admin not found")
        
    user_row.status = data.status
    await db.commit()
    
    action_type = "DISABLE_USER" if data.status == "disabled" else "ENABLE_USER"
    await log_audit_action(db, super_admin['user_id'], 'superadmin', action_type, f'hr_users:{user_id}', f'{action_type.replace("_", " ").title()} for {user_row.username}')
    
    return {"status": "success", "message": f"User status updated to {data.status}", "new_status": data.status}

@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: int, db: AsyncSession = Depends(get_db), super_admin: dict = Depends(get_current_super_admin)):
    query = select(HRUser).where(HRUser.id == user_id, HRUser.role == 'HR')
    result = await db.execute(query)
    user_row = result.scalars().first()
    
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found or invalid role")
        
    if user_row.status == "disabled":
        raise HTTPException(status_code=400, detail="Cannot impersonate a disabled account. Please enable it first.")
        
    token = create_access_token(data={"user_id": user_row.id, "role": user_row.role, "impersonated_by": super_admin['user_id']})
    
    await log_audit_action(db, super_admin['user_id'], 'superadmin', 'IMPERSONATE', f'hr_users:{user_id}', f'Impersonated user {user_row.username}')
    
    return {
        "status": "success",
        "token": token,
        "role": user_row.role,
        "username": user_row.username
    }

@router.get("/audit-logs")
async def get_audit_logs(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    action: Optional[str] = None,
    admin_username: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_order: str = "desc",
    export: bool = False,
    db: AsyncSession = Depends(get_db), 
    super_admin: dict = Depends(get_current_super_admin)
):
    filters = []

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                AuditLog.details.ilike(term),
                AuditLog.resource.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.admin_username.ilike(term)
            )
        )

    # Action filter
    if action and action.strip() and action.strip().upper() != "ALL":
        filters.append(AuditLog.action == action.strip().upper())

    # Admin username filter
    if admin_username and admin_username.strip() and admin_username.strip().upper() != "ALL":
        filters.append(AuditLog.admin_username == admin_username.strip())

    # Date from filter
    if date_from and date_from.strip():
        try:
            df = datetime.strptime(date_from.strip(), "%Y-%m-%d")
            filters.append(AuditLog.timestamp >= df)
        except ValueError:
            pass

    # Date to filter
    if date_to and date_to.strip():
        try:
            dt = datetime.strptime(date_to.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            filters.append(AuditLog.timestamp <= dt)
        except ValueError:
            pass

    # Total count query
    count_query = select(func.count(AuditLog.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total_count = total_result.scalar() or 0

    # Distinct actions & admins for filtering dropdowns
    actions_q = select(AuditLog.action).distinct()
    admins_q = select(AuditLog.admin_username).distinct()
    actions_res = await db.execute(actions_q)
    admins_res = await db.execute(admins_q)
    available_actions = sorted([a for a in actions_res.scalars().all() if a])
    available_admins = sorted([u for u in admins_res.scalars().all() if u])

    # Overall total logs in system (unfiltered)
    all_time_res = await db.execute(select(func.count(AuditLog.id)))
    total_all_time = all_time_res.scalar() or 0

    # Today's logs count
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_res = await db.execute(select(func.count(AuditLog.id)).where(AuditLog.timestamp >= today_start))
    today_count = today_res.scalar() or 0

    # Action type breakdown counts
    breakdown = {}
    action_counts_q = select(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action)
    action_counts_res = await db.execute(action_counts_q)
    for act_name, act_cnt in action_counts_res.all():
        if act_name:
            breakdown[act_name] = act_cnt

    # Data query
    data_query = select(AuditLog)
    if filters:
        data_query = data_query.where(*filters)

    if sort_order.lower() == "asc":
        data_query = data_query.order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
    else:
        data_query = data_query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())

    if export:
        data_query = data_query.limit(5000)
        curr_page = 1
        curr_limit = total_count
        total_pages = 1
    else:
        curr_page = max(1, page)
        curr_limit = max(1, min(100, limit))
        offset = (curr_page - 1) * curr_limit
        data_query = data_query.offset(offset).limit(curr_limit)
        total_pages = math.ceil(total_count / curr_limit) if total_count > 0 else 1

    result = await db.execute(data_query)
    logs = result.scalars().all()

    logs_list = [{
        "id": l.id,
        "admin_id": l.admin_id,
        "admin_username": l.admin_username,
        "action": l.action,
        "resource": l.resource,
        "details": l.details,
        "timestamp": str(l.timestamp) if l.timestamp else None
    } for l in logs]

    return {
        "status": "success",
        "logs": logs_list,
        "pagination": {
            "page": curr_page,
            "limit": curr_limit,
            "total": total_count,
            "total_pages": total_pages,
            "has_prev": curr_page > 1,
            "has_next": curr_page < total_pages
        },
        "meta": {
            "available_actions": available_actions,
            "available_admins": available_admins,
            "total_all_time": total_all_time,
            "today_count": today_count,
            "action_breakdown": breakdown
        }
    }


# ==============================================================================
# NOTIFICATION & ALERT SYSTEM ENDPOINTS
# ==============================================================================

@router.get("/alerts")
async def get_system_alerts(
    severity: Optional[str] = None,
    alert_type: Optional[str] = None,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    # 1. Fetch all tenants for lookup & real-time capacity scans
    tenants_res = await db.execute(select(HRUser).where(HRUser.role == 'HR'))
    all_tenants = tenants_res.scalars().all()
    tenant_lookup = {}
    watchlist = []
    limit_warnings_count = 0
    limit_exceeded_count = 0

    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)

    for t in all_tenants:
        emp_res = await db.execute(select(func.count(Employee.employee_id)).where(Employee.hr_user_id == t.id))
        emp_count = emp_res.scalar() or 0
        settings = get_settings_data(t.id)
        comp_name = settings.get("companyName", t.full_name or f"Tenant #{t.id}")
        max_limit = settings.get("maxEmployees", 25)
        usage_pct = round((emp_count / max_limit) * 100, 1) if max_limit > 0 else 0
        
        tenant_lookup[t.id] = {
            "name": comp_name,
            "username": t.username,
            "status": t.status,
            "logo": settings.get("logoUrl", "")
        }

        is_exceeded = emp_count >= max_limit
        is_warning = (not is_exceeded) and (emp_count >= int(0.8 * max_limit))

        if is_exceeded:
            limit_exceeded_count += 1
            # Check if alert already exists recently
            rec_q = select(SystemAlert).where(
                SystemAlert.tenant_id == t.id,
                SystemAlert.type == "LIMIT_EXCEEDED",
                SystemAlert.created_at >= last_24h
            )
            rec_alert = (await db.execute(rec_q)).scalars().first()
            if not rec_alert:
                db.add(SystemAlert(
                    tenant_id=t.id,
                    type="LIMIT_EXCEEDED",
                    severity="critical",
                    title="Tenant Limit Exceeded",
                    message=f"Tenant '{comp_name}' (@{t.username}) has reached or exceeded max employee capacity ({emp_count}/{max_limit} registered, {usage_pct}% used).",
                    data={"current": emp_count, "limit": max_limit, "pct": usage_pct}
                ))
        elif is_warning:
            limit_warnings_count += 1
            # Check if alert already exists recently
            rec_q = select(SystemAlert).where(
                SystemAlert.tenant_id == t.id,
                SystemAlert.type == "LIMIT_WARNING",
                SystemAlert.created_at >= last_24h
            )
            rec_alert = (await db.execute(rec_q)).scalars().first()
            if not rec_alert:
                db.add(SystemAlert(
                    tenant_id=t.id,
                    type="LIMIT_WARNING",
                    severity="warning",
                    title="Tenant Capacity Warning (≥80%)",
                    message=f"Tenant '{comp_name}' (@{t.username}) is nearing employee capacity limit ({emp_count}/{max_limit} registered, {usage_pct}% used).",
                    data={"current": emp_count, "limit": max_limit, "pct": usage_pct}
                ))

        watchlist.append({
            "tenant_id": t.id,
            "company_name": comp_name,
            "username": t.username,
            "status": t.status,
            "logo_url": settings.get("logoUrl", ""),
            "employee_count": emp_count,
            "max_employees": max_limit,
            "usage_pct": usage_pct,
            "is_exceeded": is_exceeded,
            "is_warning": is_warning,
            "remaining": max(0, max_limit - emp_count)
        })

    await db.commit()
    watchlist.sort(key=lambda x: x["usage_pct"], reverse=True)

    # 2. Query system_alerts table
    filters = []
    if severity and severity != 'all':
        filters.append(SystemAlert.severity == severity)
    if alert_type and alert_type != 'all':
        filters.append(SystemAlert.type == alert_type)
    if unread_only:
        filters.append(SystemAlert.is_read == False)

    alert_query = select(SystemAlert)
    if filters:
        alert_query = alert_query.where(*filters)
    alert_query = alert_query.order_by(SystemAlert.created_at.desc(), SystemAlert.id.desc()).limit(200)

    alerts_res = await db.execute(alert_query)
    alerts = alerts_res.scalars().all()

    # 3. Overall counts
    total_stored_res = await db.execute(select(SystemAlert))
    all_alerts = total_stored_res.scalars().all()
    unread_count = sum(1 for a in all_alerts if not a.is_read)
    critical_count = sum(1 for a in all_alerts if a.severity == 'critical')
    warning_count = sum(1 for a in all_alerts if a.severity == 'warning')
    seven_days_ago = now - timedelta(days=7)
    new_tenants_count = sum(1 for a in all_alerts if a.type == 'NEW_TENANT' and (a.created_at or datetime.min) >= seven_days_ago)

    alerts_list = []
    for a in alerts:
        t_meta = tenant_lookup.get(a.tenant_id, {})
        alerts_list.append({
            "id": a.id,
            "tenant_id": a.tenant_id,
            "tenant_name": t_meta.get("name", f"Tenant #{a.tenant_id}" if a.tenant_id else "Platform System"),
            "tenant_username": t_meta.get("username", ""),
            "tenant_logo": t_meta.get("logo", ""),
            "type": a.type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "data": a.data,
            "is_read": bool(a.is_read),
            "created_at": str(a.created_at) if a.created_at else None
        })

    return {
        "status": "success",
        "alerts": alerts_list,
        "unread_count": unread_count,
        "summary": {
            "total_alerts": len(all_alerts),
            "unread_count": unread_count,
            "limit_warnings_count": limit_warnings_count,
            "limit_exceeded_count": limit_exceeded_count,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "new_tenants_count": new_tenants_count
        },
        "watchlist": watchlist
    }

@router.put("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    query = select(SystemAlert).where(SystemAlert.id == alert_id)
    res = await db.execute(query)
    alert = res.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.is_read = True
    await db.commit()
    return {"status": "success", "message": "Alert marked as read"}

@router.put("/alerts/mark-all-read")
async def mark_all_alerts_read(
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    await db.execute(update(SystemAlert).values(is_read=True))
    await db.commit()
    return {"status": "success", "message": "All alerts marked as read"}

@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    query = select(SystemAlert).where(SystemAlert.id == alert_id)
    res = await db.execute(query)
    alert = res.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    await db.delete(alert)
    await db.commit()
    return {"status": "success", "message": "Alert dismissed"}

@router.post("/alerts/test-trigger")
async def trigger_test_alert(
    data: dict,
    db: AsyncSession = Depends(get_db),
    super_admin: dict = Depends(get_current_super_admin)
):
    alert = SystemAlert(
        tenant_id=data.get("tenant_id"),
        type=data.get("type", "LIMIT_WARNING"),
        severity=data.get("severity", "warning"),
        title=data.get("title", "Test Notification"),
        message=data.get("message", "This is a test notification generated from Super Admin."),
        data=data.get("data", {})
    )
    db.add(alert)
    await db.commit()
    return {"status": "success", "message": "Test alert created", "alert_id": alert.id}

