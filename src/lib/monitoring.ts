/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Severity = "info" | "warn" | "error";

/**
 * Records an app event for the administrator dashboard. Best effort: it never throws and never
 * delays a request for long. Put only codes and names in `detail`, never what a person typed.
 */
export async function recordEvent(
  kind: string,
  severity: Severity,
  detail: Record<string, string | number | boolean> = {},
  options: { path?: string; durationMs?: number } = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_app_event", {
      kind,
      severity,
      path: options.path ?? null,
      duration_ms: options.durationMs === undefined ? null : Math.round(options.durationMs),
      detail,
    });
  } catch {
    // Monitoring must never break the thing it watches.
  }
}

/**
 * Runs a server action, records how long it took, and records any exception before rethrowing it.
 * Timings feed the response-time table on the admin dashboard.
 */
export async function timeAction<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    await recordEvent("action.timing", "info", { name }, { durationMs: Date.now() - started });
    // An action that answers with an error message failed in an expected way (bad input, no rights).
    if (typeof result === "object" && result !== null && "error" in result && result.error) {
      await recordEvent("action.failed", "warn", { name });
    }
    return result;
  } catch (error) {
    // Redirects and not-found are normal control flow in Next.js, not failures.
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : "";
    if (!digest.startsWith("NEXT_")) {
      await recordEvent("action.error", "error", { name, thrown: true });
    }
    throw error;
  }
}
