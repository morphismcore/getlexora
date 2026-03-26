"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
  baro_sicil_no: string | null;
  baro: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() > exp - 60000; // 1 minute buffer
  } catch {
    return true;
  }
}

function isTokenNearExpiry(token: string, minutesLeft: number): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() > exp - (minutesLeft * 60 * 1000);
  } catch {
    return false;
  }
}

const PUBLIC_PATHS = ["/", "/giris", "/kayit"];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUser(data);
      return true;
    } catch {
      localStorage.removeItem("lexora_token");
      setToken(null);
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("lexora_token");
    if (t) {
      // Check if token is already expired before fetching user
      if (isTokenExpired(t)) {
        localStorage.removeItem("lexora_token");
        setLoading(false);
        if (typeof window !== 'undefined' && !PUBLIC_PATHS.includes(window.location.pathname)) {
          window.location.href = '/giris?expired=1';
        }
        return;
      }
      setToken(t);
      fetchUser(t).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  // Periodic token expiry check + auto-refresh
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      if (isTokenExpired(token)) {
        localStorage.removeItem("lexora_token");
        localStorage.removeItem("lexora_search_history");
        localStorage.removeItem("lexora_dilekce_draft");
        localStorage.removeItem("lexora_upload_history");
        setToken(null);
        setUser(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/giris?expired=1';
        }
        return;
      }

      // Auto-refresh if <30 min remaining
      if (isTokenNearExpiry(token, 30)) {
        try {
          const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('lexora_token', data.access_token);
            setToken(data.access_token);
          }
        } catch {
          // Silent fail — will retry in 30s
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [token]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !token && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/giris");
    }
  }, [loading, token, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.detail || (res.status === 403 ? "Hesabınız henüz onaylanmadı." : "E-posta veya şifre hatalı.");
        return { ok: false, error: msg };
      }
      const data = await res.json();
      const t = data.access_token;
      localStorage.setItem("lexora_token", t);
      setToken(t);
      await fetchUser(t);
      return { ok: true };
    } catch {
      return { ok: false, error: "Bağlantı hatası. Lütfen tekrar deneyin." };
    }
  }, [fetchUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("lexora_token");
    localStorage.removeItem("lexora_search_history");
    localStorage.removeItem("lexora_dilekce_draft");
    localStorage.removeItem("lexora_upload_history");
    setToken(null);
    setUser(null);
    router.push("/giris");
  }, [router]);

  // Show clean loading state while checking auth (prevents flash of unstyled content)
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#09090B]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-[#111113] border border-white/[0.06] rounded-xl flex items-center justify-center">
            <span className="text-[18px] font-bold bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] bg-clip-text text-transparent">L</span>
          </div>
          <div className="w-6 h-6 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Public pages don't need auth
  if (PUBLIC_PATHS.includes(pathname)) {
    return (
      <AuthContext.Provider value={{ user, token, loading, login, logout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Not logged in → redirect handled by useEffect above
  if (!token) return null;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
