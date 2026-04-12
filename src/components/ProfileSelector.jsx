/**
 * ProfileSelector — dropdown for switching between multiple health data profiles
 * with delete support for non-default profiles.
 *
 * Usage:
 *   <ProfileSelector
 *     registry={profileRegistry}
 *     active={activeProfile}
 *     onChange={setActiveProfile}
 *     onDelete={handleDeleteProfile}
 *     t={t}
 *   />
 */

import { useState, useRef, useEffect } from 'react';

function ProfileSelector({ registry, active, onChange, onDelete, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!registry || !registry.profiles?.length) return null;

  const lang = t?.('app.title') === 'HealthDash' ? 'en' : 'zh';
  const activeProfile = registry.profiles.find(p => p.name === active) || registry.profiles[0];

  const handleDelete = async (e, name) => {
    e.stopPropagation();
    const confirmMsg = lang === 'zh'
      ? `确定删除档案 "${name}"？此操作不可恢复。`
      : `Delete profile "${name}"? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;
    await onDelete(name);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="print-hide"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          {lang === 'zh' ? '档案' : 'Profile'}
        </span>
        <span>{activeProfile.label || activeProfile.name}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '240px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 500,
            overflow: 'hidden',
          }}
        >
          {registry.profiles.map((p) => {
            const isActive = p.name === active;
            const canDelete = p.name !== 'default';
            return (
              <div
                key={p.name}
                onClick={() => { onChange(p.name); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--bg-inset)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)',
                  gap: '8px',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-inset)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: 'var(--text-heading)',
                    marginBottom: '2px',
                  }}>
                    {isActive && <span style={{ color: 'var(--color-green)', marginRight: '6px' }}>●</span>}
                    {p.label || p.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {p.age ? `${p.age} ${lang === 'zh' ? '岁' : 'y'} · ` : ''}
                    {p.sex === 'male' ? (lang === 'zh' ? '男' : 'M') : p.sex === 'female' ? (lang === 'zh' ? '女' : 'F') : ''}
                    {p.totalNights ? ` · ${p.totalNights} ${lang === 'zh' ? '晚' : 'nights'}` : ''}
                  </div>
                  {p.dataRange?.start && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {p.dataRange.start} – {p.dataRange.end}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, p.name)}
                    aria-label={lang === 'zh' ? '删除档案' : 'Delete profile'}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--color-red)',
                      fontSize: '11px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {lang === 'zh' ? '删除' : 'Delete'}
                  </button>
                )}
              </div>
            );
          })}
          <div style={{
            padding: '10px 14px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'var(--bg-inset)',
            lineHeight: 1.5,
          }}>
            {lang === 'zh'
              ? '新增档案：终端运行 python3 process_data.py <path> --profile <name>'
              : 'Add profile: python3 process_data.py <path> --profile <name>'}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileSelector;
