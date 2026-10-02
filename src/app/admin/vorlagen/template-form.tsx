"use client";

import { useActionState } from "react";

import {
  INITIAL_FORM_STATE,
  type EventTemplate,
  type FormState,
  type PricingAmounts,
} from "@/lib/admin/types";
import { centsToInputValue, formatCents } from "@/lib/admin/money";
import { setTemplateActive } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";
const buttonClass =
  "self-start rounded border border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-100";

function Messages({ error, ok }: FormState) {
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

/**
 * Formular für eine Eventvorlage (E5.2) — anlegen (initial = undefined) oder
 * ändern. Datum/Uhrzeit gehören NICHT hierher: die kommen erst beim Anlegen
 * des Events aus der Vorlage. Beträge leer = beim Event gilt der Standard.
 */
export function TemplateForm({
  action,
  initial,
  submitLabel,
  standardPricing,
  standardCommission,
}: {
  action: Action;
  initial?: EventTemplate;
  submitLabel: string;
  standardPricing: PricingAmounts;
  standardCommission: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <label className="flex flex-col gap-1 text-sm">
        Name der Vorlage (nur für deine Liste)
        <input
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
          placeholder="z. B. Sunset-Tour Mittwoch"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Titel des Events (so heißt jeder daraus angelegte Termin)
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Kontingent (Plätze für das Promoter-Netzwerk)
        <input
          name="capacity_total"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          defaultValue={initial?.capacity_total ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input name="is_internal" type="checkbox" defaultChecked={initial?.is_internal ?? false} />
        Internes Event (nur im Promoter-Netzwerk, nie öffentlich)
      </label>

      <OptionalEuroField
        name="ticket_price_euro"
        label="Eigener Ticketpreis pro Person (Euro)"
        standard={standardPricing.ticket_price}
        value={initial?.ticket_price_cents ?? null}
        missingStandardHint="Es gibt noch keinen Standard-Ticketpreis — unter „Regeln“ eintragen."
      />

      <OptionalEuroField
        name="deposit_euro"
        label="Eigene Anzahlung pro Person (Euro)"
        standard={standardPricing.deposit}
        value={initial?.deposit_cents ?? null}
        missingStandardHint="Es gibt noch keine Standard-Anzahlung — unter „Regeln“ eintragen."
      />

      <OptionalEuroField
        name="commission_euro"
        label="Eigene Provision pro Ticket (Euro)"
        standard={standardCommission}
        value={initial?.commission_cents ?? null}
        missingStandardHint="Es gibt noch keine Standard-Provision — unter „Regeln“ eintragen."
      />

      <label className="flex flex-col gap-1 text-sm">
        Notiz (intern, wird ins Event übernommen)
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.note ?? ""}
          className={inputClass}
        />
      </label>

      <Messages error={state.error} ok={state.ok} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Speichern …" : submitLabel}
      </button>
    </form>
  );
}

/** Optionales Euro-Feld: leer = beim Event gilt der Standard. */
function OptionalEuroField({
  name,
  label,
  standard,
  value,
  missingStandardHint,
}: {
  name: string;
  label: string;
  standard: number | null;
  value: number | null;
  missingStandardHint: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={name}
        type="text"
        inputMode="decimal"
        placeholder={standard === null ? "z. B. 45,00" : `leer = Standard ${formatCents(standard)}`}
        defaultValue={value === null ? "" : centsToInputValue(value)}
        className={inputClass}
      />
      <span className="text-xs text-neutral-500">
        {standard === null
          ? missingStandardHint
          : `Leer lassen = Standard ${formatCents(standard)} (der beim Anlegen des Events gilt). Ein Wert hier wird für jedes Event aus dieser Vorlage als eigene Regel gespeichert.`}
      </span>
    </label>
  );
}

/** Deaktivieren/Aktivieren — es gibt kein Löschen (Herkunft bestehender Events bleibt nachvollziehbar). */
export function TemplateActiveForm({ template }: { template: EventTemplate }) {
  const [state, formAction, pending] = useActionState(setTemplateActive, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={template.id} />
      <input type="hidden" name="active" value={template.active ? "false" : "true"} />
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending
          ? "Speichern …"
          : template.active
            ? "Vorlage deaktivieren"
            : "Vorlage wieder aktivieren"}
      </button>
    </form>
  );
}
