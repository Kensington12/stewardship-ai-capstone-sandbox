"""Central settings for the central server. Change values here, nowhere else."""

import os
from pathlib import Path

FIELD_APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = FIELD_APP_DIR.parent

DATA_DIR = REPO_ROOT / "data"
STORAGE_DIR = FIELD_APP_DIR / "storage"
EXPORTS_DIR = STORAGE_DIR / "exports"
DB_PATH = Path(os.environ.get("FIELD_DB_PATH", STORAGE_DIR / "central.db"))

SERVER_PORT = 8000
MAX_RECORDS_PER_SYNC = 500
