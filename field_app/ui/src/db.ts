// Records live in the browser's own database (IndexedDB), so they survive closing
// the app, restarting the device, and having no signal.

import Dexie, { type Table } from "dexie";

import type { FieldRecord, Site } from "./types";

interface Meta {
  key: string;
  value: string;
}

class FieldDatabase extends Dexie {
  records!: Table<FieldRecord, string>;
  sites!: Table<Site, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("field-capture");
    this.version(1).stores({
      records: "id, syncStatus, capturedAt, updatedAt",
      sites: "id, name",
      meta: "key",
    });
  }
}

export const db = new FieldDatabase();

/** Some browsers only offer randomUUID on HTTPS, so there's a fallback. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getDeviceId(): Promise<string> {
  const existing = await getMeta("deviceId");
  if (existing) return existing;
  const id = `device-${newId().slice(0, 8)}`;
  await setMeta("deviceId", id);
  return id;
}

export function notifyChanged(): void {
  window.dispatchEvent(new Event("field-records-changed"));
}

export async function saveRecord(record: FieldRecord): Promise<void> {
  const updated: FieldRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
    lastError: undefined,
  };
  await db.transaction("rw", db.records, db.sites, async () => {
    await db.sites.put(updated.site);
    await db.records.put(updated);
  });
  notifyChanged();
}

/** Records that never synced are just removed. Synced ones send the delete on the next sync. */
export async function deleteRecord(record: FieldRecord): Promise<void> {
  if (record.baseVersion === 0) {
    await db.records.delete(record.id);
    return;
  }
  await db.records.update(record.id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  });
  notifyChanged();
}
