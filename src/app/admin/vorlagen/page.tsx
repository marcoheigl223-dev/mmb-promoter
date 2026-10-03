import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { listTemplates, signedImageUrls } from "@/lib/admin/queries";
import { formatCents } from "@/lib/admin/money";
import type { EventTemplate } from "@/lib/admin/types";

/** Eventvorlagen (E5.2): Stammdaten, aus denen Gabo Termine mit nur Datum/Uhrzeit anlegt. */
export default async function TemplatesPage() {
  await requireArea("admin");
  const templates = await listTemplates();
  // E5.3: Vorschaubilder — eine Signier-Anfrage für alle Pfade (privater Bucket)
  const imageUrls = await signedImageUrls(templates.map((t) => t.image_path));
  const active = templates.filter((t) => t.active);
  const inactive = templates.filter((t) => !t.active);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Eventvorlagen</h1>
        <Link
          href="/admin/vorlagen/neu"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Neue Vorlage
        </Link>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Eine Vorlage speichert Titel, Kontingent, Preis/Anzahlung und Provision. Beim Anlegen
        eines Events daraus gibst du nur Datum und Uhrzeit an — die Werte werden kopiert,
        spätere Änderungen an der Vorlage ändern bestehende Events nicht.
      </p>

      {templates.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">
          Noch keine Vorlage. Lege die erste an, danach erscheint sie unter „Neuer Termin“ als
          Auswahl „Aus Vorlage“.
        </p>
      )}

      {active.length > 0 && <TemplateTable title="Aktiv" rows={active} imageUrls={imageUrls} />}
      {inactive.length > 0 && <TemplateTable title="Deaktiviert" rows={inactive} imageUrls={imageUrls} />}
    </main>
  );
}

function amountOrStandard(cents: number | null) {
  return cents === null ? <span className="text-neutral-500">Standard</span> : formatCents(cents);
}

function TemplateTable({
  title,
  rows,
  imageUrls,
}: {
  title: string;
  rows: EventTemplate[];
  imageUrls: Record<string, string>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1 pr-2"></th>
              <th className="py-1 pr-4">Vorlage</th>
              <th className="py-1 pr-4">Event-Titel</th>
              <th className="py-1 pr-4 text-right">Kontingent</th>
              <th className="py-1 pr-4 text-right">Preis</th>
              <th className="py-1 pr-4 text-right">Anzahlung</th>
              <th className="py-1 pr-4 text-right">Provision</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-2">
                  <Thumbnail url={t.image_path ? (imageUrls[t.image_path] ?? null) : null} />
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/vorlagen/${t.id}`} className="underline">
                    {t.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {t.title}
                  {t.is_internal && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      intern
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{t.capacity_total}</td>
                <td className="py-2 pr-4 text-right">{amountOrStandard(t.ticket_price_cents)}</td>
                <td className="py-2 pr-4 text-right">{amountOrStandard(t.deposit_cents)}</td>
                <td className="py-2 pr-4 text-right">{amountOrStandard(t.commission_cents)}</td>
                <td className="py-2 whitespace-nowrap">
                  {t.active && (
                    <Link href={`/admin/termine/neu?vorlage=${t.id}`} className="underline">
                      Event anlegen
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** E5.3: Vorschaubild (signierte URL) oder Platzhalter. */
function Thumbnail({ url }: { url: string | null }) {
  if (!url) {
    return <span className="block h-10 w-14 rounded bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />;
  }
  // Signierte URL läuft ab — next/image hätte keinen stabilen Cache-Schlüssel.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-10 w-14 rounded object-cover" />;
}
