from pydantic import BaseModel
from typing import List, Optional, Dict

class LoginRequest(BaseModel):
    username: str
    password: str

class EmployeeRegistration(BaseModel):
    employee_id: str
    name: str
    domain: str
    department: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: Optional[Dict[str, str]] = None

class DatasetCreateRequest(BaseModel):
    name: str
    images: List[str]  # Base64 encoded images

class FaceLinkRequest(BaseModel):
    employee_id: str
    embedding_name: str

class RecognizeRequest(BaseModel):
    image: str
    threshold: Optional[float] = 0.35
