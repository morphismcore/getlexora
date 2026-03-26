/* ------------------------------------------------------------------ */
/*  Shared utility functions                                            */
/* ------------------------------------------------------------------ */

export const TR_MONTHS = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
export const TR_MONTHS_SHORT = ["Oca","Sub","Mar","Nis","May","Haz","Tem","Agu","Eyl","Eki","Kas","Ara"];
export const TR_DAYS = ["Pazar","Pazartesi","Sali","Carsamba","Persembe","Cuma","Cumartesi"];
export const TR_DAYS_SHORT = ["Paz","Pzt","Sal","Car","Per","Cum","Cmt"];

export function timeAgo(iso: string) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return "Az once";
  if (d < 60) return `${d} dk once`;
  const h = Math.floor(d / 60);
  if (h < 24) return `${h} saat once`;
  const days = Math.floor(h / 24);
  return days === 1 ? "Dun" : `${days} gun once`;
}

export function formatTurkishDate(date: Date): string {
  return `${date.getDate()} ${TR_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${TR_DAYS[date.getDay()]}`;
}

export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}`;
}

/* ------------------------------------------------------------------ */
/*  Case type color helper                                             */
/* ------------------------------------------------------------------ */

const CASE_TYPE_COLORS: Record<string, string> = {
  is_hukuku: "#6C6CFF",
  ceza: "#E5484D",
  ticaret: "#FFB224",
  idare: "#A78BFA",
  aile: "#3DD68C",
  icra: "#FFB224",
  vergi: "#E5484D",
};

export function getCaseTypeColor(caseType: string): string {
  const key = caseType.toLowerCase().replace(/\s+/g, "_");
  for (const [k, v] of Object.entries(CASE_TYPE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "#6C6CFF";
}

/* ------------------------------------------------------------------ */
/*  Deadline urgency helpers                                           */
/* ------------------------------------------------------------------ */

export function getDeadlineUrgency(daysLeft: number, isOverdue?: boolean) {
  if (isOverdue || daysLeft < 0) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.03]", border: "border-[#E5484D]/20", label: `${Math.abs(daysLeft)} gun gecti` };
  if (daysLeft === 0) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.05]", border: "border-[#E5484D]/20", label: "SON GUN" };
  if (daysLeft <= 3) return { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.03]", border: "border-[#E5484D]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 7) return { dot: "bg-[#FFB224]", text: "text-[#FFB224]", bg: "bg-[#FFB224]/[0.03]", border: "border-[#FFB224]/20", label: `${daysLeft} gun` };
  if (daysLeft <= 14) return { dot: "bg-[#FFB224]", text: "text-[#FFB224]", bg: "bg-[#FFB224]/[0.03]", border: "border-[#FFB224]/20", label: `${daysLeft} gun` };
  return { dot: "bg-[#5C5C5F]", text: "text-[#5C5C5F]", bg: "bg-white/[0.02]", border: "border-white/[0.06]", label: `${daysLeft} gun` };
}
