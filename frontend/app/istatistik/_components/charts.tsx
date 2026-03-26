"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
import type { ChamberStat, YearStat } from "./types";

/* ─── Animated Counter Hook ─── */
export function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView || target === 0) return;
    const startTime = performance.now();
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return { count, ref };
}

/* ─── DonutChart ─── */
export function DonutChart({
  data, size = 140, thickness = 18, colors,
}: {
  data: { label: string; value: number }[];
  size?: number; thickness?: number; colors: string[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const pct = d.value / total;
          const offset = accumulated;
          accumulated += pct;
          return (
            <motion.circle key={i} cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={colors[i % colors.length]} strokeWidth={thickness}
              strokeLinecap="round" strokeDasharray={`${pct * circumference} ${circumference}`}
              strokeDashoffset={-offset * circumference} transform={`rotate(-90 ${size / 2} ${size / 2})`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.15, duration: 0.5 }} />
          );
        })}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-[#ECECEE] text-[20px] font-bold">{total}</text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="fill-[#5C5C5F] text-[12px]">toplam</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[14px] text-[#8B8B8E]">{d.label}</span>
            <span className="text-[14px] font-medium text-[#ECECEE] ml-auto tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── HorizontalBarChart ─── */
export function HorizontalBarChart({ data, colors }: { data: { label: string; value: number }[]; colors: string[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[14px] text-[#8B8B8E]">{d.label}</span>
            <span className="text-[14px] font-medium text-[#ECECEE] tabular-nums">{d.value}</span>
          </div>
          <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ backgroundColor: colors[i % colors.length] }}
              initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── CircularProgress ─── */
export function CircularProgress({ value, size = 100, color = "#3DD68C" }: { value: number; size?: number; color?: string }) {
  const thickness = 8;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={circumference} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold text-[#ECECEE]">%{Math.round(pct)}</span>
      </div>
    </div>
  );
}

/* ─── MiniLineChart ─── */
export function MiniLineChart({ data, color = "#6C6CFF", height = 60 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 280;
  const padding = 4;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={areaD} fill={`url(#grad-${color.replace("#", "")})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
      {points.map((p, i) => (
        <motion.circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="#09090B" strokeWidth={2}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.05 }} />
      ))}
    </svg>
  );
}

/* ─── HeroStat ─── */
export function HeroStat({ label, target, icon, color }: { label: string; target: number; icon: React.ReactNode; color: string }) {
  const { count, ref } = useAnimatedCounter(target);
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden group hover:border-white/[0.10] transition-colors">
      <div className="absolute top-3 right-3 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color }}>{icon}</div>
      <p className="text-[13px] text-[#5C5C5F] uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className="text-[32px] font-bold text-[#ECECEE] leading-none tabular-nums">{count.toLocaleString("tr-TR")}</p>
    </motion.div>
  );
}

/* ─── ChamberBarChart ─── */
export function ChamberBarChart({ data }: { data: ChamberStat[] }) {
  if (!data.length) return null;
  const maxCount = Math.max(...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[14px] text-[#8B8B8E] w-[180px] truncate flex-shrink-0 text-right">{item.daire}</span>
          <div className="flex-1 h-7 bg-[#16161A] rounded-md overflow-hidden relative">
            <motion.div className="h-full rounded-md bg-[#6C6CFF]"
              initial={{ width: 0 }} animate={{ width: `${Math.max((item.count / maxCount) * 100, 2)}%` }}
              transition={{ duration: 0.5, delay: i * 0.04 }} />
            <span className="absolute inset-y-0 right-2 flex items-center text-[13px] font-medium text-[#ECECEE]">
              {item.count} ({item.percentage}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── YearBarChart ─── */
export function YearBarChart({ data }: { data: YearStat[] }) {
  if (!data.length) return null;
  const maxCount = Math.max(...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2 h-[140px]">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <span className="text-[13px] font-medium text-[#ECECEE] mb-1">{item.count}</span>
          <motion.div className="w-full rounded-t-md bg-[#6C6CFF]"
            initial={{ height: 0 }} animate={{ height: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
            transition={{ duration: 0.5, delay: i * 0.06 }} />
          <span className="text-[13px] text-[#5C5C5F] mt-1.5">{item.year}</span>
        </div>
      ))}
    </div>
  );
}
