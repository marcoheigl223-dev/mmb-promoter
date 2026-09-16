-- 0002_reserve_function_handover.sql — Reservierung + Freigabe, UNVERÄNDERT
-- übernommen aus docs/handover/reserve-function-final.sql (Zeilen 49–151).
-- Hard Rule 4: Das atomare UPDATE ist die Überbuchungssperre. Diese Datei wird
-- nie editiert; Erweiterungen (Kanal/Zahlungstyp/Promoter als Parameter, F12)
-- kommen als eigene, additive Migration ab Etappe E5.
-- Nachweis: `diff <(tail -n +49 docs/handover/reserve-function-final.sql) <(tail -n +8 supabase/migrations/0002_reserve_function_handover.sql)` ist leer.


-- === Reservierung ===========================================

CREATE OR REPLACE FUNCTION public.reserve_departure_seats(p_departure_id uuid, p_seats integer, p_total_amount_cents integer, p_amount_paid_cents integer, p_customer_name text, p_customer_email text, p_customer_phone text, p_stripe_payment_intent_id text, p_shuttle boolean, p_has_allergy boolean, p_allergy_details text)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_departure_id uuid;
  v_booking bookings;
begin
  if p_seats <= 0 then
    raise exception 'INVALID_SEATS';
  end if;

  if p_has_allergy and (p_allergy_details is null or length(trim(p_allergy_details)) = 0) then
    raise exception 'ALLERGY_DETAILS_REQUIRED';
  end if;

  -- Ein einziges Statement: Kapazitaetspruefung und Erhoehung des Zaehlers.
  -- Unveraendert gegenueber Migration 0001 bis auf die entfernten
  -- Promoter-Zweige.
  update tour_departures
  set seats_booked_total = seats_booked_total + p_seats
  where id = p_departure_id
    and status = 'open'
    and seats_booked_total + p_seats <= capacity_total
  returning id into v_departure_id;

  if v_departure_id is null then
    raise exception 'SOLD_OUT' using errcode = 'P0001';
  end if;

  -- channel/payment_type sind fest: dieses Projekt kennt nur den
  -- Online-Verkauf mit Vollzahlung. Der Wert wird weiterhin pro Buchung
  -- gespeichert, nicht weggelassen (Hard Rule 6b).
  insert into bookings (
    departure_id, channel, payment_type,
    seats, total_amount_cents, amount_paid_cents, status,
    stripe_payment_intent_id, customer_name, customer_email, customer_phone,
    shuttle, has_allergy, allergy_details
  ) values (
    p_departure_id, 'online'::booking_channel, 'full'::payment_type,
    p_seats, p_total_amount_cents, p_amount_paid_cents,
    'pending'::booking_status,
    p_stripe_payment_intent_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shuttle, p_has_allergy, p_allergy_details
  )
  returning * into v_booking;

  return v_booking;
end;
$function$

;

revoke execute on function reserve_departure_seats from public, anon, authenticated;
grant execute on function reserve_departure_seats to service_role;

-- === Gegenstück: Stornierung / Freigabe =====================

CREATE OR REPLACE FUNCTION public.release_departure_seats(p_booking_id uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_booking bookings;
begin
  select * into v_booking from bookings where id = p_booking_id for update;

  if v_booking is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status = 'cancelled' then
    return v_booking;
  end if;

  update tour_departures
  set seats_booked_total = seats_booked_total - v_booking.seats
  where id = v_booking.departure_id;

  update bookings
  set status = 'cancelled'
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$function$

;

revoke execute on function release_departure_seats from public, anon, authenticated;
grant execute on function release_departure_seats to service_role;

-- === Tatsächliche Rechte in der Quelldatenbank ==============
-- release_departure_seats: postgres=X/postgres service_role=X/postgres
-- reserve_departure_seats: postgres=X/postgres service_role=X/postgres
