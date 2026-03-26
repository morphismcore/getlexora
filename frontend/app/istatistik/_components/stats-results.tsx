"use client";

import { motion } from "motion/react";
import type { CourtStats } from "./types";
import { ChamberBarChart, YearBarChart } from "./charts";

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const listItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export function StatsResults({ stats }: { stats: CourtStats }) {
  return (
    <motion.div className="space-y-4" variants={listContainer} initial="hidden" animate="show">
      <motion.div variants={listItem} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[13px] text-[#5C5C5F] uppercase tracking-wide font-medium">Toplam Karar</p>
          <p className="text-[28px] font-bold text-[#ECECEE] mt-1 leading-none">{stats.total_decisions}</p>
        </div>
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[13px] text-[#5C5C5F] uppercase tracking-wide font-medium">Daire Sayısı</p>
          <p className="text-[28px] font-bold text-[#ECECEE] mt-1 leading-none">{stats.by_chamber.length}</p>
        </div>
        {stats.most_active_chamber && (
          <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[13px] text-[#5C5C5F] uppercase tracking-wide font-medium">En Aktif Daire</p>
            <p className="text-[28px] font-bold text-[#ECECEE] mt-1 leading-none">{stats.by_chamber[0]?.count ?? 0}</p>
            <p className="text-[14px] text-[#8B8B8E] mt-1.5">{stats.most_active_chamber}</p>
          </div>
        )}
      </motion.div>
      {stats.by_chamber.length > 0 && (
        <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[15px] font-medium text-[#ECECEE] mb-3">Daire Dağılımı</h3>
          <ChamberBarChart data={stats.by_chamber} />
        </motion.div>
      )}
      {stats.by_year.length > 0 && (
        <motion.div variants={listItem} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[15px] font-medium text-[#ECECEE] mb-3">Yıl Bazlı Trend</h3>
          <YearBarChart data={stats.by_year} />
        </motion.div>
      )}
      <motion.div variants={listItem}>
        <p className="text-[13px] text-[#5C5C5F] italic">{stats.note}</p>
      </motion.div>
    </motion.div>
  );
}
