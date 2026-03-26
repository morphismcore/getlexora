"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SearchIcon,
  CloseIcon,
  ArrowLeftIcon,
  CopyIcon,
  CheckIcon,
} from "./shared/icons";
import { SkeletonCard, SkeletonDetail } from "./shared/skeleton";
import { highlightText, formatLegalText } from "./shared/helpers";
import type { MevzuatResult, MevzuatSearchResponse, MevzuatContent } from "./types";

/* ─── Motion variants ─── */
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

/* ─── Props from useMevzuatSearch ─── */
interface MevzuatTabProps {
  mevzuatResults: MevzuatSearchResponse | null;
  selectedMevzuat: MevzuatResult | null;
  mevzuatContent: MevzuatContent | null;
  mevzuatLoading: boolean;
  loading: boolean;
  error: string | null;
  mevzuatSearchText: string;
  setMevzuatSearchText: (v: string) => void;
  searchMevzuat: (q: string) => void;
  selectMevzuat: (m: MevzuatResult) => void;
  clearSelection: () => void;
}

export function MevzuatTab({
  mevzuatResults,
  selectedMevzuat,
  mevzuatContent,
  mevzuatLoading,
  loading,
  error,
  mevzuatSearchText,
  setMevzuatSearchText,
  selectMevzuat,
  clearSelection,
}: MevzuatTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  /* Empty state */
  if (!loading && !mevzuatResults && !error) {
    return (
      <div className="flex-1 flex items-start justify-center pt-16 md:pt-24 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center px-4 max-w-lg"
        >
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 bg-[#A78BFA]/10 rounded-2xl blur-xl" />
            <div className="relative w-16 h-16 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center">
              <svg
                className="w-7 h-7 text-[#A78BFA]/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-[18px] font-semibold text-[#ECECEE] mb-1.5">
            Mevzuat Arama
          </h2>
          <p className="text-[15px] text-[#5C5C5F] mb-6 leading-relaxed">
            Kanun, yönetmelik ve tüzük metinlerine erişin. Kanun numarası ile
            de arayabilirsiniz.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {[
              "İş Kanunu",
              "Türk Borçlar Kanunu",
              "Türk Ceza Kanunu",
              "Medeni Kanun",
              "İdari Yargılama",
              "Vergi Usul",
            ].map((q) => (
              <button
                key={q}
                className="px-3 py-1.5 text-[14px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-[#A78BFA]/30 hover:text-[#ECECEE] hover:bg-[#A78BFA]/[0.04] transition-all duration-200"
              >
                {q}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  /* Loading */
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} delay={i} />
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (error && !loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#E5484D]/[0.06] border border-[#E5484D]/15 rounded-2xl p-5"
        >
          <p className="text-[15px] font-medium text-[#E5484D]">{error}</p>
          <p className="text-[14px] text-[#E5484D]/60 mt-1">
            Farklı anahtar kelimeler deneyebilirsiniz.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!mevzuatResults) return null;

  return (
    <>
      {/* Left: list */}
      <div
        className={`overflow-y-auto overflow-x-hidden min-w-0 transition-all duration-200 ${
          selectedMevzuat
            ? "hidden md:block md:w-[44%] md:shrink-0 md:border-r md:border-white/[0.06]"
            : "flex-1"
        }`}
      >
        <div className={`p-4 md:p-5 space-y-3 ${!selectedMevzuat ? "max-w-5xl mx-auto" : ""}`}>
          <div className="flex items-center justify-between px-1 mb-1">
            <p className="text-[14px] text-[#5C5C5F] tabular-nums">
              <span className="text-[#8B8B8E] font-medium">
                {mevzuatResults.toplam}
              </span>{" "}
              mevzuat bulundu
            </p>
          </div>

          {mevzuatResults.sonuclar.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-12 h-12 bg-[#111113] border border-white/[0.06] rounded-xl flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-[#5C5C5F]/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-[16px] text-[#8B8B8E] font-medium mb-1">
                Mevzuat bulunamadı
              </p>
              <p className="text-[14px] text-[#5C5C5F] max-w-xs leading-relaxed">
                Farklı anahtar kelimeler veya kanun numarası deneyin.
              </p>
            </motion.div>
          )}

          {mevzuatResults.sonuclar.length > 0 && (
            <motion.div
              className="space-y-2"
              variants={listContainer}
              initial="hidden"
              animate="show"
            >
              {mevzuatResults.sonuclar.map((m, idx) => {
                const isSelected =
                  selectedMevzuat?.mevzuatNo === m.mevzuatNo &&
                  selectedMevzuat?.mevzuatAd === m.mevzuatAd;
                return (
                  <motion.button
                    key={`${m.mevzuatNo}-${idx}`}
                    variants={listItem}
                    onClick={() => selectMevzuat(m)}
                    className={`group w-full text-left bg-[#111113] border rounded-2xl p-5 transition-all duration-200 overflow-hidden min-w-0 ${
                      isSelected
                        ? "border-[#A78BFA]/30 bg-[#A78BFA]/[0.04] shadow-[0_0_0_1px_rgba(167,139,250,0.15)]"
                        : "border-white/[0.06] hover:border-white/[0.10] hover:bg-[#141418]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-semibold tracking-wide uppercase bg-[#A78BFA]/10 text-[#A78BFA]">
                        {m.mevzuatTur || "Mevzuat"}
                      </span>
                      {m.mevzuatNo && (
                        <span className="text-[13px] font-mono text-[#8B8B8E]">
                          No: {m.mevzuatNo}
                        </span>
                      )}
                      {m.mevzuatTertip && (
                        <span className="text-[12px] text-[#5C5C5F]">
                          {m.mevzuatTertip}. Tertip
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] text-[#ECECEE] font-medium leading-relaxed mb-2 break-words group-hover:text-white transition-colors">
                      {m.mevzuatAd}
                    </p>
                    <div className="flex items-center gap-3 text-[13px] text-[#5C5C5F]">
                      {m.resmiGazeteTarihi && (
                        <span className="flex items-center gap-1">
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          RG: {m.resmiGazeteTarihi}
                        </span>
                      )}
                      {m.resmiGazeteSayisi && (
                        <span>Sayı: {m.resmiGazeteSayisi}</span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Right: content viewer */}
      <AnimatePresence mode="wait">
        {selectedMevzuat ? (
          <motion.div
            key="mevzuat-detail"
            className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#0C0C0E]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-5 md:p-6 max-w-[900px]">
              {/* Mobile back */}
              <button
                onClick={clearSelection}
                className="md:hidden flex items-center gap-1.5 text-[15px] text-[#8B8B8E] hover:text-[#ECECEE] mb-5 transition-colors"
              >
                <ArrowLeftIcon />
                Sonuçlara Dön
              </button>

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[13px] font-semibold tracking-wide uppercase bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                    {selectedMevzuat.mevzuatTur || "Mevzuat"}
                  </span>
                  {selectedMevzuat.mevzuatNo && (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-[13px] font-medium bg-white/[0.04] text-[#8B8B8E] border border-white/[0.06]">
                      No: {selectedMevzuat.mevzuatNo}
                    </span>
                  )}
                </div>
                <h2 className="text-[18px] font-semibold text-[#ECECEE] leading-relaxed mb-2">
                  {selectedMevzuat.mevzuatAd}
                </h2>
                <div className="flex items-center gap-3 text-[14px] text-[#5C5C5F]">
                  {selectedMevzuat.resmiGazeteTarihi && (
                    <span>
                      RG Tarihi: {selectedMevzuat.resmiGazeteTarihi}
                    </span>
                  )}
                  {selectedMevzuat.resmiGazeteSayisi && (
                    <span>
                      RG Sayısı: {selectedMevzuat.resmiGazeteSayisi}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                {mevzuatContent && (
                  <button
                    onClick={() => handleCopyText(mevzuatContent.content)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[14px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? "Kopyalandı" : "Metni Kopyala"}
                  </button>
                )}
                <button
                  onClick={clearSelection}
                  className="ml-auto px-3 py-2 text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all hidden md:flex items-center gap-1.5"
                >
                  <CloseIcon size={12} />
                  Kapat
                </button>
              </div>

              {/* Content body */}
              {mevzuatLoading ? (
                <SkeletonDetail />
              ) : mevzuatContent ? (
                <div className="space-y-6">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C5F]" />
                    <input
                      type="text"
                      value={mevzuatSearchText}
                      onChange={(e) => setMevzuatSearchText(e.target.value)}
                      placeholder="Metin içinde ara..."
                      className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#A78BFA]/40 transition-all"
                    />
                  </div>
                  {mevzuatSearchText.trim().length >= 2 ? (
                    <div className="text-[16px] text-[#ECECEE]/90 leading-[1.8] space-y-4">
                      {mevzuatContent.content
                        .split(/\n\n+/)
                        .filter((p) => p.trim())
                        .map((paragraph, i) => (
                          <p
                            key={i}
                            className="whitespace-pre-wrap text-[15px] text-[#ECECEE]/90 leading-relaxed mb-3"
                          >
                            {highlightText(
                              paragraph.trim(),
                              mevzuatSearchText,
                            )}
                          </p>
                        ))}
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none overflow-hidden break-words">
                      {formatLegalText(mevzuatContent.content)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[15px] text-[#5C5C5F]">
                    Mevzuat içeriği yüklenemedi.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          mevzuatResults.sonuclar.length > 0 && (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0C0C0E]">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-[#5C5C5F]/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <p className="text-[15px] text-[#5C5C5F]">
                  İçeriği görüntülemek için
                  <br />
                  <span className="text-[#8B8B8E]">bir mevzuat seçin</span>
                </p>
              </div>
            </div>
          )
        )}
      </AnimatePresence>
    </>
  );
}
