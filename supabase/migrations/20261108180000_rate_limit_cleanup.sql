-- =============================================================================
-- Rate-Limits: abgelaufene Einträge automatisch entfernen.
--
-- Ohne Aufräumen wächst public.rate_limits mit jedem neuen Schlüssel (z. B. pro
-- IP) unbegrenzt. Das längste verwendete Fenster ist 24 Stunden; ältere Zeilen
-- sind für jedes Limit bedeutungslos und werden bei jedem Aufruf gelöscht.
-- "create or replace" behält die bestehenden Rechte (nur service_role).
-- =============================================================================

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_window';
  end if;
  delete from public.rate_limits where window_start < now() - interval '1 day' and key <> p_key;

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

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);
