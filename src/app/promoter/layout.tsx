import Link from "next/link";

import { ROLE_LABELS } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

/**
 * Schutz für /promoter/*: nur aktive Profile mit Rolle promoter oder guide
 * (Teil 2: der Guide verkauft wie ein Promoter und sieht sein eigenes Dashboard).
 */
export default async function PromoterLayout({
  children,
}: LayoutProps<"/promoter">) {
  const profile = await requireArea("promoter");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {ROLE_LABELS[profile.role]}
          </p>
          <p className="font-medium">{profile.display_name}</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/promoter" className="underline">
            Events
          </Link>
          <Link href="/promoter/dashboard" className="underline">
            Mein Dashboard
          </Link>
          <form action={logout}>
            <button type="submit" className="underline">
              Abmelden
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
