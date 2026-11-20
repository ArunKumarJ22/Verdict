const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth() {
  return request("/health");
}

export async function queryAgent(query, resetHistory = false) {
  return request("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, reset_history: resetHistory }),
  });
}

export async function ingestFile(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/ingest", { method: "POST", body: form });
}

export async function ingestText(text, source = "paste") {
  const form = new FormData();
  form.append("text", text);
  form.append("source", source);
  return request("/ingest/text", { method: "POST", body: form });
}

export async function clearHistory() {
  return request("/history", { method: "DELETE" });
}

