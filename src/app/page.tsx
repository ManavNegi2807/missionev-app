import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

const TITLE = "MissionEV · A Strava for carbon";
const DESCRIPTION = "Reward the journey you chose, not the car you own. MissionEV measures each trip, verifies it, and pays $MEV on Portal V3 for the CO2 you actually avoided.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "MissionEV" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default function Home() {
  return <LandingPage />;
}
