# Design decisions

Covers DEV-09 to DEV-12 and D-01, D-03, D-05, D-06. Each entry: the choice, why, and
what we gave up.

## 1. Platform: offline web app (PWA) plus a Python central system (DEV-09)

**Choice.** The field app runs in the browser and can be installed to the home screen.
A service worker caches the app so it opens with no connection. The central system is a
Python FastAPI server.

**Why.** The requirements call for a mobile-friendly app (UI-01, UI-12, NFR-07) that keeps
working in airplane mode (DEV-16). A browser app runs on phones, tablets and laptops from
one codebase. The interpretation engine is Python, so the central system is Python too and
calls it directly.

**Trade-off.** Browsers limit background work, so automatic sync runs while the app is open
(FR-42 is Low priority). Installing on a phone over the network needs HTTPS, see Known
limitations.

## 2. Local storage: IndexedDB through Dexie (DEV-10)

**Choice.** Records, sites and sync bookkeeping live in IndexedDB on the device. The app
asks the browser to keep the storage persistent.

**Why.** IndexedDB is the browser's built-in database. It survives closing the app and
restarting the device (FR-15, FR-16, NFR-04), handles thousands of records (NFR-14) and
needs no install. Dexie makes it easier to use and to query.

**Central storage.** SQLite (`storage/central.db`): one file, no separate server, and
all-or-nothing transactions so a failed sync never leaves half a record.

## 3. Sync architecture: outbox with per-record results (DEV-11)

- Every save marks the record **pending** on the device. Nothing is removed from the device
  until the central system confirms it (FR-35, EH-04).
- The app sends pending records to `POST /sync` after each save, when the connection comes
  back, every 30 seconds, and when the researcher presses **Sync now** (FR-33, FR-39).
- Each record gets its own result: `synced`, `conflict` or `error`. One bad record never
  blocks the others (EH-12).
- **No duplicates (FR-34, BE-04).** Records carry a UUID made on the device. If the same
  content arrives twice, for example a retry after a dropped connection, the server
  recognizes it by a content fingerprint and does not store it again.
- Every record is validated on the server (BE-03, SR-09) with the same rules the capture
  form checks on the device (EH-02).

## 4. Conflict resolution (DEV-12, D-06)

**Detection.** Each record has a `version` on the central system. The device remembers
the last version it saw (`base_version`). If the server copy has changed since then and
the content is different, that is a conflict (FR-43).

**What happens.** The server does not apply the update. It keeps its copy, saves the
device's copy in a `conflicts` table, and returns its version to the device (FR-44,
FR-45). The device marks the record **Needs review** and keeps the researcher's data.

**Resolution.** The Sync page shows both versions side by side with the differences
highlighted (FR-48). The researcher chooses **Keep my version** (re-sent on top of the
latest version) or **Keep central version** (the device adopts it). The choice is logged
in the conflict history (FR-49, FR-50).

**Why this approach.** Automatic "last write wins" silently throws away someone's field
data, which FR-44 forbids. Asking the researcher is slower but never loses anything.

## 5. Interpretation pipeline (D-09)

Synced, non-deleted records are flattened into a CSV with one row per record: metadata
columns (site, time, location, conditions, device, version) followed by one column per
sensor. That is the shape `read_dataset` expects. The report from `interpret` is stored
exactly as `to_dict()` returns it, and the UI always shows `integrity_notes`, first.

## Known limitations (D-10)

- **No login yet.** The central system has no authentication (SR-04, SR-05, BE-09). Planned.
- **HTTP on localhost.** Secure transport (SR-03, SR-10) needs HTTPS before the central
  system runs anywhere other than the demo laptop. Installing the app on a phone over the
  network also requires HTTPS, because browsers only allow offline service workers on
  secure origins.
- **Sample engine.** Interpretation uses the sandbox mock engine, not the real Stewardship
  AI engine. Its pH rule also matches column names containing "ph" (for example
  Phosphorus), so we avoid such names in exported metadata columns.
