"use client";

import { FormEvent, startTransition, useState, useMemo } from "react";
import dynamic from "next/dynamic";

import { LogSheetRenderer } from "@/components/log-sheet-renderer";
import {
  buildPlanTripUrl,
  type PlanTripRequest,
  type PlanTripResponse,
  type TripSegment,
} from "@/lib/api";

// ─── Dynamic map import (SSR disabled) ────────────────────────────────────────

const TripRouteMap = dynamic(
  () => import("@/components/trip-route-map").then((m) => m.TripRouteMap),
  {
    ssr: false,
    loading: () => (
      <MapPlaceholder>
        <Spinner size={20} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
          Loading map…
        </span>
      </MapPlaceholder>
    ),
  }
);

// ─── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  current_location: string;
  pickup_location:  string;
  dropoff_location: string;
  cycle_used_hours: string;
  departure_date:   string;
  departure_time:   string;
};

type ResultTab = "map" | "sequence" | "stops" | "logs";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRIVING:             { color: "#D97706", label: "Driving" },
  ON_DUTY_NOT_DRIVING: { color: "#0E7490", label: "On Duty" },
  OFF_DUTY:            { color: "#374B6E", label: "Off Duty" },
  SLEEPER_BERTH:       { color: "#5B21B6", label: "Sleeper" },
};

const WAYPOINT_COLORS: Record<string, string> = {
  current: "#F5A623",
  pickup:  "#22C55E",
  dropoff: "#EF4444",
  fuel:    "#FB923C",
  rest:    "#6B7A9B",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toPayload(f: FormState): PlanTripRequest {
  return {
    current_location: f.current_location.trim(),
    pickup_location:  f.pickup_location.trim(),
    dropoff_location: f.dropoff_location.trim(),
    cycle_used_hours: Number(f.cycle_used_hours),
    departure_datetime: `${f.departure_date}T${f.departure_time}:00`,
  };
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed.";
  const e = (payload as { error?: { message?: unknown } }).error;
  if (typeof e?.message === "string") return e.message;
  if (e?.message) return JSON.stringify(e.message);
  return "Request failed.";
}

function totalTripWindow(segs: TripSegment[]): string {
  if (!segs.length) return "—";
  const ms = new Date(segs.at(-1)!.end).getTime() - new Date(segs[0].start).getTime();
  const h = ms / 3600000;
  const days = Math.floor(h / 24);
  const rem = (h % 24).toFixed(1);
  return days > 0 ? `${days}d ${rem}h` : `${rem}h`;
}

function fmtSegTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function countByLabel(segs: TripSegment[], label: string): number {
  return segs.filter((s) => s.label === label).length;
}

// ─── Main shell ───────────────────────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  current_location: "Chicago, IL",
  pickup_location:  "Indianapolis, IN",
  dropoff_location: "Nashville, TN",
  cycle_used_hours: "0",
  departure_date:   "2024-04-26",
  departure_time:   "06:00",
};

export function TripPlannerShell() {
  const [form, setForm]           = useState<FormState>(INITIAL_FORM);
  const [result, setResult]       = useState<PlanTripResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("map");

  // Validate before submit
  const isValid = useMemo(() => {
    const hrs = Number(form.cycle_used_hours);
    return (
      form.current_location.trim().length > 0 &&
      form.pickup_location.trim().length > 0 &&
      form.dropoff_location.trim().length > 0 &&
      hrs >= 0 && hrs < 70 &&
      form.departure_date.length > 0 &&
      form.departure_time.length > 0
    );
  }, [form]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(buildPlanTripUrl("compact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const data = (await res.json()) as PlanTripResponse | { error?: unknown };
      if (!res.ok) {
        setResult(null);
        setError(errorMessage(data));
        return;
      }
      startTransition(() => {
        setResult(data as PlanTripResponse);
        setActiveTab("map");
      });
    } catch {
      setResult(null);
      setError("Could not reach the backend API.");
    } finally {
      setLoading(false);
    }
  }

  function field(id: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [id]: value }));
  }

  const segs  = result?.trip_segments ?? [];
  const logs  = result?.log_sheets    ?? [];
  const route = result?.route;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-primary)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--border-mid)",
          background: "rgba(13,18,24,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "0 24px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Logo mark */}
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "var(--amber)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12 L8 4 L14 12" stroke="#0D1117" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 12 L11 12" stroke="#0D1117" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              HOS Trip Planner
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              FMCSA 49 CFR Part 395
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusPill color="var(--amber)" label="70-hr / 8-day" />
          <StatusPill color="#22C55E" label="Property Carrier" />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          height: "calc(100vh - 52px)",
          overflow: "hidden",
        }}
      >

        {/* ══ LEFT — Form panel ══════════════════════════════════════════════ */}
        <aside
          style={{
            borderRight: "1px solid var(--border-mid)",
            background: "var(--surface-1)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "20px 20px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--amber)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              New Trip Request
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              Plan Your Route
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "6px",
                lineHeight: 1.5,
              }}
            >
              Enter trip details to generate an HOS-compliant schedule and driver log sheets.
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              flex: 1,
            }}
          >
            {/* Location section */}
            <FormSection label="Route Locations">
              <FormField
                id="current_location"
                label="Current Location"
                placeholder="e.g. Chicago, IL"
                value={form.current_location}
                onChange={(v) => field("current_location", v)}
                hint="Your starting position"
                icon={
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="6" cy="6" r="2.5"/>
                    <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                }
                iconColor="var(--amber)"
              />
              <FormField
                id="pickup_location"
                label="Pickup Location"
                placeholder="e.g. Indianapolis, IN"
                value={form.pickup_location}
                onChange={(v) => field("pickup_location", v)}
                hint="Where you collect the load"
                icon={
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1 L6 11 M3 8 L6 11 L9 8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                iconColor="#22C55E"
              />
              <FormField
                id="dropoff_location"
                label="Dropoff Location"
                placeholder="e.g. Nashville, TN"
                value={form.dropoff_location}
                onChange={(v) => field("dropoff_location", v)}
                hint="Final delivery point"
                icon={
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1 L9 4.5 L6 4.5 L6 8 M3 8 L6 11 L9 8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                iconColor="#EF4444"
              />
            </FormSection>

            {/* Schedule section */}
            <FormSection label="Schedule & Cycle">
              <FormField
                id="cycle_used_hours"
                label="Cycle Hours Used"
                placeholder="0"
                value={form.cycle_used_hours}
                onChange={(v) => field("cycle_used_hours", v)}
                type="number"
                min="0"
                max="69.9"
                step="0.5"
                hint="Hours used in current 70-hr / 8-day cycle"
                icon={
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="6" cy="6" r="4.5"/>
                    <path d="M6 3.5 L6 6 L8 7.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                iconColor="var(--cyan)"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <FormField
                  id="departure_date"
                  label="Departure Date"
                  value={form.departure_date}
                  onChange={(v) => field("departure_date", v)}
                  type="date"
                />
                <FormField
                  id="departure_time"
                  label="Departure Time"
                  value={form.departure_time}
                  onChange={(v) => field("departure_time", v)}
                  type="time"
                />
              </div>
            </FormSection>

            {/* HOS rules reminder */}
            <div
              style={{
                background: "var(--amber-dim)",
                border: "1px solid var(--border-amber)",
                borderRadius: "6px",
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
              }}
            >
              {[
                ["11-hr drive limit", "per shift"],
                ["14-hr duty window", "per shift"],
                ["30-min break", "after 8 hrs"],
                ["10-hr reset", "off-duty"],
                ["Fuel stop", "every 1,000 mi"],
                ["1-hr pickup/dropoff", "each end"],
              ].map(([rule, detail]) => (
                <div key={rule} style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "1px",
                      background: "var(--amber)",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--amber)", letterSpacing: "0.04em" }}>
                      {rule}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)", marginLeft: "4px" }}>
                      {detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "#FCA5A5",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isValid}
              style={{
                background: loading || !isValid ? "var(--surface-3)" : "var(--amber)",
                color: loading || !isValid ? "var(--text-muted)" : "#0D1117",
                border: "none",
                borderRadius: "6px",
                padding: "12px 20px",
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: loading || !isValid ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 160ms ease, transform 100ms ease",
                marginTop: "auto",
              }}
              onMouseDown={(e) => { if (!loading && isValid) (e.currentTarget.style.transform = "scale(0.98)"); }}
              onMouseUp={(e) => { (e.currentTarget.style.transform = "scale(1)"); }}
            >
              {loading ? (
                <>
                  <Spinner size={14} />
                  Calculating Route…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8 L14 8 M9 3 L14 8 L9 13"/>
                  </svg>
                  Plan Trip
                </>
              )}
            </button>
          </form>
        </aside>

        {/* ══ RIGHT — Results panel ══════════════════════════════════════════ */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            background: "var(--bg)",
          }}
        >
          {!result ? (
            /* ── Empty state ── */
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                padding: "40px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-mid)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="14" cy="14" r="11"/>
                  <path d="M14 9 L14 14 L18 16"/>
                  <path d="M7 20 L4 23"/>
                  <path d="M21 20 L24 23"/>
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-primary)",
                    marginBottom: "6px",
                  }}
                >
                  Ready for Dispatch
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    maxWidth: "340px",
                    lineHeight: 1.6,
                  }}
                >
                  Enter your route on the left and click Plan Trip to generate an HOS-compliant schedule, route map, and FMCSA driver log sheets.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  maxWidth: "420px",
                  width: "100%",
                  marginTop: "8px",
                }}
              >
                {[
                  { icon: "🗺️", label: "Route map with stops" },
                  { icon: "📋", label: "FMCSA log sheets" },
                  { icon: "⏱️", label: "HOS-compliant schedule" },
                ].map(({ icon, label }) => (
                  <div
                    key={label}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{icon}</div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── Stats strip ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  borderBottom: "1px solid var(--border-mid)",
                  background: "var(--surface-1)",
                  flexShrink: 0,
                }}
              >
                {[
                  { label: "Distance",     value: `${route!.total_distance_miles.toFixed(1)} mi` },
                  { label: "Drive Time",   value: `${route!.total_duration_hours.toFixed(1)} hr` },
                  { label: "Trip Window",  value: totalTripWindow(segs) },
                  { label: "Segments",     value: `${segs.length}` },
                  { label: "Break Stops",  value: `${countByLabel(segs, "30-min break")}` },
                  { label: "Fuel Stops",   value: `${countByLabel(segs, "Fuel stop")}` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      padding: "10px 14px",
                      borderRight: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        color: "var(--text-muted)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        marginBottom: "3px",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Tab bar ── */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border-mid)",
                  background: "var(--surface-1)",
                  flexShrink: 0,
                  overflowX: "auto",
                }}
              >
                {(
                  [
                    { id: "map",      label: "Route Map",       count: null },
                    { id: "sequence", label: "Sequence",         count: segs.length },
                    { id: "stops",    label: "Stops",            count: route!.waypoints.length },
                    { id: "logs",     label: "Daily Logs",       count: logs.length },
                  ] as { id: ResultTab; label: string; count: number | null }[]
                ).map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "11px 18px",
                      background: "transparent",
                      border: "none",
                      borderBottom: activeTab === id ? "2px solid var(--amber)" : "2px solid transparent",
                      color: activeTab === id ? "var(--amber)" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                      transition: "color 160ms ease",
                    }}
                  >
                    {label}
                    {count !== null && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          background: activeTab === id ? "var(--amber-dim)" : "var(--surface-3)",
                          color: activeTab === id ? "var(--amber)" : "var(--text-muted)",
                          borderRadius: "3px",
                          padding: "1px 5px",
                          border: `1px solid ${activeTab === id ? "var(--border-amber)" : "var(--border)"}`,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab content ── */}
              <div style={{ flex: 1, overflow: "auto" }}>

                {/* MAP */}
                {activeTab === "map" && (
                  <div style={{ height: "100%", minHeight: "400px", position: "relative" }}>
                    <TripRouteMap
                      polylineEncoded={route!.polyline_encoded}
                      waypoints={route!.waypoints}
                    />
                    {/* Waypoint legend */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        left: "16px",
                        background: "rgba(13,18,24,0.92)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid var(--border-mid)",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                        zIndex: 500,
                      }}
                    >
                      {Object.entries(WAYPOINT_COLORS).map(([type, color]) => (
                        <div key={type} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                            {type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEQUENCE */}
                {activeTab === "sequence" && (
                  <div style={{ padding: "20px 24px" }}>
                    <SectionHeader
                      label="Operational Sequence"
                      desc="Duty-status flow from departure to delivery"
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
                      {segs.map((seg, i) => {
                        const cfg = STATUS_CONFIG[seg.type] ?? { color: "#374B6E", label: seg.type };
                        const dur = ((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / 3600000).toFixed(2);
                        return (
                          <div
                            key={i}
                            className="animate-fade-slide-up"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "28px 4px 1fr auto",
                              gap: "10px",
                              alignItems: "start",
                              padding: "8px 0",
                              animationDelay: `${i * 20}ms`,
                            }}
                          >
                            {/* Index */}
                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "10px",
                                color: "var(--text-dim)",
                                paddingTop: "2px",
                                textAlign: "right",
                              }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </div>

                            {/* Color bar */}
                            <div
                              style={{
                                borderRadius: "2px",
                                background: cfg.color,
                                alignSelf: "stretch",
                                minHeight: "32px",
                              }}
                            />

                            {/* Content */}
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                                <span
                                  style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {seg.label}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "9px",
                                    color: cfg.color,
                                    background: `${cfg.color}18`,
                                    border: `1px solid ${cfg.color}35`,
                                    borderRadius: "3px",
                                    padding: "1px 5px",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "14px" }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                                  {fmtSegTime(seg.start)}
                                </span>
                                {seg.location && (
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                                    📍 {seg.location}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Duration */}
                            <div style={{ textAlign: "right", paddingTop: "2px" }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                                {dur}
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>
                                {seg.distance_miles > 0 ? `${seg.distance_miles.toFixed(1)} mi` : "hr"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STOPS */}
                {activeTab === "stops" && (
                  <div style={{ padding: "20px 24px" }}>
                    <SectionHeader label="Route Stops" desc="Key waypoints along the planned route" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {route!.waypoints.map((wp, i) => {
                        const color = WAYPOINT_COLORS[wp.type] ?? "#6B7A9B";
                        return (
                          <div
                            key={i}
                            className="animate-fade-slide-up"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "32px 1fr auto",
                              gap: "12px",
                              alignItems: "center",
                              padding: "12px 14px",
                              background: "var(--surface-2)",
                              border: "1px solid var(--border)",
                              borderLeft: `3px solid ${color}`,
                              borderRadius: "6px",
                              animationDelay: `${i * 40}ms`,
                            }}
                          >
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background: `${color}20`,
                                border: `1px solid ${color}50`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                                color,
                                fontWeight: 500,
                              }}
                            >
                              {i + 1}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontFamily: "var(--font-display)",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color: "var(--text-primary)",
                                  marginBottom: "3px",
                                }}
                              >
                                {wp.label}
                              </div>
                              <div
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "10px",
                                  color,
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {wp.type}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                                {wp.lat.toFixed(4)}°N
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                                {Math.abs(wp.lng).toFixed(4)}°W
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* LOGS */}
                {activeTab === "logs" && (
                  <div style={{ padding: "20px 24px" }}>
                    <SectionHeader
                      label={`Driver Daily Logs — ${logs.length} sheet${logs.length === 1 ? "" : "s"}`}
                      desc="FMCSA-compliant 24-hour log sheets for each day of the trip"
                    />

                    {/* Legend */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginTop: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      {[
                        { status: "OFF_DUTY",            color: "#374B6E", label: "Off Duty" },
                        { status: "SLEEPER_BERTH",       color: "#5B21B6", label: "Sleeper Berth" },
                        { status: "DRIVING",             color: "#D97706", label: "Driving" },
                        { status: "ON_DUTY_NOT_DRIVING", color: "#0E7490", label: "On Duty (Not Driving)" },
                      ].map(({ color, label }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: color }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <LogSheetRenderer logSheets={logs} />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: "var(--text-muted)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          paddingBottom: "6px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function FormField({
  id, label, placeholder = "", value, onChange, type = "text",
  min, max, step, hint, icon, iconColor,
}: {
  id: string; label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; type?: string;
  min?: string; max?: string; step?: string;
  hint?: string; icon?: React.ReactNode; iconColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--text-secondary)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {icon && (
          <span style={{ color: iconColor, display: "flex", alignItems: "center" }}>
            {icon}
          </span>
        )}
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      {hint && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        background: `${color}12`,
        border: `1px solid ${color}30`,
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function SectionHeader({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ marginBottom: "4px" }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
        {desc}
      </div>
    </div>
  );
}

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: "400px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "var(--surface-1)",
      }}
    >
      {children}
    </div>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M8 1.5 A6.5 6.5 0 0 1 14.5 8"/>
    </svg>
  );
}