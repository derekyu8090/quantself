import { useState } from 'react';

// Usage:
// <WeeklyReport data={data.overview.weeklyReport} t={t} />
//
// data shape:
// { en: "## This Week\n...", zh: "## 本周\n...", generatedAt: "2026-04-11 02:30", period: "...", error: null }

function WeeklyReport({ data, t }) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data.error || (!data.en && !data.zh)) return null;

  const lang = t?.('app.title') === 'HealthDash' && t?.('app.subtitle') === 'Personal Health Dashboard' ? 'en' : 'zh';
  const report = lang === 'zh' ? data.zh : data.en;

  if (!report) return null;

  // Safe markdown rendering — no dangerouslySetInnerHTML
  const parseBold = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMarkdown = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h4
            key={i}
            style={{
              color: 'var(--text-heading)',
              fontSize: '13px',
              fontWeight: 600,
              marginTop: i > 0 ? '12px' : 0,
              marginBottom: '4px',
            }}
          >
            {line.slice(3)}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div
            key={i}
            style={{
              paddingLeft: '12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.6,
            }}
          >
            &bull; {parseBold(line.slice(2))}
          </div>
        );
      }
      if (line.includes('**')) {
        return (
          <p
            key={i}
            style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}
          >
            {parseBold(line)}
          </p>
        );
      }
      if (line.trim() === '') return null;
      return (
        <p key={i} style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div
      className="card"
      style={{
        borderLeft: '3px solid var(--color-blue)',
        padding: '16px 20px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expanded ? '12px' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>AI</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
            {t?.('weeklyReport.title') ?? 'Weekly Health Report'}
          </span>
          {data.period && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{data.period}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? (t?.('weeklyReport.collapse') ?? 'Collapse') : (t?.('weeklyReport.expand') ?? 'Expand')}
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {expanded ? '▴' : '▾'}{' '}
          {expanded ? (t?.('weeklyReport.collapse') ?? 'Collapse') : (t?.('weeklyReport.expand') ?? 'Expand')}
        </button>
      </div>

      {expanded && (
        <div>
          {renderMarkdown(report)}
          {data.generatedAt && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
              }}
            >
              {t?.('weeklyReport.generated') ?? 'Generated'}: {data.generatedAt} | Claude Sonnet 4.6
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WeeklyReport;
