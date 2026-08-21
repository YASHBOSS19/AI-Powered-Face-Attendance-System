import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

def get_db_connection():
    """Create and return a new MySQL connection"""
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "attendance_db"),
        port=int(os.environ.get("DB_PORT", 3306))
    )

def get_db():
    """FastAPI dependency for database connection"""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

from contextlib import contextmanager

@contextmanager
def get_db_context():
    """Context manager for DB connections (for non-FastAPI use)"""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
