/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { type Feature, parseFeatures } from "@/domain/features";
import { type AccountStatus, parseAccountStatus } from "@/domain/registration";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface AccountContext {
  userId: string;
  email: string;
  fullName: string;
  status: AccountStatus;
  isAdmin: boolean;
  isRoot: boolean;
  features: Feature[];
}

const accountRowSchema = z.object({
  status: z.string(),
  is_admin: z.boolean(),
  is_root: z.boolean(),
  full_name: z.string(),
  features: z.array(z.string()),
});

/**
 * The signed-in person's platform account: approval status, administrator flag and the features
 * the administrator granted. Null when nobody is signed in or the lookup failed. Never throws.
 */
export const getAccount = cache(async (): Promise<AccountContext | null> => {
  if (!readSupabaseEnv()) {
    return null;
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc("my_account");
  if (error) {
    return null;
  }
  const rows = z.array(accountRowSchema).safeParse(data ?? []);
  const row = rows.success ? rows.data[0] : undefined;

  // Signed in, second factor passed, but no registration row: treat as awaiting approval.
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: row?.full_name ?? "",
    status: parseAccountStatus(row?.status),
    isAdmin: row?.is_admin ?? false,
    isRoot: row?.is_root ?? false,
    features: parseFeatures(row?.features ?? []),
  };
});

/** Admin pages answer 404 to everyone else so their existence is not revealed. */
export async function requireAdmin(): Promise<AccountContext> {
  const account = await getAccount();
  if (!account?.isAdmin || account.status !== "approved") {
    notFound();
  }
  return account;
}
