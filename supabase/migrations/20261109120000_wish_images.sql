-- =============================================================================
-- Bild zum Wunsch
--
-- Ein optionales Bild pro Wunsch. Der Browser verkleinert es (WebP oder JPEG,
-- ohne Metadaten) und lädt zwei Varianten in den privaten Bucket "wish-images":
--
--   <group_id>/<wish_id>/<uuid>.<webp|jpg>         groß (max. 1600 px)
--   <group_id>/<wish_id>/<uuid>-thumb.<webp|jpg>   Vorschau (max. 480 px)
--
-- Lesen: aktive Mitglieder des Anlasses, nur das aktuelle Bild eines Wunsches.
-- Hochladen: nur der Owner des Wunsches, nur in den Ordner dieses Wunsches.
-- Ändern/Löschen: für Clients gar nicht. Ersetzte oder verwaiste Bilder entfernt
-- die Edge Function "account" (Aktion cleanup-images) mit service_role.
-- Welches Bild gilt, steht in wishes.image_path und wird nur per RPC gesetzt.
-- =============================================================================

alter table public.wishes add column image_path text
  check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$');

-- -----------------------------------------------------------------------------
-- Bucket
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wish-images', 'wish-images', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen für die Storage-Policies
-- -----------------------------------------------------------------------------

-- Zerlegt einen Objektpfad. Liefert NULL-Werte, wenn der Pfad nicht dem Schema entspricht.
create or replace function public._wish_image_parts(p_name text, out group_id uuid, out wish_id uuid)
language plpgsql immutable set search_path = '' as $$
declare m text[];
begin
  m := regexp_match(p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/' ||
    '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/' ||
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-thumb)?\.(webp|jpg)$');
  if m is not null then
    group_id := m[1]::uuid;
    wish_id := m[2]::uuid;
  end if;
end;
$$;
revoke all on function public._wish_image_parts(text) from public, anon, authenticated;

create or replace function public.can_upload_wish_image(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.wishes w
    join public.group_members m on m.group_id = w.group_id and m.user_id = w.owner_id
    where w.id = (public._wish_image_parts(p_name)).wish_id
      and w.group_id = (public._wish_image_parts(p_name)).group_id
      and w.owner_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Mitglieder lesen nur das AKTUELLE Bild (oder dessen Vorschau) eines bestehenden Wunsches.
-- Ersetzte oder zu gelöschten Wünschen gehörende Objekte sind sofort für sie nicht mehr
-- abrufbar, auch bevor die Edge Function sie aus dem Speicher entfernt hat.
-- Der Owner liest zusätzlich alles im Ordner seines Wunsches (z. B. direkt nach dem Upload).
create or replace function public.can_read_wish_image(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wishes w
    where w.id = (public._wish_image_parts(p_name)).wish_id
      and w.group_id = (public._wish_image_parts(p_name)).group_id
      and w.image_path is not null
      and p_name in (w.image_path, regexp_replace(w.image_path, '\.(webp|jpg)$', '-thumb.\1'))
      and public.is_active_member(w.group_id)
  ) or public.can_upload_wish_image(p_name);
$$;



revoke all on function public.can_read_wish_image(text), public.can_upload_wish_image(text) from public, anon;
grant execute on function public.can_read_wish_image(text), public.can_upload_wish_image(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage-Policies (bewusst kein UPDATE/DELETE für Clients)
-- -----------------------------------------------------------------------------

create policy wish_images_select on storage.objects for select to authenticated
  using (bucket_id = 'wish-images' and public.can_read_wish_image(name));

create policy wish_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wish-images' and public.can_upload_wish_image(name));

-- -----------------------------------------------------------------------------
-- RPC: gültiges Bild eines Wunsches setzen oder entfernen
-- -----------------------------------------------------------------------------

create or replace function public.set_wish_image(p_wish_id uuid, p_image_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_uid(); w public.wishes; parts record; thumb text;
begin
  select * into w from public.wishes where id = p_wish_id and owner_id = uid;
  if w.id is null then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_image_path is not null then
    select * into parts from public._wish_image_parts(p_image_path);
    if parts.wish_id is distinct from w.id or parts.group_id is distinct from w.group_id
       or p_image_path like '%-thumb.%' then
      raise exception 'invalid_image' using errcode = '22023';
    end if;
    thumb := regexp_replace(p_image_path, '\.(webp|jpg)$', '-thumb.\1');
    -- Beide Varianten müssen hochgeladen sein, sonst würde ein Verweis ins Leere gesetzt.
    if (select count(*) from storage.objects
         where bucket_id = 'wish-images' and name in (p_image_path, thumb)) <> 2 then
      raise exception 'image_missing';
    end if;
  end if;

  update public.wishes set image_path = p_image_path, updated_at = now() where id = w.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Nur für die Edge Function: verwaiste Bilder finden
--
-- Verwaist ist ein Objekt, wenn
--   * sein Wunsch nicht mehr existiert (gelöscht, Anlass gelöscht, Konto gelöscht), oder
--   * es weder das aktuelle Bild noch dessen Vorschau ist und älter als 15 Minuten
--     (jüngere Objekte können zu einem Upload gehören, der gerade noch läuft).
-- -----------------------------------------------------------------------------

create or replace function public.wish_image_orphans(p_limit integer)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  left join public.wishes w on w.id = (public._wish_image_parts(o.name)).wish_id
  where o.bucket_id = 'wish-images'
    and (
      w.id is null
      or (o.created_at < now() - interval '15 minutes'
          and (w.image_path is null
               or o.name not in (w.image_path,
                                 regexp_replace(w.image_path, '\.(webp|jpg)$', '-thumb.\1'))))
    )
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 1000);
$$;

revoke all on function public.wish_image_orphans(integer) from public, anon, authenticated;
grant execute on function public.wish_image_orphans(integer) to service_role;

grant execute on function public.set_wish_image(uuid, text) to authenticated;
revoke execute on function public.set_wish_image(uuid, text) from public, anon;
