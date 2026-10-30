"use client";

import { StageTracker, type StageState } from "@/components/ui/stage-tracker";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useTrip } from "@/providers/trip-provider";

const STAGES = ["Registered", "Captured", "Verified", "Calculated", "Recorded"] as const;

export function TripPipeline() {
  const { status, record } = useTrip();
  const { isRegistered } = useOnboarding();

  const verified = status === "VERIFIED";
  const failed = status === "FAILED";
  const done = [
    isRegistered,
    ["COMPLETED", "VERIFYING", "VERIFIED", "FAILED"].includes(status),
    verified,
    verified && Boolean(record?.emissions),
    record?.ledger.phase === "confirmed",
  ];
  const previewed = record?.ledger.phase === "previewed";
  const firstOpen = done.findIndex((d) => !d);

  const states: StageState[] = STAGES.map((_, i) => {
    if (done[i]) return "done";
    if (failed && i === 2) return "failed";
    if (i === 4 && previewed) return "preview";
    if (failed && i > 2) return "pending";
    return i === firstOpen ? "active" : "pending";
  });

  return <StageTracker labels={STAGES} states={states} ariaLabel="Journey pipeline" />;
}
