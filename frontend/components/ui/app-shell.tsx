"use client";

import { usePathname } from "next/navigation";
import AuthProvider, { useAuth } from "./auth-provider";
import Sidebar from "./sidebar";
import CommandPaletteProvider from "./command-palette-provider";
import ErrorBoundary from "./error-boundary";

const AUTH_PAGES = ["/giris", "/kayit"];

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, loading } = useAuth();
  const isAuthPage = AUTH_PAGES.includes(pathname);
  // Landing page for non-authenticated users renders without sidebar
  const isLandingPage = pathname === "/" && !token && !loading;
  const noShell = isAuthPage || isLandingPage;

  if (noShell) return <>{children}</>;

  return (
    <>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <CommandPaletteProvider />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
