"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

interface SettingsContextValue {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading:  true,
  updateSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const res  = await fetch("/api/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(patch),
    });
    if (!res.ok) {
      throw new Error("Failed to save settings");
    }
    const updated = await res.json();
    setSettings(updated);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
