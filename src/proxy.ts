/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/domain/access-gate";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { readProxySession } from "@/lib/supabase/proxy-session";

const isProduction = process.env.NODE_ENV === "production";
const FRAME_ROUTE = /^\/widgets\/[^/]+\/frame$/;

function contentSecurityPolicy(nonce: string, supabaseOrigin: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const env = readSupabaseEnv();
  if (!env) {
    return new NextResponse("The application is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { pathname } = request.nextUrl;
  const session = await readProxySession(request, env);
  const decision = decideAccess({
    pathname,
    authenticated: session.authenticated,
    hasVerifiedFactor: session.hasVerifiedFactor,
    level: session.level,
  });

  const withCookies = (response: NextResponse): NextResponse => {
    for (const entry of session.cookies) {
      response.cookies.set(...entry);
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  if (decision.type === "redirect") {
    return withCookies(NextResponse.redirect(new URL(decision.to, request.url)));
  }

  if (FRAME_ROUTE.test(pathname)) {
    return withCookies(NextResponse.next({ request: { headers: new Headers(request.headers) } }));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, new URL(env.url).origin);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = withCookies(NextResponse.next({ request: { headers: requestHeaders } }));
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
