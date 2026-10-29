import { CircleAlert, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, type SavedReport } from "../api";
import { card } from "../components/ui";
import type { Severity } from "../contract";
import { formatDateTime } from "../format";

const SEVERITY: Record<Severity, { label: string; className: string; Icon: typeof Info }> = {
  info: { label: "Info", className: "border-info-line bg-info-soft text-info", Icon: Info },
  watch: { label: "Watch", className: "border-watch-line bg-watch-soft text-watch", Icon: TriangleAlert },
  concern: { label: "Concern", className: "border-concern-line bg-concern-soft text-concern", Icon: CircleAlert },
};

/** One interpretation report. Integrity notes are always shown, first (CONTRACT.md rule). */
export function ReportDetailPage() {
  const { id } = useParams();
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) api.report(id).then(setSaved).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div role="alert" className="rounded-xl border border-concern-line bg-concern-soft px-4 py-3 text-sm text-concern">
        Couldn't load this report: {error}
      </div>
    );
  if (!saved) return <div className={`${card} h-40 animate-pulse`} />;

  const { report } = saved;
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
        <Link to="/reports">Reports</Link> / {report.dataset_filename}
      </nav>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] font-bold tracking-tight break-all md:text-[28px]">{report.dataset_filename}</h1>
        <p className="text-sm text-slate-600">
          {formatDateTime(saved.created_at)} · Engine: {report.source}
        </p>
      </div>

      <section
        aria-labelledby="integrity-heading"
        className="flex gap-4 rounded-2xl border border-integrity-line bg-integrity-soft p-5"
      >
        <ShieldAlert className="mt-0.5 size-6 shrink-0 text-integrity" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h2 id="integrity-heading" className="text-[15px] font-bold text-integrity">
            What this report can't stand behind
          </h2>
          {report.integrity_notes.length ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-integrity">
              {report.integrity_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-integrity">The engine reported no limitations for this report.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="summary-heading" className={`${card} flex flex-col gap-2 p-5`}>
        <h2 id="summary-heading" className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
          Summary
        </h2>
        <p className="text-[15px] leading-relaxed">{report.summary_text}</p>
      </section>

      <section aria-labelledby="obs-heading" className="flex flex-col gap-3">
        <h2 id="obs-heading" className="text-lg font-bold">
          Observations
        </h2>
        {report.observations.map((o, i) => {
          const s = SEVERITY[o.severity];
          return (
            <article key={i} className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:gap-4`}>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${s.className}`}
              >
                <s.Icon className="size-3.5" aria-hidden="true" />
                {s.label}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{o.statement}</p>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">Evidence:</span> {o.evidence}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="sources-heading" className={`${card} flex flex-col gap-2 p-5`}>
        <h2 id="sources-heading" className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
          Sources consulted
        </h2>
        {report.sources_consulted.length ? (
          <ul className="list-disc pl-5 text-sm">
            {report.sources_consulted.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">None cited.</p>
        )}
      </section>
    </>
  );
}
