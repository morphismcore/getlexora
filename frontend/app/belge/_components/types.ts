export interface Citation { raw_text: string; pattern_type: string; }
export interface Parties { davaci: string | null; davali: string | null; davaci_vekili: string | null; davali_vekili: string | null; }
export interface CaseInfo { mahkeme: string | null; esas_no: string | null; karar_no: string | null; tarih: string | null; }
export interface DocMetadata { title: string; author: string; subject: string; }
export interface AnalyzeResult {
  file_name: string; file_type: string; pages: number | null; paragraphs: number | null;
  document_type: string; parties: Parties; case_info: CaseInfo;
  citations: Citation[]; metadata: DocMetadata; text: string; text_length: number;
}

export interface UploadHistoryItem {
  file_name: string; file_type: string; document_type: string;
  text_length: number; citations_count: number; timestamp: string;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  dilekce: "Dilekçe", karar: "Karar", bilirkisi_raporu: "Bilirkişi Raporu",
  sozlesme: "Sözleşme", ihtarname: "İhtarname", diger: "Diğer",
};
export const DOC_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  dilekce: { bg: "bg-[#6C6CFF]/10", text: "text-[#6C6CFF]", border: "border-[#6C6CFF]/20" },
  karar: { bg: "bg-[#A78BFA]/10", text: "text-[#A78BFA]", border: "border-[#A78BFA]/20" },
  bilirkisi_raporu: { bg: "bg-[#FFB224]/10", text: "text-[#FFB224]", border: "border-[#FFB224]/20" },
  sozlesme: { bg: "bg-[#3DD68C]/10", text: "text-[#3DD68C]", border: "border-[#3DD68C]/20" },
  ihtarname: { bg: "bg-[#E5484D]/10", text: "text-[#E5484D]", border: "border-[#E5484D]/20" },
  diger: { bg: "bg-white/[0.06]", text: "text-[#8B8B8E]", border: "border-white/[0.06]" },
};
export const PATTERN_LABELS: Record<string, string> = {
  yargitay: "Yargıtay", danistay: "Danıştay", aym_norm: "AYM Norm",
  aym_bireysel: "AYM Bireysel", kanun_sayili: "Kanun", kanun_madde: "Kanun Madde",
};
export const PATTERN_COLORS: Record<string, string> = {
  yargitay: "text-[#6C6CFF] bg-[#6C6CFF]/10", danistay: "text-[#A78BFA] bg-[#A78BFA]/10",
  aym_norm: "text-[#E5484D] bg-[#E5484D]/10", aym_bireysel: "text-[#E5484D] bg-[#E5484D]/10",
  kanun_sayili: "text-[#3DD68C] bg-[#3DD68C]/10", kanun_madde: "text-[#3DD68C] bg-[#3DD68C]/10",
};
export const FORMAT_ICONS: Record<string, { color: string; label: string }> = {
  pdf: { color: "#E5484D", label: "PDF" },
  docx: { color: "#6C6CFF", label: "DOCX" },
  txt: { color: "#3DD68C", label: "TXT" },
};

export function getDocTypeStyle(dt: string) {
  return DOC_TYPE_COLORS[dt] || DOC_TYPE_COLORS.diger;
}

export function detectRisks(result: AnalyzeResult): { label: string; level: "warning" | "info" }[] {
  const risks: { label: string; level: "warning" | "info" }[] = [];
  if (!result.parties.davaci && !result.parties.davali) risks.push({ label: "Taraf bilgisi bulunamadı", level: "warning" });
  if (!result.case_info.esas_no && !result.case_info.karar_no) risks.push({ label: "Esas/Karar numarası tespit edilemedi", level: "info" });
  if (result.citations.length === 0) risks.push({ label: "Hukuki atıf/referans bulunamadı", level: "info" });
  if (result.text_length < 500) risks.push({ label: "Belge metni çok kısa", level: "warning" });
  return risks;
}
