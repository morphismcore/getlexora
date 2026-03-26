"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

import type { UserItem, FirmItem, PlatformStats, EmbeddingStats, TabKey } from "./types";
import { ROLES, ROLE_LABELS, TAB_CONFIG } from "./constants";
import { HIcon } from "./components";

import IngestionDashboard from "./ingestion-dashboard";
import DeadlineRulesTab from "./deadline-rules-tab";
import HolidaysTab from "./holidays-tab";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("genel");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [firms, setFirms] = useState<FirmItem[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [embeddings, setEmbeddings] = useState<EmbeddingStats | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [systemHealth, setSystemHealth] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const isAdmin = user?.role === "platform_admin";

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  // Guard: redirect non-admins
  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/");
    }
  }, [user, isAdmin, router]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setFetchError(null);
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
    } catch (err) {
      setFetchError("Veriler yuklenirken bir hata olustu. Lutfen sayfayi yenileyin.");
      console.error("Admin fetch error:", err);
    }
    setLoading(false);
  }, [token, isAdmin, headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const approveUser = async (id: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/approve`, { method: "POST", headers });
    showToast("Kullanici onaylandi");
    fetchAll();
  };
  const rejectUser = async (id: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/reject`, { method: "POST", headers });
    showToast("Kullanici reddedildi");
    fetchAll();
  };
  const changeRole = async (id: string, role: string) => {
    await fetch(`${API_URL}/api/v1/admin/users/${id}/role`, { method: "PUT", headers, body: JSON.stringify({ role }) });
    showToast("Rol guncellendi");
    fetchAll();
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#09090B]">
        <div className="w-6 h-6 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const pendingUsers = users.filter((u) => !u.is_active);

  const toastColors = {
    success: { bg: "bg-[#3DD68C]/15", border: "border-[#3DD68C]/30", text: "text-[#3DD68C]" },
    error: { bg: "bg-[#E5484D]/15", border: "border-[#E5484D]/30", text: "text-[#E5484D]" },
    info: { bg: "bg-[#6C6CFF]/15", border: "border-[#6C6CFF]/30", text: "text-[#6C6CFF]" },
  };

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[70] px-4 py-2.5 ${toastColors[toast.type].bg} border ${toastColors[toast.type].border} ${toastColors[toast.type].text} text-[15px] rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-2`}
          >
            {toast.type === "success" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            )}
            {toast.type === "error" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {toast.type === "info" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fetch error banner */}
      {fetchError && (
        <div role="alert" className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-4 text-[15px] text-[#E5484D]">
          {fetchError}
          <button onClick={fetchAll} className="ml-3 underline">Tekrar dene</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#ECECEE]">Admin Panel</h1>
          <p className="text-[14px] text-[#5C5C5F] mt-0.5">Lexora platform yonetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
          <span className="text-[13px] text-[#5C5C5F]">{user.full_name}</span>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Kullanici", value: stats.users.total, sub: `${stats.users.pending} beklemede`, color: "#6C6CFF" },
            { label: "Firma", value: stats.firms, color: "#A78BFA" },
            { label: "Dava", value: stats.cases, color: "#3DD68C" },
            { label: "Sure", value: stats.deadlines, color: "#FFB224" },
            { label: "Embedding", value: embeddings?.total || 0, color: "#E5484D" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 group hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <p className="text-[14px] text-[#5C5C5F]">{s.label}</p>
              </div>
              <p className="text-2xl font-semibold text-[#ECECEE]">{typeof s.value === "number" ? s.value.toLocaleString("tr-TR") : s.value}</p>
              {"sub" in s && s.sub && <p className="text-[13px] text-[#FFB224] mt-1">{s.sub}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-xl p-1.5 overflow-x-auto scrollbar-none">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === t.key
                ? "bg-[#6C6CFF]/15 text-[#6C6CFF] shadow-sm"
                : "text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.03]"
            }`}
            aria-label={t.label}
          >
            <HIcon d={t.icon} className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Genel (Dashboard) tab */}
      {tab === "genel" && (
        <GenelTabContent
          pendingUsers={pendingUsers}
          systemHealth={systemHealth}
          onApproveUser={approveUser}
          onRejectUser={rejectUser}
        />
      )}

      {/* Kullanicilar tab */}
      {tab === "kullanicilar" && (
        <KullanicilarTabContent
          users={users}
          firms={firms}
          pendingUsers={pendingUsers}
          currentUserId={user?.id}
          onApproveUser={approveUser}
          onRejectUser={rejectUser}
          onChangeRole={changeRole}
        />
      )}

      {/* Veri Yonetimi tab */}
      {tab === "veri-yonetimi" && (
        <IngestionDashboard token={token} apiUrl={API_URL} onToast={(msg: string) => showToast(msg)} />
      )}

      {tab === "sureler" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
              <h3 className="text-[16px] font-semibold text-[#ECECEE]">Süre Kuralları</h3>
            </div>
            <DeadlineRulesTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-[#3DD68C]" />
              <h3 className="text-[16px] font-semibold text-[#ECECEE]">Tatiller & Adli Tatil</h3>
            </div>
            <HolidaysTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
          </div>
        </motion.div>
      )}

    </div>
  );
}

// ── Genel Tab Content ────────────────────────────────

function GenelTabContent({
  pendingUsers,
  systemHealth,
  onApproveUser,
  onRejectUser,
}: {
  pendingUsers: UserItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  systemHealth: Record<string, any> | null;
  onApproveUser: (id: string) => void;
  onRejectUser: (id: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Pending users alert */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFB224]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="text-[15px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          </div>
          {pendingUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#09090B] rounded-lg p-3">
              <div>
                <p className="text-[15px] text-[#ECECEE] font-medium">{u.full_name}</p>
                <p className="text-[13px] text-[#5C5C5F]">{u.email} {u.baro ? `\u2014 ${u.baro}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApproveUser(u.id)} className="px-3 py-1 text-[13px] font-medium bg-[#3DD68C]/20 text-[#3DD68C] rounded-md hover:bg-[#3DD68C]/30 transition-colors">Onayla</button>
                <button onClick={() => onRejectUser(u.id)} className="px-3 py-1 text-[13px] font-medium bg-[#E5484D]/20 text-[#E5484D] rounded-md hover:bg-[#E5484D]/30 transition-colors">Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System health summary */}
      {systemHealth && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-3">Sistem Durumu</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {Object.entries(systemHealth.checks || {}).map(([key, val]: [string, any]) => (
              <div key={key} className="bg-[#09090B] rounded-lg p-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${val.status === "ok" ? "bg-[#3DD68C]" : "bg-[#E5484D] animate-pulse"}`} />
                <span className="text-[14px] text-[#ECECEE] capitalize">{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Kullanicilar Tab Content ─────────────────────────

function KullanicilarTabContent({
  users,
  firms,
  pendingUsers,
  currentUserId,
  onApproveUser,
  onRejectUser,
  onChangeRole,
}: {
  users: UserItem[];
  firms: FirmItem[];
  pendingUsers: UserItem[];
  currentUserId: string | undefined;
  onApproveUser: (id: string) => void;
  onRejectUser: (id: string) => void;
  onChangeRole: (id: string, role: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Pending users */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFB224]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="text-[15px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          </div>
          {pendingUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#09090B] rounded-lg p-3">
              <div>
                <p className="text-[15px] text-[#ECECEE] font-medium">{u.full_name}</p>
                <p className="text-[13px] text-[#5C5C5F]">{u.email} {u.baro ? `\u2014 ${u.baro}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApproveUser(u.id)} className="px-3 py-1 text-[13px] font-medium bg-[#3DD68C]/20 text-[#3DD68C] rounded-md hover:bg-[#3DD68C]/30 transition-colors">Onayla</button>
                <button onClick={() => onRejectUser(u.id)} className="px-3 py-1 text-[13px] font-medium bg-[#E5484D]/20 text-[#E5484D] rounded-md hover:bg-[#E5484D]/30 transition-colors">Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
          <h3 className="text-[16px] font-semibold text-[#ECECEE]">Kullanicilar</h3>
          <span className="text-[14px] text-[#5C5C5F]">({users.length})</span>
        </div>
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[13px] uppercase tracking-wider">
              <th className="text-left p-3">Kullanici</th><th className="text-left p-3 hidden md:table-cell">E-posta</th><th className="text-left p-3 hidden sm:table-cell">Baro</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Durum</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-[#ECECEE]">{u.full_name}</td>
                  <td className="p-3 text-[#8B8B8E] hidden md:table-cell">{u.email}</td>
                  <td className="p-3 text-[#8B8B8E] hidden sm:table-cell">{u.baro || "\u2014"}</td>
                  <td className="p-3">
                    <select value={u.role} onChange={(e) => onChangeRole(u.id, e.target.value)} className="bg-transparent text-[14px] text-[#ECECEE] cursor-pointer focus:outline-none">
                      {ROLES.map((r) => <option key={r} value={r} className="bg-[#16161A]">{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${u.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#FFB224]/10 text-[#FFB224]"}`}>
                      {u.is_active ? "Aktif" : "Beklemede"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firms table */}
      {firms.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-[#A78BFA]" />
            <h3 className="text-[16px] font-semibold text-[#ECECEE]">Firmalar</h3>
            <span className="text-[14px] text-[#5C5C5F]">({firms.length})</span>
          </div>
          <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[13px] uppercase tracking-wider">
                <th className="text-left p-3">Firma Adi</th>
                <th className="text-center p-3">Aktif / Max</th>
                <th className="text-center p-3 hidden sm:table-cell">Toplam Uye</th>
                <th className="text-center p-3">Tur</th>
                <th className="text-center p-3">Durum</th>
              </tr></thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-[#ECECEE] font-medium">{f.name}</td>
                    <td className="p-3 text-center">
                      <span className="text-[#ECECEE] font-semibold">{f.active_member_count ?? f.member_count}</span>
                      <span className="text-[#5C5C5F]">/{f.max_users}</span>
                    </td>
                    <td className="p-3 text-center text-[#8B8B8E] hidden sm:table-cell">{f.member_count}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${f.firm_type === "kurumsal" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "bg-[#3DD68C]/10 text-[#3DD68C]"}`}>
                        {f.firm_type === "kurumsal" ? "Kurumsal" : "Bireysel"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`w-2 h-2 rounded-full inline-block ${f.is_active ? "bg-[#3DD68C]" : "bg-[#E5484D]"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
