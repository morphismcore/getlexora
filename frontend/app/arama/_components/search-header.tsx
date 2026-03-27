"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SearchIcon, FilterIcon, CloseIcon, HistoryIcon } from "./shared/icons";
import { FilterSelect } from "./shared/filter-select";
import { useTypewriter } from "./hooks/use-typewriter";
import {
  TABS,
  TYPEWRITER_QUERIES,
  MAHKEMELER,
  DAIRELER,
  KAYNAKLAR,
  SIRALAMALAR,
  type TabKey,
} from "./constants";
import { formatDuration } from "./shared/helpers";
import type { SearchResponse, MevzuatSearchResponse } from "./types";

/* ─── Props ─── */
interface SearchHeaderProps {
  /* Query */
  query: string;
  setQuery: (q: string) => void;

  /* Tabs */
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  /* Actions */
  onSearch: () => void;
  loading: boolean;

  /* Result meta (optional, shown in header) */
  ictihatResults: SearchResponse | null;
  mevzuatResults: MevzuatSearchResponse | null;

  /* Filters — ictihat only */
  mahkeme: string;
  setMahkeme: (v: string) => void;
  daire: string;
  setDaire: (v: string) => void;
  tarihBaslangic: string;
  setTarihBaslangic: (v: string) => void;
  tarihBitis: string;
  setTarihBitis: (v: string) => void;
  kaynak: string;
  setKaynak: (v: string) => void;
  siralama: string;
  setSiralama: (v: string) => void;
  esasNo: string;
  setEsasNo: (v: string) => void;
  kararNo: string;
  setKararNo: (v: string) => void;
  resetFilters: () => void;
  setCurrentPage: (p: number) => void;

  /* Search history */
  searchHistory: string[];
  setSearchHistory: React.Dispatch<React.SetStateAction<string[]>>;

  /* Mevzuat extra */
  kanunNo: string;
  setKanunNo: (v: string) => void;

  /* LLM status for AI tab dot */
  llmStatus: "ok" | "error" | "loading";
}

export function SearchHeader({
  query,
  setQuery,
  activeTab,
  setActiveTab,
  onSearch,
  loading,
  ictihatResults,
  mevzuatResults,
  mahkeme,
  setMahkeme,
  daire,
  setDaire,
  tarihBaslangic,
  setTarihBaslangic,
  tarihBitis,
  setTarihBitis,
  kaynak,
  setKaynak,
  siralama,
  setSiralama,
  esasNo,
  setEsasNo,
  kararNo,
  setKararNo,
  resetFilters,
  setCurrentPage,
  searchHistory,
  setSearchHistory,
  kanunNo,
  setKanunNo,
  llmStatus,
}: SearchHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileFilterDrawer, setMobileFilterDrawer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_QUERIES);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (mahkeme !== "Tümü") count++;
    if (daire !== "Tümü") count++;
    if (tarihBaslangic) count++;
    if (tarihBitis) count++;
    if (kaynak !== "Tümü") count++;
    if (siralama !== "Alaka düzeyi") count++;
    if (esasNo.trim()) count++;
    if (kararNo.trim()) count++;
    return count;
  }, [mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama, esasNo, kararNo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
    if (e.key === "Escape") {
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };

  const placeholder =
    query
      ? undefined
      : activeTab === "ai"
        ? "Hukuki sorunuzu sorun..."
        : activeTab === "mevzuat"
          ? "Mevzuat ara... (ör: iş güvenliği)"
          : typewriterText + "│";

  return (
    <>
      <div className="shrink-0 border-b border-white/[0.06] bg-[#09090B] relative z-20">
        <div className="px-4 md:px-6 pt-14 md:pt-5 pb-0">
          {/* Title row */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#ECECEE]">
                Arama
              </h1>
              <p className="text-[14px] text-[#5C5C5F] mt-0.5">
                Doğal dil ile Türk hukuk veritabanında arama yapın
              </p>
            </div>
            {activeTab === "ictihat" && ictihatResults && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-[14px] text-[#5C5C5F] tabular-nums"
              >
                <span className="text-[#ECECEE] font-medium">
                  {ictihatResults.toplam_bulunan}
                </span>
                <span>sonuç</span>
                <span className="text-[#3A3A3F]">·</span>
                <span>{formatDuration(ictihatResults.sure_ms)}</span>
              </motion.div>
            )}
            {activeTab === "mevzuat" && mevzuatResults && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-[14px] text-[#5C5C5F] tabular-nums"
              >
                <span className="text-[#ECECEE] font-medium">
                  {mevzuatResults.toplam}
                </span>
                <span>mevzuat</span>
              </motion.div>
            )}
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <div
              className={`relative rounded-2xl transition-all duration-300 ${
                searchFocused
                  ? "shadow-[0_0_0_1px_rgba(108,108,255,0.4),0_0_20px_rgba(108,108,255,0.1),0_0_60px_rgba(108,108,255,0.05)]"
                  : "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
              }`}
            >
              <SearchIcon
                className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${
                  searchFocused ? "text-[#6C6CFF]" : "text-[#5C5C5F]"
                }`}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setSearchFocused(true);
                  if (searchHistory.length > 0 && !query) setShowHistory(true);
                }}
                onBlur={() => {
                  setSearchFocused(false);
                  setTimeout(() => setShowHistory(false), 200);
                }}
                placeholder={placeholder}
                className="w-full bg-[#111113] border-0 rounded-2xl pl-12 pr-28 py-5 text-[17px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:bg-[#13131A] transition-colors duration-200"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="p-1.5 text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
                  >
                    <CloseIcon size={12} />
                  </button>
                )}
                <button
                  onClick={onSearch}
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[15px] font-medium text-white transition-all duration-150 active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Aranıyor</span>
                    </div>
                  ) : (
                    "Ara"
                  )}
                </button>
              </div>
            </div>

            {/* Search history dropdown */}
            <AnimatePresence>
              {showHistory && searchHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <HistoryIcon />
                      <span className="text-[13px] font-medium text-[#5C5C5F]">
                        Son Aramalar
                      </span>
                    </div>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchHistory([]);
                        localStorage.removeItem("lexora_search_history");
                        setShowHistory(false);
                      }}
                      className="text-[12px] text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                    >
                      Tümünü Temizle
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {searchHistory.slice(0, 8).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center hover:bg-[#6C6CFF]/[0.06] transition-colors group"
                      >
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setQuery(h);
                            setShowHistory(false);
                          }}
                          className="flex-1 flex items-center gap-2.5 text-left px-3 py-2.5 text-[15px] text-[#8B8B8E] group-hover:text-[#ECECEE] truncate transition-colors"
                        >
                          <SearchIcon className="w-3.5 h-3.5 text-[#3A3A3F] shrink-0" />
                          {h}
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSearchHistory((prev) => {
                              const updated = prev.filter(
                                (_, idx) => idx !== i,
                              );
                              localStorage.setItem(
                                "lexora_search_history",
                                JSON.stringify(updated),
                              );
                              if (updated.length === 0) setShowHistory(false);
                              return updated;
                            });
                          }}
                          className="px-3 py-2.5 text-[#3A3A3F] hover:text-[#E5484D] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <CloseIcon size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mevzuat: Kanun No input */}
          <AnimatePresence>
            {activeTab === "mevzuat" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden mb-2"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={kanunNo}
                    onChange={(e) => setKanunNo(e.target.value)}
                    placeholder="Kanun No (opsiyonel)"
                    className="w-full bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab switcher + Filter toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 relative">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => tab.enabled && setActiveTab(tab.key)}
                  className={`relative px-4 py-2.5 text-[15px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? "text-[#ECECEE]"
                      : tab.enabled
                        ? "text-[#5C5C5F] hover:text-[#8B8B8E]"
                        : "text-[#3A3A3F] cursor-default"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {tab.key === "ai" && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          llmStatus === "loading"
                            ? "bg-[#F5A623] animate-pulse"
                            : llmStatus === "ok"
                              ? "bg-[#3DD68C]"
                              : "bg-[#E5484D]"
                        }`}
                        title={
                          llmStatus === "ok"
                            ? "LLM bağlantısı aktif"
                            : llmStatus === "error"
                              ? "LLM bağlantısı yok"
                              : "Kontrol ediliyor..."
                        }
                      />
                    )}
                  </span>
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6C6CFF] rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Filter toggle -- ictihat only */}
            {activeTab === "ictihat" && (
              <>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-[14px] transition-all ${
                    showFilters
                      ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                      : "text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.03]"
                  }`}
                >
                  <FilterIcon />
                  Filtreler
                  {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#6C6CFF] text-[11px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setMobileFilterDrawer(true)}
                  className={`flex md:hidden items-center gap-1.5 px-3 py-2 rounded-lg text-[14px] transition-all ${
                    activeFilterCount > 0
                      ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                      : "text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.03]"
                  }`}
                >
                  <FilterIcon />
                  Filtreler
                  {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#6C6CFF] text-[11px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Desktop filter panel -- ictihat only */}
        <AnimatePresence>
          {showFilters && activeTab === "ictihat" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/[0.06] hidden md:block"
            >
              <div className="px-4 md:px-6 py-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  <FilterSelect
                    value={mahkeme}
                    onChange={(v) => {
                      setMahkeme(v);
                      setCurrentPage(1);
                    }}
                    options={MAHKEMELER}
                    prefix="Mahkeme"
                  />
                  <FilterSelect
                    value={daire}
                    onChange={(v) => {
                      setDaire(v);
                      setCurrentPage(1);
                    }}
                    options={DAIRELER}
                    prefix="Daire"
                  />
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBaslangic}
                      onChange={(e) => {
                        setTarihBaslangic(e.target.value);
                        setCurrentPage(1);
                      }}
                      title="Başlangıç tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBitis}
                      onChange={(e) => {
                        setTarihBitis(e.target.value);
                        setCurrentPage(1);
                      }}
                      title="Bitiş tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <FilterSelect
                    value={kaynak}
                    onChange={(v) => {
                      setKaynak(v);
                      setCurrentPage(1);
                    }}
                    options={KAYNAKLAR}
                    prefix="Kaynak"
                  />
                  <FilterSelect
                    value={siralama}
                    onChange={(v) => {
                      setSiralama(v);
                      setCurrentPage(1);
                    }}
                    options={SIRALAMALAR}
                    prefix="Sıralama"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={esasNo}
                      onChange={(e) => setEsasNo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { setCurrentPage(1); onSearch(); } }}
                      placeholder="Esas No"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={kararNo}
                      onChange={(e) => setKararNo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { setCurrentPage(1); onSearch(); } }}
                      placeholder="Karar No"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                    />
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      resetFilters();
                      setCurrentPage(1);
                    }}
                    className="mt-2 text-[13px] text-[#E5484D] hover:text-[#FF6B6F] transition-colors"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {mobileFilterDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileFilterDrawer(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#111113] border-t border-white/[0.08] rounded-t-2xl max-h-[85vh] overflow-y-auto md:hidden"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-[17px] font-semibold text-[#ECECEE]">
                  Filtreler
                </h3>
                <button
                  onClick={() => setMobileFilterDrawer(false)}
                  className="p-1.5 text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                    Mahkeme
                  </label>
                  <FilterSelect
                    value={mahkeme}
                    onChange={(v) => {
                      setMahkeme(v);
                      setCurrentPage(1);
                    }}
                    options={MAHKEMELER}
                    prefix="Mahkeme"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                    Daire
                  </label>
                  <FilterSelect
                    value={daire}
                    onChange={(v) => {
                      setDaire(v);
                      setCurrentPage(1);
                    }}
                    options={DAIRELER}
                    prefix="Daire"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={tarihBaslangic}
                      onChange={(e) => {
                        setTarihBaslangic(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                      Bitiş Tarihi
                    </label>
                    <input
                      type="date"
                      value={tarihBitis}
                      onChange={(e) => {
                        setTarihBitis(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                    Kaynak
                  </label>
                  <FilterSelect
                    value={kaynak}
                    onChange={(v) => {
                      setKaynak(v);
                      setCurrentPage(1);
                    }}
                    options={KAYNAKLAR}
                    prefix="Kaynak"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                      Esas No
                    </label>
                    <input
                      type="text"
                      value={esasNo}
                      onChange={(e) => setEsasNo(e.target.value)}
                      placeholder="ör: 2023/1234"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                      Karar No
                    </label>
                    <input
                      type="text"
                      value={kararNo}
                      onChange={(e) => setKararNo(e.target.value)}
                      placeholder="ör: 2024/5678"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-[#8B8B8E] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#5C5C5F] uppercase tracking-wider mb-1.5">
                    Sıralama
                  </label>
                  <FilterSelect
                    value={siralama}
                    onChange={(v) => {
                      setSiralama(v);
                      setCurrentPage(1);
                    }}
                    options={SIRALAMALAR}
                    prefix="Sıralama"
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-white/[0.06] flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      resetFilters();
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2.5 text-[15px] text-[#E5484D] hover:text-[#FF6B6F] transition-colors"
                  >
                    Temizle
                  </button>
                )}
                <button
                  onClick={() => setMobileFilterDrawer(false)}
                  className="flex-1 px-4 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] rounded-xl text-[15px] font-medium text-white transition-all active:scale-[0.98]"
                >
                  Uygula
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[12px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
