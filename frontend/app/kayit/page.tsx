"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BAROLAR = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara",
  "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman",
  "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne",
  "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri",
  "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya",
  "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde",
  "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop",
  "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van",
  "Yalova", "Yozgat", "Zonguldak",
].map((b) => `${b} Barosu`);

/* ─── Searchable Baro Dropdown ─── */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g");
}

function BaroDropdown({
  value,
  onChange,
  inputCls,
}: {
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return BAROLAR;
    const q = normalize(search.trim());
    return BAROLAR.filter((b) => normalize(b).includes(q));
  }, [search]);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
      setSearch("");
      setActiveIdx(0);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      e.preventDefault();
      onChange(filtered[activeIdx]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.children[activeIdx] as HTMLElement;
      if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={inputCls + " cursor-pointer text-left flex items-center justify-between"}
      >
        <span className={value ? "text-[#ECECEE]" : "text-[#3A3A3F]"}>
          {value || "Baro Seçin (isteğe bağlı)"}
        </span>
        <div className="flex items-center gap-1.5">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="text-[#5C5C5F] hover:text-[#E5484D] transition-colors p-0.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-[#5C5C5F]">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search input */}
            <div className="p-2 border-b border-white/[0.06]">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5C5C5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Baro ara..."
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#5C5C5F]">Sonuç bulunamadı</div>
              ) : (
                filtered.map((b, i) => (
                  <button
                    key={b}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(b);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between transition-colors ${
                      i === activeIdx ? "bg-[#6C6CFF]/[0.08] text-[#ECECEE]" : "text-[#8B8B8E] hover:bg-white/[0.03]"
                    } ${value === b ? "text-[#6C6CFF]" : ""}`}
                  >
                    {b}
                    {value === b && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 border-t border-white/[0.06] text-[10px] text-[#5C5C5F]">
              {filtered.length} baro
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#5C5C5F" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20, label: "Zayif", color: "#E5484D" };
  if (score <= 2) return { score: 40, label: "Orta", color: "#FFB224" };
  if (score <= 3) return { score: 60, label: "Iyi", color: "#FFB224" };
  if (score <= 4) return { score: 80, label: "Guclu", color: "#3DD68C" };
  return { score: 100, label: "Cok Guclu", color: "#3DD68C" };
}

const STEPS = [
  { title: "Kisisel Bilgiler", desc: "Ad, e-posta ve sifre" },
  { title: "Mesleki Bilgiler", desc: "Baro ve sicil numarasi" },
  { title: "Buro Bilgileri", desc: "Istege bagli" },
];

export default function KayitPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", password_confirm: "",
    baro: "", baro_sicil_no: "", phone: "",
    firma_adi: "", firma_email: "", firma_max_users: "5",
    hasFirm: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const update = (field: string, value: string | boolean) =>
    setForm((p) => ({ ...p, [field]: value }));

  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const canNext = () => {
    if (step === 0) return form.full_name && form.email && form.password.length >= 8 && form.password === form.password_confirm;
    if (step === 1) return true; // baro is optional
    if (step === 2) return acceptTerms;
    return false;
  };

  const handleNext = () => {
    setError(null);
    if (step === 0 && form.password !== form.password_confirm) {
      setError("Sifreler eslesmiyor");
      return;
    }
    if (step < 2) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = useCallback(async () => {
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
          account_type: form.hasFirm ? "firma" : "bireysel",
          firma_adi: form.hasFirm ? form.firma_adi : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Kayit basarisiz");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayit basarisiz");
    } finally {
      setLoading(false);
    }
  }, [form]);

  const inputCls = "w-full bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200";

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 mx-auto rounded-2xl bg-[#3DD68C]/10 flex items-center justify-center glow-success"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
          <div>
            <h2 className="text-[22px] font-semibold text-[#ECECEE]">Kaydiniz Alindi!</h2>
            <p className="text-[14px] text-[#8B8B8E] mt-2 max-w-xs mx-auto">
              Hesabiniz admin onayi bekliyor. Onaylandiginda e-posta ile bilgilendirileceksiniz.
            </p>
          </div>
          <Link href="/giris" className="inline-block px-8 py-3 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] rounded-xl text-[14px] font-semibold text-white hover:from-[#5B5BEE] hover:to-[#6C6CFF] transition-all">
            Giris Sayfasina Don
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-8"
      >
        {/* Logo & Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex items-center justify-center mb-4 glow-accent">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-[24px] font-semibold text-[#ECECEE] tracking-tight">Hesap Olusturun</h1>
          <p className="text-[13px] text-[#5C5C5F] mt-1">3 adimda ucretsiz kayit</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
                  i < step ? "bg-[#3DD68C] text-white" :
                  i === step ? "bg-[#6C6CFF] text-white glow-accent" :
                  "bg-[#1A1A1F] text-[#5C5C5F]"
                }`}>
                  {i < step ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-[11px] font-medium ${i === step ? "text-[#ECECEE]" : "text-[#5C5C5F]"}`}>
                    {s.title}
                  </p>
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden bg-[#1A1A1F]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: i < step ? "#3DD68C" : i === step ? "#6C6CFF" : "transparent" }}
                  initial={{ width: 0 }}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Form Steps */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Personal */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="kayit-fullname" className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Ad Soyad *</label>
                  <input id="kayit-fullname" type="text" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Av. Mehmet Demir" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="kayit-email" className="block text-[12px] font-medium text-[#8B8B8E] mb-2">E-posta *</label>
                  <input id="kayit-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="avukat@ornek.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="kayit-password" className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Sifre * (en az 8 karakter)</label>
                  <input id="kayit-password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" className={inputCls} />
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px]" style={{ color: pwStrength.color }}>{pwStrength.label}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1A1A1F] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: pwStrength.color }}
                          animate={{ width: `${pwStrength.score}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="kayit-password-confirm" className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Sifre Tekrar *</label>
                  <input id="kayit-password-confirm" type="password" value={form.password_confirm} onChange={(e) => update("password_confirm", e.target.value)} placeholder="••••••••" className={inputCls} />
                  {form.password_confirm && form.password !== form.password_confirm && (
                    <p className="text-[11px] text-[#E5484D] mt-1">Sifreler eslesmiyor</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Professional */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Baro</label>
                  <BaroDropdown
                    value={form.baro}
                    onChange={(v) => update("baro", v)}
                    inputCls={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Baro Sicil Numarasi</label>
                  <input type="text" value={form.baro_sicil_no} onChange={(e) => update("baro_sicil_no", e.target.value)} placeholder="12345" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Telefon</label>
                  <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0532 123 4567" className={inputCls} />
                </div>
              </motion.div>
            )}

            {/* Step 3: Firm */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Firm toggle */}
                <div className="flex items-center gap-3 p-4 bg-[#09090B] rounded-xl">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasFirm as boolean}
                      onChange={(e) => update("hasFirm", e.target.checked)}
                      className="sr-only peer"
                      role="switch"
                      aria-checked={form.hasFirm as boolean}
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${form.hasFirm ? "bg-[#6C6CFF]" : "bg-[#1A1A1F]"}`}>
                      <motion.div
                        className="w-4 h-4 bg-white rounded-full absolute top-1"
                        animate={{ left: form.hasFirm ? 22 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </div>
                  </label>
                  <div>
                    <p className="text-[13px] font-medium text-[#ECECEE]">Hukuk Burosu Olustur</p>
                    <p className="text-[11px] text-[#5C5C5F]">Ekibinizi yonetin (istege bagli)</p>
                  </div>
                </div>

                <AnimatePresence>
                  {form.hasFirm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div>
                        <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Buro Adi *</label>
                        <input type="text" value={form.firma_adi} onChange={(e) => update("firma_adi", e.target.value)} placeholder="Yildirim & Partners" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-[#8B8B8E] mb-2">Buro E-postasi</label>
                        <input type="email" value={form.firma_email} onChange={(e) => update("firma_email", e.target.value)} placeholder="info@buro.com" className={inputCls} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div
                    className={`w-5 h-5 mt-0.5 rounded border-2 transition-all duration-200 flex items-center justify-center shrink-0 ${
                      acceptTerms ? "bg-[#6C6CFF] border-[#6C6CFF]" : "border-white/[0.15]"
                    }`}
                  >
                    {acceptTerms && (
                      <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </motion.svg>
                    )}
                  </div>
                  <span className="text-[12px] text-[#5C5C5F] leading-relaxed">
                    Kullanim Sartlari ve Gizlilik Politikasi&apos;ni okudum ve kabul ediyorum.
                  </span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              <span className="text-[13px] text-[#E5484D]">{error}</span>
            </motion.div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                onClick={() => { setStep(step - 1); setError(null); }}
                className="px-5 py-3 text-[13px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] border border-white/[0.06] hover:border-white/[0.10] rounded-xl transition-all"
              >
                Geri
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canNext() || loading}
              className="flex-1 py-3 bg-gradient-to-r from-[#6C6CFF] to-[#7B7BFF] hover:from-[#5B5BEE] hover:to-[#6C6CFF] disabled:from-[#6C6CFF]/20 disabled:to-[#6C6CFF]/20 disabled:cursor-not-allowed rounded-xl text-[14px] font-semibold text-white transition-all flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {step === 2 ? (loading ? "Kaydediliyor..." : "Kayit Ol") : "Devam Et"}
            </button>
          </div>
        </div>

        {/* Login link */}
        <p className="text-center text-[14px] text-[#5C5C5F]">
          Zaten hesabiniz var mi?{" "}
          <Link href="/giris" className="text-[#6C6CFF] hover:text-[#8B8BFF] font-medium transition-colors">
            Giris Yap
          </Link>
        </p>
      </motion.div>
    </div>
  );
}