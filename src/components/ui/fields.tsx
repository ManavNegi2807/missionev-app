import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

const controlClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-lg border bg-bg-2 px-3 text-sm text-fg placeholder:text-muted/60 transition",
    "hover:border-line-strong focus-visible:border-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30",
    error ? "border-err/60" : "border-line",
  );

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="section-label mb-1.5 block">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-lime">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-err">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  mono,
  suggestions,
  ...input
}: BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & { mono?: boolean; suggestions?: string[] }) {
  const id = useId();
  const listId = `${id}-list`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        {...input}
        list={suggestions?.length ? listId : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass(error), mono && "font-mono tracking-wider uppercase")}
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...select
}: BaseProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    options: readonly string[];
    placeholder: string;
  }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <select
          id={id}
          {...select}
          aria-invalid={error ? true : undefined}
          aria-required={required}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(controlClass(error), "appearance-none pr-9", !select.value && "text-muted/70")}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-panel text-fg">
              {o}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      </div>
    </FieldShell>
  );
}
