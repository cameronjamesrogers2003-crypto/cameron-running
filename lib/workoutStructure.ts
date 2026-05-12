import type { RunType, Phase } from "@/data/trainingPlan";

// ── Public types ──────────────────────────────────────────────────────────────

export interface WorkoutSection {
  label: string;
  content: string;
}

export interface WorkoutStructure {
  sessionPurpose: string;
  physiologicalTarget: string;
  warmup: WorkoutSection;
  mainSet: WorkoutSection;
  cooldown: WorkoutSection;
  effortGuidance: string;
  executionTips: string[];
  fallbackOption?: string;
  postRunRecovery?: string;
  fuelingNotes?: string;
}

export interface WorkoutContext {
  phase: Phase;
  week: number;
  totalWeeks: number;
  isCutback: boolean;
  isRecovery: boolean;
  level: "NOVICE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE";
  goal: "5k" | "10k" | "hm" | "full";
  vdot: number;
  targetDistanceKm: number;
  targetPaceMinPerKm: number;
  targetRpe?: number;
  structure?: {
    warmupMin: number;
    cooldownMin: number;
    runWalkRatio?: {
      runSec: number;
      walkSec: number;
    };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function pct(week: number, totalWeeks: number): number {
  return totalWeeks <= 1 ? 0 : (week - 1) / (totalWeeks - 1);
}

function isBasePhase(phase: Phase): boolean {
  return (
    phase === "Base" ||
    phase === "Beginner Base" ||
    phase === "Intermediate Base" ||
    phase === "Advanced Base"
  );
}

function getNoviceIntervals(ctx: WorkoutContext): string {
  if (ctx.structure?.runWalkRatio) {
    const { runSec, walkSec } = ctx.structure.runWalkRatio;
    return `Repeat: Jog ${runSec}s, Walk ${walkSec}s`;
  }
  if (ctx.week <= 2) return "Alternate 1 min jogging / 2 min brisk walking";
  if (ctx.week <= 4) return "Alternate 2 min jogging / 1 min brisk walking";
  if (ctx.week <= 6) return "Alternate 3 min jogging / 1 min brisk walking";
  if (ctx.week <= 8) return "Alternate 5 min jogging / 1 min brisk walking";
  return "Alternate 8–10 min jogging / 1 min walking";
}

// ── Easy run ──────────────────────────────────────────────────────────────────

function buildEasyStructure(ctx: WorkoutContext): WorkoutStructure {
  if (ctx.level === "NOVICE") {
    const warmup = ctx.structure?.warmupMin ?? 5;
    const cooldown = ctx.structure?.cooldownMin ?? 5;
    const rpe = ctx.targetRpe ?? 3;
    
    return {
      sessionPurpose: "Build consistency and time-on-feet through run/walk intervals.",
      physiologicalTarget: "Aerobic adaptation. Gradually teaching your body to handle continuous motion.",
      warmup: { label: "Start", content: `${warmup} min brisk walk. Focus on upright posture and easy breathing.` },
      mainSet: { label: "Main", content: `${getNoviceIntervals(ctx)} until you reach ${ctx.targetDistanceKm.toFixed(1)} km.` },
      cooldown: { label: "Finish", content: `${cooldown} min slow walk to let your heart rate settle.` },
      effortGuidance: `Effort: RPE ${rpe} / 10 ("Conversational Pace"). You should be able to hold a full conversation easily.`,
      executionTips: [
        "Don't rush the jogging intervals — consistency is more important than speed.",
        "The walking breaks are active recovery; keep moving at a brisk pace.",
        "If you feel any sharp pain, stop and walk the rest of the way.",
      ],
      postRunRecovery: "Hydrate and consider a light walk later in the day.",
    };
  }

  const isTaper = ctx.phase === "Taper";
  const isBase = isBasePhase(ctx.phase);

  const mainContent = isTaper
    ? `${ctx.targetDistanceKm.toFixed(1)} km at fully conversational pace. Stay fresh — no effort today.`
    : ctx.isCutback || ctx.isRecovery
    ? `${ctx.targetDistanceKm.toFixed(1)} km at very easy effort. Focus on loosening the legs from the week's training.`
    : isBase
    ? `${ctx.targetDistanceKm.toFixed(1)} km at conversational pace throughout. If speaking full sentences feels hard, you are going too fast.`
    : `${ctx.targetDistanceKm.toFixed(1)} km at easy recovery effort. This run supports adaptation from harder sessions — aerobic volume, not speed.`;

  const tips: string[] = [
    "If HR drifts above Zone 2, reduce pace — even to a walk on hills.",
    "Easy days done too hard are the most common cause of stalled progress.",
    "Relaxed form: shoulders down, light arm swing, easy breathing.",
  ];
  if (ctx.level === "ADVANCED" && !isTaper && !ctx.isCutback) {
    tips.push(
      "Optional: 4 × 20-second strides at the end to prime fast-twitch fibres. Walk recovery between each."
    );
  }

  return {
    sessionPurpose: isTaper
      ? "Stay loose and fresh before race day. All fitness gains are already banked — protect them."
      : ctx.isCutback || ctx.isRecovery
      ? "Active recovery. Let your body absorb the week's training load."
      : "Accumulate aerobic volume with minimal fatigue cost.",
    physiologicalTarget:
      "Zone 2 aerobic development. Builds mitochondrial density and fat oxidation capacity without accumulating significant fatigue.",
    warmup: {
      label: "Start",
      content:
        "Begin with 3–5 min at a very easy walk or shuffle, then settle into your easy pace naturally.",
    },
    mainSet: { label: "Main", content: mainContent },
    cooldown: {
      label: "Finish",
      content: "Walk for 3–5 min after to let HR settle. No rush.",
    },
    effortGuidance: `RPE 3–4 · Zone 2 HR · Target: ${fmtPace(ctx.targetPaceMinPerKm)} — or slower if needed`,
    executionTips: tips,
    postRunRecovery: "Hydrate and eat within 30–45 min. Light stretching optional.",
  };
}

// ── Tempo run ─────────────────────────────────────────────────────────────────

function buildTempoStructure(ctx: WorkoutContext): WorkoutStructure {
  const p = pct(ctx.week, ctx.totalWeeks);
  const isTaper = ctx.phase === "Taper";

  let mainContent: string;
  if (isTaper || ctx.isCutback) {
    mainContent =
      "15–20 min continuous at comfortably hard pace. Quality over quantity — finish feeling controlled, not spent.";
  } else if (ctx.level === "BEGINNER") {
    mainContent =
      p < 0.4
        ? "2 × 8 min at comfortably hard pace with 3 min easy jog between. Build the feel for threshold effort — this is new territory."
        : "2 × 12 min at comfortably hard pace with 3 min easy jog between. Aim for consistent splits across both blocks.";
  } else if (ctx.level === "INTERMEDIATE") {
    mainContent =
      p < 0.45
        ? `20–25 min continuous at threshold pace (${fmtPace(ctx.targetPaceMinPerKm)}). Keep effort controlled — 3–4 word sentences should be possible.`
        : `25–30 min continuous at threshold pace (${fmtPace(ctx.targetPaceMinPerKm)}). Push comfortably hard but stay in control through to the end.`;
  } else {
    mainContent =
      p < 0.4
        ? `30 min continuous at threshold pace (${fmtPace(ctx.targetPaceMinPerKm)}). This is a key aerobic power session — maintain control through the second half.`
        : `3 × 10 min at threshold pace with 2 min easy jog, or 35–40 min continuous. Race-specific strength work.`;
  }

  const tips: string[] = [
    "Start at target pace or slightly slower — the first 5 min often feels harder than it should.",
    `Comfortably hard, not maximal. You should be able to speak in short phrases.`,
    "If you can't complete the planned time at pace, slow down rather than stopping — reduced tempo still builds threshold.",
  ];
  tips.push(
    ctx.goal === "full"
      ? "Focus on relaxed mechanics at threshold effort — marathon economy is built through sustained tempo work."
      : "Tempo pace should sit just below HM race effort — controlled discomfort, not all-out."
  );

  return {
    sessionPurpose:
      "Raise your lactate threshold — the pace you can sustain for 60+ min. The most race-specific training in your plan.",
    physiologicalTarget:
      "Lactate threshold development. Teaches your body to process and clear lactate more efficiently at faster speeds.",
    warmup: {
      label: "Warmup",
      content:
        "1.5 km easy jog + 2–3 × 20-sec strides building toward tempo pace. Don't skip — threshold work on cold legs risks injury.",
    },
    mainSet: { label: "Tempo block", content: mainContent },
    cooldown: {
      label: "Cooldown",
      content: "1 km easy jog, then 5 min walk. Let HR drop naturally before stopping.",
    },
    effortGuidance: `RPE 7–8 · Zone 4 HR · ${fmtPace(ctx.targetPaceMinPerKm)} target — comfortably hard`,
    executionTips: tips,
    fallbackOption:
      "In heat or fatigue, run by effort rather than pace. 'Comfortably hard' is the non-negotiable — the exact split is secondary.",
    postRunRecovery:
      "Refuel within 30 min — this session creates real metabolic demand. Carbs + light protein.",
  };
}

// ── Interval run ──────────────────────────────────────────────────────────────

function buildIntervalStructure(ctx: WorkoutContext): WorkoutStructure {
  const p = pct(ctx.week, ctx.totalWeeks);
  const isTaper = ctx.phase === "Taper";
  const km = ctx.targetDistanceKm;

  let mainContent: string;
  let recoveryNote: string;

  if (isTaper || ctx.isCutback) {
    mainContent =
      "3–4 × 400m at interval pace. Short, sharp, controlled. Volume is deliberately low — the goal is to feel fast before race day.";
    recoveryNote = "Full 90 sec rest between reps.";
  } else if (ctx.level === "BEGINNER") {
    if (p < 0.35) {
      mainContent =
        "6 × 1 min hard / 1 min easy jog. Focus on effort and form — not exact pace.";
      recoveryNote = "1 min easy jog between each rep.";
    } else if (p < 0.65) {
      mainContent =
        "5 × 2 min hard / 90 sec easy jog. Build your ability to sustain harder effort over time.";
      recoveryNote = "90 sec easy jog between reps.";
    } else {
      mainContent =
        "4 × 3 min hard / 2 min easy jog. You have earned this — trust your progression.";
      recoveryNote = "2 min easy jog between reps.";
    }
  } else if (ctx.level === "INTERMEDIATE") {
    if (km <= 5) {
      mainContent = p < 0.5
        ? "4 × 400m at interval pace."
        : "5 × 400m at interval pace.";
      recoveryNote = "90 sec easy jog between reps.";
    } else if (km <= 7) {
      mainContent = p < 0.5
        ? "5 × 600m at interval pace."
        : "4 × 800m at interval pace.";
      recoveryNote = "90 sec easy jog between reps.";
    } else if (km <= 9) {
      mainContent = p < 0.65
        ? "5 × 800m at interval pace."
        : "4 × 1000m at interval pace.";
      recoveryNote = "2 min easy jog between reps.";
    } else {
      mainContent = "3 × 1200m or 4 × 1000m at interval pace.";
      recoveryNote = "2 min easy jog between reps.";
    }
  } else {
    // ADVANCED
    if (km <= 5) {
      mainContent = "6 × 400m at interval pace.";
      recoveryNote = "90 sec easy jog between reps.";
    } else if (km <= 7) {
      mainContent = p < 0.45
        ? "6 × 600m at interval pace."
        : "5 × 800m at interval pace.";
      recoveryNote = "90 sec easy jog between reps.";
    } else if (km <= 9) {
      mainContent = p < 0.65
        ? "4 × 1000m at interval pace."
        : "3 × 1200m at interval pace.";
      recoveryNote = "2 min easy jog between reps.";
    } else {
      mainContent = p < 0.75
        ? "5 × 1000m at interval pace."
        : "4 × 1200m at interval pace.";
      recoveryNote = "2 min easy jog between reps.";
    }
  }

  const warmupContent =
    ctx.level === "BEGINNER"
      ? "10 min easy jog. HR should feel comfortable before starting intervals."
      : `1.5 km easy jog + 4 × 20-sec strides building toward interval pace. Rest 2 min before rep 1.`;

  const tips: string[] = [
    "Rep 1 should feel controlled — if you're sprinting from the start, you are going too hard.",
    `Aim for consistent splits. Rep 3 should feel similar to Rep 1.`,
    `Recovery: ${recoveryNote} Do not shorten recovery to hit pace.`,
    ctx.level !== "BEGINNER"
      ? `Target pace: ${fmtPace(ctx.targetPaceMinPerKm)} per rep. Slightly aggressive is fine; unsustainable is not.`
      : "Focus on effort — hard but not maximal. You should be able to complete all reps.",
  ];

  return {
    sessionPurpose:
      "Develop your VO2 max and running economy. The hardest and most potent sessions in your plan.",
    physiologicalTarget:
      ctx.level === "BEGINNER"
        ? "High-end aerobic development. Introduces your body to harder effort with structured recovery."
        : "VO2 max development. Forces cardiac output and oxygen uptake adaptations that make all paces feel easier over time.",
    warmup: { label: "Warmup", content: warmupContent },
    mainSet: { label: "Main set", content: mainContent },
    cooldown: {
      label: "Cooldown",
      content:
        "1 km easy jog + 5 min walk. Let HR come down fully before stopping.",
    },
    effortGuidance:
      ctx.level === "BEGINNER"
        ? "RPE 8 during hard efforts · Zone 4–5 HR · Hard but controlled — not maximal"
        : `RPE 8–9 · Zone 4–5 HR · ${fmtPace(ctx.targetPaceMinPerKm)} per rep`,
    executionTips: tips,
    fallbackOption:
      "If pace feels unreachable from rep 3, drop 1–2 reps rather than compromising form. Reduce reps, not recovery time.",
    postRunRecovery:
      "The most important session to recover from. Refuel within 20–30 min. Plan easy movement or rest the following day.",
  };
}

// ── Long run ──────────────────────────────────────────────────────────────────

function buildLongRunStructure(ctx: WorkoutContext): WorkoutStructure {
  if (ctx.level === "NOVICE") {
    const warmup = ctx.structure?.warmupMin ?? 5;
    const cooldown = ctx.structure?.cooldownMin ?? 5;
    const rpe = ctx.targetRpe ?? 4;

    return {
      sessionPurpose: "Develop endurance through a sustained effort of run/walk intervals.",
      physiologicalTarget: "Aerobic base building. Increasing the total duration of forward motion.",
      warmup: { label: "Start", content: `${warmup} min brisk walk. Focus on upright posture and easy breathing.` },
      mainSet: { label: "Main", content: `${getNoviceIntervals(ctx)} for a total of ${ctx.targetDistanceKm.toFixed(1)} km.` },
      cooldown: { label: "After", content: `${cooldown} min slow walk. Light stretching if comfortable.` },
      effortGuidance: `Effort: RPE ${rpe} / 10 ("Conversational Pace"). Slightly more sustained but still fully conversational.`,
      executionTips: [
        "Use the walking breaks to lower your heart rate and reset your form.",
        "Focus on 'time on feet' rather than how fast you are moving.",
        "Hydrate during the walk breaks if the weather is warm.",
      ],
      postRunRecovery: "Hydrate and refuel within 30 min. Easy movement the next day.",
    };
  }

  const p = pct(ctx.week, ctx.totalWeeks);
  const isTaper = ctx.phase === "Taper";
  const isBase = isBasePhase(ctx.phase);
  const km = ctx.targetDistanceKm;
  const isLong = km >= 18;
  const isVeryLong = km >= 25;
  const isFullGoal = ctx.goal === "full";

  let mainContent: string;
  if (isTaper || ctx.isCutback) {
    mainContent = `${km.toFixed(1)} km at easy pace throughout. This is not a training stimulus — it is about staying loose and maintaining rhythm.`;
  } else if (isBase) {
    mainContent = `${km.toFixed(1)} km at consistent easy pace. Fully conversational from start to finish. The goal is time on feet, not pace.`;
  } else if (p >= 0.65 && isLong) {
    const easyKm = Math.round(km * 0.65);
    const progressKm = (km - easyKm).toFixed(1);
    mainContent = `${easyKm} km easy then build slightly in the final ${progressKm} km. Don't force the progression — let it happen as the engine warms up.`;
  } else {
    mainContent = `${km.toFixed(1)} km at consistent easy pace. Aim for even, relaxed effort from start to finish.`;
  }

  const fuelingNotes = isLong || (isFullGoal && km >= 14)
    ? km >= 16
      ? `Take a gel or ${isFullGoal ? "200–250 mL" : "150–200 mL"} of sports drink every 40–45 min starting from 45 min in. Practice your race-day fueling strategy now.`
      : "Start hydrating from 45 min. Consider a gel or snack if running over 75 min."
    : undefined;

  const tips: string[] = [
    `Start slower than target pace — the first 2 km should feel almost effortless.`,
    "Walk breaks are effective strategy, especially on hills or in heat — not a sign of weakness.",
    `Target pace: ${fmtPace(ctx.targetPaceMinPerKm)} — or slower if conditions demand it.`,
  ];
  if (isLong) {
    tips.push(
      "If HR drifts above Zone 2, reduce pace or take a walk break. Cardiac drift in heat is normal."
    );
  }
  if (isVeryLong) {
    tips.push(
      "Break it into thirds mentally. Time on feet matters more than pace on very long runs."
    );
  }
  if (isFullGoal && p > 0.55) {
    tips.push(
      "Practice your race-day mental routine — checkpoints, focus cues, positive self-talk."
    );
  }

  return {
    sessionPurpose: isTaper
      ? "Stay loose and preserve the fitness you have built. No gains to chase — protect race readiness."
      : isBase
      ? "Build your aerobic base and time-on-feet endurance. This is the foundation everything else rests on."
      : "Develop race-specific endurance, fueling competency, and fatigue resistance.",
    physiologicalTarget: isBase
      ? "Aerobic base development. Builds capillarisation, fat oxidation efficiency, and connective tissue strength over time."
      : "Race-specific endurance. Trains glycogen efficiency, neuromuscular fatigue resistance, and pacing discipline.",
    warmup: {
      label: "Start",
      content:
        "Begin with 5 min easy walk or very light jog. Let your body warm up naturally — do not force pace in the first km.",
    },
    mainSet: { label: "Main run", content: mainContent },
    cooldown: {
      label: "After",
      content:
        "5–10 min walk after finishing. Light calf, hamstring, and hip flexor stretching if comfortable.",
    },
    effortGuidance: `RPE 4–5 · Zone 2 HR · ${fmtPace(ctx.targetPaceMinPerKm)} target — or slower as needed`,
    executionTips: tips,
    fallbackOption: isLong
      ? "If conditions are very hot or you feel unwell, reduce distance by 20–25%. A completed shorter long run beats a forced one."
      : undefined,
    postRunRecovery: isLong
      ? "Refuel within 30–45 min with carbs and protein. Elevate legs if possible. Expect residual fatigue over the next 24 h."
      : "Hydrate and refuel within 30–45 min. Easy movement the next day aids recovery.",
    fuelingNotes,
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function buildWorkoutStructure(
  type: RunType,
  ctx: WorkoutContext,
): WorkoutStructure {
  switch (type) {
    case "easy":     return buildEasyStructure(ctx);
    case "tempo":    return buildTempoStructure(ctx);
    case "interval": return buildIntervalStructure(ctx);
    case "long":     return buildLongRunStructure(ctx);
  }
}
