/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      {
        source: "/((?!widgets/[^/]+/frame$).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      { source: "/widgets/:id/frame", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
