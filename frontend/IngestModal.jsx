import { useState, useRef } from "react";
import { ingestFile, ingestText } from "./api";

export default function IngestModal({ onClose }) {
  const [mode, setMode]       = useState("file");
  const [file, setFile]       = useState(null);
  const [text, setText]       = useState("");
  const [source, setSource]   = useState("paste");
  const [status, setStatus]   = useState(null);
  const [result, setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  async function handleSubmit() {
    setStatus("loading");
    setErrorMsg("");
    try {
      let res;
      if (mode === "file" && file) res = await ingestFile(file);
      else if (mode === "text" && text.trim()) res = await ingestText(text.trim(), source);
      else { setStatus(null); return; }
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

  const canSubmit = status !== "loading" && status !== "ok" &&
    ((mode === "file" && file) || (mode === "text" && text.trim().length > 20));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">Ingest Document</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === "file" ? "active" : ""}`} onClick={() => setMode("file")}>File upload</button>
            <button className={`mode-btn ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>Paste text</button>
          </div>

          {mode === "file" && (
            <div
              className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" style={{ display: "none" }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
              <div className="drop-icon-box">{file ? "✓" : "📄"}</div>
              {file ? (
                <>
                  <div className="drop-filename">{file.name}</div>
                  <div className="drop-hint">{(file.size / 1024).toFixed(0)} KB · <button style={{background:"none",color:"var(--red)",fontSize:12,cursor:"pointer"}} onClick={e=>{e.stopPropagation();setFile(null)}}>Remove</button></div>
                </>
              ) : (
                <>
                  <div className="drop-label">Drop a file or click to browse</div>
                  <div className="drop-hint">PDF · TXT · MD · DOCX</div>
                </>
              )}
            </div>
          )}

          {mode === "text" && (
            <>
              <input className="source-field" placeholder="Source name (e.g. meeting-notes)"
                value={source} onChange={e => setSource(e.target.value)} />
              <textarea className="text-area-field" placeholder="Paste your document text here…"
                value={text} onChange={e => setText(e.target.value)} rows={8} />
            </>
          )}

          {status === "ok" && result && (
            <div className="ingest-result-row">
              ✓ Indexed {result.chunks} chunks in {result.elapsed_s}s
            </div>
          )}
          {status === "error" && <div className="ingest-error-row">{errorMsg}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>{status === "ok" ? "Done" : "Cancel"}</button>
          {status !== "ok" && (
            <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
              {status === "loading" ? "Indexing…" : "Index document"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
