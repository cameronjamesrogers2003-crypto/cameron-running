export function getStartOfTrainingWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  // day: 0=Sun, 1=Mon, ..., 6=Sat
  // Monday start: if Sun (0), go back 6 days. If Mon (1), go back 0. If Tue (2), go back 1.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
