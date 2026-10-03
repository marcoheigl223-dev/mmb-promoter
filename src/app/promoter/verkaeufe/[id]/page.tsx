import Link from "next/link";
import { notFound } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/admin/money";
import { formatMadrid } from "@/lib/admin/time";
import { getOwnBooking } from "@/lib/promoter/queries";
import {
  BOOKING_STATUS_LABELS,
  DEPOSIT_BASIS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type PaymentStatus,
} from "@/lib/promoter/types";
import { StatusForm } from "./status-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AuditRow = {
  id: string;
  action: string;
  actor_role: string | null;
  old_values: { payment_status?: PaymentStatus } | null;
  new_values: { payment_status?: PaymentStatus } | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  sold: "Verkauft",
  payment_status_set: "Zahlungsstatus geändert",
  cancelled: "Storniert",
};

/** E5.4: ein eigener Verkauf — Beträge aus den Snapshots, Zahlungsstatus, Verlauf (Audit-Log). */
export default async function BookingPage(props: PageProps<"/promoter/verkaeufe/[id]">) {
  await requireArea("promoter");
  const { id } = await props.params;
  const { neu } = await props.searchParams;
  if (!UUID_RE.test(id)) notFound();

  const booking = await getOwnBooking(id);
  if (!booking) notFound();

  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("booking_audit_log")
    .select("id, action, actor_role, old_values, new_values, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: true });

  const cancelled = booking.status === "cancelled" || booking.status === "refunded";
  const dep = booking.tour_departures;

  return (
    <main className="flex flex-col gap-5">
      <Link href="/promoter" className="text-sm underline">
        ← Zurück
      </Link>

      {neu === "1" && (
        <p role="status" className="rounded bg-green-100 p-3 text-green-900 dark:bg-green-900 dark:text-green-100">
          Verkauf gespeichert. {booking.seats} {booking.seats === 1 ? "Platz" : "Plätze"} reserviert.
        </p>
      )}

      <div>
        <h1 className="text-xl font-semibold">{booking.customer_name}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {dep?.title ?? "Event"}
          {dep && ` · ${formatMadrid(dep.starts_at)}`}
        </p>
        {cancelled && (
          <p className="mt-2 font-medium text-red-700 dark:text-red-400">
            {BOOKING_STATUS_LABELS[booking.status]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded border-2 border-neutral-900 p-4 dark:border-neutral-100">
        <div className="flex items-baseline justify-between gap-4">
          <span>Gesamtpreis</span>
          <span className="text-lg font-semibold">{formatCents(booking.total_amount_cents)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span>Kassiert</span>
          <span className="text-lg font-semibold">{formatCents(booking.amount_paid_cents)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span>Rest im Bus</span>
          <span className="text-2xl font-bold">{formatCents(booking.amount_due_cents)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>Personen</dt>
        <dd className="text-right">
          {booking.seats}
          {booking.free_persons > 0 && ` (davon ${booking.free_persons} gratis)`}
        </dd>
        <dt>Ticketpreis pro Person</dt>
        <dd className="text-right">{formatCents(booking.ticket_price_cents_snapshot)}</dd>
        <dt>Zahlart</dt>
        <dd className="text-right">{PAYMENT_TYPE_LABELS[booking.payment_type]}</dd>
        {booking.payment_type === "deposit" && booking.deposit_basis && booking.deposit_total_cents !== null && (
          <>
            <dt>Vereinbarte Anzahlung</dt>
            <dd className="text-right">
              {formatCents(booking.deposit_total_cents)} ({DEPOSIT_BASIS_LABELS[booking.deposit_basis]})
            </dd>
          </>
        )}
        <dt>Handy</dt>
        <dd className="text-right">{booking.customer_phone}</dd>
        {booking.customer_email && (
          <>
            <dt>E-Mail</dt>
            <dd className="text-right break-all">{booking.customer_email}</dd>
          </>
        )}
        <dt>Provision (beim Verkauf festgehalten)</dt>
        <dd className="text-right">
          {booking.paid_seats} × {formatCents(booking.commission_per_ticket_cents_snapshot)} ={" "}
          {formatCents(booking.commission_total_cents)}
        </dd>
        <dt>Verkauft</dt>
        <dd className="text-right">{formatMadrid(booking.sold_at)}</dd>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Zahlungsstatus</h2>
        {cancelled ? (
          <p className="text-sm">
            {PAYMENT_STATUS_LABELS[booking.payment_status]} — storniert, keine Änderung mehr möglich.
          </p>
        ) : (
          <StatusForm
            bookingId={booking.id}
            current={booking.payment_status}
            paymentType={booking.payment_type}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Verlauf</h2>
        <ul className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
          {((audit ?? []) as AuditRow[]).map((a) => (
            <li key={a.id}>
              {formatMadrid(a.created_at)} · {ACTION_LABELS[a.action] ?? a.action}
              {a.action === "payment_status_set" && a.old_values?.payment_status && a.new_values?.payment_status && (
                <>
                  {": "}
                  {PAYMENT_STATUS_LABELS[a.old_values.payment_status]} → {PAYMENT_STATUS_LABELS[a.new_values.payment_status]}
                </>
              )}
              {a.actor_role === "network_operator" && " (Gabo)"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
