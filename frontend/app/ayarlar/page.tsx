"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/components/ui/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FirmMember { id: string; email: string; full_name: string; role: string; is_active: boolean; }
interface FirmInfo { id: string; name: string; tax_id: string | null; address: string | null; phone: string | null; email: string | null; max_users: number; }

const ROLES = [
  { value: "partner", label: "Partner" },
  { value: "avukat", label: "Avukat" },
  { value: "stajyer", label: "Stajyer" },
  { value: "asistan", label: "Asistan" },
];

export default function AyarlarPage() {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<"profil" | "guvenlik" | "firma" | "uyeler" | "bildirimler">("profil");
  const [toast, setToast] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState({ full_name: "", phone: "", baro_sicil_no: "", baro: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ current: "", new_password: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Firm state
  const [firm, setFirm] = useState<FirmInfo | null>(null);
  const [firmForm, setFirmForm] = useState({ name: "", tax_id: "", address: "", phone: "", email: "" });
  const [firmLoading, setFirmLoading] = useState(false);
  const [createFirmMode, setCreateFirmMode] = useState(false);

  // Members state
  const [members, setMembers] = useState<FirmMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    email_deadline_reminder: true,
    email_case_update: true,
    email_weekly_summary: false,
    reminder_days_before: 3,
  });
  const [notifLoading, setNotifLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Load profile
  useEffect(() => {
    if (user) {
      const u = user as unknown as Record<string, string>;
      setProfile({ full_name: user.full_name || "", phone: u.phone || "", baro_sicil_no: u.baro_sicil_no || "", baro: u.baro || "" });
    }
  }, [user]);

  // Load firm
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/auth/firm`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setFirm(data);
          setFirmForm({ name: data.name || "", tax_id: data.tax_id || "", address: data.address || "", phone: data.phone || "", email: data.email || "" });
        }
      })
      .catch((err) => { console.error("Firma yukleme hatasi:", err); setLoadError("Firma bilgileri yuklenemedi."); });
  }, [token]);

  // Load members
  useEffect(() => {
    if (!token || !firm) return;
    fetch(`${API_URL}/api/v1/auth/firm/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers)
      .catch((err) => { console.error("Uyeler yukleme hatasi:", err); setLoadError("Uye listesi yuklenemedi."); });
  }, [token, firm]);

  // Load notification preferences
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/notifications/preferences`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setNotifPrefs({
            email_deadline_reminder: data.email_deadline_reminder,
            email_case_update: data.email_case_update,
            email_weekly_summary: data.email_weekly_summary,
            reminder_days_before: data.reminder_days_before,
          });
        }
      })
      .catch((err) => { console.error("Bildirim tercihleri yukleme hatasi:", err); setLoadError("Bildirim tercihleri yuklenemedi."); });
  }, [token]);

  const saveNotifPrefs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications/preferences`, { method: "PUT", headers, body: JSON.stringify(notifPrefs) });
      if (!res.ok) throw new Error("Kaydetme basarisiz");
      setToast("Bildirim tercihleri guncellendi");
    } catch { setToast("Hata olustu"); }
    setNotifLoading(false);
  }, [notifPrefs, headers]);

  const saveProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/profile`, { method: "PUT", headers, body: JSON.stringify(profile) });
      if (!res.ok) throw new Error("Kaydetme başarısız");
      setToast("Profil güncellendi");
    } catch { setToast("Hata oluştu"); }
    setProfileLoading(false);
  }, [profile, headers]);

  const changePassword = useCallback(async () => {
    setPwError(null);
    if (passwords.new_password !== passwords.confirm) { setPwError("Şifreler eşleşmiyor"); return; }
    if (passwords.new_password.length < 8) { setPwError("Yeni şifre en az 8 karakter olmalı"); return; }
    setPwLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password`, { method: "PUT", headers, body: JSON.stringify({ current_password: passwords.current, new_password: passwords.new_password }) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.detail || "Şifre değiştirilemedi"); }
      setPasswords({ current: "", new_password: "", confirm: "" });
      setToast("Şifre değiştirildi");
    } catch (e) { setPwError(e instanceof Error ? e.message : "Hata oluştu"); }
    setPwLoading(false);
  }, [passwords, headers]);

  const createFirm = useCallback(async () => {
    setFirmLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/firm`, { method: "POST", headers, body: JSON.stringify({ name: firmForm.name, tax_id: firmForm.tax_id || null, address: firmForm.address || null, phone: firmForm.phone || null, email: firmForm.email || null }) });
      if (!res.ok) throw new Error("Firma oluşturulamadı");
      const data = await res.json();
      setFirm(data);
      setCreateFirmMode(false);
      setToast("Firma oluşturuldu");
    } catch { setToast("Hata oluştu"); }
    setFirmLoading(false);
  }, [firmForm, headers]);

  const updateFirm = useCallback(async () => {
    setFirmLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/auth/firm`, { method: "PUT", headers, body: JSON.stringify(firmForm) });
      setToast("Firma bilgileri güncellendi");
    } catch { setToast("Hata oluştu"); }
    setFirmLoading(false);
  }, [firmForm, headers]);

  const inviteMember = useCallback(async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/firm/invite`, { method: "POST", headers, body: JSON.stringify({ email: inviteEmail }) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.detail || "Davet başarısız"); }
      setInviteEmail("");
      setToast("Üye davet edildi");
      // Refresh members
      const mr = await fetch(`${API_URL}/api/v1/auth/firm/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (mr.ok) setMembers(await mr.json());
    } catch (e) { setToast(e instanceof Error ? e.message : "Hata"); }
    setInviteLoading(false);
  }, [inviteEmail, headers, token]);

  const changeRole = useCallback(async (userId: string, role: string) => {
    await fetch(`${API_URL}/api/v1/auth/firm/members/${userId}/role`, { method: "PUT", headers, body: JSON.stringify({ role }) });
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
    setToast("Rol güncellendi");
  }, [headers]);

  const removeMember = useCallback(async (userId: string) => {
    await fetch(`${API_URL}/api/v1/auth/firm/members/${userId}`, { method: "DELETE", headers });
    setMembers(prev => prev.filter(m => m.id !== userId));
    setToast("Üye çıkarıldı");
  }, [headers]);

  const inputCls = "w-full bg-[#111113] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 focus:bg-[#16161A] transition-all duration-200";
  const isAdmin = user?.role === "admin" || user?.role === "platform_admin";

  return (
    <div className="h-screen overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-6">
      {toast && <div role="alert" aria-live="polite" className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[15px] rounded-lg">{toast}</div>}

      {loadError && (
        <div role="alert" className="bg-[#E5484D]/10 border border-[#E5484D]/20 rounded-xl p-4 text-[15px] text-[#E5484D]">
          {loadError}
          <button onClick={() => { setLoadError(null); window.location.reload(); }} className="ml-3 underline">Tekrar dene</button>
        </div>
      )}

      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Ayarlar</h1>
        <p className="text-[14px] text-[#5C5C5F] mt-0.5">Hesap ve firma ayarlarınız</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-white/[0.06] rounded-lg p-1 w-fit">
        {([
          { id: "profil", label: "Profil" },
          { id: "guvenlik", label: "Güvenlik" },
          { id: "bildirimler", label: "Bildirimler" },
          { id: "firma", label: "Firma" },
          ...(firm ? [{ id: "uyeler", label: "Üyeler" }] : []),
        ] as { id: typeof tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 text-[14px] font-medium rounded-md transition-colors ${tab === t.id ? "bg-[#6C6CFF]/20 text-[#6C6CFF]" : "text-[#5C5C5F] hover:text-[#8B8B8E]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profil */}
      {tab === "profil" && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-4 max-w-lg">
          <div>
            <label htmlFor="profil-email" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">E-posta</label>
            <input id="profil-email" type="email" value={user?.email || ""} disabled className={inputCls + " opacity-50 cursor-not-allowed"} />
          </div>
          <div>
            <label htmlFor="profil-fullname" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Ad Soyad</label>
            <input id="profil-fullname" type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="profil-baro-sicil" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Baro Sicil No</label>
              <input id="profil-baro-sicil" type="text" value={profile.baro_sicil_no} onChange={e => setProfile(p => ({ ...p, baro_sicil_no: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label htmlFor="profil-baro" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Baro</label>
              <input id="profil-baro" type="text" value={profile.baro} onChange={e => setProfile(p => ({ ...p, baro: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="profil-phone" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Telefon</label>
            <input id="profil-phone" type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
          </div>
          <button onClick={saveProfile} disabled={profileLoading} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors">
            {profileLoading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      )}

      {/* Güvenlik */}
      {tab === "guvenlik" && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-4 max-w-lg">
          <h3 className="text-[15px] font-semibold text-[#ECECEE]">Şifre Değiştir</h3>
          <div>
            <label htmlFor="pw-current" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Mevcut Şifre</label>
            <input id="pw-current" type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pw-new" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Yeni Şifre (min 8 karakter)</label>
            <input id="pw-new" type="password" value={passwords.new_password} onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Yeni Şifre (tekrar)</label>
            <input id="pw-confirm" type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} className={inputCls} />
          </div>
          {pwError && <p className="text-[15px] text-[#E5484D]">{pwError}</p>}
          <button onClick={changePassword} disabled={pwLoading} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors">
            {pwLoading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
          </button>
        </div>
      )}

      {/* Bildirimler */}
      {tab === "bildirimler" && (
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-5 max-w-lg">
          <div>
            <h3 className="text-[15px] font-semibold text-[#ECECEE]">E-posta Bildirimleri</h3>
            <p className="text-[13px] text-[#5C5C5F] mt-0.5">Hangi durumlarda e-posta almak istediginizi secin.</p>
          </div>

          <div className="space-y-3">
            {/* Deadline reminder toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] text-[#ECECEE]">Sure Hatirlatmalari</p>
                <p className="text-[13px] text-[#5C5C5F]">Yaklasan hak dusurucusu ve durusma tarihleri</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.email_deadline_reminder}
                  onChange={(e) => setNotifPrefs(p => ({ ...p, email_deadline_reminder: e.target.checked }))}
                  className="sr-only peer"
                  role="switch"
                  aria-checked={notifPrefs.email_deadline_reminder}
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${notifPrefs.email_deadline_reminder ? "bg-[#6C6CFF]" : "bg-[#3A3A3F]"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifPrefs.email_deadline_reminder ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
                </div>
              </label>
            </div>

            {/* Case update toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] text-[#ECECEE]">Dava Guncellemeleri</p>
                <p className="text-[13px] text-[#5C5C5F]">Dava durumu degisiklikleri hakkinda bildirim</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.email_case_update}
                  onChange={(e) => setNotifPrefs(p => ({ ...p, email_case_update: e.target.checked }))}
                  className="sr-only peer"
                  role="switch"
                  aria-checked={notifPrefs.email_case_update}
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${notifPrefs.email_case_update ? "bg-[#6C6CFF]" : "bg-[#3A3A3F]"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifPrefs.email_case_update ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
                </div>
              </label>
            </div>

            {/* Weekly summary toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] text-[#ECECEE]">Haftalik Ozet</p>
                <p className="text-[13px] text-[#5C5C5F]">Her pazartesi dava ve sure ozeti</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.email_weekly_summary}
                  onChange={(e) => setNotifPrefs(p => ({ ...p, email_weekly_summary: e.target.checked }))}
                  className="sr-only peer"
                  role="switch"
                  aria-checked={notifPrefs.email_weekly_summary}
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${notifPrefs.email_weekly_summary ? "bg-[#6C6CFF]" : "bg-[#3A3A3F]"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifPrefs.email_weekly_summary ? "translate-x-5" : "translate-x-0.5"} mt-0.5`} />
                </div>
              </label>
            </div>
          </div>

          {/* Reminder days before */}
          {notifPrefs.email_deadline_reminder && (
            <div>
              <label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">
                Kac gun once hatirlatilsin?
              </label>
              <select
                value={notifPrefs.reminder_days_before}
                onChange={e => setNotifPrefs(p => ({ ...p, reminder_days_before: parseInt(e.target.value) }))}
                className={inputCls + " w-32"}
              >
                {[1, 2, 3, 5, 7, 14].map(d => (
                  <option key={d} value={d}>{d} gun</option>
                ))}
              </select>
            </div>
          )}

          <button onClick={saveNotifPrefs} disabled={notifLoading} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors">
            {notifLoading ? "Kaydediliyor..." : "Tercihleri Kaydet"}
          </button>
        </div>
      )}

      {/* Firma */}
      {tab === "firma" && (
        <div className="max-w-lg">
          {!firm && !createFirmMode ? (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#6C6CFF]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={1.5}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <p className="text-[16px] text-[#ECECEE]">Henüz bir firmaya bağlı değilsiniz</p>
              <p className="text-[14px] text-[#5C5C5F]">Kendi hukuk büronuzu oluşturun veya mevcut bir büroya davet bekleyin.</p>
              <button onClick={() => setCreateFirmMode(true)} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg text-[15px] font-medium text-white transition-colors">
                Firma Oluştur
              </button>
            </div>
          ) : !firm && createFirmMode ? (
            <div className="bg-[#111113] border border-[#6C6CFF]/20 rounded-xl p-5 space-y-4">
              <h3 className="text-[15px] font-semibold text-[#6C6CFF]">Yeni Firma Oluştur</h3>
              <div>
                <label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Firma Adı *</label>
                <input type="text" value={firmForm.name} onChange={e => setFirmForm(p => ({ ...p, name: e.target.value }))} placeholder="Yıldırım & Partners" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Vergi No</label><input value={firmForm.tax_id} onChange={e => setFirmForm(p => ({ ...p, tax_id: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Telefon</label><input value={firmForm.phone} onChange={e => setFirmForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
              </div>
              <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">E-posta</label><input value={firmForm.email} onChange={e => setFirmForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Adres</label><textarea value={firmForm.address} onChange={e => setFirmForm(p => ({ ...p, address: e.target.value }))} rows={2} className={inputCls + " resize-none"} /></div>
              <div className="flex gap-2">
                <button onClick={createFirm} disabled={firmLoading || !firmForm.name} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors">{firmLoading ? "Oluşturuluyor..." : "Oluştur"}</button>
                <button onClick={() => setCreateFirmMode(false)} className="px-4 py-2 text-[15px] text-[#5C5C5F] hover:text-[#ECECEE]">İptal</button>
              </div>
            </div>
          ) : firm && (
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#ECECEE]">{firm.name}</h3>
                <span className="text-[13px] text-[#5C5C5F]">{members.length}/{firm.max_users} üye</span>
              </div>
              {isAdmin ? (
                <>
                  <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Firma Adı</label><input value={firmForm.name} onChange={e => setFirmForm(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Vergi No</label><input value={firmForm.tax_id} onChange={e => setFirmForm(p => ({ ...p, tax_id: e.target.value }))} className={inputCls} /></div>
                    <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">Telefon</label><input value={firmForm.phone} onChange={e => setFirmForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
                  </div>
                  <div><label className="block text-[14px] font-medium text-[#5C5C5F] mb-1">E-posta</label><input value={firmForm.email} onChange={e => setFirmForm(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
                  <button onClick={updateFirm} disabled={firmLoading} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors">{firmLoading ? "Kaydediliyor..." : "Kaydet"}</button>
                </>
              ) : (
                <div className="space-y-2 text-[15px]">
                  {firm.tax_id && <div className="flex"><span className="w-24 text-[#5C5C5F]">Vergi No</span><span className="text-[#ECECEE]">{firm.tax_id}</span></div>}
                  {firm.email && <div className="flex"><span className="w-24 text-[#5C5C5F]">E-posta</span><span className="text-[#ECECEE]">{firm.email}</span></div>}
                  {firm.phone && <div className="flex"><span className="w-24 text-[#5C5C5F]">Telefon</span><span className="text-[#ECECEE]">{firm.phone}</span></div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Üyeler */}
      {tab === "uyeler" && firm && (
        <div className="max-w-lg space-y-4">
          {isAdmin && (
            <div className="bg-[#111113] border border-[#6C6CFF]/20 rounded-xl p-4">
              <h3 className="text-[14px] font-semibold text-[#6C6CFF] mb-3">Üye Davet Et</h3>
              <div className="flex gap-2">
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="avukat@ornek.com" className={inputCls + " flex-1"} />
                <button onClick={inviteMember} disabled={inviteLoading || !inviteEmail} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:opacity-50 rounded-lg text-[15px] font-medium text-white transition-colors shrink-0">
                  {inviteLoading ? "..." : "Davet Et"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-medium text-[#ECECEE]">{m.full_name}</p>
                  <p className="text-[13px] text-[#5C5C5F]">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && m.id !== user?.id ? (
                    <>
                      <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} className="bg-[#16161A] border border-white/[0.06] rounded-lg px-2 py-1 text-[14px] text-[#ECECEE] focus:outline-none">
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button onClick={() => removeMember(m.id)} className="px-2 py-1 text-[13px] text-[#E5484D] hover:bg-[#E5484D]/10 rounded-md transition-colors">Çıkar</button>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 text-[12px] font-medium bg-[#6C6CFF]/10 text-[#6C6CFF] rounded">{ROLES.find(r => r.value === m.role)?.label || m.role}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
