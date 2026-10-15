/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/card";
import { PageHeader } from "@/components/ui";
import { canUseApp, pendingCopy, statusLabel, statusTone } from "@/domain/registration";
import { getAccount } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request status" };

export default async function PendingPage() {
  const account = await getAccount();
  if (!account) {
    redirect("/login");
  }
  if (canUseApp(account.status)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("email, full_name, whatsapp, matric_id, requested_at, decision_note")
    .eq("user_id", account.userId)
    .maybeSingle();

  const copy = pendingCopy(account.status);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={copy.title} subtitle={copy.body} />

      <Card
        title="Request status"
        aside={<Badge tone={statusTone(account.status)}>{statusLabel(account.status)}</Badge>}
      >
        {registration?.decision_note ? (
          <p className="mb-3 rounded-md bg-surface-2 p-3 text-sm">
            <span className="font-medium">Message from the administrator: </span>
            {registration.decision_note}
          </p>
        ) : null}
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd>{registration?.full_name ?? account.fullName}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{registration?.email ?? account.email}</dd>
          <dt className="text-muted">WhatsApp</dt>
          <dd>{registration?.whatsapp ?? "Not provided"}</dd>
          <dt className="text-muted">Matric ID</dt>
          <dd>{registration?.matric_id ?? "Not provided"}</dd>
          {registration?.requested_at ? (
            <>
              <dt className="text-muted">Requested</dt>
              <dd>{formatDateTime(registration.requested_at)}</dd>
            </>
          ) : null}
        </dl>
      </Card>

      {account.status === "pending" ? (
        <Card title="While you wait">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              Command Center is a private planning workspace. The administrator chooses which tools
              each person can use.
            </li>
            <li>Keep your authenticator app: you need it every time you sign in.</li>
            <li>The administrator may contact you on the WhatsApp number or email above.</li>
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
