-- 0011_sales_reporting_views.sql — Auswertung der Promoter-Verkäufe
-- (Etappe E5.5a, Auftrag Marco 03.10.2026)
--
-- Marco: „Provisionsbeträge immer aus dem gespeicherten Snapshot (nicht
-- nachträglich umgerechnet). Zahlen müssen stimmen (Geld!) — baue dafür
-- Tests, die die Summen gegen die Einzelverkäufe prüfen." Promoter sieht
-- „NUR seine eigenen Daten", Gabo (network_operator) alles.
--
-- Vier Sichten, eine Rechenstelle für beide Dashboards (E5.5b Promoter,
-- E5.5c Admin) — die App summiert nichts selbst:
--   * sales_totals        — eine Zeile: gesamt + heute + storniert
--   * sales_by_day        — pro Verkaufstag (Ortszeit Mallorca) → Diagramm
--   * sales_by_promoter   — pro Promoter → Abrechnung, Auswertung
--   * sales_by_departure  — pro Event → Umsatz, offene Restbeträge
--
-- Regeln (Ausgestaltung Claude, DECISIONS 03.10. E5.5):
--   * Nur channel = 'promoter'. Online-Buchungen gibt es in dieser DB nicht
--     (ADR-0001); sie würden hier auch nicht mitgezählt.
--   * Beträge NUR aus den Spalten der Buchung: total_amount_cents (Gesamtpreis
--     zum Verkaufszeitpunkt), amount_paid_cents (kassiert), amount_due_cents
--     (Rest im Bus, generiert), commission_total_cents (Provisions-Snapshot,
--     RISKS Nr. 21). Keine effective_*()-Funktion, keine aktuelle Regel —
--     eine spätere Regeländerung ändert keine Summe.
--   * Storniert (status cancelled/refunded) zählt NICHT in Umsatz, Tickets,
--     Provision; wird separat als Anzahl + Provisions-Snapshot ausgewiesen
--     („Storno, Provision ungeklärt", F10 offen — nichts verrechnet).
--   * „Heute" / Verkaufstag = Kalendertag in Europe/Madrid nach sold_at.
--   * Summen als bigint (Cent, ganze Zahlen; kein float).
--
-- Sicherheit: security_invoker = true → jede Sicht läuft mit den Rechten und
-- RLS-Policies des Aufrufers. Promoter: bookings_select_own_promoter
-- (is_active_profile() and promoter_id = auth.uid()) → nur eigene Verkäufe,
-- auch in Summen. network_operator: alles. Deaktiviert: nichts. anon: kein
-- Grant. Ohne security_invoker liefe die Sicht als Eigentümer (postgres) und
-- umginge RLS — deshalb ist die Option Pflicht und getestet.
--
-- Additiv (Hard Rule 1): keine Tabelle, keine Spalte, keine Funktion
-- geändert. Reserve-Funktionen unberührt (Hard Rule 4).

-- ---------------------------------------------------------------------------
-- sales_totals — eine Zeile (auch ohne Verkäufe: Nullen)
-- ---------------------------------------------------------------------------

create view sales_totals
  with (security_invoker = true)
as
select
  count(*) filter (where s.counted)::bigint                                        as sales_count,
  coalesce(sum(s.seats) filter (where s.counted), 0)::bigint                       as tickets,
  coalesce(sum(s.paid_seats) filter (where s.counted), 0)::bigint                  as paid_tickets,
  coalesce(sum(s.free_persons) filter (where s.counted), 0)::bigint                as free_tickets,
  coalesce(sum(s.total_amount_cents) filter (where s.counted), 0)::bigint          as revenue_cents,
  coalesce(sum(s.amount_paid_cents) filter (where s.counted), 0)::bigint           as collected_cents,
  coalesce(sum(s.amount_due_cents) filter (where s.counted), 0)::bigint            as due_cents,
  coalesce(sum(s.commission_total_cents) filter (where s.counted), 0)::bigint      as commission_cents,
  count(*) filter (where s.counted and s.is_today)::bigint                         as today_sales_count,
  coalesce(sum(s.seats) filter (where s.counted and s.is_today), 0)::bigint        as today_tickets,
  coalesce(sum(s.total_amount_cents) filter (where s.counted and s.is_today), 0)::bigint     as today_revenue_cents,
  coalesce(sum(s.amount_paid_cents) filter (where s.counted and s.is_today), 0)::bigint      as today_collected_cents,
  coalesce(sum(s.commission_total_cents) filter (where s.counted and s.is_today), 0)::bigint as today_commission_cents,
  count(*) filter (where not s.counted)::bigint                                    as cancelled_count,
  coalesce(sum(s.commission_total_cents) filter (where not s.counted), 0)::bigint  as cancelled_commission_cents,
  max(s.sold_at) filter (where s.counted)                                          as last_sale_at
from (
  select
    b.*,
    b.status not in ('cancelled', 'refunded') as counted,
    (b.sold_at at time zone 'Europe/Madrid')::date
      = (now() at time zone 'Europe/Madrid')::date as is_today
  from bookings b
  where b.channel = 'promoter'
) s;

comment on view sales_totals is
  'Promoter-Verkäufe gesamt/heute (Ortszeit Mallorca), nur aus gespeicherten Beträgen und Provisions-Snapshots. Storniert separat. security_invoker: Promoter sieht nur eigene Verkäufe (RLS), network_operator alle.';

-- ---------------------------------------------------------------------------
-- sales_by_day — pro Verkaufstag (Diagramm „Abschlüsse/Umsatz über Zeit")
-- ---------------------------------------------------------------------------

create view sales_by_day
  with (security_invoker = true)
as
select
  (b.sold_at at time zone 'Europe/Madrid')::date                                   as sale_day,
  count(*) filter (where b.status not in ('cancelled', 'refunded'))::bigint        as sales_count,
  coalesce(sum(b.seats) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint              as tickets,
  coalesce(sum(b.total_amount_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as revenue_cents,
  coalesce(sum(b.amount_paid_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint  as collected_cents,
  coalesce(sum(b.commission_total_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as commission_cents,
  count(*) filter (where b.status in ('cancelled', 'refunded'))::bigint            as cancelled_count
from bookings b
where b.channel = 'promoter'
group by 1;

comment on view sales_by_day is
  'Promoter-Verkäufe pro Kalendertag (Europe/Madrid, nach sold_at). Tage ohne Verkauf fehlen — die App füllt sie für das Diagramm mit 0. security_invoker (RLS des Aufrufers).';

-- ---------------------------------------------------------------------------
-- sales_by_promoter — pro Promoter (Abrechnung, wer wie viel verkauft/verdient)
-- ---------------------------------------------------------------------------

create view sales_by_promoter
  with (security_invoker = true)
as
select
  b.promoter_id,
  p.display_name,
  p.active                                                                         as promoter_active,
  count(*) filter (where b.status not in ('cancelled', 'refunded'))::bigint        as sales_count,
  coalesce(sum(b.seats) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint              as tickets,
  coalesce(sum(b.paid_seats) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint         as paid_tickets,
  coalesce(sum(b.total_amount_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as revenue_cents,
  coalesce(sum(b.amount_paid_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint  as collected_cents,
  coalesce(sum(b.amount_due_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint   as due_cents,
  coalesce(sum(b.commission_total_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as commission_cents,
  count(*) filter (where b.status not in ('cancelled', 'refunded')
    and (b.sold_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date)::bigint as today_sales_count,
  coalesce(sum(b.total_amount_cents) filter (where b.status not in ('cancelled', 'refunded')
    and (b.sold_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date), 0)::bigint as today_revenue_cents,
  coalesce(sum(b.commission_total_cents) filter (where b.status not in ('cancelled', 'refunded')
    and (b.sold_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date), 0)::bigint as today_commission_cents,
  count(*) filter (where b.status in ('cancelled', 'refunded'))::bigint            as cancelled_count,
  coalesce(sum(b.commission_total_cents) filter (where b.status in ('cancelled', 'refunded')), 0)::bigint as cancelled_commission_cents,
  max(b.sold_at) filter (where b.status not in ('cancelled', 'refunded'))          as last_sale_at
from bookings b
left join profiles p on p.id = b.promoter_id
where b.channel = 'promoter'
group by b.promoter_id, p.display_name, p.active;

comment on view sales_by_promoter is
  'Promoter-Verkäufe pro Promoter: Umsatz, kassiert, offen, Provision (nur Snapshots). security_invoker: Promoter sieht nur die eigene Zeile, network_operator alle.';

-- ---------------------------------------------------------------------------
-- sales_by_departure — pro Event (Umsatz, offene Restbeträge im Bus)
-- ---------------------------------------------------------------------------

create view sales_by_departure
  with (security_invoker = true)
as
select
  d.id                                                                             as departure_id,
  d.title,
  d.starts_at,
  d.status                                                                         as departure_status,
  d.is_internal,
  d.capacity_total,
  d.seats_booked_total,
  count(*) filter (where b.status not in ('cancelled', 'refunded'))::bigint        as sales_count,
  coalesce(sum(b.seats) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint              as tickets,
  coalesce(sum(b.total_amount_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as revenue_cents,
  coalesce(sum(b.amount_paid_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint  as collected_cents,
  coalesce(sum(b.amount_due_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint   as due_cents,
  coalesce(sum(b.commission_total_cents) filter (where b.status not in ('cancelled', 'refunded')), 0)::bigint as commission_cents,
  count(*) filter (where b.status in ('cancelled', 'refunded'))::bigint            as cancelled_count
from bookings b
join tour_departures d on d.id = b.departure_id
where b.channel = 'promoter'
group by d.id;

comment on view sales_by_departure is
  'Promoter-Verkäufe pro Event (nur Events mit mindestens einem Verkauf). capacity_total/seats_booked_total gelten für das ganze Netzwerk, die Summen nur für die sichtbaren Verkäufe (security_invoker: Promoter = eigene).';

-- ---------------------------------------------------------------------------
-- Rechte: nur lesen, nur angemeldet; anon und public nichts
-- ---------------------------------------------------------------------------

revoke all on sales_totals, sales_by_day, sales_by_promoter, sales_by_departure
  from public, anon, authenticated;
grant select on sales_totals, sales_by_day, sales_by_promoter, sales_by_departure
  to authenticated, service_role;
