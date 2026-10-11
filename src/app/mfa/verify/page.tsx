/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { signOutAction, verifyLoginAction } from "@/app/actions-auth";
import { AuthCard } from "@/components/auth-card";
import { Form } from "@/components/form";
import { buttonClass, Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Verify" };

export default function VerifyPage() {
  return (
    <AuthCard
      title="Confirm it is you"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <Form action={verifyLoginAction} submit="Verify">
        <Field label="Code" htmlFor="code">
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className={inputClass}
          />
        </Field>
      </Form>
      <form action={signOutAction} className="mt-3">
        <button type="submit" className={buttonClass("quiet")}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
