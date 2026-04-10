/**
 * ComparisonView - Period-over-period comparison panel for the health dashboard.
 *
 * Usage:
 *   <ComparisonView cardiovascular={data.cardiovascular} sleep={data.sleep} activity={data.activity} t={t} />
 *
 * Props:
 *   cardiovascular  - cardiovascular.json data object
 *   sleep           - sleep.json data object
 *   activity        - activity.json data object
 *   t               - translation function from useTranslation
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { filterByDateRange, computeStats } from '../utils/dataUtils';
import { getChartTheme } from '../chartTheme';
import StatCard from './StatCard';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { days: 7,  label: { en: '7 Days',  zh: '7天'  } },
  { days: 30, label: { en: '30 Days', zh: '30天' } },
  { days: 90, label: { en: '90 Days', zh: '90天' } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize daily data to relative day indices so Period A and Period B
 * can be overlaid on the same x-axis.
 *
 * @param {Array}  data   - array of objects with a `date` field
 * @param {string} start  - ISO date string "YYYY-MM-DD"
 * @returns Array with an added `day` property (1-based integer)
 */
function normalizeToRelativeDays(data, start) {
  if (!data || !start) return [];
  const startMs = new Date(start + 'T00:00:00').getTime();
  return data.map((d) => ({
    ...d,
    day: Math.floor((new Date(d.date + 'T00:00:00').getTime() - startMs) / 86400000) + 1,
  }));
}

/**
 * Build a lookup map from day number to value for a normalized dataset.
 * Used to merge Period A and Period B onto a single x-axis array.
 */
function buildDayMap(normalized, valueKey = 'value') {
  const map = {};
  for (const d of normalized) {
    if (d.day != null) map[d.day] = d[valueKey] ?? null;
  }
  return map;
}

/**
 * Merge two period datasets (keyed by day) into a single array for Recharts.
 * Days range from 1 to the longer of the two periods.
 */
function mergeByDay(mapA, mapB, totalDays) {
  const result = [];
  for (let i = 1; i <= totalDays; i++) {
    result.push({
      day: i,
      a: mapA[i] ?? null,
      b: mapB[i] ?? null,
    });
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Segment button row for selecting period length */
function PeriodSelector({ value, onChange, lang, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '2px',
        }}
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => onChange(opt.days)}
            className={`date-preset-btn${value === opt.days ? ' active' : ''}`}
            style={{ minWidth: '64px' }}
            aria-pressed={value === opt.days}
          >
            {opt.label[lang] || opt.label.en}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Overlaid line chart for a single metric comparing Period A and Period B */
function OverlaidLineChart({ data, colorA, colorB, unit, height = 220 }) {
  const theme = getChartTheme();

  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid
          stroke={theme.grid.stroke}
          strokeDasharray="0"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          {...theme.xAxis}
          tickFormatter={(d) => `D${d}`}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          unit={unit ? ` ${unit}` : ''}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={theme.tooltip.cursor}
          labelFormatter={(d) => `Day ${d}`}
          formatter={(val, name) => [
            val != null ? `${val}${unit ? ' ' + unit : ''}` : '--',
            name === 'a' ? 'Period A' : 'Period B',
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          formatter={(name) => (
            <span style={{ color: 'var(--text-muted)' }}>
              {name === 'a' ? 'Period A' : 'Period B'}
            </span>
          )}
        />
        <Line
          type="monotone"
          dataKey="a"
          stroke={colorA}
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot(colorA)}
          connectNulls
          name="a"
        />
        <Line
          type="monotone"
          dataKey="b"
          stroke={colorB}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          activeDot={theme.activeDot(colorB)}
          connectNulls
          name="b"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Grouped bar chart comparing sleep duration for two periods */
function SleepComparisonChart({ dataA, dataB, colorA, colorB, height = 220 }) {
  const theme = getChartTheme();

  // Merge by relative day
  const normA = normalizeToRelativeDays(dataA, dataA?.[0]?.date);
  const normB = normalizeToRelativeDays(dataB, dataB?.[0]?.date);
  const mapA  = buildDayMap(normA, 'total');
  const mapB  = buildDayMap(normB, 'total');
  const maxDay = Math.max(
    normA.length ? Math.max(...normA.map((d) => d.day)) : 0,
    normB.length ? Math.max(...normB.map((d) => d.day)) : 0,
  );
  const merged = mergeByDay(mapA, mapB, maxDay || 30);

  if (merged.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={merged} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barSize={6}>
        <CartesianGrid
          stroke={theme.grid.stroke}
          strokeDasharray="0"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          {...theme.xAxis}
          tickFormatter={(d) => `D${d}`}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={[0, 'auto']}
          tickFormatter={(h) => `${h}h`}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={{ fill: 'var(--border-subtle)' }}
          labelFormatter={(d) => `Day ${d}`}
          formatter={(val, name) => [
            val != null ? `${val.toFixed(1)}h` : '--',
            name === 'a' ? 'Period A' : 'Period B',
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          formatter={(name) => (
            <span style={{ color: 'var(--text-muted)' }}>
              {name === 'a' ? 'Period A' : 'Period B'}
            </span>
          )}
        />
        <Bar
          dataKey="a"
          fill={colorA}
          fillOpacity={0.85}
          radius={[2, 2, 0, 0]}
          name="a"
        />
        <Bar
          dataKey="b"
          fill={colorB}
          fillOpacity={0.55}
          radius={[2, 2, 0, 0]}
          name="b"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Delta pill helper ────────────────────────────────────────────────────────

/**
 * Render a small inline delta badge.
 * higherIsBetter controls whether a positive delta gets green or red.
 */
function DeltaPill({ delta, higherIsBetter, unit }) {
  if (delta == null || isNaN(delta)) return null;

  const isPositive = delta > 0;
  const isNeutral  = Math.abs(delta) < 0.5;

  let color = 'var(--text-muted)';
  if (!isNeutral) {
    const isGood = higherIsBetter ? isPositive : !isPositive;
    color = isGood ? 'var(--color-green)' : 'var(--color-red)';
  }

  const arrow = isNeutral ? '' : isPositive ? ' ↑' : ' ↓';
  const sign  = isPositive ? '+' : '';

  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        letterSpacing: '-0.02em',
      }}
      aria-label={`Change: ${sign}${delta.toFixed(1)}${unit ? ' ' + unit : ''}`}
    >
      {sign}{delta.toFixed(1)}{unit ? ` ${unit}` : ''}{arrow}
    </span>
  );
}

// ─── No data placeholder ──────────────────────────────────────────────────────

function NoData({ message }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '120px',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}
    >
      {message}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function ComparisonView({ cardiovascular, sleep, activity, t }) {
  const theme = getChartTheme();

  // Period length selectors (in days)
  const [periodADays, setPeriodADays] = useState(30);
  const [periodBDays, setPeriodBDays] = useState(30);

  // Detect language from translation function — fall back to 'en'
  const lang = useMemo(() => {
    // The `t` function path 'tabs.compare' will return Chinese text only in zh mode
    const sample = t('tabs.compare');
    return sample === '对比' ? 'zh' : 'en';
  }, [t]);

  // Compute date ranges: Period A = last N days, Period B = the N days before that
  const { periodA, periodB } = useMemo(() => {
    const now = new Date();
    const aEnd   = now.toISOString().slice(0, 10);
    const aStart = new Date(now);
    aStart.setDate(aStart.getDate() - periodADays);
    const aStartStr = aStart.toISOString().slice(0, 10);

    const bEnd   = new Date(aStart);
    bEnd.setDate(bEnd.getDate() - 1);
    const bStart = new Date(bEnd);
    bStart.setDate(bStart.getDate() - (periodBDays - 1));
    const bEndStr   = bEnd.toISOString().slice(0, 10);
    const bStartStr = bStart.toISOString().slice(0, 10);

    return {
      periodA: { start: aStartStr, end: aEnd },
      periodB: { start: bStartStr, end: bEndStr },
    };
  }, [periodADays, periodBDays]);

  // ── Filter raw daily data for each period ──────────────────────────────────

  const rhrDailyA = useMemo(
    () => filterByDateRange(cardiovascular?.rhr?.daily, periodA.start, periodA.end),
    [cardiovascular, periodA],
  );
  const rhrDailyB = useMemo(
    () => filterByDateRange(cardiovascular?.rhr?.daily, periodB.start, periodB.end),
    [cardiovascular, periodB],
  );

  const hrvDailyA = useMemo(
    () => filterByDateRange(cardiovascular?.hrv?.daily, periodA.start, periodA.end),
    [cardiovascular, periodA],
  );
  const hrvDailyB = useMemo(
    () => filterByDateRange(cardiovascular?.hrv?.daily, periodB.start, periodB.end),
    [cardiovascular, periodB],
  );

  const sleepNightlyA = useMemo(
    () => filterByDateRange(sleep?.nightly, periodA.start, periodA.end),
    [sleep, periodA],
  );
  const sleepNightlyB = useMemo(
    () => filterByDateRange(sleep?.nightly, periodB.start, periodB.end),
    [sleep, periodB],
  );

  // Steps: activity.steps.daily is an array of { date, value }
  const stepsDailyA = useMemo(
    () => filterByDateRange(activity?.steps?.daily, periodA.start, periodA.end),
    [activity, periodA],
  );
  const stepsDailyB = useMemo(
    () => filterByDateRange(activity?.steps?.daily, periodB.start, periodB.end),
    [activity, periodB],
  );

  // ── Compute period stats ────────────────────────────────────────────────────

  const rhrStatsA = useMemo(() => computeStats((rhrDailyA || []).map((r) => r.value).filter(Boolean)), [rhrDailyA]);
  const rhrStatsB = useMemo(() => computeStats((rhrDailyB || []).map((r) => r.value).filter(Boolean)), [rhrDailyB]);

  const hrvStatsA = useMemo(() => computeStats((hrvDailyA || []).map((r) => r.value).filter(Boolean)), [hrvDailyA]);
  const hrvStatsB = useMemo(() => computeStats((hrvDailyB || []).map((r) => r.value).filter(Boolean)), [hrvDailyB]);

  const sleepStatsA = useMemo(() => computeStats((sleepNightlyA || []).map((r) => r.total).filter(Boolean)), [sleepNightlyA]);
  const sleepStatsB = useMemo(() => computeStats((sleepNightlyB || []).map((r) => r.total).filter(Boolean)), [sleepNightlyB]);

  const stepsStatsA = useMemo(() => computeStats((stepsDailyA || []).map((r) => r.value).filter(Boolean)), [stepsDailyA]);
  const stepsStatsB = useMemo(() => computeStats((stepsDailyB || []).map((r) => r.value).filter(Boolean)), [stepsDailyB]);

  // ── Deltas ─────────────────────────────────────────────────────────────────

  const rhrDelta   = rhrStatsA.count > 0 && rhrStatsB.count > 0   ? +(rhrStatsA.mean   - rhrStatsB.mean).toFixed(1)   : null;
  const hrvDelta   = hrvStatsA.count > 0 && hrvStatsB.count > 0   ? +(hrvStatsA.mean   - hrvStatsB.mean).toFixed(1)   : null;
  const sleepDelta = sleepStatsA.count > 0 && sleepStatsB.count > 0 ? +(sleepStatsA.mean - sleepStatsB.mean).toFixed(2) : null;
  const stepsDelta = stepsStatsA.count > 0 && stepsStatsB.count > 0 ? Math.round(stepsStatsA.mean - stepsStatsB.mean)   : null;

  // ── Trend direction helpers ─────────────────────────────────────────────────
  // For RHR: lower is better → negative delta = improvement → trend 'down' + badTrend=true means down=good
  // For HRV: higher is better → positive delta = improvement → trend 'up' (no badTrend)
  // For Sleep: higher is better → positive delta = improvement
  // For Steps: higher is better

  const rhrTrend   = rhrDelta == null   ? 'neutral' : rhrDelta < -1   ? 'down' : rhrDelta > 1   ? 'up' : 'neutral';
  const hrvTrend   = hrvDelta == null   ? 'neutral' : hrvDelta > 1    ? 'up'   : hrvDelta < -1   ? 'down' : 'neutral';
  const sleepTrend = sleepDelta == null ? 'neutral' : sleepDelta > 0.1 ? 'up' : sleepDelta < -0.1 ? 'down' : 'neutral';
  const stepsTrend = stepsDelta == null ? 'neutral' : stepsDelta > 100 ? 'up' : stepsDelta < -100 ? 'down' : 'neutral';

  const rhrTrendLabel   = rhrDelta   != null ? `${rhrDelta >= 0 ? '+' : ''}${rhrDelta} bpm ${t('compare.delta')}` : undefined;
  const hrvTrendLabel   = hrvDelta   != null ? `${hrvDelta >= 0 ? '+' : ''}${hrvDelta} ms ${t('compare.delta')}` : undefined;
  const sleepTrendLabel = sleepDelta != null ? `${sleepDelta >= 0 ? '+' : ''}${sleepDelta.toFixed(2)}h ${t('compare.delta')}` : undefined;
  const stepsTrendLabel = stepsDelta != null ? `${stepsDelta >= 0 ? '+' : ''}${stepsDelta} ${t('compare.delta')}` : undefined;

  // ── Overlaid chart data ─────────────────────────────────────────────────────

  const rhrChartData = useMemo(() => {
    const normA = normalizeToRelativeDays(rhrDailyA || [], periodA.start);
    const normB = normalizeToRelativeDays(rhrDailyB || [], periodB.start);
    const mapA  = buildDayMap(normA);
    const mapB  = buildDayMap(normB);
    const maxDay = Math.max(
      normA.length ? Math.max(...normA.map((d) => d.day)) : 0,
      normB.length ? Math.max(...normB.map((d) => d.day)) : 0,
    );
    return mergeByDay(mapA, mapB, maxDay || periodADays);
  }, [rhrDailyA, rhrDailyB, periodA.start, periodB.start, periodADays]);

  const hrvChartData = useMemo(() => {
    const normA = normalizeToRelativeDays(hrvDailyA || [], periodA.start);
    const normB = normalizeToRelativeDays(hrvDailyB || [], periodB.start);
    const mapA  = buildDayMap(normA);
    const mapB  = buildDayMap(normB);
    const maxDay = Math.max(
      normA.length ? Math.max(...normA.map((d) => d.day)) : 0,
      normB.length ? Math.max(...normB.map((d) => d.day)) : 0,
    );
    return mergeByDay(mapA, mapB, maxDay || periodADays);
  }, [hrvDailyA, hrvDailyB, periodA.start, periodB.start, periodADays]);

  // ── Period label helper ─────────────────────────────────────────────────────
  const fmtPeriodRange = (start, end) =>
    `${start} – ${end}`;

  // ── No data guard ───────────────────────────────────────────────────────────
  const hasAnyData =
    rhrStatsA.count > 0 || hrvStatsA.count > 0 ||
    sleepStatsA.count > 0 || stepsStatsA.count > 0;

  // Solid color for Period A, a muted/secondary shade for Period B
  const colorA_rhr   = theme.colors.heart;
  const colorB_rhr   = `${theme.colors.heart}88`;   // 53% alpha approximation via hex
  const colorA_hrv   = theme.colors.hrv;
  const colorB_hrv   = `${theme.colors.hrv}88`;
  const colorA_sleep = theme.colors.sleep;
  const colorB_sleep = `${theme.colors.sleep}88`;

  return (
    <div className="panel" role="main" aria-label="Period Comparison Panel">

      {/* ── Row 1: Period Selectors ─────────────────────────────────── */}
      <div
        className="card"
        style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}
        role="region"
        aria-label="Period selection controls"
      >
        <PeriodSelector
          value={periodADays}
          onChange={setPeriodADays}
          lang={lang}
          label={t('compare.periodA')}
        />

        <div
          style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            paddingBottom: '6px',
          }}
          aria-hidden="true"
        >
          {t('compare.vs')}
        </div>

        <PeriodSelector
          value={periodBDays}
          onChange={setPeriodBDays}
          lang={lang}
          label={t('compare.periodB')}
        />

        {/* Date range display */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}
        >
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: colorA_rhr,
                marginRight: '5px',
                verticalAlign: 'middle',
              }}
            />
            A: {fmtPeriodRange(periodA.start, periodA.end)}
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: colorB_rhr,
                marginRight: '5px',
                verticalAlign: 'middle',
              }}
            />
            B: {fmtPeriodRange(periodB.start, periodB.end)}
          </span>
        </div>
      </div>

      {/* ── Row 2: Comparison Stat Cards ───────────────────────────── */}
      <div
        className="stat-grid-4"
        role="region"
        aria-label="Period comparison metrics"
      >
        {/* RHR */}
        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('cardio.rhr')}
            value={rhrStatsA.count > 0 ? rhrStatsA.mean : null}
            unit="bpm"
            trend={rhrTrend}
            badTrend={true}
            trendLabel={rhrTrendLabel}
            color="var(--color-heart)"
          />
          {rhrDelta != null && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              <span
                style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}
              >
                B: {rhrStatsB.mean} bpm
              </span>
              <DeltaPill delta={rhrDelta} higherIsBetter={false} unit="bpm" />
            </div>
          )}
        </div>

        {/* HRV */}
        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('cardio.hrv')}
            value={hrvStatsA.count > 0 ? hrvStatsA.mean : null}
            unit="ms"
            trend={hrvTrend}
            badTrend={false}
            trendLabel={hrvTrendLabel}
            color="var(--color-hrv)"
          />
          {hrvDelta != null && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              <span
                style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}
              >
                B: {hrvStatsB.mean} ms
              </span>
              <DeltaPill delta={hrvDelta} higherIsBetter={true} unit="ms" />
            </div>
          )}
        </div>

        {/* Sleep Duration */}
        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('sleep.avgSleep')}
            value={sleepStatsA.count > 0 ? sleepStatsA.mean.toFixed(1) : null}
            unit="h"
            trend={sleepTrend}
            badTrend={false}
            trendLabel={sleepTrendLabel}
            color="var(--color-sleep)"
          />
          {sleepDelta != null && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              <span
                style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}
              >
                B: {sleepStatsB.mean.toFixed(1)}h
              </span>
              <DeltaPill delta={sleepDelta} higherIsBetter={true} unit="h" />
            </div>
          )}
        </div>

        {/* Daily Steps */}
        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('activity.dailySteps')}
            value={stepsStatsA.count > 0 ? Math.round(stepsStatsA.mean).toLocaleString() : null}
            unit="steps"
            trend={stepsTrend}
            badTrend={false}
            trendLabel={stepsTrendLabel}
            color="var(--color-activity)"
          />
          {stepsDelta != null && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              <span
                style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}
              >
                B: {Math.round(stepsStatsB.mean).toLocaleString()}
              </span>
              <DeltaPill delta={stepsDelta} higherIsBetter={true} unit="" />
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Overlaid Charts ──────────────────────────────────── */}
      <div className="two-col">

        {/* RHR + HRV comparison */}
        <div className="chart-card" role="region" aria-label="Heart rate comparison chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t('cardio.rhr')} + {t('cardio.hrv')}</h3>
              <p className="chart-card-title">{t('compare.rhrChart')}</p>
              <p className="chart-card-sub">
                {lang === 'zh' ? '实线 = 当前期，虚线 = 对比期' : 'Solid = Period A, Dashed = Period B'}
              </p>
            </div>
          </div>

          {/* RHR overlay */}
          <div style={{ marginBottom: '8px' }}>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              {t('cardio.rhr')}
            </p>
            {rhrChartData.length > 0 ? (
              <OverlaidLineChart
                data={rhrChartData}
                colorA={colorA_rhr}
                colorB={colorB_rhr}
                unit="bpm"
                height={180}
              />
            ) : (
              <NoData message={t('compare.noData')} />
            )}
          </div>

          {/* HRV overlay */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              {t('cardio.hrv')}
            </p>
            {hrvChartData.length > 0 ? (
              <OverlaidLineChart
                data={hrvChartData}
                colorA={colorA_hrv}
                colorB={colorB_hrv}
                unit="ms"
                height={180}
              />
            ) : (
              <NoData message={t('compare.noData')} />
            )}
          </div>
        </div>

        {/* Sleep duration comparison */}
        <div className="chart-card" role="region" aria-label="Sleep duration comparison chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t('sleep.avgSleep')}</h3>
              <p className="chart-card-title">{t('compare.sleepChart')}</p>
              <p className="chart-card-sub">
                {lang === 'zh' ? '实色 = 当前期，半透明 = 对比期' : 'Solid = Period A, Muted = Period B'}
              </p>
            </div>
          </div>

          {sleepNightlyA?.length > 0 || sleepNightlyB?.length > 0 ? (
            <SleepComparisonChart
              dataA={sleepNightlyA || []}
              dataB={sleepNightlyB || []}
              colorA={colorA_sleep}
              colorB={colorB_sleep}
              height={420}
            />
          ) : (
            <NoData message={t('compare.noData')} />
          )}

          {/* Summary stats under the chart */}
          {(sleepStatsA.count > 0 || sleepStatsB.count > 0) && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              {[
                { label: 'A avg', value: sleepStatsA.count > 0 ? `${sleepStatsA.mean.toFixed(1)}h` : '--', color: colorA_sleep },
                { label: 'B avg', value: sleepStatsB.count > 0 ? `${sleepStatsB.mean.toFixed(1)}h` : '--', color: colorB_sleep },
                { label: 'A min', value: sleepStatsA.count > 0 ? `${(+sleepStatsA.min).toFixed(1)}h` : '--', color: 'var(--text-muted)' },
                { label: 'B min', value: sleepStatsB.count > 0 ? `${(+sleepStatsB.min).toFixed(1)}h` : '--', color: 'var(--text-muted)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color, letterSpacing: '-0.03em' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── No data fallback ────────────────────────────────────────── */}
      {!hasAnyData && (
        <div
          className="card"
          style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}
          role="status"
        >
          {t('compare.noData')}
        </div>
      )}

    </div>
  );
}

export default ComparisonView;
