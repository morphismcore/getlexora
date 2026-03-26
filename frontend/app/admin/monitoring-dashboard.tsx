"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import type { MonitoringData, HistoryPoint } from "./types";
import { SERVICE_LABELS } from "./constants";
import { Skeleton } from "./components";

function formatUptime(seconds: number): string {
  const g = Math.floor(seconds / 86400);
  const s = Math.floor((seconds % 86400) / 3600);
  const dk = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (g > 0) parts.push(`${g}g`);
  if (s > 0) parts.push(`${s}s`);
  parts.push(`${dk}dk`);
  return parts.join(" ");
}

function cpuColor(pct: number): string {
  if (pct >= 80) return "#E5484D";
  if (pct >= 50) return "#FFB224";
  return "#3DD68C";
}

export default function MonitoringDashboard({ token, apiUrl }: { token: string | null; apiUrl: string }) {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMonitoring = useCallback(async () => {
    if (!token) return;
    try {
      const [monRes, histRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/monitoring`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/v1/admin/monitoring/history`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (monRes.status === "fulfilled" && monRes.value.ok) {
        setData(await monRes.value.json());
        setLastUpdate(new Date());
      }
      if (histRes.status === "fulfilled" && histRes.value.ok) {
        const json = await histRes.value.json();
        setHistory(json.history || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, apiUrl]);

  useEffect(() => { fetchMonitoring(); }, [fetchMonitoring]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchMonitoring, 30000);
    return () => clearInterval(interval);
  }, [fetchMonitoring]);

  if (loading && !data) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </motion.div>
    );
  }

  if (!data) {
    return <div className="text-[13px] text-[#E5484D] text-center py-12">Monitoring verileri alinamadi.</div>;
  }

  const embeddingSources = [
    { key: "yargitay", label: "Yargitay", color: "#6C6CFF" },
    { key: "danistay", label: "Danistay", color: "#A78BFA" },
    { key: "aym", label: "AYM", color: "#E5484D" },
    { key: "aihm", label: "AIHM", color: "#3DD68C" },
  ];
  const maxEmb = Math.max(...embeddingSources.map((s) => data.ingestion.by_source[s.key] || 0), 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Last update indicator */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#5C5C5F]">
          {lastUpdate ? `Son guncelleme: ${lastUpdate.toLocaleTimeString("tr-TR")}` : ""}
        </span>
        <button onClick={fetchMonitoring} className="text-[11px] text-[#6C6CFF] hover:text-[#5B5BEE] transition-colors">Yenile</button>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Uptime */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold text-[#ECECEE]">{formatUptime(data.uptime_seconds)}</p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">Uptime</p>
        </div>

        {/* CPU */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold" style={{ color: cpuColor(data.cpu_percent) }}>
            %{data.cpu_percent.toFixed(1)}
          </p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">CPU</p>
          <div className="w-full h-1.5 bg-[#1A1A1F] rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.cpu_percent}%`, backgroundColor: cpuColor(data.cpu_percent) }} />
          </div>
        </div>

        {/* RAM */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold text-[#A78BFA]">{data.memory_usage_mb.toLocaleString("tr-TR")}</p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">RAM (MB)</p>
          <div className="w-full h-1.5 bg-[#1A1A1F] rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-[#A78BFA] transition-all duration-500" style={{ width: `${Math.min((data.memory_usage_mb / 8192) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Disk */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold" style={{ color: data.disk_usage_pct >= 90 ? "#E5484D" : data.disk_usage_pct >= 75 ? "#FFB224" : "#3DD68C" }}>
            %{data.disk_usage_pct.toFixed(1)}
          </p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">Disk</p>
          <div className="w-full h-1.5 bg-[#1A1A1F] rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.disk_usage_pct}%`, backgroundColor: data.disk_usage_pct >= 90 ? "#E5484D" : data.disk_usage_pct >= 75 ? "#FFB224" : "#3DD68C" }} />
          </div>
        </div>

        {/* Req/min */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold text-[#6C6CFF]">{data.requests_per_minute}</p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">Istek/dk</p>
          <p className="text-[10px] text-[#5C5C5F] mt-1">{data.requests_total.toLocaleString("tr-TR")} toplam</p>
        </div>

        {/* Error rate */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[18px] font-semibold" style={{ color: data.error_rate_pct > 5 ? "#E5484D" : data.error_rate_pct > 1 ? "#FFB224" : "#3DD68C" }}>
            %{data.error_rate_pct.toFixed(2)}
          </p>
          <p className="text-[11px] text-[#5C5C5F] mt-0.5">Hata Orani</p>
          <p className="text-[10px] text-[#5C5C5F] mt-1">{data.avg_response_time_ms.toFixed(1)}ms ort.</p>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-4">Servis Durumu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(data.services).map(([key, svc]) => (
            <div key={key} className="bg-[#09090B] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${svc.status === "ok" ? "bg-[#3DD68C]" : "bg-[#E5484D] animate-pulse"}`} />
                <span className="text-[13px] font-medium text-[#ECECEE]">{SERVICE_LABELS[key] || key}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#5C5C5F]">Yanit suresi</span>
                  <span className="text-[11px] font-mono text-[#8B8B8E]">{svc.response_ms}ms</span>
                </div>
                {svc.memory_mb !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#5C5C5F]">Bellek</span>
                    <span className="text-[11px] font-mono text-[#8B8B8E]">{svc.memory_mb}MB</span>
                  </div>
                )}
                {svc.error && (
                  <p className="text-[10px] text-[#E5484D] mt-1 truncate" title={svc.error}>{svc.error}</p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-white/[0.04]">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${svc.status === "ok" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                  {svc.status === "ok" ? "Aktif" : "Hata"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Embedding Statistics */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#ECECEE]">Embedding Istatistikleri</h3>
          <div className="text-right">
            <p className="text-[22px] font-bold text-[#6C6CFF]">{data.ingestion.total_embeddings.toLocaleString("tr-TR")}</p>
            <p className="text-[10px] text-[#5C5C5F]">Toplam Embedding</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {embeddingSources.map((src) => {
            const count = data.ingestion.by_source[src.key] || 0;
            const barWidth = maxEmb > 0 ? (count / maxEmb) * 100 : 0;
            return (
              <div key={src.key} className="flex items-center gap-3">
                <span className="text-[12px] text-[#8B8B8E] w-20 shrink-0">{src.label}</span>
                <div className="flex-1 h-[20px] bg-[#1A1A1F] rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%`, backgroundColor: `${src.color}30` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full rounded-md transition-all duration-700 ease-out opacity-60"
                    style={{ width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%`, backgroundColor: src.color }}
                  />
                </div>
                <span className="text-[12px] font-mono text-[#ECECEE] w-16 text-right shrink-0">{count.toLocaleString("tr-TR")}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-6 pt-3 border-t border-white/[0.06]">
          <div>
            <p className="text-[11px] text-[#5C5C5F]">Son Ingestion</p>
            <p className="text-[12px] text-[#8B8B8E]">
              {data.ingestion.last_ingestion
                ? new Date(data.ingestion.last_ingestion).toLocaleString("tr-TR")
                : "Bilgi yok"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[#5C5C5F]">Gunluk Yeni</p>
            <p className="text-[12px] text-[#3DD68C] font-medium">+{data.ingestion.daily_new_count}</p>
          </div>
        </div>
      </div>

      {/* Line Charts (pure SVG, last 24h) */}
      {history.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MiniLineChart
            title="Istek/dk (Son 24s)"
            data={history}
            valueKey="requests_per_minute"
            color="#6C6CFF"
            formatValue={(v) => `${v.toFixed(1)}/dk`}
          />
          <MiniLineChart
            title="Yanit Suresi (Son 24s)"
            data={history}
            valueKey="avg_response_time_ms"
            color="#FFB224"
            formatValue={(v) => `${v.toFixed(1)}ms`}
          />
        </div>
      )}
    </motion.div>
  );
}


// ══════════════════════════════════════════════════════
// ══  SVG MINI LINE CHART (EXISTING)  ═════════════════
// ══════════════════════════════════════════════════════

function MiniLineChart({
  title,
  data,
  valueKey,
  color,
  formatValue,
}: {
  title: string;
  data: HistoryPoint[];
  valueKey: keyof HistoryPoint;
  color: string;
  formatValue: (v: number) => string;
}) {
  const W = 400;
  const H = 120;
  const PAD = 20;

  // Data is stored newest-first in Redis (lpush), reverse for chronological order
  const sorted = [...data].reverse();
  const values = sorted.map((d) => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - minVal) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Area fill path
  const firstX = PAD;
  const lastX = PAD + (Math.max(values.length - 1, 0) / Math.max(values.length - 1, 1)) * (W - PAD * 2);
  const areaPath = `M${firstX},${H - PAD} L${points.join(" L")} L${lastX},${H - PAD} Z`;

  const latestVal = values.length > 0 ? values[values.length - 1] : 0;

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-[#ECECEE]">{title}</span>
        <span className="text-[12px] font-mono" style={{ color }}>{formatValue(latestVal)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[100px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={PAD}
            y1={PAD + frac * (H - PAD * 2)}
            x2={W - PAD}
            y2={PAD + frac * (H - PAD * 2)}
            stroke="#1A1A1F"
            strokeWidth="1"
          />
        ))}
        {/* Area */}
        <path d={areaPath} fill={`url(#grad-${valueKey})`} />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Latest point dot */}
        {values.length > 0 && (
          <circle
            cx={lastX}
            cy={PAD + (1 - (latestVal - minVal) / range) * (H - PAD * 2)}
            r="3"
            fill={color}
          />
        )}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-[#5C5C5F]">{formatValue(minVal)}</span>
        <span className="text-[10px] text-[#5C5C5F]">{formatValue(maxVal)}</span>
      </div>
    </div>
  );
}
