"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import type { IngestionState, LogEntry, EmbeddingBreakdown } from "./types";
import { SOURCE_CONFIG } from "./constants";

// Source keys and their ingest endpoints
const SOURCES = ["yargitay", "danistay", "aym", "aihm", "rekabet", "kvkk", "mevzuat"] as const;
const INGEST_ENDPOINTS: Record<string, { endpoint: string; label: string }> = {
  yargitay: { endpoint: "", label: "Yargitay" },
  danistay: { endpoint: "", label: "Danistay" },
  aym: { endpoint: "/aym", label: "AYM" },
  aihm: { endpoint: "/aihm", label: "AIHM" },
  rekabet: { endpoint: "/rekabet", label: "Rekabet" },
  kvkk: { endpoint: "/kvkk", label: "KVKK" },
  mevzuat: { endpoint: "/mevzuat", label: "Mevzuat" },
};

export default function IngestionDashboard({ token, apiUrl, onToast }: { token: string | null; apiUrl: string; onToast: (msg: string) => void }) {
  const [breakdown, setBreakdown] = useState<EmbeddingBreakdown | null>(null);
  const [state, setState] = useState<IngestionState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [elapsed, setElapsed] = useState("");
  const [gpuConnected, setGpuConnected] = useState<boolean | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── API calls ──────────────────────────────────────

  const fetchBreakdown = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/embeddings/breakdown`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBreakdown(await r.json());
    } catch { /* ignore */ }
  }, [token, apiUrl]);

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

  const triggerIngest = async (endpoint: string, label: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest${endpoint}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (r.ok) onToast(`${label} ingestion baslatildi`);
      else if (r.status === 409) onToast("Bir ingestion zaten calisiyor");
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
  };

  const triggerBatch = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/batch`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (r.ok) onToast("Toplu ingestion baslatildi");
      else if (r.status === 409) onToast("Bir ingestion zaten calisiyor");
      else onToast("Baslatma basarisiz");
    } catch { onToast("Baglanti hatasi"); }
  };

  // ── Effects ────────────────────────────────────────

  useEffect(() => { fetchBreakdown(); fetchGpuStatus(); }, [fetchBreakdown, fetchGpuStatus]);

  // SSE connection
  useEffect(() => {
    if (!token) return;
    let es: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
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
              setLogs((prev) => [...prev, ...data.new_logs!].slice(-200));
            }
            if (data.embedded > 0 && data.embedded % 50 === 0) {
              fetchBreakdown();
            }
          } catch { /* ignore */ }
        };

        es.onerror = () => {
          setTimeout(() => {}, 5000);
        };
      } catch { /* ignore */ }
    };

    connect();
    return () => { cancelled = true; if (es) es.close(); };
  }, [token, apiUrl, fetchBreakdown]);

  // Elapsed time
  useEffect(() => {
    if (!state?.running || !state.started_at) { setElapsed(""); return; }
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - new Date(state.started_at!).getTime()) / 1000);
      setElapsed(`${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.running, state?.started_at]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  // ── Derived ────────────────────────────────────────

  const pct = state && state.total_topics > 0 ? Math.round((state.completed_topics / state.total_topics) * 100) : 0;
  const filteredLogs = logFilter === "errors" ? logs.filter((l) => l.level === "error") : logs;

  const getCount = (key: string): number => {
    if (!breakdown) return 0;
    if (key === "mevzuat") return breakdown.mevzuat || 0;
    return breakdown.sources?.[key] || 0;
  };

  const totalCount = breakdown?.total || 0;

  // ── Render ─────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

      {/* ── Section 1: Veri Kaynaklari ── */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#ECECEE]">Veri Kaynaklari</h3>
          <div className="flex items-center gap-3">
            {/* GPU indicator */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gpuConnected ? "bg-[#3DD68C]" : gpuConnected === false ? "bg-[#E5484D]" : "bg-[#5C5C5F] animate-pulse"}`} />
              <span className="text-[12px] text-[#5C5C5F]">
                GPU: {gpuConnected ? "Bagli" : gpuConnected === false ? "Bagli Degil" : "..."}
              </span>
            </div>
            <button onClick={() => { fetchBreakdown(); fetchGpuStatus(); }} className="text-[13px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">
              Yenile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SOURCES.map((key) => {
            const cfg = SOURCE_CONFIG[key];
            const count = getCount(key);
            const isRunningThis = state?.running && state.source === key;
            return (
              <div
                key={key}
                className={`bg-[#09090B] border rounded-lg p-4 flex flex-col gap-2 transition-colors ${
                  isRunningThis ? "border-[#3DD68C]/40 bg-[#3DD68C]/[0.03]" : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isRunningThis ? (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#3DD68C] animate-pulse" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg?.color || "#5C5C5F" }} />
                  )}
                  <span className="text-[14px] font-medium text-[#ECECEE]">{cfg?.label || key}</span>
                  {isRunningThis && <span className="text-[11px] text-[#3DD68C] font-medium ml-auto">Çalışıyor</span>}
                </div>
                <span className="text-[22px] font-semibold text-[#ECECEE] font-mono">{count.toLocaleString("tr-TR")}</span>
                {count === 0 && !state?.running && (
                  <span className="text-[11px] text-[#5C5C5F]">Henüz veri yok</span>
                )}
                <button
                  onClick={() => triggerIngest(INGEST_ENDPOINTS[key].endpoint, INGEST_ENDPOINTS[key].label)}
                  disabled={!!state?.running}
                  className="mt-auto px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    color: cfg?.color || "#8B8B8E",
                    borderColor: `${cfg?.color || "#8B8B8E"}40`,
                    backgroundColor: `${cfg?.color || "#8B8B8E"}10`,
                    borderWidth: "1px",
                  }}
                >
                  {isRunningThis ? "Çalışıyor..." : "Çek"}
                </button>
              </div>
            );
          })}

          {/* Total + Batch */}
          <div className="bg-[#09090B] border border-white/[0.06] rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#ECECEE]" />
              <span className="text-[14px] font-medium text-[#ECECEE]">TOPLAM</span>
            </div>
            <span className="text-[22px] font-semibold text-[#ECECEE] font-mono">{totalCount.toLocaleString("tr-TR")}</span>
            <button
              onClick={triggerBatch}
              disabled={!!state?.running}
              className="mt-auto px-3 py-1.5 rounded-md text-[13px] font-medium bg-gradient-to-r from-[#6C6CFF] to-[#3DD68C] text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {state?.running && state.source === "batch" ? "Calisiyor..." : "Tumunu Cek"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Aktif Operasyon (only when running) ── */}
      {state?.running ? (
        <div className="bg-[#111113] border border-[#3DD68C]/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C] animate-pulse" />
              <span className="text-[15px] font-semibold text-[#ECECEE]">Calisiyor</span>
              {elapsed && <span className="text-[14px] font-mono text-[#8B8B8E] ml-1">{elapsed}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 text-[14px]">
            <span className="text-[#5C5C5F]">Kaynak:</span>
            <span className="font-medium" style={{ color: SOURCE_CONFIG[state.source || ""]?.color || "#8B8B8E" }}>
              {SOURCE_CONFIG[state.source || ""]?.label || state.source || ""}
            </span>
            {state.task && (
              <>
                <span className="text-[#5C5C5F]">·</span>
                <span className="text-[#ECECEE]">{state.task}</span>
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
        </div>
      ) : (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5C5C5F]" />
          <span className="text-[14px] text-[#5C5C5F]">Beklemede — bir kaynak seçip &quot;Çek&quot; butonuna basın</span>
        </div>
      )}

      {/* ── Section 3: Log Terminal ── */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
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
        <div ref={terminalRef} className="bg-[#09090B] p-3 h-[250px] overflow-y-auto font-mono text-[13px] leading-[1.7] scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="text-[#5C5C5F] text-center py-12">
              {logFilter === "errors" ? "Hata yok" : "Henuz log yok"}
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
    </motion.div>
  );
}
