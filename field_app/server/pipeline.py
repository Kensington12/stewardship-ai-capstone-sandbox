"""Hand synced field data to the interpretation pipeline (FR-51 to FR-54, US-09).

Synced records are flattened into a wide CSV, one row per field record and one
column per sensor, which is the shape `read_dataset` expects. The report from
`interpret` is stored exactly as `to_dict()` returns it.
"""

import csv
import io
import json
import uuid
from pathlib import Path

from sandbox_engine import interpret, read_dataset

from . import config
from .db import get_connection
from .sync import now_iso

METADATA_COLUMNS = [
    "record_id",
    "site_name",
    "captured_at",
    "latitude",
    "longitude",
    "weather",
    "air_temp_c",
    "humidity_pct",
    "wind_speed_kmh",
    "conditions_notes",
    "device_id",
    "record_version",
]


def export_rows(site_id: str | None = None) -> tuple[list[str], list[dict]]:
    """Synced, non-deleted records as wide rows. Optionally limited to one site."""
    sql = (
        "SELECT r.*, s.name AS site_name, s.latitude, s.longitude FROM field_records r "
        "JOIN sites s ON s.id = r.site_id WHERE r.deleted = 0"
    )
    params: tuple = ()
    if site_id:
        sql += " AND r.site_id = ?"
        params = (site_id,)
    sql += " ORDER BY r.captured_at"

    rows: list[dict] = []
    sensors: list[str] = []
    with get_connection() as conn:
        for rec in conn.execute(sql, params).fetchall():
            row = {
                "record_id": rec["id"],
                "site_name": rec["site_name"],
                "captured_at": rec["captured_at"],
                "latitude": rec["latitude"],
                "longitude": rec["longitude"],
                "weather": rec["weather"],
                "air_temp_c": rec["air_temp_c"],
                "humidity_pct": rec["humidity_pct"],
                "wind_speed_kmh": rec["wind_speed_kmh"],
                "conditions_notes": rec["conditions_notes"],
                "device_id": rec["device_id"],
                "record_version": rec["version"],
            }
            for reading in conn.execute(
                "SELECT sensor, value FROM readings WHERE record_id = ? ORDER BY position",
                (rec["id"],),
            ):
                if reading["sensor"] not in sensors:
                    sensors.append(reading["sensor"])
                row[reading["sensor"]] = reading["value"]
            rows.append(row)
    return METADATA_COLUMNS + sensors, rows


def export_csv(site_id: str | None = None) -> str:
    columns, rows = export_rows(site_id)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: ("" if v is None else v) for k, v in row.items()})
    return buffer.getvalue()


def save_report(report: dict, source_kind: str, source_ref: str) -> dict:
    record = {"id": str(uuid.uuid4()), "created_at": now_iso(), "report": report}
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO reports (id, source_kind, source_ref, dataset_filename, report_json, "
            "created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                record["id"],
                source_kind,
                source_ref,
                report["dataset_filename"],
                json.dumps(report),
                record["created_at"],
            ),
        )
    return record


def interpret_file(csv_path: Path, source_kind: str, source_ref: str) -> dict:
    """Run read_dataset -> interpret and store the report unchanged."""
    report = interpret(read_dataset(str(csv_path))).to_dict()
    return save_report(report, source_kind, source_ref)


def interpret_synced_records(site_id: str | None = None) -> dict:
    """Export synced records to CSV, then interpret it."""
    text = export_csv(site_id)
    if text.count("\n") < 2:
        raise ValueError("No synced field records to interpret yet.")
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = now_iso().replace(":", "").replace("-", "")
    path = config.EXPORTS_DIR / f"field_records_{site_id or 'all'}_{stamp}.csv"
    path.write_text(text, encoding="utf-8")
    return interpret_file(path, "field_records", site_id or "all")


def list_reports() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, source_kind, source_ref, dataset_filename, created_at "
            "FROM reports ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_report(report_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, created_at, report_json FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "report": json.loads(row["report_json"]),
    }
