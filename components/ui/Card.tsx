"use client";

import type { CSSProperties, ReactNode } from "react";

type CardVariant = "base" | "elevated" | "subtle" | "interactive";

const variantStyles: Record<CardVariant, CSSProperties> = {
  base: {
    background: "var(--surface-base)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-card)",
  },
  elevated: {
    background: "var(--surface-elevated)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-elevated)",
  },
  subtle: {
    background: "var(--surface-muted)",
    border: "1px solid var(--border-subtle)",
  },
  interactive: {
    background: "var(--surface-base)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "var(--shadow-card)",
  },
};

export function Card({
  children,
  className = "",
  style,
  variant = "base",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: CardVariant;
}) {
  const interactiveClass = variant === "interactive" ? "transition-shadow hover:shadow-[var(--shadow-hover)]" : "";
  return (
    <div
      className={`rounded-2xl ${interactiveClass} ${className}`.trim()}
      style={{
        borderRadius: "var(--card-radius)",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
