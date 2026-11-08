-- =============================================================================
-- my-wish-list – Initiales Schema
--
-- Sicherheitsprinzipien:
--   * RLS auf jeder Tabelle, Default-Deny.
--   * Clients (Rolle "authenticated") dürfen Tabellen nur LESEN, soweit RLS es
--     erlaubt. Alle Schreibzugriffe laufen über SECURITY DEFINER-Funktionen,
--     die Eingaben validieren und Berechtigungen explizit prüfen.
--   * Die Rolle "anon" hat keinerlei Rechte auf Daten.
--   * Überraschungsschutz: Claims eines Wunsches sind für dessen Owner per RLS
--     unsichtbar; Wünsche selbst tragen keine Claim-Informationen.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     extensions.citext not null unique
               check (username::text ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null
               check (char_length(btrim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

create table public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  occasion_date date,
  description   text check (description is null or char_length(description) <= 500),
  mode          text not null default 'all' check (mode in ('all', 'some')),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.group_members (
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  status       text not null default 'invited' check (status in ('invited', 'active')),
  is_recipient boolean not null default true,
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.wishes (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  owner_id    uuid not null,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  url         text check (url is null or (char_length(url) <= 2000 and url ~ '^https://[^\s<>"]+$')),
  price_cents integer check (price_cents is null or (price_cents >= 0 and price_cents <= 100000000)),
  priority    text not null default 'normal' check (priority in ('normal', 'top')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (group_id, owner_id) references public.group_members (group_id, user_id) on delete cascade
);
create index wishes_group_idx on public.wishes (group_id);

create table public.claims (
  id           uuid primary key default gen_random_uuid(),
  wish_id      uuid not null references public.wishes (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('full', 'share')),
  amount_cents integer check (amount_cents is null or (amount_cents > 0 and amount_cents <= 100000000)),
  note         text check (note is null or char_length(note) <= 200),
  is_organizer boolean not null default false,
  purchased    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (wish_id, user_id),
  check (kind = 'full' or amount_cents is not null)
);
create index claims_user_idx on public.claims (user_id);

-- Hinweise an Nutzer (z. B. "Wunsch wurde entfernt, deine Zusage ist aufgehoben").
create table public.notices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  message    text not null check (char_length(message) <= 300),
  created_at timestamptz not null default now()
);
create index notices_user_idx on public.notices (user_id);

-- Nur für Edge Functions (service_role): Wiederherstellungscodes & Rate-Limits.
create table public.recovery_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

-- -----------------------------------------------------------------------------
-- Rechte: Default-Deny, dann gezielt SELECT erlauben
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.wishes         enable row level security;
alter table public.claims         enable row level security;
alter table public.notices        enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.rate_limits    enable row level security;


grant select on public.profiles, public.groups, public.group_members,
                public.wishes, public.claims, public.notices to authenticated;
-- recovery_codes / rate_limits: keine Rechte für Clients, keine Policies.

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen (SECURITY DEFINER, damit Policies nicht rekursiv werden)
-- -----------------------------------------------------------------------------

create or replace function public.is_active_member(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'admin'
  );
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = (select auth.uid()) and them.user_id = other
      and (me.status = 'active' or them.invited_by = (select auth.uid()) or me.invited_by = other)
  );
$$;

-- Darf der aktuelle Nutzer die Claims dieses Wunsches sehen?
create or replace function public.can_see_claims(wid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wishes w
    where w.id = wid
      and w.owner_id <> (select auth.uid())
      and public.is_active_member(w.group_id)
  );
$$;

revoke all on function public.is_active_member(uuid), public.is_group_admin(uuid),
  public.shares_group_with(uuid), public.can_see_claims(uuid) from public, anon;
grant execute on function public.is_active_member(uuid), public.is_group_admin(uuid),
  public.shares_group_with(uuid), public.can_see_claims(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS-Policies (nur SELECT – Schreiben ausschließlich über RPCs)
-- -----------------------------------------------------------------------------

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

create policy groups_select on public.groups for select to authenticated
  using (exists (
    select 1 from public.group_members m
    where m.group_id = groups.id and m.user_id = (select auth.uid())
  ));

create policy members_select on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_active_member(group_id));

create policy wishes_select on public.wishes for select to authenticated
  using (public.is_active_member(group_id));

-- KERNREGEL Überraschungsschutz: Owner sieht keine Claims auf eigene Wünsche.
create policy claims_select on public.claims for select to authenticated
  using (public.can_see_claims(wish_id));

create policy notices_select on public.notices for select to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Interne Helfer
-- -----------------------------------------------------------------------------

create or replace function public._require_uid()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end;
$$;
revoke all on function public._require_uid() from public, anon, authenticated;

create or replace function public._clean_text(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(t), '');
$$;
revoke all on function public._clean_text(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPCs: Profil
-- -----------------------------------------------------------------------------

create or replace function public.update_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  update public.profiles set display_name = btrim(p_display_name) where id = uid;
end;
$$;

-- Exakte Suche für Einladungen – keine Teiltreffer, keine Listen.
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, username text, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if p_username is null or lower(btrim(p_username)) !~ '^[a-z0-9_.]{3,24}$' then
    return;
  end if;
  return query
    select p.id, p.username::text, p.display_name
    from public.profiles p
    where p.username = lower(btrim(p_username))::extensions.citext;
end;
$$;

-- Konto löschen inkl. aller Daten. Letzter Admin einer Gruppe: Adminrolle wird
-- an das älteste aktive Mitglied übergeben; leere Gruppen werden entfernt.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); g record;
begin
  for g in select group_id from public.group_members where user_id = uid loop
    perform public._leave_group(g.group_id, uid);
  end loop;
  delete from auth.users where id = uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: Gruppen / Anlässe
-- -----------------------------------------------------------------------------

create or replace function public.create_group(
  p_name text, p_occasion_date date, p_description text, p_mode text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); gid uuid;
begin
  if p_mode not in ('all', 'some') then raise exception 'invalid_mode'; end if;
  insert into public.groups (name, occasion_date, description, mode, created_by)
  values (btrim(p_name), p_occasion_date, public._clean_text(p_description), p_mode, uid)
  returning id into gid;
  insert into public.group_members (group_id, user_id, role, status, is_recipient, invited_by)
  values (gid, uid, 'admin', 'active', p_mode = 'all', null);
  return gid;
end;
$$;

create or replace function public.update_group(
  p_group_id uuid, p_name text, p_occasion_date date, p_description text, p_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_mode not in ('all', 'some') then raise exception 'invalid_mode'; end if;
  update public.groups
     set name = btrim(p_name), occasion_date = p_occasion_date,
         description = public._clean_text(p_description), mode = p_mode
   where id = p_group_id;
  if p_mode = 'all' then
    update public.group_members set is_recipient = true where group_id = p_group_id;
  end if;
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.groups where id = p_group_id;
end;
$$;

create or replace function public.invite_member(p_group_id uuid, p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); target uuid; gmode text;
begin
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select p.id into target from public.profiles p
   where p.username = lower(btrim(p_username))::extensions.citext;
  if target is null then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = target) then
    raise exception 'already_member';
  end if;
  if (select count(*) from public.group_members where group_id = p_group_id) >= 100 then
    raise exception 'group_full';
  end if;
  select mode into gmode from public.groups where id = p_group_id;
  insert into public.group_members (group_id, user_id, role, status, is_recipient, invited_by)
  values (p_group_id, target, 'member', 'invited', gmode = 'all', uid);
end;
$$;

create or replace function public.respond_invite(p_group_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if p_accept then
    update public.group_members set status = 'active'
     where group_id = p_group_id and user_id = uid and status = 'invited';
  else
    delete from public.group_members
     where group_id = p_group_id and user_id = uid and status = 'invited';
  end if;
  if not found then raise exception 'invite_not_found'; end if;
end;
$$;

-- Intern: Mitglied entfernen + Admin-Nachfolge + leere Gruppe löschen.
create or replace function public._leave_group(p_group_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare successor uuid;
begin
  -- Eigene Zusagen in dieser Gruppe aufheben (eigene Wünsche fallen per FK-Cascade weg).
  delete from public.claims c using public.wishes w
   where c.wish_id = w.id and w.group_id = p_group_id and c.user_id = p_user;
  delete from public.group_members where group_id = p_group_id and user_id = p_user;
  if not exists (select 1 from public.group_members where group_id = p_group_id and status = 'active') then
    delete from public.groups where id = p_group_id;
    return;
  end if;
  if not exists (select 1 from public.group_members
                 where group_id = p_group_id and status = 'active' and role = 'admin') then
    select user_id into successor from public.group_members
     where group_id = p_group_id and status = 'active'
     order by created_at asc limit 1;
    update public.group_members set role = 'admin' where group_id = p_group_id and user_id = successor;
  end if;
end;
$$;
revoke all on function public._leave_group(uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = uid) then
    raise exception 'not_member';
  end if;
  perform public._leave_group(p_group_id, uid);
end;
$$;

-- Admin entfernt Mitglied oder zieht Einladung zurück.
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user_id = uid then raise exception 'use_leave_group'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'not_member';
  end if;
  perform public._leave_group(p_group_id, p_user_id);
end;
$$;

create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  if p_role = 'member' and p_user_id = uid and
     (select count(*) from public.group_members
       where group_id = p_group_id and role = 'admin' and status = 'active') <= 1 then
    raise exception 'last_admin';
  end if;
  update public.group_members set role = p_role
   where group_id = p_group_id and user_id = p_user_id and status = 'active';
  if not found then raise exception 'not_member'; end if;
end;
$$;

create or replace function public.set_member_recipient(p_group_id uuid, p_user_id uuid, p_is_recipient boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_uid();
  if not public.is_group_admin(p_group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.group_members set is_recipient = p_is_recipient
   where group_id = p_group_id and user_id = p_user_id;
  if not found then raise exception 'not_member'; end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: Wünsche
-- -----------------------------------------------------------------------------

create or replace function public.upsert_wish(
  p_wish_id uuid, p_group_id uuid, p_title text, p_description text,
  p_url text, p_price_cents integer, p_priority text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); wid uuid;
begin
  if p_priority not in ('normal', 'top') then raise exception 'invalid_priority'; end if;
  if p_wish_id is null then
    if not exists (select 1 from public.group_members
                    where group_id = p_group_id and user_id = uid
                      and status = 'active' and is_recipient) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if (select count(*) from public.wishes where group_id = p_group_id and owner_id = uid) >= 100 then
      raise exception 'too_many_wishes';
    end if;
    insert into public.wishes (group_id, owner_id, title, description, url, price_cents, priority)
    values (p_group_id, uid, btrim(p_title), public._clean_text(p_description),
            public._clean_text(p_url), p_price_cents, p_priority)
    returning id into wid;
  else
    update public.wishes
       set title = btrim(p_title), description = public._clean_text(p_description),
           url = public._clean_text(p_url), price_cents = p_price_cents,
           priority = p_priority, updated_at = now()
     where id = p_wish_id and owner_id = uid
    returning id into wid;
    if wid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  return wid;
end;
$$;

create or replace function public.delete_wish(p_wish_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  delete from public.wishes where id = p_wish_id and owner_id = uid;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

-- Wunsch aus einer anderen eigenen Liste in diese Gruppe kopieren.
create or replace function public.copy_wish(p_wish_id uuid, p_target_group_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); src public.wishes; wid uuid;
begin
  select * into src from public.wishes where id = p_wish_id and owner_id = uid;
  if src.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.upsert_wish(null, p_target_group_id, src.title, src.description,
                            src.url, src.price_cents, src.priority);
end;
$$;

-- Bei Löschung eines Wunsches: Beteiligte informieren (Owner erfährt nichts).
create or replace function public._notify_claimers_on_wish_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_name text;
begin
  -- Ganze Gruppe wird gelöscht: keine irreführenden Einzelhinweise.
  if not exists (select 1 from public.groups where id = old.group_id) then
    return old;
  end if;
  select display_name into owner_name from public.profiles where id = old.owner_id;
  insert into public.notices (user_id, message)
  select c.user_id,
         left(coalesce(owner_name, 'Jemand') || ' hat „' || old.title ||
              '“ von der Liste entfernt. Deine Zusage wurde aufgehoben.', 300)
  from public.claims c where c.wish_id = old.id;
  return old;
end;
$$;
revoke all on function public._notify_claimers_on_wish_delete() from public, anon, authenticated;

create trigger wishes_notify_claimers
  before delete on public.wishes
  for each row execute function public._notify_claimers_on_wish_delete();

-- -----------------------------------------------------------------------------
-- RPCs: Claims (Beanspruchen / Gruppengeschenk)
-- -----------------------------------------------------------------------------

-- Atomar: sperrt den Wunsch, prüft Konflikte, legt Claim an oder ändert ihn.
create or replace function public.claim_wish(
  p_wish_id uuid, p_kind text, p_amount_cents integer, p_note text, p_is_organizer boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); w public.wishes; others_full int; others_any int; others_sum bigint;
begin
  if p_kind not in ('full', 'share') then raise exception 'invalid_kind'; end if;
  if p_kind = 'share' and (p_amount_cents is null or p_amount_cents <= 0) then
    raise exception 'invalid_amount';
  end if;

  select * into w from public.wishes where id = p_wish_id for update;
  if w.id is null or not public.is_active_member(w.group_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if w.owner_id = uid then raise exception 'cannot_claim_own_wish'; end if;

  select count(*) filter (where kind = 'full'), count(*), coalesce(sum(amount_cents), 0)
    into others_full, others_any, others_sum
    from public.claims where wish_id = p_wish_id and user_id <> uid;

  if others_full > 0 then raise exception 'already_claimed'; end if;
  if p_kind = 'full' and others_any > 0 then raise exception 'group_gift_in_progress'; end if;
  if p_kind = 'share' and w.price_cents is not null and others_sum + p_amount_cents > w.price_cents then
    raise exception 'exceeds_price';
  end if;

  insert into public.claims (wish_id, user_id, kind, amount_cents, note, is_organizer)
  values (p_wish_id, uid, p_kind,
          case when p_kind = 'share' then p_amount_cents else w.price_cents end,
          public._clean_text(p_note), coalesce(p_is_organizer, false))
  on conflict (wish_id, user_id) do update
    set kind = excluded.kind, amount_cents = excluded.amount_cents,
        note = excluded.note, is_organizer = excluded.is_organizer, updated_at = now();
end;
$$;

create or replace function public.unclaim_wish(p_wish_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  delete from public.claims where wish_id = p_wish_id and user_id = uid;
  if not found then raise exception 'claim_not_found'; end if;
end;
$$;

create or replace function public.set_claim_purchased(p_wish_id uuid, p_purchased boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  update public.claims set purchased = p_purchased, updated_at = now()
   where wish_id = p_wish_id and user_id = uid;
  if not found then raise exception 'claim_not_found'; end if;
end;
$$;

create or replace function public.dismiss_notice(p_notice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid();
begin
  delete from public.notices where id = p_notice_id and user_id = uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ausführungsrechte für RPCs: nur eingeloggte Nutzer
-- -----------------------------------------------------------------------------

grant execute on function
  public.update_display_name(text),
  public.find_user_by_username(text),
  public.delete_my_account(),
  public.create_group(text, date, text, text),
  public.update_group(uuid, text, date, text, text),
  public.delete_group(uuid),
  public.invite_member(uuid, text),
  public.respond_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_member(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.set_member_recipient(uuid, uuid, boolean),
  public.upsert_wish(uuid, uuid, text, text, text, integer, text),
  public.delete_wish(uuid),
  public.copy_wish(uuid, uuid),
  public.claim_wish(uuid, text, integer, text, boolean),
  public.unclaim_wish(uuid),
  public.set_claim_purchased(uuid, boolean),
  public.dismiss_notice(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Nur für Edge Functions (service_role)
-- -----------------------------------------------------------------------------

-- Fixed-Window-Rate-Limit. Gibt true zurück, wenn die Anfrage erlaubt ist.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, now(), 0)
  on conflict (key) do nothing;
  select * into r from public.rate_limits where key = p_key for update;
  if r.window_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits set window_start = now(), hits = 1 where key = p_key;
    return true;
  end if;
  if r.hits >= p_max then
    return false;
  end if;
  update public.rate_limits set hits = hits + 1 where key = p_key;
  return true;
end;
$$;
-- Nur prüfen, nicht zählen (für "nur Fehlversuche zählen").
create or replace function public.rate_limit_blocked(p_key text, p_max integer, p_window_seconds integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rate_limits r
    where r.key = p_key and r.hits >= p_max
      and r.window_start >= now() - make_interval(secs => p_window_seconds)
  );
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_blocked(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_blocked(text, integer, integer) to service_role;
grant select, insert, update, delete on public.recovery_codes, public.rate_limits to service_role;
grant select, insert on public.profiles to service_role;

-- -----------------------------------------------------------------------------
-- EXECUTE für PUBLIC/anon entziehen. Postgres vergibt EXECUTE auf Funktionen
-- standardmäßig an PUBLIC; das lässt sich nur global (nicht pro Schema) ändern.
-- Explizite Grants an "authenticated"/"service_role" oben bleiben bestehen.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
alter default privileges revoke execute on functions from public;
