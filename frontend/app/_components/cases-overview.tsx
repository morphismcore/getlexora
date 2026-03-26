"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { CaseSummary } from "./types";
import { timeAgo, getCaseTypeColor } from "./helpers";

export default function CasesOverview({ cases, casesByStatus }: { cases: CaseSummary[]; casesByStatus: Record<string, number> }) {
  const statusTabs = useMemo(() => {
    const tabs: { key: string; label: string; count: number }[] = [];
    const statusLabels: Record<string, string> = {
      aktif: "Aktif",
      active: "Aktif",
      beklemede: "Beklemede",
      pending: "Beklemede",
      kapanan: "Kapanan",
      closed: "Kapanan",
      kazanildi: "Kazanildi",
      kaybedildi: "Kaybedildi",
    };
    if (casesByStatus && Object.keys(casesByStatus).length > 0) {
      Object.entries(casesByStatus).forEach(([key, count]) => {
        tabs.push({ key, label: statusLabels[key.toLowerCase()] || key, count });
      });
    } else {
      // Derive from cases
      const grouped: Record<string, number> = {};
      cases.forEach(c => {
        const s = c.status || "aktif";
        grouped[s] = (grouped[s] || 0) + 1;
      });
      Object.entries(grouped).forEach(([key, count]) => {
        tabs.push({ key, label: statusLabels[key.toLowerCase()] || key, count });
      });
    }
    if (tabs.length === 0) {
      tabs.push({ key: "all", label: "Tumu", count: cases.length });
    }
    return tabs;
  }, [cases, casesByStatus]);

  const [activeTab, setActiveTab] = useState(statusTabs[0]?.key || "all");

  const filteredCases = useMemo(() => {
    if (activeTab === "all") return cases;
    return cases.filter(c => (c.status || "aktif").toLowerCase() === activeTab.toLowerCase());
  }, [cases, activeTab]);

  const maxVisible = 6;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Davalarim</h2>
          <span className="text-[12px] text-[#5C5C5F]">{cases.length}</span>
        </div>
        <Link href="/davalar" className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] border border-[#6C6CFF]/20 rounded-lg px-3 py-1 hover:bg-[#6C6CFF]/10 transition-colors">
          Yeni Dava
        </Link>
      </div>

      {/* Tabs */}
      {statusTabs.length > 1 && (
        <div className="flex gap-1 border-b border-white/[0.06]">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-[12px] font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-[#ECECEE]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              {tab.label} ({tab.count})
              {activeTab === tab.key && (
                <motion.div layoutId="case-tab-underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6C6CFF] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cases */}
      {filteredCases.length === 0 ? (
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-[13px] text-[#5C5C5F]">Bu kategoride dava yok</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredCases.slice(0, maxVisible).map((c, i) => {
            const typeColor = getCaseTypeColor(c.case_type);
            const hasOverdue = c.next_deadline && c.next_deadline.days_left <= 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/davalar/${c.id}`}
                  className="flex items-center gap-3 bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-white/[0.10] hover:bg-[#16161A] transition-all group"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#ECECEE] truncate group-hover:text-[#6C6CFF] transition-colors">{c.title}</p>
                    <p className="text-[12px] text-[#5C5C5F] truncate">{c.court || c.case_type}{c.case_number ? ` · ${c.case_number}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.deadline_count > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        hasOverdue ? "bg-[#E5484D]/10 text-[#E5484D]" : "bg-white/[0.04] text-[#8B8B8E]"
                      }`}>
                        {c.deadline_count} sure
                      </span>
                    )}
                    {c.document_count > 0 && (
                      <span className="text-[10px] text-[#5C5C5F] px-1.5 py-0.5 rounded bg-white/[0.04]">{c.document_count} belge</span>
                    )}
                    <span className="text-[10px] text-[#3A3A3F]">{timeAgo(c.updated_at)}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {filteredCases.length > maxVisible && (
            <Link href="/davalar" className="block text-center text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] py-2 transition-colors">
              Tum davalari gor ({filteredCases.length})
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
