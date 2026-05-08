"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] w-full flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-white/10 bg-black/30 p-6 text-center space-y-4">
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-gray-400">
          An unexpected error occurred while loading this page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
