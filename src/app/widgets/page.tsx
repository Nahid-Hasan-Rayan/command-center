/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Badge } from "@/components/card";
import { Form } from "@/components/form";
import { buttonClass, EmptyState, Field, inputClass, PageHeader } from "@/components/ui";
import { canWrite } from "@/domain/features";
import { WIDGET_PERMISSIONS } from "@/domain/widgets";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { deleteWidgetAction, setWidgetStatusAction, uploadWidgetAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tools" };

const rowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["pending", "approved", "disabled"]),
  permissions: z.array(z.string()),
  uploader_id: z.uuid(),
  version: z.number(),
});

const permissionLabels: Record<string, string> = { "read:calendar": "Read today's calendar" };

export default async function WidgetsPage() {
  const session = await requireFeature("widgets");
  const supabase = await createClient();
  const { data } = await supabase
    .from("widgets")
    .select("id, name, description, status, permissions, uploader_id, version")
    .eq("workspace_id", session.active.id)
    .order("created_at", { ascending: false });
  const widgets = z
    .array(rowSchema)
    .catch([])
    .parse(data ?? []);
  const isOwner = session.membership.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom tools"
        subtitle="Upload your own HTML tools. They run in an isolated sandbox and can only use what you allow."
      />

      {canWrite(session.membership, "widgets") ? (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-medium">Upload a tool</h2>
          <Form action={uploadWidgetAction} submit="Upload">
            <Field label="Name" htmlFor="widget-name">
              <input id="widget-name" name="name" required maxLength={80} className={inputClass} />
            </Field>
            <Field label="Description" htmlFor="widget-description">
              <input
                id="widget-description"
                name="description"
                maxLength={500}
                className={inputClass}
              />
            </Field>
            <Field
              label="HTML file"
              htmlFor="widget-file"
              hint="One self-contained .html file, up to 2 MB. Its data is saved for you automatically."
            >
              <input
                id="widget-file"
                name="file"
                type="file"
                accept=".html,.htm,text/html"
                required
                className="block w-full text-sm"
              />
            </Field>
          </Form>
        </section>
      ) : null}

      {widgets.length === 0 ? (
        <EmptyState title="No tools yet" />
      ) : (
        <ul className="space-y-3">
          {widgets.map((widget) => {
            const mine = widget.uploader_id === session.userId;
            return (
              <li
                key={widget.id}
                className="space-y-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{widget.name}</h3>
                    {widget.description ? (
                      <p className="text-sm text-muted">{widget.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={widget.status === "approved" ? "accent" : "warn"}>
                      {widget.status}
                    </Badge>
                    <Badge>v{widget.version}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {widget.status !== "disabled" ? (
                    <Link href={`/widgets/${widget.id}`} className={buttonClass()}>
                      {widget.status === "approved" ? "Open" : "Preview"}
                    </Link>
                  ) : null}
                  {isOwner || mine ? (
                    <form action={deleteWidgetAction}>
                      <input type="hidden" name="id" value={widget.id} />
                      <button type="submit" className={buttonClass("danger")}>
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
                {isOwner ? (
                  <Form
                    action={setWidgetStatusAction}
                    submit="Save approval"
                    tone="quiet"
                    className="space-y-2 border-t border-border pt-3"
                  >
                    <input type="hidden" name="widgetId" value={widget.id} />
                    <Field label="Status" htmlFor={`status-${widget.id}`}>
                      <select
                        id={`status-${widget.id}`}
                        name="status"
                        defaultValue={widget.status}
                        className={inputClass}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </Field>
                    <fieldset className="space-y-1">
                      <legend className="text-xs text-muted">Allowed to</legend>
                      {WIDGET_PERMISSIONS.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="permissions"
                            value={permission}
                            defaultChecked={widget.permissions.includes(permission)}
                          />
                          {permissionLabels[permission] ?? permission}
                        </label>
                      ))}
                    </fieldset>
                    <p className="text-xs text-muted">
                      Approval applies to this exact version. Any change to the file resets it.
                    </p>
                  </Form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
