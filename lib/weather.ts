import { brisbaneHour, toBrisbaneYmd } from "@/lib/dateUtils";

// ── Historical weather (Open-Meteo archive) ───────────────────────────────────

export const BRISBANE_LAT = -27.4698;
export const BRISBANE_LON = 153.0251;

/**
 * Fetches historical temperature and humidity for a given location and time from
 * Open-Meteo's free archive API. Matches the activity's AEST start hour to the
 * closest hourly reading. Returns null on any failure — never throws.
 */
export async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  date: Date
): Promise<{ temperatureC: number; humidityPct: number } | null> {
  try {
    const dateStr  = toBrisbaneYmd(date);
    const aestHour = brisbaneHour(date);

    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${dateStr}&end_date=${dateStr}` +
      "&hourly=temperature_2m,relative_humidity_2m" +
      "&timezone=Australia%2FBrisbane";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[weather] archive fetch failed HTTP ${res.status} for ${dateStr}`);
      return null;
    }

    const data = await res.json();
    const times      = data.hourly?.time as string[] | undefined;
    const temps      = data.hourly?.temperature_2m as number[] | undefined;
    // API renamed the field — handle both old and new names
    const humidities = (
      data.hourly?.relative_humidity_2m ?? data.hourly?.relativehumidity_2m
    ) as number[] | undefined;

    if (!times?.length || !temps?.length || !humidities?.length) {
      console.warn(`[weather] no hourly data for ${dateStr} at ${lat},${lon}`);
      return null;
    }

    // Find the hourly index closest to the activity's AEST start hour
    let closestIdx  = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const h    = parseInt(times[i].split("T")[1].slice(0, 2), 10);
      const diff = Math.abs(h - aestHour);
      if (diff < closestDiff) { closestDiff = diff; closestIdx = i; }
    }

    const temperatureC = temps[closestIdx];
    const humidityPct  = humidities[closestIdx];

    if (temperatureC == null || humidityPct == null) return null;

    return {
      temperatureC: Math.round(temperatureC * 10) / 10,
      humidityPct:  Math.round(humidityPct),
    };
  } catch (err) {
    console.warn("[weather] fetchHistoricalWeather error:", err);
    return null;
  }
}
