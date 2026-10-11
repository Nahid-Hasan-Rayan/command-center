/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { canWrite } from "@/domain/features";
import { contentMatchesType, SNIFF_BYTES, validateUploadMeta } from "@/domain/files";
import { GENERIC_ERROR } from "@/lib/form-state";
import { requireFeature } from "@/lib/session";
import { FILE_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export type PrepareResult =
  | { ok: true; fileId: string; path: string; token: string }
  | { ok: false; error: string };

export type FinalizeResult = { ok: true } | { ok: false; error: string };

export async function prepareUpload(input: {
  name: string;
  mimeType: string;
  size: number;
}): Promise<PrepareResult> {
  const session = await requireFeature("files");
  if (!canWrite(session.membership, "files")) {
    return { ok: false, error: "You can view files but not upload them." };
  }
  const checked = validateUploadMeta(input);
  if (!checked.ok) {
    return checked;
  }

  const fileId = crypto.randomUUID();
  const path = `${session.active.id}/${fileId}`;
  const supabase = await createClient();

  const { error } = await supabase.from("files").insert({
    id: fileId,
    workspace_id: session.active.id,
    uploader_id: session.userId,
    name: checked.value.name,
    mime_type: checked.value.mimeType,
    size_bytes: checked.value.size,
    storage_path: path,
  });
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data, error: signError } = await supabase.storage
    .from(FILE_BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !data) {
    await supabase.from("files").delete().eq("id", fileId);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, fileId, path, token: data.token };
}

async function reject(fileId: string, path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(FILE_BUCKET).remove([path]);
  await supabase.from("files").update({ status: "rejected" }).eq("id", fileId);
  revalidatePath("/files");
}

export async function finalizeUpload(fileId: string): Promise<FinalizeResult> {
  const session = await requireFeature("files");
  const id = uuidSchema.safeParse(fileId);
  if (!id.success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("id, storage_path, mime_type, size_bytes, status")
    .eq("id", id.data)
    .eq("uploader_id", session.userId)
    .eq("status", "pending")
    .maybeSingle();
  if (!file) {
    return { ok: false, error: "Upload not found." };
  }

  const { data: signed } = await supabase.storage
    .from(FILE_BUCKET)
    .createSignedUrl(file.storage_path, 60);
  if (!signed) {
    await reject(file.id, file.storage_path);
    return { ok: false, error: "The upload did not complete." };
  }

  const response = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
  });
  if (!response.ok) {
    await reject(file.id, file.storage_path);
    return { ok: false, error: "The upload did not complete." };
  }
  const head = new Uint8Array(await response.arrayBuffer());
  const rangeTotal = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "")?.[1];
  const total = rangeTotal ? Number(rangeTotal) : head.byteLength;

  if (total !== Number(file.size_bytes) || !contentMatchesType(head, file.mime_type)) {
    await reject(file.id, file.storage_path);
    return { ok: false, error: "The file content does not match its type." };
  }

  const { error } = await supabase.from("files").update({ status: "ready" }).eq("id", file.id);
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/files");
  return { ok: true };
}

export async function deleteFileAction(formData: FormData): Promise<void> {
  const session = await requireFeature("files");
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) {
    return;
  }
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("id, storage_path")
    .eq("id", id.data)
    .eq("workspace_id", session.active.id)
    .maybeSingle();
  if (!file) {
    return;
  }
  await supabase.storage.from(FILE_BUCKET).remove([file.storage_path]);
  await supabase.from("files").delete().eq("id", file.id);
  revalidatePath("/files");
}
