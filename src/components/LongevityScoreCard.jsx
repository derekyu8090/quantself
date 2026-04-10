/**
 * LongevityScoreCard - Evidence-based long-term health score card.
 *
 * Usage:
 *   <LongevityScoreCard data={data.overview?.longevityScore} t={t} />
 *
 * Props:
 *   data  {Object} - overview.longevityScore: { score, components, monthly, trend, references }
 *   t     {Function} - translation function from useTranslation
 *
 * Visual contrast with HealthScoreCard:
 *   - HealthScoreCard: circular gauge, warm "how are you today" feel
 *   - LongevityScoreCard: clinical badge score, weighted component bars, research refs
 */

import { useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtMonth } from '../utils/dataUtils';
import { getChartTheme } from '../chartTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPONENT_LABELS = {
  en: {
    vo2max:          'VO2 Max',
    sleepRegularity: 'Sleep Regularity',
    activity:        'Activity Level',
    hrv:             'HRV',
    bodyComposition: 'Body Composition',
    spo2:            'SpO2',
    restingHR:       'Resting HR',
  },
  zh: {
    vo2max:          '最大摄氧量',
    sleepRegularity: '睡眠规律性',
    activity:        '活动水平',
    hrv:             '心率变异性',
    bodyComposition: '身体成分',
    spo2:            '血氧饱和度',
    restingHR:       '静息心率',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return 'var(--color-green)';
  if (score >= 60) return 'var(--color-amber)';
  return 'var(--color-red)';
}

// ─── ScoreBadge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  // Shield-like hexagonal clip for a clinical/authoritative feel
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0,
      }}
      aria-label={`Longevity score: ${score} out of 100`}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span
          style={{
            fontSize: '42px',
            fontWeight: 700,
            color,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '2px' }}>
          /100
        </span>
      </div>
    </div>
  );
}

// ─── ComponentBar ─────────────────────────────────────────────────────────────

function ComponentBar({ keyName, label, score, weight, detail, isPriority, priorityLabel }) {
  const color = scoreColor(score);

  return (
    <div
      style={{
        padding: isPriority ? '8px 10px' : '0',
        background: isPriority ? 'var(--bg-inset)' : 'transparent',
        borderRadius: isPriority ? '6px' : '0',
        borderLeft: isPriority ? `2px solid ${color}` : 'none',
        transition: 'background 0.2s',
      }}
    >
      {/* Label row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '13px',
              color: isPriority ? 'var(--text-heading)' : 'var(--text-primary)',
              fontWeight: isPriority ? 600 : 400,
            }}
          >
            {label}
          </span>
          {isPriority && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--color-red)',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              {priorityLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color,
              fontVariantNumeric: 'tabular-nums',
              minWidth: '24px',
              textAlign: 'right',
            }}
          >
            {score}
          </span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              minWidth: '28px',
              textAlign: 'right',
              letterSpacing: '0.01em',
            }}
          >
            {weight}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="progress-bar-wrap"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${score}`}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>

      {/* Detail text */}
      {detail && (
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '3px',
            lineHeight: 1.4,
          }}
        >
          {detail}
        </p>
      )}
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
      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>
        {fmtMonth(d.month)}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{d.score}</div>
    </div>
  );
}

// ─── LongevityScoreCard ───────────────────────────────────────────────────────

function LongevityScoreCard({ data, t }) {
  const [showRefs, setShowRefs] = useState(false);

  if (!data || !data.components) return null;

  // Sort components by weight descending
  const sortedComponents = useMemo(() => {
    return Object.entries(data.components).sort((a, b) => b[1].weight - a[1].weight);
  }, [data.components]);

  // Find the component key with the lowest score (improvement priority)
  const lowestKey = useMemo(() => {
    return sortedComponents.reduce(
      (minKey, [k, v]) =>
        v.score < (data.components[minKey]?.score ?? Infinity) ? k : minKey,
      sortedComponents[0][0]
    );
  }, [sortedComponents, data.components]);

  // Detect language from translation function
  const lang = t?.('app.title') === 'HealthDash' && t?.('app.subtitle') === 'Personal Health Dashboard'
    ? 'en'
    : 'zh';
  const labels = COMPONENT_LABELS[lang] || COMPONENT_LABELS.en;

  const trendArrow = data.trend === 'improving' ? '↑' : data.trend === 'declining' ? '↓' : '→';
  const trendColor =
    data.trend === 'improving'
      ? 'var(--color-green)'
      : data.trend === 'declining'
      ? 'var(--color-red)'
      : 'var(--text-muted)';
  const trendLabel =
    data.trend === 'improving'
      ? (t?.('healthScore.trend.improving') ?? 'Improving')
      : data.trend === 'declining'
      ? (t?.('healthScore.trend.declining') ?? 'Declining')
      : (t?.('healthScore.trend.stable') ?? 'Stable');

  const sparkColor = scoreColor(data.score);
  const sparklineData = Array.isArray(data.monthly) ? data.monthly : [];

  return (
    <div
      className="card"
      role="region"
      aria-label={t?.('longevity.title') ?? 'Longevity Score'}
      style={{ padding: '20px' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            className="section-title"
            style={{ marginBottom: '4px', letterSpacing: '0.06em' }}
          >
            {t?.('longevity.title') ?? 'LONGEVITY SCORE'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {t?.('longevity.subtitle') ?? 'Evidence-based long-term health assessment'}
          </p>
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <ScoreBadge score={data.score} />
          <div
            style={{
              fontSize: '12px',
              color: trendColor,
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {trendArrow} {trendLabel}
          </div>
        </div>
      </div>

      {/* ── Component bars ─────────────────────────────────────────────────── */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}
      >
        {sortedComponents.map(([key, comp]) => (
          <ComponentBar
            key={key}
            keyName={key}
            label={labels[key] || key}
            score={comp.score}
            weight={comp.weight}
            detail={comp.detail}
            isPriority={key === lowestKey}
            priorityLabel={t?.('longevity.priority') ?? '← Priority'}
          />
        ))}
      </div>

      {/* ── Monthly sparkline ───────────────────────────────────────────────── */}
      {sparklineData.length > 2 && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            {t?.('healthScore.last30') ?? 'Trend'}
          </div>
          <div style={{ height: '50px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                <defs>
                  <linearGradient id="longevityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={sparkColor}
                  fill="url(#longevityGrad)"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: sparkColor }}
                  isAnimationActive={true}
                />
                <Tooltip content={<SparklineTooltip />} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── References toggle ───────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        <button
          onClick={() => setShowRefs(!showRefs)}
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'inherit',
          }}
          aria-expanded={showRefs}
        >
          {t?.('longevity.sources') ?? 'Sources'} {showRefs ? '▴' : '▾'}
        </button>

        {showRefs && Array.isArray(data.references) && data.references.length > 0 && (
          <ul
            style={{
              marginTop: '8px',
              paddingLeft: '16px',
              listStyle: 'disc',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {data.references.map((ref, i) => (
              <li
                key={i}
                style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}
              >
                {ref}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default LongevityScoreCard;
