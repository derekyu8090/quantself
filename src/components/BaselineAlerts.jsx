/**
 * BaselineAlerts - Shows metrics that deviate significantly from personal baseline.
 *
 * Usage:
 *   <BaselineAlerts baselines={data.overview.baselines} t={t} />
 *
 * Props:
 *   baselines {Object} - keyed by metric name, each with { mean, stddev, current, deviation, trend, alert }
 *   t         {Function} - translation function from useTranslation
 */

// ─── BaselineBar ──────────────────────────────────────────────────────────────

/**
 * Mini bar showing where the current value sits relative to baseline range.
 * Baseline range is mean ± 2*stddev. Current is clamped to that range for display.
 */
function BaselineBar({ mean, stddev, current, alert: isAlert }) {
  const rangeMin = mean - 2 * stddev;
  const rangeMax = mean + 2 * stddev;
  const rangeSpan = rangeMax - rangeMin || 1;

  // Position of the current value within the range (0-1), clamped
  const pos = Math.max(0, Math.min(1, (current - rangeMin) / rangeSpan));

  // Position of mean within the range
  const meanPos = Math.max(0, Math.min(1, (mean - rangeMin) / rangeSpan));

  const trackColor = isAlert ? 'var(--color-red-dim)' : 'var(--color-green-dim)';
  const markerColor = isAlert ? 'var(--color-red)' : 'var(--color-green)';

  return (
    <div
      style={{
        position: 'relative',
        height: '6px',
        background: trackColor,
        borderRadius: '4px',
        overflow: 'visible',
        marginTop: '8px',
      }}
      role="presentation"
    >
      {/* Mean marker */}
      <div
        style={{
          position: 'absolute',
          left: `${meanPos * 100}%`,
          top: '-2px',
          width: '2px',
          height: '10px',
          background: 'var(--text-muted)',
          borderRadius: '1px',
          transform: 'translateX(-50%)',
        }}
        aria-hidden="true"
      />
      {/* Current value marker */}
      <div
        style={{
          position: 'absolute',
          left: `${pos * 100}%`,
          top: '-3px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: markerColor,
          transform: 'translateX(-50%)',
          boxShadow: `0 0 0 2px var(--bg-card)`,
          transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── AlertItem ────────────────────────────────────────────────────────────────

function AlertItem({ metric, baseline, label, t }) {
  const { mean, stddev, current, deviation } = baseline;
  const isAlert = baseline.alert;

  const borderColor = isAlert ? 'var(--color-red)' : 'var(--color-amber)';

  // Deviation label: e.g. "-0.74σ"
  const sigmaText =
    deviation != null
      ? `${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}${t?.('baselines.sigma') ?? 'σ'}`
      : null;

  // Trend label
  const trendLabel =
    baseline.trend === 'low'
      ? t?.('baselines.low') ?? 'Low'
      : baseline.trend === 'elevated'
      ? t?.('baselines.elevated') ?? 'Elevated'
      : t?.('baselines.normal') ?? 'Normal';

  const trendColor =
    baseline.trend === 'low' || baseline.trend === 'elevated'
      ? 'var(--color-amber)'
      : 'var(--color-green)';

  // Format current value based on metric type
  const formatValue = (v) => {
    if (v == null) return '—';
    if (metric === 'sleep') return `${v.toFixed(1)}h`;
    if (metric === 'steps') return v.toLocaleString();
    return Math.round(v).toString();
  };

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        paddingLeft: '12px',
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingRight: '4px',
      }}
      role="listitem"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-heading)',
              letterSpacing: '-0.1px',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '500',
              color: trendColor,
              background:
                baseline.trend !== 'normal'
                  ? 'var(--color-amber-dim)'
                  : 'var(--color-green-dim)',
              borderRadius: '10px',
              padding: '1px 6px',
            }}
          >
            {trendLabel}
          </span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: 'var(--text-heading)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
            }}
          >
            {formatValue(current)}
          </span>
          {sigmaText && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginLeft: '4px',
              }}
              title={t?.('baselines.deviation') ?? 'deviation from baseline'}
            >
              {sigmaText}
            </span>
          )}
        </div>
      </div>

      {/* Baseline position bar */}
      {mean != null && stddev != null && current != null && (
        <BaselineBar
          mean={mean}
          stddev={stddev}
          current={current}
          alert={isAlert}
        />
      )}
    </div>
  );
}

// ─── BaselineAlerts ───────────────────────────────────────────────────────────

function BaselineAlerts({ baselines, t }) {
  if (!baselines) return null;

  const metricLabels = {
    rhr:   t?.('cardio.rhr')        ?? 'RHR',
    hrv:   t?.('cardio.hrv')        ?? 'HRV',
    sleep: t?.('sleep.avgSleep')    ?? 'Sleep',
    steps: t?.('activity.dailySteps') ?? 'Steps',
  };

  const alerts = Object.entries(baselines).filter(([, b]) => b.alert);
  const hasAlerts = alerts.length > 0;

  // Show all metrics, sorting alerts to top
  const allEntries = Object.entries(baselines).sort(([, a], [, b]) => {
    if (a.alert && !b.alert) return -1;
    if (!a.alert && b.alert) return 1;
    return 0;
  });

  const cardBorderColor = hasAlerts ? 'var(--color-red)' : 'var(--color-green)';

  return (
    <div
      className="card"
      role="region"
      aria-label={t?.('baselines.title') ?? 'Baseline Status'}
      style={{
        padding: '20px',
        borderLeft: `3px solid ${cardBorderColor}`,
        height: '100%',
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '14px' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-heading)',
            letterSpacing: '-0.2px',
          }}
        >
          {t?.('baselines.title') ?? 'Baseline Status'}
        </h2>
      </div>

      {/* All normal state */}
      {!hasAlerts && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: 'var(--color-green-dim)',
            border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 'var(--radius)',
            marginBottom: '12px',
          }}
          role="status"
        >
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-green)',
              fontWeight: '500',
            }}
          >
            {t?.('baselines.allNormal') ?? 'All metrics within normal range'}
          </span>
        </div>
      )}

      {/* Metric list */}
      <div
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
        }}
      >
        {allEntries.map(([metric, baseline], i) => (
          <div
            key={metric}
            style={{
              borderBottom:
                i < allEntries.length - 1
                  ? '1px solid var(--border-subtle)'
                  : 'none',
            }}
          >
            <AlertItem
              metric={metric}
              baseline={baseline}
              label={metricLabels[metric] ?? metric}
              t={t}
            />
          </div>
        ))}
      </div>

      {/* Sigma legend */}
      <div
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: '8px',
            height: '2px',
            background: 'var(--text-muted)',
            borderRadius: '1px',
            flexShrink: 0,
          }}
        />
        <span>{`= ${t?.('cardio.mean') ?? 'mean'}`}</span>
        <span style={{ marginLeft: '8px' }}>
          {t?.('baselines.deviation') ?? 'deviation from baseline'}
        </span>
      </div>
    </div>
  );
}

export default BaselineAlerts;
