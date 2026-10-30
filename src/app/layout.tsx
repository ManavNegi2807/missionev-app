import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OnboardingProvider } from "@/providers/onboarding-provider";
import { RewardsProvider } from "@/providers/rewards-provider";
import { TripProvider } from "@/providers/trip-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MissionEV · CarbonCoin Protocol",
  description: "Decentralized EV carbon tracking and CarbonCoin rewards. Sign in with your wallet and register your vehicle.",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light dark",
};

/** Applies the saved theme before first paint so there is no flash of the wrong palette. Light is the default. */
const THEME_BOOT = `try{var t=localStorage.getItem("missionev:theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the boot script before React hydrates, so the server markup legitimately differs.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full">
        <WalletProvider>
          <OnboardingProvider>
            <TripProvider>
              <RewardsProvider>{children}</RewardsProvider>
            </TripProvider>
          </OnboardingProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
