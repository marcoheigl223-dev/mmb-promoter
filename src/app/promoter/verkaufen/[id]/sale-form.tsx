"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { formatCents } from "@/lib/admin/money";
import { previewSaleAction, saleAction } from "@/app/promoter/actions";
import { MAX_SEATS_PER_SALE, SALE_FIELDS } from "@/lib/promoter/sale";
import {
  DEPOSIT_BASES,
  DEPOSIT_BASIS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type SaleFormState,
  type SalePreview,
  type SaleQuote,
} from "@/lib/promoter/types";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";
const primaryButton =
  "w-full rounded bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900";
const secondaryButton =
  "w-full rounded border border-neutral-300 px-4 py-3 text-base font-medium disabled:opacity-60 dark:border-neutral-700";
const stepperButton =
  "w-14 shrink-0 rounded border border-neutral-300 text-2xl leading-none disabled:opacity-40 dark:border-neutral-700";

/**
 * E5.4: Verkauf eines Promoters für einen Kunden — zwei Schritte in einem
 * Formular-Zustand: Eingabe (mit Live-Übersicht der Beträge) → Bestätigung mit
 * ausgeschriebenen Beträgen → Verkauf. Alle Beträge aus quote_promoter_sale(),
 * nie im Browser gerechnet. Ohne JavaScript erscheinen sie im Bestätigungsschritt.
 */
export function SaleForm({ departureId }: { departureId: string }) {
  const initial: SaleFormState = {
    step: "input",
    error: null,
    fields: { departure_id: departureId, seats: "1", payment_type: "deposit", deposit_basis: "paying_persons" },
    quote: null,
    key: null,
  };
  const [state, formAction, pending] = useActionState(saleAction, initial);

  return state.step === "confirm" && state.quote && state.key ? (
    <ConfirmStep state={state} quote={state.quote} formAction={formAction} pending={pending} />
  ) : (
    <InputStep state={state} formAction={formAction} pending={pending} />
  );
}

function InputStep({
  state,
  formAction,
  pending,
}: {
  state: SaleFormState;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const f = state.fields;
  const [seats, setSeats] = useState(f.seats || "1");
  const [paymentType, setPaymentType] = useState(f.payment_type || "deposit");
  const [basis, setBasis] = useState(f.deposit_basis || "paying_persons");
  const [customDeposit, setCustomDeposit] = useState(f.custom_deposit ?? "");

  // Live-Übersicht (Marco 03.10.2026): bei jeder Änderung kurz entprellt neu
  // aus der DB rechnen lassen. Das Ergebnis trägt den Schlüssel der Eingaben,
  // aus denen es stammt — passt er nicht mehr, wird die Anzeige gedimmt.
  const inputKey = JSON.stringify({
    departure_id: f.departure_id,
    seats: seats.trim(),
    payment_type: paymentType,
    deposit_basis: paymentType === "deposit" ? basis : "",
    custom_deposit: paymentType === "deposit" && basis === "custom_total" ? customDeposit.trim() : "",
  });
  const [preview, setPreview] = useState<{ key: string; result: SalePreview } | null>(null);
  const latestKey = useRef("");

  useEffect(() => {
    latestKey.current = inputKey;
    const timer = setTimeout(() => {
      previewSaleAction(JSON.parse(inputKey) as Record<string, string>)
        .then((result) => {
          if (latestKey.current === inputKey) setPreview({ key: inputKey, result });
        })
        .catch(() => {
          if (latestKey.current !== inputKey) return;
          setPreview({
            key: inputKey,
            result: {
              quote: null,
              depositOpen: false,
              error: "Beträge konnten nicht berechnet werden — Verbindung prüfen.",
            },
          });
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [inputKey]);

  const seatsNumber = /^\d+$/.test(seats.trim()) ? Number(seats.trim()) : null;
  const stepSeats = (delta: number) => {
    setSeats(String(Math.min(MAX_SEATS_PER_SALE, Math.max(1, (seatsNumber ?? 0) + delta))));
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="departure_id" value={f.departure_id} />

      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="sale-seats">Personen (Tickets)</label>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => stepSeats(-1)}
            disabled={seatsNumber !== null && seatsNumber <= 1}
            aria-label="Eine Person weniger"
            className={stepperButton}
          >
            −
          </button>
          <input
            id="sale-seats"
            name="seats"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SEATS_PER_SALE}
            step={1}
            required
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className={`${inputClass} min-w-0 flex-1 text-center text-lg`}
          />
          <button
            type="button"
            onClick={() => stepSeats(1)}
            disabled={seatsNumber !== null && seatsNumber >= MAX_SEATS_PER_SALE}
            aria-label="Eine Person mehr"
            className={stepperButton}
          >
            +
          </button>
        </div>
        <span className="text-xs text-neutral-500">
          Gratisplätze nach der Gruppenregel werden automatisch abgezogen.
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">Zahlart</legend>
        {(["deposit", "full"] as const).map((t) => (
          <label
            key={t}
            className="flex items-center gap-3 rounded border border-neutral-300 px-3 py-3 dark:border-neutral-700"
          >
            <input
              type="radio"
              name="payment_type"
              value={t}
              checked={paymentType === t}
              onChange={() => setPaymentType(t)}
              className="h-5 w-5"
            />
            <span>{PAYMENT_TYPE_LABELS[t]}</span>
          </label>
        ))}
      </fieldset>

      {paymentType === "deposit" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm">Anzahlung berechnen</legend>
          {DEPOSIT_BASES.map((b) => (
            <label
              key={b}
              className="flex items-center gap-3 rounded border border-neutral-300 px-3 py-3 dark:border-neutral-700"
            >
              <input
                type="radio"
                name="deposit_basis"
                value={b}
                checked={basis === b}
                onChange={() => setBasis(b)}
                className="h-5 w-5"
              />
              <span>{DEPOSIT_BASIS_LABELS[b]}</span>
            </label>
          ))}
          {basis === "custom_total" && (
            <label className="flex flex-col gap-1 text-sm">
              Anzahlung gesamt (€)
              <input
                name="custom_deposit"
                type="text"
                inputMode="decimal"
                placeholder="z. B. 50,00"
                value={customDeposit}
                onChange={(e) => setCustomDeposit(e.target.value)}
                className={inputClass}
              />
              <span className="text-xs text-neutral-500">
                Muss unter dem Gesamtpreis liegen — sonst „Vollzahler“ wählen.
              </span>
            </label>
          )}
        </fieldset>
      )}

      <SaleSummary
        preview={preview?.result ?? null}
        stale={preview !== null && preview.key !== inputKey}
        isDeposit={paymentType === "deposit"}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Kundendaten</legend>
        <p className="-mt-1 text-xs text-neutral-500">
          Name und Handynummer sind bei jedem Verkauf Pflicht — auch bei Vollzahlern.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Name <span aria-hidden="true">*</span>
          </span>
          <input
            name="customer_name"
            type="text"
            autoComplete="off"
            required
            maxLength={200}
            defaultValue={f.customer_name ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Handynummer <span aria-hidden="true">*</span>
          </span>
          <input
            name="customer_phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            maxLength={40}
            placeholder="+34 …"
            defaultValue={f.customer_phone ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          E-Mail (optional)
          <input
            name="customer_email"
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={254}
            defaultValue={f.customer_email ?? ""}
            className={inputClass}
          />
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" name="intent" value="quote" disabled={pending} className={primaryButton}>
        {pending ? "Berechnen …" : "Weiter zur Bestätigung"}
      </button>
    </form>
  );
}

function seatsAvailableMessage(available: number): string {
  if (available === 0) return "Für dieses Event sind keine Plätze mehr frei.";
  if (available === 1) return "Nur noch 1 Platz frei.";
  return `Nur noch ${available} Plätze frei.`;
}

/**
 * Live-Übersicht im Eingabeschritt: Gesamtpreis, Anzahlung jetzt, Rest im Bus.
 * Alle Beträge kommen aus quote_promoter_sale() (previewSaleAction).
 */
function SaleSummary({
  preview,
  stale,
  isDeposit,
}: {
  preview: SalePreview | null;
  stale: boolean;
  isDeposit: boolean;
}) {
  const box =
    "flex flex-col gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900";
  const heading = <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Beträge</h2>;
  const quote = preview?.quote ?? null;

  if (!preview) {
    return (
      <section aria-label="Beträge" className={box}>
        {heading}
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Die Beträge erscheinen hier, sobald Personen und Zahlart gewählt sind — spätestens nach „Weiter zur
          Bestätigung“.
        </p>
      </section>
    );
  }

  if (!quote) {
    return (
      <section aria-label="Beträge" aria-live="polite" className={`${box} ${stale ? "opacity-60" : ""}`}>
        {heading}
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {preview.error}
        </p>
      </section>
    );
  }

  const depositOpen = preview.depositOpen;
  let depositFactor: string | null = null;
  if (isDeposit && !depositOpen) {
    if (quote.deposit_basis === "custom_total") depositFactor = "freier Betrag";
    else if (quote.deposit_per_person_cents !== null) {
      const persons = quote.deposit_basis === "all_persons" ? quote.seats : quote.paid_seats;
      depositFactor = `${persons} × ${formatCents(quote.deposit_per_person_cents)}`;
    }
  }

  return (
    <section
      aria-label="Beträge"
      aria-live="polite"
      aria-busy={stale}
      className={`${box} transition-opacity ${stale ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-4">
        {heading}
        {stale && <span className="text-xs text-neutral-500">wird berechnet …</span>}
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>Personen</dt>
        <dd className="text-right tabular-nums">{quote.seats}</dd>
        {quote.free_persons > 0 && (
          <>
            <dt className="text-neutral-600 dark:text-neutral-400">
              davon gratis (je {quote.group_threshold} Personen {quote.group_free} gratis)
            </dt>
            <dd className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
              − {quote.free_persons}
            </dd>
          </>
        )}
        <dt>Ticketpreis pro Person</dt>
        <dd className="text-right tabular-nums">{formatCents(quote.ticket_price_cents)}</dd>
      </dl>

      <div className="flex items-baseline justify-between gap-4 border-t border-neutral-300 pt-3 dark:border-neutral-700">
        <div className="flex flex-col">
          <span className="font-semibold">Gesamtpreis</span>
          <span className="text-xs tabular-nums text-neutral-500">
            {quote.paid_seats} × {formatCents(quote.ticket_price_cents)}
          </span>
        </div>
        <span className="text-xl font-semibold tabular-nums">{formatCents(quote.total_amount_cents)}</span>
      </div>

      <div className="flex flex-col gap-2 rounded border-2 border-neutral-900 bg-white p-3 dark:border-neutral-100 dark:bg-neutral-950">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-semibold">{isDeposit ? "Anzahlung jetzt" : "Jetzt kassieren (Vollzahlung)"}</span>
            {depositFactor && <span className="text-xs tabular-nums text-neutral-500">{depositFactor}</span>}
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {depositOpen ? "—" : formatCents(quote.amount_paid_cents)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span>Restbetrag im Bus</span>
          <span className="text-xl font-semibold tabular-nums">
            {depositOpen ? "—" : formatCents(quote.amount_due_cents)}
          </span>
        </div>
      </div>

      {depositOpen && preview.error && (
        <p className="text-sm text-amber-800 dark:text-amber-300">{preview.error}</p>
      )}

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-xs text-neutral-600 dark:text-neutral-400">
        <dt>Deine Provision</dt>
        <dd className="text-right tabular-nums">
          {quote.paid_seats} × {formatCents(quote.commission_per_ticket_cents)} ={" "}
          {formatCents(quote.commission_total_cents)}
        </dd>
      </dl>

      {quote.seats_available < quote.seats && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {seatsAvailableMessage(quote.seats_available)}
        </p>
      )}
    </section>
  );
}

function ConfirmStep({
  state,
  quote,
  formAction,
  pending,
}: {
  state: SaleFormState;
  quote: SaleQuote;
  formAction: (fd: FormData) => void;
  pending: boolean;
}) {
  const f = state.fields;
  const isDeposit = f.payment_type === "deposit";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {SALE_FIELDS.map((name) => (
        <input key={name} type="hidden" name={name} value={f[name] ?? ""} />
      ))}
      <input type="hidden" name="idempotency_key" value={state.key ?? ""} />
      <input type="hidden" name="expected_total_cents" value={quote.total_amount_cents} />
      <input type="hidden" name="expected_amount_paid_cents" value={quote.amount_paid_cents} />

      <h2 className="text-lg font-semibold">Bitte mit dem Kunden prüfen</h2>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-base">
        <dt>Personen</dt>
        <dd className="text-right">{quote.seats}</dd>
        {quote.free_persons > 0 && (
          <>
            <dt>
              davon gratis (Gruppenregel: je {quote.group_threshold} Personen {quote.group_free} gratis)
            </dt>
            <dd className="text-right">{quote.free_persons}</dd>
          </>
        )}
        <dt>Ticketpreis pro Person</dt>
        <dd className="text-right">{formatCents(quote.ticket_price_cents)}</dd>
        <dt className="font-semibold">Gesamtpreis</dt>
        <dd className="text-right font-semibold">
          {quote.paid_seats} × {formatCents(quote.ticket_price_cents)} = {formatCents(quote.total_amount_cents)}
        </dd>
        <dt>Zahlart</dt>
        <dd className="text-right">{PAYMENT_TYPE_LABELS[isDeposit ? "deposit" : "full"]}</dd>
        {isDeposit && quote.deposit_basis && (
          <>
            <dt>Anzahlung</dt>
            <dd className="text-right">{DEPOSIT_BASIS_LABELS[quote.deposit_basis]}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-2 rounded border-2 border-neutral-900 p-4 dark:border-neutral-100">
        <div className="flex items-baseline justify-between gap-4">
          <span>Jetzt kassieren</span>
          <span className="text-2xl font-bold">{formatCents(quote.amount_paid_cents)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span>Rest im Bus</span>
          <span className="text-xl font-semibold">{formatCents(quote.amount_due_cents)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <dt>Kunde</dt>
        <dd className="text-right">{f.customer_name}</dd>
        <dt>Handy</dt>
        <dd className="text-right">{f.customer_phone}</dd>
        {f.customer_email && (
          <>
            <dt>E-Mail</dt>
            <dd className="text-right break-all">{f.customer_email}</dd>
          </>
        )}
        <dt>Deine Provision</dt>
        <dd className="text-right">
          {quote.paid_seats} × {formatCents(quote.commission_per_ticket_cents)} = {formatCents(quote.commission_total_cents)}
        </dd>
        <dt>Zahlungsstatus nach Verkauf</dt>
        <dd className="text-right">{PAYMENT_STATUS_LABELS[quote.payment_status]}</dd>
        <dt>Noch frei</dt>
        <dd className="text-right">{quote.seats_available} Plätze</dd>
      </dl>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" name="intent" value="confirm" disabled={pending} className={primaryButton}>
        {pending ? "Verkaufen …" : `Verkauf bestätigen · ${formatCents(quote.amount_paid_cents)} kassiert`}
      </button>
      <button type="submit" name="intent" value="edit" disabled={pending} className={secondaryButton}>
        Ändern
      </button>
    </form>
  );
}
