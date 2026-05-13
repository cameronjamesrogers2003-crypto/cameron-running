import assert from "node:assert";
import { computeCurrentAndBestStreak, computeWeekInsight, getRunWalkForWeek } from "@/lib/noviceAnalytics";

const streak = computeCurrentAndBestStreak([
  { sessionId: "1", weekNumber: 1, sessionType: "easy", plannedDistanceKm: 2, actualDistanceKm: 2, completed: true, userRpe: 4, skippedReason: null, effortScore: 4, createdAt: new Date("2026-01-01") },
  { sessionId: "2", weekNumber: 1, sessionType: "easy", plannedDistanceKm: 2, actualDistanceKm: null, completed: false, userRpe: 5, skippedReason: "time", effortScore: null, createdAt: new Date("2026-01-02") },
  { sessionId: "3", weekNumber: 2, sessionType: "long", plannedDistanceKm: 3, actualDistanceKm: 3, completed: true, userRpe: 5, skippedReason: null, effortScore: 5, createdAt: new Date("2026-01-03") },
  { sessionId: "4", weekNumber: 2, sessionType: "easy", plannedDistanceKm: 2, actualDistanceKm: 2, completed: true, userRpe: 4, skippedReason: null, effortScore: 4, createdAt: new Date("2026-01-04") },
]);
assert.equal(streak.currentStreak, 2);
assert.equal(streak.bestStreak, 2);

assert.equal(
  computeWeekInsight({ completionRate: 1, averageRpe: 3.8, sessionsCompleted: 3, sessionsPlanned: 3, hasInjuryFlag: false, hasAnyData: true }),
  "Strong week. You made it look easy.",
);
assert.equal(
  computeWeekInsight({ completionRate: 0.6, averageRpe: 6, sessionsCompleted: 2, sessionsPlanned: 3, hasInjuryFlag: false, hasAnyData: true }),
  "Partial week — you got 2 of 3 sessions done.",
);
assert.equal(
  computeWeekInsight({ completionRate: 0.2, averageRpe: null, sessionsCompleted: 0, sessionsPlanned: 3, hasInjuryFlag: false, hasAnyData: true }),
  "Difficult week. The plan has adjusted to keep you on track.",
);
assert.equal(
  computeWeekInsight({ completionRate: 0, averageRpe: null, sessionsCompleted: 0, sessionsPlanned: 3, hasInjuryFlag: true, hasAnyData: true }),
  "Plan paused this week due to injury.",
);

const rw = getRunWalkForWeek({ week: 4, phase: "Beginner Base", sessions: [{ id: "a", day: "mon", type: "easy", targetDistanceKm: 3, targetPaceMinPerKm: 7, structure: { runWalkRatio: { runSec: 60, walkSec: 30 } } }], isRecovery: false } as never);
assert.equal(rw.runSec, 60);
assert.equal(rw.walkSec, 30);
assert.equal(rw.isContinuous, false);

const cont = getRunWalkForWeek({ week: 8, phase: "Race Specific", sessions: [{ id: "b", day: "mon", type: "easy", targetDistanceKm: 4, targetPaceMinPerKm: 7, structure: { warmupMin: 5, cooldownMin: 5 } }], isRecovery: false } as never);
assert.equal(cont.isContinuous, true);
assert.equal(cont.walkSec, 0);

console.log("novice phase 5 analytics helpers OK");
