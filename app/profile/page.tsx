import prisma from "@/lib/db";
import { differenceInYears, format } from "date-fns";
import WeightTracker from "@/components/WeightTracker";
import ProfileEditor from "@/components/ProfileEditor";

function calcBMI(weightKg: number, heightCm: number): string {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  return bmi.toFixed(1);
}

function mifflinCalories(weightKg: number, heightCm: number, ageYears: number, durationSecs: number): number {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const mets = 9;
  const hours = durationSecs / 3600;
  return Math.round(mets * weightKg * hours);
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, settings, weightEntries, allActivities, latestWeight] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.weightEntry.findMany({ orderBy: { loggedAt: "desc" }, take: 20 }),
    prisma.activity.findMany({ where: { activityType: { in: ["running", "trail_running"] } }, orderBy: { date: "asc" } }),
    prisma.weightEntry.findFirst({ orderBy: { loggedAt: "desc" } }),
  ]);

  const dob = profile?.dateOfBirth ? new Date(profile.dateOfBirth) : new Date("2002-08-16");
  const age = differenceInYears(new Date(), dob);
  const name = profile?.name ?? "Cameron";
  const heightCm = profile?.heightCm ?? 174;
  const weightKg = latestWeight?.weightKg ?? 67;

  const totalKm = allActivities.reduce((s, a) => s + a.distanceKm, 0);
  const totalSecs = allActivities.reduce((s, a) => s + a.durationSecs, 0);
  const longestRun = allActivities.reduce((m, a) => Math.max(m, a.distanceKm), 0);

  const totalCalories = allActivities.reduce(
    (s, a) => s + mifflinCalories(weightKg, heightCm, age, a.durationSecs),
    0
  );

  const first3 = allActivities.slice(0, 3).filter((a) => a.avgPaceSecKm > 0);
  const last3 = allActivities.slice(-3).filter((a) => a.avgPaceSecKm > 0);
  const avgFirst = first3.length ? Math.round(first3.reduce((s, a) => s + a.avgPaceSecKm, 0) / first3.length) : 0;
  const avgLast = last3.length ? Math.round(last3.reduce((s, a) => s + a.avgPaceSecKm, 0) / last3.length) : 0;
  const paceImprovement = avgFirst && avgLast ? avgFirst - avgLast : 0;

  const totalHours = Math.floor(totalSecs / 3600);
  const totalMins = Math.floor((totalSecs % 3600) / 60);

  const activePlan = settings?.activePlan ?? "half";
  const halfDone = settings?.halfCompleted ?? false;
  const planStart = settings?.planStartDate ? format(new Date(settings.planStartDate), "d MMMM yyyy") : "Not set";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Your personal details and training stats
        </p>
      </div>

      {/* Personal details */}
      <ProfileEditor
        name={name}
        dob={format(dob, "yyyy-MM-dd")}
        heightCm={heightCm}
        weightKg={weightKg}
      />

      {/* Stats summary */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Training Stats
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat label="Total Distance" value={`${totalKm.toFixed(1)} km`} />
          <Stat label="Time on Feet" value={`${totalHours}h ${totalMins}m`} />
          <Stat label="Calories Burned" value={totalCalories > 0 ? `~${totalCalories.toLocaleString()} kcal` : "—"} />
          <Stat label="Longest Run" value={longestRun > 0 ? `${longestRun.toFixed(2)} km` : "—"} />
          <Stat
            label="Pace Improvement"
            value={
              paceImprovement > 0
                ? `${Math.floor(paceImprovement / 60)}:${Math.abs(paceImprovement % 60).toString().padStart(2, "0")} /km faster`
                : paceImprovement < 0
                ? "Slowing down (more data needed)"
                : "—"
            }
          />
          <Stat label="Total Runs" value={String(allActivities.length)} />
        </div>
        {latestWeight && (
          <div className="mt-4 pt-4 border-t flex gap-6" style={{ borderColor: "var(--border)" }}>
            <Stat label="Current Weight" value={`${latestWeight.weightKg} kg`} />
            <Stat label="BMI" value={calcBMI(latestWeight.weightKg, heightCm)} />
            <Stat label="Age" value={`${age} yrs`} />
          </div>
        )}
      </div>

      {/* Goals */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Goals
        </h3>
        <div className="space-y-3">
          <GoalRow
            label="Current goal"
            value={activePlan === "half" ? "Complete Half Marathon" : "Complete Full Marathon"}
            done={activePlan === "marathon" || halfDone}
          />
          <GoalRow label="Next goal" value="Complete Full Marathon" done={false} />
          <GoalRow label="Half marathon target" value="Finish — no time goal" done={halfDone} />
          <GoalRow label="Marathon target" value="TBD" done={false} />
        </div>
      </div>

      {/* Plan settings */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Plan Settings
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Active plan</span>
            <span className="text-white font-medium">
              {activePlan === "half" ? "Half Marathon Novice (12 weeks)" : "Marathon Novice 1 (18 weeks)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Plan start date</span>
            <span className="text-white font-medium">{planStart}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Half marathon status</span>
            <span className={halfDone ? "text-green-400 font-medium" : "text-white font-medium"}>
              {halfDone ? "✓ Completed" : "In progress"}
            </span>
          </div>
        </div>
      </div>

      {/* Weight tracker */}
      <WeightTracker
        entries={weightEntries.map((e) => ({
          id: e.id,
          weightKg: e.weightKg,
          loggedAt: e.loggedAt,
        }))}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-base font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

function GoalRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold ${
          done ? "border-green-400 bg-green-400 text-black" : "border-gray-600"
        }`}
      >
        {done && "✓"}
      </div>
      <div className="flex-1 flex justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className={`text-sm font-medium text-right ${done ? "text-green-400 line-through" : "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
