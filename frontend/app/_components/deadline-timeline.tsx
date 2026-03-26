"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { DashboardData, DeadlineItem } from "./types";
import { formatShortDate, getDeadlineUrgency } from "./helpers";

export default function DeadlineTimeline({ deadlines }: { deadlines: DashboardData["deadlines"] }) {
  const [nextWeekOpen, setNextWeekOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const deadlineSectionRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalCount = (deadlines.overdue?.length || 0) + (deadlines.today?.length || 0) + (deadlines.this_week?.length || 0) + (deadlines.next_week?.length || 0) + (deadlines.later?.length || 0);

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
          <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu Gor</Link>
        </div>
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#1A1A1F] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <p className="text-[13px] text-[#5C5C5F]">Henuz sure eklenmemis</p>
          <Link href="/davalar" className="inline-block mt-3 text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF]">Dava dosyalarindan sure ekle</Link>
        </div>
      </div>
    );
  }

  const renderDeadlineItem = (dl: DeadlineItem, elevated: boolean) => {
    const urg = getDeadlineUrgency(dl.days_left);
    const dateFormatted = formatShortDate(dl.deadline_date);

    if (elevated) {
      return (
        <motion.div
          key={dl.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-[#111113] border ${urg.border} rounded-xl p-4 shadow-lg shadow-black/20`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${urg.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-[#ECECEE] truncate">{dl.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urg.bg} ${urg.text}`}>{urg.label}</span>
              </div>
              <p className="text-[12px] text-[#5C5C5F] mt-1 truncate">
                {dl.case_title || ""} {dl.court ? `· ${dl.court}` : ""}
              </p>
              {dl.law_reference && (
                <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-[#6C6CFF]/10 text-[#6C6CFF]">{dl.law_reference}</span>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href={`/davalar/${dl.case_id}`}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 rounded-md hover:bg-[#6C6CFF]/20 transition-colors"
                >
                  Davayi Ac
                </Link>
              </div>
            </div>
            <span className="text-[11px] text-[#5C5C5F] shrink-0">{dateFormatted}</span>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={dl.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.push(`/davalar/${dl.case_id}`)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-[#ECECEE] truncate block">{dl.title}</span>
          <span className="text-[11px] text-[#5C5C5F] truncate block">{dl.case_title}{dl.court ? ` · ${dl.court}` : ""}</span>
        </div>
        {dl.law_reference && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6C6CFF]/10 text-[#6C6CFF] shrink-0 hidden sm:inline">{dl.law_reference}</span>
        )}
        <span className="text-[11px] text-[#5C5C5F] shrink-0">{dateFormatted}</span>
        <span className={`text-[11px] font-medium shrink-0 ${urg.text}`}>{urg.label}</span>
      </motion.div>
    );
  };

  const renderSection = (
    title: string,
    items: DeadlineItem[],
    colorClass: string,
    borderColor: string,
    sectionKey: string,
    elevated: boolean,
    _defaultOpen: boolean,
    pulseDot?: boolean,
  ) => {
    if (!items || items.length === 0) return null;
    const maxVisible = 5;
    const isExpanded = expandedSections[sectionKey] || false;
    const visibleItems = isExpanded ? items : items.slice(0, maxVisible);
    const hasMore = items.length > maxVisible;

    return (
      <div className="space-y-2" key={sectionKey}>
        <div className="flex items-center gap-2 px-1">
          {pulseDot && <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse" />}
          <span className={`text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>{title}</span>
          <span className="text-[10px] text-[#5C5C5F]">({items.length})</span>
        </div>
        <div className={`border-l-2 ${borderColor} pl-3 space-y-2`}>
          {elevated ? (
            <div className="space-y-2">
              {visibleItems.map(dl => renderDeadlineItem(dl, true))}
            </div>
          ) : (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {visibleItems.map(dl => renderDeadlineItem(dl, false))}
            </div>
          )}
          {hasMore && !isExpanded && (
            <button
              onClick={() => toggleExpand(sectionKey)}
              className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors px-3 py-1"
            >
              +{items.length - maxVisible} daha...
            </button>
          )}
          {hasMore && isExpanded && (
            <button
              onClick={() => toggleExpand(sectionKey)}
              className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors px-3 py-1"
            >
              Daralt
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" ref={deadlineSectionRef} id="deadline-section">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#ECECEE]">Sure Takip</h2>
        <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumunu Gor</Link>
      </div>

      {renderSection("Gecikmis", deadlines.overdue || [], "text-[#E5484D]", "border-[#E5484D]", "overdue", true, true, true)}
      {renderSection("Bugun", deadlines.today || [], "text-[#E5484D]", "border-[#E5484D]", "today", true, true)}
      {renderSection("Bu Hafta", deadlines.this_week || [], "text-[#FFB224]", "border-[#FFB224]", "this_week", false, true)}

      {/* Gelecek Hafta -- collapsed by default */}
      {(deadlines.next_week || []).length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setNextWeekOpen(!nextWeekOpen)}
            className="flex items-center gap-2 px-1 w-full text-left group"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`text-[#5C5C5F] transition-transform ${nextWeekOpen ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C5C5F]">Gelecek Hafta</span>
            <span className="text-[10px] text-[#3A3A3F]">({(deadlines.next_week || []).length})</span>
          </button>
          {nextWeekOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="border-l-2 border-[#5C5C5F] pl-3"
            >
              <div className="bg-[#111113] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
                {(deadlines.next_week || []).map(dl => renderDeadlineItem(dl, false))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
