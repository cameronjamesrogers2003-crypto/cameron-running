interface ScorePillProps {
  score: number | null;
  size?: "xs" | "sm";
}

function getStyle(score: number): { bg: string; color: string } {
  if (score >= 9) return { bg: "#064e3b", color: "#34d399" }; // emerald
  if (score >= 7) return { bg: "#14532d", color: "#4ade80" }; // green
  if (score >= 5) return { bg: "#451a03", color: "#fbbf24" }; // amber
  return { bg: "#450a0a", color: "#f87171" };                   // rose
}

export default function ScorePill({ score, size = "sm" }: ScorePillProps) {
  if (score === null) return null;
  const s = getStyle(score);
  return (
    <span
      className="inline-flex items-center rounded-full font-bold"
      style={{
        background: s.bg,
        color: s.color,
        fontSize: size === "xs" ? "0.55rem" : "0.6rem",
        padding: size === "xs" ? "1px 5px" : "2px 6px",
      }}
    >
      {score.toFixed(1)}
    </span>
  );
}
