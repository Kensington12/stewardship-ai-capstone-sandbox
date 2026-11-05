"""The central SQLite database."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS sites (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    latitude    REAL,
    longitude   REAL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_records (
    id                TEXT PRIMARY KEY,
    site_id           TEXT NOT NULL REFERENCES sites(id),
    captured_at       TEXT NOT NULL,
    weather           TEXT,
    air_temp_c        REAL,
    humidity_pct      REAL,
    wind_speed_kmh    REAL,
    conditions_notes  TEXT,
    device_id         TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    deleted           INTEGER NOT NULL DEFAULT 0,
    version           INTEGER NOT NULL,
    content_hash      TEXT NOT NULL,
    synced_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (
    id          TEXT PRIMARY KEY,
    record_id   TEXT NOT NULL REFERENCES field_records(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    sensor      TEXT NOT NULL,
    value       REAL NOT NULL,
    unit        TEXT
);

CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    record_id   TEXT NOT NULL REFERENCES field_records(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflicts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id       TEXT NOT NULL,
    device_id       TEXT NOT NULL,
    incoming_json   TEXT NOT NULL,
    server_json     TEXT NOT NULL,
    detected_at     TEXT NOT NULL,
    resolved_at     TEXT,
    resolution      TEXT
);

CREATE TABLE IF NOT EXISTS reports (
    id                TEXT PRIMARY KEY,
    source_kind       TEXT NOT NULL,
    source_ref        TEXT NOT NULL,
    dataset_filename  TEXT NOT NULL,
    report_json       TEXT NOT NULL,
    created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_site ON field_records(site_id);
CREATE INDEX IF NOT EXISTS idx_readings_record ON readings(record_id);
CREATE INDEX IF NOT EXISTS idx_notes_record ON notes(record_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_record ON conflicts(record_id);
"""


def init_db(db_path: Path | None = None) -> None:
    """Creates the database and tables on first run. Safe to call every time."""
    db_path = db_path or config.DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(SCHEMA)


@contextmanager
def get_connection(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    """If anything inside the `with` block fails, none of its changes are saved."""
    conn = sqlite3.connect(db_path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
