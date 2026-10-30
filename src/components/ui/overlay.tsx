"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Traps Tab inside `ref`, closes on Escape, locks page scroll and restores focus to the opener. */
function useDialogBehavior(ref: React.RefObject<HTMLElement | null>, onClose: () => void, dismissable: boolean) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Prefer the primary action, but never a disabled one (focus() on it is a silent no-op).
    const first = el?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [ref, dismissable]);
}

function Shell({
  variant,
  title,
  eyebrow,
  onClose,
  dismissable = true,
  children,
  footer,
  labelId,
}: {
  variant: "modal" | "drawer";
  title: string;
  eyebrow?: string;
  onClose: () => void;
  dismissable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  labelId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehavior(ref, onClose, dismissable);
  const drawer = variant === "drawer";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex" data-overlay={variant}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-shade/50 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-dvh flex-col border border-line-strong bg-panel shadow-2xl shadow-black outline-none",
          drawer ? "ml-auto h-dvh w-full max-w-[28rem] rounded-none border-y-0 border-r-0" : "m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-2xl sm:w-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="section-label mb-1">{eyebrow}</p>}
            <h2 id={labelId} className="text-[15px] font-semibold tracking-[0.06em] uppercase">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissable}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-fg/[0.06] hover:text-fg disabled:opacity-40"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export const Modal = (p: Omit<Parameters<typeof Shell>[0], "variant">) => <Shell variant="modal" {...p} />;
export const Drawer = (p: Omit<Parameters<typeof Shell>[0], "variant">) => <Shell variant="drawer" {...p} />;
