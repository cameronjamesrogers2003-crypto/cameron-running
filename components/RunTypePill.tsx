import { runTypeColor, runTypeBg, runTypeLabel } from "@/lib/runTypeStyles";

interface RunTypePillProps {
  type: string | null | undefined;
  size?: "sm" | "md";
}

export function RunTypePill({ type, size = "md" }: RunTypePillProps) {
  const color = runTypeColor(type);
  const bg = runTypeBg(type);
  const label = runTypeLabel(type);

  const padding = size === "sm" ? "3px 8px" : "4px 10px";
  const fontSize = "12px";
  const dotSize = size === "sm" ? 5 : 6;

  return (
    <span
      style={{
        color,
        background: bg,
        padding,
        borderRadius: "999px",
        fontSize,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        whiteSpace: "nowrap",
        border: `1px solid ${color}22`,
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
