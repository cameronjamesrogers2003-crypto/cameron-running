import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const row = await prisma.planInterruption.update({
    where: { id },
    data: {
      ...(body.reason    != null               ? { reason:           body.reason }                                               : {}),
      ...(body.type      != null               ? { type:             body.type }                                                 : {}),
      ...(body.startDate != null               ? { startDate:        new Date(body.startDate) }                                  : {}),
      ...(body.endDate   !== undefined         ? { endDate:          body.endDate ? new Date(body.endDate) : null }              : {}),
      ...(body.weeklyKmEstimate !== undefined  ? { weeklyKmEstimate: body.weeklyKmEstimate != null ? Number(body.weeklyKmEstimate) : null } : {}),
      ...(body.notes     !== undefined         ? { notes:            body.notes || null }                                        : {}),
      ...(body.weeksAffected !== undefined     ? { weeksAffected:    body.weeksAffected != null ? parseInt(String(body.weeksAffected), 10) : null } : {}),
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.planInterruption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
