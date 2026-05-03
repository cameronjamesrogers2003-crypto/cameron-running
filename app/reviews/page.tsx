import { format } from "date-fns";
import prisma from "@/lib/db";
import ScorePill from "@/components/ScorePill";
import { backfillRunRatings } from "@/lib/ratingsBackfill";

export const dynamic = "force-dynamic";

function toPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function SubScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{label}</span>
        <span className="font-semibold text-white">{value.toFixed(1)}/10</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "#1f2937" }}>
        <div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.max(0, Math.min(100, value * 10))}%` }} />
      </div>
    </div>
  );
}

export default async function ReviewsPage() {
  let ratings = await prisma.runRating.findMany({
    orderBy: { activity: { date: "desc" } },
    include: { activity: true, scheduled: true },
  });

  let autoBackfillSummary: { rated: number; total: number; failed: number } | null = null;
  if (ratings.length === 0) {
    const summary = await backfillRunRatings();
    autoBackfillSummary = { rated: summary.rated, total: summary.total, failed: summary.failed };
    if (summary.rated > 0) {
      ratings = await prisma.runRating.findMany({
        orderBy: { activity: { date: "desc" } },
        include: { activity: true, scheduled: true },
      });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Run Reviews</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>All scored runs, most recent first.</p>
      </div>

      {ratings.length === 0 ? (
        <div className="space-y-3">
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          No run ratings yet.
        </div>
        {autoBackfillSummary && (
          <div className="rounded-xl p-4 text-xs" style={{ background: "#1f2937", border: "1px solid #374151", color: "#cbd5e1" }}>
            Backfill attempted automatically: rated {autoBackfillSummary.rated} of {autoBackfillSummary.total} unrated run activities ({autoBackfillSummary.failed} failed).
          </div>
        )}
      </div>
      ) : (
        <div className="space-y-4">
          {ratings.map((rating) => {
            const actualPace = rating.activity.avgPaceSecKm;
            const plannedPaceLow = rating.scheduled?.targetPaceMinKmLow ? Number(rating.scheduled.targetPaceMinKmLow) * 60 : null;
            const plannedPaceHigh = rating.scheduled?.targetPaceMinKmHigh ? Number(rating.scheduled.targetPaceMinKmHigh) * 60 : null;

            return (
              <article key={rating.id} className="space-y-3 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{format(new Date(rating.activity.date), "EEE, d MMM yyyy")}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{rating.activity.distanceKm.toFixed(2)} km • {rating.scheduled?.sessionType ?? "UNPLANNED"}</p>
                  </div>
                  <div className="[&>span]:!px-3 [&>span]:!py-1 [&>span]:!text-2xl">
                    <ScorePill score={Number(rating.score)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SubScoreBar label="Distance" value={Number(rating.distanceScore) * 10} />
                  <SubScoreBar label="Pace" value={Number(rating.paceScore) * 10} />
                  <SubScoreBar label="HR" value={Number(rating.hrScore) * 10} />
                  <SubScoreBar label="Execution" value={Number(rating.executionScore) * 10} />
                </div>

                <div className="text-sm">
                  <p className="font-semibold text-white">{rating.llmHeadline ?? "No commentary yet"}</p>
                  {rating.llmExplanation && <p className="mt-1" style={{ color: "var(--text-muted)" }}>{rating.llmExplanation}</p>}
                </div>

                {rating.heatAdjusted && (
                  <p className="text-xs" style={{ color: "#fbbf24" }}>
                    Heat-adjusted weather: {rating.weatherTempC ? `${Number(rating.weatherTempC).toFixed(1)}°C` : "—"}
                    {rating.weatherDewPointC ? `, dew point ${Number(rating.weatherDewPointC).toFixed(1)}°C` : ""}.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2" style={{ color: "var(--text-muted)" }}>
                  <p><span className="font-semibold text-white">Vs plan distance:</span> {rating.scheduled ? `${Number(rating.scheduled.currentDistanceKm).toFixed(2)} km planned vs ${rating.activity.distanceKm.toFixed(2)} km actual` : "No planned session matched"}</p>
                  <p><span className="font-semibold text-white">Vs plan pace:</span> {plannedPaceLow && plannedPaceHigh ? `${toPace(plannedPaceLow)}–${toPace(plannedPaceHigh)} planned vs ${toPace(actualPace)} actual` : `No planned pace target vs ${toPace(actualPace)} actual`}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
