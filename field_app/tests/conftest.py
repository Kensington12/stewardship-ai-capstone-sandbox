"""Shared test setup: every test gets its own throwaway database."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from field_app.server import config


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(config, "EXPORTS_DIR", tmp_path / "exports")
    from field_app.server.app import app

    with TestClient(app) as test_client:
        yield test_client


SITE_ID = str(uuid.uuid4())


def make_record(**overrides) -> dict:
    """A complete, valid field record, the way a device sends it."""
    now = datetime.now(UTC).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "site": {
            "id": SITE_ID,
            "name": "Kentucky Lake, Site 4",
            "latitude": 36.9,
            "longitude": -88.1,
        },
        "captured_at": "2026-10-30T14:05:00+00:00",
        "conditions": {
            "weather": "Overcast",
            "air_temp_c": 16.5,
            "humidity_pct": 72,
            "wind_speed_kmh": 9,
            "notes": "Light chop on the water",
        },
        "readings": [
            {
                "id": str(uuid.uuid4()),
                "sensor": "dissolved_oxygen_mgl",
                "value": 7.8,
                "unit": "mg/L",
            },
            {
                "id": str(uuid.uuid4()),
                "sensor": "water_temp_c",
                "value": 14.2,
                "unit": "°C",
            },
        ],
        "notes": [
            {
                "id": str(uuid.uuid4()),
                "text": "Algae bloom near the east bank.",
                "created_at": now,
            }
        ],
        "device_id": "test-device",
        "created_at": now,
        "updated_at": now,
        "deleted": False,
        "base_version": 0,
    }
    record.update(overrides)
    return record
