"use client";

import { FormEvent, startTransition, useState, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  CalendarClock,
  Clock3,
  FileText,
  Fuel,
  Gauge,
  LoaderCircle,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  ShieldCheck,
  TimerReset,
  Truck,
} from "lucide-react";

import { LogSheetRenderer } from "@/components/log-sheet-renderer";
import {
  buildPlanTripUrl,
  type PlanTripRequest,
  type PlanTripResponse,
  type TripSegment,
  type LogDetails,
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

export type LogMeta = {
  driver_name: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  co_driver: string;
  shipping_doc: string;
};

type ResultTab = "map" | "sequence" | "stops" | "logs";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRIVING:             { color: "#D97706", label: "Driving" },
  ON_DUTY_NOT_DRIVING: { color: "#047857", label: "On Duty" },
  OFF_DUTY:            { color: "#475569", label: "Off Duty" },
  SLEEPER_BERTH:       { color: "#2563EB", label: "Sleeper" },
};

const WAYPOINT_COLORS: Record<string, string> = {
  current: "#D97706",
  pickup:  "#047857",
  dropoff: "#DC2626",
  fuel:    "#EA580C",
  rest:    "#2563EB",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPayload(f: FormState, logMeta: LogMeta): PlanTripRequest {
  return {
    current_location: f.current_location.trim(),
    pickup_location:  f.pickup_location.trim(),
    dropoff_location: f.dropoff_location.trim(),
    cycle_used_hours: Number(f.cycle_used_hours),
    departure_datetime: `${f.departure_date}T${f.departure_time}:00`,
    driver_name: logMeta.driver_name.trim(),
    carrier_name: logMeta.carrier_name.trim(),
    truck_number: logMeta.truck_number.trim(),
    trailer_number: logMeta.trailer_number.trim(),
    co_driver: logMeta.co_driver.trim(),
    shipping_doc: logMeta.shipping_doc.trim(),
  };
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed.";
  const e = (payload as { error?: { code?: unknown; message?: unknown } }).error;
  if (e?.code === "GEOCODING_FAILED") {
    return "We could not find one of those locations. Try using a more specific format like 'Chicago, IL, USA' or 'Nairobi, Kenya'.";
  }
  if (e?.code === "ROUTING_FAILED") {
    return "We found the locations, but could not build a truck route between them. Check spelling, add country/state, or choose a nearby city or terminal.";
  }
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

const INITIAL_LOG_META: LogMeta = {
  driver_name: "",
  carrier_name: "",
  truck_number: "",
  trailer_number: "",
  co_driver: "",
  shipping_doc: "",
};

function createInitialForm(): FormState {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    current_location: "",
    pickup_location: "",
    dropoff_location: "",
    cycle_used_hours: "0",
    departure_date: `${yyyy}-${mm}-${dd}`,
    departure_time: now.toTimeString().slice(0, 5),
  };
}

export function TripPlannerShell() {
  const [form, setForm]           = useState<FormState>(() => createInitialForm());
  const [logMeta, setLogMeta]     = useState<LogMeta>(INITIAL_LOG_META);
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
        body: JSON.stringify(toPayload(form, logMeta)),
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

  function metaField(id: keyof LogMeta, value: string) {
    setLogMeta((f) => ({ ...f, [id]: value }));
  }

  const segs  = result?.trip_segments ?? [];
  const logs  = result?.log_sheets    ?? [];
  const route = result?.route;
  const logDetails: LogDetails = result?.log_details ?? {
    driver_name: logMeta.driver_name || "N/A",
    carrier_name: logMeta.carrier_name || "Trip Planner Co.",
    truck_number: logMeta.truck_number || "N/A",
    trailer_number: logMeta.trailer_number || "N/A",
    co_driver: logMeta.co_driver || "N/A",
    shipping_doc: logMeta.shipping_doc || "N/A",
  };

  return (
    <main
      className="planner-main"
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
          background: "rgba(248,250,252,0.92)",
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
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Truck size={17} color="#fff" strokeWidth={2.2} />
          </div>

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink)",
                lineHeight: 1,
              }}
            >
              HOS Trip Planner
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--muted)",
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
          <StatusPill color="var(--green)" label="70-hr / 8-day" icon={<ShieldCheck size={12} />} />
          <StatusPill color="var(--blue)" label="Property Carrier" icon={<Truck size={12} />} />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div
        className="planner-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          height: "calc(100vh - 52px)",
          overflow: "hidden",
        }}
      >

        {/* ══ LEFT — Form panel ══════════════════════════════════════════════ */}
        <aside
          className="planner-sidebar"
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
                color: "var(--green)",
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
                color: "var(--ink)",
                lineHeight: 1,
              }}
            >
              Plan Your Route
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--muted)",
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
                placeholder="Chicago, IL or Nairobi, Kenya"
                value={form.current_location}
                onChange={(v) => field("current_location", v)}
                hint="Recommended pattern: City, State/Region, Country for best routing reliability."
                icon={<LocateFixed size={13} />}
                iconColor="var(--gold)"
              />
              <FormField
                id="pickup_location"
                label="Pickup Location"
                placeholder="Austin, TX or Mombasa, Kenya"
                value={form.pickup_location}
                onChange={(v) => field("pickup_location", v)}
                hint="Free text is allowed; include state/region to avoid ambiguous geocoding."
                icon={<PackageCheck size={13} />}
                iconColor="var(--green)"
              />
              <FormField
                id="dropoff_location"
                label="Dropoff Location"
                placeholder="Springfield, IL or Kisumu, Kenya"
                value={form.dropoff_location}
                onChange={(v) => field("dropoff_location", v)}
                hint="Avoid ambiguous names like Springfield; use Springfield, IL."
                icon={<MapPin size={13} />}
                iconColor="var(--red)"
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
                icon={<Gauge size={13} />}
                iconColor="var(--blue)"
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

            <details
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: "12px",
                  fontFamily: "var(--font-display)",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FileText size={15} color="var(--green)" />
                Optional log details
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 12px 12px" }}>
                <FormField
                  id="driver_name"
                  label="Driver Name"
                  placeholder="N/A"
                  value={logMeta.driver_name}
                  onChange={(v) => metaField("driver_name", v)}
                  required={false}
                />
                <FormField
                  id="carrier_name"
                  label="Carrier Name"
                  placeholder="Trip Planner Co."
                  value={logMeta.carrier_name}
                  onChange={(v) => metaField("carrier_name", v)}
                  required={false}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <FormField
                    id="truck_number"
                    label="Truck Number"
                    placeholder="N/A"
                    value={logMeta.truck_number}
                    onChange={(v) => metaField("truck_number", v)}
                    required={false}
                  />
                  <FormField
                    id="trailer_number"
                    label="Trailer Number"
                    placeholder="N/A"
                    value={logMeta.trailer_number}
                    onChange={(v) => metaField("trailer_number", v)}
                    required={false}
                  />
                </div>
                <FormField
                  id="co_driver"
                  label="Co-driver Name"
                  placeholder="N/A"
                  value={logMeta.co_driver}
                  onChange={(v) => metaField("co_driver", v)}
                  required={false}
                />
                <FormField
                  id="shipping_doc"
                  label="Shipping Document Number"
                  placeholder="N/A"
                  value={logMeta.shipping_doc}
                  onChange={(v) => metaField("shipping_doc", v)}
                  required={false}
                />
              </div>
            </details>

            {/* HOS rules reminder */}
            <div
              style={{
                background: "var(--rule-bg)",
                border: "1px solid var(--rule-border)",
                borderRadius: "6px",
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
              }}
            >
              {[
                { rule: "11-hr drive limit", detail: "per shift", icon: <Truck size={12} /> },
                { rule: "14-hr duty window", detail: "per shift", icon: <Clock3 size={12} /> },
                { rule: "30-min break", detail: "after 8 hrs", icon: <TimerReset size={12} /> },
                { rule: "10-hr reset", detail: "off-duty", icon: <CalendarClock size={12} /> },
                { rule: "Fuel stop", detail: "every 1,000 mi", icon: <Fuel size={12} /> },
                { rule: "1-hr pickup/dropoff", detail: "each end", icon: <PackageCheck size={12} /> },
              ].map(({ rule, detail, icon }) => (
                <div key={rule} style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  <span style={{ color: "var(--green)", display: "flex", flexShrink: 0 }}>{icon}</span>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink)", letterSpacing: "0.04em" }}>
                      {rule}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--muted)", marginLeft: "4px" }}>
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
                background: loading || !isValid ? "var(--surface-3)" : "var(--ink)",
                color: loading || !isValid ? "var(--text-muted)" : "#FFFFFF",
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
                  <Navigation size={14} />
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
                <Route size={28} color="var(--muted)" strokeWidth={1.7} />
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
                  { icon: <Map size={20} />, label: "Route map with stops" },
                  { icon: <FileText size={20} />, label: "FMCSA log sheets" },
                  { icon: <ShieldCheck size={20} />, label: "HOS-compliant schedule" },
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
                    <div style={{ color: "var(--green)", marginBottom: "6px", display: "flex", justifyContent: "center" }}>{icon}</div>
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
                    { id: "map",      label: "Route Map",       count: null, icon: <Map size={14} /> },
                    { id: "sequence", label: "Sequence",         count: segs.length, icon: <Route size={14} /> },
                    { id: "stops",    label: "Stops",            count: route!.waypoints.length, icon: <MapPin size={14} /> },
                    { id: "logs",     label: "Daily Logs",       count: logs.length, icon: <FileText size={14} /> },
                  ] as { id: ResultTab; label: string; count: number | null; icon: ReactNode }[]
                ).map(({ id, label, count, icon }) => (
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
                      borderBottom: activeTab === id ? "2px solid var(--green)" : "2px solid transparent",
                      color: activeTab === id ? "var(--green)" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                      transition: "color 160ms ease",
                    }}
                  >
                    {icon}
                    {label}
                    {count !== null && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          background: activeTab === id ? "var(--green-dim)" : "var(--surface-3)",
                          color: activeTab === id ? "var(--green)" : "var(--text-muted)",
                          borderRadius: "3px",
                          padding: "1px 5px",
                          border: `1px solid ${activeTab === id ? "var(--border-green)" : "var(--border)"}`,
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
                      tripSegments={segs}
                    />
                    {/* Waypoint legend */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        left: "16px",
                        background: "rgba(255,255,255,0.94)",
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
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", textTransform: "capitalize" }}>
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
                                    <MapPin size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
                                    {seg.location}
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
                        { status: "OFF_DUTY",            color: "#475569", label: "Off Duty" },
                        { status: "SLEEPER_BERTH",       color: "#2563EB", label: "Sleeper Berth" },
                        { status: "DRIVING",             color: "#D97706", label: "Driving" },
                        { status: "ON_DUTY_NOT_DRIVING", color: "#047857", label: "On Duty (Not Driving)" },
                      ].map(({ color, label }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: color }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <LogSheetRenderer
                      logSheets={logs}
                      logMeta={logDetails}
                      routeFrom={form.current_location}
                      routeTo={form.dropoff_location}
                    />
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

function FormSection({ label, children }: { label: string; children: ReactNode }) {
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
  min, max, step, hint, icon, iconColor, required = true,
}: {
  id: string; label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; type?: string;
  min?: string; max?: string; step?: string;
  hint?: string; icon?: ReactNode; iconColor?: string; required?: boolean;
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
        required={required}
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

function StatusPill({ color, label, icon }: { color: string; label: string; icon: ReactNode }) {
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
      <span style={{ display: "flex", color }}>{icon}</span>
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

function MapPlaceholder({ children }: { children: ReactNode }) {
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
  return <LoaderCircle size={size} className="animate-spin" />;
}
