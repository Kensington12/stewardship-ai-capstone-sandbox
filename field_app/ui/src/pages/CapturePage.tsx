import { useLiveQuery } from "dexie-react-hooks";
import { CircleAlert, LocateFixed, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { btnPrimary, btnSecondary, card, input, label } from "../components/ui";
import { useToast } from "../components/Toast";
import { db, getDeviceId, newId, saveRecord } from "../db";
import { fromLocalInput, toLocalInput } from "../format";
import { SENSOR_PRESETS, WEATHER_OPTIONS } from "../sensors";
import type { FieldRecord } from "../types";

const NEW_SITE = "__new__";
const OTHER_SENSOR = "__other__";

interface ReadingRow {
  id: string;
  preset: string;
  customName: string;
  value: string;
  unit: string;
}

interface NoteRow {
  id: string;
  text: string;
  createdAt: string;
}

interface FormState {
  siteChoice: string;
  siteName: string;
  latitude: string;
  longitude: string;
  capturedAt: string;
  weather: string;
  airTempC: string;
  humidityPct: string;
  windSpeedKmh: string;
  conditionsNotes: string;
  readings: ReadingRow[];
  notes: NoteRow[];
}

type Errors = Record<string, string>;

function emptyReading(): ReadingRow {
  return { id: newId(), preset: SENSOR_PRESETS[0].key, customName: "", value: "", unit: SENSOR_PRESETS[0].unit };
}

function emptyNote(): NoteRow {
  return { id: newId(), text: "", createdAt: new Date().toISOString() };
}

function blankForm(lastSiteId?: string): FormState {
  return {
    siteChoice: lastSiteId ?? NEW_SITE,
    siteName: "",
    latitude: "",
    longitude: "",
    capturedAt: toLocalInput(new Date().toISOString()),
    weather: "",
    airTempC: "",
    humidityPct: "",
    windSpeedKmh: "",
    conditionsNotes: "",
    readings: [emptyReading()],
    notes: [emptyNote()],
  };
}

function formFromRecord(r: FieldRecord): FormState {
  const num = (n: number | null) => (n === null ? "" : String(n));
  return {
    siteChoice: r.site.id,
    siteName: r.site.name,
    latitude: num(r.site.latitude),
    longitude: num(r.site.longitude),
    capturedAt: toLocalInput(r.capturedAt),
    weather: r.conditions.weather,
    airTempC: num(r.conditions.airTempC),
    humidityPct: num(r.conditions.humidityPct),
    windSpeedKmh: num(r.conditions.windSpeedKmh),
    conditionsNotes: r.conditions.notes,
    readings: r.readings.map((x) => {
      const preset = SENSOR_PRESETS.find((p) => p.key === x.sensor);
      return {
        id: x.id,
        preset: preset ? preset.key : OTHER_SENSOR,
        customName: preset ? "" : x.sensor,
        value: String(x.value),
        unit: x.unit,
      };
    }),
    notes: r.notes.map((n) => ({ ...n })),
  };
}

/** Empty string -> null; otherwise a number or NaN. */
function parseOptional(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function checkRange(errors: Errors, key: string, value: string, min: number, max: number, name: string) {
  const n = parseOptional(value);
  if (n !== null && (!Number.isFinite(n) || n < min || n > max)) {
    errors[key] = `${name} must be a number from ${min} to ${max}.`;
  }
}

// Same rules the central system enforces (EH-02), checked here so mistakes are caught on site.
function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.siteChoice === NEW_SITE && !form.siteName.trim()) errors.siteName = "Enter a site name.";
  checkRange(errors, "latitude", form.latitude, -90, 90, "Latitude");
  checkRange(errors, "longitude", form.longitude, -180, 180, "Longitude");
  if (!form.capturedAt || Number.isNaN(new Date(form.capturedAt).getTime()))
    errors.capturedAt = "Enter the date and time of this record.";
  checkRange(errors, "airTempC", form.airTempC, -60, 60, "Air temperature");
  checkRange(errors, "humidityPct", form.humidityPct, 0, 100, "Humidity");
  checkRange(errors, "windSpeedKmh", form.windSpeedKmh, 0, 400, "Wind speed");

  const filledReadings = form.readings.filter((r) => r.value.trim() !== "" || r.customName.trim() !== "");
  form.readings.forEach((r, i) => {
    const touched = r.value.trim() !== "" || r.customName.trim() !== "";
    if (!touched) return;
    if (r.preset === OTHER_SENSOR && !r.customName.trim()) errors[`reading-${i}-name`] = "Name this sensor.";
    if (r.value.trim() === "" || !Number.isFinite(Number(r.value)))
      errors[`reading-${i}-value`] = "Enter a number, for example 7.8.";
  });
  const filledNotes = form.notes.filter((n) => n.text.trim() !== "");
  if (filledReadings.length === 0 && filledNotes.length === 0)
    errors.content = "Add at least one sensor reading or one note.";
  return errors;
}

export function CapturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sites = useLiveQuery(() => db.sites.orderBy("name").toArray(), [], []);
  const [existing, setExisting] = useState<FieldRecord | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm());
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Load the record when editing, or default to the last site used when capturing.
  useEffect(() => {
    let cancelled = false;
    if (id) {
      db.records.get(id).then((r) => {
        if (cancelled) return;
        if (!r || r.deleted) {
          toast("That record no longer exists on this device.", "error");
          navigate("/records");
          return;
        }
        setExisting(r);
        setForm(formFromRecord(r));
      });
    } else {
      setExisting(null);
      db.meta.get("lastSiteId").then((m) => !cancelled && setForm(blankForm(m?.value)));
    }
    return () => {
      cancelled = true;
    };
  }, [id, navigate, toast]);

  // If the remembered site no longer exists, fall back to "new site".
  useEffect(() => {
    if (form.siteChoice !== NEW_SITE && sites.length && !sites.some((s) => s.id === form.siteChoice)) {
      setForm((f) => ({ ...f, siteChoice: NEW_SITE }));
    }
  }, [sites, form.siteChoice]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const updateReading = (index: number, patch: Partial<ReadingRow>) =>
    setForm((f) => ({ ...f, readings: f.readings.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));

  const updateNote = (index: number, text: string) =>
    setForm((f) => ({ ...f, notes: f.notes.map((n, i) => (i === index ? { ...n, text } : n)) }));

  function fillLocation() {
    if (!("geolocation" in navigator)) {
      toast("This device can't share its location. Type the coordinates instead.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        toast("Couldn't get a location fix. Type the coordinates instead.", "error");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById("form-errors")?.focus();
      return;
    }
    setSaving(true);
    try {
      const chosen = sites.find((s) => s.id === form.siteChoice);
      const site =
        form.siteChoice === NEW_SITE || !chosen
          ? { id: newId(), name: form.siteName.trim(), latitude: null, longitude: null }
          : { ...chosen };
      site.latitude = parseOptional(form.latitude);
      site.longitude = parseOptional(form.longitude);
      if (form.siteChoice === NEW_SITE) site.name = form.siteName.trim();

      const now = new Date().toISOString();
      const record: FieldRecord = {
        id: existing?.id ?? newId(),
        site,
        capturedAt: fromLocalInput(form.capturedAt),
        conditions: {
          weather: form.weather,
          airTempC: parseOptional(form.airTempC),
          humidityPct: parseOptional(form.humidityPct),
          windSpeedKmh: parseOptional(form.windSpeedKmh),
          notes: form.conditionsNotes.trim(),
        },
        readings: form.readings
          .filter((r) => r.value.trim() !== "")
          .map((r) => ({
            id: r.id,
            sensor: r.preset === OTHER_SENSOR ? r.customName.trim() : r.preset,
            value: Number(r.value),
            unit: r.unit.trim(),
          })),
        notes: form.notes.filter((n) => n.text.trim()).map((n) => ({ ...n, text: n.text.trim() })),
        deleted: false,
        deviceId: existing?.deviceId ?? (await getDeviceId()),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        baseVersion: existing?.baseVersion ?? 0,
        syncStatus: "pending",
      };
      await saveRecord(record);
      await db.meta.put({ key: "lastSiteId", value: site.id });
      toast(existing ? "Changes saved on this device." : "Record saved on this device.");
      if (existing) {
        navigate("/records");
      } else {
        setForm(blankForm(site.id));
        setErrors({});
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      toast("Couldn't save to this device. Check that storage isn't full, then try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} className="text-sm font-medium text-red-700">
        {errors[key]}
      </p>
    ) : null;
  const describedBy = (key: string, hint?: string) =>
    [errors[key] ? `${key}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold tracking-tight md:text-[28px]">
          {existing ? "Edit field record" : "New field record"}
        </h1>
        <p className="text-[15px] leading-relaxed text-slate-600">
          Choose the site, check the time, note the conditions, then add your readings and notes. Records save to this
          device first and sync when you're back online.
        </p>
      </div>

      {errorCount > 0 && (
        <div
          id="form-errors"
          tabIndex={-1}
          role="alert"
          className="flex gap-3 rounded-xl border border-concern-line bg-concern-soft px-4 py-3 text-sm text-concern"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {errorCount === 1 ? "One thing needs fixing" : `${errorCount} things need fixing`} before this can be
              saved.
            </p>
            {errors.content && <p className="mt-1">{errors.content}</p>}
          </div>
        </div>
      )}

      <section aria-labelledby="site-heading" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
        <h2 id="site-heading" className="text-lg font-bold">
          Site and time
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="site" className={label}>
            Research site
          </label>
          <select
            id="site"
            className={input}
            value={form.siteChoice}
            onChange={(e) => {
              const chosen = sites.find((s) => s.id === e.target.value);
              setForm((f) => ({
                ...f,
                siteChoice: e.target.value,
                siteName: chosen?.name ?? "",
                latitude: chosen?.latitude == null ? "" : String(chosen.latitude),
                longitude: chosen?.longitude == null ? "" : String(chosen.longitude),
              }));
            }}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SITE}>+ New site…</option>
          </select>
        </div>
        {form.siteChoice === NEW_SITE && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="siteName" className={label}>
              New site name
            </label>
            <input
              id="siteName"
              className={input}
              value={form.siteName}
              onChange={(e) => set("siteName", e.target.value)}
              placeholder="e.g. Kentucky Lake, Site 4"
              aria-invalid={!!errors.siteName}
              aria-describedby={describedBy("siteName")}
              autoComplete="off"
            />
            {fieldError("siteName")}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="latitude" className={label}>
              Latitude <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              id="latitude"
              className={input}
              inputMode="decimal"
              value={form.latitude}
              onChange={(e) => set("latitude", e.target.value)}
              aria-invalid={!!errors.latitude}
              aria-describedby={describedBy("latitude")}
            />
            {fieldError("latitude")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="longitude" className={label}>
              Longitude <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              id="longitude"
              className={input}
              inputMode="decimal"
              value={form.longitude}
              onChange={(e) => set("longitude", e.target.value)}
              aria-invalid={!!errors.longitude}
              aria-describedby={describedBy("longitude")}
            />
            {fieldError("longitude")}
          </div>
          <button type="button" onClick={fillLocation} disabled={locating} className={btnSecondary}>
            <LocateFixed className="size-4" aria-hidden="true" />
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capturedAt" className={label}>
            Date and time
          </label>
          <input
            id="capturedAt"
            type="datetime-local"
            className={input}
            value={form.capturedAt}
            onChange={(e) => set("capturedAt", e.target.value)}
            aria-invalid={!!errors.capturedAt}
            aria-describedby={describedBy("capturedAt", "capturedAt-hint")}
          />
          <p id="capturedAt-hint" className="text-sm text-slate-600">
            Filled in with the current time. Change it if you're entering an earlier reading.
          </p>
          {fieldError("capturedAt")}
        </div>
      </section>

      <section aria-labelledby="conditions-heading" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
        <h2 id="conditions-heading" className="text-lg font-bold">
          Field conditions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="weather" className={label}>
              Weather
            </label>
            <select id="weather" className={input} value={form.weather} onChange={(e) => set("weather", e.target.value)}>
              <option value="">Not recorded</option>
              {WEATHER_OPTIONS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          {(
            [
              ["airTempC", "Air temperature (°C)"],
              ["humidityPct", "Humidity (%)"],
              ["windSpeedKmh", "Wind speed (km/h)"],
            ] as const
          ).map(([key, text]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label htmlFor={key} className={label}>
                {text}
              </label>
              <input
                id={key}
                className={input}
                inputMode="decimal"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                aria-invalid={!!errors[key]}
                aria-describedby={describedBy(key)}
              />
              {fieldError(key)}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="conditionsNotes" className={label}>
            Other conditions <span className="font-normal text-slate-600">(optional)</span>
          </label>
          <input
            id="conditionsNotes"
            className={input}
            value={form.conditionsNotes}
            onChange={(e) => set("conditionsNotes", e.target.value)}
            placeholder="e.g. light chop on the water"
          />
        </div>
      </section>

      <section aria-labelledby="readings-heading" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
        <div className="flex flex-col gap-1">
          <h2 id="readings-heading" className="text-lg font-bold">
            Sensor readings
          </h2>
          <p className="text-sm text-slate-600">Pick a sensor and enter its value. Use "Other" for anything not listed.</p>
        </div>
        {form.readings.map((r, i) => (
          <fieldset key={r.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Reading {i + 1}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_0.7fr_auto] sm:items-start">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`sensor-${i}`} className={label}>
                  Sensor
                </label>
                <select
                  id={`sensor-${i}`}
                  className={input}
                  value={r.preset}
                  onChange={(e) => {
                    const preset = SENSOR_PRESETS.find((p) => p.key === e.target.value);
                    updateReading(i, { preset: e.target.value, unit: preset ? preset.unit : "" });
                  }}
                >
                  {SENSOR_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                  <option value={OTHER_SENSOR}>Other…</option>
                </select>
                {r.preset === OTHER_SENSOR && (
                  <>
                    <label htmlFor={`sensor-name-${i}`} className="sr-only">
                      Sensor name
                    </label>
                    <input
                      id={`sensor-name-${i}`}
                      className={input}
                      value={r.customName}
                      onChange={(e) => updateReading(i, { customName: e.target.value })}
                      placeholder="Sensor name"
                      aria-invalid={!!errors[`reading-${i}-name`]}
                      aria-describedby={describedBy(`reading-${i}-name`)}
                    />
                    {fieldError(`reading-${i}-name`)}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`value-${i}`} className={label}>
                  Value
                </label>
                <input
                  id={`value-${i}`}
                  className={input}
                  inputMode="decimal"
                  value={r.value}
                  onChange={(e) => updateReading(i, { value: e.target.value })}
                  aria-invalid={!!errors[`reading-${i}-value`]}
                  aria-describedby={describedBy(`reading-${i}-value`)}
                />
                {fieldError(`reading-${i}-value`)}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`unit-${i}`} className={label}>
                  Unit
                </label>
                <input
                  id={`unit-${i}`}
                  className={input}
                  value={r.unit}
                  onChange={(e) => updateReading(i, { unit: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, readings: f.readings.filter((_, j) => j !== i) }))}
                aria-label={`Remove reading ${i + 1}`}
                className={`${btnSecondary} sm:mt-[26px] sm:px-3`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span className="sm:hidden">Remove</span>
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, readings: [...f.readings, emptyReading()] }))}
          className={`${btnSecondary} self-start`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add reading
        </button>
      </section>

      <section aria-labelledby="notes-heading" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
        <h2 id="notes-heading" className="text-lg font-bold">
          Notes
        </h2>
        {form.notes.map((n, i) => (
          <div key={n.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`note-${i}`} className={label}>
                Note {i + 1}
              </label>
              {form.notes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, notes: f.notes.filter((_, j) => j !== i) }))}
                  className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              id={`note-${i}`}
              rows={3}
              className={`${input} py-2.5 leading-relaxed`}
              value={n.text}
              onChange={(e) => updateNote(i, e.target.value)}
              placeholder="What did you observe?"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, notes: [...f.notes, emptyNote()] }))}
          className={`${btnSecondary} self-start`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add note
        </button>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className={`${btnPrimary} min-w-40`}>
          {saving ? "Saving…" : existing ? "Save changes" : "Save record"}
        </button>
        {existing && (
          <button type="button" onClick={() => navigate("/records")} className={btnSecondary}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
