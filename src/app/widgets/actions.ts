/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { CAMPUS, TIME_ZONE } from "@/config";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { canView, canWrite } from "@/domain/features";
import { buildToday } from "@/domain/today";
import { parsePermissions, validateWidgetUpload } from "@/domain/widgets";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { requireFeature, requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema, widgetStateSchema, widgetStatusSchema } from "@/lib/validation";

const MAX_UPLOAD_BYTES = 2_600_000;

export type ContextResult = { ok: true; data: unknown } | { ok: false; error: string };

export async function uploadWidgetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireFeature("widgets");
  if (!canWrite(session.membership, "widgets")) {
    return { error: "You can run tools but not upload them." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an HTML file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "The file is larger than 2 MB." };
  }

  const checked = validateWidgetUpload({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    fileName: file.name,
    text: new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer()),
  });
  if (!checked.ok) {
    return { error: checked.error };
  }

  const isOwner = session.membership.role === "owner";
  const supabase = await createClient();
  const { error } = await supabase.from("widgets").insert({
    workspace_id: session.active.id,
    uploader_id: session.userId,
    name: checked.value.name,
    description: checked.value.description,
    html: checked.value.html,
    status: isOwner ? "approved" : "pending",
  });
  if (error) {
    return { error: GENERIC_ERROR };
  }

  await supabase.from("audit_log").insert({
    workspace_id: session.active.id,
    user_id: session.userId,
    action: "widget.uploaded",
    target: checked.value.name,
  });
  revalidatePath("/widgets");
  return {
    message: isOwner
      ? "Uploaded and ready to use."
      : "Uploaded. The owner must approve it before others can run it.",
  };
}

export async function setWidgetStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const parsed = widgetStatusSchema.safeParse({
    widgetId: formData.get("widgetId"),
    status: formData.get("status"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) {
    return { error: "Check the form and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("widgets")
    .update({
      status: parsed.data.status,
      permissions: parsePermissions(parsed.data.permissions),
    })
    .eq("id", parsed.data.widgetId)
    .eq("workspace_id", session.active.id);
  if (error) {
    return { error: GENERIC_ERROR };
  }
  await supabase.from("audit_log").insert({
    workspace_id: session.active.id,
    user_id: session.userId,
    action: "widget.status",
    target: parsed.data.widgetId,
    detail: { status: parsed.data.status, permissions: parsed.data.permissions },
  });
  revalidatePath("/widgets");
  return { message: "Saved." };
}

export async function deleteWidgetAction(formData: FormData): Promise<void> {
  const session = await requireFeature("widgets");
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) {
    return;
  }
  const supabase = await createClient();
  await supabase.from("widgets").delete().eq("id", id.data).eq("workspace_id", session.active.id);
  revalidatePath("/widgets");
}

export async function saveWidgetState(widgetId: string, data: unknown): Promise<{ ok: boolean }> {
  const session = await requireFeature("widgets");
  const id = uuidSchema.safeParse(widgetId);
  const state = widgetStateSchema.safeParse(data);
  if (!id.success || !state.success) {
    return { ok: false };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("widget_state").upsert(
    {
      workspace_id: session.active.id,
      widget_id: id.data,
      user_id: session.userId,
      data: state.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "widget_id,user_id" },
  );
  return { ok: !error };
}

export async function getWidgetContext(widgetId: string, scope: string): Promise<ContextResult> {
  const session = await requireFeature("widgets");
  const id = uuidSchema.safeParse(widgetId);
  if (!id.success || scope !== "calendar") {
    return { ok: false, error: "Unknown context." };
  }
  const supabase = await createClient();
  const { data: widget } = await supabase
    .from("widgets")
    .select("status, permissions")
    .eq("id", id.data)
    .eq("workspace_id", session.active.id)
    .maybeSingle();
  const permissions = parsePermissions(
    Array.isArray(widget?.permissions) ? widget.permissions.map(String) : [],
  );
  if (widget?.status !== "approved" || !permissions.includes("read:calendar")) {
    return { ok: false, error: "This tool does not have access to calendar data." };
  }
  if (
    !canView(session.membership, "calendar") ||
    session.active.id !== process.env.SEED_WORKSPACE_ID
  ) {
    return { ok: false, error: "No calendar data is available." };
  }
  return {
    ok: true,
    data: {
      timeZone: TIME_ZONE,
      today: buildToday({
        now: new Date(),
        timeZone: TIME_ZONE,
        campus: CAMPUS,
        calendar,
        timetable,
        courses,
      }),
    },
  };
}
