/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted";

export function buttonClass(tone: "primary" | "quiet" | "danger" = "primary"): string {
  const tones = {
    primary: "bg-accent text-black hover:opacity-90",
    quiet: "border border-border bg-surface-2 text-text hover:bg-surface",
    danger: "border border-border bg-surface-2 text-danger hover:bg-surface",
  } as const;
  return `rounded-md px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-60 ${tones[tone]}`;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-muted">{subtitle}</p> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-6">
      <h2 className="font-medium">{title}</h2>
      {children ? <div className="mt-2 space-y-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
