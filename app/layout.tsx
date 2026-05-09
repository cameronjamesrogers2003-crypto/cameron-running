import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SettingsProvider } from "@/context/SettingsContext";
import { PageTransition } from "@/components/PageTransition";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

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
  return (
    <html lang="en" className={`${geist.variable} h-full overflow-x-hidden dark`}>
      <body
        className="dark min-h-screen flex flex-col overflow-x-hidden"
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <SettingsProvider>
          <Nav />
          <main className="flex-1 w-full min-w-0 px-4 pb-24 pt-2.5 lg:px-6 lg:pb-8 lg:pt-4.5 lg:pl-64">
            <div className="max-w-[1120px] mx-auto w-full">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
          <MobileBottomNav />
        </SettingsProvider>
      </body>
    </html>
  );
}
