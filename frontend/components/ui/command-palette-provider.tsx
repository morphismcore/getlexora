"use client";

import { useRouter } from "next/navigation";
import CommandPalette from "./command-palette";

const searchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const folderIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const penIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const docIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const settingsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function CommandPaletteProvider() {
  const router = useRouter();

  const groups = [
    {
      title: "Sayfalar",
      items: [
        { id: "arama", label: "Arama", icon: searchIcon, shortcut: "⌘1", onSelect: () => router.push("/arama") },
        { id: "davalar", label: "Davalarım", icon: folderIcon, shortcut: "⌘2", onSelect: () => router.push("/davalar") },
        { id: "dilekce", label: "Dilekçe", icon: penIcon, shortcut: "⌘3", onSelect: () => router.push("/dilekce") },
        { id: "belge", label: "Belge Analiz", icon: docIcon, shortcut: "⌘4", onSelect: () => router.push("/belge") },
        { id: "ayarlar", label: "Ayarlar", icon: settingsIcon, shortcut: "⌘5", onSelect: () => router.push("/ayarlar") },
      ],
    },
    {
      title: "Hızlı İşlemler",
      items: [
        { id: "yeni-arama", label: "Yeni Arama Yap", icon: searchIcon, onSelect: () => { router.push("/arama"); } },
        { id: "yeni-dava", label: "Yeni Dava Oluştur", icon: folderIcon, onSelect: () => { router.push("/davalar"); } },
        { id: "yeni-dilekce", label: "Yeni Dilekçe Hazırla", icon: penIcon, onSelect: () => { localStorage.removeItem("lexora_dilekce_draft"); router.push("/dilekce"); } },
      ],
    },
  ];

  return <CommandPalette groups={groups} />;
}
