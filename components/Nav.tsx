"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Settings } from "lucide-react";
import Logo from "@/components/Logo";

const mainLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/program", label: "Program" },
  { href: "/calendar", label: "Calendar" },
  { href: "/runs", label: "Runs" },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
    {/* Mobile: brand bar only (links live in bottom nav) */}
    <header
      className="md:hidden sticky top-0 z-50 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center min-h-12">
        <Link href="/" className="min-h-11 inline-flex items-center py-2" aria-label="Home">
          <Logo size="sm" showWordmark={true} />
        </Link>
      </div>
    </header>

    <header
      className="sticky top-0 z-50 border-b hidden md:block"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between min-h-14 h-auto py-2">
        <Logo size="sm" showWordmark={true} />
        <nav className="flex items-center gap-1 flex-wrap justify-end">
          {mainLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="min-h-11 px-3 inline-flex items-center rounded-md text-sm font-medium transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div
            className="mx-2 self-stretch min-h-8"
            style={{ width: 1, background: "rgba(255,255,255,0.1)" }}
          />

          <Link
            href="/settings"
            className="min-h-11 min-w-11 px-2.5 rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
            style={{
              color: pathname === "/settings" ? "var(--accent)" : "var(--text-muted)",
              background: pathname === "/settings" ? "rgba(249,115,22,0.1)" : "transparent",
            }}
            title="Settings"
          >
            <Settings className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-sm font-medium">Settings</span>
          </Link>

          <Link
            href="/help"
            className="min-h-11 min-w-11 px-2.5 rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
            style={{
              color: pathname === "/help" ? "#5eead4" : "var(--text-muted)",
              background: pathname === "/help" ? "rgba(20,184,166,0.12)" : "transparent",
            }}
            title="Help"
          >
            <CircleHelp className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-sm font-medium">Help</span>
          </Link>
        </nav>
      </div>
    </header>
    </>
  );
}

