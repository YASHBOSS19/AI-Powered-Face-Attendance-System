from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

# using alembic for db
from app.core.ws_manager import manager
from app.api import auth, employees, face, attendance, settings, super_admin, alerts, analytics, attendance_queries, employee_portal
from fastapi.staticfiles import StaticFiles

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("[*] Starting HR Backend...")
    try:
        from app.db.database import engine
        from app.db.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[*] Database tables verified.")
        
        from app.core.liveness import get_liveness_detector
        get_liveness_detector()
        print("[*] Anti-spoofing liveness model preloaded and ready.")
    except Exception as e:
        print("[!] DB initialization / warmup notice:", e)
    yield
    # Shutdown logic
    print("[*] Shutting down...")

app = FastAPI(title="HR Attendance API", version="1.0.0", lifespan=lifespan)

# Allow React frontend to connect
# Allow origins can be set via environment variable `FRONTEND_ORIGIN`.
# If not set, defaults to allow all (useful for local development).
frontend_origin = os.environ.get("FRONTEND_ORIGIN")
if frontend_origin:
    allow_origins = [frontend_origin]
else:
    allow_origins = ["*"]  # development default

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (ensure directory exists)
import os
os.makedirs("static/profiles", exist_ok=True)
app.mount("/api/static", StaticFiles(directory="static"), name="static")
app.mount("/static", StaticFiles(directory="static"), name="static_root")

# Mount Routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(face.router)
app.include_router(attendance.router)
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(alerts.router)
app.include_router(analytics.router)
app.include_router(super_admin.router)
app.include_router(attendance_queries.router)
app.include_router(employee_portal.router)

@app.websocket("/ws/attendance")
async def websocket_attendance(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive ping messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.get("/")
def root():
    return {"message": "Welcome to the FastAPI HR Backend!"}

# Uvicorn auto-reload trigger
