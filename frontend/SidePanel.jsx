export default function SidePanel({ activeTab, onTabChange, citations, guardEvents }) {
  return (
    <div className="panel side-panel">
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === "citations" ? "active" : ""}`}
          onClick={() => onTabChange("citations")}
        >
          Sources {citations.length > 0 && <span className="tab-count">{citations.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === "events" ? "active" : ""}`}
          onClick={() => onTabChange("events")}
        >
          Guard log {guardEvents.filter(e => e.status !== "pass").length > 0 && (
            <span className="tab-count tab-count-warn">
              {guardEvents.filter(e => e.status !== "pass").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "citations" ? (
        <CitationsTab citations={citations} />
      ) : (
        <EventsTab events={guardEvents} />
      )}

      <style>{`
        .side-panel {
          background: var(--bg-surface);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-raised);
          color: var(--text-secondary);
          font-size: 10px;
          font-family: var(--mono);
          min-width: 18px;
          height: 16px;
          border-radius: 10px;
          padding: 0 4px;
          margin-left: 5px;
        }

        .tab-count-warn {
          background: var(--warn-bg);
          color: var(--warn);
        }

        .side-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* â”€â”€ Citations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .citation-card {
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .citation-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .citation-source {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--accent);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .citation-page {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .citation-score {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .citation-text {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          font-family: var(--mono);
          border-left: 2px solid var(--border);
          padding-left: 10px;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* â”€â”€ Guard Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        .event-row {
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          animation: event-in 0.2s ease-out;
        }

        @keyframes event-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .event-row.warn  { border-left: 3px solid var(--warn);  }
        .event-row.block { border-left: 3px solid var(--block); }
        .event-row.pass  { border-left: 3px solid var(--pass);  }

        .event-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .event-stage {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .event-rule {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-secondary);
          margin-left: auto;
        }

        .event-reason {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .event-time {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          align-self: flex-end;
        }
      `}</style>
    </div>
  );
}

function CitationsTab({ citations }) {
  if (citations.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">â—§</span>
        <span className="empty-label">No sources yet</span>
        <span className="empty-sub">Sources retrieved for each answer will appear here with relevance scores.</span>
      </div>
    );
  }

  return (
    <div className="side-scroll">
      {citations.map((c, i) => (
        <div key={c.chunk_id || i} className="citation-card">
          <div className="citation-header">
            <span className="citation-source" title={c.source}>{c.source}</span>
            {c.page && <span className="citation-page">p.{c.page}</span>}
            <span className="citation-score">score {c.score?.toFixed(3) ?? "â€”"}</span>
          </div>
          <p className="citation-text">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

function EventsTab({ events }) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">â—«</span>
        <span className="empty-label">Guard log is clean</span>
        <span className="empty-sub">Blocked queries and flagged responses will show up here in real time.</span>
      </div>
    );
  }

  return (
    <div className="side-scroll">
      {[...events].reverse().map((e, i) => (
        <div key={i} className={`event-row ${e.status}`}>
          <div className="event-header">
            <span className="pill pill-${e.status}" style={pillStyle(e.status)}>
              {e.status}
            </span>
            <span className="event-stage">{e.stage}</span>
            {e.rule && <span className="event-rule">{e.rule}</span>}
          </div>
          {e.reason && <p className="event-reason">{e.reason}</p>}
          <span className="event-time">{e.time}</span>
        </div>
      ))}
    </div>
  );
}

function pillStyle(status) {
  const map = {
    pass:  { background: "var(--pass-bg)",  color: "var(--pass)" },
    warn:  { background: "var(--warn-bg)",  color: "var(--warn)" },
    block: { background: "var(--block-bg)", color: "var(--block)" },
  };
  return map[status] || {};
}

