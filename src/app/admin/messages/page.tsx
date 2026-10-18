/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Card } from "@/components/card";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/account";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversations" };

const conversationSchema = z.array(
  z.object({
    channel_id: z.uuid(),
    workspace_name: z.string(),
    kind: z.string(),
    name: z.string().nullable(),
    members: z.array(z.string()),
    message_count: z.coerce.number(),
    last_message_at: z.string().nullable(),
  }),
);

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const search = (q ?? "").trim().slice(0, 80);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_conversations", {
    search: search || null,
    max_rows: 100,
  });
  const parsed = conversationSchema.safeParse(data ?? []);

  if (error || !parsed.success) {
    return (
      <EmptyState title="Conversations could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        subtitle="Every channel and direct message in every workspace."
      />
      <AdminNav current="/admin/messages" />
      <p className="rounded-md border border-border bg-surface-2 p-3 text-sm">
        Opening a conversation is recorded in the audit trail, with the conversation and the number
        of messages read. People are told at sign-up that the administrator can see messages.
      </p>
      <form className="flex gap-2" action="/admin/messages" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by channel name or a member's email"
          maxLength={80}
          aria-label="Search conversations"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-border bg-surface-2 px-4 text-sm">
          Search
        </button>
      </form>
      <Card title={`${parsed.data.length} conversation${parsed.data.length === 1 ? "" : "s"}`}>
        {parsed.data.length === 0 ? (
          <p className="text-sm text-muted">Nothing matches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {parsed.data.map((conversation) => (
              <li key={conversation.channel_id} className="py-3">
                <Link
                  className="font-medium underline"
                  href={`/admin/messages/${conversation.channel_id}`}
                >
                  {conversation.kind === "direct" ? "Direct message" : `#${conversation.name}`}
                </Link>{" "}
                <span className="text-sm text-muted">in {conversation.workspace_name}</span>
                <p className="break-all text-sm text-muted">{conversation.members.join(", ")}</p>
                <p className="text-xs text-muted">
                  {conversation.message_count} message{conversation.message_count === 1 ? "" : "s"}
                  {conversation.last_message_at
                    ? ` · last ${formatDateTime(conversation.last_message_at)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
