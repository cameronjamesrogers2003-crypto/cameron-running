import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const allowed = ["name", "dateOfBirth", "heightCm"];
    const data: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) {
        if (key === "dateOfBirth") {
          data[key] = new Date(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    const profile = await prisma.profile.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        name: body.name ?? "Cameron",
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : new Date("2002-08-16"),
        heightCm: body.heightCm ?? 174,
      },
    });
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
