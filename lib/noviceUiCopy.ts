/** Plain-language session titles for Novice UI (no "tempo"). */
export function noviceSessionTitle(type: "easy" | "long" | "tempo"): string {
  if (type === "tempo") return "Bridge Run";
  if (type === "long") return "Long run";
  return "Easy run";
}

export function encouragingCheckinLine(params: {
  completed: boolean;
  partial: boolean;
  skipped: boolean;
  injurySkip: boolean;
  userRpe: number | null;
}): string {
  const { completed, partial, skipped, injurySkip, userRpe } = params;
  if (injurySkip) return "Taking care of yourself is the right call.";
  if (skipped) return "Rest days happen. See you next session.";
  if (partial) return "Something is better than nothing. Keep showing up.";
  if (completed && userRpe != null) {
    if (userRpe <= 4) return "Feeling strong. That's a great sign.";
    if (userRpe <= 7) return "Solid effort. That's exactly where you should be.";
    return "Tough one. Rest up — that's part of the process.";
  }
  return "Logged. See you next session.";
}

export const BRIDGE_RUN_EXPLAINER = `What is a Bridge Run?

Your first taste of running a little harder. This is not a race — just a slightly faster effort than your easy runs. You should feel "comfortably hard": short phrases possible, full sentences difficult. Back off any time you feel strain.`;
