"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { motion, AnimatePresence } from "motion/react";

interface NavGroup {
  label: string;
  items: { label: string; href: string; icon: React.ReactNode; shortcut?: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Ana Menu",
    items: [
      { label: "Arama", href: "/arama", shortcut: "1",
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
      { label: "Davalarim", href: "/davalar", shortcut: "2",
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg> },
      { label: "Dilekce", href: "/dilekce", shortcut: "3",
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
      { label: "Belge Analiz", href: "/belge", shortcut: "4",
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const h = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCollapsed(c => !c); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const sidebarContent = (isMobile: boolean) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <>
        {/* Logo */}
        <div className="flex items-center h-[56px] px-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex-shrink-0">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            {!isCollapsed && (
              <span className="text-[15px] font-bold tracking-tight text-[#ECECEE] whitespace-nowrap">
                Lexora
              </span>
            )}
            {isMobile && (
              <button onClick={closeMobile} className="ml-auto p-1.5 text-[#8B8B8E] hover:text-[#ECECEE] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Search hint */}
        {!isCollapsed && (
          <div className="px-2 pt-3 pb-1">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#5C5C5F] text-[14px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="flex-1">Komut paleti</span>
              <kbd className="text-[12px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#5C5C5F] font-mono">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#3A3A3F] px-2.5 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={isMobile ? closeMobile : undefined}
                      className={`relative flex items-center gap-2.5 h-9 px-2.5 rounded-xl text-[15px] font-medium transition-all duration-150 ${
                        isCollapsed ? "justify-center" : ""
                      } ${
                        isActive
                          ? "text-[#6C6CFF] bg-[#6C6CFF]/[0.08]"
                          : "text-[#8B8B8E] hover:bg-white/[0.03] hover:text-[#ECECEE]"
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[#6C6CFF]"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      <span className={`flex-shrink-0 transition-transform duration-150 ${isActive ? "scale-110" : ""}`}>
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.shortcut && (
                            <span className="text-[12px] text-[#3A3A3F] ml-auto flex-shrink-0 font-mono">
                              ⌘{item.shortcut}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <UserSection collapsed={isCollapsed} isMobile={isMobile} />

          <Link
            href="/ayarlar"
            className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#5C5C5F] hover:bg-white/[0.03] hover:text-[#8B8B8E] transition-colors ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "Ayarlar" : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span>Ayarlar</span>
                <span className="text-[12px] text-[#3A3A3F] ml-auto flex-shrink-0 font-mono">⌘5</span>
              </div>
            )}
          </Link>

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#5C5C5F] hover:bg-white/[0.03] hover:text-[#8B8B8E] transition-colors ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? "Genislet" : "Daralt"}
            >
              <motion.svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"
                animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </motion.svg>
              {!collapsed && <span>Daralt</span>}
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-[#111113] border border-white/[0.06] text-[#8B8B8E] hover:text-[#ECECEE] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobile} />
            <motion.aside
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col md:hidden"
              style={{ backgroundColor: "#09090B", borderRight: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 56 : 240 }}
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
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  if (!user) {
    return (
      <div className="space-y-0.5">
        <Link
          href="/giris"
          className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#6C6CFF] hover:bg-[#6C6CFF]/10 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Giris Yap" : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
          {!collapsed && <span>Giris Yap</span>}
        </Link>
        <Link
          href="/kayit"
          className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Kayit Ol" : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          {!collapsed && <span>Kayit Ol</span>}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-2.5 h-10 px-2.5 rounded-xl ${collapsed ? "justify-center" : ""}`}>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6C6CFF] to-[#A78BFA] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[13px] font-bold">{initials}</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-[15px] font-medium text-[#ECECEE] truncate block">{user?.full_name || "Kullanici"}</span>
            <span className="text-[12px] text-[#5C5C5F] capitalize">{user?.role || ""}</span>
          </div>
        )}
      </div>
      {user?.role === "platform_admin" && (
        <Link href="/admin" className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          {!collapsed && <span>Admin Panel</span>}
        </Link>
      )}
      <button onClick={logout} className={`flex items-center gap-2.5 w-full h-9 px-2.5 rounded-xl text-[15px] font-medium text-[#E5484D]/70 hover:text-[#E5484D] hover:bg-[#E5484D]/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="flex-shrink-0"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        {!collapsed && <span>Cikis Yap</span>}
      </button>
    </div>
  );
}