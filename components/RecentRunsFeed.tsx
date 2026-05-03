import { formatPace, formatDuration } from "@/lib/strava";
import { formatAEST } from "@/lib/dateUtils";

interface Run {
  id: string;
  date: Date;
  distanceKm: number;
  durationSecs: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null;
  activityType: string;
}

function activityLabel(type: string): { label: string; colour: string } {
  switch (type) {
    case "running":
      return { label: "Easy Run", colour: "bg-orange-950 text-orange-400" };
    case "trail_running":
      return { label: "Trail Run", colour: "bg-amber-950 text-amber-400" };
    case "cycling":
      return { label: "Cycling", colour: "bg-blue-950 text-blue-400" };
    case "swimming":
      return { label: "Swimming", colour: "bg-cyan-950 text-cyan-400" };
    case "walking":
      return { label: "Walk", colour: "bg-teal-950 text-teal-400" };
    default:
      return { label: type, colour: "bg-gray-800 text-gray-400" };
  }
}

export default function RecentRunsFeed({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          No activities synced yet. Connect Strava to see your runs here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2
        className="text-sm font-semibold uppercase tracking-wider px-4 pt-4 pb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Recent Runs
      </h2>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {runs.map((run) => {
          const { label, colour } = activityLabel(run.activityType);
          return (
            <div key={run.id} className="flex items-center px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">
                    {run.distanceKm.toFixed(2)} km
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colour}`}>
                    {label}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {formatAEST(run.date, "EEE d MMM")}
                </p>
              </div>
              <div className="flex gap-4 text-right text-xs flex-shrink-0">
                <div>
                  <p className="text-white font-medium">{formatPace(run.avgPaceSecKm)}</p>
                  <p style={{ color: "var(--text-muted)" }}>pace</p>
                </div>
                <div>
                  <p className="text-white font-medium">{formatDuration(run.durationSecs)}</p>
                  <p style={{ color: "var(--text-muted)" }}>time</p>
                </div>
                {run.avgHeartRate && (
                  <div>
                    <p className="text-white font-medium">{run.avgHeartRate} bpm</p>
                    <p style={{ color: "var(--text-muted)" }}>avg HR</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
