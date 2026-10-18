/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { z } from "zod";
import { Badge, Card } from "@/components/card";
import { Form } from "@/components/form";
import { Field, inputClass, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { submitBugReportAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Report a problem" };

const reportRow = z.object({
  id: z.uuid(),
  created_at: z.string(),
  summary: z.string(),
  status: z.string(),
  admin_note: z.string().nullable(),
});

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "Being looked at",
  resolved: "Resolved",
  wont_fix: "Will not fix",
};

export default async function ReportPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("bug_reports")
    .select("id, created_at, summary, status, admin_note")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const reports = z.array(reportRow).safeParse(data ?? []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Report a problem"
        subtitle="Something broken or confusing? Tell the administrator what happened."
      />
      <Card title="What went wrong?">
        <Form action={submitBugReportAction} submit="Send report">
          <Field label="Summary" htmlFor="bug-summary">
            <input
              id="bug-summary"
              name="summary"
              required
              minLength={3}
              maxLength={120}
              className={inputClass}
            />
          </Field>
          <Field label="Which page? (optional)" htmlFor="bug-page" hint="For example /study">
            <input id="bug-page" name="page" maxLength={200} className={inputClass} />
          </Field>
          <Field label="What did you expect, and what happened? (optional)" htmlFor="bug-details">
            <textarea
              id="bug-details"
              name="details"
              rows={4}
              maxLength={2000}
              className={inputClass}
            />
          </Field>
        </Form>
      </Card>

      {reports.success && reports.data.length > 0 ? (
        <Card title="Your reports">
          <ul className="divide-y divide-border">
            {reports.data.map((report) => (
              <li key={report.id} className="space-y-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{report.summary}</p>
                  <Badge tone={report.status === "resolved" ? "accent" : "neutral"}>
                    {STATUS_LABEL[report.status] ?? report.status}
                  </Badge>
                </div>
                {report.admin_note ? (
                  <p className="text-sm text-muted">Administrator: {report.admin_note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
