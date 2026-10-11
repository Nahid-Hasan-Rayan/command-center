/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions-auth";
import { AuthCard } from "@/components/auth-card";
import { Form } from "@/components/form";
import { Field, inputClass } from "@/components/ui";
import { sanitizeNext } from "@/domain/access-gate";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="Use your email and password. You will confirm with your authenticator app next."
    >
      <Form action={loginAction} submit="Continue">
        <input type="hidden" name="next" value={sanitizeNext(next)} />
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
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
      </Form>
      <p className="mt-4 text-sm text-muted">
        Invited by someone?{" "}
        <Link className="text-accent underline" href="/signup">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
