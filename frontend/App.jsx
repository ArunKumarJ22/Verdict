import { useState, useRef, useEffect } from "react";
import ChatPanel from "./components/ChatPanel";
import SidePanel from "./components/SidePanel";
import IngestModal from "./components/IngestModal";
import StatusBar from "./components/StatusBar";
import { useAgent } from "./hooks/useAgent";
import { useHealth } from "./hooks/useHealth";
import "./index.css";

export default function App() {
  const [sideTab, setSideTab] = useState("citations"); // "citations" | "events"
  const [ingestOpen, setIngestOpen] = useState(false);
  const { health, loading: healthLoading } = useHealth();
  const {
    messages,
    citations,
    guardEvents,
    isLoading,
    sendQuery,
    clearHistory,
  } = useAgent();

  // Auto-switch to events tab when a guard event fires
  useEffect(() => {
    if (guardEvents.length > 0) {
      const latest = guardEvents[guardEvents.length - 1];
      if (latest.status !== "pass") setSideTab("events");
    }
  }, [guardEvents]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-mark">◈</span>
          <span className="logo-text">RAG Agent</span>
          <span className="logo-sub">hybrid · reranked · guarded</span>
        </div>
        <div className="topbar-right">
          <StatusBar health={health} loading={healthLoading} />
          <button
            className="btn-ingest"
            onClick={() => setIngestOpen(true)}
          >
            + Ingest doc
          </button>
        </div>
      </header>

      <main className="workspace">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendQuery}
          onClear={clearHistory}
        />

        <SidePanel
          activeTab={sideTab}
          onTabChange={setSideTab}
          citations={citations}
          guardEvents={guardEvents}
        />
      </main>

      {ingestOpen && (
        <IngestModal onClose={() => setIngestOpen(false)} />
      )}
    </div>
  );
}
