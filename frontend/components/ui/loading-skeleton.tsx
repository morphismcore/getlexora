import React from "react";

function Shimmer({
  className = "",
  style,
  delay = 0,
}: {
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  return (
    <div
      className={`relative rounded bg-surface overflow-hidden ${className}`}
      style={{ ...style, animationDelay: `${delay}ms` }}
    >
      {/* Pulse layer */}
      <div
        className="absolute inset-0 animate-pulse bg-white/[0.02]"
        style={{ animationDelay: `${delay}ms` }}
      />
      {/* Shimmer layer */}
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent"
        style={{ animationDelay: `${delay}ms` }}
      />
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
          delay={i * 60}
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
        <Shimmer className="h-5 w-20" delay={0} />
        <Shimmer className="h-4 w-14" delay={40} />
      </div>
      {/* Meta row */}
      <div className="flex items-center gap-3">
        <Shimmer className="h-3 w-24" delay={80} />
        <Shimmer className="h-3 w-20" delay={120} />
        <Shimmer className="h-3 w-16" delay={160} />
      </div>
      {/* Body lines */}
      <div className="space-y-2 pt-1">
        <Shimmer className="h-3 w-full" delay={200} />
        <Shimmer className="h-3 w-full" delay={240} />
        <Shimmer className="h-3 w-3/5" delay={280} />
      </div>
      {/* Confidence bar placeholder */}
      <div className="pt-1">
        <Shimmer className="h-[3px] w-full rounded-full" delay={320} />
      </div>
    </div>
  );
}

export function SkeletonAvatar({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  return <Shimmer className={`${sizeMap[size]} rounded-full`} />;
}