-- 0009_payment_status_not_collected.sql — dritte Zahlungsstufe „noch nichts kassiert"
-- (Etappe E5.4, Entscheidung Marco 02.10.2026, F22/F23)
--
-- Marco: Der Zahlungsstatus einer Buchung hat drei Stufen — „noch nichts
-- kassiert" → „Anzahlung erhalten" → „voll bezahlt". Storno ist separat
-- (bookings.status), nicht Teil dieser Kette.
--
-- Eigene Migration NUR für den Enum-Wert: Postgres erlaubt, einen mit
-- ALTER TYPE … ADD VALUE angelegten Wert erst nach dem COMMIT zu benutzen.
-- Der Check und die Funktionen, die 'not_collected' verwenden, stehen deshalb
-- in 0010 (eigene Transaktion). Additiv (Hard Rule 1), 0001–0008 unberührt,
-- Reserve-Funktion aus 0002 unberührt (Hard Rule 4).

alter type payment_status add value 'not_collected' before 'deposit_received';

comment on type payment_status is
  'Was der Promoter kassiert hat (manuell markiert, Entscheidung Marco 02.10.2026): not_collected = noch nichts kassiert; deposit_received = Anzahlung erhalten, Rest offen; fully_paid = voll bezahlt. Storno ist bookings.status, nicht Teil dieser Kette.';
