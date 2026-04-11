/**
 * CorrelationPanel - shows discovered correlations between health metrics
 *
 * Usage:
 * <CorrelationPanel data={data.overview?.correlations} t={t} />
 *
 * data shape:
 * {
 *   pairs: [{ metric1, metric2, r, strength, direction, n, description: { en, zh } }],
 *   metrics: ['rhr', 'hrv', ...],
 *   labels: { rhr: 'Resting Heart Rate', ... },
 *   labels_zh: { rhr: '静息心率', ... },
 * }
 */

const METRIC_LABELS_EN = {
  rhr: 'RHR', hrv: 'HRV', sleep: 'Sleep', steps: 'Steps',
  daylight: 'Daylight', bedtime: 'Bedtime', deepSleep: 'Deep Sleep',
};
const METRIC_LABELS_ZH = {
  rhr: '静息心率', hrv: 'HRV', sleep: '睡眠时长', steps: '步数',
  daylight: '日光', bedtime: '入睡时间', deepSleep: '深睡',
};

function strengthColor(strength) {
  if (strength === 'strong') return 'var(--color-green, var(--color-hrv))';
  if (strength === 'moderate') return 'var(--color-amber, var(--color-vo2))';
  return 'var(--text-muted)';
}

// ─── CorrelationCard ─────────────────────────────────────────────────────────

function CorrelationCard({ pair, lang }) {
  const color = strengthColor(pair.strength);
  const dataLabels = lang === 'zh' ? (pair._labels_zh || {}) : (pair._labels || {});
  const metricLabels = { ...(lang === 'zh' ? METRIC_LABELS_ZH : METRIC_LABELS_EN), ...dataLabels };
  const description = lang === 'zh' ? pair.description?.zh : pair.description?.en;
  const arrow = pair.r > 0 ? '↗' : '↘';
  const arrowColor = pair.r > 0 ? 'var(--color-hrv)' : 'var(--color-heart)';
  const rLabel = `r = ${pair.r > 0 ? '+' : ''}${pair.r}`;

  return (
    <div
      style={{
        background: 'var(--bg-inset)',
        borderRadius: 'var(--radius)',
        padding: '14px',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
          {metricLabels[pair.metric1] ?? pair.metric1}
        </span>
        <span style={{ color: arrowColor, fontSize: '14px' }} aria-hidden="true">{arrow}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
          {metricLabels[pair.metric2] ?? pair.metric2}
        </span>
      </div>

      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rLabel}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>n={pair.n}</span>
      </div>
    </div>
  );
}

// ─── CorrelationMatrix ───────────────────────────────────────────────────────

function cellBackground(r) {
  if (r === undefined || r === null) return 'var(--bg-inset)';
  const opacity = Math.min(Math.abs(r) * 1.5, 0.8);
  return r > 0
    ? `rgba(52,211,153,${opacity})`
    : `rgba(248,113,113,${opacity})`;
}

function CorrelationMatrix({ data, lang }) {
  const metrics = data.metrics ?? [];
  const labels = lang === 'zh' ? (data.labels_zh ?? {}) : (data.labels ?? {});

  // Build lookup: "metric1-metric2" -> r
  const matrix = {};
  for (const p of data.pairs ?? []) {
    matrix[`${p.metric1}-${p.metric2}`] = p.r;
    matrix[`${p.metric2}-${p.metric1}`] = p.r;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ borderCollapse: 'collapse', fontSize: '11px' }}
        aria-label={lang === 'zh' ? '相关性矩阵' : 'Correlation Matrix'}
      >
        <thead>
          <tr>
            <td style={{ minWidth: '90px' }} />
            {metrics.map((m) => (
              <td
                key={m}
                style={{
                  padding: '6px 4px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  fontWeight: 600,
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)',
                  maxWidth: '32px',
                  height: '80px',
                  verticalAlign: 'bottom',
                }}
              >
                {(labels[m] ?? m).slice(0, 10)}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m1) => (
            <tr key={m1}>
              <td
                style={{
                  padding: '4px 8px',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {(labels[m1] ?? m1).slice(0, 14)}
              </td>
              {metrics.map((m2) => {
                const isDiag = m1 === m2;
                const r = isDiag ? 1 : matrix[`${m1}-${m2}`];
                const hasValue = r !== undefined && r !== null;
                return (
                  <td
                    key={m2}
                    style={{
                      width: '36px',
                      height: '36px',
                      textAlign: 'center',
                      background: isDiag ? 'var(--bg-card)' : cellBackground(r),
                      border: '1px solid var(--border-subtle)',
                      fontSize: '10px',
                      color: hasValue ? 'var(--text-heading)' : 'var(--text-muted)',
                      fontWeight: hasValue && Math.abs(r) >= 0.3 ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    title={
                      hasValue
                        ? `${labels[m1] ?? m1} / ${labels[m2] ?? m2}: r=${r}`
                        : undefined
                    }
                  >
                    {isDiag ? '1' : hasValue ? r.toFixed(2) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CorrelationPanel (main export) ─────────────────────────────────────────

function CorrelationPanel({ data, t }) {
  if (!data?.pairs?.length) {
    return (
      <div className="panel">
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            {t?.('correlation.noData') ?? 'Not enough data to compute correlations'}
          </p>
        </div>
      </div>
    );
  }

  // Detect language: if app title is English string we are in EN, else ZH
  const lang = t?.('app.title') === 'HealthDash' && t?.('tabs.glossary') === 'Glossary' ? 'en' : 'zh';

  // Sort by absolute r value descending, show top 5, enrich with data labels
  const top5 = [...data.pairs]
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 5)
    .map(p => ({ ...p, _labels: data.labels, _labels_zh: data.labels_zh }));

  return (
    <div className="panel" role="main" aria-label={t?.('tabs.correlation') ?? 'Insights'}>
      {/* Row 1: top correlation cards */}
      <div className="card">
        <p className="section-title" style={{ marginBottom: '16px' }}>
          {t?.('correlation.topCorrelations') ?? 'Strongest Correlations'}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {top5.map((p, i) => (
            <CorrelationCard key={`${p.metric1}-${p.metric2}-${i}`} pair={p} lang={lang} />
          ))}
        </div>
      </div>

      {/* Row 2: correlation matrix heatmap */}
      <div className="card" style={{ marginTop: '20px' }}>
        <p className="section-title" style={{ marginBottom: '16px' }}>
          {t?.('correlation.matrix') ?? 'Correlation Matrix'}
        </p>
        <CorrelationMatrix data={data} lang={lang} />
        <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {lang === 'zh'
            ? '绿色 = 正相关，红色 = 负相关，颜色深度表示相关强度。'
            : 'Green = positive correlation, red = negative. Color intensity reflects strength.'}
        </p>
      </div>
    </div>
  );
}

export default CorrelationPanel;
