import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { signedImageUrls } from "@/lib/admin/queries";
import { formatCents } from "@/lib/admin/money";
import { formatMadrid } from "@/lib/admin/time";
import { listOwnBookings, listSellableDepartures } from "@/lib/promoter/queries";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/promoter/types";

/**
 * Promoter-Start (E5.4, Verkaufs-Kern): kommende offene Events — auch interne
 * (Entscheidung 3 vom 02.10.2026) — zum Verkaufen, darunter die letzten
 * eigenen Verkäufe. Das volle Dashboard (Statistik, Provisionssumme) folgt in E5.5.
 */
export default async function PromoterPage() {
  await requireArea("promoter");
  const [departures, bookings] = await Promise.all([listSellableDepartures(), listOwnBookings(10)]);
  const imageUrls = await signedImageUrls(departures.map((d) => d.image_path));

  return (
    <main className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Events verkaufen</h1>
        {departures.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Gerade keine offenen Events.</p>
        )}
        <ul className="flex flex-col gap-3">
          {departures.map((d) => {
            const free = Math.max(d.capacity_total - d.seats_booked_total, 0);
            const img = d.image_path ? imageUrls[d.image_path] : undefined;
            return (
              <li key={d.id}>
                <Link
                  href={`/promoter/verkaufen/${d.id}`}
                  className="flex items-center gap-3 rounded border border-neutral-300 p-3 dark:border-neutral-700"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signierte URL aus privatem Bucket
                    <img src={img} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-20 shrink-0 rounded bg-neutral-100 dark:bg-neutral-900" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {d.title}
                      {d.is_internal && (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                          intern
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{formatMadrid(d.starts_at)}</p>
                    <p className="text-sm">
                      {free > 0 ? `${free} von ${d.capacity_total} frei` : "ausverkauft"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium underline">
                    {free > 0 ? "Verkaufen" : "Ansehen"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Meine letzten Verkäufe</h2>
        {bookings.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Noch keine Verkäufe.</p>
        )}
        <ul className="flex flex-col gap-2">
          {bookings.map((b) => (
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
                </div>
                <div className="shrink-0 text-right">
                  <p>
                    {b.status === "cancelled" || b.status === "refunded"
                      ? BOOKING_STATUS_LABELS[b.status]
                      : PAYMENT_STATUS_LABELS[b.payment_status]}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Rest {formatCents(b.amount_due_cents)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
