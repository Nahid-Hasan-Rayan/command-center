/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { z } from "zod";
import { parseFeatures } from "@/domain/features";
import {
  buildBootTag,
  injectBoot,
  isValidFrameToken,
  parsePermissions,
  widgetFrameCsp,
} from "@/domain/widgets";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { BRIDGE_SOURCE } from "@/lib/widgets/bridge-script";

const widgetRow = z.object({
  html: z.string(),
  status: z.enum(["pending", "approved", "disabled"]),
  permissions: z.array(z.string()),
});

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await context.params;
  const widgetId = uuidSchema.safeParse(id);
  const token = new URL(request.url).searchParams.get("t");
  if (!session || !widgetId.success || !isValidFrameToken(token)) {
    return plain(404, "Not found");
  }
  if (
    !parseFeatures(session.membership.features).includes("widgets") &&
    session.membership.role !== "owner"
  ) {
    return plain(404, "Not found");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("widgets")
    .select("html, status, permissions")
    .eq("id", widgetId.data)
    .eq("workspace_id", session.active.id)
    .maybeSingle();
  const widget = widgetRow.safeParse(data);
  if (!widget.success || widget.data.status === "disabled") {
    return plain(404, "Not found");
  }

  const approved = widget.data.status === "approved";
  let state: Record<string, string> = {};
  if (approved) {
    const { data: stored } = await supabase
      .from("widget_state")
      .select("data")
      .eq("widget_id", widgetId.data)
      .eq("user_id", session.userId)
      .maybeSingle();
    const parsed = z.record(z.string(), z.string()).safeParse(stored?.data);
    state = parsed.success ? parsed.data : {};
  }

  const bootTag = buildBootTag(
    { token, state, permissions: approved ? parsePermissions(widget.data.permissions) : [] },
    BRIDGE_SOURCE,
  );

  return new Response(injectBoot(widget.data.html, bootTag), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": widgetFrameCsp(),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
