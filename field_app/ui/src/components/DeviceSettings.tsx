import { useLiveQuery } from "dexie-react-hooks";
import { KeyRound, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { api, NetworkError, SyncKeyError } from "../api";
import { clearDevice, db, notifyChanged, setMeta } from "../db";
import { plural } from "../format";
import { useToast } from "./Toast";
import { btnDanger, btnPrimary, btnSecondary, card, input, label } from "./ui";

/** Where a device is given the team's sync key. Shown on the Sync page. */
export function SyncKeyCard() {
  const toast = useToast();
  const savedKey = useLiveQuery(async () => (await db.meta.get("syncKey"))?.value ?? "", [], null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (savedKey === null) return null;
  const showForm = editing || !savedKey;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const key = value.trim().toUpperCase().replace(/\s+/g, "");
    if (!key) {
      setError("Enter the sync key shown in the central system's terminal.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await api.checkKey(key);
      await setMeta("syncKey", key);
      setEditing(false);
      setValue("");
      toast("Connected. Waiting records will sync now.");
      notifyChanged();
    } catch (e) {
      if (e instanceof SyncKeyError) setError("That key didn't work. Check it against the terminal and try again.");
      else if (e instanceof NetworkError)
        setError("Can't reach the central system to check the key. Try again when you're connected.");
      else setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  if (!showForm) {
    return (
      <section aria-labelledby="key-heading" className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <KeyRound className="size-5 text-accent" aria-hidden="true" />
          <div className="flex flex-col">
            <h2 id="key-heading" className="text-sm font-semibold">
              Connected to the central system
            </h2>
            <span className="text-sm text-slate-600">Sync key ending in {savedKey.slice(-4)}</span>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
          Change key
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="key-heading"
      className="flex flex-col gap-4 rounded-2xl border border-watch-line bg-watch-soft p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="key-heading" className="flex items-center gap-2 text-lg font-bold text-watch">
          <KeyRound className="size-5" aria-hidden="true" />
          {savedKey ? "Change the sync key" : "Connect this device"}
        </h2>
        <p className="text-sm text-slate-700">
          Records are saved on this device either way. To send them to the central system, enter the team's sync key.
          It's printed in the terminal when the central system starts.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="sync-key" className={label}>
            Sync key
          </label>
          <input
            id="sync-key"
            className={`${input} font-mono tracking-wider uppercase`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ABCD-EFGH-JKLM-NPQR"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "sync-key-error" : undefined}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={checking} className={btnPrimary}>
            {checking ? "Checking…" : "Connect"}
          </button>
          {savedKey && (
            <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && (
        <p id="sync-key-error" role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

/** Removes everything this app has stored on the device, with a warning about unsynced records. */
export function ClearDeviceCard() {
  const unsynced = useLiveQuery(() => db.records.where("syncStatus").anyOf("pending", "error", "conflict").count(), [], 0);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearEverything() {
    setClearing(true);
    await clearDevice();
    window.location.assign("/capture");
  }

  return (
    <section aria-labelledby="clear-heading" className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id="clear-heading" className="text-lg font-bold">
        Clear data on this device
      </h2>
      <p className="text-sm text-slate-700">
        Removes every record, site and the sync key from this device, for example before handing it to someone else.
        Records already on the central system stay there.
      </p>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className={`${btnSecondary} self-start`}>
          <Trash2 className="size-4" aria-hidden="true" />
          Clear this device
        </button>
      ) : (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-concern-line bg-concern-soft p-4">
          <p className="text-sm font-semibold text-concern">
            {unsynced > 0
              ? `${plural(unsynced, "record")} on this device ${unsynced === 1 ? "hasn't" : "haven't"} reached the central system and will be lost for good. Sync first if you can.`
              : "Everything here has synced. This only removes the copy on this device."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={clearing} onClick={clearEverything} className={btnDanger}>
              {clearing ? "Clearing…" : unsynced > 0 ? "Delete anyway" : "Clear this device"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
