"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Activity,
  Settings,
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/program", label: "Program", Icon: ClipboardList },
  { href: "/calendar", label: "Calendar", Icon: Calendar },
  { href: "/runs", label: "Runs", Icon: Activity },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[60] border-t"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)",
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
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 transition-colors"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
                background: active ? "rgba(249,115,22,0.12)" : "transparent",
              }}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-[10px] font-medium leading-tight text-center truncate w-full">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
