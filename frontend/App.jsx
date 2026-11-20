import { useState, useRef, useEffect, useCallback } from "react";
import { useAgent } from "./useAgent";
import { useHealth } from "./useHealth";
import IngestModal from "./IngestModal";
import "./index.css";

// ─── Icons (inline SVG to avoid dependencies) ────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    home: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>,
    chat: <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>,
    docs: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>,
    history: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>,
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>,
    settings: <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/>,
    plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>,
    send: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>,
    attach: <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>,
    source: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>,
    guard: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"/>,
    upload: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>,
    copy: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="nav-icon">
      {icons[name]}
    </svg>
  );
};

// ─── Left Sidebar ─────────────────────────────────────────────
function Sidebar({ activeNav, setActiveNav, onIngest, health, healthLoading }) {
  const navItems = [
    { id: "home",     label: "Home",        icon: "home" },
    { id: "chat",     label: "New Chat",    icon: "chat" },
    { id: "docs",     label: "Documents",   icon: "docs" },
    { id: "history",  label: "History",     icon: "history" },
    { id: "guards",   label: "Guardrails",  icon: "shield" },
    { id: "settings", label: "Settings",    icon: "settings" },
  ];

  const statusText = healthLoading
    ? "Connecting…"
    : health
    ? `${health.vector_store_docs} vectors · ${health.bm25_docs} bm25`
    : "Backend offline";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">V</div>
        <div>
          <div className="brand-name">Verdict</div>
          <div className="brand-tagline">Document Intelligence</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Workspace</div>
        {navItems.slice(0, 3).map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => {
              setActiveNav(item.id);
              if (item.id === "docs") onIngest();
            }}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Activity</div>
        {navItems.slice(3, 5).map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => setActiveNav(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>System</div>
        {navItems.slice(5).map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => setActiveNav(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar">U</div>
          <div>
            <div className="user-name">User</div>
            <div className="user-role">Developer</div>
          </div>
        </div>
        <div className="status-row">
          <div className={`status-dot ${healthLoading ? "loading" : health ? "" : "offline"}`} />
          <span>{statusText}</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────
function WelcomeScreen({ onSend, onIngest }) {
  const cards = [
    { icon: "📄", bg: "wci-upload", title: "Upload Documents", desc: "PDFs and supported files become searchable knowledge instantly.", action: onIngest },
    { icon: "💬", bg: "wci-ask",    title: "Ask Your Documents", desc: "Find answers with hybrid RAG retrieval and source citations.", action: null },
    { icon: "🔍", bg: "wci-explore",title: "Explore Knowledge", desc: "Search your indexed documents and discover relevant information.", action: null },
  ];

  const prompts = [
    "Summarise the key findings",
    "What are the main conclusions?",
    "Compare the approaches described",
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-symbol">V</div>
      <h1 className="welcome-title">Welcome to Verdict</h1>
      <p className="welcome-subtitle">Your documents. One intelligent conversation.</p>

      <div className="welcome-cards">
        {cards.map((c) => (
          <div key={c.title} className="welcome-card" onClick={c.action || undefined}>
            <div className={`welcome-card-icon ${c.bg}`}>{c.icon}</div>
            <div className="welcome-card-title">{c.title}</div>
            <div className="welcome-card-desc">{c.desc}</div>
          </div>
        ))}
      </div>

      <p className="suggested-label">Suggested prompts</p>
      <div className="suggested-prompts">
        {prompts.map((p) => (
          <button key={p} className="prompt-chip" onClick={() => onSend(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────────
function Message({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  function copy() {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className={`chat-message ${isUser ? "user" : "assistant"} ${msg.blocked ? "blocked" : ""}`}>
      <div className={`msg-avatar ${isUser ? "user-av" : "agent-av"}`}>
        {isUser ? "U" : "V"}
      </div>
      <div className="msg-body">
        <div className="msg-role-label">{isUser ? "You" : "Verdict"}</div>
        <div className="msg-bubble">{msg.content}</div>
        {!isUser && (
          <div className="msg-meta">
            {msg.blocked && <span className="meta-pill meta-blocked">Blocked</span>}
            {msg.toolCalls > 0 && (
              <span className="meta-pill meta-tools">{msg.toolCalls} retrieval{msg.toolCalls > 1 ? "s" : ""}</span>
            )}
            <button
              onClick={copy}
              style={{ background: "none", color: "var(--text-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
              title="Copy"
            >
              <Icon name="copy" size={13} />
              {copied ? "Copied" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking Indicator ───────────────────────────────────────
function Thinking() {
  return (
    <div className="thinking-row">
      <div className="thinking-av">V</div>
      <div className="thinking-label">
        <div className="dots">
          <div className="dot" /><div className="dot" /><div className="dot" />
        </div>
        retrieving · reranking · generating
      </div>
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────
function Composer({ onSend, onIngest, isLoading }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  function submit() {
    const q = text.trim();
    if (!q || isLoading) return;
    setText("");
    onSend(q);
    setTimeout(() => ref.current?.focus(), 0);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          className="composer-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything about your documents…"
          rows={1}
          disabled={isLoading}
        />
        <div className="composer-actions">
          <button className="composer-attach" onClick={onIngest} title="Upload document">
            <Icon name="attach" size={17} />
          </button>
          <button
            className="composer-send"
            onClick={submit}
            disabled={!text.trim() || isLoading}
            title="Send"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
      <div className="composer-hint">Enter to send · Shift+Enter for newline</div>
    </div>
  );
}

// ─── Right Sidebar ─────────────────────────────────────────────
function RightSidebar({ citations, guardEvents, activeTab, setActiveTab, messages, onNewChat }) {
  const conversations = messages.length > 0
    ? [{ id: 1, title: messages.find(m => m.role === "user")?.content?.slice(0, 48) || "Conversation", time: "Just now" }]
    : [];

  return (
    <aside className="right-sidebar">
      <div className="right-header">
        <div className="right-title">Activity</div>
        <div className="right-tabs">
          {["history", "sources", "guards"].map(tab => (
            <button
              key={tab}
              className={`right-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="right-scroll">
        {activeTab === "history" && (
          <>
            <button className="conv-new-btn" onClick={onNewChat}>
              <Icon name="plus" size={15} />
              New conversation
            </button>
            {conversations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-box"><Icon name="history" size={20} /></div>
                <div className="empty-title">No conversations yet</div>
                <div className="empty-desc">Start asking questions about your documents</div>
              </div>
            ) : conversations.map(c => (
              <div key={c.id} className="conv-item active">
                <div className="conv-title">{c.title}</div>
                <div className="conv-time">{c.time}</div>
              </div>
            ))}
          </>
        )}

        {activeTab === "sources" && (
          citations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-box"><Icon name="source" size={20} /></div>
              <div className="empty-title">No sources yet</div>
              <div className="empty-desc">Retrieved sources and relevance scores appear here</div>
            </div>
          ) : citations.map((c, i) => (
            <div key={c.chunk_id || i} className="citation-card">
              <div className="citation-top">
                <span className="citation-source" title={c.source}>{c.source}</span>
                <div className="citation-badges">
                  {c.page && <span className="badge-sm badge-page">p.{c.page}</span>}
                  {c.score != null && <span className="badge-sm badge-score">{c.score.toFixed(3)}</span>}
                </div>
              </div>
              <p className="citation-excerpt">{c.text}</p>
            </div>
          ))
        )}

        {activeTab === "guards" && (
          guardEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-box"><Icon name="guard" size={20} /></div>
              <div className="empty-title">Guard log is clean</div>
              <div className="empty-desc">Blocked queries and flagged responses appear here</div>
            </div>
          ) : [...guardEvents].reverse().map((e, i) => (
            <div key={i} className={`guard-event ${e.status}`}>
              <div className="guard-top">
                <span className={`guard-pill gp-${e.status}`}>{e.status}</span>
                <span className="guard-stage">{e.stage}</span>
                {e.rule && <span className="guard-rule">{e.rule}</span>}
              </div>
              {e.reason && <p className="guard-reason">{e.reason}</p>}
              <span className="guard-time">{e.time}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// ─── App Root ─────────────────────────────────────────────────
export default function App() {
  const [activeNav, setActiveNav]   = useState("home");
  const [rightTab, setRightTab]     = useState("history");
  const [ingestOpen, setIngestOpen] = useState(false);
  const threadRef = useRef(null);

  const { health, loading: healthLoading } = useHealth();
  const { messages, citations, guardEvents, isLoading, sendQuery, clearHistory } = useAgent();

  const hasMessages = messages.length > 0;

  // Auto-scroll
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Switch to guards tab on non-pass event
  useEffect(() => {
    if (guardEvents.length > 0) {
      const latest = guardEvents[guardEvents.length - 1];
      if (latest.status !== "pass") setRightTab("guards");
    }
  }, [guardEvents]);

  // Switch to sources when citations arrive
  useEffect(() => {
    if (citations.length > 0) setRightTab("sources");
  }, [citations.length]);

  function handleSend(q) {
    setActiveNav("chat");
    sendQuery(q);
  }

  function handleNewChat() {
    clearHistory();
    setActiveNav("home");
    setRightTab("history");
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onIngest={() => setIngestOpen(true)}
        health={health}
        healthLoading={healthLoading}
      />

      <div className="main-workspace">
        {!hasMessages ? (
          <WelcomeScreen onSend={handleSend} onIngest={() => setIngestOpen(true)} />
        ) : (
          <div className="chat-thread" ref={threadRef}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {isLoading && <Thinking />}
          </div>
        )}

        <Composer
          onSend={handleSend}
          onIngest={() => setIngestOpen(true)}
          isLoading={isLoading}
        />
      </div>

      <RightSidebar
        citations={citations}
        guardEvents={guardEvents}
        activeTab={rightTab}
        setActiveTab={setRightTab}
        messages={messages}
        onNewChat={handleNewChat}
      />

      {ingestOpen && <IngestModal onClose={() => setIngestOpen(false)} />}
    </div>
  );
}
