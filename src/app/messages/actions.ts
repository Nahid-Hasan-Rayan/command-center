/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeChannelName, normalizeMessageBody } from "@/domain/messages";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { requireFeature, requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

const RATE_LIMIT_CODE = "54000";

export async function sendMessageAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireFeature("messages");
  const channelId = uuidSchema.safeParse(formData.get("channelId"));
  const body = normalizeMessageBody(String(formData.get("body") ?? ""));
  if (!channelId.success) {
    return { error: GENERIC_ERROR };
  }
  if (!body.ok) {
    return { error: body.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    workspace_id: session.active.id,
    channel_id: channelId.data,
    sender_id: session.userId,
    body: body.value,
  });
  if (error) {
    return {
      error:
        error.code === RATE_LIMIT_CODE ? "You are sending messages too quickly." : GENERIC_ERROR,
    };
  }
  revalidatePath("/messages");
  return { message: "sent" };
}

export async function createChannelAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const name = normalizeChannelName(String(formData.get("name") ?? ""));
  if (!name.ok) {
    return { error: name.error };
  }
  const members = formData
    .getAll("members")
    .map((value) => uuidSchema.safeParse(value))
    .flatMap((result) => (result.success && result.data !== session.userId ? [result.data] : []));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({
      workspace_id: session.active.id,
      kind: "channel",
      name: name.value,
      created_by: session.userId,
    })
    .select("id")
    .single();
  const channelId = uuidSchema.safeParse(data?.id);
  if (error || !channelId.success) {
    return { error: GENERIC_ERROR };
  }

  if (members.length > 0) {
    const { error: memberError } = await supabase.from("channel_members").insert(
      members.map((userId) => ({
        channel_id: channelId.data,
        workspace_id: session.active.id,
        user_id: userId,
      })),
    );
    if (memberError) {
      return { error: "The channel was created, but some people could not be added." };
    }
  }
  revalidatePath("/messages");
  return { message: "Channel created." };
}

export async function openDirectAction(formData: FormData): Promise<void> {
  const session = await requireFeature("messages");
  const other = uuidSchema.safeParse(formData.get("userId"));
  if (!other.success) {
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_direct_channel", {
    ws: session.active.id,
    other: other.data,
  });
  const channelId = uuidSchema.safeParse(data);
  if (error || !channelId.success) {
    return;
  }
  redirect(`/messages?c=${channelId.data}`);
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const session = await requireFeature("messages");
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) {
    return;
  }
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("workspace_id", session.active.id);
  revalidatePath("/messages");
}
