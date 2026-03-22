"use client";

import { useRouter } from "next/navigation";
import CommandPalette from "./command-palette";

const searchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const homeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
  </svg>
);

const bookIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const shieldIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export default function CommandPaletteProvider() {
  const router = useRouter();

  const groups = [
    {
      title: "Sayfalar",
      items: [
        { id: "home", label: "Dashboard", icon: homeIcon, shortcut: "Ctrl+1", onSelect: () => router.push("/") },
        { id: "arama", label: "İçtihat Arama", icon: searchIcon, shortcut: "Ctrl+2", onSelect: () => router.push("/arama") },
        { id: "mevzuat", label: "Mevzuat", icon: bookIcon, shortcut: "Ctrl+3", onSelect: () => router.push("/mevzuat") },
        { id: "dogrulama", label: "Atıf Doğrulama", icon: shieldIcon, shortcut: "Ctrl+4", onSelect: () => router.push("/dogrulama") },
        { id: "sureler", label: "Süre Hesapla", icon: shieldIcon, shortcut: "Ctrl+5", onSelect: () => router.push("/sureler") },
        { id: "istatistik", label: "İstatistik", icon: bookIcon, shortcut: "Ctrl+6", onSelect: () => router.push("/istatistik") },
        { id: "dilekce", label: "Dilekçe Oluştur", icon: bookIcon, shortcut: "Ctrl+7", onSelect: () => router.push("/dilekce") },
        { id: "belge", label: "Belge Analiz", icon: searchIcon, shortcut: "Ctrl+8", onSelect: () => router.push("/belge") },
        { id: "davalar", label: "Dava Dosyaları", icon: homeIcon, shortcut: "Ctrl+9", onSelect: () => router.push("/davalar") },
      ],
    },
    {
      title: "Hızlı İşlemler",
      items: [
        { id: "yeni-arama", label: "Yeni Arama Yap", icon: searchIcon, onSelect: () => { router.push("/arama"); } },
        { id: "yeni-dava", label: "Yeni Dava Oluştur", icon: homeIcon, onSelect: () => { router.push("/davalar"); } },
        { id: "yeni-dilekce", label: "Yeni Dilekçe Hazırla", icon: bookIcon, onSelect: () => { localStorage.removeItem("lexora_dilekce_draft"); router.push("/dilekce"); } },
        { id: "sure-hesapla", label: "Süre Hesapla", icon: shieldIcon, onSelect: () => router.push("/sureler") },
      ],
    },
  ];

  return <CommandPalette groups={groups} />;
}
