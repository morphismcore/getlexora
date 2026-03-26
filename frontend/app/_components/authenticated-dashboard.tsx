"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/ui/auth-provider";
import type { DashboardData } from "./types";
import { API_URL } from "./types";
import { formatTurkishDate } from "./helpers";
import SkeletonDashboard from "./skeleton-dashboard";
import StatCard from "./stat-card";
import MiniCalendar from "./mini-calendar";
import DeadlineTimeline from "./deadline-timeline";
import CasesOverview from "./cases-overview";
import CaseTypeChart from "./case-type-chart";
import RecentSearches from "./recent-searches";

/* ------------------------------------------------------------------ */
/*  Quick Actions data                                                  */
/* ------------------------------------------------------------------ */

const quickActionsNew = [
  {
    href: "/arama",
    title: "Yeni Arama",
    desc: "Ictihat ve karar ara",
    gradient: "from-[#6C6CFF]/10 to-[#6C6CFF]/5",
    iconColor: "text-[#6C6CFF]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    href: "/dogrulama",
    title: "Atif Dogrula",
    desc: "Referanslari kontrol et",
    gradient: "from-[#3DD68C]/10 to-[#3DD68C]/5",
    iconColor: "text-[#3DD68C]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
  {
    href: "/mevzuat",
    title: "Mevzuat Tara",
    desc: "Kanun ve yonetmelik ara",
    gradient: "from-[#FFB224]/10 to-[#FFB224]/5",
    iconColor: "text-[#FFB224]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
  {
    href: "/dilekce",
    title: "Dilekce Olustur",
    desc: "AI destekli belge hazirla",
    gradient: "from-[#A78BFA]/10 to-[#A78BFA]/5",
    iconColor: "text-[#A78BFA]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
  {
    href: "/davalar",
    title: "Yeni Dava",
    desc: "Dava dosyasi olustur",
    gradient: "from-[#E5484D]/10 to-[#E5484D]/5",
    iconColor: "text-[#E5484D]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  },
];

/* ------------------------------------------------------------------ */
/*  AuthenticatedDashboard                                              */
/* ------------------------------------------------------------------ */

export default function AuthenticatedDashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/v1/dashboard/summary`, { signal: controller.signal, headers });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      clearTimeout(timeout);
      setError(err instanceof Error && err.name === "AbortError" ? "Zaman asimina ugradi." : err instanceof Error ? err.message : "Yuklenemedi");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const today = new Date();
  const dateStr = formatTurkishDate(today);
  const hour = today.getHours();
  const greeting = hour >= 6 && hour < 12 ? "Gunaydin" : hour >= 12 && hour < 18 ? "Iyi gunler" : "Iyi aksamlar";
  const firstName = user?.full_name?.split(" ")[0] || "";

  if (loading) return <SkeletonDashboard />;

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center p-5">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#E5484D]/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5}><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[16px] text-[#ECECEE]">Veri yuklenemedi</p>
          <p className="text-[14px] text-[#5C5C5F]">{error}</p>
          <button onClick={fetchDashboard} className="px-6 py-2.5 bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-xl text-[15px] font-medium hover:bg-[#6C6CFF]/20 transition-colors">
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // Safe access with defaults
  const stats = data.stats || { total_cases: 0, active_cases: 0, upcoming_deadlines: 0, overdue_deadlines: 0, today_deadlines: 0, tomorrow_deadlines: 0, critical_deadlines: 0, total_searches: 0, qdrant_documents: 0 };
  const deadlines = data.deadlines || { overdue: [], today: [], this_week: [], next_week: [], later: [] };
  const cases = data.cases || [];
  const casesByType = data.cases_by_type || {};
  const casesByStatus = data.cases_by_status || {};
  const recentSearches = data.recent_searches || [];
  const newDecisions = data.new_decisions || [];

  const scrollToDeadlines = () => {
    document.getElementById("deadline-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // Status breakdown string for stat card
  const statusBreakdown = Object.entries(casesByStatus)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  return (
    <div className="h-full overflow-auto p-6 pt-14 md:p-10 md:pt-8 space-y-6">
      {/* 1. Morning Briefing Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#ECECEE]">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[15px] text-[#5C5C5F] mt-1">{dateStr}</p>
            {(stats.active_cases > 0 || stats.today_deadlines > 0 || stats.overdue_deadlines > 0 || stats.tomorrow_deadlines > 0) && (
              <p className="text-[15px] text-[#8B8B8E] mt-2">
                {stats.active_cases > 0 && (
                  <><span className="text-[#A78BFA] font-medium">{stats.active_cases}</span> aktif dava</>
                )}
                {stats.today_deadlines > 0 && (
                  <>{stats.active_cases > 0 ? " · " : ""}bugun <span className="text-[#E5484D] font-medium">{stats.today_deadlines}</span> sure dolacak</>
                )}
                {stats.overdue_deadlines > 0 && (
                  <>{(stats.active_cases > 0 || stats.today_deadlines > 0) ? " · " : ""}<span className="text-[#E5484D] font-medium">{stats.overdue_deadlines}</span> gecikmis islem</>
                )}
                {stats.tomorrow_deadlines > 0 && (
                  <>{(stats.active_cases > 0 || stats.today_deadlines > 0 || stats.overdue_deadlines > 0) ? " · " : ""}yarin <span className="text-[#FFB224] font-medium">{stats.tomorrow_deadlines}</span> sure</>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stats.overdue_deadlines > 0 && (
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E5484D]/10 hover:bg-[#E5484D]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse" />
                <span className="text-[13px] font-medium text-[#E5484D]">{stats.overdue_deadlines} gecikmis</span>
              </button>
            )}
            {stats.today_deadlines > 0 && (
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FFB224]/10 hover:bg-[#FFB224]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#FFB224]" />
                <span className="text-[13px] font-medium text-[#FFB224]">{stats.today_deadlines} bugun</span>
              </button>
            )}
            {stats.critical_deadlines > 0 && stats.overdue_deadlines === 0 && stats.today_deadlines === 0 && (
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FFB224]/10 hover:bg-[#FFB224]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#FFB224]" />
                <span className="text-[13px] font-medium text-[#FFB224]">{stats.critical_deadlines} kritik</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Aktif Dava"
          value={stats.active_cases}
          color="text-[#A78BFA]"
          delay={0.05}
          sub={statusBreakdown || undefined}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        />
        <StatCard
          label="Yaklasan Sure"
          value={stats.upcoming_deadlines}
          color={stats.overdue_deadlines > 0 ? "text-[#E5484D]" : "text-[#FFB224]"}
          delay={0.1}
          sub={stats.critical_deadlines > 0 ? `${stats.critical_deadlines} kritik` : undefined}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
        />
        <StatCard
          label="Kayitli Arama"
          value={stats.total_searches}
          color="text-[#3DD68C]"
          delay={0.15}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
        />
        <StatCard
          label="Toplam Karar"
          value={stats.qdrant_documents}
          color="text-[#6C6CFF]"
          delay={0.2}
          sub="ictihat veritabani"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
      </div>

      {/* 3. Main Grid: 3/5 + 2/5 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          <DeadlineTimeline deadlines={deadlines} />
          <CasesOverview cases={cases} casesByStatus={casesByStatus} />
        </div>

        {/* RIGHT: 2/5 */}
        <div className="lg:col-span-2 space-y-5">
          <MiniCalendar deadlines={deadlines} />
          <RecentSearches searches={recentSearches} />
          <CaseTypeChart casesByType={casesByType} />
        </div>
      </div>

      {/* 4. New Decisions */}
      {newDecisions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[#ECECEE]">Yeni Kararlar</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
            {newDecisions.slice(0, 5).map((d, i) => (
              <motion.div
                key={d.karar_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="min-w-[200px] lg:min-w-0"
              >
                <Link
                  href={`/arama?q=${encodeURIComponent(d.esas_no || d.karar_no)}`}
                  className="block bg-[#111113] border border-white/[0.06] rounded-xl p-5 hover:border-[#6C6CFF]/20 hover:bg-[#6C6CFF]/[0.03] transition-all group h-full"
                >
                  <p className="text-[13px] text-[#6C6CFF] font-medium truncate">{d.daire || "Yargitay"}</p>
                  <p className="text-[14px] text-[#ECECEE] mt-1.5 truncate">E. {d.esas_no}</p>
                  <p className="text-[14px] text-[#8B8B8E] truncate">K. {d.karar_no}</p>
                  <p className="text-[12px] text-[#5C5C5F] mt-2">{d.tarih}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-[17px] font-semibold text-[#ECECEE]">Hizli Erisim</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActionsNew.map((a, i) => (
            <motion.div key={a.href + a.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
              <Link
                href={a.href}
                className={`flex flex-col items-center gap-3 bg-gradient-to-br ${a.gradient} border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all group hover:-translate-y-0.5 text-center`}
              >
                <div className={`w-12 h-12 rounded-xl bg-[#09090B]/50 flex items-center justify-center shrink-0 ${a.iconColor} group-hover:scale-110 transition-transform`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#ECECEE] group-hover:text-white transition-colors">{a.title}</p>
                  <p className="text-[13px] text-[#5C5C5F] mt-0.5">{a.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-white/[0.06]">
        <p className="text-[13px] text-[#3A3A3F] text-center">
          Lexora avukatin isini destekler, yapmaz. Nihai hukuki degerlendirme avukata aittir.
        </p>
      </div>
    </div>
  );
}
