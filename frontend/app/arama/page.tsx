"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SearchHeader } from "./_components/search-header";
import { IctihatTab } from "./_components/ictihat-tab";
import { MevzuatTab } from "./_components/mevzuat-tab";
import { AiTab } from "./_components/ai-tab";
import { useIctihatSearch } from "./_components/hooks/use-ictihat-search";
import { useMevzuatSearch } from "./_components/hooks/use-mevzuat-search";
import { useAIChat } from "./_components/hooks/use-ai-chat";
import type { TabKey } from "./_components/constants";

export default function AramaPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ictihat");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const ictihat = useIctihatSearch();
  const mevzuat = useMevzuatSearch();
  const ai = useAIChat();

  /* Shared query: each tab owns its query, header shows the active one */
  const query =
    activeTab === "ictihat"
      ? ictihat.query
      : activeTab === "mevzuat"
        ? mevzuat.kanunNo
          ? ictihat.query
          : ictihat.query
        : ai.aiInput;

  const setQuery = useCallback(
    (q: string) => {
      if (activeTab === "ictihat") ictihat.setQuery(q);
      else if (activeTab === "ai") ai.setAiInput(q);
      else ictihat.setQuery(q); // mevzuat uses shared search bar
    },
    [activeTab, ictihat, ai],
  );

  /* Unified search trigger */
  const handleSearch = useCallback(() => {
    if (activeTab === "ictihat") {
      ictihat.search();
    } else if (activeTab === "mevzuat") {
      mevzuat.searchMevzuat(ictihat.query);
    } else if (activeTab === "ai") {
      ai.ask(ai.aiInput);
    }
  }, [activeTab, ictihat, mevzuat, ai]);

  /* Auto re-search on page change */
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (ictihat.query.trim() && activeTab === "ictihat") {
      ictihat.search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ictihat.currentPage]);

  /* Auto re-search on facet filter change */
  const facetInit = useRef(true);
  useEffect(() => {
    if (facetInit.current) {
      facetInit.current = false;
      return;
    }
    if (ictihat.query.trim() && ictihat.results && activeTab === "ictihat") {
      ictihat.search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ictihat.mahkeme, ictihat.daire, ictihat.kaynak]);

  /* Load search history on mount */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_search_history");
      if (saved) {
        try {
          setSearchHistory(JSON.parse(saved));
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const loading =
    activeTab === "ictihat"
      ? ictihat.loading
      : activeTab === "mevzuat"
        ? mevzuat.loading
        : ai.aiStreaming;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SearchHeader
        query={query}
        setQuery={setQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSearch={handleSearch}
        loading={loading}
        ictihatResults={ictihat.results}
        mevzuatResults={mevzuat.mevzuatResults}
        mahkeme={ictihat.mahkeme}
        setMahkeme={ictihat.setMahkeme}
        daire={ictihat.daire}
        setDaire={ictihat.setDaire}
        tarihBaslangic={ictihat.tarihBaslangic}
        setTarihBaslangic={ictihat.setTarihBaslangic}
        tarihBitis={ictihat.tarihBitis}
        setTarihBitis={ictihat.setTarihBitis}
        kaynak={ictihat.kaynak}
        setKaynak={ictihat.setKaynak}
        siralama={ictihat.siralama}
        setSiralama={ictihat.setSiralama}
        esasNo={ictihat.esasNo}
        setEsasNo={ictihat.setEsasNo}
        kararNo={ictihat.kararNo}
        setKararNo={ictihat.setKararNo}
        resetFilters={ictihat.resetFilters}
        setCurrentPage={ictihat.setCurrentPage}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        kanunNo={mevzuat.kanunNo}
        setKanunNo={mevzuat.setKanunNo}
        llmStatus={ai.llmStatus}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === "ictihat" && (
          <IctihatTab
            query={ictihat.query}
            setQuery={ictihat.setQuery}
            results={ictihat.results}
            loading={ictihat.loading}
            error={ictihat.error}
            setError={ictihat.setError}
            currentPage={ictihat.currentPage}
            setCurrentPage={ictihat.setCurrentPage}
            mahkeme={ictihat.mahkeme}
            setMahkeme={ictihat.setMahkeme}
            daire={ictihat.daire}
            setDaire={ictihat.setDaire}
            selectedResult={ictihat.selectedResult}
            kararDetail={ictihat.kararDetail}
            detailLoading={ictihat.detailLoading}
            relatedResults={ictihat.relatedResults}
            search={ictihat.search}
            selectResult={ictihat.selectResult}
            clearSelection={ictihat.clearSelection}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "mevzuat" && (
          <MevzuatTab
            mevzuatResults={mevzuat.mevzuatResults}
            selectedMevzuat={mevzuat.selectedMevzuat}
            mevzuatContent={mevzuat.mevzuatContent}
            mevzuatLoading={mevzuat.mevzuatLoading}
            loading={mevzuat.loading}
            error={mevzuat.error}
            mevzuatSearchText={mevzuat.mevzuatSearchText}
            setMevzuatSearchText={mevzuat.setMevzuatSearchText}
            searchMevzuat={mevzuat.searchMevzuat}
            selectMevzuat={mevzuat.selectMevzuat}
            clearSelection={mevzuat.clearSelection}
          />
        )}
        {activeTab === "ai" && (
          <AiTab
            aiMessages={ai.aiMessages}
            aiStreaming={ai.aiStreaming}
            aiInput={ai.aiInput}
            setAiInput={ai.setAiInput}
            llmStatus={ai.llmStatus}
            aiChatRef={ai.aiChatRef}
            aiInputRef={ai.aiInputRef}
            ask={ai.ask}
            setActiveTab={setActiveTab}
            clearMessages={ai.clearChat}
          />
        )}
      </div>
    </div>
  );
}
