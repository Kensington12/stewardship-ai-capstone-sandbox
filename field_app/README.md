# Offline-First Field-Capture App

CIS 420 capstone for Stewardship Compute.
Team: Destiny Childress, Noah Turner, KC Cabiness, Kountou Coulibaly.

Researchers record sensor readings, notes, site, time and conditions with no signal.
Records save on the device and sync to the central system when the connection comes back.
Synced data then goes through the interpretation pipeline in `CONTRACT.md`.

## How it works

```
Field app (on the device)               Central system (Python)
- Capture, Records, Sync, Reports  ───►  - Checks each record
- Saves records on the device      ◄───  - Skips duplicates, flags conflicts
- Works offline                          - Runs the interpretation pipeline
```

## Folders

| Folder | What's in it |
|---|---|
| `ui/` | The field app (React) |
| `server/` | The central system (Python) |
| `tests/` | Tests for the central system |
| `scripts/` | Start and reset scripts |
| `docs/` | Design decisions and requirement tracking |
| `storage/` | Databases and the sync key, created when the app runs (not committed) |

## First-time setup

You need **Python 3.11+**, **Node.js 20+** and **Git**.

**1. Get the code**

```
git clone https://github.com/Kensington12/stewardship-ai-capstone-sandbox.git
cd stewardship-ai-capstone-sandbox
```

**2. Set up Python**

Mac:

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r field_app/requirements-dev.txt
```

Windows:

```
python -m venv .venv
.venv\Scripts\python -m pip install -r field_app\requirements-dev.txt
```

If Windows says `python` isn't found, reinstall Python and tick **"Add python.exe to PATH"**.

**3. Set up the app**

```
cd field_app/ui
npm install
cd ../..
```

## Run it

From the `stewardship-ai-capstone-sandbox` folder:

| Computer | Command |
|---|---|
| Mac | `bash field_app/scripts/start_demo.sh` |
| Windows | `.\field_app\scripts\start_demo.cmd` (or double-click it) |

The app opens at **http://localhost:4173**. Press `Ctrl + C` to stop.

**Connect your device once:** the terminal prints a sync key like `K7PM-Q2XD-9HWT-R4CN`.
Enter it on the app's **Sync** page. Without it, records still save but won't sync.

**Get updates:** `git pull`, then `npm install` in `field_app/ui`.

## Reset for a demo

Clears the central database and adds three example records:

```
.venv/bin/python field_app/scripts/reset_demo.py --seed        # Mac
.venv\Scripts\python field_app\scripts\reset_demo.py --seed   # Windows
```

To clear a device, use **Clear data on this device** on the Sync page.

## Test

```
.venv/bin/python -m pytest field_app/tests        # Mac
.venv\Scripts\python -m pytest field_app\tests   # Windows
```

## Demo steps

1. Reset, start the app, and enter the sync key.
2. Stop the central system (`Ctrl + C`) to simulate no signal.
3. Capture a record and save it. It shows **Saved on device**.
4. Close the tab and reopen it. The record is still there.
5. Start the central system again. The record syncs.
6. On the **Reports** page, the record appears once under **On the central system**.
7. Edit the same record in two places to show a conflict. Both versions appear side by
   side, and nothing is overwritten.

More detail: `docs/DECISIONS.md` (why it's built this way) and `docs/TRACEABILITY.md`
(where each requirement is handled).
