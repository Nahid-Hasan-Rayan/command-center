/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, WORKSPACE_COOKIE } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

export async function selectWorkspace(id: string): Promise<void> {
  const session = await requireSession();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success || !session.workspaces.some((entry) => entry.id === parsed.data)) {
    return;
  }
  (await cookies()).set(WORKSPACE_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  await selectWorkspace(String(formData.get("workspace") ?? ""));
  redirect("/");
}
