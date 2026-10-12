-- kafaa_fs63_taxonomy_governance_p2 (2/2) · from supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql
-- Apply with apply_migration name "kafaa_fs63_taxonomy_governance_p2". Additive and idempotent; kafaa_* objects only.
-- Staleness and the orphan-rate audit as of a day (= taxonomyHealth): per live skill (sorted by id) the review state and what teaches,
-- assesses or requires it ("taught by" = TAUGHT_BY), plus the summary.
create or replace function kafaa_fs63_health(p_day date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb; v_sum jsonb;
begin
  with
  crs as (select id from kafaa_courses),
  std as (select id from kafaa_qual_standards where status = 'current'),
  ccomp as (select distinct unnest(competency_ids) k from kafaa_courses),
  linked as (select distinct skill_id k from kafaa_course_skill_links where coalesce(active, true)),
  pw as (select distinct skill_id k from kafaa_pathways where status = 'published'),
  asm as (
    select unnest(skill_ids) k from kafaa_adaptive_banks where status = 'active'
    union select skill_id from kafaa_adaptive_items where status = 'active'
    union select unnest(skill_ids) from kafaa_performance_tasks where status = 'active'
    union select unnest(skill_ids) from kafaa_twin_scenarios where status = 'published'
    union select skill_id from kafaa_ai_drills where status = 'published'
    union select unnest(skill_ids) from kafaa_fitness_areas),
  req as (
    select e ->> 'kind' kind, e ->> 'ref_id' ref from kafaa_role_profile_versions v, jsonb_array_elements(case when jsonb_typeof(v.requirements) = 'array' then v.requirements else '[]'::jsonb end) e
    where v.status = 'published' and v.path_only is not true and jsonb_typeof(e) = 'object'),
  rskill as (select ref k from req where kind = 'skill' union select skill_id from kafaa_jta_task_skills where coalesce(active, true)),
  rcomp as (select ref k from req where kind = 'competency' union select competency_id from kafaa_role_competencies),
  flags as (
    select s.id, s.review_due,
      (exists (select 1 from crs where crs.id = any(coalesce(s.evidence_keys, '{}'))) or exists (select 1 from linked where linked.k = s.id) or (s.core and exists (select 1 from ccomp where ccomp.k = s.competency_id))) course,
      exists (select 1 from pw where pw.k = s.id) pathway,
      (exists (select 1 from std where std.id = any(coalesce(s.evidence_keys, '{}'))) or exists (select 1 from asm where asm.k = s.id)) assessment,
      (exists (select 1 from rskill where rskill.k = s.id) or (s.core and exists (select 1 from rcomp where rcomp.k = s.competency_id))) role,
      case when s.review_due is null then 'none' when s.review_due < p_day then 'overdue' when s.review_due - p_day <= 90 then 'due_soon' else 'ok' end review
    from kafaa_skills s where s.lifecycle is distinct from 'obsolete'),
  rows as (select f.*, (f.course or f.pathway or f.assessment) taught from flags f)
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', id, 'review', review, 'days_overdue', case when review = 'overdue' then p_day - review_due end,
      'course', course, 'pathway', pathway, 'assessment', assessment, 'role', role, 'taught', taught, 'orphan', not taught and not role) order by id collate "C"), '[]'::jsonb),
    jsonb_build_object('as_of', to_char(p_day, 'YYYY-MM-DD'), 'skills', (select count(*) from kafaa_skills), 'live', count(*),
      'overdue', count(*) filter (where review = 'overdue'), 'due_soon', count(*) filter (where review = 'due_soon'), 'no_review', count(*) filter (where review = 'none'),
      'stale_rate', case when count(*) > 0 then round((count(*) filter (where review = 'overdue'))::numeric / count(*), 4) end,
      'no_course', count(*) filter (where not course), 'no_pathway', count(*) filter (where not pathway), 'no_assessment', count(*) filter (where not assessment),
      'no_role', count(*) filter (where not role), 'untaught', count(*) filter (where not taught), 'orphans', count(*) filter (where not taught and not role),
      'orphan_rate', case when count(*) > 0 then round((count(*) filter (where not taught and not role))::numeric / count(*), 4) end)
  into v_rows, v_sum from rows;
  return jsonb_build_object('summary', v_sum, 'skills', v_rows);
end $$;

-- ═════════════ FS55 ranked-surface fairness (= surfaceOutcomes / surfaceSnapshot in src/modules/m16/surfaces.ts)
-- Population: kafaa_fairness_base (active staff with a job role, hired by the day). Rows per metric through kafaa_fairness_rows (F24 rules),
-- re-keyed sf:<ISO week>:<metric>:<dimension>:<group> and tagged with the engine card.
create or replace function kafaa_fs63_fairness_compute(p_as_of date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_period text := to_char(p_as_of, 'IYYY-"W"IW'); v_cut timestamptz := (p_as_of + 1)::timestamp at time zone 'UTC'; v_out jsonb := '[]'::jsonb; m record; v_hit text[]; v_people text[]; v_pos boolean[];
begin
  select coalesce(array_agg(b.id order by b.id), '{}') into v_people from kafaa_fairness_base(p_as_of) b(id);
  for m in select * from (values
    (1, 'digest_suggested', 'digest', 'digest_runs'), (2, 'career_mode_used', 'dalil_career', 'advisor_sessions'), (3, 'pathway_enrolled', 'pathways', 'pathway_enrolments'),
    (4, 'external_completed', 'externals', 'external_completions'), (5, 'fitness_completed', 'fitness', 'fitness_attempts'), (6, 'gig_selected', 'future_gigs', 'opportunity_applications'),
    (7, 'twin_passed', 'twin_drills', 'twin_attempts'), (8, 'adaptive_completed', 'adaptive', 'adaptive_attempts'), (9, 'instructor_nominated', 'instructors', 'instructor_tracks')) x(n, metric, card, source) order by n
  loop
    v_hit := case m.metric
      when 'digest_suggested' then array(select distinct r.person_id from kafaa_digest_runs r where r.as_of <= p_as_of
        and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(r.items) = 'array' then r.items else '[]'::jsonb end) i where jsonb_typeof(i) = 'object' and i ->> 'kind' in ('opportunity', 'coach')))
      when 'career_mode_used' then array(select distinct a.person_id from kafaa_advisor_sessions a where a.mode = 'staff' and a.submode = 'career' and a.started_at < v_cut and a.person_id is not null)
      when 'pathway_enrolled' then array(select distinct e.person_id from kafaa_pathway_enrolments e where e.started_on <= p_as_of and (e.withdrawn_on is null or e.withdrawn_on > p_as_of))
      when 'external_completed' then array(select distinct c.person_id from kafaa_external_completions c where c.completed_on <= p_as_of)
      when 'fitness_completed' then array(select distinct f.person_id from kafaa_fitness_attempts f where f.status = 'completed' and f.completed_at < v_cut)
      when 'gig_selected' then array(select distinct a.person_id from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
        where o.channel is not null and kafaa_fairness_hist_status(a.history, v_cut) in ('selected', 'completed'))
      when 'twin_passed' then array(select distinct t.person_id from kafaa_twin_attempts t where t.passed and t.submitted_at < v_cut)
      when 'adaptive_completed' then array(select distinct t.person_id from kafaa_adaptive_attempts t where t.status = 'completed' and t.completed_at < v_cut)
      else array(select distinct t.person_id from kafaa_instructor_tracks t where t.started_on <= p_as_of) end;
    select coalesce(array_agg(p = any(v_hit) order by p), '{}') into v_pos from unnest(v_people) p;
    v_out := v_out || (select coalesce(jsonb_agg(x || jsonb_build_object('id', 'sf' || substr(x ->> 'id', 3), 'card', m.card) order by i), '[]'::jsonb)
      from jsonb_array_elements(kafaa_fairness_rows(v_period, p_as_of, m.metric, m.card, m.source, v_people, v_pos)) with ordinality z(x, i));
  end loop;
  return v_out;
end $$;

-- ═════════════ RPCs

-- FS54: propose a change (skills_taxonomy W: staff). Audited; no ledger (only council decisions are material).
create or replace function kafaa_propose_skill_change(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_c text; v_id text; v_kind text; v_sid text; t kafaa_skills; v_title jsonb; a kafaa_audit_events; q jsonb;
begin
  p := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
  v_kind := kafaa_fs63_str(p -> 'kind');
  v_sid := case when jsonb_typeof(p -> 'skill_id') = 'string' then p ->> 'skill_id' end;
  q := case when jsonb_typeof(p -> 'proposal') = 'object' then p -> 'proposal' else '{}'::jsonb end;
  if me is null then return kafaa_refuse('skills.propose_change', 'skill_change_requests', v_sid, 'not_signed_in', kafaa_fs63_msg('not_signed_in')); end if;
  v_role := kafaa_acting_role('skills_taxonomy', array['W']);
  if v_role is null then return kafaa_refuse('skills.propose_change', 'skill_change_requests', v_sid, 'forbidden', kafaa_fs63_msg('forbidden_propose')); end if;
  v_c := kafaa_fs63_propose_problem(p);
  if v_c is not null then return kafaa_refuse('skills.propose_change', 'skill_change_requests', v_sid, kafaa_fs63_code(v_c), kafaa_fs63_msg(v_c), v_role); end if;
  perform pg_advisory_xact_lock(hashtext('kafaa_skill_change_requests'));
  v_id := kafaa_fs63_next_id('scr', array(select id from kafaa_skill_change_requests));
  if v_kind <> 'add' then select * into t from kafaa_skills where id = v_sid; end if;
  v_title := kafaa_fs63_title(v_kind, t.name_en, t.name_ar, q);
  insert into kafaa_skill_change_requests (id, kind, skill_id, title_en, title_ar, proposal, rationale, development, assessment, inclusion, status, proposed_by, proposed_role, proposed_at, votes,
    first_by, first_decision, second_by, decided_at, change_id, updated_at)
  values (v_id, v_kind, case when v_kind = 'add' then null else v_sid end, v_title ->> 'en', v_title ->> 'ar', q, kafaa_fs63_clean(p -> 'rationale'), kafaa_fs63_clean(p -> 'development'),
    kafaa_fs63_clean(p -> 'assessment'), kafaa_fs63_inclusion(p), 'submitted', me, v_role, now(), '[]'::jsonb, null, null, null, null, null, now());
  a := kafaa_audit('skills.propose_change', 'skill_change_requests', v_id, 'ok', v_kind || ' ' || coalesce(v_sid, kafaa_fs63_clean(q -> 'name_en')), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Change request sent to the skills council', a, null, jsonb_build_object('id', v_id, 'status', 'submitted', 'title_en', v_title ->> 'en', 'title_ar', v_title ->> 'ar'));
end $$;

-- FS54: a council vote (skills_taxonomy A). Maker-checker; every vote writes a ledger row; the second agreeing approval publishes the change.
create or replace function kafaa_decide_skill_change(p_id text, p_decision text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; r kafaa_skill_change_requests; v_c text; v_status text; v_final boolean; v_publish boolean; v_vote jsonb; v_votes jsonb; v_change jsonb; v_cid text;
  v_first_role text; v_what text; v_action text; v_msg text; l integer; a kafaa_audit_events; v_now text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if me is null then return kafaa_refuse('skills.decide_change', 'skill_change_requests', p_id, 'not_signed_in', kafaa_fs63_msg('not_signed_in')); end if;
  v_role := kafaa_acting_role('skills_taxonomy', array['A']);
  if v_role is null then return kafaa_refuse('skills.decide_change', 'skill_change_requests', p_id, 'forbidden', kafaa_fs63_msg('forbidden_decide')); end if;
  select * into r from kafaa_skill_change_requests where id = p_id for update;
  v_c := kafaa_fs63_decide_problem(r, me, p_decision, p_note);
  if v_c is not null then return kafaa_refuse('skills.decide_change', 'skill_change_requests', p_id, kafaa_fs63_code(v_c), kafaa_fs63_msg(v_c), v_role); end if;
  -- the vote's outcome (= voteOutcome)
  if r.status = 'submitted' then v_status := case when p_decision = 'approve' then 'first_approved' else 'first_rejected' end; v_final := false; v_publish := false;
  elsif r.first_decision = p_decision then v_status := case when p_decision = 'approve' then 'published' else 'rejected' end; v_final := true; v_publish := p_decision = 'approve';
  else v_status := 'submitted'; v_final := false; v_publish := false; end if;
  if v_publish and exists (select 1 from jsonb_array_elements(kafaa_fs63_inclusion(jsonb_build_object('kind', r.kind, 'skill_id', r.skill_id, 'proposal', r.proposal, 'rationale', r.rationale,
      'development', r.development, 'assessment', r.assessment))) c where not (c ->> 'ok')::boolean) then
    return kafaa_refuse('skills.decide_change', 'skill_change_requests', r.id, 'conflict', kafaa_fs63_msg('stale'), v_role);
  end if;
  v_vote := jsonb_build_object('by', me, 'role', v_role, 'decision', p_decision, 'note', nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), ''), 'at', v_now);
  v_votes := (case when jsonb_typeof(r.votes) = 'array' then r.votes else '[]'::jsonb end) || jsonb_build_array(v_vote);
  if v_publish then
    perform pg_advisory_xact_lock(hashtext('kafaa_skill_changes'));
    v_change := kafaa_fs63_apply(r, current_date);
    v_cid := kafaa_fs63_next_id('sc', array(select id from kafaa_skill_changes));
    select v ->> 'role' into v_first_role from jsonb_array_elements(v_votes) v where v ->> 'by' = r.first_by limit 1;
    insert into kafaa_skill_changes (id, request_id, kind, skill_id, skill_code, skill_name_en, skill_name_ar, summary_en, summary_ar, before, after, version_before, version_after, new_skill_ids,
      replaced_by, effective_on, methodology, dashboards, decided_roles, proposed_role, published_at, ledger_seq, sources)
    values (v_cid, r.id, v_change ->> 'kind', v_change ->> 'skill_id', v_change ->> 'skill_code', v_change ->> 'skill_name_en', v_change ->> 'skill_name_ar', v_change ->> 'summary_en', v_change ->> 'summary_ar',
      v_change -> 'before', v_change -> 'after', (v_change ->> 'version_before')::int, (v_change ->> 'version_after')::int, array(select jsonb_array_elements_text(v_change -> 'new_skill_ids')),
      v_change ->> 'replaced_by', (v_change ->> 'effective_on')::date, (v_change ->> 'methodology')::boolean, array(select jsonb_array_elements_text(v_change -> 'dashboards')),
      array_remove(array[v_first_role, v_role], null), r.proposed_role, now(), null, v_change -> 'sources');
  end if;
  if r.status = 'submitted' then
    update kafaa_skill_change_requests set status = v_status, votes = v_votes, first_by = me, first_decision = p_decision, updated_at = now() where id = r.id;
  elsif v_final then
    update kafaa_skill_change_requests set status = v_status, votes = v_votes, second_by = me, decided_at = now(), change_id = v_cid, updated_at = now() where id = r.id;
  else
    update kafaa_skill_change_requests set status = v_status, votes = v_votes, first_by = null, first_decision = null, updated_at = now() where id = r.id;
  end if;
  v_what := case when v_status = 'published' then 'published' when v_status = 'rejected' then 'rejected' when r.status = 'submitted' then 'first ' || p_decision else 'votes differ, back to submitted' end;
  v_action := case v_status when 'published' then 'kafaa.skills.change_published' when 'rejected' then 'kafaa.skills.change_rejected' else 'kafaa.skills.council_vote' end;
  v_msg := case when v_status = 'published' then 'Change published to the catalogue and the public change log' when v_status = 'rejected' then 'Request rejected by two council members'
    when r.status = 'submitted' then case when p_decision = 'approve' then 'First approval recorded: a second council member decides' else 'First rejection recorded: a second council member confirms or overturns it' end
    else 'Votes differ: the request goes back to the council for a fresh pair of decisions' end;
  l := kafaa_ledger(v_action, format('Skills council %s on %s (%s%s): %s; maker-checker, two different council members', p_decision, r.id, r.kind, coalesce(' ' || r.skill_id, ''), v_what));
  a := kafaa_audit('skills.decide_change', 'skill_change_requests', r.id, 'ok', p_decision || ': ' || v_what, case when l is null then 'skipped' else 'written' end, l, v_role);
  if v_cid is not null then update kafaa_skill_changes set ledger_seq = l where id = v_cid; end if;
  return kafaa_result(true, 'ok', v_msg, a, l, jsonb_build_object('id', r.id, 'status', v_status, 'change_id', v_cid,
    'new_skill_ids', case when v_change is null then '[]'::jsonb else v_change -> 'new_skill_ids' end));
end $$;

-- FS54: the council queue (skills_taxonomy A, or auditors through audit_log R): every request, newest first.
create or replace function kafaa_skill_council_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('skills_taxonomy', array['A']) and not kafaa_has_grant('audit_log', array['R']) then raise exception 'Kafa''a · %', kafaa_fs63_msg('forbidden_queue') using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.proposed_at desc, r.id collate "C" desc) from kafaa_skill_change_requests r), '[]'::jsonb);
end $$;

-- FS54: staleness and the orphan-rate audit of the live catalogue (signed-in readers).
create or replace function kafaa_taxonomy_health() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null then raise exception 'Kafa''a · %', kafaa_fs63_msg('not_signed_in') using errcode = '42501'; end if;
  return kafaa_fs63_health(current_date);
end $$;

-- FS55: store the ranked-surface fairness snapshot (integrations A); audited and ledgered like the F24 snapshot.
create or replace function kafaa_run_surface_fairness(p_as_of date default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); v_day date := coalesce(p_as_of, current_date); v_rows jsonb; v_period text; v_flag integer; v_sup integer; l integer; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('fairness.surface_snapshot', 'surface_fairness', v_day::text, 'forbidden', 'Only a platform admin or AI governance lead may run the fairness snapshot'); end if;
  if v_day > current_date or v_day < current_date - 366 then return kafaa_refuse('fairness.surface_snapshot', 'surface_fairness', v_day::text, 'invalid', 'Choose a date within the last year', v_role); end if;
  v_rows := kafaa_fs63_fairness_compute(v_day);
  v_period := to_char(v_day, 'IYYY-"W"IW');
  insert into kafaa_surface_fairness (id, period, as_of, card, metric, dimension, group_key, n, positives, rate, ratio, suppressed, flagged, source, run_by, created_at)
  select x ->> 'id', x ->> 'period', (x ->> 'as_of')::date, x ->> 'card', x ->> 'metric', x ->> 'dimension', x ->> 'group_key', (x ->> 'n')::integer, (x ->> 'positives')::integer,
         (x ->> 'rate')::numeric, (x ->> 'ratio')::numeric, (x ->> 'suppressed')::boolean, (x ->> 'flagged')::boolean, x ->> 'source', kafaa_me(), now()
  from jsonb_array_elements(v_rows) x
  on conflict (id) do update set period = excluded.period, as_of = excluded.as_of, card = excluded.card, metric = excluded.metric, n = excluded.n, positives = excluded.positives, rate = excluded.rate,
    ratio = excluded.ratio, suppressed = excluded.suppressed, flagged = excluded.flagged, source = excluded.source, run_by = excluded.run_by, created_at = excluded.created_at;
  select count(distinct (x ->> 'metric') || ':' || (x ->> 'dimension')) filter (where (x ->> 'flagged')::boolean), count(distinct (x ->> 'metric') || ':' || (x ->> 'dimension')) filter (where (x ->> 'suppressed')::boolean)
    into v_flag, v_sup from jsonb_array_elements(v_rows) x;
  l := kafaa_ledger('kafaa.ai.surface_fairness', format('Ranked-surface fairness snapshot %s (as of %s): %s comparisons below four-fifths, %s suppressed', v_period, v_day, v_flag, v_sup));
  a := kafaa_audit('fairness.surface_snapshot', 'surface_fairness', v_period, 'ok', format('%s: %s rows, %s flagged, %s suppressed', v_period, jsonb_array_length(v_rows), v_flag, v_sup),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Ranked-surface fairness snapshot saved', a, l, jsonb_build_object('period', v_period, 'as_of', to_char(v_day, 'YYYY-MM-DD'), 'rows', jsonb_array_length(v_rows),
    'flagged', v_flag, 'suppressed', v_sup));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_fs63_msg(text), kafaa_fs63_code(text), kafaa_fs63_str(jsonb), kafaa_fs63_clean(jsonb), kafaa_fs63_blank(jsonb), kafaa_fs63_https(jsonb), kafaa_fs63_norm(text),
  kafaa_fs63_level_ok(jsonb), kafaa_fs63_name_ok(jsonb, jsonb), kafaa_fs63_parts(jsonb), kafaa_fs63_inclusion(jsonb), kafaa_fs63_propose_problem(jsonb),
  kafaa_fs63_decide_problem(kafaa_skill_change_requests, text, text, text), kafaa_fs63_title(text, text, text, jsonb), kafaa_fs63_next_id(text, text[]), kafaa_fs63_essence(int, text, text),
  kafaa_fs63_snapshot(kafaa_skills), kafaa_fs63_sources(jsonb), kafaa_fs63_review_due(date, text), kafaa_fs63_apply(kafaa_skill_change_requests, date), kafaa_fs63_health(date),
  kafaa_fs63_fairness_compute(date) from public, anon, authenticated;
revoke all on function kafaa_propose_skill_change(jsonb), kafaa_decide_skill_change(text, text, text), kafaa_skill_council_queue(), kafaa_taxonomy_health(), kafaa_run_surface_fairness(date) from public, anon;
grant execute on function kafaa_propose_skill_change(jsonb), kafaa_decide_skill_change(text, text, text), kafaa_skill_council_queue(), kafaa_taxonomy_health(), kafaa_run_surface_fairness(date) to authenticated;
