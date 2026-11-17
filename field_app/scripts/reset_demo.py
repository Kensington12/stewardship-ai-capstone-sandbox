"""Clears the central database so a demo or rehearsal starts clean.

Run from the repo root (it works while the server is running):
    Mac / Linux:  python field_app/scripts/reset_demo.py --seed
    Windows:      .venv\\Scripts\\python field_app\\scripts\\reset_demo.py --seed

--seed adds three example records that are already synced. The sync key is kept,
so devices stay connected. To clear a device too, use "Clear data on this device"
on the app's Sync page.
"""

import argparse
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from field_app.server import config
from field_app.server.db import get_connection, init_db
from field_app.server.sync import apply_record

TABLES = ["readings", "notes", "conflicts", "reports", "field_records", "sites"]


def example_records() -> list[dict]:
    lake = {
        "id": str(uuid.uuid4()),
        "name": "Kentucky Lake, Site 4",
        "latitude": 36.83,
        "longitude": -88.07,
    }
    river = {
        "id": str(uuid.uuid4()),
        "name": "Clarks River, Site 2",
        "latitude": 36.86,
        "longitude": -88.32,
    }
    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) - timedelta(
        days=2
    )
    rows = [
        (
            lake,
            0,
            "Overcast",
            16.5,
            72,
            9,
            [
                ("dissolved_oxygen_mgl", 7.8, "mg/L"),
                ("water_temp_c", 14.2, "°C"),
                ("pH", 7.6, ""),
            ],
            "Calm water, light algae near the east bank.",
        ),
        (
            lake,
            3,
            "Partly cloudy",
            18.0,
            65,
            12,
            [
                ("dissolved_oxygen_mgl", 3.6, "mg/L"),
                ("water_temp_c", 15.1, "°C"),
                ("pH", 7.4, ""),
            ],
            "Fish kill reported upstream. Oxygen looks low.",
        ),
        (
            river,
            24,
            "Light rain",
            12.5,
            90,
            6,
            [("turbidity_ntu", 18.4, "NTU"), ("water_temp_c", 11.8, "°C")],
            "Water is muddy after overnight rain.",
        ),
    ]
    records = []
    for site, hours, weather, air, humidity, wind, readings, note in rows:
        when = (start + timedelta(hours=hours)).isoformat()
        records.append(
            {
                "id": str(uuid.uuid4()),
                "site": site,
                "captured_at": when,
                "conditions": {
                    "weather": weather,
                    "air_temp_c": air,
                    "humidity_pct": humidity,
                    "wind_speed_kmh": wind,
                    "notes": None,
                },
                "readings": [
                    {"id": str(uuid.uuid4()), "sensor": s, "value": v, "unit": u}
                    for s, v, u in readings
                ],
                "notes": [{"id": str(uuid.uuid4()), "text": note, "created_at": when}],
                "device_id": "demo-seed",
                "created_at": when,
                "updated_at": when,
                "deleted": False,
                "base_version": 0,
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--seed", action="store_true", help="add three example synced records"
    )
    args = parser.parse_args()

    init_db()
    with get_connection() as conn:
        for table in TABLES:
            conn.execute(f"DELETE FROM {table}")  # names come from the fixed list above
    for old_export in (
        config.EXPORTS_DIR.glob("*.csv") if config.EXPORTS_DIR.exists() else []
    ):
        old_export.unlink()
    print("Central database cleared.")

    if args.seed:
        with get_connection() as conn:
            results = [apply_record(conn, record) for record in example_records()]
        print(f"Added {sum(r.status == 'synced' for r in results)} example records.")


if __name__ == "__main__":
    main()
