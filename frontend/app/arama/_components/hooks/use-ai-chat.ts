"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AIMessage, IctihatResult } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useAIChat() {
  /* ─── State ─── */
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [llmStatus, setLlmStatus] = useState<"ok" | "error" | "loading">("loading");
  const aiChatRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Check LLM status
  useEffect(() => {
    fetch(`${API_URL}/health/llm`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setLlmStatus(data?.status === "ok" ? "ok" : "error"))
      .catch(() => setLlmStatus("error"));
  }, []);

  // Auto-scroll AI chat
  useEffect(() => {
    if (aiChatRef.current) {
      aiChatRef.current.scrollTop = aiChatRef.current.scrollHeight;
    }
  }, [aiMessages, aiStreaming]);

  /* ─── AI Streaming Handler ─── */
  const ask = useCallback(async (queryText: string) => {
    const userQuery = queryText.trim() || aiInput.trim();
    if (!userQuery) return;

    const userMsg: AIMessage = { role: "user", content: userQuery, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiStreaming(true);
    setAiInput("");

    let assistantContent = "";
    let sources: IctihatResult[] = [];

    try {
      const res = await fetch(`${API_URL}/api/v1/search/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, max_sonuc: 10 }),
      });

      if (!res.ok) {
        const fallbackRes = await fetch(`${API_URL}/api/v1/search/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userQuery, max_sonuc: 10 }),
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const assistantMsg: AIMessage = {
            role: "assistant",
            content: data.yanit || data.answer || "Yanıt alınamadı.",
            sources: data.kaynaklar || data.sources || [],
            post_citation_check: data.post_citation_check,
            warnings: data.warnings,
            timestamp: new Date(),
          };
          setAiMessages(prev => [...prev, assistantMsg]);
        } else {
          setAiMessages(prev => [...prev, { role: "assistant", content: "AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.", timestamp: new Date() }]);
        }
        setAiStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(line.slice(6));
                if (eventData.type === "token" || eventData.token) {
                  assistantContent += eventData.token || eventData.content || "";
                  setAiMessages(prev => {
                    const msgs = [...prev];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === "assistant") {
                      msgs[msgs.length - 1] = { ...last, content: assistantContent };
                    } else {
                      msgs.push({ role: "assistant", content: assistantContent, timestamp: new Date() });
                    }
                    return msgs;
                  });
                }
                if (eventData.type === "sources" || eventData.sources) {
                  sources = eventData.sources || [];
                }
                if (eventData.type === "done" || eventData.done) {
                  setAiMessages(prev => {
                    const msgs = [...prev];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === "assistant") {
                      msgs[msgs.length - 1] = {
                        ...last,
                        content: assistantContent,
                        sources,
                        post_citation_check: eventData.post_citation_check,
                        warnings: eventData.warnings,
                      };
                    }
                    return msgs;
                  });
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }
      }
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.", timestamp: new Date() }]);
    } finally {
      setAiStreaming(false);
    }
  }, [aiInput]);

  const clearChat = useCallback(() => {
    setAiMessages([]);
    setAiInput("");
  }, []);

  return {
    // State
    aiMessages,
    aiStreaming,
    aiInput,
    setAiInput,
    llmStatus,
    aiChatRef,
    aiInputRef,

    // Actions
    ask,
    clearChat,
  };
}
