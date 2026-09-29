-- 0003_profiles_roles.sql — Profile, Rollen, RLS deny-by-default (Etappe E2.1)
--
-- Enthält:
--   * Enum user_role: 'network_operator' (Gabo, verwaltet das Netzwerk) | 'promoter'
--   * Tabelle profiles — 1:1 zu auth.users, trägt Rolle, Aktiv-Flag, Anzeigename
--   * Helfer current_profile_role() / is_active_profile() / is_network_operator():
--     Die Rolle kommt IMMER aus dieser Tabelle (Datenbank), nie aus dem JWT.
--     Ein Token trägt nur die Supabase-Rolle 'authenticated'; welche Fachrolle
--     der Nutzer hat, entscheidet ausschließlich die Zeile in profiles.
--   * RLS auf profiles, tour_departures, bookings: aktiviert = deny-by-default.
--     Ohne Policy sieht 'authenticated' nichts. service_role hat BYPASSRLS und
--     wird nur serverseitig benutzt (Admin-Operationen, E4).
--   * Erste Policies (nur SELECT, nur was E2 braucht):
--       profiles         — eigene Zeile lesen; network_operator liest alle
--       tour_departures  — aktive Profile dürfen Termine lesen
--       bookings         — KEINE Policy → für authenticated gesperrt (E5 entscheidet)
--
-- Keine Trigger, die automatisch Profile anlegen: Accounts legt Gabo an (E4).
-- Keine Schreib-Policies für authenticated: alle Schreibzugriffe laufen in
-- dieser Etappe serverseitig (Server Actions), später mit expliziten Policies.
-- Additiv (Hard Rule 1): berührt weder Spalten noch Funktionen aus 0001/0002.

-- ---------------------------------------------------------------------------
-- Rolle
-- ---------------------------------------------------------------------------

create type user_role as enum ('network_operator', 'promoter');

comment on type user_role is
  'Fachrolle im Promoter-Netzwerk. network_operator = Gabo (Kontingente, Accounts, Auswertung), promoter = verkauft am Strand.';

-- ---------------------------------------------------------------------------
-- Profile (1:1 zu auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  -- Deaktivieren durch Gabo: false = kein Login-Zugang, kein Verkauf (RISKS Nr. 9)
  active boolean not null default true,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is
  'Ein Profil pro Auth-Nutzer. Die Fachrolle wird serverseitig aus dieser Tabelle gelesen, nie aus dem Token. Ein Account pro Person, keine geteilten Logins (RISKS Nr. 9).';
comment on column profiles.active is
  'false = von Gabo deaktiviert. Login wird abgewiesen, RLS-Helfer liefern keine Rolle mehr.';

create index profiles_role_idx on profiles (role);

-- ---------------------------------------------------------------------------
-- Helfer für Policies und App: Rolle aus der DB
-- SECURITY DEFINER, damit die Funktion profiles lesen darf, ohne dass die
-- Policies auf profiles rekursiv greifen. search_path fest auf public.
-- ---------------------------------------------------------------------------

create function current_profile_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from profiles
  where id = auth.uid()
    and active
$$;

comment on function current_profile_role() is
  'Fachrolle des eingeloggten Nutzers aus profiles (nur wenn active). NULL = kein Profil, deaktiviert oder nicht eingeloggt.';

create function is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and active
  )
$$;

create function is_network_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_profile_role() = 'network_operator', false)
$$;

revoke all on function current_profile_role() from public;
revoke all on function is_active_profile() from public;
revoke all on function is_network_operator() from public;
grant execute on function current_profile_role() to authenticated, service_role;
grant execute on function is_active_profile() to authenticated, service_role;
grant execute on function is_network_operator() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default auf allen drei Tabellen
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table tour_departures enable row level security;
alter table bookings enable row level security;

-- Tabellenrechte: authenticated darf nur SELECT, und nur so viel, wie die
-- Policies unten freigeben. anon bekommt nichts. bookings bleibt für
-- authenticated komplett ohne Recht (weder GRANT noch Policy).
grant select on profiles to authenticated;
grant select on tour_departures to authenticated;
grant select, insert, update, delete on profiles to service_role;

-- profiles: jeder liest die eigene Zeile (auch wenn deaktiviert, damit die App
-- "Konto deaktiviert" anzeigen kann); der network_operator liest alle (E4).
create policy profiles_select_own
  on profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_select_network_operator
  on profiles for select to authenticated
  using (is_network_operator());

-- tour_departures: aktive Profile (beide Rollen) sehen Termine + Kontingent.
create policy tour_departures_select_active_profile
  on tour_departures for select to authenticated
  using (is_active_profile());

-- bookings: bewusst KEINE Policy für authenticated. Zugriff nur über
-- service_role (serverseitig). Promoter-eigene Buchungen bekommen ihre
-- Policy erst, wenn bookings.promoter_id existiert (E5.1).
