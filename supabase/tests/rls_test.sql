\set ON_ERROR_STOP 1
-- Testnutzer: A (Admin), B (Mitglied, Wunsch-Owner), C (fremd), D (nur eingeladen)
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'anna', 'Anna'),
  ('00000000-0000-0000-0000-00000000000b', 'ben', 'Ben'),
  ('00000000-0000-0000-0000-00000000000c', 'clara', 'Clara'),
  ('00000000-0000-0000-0000-00000000000d', 'dora', 'Dora');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
end $$;
create function pg_temp.expect_error(q text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'OK (erwarteter Fehler: %) %', sqlerrm, msg;
    return;
  end;
  raise exception 'FEHLER: erwartet wurde ein Fehler: %', msg;
end $$;
create function pg_temp.expect(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FEHLER: %', msg; end if;
  raise notice 'OK %', msg;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.expect_error(text, text), pg_temp.expect(boolean, text) to anon, authenticated;

-- ---- anon darf nichts ----
set role anon;
select pg_temp.expect_error('select * from public.profiles', 'anon liest keine Profile');
select pg_temp.expect_error('select public.create_group(''x'', null, null, ''all'')', 'anon darf keine RPCs');
select pg_temp.expect_error('select public.find_user_by_username(''ben'')', 'anon darf keine Usersuche');
reset role;

-- ---- A erstellt Anlass, lädt B und D ein ----
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_group('Weihnachten', '2026-12-24', 'Test', 'all') as gid \gset
select public.invite_member(:'gid', 'ben');
select public.invite_member(:'gid', 'DORA');
select pg_temp.expect_error(format('select public.invite_member(%L, ''niemand'')', :'gid'), 'Unbekannter Username');
select pg_temp.expect((select count(*) from public.find_user_by_username('be')) = 0, 'Keine Teiltreffer bei Usersuche');
select pg_temp.expect((select count(*) from public.find_user_by_username('ben')) = 1, 'Exakter Treffer bei Usersuche');
select pg_temp.expect_error('insert into public.groups (name) values (''hack'')', 'Kein direktes INSERT auf groups');
select pg_temp.expect_error(format('select public._leave_group(%L, %L)', :'gid', '00000000-0000-0000-0000-00000000000b'), 'Interne Funktion nicht aufrufbar');
select pg_temp.expect_error('select public.rate_limit_hit(''x'', 1, 1)', 'Rate-Limit-Funktion nur für service_role');
select pg_temp.expect_error('select * from public.recovery_codes', 'Keine Recovery-Codes lesbar');
select pg_temp.expect_error('update public.profiles set username = ''admin''', 'Username nicht änderbar');

-- ---- B nimmt an, legt Wünsche an ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.wishes) = 0, 'Eingeladener B sieht vor Annahme keine Wünsche');
select pg_temp.expect((select count(*) from public.groups) = 1, 'Eingeladener B sieht den Gruppennamen');
select public.respond_invite(:'gid', true);
select public.upsert_wish(null, :'gid', 'Kopfhörer', 'schwarz', 'https://example.com/k', 19900, 'top') as wid \gset
select public.upsert_wish(null, :'gid', 'Buch', null, null, 2400, 'normal') as wid2 \gset
select pg_temp.expect_error(format('select public.upsert_wish(null, %L, ''x'', null, ''javascript:alert(1)'', null, ''normal'')', :'gid'), 'Nur https-Links');
select pg_temp.expect_error(format('select public.upsert_wish(null, %L, ''x'', null, ''http://example.com'', null, ''normal'')', :'gid'), 'Kein http');
select pg_temp.expect_error(format('select public.claim_wish(%L, ''full'', null, null, false)', :'wid'), 'Eigenen Wunsch nicht beanspruchen');
select pg_temp.expect_error(format('select public.invite_member(%L, ''clara'')', :'gid'), 'Nicht-Admin darf nicht einladen');

-- ---- A beansprucht (Gruppengeschenk) ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.claim_wish(:'wid', 'share', 10000, 'Ich bestelle', true);
select public.claim_wish(:'wid2', 'full', null, null, false);
select pg_temp.expect((select count(*) from public.claims) = 2, 'A sieht eigene Claims');
select pg_temp.expect_error('insert into public.claims (wish_id, user_id, kind) values (gen_random_uuid(), auth.uid(), ''full'')', 'Kein direktes INSERT auf claims');
select pg_temp.expect_error('update public.claims set amount_cents = 1', 'Kein direktes UPDATE auf claims');

-- ---- Überraschungsschutz: B sieht keine Claims ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.claims) = 0, 'Owner B sieht KEINE Claims auf eigene Wünsche');
select pg_temp.expect((select count(*) from public.wishes) = 2, 'B sieht eigene Wünsche');

-- ---- C ist fremd ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from public.groups) = 0, 'Fremde C sieht keine Gruppe');
select pg_temp.expect((select count(*) from public.wishes) = 0, 'Fremde C sieht keine Wünsche');
select pg_temp.expect((select count(*) from public.claims) = 0, 'Fremde C sieht keine Claims');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'Fremde C sieht nur eigenes Profil');
select pg_temp.expect_error(format('select public.claim_wish(%L, ''share'', 100, null, false)', :'wid'), 'Fremde C darf nicht beanspruchen');

-- ---- D (eingeladen) nimmt an und macht mit ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.respond_invite(:'gid', true);
select pg_temp.expect((select count(*) from public.claims) = 2, 'D sieht Claims anderer (nicht Owner)');
select pg_temp.expect_error(format('select public.claim_wish(%L, ''full'', null, null, false)', :'wid'), 'Komplett-Claim bei laufendem Gruppengeschenk');
select pg_temp.expect_error(format('select public.claim_wish(%L, ''share'', 500, null, false)', :'wid2'), 'Share auf komplett vergebenen Wunsch');
select pg_temp.expect_error(format('select public.claim_wish(%L, ''share'', 9901, null, false)', :'wid'), 'Beitrag über Preis');
select public.claim_wish(:'wid', 'share', 9900, null, false);
select pg_temp.expect((select sum(amount_cents) from public.claims where wish_id = :'wid') = 19900, 'Gruppengeschenk voll gedeckt');
select pg_temp.expect_error(format('select public.remove_member(%L, %L)', :'gid', '00000000-0000-0000-0000-00000000000a'), 'Nicht-Admin entfernt niemanden');

-- ---- B löscht Wunsch → Hinweise an A und D ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.delete_wish(:'wid');
select pg_temp.expect((select count(*) from public.notices) = 0, 'Owner B bekommt keinen Hinweis');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect((select count(*) from public.notices) = 1, 'D bekommt Hinweis zum entfernten Wunsch');
select pg_temp.expect((select count(*) from public.claims where wish_id = :'wid') = 0, 'Claims des gelöschten Wunsches weg');

-- ---- Admin verlässt Gruppe → Nachfolge ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.leave_group(:'gid');
select pg_temp.expect((select count(*) from public.groups) = 0, 'A sieht Gruppe nach Austritt nicht mehr');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.group_members where role = 'admin') = 1, 'Neuer Admin wurde bestimmt');
select pg_temp.expect((select count(*) from public.claims) = 0, 'Claims von A wurden mit Austritt entfernt');

reset role;

-- ---- Rate-Limits: Zählen, Sperren, Aufräumen (nur service_role) ----
insert into public.rate_limits (key, window_start, hits) values ('alt', now() - interval '2 days', 99);
grant execute on function pg_temp.expect(boolean, text) to service_role;
set role service_role;
select pg_temp.expect(public.rate_limit_hit('k', 2, 60), 'Rate-Limit: 1. Versuch erlaubt');
select pg_temp.expect(public.rate_limit_hit('k', 2, 60), 'Rate-Limit: 2. Versuch erlaubt');
select pg_temp.expect(not public.rate_limit_hit('k', 2, 60), 'Rate-Limit: 3. Versuch gesperrt');
select pg_temp.expect(public.rate_limit_blocked('k', 2, 60), 'Rate-Limit: als gesperrt gemeldet');
select pg_temp.expect(not exists (select 1 from public.rate_limits where key = 'alt'), 'Abgelaufene Rate-Limit-Einträge werden entfernt');
reset role;

select pg_temp.expect((select count(*) from public.recovery_codes) = 0, 'Testende');
\echo 'ALLE RLS-TESTS BESTANDEN'
