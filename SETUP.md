# KVON TECH Facial Attendance System - Setup Guide

This guide provides step-by-step instructions to set up and run the Facial Attendance System (Backend API & React HR Frontend) on any computer/laptop.

---

## 📋 System Prerequisites

Before starting, ensure the following software is installed on the target machine:

1. **Python 3.10+** (with `pip`)
2. **Node.js 18+** & `npm`
3. **CMake** & **C++ Build Tools** (Recommended for `insightface` / `onnxruntime` dependencies)
4. **Git**

---

## ⚙️ 1. Backend Setup (FastAPI & OpenCV Face Engine)

Navigate to the `backend` directory:

```bash
cd backend
```

### Step 1.1: Create a Virtual Environment
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### Step 1.2: Install Backend Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 1.3: Database Setup
The backend uses **MySQL** and **Alembic** for managing the database and tables.

1. Ensure MySQL is running on your system.
2. Create a new database named `attendance_db` in your MySQL server.
3. Configure the environment variables by creating a `.env` file in the `backend` directory (you can copy `.env.example` if it exists) and fill in your database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=attendance_db
   DB_PORT=3306
   ```
4. Run the database migrations to create all the necessary tables:
   ```bash
   alembic upgrade head
   ```
5. Seed the default super admin account and the `audit_logs` table:
   ```bash
   python scripts/seed_super_admin.py
   ```

### Step 1.4: Start Backend API Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
> The API server will be live at: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)

---

## 💻 2. Frontend Setup (React & Vite HR Portal)

Open a new terminal tab/window and navigate to `hr-frontend`:

```bash
cd hr-frontend
```

### Step 2.1: Install NPM Dependencies
```bash
npm install
```

### Step 2.2: Start Frontend Development Server
```bash
npm run dev
```
> The web portal will be live at: `http://localhost:5173`

---

## 🚀 Application Links & Credentials

- **HR Admin Portal**: `http://localhost:5173/login`
  - **Username**: `admin` *(or `superadmin`)*
  - **Password**: `password123` *(or `superadmin123`)*
- **Gate Kiosk Terminal**: `http://localhost:5173/gate` *(For office entrance tablet deployment)*
- **API Documentation**: `http://localhost:8000/docs`

---

## 🐳 Docker Deployment (Production & Testing)

To easily spin up the entire application (MySQL Database, FastAPI Backend, and React Frontend) using Docker, run the following command from the root directory:

```bash
docker-compose --env-file .env.docker up --build
```
> The API will be available at `http://localhost:8000` and the HR portal at `http://localhost:5173`.

---

## Share It With Microsoft Dev Tunnel

Because the frontend now proxies `/api` and `/ws` to the local backend, your friend only needs one public tunnel: the frontend on port `5173`.

1. Start the backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. Start the frontend:

```bash
cd hr-frontend
npm run dev
```

3. Log in to Dev Tunnels once:

```bash
devtunnel user login
```

4. Host the frontend port:

```bash
devtunnel host -p 5173 --allow-anonymous
```

5. Share the public `https://...devtunnels.ms/` URL that the command prints.

Optional: if you also want to expose the backend docs directly, you can run a second tunnel:

```bash
devtunnel host -p 8000 --allow-anonymous
```
