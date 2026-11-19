import { useState, useRef } from "react";
import { ingestFile, ingestText } from "../lib/api";

export default function IngestModal({ onClose }) {
  const [mode, setMode] = useState("file"); // "file" | "text"
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState("paste");
  const [status, setStatus] = useState(null); // null | "loading" | "ok" | "error"
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  async function handleSubmit() {
    setStatus("loading");
    setErrorMsg("");
    try {
      let res;
      if (mode === "file" && file) {
        res = await ingestFile(file);
      } else if (mode === "text" && text.trim()) {
        res = await ingestText(text.trim(), source);
      } else {
        setStatus(null);
        return;
      }
      setResult(res);
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Ingest failed.");
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  const canSubmit =
    status !== "loading" &&
    status !== "ok" &&
    ((mode === "file" && file) || (mode === "text" && text.trim().length > 20));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <p className="modal-title">Ingest document</p>

        {/* Mode toggle */}
        <div className="ingest-tabs">
          <button
            className={`ingest-tab ${mode === "file" ? "active" : ""}`}
            onClick={() => setMode("file")}
          >File upload</button>
          <button
            className={`ingest-tab ${mode === "text" ? "active" : ""}`}
            onClick={() => setMode("text")}
          >Paste text</button>
        </div>

        {mode === "file" && (
          <div
            className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <span className="drop-icon">◈</span>
                <span className="drop-filename">{file.name}</span>
                <span className="drop-size">{(file.size / 1024).toFixed(0)} KB</span>
              </>
            ) : (
              <>
                <span className="drop-icon">↑</span>
                <span className="drop-label">Drop a file or click to browse</span>
                <span className="drop-hint">PDF · TXT · MD · DOCX</span>
              </>
            )}
          </div>
        )}

        {mode === "text" && (
          <>
            <input
              className="source-input"
              placeholder="Source name (e.g. meeting-notes)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <textarea
              className="text-input"
              placeholder="Paste your text here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />
          </>
        )}

        {/* Result */}
        {status === "ok" && result && (
          <div className="ingest-result">
            <span className="pill" style={{ background: "var(--pass-bg)", color: "var(--pass)" }}>
              ✓ Indexed
            </span>
            <span className="result-detail">
              {result.chunks} chunks · {result.elapsed_s}s
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="ingest-error">{errorMsg}</div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            {status === "ok" ? "Done" : "Cancel"}
          </button>
          {status !== "ok" && (
            <button
              className="btn-ingest"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
            >
              {status === "loading" ? "Indexing…" : "Index"}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .ingest-tabs {
          display: flex;
          gap: 2px;
          margin-bottom: 14px;
          background: var(--bg-raised);
          border-radius: var(--radius-sm);
          padding: 3px;
        }

        .ingest-tab {
          flex: 1;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          padding: 6px;
          border-radius: 3px;
          transition: background 0.15s, color 0.15s;
        }

        .ingest-tab.active {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .drop-zone {
          border: 1.5px dashed var(--border);
          border-radius: var(--radius-md);
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          margin-bottom: 4px;
        }

        .drop-zone:hover, .drop-zone.dragging {
          border-color: var(--accent);
          background: var(--accent-dim);
        }

        .drop-zone.has-file {
          border-color: var(--pass);
          border-style: solid;
          background: var(--pass-bg);
        }

        .drop-icon {
          font-size: 24px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .drop-filename {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--pass);
          font-weight: 500;
        }

        .drop-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .drop-hint, .drop-size {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--mono);
        }

        .source-input {
          width: 100%;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-family: var(--mono);
          font-size: 12px;
          padding: 7px 10px;
          margin-bottom: 8px;
          outline: none;
        }

        .source-input:focus { border-color: var(--accent); }

        .text-input {
          width: 100%;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-family: var(--sans);
          font-size: 13px;
          padding: 10px 12px;
          resize: vertical;
          outline: none;
          line-height: 1.6;
        }

        .text-input:focus { border-color: var(--accent); }

        .ingest-result {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .result-detail {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--text-muted);
        }

        .ingest-error {
          margin-top: 10px;
          font-size: 12px;
          color: var(--block);
          background: var(--block-bg);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
        }
      `}</style>
    </div>
  );
}
