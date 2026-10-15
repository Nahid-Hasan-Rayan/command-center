/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Badge, Card } from "@/components/card";
import { EmptyState, PageHeader } from "@/components/ui";
import { FEATURE_CATALOG, parseFeatures } from "@/domain/features";
import { parseAccountStatus, statusLabel, statusTone } from "@/domain/registration";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { DecisionForms, ManagePanel, type PersonRow } from "./person-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration" };

const rowSchema = z.object({
  user_id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  whatsapp: z.string().nullable(),
  matric_id: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  requested_at: z.string(),
  decided_at: z.string().nullable(),
  decision_note: z.string().nullable(),
  is_admin: z.boolean(),
  features: z.array(z.string()),
});

const featureLabel = (id: string): string =>
  FEATURE_CATALOG.find((feature) => feature.id === id)?.label ?? id;

export default async function AdminPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  const parsed = z.array(rowSchema).safeParse(data ?? []);

  if (error || !parsed.success) {
    return (
      <EmptyState title="The people list could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  const people: PersonRow[] = parsed.data.map((row) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    whatsapp: row.whatsapp,
    matricId: row.matric_id,
    note: row.note,
    status: parseAccountStatus(row.status),
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    isAdmin: row.is_admin,
    features: parseFeatures(row.features),
  }));

  const waiting = people.filter((person) => person.status === "pending");
  const others = people.filter((person) => person.status !== "pending");
  const count = (status: string) => people.filter((person) => person.status === status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Approve people, choose their features, and keep the app safe."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Awaiting approval", value: waiting.length },
          { label: "Approved", value: count("approved") },
          { label: "Suspended or archived", value: count("suspended") + count("removed") },
          { label: "Declined or banned", value: count("rejected") + count("banned") },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <p className="text-sm">
        <Link className="text-accent underline" href="/admin/audit">
          View the admin audit trail
        </Link>
      </p>

      <Card
        title="Registration requests"
        aside={<Badge tone="warn">{waiting.length} waiting</Badge>}
      >
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">No one is waiting.</p>
        ) : (
          <ul className="space-y-6">
            {waiting.map((person) => (
              <li key={person.userId} className="space-y-3">
                <div>
                  <p className="font-medium">{person.fullName}</p>
                  <p className="break-all text-sm text-muted">{person.email}</p>
                  <p className="text-sm">
                    WhatsApp: {person.whatsapp ?? "not provided"} · Matric ID:{" "}
                    {person.matricId ?? "not provided"}
                  </p>
                  {person.note ? <p className="text-sm">"{person.note}"</p> : null}
                  <p className="text-xs text-muted">
                    Requested {formatDateTime(person.requestedAt)}
                  </p>
                </div>
                <DecisionForms person={person} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="People">
        {others.length === 0 ? (
          <p className="text-sm text-muted">No one else has registered yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {others.map((person) => (
              <li key={person.userId} className="py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{person.fullName}</span>{" "}
                      <span className="break-all text-sm text-muted">{person.email}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {person.isAdmin ? <Badge tone="accent">Administrator</Badge> : null}
                      <Badge tone={statusTone(person.status)}>{statusLabel(person.status)}</Badge>
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm">
                      WhatsApp: {person.whatsapp ?? "not provided"} · Matric ID:{" "}
                      {person.matricId ?? "not provided"}
                    </p>
                    {person.status === "approved" ? (
                      <p className="text-sm text-muted">
                        Features:{" "}
                        {person.isAdmin
                          ? "all"
                          : person.features.length
                            ? person.features.map(featureLabel).join(", ")
                            : "none"}
                      </p>
                    ) : null}
                    {person.userId === admin.userId ? (
                      <p className="text-sm text-muted">This is your account.</p>
                    ) : (
                      <ManagePanel person={person} viewerIsRoot={admin.isRoot} />
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
