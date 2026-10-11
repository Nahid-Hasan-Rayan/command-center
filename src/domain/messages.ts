/**
 * NHR
 * @author Nahid Hasan Rayan
 */

import { stripControlCharacters } from "./text";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_CHANNEL_NAME_LENGTH = 80;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function normalizeMessageBody(raw: string): Checked<string> {
  const value = stripControlCharacters(raw.replace(/\r\n?/g, "\n"), true)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (value.length === 0) {
    return { ok: false, error: "Message is empty." };
  }
  if (value.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message is longer than ${MAX_MESSAGE_LENGTH} characters.` };
  }
  return { ok: true, value };
}

export function normalizeChannelName(raw: string): Checked<string> {
  const value = stripControlCharacters(raw.replace(/\s+/g, " ")).trim();
  if (value.length === 0) {
    return { ok: false, error: "Channel name is empty." };
  }
  if (value.length > MAX_CHANNEL_NAME_LENGTH) {
    return {
      ok: false,
      error: `Channel name is longer than ${MAX_CHANNEL_NAME_LENGTH} characters.`,
    };
  }
  return { ok: true, value };
}
