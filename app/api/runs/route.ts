import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { inferRunType, type RunType } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { brisbaneMidnightUtcForYmd, toBrisbaneYmd } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const page    = Math.max(1, parseInt(sp.get("page")    ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") ?? "25", 10)));
  const skip    = (page - 1) * perPage;

  const types    = sp.get("type")?.split(",").filter(Boolean) ?? [];
  const search   = sp.get("search") ?? "";
  const dateFrom = sp.get("dateFrom");
  const dateTo   = sp.get("dateTo");
  const distMin  = parseFloat(sp.get("distMin") ?? "");
  const distMax  = parseFloat(sp.get("distMax") ?? "");
  const paceMin  = parseInt(sp.get("paceMin") ?? "", 10);
  const paceMax  = parseInt(sp.get("paceMax") ?? "", 10);
  const sortBy   = sp.get("sort")  ?? "date";
  const order    = sp.get("order") === "asc" ? "asc" : "desc";

  const where: Prisma.ActivityWhereInput = {
    activityType: { in: ["running", "trail_running"] },
  };
  const dateFilter: Prisma.DateTimeFilter = {};
  const distanceFilter: Prisma.FloatFilter = {};
  const paceFilter: Prisma.IntFilter = {};

  if (search) where.name = { contains: search, mode: "insensitive" };
  if (dateFrom) {
    dateFilter.gte = brisbaneMidnightUtcForYmd(dateFrom);
  }
  if (dateTo) {
    const endExclusive = new Date(brisbaneMidnightUtcForYmd(dateTo).getTime() + 24 * 60 * 60 * 1000);
    dateFilter.lt = endExclusive;
  }
  if (!isNaN(distMin)) distanceFilter.gte = distMin;
  if (!isNaN(distMax)) distanceFilter.lte = distMax;
  if (!isNaN(paceMin)) paceFilter.gte = paceMin;
  if (!isNaN(paceMax)) paceFilter.lte = paceMax;

  if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
  if (Object.keys(distanceFilter).length > 0) where.distanceKm = distanceFilter;
  if (Object.keys(paceFilter).length > 0) where.avgPaceSecKm = paceFilter;
  const whereWithTypes: Prisma.ActivityWhereInput =
    types.length > 0
      ? { ...where, classifiedRunType: { in: types } }
      : where;

  const validSortFields = ["date", "distanceKm", "avgPaceSecKm", "durationSecs", "avgHeartRate"] as const;
  type SortField = typeof validSortFields[number];
  const sortField: SortField = (validSortFields as readonly string[]).includes(sortBy) ? (sortBy as SortField) : "date";
  const orderBy = { [sortField]: order } as Record<SortField, "asc" | "desc">;

  const [settingsRow, total, activities] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.count({ where: whereWithTypes }),
    prisma.activity.findMany({ where: whereWithTypes, orderBy, skip, take: perPage }),
  ]);

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  const rows = activities.map((row) => {
    const runType: RunType = inferRunType(row, settings);
    const rating = row.rating != null && !Number.isNaN(row.rating) ? row.rating : null;

    return {
      id: row.id,
      name: row.name,
      dateIso: row.date.toISOString(),
      dateAest: toBrisbaneYmd(row.date),
      distanceKm: row.distanceKm,
      durationSecs: row.durationSecs,
      avgPaceSecKm: row.avgPaceSecKm,
      avgHeartRate: row.avgHeartRate,
      maxHeartRate: row.maxHeartRate,
      calories: row.calories,
      elevationGainM: row.elevationGainM,
      temperatureC: row.temperatureC,
      humidityPct: row.humidityPct,
      activityType: row.activityType,
      runType,
      rating,
      ratingBreakdown: row.ratingBreakdown ?? null,
    };
  });

  return NextResponse.json({
    data: rows,
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
}
