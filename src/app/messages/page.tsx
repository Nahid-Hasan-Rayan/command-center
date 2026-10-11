/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { Form } from "@/components/form";
import { MessageComposer } from "@/components/message-composer";
import { buttonClass, EmptyState, Field, inputClass, PageHeader } from "@/components/ui";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createChannelAction, deleteMessageAction, openDirectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messages" };

const channelSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["channel", "direct"]),
  name: z.string().nullable(),
});
const memberSchema = z.object({ channel_id: z.uuid(), user_id: z.uuid() });
const personSchema = z.object({ user_id: z.uuid(), display_name: z.string(), role: z.string() });
const messageSchema = z.object({
  id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await requireFeature("messages");
  const { c } = await searchParams;
  const supabase = await createClient();

  const [channelResult, memberResult, peopleResult] = await Promise.all([
    supabase
      .from("channels")
      .select("id, kind, name")
      .eq("workspace_id", session.active.id)
      .order("created_at"),
    supabase
      .from("channel_members")
      .select("channel_id, user_id")
      .eq("workspace_id", session.active.id),
    supabase.rpc("workspace_people", { ws: session.active.id }),
  ]);

  const channels = z
    .array(channelSchema)
    .catch([])
    .parse(channelResult.data ?? []);
  const members = z
    .array(memberSchema)
    .catch([])
    .parse(memberResult.data ?? []);
  const people = z
    .array(personSchema)
    .catch([])
    .parse(peopleResult.data ?? []);
  const nameOf = (userId: string): string =>
    people.find((person) => person.user_id === userId)?.display_name ?? "Member";

  const labelOf = (channel: z.infer<typeof channelSchema>): string => {
    if (channel.kind === "channel") {
      return `# ${channel.name ?? "channel"}`;
    }
    const other = members.find(
      (entry) => entry.channel_id === channel.id && entry.user_id !== session.userId,
    );
    return other ? nameOf(other.user_id) : "Direct message";
  };

  const selected = channels.find((entry) => entry.id === c) ?? channels[0];
  const messageResult = selected
    ? await supabase
        .from("messages")
        .select("id, sender_id, body, created_at, edited_at, deleted_at")
        .eq("channel_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const messages = z
    .array(messageSchema)
    .catch([])
    .parse(messageResult.data ?? [])
    .reverse();

  const others = people.filter((person) => person.user_id !== session.userId);
  const isOwner = session.membership.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle={`In "${session.active.name}". Only people in a channel can read it.`}
      />
      <AutoRefresh seconds={10} />

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <aside className="space-y-4">
          <nav aria-label="Conversations" className="space-y-1">
            {channels.length === 0 ? (
              <p className="text-sm text-muted">No conversations yet.</p>
            ) : null}
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/messages?c=${channel.id}`}
                aria-current={channel.id === selected?.id ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm ${
                  channel.id === selected?.id ? "bg-surface-2" : "text-muted hover:text-text"
                }`}
              >
                {labelOf(channel)}
              </Link>
            ))}
          </nav>

          {others.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted">Direct message</h2>
              <ul className="space-y-1">
                {others.map((person) => (
                  <li key={person.user_id}>
                    <form action={openDirectAction}>
                      <input type="hidden" name="userId" value={person.user_id} />
                      <button type="submit" className="text-sm text-accent underline">
                        {person.display_name}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {isOwner ? (
            <section className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <h2 className="text-sm font-medium">New channel</h2>
              <Form action={createChannelAction} submit="Create">
                <Field label="Name" htmlFor="channel-name">
                  <input
                    id="channel-name"
                    name="name"
                    required
                    maxLength={80}
                    className={inputClass}
                  />
                </Field>
                <fieldset className="space-y-1">
                  <legend className="text-xs text-muted">Add people</legend>
                  {others.map((person) => (
                    <label key={person.user_id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="members" value={person.user_id} />
                      {person.display_name}
                    </label>
                  ))}
                </fieldset>
              </Form>
            </section>
          ) : null}
        </aside>

        <section className="space-y-4">
          {!selected ? (
            <EmptyState title="Pick a conversation">
              <p>Start a direct message, or ask the workspace owner to create a channel.</p>
            </EmptyState>
          ) : (
            <>
              <h2 className="font-medium">{labelOf(selected)}</h2>
              <ol className="space-y-3 rounded-xl border border-border bg-surface p-4">
                {messages.length === 0 ? (
                  <li className="text-sm text-muted">No messages yet.</li>
                ) : null}
                {messages.map((message) => {
                  const deleted = message.deleted_at !== null;
                  const canDelete = !deleted && (message.sender_id === session.userId || isOwner);
                  return (
                    <li key={message.id} className="space-y-0.5">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-text">{nameOf(message.sender_id)}</span> ·{" "}
                        <time dateTime={message.created_at}>
                          {timeFormat.format(new Date(message.created_at))}
                        </time>
                        {message.edited_at ? " · edited" : ""}
                      </p>
                      <p
                        className={`whitespace-pre-wrap break-words text-sm ${deleted ? "italic text-muted" : ""}`}
                      >
                        {deleted ? "Message deleted" : message.body}
                      </p>
                      {canDelete ? (
                        <form action={deleteMessageAction}>
                          <input type="hidden" name="id" value={message.id} />
                          <button
                            type="submit"
                            className={`${buttonClass("quiet")} !px-2 !py-0.5 text-xs`}
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <MessageComposer channelId={selected.id} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
