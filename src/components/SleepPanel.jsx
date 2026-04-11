/**
 * SleepPanel - Sleep analytics panel for the health dashboard
 *
 * Usage:
 * import sleepData from '../data/sleep.json';
 * <SleepPanel data={sleepData} />
 *
 * Expected data shape:
 * {
 *   nightly: [{ date, total, core, deep, rem, bedtime, wakeTime }],
 *   monthly: [{ month, avgTotal, avgDeep, avgREM, avgBedtime, count }],
 *   heatmap: [{ dow, hour, count }],
 *   stats: { avgTotal, avgDeep, avgREM, avgBedtime, below6hPct, below7hPct, above8hPct,
 *             totalNights, deepPct, remPct }
 * }
 *
 * bedtime is in hours where 24 = midnight, 25 = 1am, 26 = 2am, etc.
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import StatCard from './StatCard';
import CalendarHeatmap from './CalendarHeatmap';
import { getChartTheme } from '../chartTheme';
import { fmtMonth, formatBedtime, filterByDateRange } from '../utils/dataUtils';
import { useDateRange } from '../contexts/DateRangeContext';

// ---------------------------------------------------------------------------
// Heatmap component
// ---------------------------------------------------------------------------

/** Bedtime heatmap — rows: Mon–Sun, cols: hour 20–30 (8pm to 6am) */
function BedtimeHeatmap({ heatmap, t }) {
  if (!heatmap || heatmap.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px 0' }}>
        No data
      </div>
    );
  }

  // Build lookup: key = `${dow}-${hour}` → count
  const lookup = {};
  let maxCount = 0;
  heatmap.forEach(({ dow, hour, count }) => {
    lookup[`${dow}-${hour}`] = count;
    if (count > maxCount) maxCount = count;
  });

  const DOW_LABELS = t?.('sleep.days') ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = Array.from({ length: 11 }, (_, i) => 20 + i); // 20..30

  function hourLabel(h) {
    return `${(h % 24).toString().padStart(2, '0')}:00`;
  }

  const cellSize = 28;
  const labelWidth = 36;
  const gap = 3;

  return (
    <div
      role="img"
      aria-label="Bedtime distribution heatmap by day of week and hour"
      style={{ overflowX: 'auto' }}
    >
      {/* Hour axis header */}
      <div style={{ display: 'flex', marginLeft: labelWidth, marginBottom: gap }}>
        {HOURS.map((h) => (
          <div
            key={h}
            style={{
              width: cellSize,
              marginRight: gap,
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {hourLabel(h)}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {DOW_LABELS.map((dayLabel, dowIndex) => (
        <div key={dowIndex} style={{ display: 'flex', alignItems: 'center', marginBottom: gap }}>
          <div
            style={{
              width: labelWidth,
              fontSize: 11,
              color: 'var(--text-muted)',
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: 6,
            }}
          >
            {dayLabel}
          </div>
          {HOURS.map((h) => {
            const count = lookup[`${dowIndex}-${h}`] || 0;
            const opacity = count > 0 && maxCount > 0
              ? count / maxCount * 0.8 + 0.05
              : 0;
            return (
              <div
                key={h}
                title={`${dayLabel} ${hourLabel(h)}: ${count} night${count !== 1 ? 's' : ''}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  marginRight: gap,
                  borderRadius: 4,
                  background: count > 0 ? 'var(--color-sleep)' : 'var(--bg-inset)',
                  opacity: count > 0 ? opacity : 1,
                  flexShrink: 0,
                  cursor: count > 0 ? 'default' : undefined,
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Colour scale legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 10,
          marginLeft: labelWidth,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Less</span>
        <div
          style={{
            width: 80,
            height: 10,
            borderRadius: 4,
            background: 'linear-gradient(to right, var(--bg-inset), var(--color-sleep))',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip renderers
// ---------------------------------------------------------------------------

function SleepDurationTooltip({ active, payload, label }) {
  const theme = getChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...theme.tooltip.contentStyle, fontSize: 12 }}>
      <p style={{ ...theme.tooltip.labelStyle, marginBottom: 6 }}>{fmtMonth(label)}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}h
        </div>
      ))}
      <div
        style={{
          color: 'var(--text-secondary)',
          marginTop: 4,
          borderTop: '1px solid var(--border)',
          paddingTop: 4,
        }}
      >
        Total: {payload.reduce((s, p) => s + (p.value || 0), 0).toFixed(1)}h
      </div>
    </div>
  );
}

function BedtimeTooltip({ active, payload, label }) {
  const theme = getChartTheme();
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{ ...theme.tooltip.contentStyle, fontSize: 12 }}>
      <p style={{ ...theme.tooltip.labelStyle, marginBottom: 4 }}>{fmtMonth(label)}</p>
      <div style={{ color: 'var(--color-sleep)' }}>
        Avg Bedtime: {val != null ? formatBedtime(val) : '--'}
      </div>
    </div>
  );
}

function StagePctTooltip({ active, payload, label }) {
  const theme = getChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...theme.tooltip.contentStyle, fontSize: 12 }}>
      <p style={{ ...theme.tooltip.labelStyle, marginBottom: 6 }}>{fmtMonth(label)}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.stroke, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : '--'}%
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SleepPanel({ data, t }) {
  const theme = getChartTheme();
  const { startDate, endDate } = useDateRange();

  // Breathing disturbances — monthly averages
  const bdMonthly = useMemo(() => {
    if (!data?.breathingDisturbances?.length) return [];
    const groups = {};
    for (const r of data.breathingDisturbances) {
      const m = r.date.slice(0, 7);
      if (!groups[m]) groups[m] = [];
      groups[m].push(r.value);
    }
    return Object.entries(groups).sort().map(([month, vals]) => ({
      month,
      mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100,
      max: Math.max(...vals),
    }));
  }, [data?.breathingDisturbances]);

  // Wrist temperature — monthly averages
  const tempMonthly = useMemo(() => {
    if (!data?.wristTemperature?.length) return [];
    const groups = {};
    for (const r of data.wristTemperature) {
      const m = r.date.slice(0, 7);
      if (!groups[m]) groups[m] = [];
      groups[m].push(r.value);
    }
    return Object.entries(groups).sort().map(([month, vals]) => ({
      month,
      mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100,
    }));
  }, [data?.wristTemperature]);

  // --- Loading / null guard ---
  if (!data) {
    return (
      <div
        className="card"
        style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '40px', textAlign: 'center' }}
        role="status"
        aria-live="polite"
      >
        Loading sleep data…
      </div>
    );
  }

  const { stats, monthly = [], heatmap = [] } = data;

  if (!stats) {
    return (
      <div
        className="card"
        style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '40px', textAlign: 'center' }}
        role="alert"
      >
        Sleep data unavailable
      </div>
    );
  }

  // Filter monthly chart data by date range — stat cards always use all-time stats
  const monthlyFiltered = filterByDateRange(monthly, startDate, endDate, 'month');

  // Monthly data enriched with stage %
  const monthlyEnriched = monthlyFiltered.map((m) => ({
    ...m,
    deepPct: m.avgTotal > 0 ? parseFloat(((m.avgDeep / m.avgTotal) * 100).toFixed(1)) : 0,
    remPct: m.avgTotal > 0 ? parseFloat(((m.avgREM / m.avgTotal) * 100).toFixed(1)) : 0,
  }));

  // Filter by date range
  const bdMonthlyFiltered   = filterByDateRange(bdMonthly,   startDate, endDate, 'month');
  const tempMonthlyFiltered = filterByDateRange(tempMonthly, startDate, endDate, 'month');

  // For bedtime Y axis: nice tick labels
  const bedtimeYTicks = [24, 25, 26, 27, 28, 29, 30];

  return (
    <div className="panel" aria-label="Sleep analytics panel">

      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — Key stat cards                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="stat-grid-4" role="region" aria-label="Sleep key statistics">
        <StatCard
          label={t?.('sleep.avgSleep') ?? 'Average Sleep'}
          value={stats.avgTotal != null ? stats.avgTotal.toFixed(1) : '--'}
          unit="h"
          color="var(--color-sleep)"
        />
        <StatCard
          label={t?.('sleep.deepSleep') ?? 'Deep Sleep'}
          value={stats.avgDeep != null ? stats.avgDeep.toFixed(1) : '--'}
          unit="h"
          color="var(--color-blue)"
          trendLabel={stats.deepPct != null ? `${stats.deepPct.toFixed(1)}% of total` : undefined}
        />
        <StatCard
          label={t?.('sleep.remSleep') ?? 'REM Sleep'}
          value={stats.avgREM != null ? stats.avgREM.toFixed(1) : '--'}
          unit="h"
          color="var(--color-hrv)"
          trendLabel={stats.remPct != null ? `${stats.remPct.toFixed(1)}% of total` : undefined}
        />
        <StatCard
          label={t?.('sleep.avgBedtime') ?? 'Avg Bedtime'}
          value={stats.avgBedtime != null ? formatBedtime(stats.avgBedtime) : '--'}
          color="var(--color-sleep)"
        />
        <StatCard
          label={t?.('sleep.below6h') ?? '< 6h Nights'}
          value={stats.below6hPct != null ? stats.below6hPct.toFixed(1) : '--'}
          unit="%"
          color="var(--color-red)"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — Monthly sleep duration stacked bar chart (full width)       */}
      {/* ------------------------------------------------------------------ */}
      <div className="chart-card" role="region" aria-label="Monthly sleep duration chart">
        <div className="chart-card-header">
          <div>
            <h3 className="section-title">{t?.('sleep.monthlyDuration') ?? 'Sleep Duration'}</h3>
            <p className="chart-card-title">{t?.('sleep.monthlyDurationSub') ?? 'Monthly Average by Stage'}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={monthlyEnriched}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              {...theme.xAxis}
              interval="preserveStartEnd"
            />
            <YAxis
              {...theme.yAxis}
              domain={[0, 'auto']}
              unit="h"
              width={36}
            />
            <Tooltip content={<SleepDurationTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}
              formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>}
            />
            <ReferenceLine
              y={7}
              {...theme.referenceLine}
              stroke="var(--color-amber)"
              label={{ value: '7h', fill: 'var(--color-amber)', fontSize: 11, position: 'insideTopRight' }}
            />
            <Bar dataKey="core"    name="Core" stackId="sleep" fill="var(--color-sleep)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="avgDeep" name="Deep" stackId="sleep" fill="var(--color-blue)"  radius={[0, 0, 0, 0]} />
            <Bar dataKey="avgREM"  name="REM"  stackId="sleep" fill="var(--color-hrv)"   radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — Bedtime trend + Heatmap side by side                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="two-col">
        {/* Bedtime trend line chart */}
        <div className="chart-card" role="region" aria-label="Average bedtime trend chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('sleep.bedtimeTrend') ?? 'Bedtime Trend'}</h3>
              <p className="chart-card-title">{t?.('sleep.bedtimeTrendSub') ?? 'Average Monthly Bedtime'}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={monthlyEnriched}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                {...theme.xAxis}
                interval="preserveStartEnd"
              />
              <YAxis
                {...theme.yAxis}
                domain={[23, 31]}
                ticks={bedtimeYTicks}
                tickFormatter={formatBedtime}
                width={46}
              />
              <Tooltip content={<BedtimeTooltip />} />
              <ReferenceLine
                y={24}
                {...theme.referenceLine}
                label={{ value: 'Midnight', fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopLeft' }}
              />
              <ReferenceLine
                y={26}
                {...theme.referenceLine}
                strokeOpacity={0.3}
                label={{ value: '2am', fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopLeft' }}
              />
              <Line
                type="monotone"
                dataKey="avgBedtime"
                name="Avg Bedtime"
                stroke="var(--color-sleep)"
                strokeWidth={2}
                dot={false}
                activeDot={theme.activeDot(theme.colors.sleep)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bedtime heatmap */}
        <div className="chart-card" role="region" aria-label="Bedtime distribution heatmap">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('sleep.bedtimeDist') ?? 'Bedtime Distribution'}</h3>
              <p className="chart-card-title">{t?.('sleep.bedtimeDistSub') ?? 'Nights by Day and Hour'}</p>
            </div>
          </div>
          <BedtimeHeatmap heatmap={heatmap} t={t} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 — Sleep stage proportions over time (full width)              */}
      {/* ------------------------------------------------------------------ */}
      <div className="chart-card" role="region" aria-label="Sleep stage proportions over time">
        <div className="chart-card-header">
          <div>
            <h3 className="section-title">{t?.('sleep.stageProportions') ?? 'Sleep Stage Proportions'}</h3>
            <p className="chart-card-title">{t?.('sleep.stageProportionsSub') ?? 'Deep and REM Percentage Over Time'}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={monthlyEnriched}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              {...theme.xAxis}
              interval="preserveStartEnd"
            />
            <YAxis
              {...theme.yAxis}
              unit="%"
              domain={[0, 'auto']}
              width={40}
            />
            <Tooltip content={<StagePctTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>}
            />
            <Line
              type="monotone"
              dataKey="deepPct"
              name="Deep %"
              stroke="var(--color-blue)"
              strokeWidth={2}
              dot={false}
              activeDot={theme.activeDot(theme.colors.blue)}
            />
            <Line
              type="monotone"
              dataKey="remPct"
              name="REM %"
              stroke="var(--color-hrv)"
              strokeWidth={2}
              dot={false}
              activeDot={theme.activeDot(theme.colors.hrv)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 5 — Sleep Duration Calendar Heatmap (full width)               */}
      {/* ------------------------------------------------------------------ */}
      <CalendarHeatmap
        data={data.nightly?.map((n) => ({ date: n.date, value: Math.round(n.total * 10) / 10 }))}
        colorVar="var(--color-sleep)"
        label={t?.('sleep.calendarHeatmap') ?? 'Sleep Duration Calendar'}
        unit="h"
        targetRange={[7, 9]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Row 6 — Sleep Debt Tracker                                          */}
      {/* ------------------------------------------------------------------ */}
      {data.sleepDebt?.length > 0 && (
        <div className="chart-card" role="region" aria-label="Sleep debt tracker">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('sleep.sleepDebt') ?? 'Sleep Debt Tracker'}</h3>
              <p className="chart-card-title">{t?.('sleep.sleepDebtSub') ?? 'Cumulative deficit vs target'}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={filterByDateRange(data.sleepDebt, startDate, endDate)}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
                {...theme.xAxis}
                interval="preserveStartEnd"
              />
              <YAxis {...theme.yAxis} domain={[0, 'auto']} unit="h" width={36} />
              <Tooltip
                contentStyle={theme.tooltip.contentStyle}
                labelStyle={theme.tooltip.labelStyle}
                formatter={(val, name) => {
                  const labels = {
                    cumulativeDebt: t?.('sleep.cumulativeDebt') ?? 'Cumulative Debt',
                    duration: t?.('sleep.total') ?? 'Total',
                  };
                  return [`${val}h`, labels[name] || name];
                }}
              />
              <ReferenceLine
                y={data.sleepDebt[0]?.target ?? 7.5}
                stroke="var(--color-green)"
                strokeDasharray="4 3"
                label={{
                  value: `${t?.('sleep.target') ?? 'Target'} ${data.sleepDebt[0]?.target ?? 7.5}h`,
                  fill: 'var(--color-green)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeDebt"
                stroke="var(--color-red)"
                fill="var(--color-red)"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                name="cumulativeDebt"
              />
              <Line
                type="monotone"
                dataKey="duration"
                stroke="var(--color-sleep)"
                strokeWidth={1.5}
                dot={false}
                name="duration"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Row 7 — Breathing Disturbances + Wrist Temperature side by side     */}
      {/* ------------------------------------------------------------------ */}
      {(bdMonthlyFiltered.length > 0 || tempMonthlyFiltered.length > 0) && (
        <div className="two-col">

          {/* Breathing Disturbances bar chart */}
          {bdMonthlyFiltered.length > 0 && (
            <div className="chart-card" role="region" aria-label="Breathing disturbances monthly chart">
              <div className="chart-card-header">
                <div>
                  <h3 className="section-title">{t?.('sleep.breathingDist') ?? 'Breathing Disturbances'}</h3>
                  <p className="chart-card-title">{t?.('sleep.breathingDistSub') ?? 'Monthly Average Index'}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bdMonthlyFiltered} barCategoryGap="30%">
                  <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={fmtMonth}
                    {...theme.xAxis}
                    interval="preserveStartEnd"
                  />
                  <YAxis {...theme.yAxis} domain={[0, 'auto']} width={36} />
                  <Tooltip
                    contentStyle={theme.tooltip.contentStyle}
                    labelStyle={theme.tooltip.labelStyle}
                  />
                  <ReferenceLine
                    y={5}
                    stroke="var(--color-risk)"
                    strokeDasharray="4 3"
                    label={{
                      value: t?.('sleep.clinicalThreshold') ?? 'Clinical Threshold',
                      fill: 'var(--color-risk)',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                  <Bar dataKey="mean" fill="var(--color-risk)" fillOpacity={0.75} radius={[3, 3, 0, 0]} name={t?.('sleep.breathingDist') ?? 'Breathing Disturbances'} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Wrist Temperature line chart */}
          {tempMonthlyFiltered.length > 0 && (
            <div className="chart-card" role="region" aria-label="Wrist temperature monthly chart">
              <div className="chart-card-header">
                <div>
                  <h3 className="section-title">{t?.('sleep.wristTemp') ?? 'Wrist Temperature'}</h3>
                  <p className="chart-card-title">{t?.('sleep.wristTempSub') ?? 'Monthly Average'}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tempMonthlyFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={fmtMonth}
                    {...theme.xAxis}
                    interval="preserveStartEnd"
                  />
                  <YAxis {...theme.yAxis} domain={['auto', 'auto']} width={44} unit="°C" />
                  <Tooltip
                    contentStyle={theme.tooltip.contentStyle}
                    labelStyle={theme.tooltip.labelStyle}
                    formatter={(val) => [`${val}°C`, t?.('sleep.wristTemp') ?? 'Wrist Temperature']}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke="var(--color-heart)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={theme.activeDot(theme.colors.heart)}
                    name={t?.('sleep.wristTemp') ?? 'Wrist Temperature'}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
