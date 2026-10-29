"""Receive field records from devices: store, block duplicates, detect conflicts.

Conflict strategy (FR-47): a device sends `base_version`, the last server version
it saw. If the server copy has moved on since then and the content differs, the
update is NOT applied. The server keeps its copy, saves the device's copy in the
`conflicts` table, and tells the device. Nothing is overwritten silently, and the
researcher decides which version to keep.
"""

import hashlib
import json
import sqlite3
from datetime import UTC, datetime

from pydantic import ValidationError

from .models import FieldRecord, SyncResult


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def content_hash(record: FieldRecord) -> str:
    """Fingerprint of what the researcher captured (ignores sync bookkeeping)."""
    content = record.model_dump(
        mode="json",
        include={"site", "captured_at", "conditions", "readings", "notes", "deleted"},
    )
    return hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()


def load_record(conn: sqlite3.Connection, record_id: str) -> dict | None:
    """The server's copy of a record, in the same shape devices send."""
    row = conn.execute(
        "SELECT r.*, s.name AS site_name, s.latitude, s.longitude "
        "FROM field_records r JOIN sites s ON s.id = r.site_id WHERE r.id = ?",
        (record_id,),
    ).fetchone()
    if row is None:
        return None
    readings = conn.execute(
        "SELECT id, sensor, value, unit FROM readings WHERE record_id = ? ORDER BY position",
        (record_id,),
    ).fetchall()
    notes = conn.execute(
        "SELECT id, text, created_at FROM notes WHERE record_id = ? ORDER BY position",
        (record_id,),
    ).fetchall()
    return {
        "id": row["id"],
        "site": {
            "id": row["site_id"],
            "name": row["site_name"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
        },
        "captured_at": row["captured_at"],
        "conditions": {
            "weather": row["weather"],
            "air_temp_c": row["air_temp_c"],
            "humidity_pct": row["humidity_pct"],
            "wind_speed_kmh": row["wind_speed_kmh"],
            "notes": row["conditions_notes"],
        },
        "readings": [dict(r) for r in readings],
        "notes": [dict(n) for n in notes],
        "device_id": row["device_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "deleted": bool(row["deleted"]),
        "version": row["version"],
        "synced_at": row["synced_at"],
    }


def _write_record(
    conn: sqlite3.Connection, rec: FieldRecord, version: int, digest: str
) -> None:
    now = now_iso()
    site = rec.site
    conn.execute(
        "INSERT INTO sites (id, name, latitude, longitude, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
        "name = excluded.name, latitude = excluded.latitude, "
        "longitude = excluded.longitude, updated_at = excluded.updated_at",
        (str(site.id), site.name, site.latitude, site.longitude, now, now),
    )
    c = rec.conditions
    conn.execute(
        "INSERT INTO field_records (id, site_id, captured_at, weather, air_temp_c, humidity_pct, "
        "wind_speed_kmh, conditions_notes, device_id, created_at, updated_at, deleted, version, "
        "content_hash, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET site_id = excluded.site_id, "
        "captured_at = excluded.captured_at, weather = excluded.weather, "
        "air_temp_c = excluded.air_temp_c, humidity_pct = excluded.humidity_pct, "
        "wind_speed_kmh = excluded.wind_speed_kmh, conditions_notes = excluded.conditions_notes, "
        "device_id = excluded.device_id, updated_at = excluded.updated_at, "
        "deleted = excluded.deleted, version = excluded.version, "
        "content_hash = excluded.content_hash, synced_at = excluded.synced_at",
        (
            str(rec.id),
            str(site.id),
            rec.captured_at.isoformat(),
            c.weather,
            c.air_temp_c,
            c.humidity_pct,
            c.wind_speed_kmh,
            c.notes,
            rec.device_id,
            rec.created_at.isoformat(),
            rec.updated_at.isoformat(),
            int(rec.deleted),
            version,
            digest,
            now,
        ),
    )
    conn.execute("DELETE FROM readings WHERE record_id = ?", (str(rec.id),))
    conn.execute("DELETE FROM notes WHERE record_id = ?", (str(rec.id),))
    conn.executemany(
        "INSERT INTO readings (id, record_id, position, sensor, value, unit) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [
            (str(r.id), str(rec.id), i, r.sensor, r.value, r.unit)
            for i, r in enumerate(rec.readings)
        ],
    )
    conn.executemany(
        "INSERT INTO notes (id, record_id, position, text, created_at) VALUES (?, ?, ?, ?, ?)",
        [
            (str(n.id), str(rec.id), i, n.text, n.created_at.isoformat())
            for i, n in enumerate(rec.notes)
        ],
    )


def apply_record(conn: sqlite3.Connection, raw: dict) -> SyncResult:
    """Validate and apply one incoming record. Never raises for bad input."""
    record_id = str(raw.get("id", "unknown")) if isinstance(raw, dict) else "unknown"
    try:
        rec = FieldRecord.model_validate(raw)
    except ValidationError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first["loc"]) or "record"
        return SyncResult(
            id=record_id, status="error", error=f"{where}: {first['msg']}"
        )

    digest = content_hash(rec)
    existing = conn.execute(
        "SELECT version, content_hash FROM field_records WHERE id = ?", (str(rec.id),)
    ).fetchone()

    if existing is None:
        _write_record(conn, rec, 1, digest)
        return SyncResult(id=str(rec.id), status="synced", version=1)

    if existing["content_hash"] == digest:
        # Same content already stored (e.g. a retry after a dropped response): no duplicate.
        return SyncResult(id=str(rec.id), status="synced", version=existing["version"])

    if existing["version"] == rec.base_version:
        new_version = existing["version"] + 1
        _write_record(conn, rec, new_version, digest)
        conn.execute(
            "UPDATE conflicts SET resolved_at = ?, resolution = 'kept_device' "
            "WHERE record_id = ? AND resolved_at IS NULL",
            (now_iso(), str(rec.id)),
        )
        return SyncResult(id=str(rec.id), status="synced", version=new_version)

    server_copy = load_record(conn, str(rec.id))
    conn.execute(
        "INSERT INTO conflicts (record_id, device_id, incoming_json, server_json, detected_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (
            str(rec.id),
            rec.device_id,
            json.dumps(raw),
            json.dumps(server_copy),
            now_iso(),
        ),
    )
    return SyncResult(
        id=str(rec.id),
        status="conflict",
        version=existing["version"],
        server_record=server_copy,
    )
