"use client";

import { useActionState } from "react";

import { INITIAL_FORM_STATE, type PricingKind } from "@/lib/admin/types";
import { setGroupRule, setStandardCommission, setStandardPricing } from "./actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";
const buttonClass =
  "self-start rounded border border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-100";

function Messages({ error, ok }: { error: string | null; ok: string | null }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {ok}
        </p>
      )}
    </>
  );
}

/** Neuer Provisions-Standard (append-only). */
export function StandardCommissionForm({ currentInput }: { currentInput: string }) {
  const [state, formAction, pending] = useActionState(
    setStandardCommission,
    INITIAL_FORM_STATE,
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Neuer Standard pro Ticket (Euro)
        <input
          name="commission_euro"
          type="text"
          inputMode="decimal"
          required
          defaultValue={currentInput}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Gültig ab (leer = sofort; Ortszeit Mallorca)
        <input name="valid_from" type="datetime-local" className={inputClass} />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : "Neuen Standard speichern"}
      </button>
    </form>
  );
}

/** Neue Gruppenregel (append-only). */
export function GroupRuleForm({
  currentThreshold,
  currentFree,
}: {
  currentThreshold: number | null;
  currentFree: number | null;
}) {
  const [state, formAction, pending] = useActionState(setGroupRule, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Ab wie vielen Personen greift die Regel?
        <input
          name="threshold_persons"
          type="number"
          min={2}
          step={1}
          required
          defaultValue={currentThreshold ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Wie viele Personen sind dann gratis?
        <input
          name="free_persons"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={currentFree ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Gültig ab (leer = sofort; Ortszeit Mallorca)
        <input name="valid_from" type="datetime-local" className={inputClass} />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : "Neue Gruppenregel speichern"}
      </button>
    </form>
  );
}

/** Neuer Standard für Ticketpreis oder Anzahlung pro Person (append-only, F14). */
export function StandardPricingForm({
  kind,
  currentInput,
}: {
  kind: PricingKind;
  currentInput: string;
}) {
  const [state, formAction, pending] = useActionState(setStandardPricing, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <label className="flex flex-col gap-1 text-sm">
        Neuer Standard pro Person (Euro)
        <input
          name="amount_euro"
          type="text"
          inputMode="decimal"
          required
          defaultValue={currentInput}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Gültig ab (leer = sofort; Ortszeit Mallorca)
        <input name="valid_from" type="datetime-local" className={inputClass} />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : "Neuen Standard speichern"}
      </button>
    </form>
  );
}
