/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </header>
      <div className="rounded-xl border border-border bg-surface p-4">{children}</div>
    </div>
  );
}
