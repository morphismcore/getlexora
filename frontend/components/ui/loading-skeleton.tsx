import React from "react";

function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative rounded bg-surface overflow-hidden ${className}`}
      style={style}
    >
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  widths,
}: {
  lines?: number;
  widths?: string[];
}) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className="h-3"
          style={{
            width: widths?.[i] ?? (i === lines - 1 ? "60%" : "100%"),
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 bg-surface border border-border-subtle rounded-xl space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Shimmer className="h-5 w-20" />
        <Shimmer className="h-4 w-14" />
      </div>
      {/* Meta row */}
      <div className="flex items-center gap-3">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-16" />
      </div>
      {/* Body lines */}
      <div className="space-y-2 pt-1">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/5" />
      </div>
      {/* Confidence bar placeholder */}
      <div className="pt-1">
        <Shimmer className="h-[3px] w-full rounded-full" />
      </div>
    </div>
  );
}
