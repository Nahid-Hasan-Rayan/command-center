/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { ReactNode } from "react";

interface CardProps {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function Card({ title, aside, children }: CardProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    warn: "bg-surface-2 text-warn",
    accent: "bg-surface-2 text-accent",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}
