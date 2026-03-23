"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserItem { id: string; email: string; full_name: string; role: string; baro: string | null; baro_sicil_no: string | null; is_active: boolean; created_at: string | null; firm_id: string | null; }
interface FirmItem { id: string; name: string; email: string | null; member_count: number; max_users: number; is_active: boolean; created_at: string | null; }
interface PlatformStats { users: { total: number; active: number; pending: number }; firms: number; cases: number; deadlines: number; searches: number; }
interface EmbeddingStats { ictihat: { points_count: number }; mevzuat: { points_count: number }; total: number; }

interface IngestionState {
  running: boolean;
  source: string | null;
  task: string | null;
  started_at: string | null;
  fetched: number;
  embedded: number;
  errors: number;
  total_topics: number;
  completed_topics: number;
  new_logs?: LogEntry[];
}

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

interface EmbeddingBreakdown {
  sources: Record<string, number>;
  mevzuat: number;
  total: number;
}

const ROLES = ["platform_admin", "admin", "partner", "avukat", "stajyer", "asistan"];
const ROLE_LABELS: Record<string, string> = { platform_admin: "Platform Admin", admin: "Firma Admin", partner: "Partner", avukat: "Avukat", stajyer: "Stajyer", asistan: "Asistan" };
const ROLE_COLORS: Record<string, string> = { platform_admin: "bg-purple-500/10 text-purple-400", admin: "bg-[#6C6CFF]/10 text-[#6C6CFF]", partner: "bg-[#FFB224]/10 text-[#FFB224]", avukat: "bg-[#3DD68C]/10 text-[#3DD68C]", stajyer: "bg-[#8B8B8E]/10 text-[#8B8B8E]", asistan: "bg-[#8B8B8E]/10 text-[#8B8B8E]" };

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "firms" | "system" | "embedding">("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [firms, setFirms] = useState<FirmItem[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [embeddings, setEmbeddings] = useState<EmbeddingStats | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [systemHealth, setSystemHealth] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Guard: only platform_admin
  useEffect(() => {
    if (user && user.role !== "platform_admin") {
      router.push("/");
    }
  }, [user, router]);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, firmsRes, statsRes, embRes, sysRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/v1/admin/users`, { headers }),
        fetch(`${API_URL}/api/v1/admin/firms`, { headers }),
        fetch(`${API_URL}/api/v1/admin/stats`, { headers }),
        fetch(`${API_URL}/api/v1/admin/embeddings`, { headers }),
        fetch(`${API_URL}/api/v1/admin/system`, { headers }),
      ]);
      if (usersRes.status === "fulfilled" && usersRes.value.ok) setUsers(await usersRes.value.json());
      if (firmsRes.status === "fulfilled" && firmsRes.value.ok) setFirms(await firmsRes.value.json());
      if (statsRes.status === "fulfilled" && statsRes.value.ok) setStats(await statsRes.value.json());
      if (embRes.status === "fulfilled" && embRes.value.ok) setEmbeddings(await embRes.value.json());
      if (sysRes.status === "fulfilled" && sysRes.value.ok) setSystemHealth(await sysRes.value.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const approveUser = async (id: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/approve`, { method: "POST", headers });
    setToast("Kullanıcı onaylandı");
    fetchAll();
  };
  const rejectUser = async (id: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/reject`, { method: "POST", headers });
    setToast("Kullanıcı reddedildi");
    fetchAll();
  };
  const changeRole = async (id: string, role: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/role`, { method: "PUT", headers, body: JSON.stringify({ role }) });
    setToast("Rol güncellendi");
    fetchAll();
  };
  if (user?.role !== "platform_admin") return null;

  const pendingUsers = users.filter((u) => !u.is_active);

  return (
    <div className="h-screen overflow-auto p-4 pt-14 md:p-6 md:pt-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-[15px] font-semibold text-[#ECECEE]">Admin Panel</h1>
        <p className="text-[12px] text-[#5C5C5F] mt-0.5">Platform yönetimi</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Kullanıcı", value: stats.users.total, sub: `${stats.users.pending} beklemede` },
            { label: "Firma", value: stats.firms },
            { label: "Dava", value: stats.cases },
            { label: "Süre", value: stats.deadlines },
            { label: "Embedding", value: embeddings?.total || 0 },
          ].map((s, i) => (
            <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
              <p className="text-2xl font-semibold text-[#ECECEE]">{s.value}</p>
              <p className="text-[12px] text-[#5C5C5F]">{s.label}</p>
              {"sub" in s && s.sub && <p className="text-[11px] text-[#FFB224] mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-lg p-1 w-fit">
        {(["users", "firms", "system", "embedding"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${tab === t ? "bg-[#6C6CFF]/20 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
            {{ users: "Kullanıcılar", firms: "Firmalar", system: "Sistem", embedding: "Embedding" }[t]}
          </button>
        ))}
      </div>

      {/* Pending users alert */}
      {tab === "users" && pendingUsers.length > 0 && (
        <div className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3">
          <h3 className="text-[13px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          {pendingUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#09090B] rounded-lg p-3">
              <div>
                <p className="text-[13px] text-[#ECECEE] font-medium">{u.full_name}</p>
                <p className="text-[11px] text-[#5C5C5F]">{u.email} {u.baro ? `— ${u.baro}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approveUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#3DD68C]/20 text-[#3DD68C] rounded-md hover:bg-[#3DD68C]/30 transition-colors">Onayla</button>
                <button onClick={() => rejectUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#E5484D]/20 text-[#E5484D] rounded-md hover:bg-[#E5484D]/30 transition-colors">Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[11px] uppercase tracking-wider">
              <th className="text-left p-3">Kullanıcı</th><th className="text-left p-3">E-posta</th><th className="text-left p-3">Baro</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Durum</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="p-3 text-[#ECECEE]">{u.full_name}</td>
                  <td className="p-3 text-[#8B8B8E]">{u.email}</td>
                  <td className="p-3 text-[#8B8B8E]">{u.baro || "—"}</td>
                  <td className="p-3">
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="bg-transparent text-[12px] text-[#ECECEE] cursor-pointer focus:outline-none">
                      {ROLES.map((r) => <option key={r} value={r} className="bg-[#16161A]">{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#FFB224]/10 text-[#FFB224]"}`}>
                      {u.is_active ? "Aktif" : "Beklemede"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Firms tab */}
      {tab === "firms" && (
        <div className="space-y-2">
          {firms.length === 0 ? (
            <p className="text-[13px] text-[#5C5C5F] text-center py-8">Henüz firma yok</p>
          ) : firms.map((f) => (
            <div key={f.id} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#ECECEE]">{f.name}</p>
                <p className="text-[12px] text-[#5C5C5F]">{f.email || "—"} · {f.member_count}/{f.max_users} üye</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${f.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                {f.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* System tab */}
      {tab === "system" && systemHealth && (
        <div className="space-y-3">
          {Object.entries(systemHealth.checks || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#ECECEE] capitalize">{key}</p>
                {val.embeddings !== undefined && <p className="text-[12px] text-[#5C5C5F]">{val.embeddings} embedding</p>}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${val.status === "ok" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                {val.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Embedding tab */}
      {tab === "embedding" && (
        <IngestionDashboard token={token} apiUrl={API_URL} onToast={setToast} />
      )}
    </div>
  );
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  yargitay: { label: "Yargıtay", color: "#6C6CFF", bg: "bg-[#6C6CFF]" },
  danistay: { label: "Danıştay", color: "#A78BFA", bg: "bg-[#A78BFA]" },
  aym: { label: "AYM", color: "#E5484D", bg: "bg-[#E5484D]" },
  aihm: { label: "AİHM", color: "#3DD68C", bg: "bg-[#3DD68C]" },
  mevzuat: { label: "Mevzuat", color: "#FFB224", bg: "bg-[#FFB224]" },
};

function IngestionDashboard({ token, apiUrl, onToast }: { token: string | null; apiUrl: string; onToast: (msg: string) => void }) {
  const [breakdown, setBreakdown] = useState<EmbeddingBreakdown | null>(null);
  const [state, setState] = useState<IngestionState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [progress, setProgress] = useState<Record<string, string | number | string[]> | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch breakdown on mount
  const fetchBreakdown = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/embeddings/breakdown`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBreakdown(await r.json());
    } catch {}
  }, [token, apiUrl]);

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${apiUrl}/api/v1/ingest/progress`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setProgress(await r.json());
    } catch {}
  }, [token, apiUrl]);

  useEffect(() => { fetchBreakdown(); fetchProgress(); }, [fetchBreakdown, fetchProgress]);

  // SSE connection
  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`${apiUrl}/api/v1/admin/ingest/stream?token=${token}`);

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
      } catch {}
    };

    es.onerror = () => {
      // Reconnect after 5s
      setTimeout(() => {}, 5000);
    };

    return () => es.close();
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
      if (r.ok) onToast(`${label} ingestion başlatıldı`);
      else if (r.status === 409) onToast("Bir ingestion zaten çalışıyor");
      else onToast("Başlatma başarısız");
    } catch { onToast("Bağlantı hatası"); }
  };

  const maxCount = breakdown ? Math.max(...Object.values(breakdown.sources), breakdown.mevzuat, 1) : 1;
  const pct = state && state.total_topics > 0 ? Math.round((state.completed_topics / state.total_topics) * 100) : 0;

  const filteredLogs = logFilter === "errors" ? logs.filter((l) => l.level === "error") : logs;

  const sourceLabel = (s: string | null) => {
    if (!s) return "";
    return SOURCE_CONFIG[s]?.label || s;
  };

  return (
    <div className="space-y-4">
      {/* Source Breakdown */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#ECECEE]">Veri Kaynakları</h3>
          <button onClick={() => { fetchBreakdown(); fetchProgress(); }} className="text-[11px] text-[#5C5C5F] hover:text-[#8B8B8E] transition-colors">Yenile</button>
        </div>
        <div className="space-y-3">
          {(["yargitay", "danistay", "aym", "aihm", "mevzuat"] as const).map((key) => {
            const cfg = SOURCE_CONFIG[key];
            const count = key === "mevzuat" ? (breakdown?.mevzuat || 0) : (breakdown?.sources?.[key] || 0);
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[12px] text-[#8B8B8E] w-20 shrink-0">{cfg.label}</span>
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
                <span className="text-[13px] font-mono text-[#ECECEE] w-16 text-right shrink-0">{count.toLocaleString("tr-TR")}</span>
                {count === 0 && !state?.running && (
                  <button
                    onClick={() => {
                      if (key === "aym") triggerIngest("/aym", "AYM");
                      else if (key === "aihm") triggerIngest("/aihm", "AİHM");
                      else if (key === "mevzuat") triggerIngest("/mevzuat", "Mevzuat");
                      else triggerIngest("", "İçtihat");
                    }}
                    className="text-[10px] px-2 py-1 rounded-md border transition-colors shrink-0"
                    style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}
                  >
                    Çek
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[12px] text-[#5C5C5F]">Toplam</span>
          <span className="text-[15px] font-semibold text-[#ECECEE]">{(breakdown?.total || 0).toLocaleString("tr-TR")} embedding</span>
        </div>
      </div>

      {/* Active Operation */}
      <div className={`border rounded-xl p-5 transition-colors ${state?.running ? "bg-[#111113] border-[#3DD68C]/20" : "bg-[#111113] border-white/[0.06]"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${state?.running ? "bg-[#3DD68C] animate-pulse" : "bg-[#5C5C5F]"}`} />
            <span className="text-[13px] font-semibold text-[#ECECEE]">{state?.running ? "Çalışıyor" : "Beklemede"}</span>
          </div>
          {state?.running && elapsed && (
            <span className="text-[12px] font-mono text-[#8B8B8E]">{elapsed}</span>
          )}
        </div>

        {state?.running ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] text-[#5C5C5F]">Kaynak:</span>
              <span className="text-[12px] font-medium" style={{ color: SOURCE_CONFIG[state.source || ""]?.color || "#8B8B8E" }}>
                {sourceLabel(state.source)}
              </span>
              {state.task && (
                <>
                  <span className="text-[#5C5C5F]">·</span>
                  <span className="text-[12px] text-[#ECECEE]">{state.task}</span>
                </>
              )}
            </div>

            {state.total_topics > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#5C5C5F]">{state.completed_topics}/{state.total_topics}</span>
                  <span className="text-[11px] text-[#5C5C5F]">%{pct}</span>
                </div>
                <div className="w-full h-2 bg-[#1A1A1F] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6C6CFF] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className="text-[16px] font-semibold text-[#6C6CFF]">{state.fetched}</p>
                <p className="text-[10px] text-[#5C5C5F] mt-0.5">Çekilen</p>
              </div>
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className="text-[16px] font-semibold text-[#3DD68C]">{state.embedded}</p>
                <p className="text-[10px] text-[#5C5C5F] mt-0.5">Embed</p>
              </div>
              <div className="bg-[#09090B] rounded-lg p-3 text-center">
                <p className={`text-[16px] font-semibold ${state.errors > 0 ? "text-[#E5484D]" : "text-[#5C5C5F]"}`}>{state.errors}</p>
                <p className="text-[10px] text-[#5C5C5F] mt-0.5">Hata</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-[#5C5C5F]">
            {progress?.last_update
              ? `Son güncelleme: ${new Date(progress.last_update as string).toLocaleString("tr-TR")}`
              : "Henüz ingestion çalıştırılmadı"}
          </p>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => triggerIngest("", "İçtihat")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "bedesten" ? "Çalışıyor..." : "İçtihat Çek"}
        </button>
        <button
          onClick={() => triggerIngest("/aym", "AYM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#E5484D] hover:bg-[#D13438] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aym" ? "Çalışıyor..." : "AYM Çek"}
        </button>
        <button
          onClick={() => triggerIngest("/aihm", "AİHM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#3DD68C] hover:bg-[#2CC67C] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aihm" ? "Çalışıyor..." : "AİHM Çek"}
        </button>
        <button
          onClick={async () => { await fetch(`${apiUrl}/api/v1/admin/ingest/mevzuat`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }); onToast("Mevzuat ingestion başlatıldı"); }}
          disabled={state?.running}
          className="px-4 py-2 bg-[#FFB224] hover:bg-[#E5A010] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "mevzuat" ? "Çalışıyor..." : "Mevzuat Çek"}
        </button>
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
            <span className="text-[11px] font-medium text-[#5C5C5F]">Canlı Log</span>
            {state?.running && <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C] animate-pulse" />}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setLogFilter("all")}
              className={`px-2 py-0.5 text-[10px] rounded ${logFilter === "all" ? "bg-[#6C6CFF]/20 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}
            >
              Tümü
            </button>
            <button
              onClick={() => setLogFilter("errors")}
              className={`px-2 py-0.5 text-[10px] rounded ${logFilter === "errors" ? "bg-[#E5484D]/20 text-[#E5484D]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}
            >
              Hatalar
            </button>
          </div>
        </div>
        <div ref={terminalRef} className="bg-[#09090B] p-3 h-[300px] overflow-y-auto font-mono text-[11px] leading-[1.7] scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="text-[#5C5C5F] text-center py-12">
              {logFilter === "errors" ? "Hata yok" : "Henüz log yok. Ingestion başlatın."}
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
            <span className="text-[12px] font-medium text-[#8B8B8E]">
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
                <span key={t} className="px-1.5 py-0.5 text-[10px] bg-[#3DD68C]/10 text-[#3DD68C] rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
