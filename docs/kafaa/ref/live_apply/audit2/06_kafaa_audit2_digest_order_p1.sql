-- kafaa_audit2_digest_order_p1 (1/1) · from kafaa/supabase/migrations/20261013100006_kafaa_audit2_digest_order.sql (final audit fixes 2026-10-13, branch audit2-fixes)
-- Apply with apply_migration name "kafaa_audit2_digest_order_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit2 2026-10-13 · finding 4] Owed approvals before future-dated ones in the weekly digest (SQL mirror of compareItems/dayKey in
-- src/shell/digest/rules.ts; scripts/validate/audit2-fixes.mjs proves TS = SQL for every seeded person on 2026-10-11..2026-10-19).
-- Since FS75 (2026-10-12) the approvals of a training manager gained two pre-arrival checks dated 48-49 days ahead (FS69) and a
-- fellowship sign-off (FS67). Ordered by days, the two future-dated checks came first and, with the cap of 3 approvals, pushed out a
-- plant visit to confirm and role-play reviews that are owed now. From the FS75 release day on (the digest day = due_on - days >=
-- 2026-10-12, the same gate as FS75_FROM), the order key puts every approval that is owed (no date, due today or overdue) before every
-- approval dated in the future: a future-dated approval sorts after the undated ones, by its days. Earlier days keep the old order, so
-- the seeded W38-W41 digests (records) are unchanged. Other kinds, the caps and the 7-item limit are unchanged.
create or replace function kafaa_dg_compose(p_items jsonb, p_muted text[]) returns jsonb language sql immutable set search_path = public as $$
  with x as (
    select e, e->>'kind' as k, (e->>'urgency')::int as u, case when e->>'kind' = 'approval' and (e->>'days')::int > 0 and (e->>'due_on')::date - (e->>'days')::int >= date '2026-10-12' then 100000 + (e->>'days')::int
             else coalesce((e->>'days')::int, 100000) end as dd,
           case e->>'kind' when 'expiry' then 1 when 'approval' then 2 when 'coach' then 3 when 'opportunity' then 4 when 'mentoring' then 5 when 'conversation' then 6 when 'refresher' then 7 else 8 end as kr,
           coalesce((e->>'score')::float8, 0) as sc, e->>'id' as id
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where e->>'kind' = 'expiry' or not (e->>'kind' = any(coalesce(p_muted, '{}'::text[])))
  ), r as (
    select x.*, row_number() over (partition by k order by u, dd, kr, sc desc, id collate "C") as rn from x
  ), kept as (
    select * from r where rn <= case k when 'expiry' then 3 when 'approval' then 3 when 'opportunity' then 2 when 'future' then 2 else 1 end
     order by u, dd, kr, sc desc, id collate "C" limit 7
  )
  select coalesce(jsonb_agg(e order by u, dd, kr, sc desc, id collate "C"), '[]'::jsonb) from kept
$$;
