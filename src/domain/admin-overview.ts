/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { z } from "zod";

const countByDay = z.object({ day: z.string(), count: z.number() });
const timing = z.object({
  name: z.string(),
  count: z.number(),
  p50_ms: z.number().nullable(),
  p95_ms: z.number().nullable(),
});

export const overviewSchema = z.object({
  users: z.record(z.string(), z.number()),
  signups_14d: z.array(countByDay),
  active_users_7d: z.number(),
  messages_7d: z.number(),
  study_minutes_7d: z.number(),
  open_bugs: z.number(),
  errors_24h: z.number(),
  errors_7d: z.number(),
  top_errors: z.array(z.object({ kind: z.string(), count: z.number() })),
  timings: z.array(timing),
});

export type AdminOverview = z.infer<typeof overviewSchema>;

/** Number of people in a status, 0 when nobody is. */
export function userCount(overview: AdminOverview, status: string): number {
  return overview.users[status] ?? 0;
}

export function totalUsers(overview: AdminOverview): number {
  return Object.values(overview.users).reduce((sum, count) => sum + count, 0);
}

/** Bar heights from 0 to 100 for a series, so the tallest day fills the chart. */
export function barHeights(values: readonly number[]): number[] {
  const peak = Math.max(0, ...values);
  return values.map((value) => (peak === 0 ? 0 : Math.round((value / peak) * 100)));
}

/** "850 ms" below a second, "1.2 s" above it, "-" when unknown. */
export function formatMs(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}

export type Health = "good" | "watch" | "bad";

/** A quick read of the last day: errors and a slow action both matter. */
export function healthOf(overview: AdminOverview): Health {
  const slowest = Math.max(0, ...overview.timings.map((entry) => entry.p95_ms ?? 0));
  if (overview.errors_24h >= 10 || slowest >= 5000) {
    return "bad";
  }
  if (overview.errors_24h > 0 || slowest >= 2000 || overview.open_bugs >= 5) {
    return "watch";
  }
  return "good";
}

export function healthLabel(health: Health): string {
  return { good: "Healthy", watch: "Needs a look", bad: "Needs attention" }[health];
}
