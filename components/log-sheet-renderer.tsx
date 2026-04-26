"use client";

import type { LogSheet } from "@/lib/api";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_ORDER = [
  "OFF_DUTY",
  "SLEEPER_BERTH",
  "DRIVING",
  "ON_DUTY_NOT_DRIVING",
] as const;

type Status = (typeof STATUS_ORDER)[number];

const STATUS_CONFIG: Record<Status, { label: string; color: string; textColor: string }> = {
  OFF_DUTY:            { label: "1. Off Duty",          color: "#374B6E", textColor: "#8A9AB8" },
  SLEEPER_BERTH:       { label: "2. Sleeper Berth",     color: "#5B21B6", textColor: "#C4B5FD" },
  DRIVING:             { label: "3. Driving",            color: "#D97706", textColor: "#FDE68A" },
  ON_DUTY_NOT_DRIVING: { label: "4. On Duty (Not Drv)", color: "#0E7490", textColor: "#A5F3FC" },
};

const HOUR_LABELS = [
  "Mid", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "Noon", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "Mid",
];

// ─── SVG grid constants ───────────────────────────────────────────────────────

const SVG_W        = 720;
const LABEL_W      = 132;
const TOTAL_W      = 52;
const GRID_W       = SVG_W - LABEL_W - TOTAL_W;   // 536
const HOUR_PX      = GRID_W / 24;
const ROW_H        = 30;
const HEADER_H     = 28;
const GRID_X       = LABEL_W;
const NUM_ROWS     = STATUS_ORDER.length;
const SVG_H        = HEADER_H + NUM_ROWS * ROW_H + 1;

function hourToX(hour: number): number {
  return GRID_X + (hour / 24) * GRID_W;
}

function rowY(index: number): number {
  return HEADER_H + index * ROW_H;
}

// ─── Component ────────────────────────────────────────────────────────────────

type LogSheetRendererProps = { logSheets: LogSheet[] };

export function LogSheetRenderer({ logSheets }: LogSheetRendererProps) {
  if (!logSheets.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {logSheets.map((sheet, sheetIdx) => (
        <LogSheetCard key={sheet.date} sheet={sheet} sheetIndex={sheetIdx} />
      ))}
    </div>
  );
}

function LogSheetCard({ sheet, sheetIndex }: { sheet: LogSheet; sheetIndex: number }) {
  const totals = sheet.totals as Record<string, number>;

  return (
    <article
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-mid)",
        borderRadius: "10px",
        overflow: "hidden",
        animationDelay: `${sheetIndex * 80}ms`,
      }}
      className="animate-fade-slide-up"
    >
      {/* ── Card header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "var(--amber-dim)",
              border: "1px solid var(--border-amber)",
              borderRadius: "4px",
              padding: "2px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--amber)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Sheet {sheetIndex + 1}
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {sheet.date}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <MetaBit label="Total Miles" value={`${sheet.total_miles.toFixed(1)} mi`} />
          <MetaBit
            label="24hr Check"
            value={`${sheet.total_check.toFixed(2)} hr`}
            highlight={Math.abs(sheet.total_check - 24) > 0.1}
          />
        </div>
      </div>

      {/* ── Grid section ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div
          style={{
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          U.S. Dept. of Transportation — Driver's Daily Log (24 Hours)
        </div>

        <div style={{ overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            style={{ display: "block", minWidth: "480px" }}
            role="img"
            aria-label={`FMCSA driver log grid for ${sheet.date}`}
          >
            {/* ── Background ── */}
            <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0D1218" />
            <rect x={GRID_X} y={0} width={GRID_W} height={SVG_H} fill="#0A0F18" />

            {/* ── Hour header labels ── */}
            {HOUR_LABELS.map((label, i) => (
              <text
                key={i}
                x={i < 24 ? hourToX(i) + HOUR_PX / 2 : hourToX(24)}
                y={HEADER_H - 7}
                textAnchor="middle"
                fontSize={i === 0 || i === 12 || i === 24 ? 7 : 8}
                fontFamily="var(--font-mono)"
                fill={i === 0 || i === 12 || i === 24 ? "#6B7A9B" : "#4A5572"}
                fontWeight={i === 12 ? "500" : "400"}
              >
                {label}
              </text>
            ))}

            {/* ── Vertical hour lines ── */}
            {Array.from({ length: 25 }, (_, i) => (
              <line
                key={`vline-${i}`}
                x1={hourToX(i)} y1={HEADER_H - 2}
                x2={hourToX(i)} y2={SVG_H}
                stroke={i === 0 || i === 12 || i === 24 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
                strokeWidth={i === 0 || i === 12 || i === 24 ? 1.5 : 1}
              />
            ))}

            {/* ── 15-min tick marks in header ── */}
            {Array.from({ length: 24 * 4 + 1 }, (_, i) => {
              const isHour = i % 4 === 0;
              if (isHour) return null;
              const x = GRID_X + (i / (24 * 4)) * GRID_W;
              return (
                <line
                  key={`tick-${i}`}
                  x1={x} y1={HEADER_H - 6}
                  x2={x} y2={HEADER_H - 2}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={0.75}
                />
              );
            })}

            {/* ── Status rows ── */}
            {STATUS_ORDER.map((status, rowIndex) => {
              const cfg = STATUS_CONFIG[status];
              const y = rowY(rowIndex);
              const rowData = sheet.grid.find((r) => r.status === status);
              const segs = rowData?.segments || [];

              return (
                <g key={status}>
                  {/* Row background (alternating) */}
                  <rect
                    x={0} y={y} width={SVG_W} height={ROW_H}
                    fill={rowIndex % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)"}
                  />

                  {/* Row top border */}
                  <line
                    x1={0} y1={y} x2={SVG_W} y2={y}
                    stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                  />

                  {/* Row label */}
                  <text
                    x={LABEL_W - 8} y={y + ROW_H / 2 + 1}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={8.5}
                    fontFamily="var(--font-mono)"
                    fill={cfg.textColor}
                    opacity={0.9}
                  >
                    {cfg.label}
                  </text>

                  {/* Duty status blocks */}
                  {segs.map((seg, segIdx) => {
                    const x1 = hourToX(seg.start_hour);
                    const x2 = hourToX(seg.end_hour);
                    const w = Math.max(0, x2 - x1);
                    const blockY = y + 6;
                    const blockH = ROW_H - 12;

                    return (
                      <g key={segIdx}>
                        {/* Filled block */}
                        <rect
                          x={x1} y={blockY}
                          width={w} height={blockH}
                          fill={cfg.color}
                          opacity={0.85}
                          rx={1}
                        />
                        {/* Top edge accent line */}
                        <line
                          x1={x1} y1={blockY}
                          x2={x2} y2={blockY}
                          stroke={cfg.textColor}
                          strokeWidth={1.5}
                          opacity={0.7}
                        />
                        {/* Vertical drop line from center of block at start */}
                        <line
                          x1={x1} y1={y + 2}
                          x2={x1} y2={y + ROW_H - 2}
                          stroke={cfg.textColor}
                          strokeWidth={1}
                          opacity={0.5}
                        />
                      </g>
                    );
                  })}

                  {/* Row total (right side) */}
                  <text
                    x={SVG_W - TOTAL_W / 2}
                    y={y + ROW_H / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                    fill={totals[status] > 0 ? cfg.textColor : "var(--text-dim)"}
                    fontWeight="500"
                  >
                    {(totals[status] || 0).toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* ── Total column header ── */}
            <rect x={SVG_W - TOTAL_W} y={0} width={TOTAL_W} height={SVG_H} fill="rgba(0,0,0,0.2)" />
            <line
              x1={SVG_W - TOTAL_W} y1={0}
              x2={SVG_W - TOTAL_W} y2={SVG_H}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
            <text
              x={SVG_W - TOTAL_W / 2}
              y={HEADER_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fontFamily="var(--font-mono)"
              fill="var(--text-muted)"
              letterSpacing={1}
            >
              HRS
            </text>

            {/* ── Bottom border ── */}
            <line
              x1={0} y1={SVG_H - 1}
              x2={SVG_W} y2={SVG_H - 1}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          </svg>
        </div>
      </div>

      {/* ── Totals strip ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          background: "var(--border)",
          borderTop: "1px solid var(--border-mid)",
          borderBottom: "1px solid var(--border)",
          margin: "0 0",
        }}
      >
        {STATUS_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const hours = totals[status] || 0;
          return (
            <div
              key={status}
              style={{
                background: "var(--surface-2)",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: cfg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "9px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cfg.label.replace(/^\d\.\s/, "")}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: hours > 0 ? cfg.textColor : "var(--text-dim)",
                  letterSpacing: "0.04em",
                }}
              >
                {hours.toFixed(2)}{" "}
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>hr</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Remarks section ── */}
      {sheet.remarks.length > 0 && (
        <div style={{ padding: "12px 16px" }}>
          <div
            style={{
              fontSize: "9px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Remarks — Location Changes
          </div>
          <div
            style={{
              display: "grid",
              gap: "2px",
              maxHeight: "160px",
              overflowY: "auto",
            }}
          >
            {sheet.remarks.map((remark, i) => {
              const status = remark.status as Status;
              const cfg = STATUS_CONFIG[status] ?? { color: "#374B6E", textColor: "#8A9AB8", label: remark.status };
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 120px 1fr",
                    gap: "8px",
                    alignItems: "center",
                    padding: "5px 8px",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {formatTime(remark.time)}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "9px",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: cfg.textColor,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "1px",
                        background: cfg.color,
                        flexShrink: 0,
                      }}
                    />
                    {cfg.label.replace(/^\d\.\s/, "")}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: remark.location ? "var(--text-secondary)" : "var(--text-dim)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {remark.label}
                    {remark.location ? (
                      <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                        — {remark.location}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function MetaBit({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontSize: "8px",
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          fontWeight: "500",
          color: highlight ? "#EF4444" : "var(--text-primary)",
          letterSpacing: "0.04em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    // If not a valid ISO date, treat as HH:MM string
    return value || "--:--";
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}