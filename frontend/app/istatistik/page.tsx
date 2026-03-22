"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChamberStat {
  daire: string;
  count: number;
  percentage: number;
}

interface YearStat {
  year: number;
  count: number;
}

interface CourtStats {
  topic: string;
  court_type: string;
  total_decisions: number;
  by_chamber: ChamberStat[];
  by_year: YearStat[];
  most_active_chamber: string | null;
  note: string;
}

interface CompareResponse {
  topics: string[];
  court_type: string;
  comparisons: CourtStats[];
}

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[11px] text-[#5C5C5F] uppercase tracking-wide font-medium">{label}</p>
      <p className="text-[28px] font-bold text-[#ECECEE] mt-1 leading-none">{value}</p>
      {sub && <p className="text-[12px] text-[#8B8B8E] mt-1.5">{sub}</p>}
    </div>
  );
}

function ChamberBarChart({ data }: { data: ChamberStat[] }) {
  if (!data.length) return null;
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[12px] text-[#8B8B8E] w-[180px] truncate flex-shrink-0 text-right">
            {item.daire}
          </span>
          <div className="flex-1 h-7 bg-[#16161A] rounded-md overflow-hidden relative">
            <motion.div
              className="h-full rounded-md"
              style={{ backgroundColor: "#6C6CFF" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((item.count / maxCount) * 100, 2)}%` }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
            />
            <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-medium text-[#ECECEE]">
              {item.count} ({item.percentage}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function YearBarChart({ data }: { data: YearStat[] }) {
  if (!data.length) return null;
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-2 h-[140px]">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <span className="text-[11px] font-medium text-[#ECECEE] mb-1">{item.count}</span>
          <motion.div
            className="w-full rounded-t-md"
            style={{ backgroundColor: "#6C6CFF" }}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          />
          <span className="text-[11px] text-[#5C5C5F] mt-1.5">{item.year}</span>
        </div>
      ))}
    </div>
  );
}

function StatsResults({ stats }: { stats: CourtStats }) {
  return (
    <motion.div
      className="space-y-4"
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      {/* Summary cards */}
      <motion.div variants={listItem} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Toplam Karar" value={stats.total_decisions} />
        <StatCard label="Daire Sayısı" value={stats.by_chamber.length} />
        {stats.most_active_chamber && (
          <StatCard
            label="En Aktif Daire"
            value={stats.by_chamber[0]?.count ?? 0}
            sub={stats.most_active_chamber}
          />
        )}
      </motion.div>

      {/* Chamber distribution */}
      {stats.by_chamber.length > 0 && (
        <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[13px] font-medium text-[#ECECEE] mb-3">Daire Dağılımı</h3>
          <ChamberBarChart data={stats.by_chamber} />
        </motion.div>
      )}

      {/* Year trend */}
      {stats.by_year.length > 0 && (
        <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[13px] font-medium text-[#ECECEE] mb-3">Yıl Bazlı Trend</h3>
          <YearBarChart data={stats.by_year} />
        </motion.div>
      )}

      {/* Note */}
      <motion.div variants={listItem}>
        <p className="text-[11px] text-[#5C5C5F] italic">{stats.note}</p>
      </motion.div>
    </motion.div>
  );
}

export default function IstatistikPage() {
  const [topic, setTopic] = useState("");
  const [stats, setStats] = useState<CourtStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comparison state
  const [compareTopics, setCompareTopics] = useState(["", "", ""]);
  const [compareResults, setCompareResults] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"single" | "compare">("single");

  const handleAnalyze = useCallback(async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setStats(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(
        `${API_URL}/api/v1/statistics/court?topic=${encodeURIComponent(topic.trim())}&court_type=yargitay`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Analiz başarısız (${res.status})`);
      }
      const data: CourtStats = await res.json();
      setStats(data);
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
  }, [topic]);

  const handleCompare = useCallback(async () => {
    const filled = compareTopics.filter((t) => t.trim());
    if (filled.length < 2) return;

    setCompareLoading(true);
    setCompareError(null);
    setCompareResults(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/statistics/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: filled, court_type: "yargitay" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Karşılaştırma başarısız (${res.status})`);
      }
      const data: CompareResponse = await res.json();
      setCompareResults(data);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setCompareError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setCompareError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
      }
    } finally {
      setCompareLoading(false);
    }
  }, [compareTopics]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (activeTab === "single") handleAnalyze();
        else handleCompare();
      }
    },
    [activeTab, handleAnalyze, handleCompare]
  );

  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
          Mahkeme İstatistikleri
        </h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">
          Bedesten API verilerine dayanan daire ve konu bazlı karar analizi
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("single")}
          className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            activeTab === "single"
              ? "bg-[#6C6CFF]/[0.15] text-[#6C6CFF]"
              : "text-[#8B8B8E] hover:text-[#ECECEE]"
          }`}
        >
          Konu Analizi
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            activeTab === "compare"
              ? "bg-[#6C6CFF]/[0.15] text-[#6C6CFF]"
              : "text-[#8B8B8E] hover:text-[#ECECEE]"
          }`}
        >
          Konu Karşılaştırma
        </button>
      </div>

      {/* Single topic analysis */}
      {activeTab === "single" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Konu girin (örn: işe iade, kıdem tazminatı)..."
              className="flex-1 bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !topic.trim()}
              className="px-5 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[13px] font-medium text-white transition-colors duration-150 flex-shrink-0"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analiz ediliyor...</span>
                </div>
              ) : (
                "Analiz Et"
              )}
            </button>
          </div>

          {error && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
              {error}
              <button
                onClick={handleAnalyze}
                className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {stats && stats.total_decisions > 0 && (
              <StatsResults key={stats.topic} stats={stats} />
            )}
            {stats && stats.total_decisions === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#111113] border border-white/[0.06] rounded-xl p-6 text-center"
              >
                <p className="text-[13px] text-[#8B8B8E]">
                  &quot;{stats.topic}&quot; için karar bulunamadı.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Compare topics */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {compareTopics.map((t, i) => (
              <input
                key={i}
                type="text"
                value={t}
                onChange={(e) => {
                  const next = [...compareTopics];
                  next[i] = e.target.value;
                  setCompareTopics(next);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Konu ${i + 1}${i >= 2 ? " (opsiyonel)" : ""}...`}
                className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCompare}
              disabled={compareLoading || compareTopics.filter((t) => t.trim()).length < 2}
              className="px-5 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[13px] font-medium text-white transition-colors duration-150"
            >
              {compareLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Karşılaştırılıyor...</span>
                </div>
              ) : (
                "Karşılaştır"
              )}
            </button>
          </div>

          {compareError && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
              {compareError}
              <button
                onClick={handleCompare}
                className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {compareResults && (
            <motion.div
              className="space-y-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Summary comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {compareResults.comparisons.map((c, i) => (
                  <div
                    key={i}
                    className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
                  >
                    <p className="text-[12px] text-[#6C6CFF] font-medium mb-2 truncate">
                      {c.topic}
                    </p>
                    <p className="text-[24px] font-bold text-[#ECECEE] leading-none">
                      {c.total_decisions}
                    </p>
                    <p className="text-[11px] text-[#5C5C5F] mt-1">karar</p>
                    {c.most_active_chamber && (
                      <p className="text-[11px] text-[#8B8B8E] mt-2 truncate">
                        En aktif: {c.most_active_chamber}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Detailed per-topic */}
              {compareResults.comparisons.map(
                (c, i) =>
                  c.total_decisions > 0 && (
                    <div key={i} className="space-y-3">
                      <h3 className="text-[13px] font-medium text-[#6C6CFF]">{c.topic}</h3>
                      <StatsResults stats={c} />
                    </div>
                  )
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Empty state */}
      {activeTab === "single" && !loading && !stats && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-10 h-10 text-[#5C5C5F]/40 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="3" width="7" height="18" rx="1" strokeWidth={1} />
            <rect x="14" y="9" width="7" height="12" rx="1" strokeWidth={1} />
          </svg>
          <p className="text-[13px] text-[#8B8B8E]">
            Konu girerek mahkeme istatistiklerini analiz edin
          </p>
          <p className="text-[12px] text-[#5C5C5F] mt-1 max-w-md">
            Bedesten API üzerinden daire dağılımı, yıl bazlı trend ve en aktif daireler
          </p>
        </div>
      )}
    </div>
  );
}
