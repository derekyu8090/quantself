/**
 * ChatPanel — Natural language health data Q&A
 *
 * Connects to chat_server.py (localhost:5180) for LLM-powered answers.
 * Shows inline in the Insights tab below correlations.
 *
 * Usage:
 *   <ChatPanel t={t} />
 */

import { useState, useRef, useEffect } from 'react';

const CHAT_API = 'http://localhost:5180/api/chat';

function ChatPanel({ t }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUp, setServerUp] = useState(null);
  const bottomRef = useRef(null);

  // Check if chat server is available
  useEffect(() => {
    fetch(CHAT_API, { method: 'OPTIONS' })
      .then(() => setServerUp(true))
      .catch(() => setServerUp(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lang = t?.('app.title') === 'HealthDash' && t?.('tabs.glossary') === 'Glossary' ? 'en' : 'zh';

  const handleSend = async () => {
    const q = input.trim();
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
    en: 'Ask about your health data... e.g. "Why is my HRV declining?"',
    zh: '问问你的健康数据... 例如 "我的 HRV 为什么在下降？"',
  };

  const quickQuestions = lang === 'zh'
    ? ['我最近睡眠质量怎么样？', '我的心血管风险如何？', '给我训练建议']
    : ['How is my sleep quality?', 'What are my cardiac risks?', 'Training advice'];

  if (serverUp === false) {
    return (
      <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px' }}>AI</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
            {lang === 'zh' ? '健康问答' : 'Health Q&A'}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {lang === 'zh'
            ? '聊天服务未运行。请在终端运行: python3 chat_server.py'
            : 'Chat server not running. Start it with: python3 chat_server.py'}
        </p>
      </div>
    );
  }

  if (serverUp === null) return null;

  return (
    <div className="card" style={{ padding: '16px 20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px' }}>AI</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
          {lang === 'zh' ? '健康问答' : 'Health Q&A'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-green)' }}>online</span>
      </div>

      {/* Quick questions */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
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

      {/* Messages */}
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              lineHeight: 1.6,
              background: msg.role === 'user' ? 'var(--color-blue)' : msg.role === 'error' ? 'var(--color-red-dim)' : 'var(--bg-inset)',
              color: msg.role === 'user' ? '#fff' : msg.role === 'error' ? 'var(--color-red)' : 'var(--text-primary)',
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
            borderRadius: 'var(--radius)',
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

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[lang]}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            background: loading || !input.trim() ? 'var(--bg-inset)' : 'var(--color-blue)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: loading || !input.trim() ? 'var(--text-muted)' : '#fff',
            cursor: loading || !input.trim() ? 'default' : 'pointer',
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
