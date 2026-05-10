import prisma from "./db";
import { persistActivityRating } from "./persistActivityRating";
import { updatePlayerRating } from "./playerRating";
import { checkAndAdaptPlan } from "./planAdaptation";
import { toBrisbaneYmd } from "./dateUtils";
import { fetchHistoricalWeather, BRISBANE_LAT, BRISBANE_LON } from "./weather";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

function getStravaEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  return {
    clientId: process.env.STRAVA_CLIENT_ID ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
    redirectUri: process.env.STRAVA_REDIRECT_URI ?? "",
  };
}

export function getStravaAuthUrl(): string {
  const { clientId, redirectUri } = getStravaEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
  });
  return `${STRAVA_AUTH_URL}?${params}`;
}

export async function exchangeStravaCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const { clientId, clientSecret } = getStravaEnv();
  // Use form-encoded: Strava's token endpoint requires client_id as a number,
  // which URLSearchParams handles correctly (vs JSON where env vars are strings).
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[strava] token exchange failed:", res.status, text);
    throw new Error(`Strava token exchange failed: ${res.status} — ${text}`);
  }

  return res.json();
}

export async function refreshStravaToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const { clientId, clientSecret } = getStravaEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[strava] token refresh failed:", res.status, text);
    throw new Error(`Strava token refresh failed: ${res.status} — ${text}`);
  }

  return res.json();
}

async function getValidToken(): Promise<string | null> {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  if (!profile?.stravaToken) return null;

  const now = new Date();
  const expiry = profile.stravaTokenExpiry;
  // Refresh 60 seconds early to avoid edge-case expiry
  if (expiry && expiry.getTime() - 60_000 > now.getTime()) return profile.stravaToken;

  if (!profile.stravaRefresh) return null;

  try {
    const tokens = await refreshStravaToken(profile.stravaRefresh);
    const newExpiry = new Date(tokens.expires_at * 1000);
    await prisma.profile.update({
      where: { id: 1 },
      data: {
        stravaToken: tokens.access_token,
        stravaRefresh: tokens.refresh_token,
        stravaTokenExpiry: newExpiry,
      },
    });
    return tokens.access_token;
  } catch {
    return null;
  }
}

interface StravaActivity {
  id: number;
  name?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  kilojoules?: number;
  sport_type: string;
  type: string;
  total_elevation_gain?: number;
  start_latlng?: [number, number];
  manual?: boolean;
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
}

export interface StravaFullActivity extends StravaActivity {
  elapsed_time: number;
  splits_metric?: StravaSplit[];
}

export async function fetchFullActivity(activityId: string): Promise<StravaFullActivity | null> {
  const token = await getValidToken();
  if (!token) return null;

  const res = await fetch(
    `${STRAVA_API}/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.error("[strava] fetchFullActivity failed:", res.status);
    return null;
  }

  return res.json();
}

function sportTypeToLabel(sportType: string): string {
  switch (sportType) {
    case "Run":
    case "VirtualRun":
      return "running";
    case "TrailRun":
      return "trail_running";
    case "Ride":
    case "VirtualRide":
    case "EBikeRide":
    case "GravelRide":
      return "cycling";
    case "Swim":
      return "swimming";
    case "Walk":
    case "Hike":
      return "walking";
    default:
      return sportType.toLowerCase();
  }
}

export async function syncActivities(): Promise<{ synced: number; errors: number; playerRatingError?: string }> {
  const token = await getValidToken();
  if (!token) return { synced: 0, errors: 0 };

  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const perPage = 50;
  let page = 1;
  const allActivities: StravaActivity[] = [];

  while (true) {
    const res = await fetch(
      `${STRAVA_API}/athlete/activities?after=${thirtyDaysAgo}&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return { synced: 0, errors: 1 };

    const batch: StravaActivity[] = await res.json();
    if (batch.length === 0) break;
    allActivities.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  const activities = allActivities.sort((a: StravaActivity, b: StravaActivity) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  let synced = 0;
  let errors = 0;
  let playerRatingError: string | undefined;

  async function refreshPlayerRating(id: string, activityType: string): Promise<void> {
    try {
      await updatePlayerRating(prisma, { id, activityType });
      try {
        await checkAndAdaptPlan(prisma);
      } catch (err) {
        console.error("Plan adaptation error:", err);
      }
    } catch (err) {
      console.error("[player-rating] update failed:", err);
      playerRatingError = "Player rating failed to update";
    }
  }

  const fiveDaysAgoMs = Date.now() - 5 * 24 * 60 * 60 * 1000;

  for (const act of activities) {
    try {
      const id = String(act.id);
      const existing = await prisma.activity.findUnique({
        where: { id },
        select: {
          id: true,
          elevationGainM: true,
          temperatureC: true,
          date: true,
          startLat: true,
          startLon: true,
          activityType: true,
          weatherFetchedAt: true,
        },
      });
      if (existing) {
        const gain = act.total_elevation_gain;
        if (gain != null && gain !== existing.elevationGainM) {
          await prisma.activity.update({
            where: { id },
            data: { elevationGainM: gain },
          });
        }
        const daysSinceRun = Math.floor(
          (Date.now() - new Date(existing.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        const archiveMayLag = daysSinceRun >= 0 && daysSinceRun < 2;
        const shouldRetryWeather =
          existing.temperatureC == null
          && (archiveMayLag
            || existing.weatherFetchedAt == null
            || existing.weatherFetchedAt.getTime() < fiveDaysAgoMs);

        if (shouldRetryWeather) {
          try {
            const weather = await fetchHistoricalWeather(
              existing.startLat ?? BRISBANE_LAT,
              existing.startLon ?? BRISBANE_LON,
              existing.date,
            );
            if (weather) {
              await prisma.activity.update({
                where: { id: existing.id },
                data: {
                  temperatureC: weather.temperatureC,
                  humidityPct: weather.humidityPct,
                  weatherFetchedAt: new Date(),
                },
              });
              console.log(
                `[weather] filled missing weather for existing activity ${existing.id}`,
              );
            } else {
              console.warn(
                `[weather] no weather data returned for existing activity ${existing.id} on ${toBrisbaneYmd(existing.date)}`,
              );
              await prisma.activity.update({
                where: { id: existing.id },
                data: { weatherFetchedAt: new Date() },
              });
            }
          } catch (err) {
            console.warn(
              `[weather] failed to fill weather for existing activity ${existing.id}:`,
              err,
            );
            await prisma.activity
              .update({
                where: { id: existing.id },
                data: { weatherFetchedAt: new Date() },
              })
              .catch((markErr: unknown) => {
                console.error("[strava] failed to mark weatherFetchedAt:", existing.id, markErr);
              });
          }
        }

        await persistActivityRating(prisma, id).catch((err: unknown) => {
          console.error("[strava] persistActivityRating failed for existing activity:", id, err);
        });
        await refreshPlayerRating(id, existing.activityType);
        continue;
      }

      // average_speed is m/s → convert to sec/km
      const avgPaceSecKm = act.average_speed > 0 ? Math.round(1000 / act.average_speed) : 0;

      // Strava gives kilojoules for cycling, calories for running
      const calories = act.calories
        ? Math.round(act.calories)
        : act.kilojoules
        ? Math.round(act.kilojoules * 0.239)
        : null;

      const actDate  = new Date(act.start_date);
      const startLat = act.start_latlng?.[0] ?? null;
      const startLon = act.start_latlng?.[1] ?? null;

      const activityType = sportTypeToLabel(act.sport_type || act.type);

      await prisma.activity.create({
        data: {
          id,
          name:           act.name ?? null,
          date:           actDate,
          distanceKm:     act.distance / 1000,
          durationSecs:   act.moving_time,
          avgPaceSecKm,
          avgHeartRate:   act.average_heartrate ? Math.round(act.average_heartrate) : null,
          maxHeartRate:   act.max_heartrate     ? Math.round(act.max_heartrate)     : null,
          calories,
          activityType,
          elevationGainM: act.total_elevation_gain ?? null,
          startLat,
          startLon,
          splitsJson: null,
        },
      });

      try {
        const detailed = await fetchFullActivity(id);
        const splits = Array.isArray(detailed?.splits_metric) ? detailed.splits_metric : null;
        const detailElev = detailed?.total_elevation_gain;
        await prisma.activity.update({
          where: { id },
          data: {
            splitsJson: splits ? JSON.stringify(splits) : null,
            ...(detailElev != null ? { elevationGainM: detailElev } : {}),
          },
        });
      } catch (splitErr) {
        console.error("[strava] splits fetch failed:", splitErr);
      }

      // Fetch and store historical weather inline
      const weather = await fetchHistoricalWeather(
        startLat ?? BRISBANE_LAT,
        startLon ?? BRISBANE_LON,
        actDate
      );
      if (weather) {
        await prisma.activity.update({
          where: { id },
          data: {
            temperatureC: weather.temperatureC,
            humidityPct: weather.humidityPct,
            weatherFetchedAt: new Date(),
          },
        });
        console.log(
          `[weather] fetched weather for new activity ${id}: ${weather.temperatureC}°C, ${weather.humidityPct}% humidity`,
        );
      } else {
        console.warn(
          `[weather] no weather data for new activity ${id} on ${toBrisbaneYmd(actDate)} at lat=${startLat ?? BRISBANE_LAT} lon=${startLon ?? BRISBANE_LON}`,
        );
      }

      await persistActivityRating(prisma, id).catch((err: unknown) => {
        console.error("[strava] persistActivityRating failed for new activity:", id, err);
      });
      await refreshPlayerRating(id, activityType);

      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors, ...(playerRatingError ? { playerRatingError } : {}) };
}

export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  const mins = Math.floor(secPerKm / 60);
  const secs = secPerKm % 60;
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
