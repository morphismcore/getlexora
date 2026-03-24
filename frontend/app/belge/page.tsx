"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */
interface Citation { raw_text: string; pattern_type: string; }
interface Parties { davaci: string | null; davali: string | null; davaci_vekili: string | null; davali_vekili: string | null; }
interface CaseInfo { mahkeme: string | null; esas_no: string | null; karar_no: string | null; tarih: string | null; }
interface DocMetadata { title: string; author: string; subject: string; }
interface AnalyzeResult {
  file_name: string; file_type: string; pages: number | null; paragraphs: number | null;
  document_type: string; parties: Parties; case_info: CaseInfo;
  citations: Citation[]; metadata: DocMetadata; text: string; text_length: number;
}

interface UploadHistoryItem {
  file_name: string; file_type: string; document_type: string;
  text_length: number; citations_count: number; timestamp: string;
}

/* ─── Constants ─── */
const DOC_TYPE_LABELS: Record<string, string> = {
  dilekce: "Dilekçe", karar: "Karar", bilirkisi_raporu: "Bilirkişi Raporu",
  sozlesme: "Sözleşme", ihtarname: "İhtarname", diger: "Diğer",
};
const DOC_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dilekce: { bg: "bg-[#6C6CFF]/10", text: "text-[#6C6CFF]", border: "border-[#6C6CFF]/20" },
  karar: { bg: "bg-[#A78BFA]/10", text: "text-[#A78BFA]", border: "border-[#A78BFA]/20" },
  bilirkisi_raporu: { bg: "bg-[#FFB224]/10", text: "text-[#FFB224]", border: "border-[#FFB224]/20" },
  sozlesme: { bg: "bg-[#3DD68C]/10", text: "text-[#3DD68C]", border: "border-[#3DD68C]/20" },
  ihtarname: { bg: "bg-[#E5484D]/10", text: "text-[#E5484D]", border: "border-[#E5484D]/20" },
  diger: { bg: "bg-white/[0.06]", text: "text-[#8B8B8E]", border: "border-white/[0.06]" },
};
const PATTERN_LABELS: Record<string, string> = {
  yargitay: "Yargıtay", danistay: "Danıştay", aym_norm: "AYM Norm",
  aym_bireysel: "AYM Bireysel", kanun_sayili: "Kanun", kanun_madde: "Kanun Madde",
};
const PATTERN_COLORS: Record<string, string> = {
  yargitay: "text-[#6C6CFF] bg-[#6C6CFF]/10", danistay: "text-[#A78BFA] bg-[#A78BFA]/10",
  aym_norm: "text-[#E5484D] bg-[#E5484D]/10", aym_bireysel: "text-[#E5484D] bg-[#E5484D]/10",
  kanun_sayili: "text-[#3DD68C] bg-[#3DD68C]/10", kanun_madde: "text-[#3DD68C] bg-[#3DD68C]/10",
};

const FORMAT_ICONS: Record<string, { color: string; label: string }> = {
  pdf: { color: "#E5484D", label: "PDF" },
  docx: { color: "#6C6CFF", label: "DOCX" },
  txt: { color: "#3DD68C", label: "TXT" },
};

/* ─── Helpers ─── */
function getDocTypeStyle(dt: string) {
  return DOC_TYPE_COLORS[dt] || DOC_TYPE_COLORS.diger;
}

function detectRisks(result: AnalyzeResult): { label: string; level: "warning" | "info" }[] {
  const risks: { label: string; level: "warning" | "info" }[] = [];
  if (!result.parties.davaci && !result.parties.davali) risks.push({ label: "Taraf bilgisi bulunamadı", level: "warning" });
  if (!result.case_info.esas_no && !result.case_info.karar_no) risks.push({ label: "Esas/Karar numarası tespit edilemedi", level: "info" });
  if (result.citations.length === 0) risks.push({ label: "Hukuki atıf/referans bulunamadı", level: "info" });
  if (result.text_length < 500) risks.push({ label: "Belge metni çok kısa", level: "warning" });
  return risks;
}

/* ─── Format Icon Component ─── */
function FormatIcon({ ext, size = 32, bounce = false }: { ext: string; size?: number; bounce?: boolean }) {
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
function EntityCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
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
function UploadProgressBar({ progress }: { progress: number }) {
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

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function BelgePage() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "viewer" | "history">("overview");
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem("lexora_upload_history");
    if (saved) try { setUploadHistory(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null); setResult(null); setUploadProgress(0);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type) && ext !== "pdf" && ext !== "docx") {
      setError("Sadece PDF ve DOCX dosyaları kabul edilir."); return;
    }
    if (file.size > 20 * 1024 * 1024) { setError("Dosya boyutu 20MB sınırını aşıyor."); return; }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await new Promise<AnalyzeResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const timeoutId = setTimeout(() => { xhr.abort(); reject(new Error("İstek zaman aşımına uğradı.")); }, 30000);

        xhr.open("POST", `${API_URL}/api/v1/upload/analyze`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 90));
          }
        };

        xhr.onload = () => {
          clearTimeout(timeoutId);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve(parsed);
            } catch {
              reject(new Error("Yanıt ayrıştırılamadı"));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData?.detail || `Hata: ${xhr.status}`));
            } catch {
              reject(new Error(`Hata: ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => { clearTimeout(timeoutId); reject(new Error("Ağ hatası")); };
        xhr.onabort = () => { clearTimeout(timeoutId); reject(new Error("İstek zaman aşımına uğradı.")); };
        xhr.send(formData);
      });

      setUploadProgress(100);
      setTimeout(() => {
        setResult(data);
        setActiveTab("overview");
        setToast("Belge başarıyla analiz edildi");

        // Save to history
        const historyItem: UploadHistoryItem = {
          file_name: data.file_name, file_type: data.file_type,
          document_type: data.document_type, text_length: data.text_length,
          citations_count: data.citations.length, timestamp: new Date().toISOString(),
        };
        setUploadHistory((prev) => {
          const updated = [historyItem, ...prev].slice(0, 20);
          localStorage.setItem("lexora_upload_history", JSON.stringify(updated));
          return updated;
        });
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) uploadFile(file); }, [uploadFile]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ""; }, [uploadFile]);

  const hasParties = result && (result.parties.davaci || result.parties.davali || result.parties.davaci_vekili || result.parties.davali_vekili);
  const hasCaseInfo = result && (result.case_info.mahkeme || result.case_info.esas_no || result.case_info.karar_no || result.case_info.tarih);
  const risks = useMemo(() => result ? detectRisks(result) : [], [result]);

  return (
    <div className="h-screen overflow-auto bg-[#09090B] p-5 pt-14 md:p-8 md:pt-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-[#ECECEE] tracking-tight">Belge Analiz</h1>
            <p className="text-[13px] text-[#5C5C5F] mt-0.5">PDF veya DOCX belgenizi yükleyin — metin, taraflar, atıflar otomatik çıkarılır</p>
          </div>
          {uploadHistory.length > 0 && !result && (
            <button onClick={() => setActiveTab("history")} className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">
              Geçmiş ({uploadHistory.length})
            </button>
          )}
        </div>

        {/* Upload Area */}
        {!result && activeTab !== "history" && (
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !loading && fileInputRef.current?.click()}
            animate={dragOver ? { scale: 1.01 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 py-14 px-6 ${
              dragOver
                ? "border-[#6C6CFF] bg-[#6C6CFF]/[0.06] shadow-[0_0_30px_rgba(108,108,255,0.1)]"
                : "border-[#2A2A2E] bg-[#111113] hover:border-[#3A3A3E] hover:bg-[#151517]"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileSelect} className="hidden" />

            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <motion.div className="w-12 h-12 border-2 border-[#6C6CFF] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                <UploadProgressBar progress={uploadProgress} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6">
                  <FormatIcon ext="pdf" bounce={dragOver} />
                  <FormatIcon ext="docx" bounce={dragOver} />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-medium text-[#ECECEE]">Dosya sürükleyin veya tıklayarak seçin</p>
                  <p className="text-[12px] text-[#5C5C5F] mt-1">PDF, DOCX — Maks. 20MB</p>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Upload History */}
        {activeTab === "history" && !result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-[#ECECEE]">Yükleme Geçmişi</h2>
              <button onClick={() => setActiveTab("overview")} className="text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Geri</button>
            </div>
            {uploadHistory.map((item, i) => (
              <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#ECECEE]">{item.file_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5C5C5F]">
                    <span className="uppercase font-medium">{item.file_type}</span>
                    <span>{DOC_TYPE_LABELS[item.document_type] || item.document_type}</span>
                    <span>{item.citations_count} atıf</span>
                  </div>
                </div>
                <span className="text-[10px] text-[#5C5C5F]">{new Date(item.timestamp).toLocaleDateString("tr-TR")}</span>
              </div>
            ))}
            {uploadHistory.length === 0 && (
              <p className="text-center text-[13px] text-[#5C5C5F] py-8">Henüz yükleme yapılmadı</p>
            )}
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl bg-[#E5484D]/[0.06] border border-[#E5484D]/15 px-4 py-3 text-[13px] text-[#E5484D]">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* File info header */}
              <div className="rounded-2xl bg-[#111113] border border-white/[0.06] p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <h2 className="text-[16px] font-semibold text-[#ECECEE]">{result.file_name}</h2>
                    <div className="flex items-center gap-3 text-[12px] text-[#8B8B8E]">
                      <span className="uppercase font-medium">{result.file_type}</span>
                      {result.pages != null && <span>{result.pages} sayfa</span>}
                      {result.paragraphs != null && <span>{result.paragraphs} paragraf</span>}
                      <span>{result.text_length.toLocaleString("tr-TR")} karakter</span>
                    </div>
                  </div>
                  {(() => {
                    const style = getDocTypeStyle(result.document_type);
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                        {DOC_TYPE_LABELS[result.document_type] || result.document_type}
                      </span>
                    );
                  })()}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                  <button onClick={() => { localStorage.setItem("lexora_verify_text", result.citations.map((c) => c.raw_text).join("\n")); window.open("/dogrulama", "_blank"); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#3DD68C] bg-[#3DD68C]/[0.06] border border-[#3DD68C]/15 rounded-xl hover:bg-[#3DD68C]/10 transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Atıfları Doğrula
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `${result.file_name}_analiz.json`; a.click(); URL.revokeObjectURL(url);
                    setToast("Analiz dışa aktarıldı");
                  }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-xl hover:border-white/[0.10] transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Dışa Aktar
                  </button>
                  <button onClick={() => { setResult(null); setActiveTab("overview"); }}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">
                    Yeni Belge Yükle
                  </button>
                </div>
              </div>

              {/* Tab switcher for results */}
              <div className="flex items-center gap-0.5">
                {[
                  { key: "overview" as const, label: "Genel Bakış" },
                  { key: "viewer" as const, label: "Belge Görüntüleyici" },
                ].map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${activeTab === tab.key ? "text-[#ECECEE]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
                    {tab.label}
                    {activeTab === tab.key && (
                      <motion.div layoutId="belgeTab" className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6C6CFF] rounded-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Risk warnings */}
                  {risks.length > 0 && (
                    <div className="bg-[#FFB224]/[0.04] border border-[#FFB224]/15 rounded-2xl p-4 space-y-2">
                      <h3 className="text-[12px] font-semibold text-[#FFB224] uppercase tracking-wider flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 9v2m0 4h.01M10.29 3.86l-8.79 15.2a1 1 0 00.87 1.5h17.58a1 1 0 00.87-1.5l-8.79-15.2a1 1 0 00-1.74 0z" /></svg>
                        Dikkat Edilmesi Gerekenler
                      </h3>
                      {risks.map((r, i) => (
                        <p key={i} className={`text-[12px] ${r.level === "warning" ? "text-[#FFB224]" : "text-[#8B8B8E]"}`}>• {r.label}</p>
                      ))}
                    </div>
                  )}

                  {/* Entities grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Parties */}
                    <div className="rounded-2xl bg-[#111113] border border-white/[0.06] p-5">
                      <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#6C6CFF] rounded-full" />
                        Taraflar
                      </h3>
                      {hasParties ? (
                        <div className="space-y-2">
                          {result.parties.davaci && <EntityCard label="Davacı" value={result.parties.davaci} />}
                          {result.parties.davali && <EntityCard label="Davalı" value={result.parties.davali} />}
                          {result.parties.davaci_vekili && <EntityCard label="Davacı Vekili" value={result.parties.davaci_vekili} />}
                          {result.parties.davali_vekili && <EntityCard label="Davalı Vekili" value={result.parties.davali_vekili} />}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#5C5C5F]">Taraf bilgisi bulunamadı.</p>
                      )}
                    </div>

                    {/* Case Info */}
                    <div className="rounded-2xl bg-[#111113] border border-white/[0.06] p-5">
                      <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#A78BFA] rounded-full" />
                        Dava Bilgileri
                      </h3>
                      {hasCaseInfo ? (
                        <div className="space-y-2">
                          {result.case_info.mahkeme && <EntityCard label="Mahkeme" value={result.case_info.mahkeme} />}
                          {result.case_info.esas_no && <EntityCard label="Esas No" value={result.case_info.esas_no} />}
                          {result.case_info.karar_no && <EntityCard label="Karar No" value={result.case_info.karar_no} />}
                          {result.case_info.tarih && <EntityCard label="Tarih" value={result.case_info.tarih} />}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#5C5C5F]">Dava bilgisi bulunamadı.</p>
                      )}
                    </div>
                  </div>

                  {/* Citations */}
                  <div className="rounded-2xl bg-[#111113] border border-white/[0.06] p-5">
                    <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#3DD68C] rounded-full" />
                      Bulunan Referanslar
                      {result.citations.length > 0 && (
                        <span className="text-[11px] font-normal text-[#5C5C5F]">({result.citations.length})</span>
                      )}
                    </h3>
                    {result.citations.length > 0 ? (
                      <div className="space-y-2">
                        {result.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => { localStorage.setItem("lexora_verify_text", c.raw_text); window.open("/dogrulama", "_blank"); }}
                            className="w-full flex items-start gap-3 rounded-xl bg-[#09090B] px-3 py-2.5 border border-white/[0.04] hover:border-[#6C6CFF]/20 hover:bg-[#6C6CFF]/[0.02] transition-all text-left group"
                          >
                            <span className={`text-[10px] uppercase tracking-wider font-semibold mt-0.5 whitespace-nowrap px-1.5 py-0.5 rounded ${PATTERN_COLORS[c.pattern_type] || "text-[#8B8B8E] bg-white/[0.06]"}`}>
                              {PATTERN_LABELS[c.pattern_type] || c.pattern_type}
                            </span>
                            <span className="text-[13px] text-[#ECECEE] break-all group-hover:text-[#6C6CFF] transition-colors">{c.raw_text}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 mt-0.5 text-[#3A3A3F] group-hover:text-[#6C6CFF] transition-colors">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-[#5C5C5F]">Belgede hukuki referans bulunamadı.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Viewer Tab */}
              {activeTab === "viewer" && (
                <div className="rounded-2xl bg-[#111113] border border-white/[0.06] p-5">
                  <pre className="text-[13px] text-[#ECECEE]/90 whitespace-pre-wrap leading-[1.7] max-h-[600px] overflow-auto rounded-xl bg-[#09090B] border border-white/[0.04] p-5">
                    {result.text}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div role="alert" aria-live="polite" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <span className="text-[13px] text-[#ECECEE]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}