export default function StatusBar({ health, loading }) {
  if (loading) {
    return <span className="status-bar status-connecting">connectingâ€¦</span>;
  }

  if (!health) {
    return <span className="status-bar status-offline">â— offline</span>;
  }

  return (
    <span className="status-bar status-online">
      â— online
      <span className="status-counts">
        {health.vector_store_docs} vectors Â· {health.bm25_docs} bm25
      </span>
    </span>
  );
}

// Styles injected globally via index.css equivalent â€” using a style tag here
const style = document.createElement("style");
style.textContent = `
  .status-bar {
    font-family: var(--mono);
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-online    { color: var(--pass); }
  .status-offline   { color: var(--block); }
  .status-connecting{ color: var(--text-muted); }
  .status-counts    { color: var(--text-muted); }
`;
document.head.appendChild(style);

