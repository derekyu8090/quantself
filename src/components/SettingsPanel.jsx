/**
 * SettingsPanel - User-configurable scoring weights and risk thresholds
 *
 * Stores settings in localStorage and exposes them for scoring adjustments.
 *
 * Usage:
 *   <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} t={t} />
 */

import { useState } from 'react';

const DEFAULT_WEIGHTS = {
  rhr: 13, hrv: 18, sleep: 23, activity: 13, recovery: 13, body: 10, daylight: 10,
};

const DEFAULT_THRESHOLDS = {
  sleepTarget: 7.5,
  stepsTarget: 8000,
  bedtimeTarget: 24,
  rhrHighThreshold: 75,
};

const WEIGHT_LABELS = {
  en: { rhr: 'Heart Rate', hrv: 'HRV', sleep: 'Sleep', activity: 'Activity', recovery: 'Recovery', body: 'Body', daylight: 'Daylight' },
  zh: { rhr: '心率', hrv: 'HRV', sleep: '睡眠', activity: '活动', recovery: '恢复', body: '体质', daylight: '日光' },
};

const THRESHOLD_LABELS = {
  en: { sleepTarget: 'Sleep Target (hours)', stepsTarget: 'Steps Target', bedtimeTarget: 'Bedtime Target (hour)', rhrHighThreshold: 'RHR Alert Threshold (bpm)' },
  zh: { sleepTarget: '睡眠目标 (小时)', stepsTarget: '步数目标', bedtimeTarget: '入睡目标 (小时)', rhrHighThreshold: 'RHR 警报阈值 (bpm)' },
};

const STORAGE_KEY = 'quantself-user-settings';

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function SettingsPanel({ visible, onClose, t }) {
  const lang = t?.('app.title') === 'HealthDash' ? 'en' : 'zh';

  const [weights, setWeights] = useState(() => {
    const s = loadSettings();
    return s?.weights ?? { ...DEFAULT_WEIGHTS };
  });
  const [thresholds, setThresholds] = useState(() => {
    const s = loadSettings();
    return s?.thresholds ?? { ...DEFAULT_THRESHOLDS };
  });
  const [showSaved, setShowSaved] = useState(false);

  if (!visible) return null;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const wLabels = WEIGHT_LABELS[lang] ?? WEIGHT_LABELS.en;
  const tLabels = THRESHOLD_LABELS[lang] ?? THRESHOLD_LABELS.en;

  const handleSave = () => {
    saveSettings({ weights, thresholds });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleReset = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setThresholds({ ...DEFAULT_THRESHOLDS });
    localStorage.removeItem(STORAGE_KEY);
  };

  const inputStyle = {
    width: '60px',
    padding: '4px 6px',
    fontSize: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    textAlign: 'right',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: '420px',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--text-heading)', fontSize: '16px', fontWeight: 600, margin: 0 }}>
            {t?.('settings.title') ?? 'Settings'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            x
          </button>
        </div>

        {/* Scoring Weights */}
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '8px' }}>
          {t?.('settings.scoringWeights') ?? 'Scoring Weights'}
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '11px', marginLeft: '8px' }}>
            (total: {totalWeight}%)
          </span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '20px' }}>
          {Object.keys(DEFAULT_WEIGHTS).map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{wLabels[key] ?? key}</span>
              <input
                type="number"
                value={weights[key]}
                min={0}
                max={100}
                step={1}
                onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        {/* Thresholds */}
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '8px' }}>
          {t?.('settings.riskThresholds') ?? 'Risk Thresholds'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {Object.keys(DEFAULT_THRESHOLDS).map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tLabels[key] ?? key}</span>
              <input
                type="number"
                value={thresholds[key]}
                step={key.includes('sleep') || key.includes('bedtime') ? 0.5 : 1}
                onChange={(e) => setThresholds({ ...thresholds, [key]: parseFloat(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t?.('settings.reset') ?? 'Reset Defaults'}
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              background: 'var(--color-blue)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showSaved ? (t?.('settings.saved') ?? 'Saved!') : (t?.('settings.save') ?? 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
