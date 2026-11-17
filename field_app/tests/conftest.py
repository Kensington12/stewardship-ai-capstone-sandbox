"""Each test gets its own empty database."""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from field_app.server import config

TEST_KEY = "TEST-KEY0-ABCD-EFGH"


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    """A fresh database, export folder and sync key for one test."""
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(config, "EXPORTS_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "SYNC_KEY_FILE", tmp_path / "sync_key.txt")
    monkeypatch.setenv("FIELD_SYNC_KEY", TEST_KEY)
    return tmp_path


@pytest.fixture
def client(isolated):
    """A client that sends the right sync key, like a set-up device."""
    from field_app.server.app import app

    with TestClient(app, headers={"X-Sync-Key": TEST_KEY}) as test_client:
        yield test_client


@pytest.fixture
def anonymous(isolated):
    """A client with no sync key, like someone who isn't on the team."""
    from field_app.server.app import app

    with TestClient(app) as test_client:
        yield test_client


SITE_ID = str(uuid.uuid4())


def make_record(**overrides) -> dict:
    """A valid record, the way a device would send it."""
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
