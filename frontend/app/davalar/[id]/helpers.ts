const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function formatDateTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function formatDateShortTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function getDayNameTR(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", { weekday: "long" });
  } catch {
    return "";
  }
}

export function getUrgencyStyle(daysLeft: number, isCompleted: boolean, isExpired: boolean) {
  if (isCompleted) {
    return { bg: "bg-[#3DD68C]/5", border: "border-l-4 border-[#3DD68C]", dot: "bg-[#3DD68C]", text: "text-[#3DD68C]" };
  }
  if (isExpired || daysLeft < 0) {
    return { bg: "bg-[#5C5C5F]/5", border: "border-l-4 border-[#5C5C5F]", dot: "bg-[#5C5C5F]", text: "text-[#5C5C5F]" };
  }
  if (daysLeft <= 3) {
    return { bg: "bg-[#E5484D]/5", border: "border-l-4 border-[#E5484D]", dot: "bg-[#E5484D]", text: "text-[#E5484D]" };
  }
  if (daysLeft <= 7) {
    return { bg: "bg-[#FFB224]/5", border: "border-l-4 border-[#FFB224]", dot: "bg-[#FFB224]", text: "text-[#FFB224]" };
  }
  if (daysLeft <= 14) {
    return { bg: "bg-[#F5D90A]/5", border: "border-l-4 border-[#F5D90A]", dot: "bg-[#F5D90A]", text: "text-[#F5D90A]" };
  }
  return { bg: "bg-[#3DD68C]/5", border: "border-l-4 border-[#3DD68C]", dot: "bg-[#3DD68C]", text: "text-[#3DD68C]" };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lexora_token");
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (res.status === 401) {
    localStorage.removeItem("lexora_token");
    throw new Error("Oturum suresi doldu. Lutfen tekrar giris yapin.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}
