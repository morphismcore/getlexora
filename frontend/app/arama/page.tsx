"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CaseItem {
  id: string;
  title: string;
  court: string | null;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  closed: "Kapalı",
  pending: "Beklemede",
  archived: "Arşiv",
};

const MAHKEME_VALUE_MAP: Record<string, string> = {
  Yargıtay: "yargitay",
  Danıştay: "danistay",
  "Anayasa Mahkemesi": "aym",
  "Bölge Adliye Mahkemesi": "bam",
  "AYM": "aym",
  "AİHM": "aihm",
};

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
      <span key={i} className="bg-[#6C6CFF]/10 text-[#6C6CFF] px-0.5 rounded-sm">
        {part}
      </span>
    ) : (
      part
    )
  );
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
];
const KAYNAKLAR = ["Tümü", "Bedesten", "AYM", "AİHM"];
const SIRALAMALAR = ["Alaka düzeyi", "Tarih (yeni→eski)", "Tarih (eski→yeni)"];

function ShimmerBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1A1F] rounded ${className}`} style={style}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-[18px] w-16" />
        <ShimmerBlock className="h-[14px] w-24" />
      </div>
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-[13px] w-20" />
        <ShimmerBlock className="h-[13px] w-20" />
        <ShimmerBlock className="h-[13px] w-14 ml-auto" />
      </div>
      <div className="space-y-1.5">
        <ShimmerBlock className="h-[13px] w-full" />
        <ShimmerBlock className="h-[13px] w-4/5" />
      </div>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="space-y-4">
      <ShimmerBlock className="h-6 w-48" />
      <div className="flex gap-2">
        <ShimmerBlock className="h-5 w-20" />
        <ShimmerBlock className="h-5 w-32" />
      </div>
      <div className="space-y-2 mt-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[14px]" style={{ width: `${60 + Math.random() * 40}%` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const listItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
} as const;

export default function AramaPage() {
  const [query, setQuery] = useState("");
  const [mahkeme, setMahkeme] = useState("Tümü");
  const [daire, setDaire] = useState("Tümü");
  const [tarihBaslangic, setTarihBaslangic] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [tarihBitis, setTarihBitis] = useState("");
  const [kaynak, setKaynak] = useState("Tümü");
  const [siralama, setSiralama] = useState("Alaka düzeyi");

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const [selectedResult, setSelectedResult] = useState<IctihatResult | null>(null);
  const [kararDetail, setKararDetail] = useState<KararDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Davaya Kaydet state
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_search_history");
      if (saved) try { setSearchHistory(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Close case dropdown on outside click
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


  const fetchCases = useCallback(async () => {
    const token = localStorage.getItem("lexora_token");
    if (!token) {
      setCasesError("Giriş yapın");
      return;
    }
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: query.trim(),
          search_type: "ictihat",
          result_count: results?.toplam_bulunan || 0,
        }),
      });
      if (!res.ok) throw new Error("Kaydetme başarısız");
      setToast("Arama kaydedildi");
    } catch {
      setToast("Kaydetme başarısız oldu");
    }
    setShowCaseDropdown(false);
  }, [query, results]);

  const handleCopyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        throw new Error(`Arama başarısız oldu. Lütfen tekrar deneyin.`);
      }
      const data: SearchResponse = await res.json();
      setResults(data);

      // Arama geçmişine kaydet
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
  }, [query, mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama]);

  const handleSelectResult = useCallback(async (result: IctihatResult) => {
    setSelectedResult(result);
    setMobileShowDetail(true);
    setDetailLoading(true);
    setKararDetail(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/karar/${result.karar_id}`);
      if (!res.ok) throw new Error("Karar yüklenemedi");
      const raw = await res.json();
      setKararDetail({
        id: raw.document_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || (raw.content || "").slice(0, 500),
        tam_metin: raw.content || "",
      });
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
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg animate-fade-in">
          {toast}
        </div>
      )}
      {/* Header / Search */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#09090B] px-4 md:px-5 pt-14 md:pt-4 pb-4 space-y-3">
        <div>
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">İçtihat Arama</h1>
          <p className="text-[12px] text-[#5C5C5F] mt-0.5">
            Doğal dil ile arama yapabilirsiniz. Örneğin: &quot;işe iade savunma alınmadan fesih&quot; veya &quot;kıdem tazminatı hesaplama yöntemi&quot;
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C5F]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="İçtihat arayın... (ör: işe iade savunma alınmadan fesih)"
              className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
            />
            {/* Arama geçmişi dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#16161A] border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F]">Son Aramalar</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchHistory([]); localStorage.removeItem("lexora_search_history"); setShowHistory(false); }}
                    className="text-[10px] text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                  >
                    Temizle
                  </button>
                </div>
                {searchHistory.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-center hover:bg-[#6C6CFF]/10 transition-colors">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setQuery(h); setShowHistory(false); }}
                      className="flex-1 text-left px-3 py-2 text-[13px] text-[#8B8B8E] hover:text-[#ECECEE] truncate"
                    >
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
                      className="px-2 py-2 text-[#5C5C5F] hover:text-[#E5484D] transition-colors shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[13px] font-medium text-white transition-colors duration-150"
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

        {/* Filter toggle */}
        <div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
            {showFilters ? "Filtreleri Gizle" : "Filtrele"}
            {(mahkeme !== "Tümü" || daire !== "Tümü" || tarihBaslangic || tarihBitis || kaynak !== "Tümü" || siralama !== "Alaka düzeyi") && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#6C6CFF]" />
            )}
          </button>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2 p-3 bg-[#111113] border border-white/[0.06] rounded-xl">
              <select value={mahkeme} onChange={(e) => setMahkeme(e.target.value)} className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors">
                {MAHKEMELER.map((m) => (<option key={m} value={m}>{m === "Tümü" ? "Mahkeme: Tümü" : m}</option>))}
              </select>
              <select value={daire} onChange={(e) => setDaire(e.target.value)} className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors">
                {DAIRELER.map((d) => (<option key={d} value={d}>{d === "Tümü" ? "Daire: Tümü" : d}</option>))}
              </select>
              <input type="date" value={tarihBaslangic} onChange={(e) => setTarihBaslangic(e.target.value)} title="Başlangıç tarihi" className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors [color-scheme:dark]" />
              <input type="date" value={tarihBitis} onChange={(e) => setTarihBitis(e.target.value)} title="Bitiş tarihi" className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors [color-scheme:dark]" />
              <select value={kaynak} onChange={(e) => setKaynak(e.target.value)} className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors">
                {KAYNAKLAR.map((k) => (<option key={k} value={k}>{k === "Tümü" ? "Kaynak: Tümü" : k}</option>))}
              </select>
              <select value={siralama} onChange={(e) => setSiralama(e.target.value)} className="bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#8B8B8E] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors">
                {SIRALAMALAR.map((s) => (<option key={s} value={s}>{s === "Alaka düzeyi" ? "Sıralama: Alaka" : s}</option>))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Empty state — sonuç yokken tüm alanı kaplar, tam ortada */}
        {!loading && !results && !error && !mobileShowDetail && (
          <div className="flex-1 flex items-start justify-center pt-24">
            <div className="text-center px-4">
              <svg className="w-12 h-12 text-[#5C5C5F]/30 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-[15px] font-medium text-[#8B8B8E]">Arama yapmak için yukarıdaki alanı kullanın</p>
              <p className="text-[13px] text-[#5C5C5F] mt-2 max-w-sm mx-auto">
                Doğal dil ile arama yapabilirsiniz. Örneğin: &quot;işe iade savunma alınmadan fesih&quot; veya &quot;kıdem tazminatı hesaplama yöntemi&quot;
              </p>
            </div>
          </div>
        )}

        {/* Left panel: results — sadece sonuç/loading/error varken göster */}
        {(loading || results || error) && (
        <div
          className={`overflow-y-auto transition-all duration-200 ${
            mobileShowDetail ? "hidden md:block" : "flex-1 md:flex-none"
          } ${
            selectedResult ? "md:w-[45%] md:shrink-0 md:border-r md:border-white/[0.06]" : "flex-1"
          }`}
        >
          <div className="p-3 space-y-2">
            {/* Status */}
            {results && !loading && (
              <div className="flex items-center justify-between px-1">
                <p className="text-[12px] text-[#5C5C5F]">
                  {results.toplam_bulunan} sonuç
                  {results.sure_ms < 1000
                    ? ` (${Math.round(results.sure_ms)} ms)`
                    : ` (${(results.sure_ms / 1000).toFixed(1)}s)`}
                </p>
                {results.sonuclar.length > 0 && (
                  <button
                    onClick={() => {
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
                    }}
                    className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
                  >
                    Sonuçları İndir
                  </button>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-4 text-[13px] text-[#E5484D]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{error}</p>
                    <p className="text-[12px] text-[#E5484D]/70 mt-1">Farklı anahtar kelimeler deneyebilir veya filtreleri değiştirebilirsiniz.</p>
                  </div>
                  <button onClick={() => setError(null)} className="shrink-0 text-[#E5484D]/50 hover:text-[#E5484D] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <button
                  onClick={handleSearch}
                  className="mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-[#E5484D] hover:bg-[#D13438] rounded-lg transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            )}

            {/* Results */}
            {results && results.sonuclar.length > 0 && (
              <motion.div className="space-y-2" variants={listContainer} initial="hidden" animate="show">
                {results.sonuclar.map((result) => (
                  <motion.button
                    key={result.karar_id}
                    variants={listItem}
                    onClick={() => handleSelectResult(result)}
                    className={`w-full text-left bg-[#111113] border rounded-xl p-4 transition-all duration-150 hover:-translate-y-px ${
                      selectedResult?.karar_id === result.karar_id
                        ? "border-[#6C6CFF]/30 bg-[#6C6CFF]/[0.04]"
                        : "border-white/[0.06] hover:border-white/[0.10] hover:bg-[#1A1A1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        result.mahkeme === "Yargıtay" || result.mahkeme === "yargitay" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" :
                        result.mahkeme === "Danıştay" || result.mahkeme === "danistay" ? "bg-[#A78BFA]/10 text-[#A78BFA]" :
                        result.mahkeme === "Anayasa Mahkemesi" || result.mahkeme === "aym" ? "bg-[#E5484D]/10 text-[#E5484D]" :
                        result.mahkeme === "aihm" ? "bg-[#3DD68C]/10 text-[#3DD68C]" :
                        result.mahkeme?.includes("Bölge") || result.mahkeme === "bam" ? "bg-[#FFB224]/10 text-[#FFB224]" :
                        "bg-white/[0.06] text-[#8B8B8E]"
                      }`}>
                        {result.mahkeme === "yargitay" ? "Yargıtay" :
                         result.mahkeme === "danistay" ? "Danıştay" :
                         result.mahkeme === "aym" ? "AYM" :
                         result.mahkeme === "aihm" ? "AİHM" :
                         result.mahkeme === "bam" ? "BAM" :
                         result.mahkeme}
                      </span>
                      {result.daire && <span className="text-[11px] text-[#8B8B8E]">{result.daire}</span>}
                      {(result.mahkeme === "aym" || result.kaynak === "aym") && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#E5484D]/10 text-[#E5484D]">AYM</span>
                      )}
                      {(result.mahkeme === "aihm" || result.kaynak === "aihm") && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#3DD68C]/10 text-[#3DD68C]">AİHM</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] mb-1.5">
                      <span className="font-mono text-[#ECECEE]">E. {result.esas_no}</span>
                      <span className="font-mono text-[#ECECEE]">K. {result.karar_no}</span>
                      <span className="ml-auto text-[#5C5C5F]">{result.tarih}</span>
                    </div>
                    <p className="text-[13px] text-[#8B8B8E] line-clamp-3 leading-relaxed">
                      {highlightText(result.ozet, query)}
                    </p>
                    {result.relevance_score !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6C6CFF]/40 rounded-full"
                            style={{ width: `${result.relevance_score * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#5C5C5F]">
                          %{Math.round(result.relevance_score * 100)}
                        </span>
                      </div>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* No results */}
            {results && results.sonuclar.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-10 h-10 text-[#5C5C5F]/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[13px] text-[#8B8B8E] font-medium mb-1">Sonuç bulunamadı</p>
                <p className="text-[12px] text-[#5C5C5F] max-w-xs leading-relaxed">
                  Farklı anahtar kelimeler deneyin veya filtrelerinizi genişletin.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Right panel: document viewer */}
        <AnimatePresence mode="wait">
          {selectedResult ? (
            <motion.div
              key="detail"
              className="flex-1 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-4 md:p-5">
                {/* Mobile back button */}
                <button
                  onClick={() => {
                    setMobileShowDetail(false);
                    setSelectedResult(null);
                    setKararDetail(null);
                  }}
                  className="md:hidden flex items-center gap-1.5 text-[13px] text-[#8B8B8E] hover:text-[#ECECEE] mb-4 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5m7-7l-7 7 7 7" />
                  </svg>
                  Geri
                </button>
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#6C6CFF]/10 text-[#6C6CFF] border border-[#6C6CFF]/20">
                        {selectedResult.mahkeme}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-white/[0.04] text-[#8B8B8E]">
                        {selectedResult.daire}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-[#8B8B8E]">
                      <span className="font-mono text-[#ECECEE]">E. {selectedResult.esas_no}</span>
                      <span className="text-[#5C5C5F]">/</span>
                      <span className="font-mono text-[#ECECEE]">K. {selectedResult.karar_no}</span>
                      <span className="text-[#5C5C5F]">/</span>
                      <span className="text-[#5C5C5F]">{selectedResult.tarih}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {kararDetail && (
                      <>
                        <button
                          onClick={() => handleCopyText(kararDetail.tam_metin)}
                          className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-white/[0.10] transition-all duration-150"
                        >
                          {copied ? "Kopyalandı" : "Kopyala"}
                        </button>
                        <button
                          onClick={() => {
                            const ref = `${selectedResult.mahkeme} ${selectedResult.daire}, ${selectedResult.esas_no} E., ${selectedResult.karar_no} K.`;
                            localStorage.setItem("lexora_cite_to_dilekce", ref);
                            window.open("/dilekce", "_blank");
                          }}
                          className="px-2.5 py-1.5 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] bg-[#6C6CFF]/10 border border-[#6C6CFF]/20 rounded-lg hover:border-[#6C6CFF]/40 transition-all duration-150"
                        >
                          Dilekçeye Ekle
                        </button>
                        <button
                          onClick={() => {
                            const text = kararDetail.ozet || kararDetail.tam_metin.slice(0, 1000);
                            localStorage.setItem("lexora_verify_text", text);
                            window.open("/dogrulama", "_blank");
                          }}
                          className="px-2.5 py-1.5 text-[12px] text-[#3DD68C] hover:text-[#5DE8A8] bg-[#3DD68C]/10 border border-[#3DD68C]/20 rounded-lg hover:border-[#3DD68C]/40 transition-all duration-150"
                        >
                          Doğrula
                        </button>
                        <div className="relative" ref={caseDropdownRef}>
                          <button
                            onClick={() => {
                              if (!showCaseDropdown) {
                                setShowCaseDropdown(true);
                                fetchCases();
                              } else {
                                setShowCaseDropdown(false);
                              }
                            }}
                            className="px-2.5 py-1.5 text-[12px] text-[#FFB224] hover:text-[#FFC656] bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-lg hover:border-[#FFB224]/40 transition-all duration-150"
                          >
                            Davaya Kaydet
                          </button>
                          {showCaseDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-72 bg-[#16161A] border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                              {casesLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <div className="w-4 h-4 border-2 border-[#FFB224]/30 border-t-[#FFB224] rounded-full animate-spin" />
                                </div>
                              )}
                              {casesError && (
                                <div className="px-3 py-3 text-[12px] text-[#E5484D]">{casesError}</div>
                              )}
                              {!casesLoading && !casesError && cases.length === 0 && (
                                <div className="px-3 py-3 text-[12px] text-[#5C5C5F]">Henüz dava yok</div>
                              )}
                              {!casesLoading && !casesError && cases.length > 0 && (
                                <>
                                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F] border-b border-white/[0.06]">
                                    Dava Seçin
                                  </div>
                                  {cases.map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => handleSaveToCase(c.id)}
                                      className="w-full text-left px-3 py-2 hover:bg-[#FFB224]/10 transition-colors border-b border-white/[0.04] last:border-0"
                                    >
                                      <div className="text-[13px] text-[#ECECEE] truncate">{c.title}</div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {c.court && (
                                          <span className="text-[11px] text-[#5C5C5F]">{c.court}</span>
                                        )}
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${
                                          c.status === "active"
                                            ? "bg-[#3DD68C]/10 text-[#3DD68C]"
                                            : c.status === "closed"
                                            ? "bg-[#E5484D]/10 text-[#E5484D]"
                                            : "bg-[#FFB224]/10 text-[#FFB224]"
                                        }`}>
                                          {STATUS_LABELS[c.status] || c.status}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSelectedResult(null);
                        setKararDetail(null);
                      }}
                      className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-white/[0.10] transition-all duration-150"
                    >
                      Kapat
                    </button>
                  </div>
                </div>

                {/* Body */}
                {detailLoading ? (
                  <SkeletonDetail />
                ) : kararDetail ? (
                  <div className="max-w-[680px]">
                    {/* Özet */}
                    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 mb-5">
                      <h3 className="text-[12px] font-medium text-[#8B8B8E] mb-2">Özet</h3>
                      <p className="text-[13px] text-[#ECECEE] leading-relaxed">
                        {highlightText(kararDetail.ozet, query)}
                      </p>
                    </div>

                    {/* Tam Metin */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[12px] font-medium text-[#8B8B8E]">Karar Metni</h3>
                      </div>
                      <div className="text-[14px] text-[#ECECEE] leading-relaxed space-y-4">
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
            results &&
            results.sonuclar.length > 0 && (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <div className="text-center">
                  <svg className="w-10 h-10 text-[#5C5C5F]/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[13px] text-[#5C5C5F]">Karar seçin</p>
                </div>
              </div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#16161A] border border-[#FFB224]/30 rounded-lg shadow-xl"
          >
            <span className="text-[13px] text-[#FFB224]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
