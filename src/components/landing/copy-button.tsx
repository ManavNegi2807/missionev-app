"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard unavailable: the value is still shown in full for manual copy */
        }
      }}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-fg"
    >
      {done ? <Check aria-hidden className="size-4 text-ok" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}
