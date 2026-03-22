"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────

interface Citation {
  raw_text: string;
  pattern_type: string;
}

interface Parties {
  davaci: string | null;
  davali: string | null;
  davaci_vekili: string | null;
  davali_vekili: string | null;
}

interface CaseInfo {
  mahkeme: string | null;
  esas_no: string | null;
  karar_no: string | null;
  tarih: string | null;
}

interface DocMetadata {
  title: string;
  author: string;
  subject: string;
}

interface AnalyzeResult {
  file_name: string;
  file_type: string;
  pages: number | null;
  paragraphs: number | null;
  document_type: string;
  parties: Parties;
  case_info: CaseInfo;
  citations: Citation[];
  metadata: DocMetadata;
  text: string;
  text_length: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  dilekce: "Dilekçe",
  karar: "Karar",
  bilirkisi_raporu: "Bilirkişi Raporu",
  sozlesme: "Sözleşme",
  ihtarname: "İhtarname",
  diger: "Diğer",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  dilekce: "bg-blue-500/20 text-blue-400",
  karar: "bg-purple-500/20 text-purple-400",
  bilirkisi_raporu: "bg-amber-500/20 text-amber-400",
  sozlesme: "bg-emerald-500/20 text-emerald-400",
  ihtarname: "bg-red-500/20 text-red-400",
  diger: "bg-gray-500/20 text-gray-400",
};

const PATTERN_LABELS: Record<string, string> = {
  yargitay: "Yargitay",
  danistay: "Danistay",
  aym_norm: "AYM Norm",
  aym_bireysel: "AYM Bireysel",
  kanun_sayili: "Kanun",
  kanun_madde: "Kanun Madde",
};

// ── Component ────────────────────────────────────────────────────────

export default function BelgePage() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setTextExpanded(false);

    // Validate type
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && ext !== "pdf" && ext !== "docx") {
      setError("Sadece PDF ve DOCX dosyaları kabul edilir.");
      return;
    }

    // Validate size
    if (file.size > 20 * 1024 * 1024) {
      setError("Dosya boyutu 20MB sınırını aşıyor.");
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/v1/upload/analyze`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Hata: ${res.status}`);
      }

      const data: AnalyzeResult = await res.json();
      setResult(data);
      setToast("Belge başarıyla analiz edildi");
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [uploadFile]
  );

  const hasParties =
    result &&
    (result.parties.davaci ||
      result.parties.davali ||
      result.parties.davaci_vekili ||
      result.parties.davali_vekili);

  const hasCaseInfo =
    result &&
    (result.case_info.mahkeme ||
      result.case_info.esas_no ||
      result.case_info.karar_no ||
      result.case_info.tarih);

  return (
    <div className="h-screen overflow-auto bg-[#09090B] p-4 pt-14 md:p-6 md:pt-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg animate-fade-in">
          {toast}
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[15px] font-semibold text-[#ECECEE] tracking-[-0.01em]">
            Belge Analiz
          </h1>
          <p className="text-sm text-[#8B8B8E] mt-1">
            PDF veya DOCX belgenizi yükleyin. Metin çıkarılır, belge türü
            tespit edilir, taraflar ve referanslar bulunur.
          </p>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3
            rounded-xl border-2 border-dashed cursor-pointer
            transition-all duration-200 py-12 px-6
            ${
              dragOver
                ? "border-[#6C6CFF] bg-[#6C6CFF]/[0.08]"
                : "border-[#2A2A2E] bg-[#111113] hover:border-[#3A3A3E] hover:bg-[#151517]"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="w-10 h-10 border-2 border-[#6C6CFF] border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-sm text-[#8B8B8E]">
                Belge işleniyor...
              </span>
            </div>
          ) : (
            <>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke={dragOver ? "#6C6CFF" : "#5C5C5F"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="text-center">
                <span className="text-sm font-medium text-[#ECECEE]">
                  Dosya sürükleyin veya tıklayarak seçin
                </span>
                <p className="text-xs text-[#5C5C5F] mt-1">
                  PDF, DOCX -- Maks. 20MB
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* File info + document type badge */}
              <div className="rounded-xl bg-[#111113] border border-white/[0.06] p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h2 className="text-base font-medium text-[#ECECEE]">
                      {result.file_name}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-[#8B8B8E]">
                      <span className="uppercase font-medium">
                        {result.file_type}
                      </span>
                      {result.pages != null && (
                        <span>{result.pages} sayfa</span>
                      )}
                      {result.paragraphs != null && (
                        <span>{result.paragraphs} paragraf</span>
                      )}
                      <span>
                        {result.text_length.toLocaleString("tr-TR")} karakter
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      DOC_TYPE_COLORS[result.document_type] ||
                      DOC_TYPE_COLORS.diger
                    }`}
                  >
                    {DOC_TYPE_LABELS[result.document_type] || result.document_type}
                  </span>
                </div>

                {/* Metadata */}
                {(result.metadata.title || result.metadata.author) && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-4 text-xs text-[#8B8B8E]">
                    {result.metadata.title && (
                      <span>
                        <span className="text-[#5C5C5F]">Başlık:</span>{" "}
                        {result.metadata.title}
                      </span>
                    )}
                    {result.metadata.author && (
                      <span>
                        <span className="text-[#5C5C5F]">Yazar:</span>{" "}
                        {result.metadata.author}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Two-column grid for parties and case info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taraflar */}
                <div className="rounded-xl bg-[#111113] border border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6C6CFF"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    Taraflar
                  </h3>
                  {hasParties ? (
                    <div className="space-y-2">
                      {result.parties.davaci && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Davacı
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.parties.davaci}
                          </p>
                        </div>
                      )}
                      {result.parties.davali && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Davalı
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.parties.davali}
                          </p>
                        </div>
                      )}
                      {result.parties.davaci_vekili && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Davacı Vekili
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.parties.davaci_vekili}
                          </p>
                        </div>
                      )}
                      {result.parties.davali_vekili && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Davalı Vekili
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.parties.davali_vekili}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5C5C5F]">
                      Taraf bilgisi bulunamadı.
                    </p>
                  )}
                </div>

                {/* Dava Bilgileri */}
                <div className="rounded-xl bg-[#111113] border border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6C6CFF"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Dava Bilgileri
                  </h3>
                  {hasCaseInfo ? (
                    <div className="space-y-2">
                      {result.case_info.mahkeme && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Mahkeme
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.case_info.mahkeme}
                          </p>
                        </div>
                      )}
                      {result.case_info.esas_no && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Esas No
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.case_info.esas_no}
                          </p>
                        </div>
                      )}
                      {result.case_info.karar_no && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Karar No
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.case_info.karar_no}
                          </p>
                        </div>
                      )}
                      {result.case_info.tarih && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#5C5C5F] font-medium">
                            Tarih
                          </span>
                          <p className="text-sm text-[#ECECEE] mt-0.5">
                            {result.case_info.tarih}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5C5C5F]">
                      Dava bilgisi bulunamadı.
                    </p>
                  )}
                </div>
              </div>

              {/* Bulunan Referanslar */}
              <div className="rounded-xl bg-[#111113] border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-[#ECECEE] mb-3 flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6C6CFF"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Bulunan Referanslar
                  {result.citations.length > 0 && (
                    <span className="text-xs font-normal text-[#5C5C5F]">
                      ({result.citations.length})
                    </span>
                  )}
                </h3>
                {result.citations.length > 0 ? (
                  <div className="space-y-2">
                    {result.citations.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg bg-[#09090B] px-3 py-2.5 border border-white/[0.04]"
                      >
                        <span className="text-[10px] uppercase tracking-wider text-[#6C6CFF] font-semibold mt-0.5 whitespace-nowrap">
                          {PATTERN_LABELS[c.pattern_type] || c.pattern_type}
                        </span>
                        <span className="text-sm text-[#ECECEE] break-all">
                          {c.raw_text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5C5C5F]">
                    Belgede hukuki referans bulunamadı.
                  </p>
                )}
              </div>

              {/* Tam Metin (collapsible) */}
              <div className="rounded-xl bg-[#111113] border border-white/[0.06]">
                <button
                  onClick={() => setTextExpanded(!textExpanded)}
                  className="flex items-center justify-between w-full px-5 py-4 text-left"
                >
                  <h3 className="text-sm font-semibold text-[#ECECEE] flex items-center gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6C6CFF"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Tam Metin
                  </h3>
                  <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#5C5C5F"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={{ rotate: textExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </motion.svg>
                </button>
                <AnimatePresence>
                  {textExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        <pre className="text-xs text-[#8B8B8E] whitespace-pre-wrap font-[family-name:var(--font-geist)] leading-relaxed max-h-[500px] overflow-auto rounded-lg bg-[#09090B] border border-white/[0.04] p-4">
                          {result.text}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
