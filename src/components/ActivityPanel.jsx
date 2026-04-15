/**
 * ActivityPanel - displays activity, workout, body composition data
 *
 * Usage:
 * import activityData from '../data/activity.json'
 * <ActivityPanel data={activityData} />
 */

import { useMemo } from 'react';
import StatCard from './StatCard';
import CalendarHeatmap from './CalendarHeatmap';
import AchievementBadges from './AchievementBadges';
import { getChartTheme } from '../chartTheme';
import { fmtDateShortZh as formatDate, fmtMonthShortZh as formatMonth, filterByDateRange } from '../utils/dataUtils';
import { useDateRange } from '../contexts/useDateRange';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

function classifyHRZone(avgHR) {
  if (avgHR == null) return null;
  if (avgHR < 112) return 'Z1';
  if (avgHR < 131) return 'Z2';
  if (avgHR < 150) return 'Z3';
  if (avgHR < 169) return 'Z4';
  return 'Z5';
}

// Zone colors use CSS variables so they adapt to light/dark mode.
// We read them at render time via getChartTheme() rather than hardcoding hex.
const ZONE_CSS_VARS = {
  Z1: 'var(--color-hrv)',
  Z2: 'var(--color-activity)',
  Z3: 'var(--color-vo2)',
  Z4: 'var(--color-risk)',
  Z5: 'var(--color-heart)',
};

const ZONE_LABELS = {
  Z1: 'Z1 <112',
  Z2: 'Z2 112-131',
  Z3: 'Z3 131-150',
  Z4: 'Z4 150-169',
  Z5: 'Z5 169+',
};

// ─── custom tooltip components ───────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  const theme = getChartTheme();
  return (
    <div style={theme.tooltip.contentStyle}>
      <div style={theme.tooltip.labelStyle}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ ...theme.tooltip.itemStyle, color: p.color || 'var(--text-primary)' }}>
          {p.value != null ? `${p.value}${unit}` : '--'}
        </div>
      ))}
    </div>
  );
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const theme = getChartTheme();
  return (
    <div style={theme.tooltip.contentStyle}>
      <div style={theme.tooltip.labelStyle}>{formatDate(d.date)}</div>
      <div style={theme.tooltip.itemStyle}>时长: {d.duration} min</div>
      {d.swimDistance != null && <div style={theme.tooltip.itemStyle}>距离: {d.swimDistance} m</div>}
      {d.avgHR != null && <div style={theme.tooltip.itemStyle}>均HR: {d.avgHR} bpm</div>}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MonthlyStepsChart({ data }) {
  if (!data?.length) return <p className="chart-empty" style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} />
        <Tooltip content={<ChartTooltip unit=" 步" />} />
        <ReferenceLine
          y={8000}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: '目标 8000', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <Bar dataKey="mean" fill={theme.colors.activity} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthlyWorkoutChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit=" 次" />} />
        <Bar dataKey="count" fill={theme.colors.vo2} radius={[4, 4, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BodyWeightChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  // sample to ~60 pts to avoid chart overload
  const step = Math.max(1, Math.floor(data.length / 60));
  const chartData = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => ({ name: formatDate(d.date), value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} interval="preserveStartEnd" />
        <YAxis
          {...theme.yAxis}
          domain={['dataMin - 1', 'dataMax + 1']}
        />
        <Tooltip content={<ChartTooltip unit=" kg" />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={theme.colors.heart}
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot(theme.colors.heart)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RecentWorkoutsTable({ workouts, t }) {
  if (!workouts?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无训练记录</p>;
  const recent = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

  const headers = t?.('activity.tableHeaders') ?? ['日期', '类型', '时长(min)', '距离(m)', '卡路里', '均心率', '最大心率'];
  const workoutTypes = t?.('activity.workoutTypes') ?? {};

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" aria-label="最近训练记录">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recent.map((w, i) => {
            const isSwim = w.type === 'Swimming' || (typeof w.type === 'string' && w.type.toLowerCase().includes('swim'));
            const dist = isSwim ? (w.swimDistance ?? w.distance ?? '--') : (w.distance ?? '--');
            const displayType = workoutTypes[w.type] ?? w.type;
            return (
              <tr key={`${w.date}-${i}`} className={isSwim ? 'row-highlight' : ''}>
                <td>{formatDate(w.date)}</td>
                <td className={isSwim ? 'cell-accent' : ''}>{displayType}</td>
                <td>{w.duration ?? '--'}</td>
                <td>{dist}</td>
                <td>{w.calories ?? '--'}</td>
                <td>{w.avgHR ?? '--'}</td>
                <td>{w.maxHR ?? '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SwimDurationScatter({ swimWorkouts }) {
  if (!swimWorkouts?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无游泳数据</p>;
  const theme = getChartTheme();
  const data = swimWorkouts.map((w) => ({
    date: w.date,
    duration: w.duration,
    swimDistance: w.swimDistance,
    avgHR: w.avgHR,
    x: new Date(w.date).getTime(),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} vertical={true} />
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          {...theme.xAxis}
          tickFormatter={(v) => formatDate(new Date(v).toISOString().slice(0, 10))}
          tickCount={5}
        />
        <YAxis dataKey="duration" {...theme.yAxis} unit=" min" />
        <Tooltip content={<ScatterTooltip />} />
        <Scatter data={data} fill={theme.colors.activity}>
          {data.map((entry, i) => (
            <Cell key={i} fill={theme.colors.activity} opacity={0.8} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function SwimHRZoneChart({ swimWorkouts }) {
  if (!swimWorkouts?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无游泳数据</p>;
  const theme = getChartTheme();

  const counts = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  swimWorkouts.forEach((w) => {
    const zone = classifyHRZone(w.avgHR);
    if (zone) counts[zone]++;
  });

  // Use theme.colors for zone fills so they are resolved CSS variable values
  const ZONE_THEME_KEYS = {
    Z1: theme.colors.hrv,
    Z2: theme.colors.activity,
    Z3: theme.colors.vo2,
    Z4: theme.colors.risk,
    Z5: theme.colors.heart,
  };

  const chartData = Object.keys(counts).map((z) => ({
    zone: ZONE_LABELS[z],
    count: counts[z],
    color: ZONE_THEME_KEYS[z],
    key: z,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 10, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid {...theme.grid} horizontal={false} />
        <XAxis type="number" {...theme.xAxis} allowDecimals={false} />
        <YAxis type="category" dataKey="zone" {...theme.yAxis} width={80} />
        <Tooltip content={<ChartTooltip unit=" 次" />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExerciseTimeChart({ data, recommendedLabel }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" min" />
        <Tooltip content={<ChartTooltip unit=" min" />} />
        <ReferenceLine
          y={30}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: recommendedLabel ?? '推荐 30min', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <Bar dataKey="mean" fill="var(--color-hrv)" radius={[4, 4, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StandHoursChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  const gradientId = 'standHoursGradient';
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-activity)" stopOpacity={0.35} />
            <stop offset="50%" stopColor="var(--color-activity)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-activity)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" h" />
        <Tooltip content={<ChartTooltip unit=" h" />} />
        <Area
          type="monotone"
          dataKey="mean"
          stroke="var(--color-activity)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={theme.activeDot('var(--color-activity)')}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── new metric sub-components ───────────────────────────────────────────────

function DaylightChart({ data, targetLabel }) {
  if (!data?.length) return <p className="chart-empty" style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  const gradientId = 'daylightGradient';
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-vo2)" stopOpacity={0.4} />
            <stop offset="50%" stopColor="var(--color-vo2)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-vo2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" min" />
        <Tooltip content={<ChartTooltip unit=" min" />} />
        <ReferenceLine
          y={30}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: targetLabel ?? '30 min', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <Area
          type="monotone"
          dataKey="mean"
          stroke="var(--color-vo2)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={theme.activeDot('var(--color-vo2)')}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function WalkingSpeedChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" m/s" domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip unit=" m/s" />} />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="var(--color-activity)"
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot('var(--color-activity)')}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StepLengthChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" cm" domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip unit=" cm" />} />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="var(--color-hrv)"
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot('var(--color-hrv)')}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WalkingAsymmetryChart({ data, thresholdLabel }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit="%" domain={[0, 'auto']} />
        <Tooltip content={<ChartTooltip unit="%" />} />
        <ReferenceLine
          y={10}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: thresholdLabel ?? '10%', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="var(--color-risk)"
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot('var(--color-risk)')}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function HeadphoneExposureChart({ data, safeLimitLabel }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean, max: d.max }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" dB" domain={[0, 'auto']} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const t2 = getChartTheme();
            return (
              <div style={t2.tooltip.contentStyle}>
                <div style={t2.tooltip.labelStyle}>{label}</div>
                {payload.map((p, i) => (
                  <div key={i} style={{ ...t2.tooltip.itemStyle, color: p.color || 'var(--text-primary)' }}>
                    {p.name}: {p.value != null ? `${p.value} dB` : '--'}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <ReferenceLine
          y={80}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: safeLimitLabel ?? 'WHO 80 dB', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <Bar dataKey="mean" name="Mean" fill="var(--color-sleep)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="max" name="Max" fill="var(--color-sleep)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BodyCompositionTrendChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const step = Math.max(1, Math.floor(data.length / 60));
  const chartData = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => ({ name: formatDate(d.date), bodyFat: d.bodyFat, skeletalMuscle: d.skeletalMuscle, bodyWater: d.bodyWater }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} interval="preserveStartEnd" />
        <YAxis {...theme.yAxis} unit="%" domain={['auto', 'auto']} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const t2 = getChartTheme();
            return (
              <div style={t2.tooltip.contentStyle}>
                <div style={t2.tooltip.labelStyle}>{label}</div>
                {payload.map((p, i) => (
                  <div key={i} style={{ ...t2.tooltip.itemStyle, color: p.color }}>
                    {p.name}: {p.value != null ? `${p.value}%` : '--'}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend
          formatter={(value) => {
            const map = { bodyFat: 'Body Fat', skeletalMuscle: 'Skeletal Muscle', bodyWater: 'Body Water' };
            return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{map[value] ?? value}</span>;
          }}
        />
        <Line type="monotone" dataKey="bodyFat" name="bodyFat" stroke="var(--color-heart)" strokeWidth={2} dot={false} activeDot={theme.activeDot('var(--color-heart)')} />
        <Line type="monotone" dataKey="skeletalMuscle" name="skeletalMuscle" stroke="var(--color-activity)" strokeWidth={2} dot={false} activeDot={theme.activeDot('var(--color-activity)')} />
        <Line type="monotone" dataKey="bodyWater" name="bodyWater" stroke="var(--color-hrv)" strokeWidth={2} dot={false} activeDot={theme.activeDot('var(--color-hrv)')} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ArboleafLatestCard({ record, t }) {
  if (!record) return null;
  const labels = t?.('activity.arboleafLabels') ?? {};
  const items = [
    { key: 'weight',         value: record.weight,         unit: 'kg' },
    { key: 'bodyFat',        value: record.bodyFat,        unit: '%' },
    { key: 'bmi',            value: record.bmi,            unit: '' },
    { key: 'skeletalMuscle', value: record.skeletalMuscle, unit: '%' },
    { key: 'muscleMass',     value: record.muscleMass,     unit: 'kg' },
    { key: 'protein',        value: record.protein,        unit: '%' },
    { key: 'bmr',            value: record.bmr,            unit: 'kcal' },
    { key: 'leanMass',       value: record.leanMass,       unit: 'kg' },
    { key: 'subcutaneousFat',value: record.subcutaneousFat,unit: '%' },
    { key: 'visceralFat',    value: record.visceralFat,    unit: '' },
    { key: 'bodyWater',      value: record.bodyWater,      unit: '%' },
    { key: 'boneMass',       value: record.boneMass,       unit: 'kg' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
      {items.map(({ key, value, unit }) => (
        <div
          key={key}
          style={{
            background: 'var(--bg-inset)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            {labels[key] ?? key}
          </div>
          <div style={{ color: 'var(--text-heading)', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>
            {value ?? '--'}
            {unit && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 3 }}>{unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlightsMonthlyChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} />
        <Tooltip content={<ChartTooltip unit=" 层" />} />
        <Bar dataKey="mean" fill="var(--color-hrv)" radius={[4, 4, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BasalEnergyMonthlyChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({ name: formatMonth(d.month), mean: d.mean }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis dataKey="name" {...theme.xAxis} />
        <YAxis {...theme.yAxis} unit=" kcal" domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip unit=" kcal" />} />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="var(--color-risk)"
          strokeWidth={2}
          dot={false}
          activeDot={theme.activeDot('var(--color-risk)')}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WalkingSteadinessChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({
    date: d.date,
    value: d.value,
    x: new Date(d.date).getTime(),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          {...theme.xAxis}
          tickFormatter={(v) => formatDate(new Date(v).toISOString().slice(0, 10))}
          tickCount={5}
        />
        <YAxis dataKey="value" {...theme.yAxis} unit="%" domain={[0, 100]} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            const t2 = getChartTheme();
            return (
              <div style={t2.tooltip.contentStyle}>
                <div style={t2.tooltip.labelStyle}>{formatDate(d.date)}</div>
                <div style={t2.tooltip.itemStyle}>{d.value != null ? `${d.value}%` : '--'}</div>
              </div>
            );
          }}
        />
        <ReferenceLine
          y={80}
          stroke={theme.referenceLine.stroke}
          strokeDasharray={theme.referenceLine.strokeDasharray}
          strokeOpacity={theme.referenceLine.strokeOpacity}
          label={{ value: 'OK 80%', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
        />
        <ReferenceLine
          y={50}
          stroke="var(--color-heart)"
          strokeDasharray="4 3"
          strokeOpacity={0.6}
          label={{ value: 'Low 50%', fill: 'var(--color-heart)', fontSize: 11, position: 'right' }}
        />
        <Scatter data={chartData} fill="var(--color-hrv)">
          {chartData.map((entry, i) => (
            <Cell key={i} fill="var(--color-hrv)" opacity={0.8} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function SixMinWalkChart({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无数据</p>;
  const theme = getChartTheme();
  const chartData = data.map((d) => ({
    date: d.date,
    value: d.value,
    x: new Date(d.date).getTime(),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid {...theme.grid} />
        <XAxis
          dataKey="x"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          {...theme.xAxis}
          tickFormatter={(v) => formatDate(new Date(v).toISOString().slice(0, 10))}
          tickCount={5}
        />
        <YAxis dataKey="value" {...theme.yAxis} unit=" m" domain={['auto', 'auto']} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            const t2 = getChartTheme();
            return (
              <div style={t2.tooltip.contentStyle}>
                <div style={t2.tooltip.labelStyle}>{formatDate(d.date)}</div>
                <div style={t2.tooltip.itemStyle}>{d.value != null ? `${d.value} m` : '--'}</div>
              </div>
            );
          }}
        />
        <Scatter data={chartData} fill="var(--color-activity)">
          {chartData.map((entry, i) => (
            <Cell key={i} fill="var(--color-activity)" opacity={0.8} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function ActivityPanel({ data, t }) {
  const { startDate, endDate } = useDateRange();

  const steps = data?.steps ?? {};
  const stats = steps.stats ?? {};
  const bodyMassData = data?.bodyMass ?? [];
  // latestWeight always uses the most recent record regardless of filter
  const latestWeight = bodyMassData.length ? bodyMassData[bodyMassData.length - 1].value : null;

  // Filtered chart data — stat cards above always use all-time stats
  const stepsMonthlyFiltered   = filterByDateRange(steps.monthly,        startDate, endDate, 'month');
  const workoutMonthlyFiltered = filterByDateRange(data?.workoutMonthly, startDate, endDate, 'month');
  const bodyMassFiltered       = filterByDateRange(bodyMassData,         startDate, endDate);
  const swimWorkoutsFiltered   = filterByDateRange(data?.swimWorkouts,   startDate, endDate);
  const workoutsFiltered       = filterByDateRange(data?.workouts,       startDate, endDate);

  // active days pct from above10000pct as proxy
  const activeDaysPct = stats.above10000pct ?? null;

  // Exercise time monthly — group daily records, then filter by date range
  const exerciseMonthlyGroups = {};
  for (const r of data?.exerciseTime?.daily ?? []) {
    const m = r.date.slice(0, 7);
    if (!exerciseMonthlyGroups[m]) exerciseMonthlyGroups[m] = [];
    exerciseMonthlyGroups[m].push(r.value);
  }
  const exerciseMonthly = Object.entries(exerciseMonthlyGroups).sort().map(([month, vals]) => ({
    month,
    mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));
  const exerciseMonthlyFiltered = filterByDateRange(exerciseMonthly, startDate, endDate, 'month');

  // Stand hours monthly — group activitySummary standHours, then filter by date range
  const standMonthlyGroups = {};
  for (const r of data?.activitySummary ?? []) {
    if (!r.date || !r.standHours) continue;
    const m = r.date.slice(0, 7);
    if (!standMonthlyGroups[m]) standMonthlyGroups[m] = [];
    standMonthlyGroups[m].push(r.standHours);
  }
  const standMonthly = Object.entries(standMonthlyGroups).sort().map(([month, vals]) => ({
    month,
    mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
  }));
  const standMonthlyFiltered = filterByDateRange(standMonthly, startDate, endDate, 'month');

  // ── New metrics: monthly groupings ──────────────────────────────────────────

  const daylightMonthlyFiltered = useMemo(
    () => filterByDateRange(data?.daylight?.monthly, startDate, endDate, 'month'),
    [data?.daylight?.monthly, startDate, endDate]
  );

  const walkingSpeedFiltered = useMemo(
    () => filterByDateRange(data?.walkingSpeed?.monthly, startDate, endDate, 'month'),
    [data?.walkingSpeed?.monthly, startDate, endDate]
  );

  const walkingStepLengthFiltered = useMemo(
    () => filterByDateRange(data?.walkingStepLength?.monthly, startDate, endDate, 'month'),
    [data?.walkingStepLength?.monthly, startDate, endDate]
  );

  const walkingAsymmetryFiltered = useMemo(
    () => filterByDateRange(data?.walkingAsymmetry?.monthly, startDate, endDate, 'month'),
    [data?.walkingAsymmetry?.monthly, startDate, endDate]
  );

  const headphoneFiltered = useMemo(
    () => filterByDateRange(data?.headphoneExposure?.monthly, startDate, endDate, 'month'),
    [data?.headphoneExposure?.monthly, startDate, endDate]
  );

  // Flights climbed: group daily -> monthly, then filter
  const flightsDaily = data?.flights?.daily;
  const flightsMonthly = useMemo(() => {
    if (!flightsDaily?.length) return [];
    const groups = {};
    for (const r of flightsDaily) {
      const m = r.date?.slice(0, 7);
      if (!m) continue;
      if (!groups[m]) groups[m] = [];
      groups[m].push(r.value);
    }
    return Object.entries(groups).sort().map(([month, vals]) => ({
      month,
      mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
    }));
  }, [flightsDaily]);

  const flightsMonthlyFiltered = useMemo(
    () => filterByDateRange(flightsMonthly, startDate, endDate, 'month'),
    [flightsMonthly, startDate, endDate]
  );

  // Basal energy: group daily -> monthly, then filter
  const basalEnergyDaily = data?.basalEnergy?.daily;
  const basalEnergyMonthly = useMemo(() => {
    if (!basalEnergyDaily?.length) return [];
    const groups = {};
    for (const r of basalEnergyDaily) {
      const m = r.date?.slice(0, 7);
      if (!m) continue;
      if (!groups[m]) groups[m] = [];
      groups[m].push(r.value);
    }
    return Object.entries(groups).sort().map(([month, vals]) => ({
      month,
      mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
    }));
  }, [basalEnergyDaily]);

  const basalEnergyMonthlyFiltered = useMemo(
    () => filterByDateRange(basalEnergyMonthly, startDate, endDate, 'month'),
    [basalEnergyMonthly, startDate, endDate]
  );

  // Walking steadiness — sparse daily records, filter by date range
  const walkingSteadinessFiltered = useMemo(
    () => filterByDateRange(data?.walkingSteadiness, startDate, endDate),
    [data?.walkingSteadiness, startDate, endDate]
  );

  // Six minute walk — sparse daily records, filter by date range
  const sixMinWalkFiltered = useMemo(
    () => filterByDateRange(data?.sixMinWalk, startDate, endDate),
    [data?.sixMinWalk, startDate, endDate]
  );

  // Arboleaf — latest record (most recent by date)
  const arboleaf = data?.arboleaf;
  const latestArboleaf = useMemo(() => {
    if (!arboleaf?.length) return null;
    return [...arboleaf].sort((a, b) => (a.date > b.date ? 1 : -1)).at(-1);
  }, [arboleaf]);

  // Arboleaf filtered for trend chart
  const arboleafFiltered = useMemo(
    () => filterByDateRange(data?.arboleaf, startDate, endDate),
    [data?.arboleaf, startDate, endDate]
  );

  if (!data) {
    return (
      <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px' }}>
        活动数据加载中...
      </div>
    );
  }

  return (
    <div className="panel" role="main" aria-label="活动面板">

      {/* ── Row 1: stat cards ── */}
      <div className="stat-grid-4">
        <StatCard
          label={t?.('activity.dailySteps') ?? '日均步数'}
          value={stats.mean != null ? Math.round(stats.mean).toLocaleString() : null}
          unit="步"
          color="var(--color-activity)"
        />
        <StatCard
          label={t?.('activity.stepsBelow5k') ?? '步数 <5000 天'}
          value={stats.below5000pct != null ? `${stats.below5000pct}%` : null}
          unit=""
          color="var(--color-vo2)"
        />
        <StatCard
          label={t?.('activity.activeDays') ?? '活跃天 (>10000步)'}
          value={activeDaysPct != null ? `${activeDaysPct}%` : null}
          unit=""
          color="var(--color-activity)"
        />
        <StatCard
          label={t?.('activity.latestWeight') ?? '最新体重'}
          value={latestWeight}
          unit="kg"
          color="var(--color-heart)"
        />
      </div>

      {/* ── Row 2: monthly steps bar chart ── */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">{t?.('activity.monthlySteps') ?? '月均步数趋势'}</div>
          </div>
        </div>
        <MonthlyStepsChart data={stepsMonthlyFiltered} />
      </div>

      {/* ── Row 3: workout frequency + body weight ── */}
      <div className="two-col">
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">{t?.('activity.monthlyWorkouts') ?? '月度训练频率'}</div>
          </div>
          <MonthlyWorkoutChart data={workoutMonthlyFiltered} />
        </div>
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">{t?.('activity.weightTrend') ?? '体重趋势'}</div>
          </div>
          <BodyWeightChart data={bodyMassFiltered} />
        </div>
      </div>

      {/* ── Row 4: exercise time + stand hours ── */}
      <div className="two-col">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">{t?.('activity.exerciseTime') ?? '日均锻炼时长'}</div>
              <div className="chart-card-sub">{t?.('activity.exerciseTimeSub') ?? '月均值（分钟）'}</div>
            </div>
          </div>
          <ExerciseTimeChart
            data={exerciseMonthlyFiltered}
            recommendedLabel={`${t?.('activity.recommended') ?? '推荐'} 30min`}
          />
        </div>
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">{t?.('activity.standHours') ?? '站立时长'}</div>
              <div className="chart-card-sub">{t?.('activity.standHoursSub') ?? '月均值'}</div>
            </div>
          </div>
          <StandHoursChart data={standMonthlyFiltered} />
        </div>
      </div>

      {/* ── Row 5: recent workouts table ── */}
      <div className="card">
        <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('activity.recentWorkouts') ?? '最近 15 次训练'}</p>
        <RecentWorkoutsTable workouts={workoutsFiltered} t={t} />
      </div>

      {/* ── Row 6: steps calendar heatmap ── */}
      <CalendarHeatmap
        data={data?.steps?.daily}
        colorVar="var(--color-activity)"
        label={t?.('activity.stepsCalendar') ?? 'Steps Calendar'}
        unit=" steps"
        targetRange={[8000, 15000]}
      />

      {/* ── Row 7: achievements & records ── */}
      <AchievementBadges
        steps={data?.steps}
        workouts={data?.workouts}
        sleepNightly={null}
        t={t}
      />

      {/* ── Row 8: swimming analysis ── */}
      <div className="card">
        <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('activity.swimAnalysis') ?? '游泳分析'}</p>
        <div className="two-col">
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{t?.('activity.swimDuration') ?? '训练时长趋势'}</p>
            <SwimDurationScatter swimWorkouts={swimWorkoutsFiltered} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{t?.('activity.swimHRZone') ?? '心率区间分布'}</p>
            <SwimHRZoneChart swimWorkouts={swimWorkoutsFiltered} />
          </div>
        </div>
      </div>

      {/* ── Section 1: Daylight Exposure ── */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">{t?.('activity.daylight') ?? 'Daily Sunlight Exposure'}</div>
            <div className="chart-card-sub">{t?.('activity.daylightSub') ?? 'Monthly average (minutes)'}</div>
          </div>
        </div>
        <DaylightChart
          data={daylightMonthlyFiltered}
          targetLabel={t?.('activity.daylightTarget') ?? 'Min circadian benefit'}
        />
      </div>

      {/* ── Section 2: Mobility Analysis (3-column) ── */}
      <div className="card">
        <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('activity.mobility') ?? 'Mobility Analysis'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              {t?.('activity.walkingSpeed') ?? 'Walking Speed'}
            </p>
            <WalkingSpeedChart data={walkingSpeedFiltered} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              {t?.('activity.stepLength') ?? 'Step Length'}
            </p>
            <StepLengthChart data={walkingStepLengthFiltered} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              {t?.('activity.asymmetry') ?? 'Asymmetry'}
            </p>
            <WalkingAsymmetryChart
              data={walkingAsymmetryFiltered}
              thresholdLabel="10%"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Headphone Audio Exposure ── */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">{t?.('activity.headphone') ?? 'Headphone Audio Exposure'}</div>
            <div className="chart-card-sub">{t?.('activity.headphoneSub') ?? 'Monthly average and peak (dB)'}</div>
          </div>
        </div>
        <HeadphoneExposureChart
          data={headphoneFiltered}
          safeLimitLabel={`${t?.('activity.safeLimit') ?? 'WHO Safe Limit'} 80 dB`}
        />
      </div>

      {/* ── Section 4: Arboleaf Body Composition ── */}
      {data?.arboleaf?.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('activity.bodyComp') ?? 'Body Composition'}</p>
          <div className="two-col">
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                {t?.('activity.bodyCompTrend') ?? 'Trends'}
              </p>
              <BodyCompositionTrendChart data={arboleafFiltered} />
            </div>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                {t?.('activity.bodyCompLatest') ?? 'Latest Measurement'}
                {latestArboleaf?.date && (
                  <span style={{ fontWeight: 400, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                    {formatDate(latestArboleaf.date)}
                  </span>
                )}
              </p>
              <ArboleafLatestCard record={latestArboleaf} t={t} />
            </div>
          </div>
        </div>
      )}

      {/* ── Section 5: Additional Metrics — Flights + Basal Metabolic Rate ── */}
      <div className="two-col">
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">{t?.('activity.flightsClimbed') ?? 'Flights Climbed'}</div>
          </div>
          <FlightsMonthlyChart data={flightsMonthlyFiltered} />
        </div>
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">{t?.('activity.basalMetabolic') ?? 'Basal Metabolic Rate'}</div>
          </div>
          <BasalEnergyMonthlyChart data={basalEnergyMonthlyFiltered} />
        </div>
      </div>

      {/* ── Section 6: Walking Steadiness + Six Minute Walk ── */}
      {(data?.walkingSteadiness?.length > 0 || data?.sixMinWalk?.length > 0) && (
        <div className="two-col">
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-title">{t?.('activity.walkingSteadiness') ?? 'Walking Steadiness'}</div>
            </div>
            <WalkingSteadinessChart data={walkingSteadinessFiltered} />
          </div>
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-title">{t?.('activity.sixMinWalk') ?? 'Six Minute Walk Test'}</div>
            </div>
            <SixMinWalkChart data={sixMinWalkFiltered} />
          </div>
        </div>
      )}

    </div>
  );
}

export default ActivityPanel;
