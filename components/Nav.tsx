"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Calendar, CircleHelp, ClipboardList, LayoutDashboard, RefreshCw, Settings, Trophy } from "lucide-react";
import Logo from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const mainLinks = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/program", label: "Program", Icon: ClipboardList },
  { href: "/runs", label: "Runs", Icon: Activity },
  { href: "/calendar", label: "Calendar", Icon: Calendar },
  { href: "/rating", label: "Rating", Icon: Trophy },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/help", label: "Help", Icon: CircleHelp },
] as const;

export default function Nav({ trainingLabel = "No active plan" }: { trainingLabel?: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b"
        style={{ background: "var(--surface-overlay)", borderColor: "var(--border-subtle)" }}
      >
        <Link href="/" className="inline-flex items-center gap-2 transition-opacity hover:opacity-80" aria-label="Home">
          <Logo size="sm" showWordmark={false} />
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Cameron Running</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-150"
            style={{ background: "var(--surface-muted)", border: "1px solid var(--border-default)", color: "var(--accent)" }}
            aria-label="Sync"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className="rs-sidebar hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 border-r z-40"
        style={{ background: "var(--bg-sidebar)", borderColor: "var(--border-subtle)" }}
      >
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <Link href="/" className="inline-flex items-center gap-2 transition-opacity hover:opacity-80">
            <Logo size="sm" showWordmark={false} />
            <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Cameron Running</span>
          </Link>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {trainingLabel}
          </p>
        </div>

        <nav className="flex-1 pt-2" aria-label="Sidebar">
          {mainLinks.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            const Icon = link.Icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl mx-2 text-sm transition-colors duration-150 cursor-pointer"
                style={
                  active
                    ? { background: "var(--bg-sidebar-active)", color: "#0b8079", fontWeight: 600 }
                    : { color: "#475569" }
                }
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-2 px-4 pb-2">
            <ThemeToggle />
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
              style={{ background: "var(--surface-muted)", border: "1px solid var(--border-default)" }}
            >
              <RefreshCw className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--text-secondary)" }}>Sync Strava</span>
            </button>
          </div>
          <p className="mx-4 mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
            Last sync: —
          </p>
        </div>
      </aside>
    </>
  );
}

