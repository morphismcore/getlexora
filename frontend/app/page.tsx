"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/ui/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Dashboard types & helpers (authenticated view)                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Landing page (non-authenticated view)                              */
/* ------------------------------------------------------------------ */

interface HealthStats {
  totalPoints: number;
  loading: boolean;
}

function useHealthStats(): HealthStats {
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health/details`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const qdrant = data?.checks?.qdrant;
        if (qdrant?.total_points) setTotalPoints(qdrant.total_points);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { totalPoints, loading };
}

function LandingHeroCounter({ end, suffix }: { end: number; suffix: string }) {
  const count = useCounter(end, 1800);
  return (
    <span className="text-[32px] md:text-[40px] font-bold tabular-nums text-[#ECECEE]">
      {end > 0 ? count.toLocaleString("tr-TR") : "--"}{suffix}
    </span>
  );
}

const dataSources = [
  {
    name: "Yargitay",
    desc: "Bedesten API uzerinden tam metin ictihat kararlari",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    ),
    color: "text-[#6C6CFF]",
  },
  {
    name: "Danistay",
    desc: "Idari yargi kararlari ve ictihat arsivi",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: "text-[#A78BFA]",
  },
  {
    name: "Anayasa Mahkemesi",
    desc: "anayasa.gov.tr kaynaklarindan bireysel basvuru ve norm denetimi kararlari",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
      </svg>
    ),
    color: "text-[#E5484D]",
  },
  {
    name: "AiHM (HUDOC)",
    desc: "Avrupa Insan Haklari Mahkemesi kararlari",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    color: "text-[#3DD68C]",
  },
  {
    name: "Mevzuat",
    desc: "mevzuat.gov.tr uzerinden guncel kanun ve yonetmelikler",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: "text-[#FFB224]",
  },
];

const features = [
  {
    href: "/arama",
    title: "Akilli Arama",
    desc: "AI destekli semantik arama ile binlerce ictihat karari icinden ihtiyaciniz olan karari saniyeler icinde bulun.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    color: "text-[#6C6CFF]",
    gradient: "from-[#6C6CFF]/10 to-[#6C6CFF]/5",
  },
  {
    href: "/dilekce",
    title: "Dilekce Olusturma",
    desc: "Sablonlar ve AI destekli metin onerisiyle profesyonel dilekce ve hukuki belge hazirlayin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: "text-[#3DD68C]",
    gradient: "from-[#3DD68C]/10 to-[#3DD68C]/5",
  },
  {
    href: "/davalar",
    title: "Sure Takibi",
    desc: "Dava olaylarina bagli yasal sureleri otomatik hesaplayin, kritik sureler icin uyari alin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    color: "text-[#FFB224]",
    gradient: "from-[#FFB224]/10 to-[#FFB224]/5",
  },
  {
    href: "/belge",
    title: "Belge Yonetimi",
    desc: "Dava belgelerinizi guvenli bir sekilde yukleyin, kategorize edin ve kolayca erisin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "text-[#A78BFA]",
    gradient: "from-[#A78BFA]/10 to-[#A78BFA]/5",
  },
  {
    href: "/davalar",
    title: "Dava Takibi",
    desc: "Tum davalarinizi tek panelden yonetin, durusma tarihlerini ve gelismeleri takip edin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    color: "text-[#E5484D]",
    gradient: "from-[#E5484D]/10 to-[#E5484D]/5",
  },
  {
    href: "/istatistik",
    title: "Istatistik ve Analiz",
    desc: "Arama istatistikleri, karar dagilimi ve kullanim analizleriyle calismanizi optimize edin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: "text-[#6C6CFF]",
    gradient: "from-[#6C6CFF]/8 to-[#A78BFA]/5",
  },
];

function LandingPage() {
  const { totalPoints, loading: healthLoading } = useHealthStats();

  return (
    <div className="min-h-screen bg-[#09090B] overflow-auto">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6C6CFF]/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
              </svg>
            </div>
            <span className="text-[18px] font-bold text-[#ECECEE] tracking-tight">Lexora</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/giris"
              className="px-4 py-2 text-[13px] font-medium text-[#ECECEE] hover:text-white transition-colors"
            >
              Giris Yap
            </Link>
            <Link
              href="/kayit"
              className="px-5 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[13px] font-semibold rounded-xl transition-colors"
            >
              Ucretsiz Kayit Ol
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C6CFF]/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-[36px] md:text-[52px] font-extrabold tracking-tight text-[#ECECEE] leading-[1.1]">
              Turk Hukuk Arastirma Platformu
            </h1>
            <p className="mt-5 text-[16px] md:text-[18px] text-[#8B8B8E] leading-relaxed max-w-2xl mx-auto">
              AI destekli ictihat arama, mevzuat tarama, dilekce olusturma ve dava yonetimi — avukatlar icin tasarlandi.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link
                href="/kayit"
                className="px-8 py-3.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[15px] font-semibold rounded-xl transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(108,108,255,0.3)]"
              >
                Ucretsiz Kayit Ol
              </Link>
              <Link
                href="/giris"
                className="px-8 py-3.5 bg-white/[0.06] hover:bg-white/[0.10] text-[#ECECEE] text-[15px] font-medium rounded-xl border border-white/[0.08] transition-all hover:-translate-y-0.5"
              >
                Giris Yap
              </Link>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-16 max-w-4xl mx-auto"
          >
            <div className="text-center p-5 bg-[#111113] border border-white/[0.06] rounded-2xl">
              {healthLoading ? (
                <Shimmer className="h-10 w-24 mx-auto mb-2" />
              ) : (
                <LandingHeroCounter end={totalPoints} suffix="+" />
              )}
              <p className="text-[13px] text-[#5C5C5F] mt-1">Ictihat Karari</p>
            </div>
            <div className="text-center p-5 bg-[#111113] border border-white/[0.06] rounded-2xl">
              <span className="text-[32px] md:text-[40px] font-bold text-[#ECECEE]">5</span>
              <p className="text-[13px] text-[#5C5C5F] mt-1">Veri Kaynagi</p>
            </div>
            <div className="text-center p-5 bg-[#111113] border border-white/[0.06] rounded-2xl">
              <span className="text-[32px] md:text-[40px] font-bold text-[#ECECEE]">15+</span>
              <p className="text-[13px] text-[#5C5C5F] mt-1">Olay Turu</p>
            </div>
            <div className="text-center p-5 bg-[#111113] border border-white/[0.06] rounded-2xl">
              <span className="text-[32px] md:text-[40px] font-bold text-[#3DD68C]">Ucretsiz</span>
              <p className="text-[13px] text-[#5C5C5F] mt-1">Baslangic</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="border-t border-white/[0.06] bg-[#0C0C0E]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#ECECEE] tracking-tight">
              Veri Kaynaklarimiz
            </h2>
            <p className="text-[14px] text-[#5C5C5F] mt-3 max-w-xl mx-auto">
              Resmi ve guvenilir kaynaklardan toplanan hukuki veriler ile calisiyoruz.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {dataSources.map((src, i) => (
              <motion.div
                key={src.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${src.color.replace("text-", "bg-").replace("]", "]/10]")}`}>
                  <span className={src.color}>{src.icon}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-[#ECECEE]">{src.name}</h3>
                <p className="text-[12px] text-[#5C5C5F] mt-1.5 leading-relaxed">{src.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#ECECEE] tracking-tight">
              Avukatlar Icin Tasarlandi
            </h2>
            <p className="text-[14px] text-[#5C5C5F] mt-3 max-w-xl mx-auto">
              Hukuki arastirmadan dava yonetimine, tum ihtiyaclariniz tek platformda.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.href}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <div
                  className={`h-full bg-gradient-to-br ${f.gradient} border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all group`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-[#09090B]/50 flex items-center justify-center mb-4 ${f.color} group-hover:scale-110 transition-transform`}>
                    {f.icon}
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#ECECEE] group-hover:text-white transition-colors">{f.title}</h3>
                  <p className="text-[13px] text-[#5C5C5F] mt-2 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/[0.06] bg-[#0C0C0E]">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#ECECEE] tracking-tight">
              Hukuki arastirmanizi hizlandirin
            </h2>
            <p className="text-[14px] text-[#5C5C5F] mt-3">
              Ucretsiz hesap olusturun ve hemen aramaya baslayin.
            </p>
            <Link
              href="/kayit"
              className="inline-block mt-8 px-10 py-4 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[15px] font-semibold rounded-xl transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(108,108,255,0.3)]"
            >
              Ucretsiz Kayit Ol
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#09090B]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#6C6CFF]/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                  <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
                </svg>
              </div>
              <span className="text-[14px] font-semibold text-[#5C5C5F]">Lexora</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <a href="#" className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Gizlilik Politikasi</a>
              <a href="#" className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Kullanim Kosullari</a>
              <a href="#" className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">KVKK Aydinlatma</a>
              <a href="#" className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Iletisim</a>
            </div>
          </div>
          <p className="text-[11px] text-[#3A3A3F] text-center mt-6">
            Lexora avukatin isini destekler, yapmaz. Nihai hukuki degerlendirme avukata aittir.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deadline Widget for Dashboard                                       */
/* ------------------------------------------------------------------ */

interface UpcomingDeadline {
  id: string;
  title: string;
  court: string;
  case_title: string;
  date: string;
  deadline_date: string;
  days_left: number;
  deadline_type: string;
  case_id?: string;
}

interface DeadlineWidgetProps {
  token: string | null;
  deadlines: UpcomingDeadline[];
}

function groupDeadlinesByPeriod(deadlines: UpcomingDeadline[]) {
  const today: UpcomingDeadline[] = [];
  const thisWeek: UpcomingDeadline[] = [];
  const nextWeek: UpcomingDeadline[] = [];
  const past: UpcomingDeadline[] = [];

  deadlines.forEach((dl) => {
    if (dl.days_left < 0) {
      past.push(dl);
    } else if (dl.days_left === 0) {
      today.push(dl);
    } else if (dl.days_left <= 7) {
      thisWeek.push(dl);
    } else {
      nextWeek.push(dl);
    }
  });

  return { today, thisWeek, nextWeek, past };
}

function getWidgetUrgency(daysLeft: number) {
  if (daysLeft < 0) return { dot: "bg-[#5C5C5F]", text: "text-[#5C5C5F]", bg: "bg-[#5C5C5F]/5", border: "border-[#5C5C5F]/20", label: `${Math.abs(daysLeft)} gun gecti` };
  if (daysLeft === 0) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/5", border: "border-[#E5484D]/20", label: "SON GUN" };
  if (daysLeft <= 3) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/5", border: "border-[#E5484D]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 7) return { dot: "bg-[#FFB224]", text: "text-[#FFB224]", bg: "bg-[#FFB224]/5", border: "border-[#FFB224]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 14) return { dot: "bg-[#F5D90A]", text: "text-[#F5D90A]", bg: "bg-[#F5D90A]/5", border: "border-[#F5D90A]/20", label: `${daysLeft} gun` };
  return { dot: "bg-[#3DD68C]", text: "text-[#3DD68C]", bg: "bg-[#3DD68C]/5", border: "border-[#3DD68C]/20", label: `${daysLeft} gun` };
}

function DeadlineWidget({ token, deadlines }: DeadlineWidgetProps) {
  const [nextWeekOpen, setNextWeekOpen] = useState(false);
  const todayStr = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const { today, thisWeek, nextWeek, past } = groupDeadlinesByPeriod(deadlines);

  if (deadlines.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
            <span className="text-[12px] text-[#5C5C5F]">{todayStr}</span>
          </div>
          <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu Gor</Link>
        </div>
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <p className="text-[13px] text-[#5C5C5F]">Henuz sure eklenmemis</p>
          <Link href="/davalar" className="inline-block mt-3 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF]">Dava dosyalarindan sure ekle</Link>
        </div>
      </div>
    );
  }

  const renderDeadlineItem = (dl: UpcomingDeadline, elevated: boolean) => {
    const urg = getWidgetUrgency(dl.days_left);
    const dateFormatted = dl.deadline_date ? new Date(dl.deadline_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : dl.date;

    if (elevated) {
      return (
        <motion.div
          key={dl.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-[#111113] border ${urg.border} rounded-xl p-4 shadow-lg shadow-black/20`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${urg.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#ECECEE] truncate">{dl.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urg.bg} ${urg.text}`}>{urg.label}</span>
              </div>
              <p className="text-[12px] text-[#5C5C5F] mt-1 truncate">
                {dl.case_title || ""} {dl.court ? `\u00b7 ${dl.court}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href={dl.case_id ? `/davalar/${dl.case_id}` : "/davalar"}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 rounded-md hover:bg-[#6C6CFF]/20 transition-colors"
                >
                  Davayi Ac
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={dl.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
        <span className="text-[12px] text-[#ECECEE] truncate flex-1">{dl.title}</span>
        <span className="text-[11px] text-[#5C5C5F] shrink-0">{dateFormatted}</span>
        <span className={`text-[11px] font-medium shrink-0 ${urg.text}`}>{urg.label}</span>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
          <span className="text-[12px] text-[#5C5C5F]">{todayStr}</span>
        </div>
        <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu Gor</Link>
      </div>

      {/* BUGUN */}
      {today.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5484D]">Bugun</span>
            <span className="text-[10px] text-[#5C5C5F]">({today.length})</span>
          </div>
          <div className="space-y-2">
            {today.map((dl) => renderDeadlineItem(dl, true))}
          </div>
        </div>
      )}

      {/* BU HAFTA */}
      {thisWeek.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFB224]">Bu Hafta</span>
            <span className="text-[10px] text-[#5C5C5F]">({thisWeek.length})</span>
          </div>
          <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {thisWeek.slice(0, 3).map((dl) => renderDeadlineItem(dl, false))}
            {thisWeek.length > 3 && (
              <Link href="/davalar" className="block px-3 py-2 text-[11px] text-[#6C6CFF] hover:bg-white/[0.02] transition-colors">
                +{thisWeek.length - 3} daha...
              </Link>
            )}
          </div>
        </div>
      )}

      {/* GELECEK HAFTA */}
      {nextWeek.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setNextWeekOpen(!nextWeekOpen)}
            className="flex items-center gap-2 px-1 w-full text-left group"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`text-[#5C5C5F] transition-transform ${nextWeekOpen ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C5C5F]">Gelecek Hafta</span>
            <span className="text-[10px] text-[#3A3A3F]">({nextWeek.length})</span>
          </button>
          {nextWeekOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] overflow-hidden"
            >
              {nextWeek.map((dl) => renderDeadlineItem(dl, false))}
            </motion.div>
          )}
        </div>
      )}

      {/* GECMIS */}
      {past.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C5C5F]">Gecmis</span>
            <span className="text-[10px] text-[#3A3A3F]">({past.length})</span>
          </div>
          <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] opacity-60">
            {past.map((dl) => renderDeadlineItem(dl, false))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Authenticated Dashboard                                            */
/* ------------------------------------------------------------------ */

function AuthenticatedDashboard() {
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
        {/* Deadline Widget */}
        <div className="lg:col-span-3 space-y-4">
          <DeadlineWidget token={token} deadlines={data.upcoming_deadlines} />
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

/* ------------------------------------------------------------------ */
/*  Main export — switches between landing and dashboard               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { token, loading } = useAuth();

  if (loading) return <SkeletonDashboard />;

  if (!token) return <LandingPage />;

  return <AuthenticatedDashboard />;
}
