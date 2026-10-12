-- kafaa_fs7qa_integration_p1 (1/1) · from supabase/migrations/20261010279001_kafaa_fs7qa_integration.sql
-- Apply with apply_migration name "kafaa_fs7qa_integration_p1". Additive and idempotent; kafaa_* objects only.
-- [FS QA · wave G integration] Cross-feature wiring of FS60-FS69 on the integration branch, plus the FS48 mentoring engine card carried over
-- from wave E. Additive and idempotent: one create-or-replace of an existing kafaa_* function with its signature and grants unchanged, and one
-- guarded data statement that changes a single row only while it still holds the exact state it was written for (a second run, or a run on
-- the local seed, changes nothing). Nothing is removed; no NEXUS object or row is touched; no table, column, policy or trigger is created.
-- Proof: scripts/validate/fsqa7-integration.mjs (PGlite: SQL = TS, idempotence, the card update on a v13 card). Tests:
-- tests/unit/fsqa7-integration.test.tsx. Seed invariants: scripts/seed/ext/fsqa7-integration.mjs (FINALIZE_LAST).
--   Wiring that needs no SQL here (proved by the validator on the final seed):
--   - FS60 inputs: kafaa_compute_disclosure reproduces both stored quarters from FS50 progress, FS09/FS36 AI-fundamentals coverage, training
--     records and xAPI learning hours and FS30 credits (the stored values equal the formula after every wave-G seed builder).
--   - FS61: the adoption reference is the Future Skills Centre figure read from kafaa_benchmarks (kafaa_spl_reference), never typed.
--   - FS62: the FS41 Net Zero competences, the FS02 Jahiz groups (skills.future_group) and the FS09/FS36 AI target are linked as data
--     (kafaa_na_links derives the first two at read time). FS74's future target (wave H) joins in the wave-H file.
--   - FS64 <- FS51: kafaa_regional_demand holds only released, suppressed aggregates of released forecasts; partners never read
--     kafaa_skill_forecasts.
--   - FS66 <- FS57/FS08: coverage runs on the FS57 SQL twins; evidence at hire (kind credential, ref_table programme_alignments) is recorded
--     evidence by kind, so kafaa_skill_states_v2 / kafaa_skills_apply keep it without a redefinition (the FS29 / FS31 precedent).
--   - Partner isolation: alnoor-gm and gulfhydro-qa never read each other's FS64 commitments, FS65 pledges or FS68 readiness.
--   1. FS69 -> FS32: the public verify page labels a contractor pre-arrival share (consents.purpose = 'prearrival').
--   2. FS48 (carried over from wave E): the mentoring engine card moves from version 13 to 14 with the FS48 wording, on live only.

-- 1. FS69 -> FS32 verify page. Copied from the fs43 body (20261010243001); the only change is the 'purpose' key on an active link
--    (= sharePurpose() in src/modules/m17/learnerRecord.ts). Expired and revoked links still return nothing about the holder.
create or replace function kafaa_verify_record_share(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok text := left(btrim(coalesce(p_token, '')), 64); s kafaa_record_shares; v_status text; v_clr jsonb; a kafaa_audit_events; v_day text := to_char(current_date, 'YYYY-MM-DD');
begin
  if v_tok <> '' then select * into s from kafaa_record_shares where token = v_tok; end if;
  if (s.id is not null and (select count(*) from kafaa_audit_events e where e.action = 'record.verify' and e.ts > now() - interval '1 minute' and e.entity_id = s.id) >= 20)
     or (select count(*) from kafaa_audit_events e where e.action = 'record.verify' and e.ts > now() - interval '1 minute') >= 600 then
    return kafaa_refuse('record.verify', 'record_shares', s.id, 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  if s.id is null then return kafaa_refuse('record.verify', 'record_shares', null, 'not_found', 'No Kafa''a learner record has this link'); end if;
  v_status := case when s.revoked_at is not null then 'revoked' when s.expires_on < current_date then 'expired' else 'active' end;
  if v_status <> 'active' then
    a := kafaa_audit('record.verify', 'record_shares', s.id, 'ok', v_status, 'not_applicable', null, null);
    return kafaa_result(true, 'ok', 'This link is no longer active', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'notice', 'This link is no longer active'));
  end if;
  update kafaa_record_shares set views = views + 1, last_viewed_at = now() where id = s.id;
  v_clr := kafaa_lr_bundle(s.person_id, s.items, current_date, s.id, s.expires_on);
  a := kafaa_audit('record.verify', 'record_shares', s.id, 'ok', v_status, 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Learner record found', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'expires_on', to_char(s.expires_on, 'YYYY-MM-DD'),
    'holder_initials', v_clr #>> '{credentialSubject,holderInitials}', 'item_count', jsonb_array_length(v_clr -> 'kafaaItems'), 'clr', v_clr, 'notice', 'Learner record found',
    'purpose', coalesce(nullif(s.consents ->> 'purpose', ''), 'record')));
end $$;
revoke execute on function kafaa_verify_record_share(text) from public;
grant execute on function kafaa_verify_record_share(text) to authenticated, anon;

-- 2. F24 mentoring engine card: the FS48 wording as version 14. Live holds the card at version 13 (the version follows the live engine
--    change log); the wave-F FS55 file reconciles its content columns to the seeded FS48 text but leaves the version alone, so the FS48 change
--    is recorded here as one version step. Guarded on version 13: a second run, a card that has moved on, or the local seed (version 2, where
--    the FS48 builder already wrote this text) changes nothing. The content parts only add what is missing (the same text as the local card in
--    scripts/seed/ext/fs46-future-leadership.mjs), so the row ends identical whether or not the FS55 reconciliation ran first. Engine cards keep
--    no content history (kafaa_engine_changes logs engine settings, not card text): the v13 text differs only by these additions.
update kafaa_engine_cards c set
  scoring_functions = c.scoring_functions || array(select f from unnest(array['src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']::text[]) f
                                                   where not (f = any(c.scoring_functions))),
  inputs_used = case when exists (select 1 from jsonb_array_elements(c.inputs_used) x where x ->> 'key' = 'wfn_participants') then c.inputs_used
    else c.inputs_used || '[{"key":"wfn_participants","en":"Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers","ar":"المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة"}]'::jsonb end,
  limitations_en = case when position('(FS48)' in c.limitations_en) > 0 then c.limitations_en
    else rtrim(c.limitations_en) || ' Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.' end,
  limitations_ar = case when position('(FS48)' in c.limitations_ar) > 0 then c.limitations_ar
    else rtrim(c.limitations_ar) || ' تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.' end,
  version = 14,
  last_changed_at = '2026-10-11T00:00:00Z'::timestamptz
where c.id = 'mentoring' and c.version = 13;
