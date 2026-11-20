import { useState, useCallback } from "react";
import { queryAgent, clearHistory as apiClearHistory } from "./api";

export function useAgent() {
  const [messages, setMessages]     = useState([]);
  const [citations, setCitations]   = useState([]);
  const [guardEvents, setGuardEvents] = useState([]);
  const [isLoading, setIsLoading]   = useState(false);

  const sendQuery = useCallback(async (query) => {
    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setIsLoading(true);

    try {
      const res = await queryAgent(query);

      // Append assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.blocked
            ? "Your message was blocked by the input guard."
            : res.answer,
          toolCalls: res.tool_calls,
          blocked: res.blocked,
        },
      ]);

      // Accumulate citations (deduplicate by chunk_id)
      if (res.citations?.length) {
        setCitations((prev) => {
          const existing = new Set(prev.map((c) => c.chunk_id));
          const fresh = res.citations.filter((c) => !existing.has(c.chunk_id));
          return [...fresh, ...prev]; // newest first
        });
      }

      // Append guard events with timestamp
      if (res.guard_events?.length) {
        const timestamped = res.guard_events.map((e) => ({
          ...e,
          time: new Date().toLocaleTimeString(),
        }));
        setGuardEvents((prev) => [...prev, ...timestamped]);
      } else {
        // Log a pass event so the log isn't empty
        setGuardEvents((prev) => [
          ...prev,
          {
            stage: "both",
            status: "pass",
            rule: null,
            reason: null,
            time: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}`,
          blocked: false,
          toolCalls: 0,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    await apiClearHistory().catch(() => {});
    setMessages([]);
    setCitations([]);
    setGuardEvents([]);
  }, []);

  return { messages, citations, guardEvents, isLoading, sendQuery, clearHistory };
}

