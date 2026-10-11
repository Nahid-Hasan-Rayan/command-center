/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { AuthLevel } from "@/domain/access-gate";
import type { SupabaseEnv } from "./env";

type CookieEntry = Parameters<NextResponse["cookies"]["set"]>;

export interface ProxySession {
  authenticated: boolean;
  hasVerifiedFactor: boolean;
  level: AuthLevel;
  cookies: CookieEntry[];
}

export async function readProxySession(
  request: NextRequest,
  env: SupabaseEnv,
): Promise<ProxySession> {
  const cookies: CookieEntry[] = [];
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries) => {
        for (const { name, value, options } of entries) {
          request.cookies.set(name, value);
          cookies.push([name, value, options ?? {}]);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { authenticated: false, hasVerifiedFactor: false, level: null, cookies };
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const current = assurance.data?.currentLevel ?? null;
  const level: AuthLevel = current === "aal2" ? "aal2" : current === "aal1" ? "aal1" : null;
  const hasVerifiedFactor = (data.user.factors ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );

  return {
    authenticated: true,
    hasVerifiedFactor,
    level,
    cookies,
  };
}
