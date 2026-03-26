"use client";

import { motion } from "motion/react";
import { HIcon } from "./components";

export default function SettingsTab({ apiUrl }: { apiUrl: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Platform Info */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-4">Platform Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[13px] text-[#5C5C5F] mb-1">Versiyon</p>
            <p className="text-[16px] font-mono text-[#ECECEE]">1.0.0-beta</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[13px] text-[#5C5C5F] mb-1">API URL</p>
            <p className="text-[16px] font-mono text-[#6C6CFF] truncate">{apiUrl}</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[13px] text-[#5C5C5F] mb-1">Ortam</p>
            <p className="text-[16px] font-mono text-[#3DD68C]">{apiUrl.includes("localhost") ? "Development" : "Production"}</p>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4">
            <p className="text-[13px] text-[#5C5C5F] mb-1">Build Tarihi</p>
            <p className="text-[16px] font-mono text-[#8B8B8E]">{new Date().toLocaleDateString("tr-TR")}</p>
          </div>
        </div>
      </div>

      {/* Seed Data */}
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-[15px] font-semibold text-[#ECECEE] mb-2">Seed Data Islemleri</h3>
        <p className="text-[14px] text-[#5C5C5F] mb-4">Sure kurallari ve tatil verilerini veritabanina yukleyin. Mevcut veriler guncellenir, yeni veriler eklenir.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#6C6CFF]/10 flex items-center justify-center">
                <HIcon d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 text-[#6C6CFF]" />
              </div>
              <span className="text-[15px] font-medium text-[#ECECEE]">Sure Kurallari</span>
            </div>
            <p className="text-[13px] text-[#5C5C5F] mb-3 flex-1">65+ olay turu ve 180+ sure kuralini yukle.</p>
            <button className="w-full py-2 text-[14px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors">
              Seed Calistir
            </button>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#3DD68C]/10 flex items-center justify-center">
                <HIcon d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" className="w-4 h-4 text-[#3DD68C]" />
              </div>
              <span className="text-[15px] font-medium text-[#ECECEE]">Tatil Verileri</span>
            </div>
            <p className="text-[13px] text-[#5C5C5F] mb-3 flex-1">2025-2028 arasi tatil ve adli tatil verilerini yukle.</p>
            <button className="w-full py-2 text-[14px] font-medium text-[#3DD68C] bg-[#3DD68C]/10 hover:bg-[#3DD68C]/20 rounded-lg transition-colors">
              Seed Calistir
            </button>
          </div>
          <div className="bg-[#09090B] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFB224]/10 flex items-center justify-center">
                <HIcon d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" className="w-4 h-4 text-[#FFB224]" />
              </div>
              <span className="text-[15px] font-medium text-[#ECECEE]">Tum Seed</span>
            </div>
            <p className="text-[13px] text-[#5C5C5F] mb-3 flex-1">Tum seed verilerini tek seferde yukle.</p>
            <button className="w-full py-2 text-[14px] font-medium text-[#FFB224] bg-[#FFB224]/10 hover:bg-[#FFB224]/20 rounded-lg transition-colors">
              Tumunu Calistir
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#111113] border border-[#E5484D]/10 rounded-xl p-5">
        <h3 className="text-[15px] font-semibold text-[#E5484D] mb-2">Tehlikeli Bolge</h3>
        <p className="text-[14px] text-[#5C5C5F] mb-4">Bu islemler geri alinamaz. Dikkatli olun.</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-[14px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 rounded-lg transition-colors border border-[#E5484D]/20">
            Cache Temizle
          </button>
        </div>
      </div>
    </motion.div>
  );
}
