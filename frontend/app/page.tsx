"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/ui/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DashboardData {
  stats: { total_cases: number; upcoming_deadlines: number; total_searches: number; qdrant_documents: number };
  upcoming_deadlines: { id: string; title: string; court: string; case_title: string; date: string; deadline_date: string; days_left: number; deadline_type: string }[];
  recent_searches: { id: string; query: string; search_type: string; result_count: number; created_at: string }[];
  new_decisions: { karar_id: string; daire: string; esas_no: string; karar_no: string; tarih: string }[];
  system_health: { backend: string; qdrant: string; redis: string; postgres: string };
}

function getUrgencyColor(d: number) {
  if (d <= 3) return { bar: "bg-[#E5484D]", badge: "bg-[#E5484D]/10 text-[#E5484D]", glow: "shadow-[0_0_12px_rgba(229,72,77,0.2)]" };
  if (d <= 7) return { bar: "bg-[#FFB224]", badge: "bg-[#FFB224]/10 text-[#FFB224]", glow: "" };
  return { bar: "bg-[#5C5C5F]", badge: "bg-white/[0.04] text-[#8B8B8E]", glow: "" };
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return "Az once";
  if (d < 60) return `${d} dk once`;
  const h = Math.floor(d / 60);
  if (h < 24) return `${h} saat once`;
  const days = Math.floor(h / 24);
  return days === 1 ? "Dun" : `${days} gun once`;
}

// Animated counter hook
function useCounter(end: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end === 0) { setVal(0); return; }
    const start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [end, duration]);
  return val;
}

function StatCard({ label, value, color, icon, delay }: { label: string; value: number; color: string; icon: React.ReactNode; delay: number }) {
  const count = useCounter(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="group bg-[#111113] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] hover:bg-[#16161A] transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${color.replace("text-", "bg-").replace("]", "]/10]")} group-hover:scale-110`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
      <p className={`text-[28px] font-bold tabular-nums ${color}`}>{count.toLocaleString("tr-TR")}</p>
      <p className="text-[12px] text-[#5C5C5F] mt-1">{label}</p>
    </motion.div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className ?? ""}`} />;
}

function SkeletonDashboard() {
  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-8">
      <div><Shimmer className="h-8 w-40 mb-2" /><Shimmer className="h-4 w-56" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Shimmer key={i} className="h-[120px]" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3"><Shimmer className="h-5 w-36" />{[1,2,3].map(i => <Shimmer key={i} className="h-20" />)}</div>
        <div className="lg:col-span-2 space-y-3"><Shimmer className="h-5 w-28" />{[1,2,3].map(i => <Shimmer key={i} className="h-16" />)}</div>
      </div>
    </div>
  );
}

const quickActions = [
  { href: "/arama", title: "Yeni Arama", desc: "Ictihat ve karar ara", gradient: "from-[#6C6CFF]/10 to-[#A78BFA]/10", iconColor: "text-[#6C6CFF]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
  { href: "/dogrulama", title: "Atif Dogrula", desc: "Referanslari kontrol et", gradient: "from-[#3DD68C]/10 to-[#3DD68C]/5", iconColor: "text-[#3DD68C]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  { href: "/mevzuat", title: "Mevzuat Tara", desc: "Kanun ve yonetmelik ara", gradient: "from-[#FFB224]/10 to-[#FFB224]/5", iconColor: "text-[#FFB224]",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
];

export default function DashboardPage() {
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
  const dateStr = today.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  const hour = today.getHours();
  const greeting = hour < 12 ? "Gunaydin" : hour < 18 ? "Iyi gunler" : "Iyi aksamlar";
  const firstName = user?.full_name?.split(" ")[0] || "";

  if (loading) return <SkeletonDashboard />;

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#E5484D]/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5}><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[14px] text-[#ECECEE]">Veri yuklenemedi</p>
          <p className="text-[12px] text-[#5C5C5F]">{error}</p>
          <button onClick={fetchDashboard} className="px-5 py-2 bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-xl text-[13px] font-medium hover:bg-[#6C6CFF]/20 transition-colors">
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const allHealthy = data.system_health.backend === "ok" && data.system_health.qdrant === "ok" && data.system_health.redis === "ok" && data.system_health.postgres === "ok";

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-8">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-[#ECECEE]">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[13px] text-[#5C5C5F] mt-1">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${allHealthy ? "bg-[#3DD68C]" : "bg-[#FFB224] animate-pulse"}`} />
            <span className="text-[11px] text-[#5C5C5F]">{allHealthy ? "Sistem aktif" : "Sorun var"}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Toplam Karar" value={data.stats.qdrant_documents} color="text-[#6C6CFF]" delay={0.05}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} />
        <StatCard label="Yaklasan Sure" value={data.stats.upcoming_deadlines} color={data.stats.upcoming_deadlines > 0 ? "text-[#FFB224]" : "text-[#8B8B8E]"} delay={0.1}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
        <StatCard label="Kayitli Arama" value={data.stats.total_searches} color="text-[#3DD68C]" delay={0.15}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        <StatCard label="Aktif Dava" value={data.stats.total_cases} color="text-[#A78BFA]" delay={0.2}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Deadlines */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yaklasan Sureler</h2>
            <Link href="/sureler" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu gor</Link>
          </div>

          {data.upcoming_deadlines.length === 0 ? (
            <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <p className="text-[13px] text-[#5C5C5F]">Henuz sure eklenmemis</p>
              <Link href="/sureler" className="inline-block mt-3 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF]">Sure hesapla &rarr;</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.upcoming_deadlines.map((dl, i) => {
                const urg = getUrgencyColor(dl.days_left);
                return (
                  <motion.div
                    key={dl.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 bg-[#111113] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.10] transition-all ${urg.glow}`}
                  >
                    <div className={`w-[3px] self-stretch rounded-full ${urg.bar}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#ECECEE] truncate">{dl.title}</p>
                      <p className="text-[12px] text-[#5C5C5F] mt-0.5">{dl.court || dl.case_title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold tabular-nums ${urg.badge}`}>
                        {dl.days_left} gun
                      </span>
                      <span className="text-[11px] text-[#5C5C5F]">{dl.date}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Searches */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#ECECEE]">Son Aramalar</h2>
            <span className="text-[12px] text-[#5C5C5F]">Gecmis</span>
          </div>

          {data.recent_searches.length === 0 ? (
            <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-[13px] text-[#5C5C5F]">Henuz arama yapilmamis</p>
              <Link href="/arama" className="inline-block mt-3 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF]">Arama yap &rarr;</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent_searches.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/arama?q=${encodeURIComponent(s.query)}`}
                    className="block bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-white/[0.10] hover:bg-[#16161A] transition-all group"
                  >
                    <p className="text-[13px] text-[#ECECEE] truncate group-hover:text-[#6C6CFF] transition-colors">{s.query}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.search_type === "ictihat" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "bg-[#3DD68C]/10 text-[#3DD68C]"}`}>
                        {s.search_type === "ictihat" ? "Ictihat" : "Mevzuat"}
                      </span>
                      {s.result_count > 0 && <span className="text-[10px] text-[#5C5C5F]">{s.result_count} sonuc</span>}
                      <span className="text-[10px] text-[#5C5C5F] ml-auto">{timeAgo(s.created_at)}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Decisions */}
      {data.new_decisions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Kararlar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.new_decisions.map((d, i) => (
              <motion.div key={d.karar_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link
                  href={`/arama?q=${encodeURIComponent(d.esas_no || d.karar_no)}`}
                  className="block bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-[#6C6CFF]/20 hover:bg-[#6C6CFF]/[0.03] transition-all group"
                >
                  <p className="text-[11px] text-[#6C6CFF] font-medium truncate">{d.daire || "Yargitay"}</p>
                  <p className="text-[12px] text-[#ECECEE] mt-1.5 truncate">E. {d.esas_no}</p>
                  <p className="text-[12px] text-[#8B8B8E] truncate">K. {d.karar_no}</p>
                  <p className="text-[10px] text-[#5C5C5F] mt-2">{d.tarih}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Hizli Erisim</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((a, i) => (
            <motion.div key={a.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Link
                href={a.href}
                className={`flex items-center gap-4 bg-gradient-to-br ${a.gradient} border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all group hover:-translate-y-0.5`}
              >
                <div className={`w-12 h-12 rounded-xl bg-[#09090B]/50 flex items-center justify-center shrink-0 ${a.iconColor} group-hover:scale-110 transition-transform`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#ECECEE] group-hover:text-[#6C6CFF] transition-colors">{a.title}</p>
                  <p className="text-[12px] text-[#5C5C5F]">{a.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-[#3A3A3F] text-center">
          Lexora avukatin isini destekler, yapmaz. Nihai hukuki degerlendirme avukata aittir.
        </p>
      </div>
    </div>
  );
}