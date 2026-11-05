# Offline-First Field-Capture App

CIS 420 capstone for Stewardship Compute (sandbox Track 3).
Team: Destiny Childress, Noah Turner, KC Cabiness, Kountou Coulibaly.

Field researchers capture sensor readings, notes, site, time and conditions with no
signal. Records are saved on the device first and sync to the central system when the
connection returns. Synced data feeds the interpretation pipeline (`CONTRACT.md`), and
the app always shows the report's `integrity_notes`.

## How it fits together

```
Field device (browser / installed PWA)          Central system (Python)
┌───────────────────────────────┐   POST /sync  ┌──────────────────────────────┐
│ React UI: Capture, Records,   │ ────────────► │ FastAPI: validate, de-dupe,  │
│ Sync, Reports                 │ ◄──────────── │ detect conflicts             │
│ IndexedDB (records, sites)    │  per-record   │ SQLite: central.db           │
│ Service worker (works offline)│   results     │ Pipeline: CSV → read_dataset │
└───────────────────────────────┘               │           → interpret        │
                                                └──────────────────────────────┘
```

## Layout

| Path | Role |
|---|---|
| `ui/` | The field app: React + TypeScript + Tailwind, IndexedDB (Dexie), offline service worker |
| `server/` | Central system: sync API, SQLite storage, conflict detection, interpretation pipeline |
| `tests/` | pytest tests for the central system (IDs in docstrings map to the requirements) |
| `scripts/` | `start_demo.cmd` (Windows) and `start_demo.sh` (Mac / Linux) start everything |
| `docs/` | Decisions, requirement traceability |
| `storage/` | Central database and pipeline exports (created at runtime, not committed) |

## Getting started (teammates, first time)

You need **Python 3.11+**, **Node.js 20+** and **Git**. Check with `python3 --version`,
`node -v` and `git --version` (on Windows use `python --version`).

**1. Get the code**

```
git clone https://github.com/Kensington12/stewardship-ai-capstone-sandbox.git
cd stewardship-ai-capstone-sandbox
```

**2. Set up Python** (from the repo root)

Mac / Linux:

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r field_app/requirements-dev.txt
```

Windows (PowerShell or Command Prompt):

```
python -m venv .venv
.venv\Scripts\python -m pip install -r field_app\requirements-dev.txt
```

If `python` isn't found, install Python from python.org and tick **"Add python.exe to
PATH"** during setup, or use `py` instead of `python`.

**3. Set up the field app**

```
cd field_app/ui
npm install
cd ../..
```

You only do steps 1 to 3 once. `npm install` and `pip install` need internet; after that
everything runs offline.

## Run

**Windows:** double-click `field_app\scripts\start_demo.cmd`, or run this from the repo root:

```
field_app\scripts\start_demo.cmd
```

**Mac / Linux** (or Git Bash on Windows), from the repo root:

```
bash field_app/scripts/start_demo.sh
```

Both start the central system, build the field app, and open it in your browser.

If the browser doesn't open, go to **http://localhost:4173**. Stop with `Ctrl + C`.

The central system runs on port 8000 and the field app on port 4173, with the offline
service worker. For UI development with hot reload, run `npm run dev` in `field_app/ui`
instead (http://localhost:5173).

**Getting updates later:** `git pull`, then run `npm install` in `field_app/ui` and
`pip install -r field_app/requirements-dev.txt` again in case packages changed.

## Test

Mac / Linux (with `.venv` active):

```
python -m pytest field_app/tests -v
ruff check field_app && ruff format field_app
cd field_app/ui && npm run build
```

Windows:

```
.venv\Scripts\python -m pytest field_app\tests -v
.venv\Scripts\python -m ruff check field_app
cd field_app\ui ; npm run build
```

## Demo: the offline-to-online round trip

1. Start the app. Stop the central system (`Ctrl + C` in its terminal) to simulate no signal.
2. Capture a record: site, time, conditions, readings, notes. Save. The record shows "Saved on device".
3. Close the browser tab and reopen it. The record is still there.
4. Start the central system again. The record syncs on its own (or press **Sync now**).
5. Check `http://127.0.0.1:8000/records`: one copy, with all the original data.
6. Conflict: edit the same record somewhere else, then edit it on the device. The Sync page shows both versions side by side, and nothing is overwritten.

See `docs/DECISIONS.md` for why it is built this way and `docs/TRACEABILITY.md` for
where each requirement is handled.
