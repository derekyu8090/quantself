/**
 * GlossaryPanel
 *
 * Explains each health metric with four sections per card.
 *
 * Props:
 *   t - translation function from useTranslation hook
 *       t('glossary.title')   -> panel title string
 *       t('glossary.subtitle') -> panel subtitle string
 *       t('glossary.metrics') -> object of metric definitions, keyed by metric id
 *
 * Each metric object has: name, what, range, why, improve
 *
 * Usage:
 *   <GlossaryPanel t={t} />
 */

// ─── section config ───────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: 'what',
    labelKey: 'What is it',
    dotColor: 'var(--color-blue)',
  },
  {
    key: 'range',
    labelKey: 'Normal Range',
    dotColor: 'var(--color-green)',
  },
  {
    key: 'why',
    labelKey: 'Why it matters',
    dotColor: 'var(--color-amber)',
  },
  {
    key: 'improve',
    labelKey: 'How to improve',
    dotColor: 'var(--color-heart)',
  },
];

// ─── MetricSection ─────────────────────────────────────────────────────────────

function MetricSection({ label, text, dotColor }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 5,
        }}
      >
        {/* Colored dot icon */}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
            marginTop: 1,
          }}
        />
        {/* Section label */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.7px',
            color: dotColor,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
      {/* Section body text */}
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          paddingLeft: 13,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({ metric, color }) {
  return (
    <article
      className="card"
      style={{
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 20px 6px 18px',
        display: 'flex',
        flexDirection: 'column',
      }}
      aria-label={metric.name}
    >
      {/* Card header */}
      <header style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Color accent dot next to name */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-heading)',
              letterSpacing: '-0.2px',
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {metric.name}
          </h3>
        </div>
        {/* Subtle divider under header */}
        <div
          aria-hidden="true"
          style={{
            marginTop: 12,
            height: 1,
            background: 'var(--border-subtle)',
          }}
        />
      </header>

      {/* Four metric sections */}
      <div style={{ flex: 1 }}>
        {SECTIONS.map((section) => (
          <MetricSection
            key={section.key}
            label={section.labelKey}
            text={metric[section.key]}
            dotColor={section.dotColor}
          />
        ))}
      </div>
    </article>
  );
}

// ─── GlossaryPanel ─────────────────────────────────────────────────────────────

const METRIC_KEYS = [
  'rhr',
  'hrv',
  'vo2max',
  'spo2',
  'sleepDuration',
  'bedtime',
  'steps',
  'bodyComp',
];

const METRIC_COLORS = {
  rhr:           'var(--color-heart)',
  hrv:           'var(--color-hrv)',
  vo2max:        'var(--color-vo2)',
  spo2:          'var(--color-spo2)',
  sleepDuration: 'var(--color-sleep)',
  bedtime:       'var(--color-sleep)',
  steps:         'var(--color-activity)',
  bodyComp:      'var(--color-risk)',
};

function GlossaryPanel({ t }) {
  const metrics = t('glossary.metrics');

  return (
    <div className="panel" role="main" aria-label="Health Metrics Glossary">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 8 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-heading)',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          {t('glossary.title')}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {t('glossary.subtitle')}
        </p>
      </header>

      {/* ── Legend strip ───────────────────────────────────────────────── */}
      <div
        aria-label="Section legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 20px',
          padding: '10px 14px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
        }}
      >
        {SECTIONS.map((section) => (
          <span
            key={section.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: section.dotColor,
                flexShrink: 0,
              }}
            />
            {section.labelKey}
          </span>
        ))}
      </div>

      {/* ── Metric cards grid ──────────────────────────────────────────── */}
      <div className="two-col" role="list">
        {METRIC_KEYS.map((key) => {
          const metric = metrics[key];
          const color  = METRIC_COLORS[key];
          return (
            <div key={key} role="listitem">
              <MetricCard metric={metric} color={color} />
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default GlossaryPanel;
