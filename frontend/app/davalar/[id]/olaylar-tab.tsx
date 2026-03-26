"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Deadline, DeadlineCalcDetail, CaseEvent } from "./types";
import { EVENT_TYPE_OPTIONS, MOCK_APPLICABLE_DEADLINES, OVERRIDE_REASONS } from "./types";
import { formatDateTR, formatDateShortTR, getDayNameTR, getUrgencyStyle, apiFetch } from "./helpers";

/* ─── CalcDetailPanel ─── */

function CalcDetailPanel({ detail }: { detail: DeadlineCalcDetail }) {
  return (
    <div className="mt-3 bg-[#0C0C0E] border border-white/[0.04] rounded-lg p-4 space-y-3 font-mono text-[14px]">
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

/* ─── OverrideModal ─── */

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

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

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
        <h2 className="text-[17px] font-semibold text-[#ECECEE]">Sureyi Duzenle</h2>
        <p className="text-[14px] text-[#5C5C5F]">{deadline.name}</p>
        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">Mevcut sistem tarihi</label>
          <p className="text-[15px] text-[#8B8B8E]">{formatDateTR(deadline.deadline_date)}</p>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">Yeni tarih *</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
          {diffDays > 0 && <p className="text-[13px] text-[#E5484D] mt-1">Bu tarih yasal sureden {diffDays} gun SONRA</p>}
          {diffDays < 0 && <p className="text-[13px] text-[#6C6CFF] mt-1">Yasal sure bitiminden {Math.abs(diffDays)} gun once (ic takip)</p>}
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-2">Neden *</label>
          <div className="space-y-2">
            {OVERRIDE_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${reason === r ? "border-[#6C6CFF] bg-[#6C6CFF]" : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"}`}>
                  {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-[14px] text-[#ECECEE]">{r}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${reason === "Diger" ? "border-[#6C6CFF] bg-[#6C6CFF]" : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"}`}>
                {reason === "Diger" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-[14px] text-[#ECECEE]">Diger:</span>
            </label>
            {reason === "Diger" && (
              <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Aciklama yazin..." className={inputCls + " ml-6"} />
            )}
          </div>
        </div>
        {error && <p className="text-[14px] text-[#E5484D]">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/50 rounded-lg text-[15px] font-medium text-white transition-colors">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-[15px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">Iptal</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── DeadlineCard ─── */

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
      <div className={`${style.bg} ${style.border} rounded-lg p-4 ml-4 ${deadline.is_completed ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${style.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[15px] font-semibold ${deadline.is_completed ? "line-through text-[#5C5C5F]" : "text-[#ECECEE]"}`}>
                {deadline.name}
              </span>
              {deadline.is_completed && (
                <span className="text-[12px] font-medium px-2 py-1 rounded bg-[#3DD68C]/10 text-[#3DD68C]">Tamamlandi</span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {deadline.override ? (
                <>
                  <p className="text-[14px] text-[#ECECEE]">
                    {deadlineDateFormatted}
                    <span className="text-[#FFB224] ml-2 text-[13px]">elle duzenlendi</span>
                  </p>
                  <p className="text-[14px] text-[#5C5C5F] line-through">
                    {formatDateShortTR(deadline.override.original_date)} (sistem hesabi)
                  </p>
                  <p className="text-[13px] text-[#8B8B8E] mt-1">Neden: {deadline.override.reason}</p>
                  <p className="text-[13px] text-[#5C5C5F]">
                    Duzenleyen: {deadline.override.overridden_by} {"\u00b7"} {formatDateShortTR(deadline.override.overridden_at)}
                  </p>
                </>
              ) : (
                <p className="text-[14px] text-[#8B8B8E]">
                  {deadlineDateFormatted} ({dayName})
                </p>
              )}
              <p className="text-[13px] text-[#5C5C5F]">
                +{deadline.duration} {"\u00b7"} <span className={style.text}>{daysLabel}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {deadline.calc_detail && (
                <button
                  onClick={() => setShowCalcDetail(!showCalcDetail)}
                  className="text-[13px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors flex items-center gap-1"
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
                  className="text-[13px] text-[#8B8B8E] hover:text-[#ECECEE] transition-colors flex items-center gap-1"
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
                className={`text-[13px] transition-colors flex items-center gap-1 ${
                  deadline.is_completed ? "text-[#FFB224] hover:text-[#FFB224]" : "text-[#3DD68C] hover:text-[#3DD68C]"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {deadline.is_completed ? "Geri Al" : "Tamamlandi"}
              </button>
            </div>
            <AnimatePresence>
              {showCalcDetail && deadline.calc_detail && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <CalcDetailPanel detail={deadline.calc_detail} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showOverrideModal && (
          <OverrideModal deadline={deadline} caseId={caseId} onClose={() => setShowOverrideModal(false)} onSaved={() => { setShowOverrideModal(false); onRefresh(); }} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── UrgencyBanner ─── */

export function UrgencyBanner({ events }: { events: CaseEvent[] }) {
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
        <p className={`text-[15px] font-semibold ${hasCritical ? "text-[#E5484D]" : "text-[#FFB224]"}`}>
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

/* ─── EventCard ─── */

function EventCard({ event, caseId, onRefresh }: { event: CaseEvent; caseId: string; onRefresh: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#6C6CFF]/30 border-2 border-[#6C6CFF] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#ECECEE]">{event.event_type_label}</span>
            <span className="text-[13px] text-[#5C5C5F]">{formatDateTR(event.event_date)}</span>
          </div>
          {event.note && <p className="text-[14px] text-[#8B8B8E] mt-0.5">{event.note}</p>}
        </div>
      </div>
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

/* ─── NewEventModal ─── */

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

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-semibold text-[#ECECEE]">Yeni Olay</h2>

        {/* Event type selector */}
        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">Olay turu *</label>
          <input type="text" placeholder="Olay turu ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputCls} />
          <div className="mt-2 max-h-48 overflow-y-auto bg-[#0C0C0E] border border-white/[0.04] rounded-lg">
            {filteredEventTypes.frequent.length > 0 && (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#3A3A3F] px-3 pt-2 pb-1">Sik kullanilanlar</p>
                {filteredEventTypes.frequent.map((et) => (
                  <button key={et.value} onClick={() => { setEventType(et.value); setSearchTerm(""); }} className={`w-full text-left px-4 py-2.5 text-[14px] transition-colors ${eventType === et.value ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "text-[#ECECEE] hover:bg-white/[0.03]"}`}>
                    <span className="font-medium">{et.label}</span>
                    <span className="text-[#5C5C5F] ml-2">{et.description}</span>
                  </button>
                ))}
              </>
            )}
            {filteredEventTypes.rest.length > 0 && (
              <>
                {filteredEventTypes.frequent.length > 0 && <div className="border-t border-white/[0.04] my-1" />}
                {filteredEventTypes.rest.map((et) => (
                  <button key={et.value} onClick={() => { setEventType(et.value); setSearchTerm(""); }} className={`w-full text-left px-4 py-2.5 text-[14px] transition-colors ${eventType === et.value ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "text-[#ECECEE] hover:bg-white/[0.03]"}`}>
                    <span className="font-medium">{et.label}</span>
                    <span className="text-[#5C5C5F] ml-2">{et.description}</span>
                  </button>
                ))}
              </>
            )}
            {filteredEventTypes.frequent.length === 0 && filteredEventTypes.rest.length === 0 && (
              <p className="px-3 py-3 text-[14px] text-[#5C5C5F]">Sonuc bulunamadi</p>
            )}
          </div>
          {eventType && <p className="text-[13px] text-[#6C6CFF] mt-1">Secili: {EVENT_TYPE_OPTIONS.find((et) => et.value === eventType)?.label}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">Olay tarihi *</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">Not (istege bagli)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ek bilgi..." className={inputCls + " resize-none"} />
        </div>

        {eventType && applicableDeadlines.length > 0 && (
          <div>
            <label className="block text-[13px] font-medium text-[#5C5C5F] mb-2">Hesaplanacak sureler</label>
            <div className="space-y-1.5">
              {applicableDeadlines.map((ad) => (
                <label key={ad.key} className="flex items-start gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedDeadlines.has(ad.key) ? "border-[#6C6CFF] bg-[#6C6CFF]" : "border-[#3A3A3F] group-hover:border-[#5C5C5F]"}`}>
                    {selectedDeadlines.has(ad.key) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <div>
                    <span className="text-[14px] text-[#ECECEE] font-medium">{ad.name} ({ad.duration})</span>
                    <span className="text-[13px] text-[#5C5C5F] ml-1">-- {ad.law_reference}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[14px] text-[#E5484D]">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving || !eventType || !eventDate} className="flex-1 py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/30 disabled:cursor-not-allowed rounded-lg text-[15px] font-medium text-white transition-colors flex items-center justify-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Hesaplaniyor..." : "Hesapla ve Kaydet"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-[15px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">Iptal</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── OlaylarTab (exported) ─── */

export default function OlaylarTab({ caseId }: { caseId: string }) {
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
        <p className="text-[15px] text-[#E5484D]">{error}</p>
        <button onClick={fetchEvents} className="mt-3 text-[14px] text-[#6C6CFF] hover:text-[#8B8BFF]">Tekrar dene</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UrgencyBanner events={events} />

      <button
        onClick={() => setShowNewEvent(true)}
        className="w-full py-3 border-2 border-dashed border-white/[0.08] rounded-xl text-[15px] font-medium text-[#6C6CFF] hover:border-[#6C6CFF]/30 hover:bg-[#6C6CFF]/[0.03] transition-all"
      >
        + Yeni Olay
      </button>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <p className="text-[15px] text-[#5C5C5F]">Henuz olay eklenmemis</p>
          <p className="text-[14px] text-[#3A3A3F] mt-1">Bir olay ekleyerek yasal surelerin otomatik hesaplanmasini saglayin</p>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} caseId={caseId} onRefresh={fetchEvents} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNewEvent && (
          <NewEventModal caseId={caseId} onClose={() => setShowNewEvent(false)} onSaved={() => { setShowNewEvent(false); fetchEvents(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
