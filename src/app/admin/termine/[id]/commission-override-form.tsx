"use client";

import { useActionState, useState } from "react";

import { INITIAL_FORM_STATE } from "@/lib/admin/types";
import { setDepartureCommission } from "../actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";

/** Neue Provisions-Ausnahme für diesen Termin (append-only) oder zurück zum Standard. */
export function CommissionOverrideForm({ departureId }: { departureId: string }) {
  const [state, formAction, pending] = useActionState(
    setDepartureCommission,
    INITIAL_FORM_STATE,
  );
  const [mode, setMode] = useState<"override" | "standard">("override");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="departure_id" value={departureId} />

      <div className="flex flex-col gap-1 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="override"
            checked={mode === "override"}
            onChange={() => setMode("override")}
          />
          Eigene Provision für diesen Termin
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="standard"
            checked={mode === "standard"}
            onChange={() => setMode("standard")}
          />
          Wieder Standard verwenden
        </label>
      </div>

      {mode === "override" && (
        <label className="flex flex-col gap-1 text-sm">
          Provision pro Ticket (Euro)
          <input
            name="commission_euro"
            type="text"
            inputMode="decimal"
            placeholder="z. B. 12,50"
            required
            className={inputClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Gültig ab (leer = sofort; Ortszeit Mallorca)
        <input name="valid_from" type="datetime-local" className={inputClass} />
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
        className="self-start rounded border border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-100"
      >
        {pending ? "Speichern …" : "Provisionsregel speichern"}
      </button>
    </form>
  );
}
