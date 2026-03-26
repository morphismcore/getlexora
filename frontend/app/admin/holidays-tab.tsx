"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import type { Holiday, JudicialRecess } from "./types";
import { MONTHS_TR, HOLIDAY_TYPE_LABELS } from "./constants";
import { Skeleton, ConfirmDialog, SlideOver, FormField } from "./components";

export default function HolidaysTab({
  token,
  apiUrl,
  headers,
  onToast,
}: {
  token: string | null;
  apiUrl: string;
  headers: Record<string, string>;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [recesses, setRecesses] = useState<JudicialRecess[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-overs
  const [showNewHoliday, setShowNewHoliday] = useState(false);
  const [showEditHoliday, setShowEditHoliday] = useState<Holiday | null>(null);
  const [showEditRecess, setShowEditRecess] = useState<JudicialRecess | null>(null);
  const [showNewRecess, setShowNewRecess] = useState(false);

  // Confirm
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  // New holiday form
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "", type: "resmi", is_half_day: false });

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [holRes, recRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/holidays?year=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/v1/admin/judicial-recesses`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (holRes.status === "fulfilled" && holRes.value.ok) {
        const holData = await holRes.value.json();
        setHolidays(Array.isArray(holData) ? holData : holData.holidays || []);
      } else setHolidays([]);
      if (recRes.status === "fulfilled" && recRes.value.ok) setRecesses(await recRes.value.json());
      else setRecesses([]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, apiUrl, selectedYear, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createHoliday = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays`, {
        method: "POST", headers,
        body: JSON.stringify({ date: holidayForm.date, name: holidayForm.name, holiday_type: holidayForm.type, is_half_day: holidayForm.is_half_day, year: selectedYear }),
      });
      if (r.ok) {
        onToast("Tatil eklendi");
        setShowNewHoliday(false);
        setHolidayForm({ date: "", name: "", type: "resmi", is_half_day: false });
        fetchData();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Ekleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateHoliday = async (h: Holiday) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays/${h.id}`, {
        method: "PUT", headers,
        body: JSON.stringify(h),
      });
      if (r.ok) {
        onToast("Tatil guncellendi");
        setShowEditHoliday(null);
        fetchData();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Tatil silindi");
        fetchData();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const createRecess = async (recess: Omit<JudicialRecess, "id">) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses`, {
        method: "POST", headers,
        body: JSON.stringify(recess),
      });
      if (r.ok) {
        onToast("Adli tatil donemi eklendi");
        setShowNewRecess(false);
        fetchData();
      } else {
        onToast("Ekleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateRecess = async (recess: JudicialRecess) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses/${recess.id}`, {
        method: "PUT", headers,
        body: JSON.stringify(recess),
      });
      if (r.ok) {
        onToast("Adli tatil donemi guncellendi");
        setShowEditRecess(null);
        fetchData();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteRecess = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Adli tatil donemi silindi");
        fetchData();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  // Build calendar data
  const holidaysByDate = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    holidays.forEach((h) => {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    });
    return map;
  }, [holidays]);

  const currentRecess = recesses.find((r) => r.year === selectedYear);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Skeleton className="h-12 rounded-xl w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Year selector + actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-lg p-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-2 text-[15px] font-medium rounded-md transition-all ${
                selectedYear === y
                  ? "bg-[#6C6CFF]/15 text-[#6C6CFF]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewRecess(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium text-[#A78BFA] bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Adli Tatil
          </button>
          <button
            onClick={() => {
              setShowNewHoliday(true);
              setHolidayForm({ date: "", name: "", type: "resmi", is_half_day: false });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[14px] font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Tatil
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const firstDay = new Date(selectedYear, monthIndex, 1);
          const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
          const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

          return (
            <div key={monthIndex} className="bg-[#111113] border border-white/[0.06] rounded-xl p-3">
              <h4 className="text-[14px] font-semibold text-[#ECECEE] mb-2">{MONTHS_TR[monthIndex]}</h4>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {/* Day headers */}
                {["Pt", "Sa", "Ca", "Pe", "Cu", "Ct", "Pa"].map((d) => (
                  <span key={d} className="text-[11px] text-[#5C5C5F] font-medium pb-0.5">{d}</span>
                ))}
                {/* Empty slots */}
                {Array.from({ length: startDow }, (_, i) => (
                  <span key={`e${i}`} />
                ))}
                {/* Days */}
                {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                  const day = dayIndex + 1;
                  const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayHolidays = holidaysByDate[dateStr];
                  const hasHoliday = !!dayHolidays;
                  const isResmi = dayHolidays?.some((h) => h.holiday_type === "resmi");
                  const isDini = dayHolidays?.some((h) => h.holiday_type === "dini");
                  const isArife = dayHolidays?.some((h) => h.holiday_type === "arife");
                  const isHalf = dayHolidays?.some((h) => h.is_half_day);

                  // Check if in judicial recess
                  const isInRecess = currentRecess && dateStr >= currentRecess.start_date && dateStr <= currentRecess.end_date;

                  let bgColor = "";
                  let textColor = "text-[#8B8B8E]";
                  if (isResmi) { bgColor = "bg-[#6C6CFF]/20"; textColor = "text-[#6C6CFF]"; }
                  else if (isDini) { bgColor = "bg-[#A78BFA]/20"; textColor = "text-[#A78BFA]"; }
                  else if (isArife) { bgColor = "bg-[#FB923C]/20"; textColor = "text-[#FB923C]"; }
                  else if (isInRecess) { bgColor = "bg-[#E5484D]/10"; textColor = "text-[#E5484D]/70"; }

                  const tooltipText = dayHolidays?.map((h) => `${h.name}${h.is_half_day ? " (yarim gun)" : ""}`).join(", ");

                  return (
                    <span
                      key={day}
                      className={`text-[12px] w-6 h-6 flex items-center justify-center rounded-md ${bgColor} ${textColor} ${hasHoliday ? "font-semibold cursor-help" : ""} ${isHalf ? "relative" : ""}`}
                      title={tooltipText || undefined}
                    >
                      {day}
                      {isHalf && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FB923C]" />}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#6C6CFF]/20 border border-[#6C6CFF]/40" />
          <span className="text-[13px] text-[#8B8B8E]">Resmi Tatil</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#A78BFA]/20 border border-[#A78BFA]/40" />
          <span className="text-[13px] text-[#8B8B8E]">Dini Bayram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#FB923C]/20 border border-[#FB923C]/40" />
          <span className="text-[13px] text-[#8B8B8E]">Arife</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#E5484D]/10 border border-[#E5484D]/20" />
          <span className="text-[13px] text-[#8B8B8E]">Adli Tatil</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative w-3 h-3 rounded bg-white/[0.04]"><span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FB923C]" /></span>
          <span className="text-[13px] text-[#8B8B8E]">Yarim Gun</span>
        </div>
      </div>

      {/* Holidays table */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-[#ECECEE]">Tatil Listesi ({holidays.length})</h3>
        </div>
        {holidays.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[14px] text-[#5C5C5F]">{selectedYear} yili icin tatil verisi yok.</p>
            <button
              onClick={() => setShowNewHoliday(true)}
              className="mt-3 px-4 py-2 text-[14px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors"
            >
              + Ilk tatili ekle
            </button>
          </div>
        ) : (
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[13px] uppercase tracking-wider">
                <th className="text-left p-3">Tarih</th>
                <th className="text-left p-3">Ad</th>
                <th className="text-left p-3">Tur</th>
                <th className="text-left p-3">Yarim Gun</th>
                <th className="text-right p-3">Islemler</th>
              </tr>
            </thead>
            <tbody>
              {holidays
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => {
                  const htLabel = HOLIDAY_TYPE_LABELS[h.holiday_type] || { label: h.holiday_type, color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };
                  return (
                    <tr key={h.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 text-[#ECECEE] font-mono text-[14px]">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" })}
                      </td>
                      <td className="p-3 text-[#ECECEE]">{h.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[12px] font-medium rounded-md" style={{ color: htLabel.color, backgroundColor: `${htLabel.color}15` }}>
                          {htLabel.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {h.is_half_day ? (
                          <span className="text-[#FB923C] text-[13px]">Evet</span>
                        ) : (
                          <span className="text-[#5C5C5F] text-[13px]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setShowEditHoliday(h)}
                            className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                            aria-label="Duzenle"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ id: h.id, name: h.name })}
                            className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                            aria-label="Sil"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {/* Judicial Recesses section */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#ECECEE]">Adli Tatil Donemleri</h3>
        </div>
        {recesses.length === 0 ? (
          <div className="text-center py-6 bg-[#09090B] rounded-lg border border-dashed border-white/[0.06]">
            <p className="text-[14px] text-[#5C5C5F]">Henuz adli tatil donemi tanimlanmamis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recesses
              .sort((a, b) => b.year - a.year)
              .map((recess) => (
                <div key={recess.id} className="bg-[#09090B] rounded-lg p-4 group hover:bg-[#0D0D10] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[16px] font-semibold text-[#ECECEE]">{recess.year}</span>
                        <span className="text-[14px] text-[#A78BFA]">
                          {new Date(recess.start_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} - {new Date(recess.end_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[13px]">
                        <span className="text-[#8B8B8E]">
                          Hukuk uzatma: <span className="text-[#6C6CFF] font-medium">{recess.civil_extension_days} gun</span>
                        </span>
                        <span className="text-[#8B8B8E]">
                          Ceza uzatma: <span className="text-[#E5484D] font-medium">{recess.criminal_extension_days} gun</span>
                        </span>
                        <span className="text-[#8B8B8E]">
                          Idari uzatma: <span className="text-[#A78BFA] font-medium">{recess.administrative_extension_days} gun</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShowEditRecess(recess)}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                        aria-label="Duzenle"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button
                        onClick={() => deleteRecess(recess.id)}
                        className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                        aria-label="Sil"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* New Holiday Slide-over */}
      <SlideOver open={showNewHoliday} onClose={() => setShowNewHoliday(false)} title="Yeni Tatil Ekle">
        <div className="space-y-5">
          <FormField label="Tarih" hint="YYYY-MM-DD formatinda">
            <input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]"
            />
          </FormField>
          <FormField label="Tatil Adi">
            <input
              type="text"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="orn. Cumhuriyet Bayrami"
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
            />
          </FormField>
          <FormField label="Tatil Turu">
            <select
              value={holidayForm.type}
              onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
            >
              {Object.entries(HOLIDAY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Yarim Gun">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={holidayForm.is_half_day}
                onChange={(e) => setHolidayForm({ ...holidayForm, is_half_day: e.target.checked })}
                className="accent-[#6C6CFF] w-4 h-4"
              />
              <span className="text-[15px] text-[#ECECEE]">Yarim gun tatil</span>
            </label>
          </FormField>
          <button
            onClick={createHoliday}
            disabled={!holidayForm.date || !holidayForm.name}
            className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[15px] font-medium rounded-lg transition-colors"
          >
            Tatil Ekle
          </button>
        </div>
      </SlideOver>

      {/* Edit Holiday Slide-over */}
      <SlideOver open={!!showEditHoliday} onClose={() => setShowEditHoliday(null)} title="Tatil Duzenle">
        {showEditHoliday && (
          <EditHolidayForm holiday={showEditHoliday} onSave={updateHoliday} onCancel={() => setShowEditHoliday(null)} />
        )}
      </SlideOver>

      {/* New Recess Slide-over */}
      <SlideOver open={showNewRecess} onClose={() => setShowNewRecess(false)} title="Yeni Adli Tatil Donemi">
        <RecessFormFields
          initial={{ year: selectedYear, start_date: `${selectedYear}-07-20`, end_date: `${selectedYear}-08-31`, civil_extension_days: 7, criminal_extension_days: 3, administrative_extension_days: 7 }}
          onSave={(data) => createRecess(data)}
          onCancel={() => setShowNewRecess(false)}
        />
      </SlideOver>

      {/* Edit Recess Slide-over */}
      <SlideOver open={!!showEditRecess} onClose={() => setShowEditRecess(null)} title="Adli Tatil Donemi Duzenle">
        {showEditRecess && (
          <RecessFormFields
            initial={showEditRecess}
            onSave={(data) => updateRecess({ ...showEditRecess, ...data })}
            onCancel={() => setShowEditRecess(null)}
          />
        )}
      </SlideOver>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Tatili Sil"
        message={`"${confirmDelete?.name || ""}" silinecek. Bu islem geri alinamaz.`}
        onConfirm={() => { if (confirmDelete) { deleteHoliday(confirmDelete.id); setConfirmDelete(null); } }}
        onCancel={() => setConfirmDelete(null)}
      />
    </motion.div>
  );
}


// ── Edit Holiday Form ────────────────────────────────

function EditHolidayForm({ holiday, onSave, onCancel }: { holiday: Holiday; onSave: (h: Holiday) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...holiday });
  return (
    <div className="space-y-5">
      <FormField label="Tarih">
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
      </FormField>
      <FormField label="Tatil Adi">
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
      </FormField>
      <FormField label="Tatil Turu">
        <select value={form.holiday_type} onChange={(e) => setForm({ ...form, holiday_type: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
          {Object.entries(HOLIDAY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
        </select>
      </FormField>
      <FormField label="Yarim Gun">
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })} className="accent-[#6C6CFF] w-4 h-4" />
          <span className="text-[15px] text-[#ECECEE]">Yarim gun tatil</span>
        </label>
      </FormField>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[15px] font-medium rounded-lg transition-colors">Kaydet</button>
        <button onClick={onCancel} className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[15px] font-medium rounded-lg transition-colors">Iptal</button>
      </div>
    </div>
  );
}


// ── Recess Form Fields ───────────────────────────────

function RecessFormFields({
  initial,
  onSave,
  onCancel,
}: {
  initial: { year: number; start_date: string; end_date: string; civil_extension_days: number; criminal_extension_days: number; administrative_extension_days: number };
  onSave: (data: typeof initial) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...initial });
  return (
    <div className="space-y-5">
      <FormField label="Yil">
        <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 2026 })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Baslangic Tarihi">
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
        </FormField>
        <FormField label="Bitis Tarihi">
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Hukuk Uzatma (gun)">
          <input type="number" value={form.civil_extension_days} onChange={(e) => setForm({ ...form, civil_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
        <FormField label="Ceza Uzatma (gun)">
          <input type="number" value={form.criminal_extension_days} onChange={(e) => setForm({ ...form, criminal_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
        <FormField label="Idari Uzatma (gun)">
          <input type="number" value={form.administrative_extension_days} onChange={(e) => setForm({ ...form, administrative_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[15px] font-medium rounded-lg transition-colors">Kaydet</button>
        <button onClick={onCancel} className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[15px] font-medium rounded-lg transition-colors">Iptal</button>
      </div>
    </div>
  );
}

