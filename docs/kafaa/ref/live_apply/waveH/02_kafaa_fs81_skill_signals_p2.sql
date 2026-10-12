-- kafaa_fs81_skill_signals_p2 (2/2) · from supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql
-- Apply with apply_migration name "kafaa_fs81_skill_signals_p2". Additive and idempotent; kafaa_* objects only.
-- ═════════════ FS72 rules (mirror of src/modules/m28/suggestions.ts). Internal: not executable by API roles.
-- inferSuggestions(): one person's suggestions on a day, strongest first (at most 6)
create or replace function kafaa_ssg_candidates(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n integer; v_from date := p_today - 365; v_out jsonb;
begin
  select count(*)::int into v_n from kafaa_people where kind = 'staff' and status = 'active' and id <> p_person;
  with
  held as (select ps.skill_id, ps.level, coalesce(ps.basis, '') basis from kafaa_person_skills ps where ps.person_id = p_person and ps.active and ps.level >= 1),
  hold as (select ps.skill_id, ps.person_id from kafaa_person_skills ps join kafaa_people pe on pe.id = ps.person_id
           where ps.active and ps.level >= 1 and pe.kind = 'staff' and pe.status = 'active' and ps.person_id <> p_person),
  hcount as (select h.skill_id, count(*)::int n from hold h group by 1),
  elig as (select s.id from kafaa_skills s where not exists (select 1 from held where held.skill_id = s.id) and s.area is distinct from 'security' and s.lifecycle is distinct from 'obsolete'
           and not exists (select 1 from kafaa_skill_suggestions g where g.person_id = p_person and g.skill_id = s.id
                           and (g.status = 'confirmed' or (g.status in ('rejected', 'not_me') and g.suppressed_until is not null and p_today < g.suppressed_until)))),
  gig as (select distinct on (x.s) x.s skill, 30 pts, jsonb_build_object('code', 'gig', 'key', 'm28.ssg.reason.gig', 'vars',
            jsonb_build_object('gig', jsonb_build_object('en', coalesce(o.title_en, o.id), 'ar', coalesce(o.title_ar, o.id)))) r
          from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
          cross join lateral unnest(o.skills_needed || o.skills_gained) with ordinality x(s, i)
          where a.person_id = p_person and a.status = 'completed'
            and not (jsonb_typeof(a.outcome_levels) = 'object' and a.outcome_levels ? x.s) and exists (select 1 from elig where elig.id = x.s)
          order by x.s, a.opportunity_id collate "C", x.i),
  ctb as (select distinct on (n.nid) n.nid skill, 25 pts, jsonb_build_object('code', 'contribution', 'key', 'm28.ssg.reason.contribution', 'vars',
            jsonb_build_object('title', jsonb_build_object('en', coalesce(c.title_en, c.id), 'ar', coalesce(c.title_ar, c.id)), 'skill', jsonb_build_object('en', s.name_en, 'ar', s.name_ar))) r
          from kafaa_contributions c cross join lateral unnest(c.skill_ids) with ordinality cs(sid, ci) join kafaa_skills s on s.id = cs.sid
          cross join lateral unnest(s.adjacent_ids) with ordinality n(nid, ni)
          where c.person_id = p_person and c.status = 'validated' and exists (select 1 from elig where elig.id = n.nid)
          order by n.nid, c.id collate "C", cs.ci, n.ni),
  xst as (select x.object_type, x.object_id, x.verb, x.result from kafaa_xapi_statements x
          where x.actor_person_id = p_person and (x.occurred_at at time zone 'UTC')::date > v_from and (x.occurred_at at time zone 'UTC')::date <= p_today),
  xs as (select cs.id skill, 1 rf, 0 ot from xst x join kafaa_skills cs on cs.core and cs.competency_id = x.object_id
           where x.object_type = 'refresher' and x.verb = 'answered' and (x.result -> 'success') = 'true'::jsonb
         union all
         select cs.id, 0, 1 from xst x join kafaa_sim_scenarios sc on sc.id = x.object_id cross join lateral unnest(sc.competency_ids) cc(cid) join kafaa_skills cs on cs.core and cs.competency_id = cc.cid
           where x.object_type = 'scenario' and x.verb = 'completed'
         union all
         select ka.sid, 0, 1 from xst x join kafaa_knowledge_assets k on k.id = x.object_id cross join lateral unnest(k.skill_ids) ka(sid)
           where x.object_type = 'knowledge_asset' and x.verb = 'experienced'),
  xa as (select xs.skill, 20 pts, jsonb_build_object('code', 'xapi', 'key', 'm28.ssg.reason.xapi', 'vars', jsonb_build_object('n', sum(xs.rf) + sum(xs.ot))) r
         from xs where exists (select 1 from elig where elig.id = xs.skill) group by xs.skill having sum(xs.rf) >= 3 or sum(xs.ot) >= 1),
  pairs as (select a.skill_id a, b.skill_id b, count(*)::int both_n from hold a join hold b on b.person_id = a.person_id and b.skill_id <> a.skill_id
            where exists (select 1 from held where held.skill_id = a.skill_id) group by 1, 2),
  co as (select distinct on (p.b) p.b skill, least(30, floor(lf.l / 10))::int pts, jsonb_build_object('code', 'co_occurrence', 'key', 'm28.ssg.reason.co_occurrence', 'vars',
            jsonb_build_object('skill', jsonb_build_object('en', coalesce(sa.name_en, p.a), 'ar', coalesce(sa.name_ar, p.a)), 'pct', floor((p.both_n * 200 + ha.n)::numeric / (2 * ha.n))::int,
              'lift', round(lf.l::numeric / 100, 2))) r
         from pairs p join hcount ha on ha.skill_id = p.a join hcount hb on hb.skill_id = p.b left join kafaa_skills sa on sa.id = p.a
         cross join lateral (select floor((p.both_n::numeric * v_n * 200 + ha.n * hb.n) / (2 * ha.n * hb.n))::int l) lf
         where ha.n >= 10 and hb.n >= 10 and p.both_n >= 5 and lf.l >= 150 and exists (select 1 from elig where elig.id = p.b)
         order by p.b, lf.l desc, p.a collate "C"),
  adj as (select distinct on (n.nid) n.nid skill, (15 + case when h.level >= 3 then 5 else 0 end) pts, jsonb_build_object('code', 'adjacency', 'key', 'm28.ssg.reason.adjacency', 'vars',
            jsonb_build_object('skill', jsonb_build_object('en', s.name_en, 'ar', s.name_ar), 'level', h.level)) r
          from held h join kafaa_skills s on s.id = h.skill_id cross join lateral unnest(s.adjacent_ids) with ordinality n(nid, ni)
          where h.level >= 2 and h.basis in ('verified', 'evidenced', 'validated') and exists (select 1 from elig where elig.id = n.nid)
          order by n.nid, h.level desc, h.skill_id collate "C", n.ni),
  src as (select skill, 'gig' src, 1 o, pts, r from gig union all select skill, 'contribution', 2, pts, r from ctb union all select skill, 'xapi', 3, pts, r from xa
          union all select skill, 'co_occurrence', 4, pts, r from co union all select skill, 'adjacency', 5, pts, r from adj),
  agg as (select src.skill, least(100, sum(src.pts))::int score, jsonb_agg(to_jsonb(src.src) order by src.o) srcs, jsonb_agg(src.r order by src.o) reasons,
            bool_or(src.src in ('gig', 'contribution')) strong from src group by src.skill),
  top as (select * from agg where agg.score >= 30 order by agg.score desc, agg.skill collate "C" limit 6)
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', top.skill, 'score', top.score, 'level', case when top.strong or top.score >= 60 then 2 else 1 end, 'sources', top.srcs, 'reasons', top.reasons)
           order by top.score desc, top.skill collate "C"), '[]'::jsonb) into v_out from top;
  return v_out;
end $$;

-- the FS55 fairness snapshot of the surface (F24 population and group rules): staff reached by at least one suggestion by the day
create or replace function kafaa_ssg_fairness_compute(p_as_of date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_period text := to_char(p_as_of, 'IYYY-"W"IW'); v_people text[]; v_pos boolean[]; v_hit text[];
begin
  select coalesce(array_agg(b.id order by b.id), '{}') into v_people from kafaa_fairness_base(p_as_of) b(id);
  v_hit := array(select distinct g.person_id from kafaa_skill_suggestions g where g.first_on <= p_as_of);
  select coalesce(array_agg(p = any(v_hit) order by p), '{}') into v_pos from unnest(v_people) p;
  return (select coalesce(jsonb_agg((x - 'surface') || jsonb_build_object('id', 'ssf' || substr(x ->> 'id', 3), 'card', 'skill_suggestions') order by i), '[]'::jsonb)
    from jsonb_array_elements(kafaa_fairness_rows(v_period, p_as_of, 'suggestion_offered', 'skill_suggestions', 'skill_suggestions', v_people, v_pos)) with ordinality z(x, i));
end $$;

-- ───────────── FS72 RPCs
create or replace function kafaa_refresh_skill_suggestions() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_today date := current_date; v_c jsonb; c jsonb; cur kafaa_skill_suggestions; v_added integer := 0; v_exp integer := 0; v_open integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_suggestions.refresh', 'skill_suggestions', null, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('skill_suggestions.refresh', 'skill_suggestions', null, 'forbidden', kafaa_fs81_msg('ssg.forbidden')); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  v_c := kafaa_ssg_candidates(me, v_today);
  for c in select x from jsonb_array_elements(v_c) x loop
    select * into cur from kafaa_skill_suggestions where person_id = me and skill_id = c ->> 'skill_id';
    if cur.id is null then
      insert into kafaa_skill_suggestions (id, person_id, skill_id, status, level, score, sources, reasons, first_on, generated_on, responded_on, suppressed_until, evidence_id, history, version, updated_at)
      values ('ssg:' || me || ':' || (c ->> 'skill_id'), me, c ->> 'skill_id', 'open', (c ->> 'level')::integer, (c ->> 'score')::integer, array(select jsonb_array_elements_text(c -> 'sources')),
        c -> 'reasons', v_today, v_today, null, null, null, '[]'::jsonb, 1, now());
      v_added := v_added + 1;
    elsif cur.status in ('open', 'expired') then
      update kafaa_skill_suggestions set status = 'open', level = (c ->> 'level')::integer, score = (c ->> 'score')::integer, sources = array(select jsonb_array_elements_text(c -> 'sources')),
        reasons = c -> 'reasons', generated_on = v_today, version = cur.version + 1, updated_at = now() where id = cur.id;
      if cur.status = 'expired' then v_added := v_added + 1; end if;
    elsif cur.status in ('rejected', 'not_me') then
      update kafaa_skill_suggestions set status = 'open', level = (c ->> 'level')::integer, score = (c ->> 'score')::integer, sources = array(select jsonb_array_elements_text(c -> 'sources')),
        reasons = c -> 'reasons', generated_on = v_today, responded_on = null, suppressed_until = null,
        history = case when jsonb_typeof(cur.history) = 'array' then cur.history else '[]'::jsonb end || jsonb_build_array(jsonb_build_object('status', cur.status, 'responded_on', to_char(cur.responded_on, 'YYYY-MM-DD'))),
        version = cur.version + 1, updated_at = now() where id = cur.id;
      v_added := v_added + 1;
    end if;
  end loop;
  with gone as (update kafaa_skill_suggestions g set status = 'expired', generated_on = v_today, version = g.version + 1, updated_at = now()
    where g.person_id = me and g.status = 'open' and not exists (select 1 from jsonb_array_elements(v_c) x where x ->> 'skill_id' = g.skill_id) returning 1)
  select count(*)::int into v_exp from gone;
  v_open := jsonb_array_length(v_c);
  a := kafaa_audit('skill_suggestions.refresh', 'skill_suggestions', me, 'ok', v_open || ' open ' || v_added || ' added ' || v_exp || ' expired', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Suggestions refreshed', a, null, jsonb_build_object('open', v_open, 'added', v_added, 'expired', v_exp));
end $$;

create or replace function kafaa_respond_suggestion(p_id text, p_response text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_ent text := nullif(coalesce(p_id, ''), ''); cur kafaa_skill_suggestions; v_status text; v_eid text; v_level integer; v_name text; v_until date; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'forbidden', kafaa_fs81_msg('ssg.forbidden')); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if coalesce(p_response, '') not in ('confirm', 'reject', 'not_me') then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'invalid', kafaa_fs81_msg('ssg.invalid'), v_role); end if;
  select * into cur from kafaa_skill_suggestions where id = p_id;
  if cur.id is null or cur.person_id <> me then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'not_found', kafaa_fs81_msg('ssg.not_found'), v_role); end if;
  if cur.status <> 'open' then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'closed', kafaa_fs81_msg('ssg.closed'), v_role); end if;
  v_status := case p_response when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'not_me' end;
  if p_response = 'confirm' then
    v_eid := 'se:rating:ssg:' || me || ':' || cur.skill_id;
    v_level := least(2, cur.level);
    select coalesce(name_en, cur.skill_id) into v_name from kafaa_skills where id = cur.skill_id;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, me, cur.skill_id, 'rating', 'skill_suggestions', cur.id, v_level, 'claimed', 'current', current_date, 'Confirmed suggestion: ' || coalesce(v_name, cur.skill_id), me, true)
    on conflict (id) do update set kind = 'rating', ref_table = 'skill_suggestions', ref_id = excluded.ref_id, level = excluded.level, basis = 'claimed', status = 'current',
      observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    update kafaa_skill_suggestions set status = v_status, responded_on = current_date, evidence_id = v_eid, version = cur.version + 1, updated_at = now() where id = cur.id;
    perform kafaa_skills_apply(me, current_date);
    a := kafaa_audit('skill_suggestions.respond', 'skill_suggestions', cur.id, 'ok', 'confirmed ' || cur.skill_id || ' L' || v_level, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Added to your skills profile as your own claim', a, null, jsonb_build_object('id', cur.id, 'status', v_status, 'evidence_id', v_eid, 'suppressed_until', null));
  end if;
  v_until := current_date + 180;
  update kafaa_skill_suggestions set status = v_status, responded_on = current_date, suppressed_until = v_until, version = cur.version + 1, updated_at = now() where id = cur.id;
  a := kafaa_audit('skill_suggestions.respond', 'skill_suggestions', cur.id, 'ok', v_status || ' ' || cur.skill_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'rejected' then 'Suggestion hidden for 180 days' else 'Noted: not you. Hidden for 180 days' end, a, null,
    jsonb_build_object('id', cur.id, 'status', v_status, 'evidence_id', null, 'suppressed_until', to_char(v_until, 'YYYY-MM-DD')));
end $$;

create or replace function kafaa_run_suggestion_fairness(p_as_of date default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_day date := coalesce(p_as_of, current_date); v_rows jsonb; v_period text; v_flag integer; v_sup integer; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  v_role := kafaa_acting_role('integrations', array['A']);
  if v_role is null then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'forbidden', kafaa_fs81_msg('ssg.forbidden_fairness')); end if;
  if v_day > current_date or v_day < current_date - 366 then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'invalid', kafaa_fs81_msg('ssg.invalid_date'), v_role); end if;
  v_rows := kafaa_ssg_fairness_compute(v_day);
  v_period := coalesce(v_rows -> 0 ->> 'period', '');
  insert into kafaa_skill_suggestion_fairness (id, period, as_of, card, metric, dimension, group_key, n, positives, rate, ratio, suppressed, flagged, source, run_by, created_at)
  select x ->> 'id', x ->> 'period', (x ->> 'as_of')::date, x ->> 'card', x ->> 'metric', x ->> 'dimension', x ->> 'group_key', (x ->> 'n')::integer, (x ->> 'positives')::integer,
    (x ->> 'rate')::numeric, (x ->> 'ratio')::numeric, (x ->> 'suppressed')::boolean, (x ->> 'flagged')::boolean, x ->> 'source', me, now()
  from jsonb_array_elements(v_rows) x
  on conflict (id) do update set n = excluded.n, positives = excluded.positives, rate = excluded.rate, ratio = excluded.ratio, suppressed = excluded.suppressed, flagged = excluded.flagged,
    as_of = excluded.as_of, run_by = excluded.run_by, created_at = excluded.created_at;
  select count(*) filter (where (x ->> 'flagged')::boolean)::int, count(*) filter (where (x ->> 'suppressed')::boolean)::int into v_flag, v_sup from jsonb_array_elements(v_rows) x;
  l := kafaa_ledger('kafaa.ai.suggestion_fairness', 'Skill-suggestion fairness snapshot ' || v_period || ': ' || v_flag || ' flagged, ' || v_sup || ' suppressed');
  a := kafaa_audit('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_period, 'ok', jsonb_array_length(v_rows) || ' rows ' || v_flag || ' flagged ' || v_sup || ' suppressed',
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fairness snapshot stored', a, l, jsonb_build_object('period', v_period, 'as_of', to_char(v_day, 'YYYY-MM-DD'), 'rows', jsonb_array_length(v_rows), 'flagged', v_flag, 'suppressed', v_sup));
end $$;

create or replace function kafaa_suggestion_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_people integer; v_open integer; v_conf integer; v_rej integer; v_nm integer; v_exp integer; v_den integer; d jsonb;
begin
  if kafaa_me() is null then return kafaa_refuse('skill_suggestions.stats', 'skill_suggestions', null, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Agg', 'A']) and not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) and not kafaa_has_grant('integrations', array['R', 'A']) then
    return kafaa_refuse('skill_suggestions.stats', 'skill_suggestions', null, 'forbidden', kafaa_fs81_msg('ssg.forbidden_stats')); end if;
  select count(distinct person_id)::int, count(*) filter (where status = 'open')::int, count(*) filter (where status = 'confirmed')::int, count(*) filter (where status = 'rejected')::int,
    count(*) filter (where status = 'not_me')::int, count(*) filter (where status = 'expired')::int into v_people, v_open, v_conf, v_rej, v_nm, v_exp from kafaa_skill_suggestions;
  v_den := v_conf + v_rej + v_nm;
  d := jsonb_build_object('people', case when v_people < 10 then null else v_people end, 'open', case when v_open < 10 then null else v_open end,
    'confirmed', case when v_conf < 10 then null else v_conf end, 'rejected', case when v_rej < 10 then null else v_rej end, 'not_me', case when v_nm < 10 then null else v_nm end,
    'expired', case when v_exp < 10 then null else v_exp end, 'confirm_rate', case when v_den >= 10 then floor((v_conf * 2000 + v_den)::numeric / (2 * v_den)) / 10 end);
  d := d || jsonb_build_object('suppressed', (v_people < 10 or v_open < 10 or v_conf < 10 or v_rej < 10 or v_nm < 10 or v_exp < 10));
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Suggestion statistics', 'audit_seq', null, 'ledger_seq', null, 'data', d);
end $$;

-- ───────────── FS55: the engine card of the new ranked surface (seeded identically by scripts/seed/ext/fs70-skill-signals.mjs)
insert into kafaa_engine_cards (id, engine_surface, module, route, feature, title_en, title_ar, purpose_en, purpose_ar, owner_en, owner_ar, inputs_used, inputs_excluded, scoring_functions, weight_keys, output_en, output_ar, oversight_en, oversight_ar, limitations_en, limitations_ar, opt_out, version, last_changed_at, last_change_id, sources, sort, kernel_surface, ranks, fairness_metric, fairness_none)
values ('skill_suggestions',
  'skills',
  'M28',
  '/my/skills/suggestions',
  'FS72',
  'Skills you may have',
  'مهارات قد تمتلكها',
  'Suggests up to six skills I may already have, from my work and learning records, so I can confirm, reject or say "not me". Nothing is shown to anyone else until I confirm.',
  'يقترح حتى ست مهارات قد أمتلكها بالفعل، من سجلات عملي وتعلّمي، لأؤكدها أو أرفضها أو أقول "لا تخصني". لا يظهر شيء لأي شخص آخر حتى أؤكد.',
  'Training Manager (role card)',
  'مدير التدريب (بطاقة دور)',
  '[{"key":"person_skills","en":"The skills I already hold and how each is evidenced (held skills are never suggested)","ar":"المهارات التي أمتلكها وكيف ثبتت كل منها (لا تُقترح المهارات المثبتة)"},{"key":"opportunity_applications","en":"Gigs and opportunities I completed, and which skills the signed-off outcome levelled","ar":"الفرص والمهام التي أكملتها، والمهارات التي حدّد مستواها الاعتماد النهائي"},{"key":"contributions","en":"My validated expert contributions (lectures and knowledge assets)","ar":"مساهماتي الخبيرة المعتمدة (المحاضرات وأصول المعرفة)"},{"key":"xapi_statements","en":"My learning-record statements in the last year (refresher answers, simulator scenarios, knowledge assets used)","ar":"بيانات سجل تعلّمي خلال العام الماضي (إجابات المراجعات وسيناريوهات المحاكي وأصول المعرفة المستخدمة)"},{"key":"skill_co_occurrence","en":"Which skills staff hold together (counts only, groups under 10 never used, me excluded)","ar":"المهارات التي يمتلكها الموظفون معاً (أعداد فقط، لا تُستخدم المجموعات الأقل من 10، وأنا مستبعد)"},{"key":"skills_adjacency","en":"The catalogue''s list of skills next to each other","ar":"قائمة الكتالوج للمهارات المتجاورة"}]'::jsonb,
  array['gender', 'nationality_flag', 'age']::text[],
  array['src/modules/m28/suggestions.ts#inferSuggestions', 'sql:kafaa_ssg_candidates']::text[],
  array[]::text[],
  'Up to six suggestions, strongest first, each with its reasons; confirming adds my own claim (never more than claimed), rejecting or "not me" hides it for 180 days.',
  'حتى ستة اقتراحات، الأقوى أولاً، لكل منها أسبابه؛ التأكيد يضيف ادعائي الخاص (ولا يتجاوز درجة الادعاء)، والرفض أو "لا تخصني" يخفيه 180 يوماً.',
  'The rules and points are published on the card and the page; suggestions are private to me and never reach a manager. It never decides anything on its own: I choose, and a claim stays a claim until someone validates it.',
  'القواعد والنقاط منشورة على البطاقة والصفحة؛ والاقتراحات خاصة بي ولا تصل إلى أي مدير. لا يقرّر شيئاً بمفرده: أنا من يختار، ويبقى الادعاء ادعاءً حتى يعتمده شخص.',
  'It only sees what Kafa''a records; a skill learned elsewhere will not be suggested. Co-occurrence reflects who holds what today, not what a role needs.',
  'لا يرى إلا ما تسجّله كفاءة؛ ولن تُقترح مهارة اكتُسبت في مكان آخر. ويعكس الاقتران من يمتلك ماذا اليوم، لا ما يحتاجه الدور.',
  false,
  1,
  '2026-10-11T00:00:00Z'::timestamptz,
  null,
  '[{"label":"TechWolf · Workday customer story (skills inference with governance)","url":"https://www.techwolf.ai/customer-stories/workday","as_of":"2026-10-11"},{"label":"LinkedIn Economic Graph research","url":"https://economicgraph.linkedin.com/research","as_of":"2026-10-11"}]'::jsonb,
  35,
  'rules',
  'content',
  'suggestion_offered',
  null)
on conflict (id) do nothing;

-- ───────────── Grants: internal helpers are not executable by API roles; the twelve RPCs only by signed-in users.
revoke all on function kafaa_fs81_msg(text), kafaa_rs_bounds(text), kafaa_rs_prev(text), kafaa_rs_computable(text, date), kafaa_rs_closed(text, date), kafaa_rs_counts(text), kafaa_rs_compute(text),
  kafaa_mp_median(integer[]), kafaa_mp_summary(integer), kafaa_ht_brand_hits(text), kafaa_ht_len(jsonb), kafaa_ht_text(jsonb), kafaa_ht_problem(jsonb, boolean), kafaa_ht_window(text),
  kafaa_ht_compute(text), kafaa_ssg_candidates(text, date), kafaa_ssg_fairness_compute(date) from public, anon, authenticated;
revoke all on function kafaa_compute_skill_signals(text), kafaa_publish_skill_signals(text, text, text), kafaa_submit_manager_pulse(jsonb), kafaa_manager_pulse_summary(integer),
  kafaa_save_technology(jsonb), kafaa_tag_technology(jsonb), kafaa_compute_technology_badges(text), kafaa_publish_technology_badges(text), kafaa_refresh_skill_suggestions(),
  kafaa_respond_suggestion(text, text), kafaa_run_suggestion_fairness(date), kafaa_suggestion_stats() from public, anon;
grant execute on function kafaa_compute_skill_signals(text), kafaa_publish_skill_signals(text, text, text), kafaa_submit_manager_pulse(jsonb), kafaa_manager_pulse_summary(integer),
  kafaa_save_technology(jsonb), kafaa_tag_technology(jsonb), kafaa_compute_technology_badges(text), kafaa_publish_technology_badges(text), kafaa_refresh_skill_suggestions(),
  kafaa_respond_suggestion(text, text), kafaa_run_suggestion_fairness(date), kafaa_suggestion_stats() to authenticated;
