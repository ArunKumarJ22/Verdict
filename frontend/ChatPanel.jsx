import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, isLoading, onSend, onClear }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    onSend(q);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return (
    <div className="chat-panel">
      {/* Message thread */}
      <div className="chat-thread">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <span className="chat-welcome-icon">◈</span>
            <p className="chat-welcome-title">Ask anything about your documents</p>
            <p className="chat-welcome-sub">
              Ingest a document first, then ask questions.<br />
              The agent uses hybrid retrieval + re-ranking to find answers.
            </p>
            <div className="chat-example-queries">
              {[
                "Summarise the key findings",
                "What does the document say about X?",
                "Compare the approaches described",
              ].map((q) => (
                <button
                  key={q}
                  className="example-query"
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {isLoading && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-area">
        {messages.length > 0 && (
          <button className="btn-ghost clear-btn" onClick={onClear}>
            Clear
          </button>
        )}
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={submit}
            disabled={!input.trim() || isLoading}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        .chat-panel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-base);
        }

        .chat-thread {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .chat-welcome {
          margin: auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          max-width: 420px;
          padding: 40px 0;
        }

        .chat-welcome-icon {
          font-size: 36px;
          color: var(--accent);
          opacity: 0.7;
        }

        .chat-welcome-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .chat-welcome-sub {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .chat-example-queries {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
          width: 100%;
        }

        .example-query {
          background: var(--bg-raised);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 14px;
          font-size: 12px;
          text-align: left;
          transition: border-color 0.15s, color 0.15s;
        }

        .example-query:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }

        /* ── Messages ───────────────────── */
        .message {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 820px;
        }

        .message-role {
          font-size: 10px;
          font-family: var(--mono);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding-left: 2px;
        }

        .message-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          line-height: 1.7;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message.user { align-self: flex-end; }
        .message.user .message-bubble {
          background: var(--user-bubble);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .message.assistant { align-self: flex-start; }
        .message.assistant .message-bubble {
          background: var(--agent-bubble);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }

        .message.blocked .message-bubble {
          border-color: var(--block);
          background: var(--block-bg);
          color: var(--block);
        }

        .message-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 2px;
        }

        .meta-tools {
          font-size: 10px;
          font-family: var(--mono);
          color: var(--text-muted);
        }

        /* ── Thinking indicator ───────── */
        .thinking {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          color: var(--text-muted);
          font-size: 12px;
          font-family: var(--mono);
        }

        .thinking-dots {
          display: flex;
          gap: 4px;
        }

        .thinking-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse-dot 1.2s ease-in-out infinite;
        }

        .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }

        /* ── Input area ─────────────── */
        .chat-input-area {
          padding: 12px 20px 16px;
          border-top: 1px solid var(--border);
          background: var(--bg-surface);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .clear-btn {
          align-self: flex-end;
          font-size: 11px;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .chat-textarea {
          flex: 1;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--sans);
          font-size: 13.5px;
          line-height: 1.5;
          padding: 10px 14px;
          resize: none;
          min-height: 42px;
          max-height: 160px;
          overflow-y: auto;
          transition: border-color 0.15s;
        }

        .chat-textarea::placeholder { color: var(--text-muted); }
        .chat-textarea:focus { outline: none; border-color: var(--accent); }
        .chat-textarea:disabled { opacity: 0.5; }

        .send-btn {
          background: var(--accent);
          color: #fff;
          width: 38px;
          height: 38px;
          border-radius: var(--radius-sm);
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }

        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .send-btn:not(:disabled):hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}

function Message({ msg }) {
  const isBlocked = msg.blocked;
  return (
    <div className={`message ${msg.role} ${isBlocked ? "blocked" : ""}`}>
      <span className="message-role">{msg.role === "user" ? "you" : "agent"}</span>
      <div className="message-bubble">{msg.content}</div>
      {msg.role === "assistant" && (
        <div className="message-meta">
          {isBlocked && <span className="pill pill-block">blocked</span>}
          {msg.toolCalls > 0 && (
            <span className="meta-tools">{msg.toolCalls} retrieval{msg.toolCalls > 1 ? "s" : ""}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="thinking">
      <div className="thinking-dots">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
      retrieving · reranking · generating
    </div>
  );
}
