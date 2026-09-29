import { requireArea } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

/** Schutz für /promoter/*: nur aktive Profile mit Rolle promoter. */
export default async function PromoterLayout({
  children,
}: LayoutProps<"/promoter">) {
  const profile = await requireArea("promoter");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Promoter
          </p>
          <p className="font-medium">{profile.display_name}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Abmelden
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
