/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { getWidgetContext, saveWidgetState } from "@/app/widgets/actions";
import { WIDGET_SANDBOX } from "@/domain/widgets";
import { frameMessageSchema } from "@/lib/validation";

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function WidgetHost({ widgetId, title }: { widgetId: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(randomToken());
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    const onMessage = async (event: MessageEvent) => {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target) {
        return;
      }
      const parsed = frameMessageSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.token !== token) {
        return;
      }
      const message = parsed.data;
      if (message.type === "state.set") {
        await saveWidgetState(widgetId, message.data);
        return;
      }
      if (message.type === "context.request") {
        const result = await getWidgetContext(widgetId, message.scope);
        target.postMessage(
          {
            cc: 1,
            type: "context.response",
            token,
            id: message.id,
            ...(result.ok ? { data: result.data } : { error: result.error }),
          },
          "*",
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token, widgetId]);

  if (!token) {
    return null;
  }

  return (
    <iframe
      ref={frame}
      title={title}
      sandbox={WIDGET_SANDBOX}
      referrerPolicy="no-referrer"
      src={`/widgets/${widgetId}/frame?t=${token}`}
      className="h-[80vh] w-full rounded-xl border border-border bg-white"
    />
  );
}
