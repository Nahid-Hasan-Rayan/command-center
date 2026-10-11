/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { signOutAction } from "@/app/actions-auth";
import { AuthCard } from "@/components/auth-card";
import { EnrollTotp } from "@/components/enroll-totp";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default function EnrollPage() {
  return (
    <AuthCard
      title="Set up two-step sign-in"
      subtitle="Scan the code with an authenticator app, then enter the 6-digit code. This is required for every account."
    >
      <EnrollTotp />
      <form action={signOutAction} className="mt-4">
        <button type="submit" className={buttonClass("quiet")}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
