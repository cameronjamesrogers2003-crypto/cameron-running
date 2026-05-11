import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SettingsProvider } from "@/context/SettingsContext";
import { SyncProvider } from "@/context/SyncContext";
import { PageTransition } from "@/components/PageTransition";
import prisma from "@/lib/db";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Runshift",
  description: "Your personalised marathon training platform",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  const stravaConnected = Boolean(profile?.stravaToken);
  const lastSynced = profile?.lastRefreshedAt ? profile.lastRefreshedAt.toISOString() : null;

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full overflow-x-hidden dark`}>
      <body
        className="dark min-h-screen flex flex-col overflow-x-hidden"
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <SettingsProvider>
          <SyncProvider initialStravaConnected={stravaConnected} initialLastSynced={lastSynced}>
            <Nav />
            <main className="flex-1 w-full min-w-0 px-4 pb-24 pt-2.5 lg:px-6 lg:pb-8 lg:pt-4.5 lg:pl-64">
              <div className="max-w-[1120px] mx-auto w-full">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
            <MobileBottomNav />
          </SyncProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
