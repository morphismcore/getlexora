"use client";

import { motion } from "motion/react";

interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
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

export default function ConfidenceBar({ score, showLabel = true }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-[3px] rounded-full bg-border-subtle overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, var(--color-destructive), var(--color-warning), var(--color-success))`,
            backgroundSize: "200% 100%",
            backgroundPosition: clamped < 40 ? "0% 0%" : clamped < 70 ? "50% 0%" : "100% 0%",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
      {showLabel && (
        <span className={`text-[12px] font-medium tabular-nums ${getLabelColor(clamped)}`}>
          %{clamped}
        </span>
      )}
    </div>
  );
}
