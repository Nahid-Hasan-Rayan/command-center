/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { NextResponse } from "next/server";
import { canView } from "@/domain/features";
import { getSession } from "@/lib/session";
import { FILE_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

const LINK_SECONDS = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!session || !canView(session.membership, "files") || !parsed.success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("name, storage_path")
    .eq("id", parsed.data)
    .eq("workspace_id", session.active.id)
    .eq("status", "ready")
    .maybeSingle();
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from(FILE_BUCKET)
    .createSignedUrl(file.storage_path, LINK_SECONDS, {
      download: file.name,
    });
  if (!signed) {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
