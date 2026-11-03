"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/format";
import { useOnboarding } from "@/providers/onboarding-provider";

/**
 * The page's main call to action. Signed-out visitors go to the sign-in screen, where "Connect MetaMask" is the main
 * button; someone who is already signed in goes straight to the dashboard. `ready` is false on the server and during
 * hydration, so both renders agree.
 */
export function LaunchLink({ size = "md", label = "Launch the app", className }: { size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  const { ready, registration } = useOnboarding();
  const signedIn = ready && registration !== null;
  return (
    <Link
      href={signedIn ? "/capture-trip" : "/register"}
      data-launch={signedIn ? "dashboard" : "app"}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-xl bg-lime font-mono tracking-[0.1em] text-bg uppercase transition hover:bg-lime-strong hover:shadow-glow-lime",
        size === "sm" && "h-9 px-3.5 text-xs",
        size === "md" && "h-11 px-5 text-xs",
        size === "lg" && "h-14 px-8 text-[13px]",
        className,
      )}
    >
      {signedIn ? "Open dashboard" : label}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
