import prisma from "@/lib/db";
import ProgramTable, { type ProgramSession, type RecentRating, type WeatherByDate } from "@/components/ProgramTable";
import { addDays, format } from "date-fns";
import { fetchWeatherAtTime } from "@/lib/weather/openMeteo";

export const dynamic = "force-dynamic";

async function getWeatherByDate(): Promise<WeatherByDate> {
  const pairs = await Promise.all(
    Array.from({ length: 7 }).map(async (_, i) => {
      const d = addDays(new Date(), i);
      const wx = await fetchWeatherAtTime(-27.4698, 153.0251, d);
      return [format(d, "yyyy-MM-dd"), wx] as const;
    })
  );
  return Object.fromEntries(pairs);
}

function getSessionName(sessionType: string, weekNumber: number) {
  const easyEarly = ["Aerobic Base Builder", "Foundation Miles", "Easy Endurance Run", "Keep It Conversational Today"];
  const easyMid = ["Building Blocks Run", "Steady Aerobic Run", "Comfortable Miler", "Endurance Maintenance"];
  const easyPeak = ["Peak Phase Easy", "Active Recovery Run", "Tune-Up Easy"];
  const longEarly = ["Long Slow Distance", "Foundation Long Run", "Build Your Engine"];
  const longMid = ["Progressive Long Run", "The Big One", "Endurance Builder"];
  const longPeak = ["Peak Long Run", "Race Simulation Long Run"];
  const pick = (names: string[]) => names[(weekNumber - 1) % names.length];
  if (sessionType === "RACE_5K") return "Race Day — 5K Time Trial";
  if (sessionType === "RACE_10K") return "Race Day — 10K";
  if (sessionType === "RACE_HALF") return "Race Day — Half Marathon";
  if (sessionType === "LONG") return weekNumber <= 4 ? pick(longEarly) : weekNumber <= 8 ? pick(longMid) : pick(longPeak);
  if (sessionType === "EASY") return weekNumber <= 4 ? pick(easyEarly) : weekNumber <= 8 ? pick(easyMid) : pick(easyPeak);
  return `Session · ${sessionType.replaceAll("_", " ")}`;
}

function getSessionDescription(sessionType: string) {
  if (sessionType === "LONG") return "Develops endurance, mental toughness and fat-burning efficiency.";
  if (sessionType === "RACE_5K") return "Test your current fitness — run at full effort.";
  if (sessionType === "RACE_10K") return "A strong race effort to gauge your progress.";
  if (sessionType === "RACE_HALF") return "Your goal race — everything has led to this.";
  return "Builds aerobic base and teaches your body to run efficiently at low intensity.";
}

function getCoachingTips(sessionType: string, recentRatings: RecentRating[]) {
  const tips = ["Run at a pace where you can hold a full conversation — if you can't, slow down"];
  const lastThree = recentRatings.slice(0, 3);
  const hrValues = lastThree.map((r) => r.avgHeartRate).filter((v): v is number => v !== null);
  const avgHr = hrValues.length ? hrValues.reduce((sum, val) => sum + val, 0) / hrValues.length : null;
  if (avgHr !== null && avgHr > 168) {
    tips.push("Your HR has been running high lately — slow down to 8:00–9:00/km even if it feels too easy");
  }
  if (lastThree[0] && lastThree[0].score < 6) {
    tips.push("Last run was tough — today focus on completion not performance");
  }
  if (lastThree[0] && lastThree[0].distanceScore < 0.7) {
    tips.push("You've been cutting runs short — aim to hit the full distance today");
  }
  if (sessionType === "LONG") {
    tips.push("The long run should feel almost embarrassingly slow — that's correct");
  }
  return tips.slice(0, 4);
}

export default async function ProgramPage() {
  const [profile, sessions, ratings, adjustments, weatherByDate] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 }, select: { hrMax: true, hrRest: true, rftpSecPerKm: true, dateOfBirth: true } }),
    prisma.scheduledSession.findMany({
      include: {
        planned: { select: { weekNumber: true, dayOfWeek: true, sessionType: true, distanceKm: true } },
        activity: { select: { avgPaceSecKm: true, avgHeartRate: true } },
        rating: { select: { score: true, paceScore: true, hrScore: true, executionScore: true, distanceScore: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.runRating.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { score: true, distanceScore: true, activity: { select: { avgHeartRate: true, distanceKm: true } } },
    }),
    prisma.planAdjustment.findMany({ orderBy: { triggeredAt: "desc" } }),
    getWeatherByDate(),
  ]);

  const latestReasonBySession = new Map<string, string>();
  for (const a of adjustments) {
    const patch = a.patch as { scheduledSessionId?: string; scheduledId?: string };
    const id = patch?.scheduledSessionId ?? patch?.scheduledId;
    if (id && !latestReasonBySession.has(id)) latestReasonBySession.set(id, a.triggerReason);
  }

  const recentRatings: RecentRating[] = ratings.map((r) => ({
    score: Number(r.score),
    distanceScore: Number(r.distanceScore),
    avgHeartRate: r.activity.avgHeartRate,
    distanceKm: r.activity.distanceKm,
  }));

  const programSessions: ProgramSession[] = sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    weekNumber: s.planned.weekNumber,
    dayOfWeek: s.planned.dayOfWeek,
    sessionType: s.sessionType,
    status: s.status,
    currentDistanceKm: Number(s.currentDistanceKm),
    originalDistanceKm: Number(s.originalDistanceKm),
    targetPaceMinKmLow: s.targetPaceMinKmLow === null ? null : Number(s.targetPaceMinKmLow),
    targetPaceMinKmHigh: s.targetPaceMinKmHigh === null ? null : Number(s.targetPaceMinKmHigh),
    targetHrZone: s.targetHrZone,
    isAdjusted: s.isAdjusted,
    triggerReason: latestReasonBySession.get(s.id) ?? null,
    sessionName: getSessionName(s.sessionType, s.planned.weekNumber),
    sessionDescription: getSessionDescription(s.sessionType),
    coachingTips: getCoachingTips(s.sessionType, recentRatings),
    activity: s.activity,
    rating: s.rating
      ? {
          score: Number(s.rating.score),
          paceScore: Number(s.rating.paceScore),
          hrScore: Number(s.rating.hrScore),
          executionScore: Number(s.rating.executionScore),
          distanceScore: Number(s.rating.distanceScore),
        }
      : null,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h1 className="text-xl font-bold text-white">Program</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          12-week schedule with adaptive guidance, zone targets, and execution review.
        </p>
      </div>
      <ProgramTable sessions={programSessions} recentRatings={recentRatings} profile={profile} weatherByDate={weatherByDate} />
    </div>
  );
}
