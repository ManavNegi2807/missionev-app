import { Check, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/format";

export type StageState = "done" | "active" | "pending" | "failed" | "preview";

/** Horizontal numbered stage tracker shared by the journey screens. */
export function StageTracker({ labels, states, ariaLabel }: { labels: readonly string[]; states: StageState[]; ariaLabel: string }) {
  const current = states.findIndex((s) => s === "active" || s === "failed" || s === "preview");
  const currentLabel =
    current >= 0
      ? `0${current + 1} ${labels[current]}${states[current] === "preview" ? " (preview only)" : states[current] === "failed" ? " — failed" : ""}`
      : "All stages complete";

  return (
    <nav aria-label={ariaLabel} className="rounded-2xl border border-line bg-panel/70 p-4 backdrop-blur sm:p-5">
      <ol className="flex items-start">
        {labels.map((label, i) => {
          const st = states[i];
          return (
            <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center" aria-current={st === "active" ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={cn("absolute top-4 right-1/2 h-px w-full -translate-y-1/2", states[i - 1] === "done" ? "bg-lime/60" : "bg-line-strong")} />}
              <span
                className={cn(
                  "relative z-10 grid size-8 place-items-center rounded-full border font-mono text-[11px] font-semibold",
                  st === "done" && "border-lime bg-lime text-bg",
                  st === "active" && "border-lime bg-bg-2 text-lime shadow-glow-lime",
                  st === "pending" && "border-line-strong bg-bg-2 text-muted",
                  st === "failed" && "border-err bg-bg-2 text-err",
                  st === "preview" && "border-warn border-dashed bg-bg-2 text-warn",
                )}
              >
                {st === "done" ? <Check aria-hidden className="size-4" /> : st === "failed" ? <X aria-hidden className="size-4" /> : st === "preview" ? <FlaskConical aria-hidden className="size-3.5" /> : `0${i + 1}`}
              </span>
              <span
                className={cn(
                  "hidden px-1 font-mono text-[10.5px] tracking-[0.12em] uppercase sm:block",
                  st === "active" ? "text-lime" : st === "failed" ? "text-err" : st === "done" ? "text-fg" : "text-muted",
                )}
              >
                {label}
                {st === "preview" && <span className="block text-warn">preview</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center font-mono text-[11px] tracking-[0.12em] text-muted sm:hidden">
        NOW: <span className="text-lime">{currentLabel}</span>
      </p>
    </nav>
  );
}
