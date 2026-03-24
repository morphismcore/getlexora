"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */

interface CaseDetail {
  id: string;
  title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
  opponent: string | null;
  assigned_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DeadlineCalcDetail {
  start_date: string;
  legal_duration: string;
  law_article: string;
  calculated_end: string;
  actual_end: string;
  extended_reason: string | null;
  skipped_days: { date: string; reason: string }[];
  remaining_calendar: number;
  remaining_business: number;
  law_text: string;
}

interface Deadline {
  id: string;
  name: string;
  deadline_date: string;
  original_date?: string | null;
  urgency: "critical" | "warning" | "normal" | "expired";
  days_left: number;
  is_completed: boolean;
  law_reference: string;
  duration: string;
  note: string;
  override?: {
    original_date: string;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  } | null;
  calc_detail?: DeadlineCalcDetail | null;
}

interface CaseEvent {
  id: string;
  event_type: string;
  event_type_label: string;
  event_date: string;
  note: string | null;
  created_at: string;
  deadlines: Deadline[];
}

interface EventTypeOption {
  value: string;
  label: string;
  description: string;
  is_frequent?: boolean;
}

interface ApplicableDeadline {
  key: string;
  name: string;
  duration: string;
  law_reference: string;
}

/* ─── Constants ─── */

const CASE_TYPES: Record<string, string> = {
  is_hukuku: "Is Hukuku",
  ceza: "Ceza",
  ticaret: "Ticaret",
  idare: "Idare",
  aile: "Aile",
};

const STATUS_COLORS: Record<string, string> = {
  aktif: "bg-[#3DD68C]/10 text-[#3DD68C]",
  beklemede: "bg-[#FFB224]/10 text-[#FFB224]",
  kapandi: "bg-[#5C5C5F]/10 text-[#5C5C5F]",
};

const TABS = [
  { key: "ozet", label: "Ozet" },
  { key: "olaylar", label: "Olaylar & Sureler" },
  { key: "durusmalar", label: "Durusmalar" },
  { key: "belgeler", label: "Belgeler" },
  { key: "notlar", label: "Notlar" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "karar_teblig", label: "Karar tebligi", description: "Hukuk mahkemesi kararinin teblig edilmesi", is_frequent: true },
  { value: "durusma", label: "Durusma", description: "Durusma yapilmasi", is_frequent: true },
  { value: "bilirkisi_raporu", label: "Bilirkisi raporu", description: "Bilirkisi raporunun teblig edilmesi", is_frequent: true },
  { value: "dava_acildi", label: "Dava acildi", description: "Dava dilekcessinin teblig edilmesi", is_frequent: true },
  { value: "ceza_karar_teblig", label: "Karar tebligi (Ceza)", description: "Ceza mahkemesi kararinin teblig edilmesi" },
  { value: "istinaf_teblig", label: "Istinaf suresi (BAM)", description: "Bolge Adliye Mahkemesine istinaf" },
  { value: "temyiz_teblig", label: "Temyiz suresi (Yargitay)", description: "Yargitaya temyiz basvurusu" },
  { value: "itiraz_teblig", label: "Itiraz suresi", description: "Karara itiraz" },
  { value: "karar_duzeltme", label: "Karar duzeltme", description: "Karar duzeltme basvurusu" },
  { value: "fesih_bildirimi", label: "Fesih bildirimi", description: "Is sozlesmesinin feshedilmesi" },
  { value: "icra_takibi", label: "Icra takibi (Odeme emri)", description: "Odeme emrinin borclura tebligi" },
  { value: "idari_islem", label: "Idari islem tebligi", description: "Idari islemin ilgilisine tebligi" },
];

const MOCK_APPLICABLE_DEADLINES: Record<string, ApplicableDeadline[]> = {
  karar_teblig: [
    { key: "istinaf", name: "Istinaf basvurusu", duration: "14 gun", law_reference: "HMK md. 345" },
    { key: "temyiz", name: "Temyiz basvurusu", duration: "30 gun", law_reference: "HMK md. 361" },
    { key: "yargilanma_yenilenmesi", name: "Yargilamanin yenilenmesi", duration: "60 gun", law_reference: "HMK md. 375" },
  ],
  ceza_karar_teblig: [
    { key: "istinaf_ceza", name: "Istinaf basvurusu (Ceza)", duration: "7 gun", law_reference: "CMK md. 273" },
    { key: "temyiz_ceza", name: "Temyiz basvurusu (Ceza)", duration: "15 gun", law_reference: "CMK md. 291" },
  ],
  durusma: [
    { key: "beyanda_bulunma", name: "Beyanda bulunma", duration: "14 gun", law_reference: "HMK md. 147" },
  ],
  bilirkisi_raporu: [
    { key: "bilirkisi_itiraz", name: "Bilirkisi raporuna itiraz", duration: "14 gun", law_reference: "HMK md. 281" },
  ],
  dava_acildi: [
    { key: "cevap_dilekce", name: "Cevap dilekcesi", duration: "14 gun", law_reference: "HMK md. 127" },
  ],
  istinaf_teblig: [
    { key: "istinaf", name: "Istinaf basvurusu", duration: "14 gun", law_reference: "HMK md. 345" },
  ],
  temyiz_teblig: [
    { key: "temyiz", name: "Temyiz basvurusu", duration: "15 gun", law_reference: "HMK md. 361" },
  ],
  itiraz_teblig: [
    { key: "itiraz", name: "Itiraz", duration: "7 gun", law_reference: "HMK md. 341" },
  ],
  karar_duzeltme: [
    { key: "karar_duzeltme", name: "Karar duzeltme", duration: "15 gun", law_reference: "HMK md. 363" },
  ],
  fesih_bildirimi: [
    { key: "ise_iade", name: "Ise iade davasi", duration: "30 gun", law_reference: "Is K. md. 20" },
  ],
  icra_takibi: [
    { key: "itiraz_icra", name: "Odeme emrine itiraz", duration: "7 gun", law_reference: "IIK md. 62" },
  ],
  idari_islem: [
    { key: "iptal_davasi", name: "Iptal davasi", duration: "60 gun", law_reference: "IYUK md. 7" },
    { key: "tam_yargi", name: "Tam yargi davasi", duration: "60 gun", law_reference: "IYUK md. 13" },
  ],
};

const OVERRIDE_REASONS = [
  "Hakim farkli sure verdi",
  "Ek sure verildi",
  "Tebligat tarihi duzeltmesi",
];

/* ─── Helpers ─── */

function formatDateTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateShortTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getDayNameTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { weekday: "long" });
  } catch {
    return "";
  }
}

function getUrgencyStyle(daysLeft: number, isCompleted: boolean, isExpired: boolean) {
  if (isCompleted) {
    return { bg: "bg-[#3DD68C]/5", border: "border-l-4 border-[#3DD68C]", dot: "bg-[#3DD68C]", text: "text-[#3DD68C]" };
  }
  if (isExpired || daysLeft < 0) {
    return { bg: "bg-[#5C5C5F]/5", border: "border-l-4 border-[#5C5C5F]", dot: "bg-[#5C5C5F]", text: "text-[#5C5C5F]" };
  }
  if (daysLeft <= 3) {
    return { bg: "bg-[#E5484D]/5", border: "border-l-4 border-[#E5484D]", dot: "bg-[#E5484D]", text: "text-[#E5484D]" };
  }
  if (daysLeft <= 7) {
    return { bg: "bg-[#FFB224]/5", border: "border-l-4 border-[#FFB224]", dot: "bg-[#FFB224]", text: "text-[#FFB224]" };
  }
  if (daysLeft <= 14) {
    return { bg: "bg-[#F5D90A]/5", border: "border-l-4 border-[#F5D90A]", dot: "bg-[#F5D90A]", text: "text-[#F5D90A]" };
  }
  return { bg: "bg-[#3DD68C]/5", border: "border-l-4 border-[#3DD68C]", dot: "bg-[#3DD68C]", text: "text-[#3DD68C]" };
}

/* ─── API helpers ─── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lexora_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (res.status === 401) {
    localStorage.removeItem("lexora_token");
    throw new Error("Oturum suresi doldu. Lutfen tekrar giris yapin.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

/* ─── Components ─── */

function UrgencyBanner({ events }: { events: CaseEvent[] }) {
  const allDeadlines = events.flatMap((e) => e.deadlines);
  const active = allDeadlines.filter((d) => !d.is_completed);
  const critical = active.filter((d) => d.days_left <= 3 && d.days_left >= 0);
  const expiringSoon = active.filter((d) => d.days_left > 0 && d.days_left <= 7);
  const expired = active.filter((d) => d.days_left < 0);

  if (critical.length === 0 && expired.length === 0 && expiringSoon.length === 0) return null;

  const hasCritical = critical.length > 0 || expired.length > 0;

  return (
    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${hasCritical ? "bg-[#E5484D]/10 border border-[#E5484D]/20" : "bg-[#FFB224]/10 border border-[#FFB224]/20"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasCritical ? "#E5484D" : "#FFB224"} strokeWidth={2} className="shrink-0">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold ${hasCritical ? "text-[#E5484D]" : "text-[#FFB224]"}`}>
          {critical.length > 0 && `${critical.length} KRITIK SURE`}
          {critical.length > 0 && expired.length > 0 && " \u00b7 "}
          {expired.length > 0 && `${expired.length} sure gecti`}
          {(critical.length > 0 || expired.length > 0) && expiringSoon.length > 0 && " \u00b7 "}
          {expiringSoon.length > 0 && `${expiringSoon.length} sure ${expiringSoon[0]?.days_left} gun icinde dolacak`}
        </p>
      </div>
    </div>
  );
}

function CalcDetailPanel({ detail }: { detail: DeadlineCalcDetail }) {
  return (
    <div className="mt-3 bg-[#0C0C0E] border border-white/[0.04] rounded-lg p-4 space-y-3 font-mono text-[12px]">
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
        <span className="text-[#5C5C5F]">Baslangic tarihi:</span>
        <span className="text-[#ECECEE]">{formatDateTR(detail.start_date)}</span>

        <span className="text-[#5C5C5F]">Yasal sure:</span>
        <span className="text-[#ECECEE]">{detail.legal_duration} ({detail.law_article})</span>

        <span className="text-[#5C5C5F]">Hesaplanan bitis:</span>
        <span className="text-[#ECECEE]">{formatDateTR(detail.calculated_end)} ({getDayNameTR(detail.calculated_end)})</span>

        {detail.extended_reason && (
          <>
            <span className="text-[#FFB224]">Son gun tatil:</span>
            <span className="text-[#FFB224]">{formatDateTR(detail.actual_end)} {getDayNameTR(detail.actual_end)}e uzatildi</span>
          </>
        )}
      </div>

      {detail.skipped_days && detail.skipped_days.length > 0 && (
        <div className="pt-2 border-t border-white/[0.04]">
          <p className="text-[#5C5C5F] mb-1.5">Atlanan gunler:</p>
          <div className="space-y-0.5">
            {detail.skipped_days.map((sd, i) => (
              <p key={i} className="text-[#8B8B8E] pl-2">
                <span className="text-[#3A3A3F] mr-1.5">{"\u00b7"}</span>
                {sd.date} ({sd.reason})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/[0.04]">
        <p className="text-[#ECECEE]">
          Kalan: {detail.remaining_calendar} takvim gunu {"\u00b7"} {detail.remaining_business} is gunu
        </p>
      </div>

      {detail.law_text && (
        <div className="pt-2 border-t border-white/[0.04]">
          <p className="text-[#5C5C5F] mb-1">Yasal dayanak: {detail.law_article}</p>
          <p className="text-[#8B8B8E] italic leading-relaxed whitespace-pre-wrap">{`"${detail.law_text}"`}</p>
        </div>
      )}
    </div>
  );
}

function DeadlineCard({ deadline, caseId, onRefresh }: { deadline: Deadline; caseId: string; onRefresh: () => void }) {
  const [showCalcDetail, setShowCalcDetail] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const style = getUrgencyStyle(deadline.days_left, deadline.is_completed, deadline.urgency === "expired");

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiFetch(`/api/v1/cases/${caseId}/deadlines/${deadline.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_completed: !deadline.is_completed }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  const daysLabel = deadline.days_left === 0
    ? "SON GUN"
    : deadline.days_left < 0
      ? `${Math.abs(deadline.days_left)} gun gecti`
      : `${deadline.days_left} gun kaldi`;

  const deadlineDateFormatted = formatDateShortTR(deadline.deadline_date);
  const dayName = getDayNameTR(deadline.deadline_date);

  return (
    <>
      <div className={`${style.bg} ${style.border} rounded-lg p-3.5 ml-4 ${deadline.is_completed ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${style.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[13px] font-semibold ${deadline.is_completed ? "line-through text-[#5C5C5F]" : "text-[#ECECEE]"}`}>
                {deadline.name}
              </span>
              {deadline.is_completed && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#3DD68C]/10 text-[#3DD68C]">Tamamlandi</span>
              )}
            </div>

            {/* Date and duration */}
            <div className="mt-1.5 space-y-0.5">
              {deadline.override ? (
                <>
                  <p className="text-[12px] text-[#ECECEE]">
                    {deadlineDateFormatted}
                    <span className="text-[#FFB224] ml-2 text-[11px]">elle duzenlendi</span>
                  </p>
                  <p className="text-[12px] text-[#5C5C5F] line-through">
                    {formatDateShortTR(deadline.override.original_date)} (sistem hesabi)
                  </p>
                  <p className="text-[11px] text-[#8B8B8E] mt-1">Neden: {deadline.override.reason}</p>
                  <p className="text-[11px] text-[#5C5C5F]">
                    Duzenleyen: {deadline.override.overridden_by} {"\u00b7"} {formatDateShortTR(deadline.override.overridden_at)}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-[#8B8B8E]">
                  {deadlineDateFormatted} ({dayName})
                </p>
              )}
              <p className="text-[11px] text-[#5C5C5F]">
                +{deadline.duration} {"\u00b7"} <span className={style.text}>{daysLabel}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {deadline.calc_detail && (
                <button
                  onClick={() => setShowCalcDetail(!showCalcDetail)}
                  className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    className={`transition-transform ${showCalcDetail ? "rotate-90" : ""}`}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  Hesaplama detayi
                </button>
              )}
              {!deadline.is_completed && (
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="text-[11px] text-[#8B8B8E] hover:text-[#ECECEE] transition-colors flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Duzenle
                </button>
              )}
              <button
                onClick={handleComplete}
                disabled={completing}
                className={`text-[11px] transition-colors flex items-center gap-1 ${
                  deadline.is_completed
                    ? "text-[#FFB224] hover:text-[#FFB224]"
                    : "text-[#3DD68C] hover:text-[#3DD68C]"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {deadline.is_completed ? "Geri Al" : "Tamamlandi"}
              </button>
            </div>

            {/* Calc detail panel */}
            <AnimatePresence>
              {showCalcDetail && deadline.calc_detail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <CalcDetailPanel detail={deadline.calc_detail} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Override modal */}
      <AnimatePresence>
        {showOverrideModal && (
          <OverrideModal
            deadline={deadline}
            caseId={caseId}
            onClose={() => setShowOverrideModal(false)}
            onSaved={() => { setShowOverrideModal(false); onRefresh(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function OverrideModal({
  deadline,
  caseId,
  onClose,
  onSaved,
}: {
  deadline: Deadline;
  caseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newDate, setNewDate] = useState(deadline.deadline_date);
  const [reason, setReason] = useState(OVERRIDE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date(deadline.deadline_date);
  const selectedDate = new Date(newDate);
  const diffDays = Math.round((selectedDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const finalReason = reason === "Diger" ? customReason : reason;
      if (!finalReason.trim()) {
        setError("Lutfen bir neden girin.");
        setSaving(false);
        return;
      }
      await apiFetch(`/api/v1/cases/${caseId}/deadlines/${deadline.id}/override`, {
        method: "PUT",
        body: JSON.stringify({ new_date: newDate, reason: finalReason }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata olustu");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sureyi Duzenle</h2>
        <p className="text-[12px] text-[#5C5C5F]">{deadline.name}</p>

        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Mevcut sistem tarihi</label>
          <p className="text-[13px] text-[#8B8B8E]">{formatDateTR(deadline.deadline_date)}</p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Yeni tarih *</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
          {diffDays > 0 && (
            <p className="text-[11px] text-[#E5484D] mt-1">Bu tarih yasal sureden {diffDays} gun SONRA</p>
          )}
          {diffDays < 0 && (
            <p className="text-[11px] text-[#6C6CFF] mt-1">Yasal sure bitiminden {Math.abs(diffDays)} gun once (ic takip)</p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-2">Neden *</label>
          <div className="space-y-2">
            {OVERRIDE_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${reason === r ? "border-[#6C6CFF] bg-[#6C6CFF]" : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"}`}>
                  {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-[12px] text-[#ECECEE]">{r}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${reason === "Diger" ? "border-[#6C6CFF] bg-[#6C6CFF]" : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"}`}>
                {reason === "Diger" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-[12px] text-[#ECECEE]">Diger:</span>
            </label>
            {reason === "Diger" && (
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Aciklama yazin..."
                className={inputCls + " ml-6"}
              />
            )}
          </div>
        </div>

        {error && <p className="text-[12px] text-[#E5484D]">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/50 rounded-lg text-[13px] font-medium text-white transition-colors"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">
            Iptal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EventCard({ event, caseId, onRefresh }: { event: CaseEvent; caseId: string; onRefresh: () => void }) {
  return (
    <div className="space-y-2">
      {/* Event header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#6C6CFF]/30 border-2 border-[#6C6CFF] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#ECECEE]">{event.event_type_label}</span>
            <span className="text-[11px] text-[#5C5C5F]">{formatDateTR(event.event_date)}</span>
          </div>
          {event.note && <p className="text-[12px] text-[#8B8B8E] mt-0.5">{event.note}</p>}
        </div>
      </div>

      {/* Deadlines nested inside event */}
      {event.deadlines.length > 0 && (
        <div className="space-y-2 border-l-2 border-white/[0.04] ml-1.5">
          {event.deadlines.map((dl) => (
            <DeadlineCard key={dl.id} deadline={dl} caseId={caseId} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewEventModal({
  caseId,
  onClose,
  onSaved,
}: {
  caseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeadlines, setSelectedDeadlines] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applicableDeadlines = eventType ? (MOCK_APPLICABLE_DEADLINES[eventType] || []) : [];

  // Auto-select all applicable deadlines when event type changes
  useEffect(() => {
    if (eventType && applicableDeadlines.length > 0) {
      setSelectedDeadlines(new Set(applicableDeadlines.map((d) => d.key)));
    } else {
      setSelectedDeadlines(new Set());
    }
  }, [eventType]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEventTypes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = EVENT_TYPE_OPTIONS.filter(
      (et) => et.label.toLowerCase().includes(term) || et.description.toLowerCase().includes(term)
    );
    if (!searchTerm) {
      const frequent = filtered.filter((et) => et.is_frequent);
      const rest = filtered.filter((et) => !et.is_frequent);
      return { frequent, rest };
    }
    return { frequent: [], rest: filtered };
  }, [searchTerm]);

  const toggleDeadline = (key: string) => {
    setSelectedDeadlines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!eventType || !eventDate) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/cases/${caseId}/events`, {
        method: "POST",
        body: JSON.stringify({
          event_type: eventType,
          event_date: eventDate,
          note: note || null,
          selected_deadlines: Array.from(selectedDeadlines),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata olustu");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Olay</h2>

        {/* Event type selector */}
        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Olay turu *</label>
          <input
            type="text"
            placeholder="Olay turu ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputCls}
          />
          <div className="mt-2 max-h-48 overflow-y-auto bg-[#0C0C0E] border border-white/[0.04] rounded-lg">
            {filteredEventTypes.frequent.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3F] px-3 pt-2 pb-1">Sik kullanilanlar</p>
                {filteredEventTypes.frequent.map((et) => (
                  <button
                    key={et.value}
                    onClick={() => { setEventType(et.value); setSearchTerm(""); }}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                      eventType === et.value
                        ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                        : "text-[#ECECEE] hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="font-medium">{et.label}</span>
                    <span className="text-[#5C5C5F] ml-2">{et.description}</span>
                  </button>
                ))}
              </>
            )}
            {filteredEventTypes.rest.length > 0 && (
              <>
                {filteredEventTypes.frequent.length > 0 && (
                  <div className="border-t border-white/[0.04] my-1" />
                )}
                {filteredEventTypes.rest.map((et) => (
                  <button
                    key={et.value}
                    onClick={() => { setEventType(et.value); setSearchTerm(""); }}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                      eventType === et.value
                        ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
                        : "text-[#ECECEE] hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="font-medium">{et.label}</span>
                    <span className="text-[#5C5C5F] ml-2">{et.description}</span>
                  </button>
                ))}
              </>
            )}
            {filteredEventTypes.frequent.length === 0 && filteredEventTypes.rest.length === 0 && (
              <p className="px-3 py-3 text-[12px] text-[#5C5C5F]">Sonuc bulunamadi</p>
            )}
          </div>
          {eventType && (
            <p className="text-[11px] text-[#6C6CFF] mt-1">
              Secili: {EVENT_TYPE_OPTIONS.find((et) => et.value === eventType)?.label}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Olay tarihi *</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
        </div>

        {/* Note */}
        <div>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Not (istege bagli)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ek bilgi..."
            className={inputCls + " resize-none"}
          />
        </div>

        {/* Applicable deadlines */}
        {eventType && applicableDeadlines.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-[#5C5C5F] mb-2">Hesaplanacak sureler</label>
            <div className="space-y-1.5">
              {applicableDeadlines.map((ad) => (
                <label key={ad.key} className="flex items-start gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div
                    className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedDeadlines.has(ad.key)
                        ? "border-[#6C6CFF] bg-[#6C6CFF]"
                        : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"
                    }`}
                  >
                    {selectedDeadlines.has(ad.key) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="text-[12px] text-[#ECECEE] font-medium">{ad.name} ({ad.duration})</span>
                    <span className="text-[11px] text-[#5C5C5F] ml-1">-- {ad.law_reference}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-[#E5484D]">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !eventType || !eventDate}
            className="flex-1 py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-lg text-[13px] font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Hesaplaniyor..." : "Hesapla ve Kaydet"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">
            Iptal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Tab Contents ─── */

function OzetTab({ caseData }: { caseData: CaseDetail }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-3 text-[13px]">
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Mahkeme</span><span className="text-[#ECECEE]">{caseData.court || "\u2014"}</span></div>
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Esas No</span><span className="text-[#ECECEE]">{caseData.case_number || "\u2014"}</span></div>
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Karsi Taraf</span><span className="text-[#ECECEE]">{caseData.opponent || "\u2014"}</span></div>
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Tur</span><span className="text-[#ECECEE]">{CASE_TYPES[caseData.case_type] || caseData.case_type}</span></div>
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Durum</span>
          <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${STATUS_COLORS[caseData.status] || "bg-[#5C5C5F]/10 text-[#5C5C5F]"}`}>
            {caseData.status === "aktif" ? "Aktif" : caseData.status === "beklemede" ? "Beklemede" : "Kapandi"}
          </span>
        </div>
        <div className="flex"><span className="w-32 text-[#5C5C5F] shrink-0">Atanan</span><span className="text-[#ECECEE]">{caseData.assigned_to || "\u2014"}</span></div>
        {caseData.notes && (
          <div className="pt-3 border-t border-white/[0.04]">
            <p className="text-[12px] text-[#8B8B8E]">{caseData.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OlaylarTab({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CaseEvent[]>(`/api/v1/cases/${caseId}/events`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Olaylar yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-[#1A1A1F] rounded w-2/3 mb-2" />
            <div className="h-3 bg-[#1A1A1F] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-[#E5484D]">{error}</p>
        <button onClick={fetchEvents} className="mt-3 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF]">Tekrar dene</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Urgency banner */}
      <UrgencyBanner events={events} />

      {/* New event button */}
      <button
        onClick={() => setShowNewEvent(true)}
        className="w-full py-3 border-2 border-dashed border-white/[0.08] rounded-xl text-[13px] font-medium text-[#6C6CFF] hover:border-[#6C6CFF]/30 hover:bg-[#6C6CFF]/[0.03] transition-all"
      >
        + Yeni Olay
      </button>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <p className="text-[13px] text-[#5C5C5F]">Henuz olay eklenmemis</p>
          <p className="text-[12px] text-[#3A3A3F] mt-1">Bir olay ekleyerek yasal surelerin otomatik hesaplanmasini saglayin</p>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} caseId={caseId} onRefresh={fetchEvents} />
          ))}
        </div>
      )}

      {/* New event modal */}
      <AnimatePresence>
        {showNewEvent && (
          <NewEventModal
            caseId={caseId}
            onClose={() => setShowNewEvent(false)}
            onSaved={() => { setShowNewEvent(false); fetchEvents(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}>
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p className="text-[13px] text-[#5C5C5F]">{title} yakin zamanda eklenecek</p>
    </div>
  );
}

/* ─── Main Page ─── */

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("olaylar");

  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CaseDetail>(`/api/v1/cases/${caseId}`);
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dava yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/giris");
      return;
    }
    fetchCase();
  }, [fetchCase, router]);

  if (loading) {
    return (
      <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#1A1A1F] rounded w-48" />
          <div className="h-4 bg-[#1A1A1F] rounded w-32" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 bg-[#1A1A1F] rounded-lg w-24" />)}
          </div>
          <div className="h-48 bg-[#1A1A1F] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#E5484D]/10 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5}><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[14px] text-[#ECECEE]">Dava yuklenemedi</p>
          <p className="text-[12px] text-[#5C5C5F]">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={fetchCase} className="px-5 py-2 bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-xl text-[13px] font-medium hover:bg-[#6C6CFF]/20 transition-colors">
              Tekrar Dene
            </button>
            <Link href="/davalar" className="px-5 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">
              Davalara Don
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#09090B] border-b border-white/[0.06]">
        <div className="px-4 md:px-6 pt-14 md:pt-5 pb-0">
          {/* Breadcrumb + Title */}
          <div className="flex items-center gap-2 text-[12px] text-[#5C5C5F] mb-2">
            <Link href="/davalar" className="hover:text-[#ECECEE] transition-colors">Dava Dosyalari</Link>
            <span>/</span>
            <span className="text-[#8B8B8E] truncate">{caseData.title}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE] truncate">{caseData.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${STATUS_COLORS[caseData.status] || "bg-[#5C5C5F]/10 text-[#5C5C5F]"}`}>
                  {caseData.status === "aktif" ? "Aktif" : caseData.status === "beklemede" ? "Beklemede" : "Kapandi"}
                </span>
                {caseData.court && <span className="text-[12px] text-[#5C5C5F]">{caseData.court}</span>}
                {caseData.case_number && <span className="text-[12px] text-[#5C5C5F]">E. {caseData.case_number}</span>}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-4 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "text-[#6C6CFF]"
                    : "text-[#5C5C5F] hover:text-[#8B8B8E]"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6C6CFF] rounded-t-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 md:px-6 py-6 max-w-4xl">
        {activeTab === "ozet" && <OzetTab caseData={caseData} />}
        {activeTab === "olaylar" && <OlaylarTab caseId={caseId} />}
        {activeTab === "durusmalar" && <PlaceholderTab title="Durusmalar" />}
        {activeTab === "belgeler" && <PlaceholderTab title="Belgeler" />}
        {activeTab === "notlar" && <PlaceholderTab title="Notlar" />}
      </div>
    </div>
  );
}
