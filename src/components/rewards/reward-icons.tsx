import type { IconKey } from "@/lib/rewards/catalog";

/** Original minimal line icons for the redemption catalog (24×24, currentColor). */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function RewardIcon({ kind, className = "size-7" }: { kind: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...P}>
      {kind === "metro" && (
        <>
          <rect x="5" y="3" width="14" height="14" rx="4" />
          <path d="M5 11h14M10 6h4M8 17l-2 4M16 17l2 4M7 21h10" />
          <circle cx="9" cy="14" r=".7" fill="currentColor" />
          <circle cx="15" cy="14" r=".7" fill="currentColor" />
        </>
      )}
      {kind === "charge" && (
        <>
          <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" />
          <path d="m12.9 9.6-2 2.9h2.4l-1.3 2.6" />
        </>
      )}
      {kind === "bike" && (
        <>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="m6 16 3.5-7h5L18 16M9.5 9l2.5 7 2.5-7M13 6h3" />
        </>
      )}
      {kind === "leaf" && (
        <>
          <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
          <path d="M9 15c0-3 2-5 6-5 0 3-2 5-5 5ZM9 15l3-3" />
        </>
      )}
      {kind === "transit" && (
        <>
          <rect x="4" y="4" width="16" height="13" rx="3" />
          <path d="M4 11h16M8 4v7M16 4v7M6 17v3M18 17v3" />
          <circle cx="8" cy="14" r=".7" fill="currentColor" />
          <circle cx="16" cy="14" r=".7" fill="currentColor" />
        </>
      )}
      {kind === "wrench" && <path d="M15 4a4.5 4.5 0 0 0-4 6.3L4.5 16.8a2 2 0 0 0 2.8 2.8l6.5-6.5A4.5 4.5 0 0 0 20 9l-3 3-2.5-.5L14 9l3-3Z" />}
    </svg>
  );
}
