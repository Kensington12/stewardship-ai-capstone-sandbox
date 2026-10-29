"""Validated shapes for field records sent by devices (BE-03, SR-09, EH-02)."""

import math
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Site(Strict):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class Conditions(Strict):
    weather: str | None = Field(default=None, max_length=40)
    air_temp_c: float | None = Field(default=None, ge=-60, le=60)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    wind_speed_kmh: float | None = Field(default=None, ge=0, le=400)
    notes: str | None = Field(default=None, max_length=500)


class Reading(Strict):
    id: UUID
    sensor: str = Field(min_length=1, max_length=60)
    value: float
    unit: str | None = Field(default=None, max_length=20)

    @field_validator("value")
    @classmethod
    def must_be_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("must be a real number")
        return value


class Note(Strict):
    id: UUID
    text: str = Field(min_length=1, max_length=5000)
    created_at: datetime


class FieldRecord(Strict):
    """One field record: site + time + conditions + readings + notes."""

    id: UUID
    site: Site
    captured_at: datetime
    conditions: Conditions = Field(default_factory=Conditions)
    readings: list[Reading] = Field(default_factory=list, max_length=200)
    notes: list[Note] = Field(default_factory=list, max_length=100)
    device_id: str = Field(min_length=1, max_length=64)
    created_at: datetime
    updated_at: datetime
    deleted: bool = False
    base_version: int = Field(ge=0)

    @model_validator(mode="after")
    def needs_content(self) -> "FieldRecord":
        if not self.deleted and not self.readings and not self.notes:
            raise ValueError("a field record needs at least one reading or note")
        return self


class SyncRequest(Strict):
    records: list[dict] = Field(max_length=500)


class SyncResult(BaseModel):
    id: str
    status: Literal["synced", "conflict", "error"]
    version: int | None = None
    server_record: dict | None = None
    error: str | None = None


class SyncResponse(BaseModel):
    results: list[SyncResult]
    synced: int
    conflicts: int
    errors: int


class ConflictResolution(Strict):
    resolution: Literal["kept_server", "kept_device"]
