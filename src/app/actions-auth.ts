/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { redirect } from "next/navigation";
import { sanitizeNext } from "@/domain/access-gate";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { siteOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema, totpCodeSchema, uuidSchema } from "@/lib/validation";

const BAD_CREDENTIALS = "Email or password is incorrect.";

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: BAD_CREDENTIALS };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: BAD_CREDENTIALS };
  }
  redirect(sanitizeNext(String(formData.get("next") ?? "")));
}

export async function signupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error && error.status !== undefined && error.status >= 500) {
    return { error: GENERIC_ERROR };
  }
  return { message: "If the address can be used, a confirmation email is on its way." };
}

export interface EnrollmentStart {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function startEnrollment(): Promise<EnrollmentStart | { error: string }> {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) {
    return { error: GENERIC_ERROR };
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyEnrollmentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = totpCodeSchema.safeParse(formData.get("code"));
  const factorId = uuidSchema.safeParse(formData.get("factorId"));
  if (!code.success || !factorId.success) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId.data,
    code: code.data,
  });
  if (error) {
    return { error: "That code did not work. Check the time on your phone and try again." };
  }
  redirect("/");
}

export async function verifyLoginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!code.success) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((entry) => entry.status === "verified");
  if (!factor) {
    redirect("/mfa/enroll");
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (error) {
    return { error: "That code did not work. Try again." };
  }
  redirect(sanitizeNext(String(formData.get("next") ?? "")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
