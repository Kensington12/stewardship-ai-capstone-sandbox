"""Interpretation pipeline tests: synced data in, contract report out."""

import csv
import io

from .conftest import make_record

CONTRACT_KEYS = {
    "source",
    "dataset_filename",
    "summary_text",
    "observations",
    "sources_consulted",
    "integrity_notes",
}


def test_export_is_one_row_per_record_with_metadata(client):
    """[T-14, FR-51, FR-52] Wide CSV keeps site, time and conditions with the readings."""
    client.post("/sync", json={"records": [make_record(), make_record()]})
    rows = list(csv.DictReader(io.StringIO(client.get("/export/records.csv").text)))
    assert len(rows) == 2
    assert rows[0]["site_name"] == "Kentucky Lake, Site 4"
    assert rows[0]["weather"] == "Overcast"
    assert rows[0]["dissolved_oxygen_mgl"] == "7.8"


def test_synced_records_produce_a_contract_report(client):
    """[US-09, T-14] Report keys match CONTRACT.md exactly, integrity notes included."""
    client.post("/sync", json={"records": [make_record(), make_record()]})
    saved = client.post("/reports", json={}).json()
    assert set(saved["report"].keys()) == CONTRACT_KEYS
    assert saved["report"]["integrity_notes"]
    assert client.get(f"/reports/{saved['id']}").json()["report"] == saved["report"]


def test_interpreting_with_no_synced_data_is_a_clear_error(client):
    """[UI-10, A-04]"""
    response = client.post("/reports", json={})
    assert response.status_code == 409
    assert "No synced field records" in response.json()["detail"]


def test_sample_dataset_still_interprets(client):
    saved = client.post("/reports", json={"dataset": "sample_sensor_stream.csv"}).json()
    assert set(saved["report"].keys()) == CONTRACT_KEYS


def test_dataset_outside_data_folder_is_refused(client):
    """[SR-07 style path safety]"""
    assert client.post("/reports", json={"dataset": "../pytest.ini"}).status_code == 404
