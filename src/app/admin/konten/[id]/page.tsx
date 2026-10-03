import Link from "next/link";
import { notFound } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/access";
import { getManagedAccount } from "@/lib/admin/account-queries";
import { formatMadrid } from "@/lib/admin/time";
import { AccountActiveForm, AccountNameForm, AccountPasswordForm } from "../account-forms";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ein Promoter- oder Guide-Konto verwalten (Teil 2). Gabos eigenes Konto erscheint hier nie. */
export default async function AccountPage(props: PageProps<"/admin/konten/[id]">) {
  await requireArea("admin");
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const account = await getManagedAccount(id);
  if (!account) notFound();
  const { neu } = await props.searchParams;

  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link href="/admin/konten" className="text-sm underline">
          ← Konten
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {account.display_name}
          {!account.active && (
            <span className="ml-2 rounded bg-neutral-200 px-2 py-0.5 align-middle text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              deaktiviert
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {ROLE_LABELS[account.role]} · {account.email ?? "keine E-Mail"} · angelegt{" "}
          {formatMadrid(account.created_at)}
        </p>
        {neu === "1" && (
          <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">
            Konto angelegt. Die Person kann sich jetzt mit E-Mail und Start-Passwort anmelden.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Status</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {account.active
            ? "Aktiv — kann sich anmelden und verkaufen."
            : "Deaktiviert — keine Anmeldung, kein Verkauf. Die Verkäufe bleiben erhalten."}
        </p>
        <AccountActiveForm id={account.id} active={account.active} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Name</h2>
        <AccountNameForm id={account.id} displayName={account.display_name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Passwort</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Setzt ein neues Passwort. Das alte gilt danach nicht mehr. Es wird keine E-Mail
          verschickt — gib das Passwort persönlich weiter.
        </p>
        <AccountPasswordForm id={account.id} />
      </section>
    </main>
  );
}
