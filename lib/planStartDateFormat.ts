/** Display `yyyy-MM-dd` (ISO date) as Australian `dd/MM/yyyy`. */
export function planStartIsoYmdToAusDisplay(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const ymd = iso.slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Parse Australian `d/M/yyyy` or `dd/MM/yyyy` → `yyyy-MM-dd`, or null if invalid/empty. */
export function planStartAusDisplayToIsoYmd(aus: string): string | null {
  const t = aus.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const test = new Date(`${iso}T00:00:00Z`);
  if (
    test.getUTCFullYear() !== y
    || test.getUTCMonth() + 1 !== mo
    || test.getUTCDate() !== d
  ) {
    return null;
  }
  return iso;
}
