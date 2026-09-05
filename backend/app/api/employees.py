from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from app.db.database import get_db
from app.schemas.models import EmployeeRegistration, FaceLinkRequest
from app.core.security import get_current_user
from pydantic import BaseModel
import mysql.connector
import mysql.connector.connection_cext as mysql_conn
import csv
import json
import codecs

router = APIRouter(prefix="/api/employees", tags=["employees"])

@router.get("/export-json")
def export_json(db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    
    # Query all employees
    cursor.execute("SELECT employee_id, name, domain, department, position FROM employees")
    employees = cursor.fetchall()
    
    # Query all attendance logs
    cursor.execute("SELECT id, employee_id, date, checkin, checkout, status FROM attendance")
    attendance = cursor.fetchall()
    
    # Group attendance by employee_id
    attendance_by_emp = {}
    for record in attendance:
        emp_id = record["employee_id"]
        if emp_id not in attendance_by_emp:
            attendance_by_emp[emp_id] = []
        # Remove employee_id from the nested record to avoid redundancy
        del record["employee_id"]
        attendance_by_emp[emp_id].append(record)
        
    # Build final data structure
    export_data = {
        "platform": "Identifi HR Portal",
        "employees": []
    }
    
    for emp in employees:
        emp_data = dict(emp)
        emp_data["attendance_logs"] = attendance_by_emp.get(emp["employee_id"], [])
        export_data["employees"].append(emp_data)
        
    json_str = json.dumps(export_data, indent=2, default=str)
    
    return Response(
        content=json_str, 
        media_type="application/json", 
        headers={"Content-Disposition": "attachment; filename=platform_data_export.json"}
    )

@router.get("")
def list_employees(db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT e.employee_id, e.name, e.domain, e.department, e.position, 
               e.email, e.phone, e.custom_fields, e.registered_date, f.embedding_name
        FROM employees e
        LEFT JOIN face_embeddings f ON e.employee_id = f.employee_id
    """)
    rows = cursor.fetchall()
    
    employees = []
    for row in rows:
        employees.append({
            "employee_id": row["employee_id"],
            "name": row["name"],
            "domain": row["domain"],
            "department": row["department"],
            "position": row["position"],
            "email": row["email"],
            "phone": row["phone"],
            "custom_fields": json.loads(row["custom_fields"]) if row["custom_fields"] else None,
            "registered_date": str(row["registered_date"]) if row["registered_date"] else None,
            "embedding_name": row["embedding_name"]
        })
        
    return {"status": "success", "count": len(employees), "employees": employees}
@router.post("/register")
def register_employee(data: EmployeeRegistration, db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    try:
        custom_fields_json = json.dumps(data.custom_fields) if data.custom_fields else None

        cursor.execute("""
            INSERT INTO employees (employee_id, name, domain, department, position, email, phone, custom_fields)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (data.employee_id, data.name, data.domain, data.department, data.position, data.email, data.phone, custom_fields_json))
        db.commit()
        return {"status": "success", "message": "Employee registered successfully"}
    except mysql.connector.errors.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Employee ID already exists")

@router.post("/link-face")
def link_face(data: FaceLinkRequest, db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT employee_id FROM face_embeddings WHERE employee_id = %s", (data.employee_id,))
        if cursor.fetchone():
            cursor.execute("""
                UPDATE face_embeddings SET embedding_name = %s WHERE employee_id = %s
            """, (data.embedding_name, data.employee_id))
        else:
            cursor.execute("""
                INSERT INTO face_embeddings (employee_id, embedding_name)
                VALUES (%s, %s)
            """, (data.employee_id, data.embedding_name))
        db.commit()
        return {"status": "success", "message": "Face linked successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-upload")
def bulk_upload(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    db: mysql_conn.CMySQLConnection = Depends(get_db)
):
    try:
        col_mapping = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    csv_reader = csv.DictReader(codecs.iterdecode(file.file, 'utf-8'))
    
    cursor = db.cursor()
    success_count = 0
    skipped_count = 0

    mapped_csv_headers = set(v for k, v in col_mapping.items() if v and isinstance(v, str))

    for row in csv_reader:
        # Extract values using mapping, default to empty string if not mapped or missing
        emp_id_col = col_mapping.get('employee_id')
        name_col = col_mapping.get('name')
        
        if not emp_id_col or not name_col:
            continue # Required fields mapping missing in configuration
            
        emp_id = row.get(emp_id_col, "").strip()
        name = row.get(name_col, "").strip()
        
        # Skip if row doesn't have required data
        if not emp_id or not name:
            skipped_count += 1
            continue

        domain = row.get(col_mapping.get('domain', ''), "").strip()
        department = row.get(col_mapping.get('department', ''), "").strip()
        position = row.get(col_mapping.get('position', ''), "").strip()

        # Capture remaining columns as custom fields
        custom_fields_dict = {}
        for csv_header, value in row.items():
            if csv_header and csv_header not in mapped_csv_headers:
                val = value.strip() if value else ""
                if val:
                    custom_fields_dict[csv_header] = val

        custom_fields_json = json.dumps(custom_fields_dict) if custom_fields_dict else None

        try:
            cursor.execute("""
                INSERT INTO employees (employee_id, name, domain, department, position, custom_fields)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (emp_id, name, domain, department, position, custom_fields_json))
            success_count += 1
        except mysql.connector.errors.IntegrityError:
            # Skip duplicates
            skipped_count += 1

    db.commit()
    return {
        "status": "success", 
        "message": f"Successfully imported {success_count} employees.",
        "success_count": success_count,
        "skipped_count": skipped_count
    }

import re

@router.post("/sql-upload")
async def sql_upload(
    file: UploadFile = File(...),
    db: mysql_conn.CMySQLConnection = Depends(get_db)
):
    if not (file.filename.endswith('.sql') or file.filename.endswith('.db')):
        raise HTTPException(status_code=400, detail="Only SQL dump files are allowed (.sql or .db)")

    content = await file.read()
    text = content.decode('utf-8', errors='ignore')
    
    cursor = db.cursor()
    success_count = 0
    skipped_count = 0
    
    # Extract only INSERT INTO employees statements securely
    for match in re.finditer(r"INSERT INTO `?employees`?.*?VALUES\s*(.+?);", text, re.IGNORECASE | re.DOTALL):
        values_str = match.group(1)
        
        # Extract each parenthesis tuple (row)
        for tuple_match in re.finditer(r"\((.*?)\)", values_str):
            inner_vals = tuple_match.group(1)
            # Find all single-quoted strings in the values list
            strings = re.findall(r"'([^']*)'", inner_vals)
            
            # Assuming first string is employee_id, second is name
            if len(strings) >= 2:
                emp_id = strings[0]
                name = strings[1]
                domain = strings[2] if len(strings) > 2 else ""
                dept = strings[3] if len(strings) > 3 else ""
                pos = strings[4] if len(strings) > 4 else ""
                
                try:
                    cursor.execute("""
                        INSERT INTO employees (employee_id, name, domain, department, position)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (emp_id, name, domain, dept, pos))
                    success_count += 1
                except mysql.connector.errors.IntegrityError:
                    skipped_count += 1
                    
    db.commit()
    return {
        "status": "success", 
        "message": f"Successfully imported {success_count} employees.",
        "success_count": success_count,
        "skipped_count": skipped_count
    }

from typing import Optional, Dict

class EmployeeUpdateRequest(BaseModel):
    name: str
    domain: str
    department: str
    position: str
    email: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[Dict[str, str]] = None

@router.put("/{employee_id}")
def update_employee(employee_id: str, data: EmployeeUpdateRequest, db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor()

    # First check if employee exists
    cursor.execute("SELECT employee_id FROM employees WHERE employee_id = %s", (employee_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Employee not found")

    custom_fields_json = json.dumps(data.custom_fields) if data.custom_fields else None

    cursor.execute("""
        UPDATE employees 
        SET name = %s, domain = %s, department = %s, position = %s, email = %s, phone = %s, custom_fields = %s
        WHERE employee_id = %s
    """, (data.name, data.domain, data.department, data.position, data.email, data.phone, custom_fields_json, employee_id))
    db.commit()
    
    return {"status": "success", "message": "Employee updated successfully"}

@router.delete("/{employee_id}")
def delete_employee(employee_id: str, db: mysql_conn.CMySQLConnection = Depends(get_db)):
    cursor = db.cursor()
    
    # Delete from face_embeddings
    cursor.execute("DELETE FROM face_embeddings WHERE employee_id = %s", (employee_id,))
    
    # Delete attendance records to satisfy foreign key constraints
    cursor.execute("DELETE FROM attendance WHERE employee_id = %s", (employee_id,))
    
    # Delete employee
    cursor.execute("DELETE FROM employees WHERE employee_id = %s", (employee_id,))
    db.commit()
    
    if cursor.rowcount > 0:
        return {"status": "success", "message": "Employee deleted successfully"}
    raise HTTPException(status_code=404, detail="Employee not found")
