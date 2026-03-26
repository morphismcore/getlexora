"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

// Animated counter hook
function useCounter(end: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end === 0) { setVal(0); return; }
    const start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [end, duration]);
  return val;
}

export default function StatCard({ label, value, color, icon, delay, sub }: { label: string; value: number; color: string; icon: React.ReactNode; delay: number; sub?: string }) {
  const count = useCounter(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="group bg-[#111113] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] hover:bg-[#16161A] transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${color.replace("text-", "bg-").replace("]", "]/10]")} group-hover:scale-110`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
      <p className={`text-[28px] font-bold tabular-nums ${color}`}>{count.toLocaleString("tr-TR")}</p>
      <p className="text-[14px] text-[#5C5C5F] mt-1">{label}</p>
      {sub && <p className="text-[12px] text-[#3A3A3F] mt-0.5">{sub}</p>}
    </motion.div>
  );
}
