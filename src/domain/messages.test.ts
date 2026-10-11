/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CHANNEL_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  normalizeChannelName,
  normalizeMessageBody,
} from "./messages";

describe("normalizeMessageBody", () => {
  it("trims, unifies line endings and collapses blank runs", () => {
    expect(normalizeMessageBody("  hello\r\n\r\n\r\n\r\nworld  ")).toEqual({
      ok: true,
      value: "hello\n\nworld",
    });
  });

  it("removes control characters but keeps tabs and newlines", () => {
    expect(normalizeMessageBody("a\u0000b\u0007c\td\ne")).toEqual({ ok: true, value: "abc\td\ne" });
  });

  it("rejects empty and whitespace-only messages", () => {
    expect(normalizeMessageBody("")).toMatchObject({ ok: false });
    expect(normalizeMessageBody(" \n\t ")).toMatchObject({ ok: false });
  });

  it("enforces the length limit on the cleaned text", () => {
    expect(normalizeMessageBody("x".repeat(MAX_MESSAGE_LENGTH)).ok).toBe(true);
    expect(normalizeMessageBody("x".repeat(MAX_MESSAGE_LENGTH + 1))).toMatchObject({ ok: false });
  });

  it("leaves markup untouched because rendering escapes it", () => {
    expect(normalizeMessageBody("<b>hi</b>")).toEqual({ ok: true, value: "<b>hi</b>" });
  });
});

describe("normalizeChannelName", () => {
  it("collapses whitespace", () => {
    expect(normalizeChannelName("  study   group ")).toEqual({ ok: true, value: "study group" });
  });

  it("rejects empty and over-long names", () => {
    expect(normalizeChannelName("   ")).toMatchObject({ ok: false });
    expect(normalizeChannelName("x".repeat(MAX_CHANNEL_NAME_LENGTH + 1))).toMatchObject({
      ok: false,
    });
  });
});
