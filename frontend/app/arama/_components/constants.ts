/* ─── Search Page Constants ─── */

/* ─── Court Styles ─── */
export interface CourtStyle {
  bg: string;
  text: string;
  label: string;
  color: string;
}

export const COURT_STYLES: Record<string, CourtStyle> = {
  yargitay:                  { bg: "bg-[#6C6CFF]/20", text: "text-[#6C6CFF]", label: "Yargıtay",  color: "#6C6CFF" },
  "Yargıtay":               { bg: "bg-[#6C6CFF]/20", text: "text-[#6C6CFF]", label: "Yargıtay",  color: "#6C6CFF" },
  danistay:                  { bg: "bg-[#A78BFA]/20", text: "text-[#A78BFA]", label: "Danıştay",  color: "#A78BFA" },
  "Danıştay":               { bg: "bg-[#A78BFA]/20", text: "text-[#A78BFA]", label: "Danıştay",  color: "#A78BFA" },
  aym:                       { bg: "bg-[#E5484D]/20", text: "text-[#E5484D]", label: "AYM",       color: "#E5484D" },
  "Anayasa Mahkemesi":       { bg: "bg-[#E5484D]/20", text: "text-[#E5484D]", label: "AYM",       color: "#E5484D" },
  aihm:                      { bg: "bg-[#3DD68C]/20", text: "text-[#3DD68C]", label: "AİHM",      color: "#3DD68C" },
  bam:                       { bg: "bg-[#FFB224]/20", text: "text-[#FFB224]", label: "BAM",       color: "#FFB224" },
  "Bölge Adliye Mahkemesi":  { bg: "bg-[#FFB224]/20", text: "text-[#FFB224]", label: "BAM",       color: "#FFB224" },
  rekabet:                   { bg: "bg-[#30A46C]/20", text: "text-[#30A46C]", label: "Rekabet",   color: "#30A46C" },
  "Rekabet":                 { bg: "bg-[#30A46C]/20", text: "text-[#30A46C]", label: "Rekabet",   color: "#30A46C" },
  kvkk:                      { bg: "bg-[#F76B15]/20", text: "text-[#F76B15]", label: "KVKK",      color: "#F76B15" },
  "KVKK":                    { bg: "bg-[#F76B15]/20", text: "text-[#F76B15]", label: "KVKK",      color: "#F76B15" },
};

export const DEFAULT_COURT_STYLE: CourtStyle = {
  bg: "bg-white/[0.06]",
  text: "text-[#8B8B8E]",
  label: "",
  color: "#8B8B8E",
};

export function getCourtStyle(mahkeme: string): CourtStyle {
  if (!mahkeme) return DEFAULT_COURT_STYLE;
  const style = COURT_STYLES[mahkeme];
  if (style) return style;
  if (mahkeme.includes("Bölge")) return COURT_STYLES.bam;
  return DEFAULT_COURT_STYLE;
}

/* ─── Mahkeme value mapping (display name -> API key) ─── */
export const MAHKEME_VALUE_MAP: Record<string, string> = {
  "Yargıtay": "yargitay",
  "Danıştay": "danistay",
  "Anayasa Mahkemesi": "aym",
  "Bölge Adliye Mahkemesi": "bam",
  "AYM": "aym",
  "AİHM": "aihm",
  "Rekabet": "rekabet",
  "KVKK": "kvkk",
};

/* ─── Filter option lists ─── */
export const MAHKEMELER = [
  "Tümü", "Yargıtay", "Danıştay", "Anayasa Mahkemesi", "Bölge Adliye Mahkemesi",
  "İcra Mahkemesi", "Aile Mahkemesi", "Ceza Mahkemesi", "İdare Mahkemesi", "Tüketici Mahkemesi",
] as const;

export const DAIRELER = [
  "Tümü",
  "1. Hukuk Dairesi", "2. Hukuk Dairesi", "3. Hukuk Dairesi", "4. Hukuk Dairesi",
  "5. Hukuk Dairesi", "6. Hukuk Dairesi", "7. Hukuk Dairesi", "8. Hukuk Dairesi",
  "9. Hukuk Dairesi", "10. Hukuk Dairesi", "11. Hukuk Dairesi", "12. Hukuk Dairesi",
  "13. Hukuk Dairesi", "14. Hukuk Dairesi", "15. Hukuk Dairesi", "16. Hukuk Dairesi",
  "17. Hukuk Dairesi",
  "1. Ceza Dairesi", "2. Ceza Dairesi", "3. Ceza Dairesi", "4. Ceza Dairesi",
  "5. Ceza Dairesi", "6. Ceza Dairesi", "7. Ceza Dairesi", "8. Ceza Dairesi",
  "9. Ceza Dairesi", "10. Ceza Dairesi", "11. Ceza Dairesi", "12. Ceza Dairesi",
  "13. Ceza Dairesi", "14. Ceza Dairesi", "15. Ceza Dairesi", "16. Ceza Dairesi",
  "Hukuk Genel Kurulu", "Ceza Genel Kurulu",
  "1. İdari Dava Dairesi", "2. İdari Dava Dairesi", "3. İdari Dava Dairesi",
  "4. İdari Dava Dairesi", "5. İdari Dava Dairesi", "6. İdari Dava Dairesi",
  "7. İdari Dava Dairesi", "8. İdari Dava Dairesi", "9. İdari Dava Dairesi",
  "10. İdari Dava Dairesi",
  "1. Vergi Dava Dairesi", "2. Vergi Dava Dairesi", "3. Vergi Dava Dairesi",
  "4. Vergi Dava Dairesi",
  "İdari Dava Daireleri Kurulu", "Vergi Dava Daireleri Kurulu",
] as const;

export const KAYNAKLAR = ["Tümü", "Bedesten", "AYM", "AİHM"] as const;

/* ─── Source filter bar tabs (shown above results) ─── */
export const SOURCE_TABS = [
  { key: "Tümü",     mahkemeValue: "", label: "Tümü" },
  { key: "Yargıtay", mahkemeValue: "Yargıtay", label: "Yargıtay" },
  { key: "Danıştay", mahkemeValue: "Danıştay", label: "Danıştay" },
  { key: "AYM",      mahkemeValue: "AYM", label: "AYM" },
  { key: "AİHM",     mahkemeValue: "AİHM", label: "AİHM" },
  { key: "Rekabet",  mahkemeValue: "Rekabet", label: "Rekabet" },
  { key: "KVKK",     mahkemeValue: "KVKK", label: "KVKK" },
] as const;

export const SIRALAMALAR = ["Alaka düzeyi", "Tarih (yeni→eski)", "Tarih (eski→yeni)"] as const;

/* ─── Suggested / typewriter queries ─── */
export const SUGGESTED_QUERIES = [
  "İşe iade davası",
  "Kıdem tazminatı",
  "Boşanma nafaka",
  "Kamulaştırma bedeli",
  "Haksız fesih",
  "İş kazası tazminat",
  "Kira tespit",
  "Miras paylaşımı",
] as const;

export const TYPEWRITER_QUERIES = [
  "işe iade savunma alınmadan fesih",
  "kıdem tazminatı hesaplama yöntemi",
  "boşanma nafaka miktarı belirleme",
  "kamulaştırma bedel tespiti",
  "iş kazası tazminat hesaplama",
  "kira tespit davası emsal",
  "miras paylaşımı saklı pay",
  "haksız tahrik indirim oranı",
  "ticari kredi faiz uygulaması",
  "idari para cezası iptal",
] as const;

/* ─── Main tab definitions ─── */
export const TABS = [
  { key: "ictihat", label: "İçtihat Arama", enabled: true },
  { key: "mevzuat", label: "Mevzuat", enabled: true },
  { key: "ai", label: "AI Asistan", enabled: true },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/* ─── Status labels ─── */
export const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  closed: "Kapalı",
  pending: "Beklemede",
  archived: "Arşiv",
};
