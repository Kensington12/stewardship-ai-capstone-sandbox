// The field record as the app stores it. Kept in step with server/models.py.

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

export interface RecordContent {
  site: Site;
  capturedAt: string;
  conditions: Conditions;
  readings: Reading[];
  notes: Note[];
  deleted: boolean;
}

export interface FieldRecord extends RecordContent {
  id: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  /** 0 until the first successful sync. */
  baseVersion: number;
  syncStatus: SyncStatus;
  lastError?: string;
  syncedAt?: string;
  /** Only set while a conflict is waiting for the researcher to decide. */
  serverCopy?: RecordContent;
  serverVersion?: number;
}
