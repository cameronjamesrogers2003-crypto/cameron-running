export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{
        background: "rgba(255,255,255,0.08)",
        width,
        height: height ?? "1rem",
      }}
    />
  );
}
