"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  IctihatResult,
  SearchResponse,
  KararDetail,
} from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MAHKEME_VALUE_MAP: Record<string, string> = {
  "Yargıtay": "yargitay",
  "Danıştay": "danistay",
  "Anayasa Mahkemesi": "aym",
  "Bölge Adliye Mahkemesi": "bam",
  "AYM": "aym",
  "AİHM": "aihm",
  "Rekabet": "rekabet",
  "KVKK": "kvkk",
};

function parseDaireValue(label: string): string | null {
  const m = label.match(/^(\d+)\./);
  return m ? m[1] : null;
}

export function useIctihatSearch() {
  /* ─── State ─── */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /* ─── Filters ─── */
  const [mahkeme, setMahkeme] = useState("Tümü");
  const [daire, setDaire] = useState("Tümü");
  const [tarihBaslangic, setTarihBaslangic] = useState("");
  const [tarihBitis, setTarihBitis] = useState("");
  const [kaynak, setKaynak] = useState("Tümü");
  const [siralama, setSiralama] = useState("Alaka düzeyi");

  /* ─── Selected result + detail ─── */
  const [selectedResult, setSelectedResult] = useState<IctihatResult | null>(null);
  const [kararDetail, setKararDetail] = useState<KararDetail | null>(null);
  const [kararCache, setKararCache] = useState<Record<string, KararDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const lastKararRequestRef = useRef<string | null>(null);

  /* ─── Related ─── */
  const [relatedResults, setRelatedResults] = useState<IctihatResult[]>([]);
  const relatedCacheRef = useRef<Record<string, IctihatResult[]>>({});

  /* ─── Search History ─── */
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load search history on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_search_history");
      if (saved) try { setSearchHistory(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Fetch related decisions when a karar detail is loaded
  useEffect(() => {
    if (!kararDetail) { setRelatedResults([]); return; }
    const kararId = kararDetail.id;
    // Check cache first
    if (relatedCacheRef.current[kararId]) {
      setRelatedResults(relatedCacheRef.current[kararId]);
      return;
    }
    const ozetText = kararDetail.ozet || kararDetail.tam_metin?.slice(0, 500) || "";
    if (!ozetText) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/search/related`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karar_id: kararId, ozet: ozetText, limit: 5 }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setRelatedResults(data);
        relatedCacheRef.current[kararId] = data;
      })
      .catch(() => { /* silently ignore */ });
    return () => { cancelled = true; };
  }, [kararDetail]);

  /* ─── Actions ─── */

  const search = useCallback(async () => {
    if (!query.trim() || loading) return;
    if (query.trim().length < 3) {
      setError("Arama sorgusu en az 3 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedResult(null);
    setKararDetail(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/ictihat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          max_sonuc: 20,
          sayfa: currentPage,
          ...(mahkeme !== "Tümü" && MAHKEME_VALUE_MAP[mahkeme] && { mahkeme: [MAHKEME_VALUE_MAP[mahkeme]] }),
          ...(daire !== "Tümü" && parseDaireValue(daire) && { daire: parseDaireValue(daire) }),
          ...(tarihBaslangic && { tarih_baslangic: tarihBaslangic }),
          ...(tarihBitis && { tarih_bitis: tarihBitis }),
          ...(kaynak !== "Tümü" && { kaynak: kaynak.toLowerCase() }),
          ...(siralama !== "Alaka düzeyi" && { siralama: siralama === "Tarih (yeni→eski)" ? "tarih_desc" : "tarih_asc" }),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 422) throw new Error("Arama sorgusu geçersiz. En az 3 karakter giriniz.");
        throw new Error("Arama başarısız oldu. Lütfen tekrar deneyin.");
      }
      const data: SearchResponse = await res.json();
      setResults(data);

      const q = query.trim();
      setSearchHistory((prev) => {
        const updated = [q, ...prev.filter((h) => h !== q)].slice(0, 20);
        localStorage.setItem("lexora_search_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        setError("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.");
      } else {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
      }
    } finally {
      setLoading(false);
    }
  }, [query, mahkeme, daire, tarihBaslangic, tarihBitis, kaynak, siralama, currentPage, loading]);

  const selectResult = useCallback(async (result: IctihatResult) => {
    const requestId = result.karar_id;
    lastKararRequestRef.current = requestId;

    setSelectedResult(result);
    setRelatedResults([]);

    // Check cache first
    if (kararCache[result.karar_id]) {
      setKararDetail(kararCache[result.karar_id]);
      return;
    }

    setDetailLoading(true);
    // DON'T clear kararDetail yet -- keep showing previous while loading

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_URL}/api/v1/search/karar/${result.karar_id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Race condition guard: check if this is still the current request
      if (lastKararRequestRef.current !== requestId) return;

      if (!res.ok) throw new Error("Karar yüklenemedi");
      const raw = await res.json();

      const detail: KararDetail = {
        id: raw.document_id || result.karar_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || (raw.content || "").slice(0, 500),
        tam_metin: raw.content || "",
      };
      setKararDetail(detail);
      setKararCache(prev => ({ ...prev, [result.karar_id]: detail }));
    } catch (err) {
      // Race condition guard
      if (lastKararRequestRef.current !== requestId) return;

      // On error: show what we have (ozet from search results) instead of nothing
      setKararDetail({
        id: result.karar_id,
        mahkeme: result.mahkeme,
        daire: result.daire,
        esas_no: result.esas_no,
        karar_no: result.karar_no,
        tarih: result.tarih,
        ozet: result.ozet || "",
        tam_metin: "",  // Empty but we still show ozet
      });
    } finally {
      if (lastKararRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [kararCache]);

  const clearSelection = useCallback(() => {
    setSelectedResult(null);
    setKararDetail(null);
    setRelatedResults([]);
  }, []);

  const resetFilters = useCallback(() => {
    setMahkeme("Tümü");
    setDaire("Tümü");
    setTarihBaslangic("");
    setTarihBitis("");
    setKaynak("Tümü");
    setSiralama("Alaka düzeyi");
  }, []);

  return {
    // State
    query,
    setQuery,
    results,
    loading,
    error,
    setError,
    currentPage,
    setCurrentPage,

    // Filters
    mahkeme,
    setMahkeme,
    daire,
    setDaire,
    tarihBaslangic,
    setTarihBaslangic,
    tarihBitis,
    setTarihBitis,
    kaynak,
    setKaynak,
    siralama,
    setSiralama,

    // Selected result + detail
    selectedResult,
    kararDetail,
    detailLoading,

    // Related
    relatedResults,

    // Search history
    searchHistory,

    // Actions
    search,
    selectResult,
    clearSelection,
    resetFilters,
  };
}
