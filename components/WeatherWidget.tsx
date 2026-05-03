import { weatherDescription, weatherIcon, isGoodRunningWeather, type WeatherData } from "@/lib/weather";

interface WeatherWidgetProps {
  weather: WeatherData | null;
}

export default function WeatherWidget({ weather }: WeatherWidgetProps) {
  if (!weather) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="text-2xl">🌡️</span>
        <div>
          <p className="text-white font-semibold text-sm">Brisbane</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Weather unavailable</p>
        </div>
      </div>
    );
  }

  const good = isGoodRunningWeather(weather.weatherCode, weather.temp);
  const desc = weatherDescription(weather.weatherCode);
  const icon = weatherIcon(weather.weatherCode);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <p className="text-white font-bold text-xl">{weather.temp}°C</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {desc} · {weather.windSpeed} km/h wind
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Brisbane
          </p>
          <span
            className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
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
