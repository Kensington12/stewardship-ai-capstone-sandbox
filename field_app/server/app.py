"""The central system. Devices sync their field records here, and synced records
are what the interpretation pipeline reads.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from . import pipeline
from .config import DATA_DIR
from .db import get_connection, init_db
from .models import ConflictResolution, SyncRequest, SyncResponse
from .sync import apply_record, load_record, now_iso


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Field-Capture Central System", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


# Sync


@app.post("/sync", response_model=SyncResponse)
def sync(request: SyncRequest):
    """Each record in the batch succeeds or fails on its own, so one bad record can't block the rest."""
    results = []
    with get_connection() as conn:
        for raw in request.records:
            results.append(apply_record(conn, raw))
    return SyncResponse(
        results=results,
        synced=sum(r.status == "synced" for r in results),
        conflicts=sum(r.status == "conflict" for r in results),
        errors=sum(r.status == "error" for r in results),
    )


@app.get("/records")
def list_records():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT r.id, s.name AS site_name, r.captured_at, r.version, r.deleted, r.synced_at, "
            "(SELECT COUNT(*) FROM readings WHERE record_id = r.id) AS reading_count, "
            "(SELECT COUNT(*) FROM notes WHERE record_id = r.id) AS note_count "
            "FROM field_records r JOIN sites s ON s.id = r.site_id ORDER BY r.captured_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/records/{record_id}")
def get_record(record_id: str):
    with get_connection() as conn:
        record = load_record(conn, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    return record


@app.post("/records/{record_id}/conflicts/resolve")
def resolve_conflict(record_id: str, body: ConflictResolution):
    """Logs which version the researcher kept."""
    with get_connection() as conn:
        updated = conn.execute(
            "UPDATE conflicts SET resolved_at = ?, resolution = ? "
            "WHERE record_id = ? AND resolved_at IS NULL",
            (now_iso(), body.resolution, record_id),
        ).rowcount
    return {"resolved": updated}


@app.get("/conflicts")
def list_conflicts():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, record_id, device_id, detected_at, resolved_at, resolution "
            "FROM conflicts ORDER BY detected_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# Interpretation pipeline


class InterpretRequest(BaseModel):
    dataset: str | None = None
    site_id: str | None = None


def resolve_dataset(name: str) -> Path:
    path = (DATA_DIR / name).resolve()
    if path.parent != DATA_DIR.resolve() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"Dataset not found: {name}")
    return path


@app.get("/export/records.csv", response_class=PlainTextResponse)
def export_records(site_id: str | None = None):
    return PlainTextResponse(
        pipeline.export_csv(site_id),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="field_records.csv"'},
    )


@app.get("/datasets")
def list_datasets():
    return sorted(p.name for p in DATA_DIR.glob("*.csv"))


@app.post("/reports", status_code=201)
def create_report(request: InterpretRequest):
    """Interprets the synced field records, or one of the sample datasets if one is named."""
    if request.dataset:
        return pipeline.interpret_file(
            resolve_dataset(request.dataset), "dataset", request.dataset
        )
    try:
        return pipeline.interpret_synced_records(request.site_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/reports")
def get_reports():
    return pipeline.list_reports()


@app.get("/reports/{report_id}")
def get_one_report(report_id: str):
    record = pipeline.get_report(report_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return record
