import { useEffect, useState } from "react";

import { api } from "./api";

/** Tracks two things (FR-30): network access, and whether the central system answers. */
export function useConnection() {
  const [online, setOnline] = useState(navigator.onLine);
  const [serverUp, setServerUp] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () =>
      api
        .health()
        .then(() => setServerUp(true))
        .catch(() => setServerUp(false));
    const goOnline = () => {
      setOnline(true);
      check();
    };
    const goOffline = () => {
      setOnline(false);
      setServerUp(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, []);

  return { online, serverUp };
}
