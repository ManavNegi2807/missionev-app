"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "missionev:theme";
const EVENT = "missionev:theme-change";

type Theme = "light" | "dark";

/** The theme lives on <html data-theme>; the inline script in the root layout sets it before first paint. */
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    document.documentElement.dataset.theme = e.newValue === "dark" ? "dark" : "light";
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked (private window); the choice then lasts for this page view only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-theme-toggle={theme}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-fg"
    >
      <Icon aria-hidden className="size-[18px]" />
    </button>
  );
}
