/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { Form } from "@/components/form";
import { isValidInviteToken } from "@/domain/invite";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidInviteToken(token)) {
    return (
      <AuthCard title="Invitation not found">
        <p className="text-sm text-muted">This link is not valid.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Join a workspace"
      subtitle="Accepting adds you with the access the owner chose for you."
    >
      <Form action={acceptInviteAction} submit="Accept invitation">
        <input type="hidden" name="token" value={token} />
      </Form>
    </AuthCard>
  );
}
