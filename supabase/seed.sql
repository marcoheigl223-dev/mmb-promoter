-- seed.sql — NUR lokale Test-Accounts (läuft bei jedem `supabase db reset`)
--
-- Drei Auth-Nutzer + Profile, je Rolle einer plus ein deaktivierter Promoter
-- für den Test "inaktiver Promoter kommt nicht rein" (TASKS E2.3).
-- Passwörter sind Testwerte (≥ 12 Zeichen, config.toml minimum_password_length),
-- keine Secrets (Hard Rule 9: lokale Instanz enthält nur Test-/Seed-Daten).
-- `supabase db push` spielt Seeds NICHT ein — in einer Cloud-Instanz landen
-- diese Zeilen nie; dort legt Gabo echte Accounts über die App an (E4).
--
-- Zugangsdaten (lokal):
--   operator@mmb-promoter.test           operator-test-2026   network_operator, aktiv
--   promoter@mmb-promoter.test           promoter-test-2026   promoter, aktiv
--   inactive-promoter@mmb-promoter.test  inactive-test-2026   promoter, DEAKTIVIERT
--
-- Die Zeilen in auth.users/auth.identities folgen dem Schema von GoTrue v2.191
-- (lokal geprüft). Leere Strings statt NULL in den Token-Spalten sind nötig,
-- sonst scheitert GoTrue beim Lesen des Nutzers ("converting NULL to string").

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated',
    'operator@mmb-promoter.test',
    crypt('operator-test-2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(),
    '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated',
    'promoter@mmb-promoter.test',
    crypt('promoter-test-2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(),
    '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated',
    'inactive-promoter@mmb-promoter.test',
    crypt('inactive-test-2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(),
    '', '', '', '', ''
  );

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email in (
  'operator@mmb-promoter.test',
  'promoter@mmb-promoter.test',
  'inactive-promoter@mmb-promoter.test'
);

insert into public.profiles (id, role, active, display_name)
values
  ('11111111-1111-4111-8111-111111111111', 'network_operator', true,  'Test-Operator (Gabo)'),
  ('22222222-2222-4222-8222-222222222222', 'promoter',         true,  'Test-Promoter'),
  ('33333333-3333-4333-8333-333333333333', 'promoter',         false, 'Test-Promoter (deaktiviert)');

-- ---------------------------------------------------------------------------
-- Teil 2 (03.10.2026): Test-Guide — dritte Rolle (Migration 0012/0013).
-- Eigener Block, damit die drei Konten oben unverändert bleiben.
--   guide@mmb-promoter.test              guide-test-2026      guide, aktiv
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
values (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-8444-444444444444',
  'authenticated', 'authenticated',
  'guide@mmb-promoter.test',
  crypt('guide-test-2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(),
  '', '', '', '', ''
);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email = 'guide@mmb-promoter.test';

insert into public.profiles (id, role, active, display_name)
values ('44444444-4444-4444-8444-444444444444', 'guide', true, 'Test-Guide');
