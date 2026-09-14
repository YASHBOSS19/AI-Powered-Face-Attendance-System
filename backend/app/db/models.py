from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Enum, ForeignKeyConstraint, Text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

class HRUser(Base):
    __tablename__ = 'hr_users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default='HR')
    status = Column(String(50), default='active')
    
    # New fields for super admin & tenant isolation
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(255), nullable=True)
    permissions = Column(JSON, nullable=True)
    created_by = Column(Integer, nullable=True)
    created_by_username = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    employees = relationship("Employee", back_populates="hr_user", cascade="all, delete-orphan")
    saved_embeddings = relationship("SavedEmbedding", back_populates="hr_user", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(Integer, nullable=False)
    admin_username = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    resource = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Employee(Base):
    __tablename__ = 'employees'

    employee_id = Column(String(255), primary_key=True)
    hr_user_id = Column(Integer, ForeignKey('hr_users.id'), primary_key=True, default=1)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    position = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(255), nullable=True)
    custom_fields = Column(JSON, nullable=True)
    registered_date = Column(DateTime, default=datetime.utcnow)

    # Relationships
    hr_user = relationship("HRUser", back_populates="employees")
    face_embeddings = relationship("FaceEmbedding", back_populates="employee", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")

class FaceEmbedding(Base):
    __tablename__ = 'face_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(255), nullable=False)
    hr_user_id = Column(Integer, default=1)
    embedding_name = Column(String(255), nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ['employee_id', 'hr_user_id'],
            ['employees.employee_id', 'employees.hr_user_id'],
            ondelete="CASCADE"
        ),
    )

    # Relationships
    employee = relationship("Employee", back_populates="face_embeddings")

class SavedEmbedding(Base):
    __tablename__ = 'saved_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    hr_user_id = Column(Integer, ForeignKey('hr_users.id'), nullable=False)
    embedding_name = Column(String(255), nullable=False)
    embedding_vector = Column(JSON, nullable=False)

    # Relationships
    hr_user = relationship("HRUser", back_populates="saved_embeddings")

class AttendanceStatus(str, enum.Enum):
    present = 'present'
    late = 'late'
    absent = 'absent'

class Attendance(Base):
    __tablename__ = 'attendance'

    id = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(String(255), nullable=False)
    hr_user_id = Column(Integer, default=1)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    date = Column(String(255), nullable=False)
    checkin = Column(String(255), nullable=True)
    checkout = Column(String(255), nullable=True)
    status = Column(Enum(AttendanceStatus), nullable=True)

    __table_args__ = (
        ForeignKeyConstraint(
            ['employee_id', 'hr_user_id'],
            ['employees.employee_id', 'employees.hr_user_id'],
            ondelete="CASCADE"
        ),
    )

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")
