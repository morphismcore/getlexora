"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MevzuatResult {
  mevzuat_id: string;
  kanun_adi: string;
  kanun_no: number;
  tur: string;
  resmi_gazete_tarihi: string | null;
  resmi_gazete_sayisi: string | null;
}

interface MevzuatResponse {
  sonuclar: MevzuatResult[];
  toplam: number;
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1A1F] rounded ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-[18px] w-16" />
        <ShimmerBlock className="h-[14px] w-20" />
      </div>
      <ShimmerBlock className="h-[16px] w-3/4" />
      <ShimmerBlock className="h-[13px] w-1/2" />
    </div>
  );
}

function getTurBadgeColor(tur: string): string {
  switch (tur.toLowerCase()) {
    case "kanun":
      return "bg-[#6C6CFF]/10 text-[#6C6CFF]";
    case "khk":
    case "kanun hükmünde kararname":
      return "bg-[#A78BFA]/10 text-[#A78BFA]";
    case "yönetmelik":
      return "bg-[#3DD68C]/10 text-[#3DD68C]";
    case "tüzük":
      return "bg-[#FFB224]/10 text-[#FFB224]";
    default:
      return "bg-white/[0.04] text-[#8B8B8E]";
  }
}

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const listItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function MevzuatPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MevzuatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMevzuat, setSelectedMevzuat] = useState<MevzuatResult | null>(null);
  const [mevzuatContent, setMevzuatContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const handleViewContent = async (item: MevzuatResult) => {
    setSelectedMevzuat(item);
    setContentLoading(true);
    setMevzuatContent(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat/${item.mevzuat_id}`);
      if (!res.ok) throw new Error("İçerik yüklenemedi");
      const data = await res.json();
      setMevzuatContent(data.content || "İçerik bulunamadı.");
    } catch {
      setMevzuatContent("Mevzuat içeriği yüklenirken hata oluştu.");
    } finally {
      setContentLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const q = query.trim();
      const maddeMatch = q.match(/(\d+)\s*(?:madde|md\.?)\s*(\d+)/i);
      const isNumber = /^\d+$/.test(q);
      let body: Record<string, string>;
      if (maddeMatch) {
        body = { query: "", kanun_no: maddeMatch[1], madde_no: maddeMatch[2] };
      } else if (isNumber) {
        body = { query: "", kanun_no: q };
      } else {
        body = { query: q };
      }

      const res = await fetch(`${API_URL}/api/v1/search/mevzuat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Arama başarısız (${res.status})`);
      const data: MevzuatResponse = await res.json();
      setResults(data);
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
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">Mevzuat</h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">
          Kanun, yönetmelik ve diğer mevzuat arama
        </p>
      </div>

      {/* Search */}
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
            placeholder="Kanun adı, numarası veya madde arayın (ör: 4857, 4857 madde 18)"
            className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
          />
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

      {/* Status */}
      {results && !loading && (
        <p className="text-[12px] text-[#5C5C5F]">
          {results.toplam} sonuç bulundu
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
          {error}
          <button
            onClick={handleSearch}
            className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !results && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-10 h-10 text-[#5C5C5F]/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-[13px] text-[#8B8B8E]">Kanun adı veya numarası girin</p>
          <p className="text-[12px] text-[#5C5C5F] mt-1">
            Örnek: &quot;İş Kanunu&quot;, &quot;4857&quot;, &quot;Türk Ticaret Kanunu&quot;
          </p>
        </div>
      )}

      {/* Results */}
      {results && results.sonuclar.length > 0 && (
        <motion.div className="space-y-2" variants={listContainer} initial="hidden" animate="show">
          {results.sonuclar.map((result) => (
            <motion.div
              key={result.mevzuat_id}
              variants={listItem}
              onClick={() => handleViewContent(result)}
              className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] hover:bg-[#1A1A1F] transition-all duration-150 hover:-translate-y-px cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${getTurBadgeColor(result.tur)}`}>
                  {result.tur}
                </span>
                {result.kanun_no != null && (
                  <span className="text-[12px] font-mono text-[#8B8B8E]">No: {result.kanun_no}</span>
                )}
              </div>

              <h3 className="text-[14px] font-semibold text-[#ECECEE] mb-2">
                {result.kanun_adi}
              </h3>

              <div className="flex items-center gap-4 text-[12px] text-[#5C5C5F]">
                {result.resmi_gazete_tarihi && (
                  <span>RG: {result.resmi_gazete_tarihi}</span>
                )}
                {result.resmi_gazete_sayisi && (
                  <span>Sayı: {result.resmi_gazete_sayisi}</span>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Mevzuat içerik detay paneli */}
      {selectedMevzuat && (
        <div className="bg-[#111113] border border-[#6C6CFF]/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${getTurBadgeColor(selectedMevzuat.tur)}`}>
                {selectedMevzuat.tur}
              </span>
              <h3 className="text-[14px] font-semibold text-[#ECECEE] mt-1">{selectedMevzuat.kanun_adi}</h3>
              {selectedMevzuat.kanun_no && <p className="text-[12px] text-[#5C5C5F]">No: {selectedMevzuat.kanun_no}</p>}
            </div>
            <button onClick={() => { setSelectedMevzuat(null); setMevzuatContent(null); }} className="text-[12px] text-[#5C5C5F] hover:text-[#ECECEE]">Kapat</button>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            {contentLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <div className="w-4 h-4 border-2 border-[#6C6CFF]/30 border-t-[#6C6CFF] rounded-full animate-spin" />
                <span className="text-[12px] text-[#5C5C5F]">Mevzuat metni yükleniyor...</span>
              </div>
            ) : mevzuatContent ? (
              <div className="max-h-[500px] overflow-y-auto">
                <pre className="text-[13px] text-[#ECECEE] leading-relaxed whitespace-pre-wrap font-sans">{mevzuatContent}</pre>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* No results */}
      {results && results.sonuclar.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[13px] text-[#8B8B8E]">Sonuç bulunamadı</p>
          <p className="text-[12px] text-[#5C5C5F] mt-1">
            Farklı anahtar kelimeler veya kanun numarası deneyin
          </p>
        </div>
      )}
    </div>
  );
}
