-- W3 integration QA fixes (additive and idempotent; kafaa_* objects only).
-- F19: the succession bench aggregates suppressed only the Emirati and women shares. The successor count and the counts by
-- readiness are aggregates too: every cell under the minimum group size (10) is now null ("suppressed"), zero included,
-- as in workforce analytics. Same rule as successionAggregatesOf() in src/modules/m23/domain.ts.
create or replace function kafaa_sx_aggregates() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mg integer := (kafaa_rules()->>'minGroupSize')::int; n integer; emi integer; wom integer; r_now integer; r_12 integer; r_35 integer;
begin
  select count(*), count(*) filter (where p.nationality_flag = 'uae'), count(*) filter (where p.gender = 'f') into n, emi, wom
    from (select distinct s.person_id from kafaa_successors s where s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null) d
    left join kafaa_people p on p.id = d.person_id;
  select count(*) filter (where s.readiness = 'ready_now'), count(*) filter (where s.readiness = '1_2y'), count(*) filter (where s.readiness = '3_5y') into r_now, r_12, r_35
    from kafaa_successors s where s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null;
  return jsonb_build_object(
    'slates', (select count(*) from kafaa_succession_slates),
    'confirmed', (select count(*) from kafaa_succession_slates where status = 'confirmed'),
    'with_ready_now', (select count(*) from kafaa_succession_slates sl where exists (select 1 from kafaa_successors s where s.slate_id = sl.id and s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null and s.readiness = 'ready_now')),
    'successors', case when n >= mg then n end,
    'emirati', case when n >= mg and emi >= mg then emi end,
    'women', case when n >= mg and wom >= mg then wom end,
    'emirati_pct', case when n >= mg and emi >= mg then round((emi * 100)::numeric / n)::int end,
    'women_pct', case when n >= mg and wom >= mg then round((wom * 100)::numeric / n)::int end,
    'by_readiness', jsonb_build_object('ready_now', case when r_now >= mg then r_now end, '1_2y', case when r_12 >= mg then r_12 end, '3_5y', case when r_35 >= mg then r_35 end),
    'min_group', mg);
end $$;
revoke execute on function kafaa_sx_aggregates() from public, anon, authenticated;
