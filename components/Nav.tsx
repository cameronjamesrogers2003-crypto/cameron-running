"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
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
        <nav className="flex gap-1">
          {links.map((link) => {
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
        </nav>
      </div>
    </header>
  );
}
