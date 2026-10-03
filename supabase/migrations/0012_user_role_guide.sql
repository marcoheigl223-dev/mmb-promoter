-- 0012_user_role_guide.sql — dritte Fachrolle 'guide' (Teil 2 nach der Diagnose E5.5)
--
-- Enthält NUR den neuen Enum-Wert. Postgres erlaubt die Benutzung eines mit
-- `alter type … add value` angelegten Werts erst nach dem COMMIT dieser
-- Transaktion — Funktionen, Policies und Checks, die 'guide' benutzen, stehen
-- deshalb in 0013 (gleiches Muster wie 0009/0010).
--
-- Guide = dritte Rolle (DECISIONS 03.10.2026, „Nach der Diagnose", Punkt 2):
-- kann alles, was ein Promoter kann (verkaufen, eigenes Dashboard), plus
-- Guide-Extras (Teil 4, F29/F30/F31 offen). Additiv (Hard Rule 1).

alter type user_role add value 'guide';

comment on type user_role is
  'Fachrolle im Promoter-Netzwerk. network_operator = Gabo (Kontingente, Accounts, Auswertung), promoter = verkauft am Strand, guide = verkauft wie ein Promoter, plus Guide-Extras (ab Teil 4).';
