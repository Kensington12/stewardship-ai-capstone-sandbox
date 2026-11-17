import { useLiveQuery } from "dexie-react-hooks";
import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, NetworkError, SyncKeyError, type CentralRecord, type ReportListItem } from "../api";
import { btnPrimary, btnSecondary, card, input, label } from "../components/ui";
import { useToast } from "../components/Toast";
import { db } from "../db";
import { formatDateTime } from "../format";

export function ReportsPage() {
  const toast = useToast();
  const sites = useLiveQuery(() => db.sites.orderBy("name").toArray(), [], []);
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [central, setCentral] = useState<CentralRecord[] | null>(null);
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const [siteId, setSiteId] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  function load() {
    Promise.all([api.reports(), api.datasets(), api.centralRecords()])
      .then(([r, d, c]) => {
        setReports(r);
        setDatasets(d);
        setCentral(c);
        setUnreachable(null);
      })
      .catch((error) =>
        setUnreachable(
          error instanceof SyncKeyError
            ? "This device doesn't have the sync key yet. Add it on the Sync page to see reports."
            : "Can't reach the central system right now. Your field records are safe on this device, and capturing and saving still work offline.",
        ),
      );
  }

  useEffect(load, []);

  async function interpret(body: { dataset?: string; site_id?: string }, key: string) {
    setRunning(key);
    try {
      await api.createReport(body);
      toast("Report created.");
      load();
    } catch (error) {
      toast(
        error instanceof NetworkError ? "Reports need the central system. Connect and try again." : (error as Error).message,
        "error",
      );
    } finally {
      setRunning(null);
    }
  }

  async function downloadCsv() {
    try {
      const text = await api.exportCsv(siteId || undefined);
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "field_records.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast((error as Error).message, "error");
    }
  }

  const liveCentral = (central ?? []).filter((r) => !r.deleted);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold tracking-tight md:text-[28px]">Reports</h1>
        <p className="text-[15px] text-slate-600">
          Synced records feed the interpretation pipeline on the central system. This page needs a connection.
        </p>
      </div>

      {unreachable && (
        <div role="alert" className="rounded-xl border border-watch-line bg-watch-soft px-4 py-3 text-sm text-watch">
          {unreachable}
        </div>
      )}

      <section aria-labelledby="interpret-heading" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
        <h2 id="interpret-heading" className="text-lg font-bold">
          Interpret synced records
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="report-site" className={label}>
            Site
          </label>
          <select id="report-site" className={input} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={running !== null}
          onClick={() => interpret(siteId ? { site_id: siteId } : {}, "records")}
          className={`${btnPrimary} self-start`}
        >
          {running === "records" ? "Interpreting…" : "Create report"}
        </button>
      </section>

      {central && (
        <section aria-labelledby="central-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="central-heading" className="text-lg font-bold">
                On the central system
              </h2>
              <p className="text-sm text-slate-600">
                {liveCentral.length === 1 ? "1 synced record" : `${liveCentral.length} synced records`}. Each record
                appears once, however many times it was sent.
              </p>
            </div>
            <button type="button" onClick={downloadCsv} disabled={liveCentral.length === 0} className={btnSecondary}>
              <Download className="size-4" aria-hidden="true" />
              Download CSV
            </button>
          </div>
          {liveCentral.length > 0 && (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs tracking-wide text-slate-600 uppercase">
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Site
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Captured
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Readings
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Notes
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Version
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liveCentral.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <th scope="row" className="px-4 py-2 text-left font-semibold">
                        {r.site_name}
                      </th>
                      <td className="px-4 py-2">{formatDateTime(r.captured_at)}</td>
                      <td className="px-4 py-2 text-right">{r.reading_count}</td>
                      <td className="px-4 py-2 text-right">{r.note_count}</td>
                      <td className="px-4 py-2 text-right">{r.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="list-heading" className="flex flex-col gap-3">
        <h2 id="list-heading" className="text-lg font-bold">
          Saved reports
        </h2>
        {reports === null && !unreachable && <div className={`${card} h-20 animate-pulse`} />}
        {reports?.length === 0 && <p className="text-sm text-slate-600">No reports yet.</p>}
        {reports && reports.length > 0 && (
          <ul className={`${card} divide-y divide-slate-100`}>
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/reports/${r.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-slate-900 no-underline hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate font-semibold">
                      {r.source_kind === "field_records" ? "Field records" : r.dataset_filename}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-slate-600">{formatDateTime(r.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {datasets.length > 0 && (
        <section aria-labelledby="samples-heading" className="flex flex-col gap-3">
          <h2 id="samples-heading" className="text-lg font-bold">
            Sample datasets
          </h2>
          <p className="text-sm text-slate-600">For testing the pipeline with the sandbox's sample data.</p>
          <div className="flex flex-wrap gap-2">
            {datasets.map((d) => (
              <button
                key={d}
                type="button"
                disabled={running !== null}
                onClick={() => interpret({ dataset: d }, d)}
                className={btnSecondary}
              >
                {running === d ? "Interpreting…" : d}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
