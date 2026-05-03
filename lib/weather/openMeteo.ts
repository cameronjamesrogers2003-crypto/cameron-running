export interface WeatherAtTime {
  tempC: number;
  dewPointC: number;
  humidity: number;
}

export async function fetchWeatherAtTime(
  lat: number,
  lon: number,
  time: Date
): Promise<WeatherAtTime | null> {
  try {
    const dateStr = time.toISOString().split("T")[0];

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lon.toFixed(4));
    url.searchParams.set("hourly", "temperature_2m,dewpoint_2m,relativehumidity_2m");
    url.searchParams.set("start_date", dateStr);
    url.searchParams.set("end_date", dateStr);
    url.searchParams.set("timezone", "Australia/Brisbane");
    url.searchParams.set("past_days", "1");

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const data = await res.json();
    const hours: string[] = data.hourly?.time ?? [];
    const temps: number[] = data.hourly?.temperature_2m ?? [];
    const dews: number[] = data.hourly?.dewpoint_2m ?? [];
    const hums: number[] = data.hourly?.relativehumidity_2m ?? [];

    if (!hours.length) return null;

    // Brisbane is UTC+10, no DST
    const utcHour = time.getUTCHours();
    const brisbaneHour = ((utcHour + 10) % 24 + 24) % 24;

    let bestIdx = 0;
    let bestDiff = Infinity;
    hours.forEach((h, i) => {
      const hr = parseInt(h.split("T")[1]?.split(":")[0] ?? "0");
      const diff = Math.abs(hr - brisbaneHour);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });

    return {
      tempC: temps[bestIdx] ?? 25,
      dewPointC: dews[bestIdx] ?? 15,
      humidity: hums[bestIdx] ?? 70,
    };
  } catch {
    return null;
  }
}
