/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  buildBootTag,
  escapeForScript,
  injectBoot,
  isValidFrameToken,
  MAX_WIDGET_CHARS,
  parsePermissions,
  validateWidgetUpload,
  widgetFrameCsp,
} from "./widgets";

const upload = (overrides: Partial<Parameters<typeof validateWidgetUpload>[0]> = {}) =>
  validateWidgetUpload({
    name: "Tracker",
    description: "",
    fileName: "tracker.html",
    text: "<html><head></head><body>hi</body></html>",
    ...overrides,
  });

describe("validateWidgetUpload", () => {
  it("accepts a normal html file and normalises the name", () => {
    expect(upload({ name: "  My   tool " })).toEqual({
      ok: true,
      value: {
        name: "My tool",
        description: "",
        html: "<html><head></head><body>hi</body></html>",
      },
    });
  });

  it.each([
    ["wrong extension", { fileName: "tool.js" }],
    ["empty name", { name: "   " }],
    ["long name", { name: "x".repeat(81) }],
    ["long description", { description: "x".repeat(501) }],
    ["empty text", { text: "" }],
    ["too large", { text: `<p>${"x".repeat(MAX_WIDGET_CHARS)}` }],
    ["nul byte", { text: "<p>a\u0000b</p>" }],
    ["replacement character from bad encoding", { text: "<p>\ufffd</p>" }],
    ["not html", { text: "just some words" }],
  ])("rejects %s", (_label, overrides) => {
    expect(upload(overrides)).toMatchObject({ ok: false });
  });

  it("accepts .htm files case-insensitively", () => {
    expect(upload({ fileName: "TOOL.HTM" })).toMatchObject({ ok: true });
  });
});

describe("escapeForScript", () => {
  it("prevents script-breaking sequences in embedded json", () => {
    const hostile = JSON.stringify({ k: "</script><script>alert(1)</script><!--" });
    const escaped = escapeForScript(hostile);
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(JSON.parse(escaped)).toEqual({ k: "</script><script>alert(1)</script><!--" });
  });

  it("escapes line separators that break javascript strings", () => {
    const escaped = escapeForScript(JSON.stringify({ k: "a\u2028b\u2029c" }));
    expect(escaped).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(escaped)).toEqual({ k: "a\u2028b\u2029c" });
  });
});

describe("buildBootTag", () => {
  it("embeds boot data safely and keeps the bridge intact", () => {
    const tag = buildBootTag(
      { token: "t".repeat(20), state: { x: "</script>" }, permissions: ["read:calendar"] },
      "var a = 1; // </script>",
    );
    expect(tag.match(/<script>/g)).toHaveLength(2);
    expect(tag.match(/<\/script>/g)).toHaveLength(2);
    expect(tag).toContain("window.__CC_BOOT__=");
  });
});

describe("injectBoot", () => {
  const tag = "<script>BOOT</script>";

  it("inserts directly after the head tag", () => {
    expect(
      injectBoot("<!DOCTYPE html><html><head><title>x</title></head><body></body></html>", tag),
    ).toBe(`<!DOCTYPE html><html><head>${tag}<title>x</title></head><body></body></html>`);
  });

  it("handles head tags with attributes and different case", () => {
    expect(injectBoot('<HTML><HEAD lang="en"></HEAD></HTML>', tag)).toBe(
      `<HTML><HEAD lang="en">${tag}</HEAD></HTML>`,
    );
  });

  it("creates a head when only an html tag exists", () => {
    expect(injectBoot("<html><body>x</body></html>", tag)).toBe(
      `<html><head>${tag}</head><body>x</body></html>`,
    );
  });

  it("keeps the doctype first when there is no head or html tag", () => {
    expect(injectBoot("<!doctype html><p>x</p>", tag)).toBe(`<!doctype html>${tag}<p>x</p>`);
  });

  it("prepends for bare fragments", () => {
    expect(injectBoot("<p>x</p>", tag)).toBe(`${tag}<p>x</p>`);
  });

  it("does not mistake header elements for the head tag", () => {
    expect(injectBoot("<html><body><header>x</header></body></html>", tag)).toBe(
      `<html><head>${tag}</head><body><header>x</header></body></html>`,
    );
  });
});

describe("frame security policy", () => {
  const csp = widgetFrameCsp();

  it("forces the sandbox even when the page is opened directly", () => {
    expect(csp.startsWith("sandbox allow-scripts")).toBe(true);
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).not.toContain("allow-top-navigation");
    expect(csp).not.toContain("allow-popups");
  });

  it("blocks network access and embedding of other content", () => {
    for (const directive of [
      "default-src 'none'",
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("only allows known script hosts and no eval", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain(
      "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    );
    expect(csp).not.toMatch(/script-src[^;]*\*/);
  });

  it("can only be embedded by the application itself", () => {
    expect(csp).toContain("frame-ancestors 'self'");
  });
});

describe("tokens and permissions", () => {
  it("validates frame tokens", () => {
    expect(isValidFrameToken("abcdefghijklmnop")).toBe(true);
    expect(isValidFrameToken("short")).toBe(false);
    expect(isValidFrameToken("has spaces in it!!")).toBe(false);
    expect(isValidFrameToken(null)).toBe(false);
  });

  it("keeps only known permissions", () => {
    expect(parsePermissions(["read:calendar", "read:calendar", "read:secrets"])).toEqual([
      "read:calendar",
    ]);
  });
});
