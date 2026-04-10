/**
 * ExerciseRecoveryChart
 *
 * Overlays workout events with next-day recovery metrics (HRV and RHR)
 * to show how exercise affects recovery.
 *
 * Props:
 *   workouts     - array of { date, type, duration, avgHR, ... } from activity.json
 *   hrvDaily     - array of { date, value } from cardiovascular.json (hrv.daily)
 *   rhrDaily     - array of { date, value } from cardiovascular.json (rhr.daily)
 *   sleepNightly - array of { date, total, deep, ... } from sleep.json (nightly)
 *   t            - translation function
 *
 * Usage:
 *   <ExerciseRecoveryChart
 *     workouts={data.activity?.workouts}
 *     hrvDaily={data.cardiovascular?.hrv?.daily}
 *     rhrDaily={data.cardiovascular?.rhr?.daily}
 *     sleepNightly={data.sleep?.nightly}
 *     t={t}
 *   />
 */

import { useMemo } from 'react';
import {
  ComposedChart,
  ScatterChart,
  Scatter,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Cell,
} from 'recharts';
import { fmtDate, computeStats } from '../utils/dataUtils';
import { getChartTheme } from '../chartTheme';
import StatCard from './StatCard';

// ─── workout type colors ──────────────────────────────────────────────────────

const TYPE_COLORS = {
  Swimming:                    'var(--color-activity)',
  Cycling:                     'var(--color-hrv)',
  Walking:                     'var(--color-vo2)',
  TraditionalStrengthTraining: 'var(--color-risk)',
  Running:                     'var(--color-heart)',
};

function getTypeColor(type) {
  return TYPE_COLORS[type] || 'var(--color-spo2)';
}

// ─── custom tooltip for scatter chart ────────────────────────────────────────

function ScatterTooltip({ active, payload, t }) {
  const theme = getChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={theme.tooltip.contentStyle}>
      <p style={{ ...theme.tooltip.labelStyle, margin: '0 0 6px 0' }}>{fmtDate(d.date)}</p>
      <p style={{ margin: '2px 0', color: getTypeColor(d.type), fontSize: 13 }}>
        {d.type}
      </p>
      <p style={{ margin: '2px 0', color: 'var(--text-primary)', fontSize: 13 }}>
        {t?.('activity.duration') ?? 'Duration'}: {d.duration} min
      </p>
      <p style={{ margin: '2px 0', color: 'var(--color-hrv)', fontSize: 13 }}>
        {t?.('recovery.nextDay') ?? 'Next day'} HRV: {d.nextHRV != null ? `${d.nextHRV} ms` : '--'}
      </p>
      {d.nextRHR != null && (
        <p style={{ margin: '2px 0', color: 'var(--color-heart)', fontSize: 13 }}>
          {t?.('recovery.nextDay') ?? 'Next day'} RHR: {d.nextRHR} bpm
        </p>
      )}
    </div>
  );
}

// ─── custom tooltip for timeline chart ───────────────────────────────────────

function TimelineTooltip({ active, payload, label, t }) {
  const theme = getChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={theme.tooltip.contentStyle}>
      <p style={{ ...theme.tooltip.labelStyle, margin: '0 0 6px 0' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ margin: '2px 0', color: p.color || 'var(--text-primary)', fontSize: 13 }}>
          {p.name}: {p.value != null ? p.value : '--'}
          {p.dataKey === 'duration' ? ' min' : p.dataKey === 'nextHRV' ? ' ms' : p.dataKey === 'nextRHR' ? ' bpm' : ''}
        </p>
      ))}
    </div>
  );
}

// ─── legend label for scatter ─────────────────────────────────────────────────

function TypeLegend({ types }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px', justifyContent: 'center' }}>
      {types.map((type) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{
            display: 'inline-block',
            width: 10, height: 10, borderRadius: '50%',
            background: getTypeColor(type),
            flexShrink: 0,
          }} />
          {type}
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function ExerciseRecoveryChart({ workouts, hrvDaily, rhrDaily, sleepNightly, t }) {
  const theme = getChartTheme();

  // ── data processing ─────────────────────────────────────────────────────────
  const recoveryData = useMemo(() => {
    if (!workouts?.length || !hrvDaily?.length) return [];

    const hrvMap = Object.fromEntries(hrvDaily.map((r) => [r.date, r.value]));
    const rhrMap = Object.fromEntries((rhrDaily || []).map((r) => [r.date, r.value]));
    const sleepMap = Object.fromEntries((sleepNightly || []).map((n) => [n.date, n.total]));

    return workouts
      .filter((w) => w.date && w.duration > 10)
      .map((w) => {
        const nextDay = new Date(w.date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().slice(0, 10);

        const prevDay = new Date(w.date);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = prevDay.toISOString().slice(0, 10);

        return {
          date:     w.date,
          label:    fmtDate(w.date),
          type:     w.type || 'Unknown',
          duration: w.duration,
          avgHR:    w.avgHR ?? null,
          nextHRV:  hrvMap[nextDayStr] ?? null,
          nextRHR:  rhrMap[nextDayStr] ?? null,
          nextSleep: sleepMap[nextDayStr] ?? null,
          prevHRV:  hrvMap[prevDayStr] ?? null,
          prevRHR:  rhrMap[prevDayStr] ?? null,
          hrvDelta: (hrvMap[nextDayStr] != null && hrvMap[prevDayStr] != null)
            ? +(hrvMap[nextDayStr] - hrvMap[prevDayStr]).toFixed(1)
            : null,
          rhrDelta: (rhrMap[nextDayStr] != null && rhrMap[prevDayStr] != null)
            ? +(rhrMap[nextDayStr] - rhrMap[prevDayStr]).toFixed(1)
            : null,
        };
      })
      .filter((r) => r.nextHRV != null || r.nextRHR != null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [workouts, hrvDaily, rhrDaily, sleepNightly]);

  // ── summary stats ────────────────────────────────────────────────────────────
  const { avgHrvDelta, avgRhrDelta, avgSleep, hrvMean } = useMemo(() => {
    if (!recoveryData.length) return { avgHrvDelta: null, avgRhrDelta: null, avgSleep: null, hrvMean: null };

    const hrvDeltas = recoveryData.filter((r) => r.hrvDelta != null).map((r) => r.hrvDelta);
    const rhrDeltas = recoveryData.filter((r) => r.rhrDelta != null).map((r) => r.rhrDelta);
    const sleeps    = recoveryData.filter((r) => r.nextSleep != null).map((r) => r.nextSleep);
    const hrvVals   = recoveryData.filter((r) => r.nextHRV != null).map((r) => r.nextHRV);

    const avg = (arr) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;

    return {
      avgHrvDelta: avg(hrvDeltas),
      avgRhrDelta: avg(rhrDeltas),
      avgSleep:    sleeps.length ? +(avg(sleeps) / 60).toFixed(1) : null, // minutes -> hours
      hrvMean:     avg(hrvVals),
    };
  }, [recoveryData]);

  // ── unique types for legend ───────────────────────────────────────────────────
  const uniqueTypes = useMemo(
    () => [...new Set(recoveryData.map((r) => r.type))],
    [recoveryData],
  );

  // ── no data guard ─────────────────────────────────────────────────────────────
  if (!recoveryData.length) {
    return (
      <div
        className="chart-card"
        role="region"
        aria-label={t?.('recovery.title') ?? 'Exercise-Recovery Analysis'}
        style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}
      >
        {t?.('recovery.title') ?? 'Exercise-Recovery Analysis'} — {t?.('app.loading') ?? 'No data available'}
      </div>
    );
  }

  // ── derived display values for stat cards ──────────────────────────────────
  const hrvDeltaLabel = avgHrvDelta != null
    ? `${avgHrvDelta >= 0 ? '+' : ''}${avgHrvDelta} ms ${t?.('recovery.afterWorkout') ?? 'after workout'}`
    : undefined;
  const rhrDeltaLabel = avgRhrDelta != null
    ? `${avgRhrDelta >= 0 ? '+' : ''}${avgRhrDelta} bpm ${t?.('recovery.afterWorkout') ?? 'after workout'}`
    : undefined;
  const sleepLabel = avgSleep != null
    ? `${avgSleep} h ${t?.('recovery.nextDay') ?? 'next day'}`
    : undefined;

  return (
    <div className="chart-card" role="region" aria-label={t?.('recovery.title') ?? 'Exercise-Recovery Analysis'}>

      {/* ── section header ───────────────────────────────────────────────── */}
      <div className="chart-card-header">
        <div>
          <h3 className="section-title">{t?.('recovery.title') ?? 'Exercise-Recovery Analysis'}</h3>
          <p className="chart-card-title">{t?.('recovery.subtitle') ?? 'How workouts affect next-day recovery'}</p>
        </div>
      </div>

      {/* ── Row 1: summary stat cards ────────────────────────────────────── */}
      <div className="stat-grid-4" style={{ marginBottom: '24px' }} role="region" aria-label="Recovery summary stats">
        <StatCard
          label={t?.('recovery.avgHrvChange') ?? 'Avg HRV Change'}
          value={avgHrvDelta != null ? `${avgHrvDelta >= 0 ? '+' : ''}${avgHrvDelta}` : null}
          unit="ms"
          trend={avgHrvDelta != null ? (avgHrvDelta >= 0 ? 'up' : 'down') : undefined}
          badTrend={false}
          trendLabel={hrvDeltaLabel}
          color="var(--color-hrv)"
        />
        <StatCard
          label={t?.('recovery.avgRhrChange') ?? 'Avg RHR Change'}
          value={avgRhrDelta != null ? `${avgRhrDelta >= 0 ? '+' : ''}${avgRhrDelta}` : null}
          unit="bpm"
          trend={avgRhrDelta != null ? (avgRhrDelta > 0 ? 'up' : 'down') : undefined}
          badTrend={avgRhrDelta != null && avgRhrDelta > 0}
          trendLabel={rhrDeltaLabel}
          color="var(--color-heart)"
        />
        <StatCard
          label={t?.('recovery.avgRecoverySleep') ?? 'Avg Recovery Sleep'}
          value={avgSleep}
          unit="h"
          trendLabel={sleepLabel}
          color="var(--color-sleep)"
        />
        <StatCard
          label={t?.('recovery.workoutsAnalyzed') ?? 'Workouts Analyzed'}
          value={recoveryData.length}
          unit=""
          trendLabel={uniqueTypes.length > 0 ? uniqueTypes.slice(0, 2).join(' · ') : undefined}
          color="var(--color-activity)"
        />
      </div>

      {/* ── Row 2: scatter — duration vs next-day HRV ────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <p className="chart-card-title" style={{ marginBottom: '4px' }}>
          {t?.('recovery.durationVsHrv') ?? 'Duration vs Next-Day HRV'}
        </p>
        <p className="chart-card-sub" style={{ marginBottom: '16px' }}>
          {t?.('recovery.durationVsHrvSub') ?? 'Each dot is one workout. Color = workout type.'}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 16, left: 0 }}>
            <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" />
            <XAxis
              type="number"
              dataKey="duration"
              name={t?.('activity.duration') ?? 'Duration'}
              {...theme.xAxis}
              label={{
                value: t?.('activity.duration') ?? 'Duration (min)',
                position: 'insideBottom',
                offset: -6,
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
              domain={['auto', 'auto']}
              unit=" min"
            />
            <YAxis
              type="number"
              dataKey="nextHRV"
              name="HRV"
              {...theme.yAxis}
              unit=" ms"
              width={52}
              domain={['auto', 'auto']}
              label={{
                value: t?.('recovery.nextDay') ?? 'Next-day HRV (ms)',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
            />
            <Tooltip
              content={(props) => <ScatterTooltip {...props} t={t} />}
              cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-strong)' }}
            />
            {hrvMean != null && (
              <ReferenceLine
                y={hrvMean}
                yAxisId={0}
                {...theme.referenceLine}
                label={{
                  value: `HRV avg ${hrvMean} ms`,
                  fill: 'var(--text-muted)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}
            <Scatter
              data={recoveryData.filter((r) => r.nextHRV != null)}
              name="Workouts"
            >
              {recoveryData
                .filter((r) => r.nextHRV != null)
                .map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getTypeColor(entry.type)} fillOpacity={0.8} />
                ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <TypeLegend types={uniqueTypes} />
      </div>

      {/* ── Row 3: timeline — workout duration bars + HRV & RHR lines ────── */}
      <div>
        <p className="chart-card-title" style={{ marginBottom: '4px' }}>
          {t?.('recovery.timeline') ?? 'Recovery Timeline'}
        </p>
        <p className="chart-card-sub" style={{ marginBottom: '16px' }}>
          {t?.('recovery.timelineSub') ?? 'Workout duration (bars) with next-day HRV and RHR trend'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={recoveryData} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="label"
              {...theme.xAxis}
              tick={{ ...theme.xAxis.tick, fontSize: 10 }}
              interval="preserveStartEnd"
            />
            {/* Left Y axis: duration */}
            <YAxis
              yAxisId="duration"
              orientation="left"
              {...theme.yAxis}
              width={44}
              unit=" min"
              domain={[0, 'auto']}
              label={{
                value: t?.('activity.duration') ?? 'Duration (min)',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                fill: 'var(--text-muted)',
                fontSize: 10,
              }}
            />
            {/* Right Y axis: HRV ms */}
            <YAxis
              yAxisId="hrv"
              orientation="right"
              {...theme.yAxis}
              width={52}
              unit=" ms"
              domain={['auto', 'auto']}
              label={{
                value: 'HRV / RHR',
                angle: 90,
                position: 'insideRight',
                offset: 12,
                fill: 'var(--text-muted)',
                fontSize: 10,
              }}
            />
            <Tooltip content={(props) => <TimelineTooltip {...props} t={t} />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
            />

            {/* workout duration bar (background, low opacity) */}
            <Bar
              yAxisId="duration"
              dataKey="duration"
              name={t?.('activity.duration') ?? 'Duration'}
              fill="var(--color-activity)"
              fillOpacity={0.2}
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />

            {/* HRV mean reference line */}
            {hrvMean != null && (
              <ReferenceLine
                yAxisId="hrv"
                y={hrvMean}
                {...theme.referenceLine}
                label={{
                  value: `HRV avg ${hrvMean} ms`,
                  fill: 'var(--text-muted)',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* next-day HRV line */}
            <Line
              yAxisId="hrv"
              type="monotone"
              dataKey="nextHRV"
              name={`${t?.('recovery.nextDay') ?? 'Next day'} HRV`}
              stroke="var(--color-hrv)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-hrv)', stroke: 'none' }}
              activeDot={theme.activeDot('var(--color-hrv)')}
              connectNulls
            />

            {/* next-day RHR line */}
            <Line
              yAxisId="hrv"
              type="monotone"
              dataKey="nextRHR"
              name={`${t?.('recovery.nextDay') ?? 'Next day'} RHR`}
              stroke="var(--color-heart)"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ r: 2, fill: 'var(--color-heart)', stroke: 'none' }}
              activeDot={theme.activeDot('var(--color-heart)')}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ExerciseRecoveryChart;
