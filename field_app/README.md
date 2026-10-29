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
| `scripts/` | `start_demo.sh` starts everything |
| `docs/` | Decisions, requirement traceability |
| `storage/` | Central database and pipeline exports (created at runtime, not committed) |

## Setup (once)

From the repo root, with the sandbox `.venv` active:

```
pip install -r field_app/requirements-dev.txt
cd field_app/ui && npm install
```

## Run

```
bash field_app/scripts/start_demo.sh
```

Starts the central system on port 8000, builds the field app, and serves it with the
offline service worker at http://localhost:4173. For UI development with hot reload,
run `npm run dev` in `field_app/ui` instead (http://localhost:5173).

## Test

```
python -m pytest field_app/tests -v
ruff check field_app && ruff format field_app
cd field_app/ui && npm run build
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
