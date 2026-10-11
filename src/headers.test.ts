/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };

function matches(source: string, path: string): boolean {
  const pattern = source.replace(/:id/g, "[^/]+").replace(/^\/\(/, "/(");
  return new RegExp(`^${pattern}$`).test(path);
}

async function headersFor(path: string): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers?.()) as Rule[];
  const result = new Map<string, string>();
  for (const rule of rules) {
    if (matches(rule.source, path)) {
      for (const header of rule.headers) {
        result.set(header.key, header.value);
      }
    }
  }
  return result;
}

describe("response headers", () => {
  it("denies framing everywhere except the widget frame route", async () => {
    for (const path of [
      "/",
      "/people",
      "/widgets",
      "/widgets/abc",
      "/files/abc/download",
      "/login",
    ]) {
      expect((await headersFor(path)).get("X-Frame-Options")).toBe("DENY");
    }
    const frame = await headersFor("/widgets/7d5b3a0e/frame");
    expect(frame.has("X-Frame-Options")).toBe(false);
  });

  it("keeps the baseline protections on every route including the frame", async () => {
    for (const path of ["/", "/widgets/abc/frame"]) {
      const headers = await headersFor(path);
      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
      expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    }
  });
});
