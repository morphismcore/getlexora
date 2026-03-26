"use client";

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className ?? ""}`} />;
}

export { Shimmer };

export default function SkeletonDashboard() {
  return (
    <div className="h-full overflow-auto p-5 pt-14 md:p-8 md:pt-8 space-y-8">
      <Shimmer className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Shimmer key={i} className="h-[120px]" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-3"><Shimmer className="h-5 w-36" />{[1,2,3,4].map(i => <Shimmer key={i} className="h-20" />)}</div>
        <div className="lg:col-span-2 space-y-3"><Shimmer className="h-5 w-28" /><Shimmer className="h-[200px]" />{[1,2,3].map(i => <Shimmer key={i} className="h-16" />)}</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Shimmer key={i} className="h-24" />)}</div>
    </div>
  );
}
