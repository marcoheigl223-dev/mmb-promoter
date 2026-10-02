import Link from "next/link";
import { notFound } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import {
  departureCommissionSummary,
  departurePricingSummary,
  getDeparture,
  getTemplate,
} from "@/lib/admin/queries";
import { formatCents } from "@/lib/admin/money";
import { formatMadrid } from "@/lib/admin/time";
import { PRICING_KIND_LABELS, STATUS_LABELS, type PricingKind } from "@/lib/admin/types";
import { updateDeparture } from "../actions";
import { DepartureForm } from "../departure-form";
import { CommissionOverrideForm } from "./commission-override-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DeparturePage(props: PageProps<"/admin/termine/[id]">) {
  await requireArea("admin");
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const departure = await getDeparture(id);
  if (!departure) notFound();

  const [{ overrides, effective, standard, usesOverride }, pricing, template] = await Promise.all([
    departureCommissionSummary(id),
    departurePricingSummary(id),
    // E5.2: Herkunft anzeigen (Werte sind kopiert, kein Live-Bezug)
    departure.template_id ? getTemplate(departure.template_id) : Promise.resolve(null),
  ]);
  const free = departure.capacity_total - departure.seats_booked_total;

  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Termine
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {departure.title}
          {departure.is_internal && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              intern
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {formatMadrid(departure.starts_at)} · {STATUS_LABELS[departure.status]} · Kontingent{" "}
          {departure.capacity_total} · gebucht {departure.seats_booked_total} · frei {free}
        </p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          <PricingLine kind="ticket_price" summary={pricing} /> ·{" "}
          <PricingLine kind="deposit" summary={pricing} />
        </p>
        {departure.template_id && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Aus Vorlage:{" "}
            {template ? (
              <Link href={`/admin/vorlagen/${template.id}`} className="underline">
                {template.name}
              </Link>
            ) : (
              "nicht mehr vorhanden"
            )}{" "}
            <span className="text-neutral-500">(Werte wurden beim Anlegen kopiert)</span>
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Termin bearbeiten</h2>
        <DepartureForm
          action={updateDeparture}
          initial={departure}
          submitLabel="Speichern"
          standardPricing={pricing.standard}
          overridePricing={pricing.override}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Preis und Anzahlung für diesen Termin</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Gesetzt wird beides oben im Formular (leer = Standard). Jede Änderung ist eine neue
          Zeile — Verkäufe rechnen mit dem Wert, der beim Verkauf galt.
        </p>
        {pricing.history.length === 0 ? (
          <p className="text-sm text-neutral-500">Noch keine eigene Regel — es gilt der Standard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-1 pr-4">Gültig ab</th>
                  <th className="py-1 pr-4">Was</th>
                  <th className="py-1 pr-4">Betrag</th>
                  <th className="py-1">Angelegt</th>
                </tr>
              </thead>
              <tbody>
                {pricing.history.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1 pr-4">{formatMadrid(r.valid_from)}</td>
                    <td className="py-1 pr-4">{PRICING_KIND_LABELS[r.kind]}</td>
                    <td className="py-1 pr-4">
                      {r.amount_cents === null ? "wieder Standard" : formatCents(r.amount_cents)}
                    </td>
                    <td className="py-1 text-neutral-500">{formatMadrid(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Provision für diesen Termin</h2>
        <p className="text-sm">
          Jetzt gültig:{" "}
          <strong>{effective === null ? "keine Regel" : formatCents(effective)}</strong> pro Ticket{" "}
          <span className="text-neutral-500">
            ({usesOverride ? "Ausnahme für diesen Termin" : "Standard"}
            {standard !== null && usesOverride ? `, Standard wäre ${formatCents(standard)}` : ""})
          </span>
        </p>
        <CommissionOverrideForm departureId={id} />

        {overrides.length > 0 && (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-1 pr-4">Gültig ab</th>
                  <th className="py-1 pr-4">Provision</th>
                  <th className="py-1">Angelegt</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1 pr-4">{formatMadrid(r.valid_from)}</td>
                    <td className="py-1 pr-4">
                      {r.commission_cents === null ? "wieder Standard" : formatCents(r.commission_cents)}
                    </td>
                    <td className="py-1 text-neutral-500">{formatMadrid(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/** „Ticketpreis pro Person: 45,00 € (eigener Wert, Standard wäre 40,00 €)" */
function PricingLine({
  kind,
  summary,
}: {
  kind: PricingKind;
  summary: Awaited<ReturnType<typeof departurePricingSummary>>;
}) {
  const value = summary.effective[kind];
  const std = summary.standard[kind];
  const own = summary.override[kind] !== null;
  return (
    <>
      {PRICING_KIND_LABELS[kind]}:{" "}
      <strong>{value === null ? "nicht gesetzt" : formatCents(value)}</strong>
      <span className="text-neutral-500">
        {" "}
        ({own ? "eigener Wert" : "Standard"}
        {own && std !== null ? `, Standard wäre ${formatCents(std)}` : ""})
      </span>
    </>
  );
}
