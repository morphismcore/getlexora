"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { motion, AnimatePresence } from "motion/react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    shortcut: "⌘1",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    label: "İçtihat Arama",
    href: "/arama",
    shortcut: "⌘2",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    label: "Mevzuat",
    href: "/mevzuat",
    shortcut: "⌘3",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: "Doğrulama",
    href: "/dogrulama",
    shortcut: "⌘4",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: "Süre Hesapla",
    href: "/sureler",
    shortcut: "⌘5",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    label: "İstatistik",
    href: "/istatistik",
    shortcut: "⌘6",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    label: "Dilekçe",
    href: "/dilekce",
    shortcut: "⌘7",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    label: "Belge Analiz",
    href: "/belge",
    shortcut: "⌘8",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Dava Dosyaları",
    href: "/davalar",
    shortcut: "⌘9",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div
        className="flex items-center h-[52px] px-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6C6CFF]/[0.12] flex-shrink-0">
            <span className="text-[#6C6CFF] text-sm font-bold leading-none">L</span>
          </div>
          {(isMobile || !collapsed) && (
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#ECECEE] whitespace-nowrap overflow-hidden">
              Lexora
            </span>
          )}
          {/* Close button for mobile */}
          {isMobile && (
            <button
              onClick={closeMobile}
              className="ml-auto p-1.5 text-[#8B8B8E] hover:text-[#ECECEE] transition-colors"
              aria-label="Menüyü kapat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isCollapsedDesktop = !isMobile && collapsed;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={`relative flex items-center gap-2.5 h-9 px-2.5 rounded-xl text-[#5C5C5F] cursor-not-allowed ${
                  isCollapsedDesktop ? "justify-center" : ""
                }`}
                title={isCollapsedDesktop ? `${item.label} (Yakında)` : undefined}
              >
                <span className="flex-shrink-0 opacity-40">{item.icon}</span>
                {!isCollapsedDesktop && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate opacity-40">
                      {item.label}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#5C5C5F] bg-[#1A1A1F] px-1.5 py-0.5 rounded ml-auto flex-shrink-0">
                      Yakında
                    </span>
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? closeMobile : undefined}
              className={`relative flex items-center gap-2.5 h-9 px-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                isCollapsedDesktop ? "justify-center" : ""
              } ${
                isActive
                  ? "text-[#6C6CFF] bg-[#6C6CFF]/[0.12]"
                  : "text-[#8B8B8E] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ECECEE]"
              }`}
              title={isCollapsedDesktop ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-[#6C6CFF]" />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              {!isCollapsedDesktop && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[11px] text-[#5C5C5F] ml-auto flex-shrink-0">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div
        className="p-2 space-y-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* User avatar — gerçek kullanıcı bilgisi */}
        <UserSection collapsed={!isMobile && collapsed} isMobile={isMobile} />

        {/* Settings */}
        <Link
          href="/ayarlar"
          className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[13px] font-medium text-[#8B8B8E] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ECECEE] transition-colors ${
            !isMobile && collapsed ? "justify-center" : ""
          }`}
          title={!isMobile && collapsed ? "Ayarlar" : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {(isMobile || !collapsed) && <span>Ayarlar</span>}
        </Link>

        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[13px] font-medium text-[#8B8B8E] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ECECEE] transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Genişlet" : "Daralt"}
          >
            <motion.svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </motion.svg>
            {!collapsed && <span>Daralt</span>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-[#111113] border border-white/[0.06] text-[#8B8B8E] hover:text-[#ECECEE] hover:border-white/[0.10] transition-colors"
        aria-label="Menüyü aç"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobile}
            />
            {/* Sidebar panel */}
            <motion.aside
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col md:hidden"
              style={{ backgroundColor: "#09090B", borderRight: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25 }}
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.2 }}
        className="h-screen sticky top-0 hidden md:flex flex-col shrink-0 z-40"
        style={{ borderRight: "1px solid rgba(255,255,255,0.06)", backgroundColor: "#09090B" }}
      >
        {sidebarContent(false)}
      </motion.aside>
    </>
  );
}

function UserSection({ collapsed, isMobile }: { collapsed: boolean; isMobile: boolean }) {
  const { user, logout } = useAuth();
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-2.5 h-9 px-2.5 rounded-xl ${collapsed ? "justify-center" : ""}`}>
        <div className="w-6 h-6 rounded-full bg-[#6C6CFF]/[0.12] flex items-center justify-center flex-shrink-0">
          <span className="text-[#6C6CFF] text-[11px] font-semibold">{initials}</span>
        </div>
        {!collapsed && (
          <span className="text-[13px] font-medium text-[#8B8B8E] truncate">
            {user?.full_name || "Kullanıcı"}
          </span>
        )}
      </div>
      {user?.role === "platform_admin" && (
        <Link href="/admin" className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[13px] font-medium text-purple-400 hover:bg-purple-500/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          {!collapsed && <span>Admin Panel</span>}
        </Link>
      )}
      <button onClick={logout} className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[13px] font-medium text-[#E5484D] hover:bg-[#E5484D]/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        {!collapsed && <span>Çıkış Yap</span>}
      </button>
    </div>
  );
}
