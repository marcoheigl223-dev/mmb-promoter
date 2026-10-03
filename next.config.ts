import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E5.3: Bild-Upload über Server Actions — 5 MB Bild + Multipart-Overhead
  // (Next.js-Standard wäre 1 MB; Limit gilt für den rohen Request-Body).
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Interne Anwendung (Promoter-Netzwerk): keine Seite darf in Suchmaschinen landen.
  // Dreifach: Header hier, robots.txt (src/app/robots.ts), Metadata im Root-Layout.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
