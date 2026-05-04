import { NextRequest, NextResponse } from "next/server";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { activityType: { in: ["running", "trail_running"] } };

  if (search) where.name = { contains: search, mode: "insensitive" };
  if (dateFrom) {
    where.date = { ...where.date, gte: brisbaneMidnightUtcForYmd(dateFrom) };
  }
  if (dateTo) {
    const endExclusive = new Date(brisbaneMidnightUtcForYmd(dateTo).getTime() + 24 * 60 * 60 * 1000);
    where.date = { ...where.date, lt: endExclusive };
  }
  if (!isNaN(distMin)) where.distanceKm = { ...where.distanceKm, gte: distMin };
  if (!isNaN(distMax)) where.distanceKm = { ...where.distanceKm, lte: distMax };
  if (!isNaN(paceMin)) where.avgPaceSecKm = { ...where.avgPaceSecKm, gte: paceMin };
  if (!isNaN(paceMax)) where.avgPaceSecKm = { ...where.avgPaceSecKm, lte: paceMax };

  const validSortFields = ["date", "distanceKm", "avgPaceSecKm", "durationSecs", "avgHeartRate"] as const;
  type SortField = typeof validSortFields[number];
  const sortField: SortField = (validSortFields as readonly string[]).includes(sortBy) ? (sortBy as SortField) : "date";
  const orderBy = { [sortField]: order } as Record<SortField, "asc" | "desc">;

  const [settingsRow, total, activities] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.count({ where }),
    prisma.activity.findMany({ where, orderBy, skip, take: perPage }),
  ]);

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  type ActivityRow = (typeof activities)[number] & { ratingBreakdown?: string | null };

  const rows = activities.map((act) => {
    const row = act as ActivityRow;
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

  const filtered = types.length > 0 ? rows.filter(r => types.includes(r.runType)) : rows;

  return NextResponse.json({
    data: filtered,
    page,
    perPage,
    total: types.length > 0 ? filtered.length : total,
    totalPages: Math.ceil((types.length > 0 ? filtered.length : total) / perPage),
  });
}
