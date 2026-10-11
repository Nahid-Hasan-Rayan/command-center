/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { redirect } from "next/navigation";
import { selectWorkspace } from "@/app/actions-workspace";
import { isValidInviteToken } from "@/domain/invite";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

const REJECTED = "This invitation is invalid, expired, or belongs to a different account.";

export async function acceptInviteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  if (!isValidInviteToken(token)) {
    return { error: REJECTED };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  const workspaceId = uuidSchema.safeParse(data);
  if (error || !workspaceId.success) {
    return { error: REJECTED };
  }
  await selectWorkspace(workspaceId.data);
  redirect("/");
}
