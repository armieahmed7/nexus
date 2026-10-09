-- W1 QA (integration on master): kafaa_roadmap_to_plan no longer duplicates a development block that is already in the
-- target plan when it is sent from a second saved scenario for the same target role. Additive and idempotent: it only
-- replaces this kafaa_* function (same signature, same grants).
create or replace function kafaa_roadmap_to_plan(p_roadmap text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; rm kafaa_roadmaps; x jsonb; v_plan text; v_created integer := 0; v_existing integer := 0; v_new boolean := false;
  v_id text; a kafaa_audit_events; l integer; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'not_signed_in', 'Sign in to update your development plan'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own', 'Scope']);
  if v_role is null then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'forbidden', 'Only staff with a development plan can do this'); end if;
  select * into rm from kafaa_roadmaps where id = p_roadmap;
  if not found or rm.person_id <> me or not rm.active then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'not_found', 'Roadmap not found', v_role); end if;
  if not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(rm.plan) = 'array' then rm.plan else '[]'::jsonb end) b where b->>'lane' = 'development') then
    return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'invalid', 'This roadmap has no development blocks to send', v_role);
  end if;
  for x in select b from jsonb_array_elements(rm.plan) b where b->>'lane' = 'development' loop
    if not (jsonb_typeof(x->'id') = 'string' and x->>'id' ~ '^[a-z0-9-]{1,80}$' and coalesce(x->>'plan_kind', '') in ('course', 'mentoring', 'project')
            and jsonb_typeof(x->'title'->'en') = 'string' and jsonb_typeof(x->'title'->'ar') = 'string' and btrim(x->'title'->>'en') <> ''
            and length(x->'title'->>'en') <= 200 and length(x->'title'->>'ar') <= 200
            and (coalesce(jsonb_typeof(x->'course_id'), 'null') = 'null' or exists (select 1 from kafaa_courses co where co.id = x->>'course_id'))
            and (coalesce(jsonb_typeof(x->'end'), 'null') = 'null' or x->>'end' ~ '^\d{4}-\d{2}-\d{2}$')) then
      return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'invalid', 'The roadmap contains an activity that cannot be added', v_role);
    end if;
  end loop;
  select coalesce((select d.id from kafaa_dev_plans d where d.id = 'dp-rm-' || rm.id and d.person_id = me and d.target_role_id = rm.target_role_id and d.status in ('draft', 'submitted', 'approved', 'active')),
                  (select d.id from kafaa_dev_plans d where d.person_id = me and d.target_role_id = rm.target_role_id and d.status in ('draft', 'submitted', 'approved', 'active') order by d.id collate "C" limit 1))
    into v_plan;
  perform set_config('kafaa.seeding', 'on', true);
  if v_plan is null then
    v_plan := 'dp-rm-' || rm.id;
    insert into kafaa_dev_plans (id, person_id, target_role_id, status, created_at, note) values (v_plan, me, rm.target_role_id, 'draft', now(), 'Created from a Career Roadmap scenario');
    v_new := true;
  end if;
  for x in select b from jsonb_array_elements(rm.plan) b where b->>'lane' = 'development' loop
    v_id := 'pa-rm-' || rm.id || '-' || (x->>'id');
    -- the same development block already in this plan (from this roadmap, or from another saved scenario for the same
    -- target: same kind, title and course) counts as existing, so re-sending never duplicates plan activities
    if exists (select 1 from kafaa_plan_activities where id = v_id)
       or exists (select 1 from kafaa_plan_activities pa where pa.plan_id = v_plan and pa.kind = x->>'plan_kind' and pa.title_en = x->'title'->>'en'
                  and coalesce(pa.course_id, '') = coalesce(x->>'course_id', '')) then
      v_existing := v_existing + 1; continue;
    end if;
    insert into kafaa_plan_activities (id, plan_id, person_id, kind, title_en, title_ar, due_on, status, course_id)
    values (v_id, v_plan, me, x->>'plan_kind', x->'title'->>'en', x->'title'->>'ar', (x->>'end')::date, 'planned', x->>'course_id');
    v_created := v_created + 1;
  end loop;
  update kafaa_roadmaps set sent_plan_id = v_plan, sent_at = now() where id = rm.id;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.career.roadmap_to_plan', format('Career roadmap %s sent to development plan %s (%s activities added)', rm.id, v_plan, v_created));
  a := kafaa_audit('roadmap.to_plan', 'plan_activities', rm.id, 'ok', format('%s added, %s already in plan %s', v_created, v_existing, v_plan), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_created > 0 then 'Added to your development plan' else 'Already in your development plan' end, a, l,
    jsonb_build_object('plan_id', v_plan, 'plan_created', v_new, 'created', v_created, 'existing', v_existing));
end $$;

revoke execute on function kafaa_roadmap_to_plan(text) from public, anon;
grant execute on function kafaa_roadmap_to_plan(text) to authenticated;
