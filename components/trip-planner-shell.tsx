"use client";

import { FormEvent, startTransition, useState } from "react";

import { buildPlanTripUrl, getApiBaseUrl, type PlanTripRequest, type PlanTripResponse } from "@/lib/api";

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

function toRequestPayload(form: FormState): PlanTripRequest {
  return {
    current_location: form.current_location.trim(),
    pickup_location: form.pickup_location.trim(),
    dropoff_location: form.dropoff_location.trim(),
    cycle_used_hours: Number(form.cycle_used_hours),
    departure_datetime: `${form.departure_date}T${form.departure_time}:00`,
  };
}

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

function countStops(segments: PlanTripResponse["trip_segments"], label: string): number {
  return segments.filter((segment) => segment.label === label).length;
}

export function TripPlannerShell() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<PlanTripResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f2ead7_0%,#efe3c2_28%,#d7cab4_55%,#b8ad97_100%)] text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-5 py-8 lg:px-8">
        <header className="grid gap-6 rounded-[2rem] border border-stone-900/10 bg-stone-50/80 p-6 shadow-[0_20px_80px_rgba(54,43,28,0.14)] backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
              FMCSA Hours of Service Planner
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-stone-950 md:text-6xl">
              Plan the trip before the logbook becomes the problem.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-700 md:text-lg">
              Submit the current location, pickup, dropoff, cycle hours used, and departure time.
              This frontend targets the versioned backend contract at{" "}
              <span className="font-medium text-stone-950">{getApiBaseUrl()}</span>.
            </p>
          </div>

          <div className="grid gap-3 self-start rounded-[1.5rem] bg-stone-950 p-5 text-stone-100">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Phase 5 Scope</p>
            <div className="grid gap-2 text-sm text-stone-300">
              <p>Versioned API form submission</p>
              <p>Inline backend error handling</p>
              <p>Visible request loading state</p>
              <p>Compact response preview for route and logs</p>
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form
            onSubmit={handleSubmit}
            className="grid gap-5 rounded-[2rem] border border-stone-900/10 bg-stone-50/85 p-6 shadow-[0_24px_90px_rgba(54,43,28,0.12)] backdrop-blur"
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="current_location">
                Current location
              </label>
              <input
                id="current_location"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                value={form.current_location}
                onChange={(event) => setForm((current) => ({ ...current, current_location: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="pickup_location">
                Pickup location
              </label>
              <input
                id="pickup_location"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                value={form.pickup_location}
                onChange={(event) => setForm((current) => ({ ...current, pickup_location: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="dropoff_location">
                Dropoff location
              </label>
              <input
                id="dropoff_location"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                value={form.dropoff_location}
                onChange={(event) => setForm((current) => ({ ...current, dropoff_location: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="cycle_used_hours">
                  Cycle hours used
                </label>
                <input
                  id="cycle_used_hours"
                  type="number"
                  min="0"
                  max="70"
                  step="0.1"
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                  value={form.cycle_used_hours}
                  onChange={(event) => setForm((current) => ({ ...current, cycle_used_hours: event.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="departure_date">
                  Departure date
                </label>
                <input
                  id="departure_date"
                  type="date"
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                  value={form.departure_date}
                  onChange={(event) => setForm((current) => ({ ...current, departure_date: event.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-stone-700" htmlFor="departure_time">
                  Departure time
                </label>
                <input
                  id="departure_time"
                  type="time"
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-950"
                  value={form.departure_time}
                  onChange={(event) => setForm((current) => ({ ...current, departure_time: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-600">
                Requests are sent to the compact planner response by default.
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-full bg-stone-950 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                {isLoading ? "Planning trip..." : "Plan trip"}
              </button>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </form>

          <section className="grid gap-5 rounded-[2rem] border border-stone-900/10 bg-stone-950 p-6 text-stone-100 shadow-[0_24px_90px_rgba(54,43,28,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Response preview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Trip summary</h2>
              </div>
            </div>

            {result ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard label="Distance" value={`${result.route.total_distance_miles.toFixed(2)} mi`} />
                  <StatCard label="Drive time" value={`${result.route.total_duration_hours.toFixed(2)} hr`} />
                  <StatCard label="Trip segments" value={`${result.trip_segments.length}`} />
                  <StatCard label="Log sheets" value={`${result.log_sheets.length}`} />
                  <StatCard label="Break stops" value={`${countStops(result.trip_segments, "30-min break")}`} />
                  <StatCard label="Fuel stops" value={`${countStops(result.trip_segments, "Fuel stop")}`} />
                </div>

                <div className="grid gap-3 rounded-[1.5rem] bg-stone-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Sequence check</p>
                  <ol className="grid gap-2 text-sm text-stone-200">
                    {result.trip_segments.slice(0, 4).map((segment) => (
                      <li key={`${segment.start}-${segment.label}`} className="rounded-2xl border border-stone-800 px-3 py-2">
                        <span className="font-medium text-stone-50">{segment.label}</span>
                        <span className="ml-2 text-stone-400">{segment.start}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-3 rounded-[1.5rem] bg-stone-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Waypoint types</p>
                  <div className="flex flex-wrap gap-2">
                    {result.route.waypoints.map((waypoint) => (
                      <span
                        key={`${waypoint.type}-${waypoint.label}`}
                        className="rounded-full border border-stone-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-200"
                      >
                        {waypoint.type}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center rounded-[1.5rem] border border-dashed border-stone-700 bg-stone-900/60 p-8 text-center text-sm leading-7 text-stone-400">
                Submit the trip form to confirm the frontend is reaching the backend and handling the compact planner response cleanly.
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-800 bg-stone-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-stone-50">{value}</p>
    </div>
  );
}
