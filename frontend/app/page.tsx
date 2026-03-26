"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Dashboard types & helpers (authenticated view)                     */
/* ------------------------------------------------------------------ */

interface DeadlineItem {
  id: string;
  title: string;
  deadline_date: string;
  deadline_type: string;
  law_reference: string | null;
  urgency: string;
  days_left: number;
  business_days_left: number;
  is_completed: boolean;
  case_id: string;
  case_title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
}

interface CaseSummary {
  id: string;
  title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
  opponent: string | null;
  status: string;
  updated_at: string;
  next_deadline: { title: string; deadline_date: string; days_left: number; urgency: string } | null;
  deadline_count: number;
  document_count: number;
}

interface RecentEvent {
  id: string;
  event_type: string;
  event_type_label: string;
  event_date: string;
  case_title: string;
  case_id: string;
  created_at: string;
}

interface SavedSearch {
  id: string;
  query: string;
  search_type: string;
  result_count: number;
  created_at: string;
}

interface Decision {
  karar_id: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
}

interface DashboardData {
  stats: {
    total_cases: number;
    active_cases: number;
    upcoming_deadlines: number;
    overdue_deadlines: number;
    today_deadlines: number;
    tomorrow_deadlines: number;
    critical_deadlines: number;
    total_searches: number;
    qdrant_documents: number;
  };
  deadlines: {
    overdue: DeadlineItem[];
    today: DeadlineItem[];
    this_week: DeadlineItem[];
    next_week: DeadlineItem[];
    later: DeadlineItem[];
  };
  cases: CaseSummary[];
  cases_by_type: Record<string, number>;
  cases_by_status: Record<string, number>;
  recent_events: RecentEvent[];
  recent_searches: SavedSearch[];
  new_decisions: Decision[];
  system_health: Record<string, any>;
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

function StatCard({ label, value, color, icon, delay, sub }: { label: string; value: number; color: string; icon: React.ReactNode; delay: number; sub?: string }) {
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
      {sub && <p className="text-[10px] text-[#3A3A3F] mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className ?? ""}`} />;
}

function SkeletonDashboard() {
  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-8">
      <Shimmer className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Shimmer key={i} className="h-[120px]" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3"><Shimmer className="h-5 w-36" />{[1,2,3,4].map(i => <Shimmer key={i} className="h-20" />)}</div>
        <div className="lg:col-span-2 space-y-3"><Shimmer className="h-5 w-28" /><Shimmer className="h-[200px]" />{[1,2,3].map(i => <Shimmer key={i} className="h-16" />)}</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Shimmer key={i} className="h-24" />)}</div>
    </div>
  );
}

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

/* ------------------------------------------------------------------ */
/*  Scroll-triggered counter hook                                       */
/* ------------------------------------------------------------------ */

function useScrollCounter(end: number, duration = 2000) {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || end === 0) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(end * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, end, duration]);

  return { val, ref };
}

function AnimatedNumber({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const { val, ref } = useScrollCounter(end, duration);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{end > 0 ? val.toLocaleString("tr-TR") : "--"}{suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page data                                                   */
/* ------------------------------------------------------------------ */

const dataSources = [
  {
    name: "Yargitay",
    desc: "Hukuk ve Ceza Daireleri kararlari",
    color: "#6C6CFF",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    ),
  },
  {
    name: "Danistay",
    desc: "Idari yargi kararlari",
    color: "#A78BFA",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: "Anayasa Mahkemesi",
    desc: "Bireysel basvuru kararlari",
    color: "#E5484D",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
      </svg>
    ),
  },
  {
    name: "AiHM",
    desc: "Turkiye aleyhine AiHM kararlari",
    color: "#3DD68C",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    name: "Rekabet Kurulu",
    desc: "Rekabet Kurulu kararlari",
    color: "#30A46C",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: "KVKK",
    desc: "Kisisel veri koruma kararlari",
    color: "#F76B15",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    name: "Mevzuat",
    desc: "Kanunlar, KHK'lar, yonetmelikler",
    color: "#FFB224",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "Yapay Zeka Destekli Arama",
    desc: "Hibrit arama: vektor + anahtar kelime. Anlamsal benzerlik ile en ilgili kararlari saniyeler icinde bulun.",
    color: "#6C6CFF",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: "Otomatik Sure Hesaplama",
    desc: "93 kural, tatil ve adli tatil duyarli. Yasal sureleri otomatik hesaplayin, asla kacirmayin.",
    color: "#FFB224",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Atif Dogrulama",
    desc: "Karar referanslarini otomatik kontrol edin. Yanlis atif riskini sifira indirin.",
    color: "#A78BFA",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Belge Analizi",
    desc: "PDF/DOCX yukleyin, yapay zeka analiz etsin. Onemli noktalari otomatik cikartin.",
    color: "#3DD68C",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Dilekce Olusturucu",
    desc: "Sablonlardan profesyonel dilekce olusturun. AI destekli metin onerisiyle zaman kazanin.",
    color: "#F76B15",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    title: "Dava Yonetimi",
    desc: "Dosya takibi, sure yonetimi, ekip calismasi. Tum davalariniz tek panelde.",
    color: "#E5484D",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Landing page component                                              */
/* ------------------------------------------------------------------ */

function LandingPage() {
  const { totalPoints, loading: healthLoading } = useHealthStats();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  };

  return (
    <div className="min-h-screen bg-[#09090B] overflow-auto">
      {/* ============ NAV ============ */}
      <nav className="border-b border-white/[0.06] bg-[#09090B]/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6C6CFF]/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
              </svg>
            </div>
            <span className="text-[20px] font-bold text-[#ECECEE] tracking-tight">Lexora</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/giris"
              className="px-5 py-2.5 text-[13px] font-medium text-[#8B8B8E] hover:text-white transition-colors"
            >
              Giris Yap
            </Link>
            <Link
              href="/kayit"
              className="px-6 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[13px] font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(108,108,255,0.25)] hover:shadow-[0_0_30px_rgba(108,108,255,0.4)]"
            >
              Ucretsiz Deneyin
            </Link>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute -top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
            style={{ background: "radial-gradient(ellipse at center, rgba(108,108,255,0.12) 0%, rgba(108,108,255,0.04) 40%, transparent 70%)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -top-[200px] left-[20%] w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(ellipse at center, rgba(167,139,250,0.08) 0%, transparent 60%)" }}
            animate={{ scale: [1.1, 1, 1.1], x: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -top-[100px] right-[15%] w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(ellipse at center, rgba(61,214,140,0.06) 0%, transparent 60%)" }}
            animate={{ scale: [1, 1.15, 1], x: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="max-w-7xl mx-auto px-6 pt-24 md:pt-32 pb-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-[glow-pulse_2s_ease-in-out_infinite]" />
              <span className="text-[12px] font-medium text-[#8B8B8E]">Yapay zeka destekli hukuk platformu</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-[40px] sm:text-[52px] md:text-[64px] lg:text-[72px] font-extrabold tracking-tight leading-[1.05]">
              <span className="gradient-text">Turkiye'nin En Kapsamli</span>
              <br />
              <span className="text-[#ECECEE]">Hukuk Yapay Zeka Platformu</span>
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-6 text-[17px] md:text-[20px] text-[#8B8B8E] leading-relaxed max-w-2xl mx-auto"
            >
              65.000+ ictihat karari, 900+ kanun, 7 farkli kaynak — tek platformda.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
            >
              <Link
                href="/kayit"
                className="group relative px-10 py-4 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[16px] font-semibold rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-[0_0_30px_rgba(108,108,255,0.3)] hover:shadow-[0_0_50px_rgba(108,108,255,0.5)]"
              >
                <span className="relative z-10">Ucretsiz Deneyin</span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6C6CFF] to-[#A78BFA] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/giris"
                className="px-10 py-4 bg-white/[0.05] hover:bg-white/[0.10] text-[#ECECEE] text-[16px] font-medium rounded-2xl border border-white/[0.10] hover:border-white/[0.20] transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
              >
                Giris Yap
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero counter cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mt-20 max-w-4xl mx-auto"
          >
            {/* Dynamic counter from API */}
            <div className="group text-center p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#6C6CFF]/30 hover:bg-[#6C6CFF]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#6C6CFF]">
                {healthLoading ? (
                  <Shimmer className="h-10 w-24 mx-auto" />
                ) : (
                  <AnimatedNumber end={totalPoints} suffix="+" duration={2200} />
                )}
              </div>
              <p className="text-[13px] text-[#5C5C5F] mt-1 font-medium">Ictihat Karari</p>
            </div>
            <div className="group text-center p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#A78BFA]">
                <AnimatedNumber end={7} duration={1200} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] mt-1 font-medium">Veri Kaynagi</p>
            </div>
            <div className="group text-center p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#FFB224]/30 hover:bg-[#FFB224]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#FFB224]">
                <AnimatedNumber end={900} suffix="+" duration={1800} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] mt-1 font-medium">Kanun & Mevzuat</p>
            </div>
            <div className="group text-center p-6 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#3DD68C]/30 hover:bg-[#3DD68C]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#3DD68C]">
                <AnimatedNumber end={93} duration={1500} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] mt-1 font-medium">Sure Kurali</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ VERI HAVUZU ============ */}
      <section className="relative border-t border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0C0E] to-[#09090B] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-[12px] font-semibold tracking-[0.2em] uppercase text-[#6C6CFF] mb-4">Veri Havuzu</span>
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#ECECEE] tracking-tight">
              7 Resmi Kaynaktan<br className="hidden sm:block" /> Tek Platformda Erisim
            </h2>
            <p className="text-[15px] text-[#5C5C5F] mt-4 max-w-xl mx-auto leading-relaxed">
              Turkiye'nin en kapsamli hukuki veri tabani. Resmi ve guvenilir kaynaklardan derlenen veriler.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {dataSources.slice(0, 4).map((src) => (
              <motion.div
                key={src.name}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
              >
                {/* Glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${src.color}10 0%, transparent 70%)` }}
                />
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${src.color}15`, color: src.color }}
                  >
                    {src.icon}
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#ECECEE] mb-1.5">{src.name}</h3>
                  <p className="text-[13px] text-[#5C5C5F] leading-relaxed">{src.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4"
          >
            {dataSources.slice(4).map((src) => (
              <motion.div
                key={src.name}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${src.color}10 0%, transparent 70%)` }}
                />
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${src.color}15`, color: src.color }}
                  >
                    {src.icon}
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#ECECEE] mb-1.5">{src.name}</h3>
                  <p className="text-[13px] text-[#5C5C5F] leading-relaxed">{src.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-[12px] font-semibold tracking-[0.2em] uppercase text-[#A78BFA] mb-4">Ozellikler</span>
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#ECECEE] tracking-tight">
              Avukatlar Icin Tasarlandi
            </h2>
            <p className="text-[15px] text-[#5C5C5F] mt-4 max-w-xl mx-auto leading-relaxed">
              Hukuki arastirmadan dava yonetimine, tum ihtiyaclariniz tek platformda.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
              >
                {/* Gradient glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 30% 0%, ${f.color}08 0%, transparent 60%)` }}
                />
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                    style={{ backgroundColor: `${f.color}12`, color: f.color, boxShadow: `0 0 0 0 ${f.color}00` }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#ECECEE] group-hover:text-white transition-colors mb-2">{f.title}</h3>
                  <p className="text-[13px] text-[#5C5C5F] leading-relaxed group-hover:text-[#8B8B8E] transition-colors">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ TRUST BAR ============ */}
      <section className="relative border-t border-white/[0.06] border-b border-b-white/[0.06] bg-gradient-to-r from-[#6C6CFF]/[0.04] via-[#A78BFA]/[0.04] to-[#3DD68C]/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-8 md:gap-16"
          >
            <div className="text-center">
              <div className="text-[36px] md:text-[48px] font-bold text-[#ECECEE]">
                <AnimatedNumber end={7} duration={1000} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] font-medium mt-1">Kaynak</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center">
              <div className="text-[36px] md:text-[48px] font-bold text-[#ECECEE]">
                <AnimatedNumber end={65000} suffix="+" duration={2200} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] font-medium mt-1">Karar</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center">
              <div className="text-[36px] md:text-[48px] font-bold text-[#ECECEE]">
                <AnimatedNumber end={900} suffix="+" duration={1800} />
              </div>
              <p className="text-[13px] text-[#5C5C5F] font-medium mt-1">Kanun</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C] animate-[glow-pulse_2s_ease-in-out_infinite]" />
                <span className="text-[20px] md:text-[24px] font-bold text-[#3DD68C]">Gunluk</span>
              </div>
              <p className="text-[13px] text-[#5C5C5F] font-medium mt-1">Guncelleme</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ BOTTOM CTA ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(ellipse at center, rgba(108,108,255,0.08) 0%, transparent 60%)" }}
          />
        </div>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight">
              <span className="gradient-text">Hukuki arastirmanizi</span>
              <br />
              <span className="text-[#ECECEE]">bir ust seviyeye tasiyin</span>
            </h2>
            <p className="text-[15px] text-[#5C5C5F] mt-4 max-w-lg mx-auto leading-relaxed">
              Ucretsiz hesap olusturun ve yapay zeka destekli hukuk platformuyla hemen aramaya baslayin.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Link
                href="/kayit"
                className="group relative inline-block mt-8 px-12 py-4 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[16px] font-semibold rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-[0_0_30px_rgba(108,108,255,0.3)] hover:shadow-[0_0_60px_rgba(108,108,255,0.5)]"
              >
                <span className="relative z-10">Ucretsiz Deneyin</span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6C6CFF] to-[#A78BFA] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/[0.06] bg-[#09090B]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#6C6CFF]/20 flex items-center justify-center">
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
          <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-[#3A3A3F]">
              &copy; 2026 Lexora. Tum haklari saklidir.
            </p>
            <p className="text-[11px] text-[#3A3A3F]">
              Lexora avukatin isini destekler, yapmaz. Nihai hukuki degerlendirme avukata aittir.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Turkish month/day helpers                                          */
/* ------------------------------------------------------------------ */

const TR_MONTHS = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
const TR_MONTHS_SHORT = ["Oca","Sub","Mar","Nis","May","Haz","Tem","Agu","Eyl","Eki","Kas","Ara"];
const TR_DAYS = ["Pazar","Pazartesi","Sali","Carsamba","Persembe","Cuma","Cumartesi"];
const TR_DAYS_SHORT = ["Paz","Pzt","Sal","Car","Per","Cum","Cmt"];

function formatTurkishDate(date: Date): string {
  return `${date.getDate()} ${TR_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${TR_DAYS[date.getDay()]}`;
}

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}`;
}

/* ------------------------------------------------------------------ */
/*  Case type color helper                                             */
/* ------------------------------------------------------------------ */

const CASE_TYPE_COLORS: Record<string, string> = {
  is_hukuku: "#6C6CFF",
  ceza: "#E5484D",
  ticaret: "#FFB224",
  idare: "#A78BFA",
  aile: "#3DD68C",
  icra: "#FFB224",
  vergi: "#E5484D",
};

function getCaseTypeColor(caseType: string): string {
  const key = caseType.toLowerCase().replace(/\s+/g, "_");
  for (const [k, v] of Object.entries(CASE_TYPE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "#6C6CFF";
}

/* ------------------------------------------------------------------ */
/*  Deadline urgency helpers                                           */
/* ------------------------------------------------------------------ */

function getDeadlineUrgency(daysLeft: number, isOverdue?: boolean) {
  if (isOverdue || daysLeft < 0) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.03]", border: "border-[#E5484D]/20", label: `${Math.abs(daysLeft)} gun gecti` };
  if (daysLeft === 0) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.05]", border: "border-[#E5484D]/20", label: "SON GUN" };
  if (daysLeft <= 3) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.03]", border: "border-[#E5484D]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 7) return { dot: "bg-[#FFB224]", text: "text-[#FFB224]", bg: "bg-[#FFB224]/[0.03]", border: "border-[#FFB224]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 14) return { dot: "bg-[#FFB224]", text: "text-[#FFB224]", bg: "bg-[#FFB224]/[0.03]", border: "border-[#FFB224]/20", label: `${daysLeft} gun` };
  return { dot: "bg-[#5C5C5F]", text: "text-[#5C5C5F]", bg: "bg-white/[0.02]", border: "border-white/[0.06]", label: `${daysLeft} gun` };
}

/* ------------------------------------------------------------------ */
/*  Mini Calendar Widget                                               */
/* ------------------------------------------------------------------ */

function MiniCalendar({ deadlines }: { deadlines: DashboardData["deadlines"] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tooltip, setTooltip] = useState<{ day: number; items: DeadlineItem[] } | null>(null);

  const allDeadlines = useMemo(() => {
    return [
      ...(deadlines.overdue || []),
      ...(deadlines.today || []),
      ...(deadlines.this_week || []),
      ...(deadlines.next_week || []),
      ...(deadlines.later || []),
    ];
  }, [deadlines]);

  const deadlinesByDay = useMemo(() => {
    const map: Record<string, DeadlineItem[]> = {};
    allDeadlines.forEach(dl => {
      if (!dl.deadline_date) return;
      const d = new Date(dl.deadline_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(dl);
    });
    return map;
  }, [allDeadlines]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const cells: { day: number; inMonth: boolean }[] = [];
  // Previous month days
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevLastDay - i, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  // Next month fill
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false });
    }
  }

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8E" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="text-[13px] font-semibold text-[#ECECEE]">{TR_MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8E" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Pzt","Sal","Car","Per","Cum","Cmt","Paz"].map(d => (
          <div key={d} className="text-center text-[10px] text-[#3A3A3F] font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5 relative">
        {cells.map((cell, i) => {
          if (!cell.inMonth) {
            return (
              <div key={`out-${i}`} className="h-9 flex flex-col items-center justify-center rounded-lg">
                <span className="text-[11px] text-[#3A3A3F]">{cell.day}</span>
              </div>
            );
          }
          const dayKey = `${year}-${month}-${cell.day}`;
          const isToday = dayKey === todayKey;
          const dayDeadlines = deadlinesByDay[dayKey] || [];
          const hasDeadline = dayDeadlines.length > 0;
          const hasCritical = dayDeadlines.some(dl => dl.days_left <= 0 || dl.urgency === "critical");

          return (
            <button
              key={`in-${cell.day}`}
              onClick={() => {
                if (hasDeadline) {
                  setTooltip(tooltip?.day === cell.day ? null : { day: cell.day, items: dayDeadlines });
                } else {
                  setTooltip(null);
                }
              }}
              className={`h-9 flex flex-col items-center justify-center rounded-lg transition-colors relative
                ${isToday ? "bg-[#6C6CFF]/20 font-bold" : ""}
                ${hasCritical && !isToday ? "bg-[#E5484D]/10" : ""}
                ${hasDeadline ? "cursor-pointer hover:bg-white/[0.06]" : ""}
              `}
            >
              <span className={`text-[11px] ${isToday ? "text-[#6C6CFF] font-bold" : "text-[#ECECEE]"}`}>
                {cell.day}
              </span>
              {hasDeadline && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayDeadlines.slice(0, 3).map((dl, idx) => {
                    const urg = getDeadlineUrgency(dl.days_left);
                    return <div key={idx} className={`w-1 h-1 rounded-full ${urg.dot}`} />;
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 border border-white/[0.08] bg-[#1A1A1F] rounded-xl p-3 space-y-2"
        >
          <p className="text-[11px] font-semibold text-[#8B8B8E]">{tooltip.day} {TR_MONTHS[month]}</p>
          {tooltip.items.map(dl => {
            const urg = getDeadlineUrgency(dl.days_left);
            return (
              <Link key={dl.id} href={`/davalar/${dl.case_id}`} className="flex items-center gap-2 hover:bg-white/[0.04] rounded-md px-1.5 py-1 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${urg.dot}`} />
                <span className="text-[11px] text-[#ECECEE] truncate flex-1">{dl.title}</span>
                <span className={`text-[10px] font-medium ${urg.text}`}>{urg.label}</span>
              </Link>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kritik Sureler Timeline Widget                                     */
/* ------------------------------------------------------------------ */

function DeadlineTimeline({ deadlines }: { deadlines: DashboardData["deadlines"] }) {
  const [nextWeekOpen, setNextWeekOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const deadlineSectionRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalCount = (deadlines.overdue?.length || 0) + (deadlines.today?.length || 0) + (deadlines.this_week?.length || 0) + (deadlines.next_week?.length || 0) + (deadlines.later?.length || 0);

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
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

  const renderDeadlineItem = (dl: DeadlineItem, elevated: boolean) => {
    const urg = getDeadlineUrgency(dl.days_left);
    const dateFormatted = formatShortDate(dl.deadline_date);

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-[#ECECEE] truncate">{dl.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urg.bg} ${urg.text}`}>{urg.label}</span>
              </div>
              <p className="text-[12px] text-[#5C5C5F] mt-1 truncate">
                {dl.case_title || ""} {dl.court ? `· ${dl.court}` : ""}
              </p>
              {dl.law_reference && (
                <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-[#6C6CFF]/10 text-[#6C6CFF]">{dl.law_reference}</span>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href={`/davalar/${dl.case_id}`}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 rounded-md hover:bg-[#6C6CFF]/20 transition-colors"
                >
                  Davayi Ac
                </Link>
              </div>
            </div>
            <span className="text-[11px] text-[#5C5C5F] shrink-0">{dateFormatted}</span>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={dl.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.push(`/davalar/${dl.case_id}`)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-[#ECECEE] truncate block">{dl.title}</span>
          <span className="text-[11px] text-[#5C5C5F] truncate block">{dl.case_title}{dl.court ? ` · ${dl.court}` : ""}</span>
        </div>
        {dl.law_reference && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6C6CFF]/10 text-[#6C6CFF] shrink-0 hidden sm:inline">{dl.law_reference}</span>
        )}
        <span className="text-[11px] text-[#5C5C5F] shrink-0">{dateFormatted}</span>
        <span className={`text-[11px] font-medium shrink-0 ${urg.text}`}>{urg.label}</span>
      </motion.div>
    );
  };

  const renderSection = (
    title: string,
    items: DeadlineItem[],
    colorClass: string,
    borderColor: string,
    sectionKey: string,
    elevated: boolean,
    defaultOpen: boolean,
    pulseDot?: boolean,
  ) => {
    if (!items || items.length === 0) return null;
    const maxVisible = 5;
    const isExpanded = expandedSections[sectionKey] || false;
    const visibleItems = isExpanded ? items : items.slice(0, maxVisible);
    const hasMore = items.length > maxVisible;

    return (
      <div className="space-y-2" key={sectionKey}>
        <div className="flex items-center gap-2 px-1">
          {pulseDot && <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse" />}
          <span className={`text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>{title}</span>
          <span className="text-[10px] text-[#5C5C5F]">({items.length})</span>
        </div>
        <div className={`border-l-2 ${borderColor} pl-3 space-y-2`}>
          {elevated ? (
            <div className="space-y-2">
              {visibleItems.map(dl => renderDeadlineItem(dl, true))}
            </div>
          ) : (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {visibleItems.map(dl => renderDeadlineItem(dl, false))}
            </div>
          )}
          {hasMore && !isExpanded && (
            <button
              onClick={() => toggleExpand(sectionKey)}
              className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors px-3 py-1"
            >
              +{items.length - maxVisible} daha...
            </button>
          )}
          {hasMore && isExpanded && (
            <button
              onClick={() => toggleExpand(sectionKey)}
              className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors px-3 py-1"
            >
              Daralt
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" ref={deadlineSectionRef} id="deadline-section">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
        <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu Gor</Link>
      </div>

      {renderSection("Gecikmis", deadlines.overdue || [], "text-[#E5484D]", "border-[#E5484D]", "overdue", true, true, true)}
      {renderSection("Bugun", deadlines.today || [], "text-[#E5484D]", "border-[#E5484D]", "today", true, true)}
      {renderSection("Bu Hafta", deadlines.this_week || [], "text-[#FFB224]", "border-[#FFB224]", "this_week", false, true)}

      {/* Gelecek Hafta — collapsed by default */}
      {(deadlines.next_week || []).length > 0 && (
        <div className="space-y-2">
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
            <span className="text-[10px] text-[#3A3A3F]">({(deadlines.next_week || []).length})</span>
          </button>
          {nextWeekOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="border-l-2 border-[#5C5C5F] pl-3"
            >
              <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
                {(deadlines.next_week || []).map(dl => renderDeadlineItem(dl, false))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Davalarim (Cases Overview) Widget                                  */
/* ------------------------------------------------------------------ */

function CasesOverview({ cases, casesByStatus }: { cases: CaseSummary[]; casesByStatus: Record<string, number> }) {
  const statusTabs = useMemo(() => {
    const tabs: { key: string; label: string; count: number }[] = [];
    const statusLabels: Record<string, string> = {
      aktif: "Aktif",
      active: "Aktif",
      beklemede: "Beklemede",
      pending: "Beklemede",
      kapanan: "Kapanan",
      closed: "Kapanan",
      kazanildi: "Kazanildi",
      kaybedildi: "Kaybedildi",
    };
    if (casesByStatus && Object.keys(casesByStatus).length > 0) {
      Object.entries(casesByStatus).forEach(([key, count]) => {
        tabs.push({ key, label: statusLabels[key.toLowerCase()] || key, count });
      });
    } else {
      // Derive from cases
      const grouped: Record<string, number> = {};
      cases.forEach(c => {
        const s = c.status || "aktif";
        grouped[s] = (grouped[s] || 0) + 1;
      });
      Object.entries(grouped).forEach(([key, count]) => {
        tabs.push({ key, label: statusLabels[key.toLowerCase()] || key, count });
      });
    }
    if (tabs.length === 0) {
      tabs.push({ key: "all", label: "Tumu", count: cases.length });
    }
    return tabs;
  }, [cases, casesByStatus]);

  const [activeTab, setActiveTab] = useState(statusTabs[0]?.key || "all");

  const filteredCases = useMemo(() => {
    if (activeTab === "all") return cases;
    return cases.filter(c => (c.status || "aktif").toLowerCase() === activeTab.toLowerCase());
  }, [cases, activeTab]);

  const maxVisible = 6;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Davalarim</h2>
          <span className="text-[12px] text-[#5C5C5F]">{cases.length}</span>
        </div>
        <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] border border-[#6C6CFF]/20 rounded-lg px-3 py-1 hover:bg-[#6C6CFF]/10 transition-colors">
          Yeni Dava
        </Link>
      </div>

      {/* Tabs */}
      {statusTabs.length > 1 && (
        <div className="flex gap-1 border-b border-white/[0.06]">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-[12px] font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-[#ECECEE]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              {tab.label} ({tab.count})
              {activeTab === tab.key && (
                <motion.div layoutId="case-tab-underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6C6CFF] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cases */}
      {filteredCases.length === 0 ? (
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-[13px] text-[#5C5C5F]">Bu kategoride dava yok</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredCases.slice(0, maxVisible).map((c, i) => {
            const typeColor = getCaseTypeColor(c.case_type);
            const hasOverdue = c.next_deadline && c.next_deadline.days_left <= 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/davalar/${c.id}`}
                  className="flex items-center gap-3 bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-white/[0.10] hover:bg-[#16161A] transition-all group"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#ECECEE] truncate group-hover:text-[#6C6CFF] transition-colors">{c.title}</p>
                    <p className="text-[12px] text-[#5C5C5F] truncate">{c.court || c.case_type}{c.case_number ? ` · ${c.case_number}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.deadline_count > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        hasOverdue ? "bg-[#E5484D]/10 text-[#E5484D]" : "bg-white/[0.04] text-[#8B8B8E]"
                      }`}>
                        {c.deadline_count} sure
                      </span>
                    )}
                    {c.document_count > 0 && (
                      <span className="text-[10px] text-[#5C5C5F] px-1.5 py-0.5 rounded bg-white/[0.04]">{c.document_count} belge</span>
                    )}
                    <span className="text-[10px] text-[#3A3A3F]">{timeAgo(c.updated_at)}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {filteredCases.length > maxVisible && (
            <Link href="/davalar" className="block text-center text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] py-2 transition-colors">
              Tum davalari gor ({filteredCases.length})
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dava Tipleri Dagilimi Widget                                       */
/* ------------------------------------------------------------------ */

function CaseTypeChart({ casesByType }: { casesByType: Record<string, number> }) {
  const entries = Object.entries(casesByType || {});
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return null;

  const typeLabels: Record<string, string> = {
    is_hukuku: "Is Hukuku",
    ceza: "Ceza",
    ticaret: "Ticaret",
    idare: "Idare",
    aile: "Aile",
    icra: "Icra",
    vergi: "Vergi",
  };

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3">
      <h3 className="text-[13px] font-semibold text-[#ECECEE]">Dava Tipleri</h3>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
        {entries.map(([type, count]) => {
          const color = getCaseTypeColor(type);
          const pct = (count / total) * 100;
          return (
            <Link
              key={type}
              href={`/davalar?type=${encodeURIComponent(type)}`}
              className="h-full transition-opacity hover:opacity-80"
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${typeLabels[type] || type}: ${count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([type, count]) => {
          const color = getCaseTypeColor(type);
          return (
            <Link key={type} href={`/davalar?type=${encodeURIComponent(type)}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-[#8B8B8E]">{typeLabels[type] || type}</span>
              <span className="text-[10px] text-[#5C5C5F]">{count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Son Aramalar Widget                                                */
/* ------------------------------------------------------------------ */

function RecentSearches({ searches }: { searches: SavedSearch[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#ECECEE]">Son Aramalar</h3>
        <Link href="/arama" className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumu</Link>
      </div>
      {searches.length === 0 ? (
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="text-[12px] text-[#5C5C5F]">Henuz arama yapilmamis</p>
          <Link href="/arama" className="inline-block mt-2 text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF]">Arama yap</Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {searches.slice(0, 5).map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/arama?q=${encodeURIComponent(s.query)}`}
                className="block bg-[#111113] border border-white/[0.06] rounded-xl px-3 py-2.5 hover:border-white/[0.10] hover:bg-[#16161A] transition-all group"
              >
                <p className="text-[12px] text-[#ECECEE] truncate group-hover:text-[#6C6CFF] transition-colors">{s.query}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.search_type === "ictihat" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "bg-[#3DD68C]/10 text-[#3DD68C]"}`}>
                    {s.search_type === "ictihat" ? "Ictihat" : s.search_type === "mevzuat" ? "Mevzuat" : s.search_type}
                  </span>
                  {s.result_count > 0 && <span className="text-[10px] text-[#5C5C5F]">{s.result_count} sonuc</span>}
                  <span className="text-[10px] text-[#3A3A3F] ml-auto">{timeAgo(s.created_at)}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Actions (5 cards)                                            */
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
  const dateStr = formatTurkishDate(today);
  const hour = today.getHours();
  const greeting = hour >= 6 && hour < 12 ? "Gunaydin" : hour >= 12 && hour < 18 ? "Iyi gunler" : "Iyi aksamlar";
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

  // Safe access with defaults
  const stats = data.stats || { total_cases: 0, active_cases: 0, upcoming_deadlines: 0, overdue_deadlines: 0, today_deadlines: 0, tomorrow_deadlines: 0, critical_deadlines: 0, total_searches: 0, qdrant_documents: 0 };
  const deadlines = data.deadlines || { overdue: [], today: [], this_week: [], next_week: [], later: [] };
  const cases = data.cases || [];
  const casesByType = data.cases_by_type || {};
  const casesByStatus = data.cases_by_status || {};
  const recentSearches = data.recent_searches || [];
  const newDecisions = data.new_decisions || [];

  // Briefing summary parts
  const briefingParts: string[] = [];
  if (stats.active_cases > 0) briefingParts.push(`${stats.active_cases} aktif dava`);
  if (stats.today_deadlines > 0) briefingParts.push(`bugun ${stats.today_deadlines} sure dolacak`);
  if (stats.overdue_deadlines > 0) briefingParts.push(`${stats.overdue_deadlines} gecikmis islem`);
  if (stats.tomorrow_deadlines > 0) briefingParts.push(`yarin ${stats.tomorrow_deadlines} sure`);
  if (briefingParts.length === 0 && stats.upcoming_deadlines > 0) briefingParts.push(`${stats.upcoming_deadlines} yaklasan sure`);

  const scrollToDeadlines = () => {
    document.getElementById("deadline-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // Status breakdown string for stat card
  const statusBreakdown = Object.entries(casesByStatus)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* 1. Sabah Briefing Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-[#ECECEE]">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[13px] text-[#5C5C5F] mt-1">{dateStr}</p>
            {briefingParts.length > 0 && (
              <p className="text-[13px] text-[#8B8B8E] mt-2">
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
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5484D]/10 hover:bg-[#E5484D]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse" />
                <span className="text-[11px] font-medium text-[#E5484D]">{stats.overdue_deadlines} gecikmis</span>
              </button>
            )}
            {stats.today_deadlines > 0 && (
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFB224]/10 hover:bg-[#FFB224]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#FFB224]" />
                <span className="text-[11px] font-medium text-[#FFB224]">{stats.today_deadlines} bugun</span>
              </button>
            )}
            {stats.critical_deadlines > 0 && stats.overdue_deadlines === 0 && stats.today_deadlines === 0 && (
              <button onClick={scrollToDeadlines} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFB224]/10 hover:bg-[#FFB224]/20 transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#FFB224]" />
                <span className="text-[11px] font-medium text-[#FFB224]">{stats.critical_deadlines} kritik</span>
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
          {/* Kritik Sureler Timeline */}
          <DeadlineTimeline deadlines={deadlines} />

          {/* Davalarim */}
          <CasesOverview cases={cases} casesByStatus={casesByStatus} />
        </div>

        {/* RIGHT: 2/5 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Mini Calendar */}
          <MiniCalendar deadlines={deadlines} />

          {/* Son Aramalar */}
          <RecentSearches searches={recentSearches} />

          {/* Dava Tipleri Dagilimi */}
          <CaseTypeChart casesByType={casesByType} />
        </div>
      </div>

      {/* 4. Yeni Kararlar */}
      {newDecisions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Kararlar</h2>
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
                  className="block bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-[#6C6CFF]/20 hover:bg-[#6C6CFF]/[0.03] transition-all group h-full"
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

      {/* 5. Hizli Erisim */}
      <div className="space-y-4">
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Hizli Erisim</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActionsNew.map((a, i) => (
            <motion.div key={a.href + a.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
              <Link
                href={a.href}
                className={`flex flex-col items-center gap-3 bg-gradient-to-br ${a.gradient} border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all group hover:-translate-y-0.5 text-center`}
              >
                <div className={`w-12 h-12 rounded-xl bg-[#09090B]/50 flex items-center justify-center shrink-0 ${a.iconColor} group-hover:scale-110 transition-transform`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#ECECEE] group-hover:text-white transition-colors">{a.title}</p>
                  <p className="text-[11px] text-[#5C5C5F] mt-0.5">{a.desc}</p>
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
