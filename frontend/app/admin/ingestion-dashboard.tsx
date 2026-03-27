"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import type { PgDaireProgress, PgIngestionSummary } from "./types";

// ── Helpers ─────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "az once";
  const sn = Math.floor(diff / 1000);
  if (sn < 60) return `${sn} sn once`;
  const dk = Math.floor(sn / 60);
  if (dk < 60) return `${dk} dk once`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat once`;
  const gun = Math.floor(saat / 24);
  return `${gun} gun once`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  pending: { label: "Bekliyor", color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" },
  active: { label: "Aktif", color: "#3DD68C", bg: "bg-[#3DD68C]/10", pulse: true },
  done: { label: "Tamamlandi", color: "#3DD68C", bg: "bg-[#3DD68C]/10" },
  error: { label: "Hata", color: "#E5484D", bg: "bg-[#E5484D]/10" },
};

const MAHKEME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  yargitay: { label: "Yargitay", color: "#6C6CFF", bg: "bg-[#6C6CFF]/15" },
  danistay: { label: "Danistay", color: "#3DD68C", bg: "bg-[#3DD68C]/15" },
};

// ── Component ───────────────────────────────────────

export default function IngestionDashboard({
  token,
  apiUrl,
  onToast,
}: {
  token: string | null;
  apiUrl: string;
  onToast: (msg: string) => void;
}) {
  const [daires, setDaires] = useState<PgDaireProgress[]>([]);
  const [summary, setSummary] = useState<PgIngestionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterMahkeme, setFilterMahkeme] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  // ── Data fetching ───────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [daireRes, summaryRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/ingest/pg/daire-progress`, { headers }),
        fetch(`${apiUrl}/api/v1/admin/ingest/pg/summary`, { headers }),
      ]);
      if (daireRes.status === "fulfilled" && daireRes.value.ok) {
        setDaires(await daireRes.value.json());
      }
      if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
        setSummary(await summaryRes.value.json());
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [token, apiUrl, headers]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh: every 10s when there are active daires
  const hasActive = useMemo(() => daires.some((d) => d.status === "active"), [daires]);

  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [hasActive, fetchData]);

  // ── Actions ─────────────────────────────────────

  const startExhaustive = async () => {
    setActionLoading("exhaustive");
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/pg/exhaustive`, {
        method: "POST",
        headers,
      });
      if (r.ok) {
        onToast("PG Ingestion baslatildi");
        setTimeout(fetchData, 1000);
      } else if (r.status === 409) {
        onToast("Bir islem zaten calisiyor");
      } else {
        onToast("Baslatma basarisiz");
      }
    } catch {
      onToast("Baglanti hatasi");
    }
    setActionLoading(null);
  };

  const retryErrors = async () => {
    setActionLoading("retry");
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/ingest/pg/retry`, {
        method: "POST",
        headers,
      });
      if (r.ok) {
        onToast("Hatali daireler tekrar deneniyor");
        setTimeout(fetchData, 1000);
      } else {
        onToast("Baslatma basarisiz");
      }
    } catch {
      onToast("Baglanti hatasi");
    }
    setActionLoading(null);
  };

  // ── Filtered data ───────────────────────────────

  const filteredDaires = useMemo(() => {
    return daires.filter((d) => {
      if (filterMahkeme !== "all" && d.mahkeme !== filterMahkeme) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      return true;
    });
  }, [daires, filterMahkeme, filterStatus]);

  // ── Counts for filter badges ────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, active: 0, done: 0, error: 0 };
    daires.forEach((d) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [daires]);

  // ── Error types from summary ────────────────────

  const errorTypes = summary?.error_types || {};

  // ── Loading state ───────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* ── Header row ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
            <h3 className="text-[16px] font-semibold text-[#ECECEE]">PostgreSQL Ingestion</h3>
          </div>
          {hasActive && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
              <span className="text-[13px] text-[#3DD68C]">Her 10 sn guncelleniyor</span>
            </div>
          )}
        </div>
        <button
          onClick={fetchData}
          className="text-[13px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors"
        >
          Yenile
        </button>
      </div>

      {/* ── Summary cards ──────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Toplam Karar",
              value: summary.total_decisions,
              color: "#6C6CFF",
              icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375",
            },
            {
              label: "Aktif Daire",
              value: summary.active_daires,
              color: "#3DD68C",
              icon: "M5.636 5.636a9 9 0 1012.728 0M12 3v9",
              pulse: summary.active_daires > 0,
            },
            {
              label: "Tamamlanan",
              value: summary.completed_daires,
              color: "#3DD68C",
              icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
            },
            {
              label: "Hata",
              value: summary.error_count,
              color: summary.error_count > 0 ? "#E5484D" : "#8B8B8E",
              icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
            },
            {
              label: "Son 1 Saat",
              value: summary.recent_activity,
              color: "#FFB224",
              icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke={card.color}
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
                <span className="text-[13px] text-[#5C5C5F]">{card.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#ECECEE] font-mono">
                  {card.value.toLocaleString("tr-TR")}
                </span>
                {card.pulse && (
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: card.color }} />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Action buttons ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={startExhaustive}
          disabled={actionLoading !== null || hasActive}
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium bg-[#6C6CFF]/15 text-[#6C6CFF] border border-[#6C6CFF]/30 hover:bg-[#6C6CFF]/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {actionLoading === "exhaustive" ? (
            <span className="w-4 h-4 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          )}
          PG Ingestion Baslat
        </button>

        <button
          onClick={retryErrors}
          disabled={actionLoading !== null || (summary?.error_count ?? 0) === 0}
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium bg-[#FFB224]/15 text-[#FFB224] border border-[#FFB224]/30 hover:bg-[#FFB224]/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {actionLoading === "retry" ? (
            <span className="w-4 h-4 border-2 border-[#FFB224] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          )}
          Hatalari Tekrar Dene
        </button>

        <span className="text-[13px] text-[#5C5C5F] ml-auto">
          <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          Tamamlaninca Telegram raporu otomatik gonderilir
        </span>
      </div>

      {/* ── Filters ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-[#5C5C5F] mr-1">Filtre:</span>

        {/* Mahkeme filter */}
        {[
          { key: "all", label: "Tumu" },
          { key: "yargitay", label: "Yargitay" },
          { key: "danistay", label: "Danistay" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMahkeme(f.key)}
            className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-all ${
              filterMahkeme === f.key
                ? "bg-[#6C6CFF]/15 text-[#6C6CFF] border border-[#6C6CFF]/30"
                : "text-[#5C5C5F] border border-white/[0.06] hover:border-white/[0.12]"
            }`}
          >
            {f.label}
          </button>
        ))}

        <span className="w-px h-5 bg-white/[0.06] mx-1" />

        {/* Status filter */}
        {[
          { key: "all", label: "Tumu" },
          { key: "active", label: "Aktif", count: statusCounts.active },
          { key: "done", label: "Tamam", count: statusCounts.done },
          { key: "error", label: "Hata", count: statusCounts.error },
          { key: "pending", label: "Bekliyor", count: statusCounts.pending },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 ${
              filterStatus === f.key
                ? "bg-[#6C6CFF]/15 text-[#6C6CFF] border border-[#6C6CFF]/30"
                : "text-[#5C5C5F] border border-white/[0.06] hover:border-white/[0.12]"
            }`}
          >
            {f.label}
            {"count" in f && typeof f.count === "number" && f.count > 0 && (
              <span className="text-[11px] opacity-70">({f.count})</span>
            )}
          </button>
        ))}

        <span className="ml-auto text-[13px] text-[#5C5C5F]">
          {filteredDaires.length} / {daires.length} daire
        </span>
      </div>

      {/* ── Daire progress table ───────────────── */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-[12px] text-[#5C5C5F] uppercase tracking-wider">
              <th className="text-left p-3">Mahkeme</th>
              <th className="text-left p-3">Daire</th>
              <th className="text-left p-3">Durum</th>
              <th className="text-left p-3 min-w-[180px]">Ilerleme</th>
              <th className="text-right p-3">Karar</th>
              <th className="text-right p-3">Hata</th>
              <th className="text-right p-3 hidden md:table-cell">Son Aktivite</th>
            </tr>
          </thead>
          <tbody>
            {filteredDaires.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#5C5C5F]">
                  {daires.length === 0 ? "Henuz daire verisi yok" : "Filtreye uyan daire bulunamadi"}
                </td>
              </tr>
            )}
            {filteredDaires.map((d) => {
              const mahkemeCfg = MAHKEME_CONFIG[d.mahkeme] || {
                label: d.mahkeme,
                color: "#8B8B8E",
                bg: "bg-[#8B8B8E]/15",
              };
              const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
              const progressPct = Math.min(d.progress_pct, 100);
              const pageText =
                d.total_pages != null ? `${d.last_page} / ${d.total_pages}` : `${d.last_page} / ?`;

              return (
                <tr
                  key={d.id}
                  className={`border-b border-white/[0.04] transition-colors ${
                    d.status === "active"
                      ? "bg-[#3DD68C]/[0.02] hover:bg-[#3DD68C]/[0.04]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Mahkeme badge */}
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${mahkemeCfg.bg}`}
                      style={{ color: mahkemeCfg.color }}
                    >
                      {mahkemeCfg.label}
                    </span>
                  </td>

                  {/* Daire name */}
                  <td className="p-3 text-[#ECECEE] font-medium whitespace-nowrap">{d.daire}</td>

                  {/* Status badge */}
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium ${statusCfg.bg}`}
                      style={{ color: statusCfg.color }}
                    >
                      {statusCfg.pulse && (
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: statusCfg.color }}
                        />
                      )}
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Progress bar */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor:
                              d.status === "error"
                                ? "#E5484D"
                                : d.status === "done"
                                ? "#3DD68C"
                                : "#6C6CFF",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-[12px] text-[#5C5C5F] font-mono whitespace-nowrap min-w-[70px] text-right">
                        {pageText}
                      </span>
                    </div>
                  </td>

                  {/* Decisions saved */}
                  <td className="p-3 text-right font-mono text-[#ECECEE]">
                    {d.decisions_saved.toLocaleString("tr-TR")}
                  </td>

                  {/* Errors */}
                  <td className="p-3 text-right font-mono">
                    <span className={d.errors > 0 ? "text-[#E5484D]" : "text-[#5C5C5F]"}>
                      {d.errors}
                    </span>
                  </td>

                  {/* Last activity */}
                  <td className="p-3 text-right text-[#5C5C5F] text-[13px] hidden md:table-cell whitespace-nowrap">
                    {relativeTime(d.last_activity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Error summary ──────────────────────── */}
      {Object.keys(errorTypes).length > 0 && (
        <div className="bg-[#E5484D]/[0.06] border border-[#E5484D]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[#E5484D]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <h4 className="text-[15px] font-semibold text-[#E5484D]">Hata Ozeti</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(errorTypes).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between bg-[#09090B] rounded-lg px-3 py-2"
              >
                <span className="text-[13px] text-[#ECECEE] truncate mr-2">{type}</span>
                <span className="text-[13px] font-mono text-[#E5484D] font-semibold shrink-0">
                  {(count as number).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
