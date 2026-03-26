"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/ui/auth-provider";
import { motion, AnimatePresence } from "motion/react";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

export default function GirisPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shake, setShake] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  // Check for expired session redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setExpired(params.get('expired') === '1');
    }
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
      <AuthBrandPanel />

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
            <p className="text-[16px] text-[#5C5C5F] mt-1">
              Hesabiniza giris yapin
            </p>
          </div>

          {/* Expired session warning */}
          {expired && (
            <div role="alert" className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB224" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="text-[15px] text-[#FFB224]">Oturumunuz sona erdi. Lutfen tekrar giris yapin.</span>
            </div>
          )}

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {/* Email */}
            <div>
              <label htmlFor="giris-email" className="block text-[14px] font-medium text-[#8B8B8E] mb-2">
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
                  id="giris-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="avukat@ornek.com"
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-[16px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="giris-password" className="block text-[14px] font-medium text-[#8B8B8E] mb-2">
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
                  id="giris-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-xl pl-11 pr-12 py-3.5 text-[16px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200"
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? "bg-[#6C6CFF] border-[#6C6CFF]" : "border-[#5C5C5F] bg-transparent"}`}>
                  {rememberMe && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12"><path d="M3.5 6l2 2 3-4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-[14px] text-[#8B8B8E]">Beni hatirla</span>
              </label>
              <Link href="/sifremi-unuttum" className="text-[14px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
                Sifremi unuttum
              </Link>
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
                  <span className="text-[15px] text-[#E5484D]">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="relative w-full py-3.5 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] hover:from-[#5B5BEE] hover:to-[#6C6CFF] disabled:from-[#6C6CFF]/30 disabled:to-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-xl text-[16px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden group"
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
              <span className="px-4 bg-[#09090B] text-[14px] text-[#5C5C5F]">veya</span>
            </div>
          </div>

          {/* Register link */}
          <p className="text-center text-[16px] text-[#5C5C5F]">
            Hesabiniz yok mu?{" "}
            <Link
              href="/kayit"
              className="text-[#6C6CFF] hover:text-[#8B8BFF] font-medium transition-colors"
            >
              Ucretsiz Kayit Ol
            </Link>
          </p>

          {/* Footer */}
          <p className="text-center text-[13px] text-[#3A3A3F]">
            Giris yaparak Kullanim Sartlari ve Gizlilik Politikasi&apos;ni kabul etmis olursunuz.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
