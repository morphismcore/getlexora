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

const PUBLIC_PATHS = ["/giris", "/kayit"];

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
      setToken(t);
      fetchUser(t).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

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
    setToken(null);
    setUser(null);
    router.push("/giris");
  }, [router]);

  // Show nothing while checking auth (prevents flash)
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#09090B]">
        <div className="w-6 h-6 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin" />
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
