"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/program", label: "Plan", icon: "plan" },
  { href: "/runs", label: "Runs", icon: "runs" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/help", label: "Help", icon: "help" },
] as const;

function NavIcon({ id }: { id: (typeof NAV_ITEMS)[number]["icon"] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
  };
  if (id === "today") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (id === "plan") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
      </svg>
    );
  }
  if (id === "runs") {
    return (
      <svg {...common}>
        <path d="M4 18 L9 11 L13 14 L20 6" />
        <path d="M14 6h6v6" />
      </svg>
    );
  }
  if (id === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.7.7-1.3 1.1-1.3 2.3" />
        <circle cx="12" cy="16.7" r=".6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.36.86.6 1.51.6H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header className="rs-topbar">
        <Link href="/" className="rs-topbar__brand" aria-label="Home">
          <svg viewBox="0 0 28 28" width="22" height="22">
            <path d="M5 19 Q 9 13, 14 17 T 23 13" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <circle cx="23" cy="13" r="2.6" fill="var(--accent)" />
          </svg>
          <span>Runshift</span>
        </Link>
      </header>

      <nav className="rs-sidebar" aria-label="Sidebar">
        <div className="rs-sidebar__brand">
          <div className="rs-logo">
            <svg viewBox="0 0 28 28" width="28" height="28">
              <path d="M5 19 Q 9 13, 14 17 T 23 13" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
              <circle cx="23" cy="13" r="2.6" fill="var(--accent)" />
            </svg>
          </div>
          <div className="rs-sidebar__brand-text">
            <span className="rs-sidebar__wordmark">Runshift</span>
            <span className="rs-sidebar__sub">Training tracker</span>
          </div>
        </div>

        <div className="rs-sidebar__items">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rs-sidebar__item${isActive(item.href) ? " is-active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <NavIcon id={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="rs-sidebar__foot">
          <Link href="/" className="rs-sync">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </svg>
            Sync Strava
          </Link>
          <p className="rs-sidebar__synced">Last sync - --</p>
        </div>
      </nav>
    </>
  );
}

