/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { z } from "zod";
import { FileUploader } from "@/components/file-uploader";
import { buttonClass, EmptyState, PageHeader } from "@/components/ui";
import { canWrite } from "@/domain/features";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { deleteFileAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Files" };

const fileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mime_type: z.string(),
  size_bytes: z.coerce.number(),
  uploader_id: z.uuid(),
  created_at: z.string(),
});
const personSchema = z.object({ user_id: z.uuid(), display_name: z.string() });

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function FilesPage() {
  const session = await requireFeature("files");
  const supabase = await createClient();
  const [fileResult, peopleResult] = await Promise.all([
    supabase
      .from("files")
      .select("id, name, mime_type, size_bytes, uploader_id, created_at")
      .eq("workspace_id", session.active.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
    supabase.rpc("workspace_people", { ws: session.active.id }),
  ]);
  const files = z
    .array(fileSchema)
    .catch([])
    .parse(fileResult.data ?? []);
  const people = z
    .array(personSchema)
    .catch([])
    .parse(peopleResult.data ?? []);
  const isOwner = session.membership.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader title="Files" subtitle={`Shared in "${session.active.name}".`} />

      {canWrite(session.membership, "files") ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <FileUploader />
        </section>
      ) : null}

      {files.length === 0 ? (
        <EmptyState title="No files yet" />
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted">
                  {formatSize(file.size_bytes)} ·{" "}
                  {people.find((person) => person.user_id === file.uploader_id)?.display_name ??
                    "Member"}{" "}
                  · {file.created_at.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/files/${file.id}/download`} className={buttonClass("quiet")}>
                  Download
                </a>
                {isOwner || file.uploader_id === session.userId ? (
                  <form action={deleteFileAction}>
                    <input type="hidden" name="id" value={file.id} />
                    <button type="submit" className={buttonClass("danger")}>
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
