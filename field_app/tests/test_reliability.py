"""What happens when things go wrong, and with a lot of data. IDs match docs/TRACEABILITY.md."""

import time

from field_app.server import sync

from .conftest import TEST_KEY, make_record


def test_sync_that_dies_halfway_saves_nothing_and_can_be_retried(isolated, monkeypatch):
    """If the server fails mid-batch, no half batch is saved, and resending works. (T-08, T-09, NFR-05)"""
    from fastapi.testclient import TestClient

    from field_app.server.app import app

    real_write = sync._write_record
    calls = {"n": 0}

    def fail_on_second(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("simulated crash in the middle of a sync")
        return real_write(*args, **kwargs)

    records = [make_record(), make_record(), make_record()]
    with TestClient(
        app, headers={"X-Sync-Key": TEST_KEY}, raise_server_exceptions=False
    ) as client:
        monkeypatch.setattr(sync, "_write_record", fail_on_second)
        assert client.post("/sync", json={"records": records}).status_code == 500
        assert client.get("/records").json() == []

        monkeypatch.setattr(sync, "_write_record", real_write)
        retry = client.post("/sync", json={"records": records}).json()
        assert retry["synced"] == 3
        assert len(client.get("/records").json()) == 3


def test_a_thousand_records_sync_and_export(client):
    """1,000 records sync in two batches without slowing to a crawl. (NFR-14, T-10)"""
    started = time.perf_counter()
    for _ in range(2):
        batch = [make_record() for _ in range(500)]
        assert client.post("/sync", json={"records": batch}).json()["synced"] == 500
    elapsed = time.perf_counter() - started

    assert len(client.get("/records").json()) == 1000
    assert client.get("/export/records.csv").text.count("\n") == 1001
    assert elapsed < 30, f"syncing 1,000 records took {elapsed:.1f}s"
