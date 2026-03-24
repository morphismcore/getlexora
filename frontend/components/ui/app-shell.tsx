"use client";

import { usePathname } from "next/navigation";
import AuthProvider from "./auth-provider";
import Sidebar from "./sidebar";
import CommandPaletteProvider from "./command-palette-provider";
import ErrorBoundary from "./error-boundary";

const AUTH_PAGES = ["/giris", "/kayit"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  return (
    <AuthProvider>
      {isAuthPage ? (
        // Login/Register sayfaları sidebar olmadan gösterilir
        children
      ) : (
        // Normal sayfalar sidebar + command palette ile
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      )}
      {!isAuthPage && <CommandPaletteProvider />}
    </AuthProvider>
  );
}
