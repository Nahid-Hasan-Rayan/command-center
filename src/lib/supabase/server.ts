/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

export async function createClient() {
  const env = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        try {
          for (const { name, value, options } of entries) {
            cookieStore.set(name, value, options);
          }
        } catch {
          return;
        }
      },
    },
  });
}
