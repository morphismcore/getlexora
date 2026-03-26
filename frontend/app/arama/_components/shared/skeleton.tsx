"use client";

import React from "react";
import { motion } from "motion/react";

export function ShimmerBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#1A1A1F] rounded-lg ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

export function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay * 0.05 }}
      className="bg-[#111113] border border-white/[0.06] rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <ShimmerBlock className="h-[22px] w-20 rounded-md" />
        <ShimmerBlock className="h-[16px] w-28" />
      </div>
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-[14px] w-24" />
        <ShimmerBlock className="h-[14px] w-24" />
        <ShimmerBlock className="h-[14px] w-16 ml-auto" />
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-[14px] w-full" />
        <ShimmerBlock className="h-[14px] w-[90%]" />
        <ShimmerBlock className="h-[14px] w-3/4" />
      </div>
      <ShimmerBlock className="h-[4px] w-full rounded-full" />
    </motion.div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-7 w-24 rounded-lg" />
        <ShimmerBlock className="h-6 w-32 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-5 w-28" />
        <ShimmerBlock className="h-5 w-28" />
        <ShimmerBlock className="h-5 w-20" />
      </div>
      <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-5 space-y-2.5">
        <ShimmerBlock className="h-4 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="h-[14px]"
            style={{ width: `${70 + Math.random() * 30}%` }}
          />
        ))}
      </div>
      <div className="space-y-2.5 mt-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="h-[14px]"
            style={{ width: `${55 + Math.random() * 45}%` }}
          />
        ))}
      </div>
    </div>
  );
}
