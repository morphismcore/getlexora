"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { DashboardData, DeadlineItem } from "./types";
import { TR_MONTHS, getDeadlineUrgency } from "./helpers";

export default function MiniCalendar({ deadlines }: { deadlines: DashboardData["deadlines"] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tooltip, setTooltip] = useState<{ day: number; items: DeadlineItem[] } | null>(null);

  const allDeadlines = useMemo(() => {
    return [
      ...(deadlines.overdue || []),
      ...(deadlines.today || []),
      ...(deadlines.this_week || []),
      ...(deadlines.next_week || []),
      ...(deadlines.later || []),
    ];
  }, [deadlines]);

  const deadlinesByDay = useMemo(() => {
    const map: Record<string, DeadlineItem[]> = {};
    allDeadlines.forEach(dl => {
      if (!dl.deadline_date) return;
      const d = new Date(dl.deadline_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(dl);
    });
    return map;
  }, [allDeadlines]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const cells: { day: number; inMonth: boolean }[] = [];
  // Previous month days
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevLastDay - i, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  // Next month fill
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false });
    }
  }

  // Suppress unused variable warnings
  void firstDay;
  void lastDay;

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8E" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="text-[15px] font-semibold text-[#ECECEE]">{TR_MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8E" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Pzt","Sal","Car","Per","Cum","Cmt","Paz"].map(d => (
          <div key={d} className="text-center text-[12px] text-[#3A3A3F] font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5 relative">
        {cells.map((cell, i) => {
          if (!cell.inMonth) {
            return (
              <div key={`out-${i}`} className="h-9 flex flex-col items-center justify-center rounded-lg">
                <span className="text-[13px] text-[#3A3A3F]">{cell.day}</span>
              </div>
            );
          }
          const dayKey = `${year}-${month}-${cell.day}`;
          const isToday = dayKey === todayKey;
          const dayDeadlines = deadlinesByDay[dayKey] || [];
          const hasDeadline = dayDeadlines.length > 0;
          const hasCritical = dayDeadlines.some(dl => dl.days_left <= 0 || dl.urgency === "critical");

          return (
            <button
              key={`in-${cell.day}`}
              onClick={() => {
                if (hasDeadline) {
                  setTooltip(tooltip?.day === cell.day ? null : { day: cell.day, items: dayDeadlines });
                } else {
                  setTooltip(null);
                }
              }}
              className={`h-9 flex flex-col items-center justify-center rounded-lg transition-colors relative
                ${isToday ? "bg-[#6C6CFF]/20 font-bold" : ""}
                ${hasCritical && !isToday ? "bg-[#E5484D]/10" : ""}
                ${hasDeadline ? "cursor-pointer hover:bg-white/[0.06]" : ""}
              `}
            >
              <span className={`text-[13px] ${isToday ? "text-[#6C6CFF] font-bold" : "text-[#ECECEE]"}`}>
                {cell.day}
              </span>
              {hasDeadline && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayDeadlines.slice(0, 3).map((dl, idx) => {
                    const urg = getDeadlineUrgency(dl.days_left);
                    return <div key={idx} className={`w-1 h-1 rounded-full ${urg.dot}`} />;
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 border border-white/[0.08] bg-[#1A1A1F] rounded-xl p-4 space-y-2"
        >
          <p className="text-[13px] font-semibold text-[#8B8B8E]">{tooltip.day} {TR_MONTHS[month]}</p>
          {tooltip.items.map(dl => {
            const urg = getDeadlineUrgency(dl.days_left);
            return (
              <Link key={dl.id} href={`/davalar/${dl.case_id}`} className="flex items-center gap-2 hover:bg-white/[0.04] rounded-md px-1.5 py-1 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${urg.dot}`} />
                <span className="text-[13px] text-[#ECECEE] truncate flex-1">{dl.title}</span>
                <span className={`text-[12px] font-medium ${urg.text}`}>{urg.label}</span>
              </Link>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
