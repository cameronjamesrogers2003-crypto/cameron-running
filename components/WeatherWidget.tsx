import { weatherDescription, weatherIcon, isGoodRunningWeather, type WeatherData } from "@/lib/weather";

interface WeatherWidgetProps {
  weather: WeatherData | null;
}

export default function WeatherWidget({ weather }: WeatherWidgetProps) {
  if (!weather) {
    return (
      <div
        className="rounded-xl p-3 sm:p-4 flex items-center gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="text-xl sm:text-2xl shrink-0">🌡️</span>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">Brisbane</p>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            Weather unavailable
          </p>
        </div>
      </div>
    );
  }

  const good = isGoodRunningWeather(weather.weatherCode, weather.temp);
  const desc = weatherDescription(weather.weatherCode);
  const icon = weatherIcon(weather.weatherCode);

  return (
    <div
      className="rounded-xl p-3 sm:p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-2xl sm:text-3xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-white font-bold text-lg sm:text-xl tabular-nums">{weather.temp}°C</p>
            <p className="text-xs leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
              {desc} · {weather.windSpeed} km/h wind
            </p>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:text-right shrink-0">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Brisbane
          </p>
          <span
            className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
              good ? "bg-green-950 text-green-400" : "bg-yellow-950 text-yellow-400"
            }`}
          >
            {good ? "Good for running" : "Check conditions"}
          </span>
        </div>
      </div>
    </div>
  );
}
