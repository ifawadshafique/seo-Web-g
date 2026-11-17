import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { localPatterns: [{ pathname: "/api/media/**" }] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  // Render publishing and public content at request time.
  cacheComponents: false,
  // Keep normal route navigation for the authenticated editor.
  partialPrefetching: false,
};

export default nextConfig;
