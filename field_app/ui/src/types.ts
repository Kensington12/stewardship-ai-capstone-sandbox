// Field data model (FR-22 to FR-29). Mirrors field_app/server/models.py.

export type SyncStatus = "pending" | "synced" | "error" | "conflict";

export interface Site {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Conditions {
  weather: string;
  airTempC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  notes: string;
}

export interface Reading {
  id: string;
  sensor: string;
  value: number;
  unit: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

/** The parts of a record a researcher actually captures. */
export interface RecordContent {
  site: Site;
  capturedAt: string;
  conditions: Conditions;
  readings: Reading[];
  notes: Note[];
  deleted: boolean;
}

/** One field record as stored on the device. */
export interface FieldRecord extends RecordContent {
  id: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  /** Last version confirmed by the central system (0 = never synced). */
  baseVersion: number;
  syncStatus: SyncStatus;
  lastError?: string;
  syncedAt?: string;
  /** When in conflict: the central system's copy and its version. */
  serverCopy?: RecordContent;
  serverVersion?: number;
}
