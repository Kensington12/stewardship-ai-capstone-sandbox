# Requirement traceability (T-23)

Maps every requirement in the team's requirements document to where it is handled and
how it is tested. Update the **Status** column as work lands.

**Status values:** Done, Partial (started but not finished), Planned (not started yet).

**Test types:**

- `pytest`: automated server test in `field_app/tests` (the test docstrings list the IDs)
- `E2E`: browser walkthrough of the completion workflow
- `Manual`: checked by hand during demo rehearsal

## User stories

| ID | Handled by | Status |
|---|---|---|
| US-01 Record readings offline | Capture page, IndexedDB | Done |
| US-02 Record notes | Capture page, Notes section | Done |
| US-03 Site, time, conditions | Capture page, data model | Done |
| US-04 Stored locally | `ui/src/db.ts` | Done |
| US-05 Saved vs synced status | Status badges, header, Sync page | Done |
| US-06 Sync when connectivity returns | `ui/src/sync.ts`, `useAutoSync` | Done |
| US-07 Conflicts handled safely | `server/sync.py`, Sync page | Done |
| US-08 Review before sync | Records page, edit form | Done |
| US-09 Data available to pipeline | `server/pipeline.py`, Reports page | Done |
| US-10 Usable on unreliable networks | Local-first saves, timeouts, retries | Done |

## Functional requirements

| ID | Pri | Handled by | Test | Status |
|---|---|---|---|---|
| FR-01 Create record offline | H | Capture page | E2E | Done |
| FR-02 Sensor readings | H | Capture page, Readings | E2E | Done |
| FR-03 Written notes | H | Capture page, Notes | E2E | Done |
| FR-04 Associate with site | H | Site picker / new site | E2E | Done |
| FR-05 Date and time | H | `capturedAt` field | E2E | Done |
| FR-06 Conditions | H | Field conditions section | E2E | Done |
| FR-07 Save without network | H | `saveRecord` (IndexedDB) | E2E | Done |
| FR-08 View stored records | H | Records page | E2E | Done |
| FR-09 Edit before sync | H | `/records/:id/edit` | pytest, E2E | Done |
| FR-10 Status per record | H | `StatusBadge` | E2E | Done |
| FR-11 Delete | M | Records page, tombstone sync | pytest | Done |
| FR-12 Search / filter | M | Records page search and chips | Manual | Done |
| FR-13 Stored locally offline | H | `ui/src/db.ts` | E2E | Done |
| FR-14 Structured data | H | `ui/src/types.ts`, `server/models.py` | pytest | Done |
| FR-15 Survives connectivity loss | H | IndexedDB | E2E | Done |
| FR-16 Survives close / reopen | H | IndexedDB, `storage.persist()` | E2E | Done |
| FR-17 Unique ID | H | Device-made UUIDs | pytest | Done |
| FR-18 Sync status tracked | H | `syncStatus` field | E2E | Done |
| FR-19 Created / modified times | M | `createdAt`, `updatedAt` | pytest | Done |
| FR-20 Source device | M | `deviceId` | pytest | Done |
| FR-21 Storage usage info | L | None | None | Planned |
| FR-22 to FR-26 Data models | H | `types.ts`, `models.py`, `db.py` | pytest | Done |
| FR-27 Linked to site and record | H | Readings / notes inside a record | pytest | Done |
| FR-28 Relationships kept on sync | H | Whole record syncs as one unit | pytest | Done |
| FR-29 Extra sensors without redesign | M | "Other" sensor, readings as rows | pytest | Done |
| FR-30 Detect connectivity | H | `useConnection` | E2E | Done |
| FR-31 Keep capturing offline | H | Local-first design | E2E | Done |
| FR-32 Queue offline records | H | `pending` status (outbox) | E2E | Done |
| FR-33 Sync when back online | H | `useAutoSync` | E2E | Done |
| FR-34 No duplicates | H | Content fingerprint | pytest, E2E | Done |
| FR-35 Keep data if sync fails | H | Device keeps record until confirmed | E2E | Done |
| FR-36 Retry after failure | H | Auto retry every 30 s, Sync now | E2E | Done |
| FR-37 Status to user | H | Header, Sync page | E2E | Done |
| FR-38 Identify failed records | H | "Sync failed" status and list | pytest | Done |
| FR-39 Manual sync | M | Sync now button | E2E | Done |
| FR-40 Synced summary | M | Toast, last-sync line | E2E | Done |
| FR-41 Pending summary | M | Header pill, Sync tiles | E2E | Done |
| FR-42 Background sync | L | Auto sync while app is open | Manual | Partial |
| FR-43 Detect conflicts | H | `base_version` check | pytest, E2E | Done |
| FR-44 No silent overwrite | H | Update not applied on conflict | pytest, E2E | Done |
| FR-45 Preserve local data | H | Device keeps its copy | E2E | Done |
| FR-46 Indicate conflict | H | "Needs review" badge, Sync page | E2E | Done |
| FR-47 Defined strategy | H | `docs/DECISIONS.md` §4 | None | Done |
| FR-48 Review both versions | M | Side-by-side compare | E2E | Done |
| FR-49 Choose resolution | M | Keep mine / keep central | pytest, E2E | Done |
| FR-50 Conflict history | L | `conflicts` table | pytest | Done |
| FR-51 Structured output | H | `/export/records.csv` | pytest | Done |
| FR-52 Metadata preserved | H | Metadata columns in export | pytest | Done |
| FR-53 Synced vs incomplete | H | Only synced, non-deleted records exported | pytest | Done |
| FR-54 Export mechanism | M | CSV export, `POST /reports` | pytest | Done |
| FR-55 Direct integration | L | Calls `sandbox_engine` directly | pytest | Done |

## Security

| ID | Handled by | Status |
|---|---|---|
| SR-01 Protect local data | Browser storage is private to the app's origin | Partial |
| SR-02 No third-party services | Nothing leaves the device except to the central system | Done |
| SR-03 Secure transport | Needs HTTPS outside the demo laptop | Planned |
| SR-04 Authentication | Not built yet | Planned |
| SR-05 Block unauthorized access | Depends on SR-04 | Planned |
| SR-06 No stored credentials | No credentials exist yet | Done |
| SR-07 No data in URLs | Records sent in request bodies, only IDs in paths | Done |
| SR-08 No data in logs | Server logs request lines only | Partial (T-17 test planned) |
| SR-09 Validate incoming data | `server/models.py` | Done |
| SR-10 Integrity in transit | Depends on SR-03 | Planned |
| SR-11 Clear local data | Not built yet | Planned |
| SR-12 Document protection | `docs/DECISIONS.md` | Partial |

## UI and accessibility

| ID | Handled by | Status |
|---|---|---|
| UI-01, UI-12 Mobile friendly, responsive | Bottom tab bar on phones, sidebar on wider screens | Done |
| UI-02 to UI-05 Inputs for readings, notes, site, time, conditions | Capture page | Done |
| UI-06 Online / offline | Header pill | Done |
| UI-07 Saved locally | Toast, "Saved on device" badge | Done |
| UI-08 Sync status | Badges, header, Sync page | Done |
| UI-09 Instructions | Intro text and hints on Capture | Done |
| UI-10 Understandable errors | Plain-language messages | Done |
| UI-11 Review before sync | Records page | Done |
| UI-13 Pending view | Sync page "Waiting to sync" | Done |
| UI-14 Errors / conflicts view | Sync page sections | Done |
| UI-15, UI-16 Confirmations | Toasts | Done |
| UI-17 Display settings | None | Planned |
| A-01, A-06 Labels | Every input has a label | Done |
| A-02 Contrast | Palette chosen for 4.5:1 text | Done |
| A-03 Not color only | Every status has an icon and words | Done |
| A-04 Actionable errors | Messages say what to do | Done |
| A-05 Keyboard | Real buttons, links and form fields | Done |
| A-07 Readable sizes | 15 px+ body, 44 px+ touch targets | Done |
| A-08 Platform features | Standard HTML, works with screen readers | Partial |

## Backend and error handling

| ID | Handled by | Status |
|---|---|---|
| BE-01 Receive synced data | `POST /sync` | Done |
| BE-02 API | FastAPI JSON API | Done |
| BE-03 Validate | `server/models.py` | Done |
| BE-04 No duplicates | Content fingerprint | Done |
| BE-05 Track sync status | `version`, `synced_at` | Done |
| BE-06 Support conflict process | `conflicts` table, resolve endpoint | Done |
| BE-07 Clear responses | Per-record `synced` / `conflict` / `error` | Done |
| BE-08 Don't log data | Request lines only | Partial |
| BE-09 Authentication | Not built yet | Planned |
| BE-10 Safe error details | Validation messages name the field, no internals | Done |
| EH-01 Save offline | Local-first saves | Done |
| EH-02 Block invalid records | Form validation + server validation | Done |
| EH-03 Local save error | Toast if IndexedDB write fails | Done |
| EH-04 Keep data when sync fails | Device keeps records until confirmed | Done |
| EH-05 Retry | Automatic and manual | Done |
| EH-06 Identify failures | "Sync failed" status | Done |
| EH-07 No silent overwrite | Conflict detection | Done |
| EH-08 Conflict message | Sync page explanation | Done |
| EH-09 Unexpected errors | Generic messages, data stays local | Done |
| EH-10 Bad input doesn't crash | Per-record validation | Done |
| EH-11 Recovery options | Fix record / Sync now / keep version | Done |
| EH-12 Other records continue | Per-record results | Done |

## Testing

| ID | How | Status |
|---|---|---|
| T-01 to T-05 Offline capture, storage, reopen | E2E | Done |
| T-06 Sync after reconnect | E2E | Done |
| T-07 No duplicates | `test_resending_the_same_record_does_not_duplicate`, E2E | Done |
| T-08 Interrupted sync | Planned: kill the server mid-sync | Planned |
| T-09 No loss on failure | E2E (sync while server down) | Done |
| T-10 Multiple records | `test_multiple_pending_records_sync_together` | Done |
| T-11, T-12 Conflicts | `test_conflicting_edit_...`, `test_keeping_the_device_version_...`, E2E | Done |
| T-13 Metadata kept | `test_new_record_is_stored_with_all_metadata` | Done |
| T-14 Pipeline format | `test_pipeline.py` | Done |
| T-15 Invalid input | `test_invalid_record_...` | Done |
| T-16 Unexpected errors | `test_garbage_input_does_not_crash_the_server` | Done |
| T-17 Logs | Planned | Planned |
| T-18 Security testing | Planned | Planned |
| T-19, T-20 Browsers / screen sizes | Desktop and 390 px phone checked; more devices planned | Partial |
| T-21 Intermittent connectivity | Planned | Planned |
| T-22 Test documentation | This file + test docstrings | Partial |
| T-23 Traceability | This file | Done |
| T-24 Round-trip demo | README demo steps | Partial (rehearsal) |

## Documentation and non-functional

| ID | Where | Status |
|---|---|---|
| D-01 Architecture | `README.md`, `DECISIONS.md` | Done |
| D-02 Capture workflow | `README.md` demo steps | Partial |
| D-03 Local storage | `DECISIONS.md` §2 | Done |
| D-04 Data model | `ui/src/types.ts`, `server/models.py` | Partial (needs a diagram) |
| D-05 Sync process | `DECISIONS.md` §3 | Done |
| D-06 Conflict strategy | `DECISIONS.md` §4 | Done |
| D-07 Security decisions | `DECISIONS.md` known limitations | Partial |
| D-08 Testing | This file | Partial |
| D-09 Pipeline | `DECISIONS.md` §5 | Done |
| D-10 Limitations | `DECISIONS.md` | Done |
| D-11, D-12 User instructions | None | Planned |
| D-13 Troubleshooting | None | Planned |
| NFR-01 Save < 2 s | Local save takes milliseconds | Done |
| NFR-02, NFR-03 Usable offline / flaky network | Local-first, 10 s request timeouts | Done |
| NFR-04 Survives restart | IndexedDB | Done |
| NFR-05, NFR-06, NFR-12 Integrity, no loss, no duplicates | Sync design + tests | Done |
| NFR-07 Responsive | Mobile layout | Done |
| NFR-08, NFR-16 Plain feedback | Status words, not jargon | Done |
| NFR-09 Protected in storage / transit | See SR-03 | Partial |
| NFR-10 Maintainable | Ruff, typed code, docs | Done |
| NFR-11 Version control | Git, needs regular commits | Partial |
| NFR-13 Battery | No polling faster than 15 s | Done |
| NFR-14 1,000 records | IndexedDB indexes; load test planned | Partial |
| NFR-15 Consistent across devices | One codebase | Partial |
| NFR-17 New data types | "Other" sensor, flexible export columns | Done |
