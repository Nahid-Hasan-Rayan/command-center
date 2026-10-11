/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/card";
import { WidgetHost } from "@/components/widget-host";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tool" };

const rowSchema = z.object({
  name: z.string(),
  status: z.enum(["pending", "approved", "disabled"]),
});

export default async function WidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("widgets");
  const { id } = await params;
  const widgetId = uuidSchema.safeParse(id);
  if (!widgetId.success) {
    notFound();
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("widgets")
    .select("name, status")
    .eq("id", widgetId.data)
    .eq("workspace_id", session.active.id)
    .maybeSingle();
  const widget = rowSchema.safeParse(data);
  if (!widget.success || widget.data.status === "disabled") {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{widget.data.name}</h1>
        <div className="flex items-center gap-3">
          {widget.data.status === "pending" ? (
            <Badge tone="warn">Preview: not approved</Badge>
          ) : null}
          <Link href="/widgets" className="text-sm text-accent underline">
            All tools
          </Link>
        </div>
      </div>
      <WidgetHost widgetId={widgetId.data} title={widget.data.name} />
    </div>
  );
}
