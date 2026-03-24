"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/components/ui/auth-provider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Interfaces ───────────────────────────────────────

interface UserItem { id: string; email: string; full_name: string; role: string; baro: string | null; baro_sicil_no: string | null; is_active: boolean; created_at: string | null; firm_id: string | null; }
interface FirmItem { id: string; name: string; email: string | null; member_count: number; max_users: number; firm_type: string; is_active: boolean; created_at: string | null; }
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

// Deadline management interfaces
interface DeadlineRule {
  id: string;
  event_type_id: string;
  name: string;
  duration_value: number;
  duration_unit: string;
  deadline_type: string;
  law_reference: string;
  affects_by_judicial_recess: boolean;
  affects_by_holidays: boolean;
  description: string;
  is_active: boolean;
}

interface EventType {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  is_active: boolean;
  rules: DeadlineRule[];
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  holiday_type: string;
  is_half_day: boolean;
  year: number;
}

interface JudicialRecess {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  civil_extension_days: number;
  criminal_extension_days: number;
  administrative_extension_days: number;
}

interface DeadlineStats {
  event_type_count: number;
  rule_count: number;
  category_count: number;
  holiday_years: number;
}

// ── Constants ────────────────────────────────────────

const ROLES = ["platform_admin", "admin", "partner", "avukat", "stajyer", "asistan"];
const ROLE_LABELS: Record<string, string> = { platform_admin: "Platform Admin", admin: "Firma Admin", partner: "Partner", avukat: "Avukat", stajyer: "Stajyer", asistan: "Asistan" };
const ROLE_COLORS: Record<string, string> = { platform_admin: "bg-purple-500/10 text-purple-400", admin: "bg-[#6C6CFF]/10 text-[#6C6CFF]", partner: "bg-[#FFB224]/10 text-[#FFB224]", avukat: "bg-[#3DD68C]/10 text-[#3DD68C]", stajyer: "bg-[#8B8B8E]/10 text-[#8B8B8E]", asistan: "bg-[#8B8B8E]/10 text-[#8B8B8E]" };

type TabKey = "users" | "firms" | "deadline-rules" | "holidays" | "system" | "embedding" | "monitoring" | "settings";

const TAB_CONFIG: { key: TabKey; label: string; icon: string }[] = [
  { key: "users", label: "Kullanicilar", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { key: "firms", label: "Firmalar", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
  { key: "deadline-rules", label: "Sure Kurallari", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "holidays", label: "Tatiller", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { key: "system", label: "Sistem", icon: "M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008H15v-.008z" },
  { key: "embedding", label: "Embedding", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { key: "monitoring", label: "Monitoring", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { key: "settings", label: "Ayarlar", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  "HMK": { color: "#6C6CFF", bg: "bg-[#6C6CFF]/10" },
  "CMK": { color: "#E5484D", bg: "bg-[#E5484D]/10" },
  "IYUK": { color: "#A78BFA", bg: "bg-[#A78BFA]/10" },
  "IIK": { color: "#FFB224", bg: "bg-[#FFB224]/10" },
  "Is Kanunu": { color: "#3DD68C", bg: "bg-[#3DD68C]/10" },
  "TMK": { color: "#F472B6", bg: "bg-[#F472B6]/10" },
  "TTK": { color: "#38BDF8", bg: "bg-[#38BDF8]/10" },
  "TBK Kira": { color: "#FB923C", bg: "bg-[#FB923C]/10" },
  "Tuketici": { color: "#34D399", bg: "bg-[#34D399]/10" },
  "Vergi": { color: "#FBBF24", bg: "bg-[#FBBF24]/10" },
  "Fikri Mulkiyet": { color: "#C084FC", bg: "bg-[#C084FC]/10" },
  "Genel": { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" },
};

const DEADLINE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "hak_dusurucusu": { label: "Hak Dusurucusu", color: "#E5484D" },
  "zamanasimai": { label: "Zamanasimi", color: "#FFB224" },
  "usul_suresi": { label: "Usul Suresi", color: "#6C6CFF" },
  "bildirim": { label: "Bildirim", color: "#3DD68C" },
  "bilgi": { label: "Bilgi", color: "#8B8B8E" },
};

const DURATION_UNITS: Record<string, string> = {
  "gun": "Gun",
  "is_gunu": "Is Gunu",
  "hafta": "Hafta",
  "ay": "Ay",
  "yil": "Yil",
  "bilgi": "Bilgi",
};

const HOLIDAY_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "resmi": { label: "Resmi Tatil", color: "#6C6CFF", bg: "bg-[#6C6CFF]/10" },
  "dini": { label: "Dini Bayram", color: "#A78BFA", bg: "bg-[#A78BFA]/10" },
  "arife": { label: "Arife", color: "#FB923C", bg: "bg-[#FB923C]/10" },
};

const ALL_CATEGORIES = ["HMK", "CMK", "IYUK", "IIK", "Is Kanunu", "TMK", "TTK", "TBK Kira", "Tuketici", "Vergi", "Fikri Mulkiyet", "Genel"];

const MONTHS_TR = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];

// ── Source configs for ingestion ─────────────────────

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  yargitay: { label: "Yargitay", color: "#6C6CFF", bg: "bg-[#6C6CFF]" },
  danistay: { label: "Danistay", color: "#A78BFA", bg: "bg-[#A78BFA]" },
  aym: { label: "AYM", color: "#E5484D", bg: "bg-[#E5484D]" },
  aihm: { label: "AIHM", color: "#3DD68C", bg: "bg-[#3DD68C]" },
  mevzuat: { label: "Mevzuat", color: "#FFB224", bg: "bg-[#FFB224]" },
};

const YARGITAY_DAIRELERI: Record<string, string> = {
  "1": "1. Hukuk Dairesi", "2": "2. Hukuk Dairesi", "3": "3. Hukuk Dairesi",
  "4": "4. Hukuk Dairesi", "5": "5. Hukuk Dairesi", "6": "6. Hukuk Dairesi",
  "7": "7. Hukuk Dairesi", "8": "8. Hukuk Dairesi", "9": "9. Hukuk Dairesi",
  "10": "10. Hukuk Dairesi", "11": "11. Hukuk Dairesi", "12": "12. Hukuk Dairesi",
  "13": "13. Hukuk Dairesi", "14": "14. Hukuk Dairesi", "15": "15. Hukuk Dairesi",
  "17": "17. Hukuk Dairesi", "HGK": "Hukuk Genel Kurulu",
  "C1": "1. Ceza Dairesi", "C2": "2. Ceza Dairesi", "C3": "3. Ceza Dairesi",
  "C4": "4. Ceza Dairesi", "C5": "5. Ceza Dairesi", "C6": "6. Ceza Dairesi",
  "C7": "7. Ceza Dairesi", "C8": "8. Ceza Dairesi", "C9": "9. Ceza Dairesi",
  "C10": "10. Ceza Dairesi", "C11": "11. Ceza Dairesi", "C12": "12. Ceza Dairesi",
  "C13": "13. Ceza Dairesi", "C14": "14. Ceza Dairesi", "C15": "15. Ceza Dairesi",
  "C16": "16. Ceza Dairesi", "CGK": "Ceza Genel Kurulu",
};


// ── Helper: HeroIcon path shortcut ───────────────────

function HIcon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// ── Skeleton Loader ──────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`} />;
}

function SkeletonCard() {
  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Sil",
  confirmColor = "#E5484D",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#111113] border border-white/[0.06] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-2">{title}</h3>
        <p className="text-[13px] text-[#8B8B8E] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[12px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-[12px] font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Slide-over Panel ─────────────────────────────────

function SlideOver({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[50] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed right-0 top-0 bottom-0 z-[51] ${width} w-full bg-[#111113] border-l border-white/[0.06] shadow-2xl flex flex-col`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-[15px] font-semibold text-[#ECECEE]">{title}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


// ══════════════════════════════════════════════════════
// ══  MAIN ADMIN PAGE  ════════════════════════════════
// ══════════════════════════════════════════════════════

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("users");
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

      {/* Pending users alert */}
      {tab === "users" && pendingUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FFB224]/10 border border-[#FFB224]/20 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#FFB224]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="text-[13px] font-semibold text-[#FFB224]">Onay Bekleyen ({pendingUsers.length})</h3>
          </div>
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
        </motion.div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[11px] uppercase tracking-wider">
              <th className="text-left p-3">Kullanici</th><th className="text-left p-3">E-posta</th><th className="text-left p-3">Baro</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Durum</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
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
        </motion.div>
      )}

      {/* Firms tab */}
      {tab === "firms" && (() => {
        const kurumsalFirms = firms.filter((f) => f.firm_type === "kurumsal");
        const bireyselFirms = firms.filter((f) => f.firm_type === "bireysel");
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {firms.length === 0 ? (
              <EmptyState
                icon="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                title="Henuz firma yok"
                description="Firmalar kullanicilar tarafindan olusturulacak."
              />
            ) : (
              <>
                {/* Kurumsal Burolar */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 rounded-full bg-[#6C6CFF]" />
                    <h3 className="text-[14px] font-semibold text-[#ECECEE]">Kurumsal Burolar</h3>
                    <span className="text-[12px] text-[#5C5C5F]">({kurumsalFirms.length})</span>
                  </div>
                  {kurumsalFirms.length === 0 ? (
                    <p className="text-[12px] text-[#5C5C5F] pl-3">Henuz kurumsal buro yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {kurumsalFirms.map((f) => (
                        <div key={f.id} className="bg-[#09090B] border border-[#6C6CFF]/20 rounded-xl p-4 flex items-center justify-between hover:border-[#6C6CFF]/40 transition-colors">
                          <div>
                            <p className="text-[14px] font-medium text-[#ECECEE]">{f.name}</p>
                            <p className="text-[12px] text-[#5C5C5F]">{f.email || "\u2014"} · {f.member_count}/{f.max_users} uye</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${f.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                            {f.is_active ? "Aktif" : "Pasif"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bireysel Avukatlar */}
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
                        <div key={f.id} className="bg-[#09090B] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-white/[0.12] transition-colors">
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
              </>
            )}
          </motion.div>
        );
      })()}

      {/* Deadline Rules tab */}
      {tab === "deadline-rules" && (
        <DeadlineRulesTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
      )}

      {/* Holidays tab */}
      {tab === "holidays" && (
        <HolidaysTab token={token} apiUrl={API_URL} headers={headers} onToast={showToast} />
      )}

      {/* System tab */}
      {tab === "system" && systemHealth && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {Object.entries(systemHealth.checks || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-white/[0.12] transition-colors">
              <div>
                <p className="text-[14px] font-medium text-[#ECECEE] capitalize">{key}</p>
                {val.embeddings !== undefined && <p className="text-[12px] text-[#5C5C5F]">{val.embeddings} embedding</p>}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${val.status === "ok" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
                {val.status}
              </span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Embedding tab */}
      {tab === "embedding" && (
        <IngestionDashboard token={token} apiUrl={API_URL} onToast={(msg: string) => showToast(msg)} />
      )}

      {/* Monitoring tab */}
      {tab === "monitoring" && (
        <MonitoringDashboard token={token} apiUrl={API_URL} />
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <SettingsTab apiUrl={API_URL} />
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════
// ══  EMPTY STATE COMPONENT  ══════════════════════════
// ══════════════════════════════════════════════════════

function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111113] border border-white/[0.06] border-dashed rounded-xl p-12 flex flex-col items-center text-center"
    >
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
        <HIcon d={icon} className="w-6 h-6 text-[#5C5C5F]" />
      </div>
      <h3 className="text-[14px] font-medium text-[#ECECEE] mb-1">{title}</h3>
      <p className="text-[12px] text-[#5C5C5F] max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}


// ══════════════════════════════════════════════════════
// ══  DEADLINE RULES TAB  ═════════════════════════════
// ══════════════════════════════════════════════════════

function DeadlineRulesTab({
  token,
  apiUrl,
  headers,
  onToast,
}: {
  token: string | null;
  apiUrl: string;
  headers: Record<string, string>;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [deadlineStats, setDeadlineStats] = useState<DeadlineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tumu");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [editingRule, setEditingRule] = useState<string | null>(null);

  // Slide-over state
  const [showNewEventType, setShowNewEventType] = useState(false);
  const [showNewRule, setShowNewRule] = useState<string | null>(null); // event_type_id
  const [showEditEventType, setShowEditEventType] = useState<EventType | null>(null);

  // Confirm dialog
  const [confirmDelete, setConfirmDelete] = useState<{ type: "event" | "rule"; id: string; name: string } | null>(null);

  // New event type form
  const [newEventForm, setNewEventForm] = useState({ name: "", slug: "", category: "HMK", description: "" });

  // New/edit rule form
  const [ruleForm, setRuleForm] = useState({
    name: "",
    duration_value: 0,
    duration_unit: "gun",
    deadline_type: "usul_suresi",
    law_reference: "",
    affects_by_judicial_recess: true,
    affects_by_holidays: true,
    description: "",
    is_active: true,
  });

  const fetchEventTypes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [etRes, statsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/event-types`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/v1/admin/deadline-rules/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (etRes.status === "fulfilled" && etRes.value.ok) {
        setEventTypes(await etRes.value.json());
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        setDeadlineStats(await statsRes.value.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, apiUrl, headers]);

  useEffect(() => { fetchEventTypes(); }, [fetchEventTypes]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    eventTypes.forEach((et) => {
      counts[et.category] = (counts[et.category] || 0) + 1;
    });
    return counts;
  }, [eventTypes]);

  // Filtered event types
  const filteredEventTypes = useMemo(() => {
    let filtered = eventTypes;
    if (selectedCategory !== "Tumu") {
      filtered = filtered.filter((et) => et.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((et) =>
        et.name.toLowerCase().includes(q) ||
        et.slug.toLowerCase().includes(q) ||
        et.rules.some((r) => r.name.toLowerCase().includes(q) || r.law_reference.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [eventTypes, selectedCategory, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CRUD operations
  const createEventType = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types`, {
        method: "POST",
        headers,
        body: JSON.stringify(newEventForm),
      });
      if (r.ok) {
        onToast("Olay turu olusturuldu");
        setShowNewEventType(false);
        setNewEventForm({ name: "", slug: "", category: "HMK", description: "" });
        fetchEventTypes();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Olusturma basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateEventType = async (et: EventType) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types/${et.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name: et.name, slug: et.slug, category: et.category, description: et.description, is_active: et.is_active }),
      });
      if (r.ok) {
        onToast("Olay turu guncellendi");
        setShowEditEventType(null);
        fetchEventTypes();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteEventType = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Olay turu silindi");
        fetchEventTypes();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const createRule = async (eventTypeId: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...ruleForm, event_type_id: eventTypeId }),
      });
      if (r.ok) {
        onToast("Kural olusturuldu");
        setShowNewRule(null);
        setRuleForm({ name: "", duration_value: 0, duration_unit: "gun", deadline_type: "usul_suresi", law_reference: "", affects_by_judicial_recess: true, affects_by_holidays: true, description: "", is_active: true });
        fetchEventTypes();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Olusturma basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateRule = async (rule: DeadlineRule) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules/${rule.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(rule),
      });
      if (r.ok) {
        onToast("Kural guncellendi");
        setEditingRule(null);
        fetchEventTypes();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteRule = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Kural silindi");
        fetchEventTypes();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "event") deleteEventType(confirmDelete.id);
    else deleteRule(confirmDelete.id);
    setConfirmDelete(null);
  };

  const totalRules = eventTypes.reduce((acc, et) => acc + et.rules.length, 0);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Olay Turu", value: deadlineStats?.event_type_count ?? eventTypes.length, color: "#6C6CFF" },
          { label: "Sure Kurali", value: deadlineStats?.rule_count ?? totalRules, color: "#3DD68C" },
          { label: "Kategori", value: deadlineStats?.category_count ?? Object.keys(categoryCounts).length, color: "#A78BFA" },
          { label: "Tatil Yili", value: deadlineStats?.holiday_years ?? 0, color: "#FFB224" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#111113] border border-white/[0.06] rounded-xl p-4"
          >
            <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-[#5C5C5F] mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Olay turu, kural veya kanun maddesi ara..."
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowNewEventType(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Olay Turu
        </button>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory("Tumu")}
          className={`px-3 py-1.5 text-[12px] font-medium rounded-lg whitespace-nowrap transition-all ${
            selectedCategory === "Tumu"
              ? "bg-[#6C6CFF]/15 text-[#6C6CFF] ring-1 ring-[#6C6CFF]/30"
              : "bg-white/[0.04] text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.06]"
          }`}
        >
          Tumu ({eventTypes.length})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] || 0;
          const catColor = CATEGORY_COLORS[cat] || { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? `ring-1`
                  : "bg-white/[0.04] hover:bg-white/[0.06]"
              }`}
              style={{
                color: selectedCategory === cat ? catColor.color : "#5C5C5F",
                backgroundColor: selectedCategory === cat ? `${catColor.color}15` : undefined,
                boxShadow: selectedCategory === cat ? `inset 0 0 0 1px ${catColor.color}40` : undefined,
              }}
            >
              {cat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Event Types list */}
      {filteredEventTypes.length === 0 ? (
        <EmptyState
          icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          title={searchQuery ? "Sonuc bulunamadi" : "Henuz olay turu yok"}
          description={searchQuery ? "Farkli bir arama terimi deneyin." : "Ilk olay turunu olusturarak baslayin."}
          action={!searchQuery ? (
            <button
              onClick={() => setShowNewEventType(true)}
              className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[12px] font-medium rounded-lg transition-colors"
            >
              + Yeni Olay Turu
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filteredEventTypes.map((et) => {
            const isExpanded = expandedEvents.has(et.id);
            const catColor = CATEGORY_COLORS[et.category] || { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };

            return (
              <motion.div
                key={et.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.10] transition-colors"
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(et.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <motion.svg
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    className="w-4 h-4 text-[#5C5C5F] shrink-0"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </motion.svg>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-medium text-[#ECECEE] truncate">{et.name}</span>
                      <span
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md shrink-0"
                        style={{ color: catColor.color, backgroundColor: `${catColor.color}15` }}
                      >
                        {et.category}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono text-[#5C5C5F] bg-white/[0.04] rounded shrink-0">
                        {et.rules.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#5C5C5F] font-mono">{et.slug}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${et.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#5C5C5F]/10 text-[#5C5C5F]"}`}>
                    {et.is_active ? "Aktif" : "Pasif"}
                  </span>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
                        {et.description && (
                          <p className="text-[12px] text-[#8B8B8E] mb-3">{et.description}</p>
                        )}

                        {/* Rules */}
                        {et.rules.length === 0 ? (
                          <div className="text-center py-6 bg-[#09090B] rounded-lg border border-dashed border-white/[0.06]">
                            <p className="text-[12px] text-[#5C5C5F]">Bu olay turune henuz kural eklenmemis.</p>
                          </div>
                        ) : (
                          et.rules.map((rule) => (
                            <RuleCard
                              key={rule.id}
                              rule={rule}
                              isEditing={editingRule === rule.id}
                              onEdit={() => setEditingRule(rule.id)}
                              onCancelEdit={() => setEditingRule(null)}
                              onSave={updateRule}
                              onDelete={() => setConfirmDelete({ type: "rule", id: rule.id, name: rule.name })}
                            />
                          ))
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => {
                              setShowNewRule(et.id);
                              setRuleForm({ name: "", duration_value: 0, duration_unit: "gun", deadline_type: "usul_suresi", law_reference: "", affects_by_judicial_recess: true, affects_by_holidays: true, description: "", is_active: true });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Yeni Kural Ekle
                          </button>
                          <button
                            onClick={() => setShowEditEventType(et)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#8B8B8E] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                            Olay Turunu Duzenle
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: "event", id: et.id, name: et.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            Sil
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Event Type Slide-over */}
      <SlideOver open={showNewEventType} onClose={() => setShowNewEventType(false)} title="Yeni Olay Turu">
        <div className="space-y-5">
          <FormField label="Olay Turu Adi">
            <input
              type="text"
              value={newEventForm.name}
              onChange={(e) => setNewEventForm({ ...newEventForm, name: e.target.value })}
              placeholder="orn. Hukuk Karari Tebligi"
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
            />
          </FormField>
          <FormField label="Slug (benzersiz tanimlayici)">
            <input
              type="text"
              value={newEventForm.slug}
              onChange={(e) => setNewEventForm({ ...newEventForm, slug: e.target.value })}
              placeholder="orn. hmk_karar_teblig"
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 font-mono"
            />
          </FormField>
          <FormField label="Kategori">
            <select
              value={newEventForm.category}
              onChange={(e) => setNewEventForm({ ...newEventForm, category: e.target.value })}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
            >
              {ALL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#16161A]">{c}</option>)}
            </select>
          </FormField>
          <FormField label="Aciklama">
            <textarea
              value={newEventForm.description}
              onChange={(e) => setNewEventForm({ ...newEventForm, description: e.target.value })}
              placeholder="Opsiyonel aciklama..."
              rows={3}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 resize-none"
            />
          </FormField>
          <button
            onClick={createEventType}
            disabled={!newEventForm.name || !newEventForm.slug}
            className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Olay Turunu Olustur
          </button>
        </div>
      </SlideOver>

      {/* Edit Event Type Slide-over */}
      <SlideOver open={!!showEditEventType} onClose={() => setShowEditEventType(null)} title="Olay Turunu Duzenle">
        {showEditEventType && (
          <EditEventTypeForm
            eventType={showEditEventType}
            onSave={updateEventType}
            onCancel={() => setShowEditEventType(null)}
          />
        )}
      </SlideOver>

      {/* New Rule Slide-over */}
      <SlideOver open={!!showNewRule} onClose={() => setShowNewRule(null)} title="Yeni Sure Kurali">
        <RuleFormFields
          form={ruleForm}
          onChange={setRuleForm}
          onSubmit={() => showNewRule && createRule(showNewRule)}
          submitLabel="Kural Olustur"
        />
      </SlideOver>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === "event" ? "Olay Turunu Sil" : "Kurali Sil"}
        message={`"${confirmDelete?.name || ""}" silinecek. Bu islem geri alinamaz.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </motion.div>
  );
}


// ── Form Field wrapper ───────────────────────────────

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#8B8B8E] block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#5C5C5F] mt-1">{hint}</p>}
    </div>
  );
}


// ── Edit Event Type Form ─────────────────────────────

function EditEventTypeForm({ eventType, onSave, onCancel }: { eventType: EventType; onSave: (et: EventType) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...eventType });
  return (
    <div className="space-y-5">
      <FormField label="Olay Turu Adi">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>
      <FormField label="Slug">
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 font-mono"
        />
      </FormField>
      <FormField label="Kategori">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        >
          {ALL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#16161A]">{c}</option>)}
        </select>
      </FormField>
      <FormField label="Aciklama">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 resize-none"
        />
      </FormField>
      <FormField label="Durum">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="accent-[#6C6CFF] w-4 h-4"
          />
          <span className="text-[13px] text-[#ECECEE]">Aktif</span>
        </label>
      </FormField>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          Kaydet
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[13px] font-medium rounded-lg transition-colors"
        >
          Iptal
        </button>
      </div>
    </div>
  );
}


// ── Rule Form Fields ─────────────────────────────────

function RuleFormFields({
  form,
  onChange,
  onSubmit,
  submitLabel,
}: {
  form: {
    name: string;
    duration_value: number;
    duration_unit: string;
    deadline_type: string;
    law_reference: string;
    affects_by_judicial_recess: boolean;
    affects_by_holidays: boolean;
    description: string;
    is_active: boolean;
  };
  onChange: (f: typeof form) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-5">
      <FormField label="Kural Adi">
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="orn. Istinaf suresi"
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Sure Degeri">
          <input
            type="number"
            value={form.duration_value}
            onChange={(e) => onChange({ ...form, duration_value: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
          />
        </FormField>
        <FormField label="Sure Birimi">
          <select
            value={form.duration_unit}
            onChange={(e) => onChange({ ...form, duration_unit: e.target.value })}
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
          >
            {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="Sure Tipi">
        <select
          value={form.deadline_type}
          onChange={(e) => onChange({ ...form, deadline_type: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        >
          {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
        </select>
      </FormField>

      <FormField label="Kanun Maddesi" hint="orn. HMK md. 345">
        <input
          type="text"
          value={form.law_reference}
          onChange={(e) => onChange({ ...form, law_reference: e.target.value })}
          placeholder="HMK md. 345"
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Adli Tatil Etkisi">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.affects_by_judicial_recess}
              onChange={(e) => onChange({ ...form, affects_by_judicial_recess: e.target.checked })}
              className="accent-[#6C6CFF] w-4 h-4"
            />
            <span className="text-[13px] text-[#ECECEE]">Evet</span>
          </label>
        </FormField>
        <FormField label="Resmi Tatil Etkisi">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.affects_by_holidays}
              onChange={(e) => onChange({ ...form, affects_by_holidays: e.target.checked })}
              className="accent-[#6C6CFF] w-4 h-4"
            />
            <span className="text-[13px] text-[#ECECEE]">Evet</span>
          </label>
        </FormField>
      </div>

      <FormField label="Aciklama">
        <textarea
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Opsiyonel aciklama..."
          rows={3}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 resize-none"
        />
      </FormField>

      <FormField label="Durum">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
            className="accent-[#6C6CFF] w-4 h-4"
          />
          <span className="text-[13px] text-[#ECECEE]">Aktif</span>
        </label>
      </FormField>

      <button
        onClick={onSubmit}
        disabled={!form.name}
        className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[13px] font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}


// ── Rule Card ────────────────────────────────────────

function RuleCard({
  rule,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  rule: DeadlineRule;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (r: DeadlineRule) => void;
  onDelete: () => void;
}) {
  const [editForm, setEditForm] = useState(rule);
  const dtLabel = DEADLINE_TYPE_LABELS[rule.deadline_type] || { label: rule.deadline_type, color: "#8B8B8E" };
  const unitLabel = DURATION_UNITS[rule.duration_unit] || rule.duration_unit;

  useEffect(() => { setEditForm(rule); }, [rule]);

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-[#09090B] border border-[#6C6CFF]/20 rounded-lg p-4 space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Kural Adi">
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
          <FormField label="Kanun Maddesi">
            <input type="text" value={editForm.law_reference} onChange={(e) => setEditForm({ ...editForm, law_reference: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Sure">
            <input type="number" value={editForm.duration_value} onChange={(e) => setEditForm({ ...editForm, duration_value: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
          <FormField label="Birim">
            <select value={editForm.duration_unit} onChange={(e) => setEditForm({ ...editForm, duration_unit: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
              {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v}</option>)}
            </select>
          </FormField>
          <FormField label="Sure Tipi">
            <select value={editForm.deadline_type} onChange={(e) => setEditForm({ ...editForm, deadline_type: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
              {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editForm.affects_by_judicial_recess} onChange={(e) => setEditForm({ ...editForm, affects_by_judicial_recess: e.target.checked })} className="accent-[#6C6CFF] w-3.5 h-3.5" />
            <span className="text-[12px] text-[#ECECEE]">Adli tatil etkisi</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editForm.affects_by_holidays} onChange={(e) => setEditForm({ ...editForm, affects_by_holidays: e.target.checked })} className="accent-[#6C6CFF] w-3.5 h-3.5" />
            <span className="text-[12px] text-[#ECECEE]">Resmi tatil etkisi</span>
          </label>
        </div>
        <FormField label="Aciklama">
          <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 resize-none" />
        </FormField>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancelEdit} className="px-3 py-1.5 text-[11px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors">Iptal</button>
          <button onClick={() => onSave(editForm)} className="px-3 py-1.5 text-[11px] font-medium text-white bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg transition-colors">Kaydet</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-[#09090B] rounded-lg p-4 group hover:bg-[#0D0D10] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[13px] font-medium text-[#ECECEE]">{rule.name}</span>
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{ color: dtLabel.color, backgroundColor: `${dtLabel.color}15` }}
            >
              {dtLabel.label}
            </span>
            {!rule.is_active && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#5C5C5F]/10 text-[#5C5C5F]">Pasif</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#8B8B8E] flex-wrap">
            <span className="font-medium">
              {rule.duration_value} {unitLabel}
            </span>
            {rule.law_reference && (
              <>
                <span className="text-[#5C5C5F]">·</span>
                <span className="text-[#A78BFA]">{rule.law_reference}</span>
              </>
            )}
            <span className="text-[#5C5C5F]">·</span>
            <span className="flex items-center gap-1">
              Adli tatil: {rule.affects_by_judicial_recess ? <span className="text-[#3DD68C]">&#10003;</span> : <span className="text-[#E5484D]">&#10005;</span>}
            </span>
            <span className="flex items-center gap-1">
              Tatil: {rule.affects_by_holidays ? <span className="text-[#3DD68C]">&#10003;</span> : <span className="text-[#E5484D]">&#10005;</span>}
            </span>
          </div>
          {rule.description && (
            <p className="text-[11px] text-[#5C5C5F] mt-1.5">{rule.description}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
            aria-label="Duzenle"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
            aria-label="Sil"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════
// ══  HOLIDAYS TAB  ═══════════════════════════════════
// ══════════════════════════════════════════════════════

function HolidaysTab({
  token,
  apiUrl,
  headers,
  onToast,
}: {
  token: string | null;
  apiUrl: string;
  headers: Record<string, string>;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [recesses, setRecesses] = useState<JudicialRecess[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-overs
  const [showNewHoliday, setShowNewHoliday] = useState(false);
  const [showEditHoliday, setShowEditHoliday] = useState<Holiday | null>(null);
  const [showEditRecess, setShowEditRecess] = useState<JudicialRecess | null>(null);
  const [showNewRecess, setShowNewRecess] = useState(false);

  // Confirm
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  // New holiday form
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "", type: "resmi", is_half_day: false });

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [holRes, recRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/holidays?year=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/v1/admin/judicial-recesses`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (holRes.status === "fulfilled" && holRes.value.ok) {
        const holData = await holRes.value.json();
        setHolidays(Array.isArray(holData) ? holData : holData.holidays || []);
      } else setHolidays([]);
      if (recRes.status === "fulfilled" && recRes.value.ok) setRecesses(await recRes.value.json());
      else setRecesses([]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, apiUrl, selectedYear, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createHoliday = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays`, {
        method: "POST", headers,
        body: JSON.stringify({ date: holidayForm.date, name: holidayForm.name, holiday_type: holidayForm.type, is_half_day: holidayForm.is_half_day, year: selectedYear }),
      });
      if (r.ok) {
        onToast("Tatil eklendi");
        setShowNewHoliday(false);
        setHolidayForm({ date: "", name: "", type: "resmi", is_half_day: false });
        fetchData();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Ekleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateHoliday = async (h: Holiday) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays/${h.id}`, {
        method: "PUT", headers,
        body: JSON.stringify(h),
      });
      if (r.ok) {
        onToast("Tatil guncellendi");
        setShowEditHoliday(null);
        fetchData();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/holidays/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Tatil silindi");
        fetchData();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const createRecess = async (recess: Omit<JudicialRecess, "id">) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses`, {
        method: "POST", headers,
        body: JSON.stringify(recess),
      });
      if (r.ok) {
        onToast("Adli tatil donemi eklendi");
        setShowNewRecess(false);
        fetchData();
      } else {
        onToast("Ekleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateRecess = async (recess: JudicialRecess) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses/${recess.id}`, {
        method: "PUT", headers,
        body: JSON.stringify(recess),
      });
      if (r.ok) {
        onToast("Adli tatil donemi guncellendi");
        setShowEditRecess(null);
        fetchData();
      } else {
        onToast("Guncelleme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteRecess = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/judicial-recesses/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        onToast("Adli tatil donemi silindi");
        fetchData();
      } else {
        onToast("Silme basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  // Build calendar data
  const holidaysByDate = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    holidays.forEach((h) => {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    });
    return map;
  }, [holidays]);

  const currentRecess = recesses.find((r) => r.year === selectedYear);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Skeleton className="h-12 rounded-xl w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Year selector + actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-lg p-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
                selectedYear === y
                  ? "bg-[#6C6CFF]/15 text-[#6C6CFF]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewRecess(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#A78BFA] bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Adli Tatil
          </button>
          <button
            onClick={() => {
              setShowNewHoliday(true);
              setHolidayForm({ date: "", name: "", type: "resmi", is_half_day: false });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[12px] font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Tatil
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const firstDay = new Date(selectedYear, monthIndex, 1);
          const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
          const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

          return (
            <div key={monthIndex} className="bg-[#111113] border border-white/[0.06] rounded-xl p-3">
              <h4 className="text-[12px] font-semibold text-[#ECECEE] mb-2">{MONTHS_TR[monthIndex]}</h4>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {/* Day headers */}
                {["Pt", "Sa", "Ca", "Pe", "Cu", "Ct", "Pa"].map((d) => (
                  <span key={d} className="text-[9px] text-[#5C5C5F] font-medium pb-0.5">{d}</span>
                ))}
                {/* Empty slots */}
                {Array.from({ length: startDow }, (_, i) => (
                  <span key={`e${i}`} />
                ))}
                {/* Days */}
                {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                  const day = dayIndex + 1;
                  const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayHolidays = holidaysByDate[dateStr];
                  const hasHoliday = !!dayHolidays;
                  const isResmi = dayHolidays?.some((h) => h.holiday_type === "resmi");
                  const isDini = dayHolidays?.some((h) => h.holiday_type === "dini");
                  const isArife = dayHolidays?.some((h) => h.holiday_type === "arife");
                  const isHalf = dayHolidays?.some((h) => h.is_half_day);

                  // Check if in judicial recess
                  const isInRecess = currentRecess && dateStr >= currentRecess.start_date && dateStr <= currentRecess.end_date;

                  let bgColor = "";
                  let textColor = "text-[#8B8B8E]";
                  if (isResmi) { bgColor = "bg-[#6C6CFF]/20"; textColor = "text-[#6C6CFF]"; }
                  else if (isDini) { bgColor = "bg-[#A78BFA]/20"; textColor = "text-[#A78BFA]"; }
                  else if (isArife) { bgColor = "bg-[#FB923C]/20"; textColor = "text-[#FB923C]"; }
                  else if (isInRecess) { bgColor = "bg-[#E5484D]/10"; textColor = "text-[#E5484D]/70"; }

                  const tooltipText = dayHolidays?.map((h) => `${h.name}${h.is_half_day ? " (yarim gun)" : ""}`).join(", ");

                  return (
                    <span
                      key={day}
                      className={`text-[10px] w-6 h-6 flex items-center justify-center rounded-md ${bgColor} ${textColor} ${hasHoliday ? "font-semibold cursor-help" : ""} ${isHalf ? "relative" : ""}`}
                      title={tooltipText || undefined}
                    >
                      {day}
                      {isHalf && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FB923C]" />}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#6C6CFF]/20 border border-[#6C6CFF]/40" />
          <span className="text-[11px] text-[#8B8B8E]">Resmi Tatil</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#A78BFA]/20 border border-[#A78BFA]/40" />
          <span className="text-[11px] text-[#8B8B8E]">Dini Bayram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#FB923C]/20 border border-[#FB923C]/40" />
          <span className="text-[11px] text-[#8B8B8E]">Arife</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#E5484D]/10 border border-[#E5484D]/20" />
          <span className="text-[11px] text-[#8B8B8E]">Adli Tatil</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative w-3 h-3 rounded bg-white/[0.04]"><span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FB923C]" /></span>
          <span className="text-[11px] text-[#8B8B8E]">Yarim Gun</span>
        </div>
      </div>

      {/* Holidays table */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-[13px] font-semibold text-[#ECECEE]">Tatil Listesi ({holidays.length})</h3>
        </div>
        {holidays.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[12px] text-[#5C5C5F]">{selectedYear} yili icin tatil verisi yok.</p>
            <button
              onClick={() => setShowNewHoliday(true)}
              className="mt-3 px-4 py-2 text-[12px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors"
            >
              + Ilk tatili ekle
            </button>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[#5C5C5F] text-[11px] uppercase tracking-wider">
                <th className="text-left p-3">Tarih</th>
                <th className="text-left p-3">Ad</th>
                <th className="text-left p-3">Tur</th>
                <th className="text-left p-3">Yarim Gun</th>
                <th className="text-right p-3">Islemler</th>
              </tr>
            </thead>
            <tbody>
              {holidays
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => {
                  const htLabel = HOLIDAY_TYPE_LABELS[h.holiday_type] || { label: h.holiday_type, color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };
                  return (
                    <tr key={h.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 text-[#ECECEE] font-mono text-[12px]">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" })}
                      </td>
                      <td className="p-3 text-[#ECECEE]">{h.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md" style={{ color: htLabel.color, backgroundColor: `${htLabel.color}15` }}>
                          {htLabel.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {h.is_half_day ? (
                          <span className="text-[#FB923C] text-[11px]">Evet</span>
                        ) : (
                          <span className="text-[#5C5C5F] text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setShowEditHoliday(h)}
                            className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                            aria-label="Duzenle"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ id: h.id, name: h.name })}
                            className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                            aria-label="Sil"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {/* Judicial Recesses section */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#ECECEE]">Adli Tatil Donemleri</h3>
        </div>
        {recesses.length === 0 ? (
          <div className="text-center py-6 bg-[#09090B] rounded-lg border border-dashed border-white/[0.06]">
            <p className="text-[12px] text-[#5C5C5F]">Henuz adli tatil donemi tanimlanmamis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recesses
              .sort((a, b) => b.year - a.year)
              .map((recess) => (
                <div key={recess.id} className="bg-[#09090B] rounded-lg p-4 group hover:bg-[#0D0D10] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[14px] font-semibold text-[#ECECEE]">{recess.year}</span>
                        <span className="text-[12px] text-[#A78BFA]">
                          {new Date(recess.start_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} - {new Date(recess.end_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span className="text-[#8B8B8E]">
                          Hukuk uzatma: <span className="text-[#6C6CFF] font-medium">{recess.civil_extension_days} gun</span>
                        </span>
                        <span className="text-[#8B8B8E]">
                          Ceza uzatma: <span className="text-[#E5484D] font-medium">{recess.criminal_extension_days} gun</span>
                        </span>
                        <span className="text-[#8B8B8E]">
                          Idari uzatma: <span className="text-[#A78BFA] font-medium">{recess.administrative_extension_days} gun</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShowEditRecess(recess)}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                        aria-label="Duzenle"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                      </button>
                      <button
                        onClick={() => deleteRecess(recess.id)}
                        className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
                        aria-label="Sil"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* New Holiday Slide-over */}
      <SlideOver open={showNewHoliday} onClose={() => setShowNewHoliday(false)} title="Yeni Tatil Ekle">
        <div className="space-y-5">
          <FormField label="Tarih" hint="YYYY-MM-DD formatinda">
            <input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]"
            />
          </FormField>
          <FormField label="Tatil Adi">
            <input
              type="text"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="orn. Cumhuriyet Bayrami"
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
            />
          </FormField>
          <FormField label="Tatil Turu">
            <select
              value={holidayForm.type}
              onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
              className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
            >
              {Object.entries(HOLIDAY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Yarim Gun">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={holidayForm.is_half_day}
                onChange={(e) => setHolidayForm({ ...holidayForm, is_half_day: e.target.checked })}
                className="accent-[#6C6CFF] w-4 h-4"
              />
              <span className="text-[13px] text-[#ECECEE]">Yarim gun tatil</span>
            </label>
          </FormField>
          <button
            onClick={createHoliday}
            disabled={!holidayForm.date || !holidayForm.name}
            className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            Tatil Ekle
          </button>
        </div>
      </SlideOver>

      {/* Edit Holiday Slide-over */}
      <SlideOver open={!!showEditHoliday} onClose={() => setShowEditHoliday(null)} title="Tatil Duzenle">
        {showEditHoliday && (
          <EditHolidayForm holiday={showEditHoliday} onSave={updateHoliday} onCancel={() => setShowEditHoliday(null)} />
        )}
      </SlideOver>

      {/* New Recess Slide-over */}
      <SlideOver open={showNewRecess} onClose={() => setShowNewRecess(false)} title="Yeni Adli Tatil Donemi">
        <RecessFormFields
          initial={{ year: selectedYear, start_date: `${selectedYear}-07-20`, end_date: `${selectedYear}-08-31`, civil_extension_days: 7, criminal_extension_days: 3, administrative_extension_days: 7 }}
          onSave={(data) => createRecess(data)}
          onCancel={() => setShowNewRecess(false)}
        />
      </SlideOver>

      {/* Edit Recess Slide-over */}
      <SlideOver open={!!showEditRecess} onClose={() => setShowEditRecess(null)} title="Adli Tatil Donemi Duzenle">
        {showEditRecess && (
          <RecessFormFields
            initial={showEditRecess}
            onSave={(data) => updateRecess({ ...showEditRecess, ...data })}
            onCancel={() => setShowEditRecess(null)}
          />
        )}
      </SlideOver>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Tatili Sil"
        message={`"${confirmDelete?.name || ""}" silinecek. Bu islem geri alinamaz.`}
        onConfirm={() => { if (confirmDelete) { deleteHoliday(confirmDelete.id); setConfirmDelete(null); } }}
        onCancel={() => setConfirmDelete(null)}
      />
    </motion.div>
  );
}


// ── Edit Holiday Form ────────────────────────────────

function EditHolidayForm({ holiday, onSave, onCancel }: { holiday: Holiday; onSave: (h: Holiday) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...holiday });
  return (
    <div className="space-y-5">
      <FormField label="Tarih">
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
      </FormField>
      <FormField label="Tatil Adi">
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
      </FormField>
      <FormField label="Tatil Turu">
        <select value={form.holiday_type} onChange={(e) => setForm({ ...form, holiday_type: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
          {Object.entries(HOLIDAY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
        </select>
      </FormField>
      <FormField label="Yarim Gun">
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })} className="accent-[#6C6CFF] w-4 h-4" />
          <span className="text-[13px] text-[#ECECEE]">Yarim gun tatil</span>
        </label>
      </FormField>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[13px] font-medium rounded-lg transition-colors">Kaydet</button>
        <button onClick={onCancel} className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[13px] font-medium rounded-lg transition-colors">Iptal</button>
      </div>
    </div>
  );
}


// ── Recess Form Fields ───────────────────────────────

function RecessFormFields({
  initial,
  onSave,
  onCancel,
}: {
  initial: { year: number; start_date: string; end_date: string; civil_extension_days: number; criminal_extension_days: number; administrative_extension_days: number };
  onSave: (data: typeof initial) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...initial });
  return (
    <div className="space-y-5">
      <FormField label="Yil">
        <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 2026 })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Baslangic Tarihi">
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
        </FormField>
        <FormField label="Bitis Tarihi">
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 [color-scheme:dark]" />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Hukuk Uzatma (gun)">
          <input type="number" value={form.civil_extension_days} onChange={(e) => setForm({ ...form, civil_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
        <FormField label="Ceza Uzatma (gun)">
          <input type="number" value={form.criminal_extension_days} onChange={(e) => setForm({ ...form, criminal_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
        <FormField label="Idari Uzatma (gun)">
          <input type="number" value={form.administrative_extension_days} onChange={(e) => setForm({ ...form, administrative_extension_days: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[13px] font-medium rounded-lg transition-colors">Kaydet</button>
        <button onClick={onCancel} className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[13px] font-medium rounded-lg transition-colors">Iptal</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════
// ══  SETTINGS TAB  ═══════════════════════════════════
// ══════════════════════════════════════════════════════

function SettingsTab({ apiUrl }: { apiUrl: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Platform Info */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-4">Platform Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[11px] text-[#5C5C5F] mb-1">Versiyon</p>
            <p className="text-[14px] font-mono text-[#ECECEE]">1.0.0-beta</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[11px] text-[#5C5C5F] mb-1">API URL</p>
            <p className="text-[14px] font-mono text-[#6C6CFF] truncate">{apiUrl}</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[11px] text-[#5C5C5F] mb-1">Ortam</p>
            <p className="text-[14px] font-mono text-[#3DD68C]">{apiUrl.includes("localhost") ? "Development" : "Production"}</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[11px] text-[#5C5C5F] mb-1">Build Tarihi</p>
            <p className="text-[14px] font-mono text-[#8B8B8E]">{new Date().toLocaleDateString("tr-TR")}</p>
          </div>
        </div>
      </div>

      {/* Seed Data */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#ECECEE] mb-2">Seed Data Islemleri</h3>
        <p className="text-[12px] text-[#5C5C5F] mb-4">Sure kurallari ve tatil verilerini veritabanina yukleyin. Mevcut veriler guncellenir, yeni veriler eklenir.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#6C6CFF]/10 flex items-center justify-center">
                <HIcon d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-[#6C6CFF]" />
              </div>
              <span className="text-[13px] font-medium text-[#ECECEE]">Sure Kurallari</span>
            </div>
            <p className="text-[11px] text-[#5C5C5F] mb-3 flex-1">65+ olay turu ve 180+ sure kuralini yukle.</p>
            <button className="w-full py-2 text-[12px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors">
              Seed Calistir
            </button>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#3DD68C]/10 flex items-center justify-center">
                <HIcon d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" className="w-4 h-4 text-[#3DD68C]" />
              </div>
              <span className="text-[13px] font-medium text-[#ECECEE]">Tatil Verileri</span>
            </div>
            <p className="text-[11px] text-[#5C5C5F] mb-3 flex-1">2025-2028 arasi tatil ve adli tatil verilerini yukle.</p>
            <button className="w-full py-2 text-[12px] font-medium text-[#3DD68C] bg-[#3DD68C]/10 hover:bg-[#3DD68C]/20 rounded-lg transition-colors">
              Seed Calistir
            </button>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFB224]/10 flex items-center justify-center">
                <HIcon d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" className="w-4 h-4 text-[#FFB224]" />
              </div>
              <span className="text-[13px] font-medium text-[#ECECEE]">Tum Seed</span>
            </div>
            <p className="text-[11px] text-[#5C5C5F] mb-3 flex-1">Tum seed verilerini tek seferde yukle.</p>
            <button className="w-full py-2 text-[12px] font-medium text-[#FFB224] bg-[#FFB224]/10 hover:bg-[#FFB224]/20 rounded-lg transition-colors">
              Tumunu Calistir
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#111113] border border-[#E5484D]/10 rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#E5484D] mb-2">Tehlikeli Bolge</h3>
        <p className="text-[12px] text-[#5C5C5F] mb-4">Bu islemler geri alinamaz. Dikkatli olun.</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-[12px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 rounded-lg transition-colors border border-[#E5484D]/20">
            Cache Temizle
          </button>
        </div>
      </div>
    </motion.div>
  );
}


// ══════════════════════════════════════════════════════
// ══  INGESTION DASHBOARD (EXISTING)  ═════════════════
// ══════════════════════════════════════════════════════

function IngestionDashboard({ token, apiUrl, onToast }: { token: string | null; apiUrl: string; onToast: (msg: string) => void }) {
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

  useEffect(() => { fetchBreakdown(); fetchProgress(); }, [fetchBreakdown, fetchProgress]);

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
          <h3 className="text-[13px] font-semibold text-[#ECECEE]">Veri Kaynaklari</h3>
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
                      else if (key === "aihm") triggerIngest("/aihm", "AIHM");
                      else if (key === "mevzuat") triggerIngest("/mevzuat", "Mevzuat");
                      else triggerIngest("", "Ictihat");
                    }}
                    className="text-[10px] px-2 py-1 rounded-md border transition-colors shrink-0"
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
          <span className="text-[12px] text-[#5C5C5F]">Toplam</span>
          <span className="text-[15px] font-semibold text-[#ECECEE]">{(breakdown?.total || 0).toLocaleString("tr-TR")} embedding</span>
        </div>
      </div>

      {/* Active Operation */}
      <div className={`border rounded-xl p-5 transition-colors ${state?.running ? "bg-[#111113] border-[#3DD68C]/20" : "bg-[#111113] border-white/[0.06]"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${state?.running ? "bg-[#3DD68C] animate-pulse" : "bg-[#5C5C5F]"}`} />
            <span className="text-[13px] font-semibold text-[#ECECEE]">{state?.running ? "Calisiyor" : "Beklemede"}</span>
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
                <p className="text-[10px] text-[#5C5C5F] mt-0.5">Cekilen</p>
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
              ? `Son guncelleme: ${new Date(progress.last_update as string).toLocaleString("tr-TR")}`
              : "Henuz ingestion calistirilmadi"}
          </p>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => triggerIngest("", "Ictihat")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "bedesten" ? "Calisiyor..." : "Ictihat Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/aym", "AYM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#E5484D] hover:bg-[#D13438] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aym" ? "Calisiyor..." : "AYM Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/aihm", "AIHM")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#3DD68C] hover:bg-[#2CC67C] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "aihm" ? "Calisiyor..." : "AIHM Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/mevzuat", "Mevzuat")}
          disabled={state?.running}
          className="px-4 py-2 bg-[#FFB224] hover:bg-[#E5A010] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
        >
          {state?.running && state.source === "mevzuat" ? "Calisiyor..." : "Mevzuat Cek"}
        </button>
        <button
          onClick={() => triggerIngest("/batch", "Toplu")}
          disabled={state?.running}
          className="px-4 py-2 bg-gradient-to-r from-[#6C6CFF] to-[#3DD68C] hover:from-[#5B5BEE] hover:to-[#2CC67C] disabled:bg-[#1A1A1F] disabled:from-[#1A1A1F] disabled:to-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
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
          <span className="text-[13px] font-semibold text-[#ECECEE]">Gelismis Ingestion</span>
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
              <h4 className="text-[12px] font-semibold text-[#A78BFA]">Daire Bazli Ingestion</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Mahkeme</label>
                  <select
                    value={daireCourtType}
                    onChange={(e) => setDaireCourtType(e.target.value)}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  >
                    <option value="yargitay">Yargitay</option>
                    <option value="danistay">Danistay</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Daire</label>
                  <select
                    value={daireId}
                    onChange={(e) => setDaireId(e.target.value)}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  >
                    <option value="">Tum Daireler</option>
                    {Object.entries(YARGITAY_DAIRELERI).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Sayfa Sayisi</label>
                  <input
                    type="number"
                    value={dairePages}
                    onChange={(e) => setDairePages(parseInt(e.target.value) || 10)}
                    min={1}
                    max={100}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={triggerDaireIngest}
                    disabled={state?.running}
                    className="w-full px-4 py-2 bg-[#A78BFA] hover:bg-[#9678E5] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
                  >
                    Daire Cek
                  </button>
                </div>
              </div>
            </div>

            {/* Tarih Bazli Ingestion */}
            <div className="space-y-3">
              <h4 className="text-[12px] font-semibold text-[#FFB224]">Tarih Bazli Ingestion</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Baslangic (GG.AA.YYYY)</label>
                  <input
                    type="text"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="01.01.2024"
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Bitis (GG.AA.YYYY)</label>
                  <input
                    type="text"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="31.12.2024"
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Mahkemeler</label>
                  <div className="flex gap-2 mt-1">
                    {["yargitay", "danistay"].map((ct) => (
                      <label key={ct} className="flex items-center gap-1 text-[11px] text-[#8B8B8E]">
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
                  <label className="text-[11px] text-[#5C5C5F] block mb-1">Max Sayfa</label>
                  <input
                    type="number"
                    value={dateMaxPages}
                    onChange={(e) => setDateMaxPages(parseInt(e.target.value) || 50)}
                    min={1}
                    max={200}
                    className="w-full bg-[#09090B] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={triggerDateRangeIngest}
                    disabled={state?.running || !dateFrom || !dateTo}
                    className="w-full px-4 py-2 bg-[#FFB224] hover:bg-[#E5A010] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] rounded-lg text-[12px] font-medium text-white transition-colors"
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
            <span className="text-[11px] font-medium text-[#5C5C5F]">Canli Log</span>
            {state?.running && <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C] animate-pulse" />}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setLogFilter("all")}
              className={`px-2 py-0.5 text-[10px] rounded ${logFilter === "all" ? "bg-[#6C6CFF]/20 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}
            >
              Tumu
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
    </motion.div>
  );
}


// ══════════════════════════════════════════════════════
// ══  MONITORING DASHBOARD (EXISTING)  ════════════════
// ══════════════════════════════════════════════════════

interface MonitoringData {
  uptime_seconds: number;
  requests_total: number;
  requests_per_minute: number;
  avg_response_time_ms: number;
  error_rate_pct: number;
  active_connections: number;
  memory_usage_mb: number;
  cpu_percent: number;
  disk_usage_pct: number;
  services: Record<string, { status: string; response_ms: number; memory_mb?: number; error?: string }>;
  ingestion: {
    total_embeddings: number;
    by_source: Record<string, number>;
    last_ingestion: string | null;
    daily_new_count: number;
  };
}

interface HistoryPoint {
  ts: number;
  cpu_percent: number;
  memory_usage_mb: number;
  requests_per_minute: number;
  avg_response_time_ms: number;
  error_rate_pct: number;
  requests_total: number;
}

const SERVICE_LABELS: Record<string, string> = {
  qdrant: "Qdrant",
  redis: "Redis",
  postgres: "PostgreSQL",
  bedesten: "Bedesten",
};

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

function MonitoringDashboard({ token, apiUrl }: { token: string | null; apiUrl: string }) {
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
