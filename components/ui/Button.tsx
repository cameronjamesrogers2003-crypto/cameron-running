"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#ffffff",
    border: "1px solid rgba(15,157,148,0.45)",
  },
  secondary: {
    background: "var(--surface-muted)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-subtle)",
  },
  danger: {
    background: "rgba(248,113,113,0.10)",
    color: "#ef4444",
    border: "1px solid rgba(248,113,113,0.30)",
  },
};

export function Button({
  children,
  className = "",
  style,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <button
      {...props}
      className={`rounded-xl text-sm font-medium transition-colors min-h-11 px-4 py-2 ${className}`.trim()}
      style={{ ...variantStyles[variant], ...style }}
    >
      {children}
    </button>
  );
}
