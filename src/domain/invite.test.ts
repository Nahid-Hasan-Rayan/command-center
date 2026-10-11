/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, isValidInviteToken } from "./invite";

describe("invite tokens", () => {
  it("creates url-safe tokens with a matching sha-256 hash", async () => {
    const { token, hash } = await createInviteToken();
    expect(isValidInviteToken(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInviteToken(token)).toBe(hash);
  });

  it("creates a different token every time", async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, () => createInviteToken()));
    expect(new Set(tokens.map((entry) => entry.token)).size).toBe(20);
  });

  it("matches the known sha-256 of a fixed input", async () => {
    expect(await hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects malformed tokens", () => {
    for (const value of ["", "short", "a".repeat(44), `${"a".repeat(42)}!`, "../etc/passwd"]) {
      expect(isValidInviteToken(value)).toBe(false);
    }
  });
});
