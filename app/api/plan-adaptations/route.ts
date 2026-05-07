import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const items = await prisma.planAdaptation.findMany({
    where: { dismissed: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: items });
}
