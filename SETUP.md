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

### Step 1.3: Start Backend API Server
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
  - **Username**: `admin`
  - **Password**: `password123` *(or `admin123`)*
- **Gate Kiosk Terminal**: `http://localhost:5173/gate` *(For office entrance tablet deployment)*
- **API Documentation**: `http://localhost:8000/docs`

---

## 🧪 3. Testing Model Accuracy

The backend includes a built-in script to test the facial recognition model's accuracy against a dataset of images.

1. **Prepare Test Data**: Inside the `backend` directory, create a folder named `test_images`.
2. **Organize by Employee**: Inside `test_images`, create subfolders for each employee using their exact name (matching the database).
3. **Add Images**: Place testing images (different from the training images) inside the corresponding employee's folder.

**Folder Structure Example**:
```text
backend/
└── test_images/
    ├── John Doe/
    │   ├── test_img1.jpg
    │   └── test_img2.jpg
    └── Jane Smith/
        └── test_img1.jpg
```

4. **Run the Test**: Ensure your virtual environment is activated, then run the script:
```bash
cd backend
python test_accuracy.py
```

The script will output the recognition results per image, followed by an overall accuracy report (correct matches, false positives, false negatives).

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
