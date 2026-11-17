"""The team's sync key. Every request except /health has to send it.

The key is made the first time the server starts and saved in storage/sync_key.txt,
which git ignores. Set FIELD_SYNC_KEY to use a specific key instead.
"""

import hmac
import os
import secrets

from fastapi import Header, HTTPException

from . import config

# No 0/O or 1/I/L, so the key is easy to read off a screen and type on a phone.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def normalize(key: str) -> str:
    return key.strip().upper().replace(" ", "")


def new_key() -> str:
    groups = ["".join(secrets.choice(_ALPHABET) for _ in range(4)) for _ in range(4)]
    return "-".join(groups)


def load_sync_key() -> str:
    from_env = os.environ.get("FIELD_SYNC_KEY")
    if from_env:
        return normalize(from_env)
    path = config.SYNC_KEY_FILE
    if path.exists():
        return normalize(path.read_text(encoding="utf-8"))
    key = new_key()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(key + "\n", encoding="utf-8")
    return key


def require_sync_key(x_sync_key: str | None = Header(default=None)) -> None:
    if not x_sync_key or not hmac.compare_digest(
        normalize(x_sync_key), load_sync_key()
    ):
        raise HTTPException(status_code=401, detail="Missing or wrong sync key.")
