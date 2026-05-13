import type { Phase } from "@/data/trainingPlan";

export function phaseChipStyle(phase: Phase): { background: string; color: string } {
  switch (phase) {
    case "Base":
    case "Beginner Base":
    case "Intermediate Base":
    case "Advanced Base":
      return { background: "#1e3a5f", color: "#93c5fd" };
    case "Build":
    case "Half Marathon Build":
    case "Race Specific":
      return { background: "#14532d", color: "#86efac" };
    case "Peak":
    case "Marathon Build":
      return { background: "#3b0764", color: "#d8b4fe" };
    case "Taper":
      return { background: "#3f3f46", color: "#e4e4e7" };
    case "Recovery":
      return { background: "#1a1133", color: "#a78bfa" };
    default:
      return { background: "#27272a", color: "#a1a1aa" };
  }
}
