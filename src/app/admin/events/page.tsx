/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Badge, Card } from "@/components/card";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatMs } from "@/domain/admin-overview";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

const eventSchema = z.array(
  z.object({
    id: z.number(),
    at: z.string(),
    kind: z.string(),
    severity: z.string(),
    email: z.string().nullable(),
    path: z.string().nullable(),
    duration_ms: z.number().nullable(),
    detail: z.record(z.string(), z.unknown()).nullable(),
  }),
);

const LEVELS = ["error", "warn", "info"] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  await requireAdmin();
  const { level } = await searchParams;
  const minimum = (LEVELS as readonly string[]).includes(level ?? "") ? (level as string) : "warn";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_events", {
    min_severity: minimum,
    max_rows: 200,
  });
  const parsed = eventSchema.safeParse(data ?? []);

  if (error || !parsed.success) {
    return (
      <EmptyState title="Events could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Errors and warnings recorded by the app. Kept for 90 days."
      />
      <AdminNav current="/admin/events" />
      <p className="flex gap-3 text-sm">
        {LEVELS.map((value) => (
          <Link
            key={value}
            href={`/admin/events?level=${value}`}
            className={value === minimum ? "font-medium underline" : "text-muted underline"}
          >
            {value === "error"
              ? "Errors only"
              : value === "warn"
                ? "Warnings and errors"
                : "Everything"}
          </Link>
        ))}
      </p>
      <Card title={`Latest ${parsed.data.length}`}>
        {parsed.data.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded at this level.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3">When</th>
                  <th className="py-1 pr-3">Level</th>
                  <th className="py-1 pr-3">Event</th>
                  <th className="py-1 pr-3">Person</th>
                  <th className="py-1 pr-3">Time</th>
                  <th className="py-1">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.data.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(event.at)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={event.severity === "error" ? "warn" : "neutral"}>
                        {event.severity}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 break-all">{event.kind}</td>
                    <td className="py-2 pr-3 break-all">{event.email ?? ""}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{formatMs(event.duration_ms)}</td>
                    <td className="py-2 break-all text-muted">
                      {event.detail && Object.keys(event.detail).length > 0
                        ? JSON.stringify(event.detail)
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
