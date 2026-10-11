/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Checked } from "./messages";
import { stripControlCharacters } from "./text";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 200;
export const SNIFF_BYTES = 512;

export const ALLOWED_TYPES: Readonly<Record<string, readonly string[]>> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "text/plain": ["txt"],
  "text/markdown": ["md", "markdown"],
  "text/csv": ["csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
};

export interface UploadMeta {
  name: string;
  mimeType: string;
  size: number;
}

export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = stripControlCharacters(base.normalize("NFKC"))
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  if (cleaned.length === 0) {
    return "file";
  }
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) {
    return cleaned;
  }
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length) + extension;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function validateUploadMeta(input: {
  name: string;
  mimeType: string;
  size: number;
}): Checked<UploadMeta> {
  const name = sanitizeFileName(input.name);
  const extensions = ALLOWED_TYPES[input.mimeType];
  if (!extensions) {
    return { ok: false, error: "This file type is not allowed." };
  }
  if (!extensions.includes(extensionOf(name))) {
    return { ok: false, error: "The file extension does not match its type." };
  }
  if (!Number.isInteger(input.size) || input.size < 1) {
    return { ok: false, error: "The file is empty." };
  }
  if (input.size > MAX_FILE_BYTES) {
    return { ok: false, error: "The file is larger than 10 MB." };
  }
  return { ok: true, value: { name, mimeType: input.mimeType, size: input.size } };
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

function isPlainText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

export function contentMatchesType(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      return isPlainText(bytes);
    default:
      return mimeType in ALLOWED_TYPES && startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }
}
