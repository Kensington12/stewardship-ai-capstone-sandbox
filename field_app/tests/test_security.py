"""Access control and log checks. IDs at the end match docs/TRACEABILITY.md."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

from field_app.server import auth, config

from .conftest import make_record

PROTECTED = [
    ("post", "/sync"),
    ("get", "/records"),
    ("get", "/conflicts"),
    ("get", "/export/records.csv"),
    ("get", "/datasets"),
    ("post", "/reports"),
    ("get", "/reports"),
    ("get", "/auth/check"),
]


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_requests_without_the_key_are_refused(anonymous, method, path):
    """Nobody without the team's key can read or write field data. (SR-04, SR-05, BE-09, T-18)"""
    response = anonymous.request(method, path, json={"records": []})
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing or wrong sync key."


def test_wrong_key_is_refused(anonymous):
    """(SR-05, T-18)"""
    response = anonymous.post(
        "/sync", json={"records": [make_record()]}, headers={"X-Sync-Key": "WRONG"}
    )
    assert response.status_code == 401
    assert (
        anonymous.get("/records", headers={"X-Sync-Key": "TEST-KEY0-ABCD-EFGH"}).json()
        == []
    )


def test_key_is_forgiving_about_case_and_spaces(anonymous):
    response = anonymous.get(
        "/auth/check", headers={"X-Sync-Key": " test-key0-abcd-efgh "}
    )
    assert response.status_code == 200


def test_health_check_needs_no_key(anonymous):
    assert anonymous.get("/health").json() == {"status": "ok"}


def test_first_start_creates_and_keeps_a_key(tmp_path, monkeypatch):
    """With no key set, the server makes one, saves it, and reuses it."""
    monkeypatch.delenv("FIELD_SYNC_KEY", raising=False)
    monkeypatch.setattr(config, "SYNC_KEY_FILE", tmp_path / "sync_key.txt")
    first = auth.load_sync_key()
    assert len(first) == 19 and first.count("-") == 3
    assert auth.load_sync_key() == first
    assert (tmp_path / "sync_key.txt").read_text().strip() == first


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_server_logs_do_not_contain_field_data(tmp_path):
    """Runs the real server and checks its output for anything the researcher typed. (T-17, SR-08, BE-08)"""
    port = _free_port()
    repo_root = Path(__file__).resolve().parents[2]
    env = {
        **os.environ,
        "FIELD_DB_PATH": str(tmp_path / "central.db"),
        "FIELD_SYNC_KEY": "LOGS-TEST-KEY0-0000",
        "FIELD_SYNC_KEY_FILE": str(tmp_path / "sync_key.txt"),
    }
    log_path = tmp_path / "server.log"
    with log_path.open("w") as log:
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "field_app.server.app:app",
                "--port",
                str(port),
            ],
            cwd=repo_root,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        try:
            base = f"http://127.0.0.1:{port}"
            for _ in range(50):
                try:
                    httpx.get(f"{base}/health", timeout=0.5)
                    break
                except httpx.HTTPError:
                    time.sleep(0.2)
            record = make_record(
                site={**make_record()["site"], "name": "Hidden Hollow Spring"},
                notes=[
                    {
                        "id": make_record()["notes"][0]["id"],
                        "text": "PRIVATE-OBSERVATION-7731",
                        "created_at": "2026-11-15T10:00:00+00:00",
                    }
                ],
            )
            response = httpx.post(
                f"{base}/sync",
                json={"records": [record]},
                headers={"X-Sync-Key": "LOGS-TEST-KEY0-0000"},
            )
            assert response.json()["synced"] == 1
        finally:
            server.terminate()
            server.wait(timeout=10)

    logs = log_path.read_text()
    assert "POST /sync" in logs, "the server should still log that a sync happened"
    for secret in (
        "PRIVATE-OBSERVATION-7731",
        "Hidden Hollow Spring",
        "dissolved_oxygen",
        record["id"],
    ):
        assert secret not in logs
