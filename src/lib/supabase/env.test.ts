/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSupabaseEnv, requireSupabaseEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readSupabaseEnv", () => {
  it("returns the configuration when both variables are valid", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    expect(readSupabaseEnv()).toEqual({ url: "https://abc.supabase.co", anonKey: "key" });
  });

  it("fails closed when a variable is missing or empty", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    expect(readSupabaseEnv()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(readSupabaseEnv()).toBeNull();
    expect(() => requireSupabaseEnv()).toThrow();
  });

  it("rejects a malformed or insecure URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    expect(readSupabaseEnv()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://abc.supabase.co");
    expect(readSupabaseEnv()).toBeNull();
  });

  it("allows plain http only for a local development server", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    expect(readSupabaseEnv()).not.toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(readSupabaseEnv()).not.toBeNull();
  });
});
