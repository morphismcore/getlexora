"use client";

import type { RefObject } from "react";
import { motion } from "motion/react";
import { getCourtStyle } from "./constants";
import type { AIMessage } from "./types";

/* ─── Props from useAIChat ─── */
interface AiTabProps {
  aiMessages: AIMessage[];
  aiStreaming: boolean;
  aiInput: string;
  setAiInput: (v: string) => void;
  llmStatus: "ok" | "error" | "loading";
  aiChatRef: RefObject<HTMLDivElement | null>;
  aiInputRef: RefObject<HTMLInputElement | null>;
  ask: (q: string) => void;
  setActiveTab: (t: "ictihat" | "mevzuat" | "ai") => void;
  clearMessages: () => void;
}

export function AiTab({
  aiMessages,
  aiStreaming,
  aiInput,
  setAiInput,
  llmStatus,
  aiChatRef,
  aiInputRef,
  ask,
  setActiveTab,
  clearMessages,
}: AiTabProps) {
  const handleSend = () => {
    if (aiInput.trim() && !aiStreaming) {
      ask(aiInput);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* AI Header bar */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 bg-[#6C6CFF]/10 rounded-xl flex items-center justify-center">
            <svg
              className="w-4 h-4 text-[#6C6CFF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#ECECEE]">
              AI Hukuk Asistanı
            </h3>
            <div className="flex items-center gap-2 text-[13px] text-[#5C5C5F]">
              <span>LLM: Claude</span>
              <span className="text-[#3A3A3F]">·</span>
              <span className="flex items-center gap-1">
                Durum:
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    llmStatus === "ok"
                      ? "bg-[#3DD68C]"
                      : llmStatus === "error"
                        ? "bg-[#E5484D]"
                        : "bg-[#F5A623] animate-pulse"
                  }`}
                />
                <span
                  className={
                    llmStatus === "ok"
                      ? "text-[#3DD68C]"
                      : llmStatus === "error"
                        ? "text-[#E5484D]"
                        : "text-[#F5A623]"
                  }
                >
                  {llmStatus === "ok"
                    ? "Aktif"
                    : llmStatus === "error"
                      ? "Bağlantı yok"
                      : "Kontrol ediliyor..."}
                </span>
              </span>
            </div>
          </div>
        </div>
        {aiMessages.length > 0 && (
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 px-3 py-2 text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Yeni Sohbet
          </button>
        )}
      </div>

      {/* Chat messages area */}
      <div
        ref={aiChatRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4"
      >
        {/* Empty state */}
        {aiMessages.length === 0 && !aiStreaming && (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-md"
            >
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="absolute inset-0 bg-[#6C6CFF]/10 rounded-2xl blur-xl" />
                <div className="relative w-16 h-16 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-[#6C6CFF]/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-[18px] font-semibold text-[#ECECEE] mb-1.5">
                Hukuki Sorunuzu Sorun
              </h2>
              <p className="text-[15px] text-[#5C5C5F] mb-6 leading-relaxed">
                AI asistan, içtihat veritabanındaki kararlara dayanarak
                sorularınızı yanıtlar. Kaynakları doğrulanır.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "İş kazasında zamanaşımı süresi nedir?",
                  "Kıdem tazminatı nasıl hesaplanır?",
                  "Boşanmada mal paylaşımı kuralları",
                  "Haksız fesihte işçi hakları",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setAiInput(q);
                      aiInputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 text-[14px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-[#6C6CFF]/30 hover:text-[#ECECEE] hover:bg-[#6C6CFF]/[0.04] transition-all duration-200 text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Messages */}
        {aiMessages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[#6C6CFF]/10 border border-[#6C6CFF]/20"
                  : "bg-[#111113] border border-white/[0.06]"
              }`}
            >
              <div
                className={`text-[16px] leading-[1.7] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "text-[#ECECEE]"
                    : "text-[#ECECEE]/90"
                }`}
              >
                {msg.content}
                {msg.role === "assistant" &&
                  aiStreaming &&
                  idx === aiMessages.length - 1 && (
                    <span className="inline-block w-2 h-4 bg-[#6C6CFF] animate-pulse ml-0.5 rounded-sm align-middle" />
                  )}
              </div>

              {/* Sources */}
              {msg.role === "assistant" &&
                msg.sources &&
                msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[13px] font-semibold text-[#5C5C5F] uppercase tracking-wider mb-2">
                      Kaynaklar
                    </p>
                    <div className="space-y-1.5">
                      {msg.sources.map((s, si) => {
                        const court = getCourtStyle(s.mahkeme);
                        return (
                          <button
                            key={si}
                            onClick={() => {
                              setActiveTab("ictihat");
                            }}
                            className="flex items-center gap-2 w-full text-left group/src"
                          >
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${court.bg} ${court.text}`}
                            >
                              {court.label || s.mahkeme}
                            </span>
                            <span className="text-[14px] text-[#6C6CFF] group-hover/src:text-[#8B8BFF] transition-colors truncate">
                              {s.esas_no} E. / {s.karar_no} K.
                            </span>
                            {s.tarih && (
                              <span className="text-[12px] text-[#5C5C5F] ml-auto shrink-0">
                                {s.tarih}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Citation check */}
              {msg.role === "assistant" && msg.post_citation_check && (
                <div className="mt-2.5">
                  {msg.post_citation_check.verified ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium bg-[#3DD68C]/10 text-[#3DD68C]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {msg.post_citation_check.verified_count}/
                      {msg.post_citation_check.citations_found} atıf
                      doğrulandı
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium bg-[#FFB224]/10 text-[#FFB224]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {msg.post_citation_check.verified_count}/
                      {msg.post_citation_check.citations_found} atıf
                      doğrulandı
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {msg.role === "assistant" &&
                msg.warnings &&
                msg.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.warnings.map((w, wi) => (
                      <p
                        key={wi}
                        className="text-[13px] text-[#FFB224]/80 flex items-start gap-1.5"
                      >
                        <svg
                          className="w-3 h-3 shrink-0 mt-0.5"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {w}
                      </p>
                    ))}
                  </div>
                )}

              {/* Timestamp */}
              <p
                className={`text-[12px] mt-2 ${
                  msg.role === "user"
                    ? "text-[#6C6CFF]/40 text-right"
                    : "text-[#5C5C5F]/60"
                }`}
              >
                {msg.timestamp.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Streaming placeholder */}
        {aiStreaming &&
          (aiMessages.length === 0 ||
            aiMessages[aiMessages.length - 1]?.role === "user") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-[#111113] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse" />
                  <div
                    className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <div
                    className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </motion.div>
          )}
      </div>

      {/* AI Input bar */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-t border-white/[0.06] bg-[#09090B]">
        <div className="relative">
          <input
            ref={aiInputRef}
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Takip sorusu sorun..."
            disabled={aiStreaming}
            className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-4 pr-14 py-3.5 text-[16px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#13131A] transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!aiInput.trim() || aiStreaming}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-white transition-all duration-150 active:scale-[0.95]"
          >
            {aiStreaming ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[12px] text-[#5C5C5F]/60 mt-1.5 text-center">
          AI yanıtları hukuki tavsiye niteliği taşımaz. Kaynakları her zaman
          doğrulayın.
        </p>
      </div>
    </div>
  );
}
