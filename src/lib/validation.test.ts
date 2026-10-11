/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  emailSchema,
  frameMessageSchema,
  inviteSchema,
  memberFeaturesSchema,
  passwordSchema,
  signupSchema,
  totpCodeSchema,
  widgetStateSchema,
  widgetStatusSchema,
} from "./validation";

describe("credentials", () => {
  it("normalises emails", () => {
    expect(emailSchema.parse("  Alice@Example.COM ")).toBe("alice@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("requires long and varied passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("aaaaaaaaaaaaaaaa").success).toBe(false);
    expect(passwordSchema.safeParse("correct horse battery").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });

  it("validates sign-up and one-time codes", () => {
    expect(
      signupSchema.safeParse({
        email: "a@b.co",
        password: "correct horse battery",
        displayName: "A",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        email: "a@b.co",
        password: "correct horse battery",
        displayName: "",
      }).success,
    ).toBe(false);
    expect(totpCodeSchema.safeParse("123456").success).toBe(true);
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("invitations and access", () => {
  it("accepts only real features and invitable roles", () => {
    const valid = {
      email: "b@c.de",
      role: "viewer",
      features: ["calendar", "messages"],
      days: "7",
    };
    expect(inviteSchema.parse(valid).days).toBe(7);
    expect(inviteSchema.safeParse({ ...valid, role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...valid, features: ["everything"] }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...valid, days: "31" }).success).toBe(false);
  });

  it("validates member feature updates", () => {
    expect(
      memberFeaturesSchema.safeParse({
        userId: "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7f90",
        features: ["files"],
      }).success,
    ).toBe(true);
    expect(memberFeaturesSchema.safeParse({ userId: "nope", features: [] }).success).toBe(false);
  });

  it("validates widget approvals", () => {
    const id = "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7f90";
    expect(
      widgetStatusSchema.safeParse({
        widgetId: id,
        status: "approved",
        permissions: ["read:calendar"],
      }).success,
    ).toBe(true);
    expect(
      widgetStatusSchema.safeParse({ widgetId: id, status: "approved", permissions: ["read:all"] })
        .success,
    ).toBe(false);
    expect(
      widgetStatusSchema.safeParse({ widgetId: id, status: "hacked", permissions: [] }).success,
    ).toBe(false);
  });
});

describe("widget messages", () => {
  it("accepts well-formed frame messages", () => {
    expect(frameMessageSchema.safeParse({ cc: 1, token: "t", type: "ready" }).success).toBe(true);
    expect(
      frameMessageSchema.safeParse({ cc: 1, token: "t", type: "state.set", data: { a: "b" } })
        .success,
    ).toBe(true);
    expect(
      frameMessageSchema.safeParse({
        cc: 1,
        token: "t",
        type: "context.request",
        id: 1,
        scope: "calendar",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed or unknown messages", () => {
    expect(frameMessageSchema.safeParse({ cc: 1, token: "t", type: "danger" }).success).toBe(false);
    expect(frameMessageSchema.safeParse({ cc: 2, token: "t", type: "ready" }).success).toBe(false);
    expect(
      frameMessageSchema.safeParse({ cc: 1, token: "t", type: "state.set", data: { a: 1 } })
        .success,
    ).toBe(false);
    expect(
      frameMessageSchema.safeParse({
        cc: 1,
        token: "t",
        type: "context.request",
        id: -1,
        scope: "x",
      }).success,
    ).toBe(false);
  });

  it("limits stored state size", () => {
    expect(widgetStateSchema.safeParse({ k: "x".repeat(499_000) }).success).toBe(true);
    expect(widgetStateSchema.safeParse({ k: "x".repeat(500_001) }).success).toBe(false);
  });
});
