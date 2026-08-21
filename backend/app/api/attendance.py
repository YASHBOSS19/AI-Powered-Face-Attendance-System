from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.attendance_db import (
    get_attendance_report, 
    get_employee_attendance, 
    record_checkin, 
    record_checkout,
    get_today_attendance_summary,
    update_attendance,
    delete_attendance
)
from app.core.security import get_current_user
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

class AttendanceActionRequest(BaseModel):
    action: str  # "checkin" or "checkout"
    name: str
    employee_id: Optional[str] = None

@router.get("/today")
def today_summary():
    data = get_today_attendance_summary()
    return {"status": "success", "summary": data}

@router.get("/report")
def report(date_from: Optional[str] = None, date_to: Optional[str] = None):
    # Depending on how the frontend calls it, it might just use query params.
    data = get_attendance_report(date_from, date_to)
    return {"status": "success", "report": data}

@router.get("/detail")
def detail(employee_id: Optional[str] = None, name: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
    data = get_employee_attendance(employee_id=employee_id, name=name, date_from=date_from, date_to=date_to)
    return {"status": "success", "records": data, "detail": data}

@router.post("/action")
async def attendance_action(req: AttendanceActionRequest):
    if req.action == "checkin":
        res = record_checkin(req.name, req.employee_id)
        await manager.broadcast({
            "type": "ATTENDANCE_MARKED",
            "name": req.name,
            "employee_id": req.employee_id,
            "status": res.get("status", "present"),
            "checkin": res.get("checkin")
        })
        return {"status": "success", "result": res}
    elif req.action == "checkout":
        res = record_checkout(req.name, req.employee_id)
        await manager.broadcast({
            "type": "CHECKOUT_MARKED",
            "name": req.name,
            "employee_id": req.employee_id,
            "status": "checkout",
            "checkout": res.get("checkout")
        })
        return {"status": "success", "result": res}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'checkin' or 'checkout'.")

class AttendanceUpdateRequest(BaseModel):
    checkin: Optional[str] = None
    checkout: Optional[str] = None
    status: Optional[str] = None

@router.put("/{record_id}")
def update_record(record_id: int, req: AttendanceUpdateRequest):
    success = update_attendance(record_id, req.checkin, req.checkout, req.status)
    if success:
        return {"status": "success", "message": "Attendance record updated successfully"}
    raise HTTPException(status_code=404, detail="Attendance record not found")

@router.delete("/{record_id}")
def delete_record(record_id: int):
    success = delete_attendance(record_id)
    if success:
        return {"status": "success", "message": "Attendance record deleted successfully"}
    raise HTTPException(status_code=404, detail="Attendance record not found")
