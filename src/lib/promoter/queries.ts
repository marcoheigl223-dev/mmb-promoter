import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DepartureStatus } from "@/lib/admin/types";
import type { DepositBasis, PaymentStatus, PaymentType } from "./types";

/**
 * Lesezugriffe für den Promoter-Bereich (E5.4) — immer über den RLS-Client
 * des angemeldeten Promoters. Policies: Termine sehen alle aktiven Profile
 * (auch interne, Entscheidung 3 vom 02.10.2026); Buchungen nur die eigenen.
 */

export type SaleDeparture = {
  id: string;
  title: string;
  starts_at: string;
  capacity_total: number;
  seats_booked_total: number;
  status: DepartureStatus;
  is_internal: boolean;
  image_path: string | null;
};

const DEPARTURE_COLUMNS =
  "id, title, starts_at, capacity_total, seats_booked_total, status, is_internal, image_path";

/** Kommende offene Events, nach Startzeit. */
export async function listSellableDepartures(): Promise<SaleDeparture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .select(DEPARTURE_COLUMNS)
    .eq("status", "open")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`Events laden fehlgeschlagen: ${error.message}`);
  return (data ?? []) as SaleDeparture[];
}

export async function getSaleDeparture(id: string): Promise<SaleDeparture | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .select(DEPARTURE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Event laden fehlgeschlagen: ${error.message}`);
  return (data as SaleDeparture | null) ?? null;
}

export type PromoterBooking = {
  id: string;
  departure_id: string;
  status: string;
  seats: number;
  paid_seats: number;
  free_persons: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  payment_type: PaymentType;
  deposit_basis: DepositBasis | null;
  deposit_total_cents: number | null;
  total_amount_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  payment_status: PaymentStatus;
  ticket_price_cents_snapshot: number;
  commission_per_ticket_cents_snapshot: number;
  commission_total_cents: number;
  sold_at: string;
  tour_departures: { title: string; starts_at: string; is_internal: boolean } | null;
};

const BOOKING_COLUMNS =
  "id, departure_id, status, seats, paid_seats, free_persons, customer_name, customer_phone, customer_email, payment_type, deposit_basis, deposit_total_cents, total_amount_cents, amount_paid_cents, amount_due_cents, payment_status, ticket_price_cents_snapshot, commission_per_ticket_cents_snapshot, commission_total_cents, sold_at, tour_departures(title, starts_at, is_internal)";

/** Eigene Verkäufe, neueste zuerst (RLS: promoter_id = auth.uid()). */
export async function listOwnBookings(limit = 20): Promise<PromoterBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("channel", "promoter")
    .order("sold_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Verkäufe laden fehlgeschlagen: ${error.message}`);
  return (data ?? []) as unknown as PromoterBooking[];
}

export async function getOwnBooking(id: string): Promise<PromoterBooking | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", id)
    .eq("channel", "promoter")
    .maybeSingle();
  if (error) throw new Error(`Verkauf laden fehlgeschlagen: ${error.message}`);
  return (data as unknown as PromoterBooking | null) ?? null;
}
