import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";

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
            <Nav />
            <main className="flex-1 w-full min-w-0 px-4 pb-24 pt-2 lg:px-6 lg:pb-8 lg:pt-4 lg:pl-64">
              <div className="max-w-[1100px] mx-auto w-full">{children}</div>
            </main>
            <MobileBottomNav />
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
