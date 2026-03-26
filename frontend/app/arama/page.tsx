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
  toplam_sayfa: number;
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

interface MevzuatResult {
  mevzuatNo: string;
  mevzuatAd: string;
  mevzuatTur: string;
  mevzuatTertip?: string;
  resmiGazeteTarihi?: string;
  resmiGazeteSayisi?: string;
  mevzuatId?: string;
}

interface MevzuatSearchResponse {
  sonuclar: MevzuatResult[];
  toplam: number;
}

interface MevzuatContent {
  mevzuat_id: string;
  content: string;
  html?: string;
}

interface AIMessage {
  role: "user" | "assistant";
  content: string;
  sources?: IctihatResult[];
  post_citation_check?: {
    verified: boolean;
    citations_found: number;
    unverified: string[];
    verified_count: number;
  };
  warnings?: string[];
  timestamp: Date;
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
  { key: "mevzuat", label: "Mevzuat", enabled: true },
  { key: "ai", label: "AI Asistan", enabled: true },
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

function formatLegalText(text: string): ReactNode[] {
  if (!text) return [];

  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Detect section headers (DAVACI, DAVALI, etc.)
    const isHeader = /^(DAVACI|DAVALI|HÜKÜM|KARAR|GEREKÇESİ|SONUÇ|İDDİA|SAVUNMA|DELİLLER|T\.C\.|TÜRK MİLLETİ ADINA)/i.test(trimmed);

    if (isHeader) {
      return (
        <div key={i} className="mt-4 mb-2">
          <p className="text-[13px] font-semibold text-[#6C6CFF]">{trimmed}</p>
        </div>
      );
    }

    return (
      <p key={i} className="text-[13px] text-[#ECECEE]/90 leading-relaxed mb-3 whitespace-pre-wrap">
        {trimmed}
      </p>
    );
  }).filter(Boolean) as ReactNode[];
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

const BookmarkIcon = ({ filled = false, size = 14 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" strokeLinecap="round" strokeLinejoin="round" />
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
  isBookmarked,
  onToggleBookmark,
}: {
  result: IctihatResult;
  isSelected: boolean;
  query: string;
  onSelect: (result: IctihatResult) => void;
  isBookmarked: boolean;
  onToggleBookmark: (karar_id: string) => void;
}) {
  const court = getCourtStyle(result.mahkeme);
  return (
    <motion.button
      key={result.karar_id}
      variants={listItem}
      onClick={() => onSelect(result)}
      className={`group w-full text-left bg-[#111113] border rounded-2xl p-4 transition-all duration-200 relative ${
        isSelected
          ? "border-[#6C6CFF]/30 bg-[#6C6CFF]/[0.04] shadow-[0_0_0_1px_rgba(108,108,255,0.15)]"
          : "border-white/[0.06] hover:border-white/[0.10] hover:bg-[#141418]"
      }`}
    >
      {/* Top row: court badge + daire + bookmark */}
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
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(result.karar_id); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggleBookmark(result.karar_id); } }}
          className={`ml-auto shrink-0 p-1 rounded-md transition-all ${
            isBookmarked
              ? "text-[#6C6CFF] hover:text-[#8B8BFF]"
              : "text-[#3A3A3F] opacity-0 group-hover:opacity-100 hover:text-[#8B8B8E]"
          }`}
          title={isBookmarked ? "Kayıttan kaldır" : "Kaydet"}
        >
          <BookmarkIcon filled={isBookmarked} />
        </span>
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

  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("lexora_bookmarks");
        if (saved) return new Set(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    return new Set();
  });

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
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const lastKararRequestRef = useRef<string | null>(null);
  const lastMevzuatRequestRef = useRef<string | null>(null);

  /* ─── Mevzuat State ─── */
  const [mevzuatResults, setMevzuatResults] = useState<MevzuatSearchResponse | null>(null);
  const [selectedMevzuat, setSelectedMevzuat] = useState<MevzuatResult | null>(null);
  const [mevzuatContent, setMevzuatContent] = useState<MevzuatContent | null>(null);
  const [mevzuatLoading, setMevzuatLoading] = useState(false);
  const [kanunNo, setKanunNo] = useState("");
  const [mevzuatSearchText, setMevzuatSearchText] = useState("");

  /* ─── AI State ─── */
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const aiChatRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll AI chat
  useEffect(() => {
    if (aiChatRef.current) {
      aiChatRef.current.scrollTop = aiChatRef.current.scrollHeight;
    }
  }, [aiMessages, aiStreaming]);

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

  const toggleBookmark = useCallback((karar_id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(karar_id)) {
        next.delete(karar_id);
      } else {
        next.add(karar_id);
        setToast("Karar kaydedildi");
      }
      localStorage.setItem("lexora_bookmarks", JSON.stringify([...next]));
      return next;
    });
  }, []);

  /* ─── Mevzuat Search Handler ─── */
  const handleMevzuatSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMevzuatResults(null);
    setSelectedMevzuat(null);
    setMevzuatContent(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...(kanunNo && { kanun_no: kanunNo }),
        }),
      });
      if (!res.ok) throw new Error("Mevzuat araması başarısız");
      const data = await res.json();
      setMevzuatResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [query, kanunNo]);

  /* ─── Mevzuat Content Loader ─── */
  const handleSelectMevzuat = useCallback(async (m: MevzuatResult) => {
    const requestId = m.mevzuatId || m.mevzuatNo || "";
    lastMevzuatRequestRef.current = requestId;

    setSelectedMevzuat(m);
    if (!m.mevzuatId && !m.mevzuatNo) return;
    setMevzuatLoading(true);
    // DON'T clear mevzuatContent yet — keep showing previous while loading

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const id = m.mevzuatId || m.mevzuatNo;
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat/${id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Race condition guard
      if (lastMevzuatRequestRef.current !== requestId) return;

      if (res.ok) {
        const data = await res.json();
        setMevzuatContent(data);
      } else {
        setMevzuatContent(null);
      }
    } catch {
      if (lastMevzuatRequestRef.current !== requestId) return;
      setMevzuatContent(null);
    } finally {
      if (lastMevzuatRequestRef.current === requestId) {
        setMevzuatLoading(false);
      }
    }
  }, []);

  /* ─── AI Streaming Handler ─── */
  const handleAIAsk = useCallback(async () => {
    const userQuery = query.trim() || aiInput.trim();
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
  }, [query, aiInput]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;
    if (query.trim().length < 3) {
      setError("Arama sorgusu en az 3 karakter olmalıdır.");
      return;
    }

    if (activeTab === "mevzuat") {
      await handleMevzuatSearch();
      return;
    }

    if (activeTab === "ai") {
      await handleAIAsk();
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
          sayfa: currentPage,
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
  }, [query, activeTab, mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama, currentPage, loading, handleMevzuatSearch, handleAIAsk]);

  const handleSelectResult = useCallback(async (result: IctihatResult) => {
    const requestId = result.karar_id;
    lastKararRequestRef.current = requestId;

    setSelectedResult(result);
    setMobileShowDetail(true);

    // Check cache first
    if (kararCache[result.karar_id]) {
      setKararDetail(kararCache[result.karar_id]);
      return;
    }

    setDetailLoading(true);
    // DON'T clear kararDetail yet — keep showing previous while loading

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_URL}/api/v1/search/karar/${result.karar_id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Race condition guard: check if this is still the current request
      if (lastKararRequestRef.current !== requestId) return;

      if (!res.ok) throw new Error("Karar yüklenemedi");
      const raw = await res.json();

      const detail: KararDetail = {
        id: raw.document_id || result.karar_id,
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
    } catch (err) {
      // Race condition guard
      if (lastKararRequestRef.current !== requestId) return;

      // On error: show what we have (ozet from search results) instead of nothing
      setKararDetail({
        id: result.karar_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || "",
        tam_metin: "",  // Empty but we still show ozet
      });
    } finally {
      if (lastKararRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [kararCache]);

  const handleSuggestedQuery = (q: string) => {
    setQuery(q);
    setCurrentPage(1);
    inputRef.current?.focus();
  };

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    resultsContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Trigger search when page changes (but not on initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (query.trim() && activeTab === "ictihat") {
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleNewSearch = useCallback(() => {
    setCurrentPage(1);
    // If page was already 1, effect won't fire, so call directly
    handleSearch();
  }, [handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNewSearch();
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
            {activeTab === "ictihat" && results && !loading && (
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
            {activeTab === "mevzuat" && mevzuatResults && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-[12px] text-[#5C5C5F] tabular-nums"
              >
                <span className="text-[#ECECEE] font-medium">{mevzuatResults.toplam}</span>
                <span>mevzuat</span>
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
                placeholder={query ? undefined : activeTab === "ai" ? "Hukuki sorunuzu sorun..." : activeTab === "mevzuat" ? "Mevzuat ara... (ör: iş güvenliği)" : typewriterText + "│"}
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
                  onClick={handleNewSearch}
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
                    className="w-full bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

            {/* Filter toggle — only for ictihat */}
            {activeTab === "ictihat" && (
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
            )}
          </div>
        </div>

        {/* Filter panel — ictihat only */}
        <AnimatePresence>
          {showFilters && activeTab === "ictihat" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="px-4 md:px-6 py-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  <FilterSelect value={mahkeme} onChange={(v) => { setMahkeme(v); setCurrentPage(1); }} options={MAHKEMELER} prefix="Mahkeme" />
                  <FilterSelect value={daire} onChange={(v) => { setDaire(v); setCurrentPage(1); }} options={DAIRELER} prefix="Daire" />
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBaslangic}
                      onChange={(e) => { setTarihBaslangic(e.target.value); setCurrentPage(1); }}
                      title="Başlangıç tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      value={tarihBitis}
                      onChange={(e) => { setTarihBitis(e.target.value); setCurrentPage(1); }}
                      title="Bitiş tarihi"
                      className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/40 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <FilterSelect value={kaynak} onChange={(v) => { setKaynak(v); setCurrentPage(1); }} options={KAYNAKLAR} prefix="Kaynak" />
                  <FilterSelect value={siralama} onChange={(v) => { setSiralama(v); setCurrentPage(1); }} options={SIRALAMALAR} prefix="Sıralama" />
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
                      setCurrentPage(1);
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

        {/* ═══════ ICTIHAT TAB ═══════ */}
        {activeTab === "ictihat" && (
          <>
            {/* Empty state */}
            {isEmpty && !mobileShowDetail && (
              <div className="flex-1 flex items-start justify-center pt-16 md:pt-24">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center px-4 max-w-lg"
                >
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
                ref={resultsContainerRef}
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
                          isBookmarked={bookmarks.has(result.karar_id)}
                          onToggleBookmark={toggleBookmark}
                        />
                      ))}
                    </motion.div>
                  )}

                  {/* Pagination bar */}
                  {hasResults && results.toplam_sayfa > 1 && (
                    <div className="flex items-center justify-between px-1 py-3 mt-2 border-t border-white/[0.06]">
                      <span className="text-[12px] text-[#5C5C5F] tabular-nums">
                        <span className="text-[#8B8B8E] font-medium">{results.toplam_bulunan}</span> sonuçtan sayfa{" "}
                        <span className="text-[#ECECEE] font-medium">{currentPage}</span> / {results.toplam_sayfa}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-[#8B8B8E] hover:text-[#ECECEE] hover:border-white/[0.10] hover:bg-white/[0.03]"
                        >
                          <ChevronIcon direction="left" />
                          Onceki
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= results.toplam_sayfa}
                          className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-[#8B8B8E] hover:text-[#ECECEE] hover:border-white/[0.10] hover:bg-white/[0.03]"
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
                  className={`flex-1 overflow-y-auto bg-[#0C0C0E] ${
                    mobileShowDetail ? "block" : "hidden md:block"
                  }`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
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
                            onClick={() => toggleBookmark(selectedResult.karar_id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] rounded-xl border transition-all ${
                              bookmarks.has(selectedResult.karar_id)
                                ? "text-[#6C6CFF] bg-[#6C6CFF]/[0.06] border-[#6C6CFF]/15 hover:bg-[#6C6CFF]/10"
                                : "text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border-white/[0.06] hover:border-white/[0.10]"
                            }`}
                          >
                            <BookmarkIcon filled={bookmarks.has(selectedResult.karar_id)} />
                            {bookmarks.has(selectedResult.karar_id) ? "Kaydedildi" : "Kaydet"}
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
                          <div className="prose prose-invert max-w-none">
                            {kararDetail.tam_metin ? formatLegalText(kararDetail.tam_metin) : (
                              <p className="text-[#5C5C5F] italic">Tam metin yüklenemedi. Özet gösteriliyor.</p>
                            )}
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
          </>
        )}

        {/* ═══════ MEVZUAT TAB ═══════ */}
        {activeTab === "mevzuat" && (
          <>
            {/* Mevzuat empty state */}
            {!loading && !mevzuatResults && !error && (
              <div className="flex-1 flex items-start justify-center pt-16 md:pt-24">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center px-4 max-w-lg"
                >
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 bg-[#A78BFA]/10 rounded-2xl blur-xl" />
                    <div className="relative w-16 h-16 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#A78BFA]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>

                  <h2 className="text-[16px] font-semibold text-[#ECECEE] mb-1.5">
                    Mevzuat Arama
                  </h2>
                  <p className="text-[13px] text-[#5C5C5F] mb-6 leading-relaxed">
                    Kanun, yönetmelik ve tüzük metinlerine erişin. Kanun numarası ile de arayabilirsiniz.
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
                    {["İş Kanunu", "Türk Borçlar Kanunu", "Türk Ceza Kanunu", "Medeni Kanun", "İdari Yargılama", "Vergi Usul"].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                        className="px-3 py-1.5 text-[12px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-[#A78BFA]/30 hover:text-[#ECECEE] hover:bg-[#A78BFA]/[0.04] transition-all duration-200"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            {/* Mevzuat loading */}
            {loading && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 md:p-4 space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} delay={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Mevzuat error */}
            {error && !loading && (
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#E5484D]/[0.06] border border-[#E5484D]/15 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#E5484D]">{error}</p>
                      <p className="text-[12px] text-[#E5484D]/60 mt-1">Farklı anahtar kelimeler deneyebilirsiniz.</p>
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
              </div>
            )}

            {/* Mevzuat results */}
            {!loading && !error && mevzuatResults && (
              <>
                {/* Left: list */}
                <div
                  className={`overflow-y-auto transition-all duration-200 ${
                    selectedMevzuat ? "hidden md:block md:w-[44%] md:shrink-0 md:border-r md:border-white/[0.06]" : "flex-1"
                  }`}
                >
                  <div className="p-3 md:p-4 space-y-2.5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <p className="text-[12px] text-[#5C5C5F] tabular-nums">
                        <span className="text-[#8B8B8E] font-medium">{mevzuatResults.toplam}</span> mevzuat bulundu
                      </p>
                    </div>

                    {mevzuatResults.sonuclar.length === 0 && (
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
                        <p className="text-[14px] text-[#8B8B8E] font-medium mb-1">Mevzuat bulunamadı</p>
                        <p className="text-[12px] text-[#5C5C5F] max-w-xs leading-relaxed">
                          Farklı anahtar kelimeler veya kanun numarası deneyin.
                        </p>
                      </motion.div>
                    )}

                    {mevzuatResults.sonuclar.length > 0 && (
                      <motion.div className="space-y-2" variants={listContainer} initial="hidden" animate="show">
                        {mevzuatResults.sonuclar.map((m, idx) => {
                          const isSelected = selectedMevzuat?.mevzuatNo === m.mevzuatNo && selectedMevzuat?.mevzuatAd === m.mevzuatAd;
                          return (
                            <motion.button
                              key={`${m.mevzuatNo}-${idx}`}
                              variants={listItem}
                              onClick={() => handleSelectMevzuat(m)}
                              className={`group w-full text-left bg-[#111113] border rounded-2xl p-4 transition-all duration-200 ${
                                isSelected
                                  ? "border-[#A78BFA]/30 bg-[#A78BFA]/[0.04] shadow-[0_0_0_1px_rgba(167,139,250,0.15)]"
                                  : "border-white/[0.06] hover:border-white/[0.10] hover:bg-[#141418]"
                              }`}
                            >
                              {/* Top row: type badge + number */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-[#A78BFA]/10 text-[#A78BFA]">
                                  {m.mevzuatTur || "Mevzuat"}
                                </span>
                                {m.mevzuatNo && (
                                  <span className="text-[11px] font-mono text-[#8B8B8E]">
                                    No: {m.mevzuatNo}
                                  </span>
                                )}
                                {m.mevzuatTertip && (
                                  <span className="text-[10px] text-[#5C5C5F]">
                                    {m.mevzuatTertip}. Tertip
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <p className="text-[13px] text-[#ECECEE] font-medium leading-relaxed mb-2 group-hover:text-white transition-colors">
                                {m.mevzuatAd}
                              </p>

                              {/* Bottom row: RG date + number */}
                              <div className="flex items-center gap-3 text-[11px] text-[#5C5C5F]">
                                {m.resmiGazeteTarihi && (
                                  <span className="flex items-center gap-1">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
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
                      className="flex-1 overflow-y-auto bg-[#0C0C0E]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-4 md:p-6 max-w-[760px]">
                        {/* Mobile back */}
                        <button
                          onClick={() => { setSelectedMevzuat(null); setMevzuatContent(null); }}
                          className="md:hidden flex items-center gap-1.5 text-[13px] text-[#8B8B8E] hover:text-[#ECECEE] mb-5 transition-colors"
                        >
                          <ArrowLeftIcon />
                          Sonuçlara Dön
                        </button>

                        {/* Header */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2.5 mb-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide uppercase bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                              {selectedMevzuat.mevzuatTur || "Mevzuat"}
                            </span>
                            {selectedMevzuat.mevzuatNo && (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-[#8B8B8E] border border-white/[0.06]">
                                No: {selectedMevzuat.mevzuatNo}
                              </span>
                            )}
                          </div>
                          <h2 className="text-[16px] font-semibold text-[#ECECEE] leading-relaxed mb-2">
                            {selectedMevzuat.mevzuatAd}
                          </h2>
                          <div className="flex items-center gap-3 text-[12px] text-[#5C5C5F]">
                            {selectedMevzuat.resmiGazeteTarihi && (
                              <span>RG Tarihi: {selectedMevzuat.resmiGazeteTarihi}</span>
                            )}
                            {selectedMevzuat.resmiGazeteSayisi && (
                              <span>RG Sayısı: {selectedMevzuat.resmiGazeteSayisi}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mb-6 flex-wrap">
                          {mevzuatContent && (
                            <button
                              onClick={() => handleCopyText(mevzuatContent.content)}
                              className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                            >
                              {copied ? <CheckIcon /> : <CopyIcon />}
                              {copied ? "Kopyalandı" : "Metni Kopyala"}
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectedMevzuat(null); setMevzuatContent(null); }}
                            className="ml-auto px-3 py-2 text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all hidden md:flex items-center gap-1.5"
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
                            {/* Search within text */}
                            <div className="relative">
                              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C5F]" />
                              <input
                                type="text"
                                value={mevzuatSearchText}
                                onChange={(e) => setMevzuatSearchText(e.target.value)}
                                placeholder="Metin içinde ara..."
                                className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#A78BFA]/40 transition-all"
                              />
                            </div>

                            {/* Full text */}
                            {mevzuatSearchText.trim().length >= 2 ? (
                              <div className="text-[14px] text-[#ECECEE]/90 leading-[1.8] space-y-4">
                                {mevzuatContent.content
                                  .split(/\n\n+/)
                                  .filter((p) => p.trim())
                                  .map((paragraph, i) => (
                                    <p key={i} className="whitespace-pre-wrap text-[13px] text-[#ECECEE]/90 leading-relaxed mb-3">
                                      {highlightText(paragraph.trim(), mevzuatSearchText)}
                                    </p>
                                  ))}
                              </div>
                            ) : (
                              <div className="prose prose-invert max-w-none">
                                {formatLegalText(mevzuatContent.content)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <p className="text-[13px] text-[#5C5C5F]">Mevzuat içeriği yüklenemedi.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    mevzuatResults.sonuclar.length > 0 && (
                      <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0C0C0E]">
                        <div className="text-center">
                          <div className="w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-[#5C5C5F]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                          <p className="text-[13px] text-[#5C5C5F]">
                            İçeriği görüntülemek için<br />
                            <span className="text-[#8B8B8E]">bir mevzuat seçin</span>
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}

        {/* ═══════ AI ASISTAN TAB ═══════ */}
        {activeTab === "ai" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* AI Header bar */}
            <div className="shrink-0 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 bg-[#6C6CFF]/10 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#6C6CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#ECECEE]">AI Hukuk Asistanı</h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#5C5C5F]">
                    <span>LLM: Claude</span>
                    <span className="text-[#3A3A3F]">·</span>
                    <span className="flex items-center gap-1">
                      Durum:
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          llmStatus === "ok" ? "bg-[#3DD68C]" : llmStatus === "error" ? "bg-[#E5484D]" : "bg-[#F5A623] animate-pulse"
                        }`}
                      />
                      <span className={llmStatus === "ok" ? "text-[#3DD68C]" : llmStatus === "error" ? "text-[#E5484D]" : "text-[#F5A623]"}>
                        {llmStatus === "ok" ? "Aktif" : llmStatus === "error" ? "Bağlantı yok" : "Kontrol ediliyor..."}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              {aiMessages.length > 0 && (
                <button
                  onClick={() => { setAiMessages([]); setAiInput(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Yeni Sohbet
                </button>
              )}
            </div>

            {/* Chat messages area */}
            <div ref={aiChatRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
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
                        <svg className="w-7 h-7 text-[#6C6CFF]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    </div>
                    <h2 className="text-[16px] font-semibold text-[#ECECEE] mb-1.5">
                      Hukuki Sorunuzu Sorun
                    </h2>
                    <p className="text-[13px] text-[#5C5C5F] mb-6 leading-relaxed">
                      AI asistan, içtihat veritabanındaki kararlara dayanarak sorularınızı yanıtlar. Kaynakları doğrulanır.
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
                          onClick={() => { setAiInput(q); aiInputRef.current?.focus(); }}
                          className="px-3 py-1.5 text-[12px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-[#6C6CFF]/30 hover:text-[#ECECEE] hover:bg-[#6C6CFF]/[0.04] transition-all duration-200 text-left"
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
                    {/* Message content */}
                    <div className={`text-[14px] leading-[1.7] whitespace-pre-wrap ${
                      msg.role === "user" ? "text-[#ECECEE]" : "text-[#ECECEE]/90"
                    }`}>
                      {msg.content}
                      {/* Streaming cursor */}
                      {msg.role === "assistant" && aiStreaming && idx === aiMessages.length - 1 && (
                        <span className="inline-block w-2 h-4 bg-[#6C6CFF] animate-pulse ml-0.5 rounded-sm align-middle" />
                      )}
                    </div>

                    {/* Sources */}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <p className="text-[11px] font-semibold text-[#5C5C5F] uppercase tracking-wider mb-2">Kaynaklar</p>
                        <div className="space-y-1.5">
                          {msg.sources.map((s, si) => {
                            const court = getCourtStyle(s.mahkeme);
                            return (
                              <button
                                key={si}
                                onClick={() => {
                                  setActiveTab("ictihat");
                                  setQuery(`${s.esas_no}`);
                                }}
                                className="flex items-center gap-2 w-full text-left group/src"
                              >
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${court.bg} ${court.text}`}>
                                  {court.label || s.mahkeme}
                                </span>
                                <span className="text-[12px] text-[#6C6CFF] group-hover/src:text-[#8B8BFF] transition-colors truncate">
                                  {s.esas_no} E. / {s.karar_no} K.
                                </span>
                                {s.tarih && (
                                  <span className="text-[10px] text-[#5C5C5F] ml-auto shrink-0">{s.tarih}</span>
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
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#3DD68C]/10 text-[#3DD68C]">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {msg.post_citation_check.verified_count}/{msg.post_citation_check.citations_found} atıf doğrulandı
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#FFB224]/10 text-[#FFB224]">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {msg.post_citation_check.verified_count}/{msg.post_citation_check.citations_found} atıf doğrulandı
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warnings */}
                    {msg.role === "assistant" && msg.warnings && msg.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.warnings.map((w, wi) => (
                          <p key={wi} className="text-[11px] text-[#FFB224]/80 flex items-start gap-1.5">
                            <svg className="w-3 h-3 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {w}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-[#6C6CFF]/40 text-right" : "text-[#5C5C5F]/60"}`}>
                      {msg.timestamp.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Streaming placeholder when no assistant message yet */}
              {aiStreaming && (aiMessages.length === 0 || aiMessages[aiMessages.length - 1]?.role === "user") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-[#111113] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <div className="w-2 h-2 bg-[#6C6CFF] rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
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
                      if (aiInput.trim() && !aiStreaming) {
                        handleAIAsk();
                      }
                    }
                  }}
                  placeholder="Takip sorusu sorun..."
                  disabled={aiStreaming}
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-4 pr-14 py-3.5 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#13131A] transition-all disabled:opacity-50"
                />
                <button
                  onClick={() => {
                    if (aiInput.trim() && !aiStreaming) {
                      handleAIAsk();
                    }
                  }}
                  disabled={!aiInput.trim() || aiStreaming}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-white transition-all duration-150 active:scale-[0.95]"
                >
                  {aiStreaming ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-[#5C5C5F]/60 mt-1.5 text-center">
                AI yanıtları hukuki tavsiye niteliği taşımaz. Kaynakları her zaman doğrulayın.
              </p>
            </div>
          </div>
        )}

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