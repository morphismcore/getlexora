export function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#5C5C5F" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20, label: "Zayif", color: "#E5484D" };
  if (score <= 2) return { score: 40, label: "Orta", color: "#FFB224" };
  if (score <= 3) return { score: 60, label: "Iyi", color: "#FFB224" };
  if (score <= 4) return { score: 80, label: "Guclu", color: "#3DD68C" };
  return { score: 100, label: "Cok Guclu", color: "#3DD68C" };
}
