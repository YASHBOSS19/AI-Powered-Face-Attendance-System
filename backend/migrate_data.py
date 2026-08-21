import sqlite3
import mysql.connector
import os
from dotenv import load_dotenv

# Load MySQL credentials
load_dotenv('.env')

def migrate_data():
    sqlite_db_path = 'attendance.db'
    
    if not os.path.exists(sqlite_db_path):
        print(f"[-] SQLite database '{sqlite_db_path}' not found!")
        return

    print("[*] Connecting to SQLite...")
    sqlite_conn = sqlite3.connect(sqlite_db_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    print("[*] Connecting to MySQL...")
    try:
        mysql_conn = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ.get("DB_NAME", "attendance_db"),
            port=int(os.environ.get("DB_PORT", 3306))
        )
        mysql_cursor = mysql_conn.cursor()
    except Exception as e:
        print(f"[-] Failed to connect to MySQL: {e}")
        return

    # Disable foreign key checks temporarily during migration
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=0;")

    tables = ["hr_users", "employees", "face_embeddings", "attendance"]

    for table in tables:
        try:
            print(f"[*] Migrating table '{table}'...")
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            rows = sqlite_cursor.fetchall()
            
            if not rows:
                print(f"    - No data found in {table}, skipping.")
                continue

            # Get column names
            columns = rows[0].keys()
            cols_str = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            
            insert_query = f"INSERT IGNORE INTO {table} ({cols_str}) VALUES ({placeholders})"
            
            # Prepare data
            data_to_insert = [tuple(row[col] for col in columns) for row in rows]
            
            mysql_cursor.executemany(insert_query, data_to_insert)
            mysql_conn.commit()
            print(f"    - Successfully migrated {mysql_cursor.rowcount} rows into {table}.")
            
        except Exception as e:
            print(f"    - Error migrating {table}: {e}")

    # Re-enable foreign key checks
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=1;")
    
    sqlite_conn.close()
    mysql_conn.close()
    print("[+] Data migration complete!")

if __name__ == "__main__":
    migrate_data()
