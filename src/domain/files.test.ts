/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  contentMatchesType,
  extensionOf,
  MAX_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  sanitizeFileName,
  validateUploadMeta,
} from "./files";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("sanitizeFileName", () => {
  it("removes directories and dangerous characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\temp\\report.pdf")).toBe("report.pdf");
    expect(sanitizeFileName('a<b>:"c|d?.txt')).toBe("a_b___c_d_.txt");
    expect(sanitizeFileName("bad\u0000name.txt")).toBe("badname.txt");
  });

  it("removes leading dots and falls back for empty names", () => {
    expect(sanitizeFileName(".hidden.txt")).toBe("hidden.txt");
    expect(sanitizeFileName("   ")).toBe("file");
    expect(sanitizeFileName("...")).toBe("file");
  });

  it("truncates long names but keeps the extension", () => {
    const result = sanitizeFileName(`${"a".repeat(400)}.pdf`);
    expect(result.length).toBe(MAX_FILE_NAME_LENGTH);
    expect(result.endsWith(".pdf")).toBe(true);
  });
});

describe("validateUploadMeta", () => {
  it("accepts a matching type, extension and size", () => {
    expect(
      validateUploadMeta({ name: "notes.PDF", mimeType: "application/pdf", size: 1000 }),
    ).toEqual({
      ok: true,
      value: { name: "notes.PDF", mimeType: "application/pdf", size: 1000 },
    });
  });

  it.each([
    ["page.html", "text/html"],
    ["pic.svg", "image/svg+xml"],
    ["run.exe", "application/octet-stream"],
    ["archive.zip", "application/zip"],
  ])("rejects %s as %s", (name, mimeType) => {
    expect(validateUploadMeta({ name, mimeType, size: 10 })).toMatchObject({ ok: false });
  });

  it("rejects an extension that disagrees with the declared type", () => {
    expect(
      validateUploadMeta({ name: "evil.html", mimeType: "application/pdf", size: 10 }),
    ).toMatchObject({
      ok: false,
    });
  });

  it("enforces size limits", () => {
    expect(
      validateUploadMeta({ name: "a.pdf", mimeType: "application/pdf", size: 0 }),
    ).toMatchObject({ ok: false });
    expect(
      validateUploadMeta({ name: "a.pdf", mimeType: "application/pdf", size: MAX_FILE_BYTES }),
    ).toMatchObject({ ok: true });
    expect(
      validateUploadMeta({ name: "a.pdf", mimeType: "application/pdf", size: MAX_FILE_BYTES + 1 }),
    ).toMatchObject({ ok: false });
    expect(
      validateUploadMeta({ name: "a.pdf", mimeType: "application/pdf", size: 1.5 }),
    ).toMatchObject({ ok: false });
  });

  it("finds extensions", () => {
    expect(extensionOf("a.tar.GZ")).toBe("gz");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("contentMatchesType", () => {
  it("recognises real signatures", () => {
    expect(contentMatchesType(ascii("%PDF-1.7 rest"), "application/pdf")).toBe(true);
    expect(
      contentMatchesType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1), "image/png"),
    ).toBe(true);
    expect(contentMatchesType(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(contentMatchesType(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "), "image/webp")).toBe(
      true,
    );
    expect(
      contentMatchesType(
        bytes(0x50, 0x4b, 0x03, 0x04, 0),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("rejects mislabelled content", () => {
    expect(contentMatchesType(ascii("<html><script>alert(1)</script>"), "application/pdf")).toBe(
      false,
    );
    expect(contentMatchesType(ascii("%PDF-1.7"), "image/png")).toBe(false);
    expect(contentMatchesType(ascii("RIFF....WAVE"), "image/webp")).toBe(false);
    expect(
      contentMatchesType(
        ascii("not a zip"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(false);
    expect(contentMatchesType(ascii("anything"), "application/zip")).toBe(false);
  });

  it("accepts plain text and rejects binary or invalid UTF-8 as text", () => {
    expect(contentMatchesType(ascii("hello, world\nline 2"), "text/plain")).toBe(true);
    expect(contentMatchesType(ascii("# title"), "text/markdown")).toBe(true);
    expect(contentMatchesType(bytes(0x68, 0x00, 0x69), "text/plain")).toBe(false);
    expect(contentMatchesType(bytes(0xff, 0xfe, 0xfd), "text/csv")).toBe(false);
  });
});
