"use client";

import { motion } from "motion/react";
import { FORMAT_ICONS } from "./types";

/* ─── Format Icon Component ─── */
export function FormatIcon({ ext, size = 32, bounce = false }: { ext: string; size?: number; bounce?: boolean }) {
  const info = FORMAT_ICONS[ext] || { color: "#8B8B8E", label: ext.toUpperCase() };
  return (
    <motion.div
      animate={bounce ? { y: [0, -4, 0] } : {}}
      transition={bounce ? { duration: 0.6, repeat: Infinity, repeatDelay: 0.3 } : {}}
      className="flex flex-col items-center gap-1"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={info.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6" stroke={info.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: info.color }}>{info.label}</span>
    </motion.div>
  );
}

/* ─── Entity Card ─── */
export function EntityCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#09090B] border border-white/[0.04] rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">{label}</span>
      </div>
      <p className="text-[13px] text-[#ECECEE]">{value}</p>
    </div>
  );
}

/* ─── Progress Bar ─── */
export function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[#8B8B8E]">Yükleniyor...</span>
        <span className="text-[11px] font-mono text-[#6C6CFF] tabular-nums">%{Math.round(progress)}</span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#6C6CFF] to-[#A78BFA]"
          style={{ boxShadow: "0 0 8px rgba(108,108,255,0.3)" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
