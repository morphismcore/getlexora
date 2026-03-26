"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import type { IngestionState, LogEntry, EmbeddingBreakdown, IngestConfig } from "./types";
import { SOURCE_CONFIG, YARGITAY_DAIRELERI } from "./constants";

export default function IngestionDashboard({ token, apiUrl, onToast }: { token: string | null; apiUrl: string; onToast: (msg: string) => void }) {
  const [breakdown, setBreakdown] = useState<EmbeddingBreakdown | null>(null);
  const [state, setState] = useState<IngestionState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [progress, setProgress] = useState<Record<string, string | number | string[]> | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Daire ingestion state
  const [daireCourtType, setDaireCourtType] = useState("yargitay");
  const [daireId, setDaireId] = useState("");
  const [dairePages, setDairePages] = useState(10);

  // Date range ingestion state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateCourtTypes, setDateCourtTypes] = useState<string[]>(["yargitay", "danistay"]);
  const [dateMaxPages, setDateMaxPages] = useState(50);

  // Advanced panel toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Ingestion config state
  const [ingestConfig, setIngestConfig] = useState<IngestConfig>({ yargitay_year_from: 2020, danistay_year_from: 2020 });
  const [configSaving, setConfigSaving] = useState(false);
  const [exhaustiveStarting, setExhaustiveStarting] = useState(false);

  // GPU status
  const [gpuConnected, setGpuConnected] = useState<boolean | null>(null);

  // Fetch ingestion config
  const fetchIngestConfig = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/config`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setIngestConfig(data);
      }
    } catch { /* ignore */ }
  }, [token, apiUrl]);

  // Save ingestion config
  const saveIngestConfig = async () => {
    if (!token) return;
    setConfigSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/config`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(ingestConfig),
      });
      if (r.ok) onToast("Yapilandirma kaydedildi");
      else onToast("Kaydetme basarisiz");
    } catch { onToast("Baglanti hatasi"); }
    setConfigSaving(false);
  };

  // Start exhaustive ingestion
  const startExhaustive = async () => {
    if (!token) return;
    setExhaustiveStarting(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/exhaustive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(ingestConfig),
      });
      if (r.ok) onToast("Exhaustive ingestion baslatildi");
      else if (r.status === 409) onToast("Bir ingestion zaten calisiyor");
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
    setExhaustiveStarting(false);
  };

  // Fetch GPU status
  const fetchGpuStatus = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/system`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setGpuConnected(data.checks?.gpu?.status === "ok" || data.checks?.embedding_gpu?.status === "ok" || false);
      }
    } catch { setGpuConnected(false); }
  }, [token, apiUrl]);

  // Fetch breakdown on mount
  const fetchBreakdown = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/embeddings/breakdown`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBreakdown(await r.json());
    } catch { /* ignore */ }
  }, [token, apiUrl]);

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/ingest/progress`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setProgress(await r.json());
    } catch { /* ignore */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchBreakdown(); fetchProgress(); fetchIngestConfig(); fetchGpuStatus(); }, [fetchBreakdown, fetchProgress, fetchIngestConfig, fetchGpuStatus]);

  // SSE connection — uses one-time ticket instead of JWT in URL
  useEffect(() => {
    if (!token) return;

    let es: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        // Get a short-lived SSE ticket
        const ticketRes = await fetch(`${apiUrl}/api/v1/admin/sse-ticket`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ticketRes.ok || cancelled) return;
        const { ticket } = await ticketRes.json();

        if (cancelled) return;

        es = new EventSource(`${apiUrl}/api/v1/admin/ingest/stream?ticket=${ticket}`);

        es.onmessage = (event) => {
          try {
            const data: IngestionState = JSON.parse(event.data);
            setState(data);

            if (data.new_logs && data.new_logs.length > 0) {
              setLogs((prev) => {
                const combined = [...prev, ...data.new_logs!];
                return combined.slice(-200);
              });
            }

            // Refresh breakdown when embedding count changes
            if (data.embedded > 0 && data.embedded % 50 === 0) {
              fetchBreakdown();
            }
          } catch { /* ignore */ }
        };

        es.onerror = () => {
          // Reconnect after 5s
          setTimeout(() => {}, 5000);
        };
      } catch { /* ignore */ }
    };

    connect();

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [token, apiUrl, fetchBreakdown]);

  // Elapsed time counter
  useEffect(() => {
    if (!state?.running || !state.started_at) { setElapsed(""); return; }
    const interval = setInterval(() => {
      const start = new Date(state.started_at!).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.running, state?.started_at]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const triggerIngest = async (endpoint: string, label: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest${endpoint}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (r.ok) onToast(`${label} ingestion baslatildi`);
      else if (r.status === 409) onToast("Bir ingestion zaten calisiyor");
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
  };

  const triggerDaireIngest = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/daire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          court_type: daireCourtType,
          daire_id: daireId || null,
          pages: dairePages,
        }),
      });
      if (r.ok) onToast(`Daire ingestion baslatildi`);
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
  };

  const triggerDateRangeIngest = async () => {
    if (!dateFrom || !dateTo) {
      onToast("Tarih araligi secin");
      return;
    }
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/date-range`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: dateTo,
          court_types: dateCourtTypes,
          max_pages: dateMaxPages,
        }),
      });
      if (r.ok) onToast(`Tarih bazli ingestion baslatildi`);
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
  };

  const maxCount = breakdown ? Math.max(...Object.values(breakdown.sources), breakdown.mevzuat, 1) : 1;
  const pct = state && state.total_topics > 0 ? Math.round((state.completed_topics / state.total_topics) * 100) : 0;

  const filteredLogs = logFilter === "errors" ? logs.filter((l) => l.level === "error") : logs;

  const sourceLabel = (s: string | null) => {
    if (!s) return "";
    return SOURCE_CONFIG[s]?.label || s;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Source Breakdown */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#ECECEE]">Veri Kaynaklari</h3>
          <button onClick={() => { fetchBreakdown(); fetchProgress(); }} className="text-[13px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Yenile</button>
        </div>
        <div className="space-y-3">
          {(["yargitay", "danistay", "aym", "aihm", "mevzuat"] as const).map((key) => {
            const cfg = SOURCE_CONFIG[key];
            const count = key === "mevzuat" ? (breakdown?.mevzuat || 0) : (breakdown?.sources?.[key] || 0);
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[14px] text-[#8B8B8E] w-20 shrink-0">{cfg.label}</span>
                <div className="flex-1 h-[22px] bg-[#1A1A1F] rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%`, backgroundColor: `${cfg.color}30` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full rounded-md transition-all duration-700 ease-out opacity-60"
                    style={{ width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%`, backgroundColor: cfg.color }}
                  />
                </div>
                <span className="text-[15px] font-mono text-[#ECECEE] w-16 text-right shrink-0">{count.toLocaleString("tr-TR")}</span>
                {count === 0 && !state?.running && (
                  <button
                    onClick={() => {
                      if (key === "aym") triggerIngest("/aym", "AYM");
                      else if (key === "aihm") triggerIngest("/aihm", "AIHM");
                      else if (key === "mevzuat") triggerIngest("/mevzuat", "Mevzuat");
                      else triggerIngest("", "Ictihat");
                    }}
                    className="text-[12px] px-2 py-1 rounded-md border transition-colors shrink-0"
                    style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}
                  >
                    Cek
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[14px] text-[#5C5C5F]">Toplam</span>
          <span className="text-[17px] font-semibold text-[#ECECEE]">{(breakdown?.total || 0).toLocaleString("tr-TR")} embedding</span>
        </div>
      </div>

      {/* Active Operation */}
      <div className={`border rounded-xl p-5 transition-colors ${state?.running ? "bg-[#111113] border-[#3DD68C]/20" : "bg-[#111113] border-white/[0.06]"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${state?.running ? "bg-[#3DD68C] animate-pulse" : "bg-[#5C5C5F]"}`} />
            <span className="text-[15px] font-semibold text-[#ECECEE]">{state?.running ? "Calisiyor" : "Beklemede"}</span>
          </div>
          {state?.running && elapsed && (
            <span className="text-[14px] font-mono text-[#8B8B8E]">{elapsed}</span>
          )}
        </div>

        {state?.running ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px] text-[#5C5C5F]">Kaynak:</span>
              <span className="text-[14px] font-medium" style={{ color: SOURCE_CONFIG[state.source || ""]?.color || "#8B8B8E" }}>
                {sourceLabel(state.source)}
              </span>
              {state.task && (
                <>
                  <span className="text-[#5C5C5F]">·</span>
                  <span className="text-[14px] text-[#ECECEE]">{state.task}</span>
                </>
              )}
            </div>

            {state.total_topics > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-[#5C5C5F]">{state.completed_topics}/{state.total_topics}</span>
                  <span className="text-[13px] text-[#5C5C5F]">%{pct}</span>
                </div>
                <div className="w-full h-2 bg-[#1A1A1F] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6C6CFF] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className="text-[18px] font-semibold text-[#6C6CFF]">{state.fetched}</p>
                <p className="text-[12px] text-[#5C5C5F] mt-0.5">Cekilen</p>
              </div>
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className="text-[18px] font-semibold text-[#3DD68C]">{state.embedded}</p>
                <p className="text-[12px] text-[#5C5C5F] mt-0.5">Embed</p>
              </div>
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className={`text-[18px] font-semibold ${state.errors > 0 ? "text-[#E5484D]" : "text-[#5C5C5F]"}`}>{state.errors}</p>
                <p className="text-[12px] text-[#5C5C5F] mt-0.5">Hata</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[14px] text-[#5C5C5F]">
            {progress?.last_update
              ? `Son guncelleme: ${new Date(progress.last_update as string).toLocaleString("tr-TR")}`
              : "Henuz ingestion calistirilmadi"}
          </p>
        )}
      </div>

      {/* GPU Status */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${gpuConnected ? "bg-[#3DD68C]" : gpuConnected === false ? "bg-[#E5484D]" : "bg-[#5C5C5F] animate-pulse"}`} />
          <span className="text-[15px] font-medium text-[#ECECEE]">GPU Embedding</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${gpuConnected ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
          {gpuConnected ? "Bagli" : gpuConnected === false ? "Bagli Degil" : "Kontrol ediliyor..."}
        </span>
      </div>

      {/* Ingestion Config */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-4">Ingestion Yapilandirmasi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[13px] text-[#5C5C5F] block mb-1.5">Yargitay - Baslangic Yili</label>
            <input
              type="number"
              value={ingestConfig.yargitay_year_from}
              onChange={(e) => setIngestConfig({ ...ingestConfig, yargitay_year_from: parseInt(e.target.value) || 2020 })}
              min={2000}
              max={2030}
              className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[13px] text-[#5C5C5F] block mb-1.5">Danistay - Baslangic Yili</label>
            <input
              type="number"
              value={ingestConfig.danistay_year_from}
              onChange={(e) => setIngestConfig({ ...ingestConfig, danistay_year_from: parseInt(e.target.value) || 2020 })}
              min={2000}
              max={2030}
              className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[15px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={saveIngestConfig}
            disabled={configSaving}
            className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
          >
            {configSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            onClick={startExhaustive}
            disabled={state?.running || exhaustiveStarting}
            className="px-4 py-2 bg-gradient-to-r from-[#6C6CFF] to-[#A78BFA] hover:from-[#5B5BEE] hover:to-[#9678E5] disabled:bg-[#1A1A1F] disabled:from-[#1A1A1F] disabled:to-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
          >
            {exhaustiveStarting ? "Baslatiliyor..." : state?.running ? "Calisiyor..." : "Exhaustive Baslat"}
          </button>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => triggerIngest("", "Ictihat")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "bedesten" ? "Calisiyor..." : "Ictihat Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/aym", "AYM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#E5484D] hover:bg-[#D13438] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aym" ? "Calisiyor..." : "AYM Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/aihm", "AIHM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#3DD68C] hover:bg-[#2CC67C] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aihm" ? "Calisiyor..." : "AIHM Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/mevzuat", "Mevzuat")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#FFB224] hover:bg-[#E5A010] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "mevzuat" ? "Calisiyor..." : "Mevzuat Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/batch", "Toplu")}
          disabled={state?.running}
          className="px-4 py-2 bg-gradient-to-r from-[#6C6CFF] to-[#3DD68C] hover:from-[#5B5BEE] hover:to-[#2CC67C] disabled:bg-[#1A1A1F] disabled:from-[#1A1A1F] disabled:to-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "batch" ? "Calisiyor..." : "Toplu Cek"}
        </button>
      </div>

      {/* Advanced Ingestion Controls */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-[15px] font-semibold text-[#ECECEE]">Gelismis Ingestion</span>
          <svg
            className={`w-4 h-4 text-[#5C5C5F] transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-5 border-t border-white/[0.06] pt-4">
            {/* Daire Bazli Ingestion */}
            <div className="space-y-3">
              <h4 className="text-[14px] font-semibold text-[#A78BFA]">Daire Bazli Ingestion</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Mahkeme</label>
                  <select
                    value={daireCourtType}
                    onChange={(e) => setDaireCourtType(e.target.value)}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  >
                    <option value="yargitay">Yargitay</option>
                    <option value="danistay">Danistay</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Daire</label>
                  <select
                    value={daireId}
                    onChange={(e) => setDaireId(e.target.value)}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  >
                    <option value="">Tum Daireler</option>
                    {Object.entries(YARGITAY_DAIRELERI).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Sayfa Sayisi</label>
                  <input
                    type="number"
                    value={dairePages}
                    onChange={(e) => setDairePages(parseInt(e.target.value) || 10)}
                    min={1}
                    max={100}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={triggerDaireIngest}
                    disabled={state?.running}
                    className="w-full px-4 py-2 bg-[#A78BFA] hover:bg-[#9678E5] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
                  >
                    Daire Cek
                  </button>
                </div>
              </div>
            </div>

            {/* Tarih Bazli Ingestion */}
            <div className="space-y-3">
              <h4 className="text-[14px] font-semibold text-[#FFB224]">Tarih Bazli Ingestion</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Baslangic (GG.AA.YYYY)</label>
                  <input
                    type="text"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="01.01.2024"
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Bitis (GG.AA.YYYY)</label>
                  <input
                    type="text"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="31.12.2024"
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Mahkemeler</label>
                  <div className="flex gap-2 mt-1">
                    {["yargitay", "danistay"].map((ct) => (
                      <label key={ct} className="flex items-center gap-1 text-[13px] text-[#8B8B8E]">
                        <input
                          type="checkbox"
                          checked={dateCourtTypes.includes(ct)}
                          onChange={(e) => {
                            if (e.target.checked) setDateCourtTypes([...dateCourtTypes, ct]);
                            else setDateCourtTypes(dateCourtTypes.filter((c) => c !== ct));
                          }}
                          className="accent-[#6C6CFF] w-3 h-3"
                        />
                        {ct === "yargitay" ? "Yargitay" : "Danistay"}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[13px] text-[#5C5C5F] block mb-1">Max Sayfa</label>
                  <input
                    type="number"
                    value={dateMaxPages}
                    onChange={(e) => setDateMaxPages(parseInt(e.target.value) || 50)}
                    min={1}
                    max={200}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[14px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={triggerDateRangeIngest}
                    disabled={state?.running || !dateFrom || !dateTo}
                    className="w-full px-4 py-2 bg-[#FFB224] hover:bg-[#E5A010] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[14px] font-medium text-white transition-colors"
                  >
                    Tarih Cek
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Terminal */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#E5484D]/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFB224]/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#3DD68C]/60" />
            </div>
            <span className="text-[13px] font-medium text-[#5C5C5F]">Canli Log</span>
            {state?.running && <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C] animate-pulse" />}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setLogFilter("all")}
              className={`px-2 py-0.5 text-[12px] rounded ${logFilter === "all" ? "bg-[#6C6CFF]/20 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}
            >
              Tumu
            </button>
            <button
              onClick={() => setLogFilter("errors")}
              className={`px-2 py-0.5 text-[12px] rounded ${logFilter === "errors" ? "bg-[#E5484D]/20 text-[#E5484D]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}
            >
              Hatalar
            </button>
          </div>
        </div>
        <div ref={terminalRef} className="bg-[#09090B] p-3 h-[300px] overflow-y-auto font-mono text-[13px] leading-[1.7] scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="text-[#5C5C5F] text-center py-12">
              {logFilter === "errors" ? "Hata yok" : "Henuz log yok. Ingestion baslatin."}
            </div>
          ) : (
            filteredLogs.map((entry, i) => (
              <div
                key={i}
                className={`flex gap-2 px-1 py-0.5 rounded ${
                  entry.level === "error" ? "bg-[#E5484D]/5" :
                  entry.level === "success" ? "bg-[#3DD68C]/5" : ""
                }`}
              >
                <span className="text-[#5C5C5F] shrink-0 select-none">{entry.ts?.slice(11, 19) || ""}</span>
                <span className={
                  entry.level === "error" ? "text-[#E5484D]" :
                  entry.level === "success" ? "text-[#3DD68C]" :
                  "text-[#8B8B8E]"
                }>{entry.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Completed Topics */}
      {progress?.topics_list && (progress.topics_list as string[]).length > 0 && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <button
            onClick={() => setTopicsExpanded(!topicsExpanded)}
            className="flex items-center justify-between w-full"
          >
            <span className="text-[14px] font-medium text-[#8B8B8E]">
              Tamamlanan ({(progress.topics_list as string[]).length})
            </span>
            <svg
              className={`w-4 h-4 text-[#5C5C5F] transition-transform ${topicsExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {topicsExpanded && (
            <div className="flex flex-wrap gap-1 mt-3">
              {(progress.topics_list as string[]).map((t: string) => (
                <span key={t} className="px-1.5 py-0.5 text-[12px] bg-[#3DD68C]/10 text-[#3DD68C] rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
