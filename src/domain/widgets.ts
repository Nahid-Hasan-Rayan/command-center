/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Checked } from "./messages";

export const MAX_WIDGET_CHARS = 2_000_000;
export const MAX_WIDGET_NAME = 80;
export const MAX_WIDGET_DESCRIPTION = 500;
export const MAX_STATE_CHARS = 500_000;
export const WIDGET_PERMISSIONS = ["read:calendar"] as const;
export const WIDGET_SANDBOX = "allow-scripts allow-downloads allow-modals";

export type WidgetPermission = (typeof WIDGET_PERMISSIONS)[number];

export interface WidgetUpload {
  name: string;
  description: string;
  html: string;
}

export interface WidgetBoot {
  token: string;
  state: Record<string, string>;
  permissions: readonly WidgetPermission[];
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const HTML_NAME = /\.html?$/i;

export function isWidgetPermission(value: string): value is WidgetPermission {
  return (WIDGET_PERMISSIONS as readonly string[]).includes(value);
}

export function parsePermissions(values: readonly string[]): WidgetPermission[] {
  return [...new Set(values.filter(isWidgetPermission))];
}

export function isValidFrameToken(value: string | null): value is string {
  return value !== null && TOKEN_PATTERN.test(value);
}

export function validateWidgetUpload(input: {
  name: string;
  description: string;
  fileName: string;
  text: string;
}): Checked<WidgetUpload> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > MAX_WIDGET_NAME) {
    return { ok: false, error: `Name must be 1 to ${MAX_WIDGET_NAME} characters.` };
  }
  const description = input.description.trim();
  if (description.length > MAX_WIDGET_DESCRIPTION) {
    return {
      ok: false,
      error: `Description must be at most ${MAX_WIDGET_DESCRIPTION} characters.`,
    };
  }
  if (!HTML_NAME.test(input.fileName)) {
    return { ok: false, error: "Upload a .html file." };
  }
  if (input.text.length === 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (input.text.length > MAX_WIDGET_CHARS) {
    return { ok: false, error: "The file is larger than 2 MB." };
  }
  if (input.text.includes("\u0000") || input.text.includes("\ufffd")) {
    return { ok: false, error: "The file is not valid UTF-8 text." };
  }
  if (!/<[a-z!]/i.test(input.text)) {
    return { ok: false, error: "The file does not look like HTML." };
  }
  return { ok: true, value: { name, description, html: input.text } };
}

export function escapeForScript(json: string): string {
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function buildBootTag(boot: WidgetBoot, bridgeSource: string): string {
  const payload = escapeForScript(JSON.stringify(boot));
  const safeBridge = bridgeSource.replaceAll("</script", "<\\/script");
  return `<script>window.__CC_BOOT__=${payload};</script><script>${safeBridge}</script>`;
}

export function injectBoot(html: string, bootTag: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + bootTag + html.slice(at);
  }
  const doctype = /^\s*(?:\ufeff)?<!doctype[^>]*>/i.exec(html);
  const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}<head>${bootTag}</head>${html.slice(at)}`;
  }
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + bootTag + html.slice(at);
  }
  return bootTag + html;
}

export function widgetFrameCsp(): string {
  const cdn = "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net";
  return [
    "sandbox allow-scripts allow-downloads allow-modals",
    "default-src 'none'",
    `script-src 'unsafe-inline' ${cdn}`,
    `style-src 'unsafe-inline' ${cdn} https://fonts.googleapis.com`,
    `font-src data: ${cdn} https://fonts.gstatic.com`,
    "img-src data: blob:",
    "media-src data: blob:",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}
