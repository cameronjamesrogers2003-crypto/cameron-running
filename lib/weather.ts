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
    const dateStr = toBrisbaneYmd(date);
    const aestHour = brisbaneHour(date);

    const today = new Date();
    const runDate = new Date(date);
    const daysDiff = Math.floor(
      (today.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff >= 0 && daysDiff < 2) {
      console.warn(
        `[weather] Run is only ${daysDiff} day(s) old. Open-Meteo archive API may not have data yet for dates within 2 days. Will retry on next sync.`,
      );
    }

    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${dateStr}&end_date=${dateStr}` +
      "&hourly=temperature_2m,relative_humidity_2m" +
      "&timezone=Australia%2FBrisbane";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(
        `[weather] HTTP ${res.status} for ${dateStr} at ${lat},${lon} — URL: ${url}`,
      );
      return null;
    }

    const data = await res.json();
    const times = data.hourly?.time as string[] | undefined;
    const temps = data.hourly?.temperature_2m as number[] | undefined;
    // API renamed the field — handle both old and new names
    const humidities = (
      data.hourly?.relative_humidity_2m ?? data.hourly?.relativehumidity_2m
    ) as number[] | undefined;

    if (!times?.length || !temps?.length || !humidities?.length) {
      console.warn(
        `[weather] Empty hourly data for ${dateStr}. Response keys: ${Object.keys(data.hourly ?? {}).join(", ")}. times: ${times?.length ?? 0}, temps: ${temps?.length ?? 0}, humidities: ${humidities?.length ?? 0}`,
      );
      return null;
    }

    // Find the hourly index closest to the activity's AEST start hour
    let closestIdx = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const tPart = times[i]?.split("T")[1];
      const h = tPart ? parseInt(tPart.slice(0, 2), 10) : NaN;
      if (Number.isNaN(h)) continue;
      const diff = Math.abs(h - aestHour);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }

    if (!Number.isFinite(closestDiff)) {
      console.warn(
        `[weather] Could not parse hourly times for ${dateStr}; sample: ${times[0] ?? "none"}`,
      );
      return null;
    }

    const temperatureC = temps[closestIdx];
    const humidityPct = humidities[closestIdx];

    if (temperatureC == null || humidityPct == null) {
      console.warn(
        `[weather] Null sample at index ${closestIdx} for ${dateStr} (aestHour=${aestHour})`,
      );
      return null;
    }

    return {
      temperatureC: Math.round(temperatureC * 10) / 10,
      humidityPct: Math.round(humidityPct),
    };
  } catch (err) {
    console.warn("[weather] fetchHistoricalWeather error:", err);
    return null;
  }
}
