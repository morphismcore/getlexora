"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  SearchIcon,
  CloseIcon,
  ArrowLeftIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  ChevronIcon,
  BookmarkIcon,
} from "./shared/icons";
import { SkeletonCard, SkeletonDetail } from "./shared/skeleton";
import CitationText from "./CitationText";
import {
  getCourtStyle,
  MAHKEME_VALUE_MAP,
  SOURCE_TABS,
  SUGGESTED_QUERIES,
} from "./constants";
import {
  highlightText,
  formatDuration,
  formatTurkishDate,
  formatLegalText,
} from "./shared/helpers";
import type { IctihatResult, SearchResponse, KararDetail } from "./types";

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
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

/* ─── Result Card (simple) ─── */
const ResultCard = React.memo(function ResultCard({
  result,
  isSelected,
  query,
  onSelect,
}: {
  result: IctihatResult;
  isSelected: boolean;
  query: string;
  onSelect: (r: IctihatResult) => void;
}) {
  const court = getCourtStyle(result.mahkeme);
  const formattedDate = useMemo(
    () => formatTurkishDate(result.tarih),
    [result.tarih],
  );

  return (
    <motion.button
      variants={listItem}
      onClick={() => onSelect(result)}
      className={`group w-full text-left bg-[#111113] border rounded-2xl p-5 transition-all duration-200 relative overflow-hidden min-w-0 border-l-[3px] ${
        isSelected
          ? "border-[#6C6CFF]/30 bg-[#6C6CFF]/[0.04] shadow-[0_0_0_1px_rgba(108,108,255,0.15)]"
          : "border-white/[0.06] hover:border-white/[0.15] hover:bg-[#141418]"
      }`}
      style={{ borderLeftColor: court.color }}
    >
      {/* Court + Chamber */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-md text-[12px] font-semibold tracking-wide uppercase ${court.bg} ${court.text}`}
        >
          {court.label || result.mahkeme}
        </span>
        {result.daire && (
          <span className="text-[13px] text-[#8B8B8E]/80 font-medium px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]">
            {result.daire}
          </span>
        )}
        {result.kaynak === "aym" && result.mahkeme !== "aym" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#E5484D]/20 text-[#E5484D]">
            AYM
          </span>
        )}
        {result.kaynak === "aihm" && result.mahkeme !== "aihm" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#3DD68C]/20 text-[#3DD68C]">
            AİHM
          </span>
        )}
      </div>

      {/* Esas No / Karar No */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-[17px] font-bold text-[#ECECEE] tracking-tight">
          <span className="text-[#5C5C5F] text-[12px] font-sans font-semibold mr-1">
            E.
          </span>
          {result.esas_no}
        </span>
        <span className="text-[#3A3A3F] text-[12px]">/</span>
        <span className="font-mono text-[17px] font-bold text-[#ECECEE] tracking-tight">
          <span className="text-[#5C5C5F] text-[12px] font-sans font-semibold mr-1">
            K.
          </span>
          {result.karar_no}
        </span>
        <span className="ml-auto text-[13px] text-[#5C5C5F] tabular-nums flex items-center gap-1">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="opacity-50"
          >
            <path
              d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {formattedDate}
        </span>
      </div>

      {/* 2-line truncated ozet */}
      <p className="text-[15px] text-[#8B8B8E] leading-relaxed break-words group-hover:text-[#A0A0A3] transition-colors line-clamp-2">
        {highlightText(result.ozet, query)}
      </p>
    </motion.button>
  );
});

/* ─── Props from useIctihatSearch ─── */
interface IctihatTabProps {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  mahkeme: string;
  setMahkeme: (v: string) => void;
  daire: string;
  setDaire: (v: string) => void;
  selectedResult: IctihatResult | null;
  kararDetail: KararDetail | null;
  detailLoading: boolean;
  relatedResults: IctihatResult[];
  search: () => void;
  selectResult: (r: IctihatResult) => void;
  clearSelection: () => void;
  setActiveTab: (t: "ictihat" | "mevzuat" | "ai") => void;
}

export function IctihatTab({
  query,
  setQuery,
  results,
  loading,
  error,
  setError,
  currentPage,
  setCurrentPage,
  mahkeme,
  setMahkeme,
  daire,
  setDaire,
  selectedResult,
  kararDetail,
  detailLoading,
  relatedResults,
  search,
  selectResult,
  clearSelection,
  setActiveTab,
}: IctihatTabProps) {
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("lexora_bookmarks");
        if (saved) return new Set(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
    return new Set();
  });
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const hasResults = results && results.sonuclar.length > 0;
  const isEmpty = !loading && !results && !error;

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

  const toggleBookmark = useCallback((karar_id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(karar_id)) {
        next.delete(karar_id);
      } else {
        next.add(karar_id);
      }
      localStorage.setItem("lexora_bookmarks", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      resultsContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setCurrentPage],
  );

  const handleSelectResult = useCallback(
    (r: IctihatResult) => {
      selectResult(r);
      setMobileShowDetail(true);
    },
    [selectResult],
  );

  const handleSuggestedQuery = (q: string) => {
    setQuery(q);
    setCurrentPage(1);
  };

  const handleDownloadResults = () => {
    if (!results) return;
    const lines = results.sonuclar.map(
      (r) =>
        `${r.mahkeme} ${r.daire || ""} | ${r.esas_no || ""} E. | ${r.karar_no || ""} K. | ${r.tarih || ""}\n${(r.ozet || "").slice(0, 200)}\n`,
    );
    const blob = new Blob([lines.join("\n---\n\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arama_${query.trim().replace(/\s+/g, "_").slice(0, 30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Empty state */}
      {isEmpty && !mobileShowDetail && (
        <div className="flex-1 flex items-start justify-center pt-16 md:pt-24 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center px-4 max-w-xl"
          >
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-[-8px] bg-[#6C6CFF]/15 rounded-3xl blur-2xl animate-pulse" />
              <div className="absolute inset-[-4px] bg-[#6C6CFF]/8 rounded-2xl blur-lg" />
              <div className="relative w-20 h-20 bg-[#111113] border border-[#6C6CFF]/15 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(108,108,255,0.12)]">
                <SearchIcon className="w-9 h-9 text-[#6C6CFF]/70" />
              </div>
            </div>

            <h2 className="text-[22px] font-bold text-[#ECECEE] mb-3">
              Hukuk veritabanında arama yapın
            </h2>
            <p className="text-[15px] text-[#5C5C5F] mb-4 leading-relaxed">
              Doğal dil ile içtihat arayın. AI destekli semantik arama ile en
              alakalı kararları bulun.
            </p>
            <p className="text-[14px] text-[#6C6CFF]/60 font-medium mb-5 tracking-wide">
              65.000+ karar · 7 kaynak · yapay zeka destekli hibrit arama
            </p>

            <div className="flex items-center justify-center gap-4 mb-7 flex-wrap">
              {[
                { label: "Yargıtay", color: "#6C6CFF" },
                { label: "Danıştay", color: "#A78BFA" },
                { label: "AYM", color: "#E5484D" },
                { label: "AİHM", color: "#3DD68C" },
                { label: "Rekabet", color: "#30A46C" },
                { label: "KVKK", color: "#F76B15" },
                { label: "Mevzuat", color: "#FFB224" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[13px] text-[#5C5C5F]">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestedQuery(q)}
                  className="px-4 py-2 text-[15px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-[#6C6CFF]/40 hover:text-[#ECECEE] hover:bg-[#6C6CFF]/[0.06] hover:shadow-[0_0_16px_rgba(108,108,255,0.08)] transition-all duration-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Results panel */}
      {(loading || results || error) && (
        <div
          ref={resultsContainerRef}
          className={`overflow-y-auto overflow-x-hidden min-w-0 transition-all duration-200 ${
            mobileShowDetail ? "hidden md:block" : "flex-1 md:flex-none"
          } ${
            selectedResult
              ? "md:w-[44%] md:shrink-0 md:border-r md:border-white/[0.06]"
              : "flex-1"
          }`}
        >
          <div
            className={`p-4 md:p-5 space-y-3 ${!selectedResult ? "max-w-5xl mx-auto" : ""}`}
          >
            {/* Source filter bar */}
            {(results || loading) && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {SOURCE_TABS.map((tab) => {
                  const isActive =
                    tab.key === "Tümü"
                      ? mahkeme === "Tümü"
                      : mahkeme === tab.mahkemeValue;
                  const style =
                    tab.key === "Tümü"
                      ? null
                      : getCourtStyle(tab.mahkemeValue);
                  const facetCount = results?.facets?.mahkeme?.find(
                    (f) =>
                      f.value.toLowerCase() ===
                      (
                        MAHKEME_VALUE_MAP[tab.mahkemeValue] || ""
                      ).toLowerCase(),
                  )?.count;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        if (tab.key === "Tümü") {
                          setMahkeme("Tümü");
                        } else {
                          setMahkeme(isActive ? "Tümü" : tab.mahkemeValue);
                        }
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap border transition-all shrink-0 ${
                        isActive
                          ? style
                            ? `${style.bg} ${style.text} border-current/20`
                            : "bg-[#6C6CFF]/10 text-[#6C6CFF] border-[#6C6CFF]/20 shadow-[0_0_8px_rgba(108,108,255,0.15)]"
                          : "bg-[#111113] text-[#8B8B8E] border-white/[0.06] hover:border-white/[0.12] hover:text-[#ECECEE]"
                      }`}
                    >
                      {style && (
                        <span
                          className={`w-2 h-2 rounded-full ${isActive ? "bg-current" : style.text} opacity-60`}
                        />
                      )}
                      {tab.label}
                      {facetCount !== undefined && (
                        <span
                          className={`text-[12px] tabular-nums ${isActive ? "opacity-70" : "text-[#5C5C5F]"}`}
                        >
                          ({facetCount})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status bar */}
            {results && !loading && (
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-[14px] text-[#5C5C5F] tabular-nums flex items-center gap-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3DD68C] opacity-50" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3DD68C]" />
                  </span>
                  <span className="text-[#ECECEE] font-semibold text-[16px]">
                    {results.toplam_bulunan}
                  </span>{" "}
                  sonuç bulundu
                  <span className="text-[#3A3A3F] mx-0.5">·</span>
                  {formatDuration(results.sure_ms)}
                </p>
                {results.sonuclar.length > 0 && (
                  <button
                    onClick={handleDownloadResults}
                    className="flex items-center gap-2 text-[13px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
                  >
                    <DownloadIcon />
                    İndir
                  </button>
                )}
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} delay={i} />
                ))}
              </div>
            )}

            {/* Error state */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#E5484D]/[0.06] border border-[#E5484D]/15 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-[#E5484D]">
                      {error}
                    </p>
                    <p className="text-[14px] text-[#E5484D]/60 mt-1">
                      Farklı anahtar kelimeler deneyebilir veya filtreleri
                      değiştirebilirsiniz.
                    </p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="shrink-0 text-[#E5484D]/40 hover:text-[#E5484D] transition-colors"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                <button
                  onClick={search}
                  className="mt-3 px-4 py-1.5 text-[14px] font-medium text-white bg-[#E5484D] hover:bg-[#D13438] rounded-lg transition-colors"
                >
                  Tekrar Dene
                </button>
              </motion.div>
            )}

            {/* Results list */}
            {hasResults && (
              <motion.div
                className="space-y-3"
                variants={listContainer}
                initial="hidden"
                animate="show"
              >
                {results.sonuclar.map((result) => (
                  <ResultCard
                    key={result.karar_id}
                    result={result}
                    isSelected={
                      selectedResult?.karar_id === result.karar_id
                    }
                    query={query}
                    onSelect={handleSelectResult}
                  />
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {hasResults && results.toplam_sayfa > 1 && (
              <div className="flex items-center justify-between px-1 py-3 mt-2 border-t border-white/[0.06]">
                <span className="text-[14px] text-[#5C5C5F] tabular-nums">
                  <span className="text-[#8B8B8E] font-medium">
                    {results.toplam_bulunan}
                  </span>{" "}
                  sonuçtan sayfa{" "}
                  <span className="text-[#ECECEE] font-medium">
                    {currentPage}
                  </span>{" "}
                  / {results.toplam_sayfa}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-[14px] font-medium rounded-lg border border-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-[#8B8B8E] hover:text-[#ECECEE] hover:border-white/[0.10] hover:bg-white/[0.03]"
                  >
                    <ChevronIcon direction="left" />
                    Önceki
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= results.toplam_sayfa}
                    className="flex items-center gap-1 px-3 py-1.5 text-[14px] font-medium rounded-lg border border-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-[#8B8B8E] hover:text-[#ECECEE] hover:border-white/[0.10] hover:bg-white/[0.03]"
                  >
                    Sonraki
                    <ChevronIcon direction="right" />
                  </button>
                </div>
              </div>
            )}

            {/* No results */}
            {results && results.sonuclar.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-12 h-12 bg-[#111113] border border-white/[0.06] rounded-xl flex items-center justify-center mb-4">
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
                  Sonuç bulunamadı
                </p>
                <p className="text-[14px] text-[#5C5C5F] max-w-xs leading-relaxed mb-4">
                  Farklı anahtar kelimeler deneyin veya filtrelerinizi
                  genişletin.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUERIES.slice(0, 4).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestedQuery(q)}
                      className="px-2.5 py-1 text-[13px] text-[#6C6CFF] bg-[#6C6CFF]/[0.06] rounded-md hover:bg-[#6C6CFF]/10 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        {selectedResult ? (
          <motion.div
            key="detail"
            className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#0C0C0E] ${
              mobileShowDetail ? "block" : "hidden md:block"
            }`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="p-5 md:p-6 max-w-[900px]">
              {/* Mobile back */}
              <button
                onClick={() => {
                  setMobileShowDetail(false);
                  clearSelection();
                }}
                className="md:hidden flex items-center gap-2 text-[15px] text-[#8B8B8E] hover:text-[#ECECEE] mb-5 transition-colors"
              >
                <ArrowLeftIcon />
                Sonuçlara Dön
              </button>

              {/* Detail header card */}
              <div
                className="mb-6 bg-[#111113] border border-white/[0.06] rounded-2xl overflow-hidden"
                style={{
                  borderTopWidth: "3px",
                  borderTopColor: getCourtStyle(selectedResult.mahkeme).color,
                }}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      {(() => {
                        const court = getCourtStyle(selectedResult.mahkeme);
                        return (
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[15px] font-bold tracking-wide uppercase ${court.bg} ${court.text}`}
                          >
                            {court.label || selectedResult.mahkeme}
                          </span>
                        );
                      })()}
                      {selectedResult.daire && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[14px] font-medium bg-white/[0.04] text-[#8B8B8E] border border-white/[0.06]">
                          {selectedResult.daire}
                        </span>
                      )}
                    </div>
                    <span className="text-[14px] text-[#8B8B8E] tabular-nums font-medium">
                      {formatTurkishDate(selectedResult.tarih)}
                    </span>
                  </div>

                  <div className="h-px bg-white/[0.06] my-3" />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[12px] font-semibold text-[#5C5C5F] uppercase tracking-wider block mb-1">
                        Esas No
                      </span>
                      <span className="font-mono text-[17px] font-bold text-[#ECECEE]">
                        {selectedResult.esas_no}
                      </span>
                    </div>
                    <div>
                      <span className="text-[12px] font-semibold text-[#5C5C5F] uppercase tracking-wider block mb-1">
                        Karar No
                      </span>
                      <span className="font-mono text-[17px] font-bold text-[#ECECEE]">
                        {selectedResult.karar_no}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                {kararDetail && (
                  <>
                    <button
                      onClick={() => handleCopyText(kararDetail.tam_metin)}
                      className="flex items-center gap-2 px-3 py-2 text-[14px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {copied ? "Kopyalandı" : "Metni Kopyala"}
                    </button>
                    <button
                      onClick={() => {
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                        window.open(`${apiUrl}/api/v1/search/karar/${selectedResult.karar_id}/download`, "_blank");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[14px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                    >
                      <DownloadIcon />
                      Kararı İndir
                    </button>
                    <button
                      onClick={() => toggleBookmark(selectedResult.karar_id)}
                      className={`flex items-center gap-2 px-3 py-2 text-[14px] rounded-xl border transition-all ${
                        bookmarks.has(selectedResult.karar_id)
                          ? "text-[#6C6CFF] bg-[#6C6CFF]/[0.06] border-[#6C6CFF]/15 hover:bg-[#6C6CFF]/10"
                          : "text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border-white/[0.06] hover:border-white/[0.10]"
                      }`}
                    >
                      <BookmarkIcon
                        filled={bookmarks.has(selectedResult.karar_id)}
                      />
                      {bookmarks.has(selectedResult.karar_id)
                        ? "Kaydedildi"
                        : "Kaydet"}
                    </button>
                    <button
                      onClick={() => {
                        const ref = `${selectedResult.mahkeme} ${selectedResult.daire}, ${selectedResult.esas_no} E., ${selectedResult.karar_no} K.`;
                        localStorage.setItem("lexora_cite_to_dilekce", ref);
                        window.open("/dilekce", "_blank");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[14px] text-[#6C6CFF] bg-[#6C6CFF]/[0.06] border border-[#6C6CFF]/15 rounded-xl hover:bg-[#6C6CFF]/10 hover:border-[#6C6CFF]/30 transition-all"
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
                      Dilekçeye Ekle
                    </button>
                  </>
                )}
                <button
                  onClick={clearSelection}
                  className="ml-auto px-3 py-2 text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all hidden md:flex items-center gap-2"
                >
                  <CloseIcon size={12} />
                  Kapat
                </button>
              </div>

              {/* Detail body */}
              {detailLoading ? (
                <SkeletonDetail />
              ) : kararDetail ? (
                <div className="space-y-6">
                  {/* Summary card */}
                  <div className="bg-[#13131A] border border-[#6C6CFF]/10 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-4 bg-[#6C6CFF] rounded-full" />
                      <h3 className="text-[14px] font-semibold text-[#8B8B8E] uppercase tracking-wider">
                        Özet
                      </h3>
                    </div>
                    <p className="text-[15px] text-[#ECECEE] leading-[1.8] break-words">
                      {highlightText(kararDetail.ozet, query)}
                    </p>
                  </div>

                  {/* Full text */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-4 bg-[#A78BFA] rounded-full" />
                      <h3 className="text-[14px] font-semibold text-[#8B8B8E] uppercase tracking-wider">
                        Karar Metni
                      </h3>
                    </div>
                    <div
                      className="prose prose-invert max-w-none overflow-hidden break-words"
                      style={{ lineHeight: "1.85", textAlign: "justify" }}
                    >
                      {kararDetail.tam_metin ? (
                        <CitationText
                          text={kararDetail.tam_metin}
                          searchQuery={query}
                          onCitationClick={(citation) => {
                            if (
                              citation.type === "ictihat" &&
                              citation.esas_no
                            ) {
                              setQuery(citation.esas_no);
                              search();
                            } else if (
                              citation.type === "mevzuat" &&
                              citation.kanun_no
                            ) {
                              setActiveTab("mevzuat");
                            }
                          }}
                        />
                      ) : (
                        <p className="text-[#5C5C5F] italic">
                          Tam metin yüklenemedi. Özet gösteriliyor.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Related decisions */}
                  {relatedResults.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <h3 className="text-[14px] font-semibold text-[#5C5C5F] uppercase tracking-wider whitespace-nowrap">
                          Benzer Kararlar
                        </h3>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </div>
                      <div className="space-y-2">
                        {relatedResults.map((r) => {
                          const court = getCourtStyle(r.mahkeme);
                          return (
                            <button
                              key={r.karar_id}
                              onClick={() => handleSelectResult(r)}
                              className="w-full text-left bg-[#111113] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.12] hover:bg-white/[0.02] transition-all group"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold uppercase ${court.bg} ${court.text}`}
                                >
                                  {court.label || r.mahkeme}
                                </span>
                                {r.esas_no && (
                                  <span className="text-[13px] font-mono text-[#8B8B8E]">
                                    {r.esas_no}
                                  </span>
                                )}
                              </div>
                              <p className="text-[14px] text-[#8B8B8E] group-hover:text-[#ECECEE] line-clamp-2 leading-relaxed transition-colors">
                                {r.ozet?.slice(0, 150)}
                                {r.ozet && r.ozet.length > 150 ? "..." : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : (
          hasResults && (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0C0C0E]">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-[15px] text-[#5C5C5F]">
                  Karar metnini görüntülemek için
                  <br />
                  <span className="text-[#8B8B8E]">bir sonuç seçin</span>
                </p>
              </div>
            </div>
          )
        )}
      </AnimatePresence>
    </>
  );
}
