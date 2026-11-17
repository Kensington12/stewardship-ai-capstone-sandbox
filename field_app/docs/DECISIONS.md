# Design decisions

The main choices we made, why, and what we gave up. Requirement IDs are in brackets.

## 1. Platform: an offline web app (PWA) and a Python server (DEV-09)

- The field app runs in the browser and can be installed like an app. It opens and works
  with no connection.
- One codebase covers phones, tablets and laptops (UI-01, UI-12).
- The server is Python because the interpretation engine is Python.
- **Trade-off:** sync only runs while the app is open, and installing on a phone needs
  HTTPS.

## 2. Storage (DEV-10)

- **On the device:** IndexedDB, the browser's built-in database. Records survive closing
  the app and restarting the device (FR-15, FR-16).
- **On the server:** SQLite, a single database file. A sync either saves completely or not
  at all, so there are never half-saved records.

## 3. Sync (DEV-11)

- Every save is marked **waiting to sync**. Nothing leaves the device until the server
  confirms it (FR-35).
- The app syncs after each save, when the connection returns, every 30 seconds, and when
  the researcher taps **Sync now** (FR-33, FR-39).
- Each record succeeds or fails on its own, so one bad record doesn't block the rest
  (EH-12).
- **No duplicates (FR-34):** if the same record arrives twice, the server recognizes it
  and keeps one copy.
- The server checks every record with the same rules as the capture form (BE-03, EH-02).

## 4. Conflicts (DEV-12)

- A conflict is when a record was changed in two places since the last sync (FR-43).
- The server doesn't overwrite anything. It keeps its copy, saves the device's copy, and
  marks the record **Needs review** (FR-44, FR-45).
- The Sync page shows both versions side by side. The researcher picks **Keep my version**
  or **Keep central version**, and the choice is logged (FR-48 to FR-50).
- **Why:** "last save wins" would quietly throw away someone's field data.

## 5. Interpretation (D-09)

- Synced records become a CSV with one row per record and one column per sensor, the
  format `read_dataset` expects.
- Reports are saved exactly as the engine returns them, and the app always shows the
  integrity notes first.

## 6. Security (D-07)

- **Sync key (SR-04, SR-05):** the server only accepts requests that include the team's
  sync key. It's created on first start and printed in the terminal.
- **No field data in logs (SR-08):** the server only logs which page was called, not what
  was sent. A test checks this.
- **Clear a device (SR-11):** the Sync page can wipe everything on a device, with a warning
  if anything hasn't synced.
- **Trade-off:** one key is shared by the whole team, so the server can't tell
  researchers apart.

## Known limitations (D-10)

- **No HTTPS yet (SR-03).** Needed before the server runs anywhere but the demo laptop,
  and for installing the app on a phone.
- **One shared key** instead of personal logins.
- **Sample engine.** Reports come from the sandbox's mock engine, not the real one.
