import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
