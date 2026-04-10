/**
 * StatCard - Reusable metric display card for health dashboard panels.
 *
 * Usage:
 *   <StatCard label="Resting Heart Rate" value={52} unit="bpm" trend="down" trendLabel="vs last month" color="#10b981" />
 *   <StatCard label="VO2 Max" value={48.5} unit="mL/kg/min" trend="neutral" />
 *   <StatCard label="RHR High Events" value={14} unit="days" trend="up" badTrend={true} trendLabel="last 90 days" />
 *
 * Props:
 *   label       {string}                  - Descriptor label shown at top
 *   value       {number|string}           - Main metric value
 *   unit        {string}                  - Unit string (e.g. "bpm", "h", "%")
 *   trend       {'up'|'down'|'neutral'}   - Trend direction
 *   badTrend    {boolean}                 - Inverts color semantics: up=red, down=green
 *   trendLabel  {string}                  - Descriptive text next to trend dot
 *   color       {string}                  - CSS color override for the accent bar
 */

function StatCard({ label, value, unit, trend, badTrend = false, trendLabel, color }) {
  const getTrendClass = () => {
    if (!trend || trend === 'neutral') return 'trend-neutral'
    if (trend === 'up') return badTrend ? 'trend-up-bad' : 'trend-up'
    if (trend === 'down') return badTrend ? 'trend-down-good' : 'trend-down'
    return 'trend-neutral'
  }

  const displayValue = value === null || value === undefined ? '\u2014' : value

  return (
    <div
      className="stat-card"
      style={color ? { '--accent-color': color } : undefined}
      role="region"
      aria-label={`${label}: ${displayValue}${unit ? ' ' + unit : ''}`}
    >
      <span className="stat-card-label">{label}</span>

      <div className="stat-card-value-row">
        <span className="stat-card-value" style={{ letterSpacing: '-0.04em' }}>
          {displayValue}
        </span>
        {unit && <span className="stat-card-unit">{unit}</span>}
      </div>

      {(trend || trendLabel) && (
        <div className={`stat-card-trend ${getTrendClass()}`}>
          {trend && trend !== 'neutral' && (
            <span
              className="trend-dot"
              aria-hidden="true"
              style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }}
            />
          )}
          {trendLabel && <span className="trend-label">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}

export default StatCard
