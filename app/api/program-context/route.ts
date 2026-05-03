import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { addDays } from "date-fns";
import { fetchWeatherAtTime } from "@/lib/weather/openMeteo";

export const dynamic = "force-dynamic";

export async function GET() {
  const [profile, ratings] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 }, select: { rftpSecPerKm: true } }),
    prisma.runRating.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { activity: { select: { avgHeartRate: true, distanceKm: true } } },
    }),
  ]);

  const weatherEntries = await Promise.all(
    Array.from({ length: 7 }).map(async (_, i) => {
      const date = addDays(new Date(), i);
      const wx = await fetchWeatherAtTime(-27.4698, 153.0251, date);
      return [date.toISOString().split("T")[0], wx] as const;
    })
  );

  return NextResponse.json({
    rftpSecPerKm: profile?.rftpSecPerKm ?? null,
    recentRatings: ratings.map((r) => ({
      score: Number(r.score),
      avgHeartRate: r.activity.avgHeartRate,
      distanceKm: r.activity.distanceKm,
    })),
    weatherByDate: Object.fromEntries(weatherEntries),
  });
}
