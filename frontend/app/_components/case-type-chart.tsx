"use client";

import Link from "next/link";
import { getCaseTypeColor } from "./helpers";

export default function CaseTypeChart({ casesByType }: { casesByType: Record<string, number> }) {
  const entries = Object.entries(casesByType || {});
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return null;

  const typeLabels: Record<string, string> = {
    is_hukuku: "Is Hukuku",
    ceza: "Ceza",
    ticaret: "Ticaret",
    idare: "Idare",
    aile: "Aile",
    icra: "Icra",
    vergi: "Vergi",
  };

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3">
      <h3 className="text-[13px] font-semibold text-[#ECECEE]">Dava Tipleri</h3>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
        {entries.map(([type, count]) => {
          const color = getCaseTypeColor(type);
          const pct = (count / total) * 100;
          return (
            <Link
              key={type}
              href={`/davalar?type=${encodeURIComponent(type)}`}
              className="h-full transition-opacity hover:opacity-80"
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${typeLabels[type] || type}: ${count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([type, count]) => {
          const color = getCaseTypeColor(type);
          return (
            <Link key={type} href={`/davalar?type=${encodeURIComponent(type)}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-[#8B8B8E]">{typeLabels[type] || type}</span>
              <span className="text-[10px] text-[#5C5C5F]">{count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
