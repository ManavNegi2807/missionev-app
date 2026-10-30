import { cn } from "@/lib/format";

const TOTAL = 7;

export function StepProgress({ step = 1, label = "ACCOUNT INITIALIZATION" }: { step?: number; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL}
      aria-valuenow={step}
      aria-valuetext={`Step ${step} of ${TOTAL}: ${label}`}
      className="w-full max-w-md"
    >
      <p className="font-mono text-[11px] tracking-[0.14em] text-muted">
        <span className="text-lime">STEP {String(step).padStart(2, "0")} OF {String(TOTAL).padStart(2, "0")}</span> — {label}
      </p>
      <div aria-hidden className="mt-2 flex gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i < step ? "bg-lime shadow-[0_0_10px_color-mix(in_srgb,var(--color-lime)_45%,transparent)]" : "bg-line-strong/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
