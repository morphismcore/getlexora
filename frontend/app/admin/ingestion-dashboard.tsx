"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import type { EmbeddingBreakdown } from "./types";
import { SOURCE_CONFIG } from "./constants";

const SOURCES = ["yargitay", "danistay", "aym", "aihm", "rekabet", "kvkk", "mevzuat"] as const;
const INGEST_ENDPOINTS: Record<string, { endpoint: string; label: string }> = {
  yargitay: { endpoint: "", label: "Yargıtay" },
  danistay: { endpoint: "", label: "Danıştay" },
  aym: { endpoint: "/aym", label: "AYM" },
  aihm: { endpoint: "/aihm", label: "AİHM" },
  rekabet: { endpoint: "/rekabet", label: "Rekabet" },
  kvkk: { endpoint: "/kvkk", label: "KVKK" },
  mevzuat: { endpoint: "/mevzuat", label: "Mevzuat" },
};

export default function IngestionDashboard({ token, apiUrl, onToast }: { token: string | null; apiUrl: string; onToast: (msg: string) => void }) {
  const [breakdown, setBreakdown] = useState<EmbeddingBreakdown | null>(null);
  const [prevBreakdown, setPrevBreakdown] = useState<EmbeddingBreakdown | null>(null);
  const [gpuConnected, setGpuConnected] = useState<boolean | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<Array<{ id: string; name: string; source: string }>>([]);
  const [polling, setPolling] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Fetch counts
  const fetchBreakdown = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/embeddings/breakdown`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setBreakdown((prev) => {
          if (prev) setPrevBreakdown(prev);
          return data;
        });
      }
    } catch { /* ignore */ }
  }, [token, apiUrl]);

  const fetchGpu = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/system`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setGpuConnected(data.checks?.gpu?.status === "ok" || false);
      }
    } catch { setGpuConnected(false); }
  }, [token, apiUrl]);

  // Check active tasks from Celery
  const fetchActiveTasks = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/active`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setActiveTasks(data.tasks || []);
        if (data.running) {
          setPolling(true);
          if (data.tasks.length > 0) {
            setActiveSource(data.tasks[0].source);
          }
        } else {
          setPolling(false);
          setActiveSource(null);
        }
      }
    } catch { /* ignore */ }
  }, [token, apiUrl]);

  // Initial fetch — check active tasks on page load
  useEffect(() => { fetchBreakdown(); fetchGpu(); fetchActiveTasks(); }, [fetchBreakdown, fetchGpu, fetchActiveTasks]);

  // Polling — refresh counts + active tasks every 5 seconds when active
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      fetchBreakdown();
      fetchActiveTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, fetchBreakdown, fetchActiveTasks]);

  // Trigger ingestion
  const triggerIngest = async (key: string) => {
    const cfg = INGEST_ENDPOINTS[key];
    if (!cfg) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest${cfg.endpoint}`, { method: "POST", headers });
      if (r.ok) {
        onToast(`${cfg.label} çekimi başlatıldı`);
        setActiveSource(key);
        setPolling(true);
        // Auto-stop polling after 10 minutes
        setTimeout(() => setPolling(false), 600000);
      } else if (r.status === 409) {
        onToast("Bir çekim zaten çalışıyor");
      } else {
        onToast("Başlatma başarısız");
      }
    } catch { onToast("Bağlantı hatası"); }
  };

  const triggerBatch = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/batch`, { method: "POST", headers });
      if (r.ok) {
        onToast("Toplu çekim başlatıldı");
        setActiveSource("batch");
        setPolling(true);
        setTimeout(() => setPolling(false), 600000);
      } else if (r.status === 409) {
        onToast("Bir çekim zaten çalışıyor");
      } else {
        onToast("Başlatma başarısız");
      }
    } catch { onToast("Bağlantı hatası"); }
  };

  // Helpers
  const getCount = (key: string): number => {
    if (!breakdown) return 0;
    if (key === "mevzuat") return breakdown.mevzuat || 0;
    return breakdown.sources?.[key] || 0;
  };

  const getPrevCount = (key: string): number => {
    if (!prevBreakdown) return 0;
    if (key === "mevzuat") return prevBreakdown.mevzuat || 0;
    return prevBreakdown.sources?.[key] || 0;
  };

  const totalCount = breakdown?.total || 0;
  const prevTotal = prevBreakdown?.total || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

      {/* Header with GPU + polling status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${gpuConnected ? "bg-[#3DD68C]" : gpuConnected === false ? "bg-[#E5484D]" : "bg-[#5C5C5F] animate-pulse"}`} />
            <span className="text-[13px] text-[#5C5C5F]">
              GPU: {gpuConnected ? "Bağlı" : gpuConnected === false ? "Bağlı Değil" : "..."}
            </span>
          </div>
          {polling && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
              <span className="text-[13px] text-[#3DD68C]">Sayılar her 5 sn güncelleniyor</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {polling && (
            <button
              onClick={() => { setPolling(false); setActiveSource(null); }}
              className="text-[13px] text-[#E5484D] hover:text-[#FF6B6F] transition-colors"
            >
              Durdur
            </button>
          )}
          <button
            onClick={() => { fetchBreakdown(); fetchGpu(); }}
            className="text-[13px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Active tasks banner */}
      {activeTasks.length > 0 && (
        <div className="bg-[#3DD68C]/[0.06] border border-[#3DD68C]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C] animate-pulse" />
            <span className="text-[15px] font-semibold text-[#3DD68C]">{activeTasks.length} aktif çekim</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTasks.map((t) => (
              <span key={t.id} className="px-3 py-1 rounded-lg text-[13px] font-medium bg-[#3DD68C]/10 text-[#3DD68C]">
                {SOURCE_CONFIG[t.source]?.label || t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {SOURCES.map((key) => {
          const cfg = SOURCE_CONFIG[key];
          const count = getCount(key);
          const prev = getPrevCount(key);
          const diff = count - prev;
          const hasActiveTask = activeTasks.some((t) => t.source === key);
          const isActive = hasActiveTask || activeSource === key || activeSource === "batch";

          return (
            <div
              key={key}
              className={`bg-[#111113] border rounded-xl p-5 flex flex-col gap-2 transition-all ${
                isActive && polling ? "border-[#3DD68C]/40 bg-[#3DD68C]/[0.02]" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cfg?.color || "#5C5C5F" }} />
                <span className="text-[15px] font-medium text-[#ECECEE]">{cfg?.label || key}</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-[#ECECEE] font-mono">{count.toLocaleString("tr-TR")}</span>
                {diff > 0 && polling && (
                  <span className="text-[14px] font-medium text-[#3DD68C]">+{diff.toLocaleString("tr-TR")}</span>
                )}
              </div>

              {count === 0 && (
                <span className="text-[13px] text-[#5C5C5F]">Henüz veri yok</span>
              )}

              <button
                onClick={() => triggerIngest(key)}
                disabled={polling}
                className="mt-auto px-4 py-2 rounded-lg text-[14px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  color: cfg?.color || "#8B8B8E",
                  borderColor: `${cfg?.color || "#8B8B8E"}40`,
                  backgroundColor: `${cfg?.color || "#8B8B8E"}10`,
                  borderWidth: "1px",
                }}
              >
                {isActive && polling ? "Çalışıyor..." : "Çek"}
              </button>
            </div>
          );
        })}

        {/* Total + Batch */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0 bg-[#ECECEE]" />
            <span className="text-[15px] font-medium text-[#ECECEE]">TOPLAM</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-bold text-[#ECECEE] font-mono">{totalCount.toLocaleString("tr-TR")}</span>
            {totalCount > prevTotal && prevTotal > 0 && polling && (
              <span className="text-[14px] font-medium text-[#3DD68C]">+{(totalCount - prevTotal).toLocaleString("tr-TR")}</span>
            )}
          </div>
          <button
            onClick={triggerBatch}
            disabled={polling}
            className="mt-auto px-4 py-2 rounded-lg text-[14px] font-medium bg-gradient-to-r from-[#6C6CFF] to-[#3DD68C] text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {activeSource === "batch" && polling ? "Çalışıyor..." : "Tümünü Çek"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
