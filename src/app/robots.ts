import type { MetadataRoute } from "next";

/** Interne Anwendung: nichts indexieren. Ergänzt X-Robots-Tag in next.config.ts. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
