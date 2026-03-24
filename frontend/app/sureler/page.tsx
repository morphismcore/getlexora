"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */
interface CaseItem { id: string; title: string; court: string | null; status: string; }
interface EventType { value: string; label: string; description: string; }
interface DeadlineItem {
  name: string; law_reference: string; duration: string;
  deadline_date: string; business_days_left: number;
  urgency: "normal" | "warning" | "critical" | "expired"; note: string;
}
interface CalculateResponse { event_type: string; event_date: string; deadlines: DeadlineItem[]; }
interface SavedDeadline {
  id: string; title: string; deadline_date: string; deadline_type: string;
  description: string; completed: boolean; case_id: string; case_title?: string;
}

/* ─── Constants ─── */
const STATUS_LABELS: Record<string, string> = { active: "Aktif", closed: "Kapalı", pending: "Beklemede", archived: "Arşiv" };

const EVENT_TYPES: EventType[] = [
  { value: "karar_teblig", label: "Karar Tebliği (Hukuk)", description: "Hukuk mahkemesi kararının tebliğ edilmesi" },
  { value: "ceza_karar_teblig", label: "Karar Tebliği (Ceza)", description: "Ceza mahkemesi kararının tebliğ edilmesi" },
  { value: "temyiz_teblig", label: "Temyiz Süresi (Yargıtay)", description: "Yargıtay'a temyiz başvurusu — 15 gün" },
  { value: "istinaf_teblig", label: "İstinaf Süresi (BAM)", description: "Bölge Adliye Mahkemesi'ne istinaf — 14 gün" },
  { value: "itiraz_teblig", label: "İtiraz Süresi", description: "Karara itiraz — 7 gün" },
  { value: "karar_duzeltme", label: "Karar Düzeltme", description: "Karar düzeltme başvurusu — 15 gün" },
  { value: "fesih_bildirimi", label: "İş Sözleşmesi Fesih Bildirimi", description: "İş sözleşmesinin feshedildiğinin bildirilmesi" },
  { value: "is_kazasi", label: "İş Kazası", description: "İş kazası meydana gelmesi" },
  { value: "dava_acilma", label: "Dava Açılması (Tebliğ)", description: "Dava dilekçesinin davalıya tebliği" },
  { value: "kira_sozlesmesi", label: "Kira Sözleşmesi", description: "Kira sözleşmesi ile ilgili süreler" },
  { value: "icra_takibi", label: "İcra Takibi (Ödeme Emri)", description: "Ödeme emrinin borçluya tebliği" },
  { value: "bosanma", label: "Boşanma", description: "Boşanma davası süreleri" },
  { value: "idari_islem", label: "İdari İşlem Tebliği", description: "İdari işlemin ilgilisine tebliği" },
  { value: "zamanasimi_is", label: "Zamanaşımı (İş Hukuku)", description: "İşçi alacakları zamanaşımı — 5 yıl" },
  { value: "zamanasimi_ceza", label: "Zamanaşımı (Ceza)", description: "Ceza davası zamanaşımı" },
];

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const RESMI_TATILLER_2026 = [
  "2026-01-01", "2026-04-23", "2026-05-01", "2026-05-19",
  "2026-06-15", "2026-06-16", "2026-06-17", "2026-07-15",
  "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25",
  "2026-08-30", "2026-10-29",
];

/* ─── Helpers ─── */
function getUrgencyConfig(urgency: string) {
  switch (urgency) {
    case "critical": return { label: "Kritik", dot: "bg-[#E5484D]", border: "border-[#E5484D]/20", bg: "bg-[#E5484D]/[0.03]", text: "text-[#E5484D]", badge: "bg-[#E5484D]/10 text-[#E5484D]" };
    case "warning": return { label: "Uyarı", dot: "bg-[#FFB224]", border: "border-[#FFB224]/20", bg: "bg-[#FFB224]/[0.03]", text: "text-[#FFB224]", badge: "bg-[#FFB224]/10 text-[#FFB224]" };
    case "expired": return { label: "Süresi Dolmuş", dot: "bg-[#E5484D]", border: "border-[#E5484D]/30", bg: "bg-[#E5484D]/[0.05]", text: "text-[#E5484D]", badge: "bg-[#E5484D]/15 text-[#E5484D]" };
    default: return { label: "Normal", dot: "bg-[#3DD68C]", border: "border-[#3DD68C]/20", bg: "bg-[#3DD68C]/[0.03]", text: "text-[#3DD68C]", badge: "bg-[#3DD68C]/10 text-[#3DD68C]" };
  }
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyFromDays(days: number): string {
  if (days < 0) return "expired";
  if (days <= 3) return "critical";
  if (days <= 7) return "warning";
  return "normal";
}

/* ─── Mini Calendar ─── */
function MiniCalendar({ highlightDate }: { highlightDate?: string }) {
  const targetDate = highlightDate ? new Date(highlightDate + "T00:00:00") : new Date();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4">
      <p className="text-[13px] font-medium text-[#ECECEE] mb-3 text-center">{TR_MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 gap-1">
        {TR_DAYS_SHORT.map((d) => (
          <div key={d} className="text-[10px] text-[#5C5C5F] text-center font-medium pb-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isTarget = dateStr === highlightDate;
          const isToday = dateStr === todayStr;
          const isHoliday = RESMI_TATILLER_2026.includes(dateStr);

          return (
            <div
              key={i}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] relative ${
                isTarget ? "bg-[#6C6CFF] text-white font-bold shadow-[0_0_10px_rgba(108,108,255,0.3)]" :
                isToday ? "bg-white/[0.06] text-[#ECECEE] font-medium ring-1 ring-white/[0.10]" :
                "text-[#8B8B8E] hover:bg-white/[0.03]"
              }`}
            >
              {day}
              {isHoliday && !isTarget && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#E5484D]" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Countdown Display ─── */
function CountdownDisplay({ days, urgency }: { days: number; urgency: string }) {
  const config = getUrgencyConfig(urgency);
  return (
    <div className={`relative bg-[#111113] border ${config.border} rounded-2xl p-6 text-center overflow-hidden`}>
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${config.text.includes("E5484D") ? "#E5484D" : config.text.includes("FFB224") ? "#FFB224" : "#3DD68C"}, transparent 70%)` }} />
      <div className="relative">
        <p className={`text-[48px] font-bold tabular-nums leading-none ${config.text}`}>
          {days < 0 ? "−" + Math.abs(days) : days}
        </p>
        <p className="text-[13px] text-[#8B8B8E] mt-2">{days < 0 ? "gün geçti" : "gün kaldı"}</p>
        <span className={`inline-flex items-center px-2.5 py-0.5 mt-3 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${config.badge}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

/* ─── Saved Deadline Card ─── */
function SavedDeadlineCard({ dl }: { dl: SavedDeadline }) {
  const days = daysUntil(dl.deadline_date);
  const urgency = dl.completed ? "normal" : getUrgencyFromDays(days);
  const config = getUrgencyConfig(urgency);

  return (
    <div className={`bg-[#111113] border ${dl.completed ? "border-white/[0.06] opacity-60" : config.border} rounded-xl p-4 transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`text-[13px] font-medium ${dl.completed ? "text-[#5C5C5F] line-through" : "text-[#ECECEE]"}`}>{dl.title}</h3>
          {dl.description && <p className="text-[11px] text-[#5C5C5F] mt-0.5 font-mono">{dl.description}</p>}
          {dl.case_title && (
            <p className="text-[11px] text-[#6C6CFF] mt-1">📂 {dl.case_title}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${config.badge}`}>
            {dl.completed ? "Tamamlandı" : config.label}
          </span>
          <p className={`text-[12px] mt-1 tabular-nums ${config.text}`}>
            {formatDate(dl.deadline_date).split(",")[0]}
          </p>
          {!dl.completed && (
            <p className={`text-[11px] font-medium ${config.text}`}>
              {days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün kaldı`}
            </p>
          )}
        </div>
      </div>
      {!dl.completed && days > 0 && days <= 30 && (
        <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: config.text.includes("E5484D") ? "#E5484D" : config.text.includes("FFB224") ? "#FFB224" : "#3DD68C" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, 100 - (days / 30) * 100)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Motion Variants ─── */
const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const listItem = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function SurelerPage() {
  const [activeTab, setActiveTab] = useState<"calculate" | "my">("calculate");

  // Calculator state
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dateType, setDateType] = useState<"teblig" | "ogrenme">("teblig");
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My deadlines state
  const [savedDeadlines, setSavedDeadlines] = useState<SavedDeadline[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "urgency">("date");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Case dropdown
  const [activeCaseDropdown, setActiveCaseDropdown] = useState<number | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);

  const selectedEvent = EVENT_TYPES.find((e) => e.value === eventType);

  // Active deadline count for tab badge
  const activeDeadlineCount = useMemo(() =>
    savedDeadlines.filter((d) => !d.completed).length
  , [savedDeadlines]);

  // Sorted/filtered deadlines
  const filteredDeadlines = useMemo(() => {
    let list = showCompleted ? savedDeadlines : savedDeadlines.filter((d) => !d.completed);
    if (sortBy === "date") {
      list = [...list].sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());
    } else {
      list = [...list].sort((a, b) => daysUntil(a.deadline_date) - daysUntil(b.deadline_date));
    }
    return list;
  }, [savedDeadlines, showCompleted, sortBy]);

  // Effects
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(e.target as Node)) setActiveCaseDropdown(null);
    }
    if (activeCaseDropdown !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeCaseDropdown]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  // Fetch saved deadlines
  useEffect(() => {
    async function fetchDeadlines() {
      const token = localStorage.getItem("lexora_token");
      if (!token) return;
      setDeadlinesLoading(true);
      try {
        const casesRes = await fetch(`${API_URL}/api/v1/cases`, { headers: { Authorization: `Bearer ${token}` } });
        if (!casesRes.ok) return;
        const casesData = await casesRes.json();
        const allCases = Array.isArray(casesData) ? casesData : casesData.cases || [];

        const allDeadlines: SavedDeadline[] = [];
        for (const c of allCases) {
          try {
            const dlRes = await fetch(`${API_URL}/api/v1/cases/${c.id}/deadlines`, { headers: { Authorization: `Bearer ${token}` } });
            if (dlRes.ok) {
              const dls = await dlRes.json();
              const items = Array.isArray(dls) ? dls : dls.deadlines || [];
              for (const d of items) {
                allDeadlines.push({ ...d, case_id: c.id, case_title: c.title, completed: d.completed ?? false });
              }
            }
          } catch { /* skip */ }
        }
        setSavedDeadlines(allDeadlines);
      } catch { /* ignore */ }
      finally { setDeadlinesLoading(false); }
    }
    if (activeTab === "my") fetchDeadlines();
  }, [activeTab]);

  const fetchCases = useCallback(async () => {
    const token = localStorage.getItem("lexora_token");
    if (!token) { setCasesError("Giriş yapın"); return; }
    setCasesLoading(true); setCasesError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Davalar yüklenemedi");
      const data = await res.json();
      setCases(Array.isArray(data) ? data : data.cases || []);
    } catch { setCasesError("Davalar yüklenemedi"); }
    finally { setCasesLoading(false); }
  }, []);

  const handleSaveDeadlineToCase = useCallback(async (caseId: string, dl: DeadlineItem) => {
    const token = localStorage.getItem("lexora_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/cases/${caseId}/deadlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: dl.name, deadline_date: dl.deadline_date, deadline_type: "hak_dusurucusu", description: dl.law_reference }),
      });
      if (!res.ok) throw new Error("Kaydetme başarısız");
      setToast("Süre davaya eklendi");
    } catch { setToast("Kaydetme başarısız oldu"); }
    setActiveCaseDropdown(null);
  }, []);

  const handleCalculate = useCallback(async () => {
    if (!eventType || !eventDate) return;
    setLoading(true); setError(null); setResults(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_URL}/api/v1/deadlines/calculate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, event_date: eventDate }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.detail || `Hesaplama başarısız (${res.status})`); }
      setResults(await res.json());
    } catch (err) {
      clearTimeout(timeout);
      setError(err instanceof Error && err.name === "AbortError" ? "İstek zaman aşımına uğradı." : (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally { setLoading(false); }
  }, [eventType, eventDate]);

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#ECECEE]">Süre Hesapla</h1>
          <p className="text-[13px] text-[#5C5C5F] mt-0.5">Türk hukuk sistemindeki yasal süreleri otomatik hesaplayın</p>
        </div>
        <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Yazdır
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 no-print">
        {[
          { key: "calculate" as const, label: "Süre Hesapla" },
          { key: "my" as const, label: "Sürelerim", badge: activeDeadlineCount },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 ${activeTab === tab.key ? "text-[#ECECEE]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#6C6CFF]/10 text-[#6C6CFF] text-[10px] font-bold">{tab.badge}</span>
            )}
            {activeTab === tab.key && (
              <motion.div layoutId="sureTab" className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6C6CFF] rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Calculator Tab ── */}
      {activeTab === "calculate" && (
        <div className="space-y-6">
          {/* Form card */}
          <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#8B8B8E]">Olay Tipi</label>
              <select value={eventType} onChange={(e) => { setEventType(e.target.value); setResults(null); }}
                className="w-full appearance-none bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors cursor-pointer">
                <option value="" disabled>Olay tipi seçin...</option>
                {EVENT_TYPES.map((et) => (<option key={et.value} value={et.value}>{et.label}</option>))}
              </select>
              {selectedEvent && <p className="text-[11px] text-[#5C5C5F]">{selectedEvent.description}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#8B8B8E]">Süre Başlangıcı</label>
              <div className="flex gap-2">
                <button onClick={() => setDateType("teblig")}
                  className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-colors ${dateType === "teblig" ? "bg-[#6C6CFF]/10 border-[#6C6CFF]/50 text-[#6C6CFF]" : "bg-[#16161A] border-white/[0.06] text-[#5C5C5F]"}`}>
                  Tebliğ Tarihi
                </button>
                <button onClick={() => setDateType("ogrenme")}
                  className={`flex-1 py-2 text-[12px] font-medium rounded-lg border transition-colors ${dateType === "ogrenme" ? "bg-[#FFB224]/10 border-[#FFB224]/50 text-[#FFB224]" : "bg-[#16161A] border-white/[0.06] text-[#5C5C5F]"}`}>
                  Öğrenme Tarihi
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#8B8B8E]">{dateType === "teblig" ? "Tebliğ Tarihi" : "Öğrenme Tarihi"}</label>
              <input type="date" value={eventDate} onChange={(e) => { setEventDate(e.target.value); setResults(null); }}
                className="w-full bg-[#16161A] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors [color-scheme:dark]" />
            </div>

            <div className="flex justify-end">
              <button onClick={handleCalculate} disabled={loading || !eventType || !eventDate}
                className="px-5 py-2.5 bg-[#6C6CFF] hover:bg-[#7B7BFF] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-xl text-[13px] font-medium text-white transition-colors">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Hesaplanıyor...</span>
                  </div>
                ) : "Hesapla"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-3 text-[13px] text-[#E5484D]">
              {error}
              <button onClick={handleCalculate} className="block mt-2 text-[12px] text-[#E5484D]/80 hover:text-[#E5484D] underline underline-offset-2 transition-colors">Tekrar Dene</button>
            </div>
          )}

          {/* Results */}
          {results && results.deadlines.length > 0 && (
            <motion.div className="space-y-4" variants={listContainer} initial="hidden" animate="show">
              {/* Summary + Calendar row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[13px] font-medium text-[#ECECEE]">{results.deadlines.length} süre hesaplandı</span>
                    </div>
                    <p className="text-[12px] text-[#5C5C5F]">Olay tarihi: {formatDate(results.event_date)}</p>
                  </motion.div>

                  {/* First deadline countdown */}
                  <CountdownDisplay days={results.deadlines[0].business_days_left} urgency={results.deadlines[0].urgency} />

                  {/* Holiday warning */}
                  {results.deadlines.some((dl) => RESMI_TATILLER_2026.some((h) => {
                    const dlDate = new Date(dl.deadline_date);
                    const hDate = new Date(h);
                    const diff = Math.abs(dlDate.getTime() - hDate.getTime()) / (1000 * 60 * 60 * 24);
                    return diff <= 2;
                  })) && (
                    <div className="bg-[#FFB224]/[0.06] border border-[#FFB224]/15 rounded-xl p-3 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB224" strokeWidth={1.5}><path d="M12 9v2m0 4h.01M10.29 3.86l-8.79 15.2a1 1 0 00.87 1.5h17.58a1 1 0 00.87-1.5l-8.79-15.2a1 1 0 00-1.74 0z" /></svg>
                      <span className="text-[12px] text-[#FFB224]">Bazı süreler resmi tatil günlerine yakın düşüyor</span>
                    </div>
                  )}
                </div>

                {/* Mini calendar */}
                <MiniCalendar highlightDate={results.deadlines[0]?.deadline_date} />
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                {results.deadlines.map((dl, index) => {
                  const config = getUrgencyConfig(dl.urgency);
                  const isLast = index === results.deadlines.length - 1;
                  return (
                    <motion.div key={index} variants={listItem} className="relative flex gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${config.dot} flex-shrink-0 ring-2 ring-[#09090B]`} />
                        {!isLast && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
                      </div>
                      <div className={`flex-1 mb-3 border rounded-xl p-4 ${config.border} ${config.bg}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-medium text-[#ECECEE]">{dl.name}</h3>
                            <p className="text-[11px] text-[#5C5C5F] mt-0.5 font-mono">{dl.law_reference}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${config.badge}`}>{config.label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                          <span className={`text-[12px] font-medium ${config.text}`}>{formatDate(dl.deadline_date)}</span>
                          <span className="text-[11px] text-[#5C5C5F]">Süre: {dl.duration}</span>
                          <span className={`text-[11px] font-medium ${config.text}`}>
                            {dl.urgency === "expired" ? "Süresi dolmuş" : `${dl.business_days_left} iş günü kaldı`}
                          </span>
                        </div>
                        {dl.note && <p className="text-[11px] text-[#5C5C5F] mt-2 italic">{dl.note}</p>}

                        {/* Save to case */}
                        <div className="mt-3 flex justify-end no-print" ref={activeCaseDropdown === index ? caseDropdownRef : undefined}>
                          <div className="relative">
                            <button onClick={() => { activeCaseDropdown === index ? setActiveCaseDropdown(null) : (setActiveCaseDropdown(index), fetchCases()); }}
                              className="px-2.5 py-1.5 text-[11px] text-[#FFB224] hover:text-[#FFC656] bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-lg hover:border-[#FFB224]/40 transition-all">
                              Davaya Kaydet
                            </button>
                            {activeCaseDropdown === index && (
                              <div className="absolute right-0 bottom-full mb-1 w-72 bg-[#16161A] border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                                {casesLoading && <div className="flex items-center justify-center py-4"><div className="w-4 h-4 border-2 border-[#FFB224]/30 border-t-[#FFB224] rounded-full animate-spin" /></div>}
                                {casesError && <div className="px-3 py-3 text-[12px] text-[#E5484D]">{casesError}</div>}
                                {!casesLoading && !casesError && cases.length === 0 && <div className="px-3 py-3 text-[12px] text-[#5C5C5F]">Henüz dava yok</div>}
                                {!casesLoading && !casesError && cases.length > 0 && (
                                  <>
                                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F] border-b border-white/[0.06]">Dava Seçin</div>
                                    {cases.map((c) => (
                                      <button key={c.id} onClick={() => handleSaveDeadlineToCase(c.id, dl)}
                                        className="w-full text-left px-3 py-2 hover:bg-[#FFB224]/10 transition-colors border-b border-white/[0.04] last:border-0">
                                        <div className="text-[13px] text-[#ECECEE] truncate">{c.title}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {c.court && <span className="text-[11px] text-[#5C5C5F]">{c.court}</span>}
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${c.status === "active" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : c.status === "closed" ? "bg-[#E5484D]/10 text-[#E5484D]" : "bg-[#FFB224]/10 text-[#FFB224]"}`}>
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
              <div className="relative w-14 h-14 mb-3">
                <div className="absolute inset-0 bg-[#6C6CFF]/10 rounded-2xl blur-xl" />
                <div className="relative w-14 h-14 bg-[#111113] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#6C6CFF]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1} /><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} /></svg>
                </div>
              </div>
              <p className="text-[14px] text-[#8B8B8E] font-medium">Yasal süreleri hesaplayın</p>
              <p className="text-[12px] text-[#5C5C5F] mt-1 max-w-md">İstinaf, temyiz, itiraz, zamanaşımı ve diğer tüm yasal süreler otomatik hesaplanır</p>
            </div>
          )}
        </div>
      )}

      {/* ── My Deadlines Tab ── */}
      {activeTab === "my" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <button onClick={() => setSortBy("date")}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${sortBy === "date" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
                Tarihe Göre
              </button>
              <button onClick={() => setSortBy("urgency")}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${sortBy === "urgency" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
                Aciliyete Göre
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-8 h-5 rounded-full transition-colors relative ${showCompleted ? "bg-[#6C6CFF]" : "bg-[#1A1A1F]"}`}
                  onClick={() => setShowCompleted(!showCompleted)}>
                  <motion.div className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px]"
                    animate={{ left: showCompleted ? 16 : 3 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                </div>
                <span className="text-[12px] text-[#5C5C5F]">Tamamlananları Göster</span>
              </label>
            </div>
          </div>

          {/* Deadlines list */}
          {deadlinesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#6C6CFF]/30 border-t-[#6C6CFF] rounded-full animate-spin" />
            </div>
          ) : filteredDeadlines.length > 0 ? (
            <motion.div className="space-y-2.5" variants={listContainer} initial="hidden" animate="show">
              {filteredDeadlines.map((dl) => (
                <motion.div key={dl.id} variants={listItem}>
                  <SavedDeadlineCard dl={dl} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[14px] text-[#8B8B8E] font-medium">Henüz kayıtlı süre yok</p>
              <p className="text-[12px] text-[#5C5C5F] mt-1">Süre hesaplayıp davalarınıza kaydedin</p>
              <button onClick={() => setActiveTab("calculate")} className="mt-4 px-4 py-2 text-[13px] text-[#6C6CFF] bg-[#6C6CFF]/10 rounded-xl hover:bg-[#6C6CFF]/15 transition-colors">
                Süre Hesapla
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <span className="text-[13px] text-[#ECECEE]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}