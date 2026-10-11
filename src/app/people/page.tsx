/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { z } from "zod";
import { FeatureGrid } from "@/components/feature-grid";
import { Form } from "@/components/form";
import { buttonClass, EmptyState, Field, inputClass, PageHeader } from "@/components/ui";
import { PRESETS, parseFeatures } from "@/domain/features";
import { requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People" };

const personSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  role: z.enum(["owner", "editor", "viewer"]),
});
const featureRowSchema = z.object({ user_id: z.uuid(), feature: z.string() });
const inviteRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.string(),
  features: z.array(z.string()),
  expires_at: z.string(),
});

export default async function PeoplePage() {
  const session = await requireOwner();
  const supabase = await createClient();

  const [peopleResult, featureResult, inviteResult] = await Promise.all([
    supabase.rpc("workspace_people", { ws: session.active.id }),
    supabase
      .from("member_features")
      .select("user_id, feature")
      .eq("workspace_id", session.active.id),
    supabase
      .from("invitations")
      .select("id, email, role, features, expires_at")
      .eq("workspace_id", session.active.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = z
    .array(personSchema)
    .catch([])
    .parse(peopleResult.data ?? []);
  const featureRows = z
    .array(featureRowSchema)
    .catch([])
    .parse(featureResult.data ?? []);
  const invitations = z
    .array(inviteRowSchema)
    .catch([])
    .parse(inviteResult.data ?? []);
  const others = people.filter((person) => person.role !== "owner");

  return (
    <div className="space-y-8">
      <PageHeader
        title="People"
        subtitle={`Choose who can join "${session.active.name}" and exactly which features each person sees.`}
      />

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-medium">Invite someone</h2>
        <Form action={inviteAction} submit="Create invitation link">
          <Field
            label="Their email"
            htmlFor="invite-email"
            hint="They must sign up with exactly this address."
          >
            <input id="invite-email" name="email" type="email" required className={inputClass} />
          </Field>
          <Field
            label="Preset"
            htmlFor="invite-preset"
            hint="A preset overrides the role and features below."
          >
            <select id="invite-preset" name="preset" defaultValue="custom" className={inputClass}>
              <option value="custom">Custom (use the settings below)</option>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}: {preset.description}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Role"
            htmlFor="invite-role"
            hint="Viewers read. Editors can also change data in features they can see."
          >
            <select id="invite-role" name="role" defaultValue="viewer" className={inputClass}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </Field>
          <FeatureGrid selected={[]} idPrefix="invite" />
          <Field label="Link valid for (days)" htmlFor="invite-days">
            <input
              id="invite-days"
              name="days"
              type="number"
              min={1}
              max={30}
              defaultValue={7}
              className={inputClass}
            />
          </Field>
        </Form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Members</h2>
        {others.length === 0 ? (
          <EmptyState title="No one else is in this workspace yet" />
        ) : (
          others.map((person) => {
            const selected = parseFeatures(
              featureRows.filter((row) => row.user_id === person.user_id).map((row) => row.feature),
            );
            return (
              <div
                key={person.user_id}
                className="space-y-3 rounded-xl border border-border bg-surface p-4"
              >
                <h3 className="font-medium">{person.display_name}</h3>
                <Form action={updateMemberAction} submit="Save access">
                  <input type="hidden" name="userId" value={person.user_id} />
                  <Field label="Role" htmlFor={`role-${person.user_id}`}>
                    <select
                      id={`role-${person.user_id}`}
                      name="role"
                      defaultValue={person.role}
                      className={inputClass}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  </Field>
                  <FeatureGrid selected={selected} idPrefix={person.user_id} />
                </Form>
                <form action={removeMemberAction}>
                  <input type="hidden" name="userId" value={person.user_id} />
                  <button type="submit" className={buttonClass("danger")}>
                    Remove from workspace
                  </button>
                </form>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Pending invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span>
                  {invite.email} · {invite.role} · expires {invite.expires_at.slice(0, 10)}
                </span>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="id" value={invite.id} />
                  <button type="submit" className={buttonClass("quiet")}>
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
