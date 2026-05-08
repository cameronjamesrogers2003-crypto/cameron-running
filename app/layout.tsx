import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { buildTrainingPlan } from "@/data/trainingPlan";
import { getEffectivePlanStart, getPlanWeekForDate, getWeeklyTargetKm } from "@/lib/planUtils";
import { parseInterruptionType, reconfigurePlan, type PlanInterruption } from "@/lib/interruptions";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Cameron's Running",
  description: "Personal marathon training tracker for Cameron",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [userSettingsRow, interruptionRows, storedPlan] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.planInterruption.findMany({ orderBy: { startDate: "asc" } }),
    loadGeneratedPlan(),
  ]);

  const settings = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const today = new Date();

  let planToRender = storedPlan?.plan ?? [];
  if (!planToRender.length) {
    const basePlan = buildTrainingPlan(settings);
    const normalWeeklyKm = basePlan.reduce((sum, w) => sum + getWeeklyTargetKm(w), 0) / Math.max(1, basePlan.length);
    const interruptions: PlanInterruption[] = interruptionRows.map((row) => ({
      id: row.id,
      reason: row.reason,
      type: parseInterruptionType(row.type),
      startDate: new Date(row.startDate),
      endDate: row.endDate ? new Date(row.endDate) : null,
      weeklyKmEstimate: row.weeklyKmEstimate ?? null,
      notes: row.notes ?? null,
      weeksAffected: row.weeksAffected ?? null,
    }));
    planToRender = reconfigurePlan(basePlan, interruptions, {
      isBeginnerCurve: true,
      raceDate: settings.raceDate ? new Date(settings.raceDate) : null,
      normalWeeklyKm,
      planStart,
      experienceLevel: settings.experienceLevel ?? "BEGINNER",
    }).plan;
  }

  const sidebarTrainingLabel = (() => {
    if (!planToRender.length) return "No active plan";
    const maxWeek = planToRender[planToRender.length - 1]?.week ?? planToRender.length;
    const rawWeek = getPlanWeekForDate(today, planStart);
    const currentWeek = rawWeek > 0 ? Math.min(maxWeek, rawWeek) : 1;
    const currentPhase = planToRender.find((w) => w.week === currentWeek)?.phase ?? planToRender[0]?.phase;
    if (!currentPhase) return "Plan unavailable";
    return `Week ${currentWeek} · ${currentPhase}`;
  })();

  return (
    <html lang="en" className={`${geist.variable} h-full overflow-x-hidden dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const saved = localStorage.getItem('theme')
                const root = document.documentElement
                if (saved === 'light') {
                  root.classList.add('light')
                  root.classList.remove('dark')
                } else {
                  root.classList.add('dark')
                  root.classList.remove('light')
                }
              })()
            `,
          }}
        />
      </head>
      <body
        className="dark min-h-screen flex flex-col overflow-x-hidden"
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <ThemeProvider>
          <SettingsProvider>
            <Nav trainingLabel={sidebarTrainingLabel} />
            <main className="flex-1 w-full min-w-0 px-4 pb-24 pt-2 lg:px-6 lg:pb-8 lg:pt-4 lg:pl-64">
              <div className="max-w-[1100px] mx-auto w-full">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
            <MobileBottomNav />
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
