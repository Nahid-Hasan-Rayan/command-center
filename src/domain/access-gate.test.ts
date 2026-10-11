/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { decideAccess, type GateInput, sanitizeNext } from "./access-gate";

const base: GateInput = {
  pathname: "/",
  authenticated: true,
  hasVerifiedFactor: true,
  level: "aal2",
};

describe("anonymous visitors", () => {
  const anonymous = {
    ...base,
    authenticated: false,
    hasVerifiedFactor: false,
    level: null,
  } as const;

  it("can only reach the sign-in and sign-up pages", () => {
    expect(decideAccess({ ...anonymous, pathname: "/login" })).toEqual({ type: "allow" });
    expect(decideAccess({ ...anonymous, pathname: "/signup" })).toEqual({ type: "allow" });
  });

  it("are redirected to sign in with a return path", () => {
    expect(decideAccess({ ...anonymous, pathname: "/" })).toEqual({
      type: "redirect",
      to: "/login",
    });
    expect(decideAccess({ ...anonymous, pathname: "/files" })).toEqual({
      type: "redirect",
      to: "/login?next=%2Ffiles",
    });
    expect(decideAccess({ ...anonymous, pathname: "/invite/abc" }).type).toBe("redirect");
  });

  it("are not allowed to reach the MFA pages", () => {
    expect(decideAccess({ ...anonymous, pathname: "/mfa/verify" }).type).toBe("redirect");
    expect(decideAccess({ ...anonymous, pathname: "/mfa/enroll" }).type).toBe("redirect");
  });

  it("may complete the email confirmation callback", () => {
    expect(decideAccess({ ...anonymous, pathname: "/auth/callback" })).toEqual({ type: "allow" });
  });
});

describe("signed-in users without a second factor", () => {
  const input = { ...base, hasVerifiedFactor: false, level: "aal1" } as const;

  it("must enrol before seeing anything else", () => {
    expect(decideAccess({ ...input, pathname: "/" })).toEqual({
      type: "redirect",
      to: "/mfa/enroll",
    });
    expect(decideAccess({ ...input, pathname: "/messages" })).toEqual({
      type: "redirect",
      to: "/mfa/enroll",
    });
    expect(decideAccess({ ...input, pathname: "/mfa/enroll" })).toEqual({ type: "allow" });
  });

  it("can still sign out", () => {
    expect(decideAccess({ ...input, pathname: "/logout" })).toEqual({ type: "allow" });
  });
});

describe("signed-in users who have not verified the second factor", () => {
  const input = { ...base, level: "aal1" } as const;

  it("must verify before seeing anything else", () => {
    expect(decideAccess({ ...input, pathname: "/" })).toEqual({
      type: "redirect",
      to: "/mfa/verify",
    });
    expect(decideAccess({ ...input, pathname: "/mfa/verify" })).toEqual({ type: "allow" });
    expect(decideAccess({ ...input, pathname: "/mfa/enroll" })).toEqual({
      type: "redirect",
      to: "/mfa/verify",
    });
  });
});

describe("fully authenticated users", () => {
  it("reach application pages", () => {
    expect(decideAccess({ ...base, pathname: "/week" })).toEqual({ type: "allow" });
  });

  it("are sent home from the sign-in and MFA pages", () => {
    for (const pathname of ["/login", "/signup", "/mfa/verify", "/mfa/enroll"]) {
      expect(decideAccess({ ...base, pathname })).toEqual({ type: "redirect", to: "/" });
    }
  });
});

describe("sanitizeNext", () => {
  it("keeps safe relative paths", () => {
    expect(sanitizeNext("/files")).toBe("/files");
    expect(sanitizeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "/mfa/verify",
    "/logout",
    "/a\nb",
    `/${"a".repeat(300)}`,
  ])("rejects %j", (value) => {
    expect(sanitizeNext(value)).toBe("/");
  });
});
