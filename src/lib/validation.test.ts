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
  registrationDecisionSchema,
  removalSchema,
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
        whatsapp: "+60 12-345 6789",
        acknowledged: "on",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        email: "a@b.co",
        password: "correct horse battery",
        displayName: "",
        whatsapp: "+60 12-345 6789",
        acknowledged: "on",
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

describe("registration and administration", () => {
  const base = { email: "a@b.co", password: "correct horse battery", displayName: "A" };

  it("requires a WhatsApp number and the privacy acknowledgement", () => {
    expect(signupSchema.safeParse({ ...base, acknowledged: "on" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, whatsapp: "+60123456789" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, whatsapp: "nope", acknowledged: "on" }).success).toBe(
      false,
    );
  });

  it("normalises optional matric id and note", () => {
    const parsed = signupSchema.parse({
      ...base,
      whatsapp: "+60123456789",
      matricId: " a25mj0186 ",
      note: "  Study group  ",
      acknowledged: "on",
    });
    expect(parsed.matricId).toBe("A25MJ0186");
    expect(parsed.note).toBe("Study group");
    const blank = signupSchema.parse({
      ...base,
      whatsapp: "+60123456789",
      matricId: "",
      note: "",
      acknowledged: "on",
    });
    expect(blank.matricId).toBeUndefined();
    expect(blank.note).toBeUndefined();
    expect(
      signupSchema.safeParse({
        ...base,
        whatsapp: "+60123456789",
        matricId: "x",
        acknowledged: "on",
      }).success,
    ).toBe(false);
  });

  it("validates approval decisions", () => {
    const userId = "bbbbbbbb-0000-4000-8000-000000000002";
    expect(
      registrationDecisionSchema.safeParse({ userId, decision: "approve", features: ["notes"] })
        .success,
    ).toBe(true);
    expect(
      registrationDecisionSchema.safeParse({ userId, decision: "approve", features: ["bogus"] })
        .success,
    ).toBe(false);
    expect(
      registrationDecisionSchema.safeParse({ userId, decision: "maybe", features: [] }).success,
    ).toBe(false);
  });

  it("makes the administrator choose a removal option and confirm deletion", () => {
    const userId = "bbbbbbbb-0000-4000-8000-000000000002";
    expect(removalSchema.safeParse({ userId, option: "" }).success).toBe(false);
    expect(removalSchema.safeParse({ userId, option: "suspend" }).success).toBe(true);
    expect(removalSchema.safeParse({ userId, option: "delete" }).success).toBe(false);
    expect(
      removalSchema.safeParse({ userId, option: "delete", confirmEmail: "a@b.co" }).success,
    ).toBe(true);
  });
});
