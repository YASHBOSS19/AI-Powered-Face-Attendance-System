#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting HR Attendance Backend initialization..."

# Run database migrations
echo "Running alembic upgrade head..."
alembic upgrade head

# Seed initial super admin
echo "Running seed_super_admin.py..."
python scripts/seed_super_admin.py

echo "Starting uvicorn server..."
mkdir -p logs
uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 | tee logs/backend.log
