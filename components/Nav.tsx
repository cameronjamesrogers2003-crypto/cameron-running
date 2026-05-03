"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainLinks = [
  { href: "/",         label: "Dashboard" },
  { href: "/program",  label: "Program"   },
  { href: "/calendar", label: "Calendar"  },
  { href: "/runs",     label: "Runs"      },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: "var(--accent)" }}>
            &#9675;
          </span>
          <span className="font-semibold text-white text-sm tracking-wide">
            Cameron&apos;s Running
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {mainLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Faint divider before Settings */}
          <div
            className="mx-2 self-stretch"
            style={{ width: 1, background: "rgba(255,255,255,0.1)" }}
          />

          <Link
            href="/settings"
            className="px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
            style={{
              color: pathname === "/settings" ? "var(--accent)" : "var(--text-muted)",
              background: pathname === "/settings" ? "rgba(249,115,22,0.1)" : "transparent",
            }}
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
