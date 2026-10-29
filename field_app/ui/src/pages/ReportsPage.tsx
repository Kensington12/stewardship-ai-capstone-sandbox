import { useLiveQuery } from "dexie-react-hooks";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, NetworkError, type ReportListItem } from "../api";
import { btnPrimary, btnSecondary, card, input, label } from "../components/ui";
import { useToast } from "../components/Toast";
import { db } from "../db";
import { formatDateTime } from "../format";

/** Send synced field data through the interpretation pipeline (US-09, FR-51 to FR-55). */
export function ReportsPage() {
  const toast = useToast();
  const sites = useLiveQuery(() => db.sites.orderBy("name").toArray(), [], []);
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  function load() {
    Promise.all([api.reports(), api.datasets()])
      .then(([r, d]) => {
        setReports(r);
        setDatasets(d);
        setUnreachable(false);
      })
      .catch(() => setUnreachable(true));
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
        error instanceof NetworkError
          ? "Reports need the central system. Connect and try again."
          : (error as Error).message,
        "error",
      );
    } finally {
      setRunning(null);
    }
  }

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
          Can't reach the central system right now. Your field records are safe on this device. Capturing and saving
          still work offline.
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
