import type { Metadata } from "next";
import { Geist, Noto_Serif } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/ui/app-shell";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Lexora — Hukuk Araştırma Asistanı",
  description:
    "Türk avukatları için AI destekli içtihat arama, mevzuat tarama ve dava analizi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${geist.variable} ${notoSerif.variable} h-full`}>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="h-full bg-[#09090B] text-[#ECECEE] font-[family-name:var(--font-geist)] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
