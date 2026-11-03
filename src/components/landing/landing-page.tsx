import "./landing.css";
import { LandingNav } from "./landing-nav";
import { Hero } from "./hero";
import { AppSection, FinalCta, Footer, HonestSection, HowSection, ModeMarquee, PortalSection, ProblemSection, TrySection } from "./sections";

/**
 * The public front door at "/". It explains MissionEV, lets visitors try the real calculation, and leads into the app,
 * where the first screen is "Connect MetaMask". It sits outside the app shell, so it has no sidebar.
 */
export function LandingPage() {
  return (
    <div className="lp bg-bg text-fg">
      <a href="#main" className="sr-only z-[60] rounded-lg bg-lime px-3 py-2 font-mono text-xs text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero />
        <ModeMarquee />
        <ProblemSection />
        <HowSection />
        <TrySection />
        <AppSection />
        <PortalSection />
        <HonestSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
