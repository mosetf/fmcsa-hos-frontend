"use client";

import type { LogSheet } from "@/lib/api";

const STATUS_ORDER = ["OFF_DUTY", "SLEEPER_BERTH", "DRIVING", "ON_DUTY_NOT_DRIVING"] as const;

const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  OFF_DUTY: "Off Duty",
  SLEEPER_BERTH: "Sleeper Berth",
  DRIVING: "Driving",
  ON_DUTY_NOT_DRIVING: "On Duty",
};

const STATUS_Y: Record<(typeof STATUS_ORDER)[number], number> = {
  OFF_DUTY: 18,
  SLEEPER_BERTH: 54,
  DRIVING: 90,
  ON_DUTY_NOT_DRIVING: 126,
};

type LogSheetRendererProps = {
  logSheets: LogSheet[];
};

/** Render one or more FMCSA-style daily logs using the structured backend grid output. */
export function LogSheetRenderer({ logSheets }: LogSheetRendererProps) {
  return (
    <div className="grid gap-6">
      {logSheets.map((logSheet) => (
        <article
          key={logSheet.date}
          className="grid gap-5 rounded-[1.7rem] border border-white/8 bg-[#17110d] p-4 sm:p-5 lg:p-6"
        >
          <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Driver daily log</p>
              <h3 className="text-lg font-semibold text-stone-50">{logSheet.date}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Miles logged" value={`${logSheet.total_miles.toFixed(2)} mi`} />
              <Metric label="24 hr check" value={`${logSheet.total_check.toFixed(2)} hr`} />
              <Metric label="Remarks" value={`${logSheet.remarks.length}`} />
            </div>
          </header>

          <div className="rounded-[1.4rem] border border-white/8 bg-[#120d09] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Duty status graph</p>
              <p className="text-xs text-stone-400">Scroll horizontally on smaller screens</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
              <div className="mb-2 grid grid-cols-[11rem_1fr] gap-4">
                <div />
                <div className="grid grid-cols-24 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="text-center">
                      {hour}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[11rem_1fr] gap-4">
                <div className="grid grid-rows-4 gap-2">
                  {STATUS_ORDER.map((status) => (
                    <div
                      key={status}
                      className="flex min-h-[2.25rem] items-center rounded-xl border border-white/6 bg-white/[0.03] px-3 text-sm font-medium text-stone-200"
                    >
                      {STATUS_LABELS[status]}
                    </div>
                  ))}
                </div>

                <svg
                  viewBox="0 0 960 144"
                  className="h-[10rem] w-full overflow-visible rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]"
                  role="img"
                  aria-label={`Driver log grid for ${logSheet.date}`}
                >
                  {Array.from({ length: 25 }, (_, index) => (
                    <line
                      key={`v-${index}`}
                      x1={index * 40}
                      y1="0"
                      x2={index * 40}
                      y2="144"
                      stroke={index === 0 || index === 24 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}
                      strokeWidth={index % 6 === 0 ? 1.5 : 1}
                    />
                  ))}
                  {Array.from({ length: 5 }, (_, index) => (
                    <line
                      key={`h-${index}`}
                      x1="0"
                      y1={index * 36}
                      x2="960"
                      y2={index * 36}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={1}
                    />
                  ))}
                  <path
                    d={buildDutyPath(logSheet)}
                    fill="none"
                    stroke="#f5a524"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STATUS_ORDER.map((status) => (
                <Metric
                  key={status}
                  label={STATUS_LABELS[status]}
                  value={`${(logSheet.totals[status] || 0).toFixed(2)} hr`}
                />
              ))}
            </div>

            <div className="grid gap-2 rounded-[1.2rem] border border-white/6 bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Chronological remarks</p>
              {logSheet.remarks.length > 0 ? (
                <ol className="grid gap-2">
                  {logSheet.remarks.slice(0, 8).map((remark) => (
                    <li
                      key={`${remark.time}-${remark.label}`}
                      className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-3 text-sm text-stone-200 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-100">{remark.label}</p>
                        <p className="break-all text-xs uppercase tracking-[0.18em] text-stone-500">{remark.status}</p>
                      </div>
                      <div className="text-xs text-stone-400 sm:text-right">
                        <p>{formatRemarkTime(remark.time)}</p>
                        <p className="break-words">{remark.location || "In transit"}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-stone-400">No remarks recorded for this day.</p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Convert the backend log grid into a connected SVG duty-status path. */
function buildDutyPath(logSheet: LogSheet): string {
  const segments = STATUS_ORDER.flatMap((status) => {
    const row = logSheet.grid.find((entry) => entry.status === status);
    return (row?.segments || []).map((segment) => ({
      status,
      startHour: segment.start_hour,
      endHour: segment.end_hour,
    }));
  }).sort((left, right) => left.startHour - right.startHour);

  if (segments.length === 0) {
    return "";
  }

  const commands: string[] = [];
  let previous: (typeof segments)[number] | null = null;

  for (const segment of segments) {
    const startX = hourToX(segment.startHour);
    const endX = hourToX(segment.endHour);
    const y = STATUS_Y[segment.status];

    if (!previous) {
      commands.push(`M ${startX} ${y}`);
    } else if (previous.status !== segment.status || previous.endHour !== segment.startHour) {
      commands.push(`L ${startX} ${STATUS_Y[previous.status]}`);
      commands.push(`L ${startX} ${y}`);
    }

    commands.push(`L ${endX} ${y}`);
    previous = segment;
  }

  return commands.join(" ");
}

/** Map log sheet hours to the SVG grid width with stable rounding. */
function hourToX(hour: number): number {
  return Math.round((hour / 24) * 960);
}

/** Format remark timestamps for compact display beside the log sheet. */
function formatRemarkTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Time unavailable";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/7 bg-white/[0.05] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-stone-50">{value}</p>
    </div>
  );
}
