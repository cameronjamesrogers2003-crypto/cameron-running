import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { buildTrainingPlan } from "@/data/trainingPlan";
import { calculateRunRating, resolveRunType, resolveTargetPaceSecKm } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { toAEST } from "@/lib/dateUtils";

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

  // Build Prisma where clause (filters on DB fields)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { activityType: { in: ["running", "trail_running"] } };

  if (search)   where.name = { contains: search, mode: "insensitive" };
  if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
  if (dateTo)   where.date = { ...where.date, lte: new Date(dateTo) };
  if (!isNaN(distMin)) where.distanceKm = { ...where.distanceKm, gte: distMin };
  if (!isNaN(distMax)) where.distanceKm = { ...where.distanceKm, lte: distMax };
  if (!isNaN(paceMin)) where.avgPaceSecKm = { ...where.avgPaceSecKm, gte: paceMin };
  if (!isNaN(paceMax)) where.avgPaceSecKm = { ...where.avgPaceSecKm, lte: paceMax };

  const validSortFields = ["date", "distanceKm", "avgPaceSecKm", "durationSecs", "avgHeartRate"] as const;
  type SortField = typeof validSortFields[number];
  const sortField: SortField = (validSortFields as readonly string[]).includes(sortBy) ? (sortBy as SortField) : "date";
  const orderBy = { [sortField]: order } as Record<SortField, "asc" | "desc">;

  const [settingsRow, profileRow, bestPaceRow, total, activities] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.activity.findFirst({
      where:   { activityType: { in: ["running", "trail_running"] } },
      orderBy: { avgPaceSecKm: "asc" },
    }),
    prisma.activity.count({ where }),
    prisma.activity.findMany({ where, orderBy, skip, take: perPage }),
  ]);

  const settings    = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const ratingPlan  = buildTrainingPlan(settings);
  const athleteAge  = profileRow?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profileRow.dateOfBirth).getTime()) / (365.25 * 86400000))
    : 23;
  const pbPaceSecKm = bestPaceRow?.avgPaceSecKm ?? null;

  const distTargets: Record<string, number> = {
    easy:     settings.distTargetEasyM     / 1000,
    tempo:    settings.distTargetTempoM    / 1000,
    interval: settings.distTargetIntervalM / 1000,
    long:     settings.distTargetLongM     / 1000,
  };

  const rows = activities.map(act => {
    const runType = resolveRunType(act, ratingPlan);
    const hasRating = act.avgPaceSecKm > 0 && act.avgHeartRate != null;
    const rating = hasRating
      ? calculateRunRating({
          distanceKm: act.distanceKm, avgPaceSecKm: act.avgPaceSecKm,
          avgHeartRate: act.avgHeartRate, temperatureC: act.temperatureC,
          humidityPct: act.humidityPct, runType,
          personalBestPaceSecKm: pbPaceSecKm, athleteAgeYears: athleteAge,
          maxHROverride: settings.maxHR,
          distTargetKmOverride: distTargets[runType],
          targetPaceSecKmOverride: resolveTargetPaceSecKm(act, ratingPlan),
        })
      : null;

    const aest = toAEST(new Date(act.date));
    return {
      id: act.id,
      name: act.name,
      dateIso: act.date.toISOString(),
      dateAest: `${aest.getUTCFullYear()}-${String(aest.getUTCMonth()+1).padStart(2,"0")}-${String(aest.getUTCDate()).padStart(2,"0")}`,
      distanceKm: act.distanceKm,
      durationSecs: act.durationSecs,
      avgPaceSecKm: act.avgPaceSecKm,
      avgHeartRate: act.avgHeartRate,
      maxHeartRate: act.maxHeartRate,
      calories: act.calories,
      elevationGainM: act.elevationGainM,
      temperatureC: act.temperatureC,
      humidityPct: act.humidityPct,
      activityType: act.activityType,
      runType,
      rating,
    };
  });

  // Post-filter by run type (computed after DB query)
  const filtered = types.length > 0 ? rows.filter(r => types.includes(r.runType)) : rows;

  return NextResponse.json({
    data: filtered,
    page,
    perPage,
    total: types.length > 0 ? filtered.length : total,
    totalPages: Math.ceil((types.length > 0 ? filtered.length : total) / perPage),
  });
}
