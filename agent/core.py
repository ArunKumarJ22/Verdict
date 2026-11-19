"""
agent/core.py
-------------
The agent loop — Claude as the reasoning core with:
  - Tool use: search_docs, clarify_query
  - Multi-turn sliding-window memory
  - Guardrails on input and output
  - Source citation tracking

Architecture:
  User query
    → InputGuard (block injections / abuse)
    → Agent loop (Claude + tools)
        tool call → HybridRetriever → Reranker → top-K chunks
    → OutputGuard (block PII / hallucination signals)
    → Response + citations
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import List

import anthropic

from app_guardrails.guards import GuardRail, GuardStatus
from retrieval.hybrid_retriever import HybridRetriever
from reranker.cross_encoder import Reranker


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class Message:
    role: str   # "user" | "assistant"
    content: str


@dataclass
class AgentResponse:
    answer: str
    citations: List[dict]
    guard_events: List[dict]
    tool_calls: int
    blocked: bool = False
    block_reason: str | None = None


# ---------------------------------------------------------------------------
# Tool definitions (Anthropic tool use format)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "search_docs",
        "description": (
            "Search the document corpus for passages relevant to a query. "
            "Returns the top passages with their source and page number. "
            "Always call this before answering factual questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query — rephrase the user's question for best retrieval.",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "clarify_query",
        "description": (
            "Ask the user a clarifying question when their intent is ambiguous "
            "and you cannot answer confidently without more information."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The clarifying question to ask the user.",
                }
            },
            "required": ["question"],
        },
    },
]

SYSTEM_PROMPT = """You are a precise, citation-driven AI assistant with access to a document corpus.

Rules:
1. ALWAYS call search_docs before answering any factual question.
2. Base your answer ONLY on retrieved passages — do not use prior knowledge.
3. Cite sources inline as [Source: filename, p.N] after each claim.
4. If retrieved passages don't contain the answer, say so explicitly.
5. Be concise. Prefer bullet points for multi-part answers.
6. Never speculate or add information not present in the retrieved passages.
"""


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class RAGAgent:
    """
    Agentic RAG loop using Claude with tool use.

    Maintains a sliding-window conversation history so the agent can
    handle multi-turn follow-up questions.
    """

    MAX_HISTORY_TURNS = 10   # keep last N user/assistant pairs
    MAX_TOOL_ITERATIONS = 5  # safety cap on agentic loop

    def __init__(
        self,
        retriever: HybridRetriever,
        reranker: Reranker,
        guardrail: GuardRail,
    ):
        self.retriever = retriever
        self.reranker  = reranker
        self.guardrail = guardrail
        self.client    = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.history: List[Message] = []

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def chat(self, user_query: str) -> AgentResponse:
        """Main entry point. Returns a structured AgentResponse."""
        guard_events: List[dict] = []

        # 1. Input guardrail
        input_check = self.guardrail.check_input(user_query)
        if input_check.status == GuardStatus.BLOCK:
            return AgentResponse(
                answer="Your query could not be processed.",
                citations=[],
                guard_events=[{"stage": "input", "status": "block", "reason": input_check.reason, "rule": input_check.triggered_rule}],
                tool_calls=0,
                blocked=True,
                block_reason=input_check.reason,
            )

        # 2. Build messages for Claude
        messages = self._build_messages(user_query)

        # 3. Agentic loop
        citations: List[dict] = []
        tool_call_count = 0
        final_answer = ""

        for _ in range(self.MAX_TOOL_ITERATIONS):
            response = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            # Append assistant turn to messages
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                # Extract text answer
                for block in response.content:
                    if hasattr(block, "text"):
                        final_answer = block.text
                break

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue

                    tool_call_count += 1
                    result_content = self._handle_tool(
                        block.name, block.input, citations
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_content,
                    })

                messages.append({"role": "user", "content": tool_results})

        # 4. Output guardrail
        output_check = self.guardrail.check_output(final_answer, citations)
        if output_check.status != GuardStatus.PASS:
            guard_events.append({
                "stage": "output",
                "status": output_check.status.value,
                "reason": output_check.reason,
                "rule": output_check.triggered_rule,
            })
            if output_check.status == GuardStatus.BLOCK:
                final_answer = "Response was blocked due to a policy violation."

        # 5. Update history
        self.history.append(Message(role="user", content=user_query))
        self.history.append(Message(role="assistant", content=final_answer))
        self._trim_history()

        return AgentResponse(
            answer=final_answer,
            citations=citations,
            guard_events=guard_events,
            tool_calls=tool_call_count,
        )

    def reset(self) -> None:
        """Clear conversation history."""
        self.history.clear()

    # ------------------------------------------------------------------
    # Tool handler
    # ------------------------------------------------------------------

    def _handle_tool(
        self,
        tool_name: str,
        tool_input: dict,
        citations: List[dict],
    ) -> str:
        if tool_name == "search_docs":
            query = tool_input["query"]
            candidates = self.retriever.retrieve(query)
            top_chunks = self.reranker.rerank(query, candidates)

            if not top_chunks:
                return "No relevant passages found."

            # Track citations
            for chunk in top_chunks:
                if chunk["chunk_id"] not in {c["chunk_id"] for c in citations}:
                    citations.append({
                        "chunk_id": chunk["chunk_id"],
                        "source":   chunk["source"],
                        "page":     chunk.get("page"),
                        "score":    round(chunk.get("rerank_score", 0), 4),
                        "text":     chunk["text"][:200],
                    })

            # Format passages for the LLM
            passages = []
            for i, chunk in enumerate(top_chunks, 1):
                page_str = f", p.{chunk['page']}" if chunk.get("page") else ""
                passages.append(
                    f"[Passage {i} | Source: {chunk['source']}{page_str}]\n{chunk['text']}"
                )

            return "\n\n---\n\n".join(passages)

        if tool_name == "clarify_query":
            # Return the clarifying question as the tool result so the
            # agent can relay it in the final answer
            return f"CLARIFY: {tool_input['question']}"

        return f"Unknown tool: {tool_name}"

    # ------------------------------------------------------------------
    # History management
    # ------------------------------------------------------------------

    def _build_messages(self, user_query: str) -> list:
        """Build the messages array from sliding-window history + new query."""
        messages = []
        for msg in self.history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_query})
        return messages

    def _trim_history(self) -> None:
        """Keep only the last MAX_HISTORY_TURNS user/assistant pairs."""
        max_messages = self.MAX_HISTORY_TURNS * 2
        if len(self.history) > max_messages:
            self.history = self.history[-max_messages:]

