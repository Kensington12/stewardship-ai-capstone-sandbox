import { useLiveQuery } from "dexie-react-hooks";
import { Droplet, FileText, List, PenLine, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { db } from "../db";
import { plural } from "../format";
import type { SyncOutcome } from "../sync";
import { useAutoSync } from "../useAutoSync";
import { useConnection } from "../useConnection";
import { useToast } from "./Toast";

const NAV = [
  { to: "/capture", label: "Capture", icon: PenLine },
  { to: "/records", label: "Records", icon: List },
  { to: "/sync", label: "Sync", icon: RefreshCw },
  { to: "/reports", label: "Reports", icon: FileText },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { online, serverUp } = useConnection();
  const toast = useToast();
  const waiting = useLiveQuery(() => db.records.where("syncStatus").equals("pending").count(), [], 0);
  const attention = useLiveQuery(
    () => db.records.where("syncStatus").anyOf("error", "conflict").count(),
    [],
    0,
  );

  const onSync = useCallback(
    (outcome: SyncOutcome) => {
      if (outcome.kind !== "done") return;
      if (outcome.synced) toast(`${plural(outcome.synced, "record")} synced to the central system.`);
      if (outcome.conflicts || outcome.errors)
        toast(`${plural(outcome.conflicts + outcome.errors, "record")} need your attention. Open Sync.`, "error");
    },
    [toast],
  );
  useAutoSync(onSync);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/capture" className="flex items-center gap-3 text-slate-900 no-underline">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent">
              <Droplet className="size-[18px] text-white" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-base leading-tight font-bold tracking-tight">Field Capture</span>
              <span className="hidden text-xs text-slate-600 sm:block">Stewardship Compute</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                online ? "border-slate-200 bg-slate-100 text-slate-700" : "border-watch-line bg-watch-soft text-watch"
              }`}
            >
              {online ? <Wifi className="size-4" aria-hidden="true" /> : <WifiOff className="size-4" aria-hidden="true" />}
              {online ? (serverUp ? "Online" : "Online · central system unreachable") : "Offline · saving on device"}
            </span>
            {waiting > 0 && (
              <Link
                to="/sync"
                className="inline-flex items-center gap-1.5 rounded-full border border-watch-line bg-watch-soft px-3 py-1.5 text-watch no-underline"
              >
                <span className="size-2 rounded-full bg-amber-600" aria-hidden="true" />
                {plural(waiting, "record")} waiting to sync
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav
          aria-label="Main"
          className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white px-4 py-6 md:flex"
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center justify-between gap-3 rounded-lg px-3.5 text-[15px] no-underline transition-colors ${
                  isActive ? "bg-accent-soft font-semibold text-accent" : "font-medium text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </span>
              {to === "/sync" && attention > 0 && (
                <span className="rounded-full bg-concern px-2 py-0.5 text-xs font-bold text-white">
                  {attention}
                  <span className="sr-only"> need attention</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-12 md:pt-10 md:pb-16">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">{children}</div>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs no-underline ${
                isActive ? "font-semibold text-accent" : "font-medium text-slate-600"
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
            {to === "/sync" && attention > 0 && (
              <span className="absolute top-2 right-[calc(50%-20px)] rounded-full bg-concern px-1.5 text-[11px] font-bold text-white">
                {attention}
                <span className="sr-only"> need attention</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
