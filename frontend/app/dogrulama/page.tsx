"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EXAMPLE_TEXT =
  "Yargıtay 9. Hukuk Dairesi'nin 2024/1234 E., 2024/5678 K. sayılı kararında da belirtildiği üzere, 4857 sayılı İş Kanunu'nun 18. maddesi gereğince işverenin fesih bildirimini yazılı olarak yapması ve fesih sebebini açık ve kesin bir şekilde belirtmesi gerekmektedir. Ayrıca Yargıtay 22. Hukuk Dairesi'nin 2023/9876 E., 2023/4321 K. sayılı ilamında, işçinin savunmasının alınmadan gerçekleştirilen feshin geçersiz sayılacağı hükme bağlanmıştır. 6098 sayılı Türk Borçlar Kanunu'nun 49. maddesi uyarınca haksız fiil sorumluluğu da değerlendirilmelidir.";

interface CitationReference {
  raw_text: string;
  citation_type: string;
  mahkeme: string | null;
  esas_no: string | null;
  karar_no: string | null;
  kanun_no: string | null;
  madde_no: string | null;
}

interface CitationResult {
  reference: CitationReference;
  status: "verified" | "not_found" | "partial_match" | "unverified";
  found_match: string | null;
  suggestion: string | null;
  verification_ms: number;
}

interface VerifyResponse {
  total_citations: number;
  verified: number;
  not_found: number;
  partial_match: number;
  details: CitationResult[];
  overall_confidence: number;
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1A1F] rounded ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  );
}

function SkeletonResults() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <ShimmerBlock className="h-20 rounded-xl" />
      <div className="space-y-2">
        <ShimmerBlock className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function getStatusConfig(status: CitationResult["status"]) {
  switch (status) {
    case "verified":
      return {
        label: "Doğrulandı",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ),
        cardBorder: "border-[#3DD68C]/20",
        cardBg: "bg-[#3DD68C]/[0.03]",
        iconColor: "text-[#3DD68C]",
        badgeClass: "bg-[#3DD68C]/10 text-[#3DD68C]",
      };
    case "not_found":
      return {
        label: "Bulunamadı",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ),
        cardBorder: "border-[#E5484D]/20",
        cardBg: "bg-[#E5484D]/[0.03]",
        iconColor: "text-[#E5484D]",
        badgeClass: "bg-[#E5484D]/10 text-[#E5484D]",
      };
    case "partial_match":
      return {
        label: "Kısmi Eşleşme",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
          </svg>
        ),
        cardBorder: "border-[#FFB224]/20",
        cardBg: "bg-[#FFB224]/[0.03]",
        iconColor: "text-[#FFB224]",
        badgeClass: "bg-[#FFB224]/10 text-[#FFB224]",
      };
    case "unverified":
      return {
        label: "Doğrulanamadı",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
        ),
        cardBorder: "border-white/[0.06]",
        cardBg: "bg-white/[0.02]",
        iconColor: "text-[#8B8B8E]",
        badgeClass: "bg-white/[0.04] text-[#8B8B8E]",
      };
  }
}

function getBarColor(score: number): string {
  if (score < 0.4) return "bg-[#E5484D]";
  if (score < 0.7) return "bg-[#FFB224]";
  return "bg-[#3DD68C]";
}

function getBarTextColor(score: number): string {
  if (score < 0.4) return "text-[#E5484D]";
  if (score < 0.7) return "text-[#FFB224]";
  return "text-[#3DD68C]";
}

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const listItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function DogrulamaPage() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Aramadan gelen metin varsa otomatik yükle
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fromSearch = localStorage.getItem("lexora_verify_text");
      if (fromSearch) {
        setText(fromSearch);
        localStorage.removeItem("lexora_verify_text");
      }
    }
  }, []);

  const handleVerify = useCallback(async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Doğrulama başarısız (${res.status})`);
      const data: VerifyResponse = await res.json();
      setResults(data);
      setToast(`${data.verified} atıf doğrulandı, ${data.not_found} bulunamadı`);
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
  }, [text]);

  const handleClear = useCallback(() => {
    setText("");
    setResults(null);
    setError(null);
  }, []);

  const handleLoadExample = useCallback(() => {
    setText(EXAMPLE_TEXT);
    setResults(null);
    setError(null);
  }, []);

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg animate-fade-in">
          {toast}
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Atif Dogrulama</h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">
          Hukuki metinlerdeki atıf ve referansları doğrulayın
        </p>
      </div>

      {/* Textarea */}
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hukuki metninizi buraya yapıştırın. Sistem metindeki içtihat atıfları, kanun referansları ve mevzuat göndermelerini otomatik olarak tespit edip doğrulayacaktır."
          rows={12}
          className="w-full bg-[#111113] border border-white/[0.06] rounded-2xl px-4 py-3 text-[14px] font-mono text-[#ECECEE] placeholder:text-[#5C5C5F] placeholder:font-sans focus:outline-none focus:border-[#6C6CFF]/40 focus:bg-[#16161A] transition-all duration-200 resize-y leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {text.length > 0 && (
              <span className="text-[11px] text-[#5C5C5F]">{text.length} karakter</span>
            )}
            {!text && (
              <button
                onClick={handleLoadExample}
                className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] border border-white/[0.06] hover:border-white/[0.10] rounded-lg transition-all duration-150"
              >
                Örnek Metin Yükle
              </button>
            )}
            {text.length > 0 && (
              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 text-[12px] text-[#8B8B8E] hover:text-[#ECECEE] border border-white/[0.06] hover:border-white/[0.10] rounded-lg transition-all duration-150"
              >
                Temizle
              </button>
            )}
          </div>
          <button
            onClick={handleVerify}
            disabled={loading || !text.trim()}
            className="px-5 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[13px] font-medium text-white transition-colors duration-150"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Doğrulanıyor...</span>
              </div>
            ) : (
              "Doğrula"
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && <SkeletonResults />}

      {/* Error */}
      {error && (
        <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
          {error}
          <button
            onClick={handleVerify}
            className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <motion.div
          className="space-y-5"
          variants={listContainer}
          initial="hidden"
          animate="show"
        >
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <motion.div
              variants={listItem}
              className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-semibold text-[#ECECEE]">{results.total_citations}</p>
              <p className="text-[12px] text-[#8B8B8E] mt-1">Toplam Atıf</p>
            </motion.div>
            <motion.div
              variants={listItem}
              className="bg-[#3DD68C]/[0.03] border border-[#3DD68C]/20 rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-semibold text-[#3DD68C]">{results.verified}</p>
              <p className="text-[12px] text-[#8B8B8E] mt-1">Doğrulanan</p>
            </motion.div>
            <motion.div
              variants={listItem}
              className="bg-[#E5484D]/[0.03] border border-[#E5484D]/20 rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-semibold text-[#E5484D]">{results.not_found}</p>
              <p className="text-[12px] text-[#8B8B8E] mt-1">Bulunamayan</p>
            </motion.div>
            <motion.div
              variants={listItem}
              className="bg-[#FFB224]/[0.03] border border-[#FFB224]/20 rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-semibold text-[#FFB224]">{results.partial_match}</p>
              <p className="text-[12px] text-[#8B8B8E] mt-1">Kısmi Eşleşme</p>
            </motion.div>
          </div>

          {/* Confidence bar */}
          <motion.div
            variants={listItem}
            className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[#8B8B8E]">Genel Güven Skoru</span>
              <span className={`text-[15px] font-semibold ${getBarTextColor(results.overall_confidence)}`}>
                %{Math.round(results.overall_confidence * 100)}
              </span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getBarColor(results.overall_confidence)}`}
                initial={{ width: 0 }}
                animate={{ width: `${results.overall_confidence * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </motion.div>

          {/* Citation cards */}
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-[#8B8B8E]">
              Atıf Detayları ({results.details.length})
            </h2>

            {results.details.map((detail, index) => {
              const statusConfig = getStatusConfig(detail.status);
              return (
                <motion.div
                  key={index}
                  variants={listItem}
                  className={`border rounded-xl p-4 ${statusConfig.cardBorder} ${statusConfig.cardBg}`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                        detail.reference.citation_type === "ictihat"
                          ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                          : detail.reference.citation_type === "mevzuat"
                          ? "bg-[#A78BFA]/10 text-[#A78BFA]"
                          : "bg-white/[0.04] text-[#8B8B8E]"
                      }`}
                    >
                      {detail.reference.citation_type === "ictihat" ? "İçtihat" : detail.reference.citation_type === "mevzuat" ? "Mevzuat" : detail.reference.citation_type.toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusConfig.badgeClass}`}>
                      <span className={statusConfig.iconColor}>{statusConfig.icon}</span>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Citation text */}
                  <p className="text-[13px] font-mono font-medium text-[#ECECEE] mb-2">
                    {detail.reference.raw_text}
                  </p>

                  {/* Found match */}
                  {detail.found_match && (
                    <p className="text-[12px] text-[#8B8B8E] mb-1">
                      Kaynak: {detail.found_match}
                    </p>
                  )}

                  {/* Suggestion */}
                  {detail.suggestion && (
                    <p className="text-[12px] text-[#5C5C5F] italic mt-1">
                      Öneri: {detail.suggestion}
                    </p>
                  )}

                  {/* Verification time */}
                  <div className="mt-2">
                    <span className="text-[11px] text-[#5C5C5F]">
                      Doğrulama süresi: {(detail.verification_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !results && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-[#5C5C5F]/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-[13px] text-[#8B8B8E]">Doğrulanacak metni yukarıdaki alana yapıştırın</p>
          <p className="text-[12px] text-[#5C5C5F] mt-1 max-w-md">
            Sistem içtihat numaraları, kanun maddeleri ve diğer hukuki referansları otomatik olarak tespit edecektir
          </p>
        </div>
      )}
    </div>
  );
}
