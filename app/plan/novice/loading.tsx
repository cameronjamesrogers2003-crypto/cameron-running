export default function Loading() {
  return (
    <div className="max-w-[680px] mx-auto w-full px-3 sm:px-4 py-6 space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-full bg-[#e2e8f0]" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 w-9 shrink-0 rounded-full bg-[#e2e8f0]" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-36 w-full rounded-2xl bg-[#e2e8f0]" />
      ))}
    </div>
  );
}
