"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserItem { id: string; email: string; full_name: string; role: string; baro: string | null; baro_sicil_no: string | null; is_active: boolean; created_at: string | null; firm_id: string | null; }
interface FirmItem { id: string; name: string; email: string | null; member_count: number; max_users: number; is_active: boolean; created_at: string | null; }
interface PlatformStats { users: { total: number; active: number; pending: number }; firms: number; cases: number; deadlines: number; searches: number; }
interface EmbeddingStats { ictihat: { points_count: number }; mevzuat: { points_count: number }; total: number; }

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
  const triggerIngest = async () => {
    await fetch(`${API_URL}/api/v1/admin/ingest`, { method: "POST", headers });
    setToast("Ingestion başlatıldı");
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
        <div className="space-y-4">
          {embeddings && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-[#6C6CFF]">{embeddings.ictihat?.points_count || 0}</p>
                <p className="text-[12px] text-[#5C5C5F]">İçtihat</p>
              </div>
              <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-[#3DD68C]">{embeddings.mevzuat?.points_count || 0}</p>
                <p className="text-[12px] text-[#5C5C5F]">Mevzuat</p>
              </div>
              <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-[#ECECEE]">{embeddings.total}</p>
                <p className="text-[12px] text-[#5C5C5F]">Toplam</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={triggerIngest} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg text-[13px] font-medium text-white transition-colors">
              İçtihat Ingestion
            </button>
            <button onClick={async () => { await fetch(`${API_URL}/api/v1/admin/ingest/mevzuat`, { method: "POST", headers }); setToast("Mevzuat ingestion başlatıldı"); }} className="px-4 py-2 bg-[#3DD68C] hover:bg-[#2CC67C] rounded-lg text-[13px] font-medium text-white transition-colors">
              Mevzuat Ingestion
            </button>
            <button onClick={() => fetchAll()} className="px-4 py-2 bg-[#111113] border border-white/[0.06] hover:border-white/[0.12] rounded-lg text-[13px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] transition-colors">
              Yenile
            </button>
          </div>

          {/* Ingestion durumu */}
          <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-3">Ingestion Durumu</h3>
            <IngestionStatus token={token} apiUrl={API_URL} />
          </div>
        </div>
      )}
    </div>
  );
}

function IngestionStatus({ token, apiUrl }: { token: string | null; apiUrl: string }) {
  const [progress, setProgress] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    const [pRes, lRes] = await Promise.allSettled([
      fetch(`${apiUrl}/api/v1/ingest/progress`, { headers: h }),
      fetch(`${apiUrl}/api/v1/admin/logs`, { headers: h }),
    ]);
    if (pRes.status === "fulfilled" && pRes.value.ok) setProgress(await pRes.value.json());
    if (lRes.status === "fulfilled" && lRes.value.ok) setLogs(await lRes.value.json());
  }, [token, apiUrl]);

  useEffect(() => { refresh(); const i = setInterval(refresh, 3000); return () => clearInterval(i); }, [refresh]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const totalTopics = 100;
  const completed = progress?.completed_topics || 0;
  const pct = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0;
  const isRunning = logs?.running === true;
  const logEntries = logs?.logs || [];

  const levelColor = (level: string) => {
    if (level === "error") return "text-[#E5484D]";
    if (level === "success") return "text-[#3DD68C]";
    if (level === "warn") return "text-[#FFB224]";
    return "text-[#8B8B8E]";
  };

  return (
    <div className="space-y-4 text-[13px]">
      {/* Status + ilerleme */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-[#3DD68C] animate-pulse" : "bg-[#5C5C5F]"}`} />
          <span className="text-[#ECECEE] font-medium">{isRunning ? "Çalışıyor" : "Beklemede"}</span>
        </div>
        <span className="text-[#5C5C5F]">|</span>
        <span className="text-[#ECECEE]">{progress?.total_embeddings || 0} embedding</span>
        <span className="text-[#5C5C5F]">|</span>
        <span className="text-[#ECECEE]">{completed}/{totalTopics} konu</span>
      </div>

      {/* İlerleme çubuğu */}
      <div className="w-full h-2 bg-[#1A1A1F] rounded-full overflow-hidden">
        <div className="h-full bg-[#6C6CFF] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {progress?.last_update && (
        <p className="text-[11px] text-[#5C5C5F]">Son güncelleme: {new Date(progress.last_update).toLocaleString("tr-TR")}</p>
      )}

      {/* Terminal */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5C5F]">Canlı Log</p>
          <span className="text-[10px] text-[#5C5C5F]">{logEntries.length} satır — 3sn'de yenilenir</span>
        </div>
        <div ref={terminalRef} className="bg-[#000000] border border-white/[0.08] rounded-lg p-3 h-[350px] overflow-y-auto font-mono text-[11px] leading-[1.6]">
          {logEntries.length === 0 ? (
            <div className="text-[#5C5C5F] text-center py-8">Henüz log yok. Ingestion başlatın.</div>
          ) : (
            logEntries.map((entry: any, i: number) => (
              <div key={i} className={`${levelColor(entry.level)} flex gap-2`}>
                <span className="text-[#5C5C5F] shrink-0 select-none">{entry.ts?.slice(11, 19) || ""}</span>
                <span>{entry.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tamamlanan konular */}
      {progress?.topics_list?.length > 0 && (
        <div>
          <p className="text-[11px] text-[#5C5C5F] mb-1">Tamamlanan ({progress.topics_list.length}):</p>
          <div className="flex flex-wrap gap-1">
            {progress.topics_list.map((t: string) => (
              <span key={t} className="px-1.5 py-0.5 text-[10px] bg-[#3DD68C]/10 text-[#3DD68C] rounded">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
