/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { recordEvent } from "@/lib/monitoring";

/** Called by the error page. Only the opaque Next.js digest is stored, never page content. */
export async function reportClientErrorAction(digest: string): Promise<void> {
  const clean = digest.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  await recordEvent("client.error", "error", { digest: clean });
}
