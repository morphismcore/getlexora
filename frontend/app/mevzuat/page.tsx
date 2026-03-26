"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MevzuatResult { mevzuat_id: string; kanun_adi: string; kanun_no: number; tur: string; resmi_gazete_tarihi: string | null; resmi_gazete_sayisi: string | null; }
interface MevzuatResponse { sonuclar: MevzuatResult[]; toplam: number; }

const POPULAR_LAWS = [
  { no: "4857", name: "Is Kanunu", color: "#6C6CFF" },
  { no: "5237", name: "Turk Ceza Kanunu", color: "#E5484D" },
  { no: "6098", name: "Turk Borclar Kanunu", color: "#3DD68C" },
  { no: "6100", name: "Hukuk Muhakemeleri K.", color: "#A78BFA" },
  { no: "5271", name: "Ceza Muhakemesi K.", color: "#FFB224" },
  { no: "2004", name: "Icra Iflas Kanunu", color: "#E5484D" },
  { no: "6102", name: "Turk Ticaret Kanunu", color: "#6C6CFF" },
  { no: "2709", name: "Anayasa", color: "#FFB224" },
];

function getTurBadge(tur: string) {
  switch (tur.toLowerCase()) {
    case "kanun": return "bg-[#6C6CFF]/10 text-[#6C6CFF]";
    case "khk": case "kanun hukmunde kararname": return "bg-[#A78BFA]/10 text-[#A78BFA]";
    case "yonetmelik": return "bg-[#3DD68C]/10 text-[#3DD68C]";
    default: return "bg-white/[0.04] text-[#8B8B8E]";
  }
}

export default function MevzuatPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MevzuatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMevzuat, setSelectedMevzuat] = useState<MevzuatResult | null>(null);
  const [mevzuatContent, setMevzuatContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;
    setLoading(true); setError(null); setResults(null); setSelectedMevzuat(null);
    try {
      const isNumber = /^\d+$/.test(q);
      const maddeMatch = q.match(/(\d+)\s*(?:madde|md\.?)\s*(\d+)/i);
      let body: Record<string, string>;
      if (maddeMatch) body = { query: "", kanun_no: maddeMatch[1], madde_no: maddeMatch[2] };
      else if (isNumber) body = { query: "", kanun_no: q };
      else body = { query: q };

      const res = await fetch(`${API_URL}/api/v1/search/mevzuat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Arama basarisiz (${res.status})`);
      setResults(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata olustu");
    } finally { setLoading(false); }
  }, [query]);

  const handleViewContent = async (item: MevzuatResult) => {
    setSelectedMevzuat(item); setContentLoading(true); setMevzuatContent(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat/${item.mevzuat_id}`);
      if (!res.ok) throw new Error("Icerik yuklenemedi");
      const data = await res.json();
      setMevzuatContent(data.content || "Icerik bulunamadi.");
    } catch { setMevzuatContent("Mevzuat icerigi yuklenirken hata olustu."); }
    finally { setContentLoading(false); }
  };

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Mevzuat</h1>
        <p className="text-[15px] text-[#5C5C5F] mt-1">Kanun, yonetmelik ve diger mevzuat arama</p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C5C5F]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Kanun adi, numarasi veya madde arayin (or: 4857, is kanunu, 4857 madde 18)"
          className="w-full bg-[#111113] border border-white/[0.06] rounded-2xl pl-12 pr-24 py-4 text-[17px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#16161A] transition-all duration-200"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[15px] font-medium text-white transition-all"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Ara"}
        </button>
      </div>

      {/* Popular Laws */}
      {!results && !loading && !error && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-semibold text-[#8B8B8E]">Sik Aranan Kanunlar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {POPULAR_LAWS.map((law, i) => (
              <motion.button
                key={law.no}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => { setQuery(law.no); handleSearch(law.no); }}
                className="text-left bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] hover:bg-[#16161A] transition-all group"
              >
                <span className="text-[20px] font-bold tabular-nums" style={{ color: law.color }}>{law.no}</span>
                <p className="text-[14px] text-[#8B8B8E] mt-1 group-hover:text-[#ECECEE] transition-colors">{law.name}</p>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      {results && !loading && (
        <p className="text-[14px] text-[#5C5C5F]">{results.toplam} sonuc bulundu</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">{[1,2,3,4].map(i => (
          <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-[#1A1A1F] rounded w-1/4 mb-2" /><div className="h-5 bg-[#1A1A1F] rounded w-3/4 mb-2" /><div className="h-3 bg-[#1A1A1F] rounded w-1/2" />
          </div>
        ))}</div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-4 text-[15px] text-[#E5484D]">
          {error}
          <button onClick={() => handleSearch()} className="block mt-2 text-[14px] underline underline-offset-2 hover:text-[#E5484D]">Tekrar Dene</button>
        </div>
      )}

      {/* Results + Content Side Panel */}
      {results && results.sonuclar.length > 0 && (
        <div className="flex gap-6">
          {/* Result List */}
          <div className={`space-y-2 ${selectedMevzuat ? "w-2/5 hidden md:block" : "w-full"}`}>
            {results.sonuclar.map((r, i) => (
              <motion.div
                key={r.mevzuat_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleViewContent(r)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedMevzuat?.mevzuat_id === r.mevzuat_id
                    ? "bg-[#6C6CFF]/[0.04] border-[#6C6CFF]/30"
                    : "bg-[#111113] border-white/[0.06] hover:border-white/[0.10] hover:bg-[#16161A]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium uppercase ${getTurBadge(r.tur)}`}>{r.tur}</span>
                  {r.kanun_no && <span className="text-[14px] font-mono text-[#8B8B8E]">No: {r.kanun_no}</span>}
                </div>
                <h3 className="text-[16px] font-semibold text-[#ECECEE]">{r.kanun_adi}</h3>
                <div className="flex items-center gap-4 mt-2 text-[13px] text-[#5C5C5F]">
                  {r.resmi_gazete_tarihi && <span>RG: {r.resmi_gazete_tarihi}</span>}
                  {r.resmi_gazete_sayisi && <span>Sayi: {r.resmi_gazete_sayisi}</span>}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Content Panel */}
          <AnimatePresence>
            {selectedMevzuat && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 bg-[#111113] border border-white/[0.06] rounded-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                  <div>
                    <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium uppercase ${getTurBadge(selectedMevzuat.tur)}`}>{selectedMevzuat.tur}</span>
                    <h3 className="text-[17px] font-semibold text-[#ECECEE] mt-1">{selectedMevzuat.kanun_adi}</h3>
                    {selectedMevzuat.kanun_no && <p className="text-[14px] text-[#5C5C5F]">No: {selectedMevzuat.kanun_no}</p>}
                  </div>
                  <button onClick={() => { setSelectedMevzuat(null); setMevzuatContent(null); }} className="p-1.5 text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-5 max-h-[600px] overflow-y-auto">
                  {contentLoading ? (
                    <div className="flex items-center gap-2 py-12 justify-center">
                      <div className="w-4 h-4 border-2 border-[#6C6CFF]/30 border-t-[#6C6CFF] rounded-full animate-spin" />
                      <span className="text-[14px] text-[#5C5C5F]">Metin yukleniyor...</span>
                    </div>
                  ) : mevzuatContent ? (
                    <pre className="text-[15px] text-[#ECECEE] leading-[1.8] whitespace-pre-wrap font-[family-name:var(--font-serif)]">{mevzuatContent}</pre>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* No results */}
      {results && results.sonuclar.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[16px] text-[#8B8B8E]">Sonuc bulunamadi</p>
          <p className="text-[14px] text-[#5C5C5F] mt-1">Farkli anahtar kelimeler veya kanun numarasi deneyin</p>
        </div>
      )}
    </div>
  );
}