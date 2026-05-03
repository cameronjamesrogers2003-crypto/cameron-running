import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const ratings = await prisma.runRating.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      activity: { select: { date: true } },
    },
  });

  return NextResponse.json(
    ratings.map(r => ({
      id: r.id,
      activityId: r.activityId,
      date: r.activity.date.toISOString(),
      score: Number(r.score),
      llmHeadline: r.llmHeadline,
      llmExplanation: r.llmExplanation,
      heatAdjusted: r.heatAdjusted,
    }))
  );
}
