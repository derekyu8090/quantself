import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function ECGPanel({ data, t }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!data?.records?.length) return (
    <div className="panel">
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
        {t?.('ecg.noData') ?? 'No ECG recordings available'}
      </p>
    </div>
  );

  const recording = data.records[selectedIdx];
  const chartData = recording.samples.map((v, i) => ({ i, v }));

  // Classification color
  const classColor = recording.classification.includes('Sinus') ? 'var(--color-green)' :
                     recording.classification.includes('Under 50') ? 'var(--color-amber)' :
                     'var(--color-red)';

  return (
    <div className="panel">
      {/* Selector */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          aria-label={t?.('ecg.recording') ?? 'Recording'}
          style={{
            background: 'var(--bg-inset)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: '13px',
          }}
        >
          {data.records.map((r, i) => (
            <option key={i} value={i}>{r.date} — {r.classification}</option>
          ))}
        </select>
        <span style={{
          fontSize: '13px',
          padding: '3px 10px',
          borderRadius: '12px',
          background: classColor,
          color: '#fff',
          fontWeight: 600,
          opacity: 0.9,
        }}>
          {recording.classification}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{recording.sampleRate}</span>
      </div>

      {/* Waveform */}
      <div className="chart-card">
        <div className="chart-card-header">
          <p className="chart-card-title">{t?.('ecg.waveform') ?? 'ECG Waveform'} — Lead I</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Line
              type="monotone"
              dataKey="v"
              stroke="var(--color-heart)"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ECGPanel;
