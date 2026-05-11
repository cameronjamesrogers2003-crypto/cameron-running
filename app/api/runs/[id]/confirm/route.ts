import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { persistActivityRating } from "@/lib/persistActivityRating";
import { updatePlayerRating } from "@/lib/playerRating";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  const { confirmedRunType, linkedSessionId } = body;

  if (!confirmedRunType) {
    return NextResponse.json({ error: "confirmedRunType is required" }, { status: 400 });
  }

  try {
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        confirmedRunType,
        linkedSessionId: linkedSessionId || null,
        isConfirmed: true,
      },
    });

    // Re-trigger the run rating calculation
    await persistActivityRating(prisma, id);

    // Also update the global player rating since a run's classification changed
    await updatePlayerRating(prisma, { id, activityType: activity.activityType });

    const updatedActivity = await prisma.activity.findUnique({
      where: { id },
    });

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error("[confirm run] failed:", error);
    return NextResponse.json({ error: "Failed to confirm run" }, { status: 500 });
  }
}
