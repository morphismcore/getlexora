"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CaseItem {
  id: string;
  title: string;
  court: string | null;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  closed: "Kapalı",
  pending: "Beklemede",
  archived: "Arşiv",
};

interface EventType {
  value: string;
  label: string;
  description: string;
}

interface DeadlineItem {
  name: string;
  law_reference: string;
  duration: string;
  deadline_date: string;
  business_days_left: number;
  urgency: "normal" | "warning" | "critical" | "expired";
  note: string;
}

interface CalculateResponse {
  event_type: string;
  event_date: string;
  deadlines: DeadlineItem[];
}

const EVENT_TYPES: EventType[] = [
  { value: "karar_teblig", label: "Karar Tebliği (Hukuk)", description: "Hukuk mahkemesi kararının tebliğ edilmesi" },
  { value: "ceza_karar_teblig", label: "Karar Tebliği (Ceza)", description: "Ceza mahkemesi kararının tebliğ edilmesi" },
  { value: "temyiz_teblig", label: "Temyiz Süresi (Yargıtay)", description: "Yargıtay'a temyiz başvurusu süresi — 15 gün" },
  { value: "istinaf_teblig", label: "İstinaf Süresi (BAM)", description: "Bölge Adliye Mahkemesi'ne istinaf başvurusu — 14 gün" },
  { value: "itiraz_teblig", label: "İtiraz Süresi", description: "Karara itiraz süresi — 7 gün" },
  { value: "karar_duzeltme", label: "Karar Düzeltme Süresi", description: "Karar düzeltme başvurusu — 15 gün" },
  { value: "fesih_bildirimi", label: "İş Sözleşmesi Fesih Bildirimi", description: "İş sözleşmesinin feshedildiğinin bildirilmesi" },
  { value: "is_kazasi", label: "İş Kazası", description: "İş kazası meydana gelmesi" },
  { value: "dava_acilma", label: "Dava Açılması (Tebliğ)", description: "Dava dilekçesinin davalıya tebliğ edilmesi" },
  { value: "kira_sozlesmesi", label: "Kira Sözleşmesi", description: "Kira sözleşmesi ile ilgili süreler" },
  { value: "icra_takibi", label: "İcra Takibi (Ödeme Emri Tebliği)", description: "Ödeme emrinin borçluya tebliğ edilmesi" },
  { value: "bosanma", label: "Boşanma", description: "Boşanma davası süreleri" },
  { value: "idari_islem", label: "İdari İşlem Tebliği", description: "İdari işlemin ilgilisine tebliğ edilmesi" },
  { value: "zamanasimi_is", label: "Zamanaşımı (İş Hukuku)", description: "İşçi alacakları zamanaşımı — 5 yıl" },
  { value: "zamanasimi_ceza", label: "Zamanaşımı (Ceza Hukuku)", description: "Ceza davası zamanaşımı süresi" },
];

function getUrgencyConfig(urgency: string) {
  switch (urgency) {
    case "critical":
      return {
        label: "Kritik",
        dotColor: "bg-[#E5484D]",
        borderColor: "border-[#E5484D]/20",
        bgColor: "bg-[#E5484D]/[0.03]",
        textColor: "text-[#E5484D]",
        badgeClass: "bg-[#E5484D]/10 text-[#E5484D]",
      };
    case "warning":
      return {
        label: "Uyarı",
        dotColor: "bg-[#FFB224]",
        borderColor: "border-[#FFB224]/20",
        bgColor: "bg-[#FFB224]/[0.03]",
        textColor: "text-[#FFB224]",
        badgeClass: "bg-[#FFB224]/10 text-[#FFB224]",
      };
    case "expired":
      return {
        label: "Süresi Dolmuş",
        dotColor: "bg-[#E5484D]",
        borderColor: "border-[#E5484D]/30",
        bgColor: "bg-[#E5484D]/[0.05]",
        textColor: "text-[#E5484D]",
        badgeClass: "bg-[#E5484D]/15 text-[#E5484D]",
      };
    default:
      return {
        label: "Normal",
        dotColor: "bg-[#3DD68C]",
        borderColor: "border-[#3DD68C]/20",
        bgColor: "bg-[#3DD68C]/[0.03]",
        textColor: "text-[#3DD68C]",
        badgeClass: "bg-[#3DD68C]/10 text-[#3DD68C]",
      };
  }
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SurelerPage() {
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dateType, setDateType] = useState<"teblig" | "ogrenme">("teblig");
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Davaya Kaydet state
  const [activeCaseDropdown, setActiveCaseDropdown] = useState<number | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);

  const selectedEvent = EVENT_TYPES.find((e) => e.value === eventType);

  // Close case dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(e.target as Node)) {
        setActiveCaseDropdown(null);
      }
    }
    if (activeCaseDropdown !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeCaseDropdown]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchCases = useCallback(async () => {
    const token = localStorage.getItem("lexora_token");
    if (!token) {
      setCasesError("Giriş yapın");
      return;
    }
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Davalar yüklenemedi");
      const data = await res.json();
      setCases(Array.isArray(data) ? data : data.cases || []);
    } catch {
      setCasesError("Davalar yüklenemedi");
    } finally {
      setCasesLoading(false);
    }
  }, []);

  const handleSaveDeadlineToCase = useCallback(async (caseId: string, dl: DeadlineItem) => {
    const token = localStorage.getItem("lexora_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/cases/${caseId}/deadlines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: dl.name,
          deadline_date: dl.deadline_date,
          deadline_type: "hak_dusurucusu",
          description: dl.law_reference,
        }),
      });
      if (!res.ok) throw new Error("Kaydetme başarısız");
      setToast("Süre davaya eklendi");
    } catch {
      setToast("Kaydetme başarısız oldu");
    }
    setActiveCaseDropdown(null);
  }, []);

  const handleCalculate = useCallback(async () => {
    if (!eventType || !eventDate) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/deadlines/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          event_date: eventDate,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Hesaplama başarısız (${res.status})`);
      }

      const data: CalculateResponse = await res.json();
      setResults(data);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
      }
    } finally {
      setLoading(false);
    }
  }, [eventType, eventDate]);

  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#ECECEE]">
          Süre Hesapla
        </h1>
        <p className="text-[12px] text-[#5C5C5F] mt-1">
          Türk hukuk sistemindeki yasal süreleri otomatik hesaplayın
        </p>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-[#8B8B8E]">Olay Tipi</label>
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setResults(null);
            }}
            className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150 appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8B8E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            <option value="" disabled className="text-[#5C5C5F]">
              Olay tipi seçin...
            </option>
            {EVENT_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
          {selectedEvent && (
            <p className="text-[11px] text-[#5C5C5F]">{selectedEvent.description}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-[#8B8B8E]">Süre Başlangıcı</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDateType("teblig")}
              className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-colors ${
                dateType === "teblig"
                  ? "bg-[#6C6CFF]/10 border-[#6C6CFF]/50 text-[#6C6CFF]"
                  : "bg-[#16161A] border-white/[0.06] text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              Tebliğ Tarihi
            </button>
            <button
              onClick={() => setDateType("ogrenme")}
              className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-colors ${
                dateType === "ogrenme"
                  ? "bg-[#FFB224]/10 border-[#FFB224]/50 text-[#FFB224]"
                  : "bg-[#16161A] border-white/[0.06] text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              Öğrenme Tarihi
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-[#8B8B8E]">
            {dateType === "teblig" ? "Tebliğ Tarihi" : "Öğrenme Tarihi"}
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => {
              setEventDate(e.target.value);
              setResults(null);
            }}
            className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150 [color-scheme:dark]"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCalculate}
            disabled={loading || !eventType || !eventDate}
            className="px-5 py-2 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[13px] font-medium text-white transition-colors duration-150"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Hesaplanıyor...</span>
              </div>
            ) : (
              "Hesapla"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
          {error}
          <button
            onClick={handleCalculate}
            className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Results */}
      {results && results.deadlines.length > 0 && (
        <motion.div
          className="space-y-3"
          variants={listContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div
            variants={listItem}
            className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="text-[13px] font-medium text-[#ECECEE]">
                {results.deadlines.length} süre hesaplandı
              </span>
            </div>
            <p className="text-[12px] text-[#5C5C5F]">
              Olay tarihi: {formatDate(results.event_date)}
            </p>
          </motion.div>

          <div className="relative space-y-0">
            {results.deadlines.map((dl, index) => {
              const config = getUrgencyConfig(dl.urgency);
              const isLast = index === results.deadlines.length - 1;

              return (
                <motion.div
                  key={index}
                  variants={listItem}
                  className="relative flex gap-4"
                >
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor} flex-shrink-0 ring-2 ring-[#09090B]`} />
                    {!isLast && (
                      <div className="w-px flex-1 bg-white/[0.06] my-1" />
                    )}
                  </div>

                  <div className={`flex-1 mb-3 border rounded-xl p-4 ${config.borderColor} ${config.bgColor}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-medium text-[#ECECEE] leading-snug">
                          {dl.name}
                        </h3>
                        <p className="text-[11px] text-[#5C5C5F] mt-0.5 font-mono">
                          {dl.law_reference}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ${config.badgeClass}`}
                      >
                        {config.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                      <div className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B8B8E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className={`text-[12px] font-medium ${config.textColor}`}>
                          {formatDate(dl.deadline_date)}
                        </span>
                      </div>

                      <span className="text-[11px] text-[#5C5C5F]">
                        Süre: {dl.duration}
                      </span>

                      <span className={`text-[11px] font-medium ${config.textColor}`}>
                        {dl.urgency === "expired"
                          ? "Süresi dolmuş"
                          : `${dl.business_days_left} iş günü kaldı`}
                      </span>
                    </div>

                    {dl.note && (
                      <p className="text-[11px] text-[#5C5C5F] mt-2 italic">
                        {dl.note}
                      </p>
                    )}

                    {/* Davaya Kaydet */}
                    <div className="mt-3 flex justify-end" ref={activeCaseDropdown === index ? caseDropdownRef : undefined}>
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (activeCaseDropdown === index) {
                              setActiveCaseDropdown(null);
                            } else {
                              setActiveCaseDropdown(index);
                              fetchCases();
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] text-[#FFB224] hover:text-[#FFC656] bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-lg hover:border-[#FFB224]/40 transition-all duration-150"
                        >
                          Davaya Kaydet
                        </button>
                        {activeCaseDropdown === index && (
                          <div className="absolute right-0 bottom-full mb-1 w-72 bg-[#16161A] border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                            {casesLoading && (
                              <div className="flex items-center justify-center py-4">
                                <div className="w-4 h-4 border-2 border-[#FFB224]/30 border-t-[#FFB224] rounded-full animate-spin" />
                              </div>
                            )}
                            {casesError && (
                              <div className="px-3 py-3 text-[12px] text-[#E5484D]">{casesError}</div>
                            )}
                            {!casesLoading && !casesError && cases.length === 0 && (
                              <div className="px-3 py-3 text-[12px] text-[#5C5C5F]">Henüz dava yok</div>
                            )}
                            {!casesLoading && !casesError && cases.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F] border-b border-white/[0.06]">
                                  Dava Seçin
                                </div>
                                {cases.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => handleSaveDeadlineToCase(c.id, dl)}
                                    className="w-full text-left px-3 py-2 hover:bg-[#FFB224]/10 transition-colors border-b border-white/[0.04] last:border-0"
                                  >
                                    <div className="text-[13px] text-[#ECECEE] truncate">{c.title}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {c.court && (
                                        <span className="text-[11px] text-[#5C5C5F]">{c.court}</span>
                                      )}
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${
                                        c.status === "active"
                                          ? "bg-[#3DD68C]/10 text-[#3DD68C]"
                                          : c.status === "closed"
                                          ? "bg-[#E5484D]/10 text-[#E5484D]"
                                          : "bg-[#FFB224]/10 text-[#FFB224]"
                                      }`}>
                                        {STATUS_LABELS[c.status] || c.status}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !results && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-10 h-10 text-[#5C5C5F]/40 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth={1} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6l4 2" />
          </svg>
          <p className="text-[13px] text-[#8B8B8E]">
            Olay tipini ve tarihini seçerek yasal süreleri hesaplayın
          </p>
          <p className="text-[12px] text-[#5C5C5F] mt-1 max-w-md">
            Sistem; istinaf, temyiz, itiraz, zamanaşımı ve diğer tüm yasal süreleri otomatik olarak hesaplayacaktır
          </p>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#16161A] border border-[#FFB224]/30 rounded-lg shadow-xl"
          >
            <span className="text-[13px] text-[#FFB224]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
