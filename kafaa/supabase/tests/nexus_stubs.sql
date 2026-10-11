-- TEST-ONLY stubs of the existing ENEC NEXUS objects that the kafaa_* migrations reference.
-- Used by scripts/validate-migrations.mjs (PGlite). NEVER apply this file to the real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;

create table if not exists personas (id text primary key, role text not null, alias text, title text not null, lens text not null, org_id text not null, plane text not null, initials text not null default '', description text not null default '', decides text not null default '', is_default boolean not null default false);
create table if not exists profiles (user_id uuid primary key, email text not null, persona_id text not null, org_id text not null, lens text not null, planes text[] not null default '{}', roles text[] not null default '{}', read_all boolean not null default false, created_at timestamptz not null default now());
create table if not exists authority_matrix (decision_key text primary key, decision text not null, domain text not null, authority_role text not null, maker_agents text[] not null default '{}', evidence_required text not null default '', authority_ref text not null default '', requires_second boolean not null default false);
create table if not exists organisations (id text primary key, name text not null, short text, kind text not null, category text not null, country text not null, location text, basis text not null, icv_score numeric, nasl_status text not null default 'none', quality_class text, description text not null default '', source text, tags text[] not null default '{}');
create table if not exists training_programs (id text primary key, name text not null, kind text not null, duration_months integer, participants integer, description text not null, basis text not null);
create table if not exists people_quals (id text primary key, cohort text not null, program_id text, qualification text not null, status text not null, expires_at date, progress_pct integer not null, headcount integer not null);
create table if not exists eco_courses (id text primary key, code text, title text, topic text, summary text, modules jsonb, hours numeric, format text, languages text[], assessment text, pass_mark numeric, validity_months numeric, audience text, rule_ids text[], owner_role text, next_session text, seats numeric, basis text, source text);
create table if not exists eco_enrolments (id text primary key, org_id text, persona_id text, learner_role text, course_id text, enrolled_at text, modules_done numeric, status text, score numeric, certificate_no text, certified_at text, basis text);
create table if not exists eco_scholarships (id text primary key, programme text, intake_year numeric, destination text, pathway text, applicants numeric, awarded numeric, in_study numeric, graduated numeric, placed numeric, women_pct numeric, basis text);
create table if not exists eco_partnerships (id text primary key, org_id text, name text, kind text, since text, instrument text, scope text, focus text[], status text, projects numeric, basis text, source text);
create table if not exists ledger_entries (seq bigserial primary key, ts timestamptz not null default now(), actor text not null, role text not null, plane text not null, domain text not null default '', action text not null, evidence_class text not null, reason text, case_id text, agent_id text, prev_hash text not null default '', hash text not null default '', actor_persona_id text);

create or replace function nexus_uid() returns uuid language plpgsql stable as $$
declare s text;
begin
  s := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  if s is null or s !~* '^[0-9a-f-]{36}$' then return null; end if;
  return s::uuid;
end $$;
create or replace function nexus_my_persona() returns text language sql stable security definer as $$ select persona_id from profiles where user_id = nexus_uid() $$;
create or replace function nexus_my_org() returns text language sql stable security definer as $$ select org_id from profiles where user_id = nexus_uid() $$;
-- Simplified stand-in with the same signature and the same role check as the real nexus_append_ledger
create or replace function nexus_append_ledger(p jsonb) returns ledger_entries language plpgsql security definer as $$
declare me profiles; r ledger_entries;
begin
  select * into me from profiles where user_id = nexus_uid();
  if me.user_id is null then raise exception 'NEXUS · sign in to write evidence' using errcode = '42501'; end if;
  if (p->>'evidence_class') = 'USER_ACTION' and not ((p->>'role') = any(me.roles)) then raise exception 'NEXUS · cannot act as %', p->>'role' using errcode = '42501'; end if;
  insert into ledger_entries (actor, role, plane, domain, action, evidence_class, reason, actor_persona_id)
  values (p->>'role', p->>'role', p->>'plane', coalesce(p->>'domain', ''), p->>'action', p->>'evidence_class', p->>'reason', me.persona_id) returning * into r;
  return r;
end $$;

-- Minimal NEXUS rows used by the tests
insert into personas (id, role, title, lens, org_id, plane, decides) values
 ('training-mgr', 'Training Manager', 'Training Manager · Nuclear Training', 'employee', 'enec-ops', 'PEOPLE', 'bookings · qualification sign-off · licensing candidacy'),
 ('sro', 'Shift Manager · licensed SRO', 'Shift Manager', 'employee', 'enec-ops', 'OPERATIONS SUPPORT', 'shift decisions'),
 ('gulfhydro-qa', 'Gulf Hydro-Valve QA Manager', 'QA Manager', 'partner', 'org-gulfhydro', 'SUPPLY CHAIN', '')
on conflict do nothing;
insert into authority_matrix (decision_key, decision, domain, authority_role) values ('talent.candidacy', 'Hiring; licensing candidacy', 'T', 'Training Manager') on conflict do nothing;
insert into organisations (id, name, kind, category, country, basis, icv_score) values ('org-alnoor', 'Al Noor Precision Engineering LLC', 'supplier', 'x', 'UAE', 'synthetic', 41), ('ku', 'Khalifa University', 'university', 'x', 'UAE', 'public', null) on conflict do nothing;
insert into training_programs values ('TP-DNT', 'Diploma in Nuclear Technology (DNT)', 'pipeline', 24, 20, 'First cohort of 20 graduated 17 Jun 2026.', 'public'), ('TP-KC', 'Knowledge capture', 'continuing', null, null, 'illustrative', 'illustrative') on conflict do nothing;
insert into people_quals values ('PQ-1', 'Crew B LOs', 'TP-LOCT', 'LO watch-station', 'qualified', '2027-01-01', 100, 12), ('PQ-2', 'Small cohort', 'TP-LOCT', 'x', 'in_training', null, 40, 6) on conflict do nothing;
insert into eco_enrolments (id, org_id, persona_id, course_id, status) values ('E-1', 'org-alnoor', 'alnoor-qaqc', 'SA-NQA1-101', 'certified'), ('E-2', 'org-gulfhydro', 'gulfhydro-qa', 'SA-NQA1-101', 'enrolled') on conflict do nothing;
