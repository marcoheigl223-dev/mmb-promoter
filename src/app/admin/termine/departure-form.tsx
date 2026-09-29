"use client";

import { useActionState } from "react";

import {
  DEPARTURE_STATUSES,
  INITIAL_FORM_STATE,
  STATUS_LABELS,
  type Departure,
  type FormState,
} from "@/lib/admin/types";
import { isoToMadridLocal } from "@/lib/admin/time";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Formular für Termin/Event — anlegen (initial = undefined) oder ändern.
 * Zeiten in Ortszeit Mallorca (Europe/Madrid), Umrechnung serverseitig.
 */
export function DepartureForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: Departure;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <label className="flex flex-col gap-1 text-sm">
        Titel
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
        Datum und Uhrzeit (Ortszeit Mallorca)
        <input
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={initial ? isoToMadridLocal(initial.starts_at) : ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Kontingent (Plätze für das Promoter-Netzwerk)
        <input
          name="capacity_total"
          type="number"
          inputMode="numeric"
          min={initial?.seats_booked_total ?? 0}
          step={1}
          required
          defaultValue={initial?.capacity_total ?? ""}
          className={inputClass}
        />
        {initial && initial.seats_booked_total > 0 && (
          <span className="text-xs text-neutral-500">
            Bereits gebucht: {initial.seats_booked_total} — darunter kann das Kontingent nicht
            gesenkt werden.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          name="status"
          defaultValue={initial?.status ?? "open"}
          className={inputClass}
        >
          {DEPARTURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="is_internal"
          type="checkbox"
          defaultChecked={initial?.is_internal ?? false}
        />
        Internes Event (nur im Promoter-Netzwerk, nie öffentlich)
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notiz (intern, nicht für Kunden)
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.note ?? ""}
          className={inputClass}
        />
      </label>

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
