export interface WeatherData {
  temp: number;
  weatherCode: number;
  windSpeed: number;
  hourlyTemps?: number[];
  hourlyTimes?: string[];
}

export async function getBrisbaneWeather(): Promise<WeatherData | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=-27.4698&longitude=153.0251" +
      "&current=temperature_2m,weathercode,windspeed_10m" +
      "&hourly=temperature_2m" +
      "&forecast_days=1" +
      "&timezone=Australia%2FBrisbane";

    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weathercode,
      windSpeed: Math.round(data.current.windspeed_10m),
      hourlyTemps: data.hourly?.temperature_2m,
      hourlyTimes: data.hourly?.time,
    };
  } catch {
    return null;
  }
}

export function weatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 49) return "🌫️";
  if (code <= 69) return "🌧️";
  if (code <= 79) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

export function isGoodRunningWeather(code: number, temp: number): boolean {
  return code <= 3 && temp >= 5 && temp <= 30;
}

export function getBestRunTime(
  hourlyTemps: number[] | undefined,
  hourlyTimes: string[] | undefined
): string {
  if (!hourlyTemps || !hourlyTimes) return "6–8am";

  let bestIdx = 0;
  let bestScore = Infinity;

  hourlyTemps.forEach((temp, i) => {
    const hour = parseInt(hourlyTimes![i].split("T")[1].split(":")[0]);
    if (hour < 5 || hour > 10) return;
    const score = Math.abs(temp - 17);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  const hour = parseInt(hourlyTimes[bestIdx].split("T")[1].split(":")[0]);
  const temp = Math.round(hourlyTemps[bestIdx]);
  return `${hour}–${hour + 2}am (${temp}°C)`;
}

export function getSeasonalTip(month: number): string {
  const tips: Record<number, string> = {
    5: "Brisbane's humidity is dropping — you'll notice your breathing feels easier than summer. Great time to build your base.",
    6: "Peak running season in Brisbane. Cool, dry mornings are ideal. Aim for early starts before 8am to make the most of it.",
    7: "Brisbane's best running month — low humidity, clear skies, crisp mornings around 11°C. Layer up at the start, you'll warm up fast.",
    8: "Driest month of the year. Stay hydrated — the dry air is deceptive. UV is climbing as spring approaches, use sunscreen.",
    9: "Spring is warming up. Humidity starts rising — slow your pace on humid days and hydrate more.",
    10: "Summer is approaching. Run early (before 7am) to beat the heat and humidity.",
    11: "Humidity is rising sharply. Prioritise early morning runs and carry water on anything over 8 km.",
    12: "Brisbane summer — hot and humid. Run at dawn or skip to a treadmill when it's above 28°C.",
    1: "Peak summer. Run before 6:30am. Stay hydrated and consider shorter distances.",
    2: "Still hot and humid. The end of summer is near — keep your base running.",
    3: "Humidity starting to ease. Still warm — morning runs are the move.",
    4: "Autumn arriving. Conditions improving. Great time to extend your long runs.",
  };
  return tips[month] ?? "Keep up the training — consistency is key.";
}
