"use client";

import { useSettings } from "@/context/SettingsContext";
import { getDisplayName } from "@/lib/settings";

export function SidebarSubtitle() {
  const { settings } = useSettings();
  const name = getDisplayName(settings);
  const hasCustomName = Boolean(settings.nickname ?? settings.firstName);

  return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
      {hasCustomName ? `${name} · ` : ""}Runshift
    </p>
  );
}
