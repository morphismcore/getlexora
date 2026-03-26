export interface CitationReference {
  raw_text: string; citation_type: string; mahkeme: string | null;
  esas_no: string | null; karar_no: string | null; kanun_no: string | null; madde_no: string | null;
}

export interface CitationResult {
  reference: CitationReference;
  status: "verified" | "not_found" | "partial_match" | "unverified";
  found_match: string | null; suggestion: string | null; verification_ms: number;
}

export interface VerifyResponse {
  total_citations: number; verified: number; not_found: number;
  partial_match: number; details: CitationResult[]; overall_confidence: number;
}

export const EXAMPLE_TEXT =
  "Yargıtay 9. Hukuk Dairesi'nin 2024/1234 E., 2024/5678 K. sayılı kararında da belirtildiği üzere, 4857 sayılı İş Kanunu'nun 18. maddesi gereğince işverenin fesih bildirimini yazılı olarak yapması ve fesih sebebini açık ve kesin bir şekilde belirtmesi gerekmektedir. Ayrıca Yargıtay 22. Hukuk Dairesi'nin 2023/9876 E., 2023/4321 K. sayılı ilamında, işçinin savunmasının alınmadan gerçekleştirilen feshin geçersiz sayılacağı hükme bağlanmıştır. 6098 sayılı Türk Borçlar Kanunu'nun 49. maddesi uyarınca haksız fiil sorumluluğu da değerlendirilmelidir.";

export function getStatusConfig(status: CitationResult["status"]) {
  switch (status) {
    case "verified":
      return { label: "Doğrulandı", iconPath: "M20 6L9 17l-5-5",
        cardBorder: "border-[#3DD68C]/20", cardBg: "bg-[#3DD68C]/[0.03]", iconColor: "text-[#3DD68C]", badgeClass: "bg-[#3DD68C]/10 text-[#3DD68C]" };
    case "not_found":
      return { label: "Bulunamadı", iconPath: "M18 6L6 18M6 6l12 12",
        cardBorder: "border-[#E5484D]/20", cardBg: "bg-[#E5484D]/[0.03]", iconColor: "text-[#E5484D]", badgeClass: "bg-[#E5484D]/10 text-[#E5484D]" };
    case "partial_match":
      return { label: "Kısmi Eşleşme", iconPath: "M5 12h14",
        cardBorder: "border-[#FFB224]/20", cardBg: "bg-[#FFB224]/[0.03]", iconColor: "text-[#FFB224]", badgeClass: "bg-[#FFB224]/10 text-[#FFB224]" };
    case "unverified":
      return { label: "Doğrulanamadı", iconPath: "",
        cardBorder: "border-white/[0.06]", cardBg: "bg-white/[0.02]", iconColor: "text-[#8B8B8E]", badgeClass: "bg-white/[0.04] text-[#8B8B8E]" };
  }
}

export function getBarColor(score: number): string {
  if (score < 0.4) return "bg-[#E5484D]";
  if (score < 0.7) return "bg-[#FFB224]";
  return "bg-[#3DD68C]";
}

export function getBarTextColor(score: number): string {
  if (score < 0.4) return "text-[#E5484D]";
  if (score < 0.7) return "text-[#FFB224]";
  return "text-[#3DD68C]";
}
