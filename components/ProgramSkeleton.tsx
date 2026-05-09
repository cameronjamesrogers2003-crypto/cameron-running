import { Skeleton } from "@/components/Skeleton";

export default function ProgramSkeleton() {
  return (
    <div className="space-y-4 pt-2 pb-24 lg:pb-8">
      <Skeleton width={180} height={28} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.08] bg-[var(--card-bg)] p-4 space-y-3">
          <Skeleton width={120} height={12} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="86%" height={14} />
          <Skeleton width="72%" height={14} />
        </div>
      ))}
    </div>
  );
}
