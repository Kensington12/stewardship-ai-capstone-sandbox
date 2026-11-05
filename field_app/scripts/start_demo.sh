#!/usr/bin/env bash
# Starts the central system and the field app. Run from the repo root:
#   bash field_app/scripts/start_demo.sh
# Ctrl + C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
elif [ -f .venv/Scripts/activate ]; then
  source .venv/Scripts/activate
else
  echo "No .venv found. Follow 'Getting started' in field_app/README.md first."
  exit 1
fi

if [ ! -d field_app/ui/node_modules ]; then
  echo "Field app packages missing. Run: cd field_app/ui && npm install"
  exit 1
fi

echo "Starting the central system on http://127.0.0.1:8000 ..."
python -m uvicorn field_app.server.app:app --port 8000 &
SERVER_PID=$!
trap 'echo; echo "Stopping the central system..."; kill $SERVER_PID 2>/dev/null' EXIT

cd field_app/ui
echo "Building the field app (with offline support)..."
npm run build --silent

URL="http://localhost:4173"
(sleep 3 && { open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || start "$URL" 2>/dev/null || true; }) &
echo "Field app running at $URL"
npm run preview
