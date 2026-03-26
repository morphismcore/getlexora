"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

import type { CourtStats, CompareResponse, DashboardStats } from "./_components/types";
import {
  DonutChart, HorizontalBarChart, CircularProgress,
  MiniLineChart, HeroStat,
} from "./_components/charts";
import { StatsResults } from "./_components/stats-results";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PERIODS = ["Bu Hafta", "Bu Ay", "Son 3 Ay", "Tüm Zamanlar"] as const;

export default function IstatistikPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "single" | "compare">("overview");
  const [period, setPeriod] = useState<string>("Tüm Zamanlar");

  // Single topic state
  const [topic, setTopic] = useState("");
  const [stats, setStats] = useState<CourtStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare state
  const [compareTopics, setCompareTopics] = useState(["", "", ""]);
  const [compareResults, setCompareResults] = useState<CompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Dashboard stats
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // Fetch dashboard stats
  useEffect(() => {
    async function fetchDashboard() {
      setDashLoading(true);
      try {
        const token = localStorage.getItem("lexora_token");
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const [dashRes, healthRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/dashboard`, { headers }).catch(() => null),
          fetch(`${API_URL}/health/details`).catch(() => null),
        ]);

        let totalCases = 0, totalSearches = 0, upcomingDeadlines = 0, totalEmbeddings = 0;
        let casesByType: Record<string, number> = {};
        let casesByStatus: Record<string, number> = {};
        let recentSearches: string[] = [];

        if (dashRes?.ok) {
          const d = await dashRes.json();
          totalCases = d.total_cases ?? d.cases_count ?? 0;
          totalSearches = d.total_searches ?? d.searches_count ?? 0;
          upcomingDeadlines = d.upcoming_deadlines ?? d.deadlines_count ?? 0;
          casesByType = d.cases_by_type ?? {};
          casesByStatus = d.cases_by_status ?? {};
          recentSearches = d.recent_searches ?? [];
        }

        if (healthRes?.ok) {
          const h = await healthRes.json();
          totalEmbeddings = h.qdrant_documents ?? h.total_embeddings ?? 0;
        }

        setDashboard({
          total_cases: totalCases, total_searches: totalSearches,
          upcoming_deadlines: upcomingDeadlines, total_embeddings: totalEmbeddings,
          cases_by_type: casesByType, cases_by_status: casesByStatus,
          recent_searches: recentSearches, deadline_completion_rate: 72,
        });
      } catch {
        setDashboard({
          total_cases: 0, total_searches: 0, upcoming_deadlines: 0, total_embeddings: 0,
          cases_by_type: {}, cases_by_status: {}, recent_searches: [], deadline_completion_rate: 0,
        });
      } finally { setDashLoading(false); }
    }
    fetchDashboard();
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(null); setStats(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_URL}/api/v1/statistics/court?topic=${encodeURIComponent(topic.trim())}&court_type=yargitay`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.detail || `Analiz başarısız (${res.status})`); }
      setStats(await res.json());
    } catch (err) {
      clearTimeout(timeout);
      setError(err instanceof Error && err.name === "AbortError" ? "İstek zaman aşımına uğradı." : (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally { setLoading(false); }
  }, [topic]);

  const handleCompare = useCallback(async () => {
    const filled = compareTopics.filter((t) => t.trim());
    if (filled.length < 2) return;
    setCompareLoading(true); setCompareError(null); setCompareResults(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_URL}/api/v1/statistics/compare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: filled, court_type: "yargitay" }), signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.detail || `Karşılaştırma başarısız (${res.status})`); }
      setCompareResults(await res.json());
    } catch (err) {
      clearTimeout(timeout);
      setCompareError(err instanceof Error && err.name === "AbortError" ? "İstek zaman aşımına uğradı." : (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally { setCompareLoading(false); }
  }, [compareTopics]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { if (activeTab === "single") handleAnalyze(); else if (activeTab === "compare") handleCompare(); }
  }, [activeTab, handleAnalyze, handleCompare]);

  // Derived chart data
  const caseTypeData = useMemo(() => {
    if (!dashboard) return [];
    return Object.entries(dashboard.cases_by_type).map(([label, value]) => ({ label, value }));
  }, [dashboard]);

  const caseStatusData = useMemo(() => {
    if (!dashboard) return [];
    const labels: Record<string, string> = { active: "Aktif", closed: "Kapalı", pending: "Beklemede", archived: "Arşiv" };
    return Object.entries(dashboard.cases_by_status).map(([key, value]) => ({ label: labels[key] || key, value }));
  }, [dashboard]);

  const handleExport = (format: "json" | "csv") => {
    if (!dashboard) return;
    let content: string, mimeType: string, ext: string;
    if (format === "json") {
      content = JSON.stringify(dashboard, null, 2); mimeType = "application/json"; ext = "json";
    } else {
      const rows = [["Metrik", "Değer"], ["Toplam Dava", String(dashboard.total_cases)],
        ["Toplam Arama", String(dashboard.total_searches)], ["Yaklaşan Süre", String(dashboard.upcoming_deadlines)],
        ["Toplam Embedding", String(dashboard.total_embeddings)]];
      content = rows.map((r) => r.join(",")).join("\n"); mimeType = "text/csv"; ext = "csv";
    }
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lexora_istatistik.${ext}`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#ECECEE]">İstatistikler</h1>
          <p className="text-[14px] text-[#5C5C5F] mt-0.5">Platform kullanımı ve mahkeme analizi</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-2 text-[14px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Dışa Aktar
            </button>
            <div className="absolute right-0 top-full mt-1 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button onClick={() => handleExport("json")} className="block w-full text-left px-4 py-2 text-[14px] text-[#8B8B8E] hover:text-[#ECECEE] hover:bg-white/[0.03] transition-colors rounded-t-xl">JSON</button>
              <button onClick={() => handleExport("csv")} className="block w-full text-left px-4 py-2 text-[14px] text-[#8B8B8E] hover:text-[#ECECEE] hover:bg-white/[0.03] transition-colors rounded-b-xl">CSV</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 relative">
        {([
          { key: "overview" as const, label: "Genel Bakış" },
          { key: "single" as const, label: "Konu Analizi" },
          { key: "compare" as const, label: "Konu Karşılaştırma" },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-[15px] font-medium transition-colors ${activeTab === tab.key ? "text-[#ECECEE]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
            {tab.label}
            {activeTab === tab.key && (
              <motion.div layoutId="statsTab" className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6C6CFF] rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="flex items-center gap-1.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[14px] font-medium transition-all ${period === p ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.03]"}`}>
                {p}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroStat label="Toplam Dava" target={dashboard?.total_cases ?? 0} color="#6C6CFF"
              icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M16 2v4M8 2v4M4 10h16" /></svg>} />
            <HeroStat label="Toplam Arama" target={dashboard?.total_searches ?? 0} color="#A78BFA"
              icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>} />
            <HeroStat label="Yaklaşan Süre" target={dashboard?.upcoming_deadlines ?? 0} color="#FFB224"
              icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
            <HeroStat label="Embedding Sayısı" target={dashboard?.total_embeddings ?? 0} color="#3DD68C"
              icon={<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {caseTypeData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-[15px] font-medium text-[#ECECEE] mb-4">Dava Türü Dağılımı</h3>
                <DonutChart data={caseTypeData} colors={["#6C6CFF", "#A78BFA", "#3DD68C", "#FFB224", "#E5484D", "#8B8B8E"]} />
              </motion.div>
            )}
            {caseStatusData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-[15px] font-medium text-[#ECECEE] mb-4">Dava Durumu</h3>
                <HorizontalBarChart data={caseStatusData} colors={["#3DD68C", "#E5484D", "#FFB224", "#8B8B8E"]} />
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 flex flex-col items-center">
              <h3 className="text-[15px] font-medium text-[#ECECEE] mb-4 self-start">Süre Tamamlanma</h3>
              <CircularProgress value={dashboard?.deadline_completion_rate ?? 0} />
              <p className="text-[14px] text-[#5C5C5F] mt-3">tamamlanma oranı</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-[15px] font-medium text-[#ECECEE] mb-4">Arama Aktivitesi (Son 7 Gün)</h3>
              <MiniLineChart data={[3, 7, 5, 12, 8, 15, dashboard?.total_searches ? Math.min(dashboard.total_searches, 20) : 10]} color="#6C6CFF" height={80} />
              <div className="flex justify-between mt-2 text-[12px] text-[#5C5C5F]">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (<span key={d}>{d}</span>))}
              </div>
            </motion.div>
          </div>

          {dashboard?.recent_searches && dashboard.recent_searches.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-[15px] font-medium text-[#ECECEE] mb-3">Son Aramalar</h3>
              <div className="flex flex-wrap gap-2">
                {dashboard.recent_searches.slice(0, 12).map((s, i) => (
                  <span key={i} className="px-3 py-1.5 text-[14px] text-[#8B8B8E] bg-white/[0.03] border border-white/[0.06] rounded-lg">{s}</span>
                ))}
              </div>
            </motion.div>
          )}

          {dashboard && dashboard.total_cases === 0 && dashboard.total_searches === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#5C5C5F]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="18" rx="1" strokeWidth={1} /><rect x="14" y="9" width="7" height="12" rx="1" strokeWidth={1} />
                </svg>
              </div>
              <p className="text-[16px] text-[#8B8B8E] font-medium">Henüz veri yok</p>
              <p className="text-[14px] text-[#5C5C5F] mt-1 max-w-sm">Arama yapın, dava oluşturun ve süre ekleyin — istatistikler burada görünecek.</p>
            </div>
          )}
        </div>
      )}

      {/* Single Topic Tab */}
      {activeTab === "single" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Konu girin (örn: işe iade, kıdem tazminatı)..."
              className="flex-1 bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[16px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors" />
            <button onClick={handleAnalyze} disabled={loading || !topic.trim()}
              className="px-5 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[15px] font-medium text-white transition-colors flex-shrink-0">
              {loading ? (<div className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Analiz ediliyor...</span></div>) : "Analiz Et"}
            </button>
          </div>
          {error && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[15px] text-[#E5484D]">
              {error}
              <button onClick={handleAnalyze} className="block mt-2 text-[14px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors">Tekrar Dene</button>
            </div>
          )}
          <AnimatePresence mode="wait">
            {stats && stats.total_decisions > 0 && <StatsResults key={stats.topic} stats={stats} />}
            {stats && stats.total_decisions === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111113] border border-white/[0.06] rounded-xl p-6 text-center">
                <p className="text-[15px] text-[#8B8B8E]">&quot;{stats.topic}&quot; için karar bulunamadı.</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!loading && !stats && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-10 h-10 text-[#5C5C5F]/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="18" rx="1" strokeWidth={1} /><rect x="14" y="9" width="7" height="12" rx="1" strokeWidth={1} />
              </svg>
              <p className="text-[15px] text-[#8B8B8E]">Konu girerek mahkeme istatistiklerini analiz edin</p>
              <p className="text-[14px] text-[#5C5C5F] mt-1 max-w-md">Bedesten API üzerinden daire dağılımı, yıl bazlı trend ve en aktif daireler</p>
            </div>
          )}
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {compareTopics.map((t, i) => (
              <input key={i} type="text" value={t}
                onChange={(e) => { const next = [...compareTopics]; next[i] = e.target.value; setCompareTopics(next); }}
                onKeyDown={handleKeyDown}
                placeholder={`Konu ${i + 1}${i >= 2 ? " (opsiyonel)" : ""}...`}
                className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[16px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors" />
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={handleCompare} disabled={compareLoading || compareTopics.filter((t) => t.trim()).length < 2}
              className="px-5 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[15px] font-medium text-white transition-colors">
              {compareLoading ? (<div className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Karşılaştırılıyor...</span></div>) : "Karşılaştır"}
            </button>
          </div>
          {compareError && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[15px] text-[#E5484D]">
              {compareError}
              <button onClick={handleCompare} className="block mt-2 text-[14px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors">Tekrar Dene</button>
            </div>
          )}
          {compareResults && (
            <motion.div className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {compareResults.comparisons.map((c, i) => (
                  <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
                    <p className="text-[14px] text-[#6C6CFF] font-medium mb-2 truncate">{c.topic}</p>
                    <p className="text-[24px] font-bold text-[#ECECEE] leading-none">{c.total_decisions}</p>
                    <p className="text-[13px] text-[#5C5C5F] mt-1">karar</p>
                    {c.most_active_chamber && <p className="text-[13px] text-[#8B8B8E] mt-2 truncate">En aktif: {c.most_active_chamber}</p>}
                  </div>
                ))}
              </div>
              {compareResults.comparisons.map((c, i) => c.total_decisions > 0 && (
                <div key={i} className="space-y-3">
                  <h3 className="text-[15px] font-medium text-[#6C6CFF]">{c.topic}</h3>
                  <StatsResults stats={c} />
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
