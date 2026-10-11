/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { url, anonKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error("Supabase environment variables are missing or invalid.");
  }
  return env;
}
