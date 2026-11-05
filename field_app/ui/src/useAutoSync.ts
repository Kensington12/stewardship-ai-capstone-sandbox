import { useEffect } from "react";

import { syncNow, type SyncOutcome } from "./sync";

/** Tries to sync after every save, when the connection comes back, and every 30 seconds. */
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
