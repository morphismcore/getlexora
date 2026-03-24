"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/ui/auth-provider";
import { motion, AnimatePresence } from "motion/react";

// Floating icon data
const FLOATING_ICONS = [
  { // Scales of justice
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 3v18M3 7l3 7c0 1.66 1.34 2 3 2s3-.34 3-2l3-7M15 7l3 7c0 1.66 1.34 2 3 2s3-.34 3-2l3-7"/><circle cx="12" cy="3" r="1"/></svg>`,
    x: 15, y: 20, size: 40, delay: 0,
  },
  { // Book
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/></svg>`,
    x: 75, y: 60, size: 36, delay: 0.5,
  },
  { // Shield
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    x: 30, y: 70, size: 32, delay: 1,
  },
  { // Gavel
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M14.5 2l5 5-5 5-5-5 5-5zM3 21l6-6M2 22l1-1"/><rect x="8" y="8" width="8" height="2" rx="1" transform="rotate(45 12 9)"/></svg>`,
    x: 65, y: 25, size: 34, delay: 1.5,
  },
  { // Paragraph
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M13 4v16M17 4v16M13 4h4a4 4 0 010 8h-4"/></svg>`,
    x: 50, y: 85, size: 28, delay: 2,
  },
  { // Pillar
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 2h12l-2 4H8L6 2zM8 6v12M16 6v12M6 18h12l2 4H4l2-4z"/></svg>`,
    x: 85, y: 80, size: 30, delay: 0.8,
  },
];

const TYPEWRITER_TEXT = "Hukuk Arastirma Asistani";

export default function GirisPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shake, setShake] = useState(false);
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const router = useRouter();

  // Typewriter effect
  useEffect(() => {
    if (typewriterIndex < TYPEWRITER_TEXT.length) {
      const timer = setTimeout(() => setTypewriterIndex((i) => i + 1), 60);
      return () => clearTimeout(timer);
    }
  }, [typewriterIndex]);

  // Mouse tracking for parallax
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!leftPanelRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const result = await login(email, password);
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Giris basarisiz");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    setLoading(false);
  }, [email, password, login, router]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#09090B]">
      {/* Left Panel - Visual */}
      <div
        ref={leftPanelRef}
        onMouseMove={handleMouseMove}
        className="relative w-full md:w-[55%] min-h-[280px] md:min-h-screen overflow-hidden flex items-center justify-center"
      >
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6C6CFF]/20 via-[#09090B] to-[#A78BFA]/10" />
          <div
            className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
            style={{
              background: "radial-gradient(circle, #6C6CFF 0%, transparent 70%)",
              left: `${mousePos.x * 30}%`,
              top: `${mousePos.y * 30}%`,
              transition: "left 0.8s ease-out, top 0.8s ease-out",
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
            style={{
              background: "radial-gradient(circle, #A78BFA 0%, transparent 70%)",
              right: `${(1 - mousePos.x) * 20}%`,
              bottom: `${(1 - mousePos.y) * 20}%`,
              transition: "right 1s ease-out, bottom 1s ease-out",
            }}
          />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating icons */}
        <div className="absolute inset-0 hidden md:block">
          {FLOATING_ICONS.map((icon, i) => (
            <motion.div
              key={i}
              className="absolute text-[#6C6CFF]/20"
              style={{
                left: `${icon.x}%`,
                top: `${icon.y}%`,
                width: icon.size,
                height: icon.size,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: (mousePos.x - 0.5) * (15 + i * 5),
                y: (mousePos.y - 0.5) * (15 + i * 5),
              }}
              transition={{
                opacity: { delay: icon.delay, duration: 0.8 },
                scale: { delay: icon.delay, duration: 0.8 },
                x: { duration: 1.2, ease: "easeOut" },
                y: { duration: 1.2, ease: "easeOut" },
              }}
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
          ))}
        </div>

        {/* Center content */}
        <div className="relative z-10 text-center px-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex items-center justify-center glow-accent">
              <span className="text-white text-3xl font-bold">L</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            <span className="gradient-text">Lexora</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-3 h-6"
          >
            <span className="text-[16px] text-[#8B8B8E] font-[family-name:var(--font-serif)]">
              {TYPEWRITER_TEXT.slice(0, typewriterIndex)}
              <span className="animate-pulse text-[#6C6CFF]">|</span>
            </span>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-10 hidden md:flex items-center justify-center gap-8"
          >
            {[
              { value: "500+", label: "Avukat" },
              { value: "1M+", label: "Karar" },
              { value: "50+", label: "Baro" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-[20px] font-bold text-[#ECECEE]">{stat.value}</p>
                <p className="text-[11px] text-[#5C5C5F] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-[400px] space-y-8"
        >
          {/* Header */}
          <div>
            <h2 className="text-[24px] font-semibold text-[#ECECEE] tracking-tight">
              Hosgeldiniz
            </h2>
            <p className="text-[14px] text-[#5C5C5F] mt-1">
              Hesabiniza giris yapin
            </p>
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {/* Email */}
            <div>
              <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">
                E-posta
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C5F]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="avukat@ornek.com"
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">
                Sifre
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C5F]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-11 pr-12 py-3 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${
                    rememberMe
                      ? "bg-[#6C6CFF] border-[#6C6CFF]"
                      : "border-white/[0.15] group-hover:border-white/[0.25]"
                  }`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </motion.svg>
                  )}
                </div>
                <span className="text-[12px] text-[#5C5C5F] group-hover:text-[#8B8B8E] transition-colors">
                  Beni hatirla
                </span>
              </label>
              <a href="/sifremi-unuttum" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
                Sifremi unuttum
              </a>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span className="text-[13px] text-[#E5484D]">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="relative w-full py-3 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] hover:from-[#5B5BEE] hover:to-[#6C6CFF] disabled:from-[#6C6CFF]/30 disabled:to-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-xl text-[14px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden group"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                />
              )}
              {loading ? "Giris yapiliyor..." : "Giris Yap"}
            </button>
          </motion.form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-[#09090B] text-[12px] text-[#5C5C5F]">veya</span>
            </div>
          </div>

          {/* Register link */}
          <p className="text-center text-[14px] text-[#5C5C5F]">
            Hesabiniz yok mu?{" "}
            <a
              href="/kayit"
              className="text-[#6C6CFF] hover:text-[#8B8BFF] font-medium transition-colors"
            >
              Ucretsiz Kayit Ol
            </a>
          </p>

          {/* Footer */}
          <p className="text-center text-[11px] text-[#3A3A3F]">
            Giris yaparak Kullanim Sartlari ve Gizlilik Politikasi&apos;ni kabul etmis olursunuz.
          </p>
        </motion.div>
      </div>
    </div>
  );
}