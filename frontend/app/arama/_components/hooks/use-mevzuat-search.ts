"use client";

import { useState, useCallback, useRef } from "react";
import type {
  MevzuatResult,
  MevzuatSearchResponse,
  MevzuatContent,
} from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useMevzuatSearch() {
  /* ─── State ─── */
  const [mevzuatResults, setMevzuatResults] = useState<MevzuatSearchResponse | null>(null);
  const [selectedMevzuat, setSelectedMevzuat] = useState<MevzuatResult | null>(null);
  const [mevzuatContent, setMevzuatContent] = useState<MevzuatContent | null>(null);
  const [mevzuatLoading, setMevzuatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kanunNo, setKanunNo] = useState("");
  const [mevzuatSearchText, setMevzuatSearchText] = useState("");
  const lastMevzuatRequestRef = useRef<string | null>(null);

  /* ─── Mevzuat Search Handler ─── */
  const searchMevzuat = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setMevzuatResults(null);
    setSelectedMevzuat(null);
    setMevzuatContent(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...(kanunNo && { kanun_no: kanunNo }),
        }),
      });
      if (!res.ok) throw new Error("Mevzuat araması başarısız");
      const data = await res.json();
      setMevzuatResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [kanunNo]);

  /* ─── Mevzuat Content Loader ─── */
  const selectMevzuat = useCallback(async (m: MevzuatResult) => {
    const requestId = m.mevzuatId || m.mevzuatNo || "";
    lastMevzuatRequestRef.current = requestId;

    setSelectedMevzuat(m);
    if (!m.mevzuatId && !m.mevzuatNo) return;
    setMevzuatLoading(true);
    // DON'T clear mevzuatContent yet -- keep showing previous while loading

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const id = m.mevzuatId || m.mevzuatNo;
      const res = await fetch(`${API_URL}/api/v1/search/mevzuat/${id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Race condition guard
      if (lastMevzuatRequestRef.current !== requestId) return;

      if (res.ok) {
        const data = await res.json();
        setMevzuatContent(data);
      } else {
        setMevzuatContent(null);
      }
    } catch {
      if (lastMevzuatRequestRef.current !== requestId) return;
      setMevzuatContent(null);
    } finally {
      if (lastMevzuatRequestRef.current === requestId) {
        setMevzuatLoading(false);
      }
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMevzuat(null);
    setMevzuatContent(null);
  }, []);

  return {
    // State
    mevzuatResults,
    selectedMevzuat,
    mevzuatContent,
    mevzuatLoading,
    loading,
    error,
    kanunNo,
    setKanunNo,
    mevzuatSearchText,
    setMevzuatSearchText,

    // Actions
    searchMevzuat,
    selectMevzuat,
    clearSelection,
  };
}
