"use client";

import { FormEvent, startTransition, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { buildPlanTripUrl, type LogSheet, type PlanTripRequest, type PlanTripResponse } from "@/lib/api";

const TripRouteMap = dynamic(
  () => import("@/components/trip-route-map").then((module) => module.TripRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[24rem] items-center justify-center rounded-[1.7rem] border border-white/8 bg-black/10 px-6 py-10 text-sm text-stone-400">
        Rendering route map...
      </div>
    ),
  },
);

type FormState = {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hours: string;
  departure_date: string;
  departure_time: string;
};

const INITIAL_FORM: FormState = {
  current_location: "Chicago, IL",
  pickup_location: "Indianapolis, IN",
  dropoff_location: "Nashville, TN",
  cycle_used_hours: "0",
  departure_date: "2024-04-26",
  departure_time: "06:00",
};

/** Convert the editable form state into the backend trip planner payload. */
function toRequestPayload(form: FormState): PlanTripRequest {
  return {
    current_location: form.current_location.trim(),
    pickup_location: form.pickup_location.trim(),
    dropoff_location: form.dropoff_location.trim(),
    cycle_used_hours: Number(form.cycle_used_hours),
    departure_datetime: `${form.departure_date}T${form.departure_time}:00`,
  };
}

/** Normalize backend error payloads into a readable inline message. */
function formatApiError(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "The planner request failed.";
  }

  const maybeError = (payload as { error?: { message?: unknown } }).error;
  if (typeof maybeError?.message === "string") {
    return maybeError.message;
  }

  if (maybeError?.message && typeof maybeError.message === "object") {
    return JSON.stringify(maybeError.message);
  }

  return "The planner request failed.";
}

/** Count segments matching the exact label used by the backend planner response. */
function countStops(segments: PlanTripResponse["trip_segments"], label: string): number {
  return segments.filter((segment) => segment.label === label).length;
}

/** Format trip timestamps into a concise local operational readout. */
function formatSegmentTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Summarize the overall activity window covered by the current trip result. */
function describeTripWindow(segments: PlanTripResponse["trip_segments"]): string {
  if (segments.length === 0) {
    return "No trip activity yet";
  }

  const start = new Date(segments[0].start);
  const end = new Date(segments[segments.length - 1].end);
  const hours = (end.getTime() - start.getTime()) / 3600000;
  return `${hours.toFixed(1)} hr total window`;
}

/** Return the first chronological log sheet for the compact review panel. */
function getPrimaryLogSheet(logSheets: LogSheet[]): LogSheet | null {
  return logSheets.length > 0 ? logSheets[0] : null;
}

export function TripPlannerShell() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<PlanTripResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const primaryLogSheet = useMemo(() => getPrimaryLogSheet(result?.log_sheets || []), [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildPlanTripUrl("compact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toRequestPayload(form)),
      });

      const payload = (await response.json()) as PlanTripResponse | { error?: { message?: unknown } };
      if (!response.ok) {
        setResult(null);
        setErrorMessage(formatApiError(payload));
        return;
      }

      startTransition(() => {
        setResult(payload as PlanTripResponse);
      });
    } catch {
      setResult(null);
      setErrorMessage("The frontend could not reach the backend API.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f3ec_0%,#efe4d3_44%,#e5d6bf_100%)] text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-stone-900/8 bg-white/82 p-6 shadow-[0_24px_80px_rgba(67,52,34,0.08)] backdrop-blur md:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_left,rgba(149,116,69,0.18),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(120,96,68,0.04))] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-800/10 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-900">
                <CompassIcon className="h-3.5 w-3.5" />
                Dispatch workspace
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-stone-950 md:text-6xl">
                  Professional trip planning with route, duty flow, and daily log visibility.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-stone-650 md:text-lg">
                  Submit a trip once and review the route geometry, operational sequence, and early log output in one
                  clean planner view.
                </p>
              </div>
            </div>

            <div className="grid gap-3 self-start">
              <QuickNote
                icon={<RouteIcon className="h-4 w-4" />}
                title="Structured trip inputs"
                text="Locations, cycle usage, and departure timing stay organized in a single dispatcher-friendly form."
              />
              <QuickNote
                icon={<MapIcon className="h-4 w-4" />}
                title="Live route visibility"
                text="The response panel now renders the decoded route directly on a map with clearly marked stops."
              />
              <QuickNote
                icon={<LogIcon className="h-4 w-4" />}
                title="Operational review"
                text="Distance, drive time, stop sequence, and log totals are presented without exposing backend internals."
              />
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={handleSubmit}
            className="grid gap-6 rounded-[2rem] border border-stone-900/8 bg-white/84 p-6 shadow-[0_18px_70px_rgba(67,52,34,0.08)] backdrop-blur md:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Trip request</p>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-950">Plan a new route</h2>
              </div>
              <div className="rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-stone-50">
                HOS ready
              </div>
            </div>

            <div className="grid gap-4">
              <Field
                id="current_location"
                label="Current location"
                value={form.current_location}
                onChange={(value) => setForm((current) => ({ ...current, current_location: value }))}
              />
              <Field
                id="pickup_location"
                label="Pickup location"
                value={form.pickup_location}
                onChange={(value) => setForm((current) => ({ ...current, pickup_location: value }))}
              />
              <Field
                id="dropoff_location"
                label="Dropoff location"
                value={form.dropoff_location}
                onChange={(value) => setForm((current) => ({ ...current, dropoff_location: value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field
                id="cycle_used_hours"
                label="Cycle hours used"
                type="number"
                min="0"
                max="70"
                step="0.1"
                value={form.cycle_used_hours}
                onChange={(value) => setForm((current) => ({ ...current, cycle_used_hours: value }))}
              />
              <Field
                id="departure_date"
                label="Departure date"
                type="date"
                value={form.departure_date}
                onChange={(value) => setForm((current) => ({ ...current, departure_date: value }))}
              />
              <Field
                id="departure_time"
                label="Departure time"
                type="time"
                value={form.departure_time}
                onChange={(value) => setForm((current) => ({ ...current, departure_time: value }))}
              />
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600 sm:grid-cols-3">
              <HelperPill icon={<ShieldIcon className="h-4 w-4" />} text="70-hour cycle constrained" />
              <HelperPill icon={<ClockIcon className="h-4 w-4" />} text="Immediate scheduling preview" />
              <HelperPill icon={<MapIcon className="h-4 w-4" />} text="Map-ready route output" />
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm leading-6 text-stone-600">
                Use concise city and state inputs for more reliable geocoding and faster route generation.
              </p>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-stone-50 shadow-[0_12px_30px_rgba(36,27,18,0.18)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                {isLoading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <ArrowIcon className="h-4 w-4" />}
                {isLoading ? "Planning trip" : "Plan trip"}
              </button>
            </div>

            {errorMessage ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </form>

          <section className="grid gap-5 rounded-[2rem] border border-stone-900/8 bg-[#201812] p-6 text-stone-100 shadow-[0_24px_90px_rgba(55,40,24,0.18)] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Trip summary</p>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-50">
                  Route and duty-status review
                </h2>
              </div>
              <div className="rounded-full border border-stone-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">
                {result ? describeTripWindow(result.trip_segments) : "Awaiting request"}
              </div>
            </div>

            {result ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <StatCard
                    icon={<RouteIcon className="h-5 w-5" />}
                    label="Distance"
                    value={`${result.route.total_distance_miles.toFixed(2)} mi`}
                  />
                  <StatCard
                    icon={<ClockIcon className="h-5 w-5" />}
                    label="Drive time"
                    value={`${result.route.total_duration_hours.toFixed(2)} hr`}
                  />
                  <StatCard
                    icon={<LayerIcon className="h-5 w-5" />}
                    label="Trip segments"
                    value={`${result.trip_segments.length}`}
                  />
                  <StatCard
                    icon={<LogIcon className="h-5 w-5" />}
                    label="Log sheets"
                    value={`${result.log_sheets.length}`}
                  />
                  <StatCard
                    icon={<PauseIcon className="h-5 w-5" />}
                    label="Break stops"
                    value={`${countStops(result.trip_segments, "30-min break")}`}
                  />
                  <StatCard
                    icon={<FuelIcon className="h-5 w-5" />}
                    label="Fuel stops"
                    value={`${countStops(result.trip_segments, "Fuel stop")}`}
                  />
                </div>

                <div className="grid gap-4">
                  <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-amber-300" />
                    <p className="text-sm font-semibold text-stone-100">Route map</p>
                  </div>
                  <TripRouteMap
                    polylineEncoded={result.route.polyline_encoded}
                    waypoints={result.route.waypoints}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
                  <div className="grid gap-4 rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2">
                      <SequenceIcon className="h-4 w-4 text-amber-300" />
                      <p className="text-sm font-semibold text-stone-100">Operational sequence</p>
                    </div>
                    <ol className="grid gap-3">
                      {result.trip_segments.slice(0, 6).map((segment, index) => (
                        <li
                          key={`${segment.start}-${segment.label}`}
                          className="grid gap-2 rounded-[1.25rem] border border-white/6 bg-black/10 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-300/14 text-xs font-semibold text-amber-200">
                                {index + 1}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-stone-50">{segment.label}</p>
                                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{segment.type}</p>
                              </div>
                            </div>
                            <p className="text-xs text-stone-400">{formatSegmentTime(segment.start)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm text-stone-300">
                            <span>{segment.location || "In transit"}</span>
                            <span>{segment.distance_miles.toFixed(2)} mi</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="grid gap-4 rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2">
                      <PinIcon className="h-4 w-4 text-amber-300" />
                      <p className="text-sm font-semibold text-stone-100">Route stops</p>
                    </div>
                    <div className="grid gap-3">
                      {result.route.waypoints.map((waypoint) => (
                        <div
                          key={`${waypoint.type}-${waypoint.label}`}
                          className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-stone-50">{waypoint.label}</p>
                            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{waypoint.type}</p>
                          </div>
                          <p className="text-xs text-stone-400">
                            {waypoint.lat.toFixed(3)}, {waypoint.lng.toFixed(3)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {primaryLogSheet ? (
                  <div className="grid gap-4 rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <GridIcon className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold text-stone-100">Daily log snapshot</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{primaryLogSheet.date}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(primaryLogSheet.totals).map(([status, hours]) => (
                        <StatCard
                          key={status}
                          icon={<ClockIcon className="h-5 w-5" />}
                          label={status.replaceAll("_", " ")}
                          value={`${hours.toFixed(2)} hr`}
                        />
                      ))}
                    </div>
                    <div className="grid gap-3 rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-4 sm:grid-cols-3">
                      <SummaryMetric label="Miles logged" value={`${primaryLogSheet.total_miles.toFixed(2)} mi`} />
                      <SummaryMetric label="24 hr check" value={`${primaryLogSheet.total_check.toFixed(2)} hr`} />
                      <SummaryMetric label="Remarks" value={`${primaryLogSheet.remarks.length}`} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid flex-1 gap-5 rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-300/10 text-amber-200">
                  <CompassIcon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-stone-50">Results appear here after submission</p>
                  <p className="mx-auto max-w-md text-sm leading-7 text-stone-400">
                    Review the route map, trip sequence, and early daily log summary here once the planner response is
                    available.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-stone-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 focus:ring-4 focus:ring-amber-200/60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function QuickNote({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-900/8 bg-stone-950 px-4 py-4 text-stone-100 shadow-[0_18px_45px_rgba(35,26,18,0.16)]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-300/12 text-amber-200">
        {icon}
      </div>
      <p className="text-sm font-semibold text-stone-50">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-300">{text}</p>
    </div>
  );
}

function HelperPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-stone-700 shadow-[inset_0_0_0_1px_rgba(91,74,52,0.08)]">
      <span className="text-stone-900">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/7 bg-white/[0.05] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">{label}</p>
        <span className="text-amber-200">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-stone-50">{value}</p>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="text-lg font-semibold text-stone-50">{value}</p>
    </div>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z" />
    </svg>
  );
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6h3a4 4 0 0 1 4 4v4" />
      <path d="M12 14h4" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.8 2" />
    </svg>
  );
}

function LogIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 4h8l3 3v13H7z" />
      <path d="M15 4v4h4" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3 6.5 5v5.2c0 3.7 2.2 7 5.5 8.8 3.3-1.8 5.5-5.1 5.5-8.8V5z" />
      <path d="m9.5 11.8 1.7 1.7 3.3-3.7" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function LayerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

function FuelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6a2 2 0 0 1 2-2h5v16H8a2 2 0 0 1-2-2z" />
      <path d="M13 8h2.5a1.5 1.5 0 0 1 1.5 1.5V18a2 2 0 1 0 4 0v-6l-2-2" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function SequenceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 7h7" />
      <path d="m9 3 3 4-3 4" />
      <path d="M19 17h-7" />
      <path d="m15 13-3 4 3 4" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 20s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 4h16v16H4z" />
      <path d="M4 10h16M10 4v16M16 4v16" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 4a8 8 0 1 1-5.7 2.3" />
    </svg>
  );
}
