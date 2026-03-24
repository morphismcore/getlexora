"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */
interface CaseItem {
  id: string;
  title: string;
  court: string | null;
  status: string;
}

interface IctihatResult {
  karar_id: string;
  mahkeme: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
  ozet: string;
  relevance_score?: number;
  kaynak?: string;
}

interface SearchResponse {
  sonuclar: IctihatResult[];
  toplam_bulunan: number;
  sure_ms: number;
}

interface KararDetail {
  id: string;
  mahkeme: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
  tam_metin: string;
  ozet: string;
}

/* ─── Constants ─── */
const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  closed: "Kapalı",
  pending: "Beklemede",
  archived: "Arşiv",
};

const MAHKEME_VALUE_MAP: Record<string, string> = {
  "Yargıtay": "yargitay",
  "Danıştay": "danistay",
  "Anayasa Mahkemesi": "aym",
  "Bölge Adliye Mahkemesi": "bam",
  "AYM": "aym",
  "AİHM": "aihm",
};

const COURT_STYLES: Record<string, { bg: string; text: string; glow: string; label: string }> = {
  yargitay:  { bg: "bg-[#6C6CFF]/10", text: "text-[#6C6CFF]", glow: "shadow-[0_0_8px_rgba(108,108,255,0.15)]", label: "Yargıtay" },
  "Yargıtay":  { bg: "bg-[#6C6CFF]/10", text: "text-[#6C6CFF]", glow: "shadow-[0_0_8px_rgba(108,108,255,0.15)]", label: "Yargıtay" },
  danistay:  { bg: "bg-[#A78BFA]/10", text: "text-[#A78BFA]", glow: "shadow-[0_0_8px_rgba(167,139,250,0.15)]", label: "Danıştay" },
  "Danıştay":  { bg: "bg-[#A78BFA]/10", text: "text-[#A78BFA]", glow: "shadow-[0_0_8px_rgba(167,139,250,0.15)]", label: "Danıştay" },
  aym:       { bg: "bg-[#E5484D]/10", text: "text-[#E5484D]", glow: "shadow-[0_0_8px_rgba(229,72,77,0.15)]", label: "AYM" },
  "Anayasa Mahkemesi": { bg: "bg-[#E5484D]/10", text: "text-[#E5484D]", glow: "shadow-[0_0_8px_rgba(229,72,77,0.15)]", label: "AYM" },
  aihm:      { bg: "bg-[#3DD68C]/10", text: "text-[#3DD68C]", glow: "shadow-[0_0_8px_rgba(61,214,140,0.15)]", label: "AİHM" },
  bam:       { bg: "bg-[#FFB224]/10", text: "text-[#FFB224]", glow: "shadow-[0_0_8px_rgba(255,178,36,0.15)]", label: "BAM" },
  "Bölge Adliye Mahkemesi": { bg: "bg-[#FFB224]/10", text: "text-[#FFB224]", glow: "shadow-[0_0_8px_rgba(255,178,36,0.15)]", label: "BAM" },
};

const DEFAULT_COURT_STYLE = { bg: "bg-white/[0.06]", text: "text-[#8B8B8E]", glow: "", label: "" };

function getCourtStyle(mahkeme: string) {
  if (!mahkeme) return DEFAULT_COURT_STYLE;
  const style = COURT_STYLES[mahkeme];
  if (style) return style;
  if (mahkeme.includes("Bölge")) return COURT_STYLES.bam;
  return DEFAULT_COURT_STYLE;
}

const MAHKEMELER = [
  "Tümü", "Yargıtay", "Danıştay", "Anayasa Mahkemesi", "Bölge Adliye Mahkemesi",
  "İcra Mahkemesi", "Aile Mahkemesi", "Ceza Mahkemesi", "İdare Mahkemesi", "Tüketici Mahkemesi",
];

const DAIRELER = [
  "Tümü",
  "1. Hukuk Dairesi", "2. Hukuk Dairesi", "3. Hukuk Dairesi", "4. Hukuk Dairesi",
  "5. Hukuk Dairesi", "6. Hukuk Dairesi", "7. Hukuk Dairesi", "8. Hukuk Dairesi",
  "9. Hukuk Dairesi", "10. Hukuk Dairesi", "11. Hukuk Dairesi", "12. Hukuk Dairesi",
  "13. Hukuk Dairesi", "14. Hukuk Dairesi", "15. Hukuk Dairesi", "16. Hukuk Dairesi",
  "17. Hukuk Dairesi",
  "1. Ceza Dairesi", "2. Ceza Dairesi", "3. Ceza Dairesi", "4. Ceza Dairesi",
  "5. Ceza Dairesi", "6. Ceza Dairesi", "7. Ceza Dairesi", "8. Ceza Dairesi",
  "9. Ceza Dairesi", "10. Ceza Dairesi", "11. Ceza Dairesi", "12. Ceza Dairesi",
  "13. Ceza Dairesi", "14. Ceza Dairesi", "15. Ceza Dairesi", "16. Ceza Dairesi",
  "Hukuk Genel Kurulu", "Ceza Genel Kurulu",
  "1. İdari Dava Dairesi", "2. İdari Dava Dairesi", "3. İdari Dava Dairesi",
  "4. İdari Dava Dairesi", "5. İdari Dava Dairesi", "6. İdari Dava Dairesi",
  "7. İdari Dava Dairesi", "8. İdari Dava Dairesi", "9. İdari Dava Dairesi",
  "10. İdari Dava Dairesi",
  "1. Vergi Dava Dairesi", "2. Vergi Dava Dairesi", "3. Vergi Dava Dairesi",
  "4. Vergi Dava Dairesi",
  "İdari Dava Daireleri Kurulu", "Vergi Dava Daireleri Kurulu",
];

const KAYNAKLAR = ["Tümü", "Bedesten", "AYM", "AİHM"];
const SIRALAMALAR = ["Alaka düzeyi", "Tarih (yeni→eski)", "Tarih (eski→yeni)"];

const TYPEWRITER_QUERIES = [
  "işe iade savunma alınmadan fesih",
  "kıdem tazminatı hesaplama yöntemi",
  "boşanma nafaka miktarı belirleme",
  "kamulaştırma bedel tespiti",
  "iş kazası tazminat hesaplama",
  "kira tespit davası emsal",
  "miras paylaşımı saklı pay",
  "haksız tahrik indirim oranı",
  "ticari kredi faiz uygulaması",
  "idari para cezası iptal",
];

const SUGGESTED_QUERIES = [
  "İşe iade davası",
  "Kıdem tazminatı",
  "Boşanma nafaka",
  "Kamulaştırma bedeli",
  "Haksız fesih",
  "İş kazası tazminat",
  "Kira tespit",
  "Miras paylaşımı",
];

const TABS = [
  { key: "ictihat", label: "İçtihat Arama", enabled: true },
  { key: "mevzuat", label: "Mevzuat", enabled: false },
  { key: "ai", label: "AI Asistan", enabled: false },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ─── Helpers ─── */
function parseDaireValue(label: string): string | null {
  const m = label.match(/^(\d+)\./);
  return m ? m[1] : null;
}

function highlightText(text: string, queryStr: string): ReactNode[] {
  if (!queryStr.trim()) return [text];
  const words = queryStr
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return [text];
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(regex);
  const testRegex = new RegExp(`^(?:${words.join("|")})$`, "i");
  return parts.map((part, i) =>
    testRegex.test(part) ? (
      <mark key={i} className="bg-[#6C6CFF]/15 text-[#A5A5FF] rounded-sm px-0.5 ring-1 ring-[#6C6CFF]/20">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`;
}

/* ─── Typewriter Hook ─── */
function useTypewriter(phrases: string[], typingSpeed = 60, pauseDuration = 2200, deletingSpeed = 30) {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(currentPhrase.slice(0, text.length + 1));
        if (text.length + 1 === currentPhrase.length) {
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        setText(currentPhrase.slice(0, text.length - 1));
        if (text.length === 0) {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [text, phraseIndex, isDeleting, phrases, typingSpeed, pauseDuration, deletingSpeed]);

  return text;
}

/* ─── Skeleton Components ─── */
function ShimmerBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1A1F] rounded-lg ${className}`} style={style}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay * 0.05 }}
      className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <ShimmerBlock className="h-[22px] w-20 rounded-md" />
        <ShimmerBlock className="h-[16px] w-28" />
      </div>
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-[14px] w-24" />
        <ShimmerBlock className="h-[14px] w-24" />
        <ShimmerBlock className="h-[14px] w-16 ml-auto" />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-[14px] w-full" />
        <ShimmerBlock className="h-[14px] w-[90%]" />
        <ShimmerBlock className="h-[14px] w-3/4" />
      </div>
      <ShimmerBlock className="h-[4px] w-full rounded-full" />
    </motion.div>
  );
}

function SkeletonDetail() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-7 w-24 rounded-lg" />
        <ShimmerBlock className="h-6 w-32 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-5 w-28" />
        <ShimmerBlock className="h-5 w-28" />
        <ShimmerBlock className="h-5 w-20" />
      </div>
      <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 space-y-2.5">
        <ShimmerBlock className="h-4 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[14px]" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
      <div className="space-y-2.5 mt-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[14px]" style={{ width: `${55 + Math.random() * 45}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Motion Variants ─── */
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/* ─── Icons ─── */
const SearchIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 4h18M6 8h12M9 12h6M11 16h2" />
  </svg>
);

const CloseIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5m7-7l-7 7 7 7" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = ({ direction = "left" }: { direction?: "left" | "right" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Relevance Bar ─── */
function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "#3DD68C" : pct >= 60 ? "#6C6CFF" : pct >= 40 ? "#FFB224" : "#E5484D";

  return (
    <div className="flex items-center gap-2.5 mt-2.5">
      <div className="flex-1 h-[4px] bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}40, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums" style={{ color }}>
        %{pct}
      </span>
    </div>
  );
}

/* ─── Memoized Search Result Card ─── */
const SearchResultCard = React.memo(function SearchResultCard({
  result,
  isSelected,
  query,
  onSelect,
}: {
  result: IctihatResult;
  isSelected: boolean;
  query: string;
  onSelect: (result: IctihatResult) => void;
}) {
  const court = getCourtStyle(result.mahkeme);
  return (
    <motion.button
      key={result.karar_id}
      variants={listItem}
      onClick={() => onSelect(result)}
      className={`group w-full text-left bg-[#111113] border rounded-2xl p-4 transition-all duration-200 ${
        isSelected
          ? "border-[#6C6CFF]/30 bg-[#6C6CFF]/[0.04] shadow-[0_0_0_1px_rgba(108,108,255,0.15)]"
          : "border-white/[0.06] hover:border-white/[0.10] hover:bg-[#141418]"
      }`}
    >
      {/* Top row: court badge + daire */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase ${court.bg} ${court.text} ${court.glow}`}>
          {court.label || result.mahkeme}
        </span>
        {result.daire && (
          <span className="text-[11px] text-[#8B8B8E] font-medium">{result.daire}</span>
        )}
        {result.kaynak === "aym" && result.mahkeme !== "aym" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#E5484D]/10 text-[#E5484D]">AYM</span>
        )}
        {result.kaynak === "aihm" && result.mahkeme !== "aihm" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#3DD68C]/10 text-[#3DD68C]">AİHM</span>
        )}
      </div>

      {/* Case numbers row */}
      <div className="flex items-center gap-3 text-[12px] mb-2">
        <span className="font-mono text-[#ECECEE]">
          <span className="text-[#5C5C5F] text-[10px] mr-0.5">E.</span>
          {result.esas_no}
        </span>
        <span className="font-mono text-[#ECECEE]">
          <span className="text-[#5C5C5F] text-[10px] mr-0.5">K.</span>
          {result.karar_no}
        </span>
        <span className="ml-auto text-[11px] text-[#5C5C5F] tabular-nums">{result.tarih}</span>
      </div>

      {/* Summary with highlights */}
      <p className="text-[13px] text-[#8B8B8E] line-clamp-3 leading-relaxed group-hover:text-[#A0A0A3] transition-colors">
        {highlightText(result.ozet, query)}
      </p>

      {/* Relevance bar */}
      {result.relevance_score !== undefined && (
        <RelevanceBar score={result.relevance_score} />
      )}
    </motion.button>
  );
});

/* ─── Select Component ─── */
function FilterSelect({
  value,
  onChange,
  options,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  prefix: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 pr-8 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#1A1A1F] transition-all cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "Tümü" ? `${prefix}: Tümü` : o}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5C5C5F] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M6 9l6 6 6-6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function AramaPage() {
  /* ─── State ─── */
  const [activeTab, setActiveTab] = useState<TabKey>("ictihat");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mahkeme, setMahkeme] = useState("Tümü");
  const [daire, setDaire] = useState("Tümü");
  const [tarihBaslangic, setTarihBaslangic] = useState("");
  const [tarihBitis, setTarihBitis] = useState("");
  const [kaynak, setKaynak] = useState("Tümü");
  const [siralama, setSiralama] = useState("Alaka düzeyi");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedResult, setSelectedResult] = useState<IctihatResult | null>(null);
  const [kararDetail, setKararDetail] = useState<KararDetail | null>(null);
  const [kararCache, setKararCache] = useState<Record<string, KararDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const [llmStatus, setLlmStatus] = useState<"ok" | "error" | "loading">("loading");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const typewriterText = useTypewriter(TYPEWRITER_QUERIES);

  /* ─── Derived ─── */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (mahkeme !== "Tümü") count++;
    if (daire !== "Tümü") count++;
    if (tarihBaslangic) count++;
    if (tarihBitis) count++;
    if (kaynak !== "Tümü") count++;
    if (siralama !== "Alaka düzeyi") count++;
    return count;
  }, [mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama]);

  const hasResults = results && results.sonuclar.length > 0;
  const isEmpty = !loading && !results && !error;

  /* ─── Effects ─── */
  // Check LLM status
  useEffect(() => {
    fetch(`${API_URL}/health/llm`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setLlmStatus(data?.status === "ok" ? "ok" : "error"))
      .catch(() => setLlmStatus("error"));
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_search_history");
      if (saved) try { setSearchHistory(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(e.target as Node)) {
        setShowCaseDropdown(false);
      }
    }
    if (showCaseDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCaseDropdown]);

  /* ─── Callbacks ─── */
  const fetchCases = useCallback(async () => {
    const token = localStorage.getItem("lexora_token");
    if (!token) { setCasesError("Giriş yapın"); return; }
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Davalar yüklenemedi");
      const data = await res.json();
      setCases(Array.isArray(data) ? data : data.cases || []);
    } catch {
      setCasesError("Davalar yüklenemedi");
    } finally {
      setCasesLoading(false);
    }
  }, []);

  const handleSaveToCase = useCallback(async (caseId: string) => {
    const token = localStorage.getItem("lexora_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/cases/${caseId}/searches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: query.trim(),
          search_type: "ictihat",
          result_count: results?.toplam_bulunan || 0,
        }),
      });
      if (!res.ok) throw new Error("Kaydetme başarısız");
      setToast("Arama davaya kaydedildi");
    } catch {
      setToast("Kaydetme başarısız oldu");
    }
    setShowCaseDropdown(false);
  }, [query, results]);

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

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;
    if (query.trim().length < 3) {
      setError("Arama sorgusu en az 3 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedResult(null);
    setKararDetail(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/ictihat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          max_sonuc: 20,
          ...(mahkeme !== "Tümü" && MAHKEME_VALUE_MAP[mahkeme] && { mahkeme: [MAHKEME_VALUE_MAP[mahkeme]] }),
          ...(daire !== "Tümü" && parseDaireValue(daire) && { daire: parseDaireValue(daire) }),
          ...(tarihBaslangic && { tarih_baslangic: tarihBaslangic }),
          ...(tarihBitis && { tarih_bitis: tarihBitis }),
          ...(kaynak !== "Tümü" && { kaynak: kaynak.toLowerCase() }),
          ...(siralama !== "Alaka düzeyi" && { siralama: siralama === "Tarih (yeni→eski)" ? "tarih_desc" : "tarih_asc" }),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 422) throw new Error("Arama sorgusu geçersiz. En az 3 karakter giriniz.");
        throw new Error("Arama başarısız oldu. Lütfen tekrar deneyin.");
      }
      const data: SearchResponse = await res.json();
      setResults(data);

      const q = query.trim();
      setSearchHistory((prev) => {
        const updated = [q, ...prev.filter((h) => h !== q)].slice(0, 20);
        localStorage.setItem("lexora_search_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
      }
    } finally {
      setLoading(false);
    }
  }, [query, mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama, loading]);

  const handleSelectResult = useCallback(async (result: IctihatResult) => {
    setSelectedResult(result);
    setMobileShowDetail(true);

    // Check cache first
    if (kararCache[result.karar_id]) {
      setKararDetail(kararCache[result.karar_id]);
      return;
    }

    setDetailLoading(true);
    setKararDetail(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/karar/${result.karar_id}`);
      if (!res.ok) throw new Error("Karar yüklenemedi");
      const raw = await res.json();
      const detail: KararDetail = {
        id: raw.document_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || (raw.content || "").slice(0, 500),
        tam_metin: raw.content || "",
      };
      setKararDetail(detail);
      setKararCache(prev => ({ ...prev, [result.karar_id]: detail }));
    } catch {
      setKararDetail({
        id: result.karar_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || "",
        tam_metin: "Karar metni yüklenirken hata oluştu. Lütfen tekrar deneyin.",
      });
    } finally {
      setDetailLoading(false);
    }
  }, [kararCache]);

  const handleSuggestedQuery = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const handleDownloadResults = () => {
    if (!results) return;
    const lines = results.sonuclar.map((r) =>
      `${r.mahkeme} ${r.daire || ""} | ${r.esas_no || ""} E. | ${r.karar_no || ""} K. | ${r.tarih || ""}\n${(r.ozet || "").slice(0, 200)}\n`
    );
    const blob = new Blob([lines.join("\n---\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arama_${query.trim().replace(/\s+/g, "_").slice(0, 30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Sonuçlar indirildi");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") { setShowHistory(false); inputRef.current?.blur(); }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#09090B]">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#09090B] relative z-20">
        <div className="px-4 md:px-6 pt-14 md:pt-5 pb-0">

          {/* Title row */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#ECECEE]">
                Arama
              </h1>
              <p className="text-[12px] text-[#5C5C5F] mt-0.5">
                Doğal dil ile Türk hukuk veritabanında arama yapın
              </p>
            </div>
            {results && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-[12px] text-[#5C5C5F] tabular-nums"
              >
                <span className="text-[#ECECEE] font-medium">{results.toplam_bulunan}</span>
                <span>sonuç</span>
                <span className="text-[#3A3A3F]">·</span>
                <span>{formatDuration(results.sure_ms)}</span>
              </motion.div>
            )}
          </div>

          {/* Search bar — Hero element */}
          <div className="relative mb-3">
            <div
              className={`relative rounded-2xl transition-all duration-300 ${
                searchFocused
                  ? "shadow-[0_0_0_1px_rgba(108,108,255,0.4),0_0_20px_rgba(108,108,255,0.1),0_0_60px_rgba(108,108,255,0.05)]"
                  : "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
              }`}
            >
              <SearchIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${searchFocused ? "text-[#6C6CFF]" : "text-[#5C5C5F]"}`} />
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
                placeholder={query ? undefined : typewriterText + "│"}
                className="w-full bg-[#111113] border-0 rounded-2xl pl-12 pr-28 py-4 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:bg-[#13131A] transition-colors duration-200"
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
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[13px] font-medium text-white transition-all duration-150 active:scale-[0.98]"
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
                      <span className="text-[11px] font-medium text-[#5C5C5F]">Son Aramalar</span>
                    </div>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchHistory([]);
                        localStorage.removeItem("lexora_search_history");
                        setShowHistory(false);
                      }}
                      className="text-[10px] text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                    >
                      Tümünü Temizle
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {searchHistory.slice(0, 8).map((h, i) => (
                      <div key={i} className="flex items-center hover:bg-[#6C6CFF]/[0.06] transition-colors group">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setQuery(h); setShowHistory(false); }}
                          className="flex-1 flex items-center gap-2.5 text-left px-3 py-2.5 text-[13px] text-[#8B8B8E] group-hover:text-[#ECECEE] truncate transition-colors"
                        >
                          <SearchIcon className="w-3.5 h-3.5 text-[#3A3A3F] shrink-0" />
                          {h}
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSearchHistory((prev) => {
                              const updated = prev.filter((_, idx) => idx !== i);
                              localStorage.setItem("lexora_search_history", JSON.stringify(updated));
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

          {/* Tab switcher + Filter toggle */}
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <div className="flex items-center gap-0.5 relative">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => tab.enabled && setActiveTab(tab.key)}
                  className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? "text-[#ECECEE]"
                      : tab.enabled
                      ? "text-[#5C5C5F] hover:text-[#8B8B8E]"
                      : "text-[#3A3A3F] cursor-default"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {!tab.enabled && tab.key !== "ai" && (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-[#6C6CFF]/10 text-[#6C6CFF]/60 rounded-md">
                        YAKINDA
                      </span>
                    )}
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
                            ? "LLM baglantisi aktif"
                            : llmStatus === "error"
                            ? "LLM baglantisi yok"
                            : "Kontrol ediliyor..."
                        }
                      />
                    )}
                  </span>
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6C6CFF] rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] transition-all ${
                showFilters
                  ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.03]"
              }`}
            >
              <FilterIcon />
              Filtreler
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#6C6CFF] text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="px-4 md:px-6 py-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  <FilterSelect value={mahkeme} onChange={setMahkeme} options={MAHKEMELER} prefix="Mahkeme" />
                  <FilterSelect value={daire} onChange={setDaire} options={DAIRELER} prefix="Daire" />
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBaslangic}
                      onChange={(e) => setTarihBaslangic(e.target.value)}
                      title="Başlangıç tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBitis}
                      onChange={(e) => setTarihBitis(e.target.value)}
                      title="Bitiş tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <FilterSelect value={kaynak} onChange={setKaynak} options={KAYNAKLAR} prefix="Kaynak" />
                  <FilterSelect value={siralama} onChange={setSiralama} options={SIRALAMALAR} prefix="Sıralama" />
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setMahkeme("Tümü");
                      setDaire("Tümü");
                      setTarihBaslangic("");
                      setTarihBitis("");
                      setKaynak("Tümü");
                      setSiralama("Alaka düzeyi");
                    }}
                    className="mt-2 text-[11px] text-[#E5484D] hover:text-[#FF6B6F] transition-colors"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex min-h-0">

        {/* Empty state */}
        {isEmpty && !mobileShowDetail && (
          <div className="flex-1 flex items-start justify-center pt-16 md:pt-24">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center px-4 max-w-lg"
            >
              {/* Decorative search icon with glow */}
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="absolute inset-0 bg-[#6C6CFF]/10 rounded-2xl blur-xl" />
                <div className="relative w-16 h-16 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                  <SearchIcon className="w-7 h-7 text-[#6C6CFF]/60" />
                </div>
              </div>

              <h2 className="text-[16px] font-semibold text-[#ECECEE] mb-1.5">
                Hukuk veritabanında arama yapın
              </h2>
              <p className="text-[13px] text-[#5C5C5F] mb-6 leading-relaxed">
                Doğal dil ile içtihat arayın. AI destekli semantik arama ile en alakalı kararları bulun.
              </p>

              {/* Suggested queries */}
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestedQuery(q)}
                    className="px-3 py-1.5 text-[12px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-[#6C6CFF]/30 hover:text-[#ECECEE] hover:bg-[#6C6CFF]/[0.04] transition-all duration-200"
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
            className={`overflow-y-auto transition-all duration-200 ${
              mobileShowDetail ? "hidden md:block" : "flex-1 md:flex-none"
            } ${
              selectedResult ? "md:w-[44%] md:shrink-0 md:border-r md:border-white/[0.06]" : "flex-1"
            }`}
          >
            <div className="p-3 md:p-4 space-y-2.5">

              {/* Status bar */}
              {results && !loading && (
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[12px] text-[#5C5C5F] tabular-nums">
                    <span className="text-[#8B8B8E] font-medium">{results.toplam_bulunan}</span> sonuç bulundu
                    <span className="text-[#3A3A3F] mx-1.5">·</span>
                    {formatDuration(results.sure_ms)}
                  </p>
                  {results.sonuclar.length > 0 && (
                    <button
                      onClick={handleDownloadResults}
                      className="flex items-center gap-1.5 text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
                    >
                      <DownloadIcon />
                      İndir
                    </button>
                  )}
                </div>
              )}

              {/* Loading skeletons */}
              {loading && (
                <div className="space-y-2.5">
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
                      <p className="text-[13px] font-medium text-[#E5484D]">{error}</p>
                      <p className="text-[12px] text-[#E5484D]/60 mt-1">Farklı anahtar kelimeler deneyebilir veya filtreleri değiştirebilirsiniz.</p>
                    </div>
                    <button onClick={() => setError(null)} className="shrink-0 text-[#E5484D]/40 hover:text-[#E5484D] transition-colors">
                      <CloseIcon size={16} />
                    </button>
                  </div>
                  <button
                    onClick={handleSearch}
                    className="mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-[#E5484D] hover:bg-[#D13438] rounded-lg transition-colors"
                  >
                    Tekrar Dene
                  </button>
                </motion.div>
              )}

              {/* Results list */}
              {hasResults && (
                <motion.div className="space-y-2" variants={listContainer} initial="hidden" animate="show">
                  {results.sonuclar.map((result) => (
                    <SearchResultCard
                      key={result.karar_id}
                      result={result}
                      isSelected={selectedResult?.karar_id === result.karar_id}
                      query={query}
                      onSelect={handleSelectResult}
                    />
                  ))}
                </motion.div>
              )}

              {/* No results */}
              {results && results.sonuclar.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-12 h-12 bg-[#111113] border border-white/[0.06] rounded-xl flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-[#5C5C5F]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[#8B8B8E] font-medium mb-1">Sonuç bulunamadı</p>
                  <p className="text-[12px] text-[#5C5C5F] max-w-xs leading-relaxed mb-4">
                    Farklı anahtar kelimeler deneyin veya filtrelerinizi genişletin.
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {SUGGESTED_QUERIES.slice(0, 4).map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSuggestedQuery(q)}
                        className="px-2.5 py-1 text-[11px] text-[#6C6CFF] bg-[#6C6CFF]/[0.06] rounded-md hover:bg-[#6C6CFF]/10 transition-colors"
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

        {/* ── Right panel: Document viewer ── */}
        <AnimatePresence mode="wait">
          {selectedResult ? (
            <motion.div
              key="detail"
              className="flex-1 overflow-y-auto bg-[#0C0C0E]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-4 md:p-6 max-w-[760px]">

                {/* Mobile back */}
                <button
                  onClick={() => { setMobileShowDetail(false); setSelectedResult(null); setKararDetail(null); }}
                  className="md:hidden flex items-center gap-1.5 text-[13px] text-[#8B8B8E] hover:text-[#ECECEE] mb-5 transition-colors"
                >
                  <ArrowLeftIcon />
                  Sonuçlara Dön
                </button>

                {/* Detail header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    {(() => {
                      const court = getCourtStyle(selectedResult.mahkeme);
                      return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide uppercase ${court.bg} ${court.text} border border-current/10`}>
                          {court.label || selectedResult.mahkeme}
                        </span>
                      );
                    })()}
                    {selectedResult.daire && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-[#8B8B8E] border border-white/[0.06]">
                        {selectedResult.daire}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className="font-mono text-[#ECECEE]">
                      <span className="text-[#5C5C5F] text-[11px]">Esas </span>
                      {selectedResult.esas_no}
                    </span>
                    <span className="text-[#3A3A3F]">/</span>
                    <span className="font-mono text-[#ECECEE]">
                      <span className="text-[#5C5C5F] text-[11px]">Karar </span>
                      {selectedResult.karar_no}
                    </span>
                    <span className="text-[#3A3A3F]">/</span>
                    <span className="text-[#5C5C5F] tabular-nums">{selectedResult.tarih}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {kararDetail && (
                    <>
                      <button
                        onClick={() => handleCopyText(kararDetail.tam_metin)}
                        className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? "Kopyalandı" : "Metni Kopyala"}
                      </button>
                      <button
                        onClick={() => {
                          const ref = `${selectedResult.mahkeme} ${selectedResult.daire}, ${selectedResult.esas_no} E., ${selectedResult.karar_no} K.`;
                          localStorage.setItem("lexora_cite_to_dilekce", ref);
                          window.open("/dilekce", "_blank");
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#6C6CFF] bg-[#6C6CFF]/[0.06] border border-[#6C6CFF]/15 rounded-xl hover:bg-[#6C6CFF]/10 hover:border-[#6C6CFF]/30 transition-all"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                        Dilekçeye Ekle
                      </button>
                      <button
                        onClick={() => {
                          const text = kararDetail.ozet || kararDetail.tam_metin.slice(0, 1000);
                          localStorage.setItem("lexora_verify_text", text);
                          window.open("/dogrulama", "_blank");
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#3DD68C] bg-[#3DD68C]/[0.06] border border-[#3DD68C]/15 rounded-xl hover:bg-[#3DD68C]/10 hover:border-[#3DD68C]/30 transition-all"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Doğrula
                      </button>

                      {/* Davaya Kaydet */}
                      <div className="relative" ref={caseDropdownRef}>
                        <button
                          onClick={() => {
                            if (!showCaseDropdown) { setShowCaseDropdown(true); fetchCases(); } else { setShowCaseDropdown(false); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#FFB224] bg-[#FFB224]/[0.06] border border-[#FFB224]/15 rounded-xl hover:bg-[#FFB224]/10 hover:border-[#FFB224]/30 transition-all"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                            <path d="M16 2v4M8 2v4M4 10h16" strokeLinecap="round" />
                          </svg>
                          Davaya Kaydet
                        </button>
                        <AnimatePresence>
                          {showCaseDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ duration: 0.12 }}
                              className="absolute left-0 top-full mt-1.5 w-72 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                              {casesLoading && (
                                <div className="flex items-center justify-center py-5">
                                  <div className="w-4 h-4 border-2 border-[#FFB224]/30 border-t-[#FFB224] rounded-full animate-spin" />
                                </div>
                              )}
                              {casesError && (
                                <div className="px-3 py-3 text-[12px] text-[#E5484D]">{casesError}</div>
                              )}
                              {!casesLoading && !casesError && cases.length === 0 && (
                                <div className="px-3 py-3 text-[12px] text-[#5C5C5F]">Henüz dava dosyanız yok</div>
                              )}
                              {!casesLoading && !casesError && cases.length > 0 && (
                                <>
                                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F] border-b border-white/[0.06]">
                                    Dava Seçin
                                  </div>
                                  <div className="max-h-52 overflow-y-auto">
                                    {cases.map((c) => (
                                      <button
                                        key={c.id}
                                        onClick={() => handleSaveToCase(c.id)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-[#FFB224]/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
                                      >
                                        <div className="text-[13px] text-[#ECECEE] truncate">{c.title}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {c.court && <span className="text-[11px] text-[#5C5C5F]">{c.court}</span>}
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${
                                            c.status === "active" ? "bg-[#3DD68C]/10 text-[#3DD68C]" :
                                            c.status === "closed" ? "bg-[#E5484D]/10 text-[#E5484D]" :
                                            "bg-[#FFB224]/10 text-[#FFB224]"
                                          }`}>
                                            {STATUS_LABELS[c.status] || c.status}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => { setSelectedResult(null); setKararDetail(null); }}
                    className="ml-auto px-3 py-2 text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all hidden md:flex items-center gap-1.5"
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
                    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 bg-[#6C6CFF] rounded-full" />
                        <h3 className="text-[12px] font-semibold text-[#8B8B8E] uppercase tracking-wider">Özet</h3>
                      </div>
                      <p className="text-[13px] text-[#ECECEE] leading-[1.7]">
                        {highlightText(kararDetail.ozet, query)}
                      </p>
                    </div>

                    {/* Full text */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-[#A78BFA] rounded-full" />
                        <h3 className="text-[12px] font-semibold text-[#8B8B8E] uppercase tracking-wider">Karar Metni</h3>
                      </div>
                      <div className="text-[14px] text-[#ECECEE]/90 leading-[1.8] space-y-4">
                        {kararDetail.tam_metin
                          .split(/\n\s*\n/)
                          .filter((p) => p.trim())
                          .map((paragraph, i) => (
                            <p key={i} className="whitespace-pre-wrap">
                              {paragraph.trim()}
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : (
            hasResults && (
              <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0C0C0E]">
                <div className="text-center">
                  <div className="w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[#5C5C5F]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-[#5C5C5F]">
                    Karar metnini görüntülemek için<br />
                    <span className="text-[#8B8B8E]">bir sonuç seçin</span>
                  </p>
                </div>
              </div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            role="alert" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <span className="text-[13px] text-[#ECECEE]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}