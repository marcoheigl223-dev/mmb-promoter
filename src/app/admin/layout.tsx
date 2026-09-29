import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

/**
 * Schutz für /admin/*: nur aktive Profile mit Rolle network_operator.
 * Die Prüfung liegt im Layout UND in jeder Server Action (DAL), nicht nur im Proxy.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const profile = await requireArea("admin");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Admin · network_operator
          </p>
          <p className="font-medium">{profile.display_name}</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="underline">
            Termine
          </Link>
          <Link href="/admin/regeln" className="underline">
            Regeln
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
