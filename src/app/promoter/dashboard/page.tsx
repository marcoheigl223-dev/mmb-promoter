import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { formatCents } from "@/lib/admin/money";
import { formatMadrid } from "@/lib/admin/time";
import { fillDays, madridDayKey, shiftDayKey, type DayPoint } from "@/lib/promoter/dashboard";
import { getOwnSalesSummary, listAllOwnBookings, listOwnSalesDays } from "@/lib/promoter/queries";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/promoter/types";

const CHART_DAYS = 14;

/**
 * Mein Dashboard (E5.5b / Teil 1 nach der Diagnose E5.5): eigene Kennzahlen
 * heute/gesamt aus `sales_by_promoter`, Abschlüsse der letzten 14 Tage aus
 * `sales_by_day`, darunter alle eigenen Verkäufe. Alle Beträge kommen aus der
 * DB (Sichten bzw. Snapshots pro Buchung) — hier wird nichts summiert.
 */
export default async function PromoterDashboardPage() {
  const profile = await requireArea("promoter");
  const today = madridDayKey(new Date());
  const [summary, dayRows, bookings] = await Promise.all([
    getOwnSalesSummary(profile.id),
    listOwnSalesDays(shiftDayKey(today, -(CHART_DAYS - 1))),
    listAllOwnBookings(profile.id),
  ]);
  const days = fillDays(dayRows, today, CHART_DAYS);

  return (
    <main className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Mein Dashboard</h1>
        <Link
          href="/promoter"
          className="rounded bg-neutral-900 px-4 py-3 text-center font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Zu den Events · Verkaufen
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Heute</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="Abschlüsse" value={String(summary.today_sales_count)} />
          <Figure label="Umsatz" value={formatCents(summary.today_revenue_cents)} />
          <Figure label="Provision" value={formatCents(summary.today_commission_cents)} />
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gesamt</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="Abschlüsse" value={String(summary.sales_count)} />
          <Figure
            label="Tickets"
            value={String(summary.tickets)}
            hint={`${summary.paid_tickets} bezahlt · ${summary.tickets - summary.paid_tickets} gratis`}
          />
          <Figure label="Umsatz" value={formatCents(summary.revenue_cents)} />
          <Figure label="Kassiert" value={formatCents(summary.collected_cents)} />
          <Figure label="Offen (Rest im Bus)" value={formatCents(summary.due_cents)} />
          <Figure label="Provision" value={formatCents(summary.commission_cents)} />
        </dl>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Umsatz = Gesamtpreis der nicht stornierten Verkäufe. Provision = beim Verkauf festgeschriebener Betrag.
        </p>
        {summary.cancelled_count > 0 && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            Storniert: {summary.cancelled_count} · Provision dazu {formatCents(summary.cancelled_commission_cents)} — nicht in den Summen oben, Regelung noch offen.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{`Abschlüsse der letzten ${CHART_DAYS} Tage`}</h2>
        <SalesChart days={days} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{`Alle meine Verkäufe (${bookings.length})`}</h2>
        {bookings.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Noch keine Verkäufe.</p>
        )}
        <ul className="flex flex-col gap-2">
          {bookings.map((b) => {
            const cancelled = b.status === "cancelled" || b.status === "refunded";
            return (
              <li key={b.id}>
                <Link
                  href={`/promoter/verkaeufe/${b.id}`}
                  className="flex items-start justify-between gap-3 rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{b.customer_name}</p>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {b.tour_departures?.title ?? "Event"} · {b.seats} Pers.
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-400">{formatMadrid(b.sold_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatCents(b.total_amount_cents)}</p>
                    <p>{cancelled ? BOOKING_STATUS_LABELS[b.status] : PAYMENT_STATUS_LABELS[b.payment_status]}</p>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Provision {formatCents(b.commission_total_cents)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <dt className="text-xs text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</dd>}
    </div>
  );
}

function dayLabel(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

/**
 * Balken = Abschlüsse pro Tag (Ortszeit Mallorca); serverseitiges SVG ohne
 * Bibliothek. Darunter die Tage mit Verkauf samt Umsatz aus `sales_by_day`.
 */
function SalesChart({ days }: { days: DayPoint[] }) {
  const max = Math.max(1, ...days.map((d) => d.sales_count));
  const slot = 20;
  const barHeight = 80;
  const width = days.length * slot;
  const withSales = days.filter((d) => d.sales_count > 0).reverse();
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${barHeight + 16}`}
        className="h-auto w-full text-neutral-900 dark:text-neutral-100"
        role="img"
        aria-label={`Abschlüsse pro Tag, letzte ${days.length} Tage`}
      >
        <line x1="0" x2={width} y1={barHeight} y2={barHeight} stroke="currentColor" strokeOpacity="0.2" />
        {days.map((d, i) => {
          const h = (d.sales_count / max) * (barHeight - 14);
          const x = i * slot + 3;
          const mid = x + (slot - 6) / 2;
          return (
            <g key={d.day}>
              <title>{`${dayLabel(d.day)}: ${d.sales_count} Abschlüsse, ${formatCents(d.revenue_cents)}`}</title>
              {d.sales_count > 0 && (
                <>
                  <rect x={x} y={barHeight - h} width={slot - 6} height={h} fill="currentColor" rx="1" />
                  <text x={mid} y={barHeight - h - 3} fontSize="8" textAnchor="middle" fill="currentColor">
                    {d.sales_count}
                  </text>
                </>
              )}
              <text x={mid} y={barHeight + 11} fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.6">
                {d.day.slice(8, 10)}
              </text>
            </g>
          );
        })}
      </svg>
      {withSales.length === 0 ? (
        <figcaption className="text-sm text-neutral-600 dark:text-neutral-400">
          In den letzten {days.length} Tagen keine Abschlüsse.
        </figcaption>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {withSales.map((d) => (
            <li key={d.day} className="flex justify-between gap-3 tabular-nums">
              <span>{dayLabel(d.day)}</span>
              <span>
                {d.sales_count} {d.sales_count === 1 ? "Abschluss" : "Abschlüsse"} · {formatCents(d.revenue_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
