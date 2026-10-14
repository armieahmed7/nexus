-- kafaa_ready_mirror_clock_p1 (1/1) · from kafaa/supabase/migrations/20261013200003_kafaa_ready_mirror_clock.sql (readiness fixes 2026-10-13, branch readiness-fixes)
-- Apply with apply_migration name "kafaa_ready_mirror_clock_p1", in ORDER.txt order. Idempotent; a second run changes nothing; kafaa_* objects only. See EXPECTED.md.
-- [Readiness fixes 2026-10-13 · finding 1] Mirror freshness clock (SQL mirror of src/domain/mirrorClock.ts).
--
-- The licence mirror rows were synced on 2-8 Oct 2026 (the demo snapshot) and freshness was judged against the wall clock, so from 11 Oct
-- every licence read "Not confirmed (stale sync)" and the licensing pages showed no valid licence at all, a little worse every day.
-- Freshness is now judged at kafaa_mirror_now() = least(now(), MIRROR_AS_OF): w-sro-05's licence (synced 2 Oct, 148 h before the
-- snapshot) stays the deliberately stale record, the others stay fresh, and a record synced after the snapshot (kafaa_set_licence_status,
-- kafaa_record_medical_date set last_synced = now()) counts as fresh. Expiry and due dates keep current_date. A deployment fed by live
-- connectors redefines kafaa_mirror_now() as now() (and sets MIRROR_AS_OF = null in the TS file).
-- Redefines the two SQL readers of the 72-hour rule with that clock and nothing else changed:
--   kafaa_crew_availability()  (from 20261008131000_kafaa_g1_quals_licensing.sql; TS mirror LocalRpc.crewAvailability)
--   kafaa_sc_available(text)   (from 20261009121001_kafaa_w2e1_checkins.sql; TS mirror availabilityOf in src/modules/m17/checkins.ts)
-- Same signatures, owners and grants. Idempotent (create or replace).

create or replace function kafaa_mirror_now() returns timestamptz language sql stable set search_path = public as $$
  select least(now(), timestamptz '2026-10-08 08:00:00+00')
$$;
revoke all on function kafaa_mirror_now() from public, anon, authenticated; -- internal: read by the SECURITY DEFINER functions below

-- ───────────── M03 · crew availability for shift supervisors: available / not available only (null when the sync is stale)
create or replace function kafaa_crew_availability() returns table (person_id text, available boolean) language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('licence', array['Scope','R','W','Own']) then raise exception 'Kafa''a · crew availability is restricted' using errcode = '42501'; end if;
  return query
    select l.person_id,
           case when kafaa_mirror_now() - l.last_synced > interval '72 hours' then null
                else (l.status = 'valid' and l.expires_on >= current_date and coalesce((select m.due_on >= current_date from kafaa_medical_due m where m.person_id = l.person_id), false)) end
      from kafaa_licences l
     where kafaa_rule_read('licence', l.person_id, null::text, true);
end $$;

-- availabilityOf (crew view): no licence mirror row = available; stale sync (> 72 h at the mirror clock) = unknown; else valid, unexpired,
-- medically in date.
create or replace function kafaa_sc_available(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select case when l.id is null then true
              when kafaa_mirror_now() - l.last_synced > interval '72 hours' then null
              else (l.status = 'valid' and l.expires_on >= current_date
                    and coalesce((select m.due_on >= current_date from kafaa_medical_due m where m.person_id = p_person order by m.id collate "C" limit 1), false)) end
  from (select 1) d left join lateral (select * from kafaa_licences x where x.person_id = p_person order by x.id collate "C" limit 1) l on true
$$;
