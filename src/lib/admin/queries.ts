import "server-only";

import { createClient } from "@/lib/supabase/server";
import { activeOverrideCents } from "./pricing";
import {
  PRICING_KINDS,
  type CommissionRule,
  type Departure,
  type GroupRule,
  type PricingAmounts,
  type PricingKind,
  type PricingRule,
} from "./types";

/**
 * Lesezugriffe für den Admin-Bereich — immer über den RLS-geschützten Client
 * des angemeldeten Nutzers (nie service_role). Die Policies aus 0003/0004
 * entscheiden, was sichtbar ist; die Seiten rufen zusätzlich requireArea().
 */

const DEPARTURE_COLUMNS =
  "id, title, starts_at, capacity_total, seats_booked_total, status, is_internal, note, created_at";

export async function listDepartures(): Promise<Departure[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .select(DEPARTURE_COLUMNS)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`Termine konnten nicht gelesen werden: ${error.message}`);
  return (data ?? []) as Departure[];
}

export async function getDeparture(id: string): Promise<Departure | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .select(DEPARTURE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Termin konnte nicht gelesen werden: ${error.message}`);
  return (data as Departure | null) ?? null;
}

/** Historie der Provisionsregeln: departureId = null → Standard, sonst Ausnahmen des Termins. Jüngste zuerst. */
export async function listCommissionRules(
  departureId: string | null,
): Promise<CommissionRule[]> {
  const supabase = await createClient();
  let query = supabase
    .from("commission_rules")
    .select("id, departure_id, commission_cents, valid_from, created_at, created_by")
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });
  query = departureId === null ? query.is("departure_id", null) : query.eq("departure_id", departureId);
  const { data, error } = await query;
  if (error) throw new Error(`Provisionsregeln konnten nicht gelesen werden: ${error.message}`);
  return (data ?? []) as CommissionRule[];
}

export async function listGroupRules(): Promise<GroupRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_rules")
    .select("id, threshold_persons, free_persons, valid_from, created_at, created_by")
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gruppenregeln konnten nicht gelesen werden: ${error.message}`);
  return (data ?? []) as GroupRule[];
}

/** Jetzt gültige Provision in Cent (DB-Funktion aus 0004). departureId = null → Standard. */
export async function effectiveCommissionCents(
  departureId: string | null,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("effective_commission_cents", {
    p_departure_id: departureId,
  });
  if (error) throw new Error(`Gültige Provision konnte nicht gelesen werden: ${error.message}`);
  return (data as number | null) ?? null;
}

/** Jetzt gültige Gruppenregel (DB-Funktion aus 0004). */
export async function effectiveGroupRule(): Promise<Pick<
  GroupRule,
  "threshold_persons" | "free_persons"
> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("effective_group_rule");
  if (error) throw new Error(`Gültige Gruppenregel konnte nicht gelesen werden: ${error.message}`);
  const rows = (data ?? []) as Pick<GroupRule, "threshold_persons" | "free_persons">[];
  return rows[0] ?? null;
}

/**
 * Ableitungen mit "jetzt" gehören hierher, nicht in die Render-Funktion
 * (React-Regel: Komponenten sind pur, Date.now() dort verboten).
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Termine getrennt: kommende (ab gestern, aufsteigend) und vergangene (absteigend). */
export async function listDeparturesSplit(): Promise<{
  upcoming: Departure[];
  past: Departure[];
}> {
  const all = await listDepartures();
  const cutoff = Date.now() - ONE_DAY_MS;
  const upcoming = all.filter((d) => new Date(d.starts_at).getTime() >= cutoff);
  const past = all.filter((d) => new Date(d.starts_at).getTime() < cutoff).reverse();
  return { upcoming, past };
}

/** Provisionslage eines Termins: gültiger Wert, Standard, Ausnahme-Historie, ob eine Ausnahme greift. */
export async function departureCommissionSummary(departureId: string): Promise<{
  overrides: CommissionRule[];
  effective: number | null;
  standard: number | null;
  usesOverride: boolean;
}> {
  const [overrides, effective, standard] = await Promise.all([
    listCommissionRules(departureId),
    effectiveCommissionCents(departureId),
    effectiveCommissionCents(null),
  ]);
  const now = Date.now();
  const active = overrides.find((r) => new Date(r.valid_from).getTime() <= now);
  return {
    overrides,
    effective,
    standard,
    usesOverride: active !== undefined && active.commission_cents !== null,
  };
}

// ---------------------------------------------------------------------------
// Preis und Anzahlung pro Person (F14, Migration 0005) — gleiches Muster wie Provision
// ---------------------------------------------------------------------------

const PRICING_COLUMNS = "id, kind, departure_id, amount_cents, valid_from, created_at, created_by";

/** Historie einer Art: departureId = null → Standard, sonst Ausnahmen des Termins. Jüngste zuerst. */
export async function listPricingRules(
  kind: PricingKind,
  departureId: string | null,
): Promise<PricingRule[]> {
  const supabase = await createClient();
  let query = supabase
    .from("pricing_rules")
    .select(PRICING_COLUMNS)
    .eq("kind", kind)
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false });
  query = departureId === null ? query.is("departure_id", null) : query.eq("departure_id", departureId);
  const { data, error } = await query;
  if (error) throw new Error(`Preisregeln konnten nicht gelesen werden: ${error.message}`);
  return (data ?? []) as PricingRule[];
}

/** Jetzt gültiger Betrag in Cent (DB-Funktion aus 0005). departureId = null → Standard. */
export async function effectivePriceCents(
  kind: PricingKind,
  departureId: string | null,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("effective_price_cents", {
    p_kind: kind,
    p_departure_id: departureId,
  });
  if (error) throw new Error(`Gültiger Betrag (${kind}) konnte nicht gelesen werden: ${error.message}`);
  return (data as number | null) ?? null;
}

/** Beide Standardwerte (Ticketpreis, Anzahlung) — für Formulare und /admin/regeln. */
export async function standardPricing(): Promise<PricingAmounts> {
  const [ticket_price, deposit] = await Promise.all(
    PRICING_KINDS.map((k) => effectivePriceCents(k, null)),
  );
  return { ticket_price: ticket_price ?? null, deposit: deposit ?? null };
}

/** Aktive Ausnahme-Beträge eines Termins (null = Standard gilt) — Grundlage für planPricingWrites(). */
export async function activePricingOverrides(departureId: string): Promise<PricingAmounts> {
  const [price, deposit] = await Promise.all(
    PRICING_KINDS.map((k) => listPricingRules(k, departureId)),
  );
  return {
    ticket_price: activeOverrideCents(price),
    deposit: activeOverrideCents(deposit),
  };
}

/** Preislage eines Termins: gültige Werte, Standard, aktive Ausnahmen, Historie beider Arten. */
export async function departurePricingSummary(departureId: string): Promise<{
  effective: PricingAmounts;
  standard: PricingAmounts;
  override: PricingAmounts;
  history: PricingRule[];
}> {
  const [effPrice, effDeposit, standard, priceRules, depositRules] = await Promise.all([
    effectivePriceCents("ticket_price", departureId),
    effectivePriceCents("deposit", departureId),
    standardPricing(),
    listPricingRules("ticket_price", departureId),
    listPricingRules("deposit", departureId),
  ]);
  const history = [...priceRules, ...depositRules].sort((a, b) => {
    const byValid = new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
    return byValid !== 0 ? byValid : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return {
    effective: { ticket_price: effPrice, deposit: effDeposit },
    standard,
    override: {
      ticket_price: activeOverrideCents(priceRules),
      deposit: activeOverrideCents(depositRules),
    },
    history,
  };
}
