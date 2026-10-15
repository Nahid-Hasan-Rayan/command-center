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
      subtitle="Send a request for access. The administrator reviews it before you can use the app."
    >
      <Form action={signupAction} submit="Request access">
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
        <Field
          label="WhatsApp number"
          htmlFor="whatsapp"
          hint="With country code, for example +60 12-345 6789. Only the administrator sees it."
        >
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            required
            maxLength={20}
            className={inputClass}
          />
        </Field>
        <Field
          label="Matric ID (optional)"
          htmlFor="matricId"
          hint="Students only, for example A25MJ0186."
        >
          <input
            id="matricId"
            name="matricId"
            autoComplete="off"
            maxLength={20}
            className={inputClass}
          />
        </Field>
        <Field label="Why do you want access? (optional)" htmlFor="note">
          <textarea id="note" name="note" rows={2} maxLength={500} className={inputClass} />
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
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acknowledged" required className="mt-1" />
          <span>
            I understand that the administrator can see my registration details and, to keep the
            service safe, the activity, files and messages inside this app.
          </span>
        </label>
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
