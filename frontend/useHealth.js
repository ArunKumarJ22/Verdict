import { useState, useEffect } from "react";
import { fetchHealth } from "./api";

export function useHealth(intervalMs = 15000) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const data = await fetchHealth();
        if (mounted) { setHealth(data); setLoading(false); }
      } catch {
        if (mounted) { setHealth(null); setLoading(false); }
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { mounted = false; clearInterval(id); };
  }, [intervalMs]);

  return { health, loading };
}

