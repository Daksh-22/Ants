import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "../styles/globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { LevelUpModal } from "@/components/gamification/LevelUpModal";
import { XpToastLayer } from "@/components/gamification/XpToast";
import { AppStateProvider } from "@/components/app/AppState";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ants",
  description: "Investing that finally feels like it belongs to you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0C0C0E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-base text-primary antialiased">
        <AppStateProvider>
          {/* the phone frame — full-bleed on mobile, a defined column on larger screens */}
          <div className="relative mx-auto min-h-screen w-full max-w-app bg-base sm:border-x sm:border-subtle sm:shadow-[0_0_80px_rgba(0,0,0,0.6)]">
            {/* content sits above the bottom nav; pb leaves room for the dock */}
            <main className="min-h-screen pb-28">{children}</main>
            <BottomNav />
            <LevelUpModal />
            <XpToastLayer />
          </div>
        </AppStateProvider>
      </body>
    </html>
  );
}
