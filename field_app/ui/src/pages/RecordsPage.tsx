import { useLiveQuery } from "dexie-react-hooks";
import { PenLine, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "../components/StatusBadge";
import { btnDanger, btnPrimary, btnSecondary, card, input } from "../components/ui";
import { useToast } from "../components/Toast";
import { db, deleteRecord } from "../db";
import { formatDateTime, plural } from "../format";
import { sensorLabel } from "../sensors";
import type { FieldRecord, SyncStatus } from "../types";

const FILTERS: { key: "all" | SyncStatus | "attention"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Waiting to sync" },
  { key: "synced", label: "Synced" },
  { key: "attention", label: "Needs attention" },
];

function matches(record: FieldRecord, query: string): boolean {
  if (!query) return true;
  const haystack = [
    record.site.name,
    record.conditions.weather,
    record.conditions.notes,
    ...record.readings.map((r) => `${r.sensor} ${sensorLabel(r.sensor)}`),
    ...record.notes.map((n) => n.text),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** Review, search, edit and delete records stored on this device (FR-08, FR-09, FR-11, FR-12, UI-11). */
export function RecordsPage() {
  const toast = useToast();
  const records = useLiveQuery(() => db.records.orderBy("capturedAt").reverse().toArray(), [], null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [confirming, setConfirming] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      (records ?? [])
        .filter((r) => !r.deleted)
        .filter((r) =>
          filter === "all"
            ? true
            : filter === "attention"
              ? r.syncStatus === "error" || r.syncStatus === "conflict"
              : r.syncStatus === filter,
        )
        .filter((r) => matches(r, query.trim())),
    [records, filter, query],
  );

  const total = (records ?? []).filter((r) => !r.deleted).length;

  async function remove(record: FieldRecord) {
    await deleteRecord(record);
    setConfirming(null);
    toast(record.baseVersion === 0 ? "Record deleted." : "Record deleted. The delete will sync when you're online.");
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-tight md:text-[28px]">Records</h1>
          <p className="text-[15px] text-slate-600">
            {plural(total, "record")} on this device. Review them here before they sync.
          </p>
        </div>
        <Link to="/capture" className={btnPrimary}>
          <PenLine className="size-4" aria-hidden="true" />
          New record
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <label htmlFor="search" className="sr-only">
            Search records
          </label>
          <Search className="absolute top-3.5 left-3 size-4 text-slate-500" aria-hidden="true" />
          <input
            id="search"
            type="search"
            className={`${input} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by site, sensor, weather or note"
          />
        </div>
        <div role="group" aria-label="Filter by sync status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-10 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "border-accent bg-accent text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {records === null && <div className={`${card} h-32 animate-pulse`} />}

      {records && total === 0 && (
        <div className={`${card} flex flex-col items-start gap-3 p-6`}>
          <h2 className="text-lg font-bold">No records yet</h2>
          <p className="text-[15px] text-slate-600">Your first field record will show up here as soon as you save it.</p>
          <Link to="/capture" className={btnPrimary}>
            Capture a record
          </Link>
        </div>
      )}

      {records && total > 0 && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-600">
          No records match that search or filter.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {visible.map((r) => (
          <li key={r.id} className={`${card} flex flex-col gap-4 p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-[17px] font-semibold break-words">{r.site.name}</h2>
                <p className="text-sm text-slate-600">
                  {formatDateTime(r.capturedAt)}
                  {r.conditions.weather && ` · ${r.conditions.weather}`}
                  {r.conditions.airTempC !== null && ` · ${r.conditions.airTempC} °C air`}
                </p>
              </div>
              <StatusBadge status={r.syncStatus} />
            </div>

            {r.readings.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {r.readings.map((x) => (
                  <div key={x.id} className="flex flex-col">
                    <dt className="text-xs text-slate-600">{sensorLabel(x.sensor)}</dt>
                    <dd className="text-[15px] font-semibold">
                      {x.value} <span className="font-normal text-slate-600">{x.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {r.notes.length > 0 && (
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-700">“{r.notes[0].text}”</p>
            )}

            {r.syncStatus === "error" && r.lastError && (
              <p role="alert" className="rounded-lg bg-concern-soft px-3 py-2 text-sm text-concern">
                Sync failed: {r.lastError}. Edit the record to fix it, then it will sync again.
              </p>
            )}
            {r.syncStatus === "conflict" && (
              <p className="rounded-lg bg-integrity-soft px-3 py-2 text-sm text-integrity">
                This record was changed somewhere else too. <Link to="/sync">Review it on the Sync page.</Link>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="mr-auto text-xs text-slate-600">
                {plural(r.readings.length, "reading")} · {plural(r.notes.length, "note")}
              </span>
              {confirming === r.id ? (
                <>
                  <span className="text-sm font-semibold text-slate-800">Delete this record?</span>
                  <button type="button" onClick={() => remove(r)} className={btnDanger}>
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className={btnSecondary}>
                    Keep
                  </button>
                </>
              ) : (
                <>
                  {r.syncStatus !== "conflict" && (
                    <Link to={`/records/${r.id}/edit`} className={btnSecondary}>
                      Edit
                    </Link>
                  )}
                  <button type="button" onClick={() => setConfirming(r.id)} className={btnSecondary}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
