/**
 * NHR
 * @author Nahid Hasan Rayan
 */

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function isValidInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createInviteToken(): Promise<{ token: string; hash: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  return { token, hash: await hashInviteToken(token) };
}
