/** Original MissionEV mark: a leaf whose midrib is an energy bolt, anchored by three network nodes. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8" fill="var(--color-panel)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
      <path
        d="M9 21.5C9 13.5 14.5 8.5 23 8.5c0 8-4.2 13.5-12 13.5-.7 0-1.4-.1-2-.5Z"
        fill="var(--color-lime)" fillOpacity={0.14}
        stroke="var(--color-lime)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M17.6 10.8 13.2 17h3.4l-1.3 4.2 4.5-6.3h-3.4l1.2-4.1Z" fill="var(--color-lime)" />
      <circle cx="8.5" cy="23.5" r="1.7" fill="var(--color-cyan)" />
      <circle cx="23.5" cy="8.5" r="1.7" fill="var(--color-cyan)" />
      <path d="M9.8 22.3 11 21.5" stroke="var(--color-cyan)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <div className="min-w-0 leading-none">
      <p className="text-[15px] font-semibold tracking-[0.18em] text-fg">MISSIONEV</p>
      <p className="mt-1.5 truncate font-mono text-[10.5px] tracking-[0.12em] text-muted">CARBONCOIN PROTOCOL</p>
    </div>
  );
}

/** Simplified fox glyph for the browser-wallet row. Generic — not the MetaMask brand asset. */
export function WalletFoxIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M4 6l9 6.5h6L28 6l-2 11 2 8-6 2-3-3h-6l-3 3-6-2 2-8L4 6Z" fill="#F2BC65" stroke="#8a5a1a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M13 12.5 16 18l3-5.5" fill="#E8833A" />
      <circle cx="12.5" cy="17" r="1.1" fill="#080B10" />
      <circle cx="19.5" cy="17" r="1.1" fill="#080B10" />
      <path d="M14 22h4l-2 2-2-2Z" fill="#080B10" />
    </svg>
  );
}
