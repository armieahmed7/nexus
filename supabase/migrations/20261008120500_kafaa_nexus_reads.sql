-- Kafa'a read-only views over existing ENEC NEXUS tables (SECURITY DEFINER functions with Kafa'a's own checks).
-- Additive only: reads public.personas, authority_matrix, organisations, training_programs, people_quals,
-- eco_courses, eco_enrolments, eco_scholarships, eco_partnerships. Never writes to them.

-- NEXUS role cards and their "Decides" lines (public, as on the NEXUS /platform screen)
create or replace function kafaa_nexus_personas() returns table (id text, role text, title text, lens text, org_id text, plane text, decides text)
language sql stable security definer set search_path = public as $$
  select p.id, p.role, p.title, p.lens, p.org_id, p.plane, p.decides from personas p order by p.lens, p.id
$$;

-- People-plane reserved decisions (domain T) from the NEXUS authority matrix
create or replace function kafaa_nexus_authority() returns table (decision_key text, decision text, domain text, authority_role text, evidence_required text, authority_ref text, requires_second boolean)
language sql stable security definer set search_path = public as $$
  select a.decision_key, a.decision, a.domain, a.authority_role, a.evidence_required, a.authority_ref, a.requires_second
  from authority_matrix a where a.domain = 'T' or a.decision_key like 'talent%' or a.authority_role in ('Training Manager', 'Chief Human Capital Officer')
$$;

-- Organisations: public directory fields for everyone; ICV and NASL status only for the org itself or platform admins/auditors
create or replace function kafaa_nexus_organisations() returns table (id text, name text, short text, kind text, category text, country text, icv_score numeric, nasl_status text, source text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.short, o.kind, o.category, o.country,
         case when o.id = kafaa_my_org() or kafaa_has_grant('partner_org', array['R','A']) then o.icv_score end,
         case when o.id = kafaa_my_org() or kafaa_has_grant('partner_org', array['R','A']) then o.nasl_status end,
         o.source
  from organisations o
$$;

-- NEXUS training programmes: public-basis rows for everyone; all rows for staff with internal content access
create or replace function kafaa_nexus_training_programs() returns table (id text, name text, kind text, duration_months integer, participants integer, description text, basis text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.kind, t.duration_months, t.participants, t.description, t.basis
  from training_programs t where t.basis = 'public' or kafaa_has_grant('internal_content', array['R'])
$$;

-- Cohort-level qualification status (NEXUS people_quals): aggregate holders only
create or replace function kafaa_nexus_people_quals() returns table (id text, cohort text, program_id text, qualification text, status text, expires_at date, progress_pct integer, headcount integer, suppressed boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.cohort, q.program_id, q.qualification, q.status, q.expires_at, q.progress_pct,
         case when q.headcount < (kafaa_rules()->>'minGroupSize')::int then null else q.headcount end,
         q.headcount < (kafaa_rules()->>'minGroupSize')::int
  from people_quals q
  where kafaa_has_grant('workforce_analytics', array['Agg','R']) or kafaa_has_grant('qual_records', array['Scope','Agg','R'])
$$;

-- Supplier academy catalogue (public)
create or replace function kafaa_nexus_eco_courses() returns table (id text, code text, title text, topic text, summary text, hours numeric, format text, pass_mark numeric, validity_months numeric, audience text, next_session text, seats numeric, basis text, source text)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.title, c.topic, c.summary, c.hours, c.format, c.pass_mark, c.validity_months, c.audience, c.next_session, c.seats, c.basis, c.source from eco_courses c
$$;

-- Supplier academy enrolments: a partner sees only its own organisation (NEXUS B-06 lesson); training staff see all
create or replace function kafaa_nexus_eco_enrolments() returns table (id text, org_id text, persona_id text, learner_role text, course_id text, status text, score numeric, certificate_no text, certified_at text)
language sql stable security definer set search_path = public as $$
  select e.id, e.org_id, e.persona_id, e.learner_role, e.course_id, e.status, e.score, e.certificate_no, e.certified_at
  from eco_enrolments e
  where kafaa_has_grant('training', array['R','W','A']) or (e.org_id is not null and e.org_id = kafaa_my_org() and kafaa_has_grant('training', array['Own','OwnOrg']))
$$;

-- Scholarship intakes and outcomes (aggregate)
create or replace function kafaa_nexus_eco_scholarships() returns table (id text, programme text, intake_year numeric, destination text, pathway text, applicants numeric, awarded numeric, in_study numeric, graduated numeric, placed numeric, women_pct numeric, basis text)
language sql stable security definer set search_path = public as $$
  select s.id, s.programme, s.intake_year, s.destination, s.pathway, s.applicants, s.awarded, s.in_study, s.graduated, s.placed, s.women_pct, s.basis
  from eco_scholarships s where kafaa_has_grant('cohorts', array['Scope','R']) or kafaa_has_grant('workforce_analytics', array['Agg','R'])
$$;

-- Academic and research partnerships: public-basis rows for everyone
create or replace function kafaa_nexus_eco_partnerships() returns table (id text, org_id text, name text, kind text, since text, instrument text, scope text, status text, basis text, source text)
language sql stable security definer set search_path = public as $$
  select p.id, p.org_id, p.name, p.kind, p.since, p.instrument, p.scope, p.status, p.basis, p.source
  from eco_partnerships p where p.basis = 'public' or kafaa_has_grant('research', array['R','A']) or p.org_id = kafaa_my_org()
$$;

-- Caller identity as Kafa'a sees it (NEXUS persona + Kafa'a person + roles)
create or replace function kafaa_whoami() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('persona_id', nexus_my_persona(), 'person_id', kafaa_me(), 'org_id', kafaa_my_org(), 'roles', to_jsonb(kafaa_my_roles()),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('role', ra.role, 'scope_type', ra.scope_type, 'scope_value', ra.scope_value, 'status', ra.status))
                             from kafaa_role_assignments ra where ra.person_id = kafaa_me()), '[]'::jsonb))
$$;

grant execute on function kafaa_nexus_personas(), kafaa_nexus_authority(), kafaa_nexus_organisations(), kafaa_nexus_training_programs(), kafaa_nexus_people_quals(),
  kafaa_nexus_eco_courses(), kafaa_nexus_eco_enrolments(), kafaa_nexus_eco_scholarships(), kafaa_nexus_eco_partnerships(), kafaa_whoami() to anon, authenticated;
