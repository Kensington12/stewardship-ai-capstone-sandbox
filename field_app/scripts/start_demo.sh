#!/usr/bin/env bash
# Start the whole Field-Capture App: the central system, then the field app.
# Usage (from the repo root):  bash field_app/scripts/start_demo.sh
# Stop everything with Ctrl + C.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

source .venv/bin/activate

echo "Starting the central system on http://127.0.0.1:8000 ..."
uvicorn field_app.server.app:app --port 8000 &
SERVER_PID=$!
trap 'echo; echo "Stopping the central system..."; kill $SERVER_PID 2>/dev/null' EXIT

cd field_app/ui
echo "Building the field app (with offline support)..."
npm run build --silent

(sleep 3 && open http://localhost:4173) &
echo "Field app running at http://localhost:4173"
npm run preview
