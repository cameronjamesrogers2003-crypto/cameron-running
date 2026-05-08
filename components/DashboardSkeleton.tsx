import { Skeleton } from "@/components/Skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4 pt-2 pb-24 lg:pb-8">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5">
        <Skeleton className="mb-4" width={140} height={18} />
        <div className="space-y-3">
          <Skeleton width="100%" height={10} />
          <Skeleton width="88%" height={10} />
          <Skeleton width="76%" height={10} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
            <Skeleton className="mb-3" width={90} height={12} />
            <Skeleton width={70} height={30} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <Skeleton width={120} height={12} className="mb-4" />
        <Skeleton width="100%" height={220} />
      </div>
    </div>
  );
}
