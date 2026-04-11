/**
 * HealthScoreCard - Centerpiece card showing daily composite health score.
 *
 * Usage:
 *   <HealthScoreCard data={data.overview.healthScore} t={t} />
 *
 * Props:
 *   data  {Object} - overview.healthScore: { daily, latest, mean, trend, breakdown }
 *   t     {Function} - translation function from useTranslation
 */

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ─── ScoreGauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 160 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const color =
    score >= 80
      ? 'var(--color-green)'
      : score >= 60
      ? 'var(--color-amber)'
      : 'var(--color-red)';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Health score: ${score} out of 100`}
      role="img"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-inset)"
        strokeWidth={8}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        fill="var(--text-heading)"
        fontSize="36"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize="12"
        fontFamily="Inter, sans-serif"
      >
        / 100
      </text>
    </svg>
  );
}

// ─── BreakdownBar ─────────────────────────────────────────────────────────────

function BreakdownBar({ label, score }) {
  const color =
    score >= 80
      ? 'var(--color-green)'
      : score >= 60
      ? 'var(--color-amber)'
      : 'var(--color-red)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          width: '62px',
          flexShrink: 0,
          fontWeight: '500',
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: '4px',
          background: 'var(--bg-inset)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${score}`}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: '4px',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          width: '24px',
          textAlign: 'right',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── SparklineTooltip ─────────────────────────────────────────────────────────

function SparklineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: 'var(--chart-tooltip-bg)',
        border: '1px solid var(--chart-tooltip-border)',
        borderRadius: '6px',
        padding: '6px 10px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-tooltip)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{d.date}</div>
      <div style={{ fontWeight: '600', color: 'var(--text-heading)' }}>{d.score}</div>
    </div>
  );
}

// ─── TrendIndicator ───────────────────────────────────────────────────────────

function TrendIndicator({ trend, t }) {
  const label =
    trend === 'improving'
      ? t?.('healthScore.trend.improving') ?? 'Improving'
      : trend === 'declining'
      ? t?.('healthScore.trend.declining') ?? 'Declining'
      : t?.('healthScore.trend.stable') ?? 'Stable';

  const arrow =
    trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→';

  const color =
    trend === 'improving'
      ? 'var(--color-green)'
      : trend === 'declining'
      ? 'var(--color-red)'
      : 'var(--color-amber)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '6px',
        justifyContent: 'center',
      }}
    >
      <span style={{ color, fontSize: '13px', fontWeight: '700', lineHeight: 1 }}>
        {arrow}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
        {label}
      </span>
    </div>
  );
}

// ─── HealthScoreCard ──────────────────────────────────────────────────────────

function scoreColor(s) {
  return s >= 80 ? 'var(--color-green)' : s >= 60 ? 'var(--color-amber)' : 'var(--color-red)';
}

function HealthScoreCard({ data, t }) {
  if (!data) return null;

  const { mean, trend, daily } = data;

  // Use the last COMPLETE day (not today) as the displayed score.
  // Today's data is incomplete (especially early morning) and misleading.
  const today = new Date().toISOString().slice(0, 10);
  const completeDays = Array.isArray(daily)
    ? daily.filter(d => d.date < today)
    : [];
  const latestComplete = completeDays.length > 0 ? completeDays[completeDays.length - 1] : null;

  const score = latestComplete?.score ?? data.latest ?? 0;
  const breakdown = latestComplete || data.breakdown
    ? { rhr: 0, hrv: 0, sleep: 0, activity: 0, recovery: 0, body: 0, ...(latestComplete ?? {}), ...(latestComplete ? {} : data.breakdown ?? {}) }
    : null;

  // Recent 14 days (complete days only)
  const recent14 = completeDays.slice(-14);

  // Last 30 days of sparkline data (complete days only)
  const sparklineData = completeDays.slice(-30);

  // Determine gradient color id based on score
  const gradientId = 'health-score-gradient';
  const sparkColor =
    score >= 80
      ? 'var(--color-green)'
      : score >= 60
      ? 'var(--color-amber)'
      : 'var(--color-red)';

  const breakdownComponents = breakdown
    ? [
        { key: 'rhr',      label: t?.('healthScore.components.rhr')      ?? 'Heart Rate',  score: breakdown.rhr      ?? 0 },
        { key: 'hrv',      label: t?.('healthScore.components.hrv')      ?? 'HRV',         score: breakdown.hrv      ?? 0 },
        { key: 'sleep',    label: t?.('healthScore.components.sleep')    ?? 'Sleep',       score: breakdown.sleep    ?? 0 },
        { key: 'activity', label: t?.('healthScore.components.activity') ?? 'Activity',    score: breakdown.activity ?? 0 },
        { key: 'recovery', label: t?.('healthScore.components.recovery') ?? 'Recovery',    score: breakdown.recovery ?? 0 },
        { key: 'body',     label: t?.('healthScore.components.body')     ?? 'Body',        score: breakdown.body     ?? 0 },
      ]
    : [];

  return (
    <div
      className="card"
      role="region"
      aria-label={t?.('healthScore.title') ?? 'Health Score'}
      style={{ padding: '20px' }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-heading)',
            letterSpacing: '-0.2px',
          }}
        >
          {t?.('healthScore.title') ?? 'Health Score'}
        </h2>
        {mean != null && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {`${t?.('cardio.mean') ?? 'Mean'}: ${mean}`}
          </div>
        )}
      </div>

      {/* Main body: gauge left, breakdown right */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: gauge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <ScoreGauge score={score} size={160} />
          <TrendIndicator trend={trend} t={t} />
        </div>

        {/* Right: breakdown bars */}
        <div
          style={{
            flex: '1 1 180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {breakdownComponents.map(({ key, label, score: s }) => (
            <BreakdownBar key={key} label={label} score={s} />
          ))}
        </div>
      </div>

      {/* Bottom: 30-day sparkline */}
      {sparklineData.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '6px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {t?.('healthScore.last30') ?? 'Last 30 days'}
          </div>
          <div style={{ height: '60px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparklineData}
                margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<SparklineTooltip />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 3, fill: sparkColor }}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent 14 days daily scores */}
      {recent14.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px',
            fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {t?.('healthScore.recent14') ?? 'Recent 14 Days'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...recent14].reverse().map(day => {
              const dayColor = scoreColor(day.score);
              const dateLabel = day.date.slice(5); // MM-DD
              return (
                <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '42px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {dateLabel}
                  </span>
                  <div style={{ flex: 1, height: '6px', background: 'var(--bg-inset)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${day.score}%`, background: dayColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: dayColor, width: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {day.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthScoreCard;
