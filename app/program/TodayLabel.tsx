/** Mutually exclusive session-row labels — variant chosen on Program page (Brisbane dates). */
export type SessionDayLabelVariant = "today" | "startDay" | "missed";

const LABEL: Record<
  SessionDayLabelVariant,
  { text: string; color: string }
> = {
  today: { text: "Today", color: "#a5b4fc" },
  startDay: { text: "Start Day", color: "var(--accent)" },
  missed: { text: "Missed", color: "#f59e0b" },
};

export default function TodayLabel({ variant }: { variant: SessionDayLabelVariant | null }) {
  if (!variant) return null;
  const { text, color } = LABEL[variant];

  return (
    <p
      className="text-xs font-semibold mt-1.5"
      style={{ color }}
    >
      {text}
    </p>
  );
}
