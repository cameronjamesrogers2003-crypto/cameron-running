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
      include: { activity: { select: { avgHeartRate: true, distanceKm: true } } },
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

  const recentRatings: RecentRating[] = ratings.map((r) => ({
    score: Number(r.score),
    avgHeartRate: r.activity.avgHeartRate,
    distanceKm: r.activity.distanceKm,
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
