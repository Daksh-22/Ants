import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "../styles/globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
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
          {/* the phone frame — full-bleed on mobile, centered on larger screens */}
          <div className="relative mx-auto min-h-screen w-full max-w-app bg-base">
            {/* content sits above the bottom nav; pb leaves room for the nav bar */}
            <main className="min-h-screen pb-28">{children}</main>
            <BottomNav />
          </div>
        </AppStateProvider>
      </body>
    </html>
  );
}
