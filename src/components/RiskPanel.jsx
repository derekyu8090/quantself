/**
 * RiskPanel - displays health risk scores, goals, and anomaly timeline
 *
 * Usage:
 * import overviewData from '../data/overview.json'
 * <RiskPanel overview={overviewData} />
 */

import { fmtDateFullZh as formatDate, filterByDateRange } from '../utils/dataUtils';
import { useDateRange } from '../contexts/DateRangeContext';

// ─── risk level config ─────────────────────────────────────────────────────

const RISK_COLORS = {
  'high':        { color: 'var(--color-red)',   bg: 'var(--color-red-dim)' },
  'medium-high': { color: 'var(--color-risk)',  bg: 'rgba(251,146,60,0.10)' },
  'medium':      { color: 'var(--color-amber)', bg: 'var(--color-amber-dim)' },
  'low-medium':  { color: 'var(--color-green)', bg: 'var(--color-green-dim)' },
  'low':         { color: 'var(--color-green)', bg: 'var(--color-green-dim)' },
};

const RISK_LABELS_EN = {
  high: '高风险',
  'medium-high': '中高',
  medium: '中等',
  'low-medium': '中低',
  low: '低风险',
};

function getRiskEntry(level) {
  return RISK_COLORS[level] ?? { color: 'var(--text-muted)', bg: 'var(--bg-inset)' };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert decimal hours to HH:MM string. e.g. 27.6 → 03:36 (next day) */
function hoursToHHMM(h) {
  if (h == null || isNaN(h)) return '--';
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Detect if a goal key is bedtime-related */
function isBedtimeGoal(key) {
  return key === 'bedtime' || key.toLowerCase().includes('bed') || key.toLowerCase().includes('sleep');
}

/**
 * Compute progress ratio: 0..1, how far current is toward target.
 * For bedtime, lower is better (earlier bedtime). For others, higher is better.
 */
function computeProgress(key, current, target4w) {
  if (current == null || target4w == null) return 0;
  if (isBedtimeGoal(key)) {
    const improvement = current - target4w;
    if (improvement <= 0) return 1;
    return Math.min(1, Math.max(0, (current - target4w) / improvement));
  }
  if (target4w <= current) return 1;
  return Math.min(1, Math.max(0, current / target4w));
}

/**
 * Traffic-light CSS variable for goal progress bar fill.
 * ratio >= 0.8: green, >= 0.5: amber, < 0.5: red
 */
function progressBarColor(ratio) {
  if (ratio >= 0.8) return 'var(--color-green)';
  if (ratio >= 0.5) return 'var(--color-amber)';
  return 'var(--color-red)';
}

/**
 * Traffic-light CSS variable for goal current value label.
 * Compares current against 2-week target milestone.
 */
function goalTextColor(key, current, target2w) {
  if (current == null) return 'var(--text-muted)';
  if (isBedtimeGoal(key)) {
    if (current <= target2w) return 'var(--color-green)';
    if (current <= target2w + 0.5) return 'var(--color-amber)';
    return 'var(--color-red)';
  }
  if (current >= target2w) return 'var(--color-green)';
  if (current >= target2w * 0.85) return 'var(--color-amber)';
  return 'var(--color-red)';
}

// ─── anomaly type icons (text) ─────────────────────────────────────────────

const ANOMALY_ICONS = {
  rhr_high: 'HR',
  rhr_low: 'HR',
  hrv_low: 'HRV',
  hrv_high: 'HRV',
  sleep_short: 'ZZZ',
  sleep_long: 'ZZZ',
  steps_low: 'STP',
  weight_spike: 'WT',
};

function anomalyIcon(type) {
  const key = Object.keys(ANOMALY_ICONS).find((k) => type?.includes(k.split('_')[0]));
  return ANOMALY_ICONS[key] ?? '!';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function UserProfileCard({ user, t }) {
  if (!user) return null;

  const profileItems = [
    { label: t?.('risk.age') ?? '年龄', value: user.age, unit: '岁' },
    { label: t?.('risk.sex') ?? '性别', value: user.sex === 'male' ? (t?.('risk.male') ?? '男') : user.sex === 'female' ? (t?.('risk.female') ?? '女') : user.sex },
    { label: t?.('risk.weight') ?? '体重', value: user.currentWeight, unit: 'kg' },
    { label: t?.('risk.bodyFat') ?? '体脂率', value: user.currentBodyFat, unit: '%' },
  ];

  return (
    <div className="card" role="region" aria-label="用户概况">
      <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('risk.profile') ?? '个人档案'}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {profileItems.map(({ label, value, unit }) => (
          <div
            key={label}
            style={{
              flex: '1 1 120px',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}>
              {label}
            </div>
            <div style={{ color: 'var(--text-heading)', fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>
              {value ?? '--'}
              {unit && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBar({ label, level, score, t }) {
  const { color, bg } = getRiskEntry(level);
  const riskLevels = t?.('risk.riskLevels') ?? RISK_LABELS_EN;
  const levelLabel = riskLevels[level] ?? level;

  return (
    <div
      style={{ marginBottom: '16px' }}
      role="meter"
      aria-label={`${label} 风险 ${score}`}
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 9px',
              borderRadius: 'var(--radius-sm)',
              background: bg,
              color,
              border: `1px solid ${color}`,
              borderColor: color,
              opacity: 1,
            }}
          >
            {levelLabel}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px', minWidth: 28, textAlign: 'right' }}>
            {score}
          </span>
        </div>
      </div>
      <div className="progress-bar-wrap">
        <div
          className="progress-bar-fill"
          style={{
            width: `${score}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function RiskAssessment({ risks, t }) {
  if (!risks || !Object.keys(risks).length) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无风险数据</p>;
  }

  const sorted = Object.entries(risks)
    .map(([, v]) => v)
    .filter(Boolean)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="card" role="region" aria-label="风险评估">
      <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('risk.riskAssessment') ?? '风险评估'}</p>
      {sorted.map((r) => (
        <RiskBar key={r.label} label={r.label} level={r.level} score={r.score ?? 0} t={t} />
      ))}
    </div>
  );
}

function GoalRow({ goalKey, goal, t }) {
  if (!goal) return null;
  const { current, target2w, target4w, unit, label } = goal;
  const isBed = isBedtimeGoal(goalKey);
  const textColor = goalTextColor(goalKey, current, target2w);
  const progressRatio = computeProgress(goalKey, current, target4w);
  const progressWidth = Math.min(100, Math.max(0, progressRatio * 100));
  const barColor = progressBarColor(progressRatio);

  const fmt = (v) => {
    if (v == null) return '--';
    if (isBed) return hoursToHHMM(v);
    return typeof v === 'number' ? v.toLocaleString() : v;
  };

  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
      }}
      role="meter"
      aria-label={`${label} 目标进度`}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, minWidth: 100 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ color: textColor, fontWeight: 700, fontSize: '15px' }}>
            {fmt(current)} {unit}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>→</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {fmt(target2w)}{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t?.('risk.target2w') ?? '2W'}</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>→</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {fmt(target4w)}{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t?.('risk.target4w') ?? '4W'}</span>
          </span>
        </div>
      </div>
      <div className="progress-bar-wrap">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progressWidth}%`,
            background: barColor,
          }}
        />
      </div>
    </div>
  );
}

function GoalTracking({ goals, t }) {
  if (!goals || !Object.keys(goals).length) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>暂无目标数据</p>;
  }

  return (
    <div className="card" role="region" aria-label="目标追踪">
      <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('risk.goalTracking') ?? '目标追踪'}</p>
      {Object.entries(goals).map(([key, goal]) => (
        <GoalRow key={key} goalKey={key} goal={goal} t={t} />
      ))}
    </div>
  );
}

function AnomalyTimeline({ anomalies, t }) {
  if (!anomalies?.length) {
    return (
      <div className="card" role="region" aria-label="异常事件">
        <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('risk.anomalies') ?? '异常事件'}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>无异常记录</p>
      </div>
    );
  }

  // Filter to significant anomalies by type, limit to 20 most recent
  const significant = anomalies.filter(a => {
    if (a.type === 'rhr_high') return a.value >= 65;
    if (a.type === 'hrv_low') return true;
    if (a.type === 'sleep_short') return true;
    if (a.type === 'bedtime_late') return a.value >= 29; // after 5am only
    if (a.type === 'spo2_low') return a.value < 88;
    if (a.type === 'steps_low') return true;
    return true;
  });
  const sorted = [...significant]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  return (
    <div className="card" role="region" aria-label="异常事件时间线">
      <p className="section-title" style={{ marginBottom: '16px' }}>{t?.('risk.anomalies') ?? '异常事件'}</p>
      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* vertical timeline connector */}
        <div
          style={{
            position: 'absolute',
            left: 11,
            top: 4,
            bottom: 4,
            width: 2,
            background: 'var(--border)',
            borderRadius: 1,
          }}
        />

        {sorted.map((item, i) => {
          const isHigh = item.type?.includes('high');
          const isLow = item.type?.includes('low');
          const dotColor = isHigh
            ? 'var(--color-red)'
            : isLow
            ? 'var(--color-activity)'
            : 'var(--color-amber)';
          const dotBg = isHigh
            ? 'var(--color-red-dim)'
            : isLow
            ? 'var(--color-activity-dim)'
            : 'var(--color-amber-dim)';
          const icon = anomalyIcon(item.type);

          return (
            <div
              key={`${item.date}-${i}`}
              style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20, position: 'relative' }}
            >
              {/* dot */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: -32,
                  top: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: dotBg,
                  border: `2px solid ${dotColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '7px',
                  fontWeight: 700,
                  color: dotColor,
                  letterSpacing: '-0.03em',
                }}
              >
                {icon}
              </div>

              {/* content */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: 2 }}>
                  {formatDate(item.date)}
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                  {item.label}
                  {item.value != null && (
                    <span style={{ color: dotColor, marginLeft: 6, fontSize: '13px' }}>
                      {item.value}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function RiskPanel({ overview, t }) {
  if (!overview) {
    return (
      <div
        className="card"
        style={{
          padding: '60px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        风险数据加载中...
      </div>
    );
  }

  const { startDate, endDate } = useDateRange();
  const anomaliesFiltered = filterByDateRange(overview.anomalies, startDate, endDate);

  return (
    <div className="panel" role="main" aria-label="风险面板">
      <UserProfileCard user={overview.user} t={t} />
      <RiskAssessment risks={overview.risks} t={t} />
      <GoalTracking goals={overview.goals} t={t} />
      <AnomalyTimeline anomalies={anomaliesFiltered} t={t} />
    </div>
  );
}

export default RiskPanel;
