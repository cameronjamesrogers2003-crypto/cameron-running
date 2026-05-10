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
        <p className="ty-date mb-1.5">{subtitle}</p>
      ) : null}
      <h1
        className="text-white font-extrabold tracking-tight"
        style={{ fontSize: "clamp(22px, 4vw, 28px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
      >
        {children}
      </h1>
    </div>
  );
}
