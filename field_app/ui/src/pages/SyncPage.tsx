import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, CircleAlert, Clock, GitCompare, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { btnPrimary, btnSecondary, card } from "../components/ui";
import { useToast } from "../components/Toast";
import { db } from "../db";
import { formatDateTime, formatTime, plural } from "../format";
import { sensorLabel } from "../sensors";
import { keepDeviceVersion, keepServerVersion, syncNow, type LastSync } from "../sync";
import type { FieldRecord, RecordContent } from "../types";

function describe(c: RecordContent): [string, string][] {
  if (c.deleted) return [["Status", "Deleted"]];
  const n = (v: number | null, unit: string) => (v === null ? "—" : `${v} ${unit}`);
  return [
    ["Site", c.site.name],
    ["Time", formatDateTime(c.capturedAt)],
    ["Weather", c.conditions.weather || "—"],
    ["Air temp", n(c.conditions.airTempC, "°C")],
    ["Humidity", n(c.conditions.humidityPct, "%")],
    ["Wind", n(c.conditions.windSpeedKmh, "km/h")],
    ["Other conditions", c.conditions.notes || "—"],
    ...c.readings.map((r): [string, string] => [sensorLabel(r.sensor), `${r.value} ${r.unit}`.trim()]),
    ...c.notes.map((note, i): [string, string] => [`Note ${i + 1}`, note.text]),
  ];
}

function ConflictCard({ record }: { record: FieldRecord }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!record.serverCopy) return null;
  const mine = describe(record);
  const theirs = describe(record.serverCopy);
  const theirsMap = new Map(theirs);
  const mineMap = new Map(mine);
  const labels = [...new Set([...mine.map(([k]) => k), ...theirs.map(([k]) => k)])];

  async function choose(which: "device" | "server") {
    setBusy(true);
    if (which === "device") {
      await keepDeviceVersion(record);
      toast("Keeping your version. It will sync now.");
    } else {
      await keepServerVersion(record);
      toast("Using the central system's version.");
    }
    setBusy(false);
  }

  return (
    <li className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] font-semibold">{record.site.name}</h3>
        <p className="text-sm text-slate-600">
          Changed on this device and on the central system. Nothing has been overwritten. Choose which version to keep.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs tracking-wide text-slate-600 uppercase">
              <th scope="col" className="px-3 py-2 font-semibold">
                Field
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                On this device
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                On central system
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((k) => {
              const a = mineMap.get(k) ?? "—";
              const b = theirsMap.get(k) ?? "—";
              const differs = a !== b;
              return (
                <tr key={k} className={`border-t border-slate-100 ${differs ? "bg-integrity-soft" : ""}`}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700">
                    {k}
                    {differs && <span className="ml-1 text-xs font-semibold text-integrity">(differs)</span>}
                  </th>
                  <td className="px-3 py-2 break-words">{a}</td>
                  <td className="px-3 py-2 break-words">{b}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => choose("device")} className={btnPrimary}>
          Keep my version
        </button>
        <button type="button" disabled={busy} onClick={() => choose("server")} className={btnSecondary}>
          Keep central version
        </button>
      </div>
    </li>
  );
}

/** Sync status, manual sync, failures and conflicts (FR-37 to FR-41, FR-46 to FR-49, UI-13, UI-14). */
export function SyncPage() {
  const toast = useToast();
  const records = useLiveQuery(() => db.records.toArray(), [], []);
  const lastSync = useLiveQuery(
    async () => {
      const raw = (await db.meta.get("lastSync"))?.value;
      return raw ? (JSON.parse(raw) as LastSync) : null;
    },
    [],
    null,
  );
  const [syncing, setSyncing] = useState(false);

  const pending = records.filter((r) => r.syncStatus === "pending");
  const failed = records.filter((r) => r.syncStatus === "error");
  const conflicts = records.filter((r) => r.syncStatus === "conflict");
  const synced = records.filter((r) => r.syncStatus === "synced");

  async function runSync() {
    setSyncing(true);
    const outcome = await syncNow();
    setSyncing(false);
    if (outcome.kind === "nothing") toast("Everything is already synced.");
    if (outcome.kind === "unreachable") toast(outcome.message, "error");
    if (outcome.kind === "done" && outcome.synced && !outcome.conflicts && !outcome.errors)
      toast(`${plural(outcome.synced, "record")} synced to the central system.`);
  }

  const tiles = [
    { label: "Waiting to sync", count: pending.length, Icon: Clock, tone: "text-watch" },
    { label: "Synced", count: synced.length, Icon: CheckCircle2, tone: "text-teal-800" },
    { label: "Sync failed", count: failed.length, Icon: CircleAlert, tone: "text-concern" },
    { label: "Needs review", count: conflicts.length, Icon: GitCompare, tone: "text-integrity" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-tight md:text-[28px]">Sync</h1>
          <p className="text-[15px] text-slate-600">
            Records sync on their own when you're online. You can also sync right now.
          </p>
        </div>
        <button type="button" onClick={runSync} disabled={syncing} className={btnPrimary}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(({ label, count, Icon, tone }) => (
          <div key={label} className={`${card} flex flex-col gap-2 p-4`}>
            <span className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </span>
            <span className="text-3xl font-bold">{count}</span>
          </div>
        ))}
      </div>

      <p aria-live="polite" className="text-sm text-slate-600">
        {lastSync === null
          ? "No sync attempted yet on this device."
          : lastSync.ok
            ? `Last sync at ${formatTime(lastSync.at)}: ${plural(lastSync.synced, "record")} synced, ${lastSync.conflicts} need review, ${lastSync.errors} failed.`
            : `Last attempt at ${formatTime(lastSync.at)} didn't reach the central system. ${lastSync.message ?? ""}`}
      </p>

      {conflicts.length > 0 && (
        <section aria-labelledby="conflicts-heading" className="flex flex-col gap-3">
          <h2 id="conflicts-heading" className="text-lg font-bold">
            Needs review
          </h2>
          <ul className="flex flex-col gap-4">
            {conflicts.map((r) => (
              <ConflictCard key={r.id} record={r} />
            ))}
          </ul>
        </section>
      )}

      {failed.length > 0 && (
        <section aria-labelledby="failed-heading" className="flex flex-col gap-3">
          <h2 id="failed-heading" className="text-lg font-bold">
            Sync failed
          </h2>
          <ul className="flex flex-col gap-3">
            {failed.map((r) => (
              <li key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{r.site.name}</span>
                  <span className="text-sm text-concern">{r.lastError}</span>
                  <span className="text-xs text-slate-600">Still saved on this device. Fix it and it will sync.</span>
                </div>
                <Link to={`/records/${r.id}/edit`} className={btnSecondary}>
                  Fix record
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <h2 id="pending-heading" className="text-lg font-bold">
            Waiting to sync
          </h2>
          <ul className={`${card} divide-y divide-slate-100`}>
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold">{r.deleted ? `${r.site.name} (delete)` : r.site.name}</span>
                <span className="text-slate-600">{formatDateTime(r.capturedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
