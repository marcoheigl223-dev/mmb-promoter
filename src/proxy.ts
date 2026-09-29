import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { areaForPath, LOGIN_PATH } from "@/lib/auth/access";

/**
 * Next.js 16 Proxy (früher Middleware). Zwei Aufgaben:
 *  1. Session-Cookie erneuern (@supabase/ssr-Muster: getUser() löst bei Bedarf
 *     einen Token-Refresh aus, setAll schreibt die neuen Cookies in die Antwort).
 *  2. Optimistischer Schutz von /admin/* und /promoter/*: ohne Session sofort
 *     zum Login. Das ist NICHT die Autorisierung — Rolle und Aktiv-Status werden
 *     in der DAL (src/lib/auth/dal.ts) in jedem Layout geprüft, weil Server
 *     Actions als POST an die Seiten-Route gehen und der Proxy sie nicht
 *     zuverlässig abdeckt (Next.js-Guide "proxy").
 *
 * Keine Umgebungsvariablen aus .env in Kommentaren, keine Secrets: Anon-Key
 * ist öffentlich (NEXT_PUBLIC_), RLS schützt die Daten.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Wichtig: kein Code zwischen createServerClient und getUser (Refresh-Muster).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const area = areaForPath(request.nextUrl.pathname);
  if (area && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/promoter/:path*", "/login", "/"],
};
