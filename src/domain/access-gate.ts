/**
 * NHR
 * @author Nahid Hasan Rayan
 */

import { hasControlCharacters } from "./text";

export type AuthLevel = "aal1" | "aal2" | null;

export interface GateInput {
  pathname: string;
  authenticated: boolean;
  hasVerifiedFactor: boolean;
  level: AuthLevel;
}

export type GateDecision = { type: "allow" } | { type: "redirect"; to: string };

const PUBLIC_PATHS = ["/login", "/signup"];
const ALWAYS_ALLOWED = ["/auth/callback", "/logout"];
const MFA_ENROLL = "/mfa/enroll";
const MFA_VERIFY = "/mfa/verify";
const MAX_NEXT_LENGTH = 200;

export function sanitizeNext(value: string | null | undefined): string {
  if (!value || value.length > MAX_NEXT_LENGTH) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  if (hasControlCharacters(value)) {
    return "/";
  }
  const blocked = [...PUBLIC_PATHS, MFA_ENROLL, MFA_VERIFY, ...ALWAYS_ALLOWED];
  if (
    blocked.some(
      (path) => value === path || value.startsWith(`${path}/`) || value.startsWith(`${path}?`),
    )
  ) {
    return "/";
  }
  return value;
}

export function decideAccess(input: GateInput): GateDecision {
  const { pathname, authenticated, hasVerifiedFactor, level } = input;

  if (ALWAYS_ALLOWED.includes(pathname)) {
    return { type: "allow" };
  }

  if (!authenticated) {
    if (PUBLIC_PATHS.includes(pathname)) {
      return { type: "allow" };
    }
    const next = sanitizeNext(pathname);
    return {
      type: "redirect",
      to: next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`,
    };
  }

  if (!hasVerifiedFactor) {
    return pathname === MFA_ENROLL ? { type: "allow" } : { type: "redirect", to: MFA_ENROLL };
  }

  if (level !== "aal2") {
    return pathname === MFA_VERIFY ? { type: "allow" } : { type: "redirect", to: MFA_VERIFY };
  }

  if (PUBLIC_PATHS.includes(pathname) || pathname === MFA_ENROLL || pathname === MFA_VERIFY) {
    return { type: "redirect", to: "/" };
  }

  return { type: "allow" };
}
