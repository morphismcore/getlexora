"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/ui/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────

interface DashboardData {
  stats: {
    total_cases: number;
    upcoming_deadlines: number;
    total_searches: number;
    qdrant_documents: number;
  };
  upcoming_deadlines: {
    id: string;
    title: string;
    court: string;
    case_title: string;
    date: string;
    deadline_date: string;
    days_left: number;
    deadline_type: string;
  }[];
  recent_searches: {
    id: string;
    query: string;
    search_type: string;
    result_count: number;
    created_at: string;
  }[];
  new_decisions: {
    karar_id: string;
    daire: string;
    esas_no: string;
    karar_no: string;
    tarih: string;
  }[];
  system_health: {
    backend: string;
    qdrant: string;
    redis: string;
    postgres: string;
  };
}

interface QuickAction {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// ── Static Data ──────────────────────────────────────────────────────

const quickActions: QuickAction[] = [
  {
    href: "/arama",
    title: "Yeni Arama",
    description: "İçtihat ve karar ara",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/dogrulama",
    title: "Dilekçe Doğrula",
    description: "Atıf ve referans kontrol",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    href: "/mevzuat",
    title: "Mevzuat Tara",
    description: "Kanun ve yönetmelik ara",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function getUrgencyBarColor(daysLeft: number): string {
  if (daysLeft <= 3) return "bg-[#E5484D]";
  if (daysLeft <= 7) return "bg-[#FFB224]";
  return "bg-[#5C5C5F]";
}

function getUrgencyBadge(daysLeft: number): { text: string; className: string } {
  if (daysLeft <= 3) {
    return { text: `${daysLeft} gün`, className: "bg-[#E5484D]/10 text-[#E5484D]" };
  }
  if (daysLeft <= 7) {
    return { text: `${daysLeft} gün`, className: "bg-[#FFB224]/10 text-[#FFB224]" };
  }
  return { text: `${daysLeft} gün`, className: "bg-white/[0.04] text-[#8B8B8E]" };
}

function timeAgo(isoDate: string): string {
  if (!isoDate) return "";
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} saat önce`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Dün";
  return `${diffDay} gün önce`;
}

function isAllHealthy(health: DashboardData["system_health"]): boolean {
  return (
    health.backend === "ok" &&
    health.qdrant === "ok" &&
    health.redis === "ok" &&
    health.postgres === "ok"
  );
}

// ── Animation Variants ───────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Shimmer Skeleton ─────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.04] ${className ?? ""}`}
    />
  );
}

function SkeletonDashboard() {
  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-6">
      {/* Greeting skeleton */}
      <div>
        <Shimmer className="h-6 w-32 mb-2" />
        <Shimmer className="h-4 w-48" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
          >
            <Shimmer className="h-8 w-16 mb-2" />
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          <Shimmer className="h-5 w-36" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
            >
              <Shimmer className="h-4 w-3/4 mb-2" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-3">
          <Shimmer className="h-5 w-28" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111113] border border-white/[0.06] rounded-lg p-3"
            >
              <Shimmer className="h-4 w-full mb-2" />
              <Shimmer className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/v1/dashboard/summary`, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(
          err instanceof Error ? err.message : "Dashboard verisi yüklenemedi"
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Time-based greeting ──────────────────────────────────────────
  const today = new Date();
  const dateStr = today.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  const hour = today.getHours();
  let greeting = "Günaydın";
  if (hour >= 12 && hour < 18) greeting = "İyi günler";
  else if (hour >= 18) greeting = "İyi akşamlar";

  // ── Loading state ────────────────────────────────────────────────
  if (loading) return <SkeletonDashboard />;

  // ── Error state ──────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#E5484D]/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[14px] text-[#ECECEE]">Dashboard verisi yüklenemedi</p>
          <p className="text-[12px] text-[#5C5C5F]">{error}</p>
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-lg text-[13px] font-medium hover:bg-[#6C6CFF]/20 transition-colors duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // ── Build stat cards from real data ──────────────────────────────
  const allHealthy = isAllHealthy(data.system_health);

  const statCards = [
    {
      label: "Toplam Karar",
      value: data.stats.qdrant_documents,
      color: "text-[#6C6CFF]",
    },
    {
      label: "Yaklaşan Süre",
      value: data.stats.upcoming_deadlines,
      color:
        data.stats.upcoming_deadlines > 0
          ? "text-[#FFB224]"
          : "text-[#8B8B8E]",
    },
    {
      label: "Kayıtlı Arama",
      value: data.stats.total_searches,
      color: "text-[#3DD68C]",
    },
  ];

  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
          {greeting}
        </h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">{dateStr}</p>
      </div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] hover:bg-[#1A1A1F] transition-all duration-150 hover:-translate-y-px"
          >
            <p className={`text-2xl font-semibold ${stat.color}`}>
              {stat.value.toLocaleString("tr-TR")}
            </p>
            <p className="text-[12px] text-[#8B8B8E] mt-1">{stat.label}</p>
          </motion.div>
        ))}

        {/* System health card */}
        <motion.div
          variants={item}
          className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] hover:bg-[#1A1A1F] transition-all duration-150 hover:-translate-y-px"
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                allHealthy ? "bg-[#3DD68C]" : "bg-[#FFB224]"
              }`}
            />
            <p
              className={`text-2xl font-semibold ${
                allHealthy ? "text-[#3DD68C]" : "text-[#FFB224]"
              }`}
            >
              {allHealthy ? "OK" : "!"}
            </p>
          </div>
          <p className="text-[12px] text-[#8B8B8E] mt-1">Sistem Durumu</p>
        </motion.div>
      </motion.div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Yaklaşan Süreler */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
              Yaklaşan Süreler
            </h2>
            <Link href="/sureler" className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">
              Tüm süreler
            </Link>
          </div>

          {data.upcoming_deadlines.length === 0 ? (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-6 text-center">
              <p className="text-[13px] text-[#5C5C5F]">Henüz süre eklenmemiş</p>
              <Link
                href="/sureler"
                className="inline-block mt-2 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
              >
                Süre hesapla &rarr;
              </Link>
            </div>
          ) : (
            <motion.div
              className="space-y-2"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {data.upcoming_deadlines.map((deadline) => {
                const badge = getUrgencyBadge(deadline.days_left);
                return (
                  <motion.div
                    key={deadline.id}
                    variants={item}
                    className="flex items-center gap-3 bg-[#111113] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.10] hover:bg-[#1A1A1F] transition-all duration-150"
                  >
                    <div className={`w-[2px] self-stretch rounded-full ${getUrgencyBarColor(deadline.days_left)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#ECECEE] truncate">
                        {deadline.title}
                      </p>
                      <p className="text-[12px] text-[#5C5C5F] mt-0.5">
                        {deadline.court || deadline.case_title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                      <span className="text-[11px] text-[#5C5C5F]">{deadline.date}</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Son Aramalar */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
              Son Aramalar
            </h2>
            <span className="text-[12px] text-[#5C5C5F]">Geçmiş</span>
          </div>

          {data.recent_searches.length === 0 ? (
            <div className="bg-[#111113] border border-white/[0.06] rounded-lg p-6 text-center">
              <p className="text-[13px] text-[#5C5C5F]">Henüz arama yapılmamış</p>
              <Link
                href="/arama"
                className="inline-block mt-2 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
              >
                Arama yap &rarr;
              </Link>
            </div>
          ) : (
            <motion.div
              className="space-y-1.5"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {data.recent_searches.map((search) => (
                <motion.div
                  key={search.id}
                  variants={item}
                  className="bg-[#111113] border border-white/[0.06] rounded-lg px-3 py-2.5 hover:border-white/[0.10] hover:bg-[#1A1A1F] transition-all duration-150 cursor-pointer"
                >
                  <p className="text-[13px] text-[#ECECEE] truncate">{search.query}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        search.search_type === "ictihat"
                          ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                          : "bg-[#3DD68C]/10 text-[#3DD68C]"
                      }`}
                    >
                      {search.search_type === "ictihat" ? "İçtihat" : "Mevzuat"}
                    </span>
                    {search.result_count > 0 && (
                      <span className="text-[10px] text-[#5C5C5F]">
                        {search.result_count} sonuç
                      </span>
                    )}
                    <span className="text-[10px] text-[#5C5C5F] ml-auto">
                      {timeAgo(search.created_at)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Yeni Kararlar */}
      {data.new_decisions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
            Yeni Kararlar
          </h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {data.new_decisions.map((decision) => (
              <motion.div key={decision.karar_id} variants={item}>
                <Link
                  href={`/arama?q=${encodeURIComponent(decision.esas_no || decision.karar_no)}`}
                  className="block bg-[#111113] border border-white/[0.06] rounded-xl p-3 hover:border-white/[0.10] hover:bg-[#6C6CFF]/[0.04] transition-all duration-150 group"
                >
                  <p className="text-[11px] text-[#6C6CFF] font-medium truncate">
                    {decision.daire || "Yargıtay"}
                  </p>
                  <p className="text-[12px] text-[#ECECEE] mt-1 truncate">
                    E. {decision.esas_no}
                  </p>
                  <p className="text-[12px] text-[#8B8B8E] truncate">
                    K. {decision.karar_no}
                  </p>
                  <p className="text-[10px] text-[#5C5C5F] mt-1.5">
                    {decision.tarih}
                  </p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Hızlı Erişim */}
      <div className="space-y-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
          Hızlı Erişim
        </h2>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {quickActions.map((action) => (
            <motion.div key={action.href} variants={item}>
              <Link
                href={action.href}
                className="flex items-center gap-3 bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.10] hover:bg-[#6C6CFF]/[0.04] transition-all duration-150 group hover:-translate-y-px"
              >
                <div className="w-9 h-9 rounded-lg bg-[#6C6CFF]/[0.08] flex items-center justify-center shrink-0 text-[#6C6CFF] group-hover:bg-[#6C6CFF]/[0.12] transition-colors duration-150">
                  {action.icon}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#ECECEE] group-hover:text-[#6C6CFF] transition-colors duration-150">
                    {action.title}
                  </p>
                  <p className="text-[12px] text-[#5C5C5F]">{action.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Disclaimer */}
      <div className="pt-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-[#5C5C5F] text-center">
          Bu sistem avukatın işini destekler, yapmaz. Nihai hukuki değerlendirme avukata aittir.
        </p>
      </div>
    </div>
  );
}
