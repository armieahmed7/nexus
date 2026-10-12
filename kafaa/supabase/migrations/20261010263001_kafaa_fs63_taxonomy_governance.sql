-- [FS wave F · E3 · FS54 + FS55] Skills council and taxonomy change tracker; engine cards for every ranked surface, ranked-surface fairness,
-- the skills-ontology datasheet and the model-risk template (M16 Admin, audit, AI transparency).
-- FS54: kafaa_skill_change_requests holds proposals to add, rename, split, retire or re-level a skill, each checked against the inclusion rule
--   (distinct development and assessment, distinct names, an https source for a new skill; kafaa_fs63_inclusion = inclusionChecks in
--   src/modules/m16/taxonomyGov.ts). Staff propose (skills_taxonomy W); the skills council decides (skills_taxonomy A: training manager, HR
--   director, platform admin). Maker-checker: two different council members, neither of them the proposer (check constraints below); the first
--   vote approves or rejects, a second member who agrees closes the request, one who disagrees sends it back. Every vote writes a NEXUS ledger
--   row. A published change is applied to kafaa_skills through the FS02 guard paths (kafaa_fs_skill_guard): retire and split mark the skill
--   obsolete with its date and replacement and never remove it; rename and re-level raise the version and restart the review clock. The public
--   change log kafaa_skill_changes (skills_taxonomy R, every role) carries no person ids, only roles. Staleness and the orphan-rate audit are
--   computed by kafaa_taxonomy_health (= taxonomyHealth; "taught by" = TAUGHT_BY, shared with FS57).
-- FS55: kafaa_engine_cards gains kernel_surface, ranks, fairness_metric and fairness_none (registry: src/modules/m16/surfaces.ts RANKED_SURFACES;
--   the new FS55 cards are seed rows, insert ... on conflict (id) do nothing). The eight F24 cards receive their FS55 values through guarded
--   updates; the navigator and Future Me cards name the rankers their pages already use (version + 1, once); the four match cards whose live
--   content differed (experts, marketplace, mentoring, rotations) are reconciled to the seeded content with guarded, idempotent updates (content
--   columns only; version and last change stay, because they follow the live engine change log). kafaa_surface_fairness stores the weekly
--   ranked-surface fairness snapshot (kafaa_run_surface_fairness, integrations A; = surfaceSnapshot), reusing the F24 population and group rules
--   (kafaa_fairness_base, kafaa_fairness_rows: groups under 10 suppress the whole comparison, four-fifths flag).
-- PGlite parity and checks: scripts/validate/fs63-taxonomy-governance.mjs. Seed: scripts/seed/ext/fs54-taxonomy-governance.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.

-- ───────────── FS55 columns on the F24 engine cards (generated column DDL)
alter table kafaa_engine_cards add column if not exists kernel_surface text check (kernel_surface in ('skills', 'recommend', 'match', 'search', 'transform', 'assess', 'rules'));
alter table kafaa_engine_cards add column if not exists ranks text check (ranks in ('content', 'people', 'options'));
alter table kafaa_engine_cards add column if not exists fairness_metric text;
alter table kafaa_engine_cards add column if not exists fairness_none text check (fairness_none in ('f24', 'content', 'anonymous', 'no_outcome', 'non_staff'));

-- ───────────── Tables (generated DDL)
create table if not exists kafaa_skill_change_requests (
  id text primary key,
  kind text not null check (kind in ('add', 'rename', 'split', 'retire', 'relevel')),
  skill_id text,
  title_en text not null,
  title_ar text not null,
  proposal jsonb not null default '{}'::jsonb,
  rationale text not null,
  development text not null,
  assessment text not null,
  inclusion jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'first_approved', 'first_rejected', 'published', 'rejected')),
  proposed_by text not null,
  proposed_role text,
  proposed_at timestamptz not null default now(),
  votes jsonb not null default '[]'::jsonb,
  first_by text,
  first_decision text check (first_decision in ('approve', 'reject')),
  second_by text,
  decided_at timestamptz,
  change_id text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_skill_change_requests is '[M16] Skill change requests (add, rename, split, retire, re-level) with the inclusion-rule checks and two council votes (FS54)';
create table if not exists kafaa_skill_changes (
  id text primary key,
  request_id text,
  kind text not null check (kind in ('add', 'rename', 'split', 'retire', 'relevel')),
  skill_id text not null,
  skill_code text not null,
  skill_name_en text not null,
  skill_name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  version_before integer,
  version_after integer,
  new_skill_ids text[] not null default '{}'::text[],
  replaced_by text,
  effective_on date not null,
  methodology boolean not null default false,
  dashboards text[] not null default '{}'::text[],
  decided_roles text[] not null default '{}'::text[],
  proposed_role text,
  published_at timestamptz not null default now(),
  ledger_seq integer,
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_skill_changes is '[M16] Published skill changes: the public taxonomy change log with before and after, methodology flag and affected dashboards (FS54)';
create table if not exists kafaa_surface_fairness (
  id text primary key,
  period text not null,
  as_of date not null,
  card text not null,
  metric text not null,
  dimension text not null check (dimension in ('gender', 'nationality')),
  group_key text not null check (group_key in ('f', 'm', 'uae', 'other')),
  n integer,
  positives integer,
  rate numeric,
  ratio numeric,
  suppressed boolean not null default false,
  flagged boolean not null default false,
  source text not null,
  run_by text,
  created_at timestamptz not null default now()
);
comment on table kafaa_surface_fairness is '[M16] Weekly fairness snapshot per FS55 ranked surface: outcome rate by gender and nationality, suppressed below 10, four-fifths flag (FS55; aggregates only)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_change_requests_skill_id_fk') then alter table kafaa_skill_change_requests add constraint kafaa_skill_change_requests_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_change_requests_proposed_by_fk') then alter table kafaa_skill_change_requests add constraint kafaa_skill_change_requests_proposed_by_fk foreign key (proposed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_changes_skill_id_fk') then alter table kafaa_skill_changes add constraint kafaa_skill_changes_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skill_change_requests_kind_idx on kafaa_skill_change_requests (kind);
create index if not exists kafaa_skill_change_requests_skill_id_idx on kafaa_skill_change_requests (skill_id);
create index if not exists kafaa_skill_change_requests_status_idx on kafaa_skill_change_requests (status);
create index if not exists kafaa_skill_change_requests_proposed_by_idx on kafaa_skill_change_requests (proposed_by);
create index if not exists kafaa_skill_changes_request_id_idx on kafaa_skill_changes (request_id);
create index if not exists kafaa_skill_changes_kind_idx on kafaa_skill_changes (kind);
create index if not exists kafaa_skill_changes_skill_id_idx on kafaa_skill_changes (skill_id);
create index if not exists kafaa_skill_changes_effective_on_idx on kafaa_skill_changes (effective_on);
create index if not exists kafaa_surface_fairness_period_idx on kafaa_surface_fairness (period);
create index if not exists kafaa_surface_fairness_card_idx on kafaa_surface_fairness (card);
create index if not exists kafaa_surface_fairness_metric_idx on kafaa_surface_fairness (metric);

-- Maker-checker in the data: neither council vote is the proposer's, and the second vote is another member's.
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_scr_maker_checker_ck') then
  alter table kafaa_skill_change_requests add constraint kafaa_scr_maker_checker_ck check ((first_by is null or first_by <> proposed_by) and (second_by is null or (second_by <> proposed_by and second_by <> coalesce(first_by, '')))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_scr_published_ck') then
  alter table kafaa_skill_change_requests add constraint kafaa_scr_published_ck check (status not in ('published', 'rejected') or (first_by is not null and second_by is not null and decided_at is not null)); end if; end $$;

-- ───────────── RLS (policies created when missing, then set to the per-statement form)
alter table kafaa_skill_change_requests enable row level security;
alter table kafaa_skill_changes enable row level security;
alter table kafaa_surface_fairness enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_change_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_change_requests for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_changes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_changes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_surface_fairness' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_surface_fairness for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skill_change_requests using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((proposed_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, proposed_by, NULL::text, false)));
alter policy kafaa_read on kafaa_skill_changes using ((SELECT kafaa_has_grant('skills_taxonomy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_surface_fairness using (((SELECT kafaa_has_grant('integrations'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
-- All three tables change only through the SECURITY DEFINER RPCs below.
revoke all on kafaa_skill_change_requests, kafaa_skill_changes, kafaa_surface_fairness from anon, authenticated;
grant select on kafaa_skill_change_requests, kafaa_skill_changes, kafaa_surface_fairness to anon, authenticated;

-- ───────────── Data: FS55 values of the eight F24 engine cards (guarded: only while still unset; same values as the seed builder)
update kafaa_engine_cards set kernel_surface = 'recommend', ranks = 'options', fairness_metric = 'navigator_ready', fairness_none = null where id = 'navigator' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'recommend', ranks = 'content', fairness_metric = null, fairness_none = 'f24' where id = 'coach' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'match', ranks = 'options', fairness_metric = 'opportunity_selected', fairness_none = null where id = 'marketplace' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'skills', ranks = 'content', fairness_metric = 'hipo_pool', fairness_none = null where id = 'talent_evidence' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'match', ranks = 'people', fairness_metric = 'mentoring_matched', fairness_none = null where id = 'mentoring' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'match', ranks = 'options', fairness_metric = null, fairness_none = 'f24' where id = 'rotations' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'match', ranks = 'people', fairness_metric = null, fairness_none = 'f24' where id = 'experts' and kernel_surface is null;
update kafaa_engine_cards set kernel_surface = 'recommend', ranks = 'options', fairness_metric = null, fairness_none = 'f24' where id = 'future' and kernel_surface is null;

-- The navigator and Future Me cards name the rankers their pages already call (once: version + 1 only when the function is still missing).
update kafaa_engine_cards set scoring_functions = scoring_functions || array['src/modules/m18/FutureRoles.tsx#rankConcepts']::text[], version = version + 1, last_changed_at = '2026-10-11T00:00:00Z'::timestamptz
  where id = 'navigator' and not ('src/modules/m18/FutureRoles.tsx#rankConcepts' = any(scoring_functions));
update kafaa_engine_cards set scoring_functions = scoring_functions || array['src/modules/m21/future.ts#bridgePlan', 'src/modules/m21/raises.ts#rankRaises']::text[], version = version + 1, last_changed_at = '2026-10-11T00:00:00Z'::timestamptz
  where id = 'future' and not ('src/modules/m21/future.ts#bridgePlan' = any(scoring_functions));

-- Reconcile the four match cards whose live content differed from the seed (experts, marketplace, mentoring, rotations): content columns are set
-- to the seeded values only where they differ (idempotent; no row is removed). version, last_changed_at and last_change_id are left as they are:
-- they follow the live engine change log (kafaa_engine_changes) of the match surface.
update kafaa_engine_cards c set engine_surface = v.engine_surface, module = v.module, route = v.route, feature = v.feature, title_en = v.title_en, title_ar = v.title_ar, purpose_en = v.purpose_en, purpose_ar = v.purpose_ar, owner_en = v.owner_en, owner_ar = v.owner_ar, inputs_used = v.inputs_used, inputs_excluded = v.inputs_excluded, scoring_functions = v.scoring_functions, weight_keys = v.weight_keys, output_en = v.output_en, output_ar = v.output_ar, oversight_en = v.oversight_en, oversight_ar = v.oversight_ar, limitations_en = v.limitations_en, limitations_ar = v.limitations_ar, opt_out = v.opt_out, sources = v.sources, sort = v.sort
from (select 'match' as engine_surface,
  'M22' as module,
  '/communities/experts' as route,
  'F17' as feature,
  'Expert finder' as title_en,
  'الباحث عن الخبراء' as title_ar,
  'Lists colleagues who opted in as experts for a skill, strongest evidence first.' as purpose_en,
  'يعرض الزملاء الذين اختاروا الظهور كخبراء في مهارة ما، بدءاً بأقوى الأدلة.' as purpose_ar,
  'Knowledge management lead (role card)' as owner_en,
  'مسؤول إدارة المعرفة (بطاقة دور)' as owner_ar,
  '[{"key":"expert_optin","en":"Experts who opted in: skills at level 3 or above, availability","ar":"الخبراء الذين اختاروا الظهور: مهارات بالمستوى 3 فأعلى، والتوفر"},{"key":"person_skills","en":"My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)","ar":"مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)"}]'::jsonb as inputs_used,
  array['gender', 'nationality_flag', 'age']::text[] as inputs_excluded,
  array['src/modules/m22/domain.ts#rankExperts']::text[] as scoring_functions,
  array[]::text[] as weight_keys,
  'A list of opted-in experts with their level and why they appear. No contact details.' as output_en,
  'قائمة بالخبراء الذين اختاروا الظهور مع مستواهم وسبب ظهورهم. دون بيانات اتصال.' as output_ar,
  'Experts choose to appear and can withdraw at any time; requests go through Kafa''a.' as oversight_en,
  'يختار الخبراء الظهور ويمكنهم الانسحاب في أي وقت؛ وتمر الطلبات عبر كفاءة.' as oversight_ar,
  'Only level 3 or above and only people who opted in.' as limitations_en,
  'المستوى 3 فأعلى فقط، ولمن اختار الظهور فقط.' as limitations_ar,
  false as opt_out,
  '[{"label":"US 29 CFR 1607.4(D) · Uniform Guidelines on Employee Selection Procedures: the four-fifths rule","url":"https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4","as_of":"2026-10-09"},{"label":"UAE Government portal · Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)","url":"https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws","as_of":"2026-10-09"},{"label":"NIST · AI Risk Management Framework (AI RMF 1.0)","url":"https://www.nist.gov/itl/ai-risk-management-framework","as_of":"2026-10-09"}]'::jsonb as sources,
  7 as sort) v
where c.id = 'experts' and (c.engine_surface, c.module, c.route, c.feature, c.title_en, c.title_ar, c.purpose_en, c.purpose_ar, c.owner_en, c.owner_ar, c.inputs_used, c.inputs_excluded, c.scoring_functions, c.weight_keys, c.output_en, c.output_ar, c.oversight_en, c.oversight_ar, c.limitations_en, c.limitations_ar, c.opt_out, c.sources, c.sort) is distinct from (v.engine_surface, v.module, v.route, v.feature, v.title_en, v.title_ar, v.purpose_en, v.purpose_ar, v.owner_en, v.owner_ar, v.inputs_used, v.inputs_excluded, v.scoring_functions, v.weight_keys, v.output_en, v.output_ar, v.oversight_en, v.oversight_ar, v.limitations_en, v.limitations_ar, v.opt_out, v.sources, v.sort);
update kafaa_engine_cards c set engine_surface = v.engine_surface, module = v.module, route = v.route, feature = v.feature, title_en = v.title_en, title_ar = v.title_ar, purpose_en = v.purpose_en, purpose_ar = v.purpose_ar, owner_en = v.owner_en, owner_ar = v.owner_ar, inputs_used = v.inputs_used, inputs_excluded = v.inputs_excluded, scoring_functions = v.scoring_functions, weight_keys = v.weight_keys, output_en = v.output_en, output_ar = v.output_ar, oversight_en = v.oversight_en, oversight_ar = v.oversight_ar, limitations_en = v.limitations_en, limitations_ar = v.limitations_ar, opt_out = v.opt_out, sources = v.sources, sort = v.sort
from (select 'match' as engine_surface,
  'M20' as module,
  '/opportunities' as route,
  'F08' as feature,
  'Opportunity marketplace' as title_en,
  'سوق الفرص' as title_ar,
  'Orders gigs, projects, outage support and shadowing by how well they fit my skills and help my development.' as purpose_en,
  'يرتّب المهام القصيرة والمشاريع ودعم فترات الصيانة والمرافقة بحسب ملاءمتها لمهاراتي وفائدتها لتطوري.' as purpose_ar,
  'Head of Talent and Careers (role card)' as owner_en,
  'رئيس المواهب والمسارات المهنية (بطاقة دور)' as owner_ar,
  '[{"key":"person_skills","en":"My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)","ar":"مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)"},{"key":"opportunities","en":"Each opportunity: skills needed, skills gained, eligible job families","ar":"كل فرصة: المهارات المطلوبة والمهارات المكتسبة والعائلات الوظيفية المؤهلة"},{"key":"role_competencies","en":"The competency levels each role requires (core, important, useful)","ar":"مستويات الكفاءة التي يتطلبها كل دور (أساسية، مهمة، مفيدة)"},{"key":"career_targets","en":"My shortlisted target roles and weekly learning goal (only if I set them)","ar":"الأدوار المستهدفة في قائمتي المختصرة وهدف التعلّم الأسبوعي (إن حدّدتها فقط)"},{"key":"job_family","en":"My job family (eligibility only)","ar":"عائلتي الوظيفية (للأهلية فقط)"}]'::jsonb as inputs_used,
  array['gender', 'nationality_flag', 'age']::text[] as inputs_excluded,
  array['src/modules/m20/match.ts#matchOpportunities']::text[] as scoring_functions,
  array['skills', 'development', 'target']::text[] as weight_keys,
  'A match score (skills fit, development value, target-role value) and reasons per opportunity. The "Emirati development priority" flag is shown on the card and never changes the score.' as output_en,
  'درجة مطابقة (ملاءمة المهارات، والقيمة التطويرية، والقيمة للدور المستهدف) وأسباب لكل فرصة. تظهر علامة "أولوية تطوير الكوادر الإماراتية" على البطاقة ولا تغيّر الدرجة أبداً.' as output_ar,
  'Selection is made by the posting manager after my line manager releases me; the score never selects anyone.' as oversight_en,
  'يتم الاختيار من قبل المدير الناشر بعد موافقة مديري المباشر على إتاحتي؛ ولا تختار الدرجة أحداً أبداً.' as oversight_ar,
  'Opportunities without skill tags show an open fit. Skills learned outside Kafa''a count only once evidenced or validated.' as limitations_en,
  'تظهر الفرص غير المرتبطة بمهارات بملاءمة مفتوحة. ولا تُحتسب المهارات المكتسبة خارج كفاءة إلا بعد إثباتها أو اعتمادها.' as limitations_ar,
  true as opt_out,
  '[{"label":"US 29 CFR 1607.4(D) · Uniform Guidelines on Employee Selection Procedures: the four-fifths rule","url":"https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4","as_of":"2026-10-09"},{"label":"UAE Government portal · Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)","url":"https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws","as_of":"2026-10-09"},{"label":"NIST · AI Risk Management Framework (AI RMF 1.0)","url":"https://www.nist.gov/itl/ai-risk-management-framework","as_of":"2026-10-09"}]'::jsonb as sources,
  3 as sort) v
where c.id = 'marketplace' and (c.engine_surface, c.module, c.route, c.feature, c.title_en, c.title_ar, c.purpose_en, c.purpose_ar, c.owner_en, c.owner_ar, c.inputs_used, c.inputs_excluded, c.scoring_functions, c.weight_keys, c.output_en, c.output_ar, c.oversight_en, c.oversight_ar, c.limitations_en, c.limitations_ar, c.opt_out, c.sources, c.sort) is distinct from (v.engine_surface, v.module, v.route, v.feature, v.title_en, v.title_ar, v.purpose_en, v.purpose_ar, v.owner_en, v.owner_ar, v.inputs_used, v.inputs_excluded, v.scoring_functions, v.weight_keys, v.output_en, v.output_ar, v.oversight_en, v.oversight_ar, v.limitations_en, v.limitations_ar, v.opt_out, v.sources, v.sort);
update kafaa_engine_cards c set engine_surface = v.engine_surface, module = v.module, route = v.route, feature = v.feature, title_en = v.title_en, title_ar = v.title_ar, purpose_en = v.purpose_en, purpose_ar = v.purpose_ar, owner_en = v.owner_en, owner_ar = v.owner_ar, inputs_used = v.inputs_used, inputs_excluded = v.inputs_excluded, scoring_functions = v.scoring_functions, weight_keys = v.weight_keys, output_en = v.output_en, output_ar = v.output_ar, oversight_en = v.oversight_en, oversight_ar = v.oversight_ar, limitations_en = v.limitations_en, limitations_ar = v.limitations_ar, opt_out = v.opt_out, sources = v.sources, sort = v.sort
from (select 'match' as engine_surface,
  'M04' as module,
  '/my/mentoring' as route,
  'F13' as feature,
  'Mentor matching' as title_en,
  'مطابقة المرشدين' as title_ar,
  'Suggests mentors whose offered skills and mentoring types fit what I want to learn.' as purpose_en,
  'يقترح مرشدين تتوافق مهاراتهم وأنواع الإرشاد لديهم مع ما أريد تعلّمه.' as purpose_ar,
  'Training Manager (role card)' as owner_en,
  'مدير التدريب (بطاقة دور)' as owner_ar,
  '[{"key":"mentors","en":"Mentor profiles: skills offered, mentoring types, capacity","ar":"ملفات المرشدين: المهارات المعروضة وأنواع الإرشاد والطاقة الاستيعابية"},{"key":"person_skills","en":"My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)","ar":"مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)"},{"key":"reporting_line","en":"My reporting line (so my own line manager is never suggested)","ar":"تسلسلي الإداري (حتى لا يُقترح مديري المباشر أبداً)"},{"key":"wfn_participants","en":"Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers","ar":"المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة"}]'::jsonb as inputs_used,
  array['gender', 'nationality_flag', 'age']::text[] as inputs_excluded,
  array['src/modules/m04/match.ts#rankMentors', 'src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']::text[] as scoring_functions,
  array['skills', 'development', 'target']::text[] as weight_keys,
  'A short list of mentors with reasons; my own line manager is never suggested.' as output_en,
  'قائمة قصيرة بالمرشدين مع الأسباب؛ ولا يُقترح مديري المباشر أبداً.' as output_ar,
  'The mentor decides whether to accept; the agreement is set by both people.' as oversight_en,
  'يقرّر المرشد قبول الطلب أو رفضه؛ ويحدّد الطرفان الاتفاق معاً.' as oversight_ar,
  'Only mentors who opted in and have capacity appear. Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.' as limitations_en,
  'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية. تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.' as limitations_ar,
  false as opt_out,
  '[{"label":"US 29 CFR 1607.4(D) · Uniform Guidelines on Employee Selection Procedures: the four-fifths rule","url":"https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4","as_of":"2026-10-09"},{"label":"UAE Government portal · Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)","url":"https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws","as_of":"2026-10-09"},{"label":"NIST · AI Risk Management Framework (AI RMF 1.0)","url":"https://www.nist.gov/itl/ai-risk-management-framework","as_of":"2026-10-09"}]'::jsonb as sources,
  5 as sort) v
where c.id = 'mentoring' and (c.engine_surface, c.module, c.route, c.feature, c.title_en, c.title_ar, c.purpose_en, c.purpose_ar, c.owner_en, c.owner_ar, c.inputs_used, c.inputs_excluded, c.scoring_functions, c.weight_keys, c.output_en, c.output_ar, c.oversight_en, c.oversight_ar, c.limitations_en, c.limitations_ar, c.opt_out, c.sources, c.sort) is distinct from (v.engine_surface, v.module, v.route, v.feature, v.title_en, v.title_ar, v.purpose_en, v.purpose_ar, v.owner_en, v.owner_ar, v.inputs_used, v.inputs_excluded, v.scoring_functions, v.weight_keys, v.output_en, v.output_ar, v.oversight_en, v.oversight_ar, v.limitations_en, v.limitations_ar, v.opt_out, v.sources, v.sort);
update kafaa_engine_cards c set engine_surface = v.engine_surface, module = v.module, route = v.route, feature = v.feature, title_en = v.title_en, title_ar = v.title_ar, purpose_en = v.purpose_en, purpose_ar = v.purpose_ar, owner_en = v.owner_en, owner_ar = v.owner_ar, inputs_used = v.inputs_used, inputs_excluded = v.inputs_excluded, scoring_functions = v.scoring_functions, weight_keys = v.weight_keys, output_en = v.output_en, output_ar = v.output_ar, oversight_en = v.oversight_en, oversight_ar = v.oversight_ar, limitations_en = v.limitations_en, limitations_ar = v.limitations_ar, opt_out = v.opt_out, sources = v.sources, sort = v.sort
from (select 'match' as engine_surface,
  'M20' as module,
  '/opportunities/rotations' as route,
  'F15' as feature,
  'Rotations and shadowing suggestions' as title_en,
  'اقتراحات التناوب والمرافقة' as title_ar,
  'Orders rotation programmes and shadowing hosts by the gaps they close for my role and targets.' as purpose_en,
  'يرتّب برامج التناوب ومضيفي المرافقة بحسب الفجوات التي تسدّها لدوري وأهدافي.' as purpose_ar,
  'Head of Talent and Careers (role card)' as owner_en,
  'رئيس المواهب والمسارات المهنية (بطاقة دور)' as owner_ar,
  '[{"key":"rotation_templates","en":"Rotation programmes: objectives, families, duration","ar":"برامج التناوب: الأهداف والعائلات والمدة"},{"key":"shadow_hosts","en":"Opted-in shadowing hosts and the skills they offer","ar":"المضيفون الذين اختاروا الاستضافة والمهارات التي يقدمونها"},{"key":"person_skills","en":"My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)","ar":"مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)"},{"key":"role_competencies","en":"The competency levels each role requires (core, important, useful)","ar":"مستويات الكفاءة التي يتطلبها كل دور (أساسية، مهمة، مفيدة)"},{"key":"job_family","en":"My job family (eligibility only)","ar":"عائلتي الوظيفية (للأهلية فقط)"}]'::jsonb as inputs_used,
  array['gender', 'nationality_flag', 'age']::text[] as inputs_excluded,
  array['src/modules/m20/rotationMatch.ts#rankProgrammes', 'src/modules/m20/rotationMatch.ts#rankHosts']::text[] as scoring_functions,
  array['skills', 'development', 'target']::text[] as weight_keys,
  'Ranked programmes and hosts with reasons. Enrolment is by programme owners; shadowing needs the host''s and my manager''s agreement.' as output_en,
  'برامج ومضيفون مرتبون مع الأسباب. يتم التسجيل من قبل مالكي البرامج؛ وتتطلب المرافقة موافقة المضيف ومديري.' as output_ar,
  'Programme owners enrol people; sign-off is maker-checker.' as oversight_en,
  'يسجّل مالكو البرامج المشاركين؛ ويخضع الاعتماد لمبدأ المُعِدّ والمُدقِّق.' as oversight_ar,
  'Security, safeguards and cyber areas are never suggested.' as limitations_en,
  'لا تُقترح أبداً مجالات الأمن والضمانات والأمن السيبراني.' as limitations_ar,
  false as opt_out,
  '[{"label":"US 29 CFR 1607.4(D) · Uniform Guidelines on Employee Selection Procedures: the four-fifths rule","url":"https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4","as_of":"2026-10-09"},{"label":"UAE Government portal · Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)","url":"https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws","as_of":"2026-10-09"},{"label":"NIST · AI Risk Management Framework (AI RMF 1.0)","url":"https://www.nist.gov/itl/ai-risk-management-framework","as_of":"2026-10-09"}]'::jsonb as sources,
  6 as sort) v
where c.id = 'rotations' and (c.engine_surface, c.module, c.route, c.feature, c.title_en, c.title_ar, c.purpose_en, c.purpose_ar, c.owner_en, c.owner_ar, c.inputs_used, c.inputs_excluded, c.scoring_functions, c.weight_keys, c.output_en, c.output_ar, c.oversight_en, c.oversight_ar, c.limitations_en, c.limitations_ar, c.opt_out, c.sources, c.sort) is distinct from (v.engine_surface, v.module, v.route, v.feature, v.title_en, v.title_ar, v.purpose_en, v.purpose_ar, v.owner_en, v.owner_ar, v.inputs_used, v.inputs_excluded, v.scoring_functions, v.weight_keys, v.output_en, v.output_ar, v.oversight_en, v.oversight_ar, v.limitations_en, v.limitations_ar, v.opt_out, v.sources, v.sort);

-- ═════════════ FS54 rules (= src/modules/m16/taxonomyGov.ts). Internal helpers: not executable by API roles.

-- User-facing refusal messages (= GOV_MSG).
create or replace function kafaa_fs63_msg(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'not_signed_in' then 'Sign in to propose or decide a skill change'
    when 'forbidden_propose' then 'Only staff may propose a change to the skills catalogue'
    when 'forbidden_decide' then 'Only skills council members (training manager, HR director, platform admin) decide skill changes'
    when 'kind' then 'Choose add, rename, split, retire or re-level'
    when 'rationale' then 'Give a rationale of 10 to 1,000 characters: the council reads it before deciding'
    when 'not_found' then 'That skill or request does not exist'
    when 'duplicate' then 'An open request already covers this skill: comment on it instead of opening a second one'
    when 'inclusion' then 'The proposal does not meet the inclusion rule (distinct development and assessment, distinct names, a source for new skills)'
    when 'decision' then 'Choose approve or reject'
    when 'closed' then 'This request is already decided'
    when 'own_request' then 'Maker-checker: you proposed this change, so two other council members decide it'
    when 'second_approver' then 'Maker-checker: you already voted on this request; a different council member gives the second decision'
    when 'note' then 'Give the reason for a rejection (10 to 500 characters): it is shown to the proposer'
    when 'stale' then 'The catalogue changed since this request was made: it no longer applies as written'
    when 'forbidden_queue' then 'Only skills council members and auditors see the council queue'
    else p_code end
$$;

-- The Result code of a refusal (= govResultCode).
create or replace function kafaa_fs63_code(p_code text) returns text language sql immutable set search_path = public as $$
  select case
    when p_code in ('kind', 'rationale', 'inclusion', 'decision', 'note') then 'invalid'
    when p_code in ('duplicate', 'closed', 'stale') then 'conflict'
    when p_code in ('own_request', 'second_approver') then 'maker_checker'
    when p_code in ('forbidden_propose', 'forbidden_decide', 'forbidden_queue') then 'forbidden'
    else p_code end
$$;

-- A JSON value as text when it is a string, else '' (= str); trimmed of spaces, tabs and line breaks (= clean); blank (= blank).
create or replace function kafaa_fs63_str(p jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'string' then p #>> '{}' else '' end
$$;
create or replace function kafaa_fs63_clean(p jsonb) returns text language sql immutable set search_path = public as $$
  select btrim(kafaa_fs63_str(p), E' \t\r\n')
$$;
create or replace function kafaa_fs63_blank(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select translate(kafaa_fs63_str(p), E' \t\n\r', '') = ''
$$;
-- https URL (= isHttpsUrl).
create or replace function kafaa_fs63_https(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'string' and (p #>> '{}') ~* '^https://[^\s/$.?#][^\s]*$'
$$;
-- Name key for collision checks (= normName): lower case, Arabic diacritics and tatweel removed, alef forms, alef maqsura and ta marbuta
-- folded, runs of spaces collapsed, trimmed.
create or replace function kafaa_fs63_norm(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(translate(regexp_replace(lower(coalesce(p, '')), '[ً-ْـ]', '', 'g'), 'أإآىة', 'اااي' || 'ه'), '[ \t\r\n]+', ' ', 'g'), '^ | $', '', 'g')
$$;
-- A key level: a JSON integer from 1 to 4 (= levelOk).
create or replace function kafaa_fs63_level_ok(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric = trunc((p #>> '{}')::numeric) and (p #>> '{}')::numeric between 1 and 4, false)
$$;
-- Both names present and at most 120 characters (= nameOk).
create or replace function kafaa_fs63_name_ok(p_en jsonb, p_ar jsonb) returns boolean language sql immutable set search_path = public as $$
  select not kafaa_fs63_blank(p_en) and not kafaa_fs63_blank(p_ar) and length(kafaa_fs63_clean(p_en)) <= 120 and length(kafaa_fs63_clean(p_ar)) <= 120
$$;
-- The parts of a split (= partsOf).
create or replace function kafaa_fs63_parts(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p -> 'parts') = 'array' then p -> 'parts' else '[]'::jsonb end
$$;

-- The inclusion checks in a fixed order (= inclusionChecks): skill, names, distinct_name, development, assessment, source, replacement, level.
-- p = { kind, skill_id, proposal, rationale, development, assessment }.
create or replace function kafaa_fs63_inclusion(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_kind text := kafaa_fs63_str(p -> 'kind');
  v_sid text := case when jsonb_typeof(p -> 'skill_id') = 'string' then p ->> 'skill_id' end;
  q jsonb := case when jsonb_typeof(p -> 'proposal') = 'object' then p -> 'proposal' else '{}'::jsonb end;
  t kafaa_skills; v_parts jsonb := kafaa_fs63_parts(case when jsonb_typeof(p -> 'proposal') = 'object' then p -> 'proposal' else '{}'::jsonb end);
  v_skill boolean; v_names boolean := true; v_distinct boolean := true; v_src boolean; v_repl boolean := true; v_lvl boolean := true;
  v_keys text[] := '{}'; v_taken text[];
begin
  if v_sid is not null then select * into t from kafaa_skills where id = v_sid; end if;
  v_skill := case when v_kind = 'add' then coalesce(v_sid, '') = '' else t.id is not null and t.lifecycle is distinct from 'obsolete' end;
  if v_kind in ('add', 'rename') then v_names := kafaa_fs63_name_ok(q -> 'name_en', q -> 'name_ar');
  elsif v_kind = 'split' then
    v_names := jsonb_array_length(v_parts) between 2 and 4
      and not exists (select 1 from jsonb_array_elements(v_parts) e where jsonb_typeof(e) <> 'object' or not kafaa_fs63_name_ok(e -> 'name_en', e -> 'name_ar'));
  end if;
  if v_kind in ('add', 'rename', 'split') then
    if v_kind = 'split' then
      select coalesce(array_agg(k order by i, j), '{}') into v_keys from (
        select e.i, x.j, kafaa_fs63_norm(kafaa_fs63_str(case x.j when 1 then e.v -> 'name_en' else e.v -> 'name_ar' end)) k
        from jsonb_array_elements(v_parts) with ordinality e(v, i) cross join (values (1), (2)) x(j)) z;
    else
      v_keys := array[kafaa_fs63_norm(kafaa_fs63_str(q -> 'name_en')), kafaa_fs63_norm(kafaa_fs63_str(q -> 'name_ar'))];
    end if;
    select coalesce(array_agg(distinct z.k), '{}') into v_taken from (
      select kafaa_fs63_norm(u) k from kafaa_skills s, unnest(array[s.name_en, s.name_ar] || coalesce(s.alt_labels_en, '{}') || coalesce(s.alt_labels_ar, '{}')) u
      where s.lifecycle is distinct from 'obsolete' and (v_kind = 'split' or s.id is distinct from v_sid)) z where z.k <> '';
    v_distinct := not exists (select 1 from unnest(v_keys) k where k = '' or k = any(v_taken))
      and (select count(*) from unnest(v_keys)) = (select count(distinct k) from unnest(v_keys) k);
    if v_kind = 'rename' and t.id is not null and kafaa_fs63_norm(kafaa_fs63_str(q -> 'name_en')) = kafaa_fs63_norm(t.name_en)
       and kafaa_fs63_norm(kafaa_fs63_str(q -> 'name_ar')) = kafaa_fs63_norm(t.name_ar) then v_distinct := false; end if;
  end if;
  v_src := v_kind <> 'add' or (kafaa_fs63_https(q -> 'source_url') and not kafaa_fs63_blank(q -> 'source_label'));
  if v_kind = 'retire' and coalesce(jsonb_typeof(q -> 'replaced_by'), 'null') <> 'null' then
    v_repl := exists (select 1 from kafaa_skills r where r.id = q ->> 'replaced_by' and r.lifecycle is distinct from 'obsolete' and r.id is distinct from v_sid);
  end if;
  if v_kind = 'add' then
    v_lvl := (coalesce(jsonb_typeof(q -> 'key_level'), 'null') = 'null' or kafaa_fs63_level_ok(q -> 'key_level'))
      and exists (select 1 from kafaa_competencies c where c.id = kafaa_fs63_str(q -> 'competency_id'))
      and kafaa_fs63_str(q -> 'area') = any (array['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'digital', 'project']);
  elsif v_kind = 'relevel' then
    v_lvl := kafaa_fs63_level_ok(q -> 'key_level') and t.id is not null
      and ((q ->> 'key_level')::numeric <> t.key_level
        or (not kafaa_fs63_blank(q -> 'level_essence_en') and kafaa_fs63_clean(q -> 'level_essence_en') <> btrim(coalesce(t.level_essence_en, ''), E' \t\r\n'))
        or (not kafaa_fs63_blank(q -> 'level_essence_ar') and kafaa_fs63_clean(q -> 'level_essence_ar') <> btrim(coalesce(t.level_essence_ar, ''), E' \t\r\n')));
  end if;
  return jsonb_build_array(
    jsonb_build_object('key', 'skill', 'ok', v_skill), jsonb_build_object('key', 'names', 'ok', v_names), jsonb_build_object('key', 'distinct_name', 'ok', v_distinct),
    jsonb_build_object('key', 'development', 'ok', length(kafaa_fs63_clean(p -> 'development')) >= 20), jsonb_build_object('key', 'assessment', 'ok', length(kafaa_fs63_clean(p -> 'assessment')) >= 20),
    jsonb_build_object('key', 'source', 'ok', v_src), jsonb_build_object('key', 'replacement', 'ok', v_repl), jsonb_build_object('key', 'level', 'ok', coalesce(v_lvl, false)));
end $$;

-- Refusal code of a proposal or null (= proposeProblem): kind, rationale, not_found, duplicate, inclusion.
create or replace function kafaa_fs63_propose_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_kind text := kafaa_fs63_str(p -> 'kind');
  v_sid text := case when jsonb_typeof(p -> 'skill_id') = 'string' then p ->> 'skill_id' end;
  v_why int := length(kafaa_fs63_clean(p -> 'rationale'));
  v_name text := kafaa_fs63_norm(kafaa_fs63_str(case when jsonb_typeof(p -> 'proposal') = 'object' then p -> 'proposal' -> 'name_en' end));
begin
  if v_kind not in ('add', 'rename', 'split', 'retire', 'relevel') then return 'kind'; end if;
  if v_why < 10 or v_why > 1000 then return 'rationale'; end if;
  if v_kind <> 'add' and not exists (select 1 from kafaa_skills s where s.id = v_sid) then return 'not_found'; end if;
  if v_kind <> 'add' and exists (select 1 from kafaa_skill_change_requests r where r.status in ('submitted', 'first_approved', 'first_rejected') and r.skill_id = v_sid) then return 'duplicate'; end if;
  if v_kind = 'add' and exists (select 1 from kafaa_skill_change_requests r where r.status in ('submitted', 'first_approved', 'first_rejected') and r.kind = 'add'
    and kafaa_fs63_norm(kafaa_fs63_str(r.proposal -> 'name_en')) = v_name) then return 'duplicate'; end if;
  if exists (select 1 from jsonb_array_elements(kafaa_fs63_inclusion(p)) c where not (c ->> 'ok')::boolean) then return 'inclusion'; end if;
  return null;
end $$;

-- Refusal code of a council vote or null (= decideProblem), after the grant check.
create or replace function kafaa_fs63_decide_problem(r kafaa_skill_change_requests, p_me text, p_decision text, p_note text) returns text language plpgsql immutable set search_path = public as $$
declare v_n int := length(btrim(coalesce(p_note, ''), E' \t\r\n'));
begin
  if r.id is null then return 'not_found'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then return 'decision'; end if;
  if r.status not in ('submitted', 'first_approved', 'first_rejected') then return 'closed'; end if;
  if r.proposed_by = p_me then return 'own_request'; end if;
  if r.status <> 'submitted' and r.first_by = p_me then return 'second_approver'; end if;
  if (p_decision = 'reject' and v_n < 10) or v_n > 500 then return 'note'; end if;
  return null;
end $$;

-- A short title of a request (= requestTitle).
create or replace function kafaa_fs63_title(p_kind text, p_en text, p_ar text, q jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case p_kind
    when 'add' then jsonb_build_object('en', format('Add "%s"', kafaa_fs63_clean(q -> 'name_en')), 'ar', format('إضافة «%s»', kafaa_fs63_clean(q -> 'name_ar')))
    when 'rename' then jsonb_build_object('en', format('Rename "%s" to "%s"', btrim(coalesce(p_en, ''), E' \t\r\n'), kafaa_fs63_clean(q -> 'name_en')),
      'ar', format('إعادة تسمية «%s» إلى «%s»', btrim(coalesce(p_ar, ''), E' \t\r\n'), kafaa_fs63_clean(q -> 'name_ar')))
    when 'split' then jsonb_build_object('en', format('Split "%s" into %s skills', btrim(coalesce(p_en, ''), E' \t\r\n'), jsonb_array_length(kafaa_fs63_parts(q))),
      'ar', format('تقسيم «%s» إلى %s مهارات', btrim(coalesce(p_ar, ''), E' \t\r\n'), jsonb_array_length(kafaa_fs63_parts(q))))
    when 'retire' then jsonb_build_object('en', format('Retire "%s"', btrim(coalesce(p_en, ''), E' \t\r\n')), 'ar', format('إيقاف «%s»', btrim(coalesce(p_ar, ''), E' \t\r\n')))
    else jsonb_build_object('en', format('Re-level "%s" to key level %s', btrim(coalesce(p_en, ''), E' \t\r\n'), ((q ->> 'key_level')::numeric)::int),
      'ar', format('إعادة تحديد مستوى «%s» إلى المستوى المحوري %s', btrim(coalesce(p_ar, ''), E' \t\r\n'), ((q ->> 'key_level')::numeric)::int)) end
$$;

-- Next sequential id (= nextId): the highest numeric suffix plus one, three digits.
create or replace function kafaa_fs63_next_id(p_prefix text, p_ids text[]) returns text language sql immutable set search_path = public as $$
  select p_prefix || '-' || lpad((coalesce(max(substring(x from '^' || p_prefix || '-(\d+)$')::int), 0) + 1)::text, 3, '0') from unnest(coalesce(p_ids, '{}')) x
$$;

-- The generic level essence of a key level, filled with the skill name (= levelEssence in src/domain/taxonomy.ts).
create or replace function kafaa_fs63_essence(p_level int, p_en text, p_ar text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'en', replace(case least(4, greatest(1, p_level))
      when 1 then 'Awareness: explains what {skill} is for and follows guidance on routine tasks under close supervision.'
      when 2 then 'Practitioner: applies {skill} on routine work with some supervision, using procedures and checking own work.'
      when 3 then 'Independent: applies {skill} on varied work without supervision, checks the work of others and solves non-routine problems.'
      else 'Expert: sets the standard for {skill}, advises across teams and develops others.' end, '{skill}', lower(left(p_en, 1)) || substr(p_en, 2)),
    'ar', replace(case least(4, greatest(1, p_level))
      when 1 then 'إلمام: يشرح الغرض من {skill} ويتبع الإرشادات في المهام الروتينية تحت إشراف مباشر.'
      when 2 then 'ممارس: يطبّق {skill} في الأعمال الروتينية بإشراف محدود، ملتزماً بالإجراءات ومراجعاً عمله.'
      when 3 then 'مستقل: يطبّق {skill} في أعمال متنوعة دون إشراف، ويراجع عمل الآخرين ويحل المشكلات غير الروتينية.'
      else 'خبير: يضع المعيار في {skill}، ويقدّم المشورة عبر الفرق ويطوّر الآخرين.' end, '{skill}', p_ar))
$$;

-- The catalogue fields a change log row records (= snapshot).
create or replace function kafaa_fs63_snapshot(s kafaa_skills) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('name_en', s.name_en, 'name_ar', s.name_ar, 'key_level', s.key_level, 'lifecycle', s.lifecycle, 'version', s.version, 'obsolete_on', s.obsolete_on,
    'replaced_by', s.replaced_by, 'review_due', s.review_due, 'level_essence_en', s.level_essence_en, 'level_essence_ar', s.level_essence_ar,
    'alt_labels_en', to_jsonb(coalesce(s.alt_labels_en, '{}')), 'alt_labels_ar', to_jsonb(coalesce(s.alt_labels_ar, '{}')))
$$;

-- https sources of a skill as {label, url} (= srcList).
create or replace function kafaa_fs63_sources(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('label', kafaa_fs63_str(e -> 'label'), 'url', e ->> 'url') order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality x(e, i)
  where jsonb_typeof(e) = 'object' and kafaa_fs63_https(e -> 'url')
$$;

-- Review due one review cycle after a day (= REVIEW_CYCLE_MONTHS: fast 12, standard 24, slow 36 months; day clamped to the month).
create or replace function kafaa_fs63_review_due(p_day date, p_decay text) returns date language sql immutable set search_path = public as $$
  select (p_day + make_interval(months => case coalesce(p_decay, 'standard') when 'fast' then 12 when 'slow' then 36 else 24 end))::date
$$;

-- Apply a published request to the catalogue (= changePlan) and return the change log fields (without id, roles and timestamps).
-- Retire and split mark the original obsolete (the FS02 guard refuses any removal); new skills are inserted with version 1.
create or replace function kafaa_fs63_apply(r kafaa_skill_change_requests, p_day date) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q jsonb := coalesce(r.proposal, '{}'::jsonb); s kafaa_skills; s2 kafaa_skills; v_num text := regexp_replace(r.id, '^scr-', ''); v_sort int; v_key int; v_decay text; v_ess jsonb;
  v_ids text[] := '{}'; v_names_en text[] := '{}'; v_names_ar text[] := '{}'; e jsonb; i int := 0; v_id text; v_en text; v_ar text; v_repl text;
  v_dash text[]; v_meth boolean;
begin
  select coalesce(max(sort), 0) into v_sort from kafaa_skills;
  v_meth := r.kind <> 'rename';
  v_dash := case r.kind when 'rename' then array['catalogue'] when 'relevel' then array['catalogue', 'skills_outlook', 'skill_forecasts', 'skills_health']
    else array['catalogue', 'skills_outlook', 'skill_forecasts', 'skills_health', 'datasheet'] end;
  if r.kind = 'add' then
    v_key := coalesce((q ->> 'key_level')::numeric::int, 2);
    v_decay := case when kafaa_fs63_str(q -> 'decay_class') in ('fast', 'standard', 'slow') then kafaa_fs63_str(q -> 'decay_class') else 'standard' end;
    v_en := kafaa_fs63_clean(q -> 'name_en'); v_ar := kafaa_fs63_clean(q -> 'name_ar');
    v_ess := kafaa_fs63_essence(v_key, v_en, v_ar);
    v_id := 'sk-c-' || v_num;
    insert into kafaa_skills (id, code, competency_id, name_en, name_ar, area, core, key_level, evidence_keys, adjacent_ids, adv_skill_ids, description_en, description_ar, sources, sort,
      reusability, skill_type, lifecycle, decay_class, owner_role, version, review_due, level_essence_en, level_essence_ar, alt_labels_en, alt_labels_ar, future_group, fs_area, benchmark_ids, obsolete_on, replaced_by)
    values (v_id, 'SC-' || v_num, kafaa_fs63_str(q -> 'competency_id'), v_en, v_ar, kafaa_fs63_str(q -> 'area'), false, v_key, '{}', '{}', '{}', kafaa_fs63_clean(q -> 'description_en'), kafaa_fs63_clean(q -> 'description_ar'),
      jsonb_build_array(jsonb_build_object('label', kafaa_fs63_clean(q -> 'source_label'), 'url', kafaa_fs63_clean(q -> 'source_url'))), v_sort + 1,
      'sector_specific', 'specialised', 'emerging', v_decay,
      case when kafaa_fs63_str(q -> 'owner_role') = any (array['nuclear_training', 'operations', 'maintenance', 'engineering', 'radiation_chemistry', 'safety_licensing', 'human_performance', 'emergency_preparedness',
        'quality', 'leadership_development', 'digital_ai_governance', 'sustainability', 'advanced_reactors', 'cyber_awareness']) then kafaa_fs63_str(q -> 'owner_role') else 'nuclear_training' end,
      1, kafaa_fs63_review_due(p_day, v_decay), v_ess ->> 'en', v_ess ->> 'ar', '{}', '{}', null,
      case when kafaa_fs63_str(q -> 'fs_area') in ('transversal', 'ai_data', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'digital_plant') then kafaa_fs63_str(q -> 'fs_area') end, '{}', null, null);
    select * into s2 from kafaa_skills where id = v_id;
    return jsonb_build_object('request_id', r.id, 'kind', 'add', 'skill_id', v_id, 'skill_code', s2.code, 'skill_name_en', v_en, 'skill_name_ar', v_ar,
      'summary_en', format('Added "%s"', v_en), 'summary_ar', format('أُضيفت «%s»', v_ar), 'before', '{}'::jsonb, 'after', kafaa_fs63_snapshot(s2), 'version_before', null, 'version_after', 1,
      'new_skill_ids', jsonb_build_array(v_id), 'replaced_by', null, 'effective_on', p_day, 'methodology', v_meth, 'dashboards', to_jsonb(v_dash), 'proposed_role', r.proposed_role,
      'sources', kafaa_fs63_sources(s2.sources));
  end if;
  select * into s from kafaa_skills where id = r.skill_id;
  if r.kind = 'split' then
    for e in select x from jsonb_array_elements(kafaa_fs63_parts(q)) x loop
      v_id := 'sk-c-' || v_num || chr(97 + i);
      v_en := kafaa_fs63_clean(e -> 'name_en'); v_ar := kafaa_fs63_clean(e -> 'name_ar');
      v_ess := kafaa_fs63_essence(s.key_level, v_en, v_ar);
      insert into kafaa_skills (id, code, competency_id, name_en, name_ar, area, core, key_level, evidence_keys, adjacent_ids, adv_skill_ids, description_en, description_ar, sources, sort,
        reusability, skill_type, lifecycle, decay_class, owner_role, version, review_due, level_essence_en, level_essence_ar, alt_labels_en, alt_labels_ar, future_group, fs_area, benchmark_ids, obsolete_on, replaced_by)
      values (v_id, 'SC-' || v_num || chr(65 + i), s.competency_id, v_en, v_ar, s.area, false, s.key_level, '{}', array[s.id], '{}', kafaa_fs63_clean(e -> 'description_en'), kafaa_fs63_clean(e -> 'description_ar'),
        kafaa_fs63_sources(s.sources), v_sort + 1 + i, coalesce(s.reusability, 'sector_specific'), coalesce(s.skill_type, 'specialised'),
        case when s.lifecycle = 'obsolete' then 'stable' else coalesce(s.lifecycle, 'stable') end, coalesce(s.decay_class, 'standard'), coalesce(s.owner_role, 'nuclear_training'), 1,
        kafaa_fs63_review_due(p_day, coalesce(s.decay_class, 'standard')), v_ess ->> 'en', v_ess ->> 'ar', '{}', '{}', s.future_group, s.fs_area, coalesce(s.benchmark_ids, '{}'), null, null);
      v_ids := v_ids || v_id; v_names_en := v_names_en || v_en; v_names_ar := v_names_ar || v_ar; i := i + 1;
    end loop;
    update kafaa_skills set lifecycle = 'obsolete', obsolete_on = p_day, replaced_by = v_ids[1] where id = s.id;
    select * into s2 from kafaa_skills where id = s.id;
    return jsonb_build_object('request_id', r.id, 'kind', 'split', 'skill_id', s.id, 'skill_code', s.code, 'skill_name_en', s.name_en, 'skill_name_ar', s.name_ar,
      'summary_en', format('Split "%s" into %s', s.name_en, (select string_agg(format('"%s"', n), ' and ' order by k) from unnest(v_names_en) with ordinality u(n, k))),
      'summary_ar', format('قُسّمت «%s» إلى %s', s.name_ar, (select string_agg(format('«%s»', n), ' و' order by k) from unnest(v_names_ar) with ordinality u(n, k))),
      'before', kafaa_fs63_snapshot(s), 'after', kafaa_fs63_snapshot(s2), 'version_before', s.version, 'version_after', s.version, 'new_skill_ids', to_jsonb(v_ids), 'replaced_by', v_ids[1],
      'effective_on', p_day, 'methodology', v_meth, 'dashboards', to_jsonb(v_dash), 'proposed_role', r.proposed_role, 'sources', kafaa_fs63_sources(s.sources));
  end if;
  if r.kind = 'retire' then
    select x.id into v_repl from kafaa_skills x where coalesce(jsonb_typeof(q -> 'replaced_by'), 'null') <> 'null' and x.id = q ->> 'replaced_by';
    update kafaa_skills set lifecycle = 'obsolete', obsolete_on = p_day, replaced_by = v_repl where id = s.id;
    select * into s2 from kafaa_skills where id = s.id;
    return jsonb_build_object('request_id', r.id, 'kind', 'retire', 'skill_id', s.id, 'skill_code', s.code, 'skill_name_en', s.name_en, 'skill_name_ar', s.name_ar,
      'summary_en', case when v_repl is null then format('Retired "%s"', s.name_en) else format('Retired "%s", replaced by "%s"', s.name_en, (select name_en from kafaa_skills where id = v_repl)) end,
      'summary_ar', case when v_repl is null then format('أُوقفت «%s»', s.name_ar) else format('أُوقفت «%s» وحلّت محلها «%s»', s.name_ar, (select name_ar from kafaa_skills where id = v_repl)) end,
      'before', kafaa_fs63_snapshot(s), 'after', kafaa_fs63_snapshot(s2), 'version_before', s.version, 'version_after', s.version, 'new_skill_ids', '[]'::jsonb, 'replaced_by', v_repl,
      'effective_on', p_day, 'methodology', v_meth, 'dashboards', to_jsonb(v_dash), 'proposed_role', r.proposed_role, 'sources', kafaa_fs63_sources(s.sources));
  end if;
  if r.kind = 'rename' then
    v_en := kafaa_fs63_clean(q -> 'name_en'); v_ar := kafaa_fs63_clean(q -> 'name_ar');
    update kafaa_skills set name_en = v_en, name_ar = v_ar,
      alt_labels_en = case when s.name_en <> '' and not exists (select 1 from unnest(coalesce(s.alt_labels_en, '{}')) l where kafaa_fs63_norm(l) = kafaa_fs63_norm(s.name_en)) then coalesce(s.alt_labels_en, '{}') || s.name_en else coalesce(s.alt_labels_en, '{}') end,
      alt_labels_ar = case when s.name_ar <> '' and not exists (select 1 from unnest(coalesce(s.alt_labels_ar, '{}')) l where kafaa_fs63_norm(l) = kafaa_fs63_norm(s.name_ar)) then coalesce(s.alt_labels_ar, '{}') || s.name_ar else coalesce(s.alt_labels_ar, '{}') end,
      version = coalesce(s.version, 1) + 1, review_due = kafaa_fs63_review_due(p_day, s.decay_class) where id = s.id;
    select * into s2 from kafaa_skills where id = s.id;
    return jsonb_build_object('request_id', r.id, 'kind', 'rename', 'skill_id', s.id, 'skill_code', s.code, 'skill_name_en', v_en, 'skill_name_ar', v_ar,
      'summary_en', format('Renamed "%s" to "%s"', s.name_en, v_en), 'summary_ar', format('أُعيدت تسمية «%s» إلى «%s»', s.name_ar, v_ar),
      'before', kafaa_fs63_snapshot(s), 'after', kafaa_fs63_snapshot(s2), 'version_before', coalesce(s.version, 1), 'version_after', coalesce(s.version, 1) + 1, 'new_skill_ids', '[]'::jsonb, 'replaced_by', null,
      'effective_on', p_day, 'methodology', v_meth, 'dashboards', to_jsonb(v_dash), 'proposed_role', r.proposed_role, 'sources', kafaa_fs63_sources(s.sources));
  end if;
  -- relevel
  v_key := (q ->> 'key_level')::numeric::int;
  v_ess := kafaa_fs63_essence(v_key, s.name_en, s.name_ar);
  update kafaa_skills set key_level = v_key,
    level_essence_en = case when kafaa_fs63_blank(q -> 'level_essence_en') then v_ess ->> 'en' else kafaa_fs63_clean(q -> 'level_essence_en') end,
    level_essence_ar = case when kafaa_fs63_blank(q -> 'level_essence_ar') then v_ess ->> 'ar' else kafaa_fs63_clean(q -> 'level_essence_ar') end,
    version = coalesce(s.version, 1) + 1, review_due = kafaa_fs63_review_due(p_day, s.decay_class) where id = s.id;
  select * into s2 from kafaa_skills where id = s.id;
  return jsonb_build_object('request_id', r.id, 'kind', 'relevel', 'skill_id', s.id, 'skill_code', s.code, 'skill_name_en', s.name_en, 'skill_name_ar', s.name_ar,
    'summary_en', format('Re-levelled "%s": key level %s to %s', s.name_en, s.key_level, v_key), 'summary_ar', format('أُعيد تحديد مستوى «%s»: المستوى المحوري من %s إلى %s', s.name_ar, s.key_level, v_key),
    'before', kafaa_fs63_snapshot(s), 'after', kafaa_fs63_snapshot(s2), 'version_before', coalesce(s.version, 1), 'version_after', coalesce(s.version, 1) + 1, 'new_skill_ids', '[]'::jsonb, 'replaced_by', null,
    'effective_on', p_day, 'methodology', v_meth, 'dashboards', to_jsonb(v_dash), 'proposed_role', r.proposed_role, 'sources', kafaa_fs63_sources(s.sources));
end $$;

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
