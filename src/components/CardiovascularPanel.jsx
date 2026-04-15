/**
 * CardiovascularPanel
 *
 * Props:
 *   data    - parsed cardiovascular.json (see shape below)
 *   overview - user overview object (optional, reserved for future header use)
 *
 * data shape:
 * {
 *   rhr:        { daily, monthly: [{month, mean, min, max}], stats: {mean, min, max, latest, latestDate} }
 *   hrv:        { daily, monthly: [{month, mean}],          stats: {mean, nightMean, dayMean, latest, latestDate} }
 *   vo2max:     { records: [{date, value}],                  stats: {latest, latestDate, peak, mean} }
 *   walkingHR:  { monthly: [{month, mean}] }
 *   hrHourly:   [{hour, mean, median}]
 *   spo2:       { stats: {mean, below95pct} }
 * }
 */

import {
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import StatCard from './StatCard';
import ExerciseRecoveryChart from './ExerciseRecoveryChart';
import { getChartTheme } from '../chartTheme';
import { fmtMonth, fmtDate, fmtHour, filterByDateRange } from '../utils/dataUtils';
import { useDateRange } from '../contexts/useDateRange';

// ─── sub-components ───────────────────────────────────────────────────────────

/** RHR band chart: mean line + min/max area */
function RHRChart({ monthly, overallMean }) {
  const theme = getChartTheme();
  const data = (monthly || []).map((d) => ({
    month: fmtMonth(d.month),
    mean: d.mean != null ? +d.mean.toFixed(1) : null,
    min:  d.min  != null ? +d.min             : null,
    max:  d.max  != null ? +d.max             : null,
    range: d.min != null && d.max != null ? [d.min, d.max] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rhrBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={theme.colors.heart} stopOpacity={0.18} />
            <stop offset="60%"  stopColor={theme.colors.heart} stopOpacity={0.04} />
            <stop offset="100%" stopColor={theme.colors.heart} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="month"
          {...theme.xAxis}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          unit=" bpm"
          width={58}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={theme.tooltip.cursor}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload || {};
            return (
              <div style={theme.tooltip.contentStyle}>
                <p style={{ ...theme.tooltip.labelStyle, margin: '0 0 6px 0' }}>{label}</p>
                <p style={{ margin: '2px 0', color: theme.colors.heart }}>Mean: {p.mean} bpm</p>
                <p style={{ margin: '2px 0', color: 'var(--text-muted)' }}>Min: {p.min} bpm</p>
                <p style={{ margin: '2px 0', color: 'var(--text-muted)' }}>Max: {p.max} bpm</p>
              </div>
            );
          }}
        />
        {/* min–max shaded band */}
        <Area
          type="monotone"
          dataKey="range"
          fill="url(#rhrBandGrad)"
          stroke="none"
          connectNulls
          legendType="none"
          name="range"
        />
        {/* mean line */}
        <Line
          type="monotone"
          dataKey="mean"
          stroke={theme.colors.heart}
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot(theme.colors.heart)}
          name="Mean RHR"
          connectNulls
        />
        {overallMean != null && (
          <ReferenceLine
            y={overallMean}
            {...theme.referenceLine}
            label={{ value: `avg ${overallMean}`, fill: 'var(--text-muted)', fontSize: 11, position: 'insideTopRight' }}
          />
        )}
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)', paddingTop: '8px' }}
          formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** HRV monthly mean line */
function HRVChart({ monthly, overallMean }) {
  const theme = getChartTheme();
  const data = (monthly || []).map((d) => ({
    month: fmtMonth(d.month),
    mean:  d.mean != null ? +d.mean.toFixed(1) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="month"
          {...theme.xAxis}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          unit=" ms"
          width={52}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={theme.tooltip.cursor}
          formatter={(val) => [`${val} ms`, 'HRV SDNN']}
        />
        {overallMean != null && (
          <ReferenceLine
            y={overallMean}
            {...theme.referenceLine}
            label={{ value: `avg ${overallMean}`, fill: 'var(--text-muted)', fontSize: 11, position: 'insideTopRight' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="mean"
          stroke={theme.colors.hrv}
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot(theme.colors.hrv)}
          name="HRV SDNN"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** VO2Max scatter points connected by line */
function VO2MaxChart({ records, peak, mean }) {
  const theme = getChartTheme();
  const data = (records || []).map((d) => ({
    date:  d.date,
    label: fmtDate(d.date),
    value: d.value != null ? +d.value.toFixed(1) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="label"
          {...theme.xAxis}
          tick={{ ...theme.xAxis.tick, fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          width={36}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={theme.tooltip.cursor}
          formatter={(val) => [val, 'VO2Max']}
        />
        {peak != null && (
          <ReferenceLine
            y={peak}
            {...theme.referenceLine}
            label={{ value: `peak ${peak}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        {mean != null && (
          <ReferenceLine
            y={mean}
            {...theme.referenceLine}
            strokeOpacity={0.35}
            label={{ value: `avg ${mean}`, fill: 'var(--text-muted)', fontSize: 10, position: 'insideBottomRight' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={theme.colors.vo2}
          strokeWidth={2}
          dot={{ r: 3, fill: theme.colors.vo2, stroke: 'none' }}
          activeDot={theme.activeDot(theme.colors.vo2)}
          name="VO2Max"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 24-hour HR profile bar chart */
function HRHourlyChart({ hrHourly }) {
  const theme = getChartTheme();
  const data = (hrHourly || []).map((d) => ({
    label: fmtHour(d.hour),
    hour:  d.hour,
    mean:  d.mean   != null ? +d.mean.toFixed(0)   : null,
    median:d.median != null ? +d.median.toFixed(0) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barSize={10}>
        <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="label"
          {...theme.xAxis}
          tick={{ ...theme.xAxis.tick, fontSize: 10 }}
          interval={2}
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          unit=" bpm"
          width={58}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={{ fill: 'var(--border-subtle)' }}
          formatter={(val, name) => [`${val} bpm`, name === 'mean' ? 'Mean HR' : 'Median HR']}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          formatter={(value) => (
            <span style={{ color: 'var(--text-muted)' }}>
              {value === 'mean' ? 'Mean HR' : 'Median HR'}
            </span>
          )}
        />
        <Bar dataKey="mean"   fill={theme.colors.heart} fillOpacity={0.85} radius={[2, 2, 0, 0]} name="mean" />
        <Bar dataKey="median" fill={theme.colors.spo2}  fillOpacity={0.6}  radius={[2, 2, 0, 0]} name="median" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Walking HR monthly trend */
function WalkingHRChart({ monthly }) {
  const theme = getChartTheme();
  const data = (monthly || []).map((d) => ({
    month: fmtMonth(d.month),
    mean:  d.mean != null ? +d.mean.toFixed(1) : null,
  }));

  // Resolve the CSS variable value for use in the gradient stop color attribute
  // (SVG stopColor doesn't support CSS vars directly in all browsers)
  const walkColor = theme.colors.activity;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="walkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={walkColor} stopOpacity={0.18} />
            <stop offset="60%"  stopColor={walkColor} stopOpacity={0.04} />
            <stop offset="100%" stopColor={walkColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="month"
          {...theme.xAxis}
          interval="preserveStartEnd"
        />
        <YAxis
          {...theme.yAxis}
          domain={['auto', 'auto']}
          unit=" bpm"
          width={58}
        />
        <Tooltip
          contentStyle={theme.tooltip.contentStyle}
          labelStyle={theme.tooltip.labelStyle}
          itemStyle={theme.tooltip.itemStyle}
          cursor={theme.tooltip.cursor}
          formatter={(val) => [`${val} bpm`, 'Walking HR']}
        />
        <Area
          type="monotone"
          dataKey="mean"
          stroke={walkColor}
          strokeWidth={2}
          fill="url(#walkGrad)"
          dot={false}
          activeDot={theme.activeDot(walkColor)}
          name="Walking HR"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function CardiovascularPanel({ data, workouts, sleepNightly, t }) {
  const { startDate, endDate } = useDateRange();

  if (!data) {
    return (
      <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>
        Loading cardiovascular data…
      </div>
    );
  }

  const theme = getChartTheme();
  const { rhr, hrv, vo2max, walkingHR, hrHourly, spo2 } = data;

  // Filtered chart data — stat cards always use all-time stats above
  const rhrMonthlyFiltered   = filterByDateRange(rhr?.monthly,                startDate, endDate, 'month');
  const hrvMonthlyFiltered   = filterByDateRange(hrv?.monthly,                startDate, endDate, 'month');
  const vo2RecordsFiltered   = filterByDateRange(vo2max?.records,             startDate, endDate);
  const walkingHRFiltered    = filterByDateRange(walkingHR?.monthly,          startDate, endDate, 'month');
  const filteredRespMonthly  = filterByDateRange(data.respiratory?.monthly,   startDate, endDate, 'month');

  // ── stat card derived values ──────────────────────────────────────────────
  const rhrLatest   = rhr?.stats?.latest  ?? null;
  const rhrMean     = rhr?.stats?.mean    ?? null;
  // For RHR, lower is better: if latest < mean → trend down (good)
  const rhrTrendDir = rhrLatest != null && rhrMean != null
    ? (rhrLatest < rhrMean ? 'down' : rhrLatest > rhrMean ? 'up' : 'neutral')
    : undefined;
  const rhrDelta    = rhrLatest != null && rhrMean != null
    ? +(rhrLatest - rhrMean).toFixed(1)
    : null;
  const rhrTrendLabel = rhrDelta != null
    ? `${rhrDelta >= 0 ? '+' : ''}${rhrDelta} ${t?.('cardio.vsMean') ?? 'vs mean'} ${rhrMean} bpm`
    : undefined;

  const hrvLatest   = hrv?.stats?.latest     ?? null;
  const hrvNight    = hrv?.stats?.nightMean  ?? null;
  const hrvDay      = hrv?.stats?.dayMean    ?? null;
  const hrvNightDay = hrvNight != null && hrvDay != null
    ? `${t?.('cardio.nightDay') ?? 'Night'} ${hrvNight} ms / ${t?.('cardio.dayLabel') ?? 'Day'} ${hrvDay} ms`
    : undefined;

  const vo2Latest   = vo2max?.stats?.latest ?? null;
  const vo2Peak     = vo2max?.stats?.peak   ?? null;
  // For VO2Max, higher is better; latest vs peak (peak is best ever)
  const vo2TrendDir = vo2Latest != null && vo2Peak != null
    ? (vo2Latest >= vo2Peak ? 'up' : 'down')
    : undefined;
  const vo2Delta    = vo2Latest != null && vo2Peak != null
    ? +(vo2Latest - vo2Peak).toFixed(1)
    : null;
  const vo2TrendLabel = vo2Delta != null
    ? `${vo2Delta >= 0 ? '+' : ''}${vo2Delta} ${t?.('cardio.vsPeak') ?? 'vs peak'} ${vo2Peak}`
    : undefined;

  const spo2Mean    = spo2?.stats?.mean     ?? null;
  const spo2Below   = spo2?.stats?.below95pct ?? null;

  return (
    <div className="panel" role="main" aria-label="Cardiovascular Health Panel">

      {/* ── Row 1: stat cards ─────────────────────────────────────────── */}
      <div className="stat-grid-4" role="region" aria-label="Key cardiovascular stats">
        <StatCard
          label={t?.('cardio.rhr') ?? 'Resting Heart Rate'}
          value={rhrLatest}
          unit="bpm"
          trend={rhrTrendDir}
          badTrend={rhrTrendDir === 'up'}
          trendLabel={rhrTrendLabel}
          color="var(--color-heart)"
        />
        <StatCard
          label={t?.('cardio.hrv') ?? 'HRV SDNN'}
          value={hrvLatest}
          unit="ms"
          trendLabel={hrvNightDay}
          color="var(--color-hrv)"
        />
        <StatCard
          label={t?.('cardio.vo2') ?? 'VO2 Max'}
          value={vo2Latest}
          unit="mL/kg/min"
          trend={vo2TrendDir}
          badTrend={false}
          trendLabel={vo2TrendLabel}
          color="var(--color-vo2)"
        />
        <StatCard
          label={t?.('cardio.spo2') ?? 'SpO2'}
          value={spo2Mean != null ? spo2Mean.toFixed(1) : null}
          unit="%"
          trendLabel={spo2Below != null ? `${spo2Below}% ${t?.('cardio.below95') ?? 'below 95%'}` : undefined}
          color="var(--color-spo2)"
        />
      </div>

      {/* ── Row 2: RHR trend ──────────────────────────────────────────── */}
      <div className="chart-card" role="region" aria-label="Resting heart rate trend chart">
        <div className="chart-card-header">
          <div>
            <h3 className="section-title">{t?.('cardio.rhr') ?? 'Resting Heart Rate'}</h3>
            <p className="chart-card-title">{t?.('cardio.rhrTrend') ?? 'Monthly Mean Trend'}</p>
            <p className="chart-card-sub">{t?.('cardio.rhrBandSub') ?? 'Band shows monthly min–max range'}</p>
          </div>
        </div>
        <RHRChart
          monthly={rhrMonthlyFiltered}
          overallMean={rhrMean != null ? +rhrMean.toFixed(1) : null}
        />
      </div>

      {/* ── Row 3: HRV trend ──────────────────────────────────────────── */}
      <div className="chart-card" role="region" aria-label="HRV trend chart">
        <div className="chart-card-header">
          <div>
            <h3 className="section-title">{t?.('cardio.hrvTitle') ?? 'Heart Rate Variability'}</h3>
            <p className="chart-card-title">{t?.('cardio.hrvSubtitle') ?? 'SDNN Monthly Mean'}</p>
          </div>
        </div>
        <HRVChart
          monthly={hrvMonthlyFiltered}
          overallMean={hrv?.stats?.mean != null ? +hrv.stats.mean.toFixed(1) : null}
        />
      </div>

      {/* ── Row 4: VO2Max + hourly HR ─────────────────────────────────── */}
      <div className="two-col">
        <div className="chart-card" role="region" aria-label="VO2 Max history chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('cardio.vo2') ?? 'VO2 Max'}</h3>
              <p className="chart-card-title">{t?.('cardio.vo2History') ?? 'History'}</p>
              {vo2max?.stats?.latestDate && (
                <p className="chart-card-sub">Latest: {fmtDate(vo2max.stats.latestDate)}</p>
              )}
            </div>
          </div>
          <VO2MaxChart
            records={vo2RecordsFiltered}
            peak={vo2Peak}
            mean={vo2max?.stats?.mean != null ? +vo2max.stats.mean.toFixed(1) : null}
          />
        </div>

        <div className="chart-card" role="region" aria-label="24 hour heart rate profile chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('cardio.hrProfile') ?? '24-Hour HR Profile'}</h3>
              <p className="chart-card-title">{t?.('cardio.hrProfileSub') ?? 'Mean and Median by Hour'}</p>
            </div>
          </div>
          <HRHourlyChart hrHourly={hrHourly} />
        </div>
      </div>

      {/* ── Row 5: Walking HR ─────────────────────────────────────────── */}
      <div className="chart-card" role="region" aria-label="Walking heart rate trend chart">
        <div className="chart-card-header">
          <div>
            <h3 className="section-title">{t?.('cardio.walkingHR') ?? 'Walking Heart Rate'}</h3>
            <p className="chart-card-title">{t?.('cardio.walkingHRTrend') ?? 'Monthly Mean Trend'}</p>
          </div>
        </div>
        <WalkingHRChart monthly={walkingHRFiltered} />
      </div>

      {/* ── Row 6: SpO2 Hourly Profile ────────────────────────────────── */}
      {data.spo2?.hourly?.length > 0 && (
        <div className="chart-card" role="region" aria-label="SpO2 24-hour profile chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('cardio.spo2') ?? 'SpO2'}</h3>
              <p className="chart-card-title">{t?.('cardio.spo2Hourly') ?? '24-Hour SpO2 Profile'}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.spo2.hourly} barCategoryGap="20%">
              <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" {...theme.xAxis} tickFormatter={(h) => fmtHour(h)} />
              <YAxis {...theme.yAxis} domain={[90, 100]} />
              <Tooltip contentStyle={theme.tooltip.contentStyle} labelStyle={theme.tooltip.labelStyle} />
              <Bar dataKey="mean" fill="var(--color-spo2)" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={20} name="Mean SpO2 %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row 7: Respiratory Rate Monthly Trend ────────────────────── */}
      {data.respiratory?.monthly?.length > 0 && (
        <div className="chart-card" role="region" aria-label="Respiratory rate monthly trend chart">
          <div className="chart-card-header">
            <div>
              <h3 className="section-title">{t?.('cardio.respiratory') ?? 'Respiratory Rate'}</h3>
              <p className="chart-card-title">{t?.('cardio.respiratoryTrend') ?? 'Monthly Mean Trend'}</p>
              <p className="chart-card-sub">
                {t?.('cardio.respiratorySub')
                  ? `Overall: ${data.respiratory.stats?.mean ?? '--'} · Night: ${data.respiratory.stats?.nightMean ?? '--'} ${t('cardio.respiratorySub')}`
                  : `Overall: ${data.respiratory.stats?.mean ?? '--'} · Night: ${data.respiratory.stats?.nightMean ?? '--'} breaths/min`}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filteredRespMonthly}>
              <defs>
                <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-spo2)" stopOpacity={0.18} />
                  <stop offset="60%" stopColor="var(--color-spo2)" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="var(--color-spo2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.grid.stroke} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="month" {...theme.xAxis} tickFormatter={(m) => fmtMonth(m)} />
              <YAxis {...theme.yAxis} />
              <Tooltip contentStyle={theme.tooltip.contentStyle} labelStyle={theme.tooltip.labelStyle} />
              <Area type="monotone" dataKey="mean" stroke="var(--color-spo2)" fill="url(#respGrad)" strokeWidth={2} dot={false} activeDot={theme.activeDot('var(--color-spo2)')} name="Breaths/min" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row 8: Exercise-Recovery Correlation ──────────────────────── */}
      <ExerciseRecoveryChart
        workouts={workouts}
        hrvDaily={data.hrv?.daily}
        rhrDaily={data.rhr?.daily}
        sleepNightly={sleepNightly}
        t={t}
      />

    </div>
  );
}

export default CardiovascularPanel;
