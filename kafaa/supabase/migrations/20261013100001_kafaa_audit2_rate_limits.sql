-- [Audit2 2026-10-13 · findings 2, 6, 7] Shared rate limiting for the anonymous RPCs (Dalil, public verification links, contact form).
-- 1. kafaa_rate_limits: one counter row per (bucket, key), reset when its window passes, so the table holds one row per slug / hashed IP /
--    global key instead of one audit row per page view. Keys are slugs, 'ip-' || md5(ip) or '*'; never a raw IP address. Same columns,
--    RLS and grants as the generated schema (src/data/schema.ts rate_limits): auditors may read, nobody writes directly.
-- 2. kafaa_client_ip(): the caller's IP as the platform sees it. Cloudflare's cf-connecting-ip (set by the edge, which overwrites any
--    client value) wins; otherwise the LAST hop of X-Forwarded-For, the one the platform's proxy appends. The first hop is whatever the
--    client sent, so it must never be a rate-limit key (the earlier kafaa_dalil_turn used it). Null when PostgREST passes no headers.
-- 3. kafaa_rl_hit(bucket, key, window): counts one hit and returns the count in the current window (1 = first hit of a new window).
-- Internal helpers: executable by no API role. Idempotent; kafaa_* objects only.

create table if not exists kafaa_rate_limits (
  id text primary key,
  bucket text not null,
  key text not null,
  window_start timestamptz not null default now(),
  n integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table kafaa_rate_limits is '[M16] Rate-limit counters for anonymous RPCs (hashed keys only)';
create index if not exists kafaa_rate_limits_bucket_idx on kafaa_rate_limits (bucket);
alter table kafaa_rate_limits enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_rate_limits' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_rate_limits for select to anon, authenticated using ((select kafaa_has_grant('audit_log'::text, array['R'::text, 'W'::text, 'A'::text])));
  end if;
end $$;
revoke all on kafaa_rate_limits from anon, authenticated;
grant select on kafaa_rate_limits to anon, authenticated;

create or replace function kafaa_client_ip() returns text language plpgsql stable set search_path = public as $$
declare h json; v text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  if h is null then return null; end if;
  v := nullif(btrim(coalesce(h ->> 'cf-connecting-ip', '')), '');
  if v is null then
    -- the last X-Forwarded-For element: appended by the platform's proxy, not chosen by the client
    v := nullif(btrim(reverse(split_part(reverse(coalesce(h ->> 'x-forwarded-for', '')), ',', 1))), '');
  end if;
  return left(v, 64);
end $$;
revoke all on function kafaa_client_ip() from public, anon, authenticated;

create or replace function kafaa_rl_hit(p_bucket text, p_key text, p_window interval) returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer; v_id text := left(p_bucket, 60) || ':' || left(coalesce(p_key, ''), 80);
begin
  insert into kafaa_rate_limits as r (id, bucket, key, window_start, n, updated_at)
  values (v_id, left(p_bucket, 60), left(coalesce(p_key, ''), 80), now(), 1, now())
  on conflict (id) do update set
    n = case when r.window_start <= now() - p_window then 1 else r.n + 1 end,
    window_start = case when r.window_start <= now() - p_window then now() else r.window_start end,
    updated_at = now()
  returning r.n into v_n;
  return v_n;
end $$;
revoke all on function kafaa_rl_hit(text, text, interval) from public, anon, authenticated;
