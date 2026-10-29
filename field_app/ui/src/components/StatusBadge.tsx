import { CheckCircle2, CircleAlert, Clock, GitCompare } from "lucide-react";

import type { SyncStatus } from "../types";

// Every status has an icon AND words, never color alone (A-03).
const STYLES: Record<SyncStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: {
    label: "Saved on device",
    className: "border-watch-line bg-watch-soft text-watch",
    Icon: Clock,
  },
  synced: {
    label: "Synced",
    className: "border-teal-200 bg-accent-soft text-teal-800",
    Icon: CheckCircle2,
  },
  error: {
    label: "Sync failed",
    className: "border-concern-line bg-concern-soft text-concern",
    Icon: CircleAlert,
  },
  conflict: {
    label: "Needs review",
    className: "border-integrity-line bg-integrity-soft text-integrity",
    Icon: GitCompare,
  },
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
