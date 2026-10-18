/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import Link from "next/link";
import { Badge, Card } from "@/components/card";
import {
  type AdminOverview,
  barHeights,
  formatMs,
  healthLabel,
  healthOf,
  totalUsers,
  userCount,
} from "@/domain/admin-overview";

function projectRef(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export function OverviewPanel({ overview }: { overview: AdminOverview }) {
  const health = healthOf(overview);
  const heights = barHeights(overview.signups_14d.map((entry) => entry.count));
  const ref = projectRef();
  const stats = [
    { label: "People", value: totalUsers(overview) },
    { label: "Awaiting approval", value: userCount(overview, "pending") },
    { label: "Active in 7 days", value: overview.active_users_7d },
    { label: "Messages in 7 days", value: overview.messages_7d },
    { label: "Study minutes in 7 days", value: overview.study_minutes_7d },
    { label: "Errors in 24 hours", value: overview.errors_24h },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={health === "good" ? "accent" : health === "watch" ? "warn" : "neutral"}>
          {healthLabel(health)}
        </Badge>
        <Link className="text-sm underline" href="/admin/bugs">
          {overview.open_bugs} open bug report{overview.open_bugs === 1 ? "" : "s"}
        </Link>
        <Link className="text-sm underline" href="/admin/events">
          Events and errors
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sign-ups, last 14 days">
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Sign-ups per day">
            {overview.signups_14d.map((entry, index) => (
              <span
                key={entry.day}
                title={`${entry.day}: ${entry.count}`}
                className="flex-1 rounded-t bg-accent"
                style={{ height: `${Math.max(heights[index] ?? 0, entry.count > 0 ? 6 : 2)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Days are in UTC.</p>
        </Card>

        <Card title="Response times (server actions, 7 days)">
          {overview.timings.length === 0 ? (
            <p className="text-sm text-muted">No timings yet. They appear as people use the app.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-2">Action</th>
                  <th className="py-1 pr-2">Calls</th>
                  <th className="py-1 pr-2">Median</th>
                  <th className="py-1">95th</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.timings.slice(0, 8).map((entry) => (
                  <tr key={entry.name}>
                    <td className="py-1 pr-2 break-all">{entry.name}</td>
                    <td className="py-1 pr-2">{entry.count}</td>
                    <td className="py-1 pr-2">{formatMs(entry.p50_ms)}</td>
                    <td className="py-1">{formatMs(entry.p95_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {overview.top_errors.length > 0 ? (
        <Card title="Top errors, 7 days">
          <ul className="space-y-1 text-sm">
            {overview.top_errors.map((entry) => (
              <li key={entry.kind} className="flex justify-between gap-2">
                <span>{entry.kind}</span>
                <span className="text-muted">{entry.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-xs text-muted">
        Full request logs and page speed are in the{" "}
        <a
          className="underline"
          href="https://vercel.com/dashboard"
          rel="noreferrer"
          target="_blank"
        >
          Vercel dashboard
        </a>
        {ref ? (
          <>
            {" "}
            and database logs in{" "}
            <a
              className="underline"
              href={`https://supabase.com/dashboard/project/${ref}/logs/explorer`}
              rel="noreferrer"
              target="_blank"
            >
              Supabase
            </a>
          </>
        ) : null}
        . Events kept here are deleted after 90 days.
      </p>
    </div>
  );
}
