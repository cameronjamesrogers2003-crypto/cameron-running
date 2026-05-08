"use client";

import type { CSSProperties, ReactNode } from "react";

type Tone = "secondary" | "muted" | "label";

const toneColor: Record<Tone, string> = {
  secondary: "var(--text-secondary)",
  muted: "var(--text-muted)",
  label: "var(--text-label)",
};

export function MutedText({
  children,
  className = "",
  tone = "muted",
  style,
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return (
    <p className={className} style={{ color: toneColor[tone], ...style }}>
      {children}
    </p>
  );
}
