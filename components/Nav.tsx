"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Calendar, CircleHelp, ClipboardList, LayoutDashboard, RefreshCw, Settings, Trophy } from "lucide-react";
import Logo from "@/components/Logo";
import { SidebarSubtitle } from "@/components/SidebarSubtitle";

const mainLinks = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/program", label: "Program", Icon: ClipboardList },
  { href: "/runs", label: "Runs", Icon: Activity },
  { href: "/calendar", label: "Calendar", Icon: Calendar },
  { href: "/rating", label: "Rating", Icon: Trophy },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/help", label: "Help", Icon: CircleHelp },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <Link href="/" className="inline-flex items-center gap-2 transition-opacity hover:opacity-80" aria-label="Home">
          <Logo size="sm" showWordmark={false} />
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Runshift</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.10] transition-colors duration-150"
            style={{ color: "var(--accent)" }}
            aria-label="Sync"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="rs-sidebar hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-40">
        <div className="px-4 pt-4.5 pb-3.5 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Logo size="md" showWordmark={false} className="scale-[0.72] origin-left" />
            <span className="text-xl leading-none font-extrabold tracking-tight text-white">Runshift</span>
          </Link>
          <div className="mt-2.5">
            <SidebarSubtitle />
          </div>
        </div>

        <nav className="flex-1 pt-3" aria-label="Sidebar">
          {mainLinks.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            const Icon = link.Icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl mx-2 mb-0.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                  active ? "bg-teal-500/10 text-teal-400" : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                }`}
                style={active ? { borderLeft: "2px solid var(--accent)" } : undefined}
              >
                <Icon className="w-4 h-4" strokeWidth={2} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-2 px-4 pb-2">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors duration-150"
            >
              <RefreshCw className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-white/75">Sync Strava</span>
            </button>
          </div>
          <p className="mx-4 mb-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Last sync: —
          </p>
        </div>
      </aside>
    </>
  );
}

