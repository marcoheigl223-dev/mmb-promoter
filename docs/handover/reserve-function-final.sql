-- reserve-function-final.sql — eingefrorene, promoter-freie Fassung der
-- Sitzplatz-Reservierung von MyMallorcaBoats.
--
-- ZWECK: Übergabe-Artefakt für das getrennte Promoter-/Vertriebsprojekt
-- (docs/DECISIONS.md, Eintrag vom 14.09.2026). Die beiden Projekte teilen
-- ausdrücklich KEINE Daten — die Wiederverwendung läuft über genau diese
-- versionierte SQL-Datei. Das Promoter-Projekt legt sie in seiner eigenen
-- Datenbank an und ergänzt dort seine eigenen Kanal-/Kontingent-Spalten.
--
-- DAS HIER IST KEINE MIGRATION. Nicht ausführen, um das Boots-Schema zu
-- ändern — der verbindliche Stand sind web/supabase/migrations/*.sql.
-- Diese Datei ist eine Kopie des Ergebnisses, erzeugt aus der laufenden
-- Datenbank, damit das andere Projekt nicht die Migrationskette nachspielen
-- muss.
--
-- WAS MAN BEIM ÜBERNEHMEN NICHT KAPUTTMACHEN DARF
-- ------------------------------------------------
-- Die Überbuchungssperre ist das eine Statement
--     update tour_departures
--     set seats_booked_total = seats_booked_total + p_seats
--     where id = p_departure_id
--       and status = 'open'
--       and seats_booked_total + p_seats <= capacity_total
--     returning id into v_departure_id;
-- Prüfung und Erhöhung passieren im selben UPDATE. Postgres serialisiert
-- konkurrierende UPDATEs auf dieselbe Zeile über das normale Row-Locking;
-- eine zweite Anfrage auf den letzten Platz sieht den bereits erhöhten
-- Zähler, trifft 0 Zeilen und bekommt SOLD_OUT. Es gibt bewusst KEIN
-- vorgelagertes SELECT, kein SELECT ... FOR UPDATE und kein Locking in der
-- Anwendung — jede dieser "Verbesserungen" öffnet das Zeitfenster zwischen
-- Prüfen und Schreiben wieder, das hier gerade nicht existiert.
--
-- Wer das im Promoter-Projekt um ein eigenes Kontingent erweitert, hängt die
-- zusätzliche Bedingung in DIESELBE WHERE-Klausel (so war es hier bis
-- Migration 0004) — niemals als zweites Statement davor.
--
-- SECURITY DEFINER + `set search_path = public` und die Rechte-Zeilen am Ende
-- gehören zur Funktion: nur der Server mit Service-Role darf reservieren,
-- niemals anon/authenticated (docs/DECISIONS.md, 01.09.2026).
--
-- Nachweis für diesen Stand: 8 parallele Reservierungen auf 1 freien Platz
-- ergeben 1x Erfolg und 7x SOLD_OUT, seats_booked_total bleibt 1 von 1
-- (web/scripts/test-shared-inventory.mjs, web/scripts/test-booking-api-concurrency.mjs).
--
-- Erzeugt am: 2026-09-15 aus der laufenden lokalen Datenbank
-- Quelle: PostgreSQL 17.6 on x86_64-pc-linux-gnu
-- Migrationsstand: 0001_shared_inventory.sql 0002_booking_shuttle_allergy.sql 0003_admin_roles_audit.sql 0004_reserve_online_only.sql 0005_drop_promoter_columns.sql 0006_restore_reserve_comment.sql 
-- Reproduzieren: bash scripts/gen-final-ddl.sh (aus dem Ordner web/)

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
