/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  canView,
  type Feature,
  type Membership,
  parseFeatures,
  type Role,
} from "@/domain/features";
import { canUseApp } from "@/domain/registration";
import { getAccount } from "@/lib/account";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const WORKSPACE_COOKIE = "cc_ws";

export interface WorkspaceRef {
  id: string;
  name: string;
  role: Role;
  features: Feature[];
}

export interface SessionContext {
  userId: string;
  email: string;
  workspaces: WorkspaceRef[];
  active: WorkspaceRef;
  membership: Membership;
}

const memberRowSchema = z.object({
  workspace_id: z.uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
  workspaces: z.object({ name: z.string() }).nullable(),
});

const featureRowSchema = z.object({ workspace_id: z.uuid(), feature: z.string() });

export async function getSession(): Promise<SessionContext | null> {
  if (!readSupabaseEnv()) {
    return null;
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return null;
  }

  const [memberResult, featureResult] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(name)")
      .eq("user_id", user.id),
    supabase.from("member_features").select("workspace_id, feature").eq("user_id", user.id),
  ]);

  const members = z.array(memberRowSchema).safeParse(memberResult.data ?? []);
  const features = z.array(featureRowSchema).safeParse(featureResult.data ?? []);
  if (!members.success || !features.success || members.data.length === 0) {
    return null;
  }

  const workspaces: WorkspaceRef[] = members.data
    .map((row) => ({
      id: row.workspace_id,
      name: row.workspaces?.name ?? "Workspace",
      role: row.role,
      features: parseFeatures(
        features.data
          .filter((entry) => entry.workspace_id === row.workspace_id)
          .map((entry) => entry.feature),
      ),
    }))
    .sort(
      (a, b) =>
        (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0) ||
        a.name.localeCompare(b.name),
    );

  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = workspaces.find((entry) => entry.id === preferred) ?? workspaces[0];
  if (!active) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    workspaces,
    active,
    membership: { role: active.role, features: active.features },
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    const account = await getAccount();
    redirect(account && !canUseApp(account.status) ? "/pending" : "/login");
  }
  return session;
}

export async function requireFeature(feature: Feature): Promise<SessionContext> {
  const session = await requireSession();
  if (!canView(session.membership, feature)) {
    notFound();
  }
  // The administrator also decides, per person, which features exist for them.
  const account = await getAccount();
  if (account && !account.isAdmin && !account.features.includes(feature)) {
    notFound();
  }
  return session;
}

export async function requireOwner(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.membership.role !== "owner") {
    notFound();
  }
  return session;
}
