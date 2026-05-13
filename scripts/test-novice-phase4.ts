import assert from "node:assert";
import { noviceRunWalkSegments } from "@/components/novice/NoviceRunWalkIndicator";

function approx(a: number, b: number, eps = 0.01) {
  assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
}

approx(noviceRunWalkSegments({ runSec: 60, walkSec: 90 }).runPct, 40);
approx(noviceRunWalkSegments({ runSec: 60, walkSec: 90 }).walkPct, 60);

approx(noviceRunWalkSegments({ runSec: 60, walkSec: 30 }).runPct, 66.67, 0.02);
approx(noviceRunWalkSegments({ runSec: 60, walkSec: 30 }).walkPct, 33.33, 0.02);

const z = noviceRunWalkSegments({ runSec: 60, walkSec: 0 });
assert.equal(z.runPct, 100);
assert.equal(z.walkPct, 0);

console.log("novice phase 4 UI helpers OK");
