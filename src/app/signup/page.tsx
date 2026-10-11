/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { signupAction } from "@/app/actions-auth";
import { AuthCard } from "@/components/auth-card";
import { Form } from "@/components/form";
import { Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create account"
      subtitle="Use the same email address your invitation was sent to."
    >
      <Form action={signupAction} submit="Create account">
        <Field label="Name" htmlFor="displayName">
          <input
            id="displayName"
            name="displayName"
            autoComplete="name"
            required
            maxLength={60}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 12 characters.">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className={inputClass}
          />
        </Field>
      </Form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link className="text-accent underline" href="/login">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
