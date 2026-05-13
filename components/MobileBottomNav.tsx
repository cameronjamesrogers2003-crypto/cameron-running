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
  BarChart3,
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

const baseItems = [
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
  const { settings } = useSettings();
  const noviceActive = settings.experienceLevel === "NOVICE";

  const items = noviceActive
    ? [...baseItems.slice(0, 2), { href: "/plan/novice/progress", label: "Progress", Icon: BarChart3 }, ...baseItems.slice(2)]
    : baseItems;

  return (
    <nav
      className="bottomnav lg:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/[0.08] z-50"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)",
      }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around gap-0 max-w-lg mx-auto px-1 pt-1">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-[8px] px-0 transition-colors duration-150"
              style={{
                color: active ? "var(--accent)" : "rgba(255,255,255,0.45)",
              }}
            >
              <span
                className="mb-0.5"
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: active ? "var(--accent)" : "transparent",
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
