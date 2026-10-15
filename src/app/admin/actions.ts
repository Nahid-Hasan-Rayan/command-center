/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/account";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import {
  accountStatusSchema,
  adminRoleSchema,
  memberFeaturesSchema,
  registrationDecisionSchema,
  removalSchema,
} from "@/lib/validation";

/** Postgres codes raised on purpose by the admin functions. Their messages are written for people. */
const SAFE_CODES = new Set(["42501", "22023", "55000", "P0002"]);

function failure(error: { code?: string; message: string }): FormState {
  return { error: error.code && SAFE_CODES.has(error.code) ? error.message : GENERIC_ERROR };
}

function checkForm(): FormState {
  return { error: "Check the form and try again." };
}

export async function decideRegistrationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = registrationDecisionSchema.safeParse({
    userId: formData.get("userId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
    features: formData.getAll("features"),
  });
  if (!parsed.success) {
    return checkForm();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decide_registration", {
    target: parsed.data.userId,
    decision: parsed.data.decision,
    note: parsed.data.note ?? null,
    features: parsed.data.decision === "approve" ? parsed.data.features : [],
  });
  if (error) {
    return failure(error);
  }
  revalidatePath("/admin");
  return { message: parsed.data.decision === "approve" ? "Approved." : "Request declined." };
}

export async function setEntitlementsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = memberFeaturesSchema.safeParse({
    userId: formData.get("userId"),
    features: formData.getAll("features"),
  });
  if (!parsed.success) {
    return checkForm();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_entitlements", {
    target: parsed.data.userId,
    features: parsed.data.features,
  });
  if (error) {
    return failure(error);
  }
  revalidatePath("/admin");
  return { message: "Features saved." };
}

export async function setStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = accountStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return checkForm();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_status", {
    target: parsed.data.userId,
    new_status: parsed.data.status,
    note: parsed.data.note ?? null,
  });
  if (error) {
    return failure(error);
  }
  revalidatePath("/admin");
  return {
    message: parsed.data.status === "suspended" ? "Account suspended." : "Account restored.",
  };
}

export async function removeUserAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = removalSchema.safeParse({
    userId: formData.get("userId"),
    option: formData.get("option") ?? "",
    note: formData.get("note") ?? "",
    confirmEmail: formData.get("confirmEmail") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_user", {
    target: parsed.data.userId,
    option: parsed.data.option,
    note: parsed.data.note ?? null,
    confirm_email: parsed.data.confirmEmail ?? null,
  });
  if (error) {
    return failure(error);
  }
  revalidatePath("/admin");
  return { message: "Done." };
}

export async function setAdminRoleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = adminRoleSchema.safeParse({
    userId: formData.get("userId"),
    makeAdmin: formData.get("makeAdmin"),
  });
  if (!parsed.success) {
    return checkForm();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_platform_admin", {
    target: parsed.data.userId,
    make_admin: parsed.data.makeAdmin,
  });
  if (error) {
    return failure(error);
  }
  revalidatePath("/admin");
  return {
    message: parsed.data.makeAdmin ? "Administrator role granted." : "Administrator role removed.",
  };
}
