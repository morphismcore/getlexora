"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

import type { UserItem, FirmItem, PlatformStats, EmbeddingStats, TabKey } from "./types";
import { ROLES, ROLE_LABELS, TAB_CONFIG } from "./constants";
import { HIcon } from "./components";

import DeadlineRulesTab from "./deadline-rules-tab";
import HolidaysTab from "./holidays-tab";
import SettingsTab from "./settings-tab";
import IngestionDashboard from "./ingestion-dashboard";
import MonitoringDashboard from "./monitoring-dashboard";

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
            className={`fixed top-4 right-4 z-[70] px-4 py-2.5 ${toastColors[toast.type].bg} border ${toastColors[toast.type].border} ${toastColors[toast.type].text} text-[13px] rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-2`}
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
        <div role="alert" className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-4 text-[13px] text-[#E5484D]">
          {fetchError}
          <button onClick={fetchAll} className="ml-3 underline">Tekrar dene</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#ECECEE]">Admin Panel</h1>
          <p className="text-[12px] text-[#5C5C5F] mt-0.5">Lexora platform yonetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
          <span className="text-[11px] text-[#5C5C5F]">{user.full_name}</span>
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
                <p className="text-[12px] text-[#5C5C5F]">{s.label}</p>
              </div>
              <p className="text-2xl font-semibold text-[#ECECEE]">{typeof s.value === "number" ? s.value.toLocaleString("tr-TR") : s.value}</p>
              {"sub" in s && s.sub && <p className="text-[11px] text-[#FFB224] mt-1">{s.sub}</p>}
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
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg transition-all whitespace-nowrap ${
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
          users={users}
          firms={firms}
          embeddings={embeddings}
          systemHealth={systemHealth}
          onApproveUser={approveUser}
          onRejectUser={rejectUser}
          onSetTab={setTab}
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

      {/* Sistem tab */}
      {tab === "sistem" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {systemHealth && (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-3">Servis Durumu</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {Object.entries(systemHealth.checks || {}).map(([key, val]: [string, any]) => (
                  <div key={key} className="bg-[#09090B] rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${val.status === "ok" ? "bg-[#3DD68C]" : "bg-[#E5484D] animate-pulse"}`} />
                      <span className="text-[12px] text-[#ECECEE] capitalize">{key}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${val.status === "ok" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                      {val.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MonitoringDashboard token={token} apiUrl={API_URL} />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
              <h3 className="text-[14px] font-semibold text-[#ECECEE]">Sure Kurallari</h3>
            </div>
            <DeadlineRulesTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-[#3DD68C]" />
              <h3 className="text-[14px] font-semibold text-[#ECECEE]">Tatiller</h3>
            </div>
            <HolidaysTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-[#FFB224]" />
              <h3 className="text-[14px] font-semibold text-[#ECECEE]">Platform Ayarlari</h3>
            </div>
            <SettingsTab apiUrl={API_URL} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Genel Tab Content ────────────────────────────────

function GenelTabContent({
  pendingUsers,
  users,
  firms,
  embeddings,
  systemHealth,
  onApproveUser,
  onRejectUser,
  onSetTab,
}: {
  pendingUsers: UserItem[];
  users: UserItem[];
  firms: FirmItem[];
  embeddings: EmbeddingStats | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  systemHealth: Record<string, any> | null;
  onApproveUser: (id: string) => void;
  onRejectUser: (id: string) => void;
  onSetTab: (tab: TabKey) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Pending users alert */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFB224]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="text-[13px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          </div>
          {pendingUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#09090B] rounded-lg p-3">
              <div>
                <p className="text-[13px] text-[#ECECEE] font-medium">{u.full_name}</p>
                <p className="text-[11px] text-[#5C5C5F]">{u.email} {u.baro ? `\u2014 ${u.baro}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApproveUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#3DD68C]/20 text-[#3DD68C] rounded-md hover:bg-[#3DD68C]/30 transition-colors">Onayla</button>
                <button onClick={() => onRejectUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#E5484D]/20 text-[#E5484D] rounded-md hover:bg-[#E5484D]/30 transition-colors">Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => onSetTab("kullanicilar")} className="bg-[#111113] border border-white/[0.06] hover:border-[#6C6CFF]/30 rounded-xl p-5 text-left transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-[#6C6CFF]/10 flex items-center justify-center mb-3">
            <HIcon d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" className="w-5 h-5 text-[#6C6CFF]" />
          </div>
          <p className="text-[14px] font-medium text-[#ECECEE] mb-1">Kullanicilar & Firmalar</p>
          <p className="text-[12px] text-[#5C5C5F]">{users.length} kullanici, {firms.length} firma</p>
        </button>
        <button onClick={() => onSetTab("veri-yonetimi")} className="bg-[#111113] border border-white/[0.06] hover:border-[#3DD68C]/30 rounded-xl p-5 text-left transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/10 flex items-center justify-center mb-3">
            <HIcon d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" className="w-5 h-5 text-[#3DD68C]" />
          </div>
          <p className="text-[14px] font-medium text-[#ECECEE] mb-1">Veri Yonetimi</p>
          <p className="text-[12px] text-[#5C5C5F]">{(embeddings?.total || 0).toLocaleString("tr-TR")} embedding</p>
        </button>
        <button onClick={() => onSetTab("sistem")} className="bg-[#111113] border border-white/[0.06] hover:border-[#FFB224]/30 rounded-xl p-5 text-left transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-[#FFB224]/10 flex items-center justify-center mb-3">
            <HIcon d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-5 h-5 text-[#FFB224]" />
          </div>
          <p className="text-[14px] font-medium text-[#ECECEE] mb-1">Sistem Ayarlari</p>
          <p className="text-[12px] text-[#5C5C5F]">Sure kurallari, tatiller, ayarlar</p>
        </button>
      </div>

      {/* System health summary */}
      {systemHealth && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-3">Sistem Durumu</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {Object.entries(systemHealth.checks || {}).map(([key, val]: [string, any]) => (
              <div key={key} className="bg-[#09090B] rounded-lg p-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${val.status === "ok" ? "bg-[#3DD68C]" : "bg-[#E5484D] animate-pulse"}`} />
                <span className="text-[12px] text-[#ECECEE] capitalize">{key}</span>
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
  const kurumsalFirms = firms.filter((f) => f.firm_type === "kurumsal");
  const bireyselFirms = firms.filter((f) => f.firm_type === "bireysel");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Pending users */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFB224]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="text-[13px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          </div>
          {pendingUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#09090B] rounded-lg p-3">
              <div>
                <p className="text-[13px] text-[#ECECEE] font-medium">{u.full_name}</p>
                <p className="text-[11px] text-[#5C5C5F]">{u.email} {u.baro ? `\u2014 ${u.baro}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApproveUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#3DD68C]/20 text-[#3DD68C] rounded-md hover:bg-[#3DD68C]/30 transition-colors">Onayla</button>
                <button onClick={() => onRejectUser(u.id)} className="px-3 py-1 text-[11px] font-medium bg-[#E5484D]/20 text-[#E5484D] rounded-md hover:bg-[#E5484D]/30 transition-colors">Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
          <h3 className="text-[14px] font-semibold text-[#ECECEE]">Kullanicilar</h3>
          <span className="text-[12px] text-[#5C5C5F]">({users.length})</span>
        </div>
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[11px] uppercase tracking-wider">
              <th className="text-left p-3">Kullanici</th><th className="text-left p-3 hidden md:table-cell">E-posta</th><th className="text-left p-3 hidden sm:table-cell">Baro</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Durum</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-[#ECECEE]">{u.full_name}</td>
                  <td className="p-3 text-[#8B8B8E] hidden md:table-cell">{u.email}</td>
                  <td className="p-3 text-[#8B8B8E] hidden sm:table-cell">{u.baro || "\u2014"}</td>
                  <td className="p-3">
                    <select value={u.role} onChange={(e) => onChangeRole(u.id, e.target.value)} className="bg-transparent text-[12px] text-[#ECECEE] cursor-pointer focus:outline-none">
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
      </div>

      {/* Kurumsal Firms */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#A78BFA]" />
          <h3 className="text-[14px] font-semibold text-[#ECECEE]">Kurumsal Burolar</h3>
          <span className="text-[12px] text-[#5C5C5F]">({kurumsalFirms.length})</span>
        </div>
        {kurumsalFirms.length === 0 ? (
          <p className="text-[12px] text-[#5C5C5F] pl-3">Henuz kurumsal buro yok.</p>
        ) : (
          <div className="space-y-2">
            {kurumsalFirms.map((f) => (
              <div key={f.id} className="bg-[#111113] border border-[#6C6CFF]/20 rounded-xl p-4 flex items-center justify-between hover:border-[#6C6CFF]/40 transition-colors">
                <div>
                  <p className="text-[14px] font-medium text-[#ECECEE]">{f.name}</p>
                  <p className="text-[12px] text-[#5C5C5F]">{f.email || "\u2014"} {"\u00b7"} {f.member_count}/{f.max_users} uye</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${f.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                  {f.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bireysel Firms */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-[#3DD68C]" />
          <h3 className="text-[14px] font-semibold text-[#ECECEE]">Bireysel Avukatlar</h3>
          <span className="text-[12px] text-[#5C5C5F]">({bireyselFirms.length})</span>
        </div>
        {bireyselFirms.length === 0 ? (
          <p className="text-[12px] text-[#5C5C5F] pl-3">Henuz bireysel avukat yok.</p>
        ) : (
          <div className="space-y-2">
            {bireyselFirms.map((f) => (
              <div key={f.id} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-white/[0.12] transition-colors">
                <div>
                  <p className="text-[14px] font-medium text-[#ECECEE]">{f.name}</p>
                  <p className="text-[12px] text-[#5C5C5F]">{f.member_count}/{f.max_users} uye</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${f.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                  {f.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
