import { Skeleton } from "@/components/Skeleton";

export default function RunsListSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[var(--card-bg)] p-2 sm:p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.06] last:border-b-0"
        >
          <Skeleton width={160} height={14} />
          <Skeleton width={72} height={20} className="rounded-full" />
          <Skeleton width={90} height={14} />
          <Skeleton width={90} height={14} />
          <Skeleton width={70} height={14} className="hidden md:block" />
          <Skeleton width={90} height={14} className="hidden md:block" />
        </div>
      ))}
    </div>
  );
}
