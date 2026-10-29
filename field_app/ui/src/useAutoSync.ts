import { useEffect } from "react";

import { syncNow, type SyncOutcome } from "./sync";

/** Sync automatically after saves, when the connection returns, and every 30 s (FR-33, FR-42). */
export function useAutoSync(onResult: (outcome: SyncOutcome) => void) {
  useEffect(() => {
    const run = () => {
      if (navigator.onLine) syncNow().then(onResult);
    };
    run();
    window.addEventListener("online", run);
    window.addEventListener("field-records-changed", run);
    const timer = window.setInterval(run, 30000);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("field-records-changed", run);
      window.clearInterval(timer);
    };
  }, [onResult]);
}
