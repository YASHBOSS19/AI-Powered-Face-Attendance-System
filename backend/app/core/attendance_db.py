import os
from datetime import datetime, date
from app.db.database import get_db_context

def init_db():
    """Initialize MySQL database with employees and attendance tables"""
    with get_db_context() as conn:
        cursor = conn.cursor()
        
        # Create employees table first
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                employee_id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                position VARCHAR(255),
                department VARCHAR(255),
                registered_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                face_embedding_id INT UNIQUE
            )
        """)
        
        # Create hr_users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hr_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'HR'
            )
        """)

        # Create face_embeddings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(255) NOT NULL,
                embedding_name VARCHAR(255) NOT NULL,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                date VARCHAR(255) NOT NULL,
                checkin VARCHAR(255),
                checkout VARCHAR(255),
                status ENUM('present', 'late', 'absent'),
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        """)
        
        # Create indexes AFTER tables are created (MySQL syntax)
        try:
            cursor.execute("""
                CREATE INDEX idx_attendance_employee 
                ON attendance(employee_id)
            """)
        except Exception:
            pass # Index might already exist, MySQL handles IF NOT EXISTS differently for indexes
        
        conn.commit()


def get_today_status(name, employee_id=None):
    """Get today's attendance status for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    with get_db_context() as conn:
        cursor = conn.cursor(dictionary=True)
        name = name.strip()
        
        if employee_id:
            cursor.execute("""
                SELECT id, checkin, checkout, status FROM attendance
                WHERE (employee_id = %s OR name = %s) AND date = %s
            """, (employee_id, name, today_str))
        else:
            cursor.execute("""
                SELECT id, checkin, checkout, status FROM attendance
                WHERE name = %s AND date = %s
            """, (name, today_str))
            
        row = cursor.fetchone()
        if row:
            return {
                "has_record": True,
                "checkin": row["checkin"],
                "checkout": row["checkout"],
                "status": row["status"]
            }
        return {
            "has_record": False,
            "checkin": None,
            "checkout": None,
            "status": None
        }


def record_checkin(name, employee_id=None):
    """Perform check-in for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    now_time_str = datetime.now().strftime("%H:%M:%S")
    current_hour = datetime.now().hour
    status = 'present' if current_hour < 10 else 'late'

    with get_db_context() as conn:
        cursor = conn.cursor()
        name = name.strip()

        domain = 'Unknown'
        if employee_id:
            cursor.execute("SELECT domain FROM employees WHERE employee_id = %s", (employee_id,))
            res = cursor.fetchone()
            if res:
                domain = res[0]

        existing = get_today_status(name, employee_id)
        if existing["has_record"]:
            return {
                "success": True,
                "message": f"Already checked in today at {existing['checkin']}",
                "already_checked_in": True,
                "checkin": existing["checkin"],
                "checkout": existing["checkout"],
                "status": existing["status"]
            }

        cursor.execute("""
            INSERT INTO attendance (employee_id, name, domain, date, checkin, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            employee_id if employee_id else name,
            name,
            domain,
            today_str,
            now_time_str,
            status
        ))
        conn.commit()
        return {
            "success": True,
            "message": f"Checked in successfully at {now_time_str}",
            "already_checked_in": False,
            "checkin": now_time_str,
            "checkout": None,
            "status": status
        }


def record_checkout(name, employee_id=None):
    """Perform check-out for an employee"""
    today_str = date.today().strftime("%Y-%m-%d")
    now_time_str = datetime.now().strftime("%H:%M:%S")

    with get_db_context() as conn:
        cursor = conn.cursor()
        name = name.strip()

        domain = 'Unknown'
        if employee_id:
            cursor.execute("SELECT domain FROM employees WHERE employee_id = %s", (employee_id,))
            res = cursor.fetchone()
            if res:
                domain = res[0]

        existing = get_today_status(name, employee_id)
        if existing["has_record"]:
            cursor.execute("""
                UPDATE attendance SET checkout = %s
                WHERE (employee_id = %s OR name = %s) AND date = %s
            """, (now_time_str, employee_id if employee_id else name, name, today_str))
            conn.commit()
            return {
                "success": True,
                "message": f"Checked out successfully at {now_time_str}",
                "checkin": existing["checkin"],
                "checkout": now_time_str,
                "status": existing["status"]
            }
        else:
            current_hour = datetime.now().hour
            status = 'present' if current_hour < 10 else 'late'
            cursor.execute("""
                INSERT INTO attendance (employee_id, name, domain, date, checkin, checkout, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                employee_id if employee_id else name,
                name,
                domain,
                today_str,
                now_time_str,
                now_time_str,
                status
            ))
            conn.commit()
            return {
                "success": True,
                "message": f"Checked out at {now_time_str}",
                "checkin": now_time_str,
                "checkout": now_time_str,
                "status": status
            }


def mark_attendance(name, employee_id=None):
    """
    Mark attendance for an employee (legacy helper)
    """
    res = record_checkin(name, employee_id)
    return not res.get("already_checked_in", False)


def auto_mark_absent():
    """Mark attendance as 'absent' for past dates if checkout is missing."""
    today_str = date.today().strftime("%Y-%m-%d")
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE attendance 
            SET status = 'absent' 
            WHERE checkout IS NULL AND date < %s AND status != 'absent'
        """, (today_str,))
        conn.commit()

def get_attendance_report(date_from=None, date_to=None):
    """
    Generate attendance report between dates
    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
    Returns:
        List of attendance records with employee details
    """
    if not date_from:
        date_from = date.today().replace(day=1).strftime("%Y-%m-%d")
    if not date_to:
        date_to = date.today().strftime("%Y-%m-%d")
        
    auto_mark_absent()
        
    with get_db_context() as conn:
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                e.employee_id,
                e.name,
                e.domain,
                e.department,
                SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) AS days_present,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS days_late,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS days_absent
            FROM employees e
            LEFT JOIN attendance a ON (e.employee_id = a.employee_id OR e.name = a.name)
                AND a.date BETWEEN %s AND %s
            GROUP BY e.employee_id
            ORDER BY e.department, e.name
        """, (date_from, date_to))
        
        return [dict(row) for row in cursor.fetchall()]

def get_employee_attendance(employee_id=None, name=None, date_from=None, date_to=None):
    """
    Get detailed attendance for a specific employee
    """
    with get_db_context() as conn:
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                id,
                employee_id,
                name,
                domain,
                date,
                checkin,
                checkout,
                status
            FROM attendance
            WHERE 1=1
        """
        params = []
        
        if employee_id and name:
            query += " AND (employee_id = %s OR name = %s)"
            params.extend([employee_id, name])
        elif employee_id:
            query += " AND (employee_id = %s OR name = %s)"
            params.extend([employee_id, employee_id])
        elif name:
            query += " AND (name = %s OR employee_id = %s)"
            params.extend([name, name])
            
        if date_from and date_to:
            query += " AND date BETWEEN %s AND %s"
            params.extend([date_from, date_to])
        elif date_from:
            query += " AND date >= %s"
            params.append(date_from)
        elif date_to:
            query += " AND date <= %s"
            params.append(date_to)
            
        query += " ORDER BY date DESC, checkin DESC"
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

def get_today_attendance_summary():
    """
    Get today's overall attendance statistics, employee records, and department breakdown
    """
    today_str = date.today().strftime("%Y-%m-%d")
    with get_db_context() as conn:
        cursor = conn.cursor(dictionary=True)

        # Total employees count
        cursor.execute("SELECT COUNT(*) as count FROM employees")
        total_employees = cursor.fetchone()["count"]

        # Today's attendance records
        cursor.execute("""
            SELECT 
                a.id,
                a.employee_id,
                a.name,
                a.domain,
                a.date,
                a.checkin,
                a.checkout,
                a.status,
                COALESCE(e.department, e.domain, 'General') AS department,
                e.position
            FROM attendance a
            LEFT JOIN employees e ON (a.employee_id = e.employee_id OR a.name = e.name)
            WHERE a.date = %s
            ORDER BY a.checkin DESC
        """, (today_str,))
        today_records = [dict(row) for row in cursor.fetchall()]

        # Calculate KPI stats
        present_today = len(today_records)
        on_time_count = sum(1 for r in today_records if r["status"] == "present")
        late_count = sum(1 for r in today_records if r["status"] == "late")
        absent_count = max(0, total_employees - present_today)

        # Department breakdown
        cursor.execute("""
            SELECT 
                COALESCE(department, domain, 'General') AS dept_name,
                COUNT(DISTINCT employee_id) AS total_emp
            FROM employees
            GROUP BY dept_name
        """)
        dept_rows = cursor.fetchall()

        dept_summary = []
        for d in dept_rows:
            d_name = d["dept_name"]
            d_total = d["total_emp"]
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

def update_attendance(record_id, checkin, checkout, status):
    """Manually update an attendance record"""
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE attendance 
            SET checkin = %s, checkout = %s, status = %s
            WHERE id = %s
        """, (checkin, checkout, status, record_id))
        conn.commit()
        return cursor.rowcount > 0

def delete_attendance(record_id):
    """Manually delete an attendance record"""
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attendance WHERE id = %s", (record_id,))
        conn.commit()
        return cursor.rowcount > 0