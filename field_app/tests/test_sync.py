"""Sync tests. The IDs at the end of each description match docs/TRACEABILITY.md."""

import uuid

from .conftest import make_record


def sync(client, *records):
    response = client.post("/sync", json={"records": list(records)})
    assert response.status_code == 200
    return response.json()


def test_new_record_is_stored_with_all_metadata(client):
    """Everything the researcher entered arrives intact. (T-03, T-13)"""
    record = make_record()
    result = sync(client, record)
    assert result["synced"] == 1

    stored = client.get(f"/records/{record['id']}").json()
    assert stored["site"]["name"] == record["site"]["name"]
    assert stored["captured_at"].startswith("2026-10-30T14:05:00")
    assert stored["conditions"]["weather"] == "Overcast"
    assert [r["sensor"] for r in stored["readings"]] == [
        "dissolved_oxygen_mgl",
        "water_temp_c",
    ]
    assert stored["notes"][0]["text"] == "Algae bloom near the east bank."
    assert stored["version"] == 1


def test_resending_the_same_record_does_not_duplicate(client):
    """Sending the same record twice doesn't create a second copy. (T-07, FR-34)"""
    record = make_record()
    sync(client, record)
    second = sync(client, record)
    assert second["results"][0] == {
        **second["results"][0],
        "status": "synced",
        "version": 1,
    }
    assert len(client.get("/records").json()) == 1


def test_multiple_pending_records_sync_together(client):
    """(T-10)"""
    result = sync(client, make_record(), make_record(), make_record())
    assert result["synced"] == 3
    assert len(client.get("/records").json()) == 3


def test_edit_based_on_latest_version_is_applied(client):
    """An edit based on the latest version is saved. (FR-09)"""
    record = make_record()
    sync(client, record)
    edited = {
        **record,
        "base_version": 1,
        "conditions": {**record["conditions"], "weather": "Rain"},
    }
    result = sync(client, edited)
    assert result["results"][0]["status"] == "synced"
    assert result["results"][0]["version"] == 2
    assert (
        client.get(f"/records/{record['id']}").json()["conditions"]["weather"] == "Rain"
    )


def test_conflicting_edit_is_flagged_and_nothing_is_overwritten(client):
    """Two edits to the same version: the second is flagged and nothing is lost. (T-11, T-12, FR-43 to FR-46)"""
    record = make_record()
    sync(client, record)
    first_edit = {
        **record,
        "base_version": 1,
        "conditions": {**record["conditions"], "weather": "Rain"},
    }
    second_edit = {
        **record,
        "base_version": 1,
        "conditions": {**record["conditions"], "weather": "Sunny"},
    }
    sync(client, first_edit)

    result = sync(client, second_edit)["results"][0]
    assert result["status"] == "conflict"
    assert result["server_record"]["conditions"]["weather"] == "Rain"
    assert (
        client.get(f"/records/{record['id']}").json()["conditions"]["weather"] == "Rain"
    )

    history = client.get("/conflicts").json()
    assert len(history) == 1 and history[0]["resolved_at"] is None


def test_keeping_the_device_version_resolves_the_conflict(client):
    """Choosing "keep my version" saves it and logs the choice. (FR-47 to FR-50)"""
    record = make_record()
    sync(client, record)
    sync(
        client,
        {
            **record,
            "base_version": 1,
            "conditions": {**record["conditions"], "weather": "Rain"},
        },
    )
    mine = {
        **record,
        "base_version": 1,
        "conditions": {**record["conditions"], "weather": "Sunny"},
    }
    sync(client, mine)

    result = sync(client, {**mine, "base_version": 2})["results"][0]
    assert result["status"] == "synced"
    assert (
        client.get(f"/records/{record['id']}").json()["conditions"]["weather"]
        == "Sunny"
    )
    assert client.get("/conflicts").json()[0]["resolution"] == "kept_device"


def test_invalid_record_is_rejected_without_blocking_others(client):
    """Bad records are rejected without holding up the good ones. (T-15, EH-02, EH-12, SR-09)"""
    bad = make_record(readings=[], notes=[])
    weird = make_record(conditions={"humidity_pct": 250})
    good = make_record()
    result = sync(client, bad, weird, good)
    statuses = {r["id"]: r for r in result["results"]}
    assert statuses[bad["id"]]["status"] == "error"
    assert statuses[weird["id"]]["status"] == "error"
    assert "humidity_pct" in statuses[weird["id"]]["error"]
    assert statuses[good["id"]]["status"] == "synced"


def test_garbage_input_does_not_crash_the_server(client):
    """(EH-10, T-16)"""
    result = sync(client, {"id": "not-a-uuid"}, {"nonsense": True})
    assert result["errors"] == 2


def test_deleting_a_record_syncs_as_a_tombstone(client):
    """Deletes sync too, and deleted records drop out of the export. (FR-11)"""
    record = make_record()
    sync(client, record)
    sync(client, {**record, "base_version": 1, "deleted": True})
    assert client.get(f"/records/{record['id']}").json()["deleted"] is True
    assert str(record["id"]) not in client.get("/export/records.csv").text


def test_unknown_record_returns_404(client):
    assert client.get(f"/records/{uuid.uuid4()}").status_code == 404
