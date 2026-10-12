-- [FS wave H · E4 · FS76] Dalil future-skills mode (M13): the governed intent catalogue and the future-skills turn log.
-- FS76 adds four Dalil intents (how my role changes by 2030, which AI rung I need, what a skill means and its crosswalk, which pathway closes
-- my gap). Answers are built in the browser by deterministic rules over rows the caller may read (src/modules/m13/career/future.ts calls the
-- FS11, FS09, FS07/FS08 and FS17 rules unchanged); the server governs them:
--   kafaa_dalil_intents       one row per intent (public catalogue: EN/AR title, summary, examples, cited routes, https sources, benchmarks),
--                             switched on or off only by the AI owner through kafaa_set_dalil_intent (dalil_config A; reason 5-300 characters;
--                             audited, NEXUS ledger kafaa.dalil.intent_enable / intent_disable). The change keeps the acting role, time and reason.
--   kafaa_dalil_future_turn   the turn log for signed-in callers: refuses intent_disabled when the answer's intent is switched off and
--                             personal_not_allowed when a personal answer comes from anyone but staff with a skills profile, then hands the turn
--                             to the existing logs unchanged: staff to kafaa_dalil_career_turn (F37), everyone else to kafaa_dalil_turn in their own
--                             mode (G5). Kill switch, the shared hourly limit and concern redaction therefore apply as before. Anonymous visitors
--                             keep using kafaa_dalil_turn (public mode); nothing new is executable by anon.
--   kafaa_dl_intent_base      'future.role_2030.personal' -> 'future.role_2030' (= intentBase() in src/modules/m13/career/futureIntents.ts).
-- No shared function is redefined; kafaa_dalil_turn and kafaa_dalil_career_turn are called as they are. PGlite parity and RBAC:
-- scripts/validate/fs84-dalil-future.mjs. Additive and idempotent: kafaa_* objects only; NEXUS objects are never touched and no object or
-- row is ever removed.

-- ───────────── Table (generated DDL, additive)
create table if not exists kafaa_dalil_intents (
  id text primary key,
  kind text not null unique check (kind in ('role_2030', 'ai_rung', 'skill_crosswalk', 'pathway_gap')),
  audience text not null check (audience in ('both', 'public', 'personal')),
  feature text not null,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  examples_en text[] not null default '{}'::text[],
  examples_ar text[] not null default '{}'::text[],
  cites text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  enabled boolean not null default true,
  changed_role text,
  changed_at timestamptz,
  change_note text,
  sort integer not null default 0
);
comment on table kafaa_dalil_intents is '[M13] Dalil future-skills intent (FS76): catalogue text, cited routes and sources; the AI owner can switch it off';

do $rls$ begin
  execute 'alter table kafaa_dalil_intents enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_dalil_intents' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_dalil_intents for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
end $rls$;
alter policy kafaa_read on kafaa_dalil_intents using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_dalil_intents from anon, authenticated;
grant select on kafaa_dalil_intents to anon, authenticated;

-- ───────────── The four intents (same rows as the seed; never overwritten here, so a switch made live is kept)
insert into kafaa_dalil_intents (id, kind, audience, feature, title_en, title_ar, summary_en, summary_ar, examples_en, examples_ar, cites, sources, benchmark_ids, enabled, sort) values
  ('future.role_2030', 'role_2030', 'both', 'FS11', 'How my role changes by 2030', 'كيف يتغير دوري بحلول 2030', 'The role transformation map: the technology drivers, which tasks grow with people, become AI-assisted or shrink, what the 2030 profile adds and, for you, your time-to-ready. A planning assumption, no deployment decision implied.', 'خريطة تحول الدور: محركات التقنية، والمهام التي تنمو مع الناس أو تصبح مدعومة بالذكاء الاصطناعي أو تتقلص، وما يضيفه ملف 2030، ووقتك المقدّر للجاهزية. افتراض تخطيطي ولا يعني أي قرار نشر.', array['How will my role change by 2030?', 'How will the senior reactor operator role change by 2030?']::text[], array['كيف سيتغير دوري بحلول 2030؟', 'كيف سيتغير دور مشغل المفاعل الأول بحلول 2030؟']::text[], array['/my/role-2030', '/careers/roles/:slug/transformation', '/careers/roles/:slug']::text[], '[{"label":"Workforce Singapore · Jobs Transformation Maps","url":"https://wsg.gov.sg/for-employers/jobs-transformation-maps.html","as_of":"2026-10-10"},{"label":"SkillsFuture Singapore · Careers and Skills Passport","url":"https://www.myskillsfuture.gov.sg/csp","as_of":"2026-10-10"}]'::jsonb, array['SG-CAREER']::text[], true, 1),
  ('future.ai_rung', 'ai_rung', 'both', 'FS09', 'Which AI rung I need', 'درجة الذكاء الاصطناعي التي أحتاجها', 'The AI fluency ladder target for a job family, and for you the rung your evidence shows and the cells still missing, each with the learning that evidences it. Self-ratings never move the rung.', 'هدف سلم الطلاقة في الذكاء الاصطناعي لكل عائلة وظيفية، ولك الدرجة التي تُظهرها أدلتك والخلايا الناقصة مع التعلم الذي يثبتها. التقييم الذاتي لا يرفع الدرجة أبداً.', array['Which AI rung do I need?', 'What AI fluency does a reactor operator need?']::text[], array['ما درجة الذكاء الاصطناعي التي أحتاجها؟', 'ما مستوى الطلاقة في الذكاء الاصطناعي الذي يحتاجه مشغل المفاعل؟']::text[], array['/learn/ai-fluency', '/my/ai-fluency']::text[], '[{"label":"European Commission · Living repository of AI-literacy practices (EU AI Act Article 4)","url":"https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices","as_of":"2026-10-10"}]'::jsonb, array['AI-LIT']::text[], true, 2),
  ('future.skill_crosswalk', 'skill_crosswalk', 'public', 'FS08', 'What a skill means and its crosswalk', 'معنى المهارة ومقابلها في الأطر الدولية', 'The skill page in plain words and its published crosswalk to ESCO, O*NET, SFIA, DigComp and the other frameworks, with the match type, the review state and the source. Label-level rows say "code pending review".', 'صفحة المهارة بلغة واضحة ومقابلها المنشور في ESCO وO*NET وSFIA وDigComp وغيرها، مع نوع المطابقة وحالة المراجعة والمصدر. الصفوف على مستوى التسمية تقول "الرمز قيد المراجعة".', array['What is the ESCO equivalent of digital twin validation?', 'What does AI output verification and challenge mean?']::text[], array['ما المقابل في ESCO لمهارة التحقق من التوأم الرقمي؟', 'ما معنى مهارة التحقق من مخرجات الذكاء الاصطناعي ومساءلتها؟']::text[], array['/skills/:id', '/skills/frameworks']::text[], '[{"label":"ESCO v1.2.1 skills pillar (European Commission)","url":"https://esco.ec.europa.eu/en/classification/skill_main","as_of":"2026-10-10"},{"label":"SkillsFuture Singapore · Careers and Skills Passport","url":"https://www.myskillsfuture.gov.sg/csp","as_of":"2026-10-10"}]'::jsonb, array['SG-CAREER']::text[], true, 3),
  ('future.pathway_gap', 'pathway_gap', 'personal', 'FS17', 'Which pathway closes my gap', 'أي مسار تعلم يسد فجوتي', 'The future-skill learning pathways that close your 2030 gaps first, ranked the same way as the Learning Coach, each with why it was picked. Anonymous visitors are pointed to the public skills catalogue.', 'مسارات تعلم مهارات المستقبل التي تسد فجوات 2030 لديك أولاً، مرتبة بالطريقة نفسها التي يرتبها بها مدرب التعلم، مع سبب اختيار كل منها. يُوجَّه الزوار غير المسجلين إلى دليل المهارات العام.', array['Which pathway closes my gap?', 'Which learning pathway closes my gap in AI output verification?']::text[], array['أي مسار تعلم يسد فجوتي؟', 'أي مسار تعلم يسد فجوتي في التحقق من مخرجات الذكاء الاصطناعي؟']::text[], array['/learn/pathways/:id', '/my/pathways', '/my/coach']::text[], '[{"label":"SkillsFuture Singapore · Careers and Skills Passport","url":"https://www.myskillsfuture.gov.sg/csp","as_of":"2026-10-10"},{"label":"European Commission · Living repository of AI-literacy practices (EU AI Act Article 4)","url":"https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices","as_of":"2026-10-10"}]'::jsonb, array['SG-CAREER', 'AI-LIT']::text[], true, 4)
on conflict (id) do nothing;

-- ───────────── Rule: intent base (TS intentBase)
create or replace function kafaa_dl_intent_base(p text) returns text language sql immutable set search_path = public as $$
  select substring(coalesce(p, '') from '^(future\.[a-z0-9_]+)')
$$;

-- ───────────── RPC: switch one future-skills intent (the AI owner)
create or replace function kafaa_set_dalil_intent(p_id text, p_enabled boolean, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_dalil_intents; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('dalil_config', array['A']); v_note text := btrim(coalesce(p_note, ''));
begin
  if v_role is null then return kafaa_refuse('dalil.intent', 'dalil_intents', p_id, 'forbidden', 'Only the AI owner (admin) may switch a Dalil intent'); end if;
  select * into r from kafaa_dalil_intents where id = p_id;
  if r.id is null then return kafaa_refuse('dalil.intent', 'dalil_intents', p_id, 'not_found', 'Unknown intent', v_role); end if;
  if length(v_note) < 5 or length(v_note) > 300 then return kafaa_refuse('dalil.intent', 'dalil_intents', p_id, 'invalid', 'A reason of 5 to 300 characters is required', v_role); end if;
  if r.enabled = coalesce(p_enabled, false) then
    return kafaa_refuse('dalil.intent', 'dalil_intents', p_id, 'unchanged', case when r.enabled then 'This intent is already on' else 'This intent is already off' end, v_role);
  end if;
  update kafaa_dalil_intents set enabled = coalesce(p_enabled, false), changed_role = v_role, changed_at = now(), change_note = v_note where id = p_id;
  l := kafaa_ledger('kafaa.dalil.intent_' || case when p_enabled then 'enable' else 'disable' end, 'Dalil intent ' || p_id);
  a := kafaa_audit('dalil.intent', 'dalil_intents', p_id, 'ok', case when p_enabled then 'enabled: ' else 'disabled: ' end || v_note, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_enabled then 'Intent switched on' else 'Intent switched off' end, a, l, jsonb_build_object('id', p_id, 'enabled', coalesce(p_enabled, false)));
end $$;

-- ───────────── RPC: future-skills turn log for signed-in callers (hands the turn to the career or the Dalil log)
create or replace function kafaa_dalil_future_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_base text := kafaa_dl_intent_base(p->>'intent'); v_on boolean; v_staff boolean; v_mode text;
begin
  if v_base is not null then
    select enabled into v_on from kafaa_dalil_intents where id = v_base;
    if v_on is false then return kafaa_refuse('dalil.future_turn', 'advisor_turns', v_base, 'intent_disabled', 'This answer type is switched off by the AI owner'); end if;
  end if;
  if me is null then return kafaa_refuse('dalil.future_turn', 'advisor_turns', null, 'not_signed_in', 'Sign in to log a future-skills turn'); end if;
  v_staff := kafaa_acting_role('skills_profile', array['Own']) is not null and kafaa_dalil_mode_allowed('staff');
  if (coalesce((p->>'personal')::boolean, false) or coalesce(p->>'intent', '') ~ '^future\.[a-z0-9_]+\.personal$') and not v_staff then
    return kafaa_refuse('dalil.future_turn', 'advisor_turns', null, 'personal_not_allowed', 'Personal future-skills answers are for staff with a skills profile');
  end if;
  if v_staff then return kafaa_dalil_career_turn(p - 'personal' - 'mode' - 'client_key'); end if;
  v_mode := coalesce(nullif(p->>'mode', ''), case when kafaa_dalil_mode_allowed('staff') then 'staff' when kafaa_dalil_mode_allowed('partner') then 'partner' else 'applicant' end);
  return kafaa_dalil_turn((p - 'personal' - 'client_key') || jsonb_build_object('mode', v_mode));
end $$;

-- ───────────── Grants: the rule is internal; both RPCs for signed-in users only (anon executes nothing new)
revoke all on function kafaa_dl_intent_base(text) from public, anon, authenticated;
revoke all on function kafaa_set_dalil_intent(text, boolean, text), kafaa_dalil_future_turn(jsonb) from public, anon;
grant execute on function kafaa_set_dalil_intent(text, boolean, text), kafaa_dalil_future_turn(jsonb) to authenticated;
