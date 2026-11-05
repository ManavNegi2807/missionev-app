import {
  BadgeCheck,
  BarChart3,
  Bus,
  Car,
  CircleDashed,
  Coins,
  ExternalLink,
  FlaskConical,
  Footprints,
  Gift,
  Layers,
  MapPin,
  ShieldCheck,
  TrainFront,
  Wallet,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/format";
import { CHAIN_ID, DEPLOYED_CONTRACT, DEPLOY_PROOF_URL, DOCS_URL, GRID_FACTOR_KG_PER_KWH, REPO_URL } from "@/lib/landing/facts";
import { Calculator } from "./calculator";
import { CopyButton } from "./copy-button";
import { CountUp } from "./count-up";
import { LaunchLink } from "./launch-link";
import { LiveChain } from "./live-chain";
import { RecentActivity } from "./recent-activity";
import { Magnetic } from "./magnetic";
import { Reveal } from "./reveal";
import { SpotlightCard } from "./spotlight-card";

function Head({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <Reveal className="max-w-3xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-lime uppercase sm:text-xs">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-base leading-relaxed text-muted text-pretty sm:text-lg">{children}</p>}
    </Reveal>
  );
}

const wrap = "mx-auto max-w-6xl px-4 sm:px-6";

/* ---------------- a slow strip of the modes MissionEV understands ---------------- */
const MODES = [
  { icon: TrainFront, label: "Metro" },
  { icon: Bus, label: "Electric bus" },
  { icon: Footprints, label: "Walking and cycling" },
  { icon: Zap, label: "Electric car" },
  { icon: Zap, label: "Electric two-wheeler" },
  { icon: Car, label: "Ola, Uber, Rapido" },
  { icon: Car, label: "Petrol car: measured, never rewarded" },
];

export function ModeMarquee() {
  const row = (hidden: boolean) =>
    MODES.map(({ icon: Icon, label }) => (
      <li key={label + hidden} aria-hidden={hidden || undefined} className="flex items-center gap-2.5 px-6 text-sm whitespace-nowrap text-muted">
        <Icon aria-hidden className="size-4 text-lime" />
        {label}
      </li>
    ));
  return (
    <section aria-label="Transport modes MissionEV understands" className="lp-marquee-wrap relative overflow-hidden border-y border-line bg-bg-2/60 py-4">
      <ul className="lp-marquee flex">
        {row(false)}
        {row(true)}
      </ul>
    </section>
  );
}

/* ---------------- the problem ---------------- */
const PROBLEMS = [
  {
    icon: Car,
    title: "An EV owner in a petrol cab",
    text: "Owning a clean vehicle earns nothing by itself. MissionEV calculates the journey that actually happened, so a petrol cab ride earns no $MEV, even for an EV owner.",
  },
  {
    icon: TrainFront,
    title: "A metro rider with no vehicle",
    text: "Metro, e-bus and walking trips need no vehicle at all. If a journey avoids CO₂ against its reference, it earns, whatever is parked at home.",
  },
  {
    icon: Zap,
    title: "EVs are not “zero emission”",
    text: `Electricity is counted at the grid's own factor, ${GRID_FACTOR_KG_PER_KWH} kg CO₂ per kWh (CEA, FY 2025-26), so the comparison is honest on both sides.`,
  },
];

export function ProblemSection() {
  return (
    <section aria-labelledby="why-title" className={`${wrap} py-24 sm:py-32`}>
      <Head id="why-title" eyebrow="The problem" title="Clean-mobility rewards pay for what you own. They should pay for what you did.">
        Most schemes reward the vehicle in the garage. MissionEV rewards the trip.
      </Head>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, text }, i) => (
          <Reveal key={title} delay={i * 90}>
            <SpotlightCard className="h-full p-6">
              <span className="grid size-11 place-items-center rounded-xl border border-lime/40 bg-lime/[0.09] text-lime">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- how it works ---------------- */
const STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    text: "Your MetaMask address is your account. No phone number, no password. No wallet? Look around with a labelled demo account.",
  },
  {
    icon: MapPin,
    title: "Record a journey",
    text: "Say how you travelled, then record with real GPS or a clearly labelled simulation. Ride receipts are read in your browser; the image never leaves your device.",
  },
  {
    icon: ShieldCheck,
    title: "Get it verified",
    text: "Four checks run, then the verifier node recomputes the distance and the CO₂ itself and signs an EIP-712 message. The server only signs.",
  },
  {
    icon: Coins,
    title: "Earn $MEV",
    text: "Your own wallet sends the transaction on Portal V3: 20 $MEV per kg of CO₂ avoided, a streak multiplier up to 3×, and a bonus for clean modes.",
  },
];

export function HowSection() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-y border-line bg-bg-2/50 py-24 sm:py-32">
      <div className={wrap}>
        <Head id="how-title" eyebrow="How it works" title="From a commute to a verified reward in four steps">
          The oracle can sign but never submit: your wallet sends the transaction, so MissionEV never holds your funds or acts on your behalf.
        </Head>
        <div className="relative mt-14">
          <div aria-hidden className="absolute top-[50px] right-0 left-0 hidden lg:block">
            <div className="lp-steps-line relative" />
          </div>
          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="list-none">
                <Reveal delay={i * 100} className="h-full">
                  <SpotlightCard className="h-full p-6">
                    <div className="flex items-center gap-3">
                      <span className="relative grid size-[52px] place-items-center rounded-2xl border border-lime/40 bg-panel text-lime shadow-glow-lime">
                        <Icon aria-hidden className="size-6" />
                        <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-lime font-mono text-[11px] font-semibold text-bg">{i + 1}</span>
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                  </SpotlightCard>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- try the maths ---------------- */
export function TrySection() {
  return (
    <section id="try" aria-labelledby="try-title" className={`${wrap} scroll-mt-20 py-24 sm:py-32`}>
      <Head id="try-title" eyebrow="Try the maths" title="Pick a journey. Watch the carbon and the reward move.">
        This is the real calculation, not a mock-up: the same emissions engine and the same on-chain reward formula the app runs.
      </Head>
      <Reveal className="mt-12">
        <Calculator />
      </Reveal>
    </section>
  );
}

/* ---------------- inside the app ---------------- */
const SCREENS = [
  { n: "01", icon: Wallet, title: "Sign-in & profile", text: "Connect MetaMask and say how you usually commute. Nine journey modes (plus an \"other\" that can't be calculated); vehicles are only a profile." },
  { n: "02", icon: MapPin, title: "Capture trip", text: "A live GPS map, four verification checks, and a carbon comparison with its formula and sources." },
  { n: "03", icon: Gift, title: "Rewards", text: "Your $MEV balance, a simulated redemption catalogue and your on-chain activity." },
  { n: "04", icon: BarChart3, title: "Analytics", text: "Emissions, mode share and a leaderboard. Community data is synthetic, and says so." },
];

export function AppSection() {
  return (
    <section aria-labelledby="app-title" className="border-y border-line bg-bg-2/50 py-24 sm:py-32">
      <div className={wrap}>
        <Head id="app-title" eyebrow="Inside the app" title="Four screens, one flow">
          After you connect, the dashboard walks you through the same four screens every time.
        </Head>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SCREENS.map(({ n, icon: Icon, title, text }, i) => (
            <Reveal key={n} delay={i * 80}>
              <SpotlightCard className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-semibold text-line-strong">{n}</span>
                  <Icon aria-hidden className="size-6 text-lime" />
                </div>
                <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- why Portal V3 ---------------- */
export function PortalSection() {
  const stats: Array<{ to: number; decimals?: number; suffix?: string; label: string }> = [
    { to: 9, label: "journey modes the engine understands" },
    { to: 20, suffix: " MEV", label: "per kg of CO₂ avoided, before streaks" },
    { to: 3, suffix: "×", label: "top streak multiplier, at 20 days" },
    { to: 100, suffix: "+", label: "automated tests, including the compiled contract" },
  ];
  return (
    <section id="portal" aria-labelledby="portal-title" className={`${wrap} scroll-mt-20 py-24 sm:py-32`}>
      <Head id="portal-title" eyebrow="Why Portal V3" title="An EVM chain where commuters send their own transactions">
        The contract is live on Portal V3 testnet. Streaks and carbon score are stored on-chain per commuter, and every reward is a public record.
      </Head>

      <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Reveal>
          <SpotlightCard className="h-full p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-cyan/40 bg-cyan/[0.09] text-cyan">
                <Layers aria-hidden className="size-5" />
              </span>
              <div>
                <p className="section-label">MissionEV v2 contract</p>
                <p className="text-sm text-muted">Deployed and verified on Portal V3 testnet</p>
              </div>
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="section-label">Address</dt>
                <dd className="mt-1.5 flex items-center gap-2">
                  <code className="min-w-0 flex-1 rounded-lg border border-line bg-bg-2 px-3 py-2 font-mono text-[12.5px] break-all">{DEPLOYED_CONTRACT}</code>
                  <CopyButton value={DEPLOYED_CONTRACT} label="Copy contract address" />
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="section-label">Chain</dt>
                  <dd className="mt-1.5 font-mono">Portal V3 · {CHAIN_ID}</dd>
                </div>
                <div>
                  <dt className="section-label">Check it yourself</dt>
                  <dd className="mt-1.5 font-mono text-[12.5px]">npm run contract:verify</dd>
                </div>
              </div>
            </dl>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href={DEPLOY_PROOF_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 font-mono text-xs tracking-[0.1em] uppercase transition hover:border-cyan/50 hover:text-cyan">
                Deploy transaction <ExternalLink aria-hidden className="size-3.5" />
              </a>
              <a href={`${DOCS_URL}/ARCHITECTURE.md`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 font-mono text-xs tracking-[0.1em] uppercase transition hover:border-cyan/50 hover:text-cyan">
                Architecture <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </div>
          </SpotlightCard>
        </Reveal>

        <div className="grid grid-cols-2 gap-5">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <SpotlightCard className="flex h-full flex-col justify-between p-5">
                <p className="text-3xl font-semibold tracking-tight text-lime sm:text-4xl">
                  <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-xs leading-snug text-muted">{s.label}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal className="mt-5">
        <LiveChain />
      </Reveal>

      <Reveal className="mt-5">
        <RecentActivity />
      </Reveal>
    </section>
  );
}

/* ---------------- honest status ---------------- */
const REAL = [
  "A contract deployed and verified on Portal V3 testnet",
  "A carbon engine with cited emission factors and shown formulas",
  "A verifier node that recomputes everything before it signs",
  "MetaMask sign-in with network switching",
  "Receipt reading in your browser; the image is never uploaded",
  "100+ automated tests, including the compiled contract in an EVM",
];
const SIMULATED = [
  "Demo accounts: no wallet, nothing on-chain",
  "Trips recorded in Simulated mode",
  "Redemptions: the contract has no redeem function",
  "Community analytics: synthetic data",
  "Metro and e-bus factors are placeholders, flagged as such",
];
const NEXT = ["A first recordCommute sent from the web app on Portal V3", "Sign-In with Ethereum (a signed login and a server session)", "A durable store for the verifier node"];

function List({ items, icon: Icon, tone }: { items: string[]; icon: typeof BadgeCheck; tone: string }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-sm leading-relaxed">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone)} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function HonestSection() {
  return (
    <section id="honest" aria-labelledby="honest-title" className="scroll-mt-20 border-y border-line bg-bg-2/50 py-24 sm:py-32">
      <div className={wrap}>
        <Head id="honest-title" eyebrow="Honest by design" title="What is real today, and what is simulated">
          Every simulated result is labelled in the app. We would rather show the limits than hide them.
        </Head>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Reveal>
            <SpotlightCard className="h-full p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <BadgeCheck aria-hidden className="size-5 text-ok" /> Real today
              </h3>
              <List items={REAL} icon={BadgeCheck} tone="text-ok" />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={90}>
            <SpotlightCard className="h-full p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <FlaskConical aria-hidden className="size-5 text-warn" /> Simulated, and labelled
              </h3>
              <List items={SIMULATED} icon={FlaskConical} tone="text-warn" />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={180}>
            <SpotlightCard className="h-full p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <CircleDashed aria-hidden className="size-5 text-cyan" /> Next
              </h3>
              <List items={NEXT} icon={CircleDashed} tone="text-cyan" />
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- final call to action ---------------- */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className={`${wrap} py-24 sm:py-32`}>
      <Reveal>
        <SpotlightCard className="relative overflow-hidden border-line-strong px-6 py-16 text-center sm:px-12 sm:py-20" style={{ borderRadius: "2rem" }}>
          <div aria-hidden className="lp-spot pointer-events-none absolute inset-0 -z-10 opacity-80" />
          <div aria-hidden className="lp-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
          <LogoMark className="mx-auto size-14" />
          <h2 id="cta-title" className="mx-auto mt-6 max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Ready to see what your commute is worth?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Open the app, connect MetaMask, and record your first journey. It takes about a minute, and it never asks for a phone number.
          </p>
          <div className="mt-9 flex justify-center">
            <Magnetic>
              <LaunchLink size="lg" />
            </Magnetic>
          </div>
          <p className="mt-4 text-sm text-muted">No wallet? You can explore with a demo account first.</p>
        </SpotlightCard>
      </Reveal>
    </section>
  );
}

/* ---------------- footer ---------------- */
export function Footer() {
  const link = "text-muted transition hover:text-fg";
  return (
    <footer className="border-t border-line bg-bg-2/60">
      <div className={`${wrap} py-12`}>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <LogoMark className="size-8" />
              <Wordmark />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">Journey-based carbon rewards on Portal V3. Reward the impact of the journey, not the ownership of the vehicle.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            <a className={link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a className={link} href={DOCS_URL} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            <a className={link} href={`${REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">
              MIT licence
            </a>
            <a className={link} href={`${REPO_URL}/blob/master/SECURITY.md`} target="_blank" rel="noopener noreferrer">
              Security
            </a>
          </nav>
        </div>
        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          $MEV is a prototype reward token, not a certified carbon credit. MissionEV was built for Portaldot Hacker House 2026 (Ecosystem DApps) and runs on Portal V3 testnet.
        </p>
      </div>
    </footer>
  );
}
