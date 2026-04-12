/**
 * ChatPanel — Floating chat bubble for natural language health data Q&A
 *
 * Renders as a fixed-position button at bottom-right. Click to expand into
 * a chat window. Available from any tab in the dashboard.
 *
 * Connects to chat_server.py (http://localhost:5180/api/chat).
 *
 * Usage:
 *   <ChatPanel t={t} />
 */

import { useState, useRef, useEffect } from 'react';

const CHAT_API = 'http://localhost:5180/api/chat';
const HEALTH_API = 'http://localhost:5180/api/health';

function ChatPanel({ t }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUp, setServerUp] = useState(null);
  const bottomRef = useRef(null);

  // Check if chat server is available (GET /api/health, cheaper than OPTIONS)
  useEffect(() => {
    fetch(HEALTH_API)
      .then(r => r.ok ? setServerUp(true) : setServerUp(false))
      .catch(() => setServerUp(false));
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const lang = t?.('app.title') === 'HealthDash' && t?.('tabs.glossary') === 'Glossary' ? 'en' : 'zh';

  const handleSend = async (overrideText) => {
    const q = (overrideText ?? input).trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: 'error', text: data.error }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', text: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholders = {
    en: 'Ask about your health data...',
    zh: '问问你的健康数据...',
  };

  const quickQuestions = lang === 'zh'
    ? ['最近睡眠质量怎么样？', '心血管风险如何？', '给我训练建议']
    : ['How is my sleep?', 'Cardiac risks?', 'Training advice'];

  // Don't render anything until we know server status
  if (serverUp === null) return null;

  // ── Collapsed bubble ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={lang === 'zh' ? '打开健康问答' : 'Open Health Q&A'}
        className="print-hide"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 900,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: serverUp ? 'var(--color-blue)' : 'var(--text-muted)',
          border: 'none',
          color: '#fff',
          fontSize: '20px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span aria-hidden="true">AI</span>
      </button>
    );
  }

  // ── Expanded chat window ──
  return (
    <div
      className="print-hide"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 900,
        width: '380px',
        maxWidth: 'calc(100vw - 48px)',
        height: '520px',
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-inset)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--color-blue)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
          }}>AI</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
              {lang === 'zh' ? '健康问答' : 'Health Q&A'}
            </div>
            <div style={{ fontSize: '10px', color: serverUp ? 'var(--color-green)' : 'var(--color-red)' }}>
              {serverUp ? (lang === 'zh' ? '在线' : 'Online') : (lang === 'zh' ? '离线' : 'Offline')} · Claude Sonnet 4.6
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label={lang === 'zh' ? '关闭' : 'Close'}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >×</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {messages.length === 0 && serverUp && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            {lang === 'zh' ? '问问你的健康数据，开始对话' : 'Ask about your health data to start'}
          </div>
        )}
        {messages.length === 0 && !serverUp && (
          <div style={{
            padding: '12px',
            background: 'var(--bg-inset)',
            borderRadius: 'var(--radius)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            {lang === 'zh'
              ? '聊天服务未运行。请在终端运行：'
              : 'Chat server not running. Start it with:'}
            <code style={{
              display: 'block',
              marginTop: '8px',
              padding: '6px 10px',
              background: 'var(--bg-card)',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'Menlo, monospace',
            }}>python3 chat_server.py</code>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              lineHeight: 1.6,
              background: msg.role === 'user'
                ? 'var(--color-blue)'
                : msg.role === 'error'
                  ? 'var(--color-red-dim)'
                  : 'var(--bg-inset)',
              color: msg.role === 'user'
                ? '#fff'
                : msg.role === 'error'
                  ? 'var(--color-red)'
                  : 'var(--text-primary)',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'var(--bg-inset)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            alignSelf: 'flex-start',
          }}>
            {lang === 'zh' ? '思考中...' : 'Thinking...'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions (only when empty) */}
      {messages.length === 0 && serverUp && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}>
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[lang]}
          disabled={loading || !serverUp}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim() || !serverUp}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            background: (loading || !input.trim() || !serverUp) ? 'var(--bg-inset)' : 'var(--color-blue)',
            border: 'none',
            borderRadius: '8px',
            color: (loading || !input.trim() || !serverUp) ? 'var(--text-muted)' : '#fff',
            cursor: (loading || !input.trim() || !serverUp) ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          {lang === 'zh' ? '发送' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
