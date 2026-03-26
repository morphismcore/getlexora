"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";

import type { VerifyResponse } from "./_components/types";
import { EXAMPLE_TEXT } from "./_components/types";
import { SkeletonResults, SummaryStats, ConfidenceBar, CitationCard } from "./_components/ui-parts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };

export default function DogrulamaPage() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const fromSearch = localStorage.getItem("lexora_verify_text");
      if (fromSearch) { setText(fromSearch); localStorage.removeItem("lexora_verify_text"); }
    }
  }, []);

  const handleVerify = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResults(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_URL}/api/v1/search/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }), signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Doğrulama başarısız (${res.status})`);
      const data: VerifyResponse = await res.json();
      setResults(data);
      setToast(`${data.verified} atıf doğrulandı, ${data.not_found} bulunamadı`);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      else setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
    } finally { setLoading(false); }
  }, [text]);

  const handleClear = useCallback(() => { setText(""); setResults(null); setError(null); }, []);
  const handleLoadExample = useCallback(() => { setText(EXAMPLE_TEXT); setResults(null); setError(null); }, []);

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {toast && (
        <div role="alert" aria-live="polite" className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg animate-fade-in">{toast}</div>
      )}

      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Atif Dogrulama</h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">Hukuki metinlerdeki atıf ve referansları doğrulayın</p>
      </div>

      <div className="space-y-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Hukuki metninizi buraya yapıştırın. Sistem metindeki içtihat atıfları, kanun referansları ve mevzuat göndermelerini otomatik olarak tespit edip doğrulayacaktır."
          rows={12}
          className="w-full bg-[#111113] border border-white/[0.06] rounded-2xl px-4 py-3 text-[14px] font-mono text-[#ECECEE] placeholder:text-[#5C5C5F] placeholder:font-sans focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#16161A] transition-all duration-200 resize-y leading-relaxed" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {text.length > 0 && (<span className="text-[11px] text-[#5C5C5F]">{text.length} karakter</span>)}
            {!text && (
              <button onClick={handleLoadExample}
                className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] border border-white/[0.06] hover:border-white/[0.10] rounded-lg transition-all duration-150">Örnek Metin Yükle</button>
            )}
            {text.length > 0 && (
              <button onClick={handleClear}
                className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] border border-white/[0.06] hover:border-white/[0.10] rounded-lg transition-all duration-150">Temizle</button>
            )}
          </div>
          <button onClick={handleVerify} disabled={loading || !text.trim()}
            className="px-5 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[13px] font-medium text-white transition-colors duration-150">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Doğrulanıyor...</span>
              </div>
            ) : "Doğrula"}
          </button>
        </div>
      </div>

      {loading && <SkeletonResults />}

      {error && (
        <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
          {error}
          <button onClick={handleVerify} className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors">Tekrar Dene</button>
        </div>
      )}

      {results && (
        <motion.div className="space-y-5" variants={listContainer} initial="hidden" animate="show">
          <SummaryStats results={results} />
          <ConfidenceBar confidence={results.overall_confidence} />
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-[#8B8B8E]">Atıf Detayları ({results.details.length})</h2>
            {results.details.map((detail, index) => (<CitationCard key={index} detail={detail} />))}
          </div>
        </motion.div>
      )}

      {!loading && !results && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-[#5C5C5F]/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-[13px] text-[#8B8B8E]">Doğrulanacak metni yukarıdaki alana yapıştırın</p>
          <p className="text-[12px] text-[#5C5C5F] mt-1 max-w-md">Sistem içtihat numaraları, kanun maddeleri ve diğer hukuki referansları otomatik olarak tespit edecektir</p>
        </div>
      )}
    </div>
  );
}
