# BrandShift — Setup Guide

## Prerequisites

Install the following before starting:

- **Node.js** (v18+): https://nodejs.org
- **Python 3.11**: `winget install Python.Python.3.11`
- **MongoDB Community Server**: https://www.mongodb.com/try/download/community
  - During install: choose **Complete**, keep **"Install as a Service"** checked

---

## 1. Clone the project

```bash
git clone https://github.com/MarouaOuadrhiri/BrandShift
cd BrandShift
```

---

## 2. Start the Backend

Open a terminal in the project folder and run:

```powershell
cd backend_new

py -3.11 -m venv venv
venv\Scripts\activate

pip install setuptools django==3.2.7 djangorestframework django-cors-headers mongoengine PyJWT

python manage.py runserver 0.0.0.0:8000
```

Backend runs at `http://localhost:8000`

---

## 3. Start the Frontend

Open a **second terminal** in the project folder and run:

```powershell
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:4200`

---

## 4. (Optional) Seed the database with sample data

Open a **third terminal** in the project root and run:

```powershell
cd backend_new
venv\Scripts\activate
cd ..
python seed_data.py
```

This populates the database with departments, employees, projects, meetings, and messages.

---

## Notes

- MongoDB must be running before starting the backend. If you installed it as a service it starts automatically with Windows.
- To verify MongoDB is running: `Get-Service -Name MongoDB` in PowerShell — Status should be `Running`.
- The app is accessible to other computers on the same network at `http://<your-ip>:4200`
