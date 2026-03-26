"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (res.status === 429) {
          setError("Cok fazla talep gonderdiniz. Lutfen 30 dakika sonra tekrar deneyin.");
        } else {
          setSent(true);
        }
      } catch {
        setError("Bir hata olustu. Lutfen tekrar deneyin.");
      }
      setLoading(false);
    },
    [email]
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
            Sifremi Unuttum
          </h1>
          <p className="text-[15px] text-[#5C5C5F] mt-1">
            E-posta adresinize sifre sifirlama linki gonderecegiz.
          </p>
        </div>

        {sent ? (
          /* Success state */
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
            <h3 className="text-[17px] font-semibold text-[#ECECEE]">
              E-posta Gonderildi
            </h3>
            <p className="text-[15px] text-[#8B8B8E] leading-relaxed">
              <strong className="text-[#ECECEE]">{email}</strong> adresine sifre sifirlama linki gonderdik.
              Lutfen gelen kutunuzu (ve spam klasorunu) kontrol edin.
            </p>
            <p className="text-[13px] text-[#5C5C5F]">
              Link 1 saat boyunca gecerlidir.
            </p>
            <Link
              href="/giris"
              className="inline-block mt-2 text-[15px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
            >
              Giris sayfasina don
            </Link>
          </motion.div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#8B8B8E] mb-2">
                  E-posta Adresiniz
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
                    className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-[16px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-all duration-200"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span className="text-[15px] text-[#E5484D]">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] hover:from-[#5B5BEE] hover:to-[#6C6CFF] disabled:from-[#6C6CFF]/30 disabled:to-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-xl text-[16px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? "Gonderiliyor..." : "Sifirlama Linki Gonder"}
              </button>
            </div>

            <p className="text-center text-[15px] text-[#5C5C5F]">
              <Link href="/giris" className="text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
                Giris sayfasina don
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
