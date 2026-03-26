"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { SavedSearch } from "./types";
import { timeAgo } from "./helpers";

export default function RecentSearches({ searches }: { searches: SavedSearch[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#ECECEE]">Son Aramalar</h3>
        <Link href="/arama" className="text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Tumu</Link>
      </div>
      {searches.length === 0 ? (
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="text-[12px] text-[#5C5C5F]">Henuz arama yapilmamis</p>
          <Link href="/arama" className="inline-block mt-2 text-[11px] text-[#6C6CFF] hover:text-[#8B8BFF]">Arama yap</Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {searches.slice(0, 5).map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/arama?q=${encodeURIComponent(s.query)}`}
                className="block bg-[#111113] border border-white/[0.06] rounded-xl px-3 py-2.5 hover:border-white/[0.10] hover:bg-[#16161A] transition-all group"
              >
                <p className="text-[12px] text-[#ECECEE] truncate group-hover:text-[#6C6CFF] transition-colors">{s.query}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.search_type === "ictihat" ? "bg-[#6C6CFF]/10 text-[#6C6CFF]" : "bg-[#3DD68C]/10 text-[#3DD68C]"}`}>
                    {s.search_type === "ictihat" ? "Ictihat" : s.search_type === "mevzuat" ? "Mevzuat" : s.search_type}
                  </span>
                  {s.result_count > 0 && <span className="text-[10px] text-[#5C5C5F]">{s.result_count} sonuc</span>}
                  <span className="text-[10px] text-[#3A3A3F] ml-auto">{timeAgo(s.created_at)}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
