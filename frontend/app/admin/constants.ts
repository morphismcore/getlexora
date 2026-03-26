import type { TabKey } from "./types";

export const ROLES = ["platform_admin", "admin", "yonetici", "kullanici"];

export const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  admin: "Firma Admin",
  yonetici: "Yonetici",
  kullanici: "Kullanici",
};

export const ROLE_COLORS: Record<string, string> = {
  platform_admin: "bg-purple-500/10 text-purple-400",
  admin: "bg-[#6C6CFF]/10 text-[#6C6CFF]",
  yonetici: "bg-[#FFB224]/10 text-[#FFB224]",
  kullanici: "bg-[#3DD68C]/10 text-[#3DD68C]",
};

export const TAB_CONFIG: { key: TabKey; label: string; icon: string }[] = [
  { key: "genel", label: "Genel", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
  { key: "kullanicilar", label: "Kullanicilar", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { key: "veri-yonetimi", label: "Veri Yonetimi", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { key: "sistem", label: "Sistem", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  "HMK": { color: "#6C6CFF", bg: "bg-[#6C6CFF]/10" },
  "CMK": { color: "#E5484D", bg: "bg-[#E5484D]/10" },
  "IYUK": { color: "#A78BFA", bg: "bg-[#A78BFA]/10" },
  "IIK": { color: "#FFB224", bg: "bg-[#FFB224]/10" },
  "Is Kanunu": { color: "#3DD68C", bg: "bg-[#3DD68C]/10" },
  "TMK": { color: "#F472B6", bg: "bg-[#F472B6]/10" },
  "TTK": { color: "#38BDF8", bg: "bg-[#38BDF8]/10" },
  "TBK Kira": { color: "#FB923C", bg: "bg-[#FB923C]/10" },
  "Tuketici": { color: "#34D399", bg: "bg-[#34D399]/10" },
  "Vergi": { color: "#FBBF24", bg: "bg-[#FBBF24]/10" },
  "Fikri Mulkiyet": { color: "#C084FC", bg: "bg-[#C084FC]/10" },
  "Genel": { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" },
};

export const DEADLINE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "hak_dusurucusu": { label: "Hak Dusurucusu", color: "#E5484D" },
  "zamanasimai": { label: "Zamanasimi", color: "#FFB224" },
  "usul_suresi": { label: "Usul Suresi", color: "#6C6CFF" },
  "bildirim": { label: "Bildirim", color: "#3DD68C" },
  "bilgi": { label: "Bilgi", color: "#8B8B8E" },
};

export const DURATION_UNITS: Record<string, string> = {
  "gun": "Gun",
  "is_gunu": "Is Gunu",
  "hafta": "Hafta",
  "ay": "Ay",
  "yil": "Yil",
  "bilgi": "Bilgi",
};

export const HOLIDAY_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "resmi": { label: "Resmi Tatil", color: "#6C6CFF", bg: "bg-[#6C6CFF]/10" },
  "dini": { label: "Dini Bayram", color: "#A78BFA", bg: "bg-[#A78BFA]/10" },
  "arife": { label: "Arife", color: "#FB923C", bg: "bg-[#FB923C]/10" },
};

export const ALL_CATEGORIES = ["HMK", "CMK", "IYUK", "IIK", "Is Kanunu", "TMK", "TTK", "TBK Kira", "Tuketici", "Vergi", "Fikri Mulkiyet", "Genel"];

export const MONTHS_TR = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];

export const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  yargitay: { label: "Yargitay", color: "#6C6CFF", bg: "bg-[#6C6CFF]" },
  danistay: { label: "Danistay", color: "#A78BFA", bg: "bg-[#A78BFA]" },
  aym: { label: "AYM", color: "#E5484D", bg: "bg-[#E5484D]" },
  aihm: { label: "AIHM", color: "#3DD68C", bg: "bg-[#3DD68C]" },
  mevzuat: { label: "Mevzuat", color: "#FFB224", bg: "bg-[#FFB224]" },
};

export const YARGITAY_DAIRELERI: Record<string, string> = {
  "1": "1. Hukuk Dairesi", "2": "2. Hukuk Dairesi", "3": "3. Hukuk Dairesi",
  "4": "4. Hukuk Dairesi", "5": "5. Hukuk Dairesi", "6": "6. Hukuk Dairesi",
  "7": "7. Hukuk Dairesi", "8": "8. Hukuk Dairesi", "9": "9. Hukuk Dairesi",
  "10": "10. Hukuk Dairesi", "11": "11. Hukuk Dairesi", "12": "12. Hukuk Dairesi",
  "13": "13. Hukuk Dairesi", "14": "14. Hukuk Dairesi", "15": "15. Hukuk Dairesi",
  "17": "17. Hukuk Dairesi", "HGK": "Hukuk Genel Kurulu",
  "C1": "1. Ceza Dairesi", "C2": "2. Ceza Dairesi", "C3": "3. Ceza Dairesi",
  "C4": "4. Ceza Dairesi", "C5": "5. Ceza Dairesi", "C6": "6. Ceza Dairesi",
  "C7": "7. Ceza Dairesi", "C8": "8. Ceza Dairesi", "C9": "9. Ceza Dairesi",
  "C10": "10. Ceza Dairesi", "C11": "11. Ceza Dairesi", "C12": "12. Ceza Dairesi",
  "C13": "13. Ceza Dairesi", "C14": "14. Ceza Dairesi", "C15": "15. Ceza Dairesi",
  "C16": "16. Ceza Dairesi", "CGK": "Ceza Genel Kurulu",
};

export const SERVICE_LABELS: Record<string, string> = {
  qdrant: "Qdrant",
  redis: "Redis",
  postgres: "PostgreSQL",
  bedesten: "Bedesten",
};
