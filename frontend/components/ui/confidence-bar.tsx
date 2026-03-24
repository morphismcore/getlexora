"use client";

import { motion } from "motion/react";

interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

function getFillColor(score: number): string {
  if (score < 40) return "var(--color-destructive)";
  if (score < 70) return "var(--color-warning)";
  return "var(--color-success)";
}

function getLabelColor(score: number): string {
  if (score < 40) return "text-destructive";
  if (score < 70) return "text-warning";
  return "text-success";
}

function getGlowColor(score: number): string {
  if (score < 40) return "rgba(229,72,77,0.25)";
  if (score < 70) return "rgba(255,178,36,0.25)";
  return "rgba(61,214,140,0.25)";
}

const sizeMap = {
  sm: { bar: "h-[2px]", label: "text-[10px]", gap: "gap-2" },
  md: { bar: "h-[3px]", label: "text-[12px]", gap: "gap-2.5" },
  lg: { bar: "h-[5px]", label: "text-[13px]", gap: "gap-3" },
};

export default function ConfidenceBar({ score, showLabel = true, size = "md" }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const s = sizeMap[size];

  return (
    <div className={`flex items-center ${s.gap}`}>
      <div className={`flex-1 ${s.bar} rounded-full bg-border-subtle overflow-hidden`}>
        <motion.div
          className={`h-full rounded-full`}
          style={{
            background: `linear-gradient(90deg, var(--color-destructive), var(--color-warning), var(--color-success))`,
            backgroundSize: "200% 100%",
            backgroundPosition: clamped < 40 ? "0% 0%" : clamped < 70 ? "50% 0%" : "100% 0%",
            boxShadow: `0 0 8px ${getGlowColor(clamped)}, 0 0 20px ${getGlowColor(clamped)}`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
      {showLabel && (
        <motion.span
          className={`${s.label} font-medium tabular-nums ${getLabelColor(clamped)}`}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          %{clamped}
        </motion.span>
      )}
    </div>
  );
}