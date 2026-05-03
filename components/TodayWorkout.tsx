import { WORKOUT_BADGE, WORKOUT_COLOURS, type DayWorkout } from "@/lib/plans";

interface NextWorkout {
  dayLabel: string;
  workout: DayWorkout;
}

interface TodayWorkoutProps {
  workout: DayWorkout | null;
  week: number;
  totalWeeks: number;
  planName: string;
  bestRunTime?: string;
  onTrack: "on_track" | "behind" | "rest";
  nextWorkout?: NextWorkout | null;
}

const STATUS_STYLE = {
  on_track: { label: "On Track", className: "bg-green-950 text-green-400" },
  behind: { label: "Behind", className: "bg-red-950 text-red-400" },
  rest: { label: "Rest Day", className: "bg-gray-800 text-gray-400" },
};

export default function TodayWorkout({
  workout,
  week,
  totalWeeks,
  planName,
  bestRunTime,
  onTrack,
  nextWorkout,
}: TodayWorkoutProps) {
  const status = STATUS_STYLE[onTrack];
  const isRest = workout?.type === "rest";

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Today&apos;s Workout
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {planName} — Week {week} of {totalWeeks}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      {workout ? (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-10 rounded-full flex-shrink-0"
              style={{ background: WORKOUT_COLOURS[workout.type] }}
            />
            <div>
              <p className="text-xl font-bold text-white">{workout.label}</p>
              {workout.distanceKm && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {workout.distanceKm.toFixed(1)} km target
                </p>
              )}
              {workout.durationMins && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {workout.durationMins} minutes
                </p>
              )}
            </div>
          </div>
          <span className={`inline-block mt-3 text-xs px-2 py-0.5 rounded-full font-medium ${WORKOUT_BADGE[workout.type]}`}>
            {workout.type.replace("_", " ").replace("race ", "Race: ")}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Plan not started yet. Set your start date on the Program page.
        </p>
      )}

      {/* Next session hint on rest days */}
      {isRest && nextWorkout && (
        <div
          className="mt-4 rounded-lg px-3 py-2 text-xs flex items-center gap-2"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: WORKOUT_COLOURS[nextWorkout.workout.type] }}
          />
          <span>
            Next up:{" "}
            <span className="text-white font-medium">{nextWorkout.dayLabel}</span>
            {" — "}
            <span className="text-white font-medium">{nextWorkout.workout.label}</span>
          </span>
        </div>
      )}

      {/* Best run time — only on active training days */}
      {bestRunTime && !isRest && (
        <div
          className="mt-4 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          Best time to run today:{" "}
          <span className="text-white font-medium">{bestRunTime}</span>
        </div>
      )}
    </div>
  );
}
