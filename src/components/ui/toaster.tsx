"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/format";

export interface Toast {
  id: number;
  tone: "ok" | "err" | "info";
  title: string;
  text?: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "err" ? 8000 : 5000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none fixed top-20 right-3 z-[90] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-6" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "err" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex gap-3 rounded-xl border bg-panel p-3.5 shadow-xl shadow-shade/15",
            t.tone === "ok" && "border-ok/40",
            t.tone === "err" && "border-err/50",
            t.tone === "info" && "border-cyan/40",
          )}
        >
          <span className="mt-0.5 shrink-0">
            {t.tone === "ok" ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : t.tone === "err" ? <XCircle aria-hidden className="size-4 text-err" /> : <Info aria-hidden className="size-4 text-cyan" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{t.title}</p>
            {t.text && <p className="mt-0.5 text-xs leading-relaxed [overflow-wrap:anywhere] text-muted">{t.text}</p>}
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="grid size-6 shrink-0 place-items-center rounded text-muted hover:text-fg">
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
