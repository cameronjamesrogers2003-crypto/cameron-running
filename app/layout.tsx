import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SettingsProvider } from "@/context/SettingsContext";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full overflow-x-hidden`}>
      <body
        className="min-h-screen flex flex-col overflow-x-hidden"
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <SettingsProvider>
          <Nav />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-6 pb-24 md:pb-6 min-w-0">
            {children}
          </main>
          <MobileBottomNav />
        </SettingsProvider>
      </body>
    </html>
  );
}
