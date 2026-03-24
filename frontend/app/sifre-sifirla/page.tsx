"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SifreSifirlaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Gecersiz sifirlama linki. Lutfen yeni bir talep olusturun.");
    }
  }, [token]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < 8) {
        setError("Sifre en az 8 karakter olmalidir.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Sifre en az bir buyuk harf icermelidir.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Sifre en az bir rakam icermelidir.");
        return;
      }
      if (password !== confirm) {
        setError("Sifreler eslesmiyor.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, new_password: password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail || "Sifre sifirlanamadi");
        }

        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata olustu");
      }
      setLoading(false);
    },
    [password, confirm, token]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] space-y-6"
      >
        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex items-center justify-center">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-[20px] font-bold text-[#ECECEE] mt-4 tracking-tight">
            Yeni Sifre Belirle
          </h1>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111113] border border-[#3DD68C]/20 rounded-xl p-6 text-center space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-[#3DD68C]/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-[#ECECEE]">
              Sifreniz Degistirildi
            </h3>
            <p className="text-[13px] text-[#8B8B8E]">
              Yeni sifrenizle giris yapabilirsiniz.
            </p>
            <a
              href="/giris"
              className="inline-block mt-2 px-6 py-2.5 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] rounded-xl text-[14px] font-semibold text-white transition-all hover:from-[#5B5BEE] hover:to-[#6C6CFF]"
            >
              Giris Yap
            </a>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">
                  Yeni Sifre
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
                    placeholder="En az 8 karakter"
                    className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl pl-11 pr-12 py-3 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-all duration-200"
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
                {/* Password strength hints */}
                <div className="mt-2 flex gap-3 text-[11px]">
                  <span className={password.length >= 8 ? "text-[#3DD68C]" : "text-[#5C5C5F]"}>8+ karakter</span>
                  <span className={/[A-Z]/.test(password) ? "text-[#3DD68C]" : "text-[#5C5C5F]"}>Buyuk harf</span>
                  <span className={/[0-9]/.test(password) ? "text-[#3DD68C]" : "text-[#5C5C5F]"}>Rakam</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">
                  Sifre Tekrar
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C5F]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Sifreyi tekrar girin"
                    className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-all duration-200"
                  />
                </div>
                {confirm && password !== confirm && (
                  <p className="mt-1 text-[11px] text-[#E5484D]">Sifreler eslesmiyor</p>
                )}
              </div>

              {error && (
                <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span className="text-[13px] text-[#E5484D]">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm || !token}
                className="w-full py-3 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] hover:from-[#5B5BEE] hover:to-[#6C6CFF] disabled:from-[#6C6CFF]/30 disabled:to-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-xl text-[14px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? "Kaydediliyor..." : "Sifreyi Degistir"}
              </button>
            </div>

            <p className="text-center text-[13px] text-[#5C5C5F]">
              <a href="/giris" className="text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
                Giris sayfasina don
              </a>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
