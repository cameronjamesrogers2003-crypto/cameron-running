export function runTypeColor(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case "easy":
      return "var(--c-easy)";
    case "tempo":
      return "var(--c-tempo)";
    case "interval":
      return "var(--c-interval)";
    case "long":
      return "var(--c-long)";
    default:
      return "rgba(255,255,255,0.4)";
  }
}

export function runTypeBg(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case "easy":
      return "rgba(125,211,252,0.10)";
    case "tempo":
      return "rgba(45,212,191,0.10)";
    case "interval":
      return "rgba(249,115,22,0.10)";
    case "long":
      return "rgba(167,139,250,0.10)";
    default:
      return "rgba(255,255,255,0.06)";
  }
}

export function runTypeLabel(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case "easy":
      return "Easy";
    case "tempo":
      return "Tempo";
    case "interval":
      return "Interval";
    case "long":
      return "Long";
    default:
      return "Run";
  }
}
