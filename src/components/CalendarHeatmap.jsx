/**
 * CalendarHeatmap - GitHub-contributions-style calendar heatmap
 *
 * Usage:
 * <CalendarHeatmap
 *   data={[{ date: "2024-01-15", value: 7.5 }]}
 *   colorVar="var(--color-sleep)"
 *   label="Sleep Duration Calendar"
 *   unit="h"
 *   targetRange={[7, 9]}
 * />
 *
 * Props:
 *   data        - array of { date: "YYYY-MM-DD", value: number }
 *   colorVar    - CSS variable string, e.g. 'var(--color-hrv)'
 *   label       - chart title string
 *   unit        - value unit shown in tooltip, e.g. 'h' or ' steps'
 *   targetRange - optional [min, max]; values in range get full opacity,
 *                 outside range render slightly dimmer (no separate color)
 */

import { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return today's date as "YYYY-MM-DD" */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Add `n` days to a Date and return a new Date */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Format a Date as "YYYY-MM-DD" */
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Build the 52-week grid (Sunday=0 … Saturday=6 mapped to Mon-first display).
 * Returns an array of week arrays: weeks[wi][di] = { date: "YYYY-MM-DD", value: number|null }
 * Rows: 0=Mon … 6=Sun  (day-of-week in Mon-first convention)
 */
function buildGrid(dataMap, endDate) {
  // Align end to the most recent Saturday (so last column ends on Sunday in Mon-first)
  const end = new Date(endDate + 'T00:00:00');
  // day: 0=Sun … 6=Sat. We want the grid to end on a Sunday (Mon-first row=6).
  // Step end forward to the nearest coming Sunday.
  const endDow = end.getDay(); // 0=Sun
  const daysToSunday = endDow === 0 ? 0 : 7 - endDow;
  const gridEnd = addDays(end, daysToSunday);

  // Grid covers 52 full weeks (364 days) ending at gridEnd
  const gridStart = addDays(gridEnd, -(52 * 7 - 1));

  const weeks = [];
  let cursor = new Date(gridStart);

  for (let wi = 0; wi < 52; wi++) {
    const week = [];
    for (let di = 0; di < 7; di++) {
      const dateStr = toDateStr(cursor);
      week.push({
        date: dateStr,
        value: dataMap[dateStr] ?? null,
        // di=0 is Monday in Mon-first grid
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { weeks, gridStart, gridEnd };
}

/** Compute percentile-based opacity: maps value to [0.15, 0.90] */
function makeOpacityFn(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  return function getOpacity(value) {
    if (range === 0) return 0.55;
    const pct = (value - min) / range; // 0..1
    return 0.15 + pct * 0.75; // 0.15..0.90
  };
}

/** Derive month labels: for each week, record month if it just changed */
function buildMonthLabels(weeks) {
  const labels = new Array(weeks.length).fill(null);
  let lastMonth = null;
  weeks.forEach((week, wi) => {
    // Use the first cell (Monday) of each week to determine month label
    const month = week[0].date.slice(0, 7); // "YYYY-MM"
    if (month !== lastMonth) {
      const d = new Date(week[0].date + 'T00:00:00');
      labels[wi] = d.toLocaleString('default', { month: 'short' });
      lastMonth = month;
    }
  });
  return labels;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarHeatmap({
  data,
  colorVar = 'var(--color-hrv)',
  label,
  unit = '',
  // eslint-disable-next-line no-unused-vars
  targetRange,
}) {
  const [tooltip, setTooltip] = useState(null);

  const { weeks, monthLabels, getOpacity } = useMemo(() => {
    if (!data?.length) return { weeks: [], monthLabels: [], getOpacity: () => 0.15 };

    // Build date -> value map
    const dataMap = {};
    const values = [];
    for (const entry of data) {
      if (entry?.date && entry.value != null) {
        dataMap[entry.date] = entry.value;
        values.push(entry.value);
      }
    }

    const today = todayStr();
    const { weeks: w } = buildGrid(dataMap, today);
    const ml = buildMonthLabels(w);
    const opFn = values.length ? makeOpacityFn(values) : () => 0.15;

    return { weeks: w, monthLabels: ml, getOpacity: opFn };
  }, [data]);

  if (!data?.length) {
    return (
      <div className="chart-card" role="region" aria-label={label}>
        <div className="chart-card-header">
          <p className="chart-card-title">{label}</p>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No data</p>
      </div>
    );
  }

  const CELL = 11;
  const GAP = 2;
  const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];

  return (
    <div className="chart-card" role="region" aria-label={label}>
      <div className="chart-card-header">
        <p className="chart-card-title">{label}</p>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 0 }}>

          {/* Month labels row */}
          <div style={{ display: 'flex', marginLeft: CELL + 4 + 4, marginBottom: 4 }}>
            {monthLabels.map((ml, wi) => (
              <div
                key={wi}
                style={{
                  width: CELL,
                  marginRight: GAP,
                  fontSize: 9,
                  color: ml ? 'var(--text-muted)' : 'transparent',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {ml ?? ''}
              </div>
            ))}
          </div>

          {/* Main heatmap row: day labels + week columns */}
          <div style={{ display: 'flex', gap: 4 }}>

            {/* Day-of-week labels (Mon, Wed, Fri) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 0 }}>
              {DAY_LABELS.map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    height: CELL,
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {week.map((day, di) => {
                  const hasValue = day.value != null;
                  const opacity = hasValue ? getOpacity(day.value) : 0.15;

                  return (
                    <div
                      key={di}
                      role={hasValue ? 'button' : undefined}
                      tabIndex={hasValue ? 0 : undefined}
                      aria-label={hasValue ? `${day.date}: ${day.value}${unit}` : undefined}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 2,
                        background: hasValue ? colorVar : 'var(--bg-inset)',
                        opacity: hasValue ? opacity : 1,
                        cursor: hasValue ? 'pointer' : 'default',
                        flexShrink: 0,
                        transition: 'opacity 80ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (hasValue) {
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            date: day.date,
                            value: day.value,
                          });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (hasValue && tooltip) {
                          setTooltip((prev) =>
                            prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                          );
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(e) => {
                        if (hasValue) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            x: rect.left,
                            y: rect.top,
                            date: day.date,
                            value: day.value,
                          });
                        }
                      }}
                      onBlur={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Colour scale legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              marginLeft: CELL + 4 + 4,
            }}
          >
            <span style={{ fontSize: 9, color: 'var(--text-muted)', userSelect: 'none' }}>Less</span>
            <div
              style={{
                width: 60,
                height: 8,
                borderRadius: 3,
                background: `linear-gradient(to right, color-mix(in srgb, ${colorVar} 15%, var(--bg-inset)), ${colorVar})`,
                opacity: 0.85,
              }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', userSelect: 'none' }}>More</span>
          </div>

        </div>
      </div>

      {/* Tooltip — fixed position, follows cursor */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 36,
            background: 'var(--chart-tooltip-bg)',
            border: '1px solid var(--chart-tooltip-border)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-tooltip)',
          }}
        >
          {tooltip.date}: <strong>{typeof tooltip.value === 'number' ? tooltip.value.toLocaleString() : tooltip.value}{unit}</strong>
        </div>
      )}
    </div>
  );
}
