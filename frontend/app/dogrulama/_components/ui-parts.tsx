"use client";

import { motion } from "motion/react";
import type { CitationResult, VerifyResponse } from "./types";
import { getStatusConfig, getBarColor, getBarTextColor } from "./types";

/* ─── Shimmer / Skeleton ─── */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1A1F] rounded ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  );
}

export function SkeletonResults() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (<ShimmerBlock key={i} className="h-[76px] rounded-xl" />))}
      </div>
      <ShimmerBlock className="h-20 rounded-xl" />
      <div className="space-y-2">
        <ShimmerBlock className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (<ShimmerBlock key={i} className="h-32 rounded-xl" />))}
      </div>
    </div>
  );
}

/* ─── Status Icon ─── */
function StatusIcon({ status }: { status: CitationResult["status"] }) {
  const cfg = getStatusConfig(status);
  if (status === "unverified") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={cfg.iconPath} />
    </svg>
  );
}

/* ─── Summary Stats ─── */
export function SummaryStats({ results }: { results: VerifyResponse }) {
  const listItem = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 text-center">
        <p className="text-2xl font-semibold text-[#ECECEE]">{results.total_citations}</p>
        <p className="text-[12px] text-[#8B8B8E] mt-1">Toplam Atıf</p>
      </motion.div>
      <motion.div variants={listItem} className="bg-[#3DD68C]/[0.03] border border-[#3DD68C]/20 rounded-xl p-4 text-center">
        <p className="text-2xl font-semibold text-[#3DD68C]">{results.verified}</p>
        <p className="text-[12px] text-[#8B8B8E] mt-1">Doğrulanan</p>
      </motion.div>
      <motion.div variants={listItem} className="bg-[#E5484D]/[0.03] border border-[#E5484D]/20 rounded-xl p-4 text-center">
        <p className="text-2xl font-semibold text-[#E5484D]">{results.not_found}</p>
        <p className="text-[12px] text-[#8B8B8E] mt-1">Bulunamayan</p>
      </motion.div>
      <motion.div variants={listItem} className="bg-[#FFB224]/[0.03] border border-[#FFB224]/20 rounded-xl p-4 text-center">
        <p className="text-2xl font-semibold text-[#FFB224]">{results.partial_match}</p>
        <p className="text-[12px] text-[#8B8B8E] mt-1">Kısmi Eşleşme</p>
      </motion.div>
    </div>
  );
}

/* ─── Confidence Bar ─── */
export function ConfidenceBar({ confidence }: { confidence: number }) {
  const listItem = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
  return (
    <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-[#8B8B8E]">Genel Güven Skoru</span>
        <span className={`text-[15px] font-semibold ${getBarTextColor(confidence)}`}>%{Math.round(confidence * 100)}</span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${getBarColor(confidence)}`}
          initial={{ width: 0 }} animate={{ width: `${confidence * 100}%` }} transition={{ duration: 0.8 }} />
      </div>
    </motion.div>
  );
}

/* ─── Citation Card ─── */
export function CitationCard({ detail }: { detail: CitationResult }) {
  const statusConfig = getStatusConfig(detail.status);
  const listItem = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
  return (
    <motion.div variants={listItem} className={`border rounded-xl p-4 ${statusConfig.cardBorder} ${statusConfig.cardBg}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
          detail.reference.citation_type === "ictihat" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]"
          : detail.reference.citation_type === "mevzuat" ? "bg-[#A78BFA]/10 text-[#A78BFA]"
          : "bg-white/[0.04] text-[#8B8B8E]"
        }`}>
          {detail.reference.citation_type === "ictihat" ? "İçtihat" : detail.reference.citation_type === "mevzuat" ? "Mevzuat" : detail.reference.citation_type.toUpperCase()}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusConfig.badgeClass}`}>
          <span className={statusConfig.iconColor}><StatusIcon status={detail.status} /></span>
          {statusConfig.label}
        </span>
      </div>
      <p className="text-[13px] font-mono font-medium text-[#ECECEE] mb-2">{detail.reference.raw_text}</p>
      {detail.found_match && (<p className="text-[12px] text-[#8B8B8E] mb-1">Kaynak: {detail.found_match}</p>)}
      {detail.suggestion && (<p className="text-[12px] text-[#5C5C5F] italic mt-1">Öneri: {detail.suggestion}</p>)}
      <div className="mt-2"><span className="text-[11px] text-[#5C5C5F]">Doğrulama süresi: {(detail.verification_ms / 1000).toFixed(1)}s</span></div>
    </motion.div>
  );
}
