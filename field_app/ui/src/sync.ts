// Sync engine (FR-30 to FR-41). Sends waiting records to the central system and
// records what happened to each one. Local data is never removed until the
// central system has confirmed it (FR-35, EH-04).

import { api, NetworkError, type ServerRecord } from "./api";
import { db, notifyChanged, setMeta } from "./db";
import type { FieldRecord, RecordContent } from "./types";

export interface LastSync {
  at: string;
  ok: boolean;
  synced: number;
  conflicts: number;
  errors: number;
  message?: string;
}

export type SyncOutcome =
  | { kind: "nothing" }
  | { kind: "busy" }
  | { kind: "unreachable"; message: string }
  | { kind: "done"; synced: number; conflicts: number; errors: number };

export function toPayload(r: FieldRecord): ServerRecord & { base_version: number } {
  return {
    id: r.id,
    site: { id: r.site.id, name: r.site.name, latitude: r.site.latitude, longitude: r.site.longitude },
    captured_at: r.capturedAt,
    conditions: {
      weather: r.conditions.weather || null,
      air_temp_c: r.conditions.airTempC,
      humidity_pct: r.conditions.humidityPct,
      wind_speed_kmh: r.conditions.windSpeedKmh,
      notes: r.conditions.notes || null,
    },
    readings: r.readings.map((x) => ({ id: x.id, sensor: x.sensor, value: x.value, unit: x.unit || null })),
    notes: r.notes.map((n) => ({ id: n.id, text: n.text, created_at: n.createdAt })),
    device_id: r.deviceId,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    deleted: r.deleted,
    base_version: r.baseVersion,
  };
}

export function fromServer(s: ServerRecord): RecordContent {
  return {
    site: { ...s.site },
    capturedAt: s.captured_at,
    conditions: {
      weather: s.conditions.weather ?? "",
      airTempC: s.conditions.air_temp_c,
      humidityPct: s.conditions.humidity_pct,
      windSpeedKmh: s.conditions.wind_speed_kmh,
      notes: s.conditions.notes ?? "",
    },
    readings: s.readings.map((x) => ({ id: x.id, sensor: x.sensor, value: x.value, unit: x.unit ?? "" })),
    notes: s.notes.map((n) => ({ id: n.id, text: n.text, createdAt: n.created_at })),
    deleted: s.deleted,
  };
}

let running = false;

export async function syncNow(): Promise<SyncOutcome> {
  if (running) return { kind: "busy" };
  running = true;
  try {
    const queue = await db.records.where("syncStatus").anyOf("pending", "error").toArray();
    if (queue.length === 0) return { kind: "nothing" };

    let response;
    try {
      response = await api.sync(queue.map(toPayload));
    } catch (error) {
      const message =
        error instanceof NetworkError
          ? "Can't reach the central system. Your records are safe on this device."
          : (error as Error).message;
      await saveLastSync({ ok: false, synced: 0, conflicts: 0, errors: 0, message });
      return { kind: "unreachable", message };
    }

    const sentById = new Map(queue.map((r) => [r.id, r]));
    const now = new Date().toISOString();
    await db.transaction("rw", db.records, async () => {
      for (const result of response.results) {
        const sent = sentById.get(result.id);
        const current = sent && (await db.records.get(result.id));
        if (!sent || !current) continue;
        const editedDuringSync = current.updatedAt !== sent.updatedAt;

        if (result.status === "synced") {
          if (current.deleted && !editedDuringSync) {
            await db.records.delete(current.id);
            continue;
          }
          await db.records.update(current.id, {
            baseVersion: result.version ?? current.baseVersion,
            syncStatus: editedDuringSync ? "pending" : "synced",
            syncedAt: now,
            lastError: undefined,
            serverCopy: undefined,
            serverVersion: undefined,
          });
        } else if (result.status === "conflict" && result.server_record) {
          await db.records.update(current.id, {
            syncStatus: "conflict",
            serverCopy: fromServer(result.server_record),
            serverVersion: result.version ?? undefined,
            lastError: undefined,
          });
        } else {
          await db.records.update(current.id, {
            syncStatus: "error",
            lastError: result.error ?? "The central system rejected this record.",
          });
        }
      }
    });

    await saveLastSync({
      ok: true,
      synced: response.synced,
      conflicts: response.conflicts,
      errors: response.errors,
    });
    return { kind: "done", synced: response.synced, conflicts: response.conflicts, errors: response.errors };
  } finally {
    running = false;
  }
}

async function saveLastSync(result: Omit<LastSync, "at">): Promise<void> {
  await setMeta("lastSync", JSON.stringify({ at: new Date().toISOString(), ...result }));
}

/** Conflict choice: take the central system's version (FR-49). */
export async function keepServerVersion(record: FieldRecord): Promise<void> {
  if (!record.serverCopy) return;
  if (record.serverCopy.deleted) {
    await db.records.delete(record.id);
  } else {
    await db.records.put({
      ...record,
      ...record.serverCopy,
      baseVersion: record.serverVersion ?? record.baseVersion,
      syncStatus: "synced",
      syncedAt: new Date().toISOString(),
      serverCopy: undefined,
      serverVersion: undefined,
    });
  }
  api.resolveConflict(record.id, "kept_server").catch(() => undefined);
}

/** Conflict choice: keep this device's version and send it again (FR-49). */
export async function keepDeviceVersion(record: FieldRecord): Promise<void> {
  await db.records.update(record.id, {
    baseVersion: record.serverVersion ?? record.baseVersion,
    syncStatus: "pending",
    serverCopy: undefined,
    serverVersion: undefined,
  });
  notifyChanged();
}
