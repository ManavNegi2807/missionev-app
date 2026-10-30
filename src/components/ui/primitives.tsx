import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

/* ---------- Panel ---------- */
export function Panel({
  children,
  className,
  glass,
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  as?: "section" | "div" | "aside";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line shadow-panel",
        glass ? "glass" : "bg-panel",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  subtitle,
  action,
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
      <div className="min-w-0">
        {eyebrow && <p className="section-label mb-1">{eyebrow}</p>}
        <h2 id={id} className="text-[15px] font-semibold tracking-[0.06em] text-fg uppercase">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------- Badge ---------- */
type Tone = "neutral" | "lime" | "cyan" | "ok" | "warn" | "err";
const toneClass: Record<Tone, string> = {
  neutral: "border-line-strong text-muted bg-fg/[0.02]",
  lime: "border-lime/40 text-lime bg-lime/[0.08]",
  cyan: "border-cyan/40 text-cyan bg-cyan/[0.08]",
  ok: "border-ok/40 text-ok bg-ok/[0.08]",
  warn: "border-warn/40 text-warn bg-warn/[0.08]",
  err: "border-err/40 text-err bg-err/[0.08]",
};
export const dotClass: Record<Tone, string> = {
  neutral: "bg-muted",
  lime: "bg-lime",
  cyan: "bg-cyan",
  ok: "bg-ok",
  warn: "bg-warn",
  err: "bg-err",
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] leading-4 font-medium tracking-[0.08em] uppercase",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dotClass[tone])} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variantClass: Record<Variant, string> = {
  primary:
    "bg-lime text-bg font-semibold hover:bg-lime-strong hover:shadow-glow-lime disabled:bg-elevated disabled:text-muted disabled:shadow-none",
  secondary:
    "border border-line-strong bg-elevated text-fg hover:border-cyan/50 hover:text-cyan disabled:text-muted disabled:hover:border-line-strong",
  ghost: "text-muted hover:bg-fg/[0.05] hover:text-fg",
  danger: "border border-err/40 bg-err/[0.06] text-err hover:bg-err/[0.12]",
};

export function Button({
  variant = "secondary",
  loading,
  icon,
  children,
  className,
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-mono text-xs tracking-[0.1em] uppercase transition disabled:cursor-not-allowed",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "lg" && "h-12 px-5 text-[13px]",
        variantClass[variant],
        className,
      )}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ---------- Alert ---------- */
export function Alert({
  tone,
  icon,
  title,
  children,
  actions,
  role,
}: {
  tone: "warn" | "err" | "ok" | "cyan" | "neutral";
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
}) {
  const border = {
    warn: "border-warn/35 bg-warn/[0.06]",
    err: "border-err/35 bg-err/[0.06]",
    ok: "border-ok/35 bg-ok/[0.06]",
    cyan: "border-cyan/35 bg-cyan/[0.06]",
    neutral: "border-line bg-fg/[0.02]",
  }[tone];
  const text = { warn: "text-warn", err: "text-err", ok: "text-ok", cyan: "text-cyan", neutral: "text-fg" }[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border p-3.5 sm:p-4", border)}>
      {icon && <span className={cn("mt-0.5 shrink-0", text)}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", text)}>{title}</p>
        {children && <div className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere] text-muted">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------- Key/value row ---------- */
export function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="section-label">{label}</dt>
      <dd className={cn("mt-1 truncate text-sm text-fg", mono && "font-mono")}>{children}</dd>
    </div>
  );
}
