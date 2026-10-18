/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { AdminNav } from "../../admin-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversation" };

const PAGE_SIZE = 100;

const messageSchema = z.array(
  z.object({
    id: z.uuid(),
    sender_email: z.string().nullable(),
    body: z.string(),
    created_at: z.string(),
    edited_at: z.string().nullable(),
    deleted_at: z.string().nullable(),
  }),
);

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { before } = await searchParams;
  if (!uuidSchema.safeParse(id).success) {
    notFound();
  }
  const cursor = before && !Number.isNaN(Date.parse(before)) ? before : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_read_messages", {
    channel: id,
    max_rows: PAGE_SIZE,
    before: cursor,
  });
  if (error?.code === "P0002") {
    notFound();
  }
  const parsed = messageSchema.safeParse(data ?? []);
  if (error || !parsed.success) {
    return (
      <p className="text-sm text-muted">
        The conversation could not be loaded. Try again in a moment.
      </p>
    );
  }
  const messages = parsed.data;
  const oldest = messages[0]?.created_at;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation"
        subtitle={`Latest ${messages.length} messages, oldest first.`}
      />
      <AdminNav current="/admin/messages" />
      <p className="rounded-md border border-border bg-surface-2 p-3 text-sm">
        This view was recorded in the audit trail. A message that its sender deleted shows as
        [deleted]: the text is erased when it is deleted and cannot be recovered.
      </p>
      <p className="text-sm">
        <Link className="underline" href="/admin/messages">
          Back to all conversations
        </Link>
      </p>
      <Card title="Messages">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">No messages.</p>
        ) : (
          <ul className="space-y-3">
            {oldest && messages.length === PAGE_SIZE ? (
              <li>
                <Link
                  className="text-sm underline"
                  href={`/admin/messages/${id}?before=${encodeURIComponent(oldest)}`}
                >
                  Older messages
                </Link>
              </li>
            ) : null}
            {messages.map((message) => (
              <li key={message.id} className="text-sm">
                <p className="text-xs text-muted">
                  {message.sender_email ?? "unknown"} · {formatDateTime(message.created_at)}
                  {message.edited_at ? " · edited" : ""}
                  {message.deleted_at ? " · deleted" : ""}
                </p>
                <p
                  className={`whitespace-pre-wrap ${message.deleted_at ? "text-muted italic" : ""}`}
                >
                  {message.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
