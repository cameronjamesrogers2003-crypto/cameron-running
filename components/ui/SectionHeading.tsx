"use client";

import type { ReactNode } from "react";

export function SectionHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold tracking-widest uppercase ${className}`.trim()} style={{ color: "var(--text-label)" }}>
      {children}
    </p>
  );
}
