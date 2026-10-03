"use client";

import { useActionState } from "react";

import { setPaymentStatusAction } from "@/app/promoter/actions";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type PaymentType,
  type StatusFormState,
} from "@/lib/promoter/types";

const INITIAL: StatusFormState = { error: null, ok: null };

/**
 * E5.4: Zahlungsstatus in drei Stufen ändern (Marco 02.10.2026). „Anzahlung
 * erhalten" nur bei Zahlart Anzahlung. Jede Änderung schreibt die DB-Funktion
 * ins Audit-Log.
 */
export function StatusForm({
  bookingId,
  current,
  paymentType,
}: {
  bookingId: string;
  current: PaymentStatus;
  paymentType: PaymentType;
}) {
  const [state, formAction, pending] = useActionState(setPaymentStatusAction, INITIAL);
  const options = PAYMENT_STATUSES.filter((s) => paymentType === "deposit" || s !== "deposit_received");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      {options.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="submit"
            name="payment_status"
            value={s}
            disabled={pending || active}
            aria-pressed={active}
            className={
              active
                ? "w-full rounded bg-neutral-900 px-4 py-3 text-left font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "w-full rounded border border-neutral-300 px-4 py-3 text-left disabled:opacity-60 dark:border-neutral-700"
            }
          >
            {active ? "✓ " : ""}
            {PAYMENT_STATUS_LABELS[s]}
          </button>
        );
      })}
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.ok}
        </p>
      )}
    </form>
  );
}
