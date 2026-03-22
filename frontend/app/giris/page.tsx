"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/ui/auth-provider";

export default function GirisPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const result = await login(email, password);
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Giriş başarısız");
    }
    setLoading(false);
  }, [email, password, login, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#6C6CFF]/[0.12] flex items-center justify-center mb-4">
            <span className="text-[#6C6CFF] text-xl font-bold">L</span>
          </div>
          <h1 className="text-[20px] font-semibold text-[#ECECEE]">Lexora</h1>
          <p className="text-[13px] text-[#5C5C5F] mt-1">Hukuk Araştırma Asistanı</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1.5">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="avukat@ornek.com"
              className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1.5">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-lg p-3 text-[13px] text-[#E5484D]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-lg text-[14px] font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#5C5C5F]">
          Hesabınız yok mu?{" "}
          <a href="/kayit" className="text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
            Kayıt Ol
          </a>
        </p>
      </div>
    </div>
  );
}
