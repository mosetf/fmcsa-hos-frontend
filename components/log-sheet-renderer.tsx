"use client";

import type { LogSheet } from "@/lib/api";

const STATUS_ORDER = [
  "OFF_DUTY",
  "SLEEPER_BERTH",
  "DRIVING",
  "ON_DUTY_NOT_DRIVING",
] as const;

type Status = (typeof STATUS_ORDER)[number];

const STATUS_CONFIG: Record<Status, { label: string; shortLabel: string; color: string }> = {
  OFF_DUTY: { label: "1. Off Duty", shortLabel: "Off duty", color: "#2563EB" },
  SLEEPER_BERTH: { label: "2. Sleeper Berth", shortLabel: "Sleeper", color: "#7C3AED" },
  DRIVING: { label: "3. Driving", shortLabel: "Driving", color: "#EA580C" },
  ON_DUTY_NOT_DRIVING: { label: "4. On Duty (not driving)", shortLabel: "On duty", color: "#047857" },
};

const HOUR_LABELS = [
  "Mid-\nnight",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "Noon",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "Mid-\nnight",
];

const SVG_W = 1040;
const SVG_H = 820;
const PAGE_PAD = 34;
const LABEL_W = 104;
const TOTAL_W = 58;
const GRID_X = PAGE_PAD + LABEL_W;
const GRID_Y = 230;
const GRID_W = SVG_W - PAGE_PAD * 2 - LABEL_W - TOTAL_W;
const HEADER_H = 34;
const ROW_H = 39;
const GRID_BODY_H = ROW_H * STATUS_ORDER.length;
const GRID_TOTAL_H = HEADER_H + GRID_BODY_H;
const HOUR_W = GRID_W / 24;

export type LogSheetMeta = {
  driver_name: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  co_driver: string;
  shipping_doc: string;
};

type TraceSegment = {
  status: Status;
  start_hour: number;
  end_hour: number;
};

type LogSheetRendererProps = {
  logSheets: LogSheet[];
  logMeta: LogSheetMeta;
  routeFrom: string;
  routeTo: string;
};

export function LogSheetRenderer({ logSheets, logMeta, routeFrom, routeTo }: LogSheetRendererProps) {
  if (!logSheets.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {logSheets.map((sheet, sheetIdx) => (
        <LogSheetPage
          key={`${sheet.date}-${sheetIdx}`}
          sheet={sheet}
          sheetIndex={sheetIdx}
          logMeta={logMeta}
          routeFrom={routeFrom}
          routeTo={routeTo}
        />
      ))}
    </div>
  );
}

function LogSheetPage({
  sheet,
  sheetIndex,
  logMeta,
  routeFrom,
  routeTo,
}: {
  sheet: LogSheet;
  sheetIndex: number;
  logMeta: LogSheetMeta;
  routeFrom: string;
  routeTo: string;
}) {
  const totals = sheet.totals as Record<string, number>;
  const [year = "", month = "", day = ""] = sheet.date.split("-");
  const recapHoursLeft = Math.max(0, 70 - sumStatusTotals(totals));

  return (
    <article
      className="animate-fade-slide-up"
      style={{
        background: "#f4f7fb",
        border: "1px solid var(--border-mid)",
        borderRadius: "8px",
        padding: "14px",
        overflowX: "auto",
        animationDelay: `${sheetIndex * 80}ms`,
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{
          display: "block",
          minWidth: "880px",
          background: "#fff",
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.14)",
        }}
        role="img"
        aria-label={`Driver daily log sheet for ${sheet.date}`}
      >
        <rect width={SVG_W} height={SVG_H} fill="#fff" />
        <Header month={month} day={day} year={year} sheet={sheet} logMeta={logMeta} routeFrom={routeFrom} routeTo={routeTo} />
        <DutyGrid sheet={sheet} totals={totals} />
        <Remarks sheet={sheet} logMeta={logMeta} />
        <Recap totalMiles={sheet.total_miles} recapHoursLeft={recapHoursLeft} />
      </svg>
    </article>
  );
}

function Header({
  month,
  day,
  year,
  sheet,
  logMeta,
  routeFrom,
  routeTo,
}: {
  month: string;
  day: string;
  year: string;
  sheet: LogSheet;
  logMeta: LogSheetMeta;
  routeFrom: string;
  routeTo: string;
}) {
  return (
    <g>
      <text x={PAGE_PAD} y={36} fontFamily="Arial, sans-serif" fontSize={27} fontWeight={700} fill="#050505">
        Drivers Daily Log
      </text>
      <text x={PAGE_PAD + 116} y={56} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        (24 hours)
      </text>

      <HeaderLine label="From:" x={120} y={84} width={340} value={routeFrom} />
      <HeaderLine label="To:" x={516} y={84} width={350} value={routeTo} />

      <text x={348} y={32} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
        {month}
      </text>
      <text x={444} y={32} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
        {day}
      </text>
      <text x={546} y={32} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
        {year}
      </text>
      <line x1={318} y1={38} x2={386} y2={38} stroke="#050505" strokeWidth={1.5} />
      <line x1={414} y1={38} x2={482} y2={38} stroke="#050505" strokeWidth={1.5} />
      <line x1={514} y1={38} x2={586} y2={38} stroke="#050505" strokeWidth={1.5} />
      <text x={328} y={51} fontFamily="Arial, sans-serif" fontSize={8} fill="#050505">
        (month)
      </text>
      <text x={430} y={51} fontFamily="Arial, sans-serif" fontSize={8} fill="#050505">
        (day)
      </text>
      <text x={530} y={51} fontFamily="Arial, sans-serif" fontSize={8} fill="#050505">
        (year)
      </text>

      <text x={674} y={28} fontFamily="Arial, sans-serif" fontSize={9} fontWeight={700} fill="#050505">
        Original - File at home terminal.
      </text>
      <text x={674} y={43} fontFamily="Arial, sans-serif" fontSize={9} fill="#050505">
        Duplicate - Driver retains in his/her possession for 8 days.
      </text>

      <SmallBox x={104} y={118} w={174} label="Total Miles Driving Today" value={sheet.total_miles.toFixed(1)} />
      <SmallBox x={296} y={118} w={174} label="Total Mileage Today" value={sheet.total_miles.toFixed(1)} />
      <SmallBox
        x={104}
        y={160}
        w={364}
        label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)"
        value={`Truck ${logMeta.truck_number} / Trailer ${logMeta.trailer_number}`}
      />

      <HeaderLine label="Driver Name" x={674} y={68} width={258} center value={logMeta.driver_name} />
      <HeaderLine label="Name of Carrier or Carriers" x={502} y={130} width={430} center value={logMeta.carrier_name} />
      <HeaderLine label="Co-driver Name" x={502} y={170} width={430} center value={logMeta.co_driver} />
      <HeaderLine label="Home Terminal Address" x={502} y={206} width={430} center value="N/A" />
    </g>
  );
}

function DutyGrid({ sheet, totals }: { sheet: LogSheet; totals: Record<string, number> }) {
  return (
    <g>
      <rect x={PAGE_PAD} y={GRID_Y} width={SVG_W - PAGE_PAD * 2} height={HEADER_H} fill="#050505" />
      <text x={PAGE_PAD + 12} y={GRID_Y + 13} fontFamily="Arial, sans-serif" fontSize={9} fill="#fff">
        Mid-
      </text>
      <text x={PAGE_PAD + 12} y={GRID_Y + 25} fontFamily="Arial, sans-serif" fontSize={9} fill="#fff">
        night
      </text>
      <text x={SVG_W - PAGE_PAD - 44} y={GRID_Y + 13} fontFamily="Arial, sans-serif" fontSize={9} fill="#fff">
        Total
      </text>
      <text x={SVG_W - PAGE_PAD - 44} y={GRID_Y + 25} fontFamily="Arial, sans-serif" fontSize={9} fill="#fff">
        Hours
      </text>

      {HOUR_LABELS.map((label, index) => {
        const x = index === 24 ? GRID_X + GRID_W : GRID_X + index * HOUR_W + HOUR_W / 2;
        return (
          <text
            key={`${label}-${index}`}
            x={x}
            y={GRID_Y + (label.includes("\n") ? 12 : 22)}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={index === 0 || index === 12 || index === 24 ? 8 : 10}
            fontWeight={index === 12 ? 700 : 400}
            fill="#fff"
          >
            {label.split("\n").map((part, partIndex) => (
              <tspan key={part} x={x} dy={partIndex === 0 ? 0 : 10}>
                {part}
              </tspan>
            ))}
          </text>
        );
      })}

      <rect x={PAGE_PAD} y={GRID_Y + HEADER_H} width={SVG_W - PAGE_PAD * 2} height={GRID_BODY_H} fill="#fff" stroke="#050505" strokeWidth={1.3} />
      <line x1={GRID_X} y1={GRID_Y} x2={GRID_X} y2={GRID_Y + GRID_TOTAL_H} stroke="#050505" strokeWidth={1.4} />
      <line x1={GRID_X + GRID_W} y1={GRID_Y} x2={GRID_X + GRID_W} y2={GRID_Y + GRID_TOTAL_H} stroke="#050505" strokeWidth={1.4} />

      {STATUS_ORDER.map((status, index) => {
        const y = GRID_Y + HEADER_H + index * ROW_H;
        const centerY = y + ROW_H / 2;
        const total = totals[status] || 0;
        return (
          <g key={status}>
            <line x1={PAGE_PAD} y1={y} x2={SVG_W - PAGE_PAD} y2={y} stroke="#1F2937" strokeWidth={0.9} />
            <text x={PAGE_PAD + 10} y={centerY - 3} fontFamily="Arial, sans-serif" fontSize={12} fontWeight={700} fill="#050505">
              {STATUS_CONFIG[status].label}
            </text>
            <line x1={GRID_X} y1={centerY} x2={GRID_X + GRID_W} y2={centerY} stroke="#94A3B8" strokeWidth={0.8} />
            <text x={GRID_X + GRID_W + TOTAL_W / 2} y={centerY + 4} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={13} fill="#050505">
              {total > 0 ? total.toFixed(2) : ""}
            </text>
          </g>
        );
      })}
      <line x1={PAGE_PAD} y1={GRID_Y + HEADER_H + GRID_BODY_H} x2={SVG_W - PAGE_PAD} y2={GRID_Y + HEADER_H + GRID_BODY_H} stroke="#050505" strokeWidth={1.4} />

      {Array.from({ length: 97 }, (_, tick) => {
        const x = GRID_X + (tick / 96) * GRID_W;
        const hour = tick % 4 === 0;
        const half = tick % 2 === 0;
        return (
          <line
            key={tick}
            x1={x}
            y1={GRID_Y + HEADER_H}
            x2={x}
            y2={GRID_Y + HEADER_H + GRID_BODY_H}
            stroke="#64748B"
            strokeWidth={hour ? 1.1 : 0.55}
            opacity={hour ? 1 : 0.65}
            strokeDasharray={hour ? undefined : half ? "2 4" : "1 5"}
          />
        );
      })}

      <ContinuousTrace sheet={sheet} />
    </g>
  );
}

function ContinuousTrace({ sheet }: { sheet: LogSheet }) {
  const trace = buildContinuousTrace(sheet);

  return (
    <g>
      {trace.map((segment, index) => {
        const x1 = hourToX(segment.start_hour);
        const x2 = hourToX(segment.end_hour);
        const y = statusCenterY(segment.status);
        const next = trace[index + 1];
        const color = STATUS_CONFIG[segment.status].color;

        return (
          <g key={`${segment.status}-${segment.start_hour}-${index}`}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={5.5} strokeLinecap="butt" />
            {next ? (
              <line
                x1={x2}
                y1={y}
                x2={hourToX(next.start_hour)}
                y2={statusCenterY(next.status)}
                stroke={STATUS_CONFIG[next.status].color}
                strokeWidth={3.5}
                strokeLinecap="square"
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function Remarks({ sheet, logMeta }: { sheet: LogSheet; logMeta: LogSheetMeta }) {
  const baseY = 430;
  return (
    <g>
      <text x={PAGE_PAD} y={baseY} fontFamily="Arial, sans-serif" fontSize={16} fontWeight={700} fill="#050505">
        Remarks
      </text>
      <rect x={PAGE_PAD} y={baseY + 16} width={SVG_W - PAGE_PAD * 2} height={150} fill="#fff" stroke="#050505" strokeWidth={2} />
      <line x1={PAGE_PAD + 330} y1={baseY + 16} x2={PAGE_PAD + 330} y2={baseY + 166} stroke="#050505" strokeWidth={1} />
      <text x={PAGE_PAD + 10} y={baseY + 58} fontFamily="Arial, sans-serif" fontSize={12} fontWeight={700} fill="#050505">
        Shipping
      </text>
      <text x={PAGE_PAD + 10} y={baseY + 73} fontFamily="Arial, sans-serif" fontSize={12} fontWeight={700} fill="#050505">
        Documents:
      </text>
      <text x={PAGE_PAD + 110} y={baseY + 73} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
        {truncate(logMeta.shipping_doc, 28)}
      </text>
      <line x1={PAGE_PAD} y1={baseY + 96} x2={PAGE_PAD + 330} y2={baseY + 96} stroke="#050505" strokeWidth={1} />
      <text x={PAGE_PAD + 10} y={baseY + 114} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        DVIR or Manifest No.
      </text>
      <text x={PAGE_PAD + 142} y={baseY + 114} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        {truncate(logMeta.shipping_doc, 24)}
      </text>
      <text x={PAGE_PAD + 10} y={baseY + 128} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        or
      </text>
      <line x1={PAGE_PAD} y1={baseY + 140} x2={PAGE_PAD + 330} y2={baseY + 140} stroke="#050505" strokeWidth={1} />
      <text x={PAGE_PAD + 10} y={baseY + 158} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        Shipper & Commodity
      </text>
      <text x={PAGE_PAD + 138} y={baseY + 158} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        {truncate(logMeta.carrier_name, 28)}
      </text>

      <text x={PAGE_PAD + 350} y={baseY + 39} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        Enter name of place you reported and where released from work and when each change of duty occurred.
      </text>
      <text x={PAGE_PAD + 350} y={baseY + 54} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        Use time standard of home terminal.
      </text>

      {sheet.remarks.slice(0, 6).map((remark, index) => (
        <text key={`${remark.time}-${index}`} x={PAGE_PAD + 350} y={baseY + 78 + index * 15} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
          {formatTime(remark.time)} - {statusLabel(remark.status)} - {remark.label}
          {remark.location ? `, ${remark.location}` : ""}
        </text>
      ))}
    </g>
  );
}

function Recap({ totalMiles, recapHoursLeft }: { totalMiles: number; recapHoursLeft: number }) {
  const y = 642;
  return (
    <g>
      <line x1={PAGE_PAD} y1={y - 16} x2={SVG_W - PAGE_PAD} y2={y - 16} stroke="#050505" strokeWidth={2} />
      <text x={PAGE_PAD} y={y} fontFamily="Arial, sans-serif" fontSize={11} fontWeight={700} fill="#050505">
        Recap:
      </text>
      <text x={PAGE_PAD} y={y + 15} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        Complete at
      </text>
      <text x={PAGE_PAD} y={y + 30} fontFamily="Arial, sans-serif" fontSize={10} fill="#050505">
        end of day.
      </text>
      <text x={PAGE_PAD + 180} y={y} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        Total miles driving today:
      </text>
      <text x={PAGE_PAD + 350} y={y} fontFamily="Arial, sans-serif" fontSize={12} fontWeight={700} fill="#050505">
        {totalMiles.toFixed(1)}
      </text>
      <text x={PAGE_PAD + 180} y={y + 26} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        70 Hour / 8 Day Drivers
      </text>
      <RecapColumn x={PAGE_PAD + 180} y={y + 44} letter="A." title="Total hours on duty last 7 days including today." />
      <RecapColumn x={PAGE_PAD + 330} y={y + 44} letter="B." title="Total hours available tomorrow 70 hr. minus A." />
      <RecapColumn x={PAGE_PAD + 490} y={y + 44} letter="C." title="Total hours on duty last 8 days including today." />
      <text x={PAGE_PAD + 700} y={y + 26} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        60 Hour / 7 Day Drivers
      </text>
      <RecapColumn x={PAGE_PAD + 700} y={y + 44} letter="A." title="Total hours on duty last 6 days including today." />
      <text x={PAGE_PAD + 880} y={y + 44} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        70/8 available
      </text>
      <text x={PAGE_PAD + 900} y={y + 72} fontFamily="Arial, sans-serif" fontSize={18} fontWeight={700} fill="#050505">
        {recapHoursLeft.toFixed(1)}
      </text>
      <line x1={PAGE_PAD} y1={SVG_H - 24} x2={SVG_W - PAGE_PAD} y2={SVG_H - 24} stroke="#050505" strokeWidth={3} />
    </g>
  );
}

function HeaderLine({
  label,
  x,
  y,
  width,
  center = false,
  value = "",
}: {
  label: string;
  x: number;
  y: number;
  width: number;
  center?: boolean;
  value?: string;
}) {
  return (
    <g>
      <text x={x - 52} y={y - 2} fontFamily="Arial, sans-serif" fontSize={11} fontWeight={700} fill="#050505">
        {!center ? label : ""}
      </text>
      {value ? (
        <text x={x + 8} y={y - 5} fontFamily="Arial, sans-serif" fontSize={11} fill="#050505">
          {truncate(value, Math.max(18, Math.floor(width / 8)))}
        </text>
      ) : null}
      <line x1={x} y1={y} x2={x + width} y2={y} stroke="#050505" strokeWidth={1.5} />
      {center ? (
        <text x={x + width / 2} y={y + 13} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={8} fill="#050505">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function SmallBox({ x, y, w, label, value = "" }: { x: number; y: number; w: number; label: string; value?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={36} fill="#fff" stroke="#050505" strokeWidth={1.5} />
      {value ? (
        <text x={x + w / 2} y={y + 23} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={12} fill="#050505">
          {truncate(value, Math.max(12, Math.floor(w / 8)))}
        </text>
      ) : null}
      <text x={x + w / 2} y={y + 47} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={8} fontWeight={700} fill="#050505">
        {label}
      </text>
    </g>
  );
}

function RecapColumn({ x, y, letter, title }: { x: number; y: number; letter: string; title: string }) {
  return (
    <g>
      <text x={x} y={y} fontFamily="Arial, sans-serif" fontSize={10} fontWeight={700} fill="#050505">
        {letter}
      </text>
      <line x1={x + 20} y1={y + 4} x2={x + 92} y2={y + 4} stroke="#050505" strokeWidth={1} />
      <foreignObject x={x} y={y + 10} width={124} height={76}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "9px", lineHeight: 1.15, color: "#050505" }}>{title}</div>
      </foreignObject>
    </g>
  );
}

function hourToX(hour: number): number {
  return GRID_X + (Math.max(0, Math.min(24, hour)) / 24) * GRID_W;
}

function statusCenterY(status: Status): number {
  const rowIndex = STATUS_ORDER.indexOf(status);
  return GRID_Y + HEADER_H + rowIndex * ROW_H + ROW_H / 2;
}

function buildContinuousTrace(sheet: LogSheet): TraceSegment[] {
  const segments = STATUS_ORDER.flatMap((status) => {
    const row = sheet.grid.find((entry) => entry.status === status);
    return (row?.segments || []).map((segment) => ({
      status,
      start_hour: clampHour(segment.start_hour),
      end_hour: clampHour(segment.end_hour),
    }));
  })
    .filter((segment) => segment.end_hour > segment.start_hour)
    .sort((a, b) => a.start_hour - b.start_hour || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const continuous: TraceSegment[] = [];
  let cursor = 0;

  for (const segment of segments) {
    if (segment.start_hour > cursor) {
      continuous.push({ status: "OFF_DUTY", start_hour: cursor, end_hour: segment.start_hour });
    }

    const start = Math.max(segment.start_hour, cursor);
    if (segment.end_hour > start) {
      continuous.push({ ...segment, start_hour: start });
      cursor = segment.end_hour;
    }
  }

  if (cursor < 24) {
    continuous.push({ status: "OFF_DUTY", start_hour: cursor, end_hour: 24 });
  }

  return mergeAdjacentTrace(continuous);
}

function mergeAdjacentTrace(segments: TraceSegment[]): TraceSegment[] {
  const merged: TraceSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && previous.status === segment.status && Math.abs(previous.end_hour - segment.start_hour) < 0.001) {
      previous.end_hour = segment.end_hour;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function clampHour(hour: number): number {
  return Math.max(0, Math.min(24, hour));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function sumStatusTotals(totals: Record<string, number>): number {
  return STATUS_ORDER.reduce((sum, status) => sum + (totals[status] || 0), 0);
}

function statusLabel(status: string): string {
  return STATUS_CONFIG[status as Status]?.shortLabel ?? status.replaceAll("_", " ").toLowerCase();
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
