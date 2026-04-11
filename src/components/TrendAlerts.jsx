/**
 * TrendAlerts - displays sustained metric trends as alerts
 *
 * Usage:
 *   <TrendAlerts trends={data.overview.trends} t={t} />
 *
 * data shape:
 *   [{ metric, direction, pctChange, recentMean, previousMean, concerning, label: {en, zh}, unit, window }]
 */

function TrendAlerts({ trends, t }) {
  if (!trends || trends.length === 0) return null;

  const lang = t?.('app.title') === 'HealthDash' ? 'en' : 'zh';

  return (
    <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
      <p className="section-title" style={{ marginBottom: '12px' }}>
        {t?.('trends.title') ?? 'Trend Alerts'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {trends.map((tr, i) => {
          const arrow = tr.direction === 'up' ? '↑' : '↓';
          const arrowColor = tr.concerning
            ? 'var(--color-red)'
            : 'var(--color-green)';
          const label = lang === 'zh' ? tr.label.zh : tr.label.en;
          const dirLabel = tr.direction === 'up'
            ? (t?.('trends.up') ?? 'trending up')
            : (t?.('trends.down') ?? 'trending down');

          return (
            <div
              key={tr.metric}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: 'var(--bg-inset)',
                borderRadius: 'var(--radius)',
                borderLeft: `3px solid ${arrowColor}`,
              }}
            >
              <span style={{ fontSize: '16px', color: arrowColor }}>{arrow}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  {label}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  {dirLabel} {Math.abs(tr.pctChange)}%
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({tr.recentMean} {t?.('trends.vs') ?? 'vs previous'} {tr.previousMean} {tr.unit})
                </span>
              </div>
              {tr.concerning && (
                <span style={{
                  fontSize: '10px',
                  color: 'var(--color-red)',
                  background: 'var(--color-red-dim)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}>
                  {t?.('trends.concerning') ?? 'Needs attention'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TrendAlerts;
