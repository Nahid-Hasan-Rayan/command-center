/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { z } from "zod";
import { Badge, Card } from "@/components/card";
import { Form } from "@/components/form";
import { EmptyState, Field, inputClass, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { updateBugAction } from "../actions";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bug reports" };

const reportSchema = z.array(
  z.object({
    id: z.uuid(),
    created_at: z.string(),
    email: z.string(),
    page: z.string(),
    summary: z.string(),
    details: z.string(),
    status: z.string(),
    admin_note: z.string().nullable(),
  }),
);

const STATUSES = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
  ["wont_fix", "Will not fix"],
] as const;

export default async function BugReportsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_bug_reports", { status_filter: null });
  const parsed = reportSchema.safeParse(data ?? []);

  if (error || !parsed.success) {
    return (
      <EmptyState title="Bug reports could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bug reports"
        subtitle="What people told you is broken, newest open first."
      />
      <AdminNav current="/admin/bugs" />
      {parsed.data.length === 0 ? (
        <p className="text-sm text-muted">No reports yet.</p>
      ) : (
        <div className="space-y-4">
          {parsed.data.map((report) => (
            <Card
              key={report.id}
              title={report.summary}
              aside={
                <Badge tone={report.status === "resolved" ? "accent" : "warn"}>
                  {report.status.replace("_", " ")}
                </Badge>
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  {report.email} · {formatDateTime(report.created_at)}
                  {report.page ? ` · ${report.page}` : ""}
                </p>
                {report.details ? (
                  <p className="whitespace-pre-wrap text-sm">{report.details}</p>
                ) : null}
                <Form action={updateBugAction} submit="Update" tone="quiet">
                  <input type="hidden" name="reportId" value={report.id} />
                  <Field label="Status" htmlFor={`bug-status-${report.id}`}>
                    <select
                      id={`bug-status-${report.id}`}
                      name="status"
                      defaultValue={report.status}
                      className={inputClass}
                    >
                      {STATUSES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Note to the reporter (optional)" htmlFor={`bug-note-${report.id}`}>
                    <input
                      id={`bug-note-${report.id}`}
                      name="note"
                      maxLength={500}
                      defaultValue={report.admin_note ?? ""}
                      className={inputClass}
                    />
                  </Field>
                </Form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
