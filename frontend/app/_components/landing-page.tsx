"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { API_URL } from "./types";
import { Shimmer } from "./skeleton-dashboard";

/* ------------------------------------------------------------------ */
/*  Health stats hook                                                   */
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

export default function LandingPage() {
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
    <div className="min-h-full bg-[#09090B] overflow-auto">
      {/* ============ NAV ============ */}
      <nav className="border-b border-white/[0.06] bg-[#09090B]/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-7 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6C6CFF]/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
              </svg>
            </div>
            <span className="text-[22px] font-bold text-[#ECECEE] tracking-tight">Lexora</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/giris"
              className="px-6 py-2.5.5 text-[15px] font-medium text-[#8B8B8E] hover:text-white transition-colors"
            >
              Giris Yap
            </Link>
            <Link
              href="/kayit"
              className="px-7 py-2.5.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[15px] font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(108,108,255,0.25)] hover:shadow-[0_0_30px_rgba(108,108,255,0.4)]"
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

        <div className="max-w-7xl mx-auto px-7 pt-24 md:pt-32 pb-20 relative">
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-[glow-pulse_2s_ease-in-out_infinite]" />
              <span className="text-[14px] font-medium text-[#8B8B8E]">Yapay zeka destekli hukuk platformu</span>
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
              className="mt-6 text-[19px] md:text-[22px] text-[#8B8B8E] leading-relaxed max-w-2xl mx-auto"
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
                className="group relative px-10 py-5 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[18px] font-semibold rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-[0_0_30px_rgba(108,108,255,0.3)] hover:shadow-[0_0_50px_rgba(108,108,255,0.5)]"
              >
                <span className="relative z-10">Ucretsiz Deneyin</span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6C6CFF] to-[#A78BFA] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/giris"
                className="px-10 py-5 bg-white/[0.05] hover:bg-white/[0.10] text-[#ECECEE] text-[18px] font-medium rounded-2xl border border-white/[0.10] hover:border-white/[0.20] transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
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
            <div className="group text-center p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#6C6CFF]/30 hover:bg-[#6C6CFF]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#6C6CFF]">
                {healthLoading ? (
                  <Shimmer className="h-10 w-24 mx-auto" />
                ) : (
                  <AnimatedNumber end={totalPoints} suffix="+" duration={2200} />
                )}
              </div>
              <p className="text-[15px] text-[#5C5C5F] mt-1 font-medium">Ictihat Karari</p>
            </div>
            <div className="group text-center p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#A78BFA]">
                <AnimatedNumber end={7} duration={1200} />
              </div>
              <p className="text-[15px] text-[#5C5C5F] mt-1 font-medium">Veri Kaynagi</p>
            </div>
            <div className="group text-center p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#FFB224]/30 hover:bg-[#FFB224]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#FFB224]">
                <AnimatedNumber end={900} suffix="+" duration={1800} />
              </div>
              <p className="text-[15px] text-[#5C5C5F] mt-1 font-medium">Kanun & Mevzuat</p>
            </div>
            <div className="group text-center p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:border-[#3DD68C]/30 hover:bg-[#3DD68C]/[0.04] transition-all duration-300">
              <div className="text-[32px] md:text-[42px] font-bold text-[#3DD68C]">
                <AnimatedNumber end={93} duration={1500} />
              </div>
              <p className="text-[15px] text-[#5C5C5F] mt-1 font-medium">Sure Kurali</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ VERI HAVUZU ============ */}
      <section className="relative border-t border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0C0E] to-[#09090B] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-7 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-[14px] font-semibold tracking-[0.2em] uppercase text-[#6C6CFF] mb-4">Veri Havuzu</span>
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#ECECEE] tracking-tight">
              7 Resmi Kaynaktan<br className="hidden sm:block" /> Tek Platformda Erisim
            </h2>
            <p className="text-[17px] text-[#5C5C5F] mt-4 max-w-xl mx-auto leading-relaxed">
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
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
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
                  <h3 className="text-[18px] font-semibold text-[#ECECEE] mb-1.5">{src.name}</h3>
                  <p className="text-[15px] text-[#5C5C5F] leading-relaxed">{src.desc}</p>
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
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
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
                  <h3 className="text-[18px] font-semibold text-[#ECECEE] mb-1.5">{src.name}</h3>
                  <p className="text-[15px] text-[#5C5C5F] leading-relaxed">{src.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-7 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-[14px] font-semibold tracking-[0.2em] uppercase text-[#A78BFA] mb-4">Ozellikler</span>
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#ECECEE] tracking-tight">
              Avukatlar Icin Tasarlandi
            </h2>
            <p className="text-[17px] text-[#5C5C5F] mt-4 max-w-xl mx-auto leading-relaxed">
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
                className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 hover:border-white/[0.16] transition-all duration-300 overflow-hidden"
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
                  <h3 className="text-[19px] font-semibold text-[#ECECEE] group-hover:text-white transition-colors mb-2">{f.title}</h3>
                  <p className="text-[15px] text-[#5C5C5F] leading-relaxed group-hover:text-[#8B8B8E] transition-colors">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ TRUST BAR ============ */}
      <section className="relative border-t border-white/[0.06] border-b border-b-white/[0.06] bg-gradient-to-r from-[#6C6CFF]/[0.04] via-[#A78BFA]/[0.04] to-[#3DD68C]/[0.04]">
        <div className="max-w-7xl mx-auto px-7 py-16">
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
              <p className="text-[15px] text-[#5C5C5F] font-medium mt-1">Kaynak</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center">
              <div className="text-[36px] md:text-[48px] font-bold text-[#ECECEE]">
                <AnimatedNumber end={65000} suffix="+" duration={2200} />
              </div>
              <p className="text-[15px] text-[#5C5C5F] font-medium mt-1">Karar</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center">
              <div className="text-[36px] md:text-[48px] font-bold text-[#ECECEE]">
                <AnimatedNumber end={900} suffix="+" duration={1800} />
              </div>
              <p className="text-[15px] text-[#5C5C5F] font-medium mt-1">Kanun</p>
            </div>
            <div className="hidden md:block w-px h-16 bg-white/[0.08]" />
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C] animate-[glow-pulse_2s_ease-in-out_infinite]" />
                <span className="text-[22px] md:text-[28px] font-bold text-[#3DD68C]">Gunluk</span>
              </div>
              <p className="text-[15px] text-[#5C5C5F] font-medium mt-1">Guncelleme</p>
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
        <div className="max-w-3xl mx-auto px-7 py-24 text-center relative">
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
            <p className="text-[17px] text-[#5C5C5F] mt-4 max-w-lg mx-auto leading-relaxed">
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
                className="group relative inline-block mt-8 px-12 py-5 bg-[#6C6CFF] hover:bg-[#7B7BFF] text-white text-[18px] font-semibold rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-[0_0_30px_rgba(108,108,255,0.3)] hover:shadow-[0_0_60px_rgba(108,108,255,0.5)]"
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
        <div className="max-w-7xl mx-auto px-7 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#6C6CFF]/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                  <path d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M3 6l9 3m0 0l9-3m-9 3v12" />
                </svg>
              </div>
              <span className="text-[16px] font-semibold text-[#5C5C5F]">Lexora</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <a href="#" className="text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Gizlilik Politikasi</a>
              <a href="#" className="text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Kullanim Kosullari</a>
              <a href="#" className="text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">KVKK Aydinlatma</a>
              <a href="#" className="text-[14px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Iletisim</a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[#3A3A3F]">
              &copy; 2026 Lexora. Tum haklari saklidir.
            </p>
            <p className="text-[13px] text-[#3A3A3F]">
              Lexora avukatin isini destekler, yapmaz. Nihai hukuki degerlendirme avukata aittir.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
