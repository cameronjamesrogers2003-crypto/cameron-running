"use client";

import { WORKOUT_COLOURS, TRAINING_DAYS, type WeekPlan, type DayKey, DAY_KEYS, DAY_LABELS } from "@/lib/plans";
import { format, addDays } from "date-fns";

interface ProgramTableProps {
  plan: WeekPlan[];
  currentWeek: number;
  planStartDate: Date | null;
  completedDays: Set<string>;
}

function TrainingCell({
  workout,
  isToday,
  done,
  date,
}: {
  workout: import("@/lib/plans").DayWorkout;
  isToday: boolean;
  done: boolean;
  date?: Date;
}) {
  return (
    <td className="p-1.5" style={{ width: 120 }}>
      <div
        className="rounded-lg p-2 text-xs relative"
        style={{
          background: done ? "rgba(249,115,22,0.1)" : "var(--surface-2)",
          border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
          minHeight: 60,
        }}
      >
        {date && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.6rem" }} className="mb-1">
            {format(date, "d MMM")}
          </p>
        )}

        {workout.type === "rest" ? (
          <p className="font-medium" style={{ color: "var(--text-muted)" }}>Rest</p>
        ) : workout.type === "cross" ? (
          <div>
            <div className="w-1.5 h-1.5 rounded-full mb-1" style={{ background: "#3b82f6" }} />
            <p className="font-semibold" style={{ color: "#3b82f6" }}>
              {workout.durationMins}min cross
            </p>
          </div>
        ) : (
          <div>
            <div
              className="w-1.5 h-1.5 rounded-full mb-1"
              style={{ background: WORKOUT_COLOURS[workout.type] }}
            />
            <p className="font-semibold text-white leading-tight">
              {workout.distanceKm ? `${workout.distanceKm.toFixed(1)} km` : workout.label}
            </p>
            <p className="mt-0.5 capitalize" style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>
              {workout.type === "sorta_long" ? "sorta long" : workout.type.replace("race_", "")}
            </p>
          </div>
        )}

        {done && (
          <span
            className="absolute top-1 right-1.5 text-xs font-bold"
            style={{ color: "var(--accent)" }}
          >
            ✓
          </span>
        )}
        {isToday && !done && workout.type !== "rest" && (
          <span
            className="absolute top-1 right-1.5 text-xs font-bold"
            style={{ color: "var(--accent)", fontSize: "0.55rem" }}
          >
            TODAY
          </span>
        )}
      </div>
    </td>
  );
}

function RestCell({ isToday }: { isToday: boolean }) {
  return (
    <td className="p-1" style={{ width: 36 }}>
      <div
        className="flex items-center justify-center rounded text-xs"
        style={{
          height: 60,
          background: isToday ? "rgba(249,115,22,0.05)" : "transparent",
          border: isToday ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent",
          color: "var(--border)",
        }}
      >
        —
      </div>
    </td>
  );
}

export default function ProgramTable({
  plan,
  currentWeek,
  planStartDate,
  completedDays,
}: ProgramTableProps) {
  function getDate(weekIdx: number, dayIdx: number): Date | undefined {
    if (!planStartDate) return undefined;
    return addDays(planStartDate, weekIdx * 7 + dayIdx);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            {/* Week col */}
            <th
              className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", width: 56 }}
            >
              Week
            </th>

            {DAY_KEYS.map((day) => {
              const isTraining = TRAINING_DAYS.has(day);
              return (
                <th
                  key={day}
                  className="py-2 text-xs font-semibold uppercase tracking-wider text-center"
                  style={{
                    color: isTraining ? "var(--text-muted)" : "var(--border)",
                    width: isTraining ? 120 : 36,
                    paddingLeft: isTraining ? 6 : 0,
                    paddingRight: isTraining ? 6 : 0,
                  }}
                >
                  {DAY_LABELS[day]}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {plan.map((week, weekIdx) => {
            const isCurrentWeek = week.week === currentWeek;
            return (
              <tr
                key={week.week}
                style={{
                  background: isCurrentWeek ? "rgba(249,115,22,0.04)" : "transparent",
                }}
              >
                {/* Week number */}
                <td className="px-3 py-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-sm font-bold"
                      style={{ color: isCurrentWeek ? "var(--accent)" : "var(--text-muted)" }}
                    >
                      {week.week}
                    </span>
                    {isCurrentWeek && (
                      <span
                        className="rounded-full font-semibold"
                        style={{
                          background: "var(--accent)",
                          color: "#fff",
                          fontSize: "0.55rem",
                          padding: "2px 5px",
                        }}
                      >
                        NOW
                      </span>
                    )}
                  </div>
                </td>

                {(DAY_KEYS as DayKey[]).map((dayKey, dayIdx) => {
                  const date = getDate(weekIdx, dayIdx);
                  let isToday = false;
                  let done = false;

                  if (date) {
                    const d = new Date(date);
                    d.setHours(0, 0, 0, 0);
                    isToday = d.getTime() === today.getTime();
                    done = completedDays.has(d.toISOString().split("T")[0]);
                  }

                  if (!TRAINING_DAYS.has(dayKey)) {
                    return <RestCell key={dayKey} isToday={isToday} />;
                  }

                  return (
                    <TrainingCell
                      key={dayKey}
                      workout={week[dayKey]}
                      isToday={isToday}
                      done={done}
                      date={date}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
