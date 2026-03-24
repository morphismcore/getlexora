"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Case {
  id: string;
  title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
  opponent: string | null;
  assigned_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deadlines?: Deadline[];
  documents?: CaseDoc[];
  saved_searches?: SavedSearch[];
}

interface Deadline {
  id: string;
  title: string;
  deadline_date: string;
  deadline_type: string;
  is_completed: boolean;
}

interface CaseDoc {
  id: string;
  file_name: string;
  file_type: string;
  document_type: string;
  uploaded_at: string;
}

interface SavedSearch {
  id: string;
  query: string;
  search_type: string;
  result_count: number;
  created_at: string;
}

const CASE_TYPES: Record<string, string> = {
  is_hukuku: "İş Hukuku",
  ceza: "Ceza",
  ticaret: "Ticaret",
  idare: "İdare",
  aile: "Aile",
};

const STATUS_COLORS: Record<string, string> = {
  aktif: "bg-[#3DD68C]/10 text-[#3DD68C]",
  beklemede: "bg-[#FFB224]/10 text-[#FFB224]",
  kapandi: "bg-[#5C5C5F]/10 text-[#5C5C5F]",
};

export default function DavalarPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [token, setToken] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Auth token from localStorage
  useEffect(() => {
    const t = localStorage.getItem("lexora_token");
    setToken(t);
    if (t) fetchCases(t);
    else setLoading(false);
  }, []);

  const fetchCases = useCallback(async (authToken: string) => {
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/cases`, {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 401) {
        localStorage.removeItem("lexora_token");
        setToken(null);
        setError("Lütfen giriş yapın");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Hata: ${res.status}`);
      const data = await res.json();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(err instanceof Error ? err.message : "Davalar yüklenemedi");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCaseDetail = useCallback(async (caseId: string) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Detay yüklenemedi");
      const data = await res.json();
      setSelectedCase(data);
    } catch {
      // Keep existing selection
    } finally {
      setDetailLoading(false);
    }
  }, [token]);

  const handleCreateCase = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || createLoading) return;
    setCreateLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.get("title"),
          case_type: form.get("case_type"),
          court: form.get("court") || null,
          case_number: form.get("case_number") || null,
          opponent: form.get("opponent") || null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) throw new Error("Dava oluşturulamadı");
      setShowCreateForm(false);
      setToast("Dava dosyası oluşturuldu");
      fetchCases(token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setCreateLoading(false);
    }
  }, [token, fetchCases, createLoading]);

  const handleDeleteCase = useCallback(async () => {
    if (!token || !selectedCase) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cases/${selectedCase.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Dava silinemedi");
      setShowDeleteConfirm(false);
      setSelectedCase(null);
      fetchCases(token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setDeleting(false);
    }
  }, [token, selectedCase, fetchCases]);

  const filteredCases = statusFilter === "all" ? cases : cases.filter((c) => c.status === statusFilter);

  const inputCls = "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors";

  // Not logged in
  if (!token && !loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#6C6CFF]/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </div>
          <h2 className="text-[15px] font-semibold text-[#ECECEE]">Dava Dosyaları</h2>
          <p className="text-[13px] text-[#5C5C5F]">Davalarınızı yönetmek için giriş yapmanız gerekiyor.</p>
          <a href="/api/v1/auth/login" className="inline-block px-4 py-2 bg-[#6C6CFF] rounded-lg text-white text-[13px] font-medium hover:bg-[#5B5BEE] transition-colors">
            Giriş Yap
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-[#3DD68C]/20 border border-[#3DD68C]/30 text-[#3DD68C] text-[13px] rounded-lg animate-fade-in">
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#09090B] px-4 md:px-5 pt-14 md:pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Dava Dosyalari</h1>
            <p className="text-[12px] text-[#5C5C5F] mt-0.5">
              {cases.length} dava dosyası
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg text-[12px] font-medium text-white transition-colors"
          >
            + Yeni Dava
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 mt-3">
          {[
            { value: "all", label: "Tümü" },
            { value: "aktif", label: "Aktif" },
            { value: "beklemede", label: "Beklemede" },
            { value: "kapandi", label: "Kapandı" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                statusFilter === f.value
                  ? "bg-[#6C6CFF]/20 text-[#6C6CFF]"
                  : "text-[#5C5C5F] hover:text-[#8B8B8E]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Case list */}
        <div className={`overflow-y-auto border-r border-white/[0.06] ${selectedCase ? "w-1/2 hidden md:block" : "w-full"}`}>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-[#1A1A1F] rounded w-3/4 mb-2" />
                  <div className="h-3 bg-[#1A1A1F] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-[#E5484D] text-sm">{error}</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-[#111113] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5C5C5F" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <p className="text-[13px] text-[#5C5C5F]">Henüz dava dosyanız yok.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-[12px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
              >
                İlk davanızı oluşturun
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredCases.map((c) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => fetchCaseDetail(c.id)}
                  className={`w-full text-left bg-[#111113] border rounded-xl p-3.5 transition-all duration-150 ${
                    selectedCase?.id === c.id
                      ? "border-[#6C6CFF]/30 bg-[#6C6CFF]/[0.04]"
                      : "border-white/[0.06] hover:border-white/[0.10]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${STATUS_COLORS[c.status] || "bg-[#5C5C5F]/10 text-[#5C5C5F]"}`}>
                      {c.status === "aktif" ? "Aktif" : c.status === "beklemede" ? "Beklemede" : "Kapandı"}
                    </span>
                    <span className="text-[10px] text-[#5C5C5F]">{CASE_TYPES[c.case_type] || c.case_type}</span>
                  </div>
                  <h3 className="text-[13px] font-medium text-[#ECECEE] line-clamp-1">{c.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#5C5C5F]">
                    {c.court && <span>{c.court}</span>}
                    {c.case_number && <span>E. {c.case_number}</span>}
                    {c.opponent && <span>vs. {c.opponent}</span>}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Case detail */}
        {selectedCase && (
          <div className="w-full md:w-1/2 overflow-y-auto p-4 space-y-4 relative">
            {detailLoading && (
              <div className="absolute inset-0 bg-[#09090B]/60 z-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#ECECEE]">{selectedCase.title}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowDeleteConfirm(true)} className="px-2.5 py-1 text-[12px] font-medium text-[#E5484D] hover:bg-[#E5484D]/10 rounded-md transition-colors">Sil</button>
                <button onClick={() => setSelectedCase(null)} className="text-[12px] text-[#5C5C5F] hover:text-[#ECECEE]">Kapat</button>
              </div>
            </div>

            {/* Case info */}
            <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 space-y-2 text-[13px]">
              <div className="flex"><span className="w-28 text-[#5C5C5F]">Mahkeme</span><span className="text-[#ECECEE]">{selectedCase.court || "—"}</span></div>
              <div className="flex"><span className="w-28 text-[#5C5C5F]">Esas No</span><span className="text-[#ECECEE]">{selectedCase.case_number || "—"}</span></div>
              <div className="flex"><span className="w-28 text-[#5C5C5F]">Karşı Taraf</span><span className="text-[#ECECEE]">{selectedCase.opponent || "—"}</span></div>
              <div className="flex"><span className="w-28 text-[#5C5C5F]">Tür</span><span className="text-[#ECECEE]">{CASE_TYPES[selectedCase.case_type] || selectedCase.case_type}</span></div>
              <div className="flex"><span className="w-28 text-[#5C5C5F]">Atanan</span><span className="text-[#ECECEE]">{selectedCase.assigned_to || "—"}</span></div>
              {selectedCase.notes && (
                <div className="pt-2 border-t border-white/[0.04]">
                  <p className="text-[12px] text-[#8B8B8E]">{selectedCase.notes}</p>
                </div>
              )}
            </div>

            {/* Deadlines */}
            {selectedCase.deadlines && selectedCase.deadlines.length > 0 && (
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-2">Süreler ({selectedCase.deadlines.length})</h3>
                <div className="space-y-1.5">
                  {selectedCase.deadlines.map((dl) => (
                    <div key={dl.id} className={`bg-[#111113] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between ${dl.is_completed ? "opacity-50" : ""}`}>
                      <div>
                        <p className="text-[13px] text-[#ECECEE]">{dl.title}</p>
                        <p className="text-[11px] text-[#5C5C5F]">{dl.deadline_date}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${dl.is_completed ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#FFB224]/10 text-[#FFB224]"}`}>
                        {dl.is_completed ? "Tamamlandı" : "Bekliyor"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved searches */}
            {selectedCase.saved_searches && selectedCase.saved_searches.length > 0 && (
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-2">Kayıtlı Aramalar ({selectedCase.saved_searches.length})</h3>
                <div className="space-y-1.5">
                  {selectedCase.saved_searches.map((ss) => (
                    <div key={ss.id} className="bg-[#111113] border border-white/[0.06] rounded-lg p-3">
                      <p className="text-[13px] text-[#ECECEE]">{ss.query}</p>
                      <p className="text-[11px] text-[#5C5C5F]">{ss.result_count} sonuç — {ss.search_type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {selectedCase.documents && selectedCase.documents.length > 0 && (
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-2">Belgeler ({selectedCase.documents.length})</h3>
                <div className="space-y-1.5">
                  {selectedCase.documents.map((doc) => (
                    <div key={doc.id} className="bg-[#111113] border border-white/[0.06] rounded-lg p-3 flex items-center gap-3">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[#6C6CFF]/10 text-[#6C6CFF] rounded">{doc.file_type.toUpperCase()}</span>
                      <div>
                        <p className="text-[13px] text-[#ECECEE]">{doc.file_name}</p>
                        <p className="text-[11px] text-[#5C5C5F]">{doc.document_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-[#E5484D]/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth={1.5}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>
              </div>
              <div className="text-center">
                <h2 className="text-[15px] font-semibold text-[#ECECEE]">Dava Dosyasını Kapat</h2>
                <p className="text-[13px] text-[#5C5C5F] mt-2">Bu dava dosyası kapatılacak. Emin misiniz?</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteCase}
                  disabled={deleting}
                  className="flex-1 py-2 bg-[#E5484D] hover:bg-[#D13438] rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
                >
                  {deleting ? "Kapatılıyor..." : "Dosyayı Kapat"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                >
                  İptal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create case modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Dava Dosyası</h2>
              <form onSubmit={handleCreateCase} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Dava Başlığı *</label>
                  <input name="title" required placeholder="Ahmet Yılmaz vs XYZ A.Ş." className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Dava Türü *</label>
                  <select name="case_type" required className={inputCls + " cursor-pointer"}>
                    <option value="is_hukuku">İş Hukuku</option>
                    <option value="ceza">Ceza</option>
                    <option value="ticaret">Ticaret</option>
                    <option value="idare">İdare</option>
                    <option value="aile">Aile</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Mahkeme</label>
                    <input name="court" placeholder="İstanbul 3. İş Mahkemesi" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Esas Numarası</label>
                    <input name="case_number" placeholder="2026/1234" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Karşı Taraf</label>
                  <input name="opponent" placeholder="Şirket / Kişi adı" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">Notlar</label>
                  <textarea name="notes" rows={2} placeholder="Ek bilgiler..." className={inputCls + " resize-none"} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={createLoading} className="flex-1 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#6C6CFF]/50 disabled:cursor-not-allowed rounded-lg text-[13px] font-medium text-white transition-colors flex items-center justify-center gap-2">
                    {createLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {createLoading ? "Oluşturuluyor..." : "Oluştur"}
                  </button>
                  <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">
                    İptal
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
