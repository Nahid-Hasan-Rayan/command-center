/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Card } from "@/components/card";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin audit" };

const auditSchema = z.array(
  z.object({
    id: z.number(),
    at: z.string(),
    admin_email: z.string().nullable(),
    action: z.string(),
    target_email: z.string().nullable(),
    detail: z.record(z.string(), z.unknown()).nullable(),
  }),
);

export default async function AdminAuditPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_audit_list", { max_rows: 200 });
  const parsed = auditSchema.safeParse(data ?? []);

  if (error || !parsed.success) {
    return (
      <EmptyState title="The audit trail could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin audit"
        subtitle="Every administrator action, newest first. It cannot be edited."
      />
      <p className="text-sm">
        <Link className="text-accent underline" href="/admin">
          Back to administration
        </Link>
      </p>
      <Card title="Actions">
        {parsed.data.length === 0 ? (
          <p className="text-sm text-muted">Nothing has been recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3">When</th>
                  <th className="py-1 pr-3">Administrator</th>
                  <th className="py-1 pr-3">Action</th>
                  <th className="py-1">Person</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(entry.at)}</td>
                    <td className="py-2 pr-3 break-all">{entry.admin_email ?? "unknown"}</td>
                    <td className="py-2 pr-3">{entry.action}</td>
                    <td className="py-2 break-all">{entry.target_email ?? ""}</td>
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
