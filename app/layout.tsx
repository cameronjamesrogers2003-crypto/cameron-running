import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./runshift/styles.css";
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
      <body style={{ background: "var(--background)", color: "var(--text)" }}>
        <SettingsProvider>
          <div className="rs-app">
            <Nav />
            <main className="rs-main">
              <div className="rs-main__inner">{children}</div>
            </main>
            <MobileBottomNav />
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
