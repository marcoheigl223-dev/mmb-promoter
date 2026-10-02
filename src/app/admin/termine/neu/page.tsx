import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { getTemplate, listTemplates, standardPricing } from "@/lib/admin/queries";
import { formatCents } from "@/lib/admin/money";
import type { EventTemplate, PricingAmounts } from "@/lib/admin/types";
import { createDeparture } from "../actions";
import { DepartureForm } from "../departure-form";
import { FromTemplateForm } from "../from-template-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Neuer Termin/Event. E5.2: mit `?vorlage=<id>` wird das Formular auf Datum/
 * Uhrzeit (+ Status) reduziert, alle anderen Werte kommen aus der Vorlage.
 * Ohne Vorlage: das volle Formular wie bisher plus Auswahl „Aus Vorlage".
 */
export default async function NewDeparturePage(props: PageProps<"/admin/termine/neu">) {
  await requireArea("admin");
  const params = await props.searchParams;
  const vorlageRaw = params.vorlage;
  const vorlageId = Array.isArray(vorlageRaw) ? vorlageRaw[0] : vorlageRaw;

  const [standard, templates] = await Promise.all([standardPricing(), listTemplates()]);
  const activeTemplates = templates.filter((t) => t.active);

  let template: EventTemplate | null = null;
  let templateHint: string | null = null;
  if (vorlageId !== undefined) {
    template = UUID_RE.test(vorlageId) ? await getTemplate(vorlageId) : null;
    if (!template) {
      templateHint = "Vorlage nicht gefunden — du kannst den Termin von Hand anlegen.";
    } else if (!template.active) {
      templateHint = `Die Vorlage „${template.name}“ ist deaktiviert — erst wieder aktivieren oder den Termin von Hand anlegen.`;
      template = null;
    }
  }

  if (template) {
    return (
      <main className="flex flex-col gap-6">
        <div>
          <Link href="/admin" className="text-sm underline">
            ← Termine
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Neuer Termin aus Vorlage „{template.name}“</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Nur Datum und Uhrzeit sind nötig. Die Werte unten werden beim Anlegen kopiert — spätere
            Änderungen an der Vorlage ändern dieses Event nicht.{" "}
            <Link href="/admin/termine/neu" className="underline">
              Stattdessen von Hand anlegen
            </Link>
          </p>
        </div>

        <TemplateSummary template={template} standard={standard} />

        <FromTemplateForm template={template} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Termine
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Neuer Termin / Event</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Das Kontingent ist die Zahl der Plätze, die das Promoter-Netzwerk für diesen
          Termin verkaufen darf. Die Sperre auf der Boots-Seite bleibt ein manueller Schritt.
          Preis und Anzahlung pro Person gelten nach Standard, solange du hier nichts einträgst.
        </p>
      </div>

      {templateHint && (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
          {templateHint}
        </p>
      )}

      <section className="flex flex-col gap-2 rounded border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Aus Vorlage</h2>
        {activeTemplates.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Noch keine aktive Vorlage.{" "}
            <Link href="/admin/vorlagen/neu" className="underline">
              Vorlage anlegen
            </Link>
          </p>
        ) : (
          <form method="get" action="/admin/termine/neu" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Vorlage wählen
              <select
                name="vorlage"
                defaultValue={activeTemplates[0].id}
                className="rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
              >
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.title}, Kontingent {t.capacity_total}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded border border-neutral-900 px-4 py-2 text-sm font-medium dark:border-neutral-100"
            >
              Weiter mit Vorlage
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Von Hand</h2>
        <DepartureForm action={createDeparture} submitLabel="Termin anlegen" standardPricing={standard} />
      </section>
    </main>
  );
}

/** Was aus der Vorlage ins Event kopiert wird — mit „Standard", wo die Vorlage nichts vorgibt. */
function TemplateSummary({ template, standard }: { template: EventTemplate; standard: PricingAmounts }) {
  const line = (label: string, own: number | null, std: number | null) => (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>
        {own !== null
          ? `${formatCents(own)} (eigener Wert)`
          : std !== null
            ? `${formatCents(std)} (Standard)`
            : "Standard — noch nicht eingetragen"}
      </dd>
    </>
  );
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <dt className="text-neutral-500">Titel</dt>
      <dd>
        {template.title}
        {template.is_internal && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            intern
          </span>
        )}
      </dd>
      <dt className="text-neutral-500">Kontingent</dt>
      <dd>{template.capacity_total}</dd>
      {line("Ticketpreis pro Person", template.ticket_price_cents, standard.ticket_price)}
      {line("Anzahlung pro Person", template.deposit_cents, standard.deposit)}
      <dt className="text-neutral-500">Provision pro Ticket</dt>
      <dd>
        {template.commission_cents !== null
          ? `${formatCents(template.commission_cents)} (eigener Wert)`
          : "Standard"}
      </dd>
      {template.note && (
        <>
          <dt className="text-neutral-500">Notiz</dt>
          <dd className="whitespace-pre-wrap">{template.note}</dd>
        </>
      )}
    </dl>
  );
}
