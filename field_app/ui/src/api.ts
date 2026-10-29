import type { InterpretationReport } from "./contract";

/** A field record in the central system's shape (snake_case). */
export interface ServerRecord {
  id: string;
  site: { id: string; name: string; latitude: number | null; longitude: number | null };
  captured_at: string;
  conditions: {
    weather: string | null;
    air_temp_c: number | null;
    humidity_pct: number | null;
    wind_speed_kmh: number | null;
    notes: string | null;
  };
  readings: { id: string; sensor: string; value: number; unit: string | null }[];
  notes: { id: string; text: string; created_at: string }[];
  device_id: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  version?: number;
}

export interface SyncResult {
  id: string;
  status: "synced" | "conflict" | "error";
  version: number | null;
  server_record: ServerRecord | null;
  error: string | null;
}

export interface SyncResponse {
  results: SyncResult[];
  synced: number;
  conflicts: number;
  errors: number;
}

/** A saved report: our metadata wrapped around the unchanged contract report. */
export interface SavedReport {
  id: string;
  created_at: string;
  report: InterpretationReport;
}

export interface ReportListItem {
  id: string;
  source_kind: string;
  source_ref: string;
  dataset_filename: string;
  created_at: string;
}

export class NetworkError extends Error {}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...init,
    });
  } catch {
    throw new NetworkError("Can't reach the central system.");
  } finally {
    window.clearTimeout(timer);
  }
  if (response.status >= 500) {
    // Proxy and gateway failures mean the central system is down or out of reach.
    throw new NetworkError("Can't reach the central system.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health", undefined, 4000),
  sync: (records: ServerRecord[]) =>
    request<SyncResponse>("/sync", { method: "POST", body: JSON.stringify({ records }) }, 30000),
  resolveConflict: (id: string, resolution: "kept_server" | "kept_device") =>
    request<{ resolved: number }>(`/records/${id}/conflicts/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),
  datasets: () => request<string[]>("/datasets"),
  createReport: (body: { dataset?: string; site_id?: string }) =>
    request<SavedReport>("/reports", { method: "POST", body: JSON.stringify(body) }, 30000),
  reports: () => request<ReportListItem[]>("/reports"),
  report: (id: string) => request<SavedReport>(`/reports/${id}`),
};
