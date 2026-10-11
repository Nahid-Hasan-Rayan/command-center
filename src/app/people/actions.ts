/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { type Feature, PRESETS, parseFeatures } from "@/domain/features";
import { createInviteToken } from "@/domain/invite";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { siteOrigin } from "@/lib/origin";
import { requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, memberFeaturesSchema, uuidSchema } from "@/lib/validation";

const MS_PER_DAY = 86_400_000;

export async function inviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireOwner();
  const presetId = String(formData.get("preset") ?? "custom");
  const preset = PRESETS.find((entry) => entry.id === presetId);

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: preset ? preset.role : formData.get("role"),
    features: preset ? [...preset.features] : formData.getAll("features"),
    days: formData.get("days") ?? "7",
  });
  if (!parsed.success) {
    return { error: "Check the email, role, features and expiry, then try again." };
  }

  const { token, hash } = await createInviteToken();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    workspace_id: session.active.id,
    email: parsed.data.email,
    role: parsed.data.role,
    features: parsed.data.features,
    token_hash: hash,
    expires_at: new Date(Date.now() + parsed.data.days * MS_PER_DAY).toISOString(),
    created_by: session.userId,
  });
  if (error) {
    return { error: GENERIC_ERROR };
  }

  await supabase.from("audit_log").insert({
    workspace_id: session.active.id,
    user_id: session.userId,
    action: "invitation.created",
    target: parsed.data.email,
  });
  revalidatePath("/people");
  return { message: `Send this link once, privately: ${await siteOrigin()}/invite/${token}` };
}

export async function updateMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const parsed = memberFeaturesSchema.safeParse({
    userId: formData.get("userId"),
    features: formData.getAll("features"),
  });
  const role = String(formData.get("role"));
  if (!parsed.success || (role !== "viewer" && role !== "editor")) {
    return { error: "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error: roleError } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", session.active.id)
    .eq("user_id", parsed.data.userId);
  if (roleError) {
    return { error: GENERIC_ERROR };
  }

  const { data: current, error: readError } = await supabase
    .from("member_features")
    .select("feature")
    .eq("workspace_id", session.active.id)
    .eq("user_id", parsed.data.userId);
  if (readError) {
    return { error: GENERIC_ERROR };
  }

  const existing = new Set(parseFeatures((current ?? []).map((row) => String(row.feature))));
  const wanted = new Set<Feature>(parsed.data.features);
  const removed = [...existing].filter((feature) => !wanted.has(feature));
  const added = [...wanted].filter((feature) => !existing.has(feature));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("member_features")
      .delete()
      .eq("workspace_id", session.active.id)
      .eq("user_id", parsed.data.userId)
      .in("feature", removed);
    if (error) {
      return { error: GENERIC_ERROR };
    }
  }
  if (added.length > 0) {
    const { error } = await supabase.from("member_features").insert(
      added.map((feature) => ({
        workspace_id: session.active.id,
        user_id: parsed.data.userId,
        feature,
      })),
    );
    if (error) {
      return { error: GENERIC_ERROR };
    }
  }

  await supabase.from("audit_log").insert({
    workspace_id: session.active.id,
    user_id: session.userId,
    action: "member.updated",
    target: parsed.data.userId,
    detail: { role, features: [...wanted] },
  });
  revalidatePath("/people");
  return { message: "Saved." };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const session = await requireOwner();
  const userId = uuidSchema.safeParse(formData.get("userId"));
  if (!userId.success) {
    return;
  }
  const supabase = await createClient();
  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", session.active.id)
    .eq("user_id", userId.data);
  await supabase.from("audit_log").insert({
    workspace_id: session.active.id,
    user_id: session.userId,
    action: "member.removed",
    target: userId.data,
  });
  revalidatePath("/people");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const session = await requireOwner();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) {
    return;
  }
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .delete()
    .eq("id", id.data)
    .eq("workspace_id", session.active.id);
  revalidatePath("/people");
}
