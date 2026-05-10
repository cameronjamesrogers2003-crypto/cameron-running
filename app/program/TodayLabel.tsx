/** Session-row label: "Today" vs first-day "Starts …" — props computed on Program page (Brisbane dates). */
export default function TodayLabel({
  showToday,
  startsText,
}: {
  showToday: boolean;
  startsText: string | null;
}) {
  const text = startsText ?? (showToday ? "Today" : null);
  if (!text) return null;

  return (
    <p
      className="text-xs font-semibold mt-1.5"
      style={{ color: "#a5b4fc" }}
    >
      {text}
    </p>
  );
}
