"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";

import type { CaseDetail } from "./types";
import { CASE_TYPES, STATUS_COLORS, TABS, type TabKey } from "./types";
import { getToken, apiFetch } from "./helpers";
import OlaylarTab from "./olaylar-tab";

/* ─── OzetTab ─── */

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

/* ─── PlaceholderTab ─── */

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
                  activeTab === tab.key ? "text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"
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
