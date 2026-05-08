"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Activity,
  Calendar,
  CircleHelp,
  Settings,
  Trophy,
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/program", label: "Program", Icon: ClipboardList },
  { href: "/runs", label: "Runs", Icon: Activity },
  { href: "/calendar", label: "Calendar", Icon: Calendar },
  { href: "/rating", label: "Rating", Icon: Trophy },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/help", label: "Help", Icon: CircleHelp },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottomnav lg:hidden fixed bottom-0 left-0 right-0 border-t z-50"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)",
        background: "var(--surface-overlay)",
        borderColor: "var(--border-subtle)",
      }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around gap-0 max-w-lg mx-auto px-1 pt-1">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-[8px] px-0 transition-colors duration-150"
              style={{
                color: active ? "#0b8079" : "#475569",
                background: active ? "var(--bg-sidebar-active)" : "transparent",
                borderRadius: "0.75rem",
              }}
            >
              <span
                className="mb-0.5"
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: active ? "#0b8079" : "transparent",
                }}
                aria-hidden
              />
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              <span className="leading-tight text-center truncate w-full mt-[3px] font-medium tracking-[0.02em]" style={{ fontSize: "0.65rem" }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
