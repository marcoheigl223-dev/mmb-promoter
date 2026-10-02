"use client";

import { useActionState } from "react";

import {
  DEPARTURE_STATUSES,
  INITIAL_FORM_STATE,
  STATUS_LABELS,
  type EventTemplate,
} from "@/lib/admin/types";
import { createDepartureFromTemplate } from "./actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";

/**
 * E5.2: Event aus Vorlage — Gabo gibt nur Datum/Uhrzeit (und den Status) an,
 * alles andere kommt aus der Vorlage (Anzeige daneben auf der Seite).
 */
export function FromTemplateForm({ template }: { template: EventTemplate }) {
  const [state, formAction, pending] = useActionState(
    createDepartureFromTemplate,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="template_id" value={template.id} />

      <label className="flex flex-col gap-1 text-sm">
        Datum und Uhrzeit (Ortszeit Mallorca)
        <input name="starts_at" type="datetime-local" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select name="status" defaultValue="open" className={inputClass}>
          {DEPARTURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Anlegen …" : "Event aus Vorlage anlegen"}
      </button>
    </form>
  );
}
