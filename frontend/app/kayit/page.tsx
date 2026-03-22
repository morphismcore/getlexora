"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KayitPage() {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", baro_sicil_no: "", baro: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) return;
    if (form.password.length < 8) { setError("Şifre en az 8 karakter olmalı"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          baro_sicil_no: form.baro_sicil_no || null,
          baro: form.baro || null,
          phone: form.phone || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Kayıt başarısız");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }, [form]);

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#3DD68C]/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[#ECECEE]">Kaydınız Alındı</h2>
          <p className="text-[14px] text-[#8B8B8E]">
            Hesabınız admin onayı bekliyor. Onaylandığınızda giriş yapabileceksiniz.
          </p>
          <a href="/giris" className="inline-block px-6 py-2.5 bg-[#6C6CFF] rounded-lg text-[14px] font-medium text-white hover:bg-[#5B5BEE] transition-colors">
            Giriş Sayfasına Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#6C6CFF]/[0.12] flex items-center justify-center mb-4">
            <span className="text-[#6C6CFF] text-xl font-bold">L</span>
          </div>
          <h1 className="text-[20px] font-semibold text-[#ECECEE]">Kayıt Ol</h1>
          <p className="text-[13px] text-[#5C5C5F] mt-1">Lexora hesabı oluşturun</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">Ad Soyad *</label>
            <input type="text" required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Av. Mehmet Demir" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">E-posta *</label>
            <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="avukat@ornek.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">Şifre * (en az 8 karakter)</label>
            <input type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">Baro Sicil No</label>
              <input type="text" value={form.baro_sicil_no} onChange={(e) => update("baro_sicil_no", e.target.value)} placeholder="12345" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">Baro</label>
              <input type="text" value={form.baro} onChange={(e) => update("baro", e.target.value)} placeholder="İstanbul Barosu" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#5C5C5F] mb-1">Telefon</label>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0532 123 4567" className={inputCls} />
          </div>

          {error && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-lg p-3 text-[13px] text-[#E5484D]">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/30 rounded-lg text-[14px] font-medium text-white transition-colors flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#5C5C5F]">
          Zaten hesabınız var mı?{" "}
          <a href="/giris" className="text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Giriş Yap</a>
        </p>
      </div>
    </div>
  );
}
