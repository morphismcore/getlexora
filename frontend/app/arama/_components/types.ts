/* ─── Search Page Types ─── */

export interface CaseItem {
  id: string;
  title: string;
  court: string | null;
  status: string;
}

export interface IctihatResult {
  karar_id: string;
  mahkeme: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
  ozet: string;
  relevance_score?: number;
  kaynak?: string;
}

export interface FacetItem {
  value: string;
  count: number;
}

export interface SearchFacets {
  mahkeme?: FacetItem[];
  daire?: FacetItem[];
  yil?: FacetItem[];
}

export interface SearchResponse {
  sonuclar: IctihatResult[];
  toplam_bulunan: number;
  toplam_sayfa: number;
  sure_ms: number;
  facets?: SearchFacets;
}

export interface KararDetail {
  id: string;
  mahkeme: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
  tam_metin: string;
  html?: string;
  ozet: string;
}

export interface MevzuatResult {
  mevzuatNo: string;
  mevzuatAd: string;
  mevzuatTur: string;
  mevzuatTertip?: string;
  resmiGazeteTarihi?: string;
  resmiGazeteSayisi?: string;
  mevzuatId?: string;
}

export interface MevzuatSearchResponse {
  sonuclar: MevzuatResult[];
  toplam: number;
}

export interface MevzuatContent {
  mevzuat_id: string;
  content: string;
  html?: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  sources?: IctihatResult[];
  post_citation_check?: {
    verified: boolean;
    citations_found: number;
    unverified: string[];
    verified_count: number;
  };
  warnings?: string[];
  timestamp: Date;
}
