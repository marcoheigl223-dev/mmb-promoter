import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { listManagedAccounts, type ManagedAccount } from "@/lib/admin/account-queries";
import type { ManagedRole } from "@/lib/admin/accounts";
import { CreateAccountForm } from "./account-forms";

/**
 * Konto-Verwaltung (Teil 2): Gabo legt Promoter- und Guide-Konten an,
 * aktiviert/deaktiviert sie und setzt Passwörter. Promoter und Guides stehen
 * getrennt — je Rolle eine Liste und ein eigenes Anlege-Formular.
 */
export default async function AccountsPage() {
  await requireArea("admin");
  const accounts = await listManagedAccounts();

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Konten</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Jede Person bekommt ein eigenes Konto (keine geteilten Logins). Deaktivieren statt
          löschen: ein deaktiviertes Konto kann sich nicht anmelden und nicht verkaufen, seine
          Verkäufe bleiben erhalten. Die Rolle steht beim Anlegen fest.
        </p>
      </div>

      <AccountSection
        role="promoter"
        title="Promoter"
        hint="Verkaufen am Strand, sehen nur ihre eigenen Verkäufe und Zahlen."
        rows={accounts.filter((a) => a.role === "promoter")}
      />
      <AccountSection
        role="guide"
        title="Guides"
        hint="Verkaufen wie ein Promoter und sehen nur ihre eigenen Verkäufe. Guide-Extras folgen später."
        rows={accounts.filter((a) => a.role === "guide")}
      />
    </main>
  );
}

function AccountSection({
  role,
  title,
  hint,
  rows,
}: {
  role: ManagedRole;
  title: string;
  hint: string;
  rows: ManagedAccount[];
}) {
  const newLabel = role === "promoter" ? "Neuen Promoter anlegen" : "Neuen Guide anlegen";
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          {title} ({rows.length})
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Noch kein Konto.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4">E-Mail</th>
                <th className="py-1 pr-4">Status</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4 font-medium">{a.display_name}</td>
                  <td className="py-2 pr-4 break-all">{a.email ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {a.active ? (
                      "aktiv"
                    ) : (
                      <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        deaktiviert
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/konten/${a.id}`} className="underline">
                      verwalten
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-medium">{newLabel}</summary>
        <div className="mt-3">
          <CreateAccountForm role={role} />
        </div>
      </details>
    </section>
  );
}
