"use client";

import { useEffect, useState } from "react";
import type { Day } from "@/data/trainingPlan";

export const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export function isToday(day: string | null | undefined, today: number): boolean {
  return DAY_MAP[day?.toUpperCase() ?? ""] === today;
}

function getLocalToday(): number {
  return new Date().getDay();
}

function msUntilNextLocalDay(): number {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 100);
  return nextDay.getTime() - now.getTime();
}

export default function TodayLabel({ day, enabled }: { day: Day; enabled: boolean }) {
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof window.setTimeout>;

    const updateToday = () => {
      setToday(getLocalToday());
      timeoutId = window.setTimeout(updateToday, msUntilNextLocalDay());
    };

    updateToday();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!enabled || today == null || !isToday(day, today)) return null;

  return (
    <p
      className="text-[11px] font-semibold mt-1.5"
      style={{ color: "#a5b4fc" }}
    >
      Today
    </p>
  );
}
