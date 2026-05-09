import type { ReactNode } from "react";

type PageHeadingProps = {
  children: ReactNode;
  /** Label shown above the title (e.g. “Your athletic profile”). */
  subtitle?: ReactNode;
  className?: string;
};

/**
 * Unified page `<h1>` — use for top-level Dashboard, Rating, Calendar, Settings, Runs, Program titles only.
 */
export default function PageHeading({ children, subtitle, className = "" }: PageHeadingProps) {
  return (
    <div className={className}>
      {subtitle != null && subtitle !== "" ? (
        <p className="text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      ) : null}
      <h1 className="text-3xl font-black tracking-tight text-white">{children}</h1>
    </div>
  );
}
