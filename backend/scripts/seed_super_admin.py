import os
import sys
from werkzeug.security import generate_password_hash

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import get_db_context

def setup_super_admin():
    print("[*] Setting up Super Admin and Audit Logs...")
    
    import mysql.connector
    from dotenv import load_dotenv
    import os
    
    load_dotenv('.env')
    
    try:
        db = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ.get("DB_NAME", "attendance_db"),
            port=int(os.environ.get("DB_PORT", 3306))
        )
        cursor = db.cursor()
    except Exception as e:
        print(f"[-] Failed to connect to MySQL: {e}")
        return
        
    # 1. Create audit_logs table
    print("[*] Ensuring audit_logs table exists...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_id INT NOT NULL,
            admin_username VARCHAR(255) NOT NULL,
            action VARCHAR(255) NOT NULL,
            resource VARCHAR(255) NOT NULL,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 2. Check if Super Admin exists
    print("[*] Checking for existing SUPER_ADMIN...")
    cursor.execute("SELECT id FROM hr_users WHERE role = 'SUPER_ADMIN' AND username = 'superadmin'")
    existing = cursor.fetchone()
    
    if existing:
        print("[+] Super Admin account already exists.")
    else:
        print("[*] Creating default Super Admin account...")
        password = "superadmin123"
        hashed = generate_password_hash(password)
        
        cursor.execute("""
            INSERT INTO hr_users (username, password_hash, role, full_name, status)
            VALUES (%s, %s, %s, %s, %s)
        """, ('superadmin', hashed, 'SUPER_ADMIN', 'System Super Admin', 'active'))
        
        print(f"[+] Successfully created Super Admin!")
        print(f"    Username: superadmin")
        print(f"    Password: {password}")
        print(f"    WARNING: Please change this password in production!")
        
    db.commit()
    db.close()

if __name__ == "__main__":
    setup_super_admin()
