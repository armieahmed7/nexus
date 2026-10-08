-- [W1 · E1 · F03/F04] Kafa'a Skills Passport (skill claims) and Credential Wallet (signed Open Badges 3.0-shaped credentials).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- an Ed25519 signer and a canonical-JSON function in SQL (mirrors of src/modules/m17/badgeCrypto.ts), the credential builder
-- (mirror of buildCredential in src/modules/m17/issuer.ts) and four RPCs. LocalBackend mirror: src/modules/m17/backend/local.ts.
-- Checked by scripts/validate/w1e1-passport.mjs (PGlite): SQL signature = TS signature, SQL credential = TS credential.

-- ───────────── Tables (generated DDL)
-- M17 · Self-claimed skill levels with a note (F03); claimed until validated (F10)
create table if not exists kafaa_skill_claims (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  level integer not null,
  note text not null,
  evidence_url text,
  status text not null default 'claimed' check (status in ('claimed', 'validated', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text
);
comment on table kafaa_skill_claims is '[M17] Self-claimed skill levels with a note (F03); claimed until validated (F10)';

-- M17 · Signed Open Badges 3.0-shaped credentials for Kafa'a course certificates and completions (F04); public verify via RPC
create table if not exists kafaa_badges (
  id text primary key,
  person_id text not null,
  source_table text not null check (source_table in ('certificates', 'training_records')),
  source_id text not null,
  course_id text not null,
  holder_initials text not null,
  achievement jsonb not null default '{}'::jsonb,
  credential jsonb not null default '{}'::jsonb,
  issued_on date not null,
  valid_to date,
  status text not null default 'active' check (status in ('active', 'revoked')),
  key_id text not null default 'key-1' check (key_id in ('key-1', 'key-offline')),
  public_slug text not null unique,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now()
);
comment on table kafaa_badges is '[M17] Signed Open Badges 3.0-shaped credentials for Kafa''a course certificates and completions (F04); public verify via RPC';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_claims_person_id_fk') then alter table kafaa_skill_claims add constraint kafaa_skill_claims_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_claims_skill_id_fk') then alter table kafaa_skill_claims add constraint kafaa_skill_claims_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_badges_person_id_fk') then alter table kafaa_badges add constraint kafaa_badges_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_badges_course_id_fk') then alter table kafaa_badges add constraint kafaa_badges_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skill_claims_person_id_idx on kafaa_skill_claims (person_id);
create index if not exists kafaa_skill_claims_skill_id_idx on kafaa_skill_claims (skill_id);
create index if not exists kafaa_skill_claims_status_idx on kafaa_skill_claims (status);
create index if not exists kafaa_badges_person_id_idx on kafaa_badges (person_id);
create index if not exists kafaa_badges_source_id_idx on kafaa_badges (source_id);
create index if not exists kafaa_badges_course_id_idx on kafaa_badges (course_id);
create index if not exists kafaa_badges_status_idx on kafaa_badges (status);

-- ───────────── RLS (created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
alter table kafaa_skill_claims enable row level security;
alter table kafaa_badges enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_claims' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_claims for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_badges' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_badges for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skill_claims using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_badges using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
grant select on kafaa_skill_claims, kafaa_badges to anon, authenticated;
-- Both tables change only through the SECURITY DEFINER RPCs below; the public verifies badges only through kafaa_verify_badge.
revoke insert, update on kafaa_skill_claims, kafaa_badges from anon, authenticated;

-- ───────────── Ed25519 (RFC 8032) in SQL: little-endian helpers, base-point multiplication, signing
create or replace function kafaa_ed_le(p_b bytea) returns numeric language plpgsql immutable set search_path = public as $$
declare n numeric := 0; i integer;
begin
  for i in reverse length(p_b) - 1 .. 0 loop n := n * 256 + get_byte(p_b, i); end loop;
  return n;
end $$;

create or replace function kafaa_ed_le32(p_n numeric) returns bytea language plpgsql immutable set search_path = public as $$
declare v_out bytea := decode(repeat('00', 32), 'hex'); i integer; v numeric := p_n;
begin
  for i in 0 .. 31 loop v_out := set_byte(v_out, i, mod(v, 256)::integer); v := div(v, 256); end loop;
  return v_out;
end $$;

-- [k]B in extended coordinates (double-and-add), returned as the 32-byte point encoding.
create or replace function kafaa_ed_base_mul(p_k numeric) returns bytea language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 57896044618658097711785492504343953926634992332820282019728792003956564819949;
  bx constant numeric := 15112221349535400772501151409588531511454012693041857206046113283949847762202;
  by_ constant numeric := 46316835694926478169428394003475163141307993866256225615783033603165251855960;
  k2 constant numeric := 50237614328228664512531835696112167678046477356841409204013502641986506238568; -- 2·d·Bx·By mod p
  x numeric := 0; y numeric := 1; z numeric := 1; t numeric := 0;
  a numeric; b numeric; c numeric; dd numeric; e numeric; f numeric; g numeric; h numeric;
  bits integer[] := '{}'; v numeric := p_k; bit integer; zi numeric; ex numeric; base numeric; ax numeric; ay numeric; v_out bytea;
begin
  while v > 0 loop bits := array_prepend(mod(v, 2)::integer, bits); v := div(v, 2); end loop;
  foreach bit in array bits loop
    a := mod(x * x, p); b := mod(y * y, p); c := mod(2 * z * z, p); h := a + b;
    e := mod(h - mod((x + y) * (x + y), p) + 2 * p, p); g := mod(a - b + p, p); f := mod(c + g, p);
    x := mod(e * f, p); y := mod(g * h, p); t := mod(e * h, p); z := mod(f * g, p);
    if bit = 1 then
      a := mod((y - x + p) * (by_ - bx + p), p); b := mod((y + x) * (by_ + bx), p); c := mod(t * k2, p); dd := mod(2 * z, p);
      e := mod(b - a + p, p); f := mod(dd - c + p, p); g := mod(dd + c, p); h := mod(b + a, p);
      x := mod(e * f, p); y := mod(g * h, p); t := mod(e * h, p); z := mod(f * g, p);
    end if;
  end loop;
  zi := 1; base := z; ex := p - 2;
  while ex > 0 loop
    if mod(ex, 2) = 1 then zi := mod(zi * base, p); end if;
    base := mod(base * base, p); ex := div(ex, 2);
  end loop;
  ax := mod(x * zi, p); ay := mod(y * zi, p);
  v_out := kafaa_ed_le32(ay);
  if mod(ax, 2) = 1 then v_out := set_byte(v_out, 31, get_byte(v_out, 31) | 128); end if;
  return v_out;
end $$;

create or replace function kafaa_ed25519_sign(p_msg bytea, p_seed bytea, p_pub bytea default null) returns bytea language plpgsql immutable set search_path = public as $$
declare
  l constant numeric := 7237005577332262213973186563042994240857116359379907606001950938285454250989;
  h bytea := sha512(p_seed); a bytea := substring(h from 1 for 32); prefix bytea := substring(h from 33 for 32);
  s numeric; r numeric; k numeric; pub bytea; rb bytea;
begin
  a := set_byte(a, 0, get_byte(a, 0) & 248);
  a := set_byte(a, 31, (get_byte(a, 31) & 127) | 64);
  s := kafaa_ed_le(a);
  pub := coalesce(p_pub, kafaa_ed_base_mul(s));
  r := mod(kafaa_ed_le(sha512(prefix || p_msg)), l);
  rb := kafaa_ed_base_mul(r);
  k := mod(kafaa_ed_le(sha512(rb || pub || p_msg)), l);
  return rb || kafaa_ed_le32(mod(r + k * s, l));
end $$;

create or replace function kafaa_b64url(p_b bytea) returns text language sql immutable set search_path = public as $$
  select rtrim(translate(replace(encode(p_b, 'base64'), E'\n', ''), '+/', '-_'), '=')
$$;

-- Canonical JSON (sorted keys, no whitespace): mirror of canon() in src/modules/m17/badgeCrypto.ts.
create or replace function kafaa_jcs(p_j jsonb) returns text language plpgsql immutable set search_path = public as $$
declare v_t text := jsonb_typeof(p_j); v_r text;
begin
  if v_t = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(e.k)::text || ':' || kafaa_jcs(e.v), ',' order by e.k collate "C"), '') || '}' into v_r from jsonb_each(p_j) as e(k, v);
    return v_r;
  elsif v_t = 'array' then
    select '[' || coalesce(string_agg(kafaa_jcs(e.v), ',' order by e.n), '') || ']' into v_r from jsonb_array_elements(p_j) with ordinality as e(v, n);
    return v_r;
  end if;
  return p_j::text;
end $$;

-- The server issuer key (key-1). DEMO KEY for the synthetic demo tenant: the private seed lives only in this function, which no
-- API role can execute; its public half is published at /kafaa/.well-known/kafaa-issuer.json. Rotate by replacing this function
-- and the published key together. (scripts/seed/ext/f03-passport.mjs reads it from this file to sign the seeded badges.)
create or replace function kafaa_badge_issuer_seed() returns bytea language sql immutable set search_path = public as $$
  select '\xb4f1321ed6ff7c63d8470b071222c816074f6eadd1b43eb437b467af0449844f'::bytea
$$;
create or replace function kafaa_badge_issuer_pub() returns bytea language sql immutable set search_path = public as $$
  select '\x09613c2d60072a14352f5d1055a0cfdd868dd928a097ace9eef0a438188f6455'::bytea
$$;

-- ───────────── Badge rules (mirror of src/modules/m17/badgeRules.ts)
-- Skills a course evidences: core skill of each course competency (cap 2 if qualifying, else 1) and skills keyed to the course.
create or replace function kafaa_course_alignment(p_course text)
returns table (id text, code text, name_en text, name_ar text, sort integer, lvl integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.code, s.name_en, s.name_ar, s.sort, x.lvl
  from kafaa_courses c cross join kafaa_skills s join kafaa_competencies k on k.id = s.competency_id
  cross join lateral (select greatest(
      case when s.core and s.competency_id = any(c.competency_ids) then (case when coalesce(c.qualifying, false) then 2 else 1 end) else 0 end,
      case when c.id = any(s.evidence_keys) then least(s.key_level, case when coalesce(c.qualifying, false) then 2 else 1 end) else 0 end) as lvl) x
  where c.id = p_course and k.domain <> 'security' and s.area <> 'security' and x.lvl > 0
$$;

-- Unsigned OpenBadgeCredential (proof without proofValue). Mirror of buildCredential() in src/modules/m17/issuer.ts.
create or replace function kafaa_badge_credential(p_slug text, p_kind text, p_cert_no text, p_course text, p_initials text, p_issued date,
  p_valid_to date, p_source_date date, p_source_system text, p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select * from kafaa_courses where id = p_course),
  j as (
    select jsonb_build_object(
      '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
      'id', 'urn:kafaa:badge:' || p_slug,
      'type', jsonb_build_array('VerifiableCredential', 'OpenBadgeCredential'),
      'name', c.code || ' ' || c.title_en,
      'nameAr', c.code || ' ' || c.title_ar,
      'issuer', jsonb_build_object('id', 'urn:kafaa:issuer:demo-tenant', 'type', jsonb_build_array('Profile'), 'name', 'Kafa''a demo tenant', 'url', '/kafaa/.well-known/kafaa-issuer.json'),
      'validFrom', to_char(p_issued, 'YYYY-MM-DD') || 'T00:00:00Z',
      'credentialSubject', jsonb_build_object(
        'type', jsonb_build_array('AchievementSubject'),
        'holderInitials', p_initials,
        'achievement', jsonb_build_object(
          'id', 'urn:kafaa:achievement:' || c.id,
          'type', jsonb_build_array('Achievement'),
          'achievementType', case when p_kind = 'certificate' then 'Certificate' else 'Course' end,
          'humanCode', c.code,
          'name', c.title_en,
          'nameAr', c.title_ar,
          'description', case when p_kind = 'certificate' then 'Kafa''a internal course certificate for ' || c.code || ' ' || c.title_en || '.'
                              else 'Kafa''a internal course completion for ' || c.code || ' ' || c.title_en || '.' end,
          'criteria', jsonb_build_object('narrative', case when p_kind = 'certificate'
              then 'Holds Kafa''a course certificate ' || p_cert_no || ' for ' || c.code || ' ' || c.title_en || ', issued ' || to_char(p_source_date, 'YYYY-MM-DD') || '.'
              else 'Completed ' || c.code || ' ' || c.title_en || ' as recorded in ' || p_source_system || ' on ' || to_char(p_source_date, 'YYYY-MM-DD') || '.' end),
          'criteriaAr', case when p_kind = 'certificate'
              then 'يحمل شهادة الدورة الداخلية من كفاءة رقم ' || p_cert_no || ' للدورة ' || c.code || ' ' || c.title_ar || '، الصادرة بتاريخ ' || to_char(p_source_date, 'YYYY-MM-DD') || '.'
              else 'أكمل الدورة ' || c.code || ' ' || c.title_ar || ' كما هو مسجل في ' || p_source_system || ' بتاريخ ' || to_char(p_source_date, 'YYYY-MM-DD') || '.' end,
          'alignment', coalesce((select jsonb_agg(jsonb_build_object('type', jsonb_build_array('Alignment'), 'targetType', 'ceterms:Skill', 'targetFramework', 'Kafa''a skills catalogue',
              'targetCode', al.code, 'targetName', al.name_en, 'targetUrl', 'urn:kafaa:skill:' || al.id) order by al.sort, al.id collate "C") from kafaa_course_alignment(p_course) al), '[]'::jsonb))),
      'evidence', jsonb_build_array(case when p_kind = 'certificate'
          then jsonb_build_object('id', 'urn:kafaa:certificate:' || p_cert_no, 'type', jsonb_build_array('Evidence'), 'name', 'Kafa''a course certificate ' || p_cert_no, 'narrative', 'Certificate number can also be checked at /kafaa/verify.')
          else jsonb_build_object('id', 'urn:kafaa:evidence:' || p_slug, 'type', jsonb_build_array('Evidence'), 'name', 'Course completion ' || c.code, 'narrative', 'Completion mirrored from ' || p_source_system || '.') end),
      'kafaaNotice', 'Internal Kafa''a credential; not a FANR certificate or licence.',
      'proof', jsonb_build_object('type', 'DataIntegrityProof', 'cryptosuite', 'kafaa-jcs-eddsa-2026', 'created', to_char(p_issued, 'YYYY-MM-DD') || 'T00:00:00Z',
        'verificationMethod', 'urn:kafaa:issuer:demo-tenant#' || p_key, 'proofPurpose', 'assertionMethod')) as v
    from c)
  select case when p_valid_to is null then j.v else j.v || jsonb_build_object('validUntil', to_char(p_valid_to, 'YYYY-MM-DD') || 'T00:00:00Z') end from j
$$;

-- Sign with the server key (key-1): Ed25519 over canon(credential without proof.proofValue).
create or replace function kafaa_badge_sign(p_cred jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sig bytea;
begin
  v_sig := kafaa_ed25519_sign(convert_to(kafaa_jcs(p_cred #- '{proof,proofValue}'), 'UTF8'), kafaa_badge_issuer_seed(), kafaa_badge_issuer_pub());
  return jsonb_set(p_cred, '{proof,proofValue}', to_jsonb('u' || kafaa_b64url(v_sig)));
end $$;

-- Effective status: revoked (badge or source certificate), expired (valid_to or source certificate past), else active.
create or replace function kafaa_badge_status(p_badge kafaa_badges) returns text language sql stable security definer set search_path = public as $$
  select case
    when p_badge.status = 'revoked' then 'revoked'
    when exists (select 1 from kafaa_certificates c where p_badge.source_table = 'certificates' and c.id = p_badge.source_id and c.status = 'revoked') then 'revoked'
    when exists (select 1 from kafaa_certificates c where p_badge.source_table = 'certificates' and c.id = p_badge.source_id and (c.status = 'expired' or (c.valid_to is not null and c.valid_to < current_date))) then 'expired'
    when p_badge.valid_to is not null and p_badge.valid_to < current_date then 'expired'
    else 'active' end
$$;

-- ───────────── RPC: claim a skill (F03). Own only; 20 a day; security competencies refused; audited without a ledger write.
create or replace function kafaa_claim_skill(p_skill text, p_level integer, p_note text, p_evidence_url text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_skills; v_dom text; v_note text := trim(coalesce(p_note, '')); v_url text := trim(coalesce(p_evidence_url, ''));
  v_id text; v_level integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'not_signed_in', 'Sign in to claim a skill'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'forbidden', 'Only staff can claim skills on their own passport'); end if;
  select * into s from kafaa_skills where id = p_skill;
  if s.id is null then return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'not_found', 'Skill not found', v_role); end if;
  select domain into v_dom from kafaa_competencies where id = s.competency_id;
  if s.area = 'security' or v_dom = 'security' then
    return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'security_restricted', 'Security competencies cannot be self-claimed: they show as qualified or not qualified only', v_role);
  end if;
  if p_level is null or p_level < 1 or p_level > 4 then return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'invalid', 'Level must be between 1 and 4', v_role); end if;
  if length(v_note) < 3 or length(v_note) > 500 then return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'invalid', 'Add a short note (3 to 500 characters)', v_role); end if;
  if v_url <> '' and (v_url !~* '^https?://[^\s]{3,}$' or length(v_url) > 300) then
    return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'invalid', 'The evidence link must be an http(s) address of up to 300 characters', v_role);
  end if;
  if (select count(*) from kafaa_skill_claims c where c.person_id = me and (c.created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date) >= 20 then
    return kafaa_refuse('skills.claim', 'skill_claims', p_skill, 'rate_limited', 'You can add up to 20 claims a day', v_role);
  end if;
  update kafaa_skill_evidence e set active = false from kafaa_skill_claims c
    where c.person_id = me and c.skill_id = s.id and c.status = 'claimed' and e.id = 'se:rating:' || c.id || ':' || s.id;
  update kafaa_skill_claims set status = 'superseded' where person_id = me and skill_id = s.id and status = 'claimed';
  v_id := 'scl-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
  insert into kafaa_skill_claims (id, person_id, skill_id, level, note, evidence_url, status, created_at)
  values (v_id, me, s.id, p_level, v_note, nullif(v_url, ''), 'claimed', now());
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
  values ('se:rating:' || v_id || ':' || s.id, me, s.id, 'rating', 'skill_claims', v_id, p_level, 'claimed', 'current', (now() at time zone 'UTC')::date, v_note, me, true, now());
  perform kafaa_skills_apply(me, (now() at time zone 'UTC')::date);
  select level into v_level from kafaa_person_skills where id = 'ps:' || me || ':' || s.id;
  a := kafaa_audit('skills.claim', 'skill_claims', v_id, 'ok', s.id || ' level ' || p_level, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Claim recorded. It stays "claimed" until a manager or peer validates it.', a, null,
    jsonb_build_object('id', v_id, 'level', p_level, 'state_level', coalesce(v_level, 0)));
end $$;

-- ───────────── RPC: issue a badge (F04). Own only; from a valid Kafa'a course certificate or course completion of the caller.
-- Same checks and codes as badgeSourceCheck in src/modules/m17/badgeRules.ts.
create or replace function kafaa_issue_badge(p_source text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_src text := trim(coalesce(p_source, '')); cert kafaa_certificates; tr kafaa_training_records; co kafaa_courses;
  v_kind text; v_table text; v_cert_no text; v_date date; v_valid date; v_system text; v_init text; v_slug text; v_id text; v_cred jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'not_signed_in', 'Sign in to issue a badge'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'forbidden', 'Only staff can issue badges to their own wallet'); end if;
  select initials into v_init from kafaa_people where id = me;
  select * into cert from kafaa_certificates where id = v_src and person_id = me;
  if cert.id is null then
    select * into tr from kafaa_training_records where id = v_src and person_id = me and result in ('passed', 'completed');
  end if;
  if cert.id is null and tr.id is null then
    if exists (select 1 from kafaa_licences where id = v_src and person_id = me) or exists (select 1 from kafaa_qual_records where id = v_src and person_id = me) then
      return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'Licences and qualification records mirror the licensee''s systems and are never issued as badges', v_role);
    end if;
    return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'not_found', 'No certificate or course completion of yours has this number', v_role);
  end if;
  select * into co from kafaa_courses where id = coalesce(cert.course_id, tr.course_id);
  if co.id is null then return kafaa_refuse('badge.issue', 'badges', v_src, 'not_found', 'Course not found', v_role); end if;
  if cert.id is not null then
    if cert.status = 'revoked' then return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'This certificate is revoked: a badge cannot be issued', v_role); end if;
    if cert.status <> 'valid' or (cert.valid_to is not null and cert.valid_to < current_date) then
      return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'This certificate has expired: a badge cannot be issued', v_role);
    end if;
    v_kind := 'certificate'; v_table := 'certificates'; v_cert_no := cert.id; v_date := cert.issued_on; v_valid := cert.valid_to;
    v_system := 'Kafa''a certificate register'; v_init := coalesce(nullif(cert.holder_initials, ''), v_init, '—');
  else
    v_date := tr.completed_on;
    v_valid := case when co.validity_months is not null and co.validity_months > 0 then (tr.completed_on + make_interval(months => co.validity_months))::date end;
    if v_valid is not null and v_valid < current_date then
      return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'This course completion is past its validity: a badge cannot be issued', v_role);
    end if;
    if exists (select 1 from kafaa_certificates c where c.person_id = me and c.course_id = co.id) then
      return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'A certificate exists for this course: the badge wraps the certificate instead', v_role);
    end if;
    v_kind := 'completion'; v_table := 'training_records'; v_cert_no := null; v_system := coalesce(tr.source_system, 'Training records system'); v_init := coalesce(v_init, '—');
  end if;
  if exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security') then
    return kafaa_refuse('badge.issue', 'badges', v_src, 'security_restricted', 'Security-related training shows as qualified or not qualified only and is never issued as a badge', v_role);
  end if;
  if exists (select 1 from kafaa_badges b where b.person_id = me and b.course_id = co.id and b.status = 'active') then
    return kafaa_refuse('badge.issue', 'badges', v_src, 'already_issued', 'You already hold an active badge for this course', v_role);
  end if;
  v_slug := 'kb' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_id := 'bdg-' || v_slug;
  v_cred := kafaa_badge_sign(kafaa_badge_credential(v_slug, v_kind, v_cert_no, co.id, v_init, current_date, v_valid, v_date, v_system, 'key-1'));
  insert into kafaa_badges (id, person_id, source_table, source_id, course_id, holder_initials, achievement, credential, issued_on, valid_to, status, key_id, public_slug, created_at)
  values (v_id, me, v_table, v_src, co.id, v_init,
    jsonb_build_object('kind', v_kind, 'code', co.code, 'name_en', co.title_en, 'name_ar', co.title_ar,
      'skills', coalesce((select jsonb_agg(al.id order by al.sort, al.id collate "C") from kafaa_course_alignment(co.id) al), '[]'::jsonb)),
    v_cred, current_date, v_valid, 'active', 'key-1', v_slug, now());
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
  select 'se:credential:' || v_id || ':' || al.id, me, al.id, 'credential', 'badges', v_id, al.lvl, 'evidenced', 'current', v_date, null, me, true, now()
  from kafaa_course_alignment(co.id) al
  on conflict (id) do update set active = true;
  perform kafaa_skills_apply(me, current_date);
  l := kafaa_ledger('kafaa.badge.issue', format('Badge %s issued for %s (%s)', v_slug, co.code, v_kind));
  a := kafaa_audit('badge.issue', 'badges', v_id, 'ok', co.code || ' ' || v_kind || ' ' || v_src, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Badge issued and signed', a, l, jsonb_build_object('id', v_id, 'slug', v_slug));
end $$;

-- ───────────── RPC: revoke a badge (F04): the holder (withdraw) or a training manager (skills_profile A).
create or replace function kafaa_revoke_badge(p_badge text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); bd kafaa_badges; v_own boolean; v_role text; v_why text := trim(coalesce(p_reason, '')); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('badge.revoke', 'badges', p_badge, 'not_signed_in', 'Sign in to revoke a badge'); end if;
  select * into bd from kafaa_badges where id = p_badge;
  v_own := bd.id is not null and bd.person_id = me and kafaa_has_grant('skills_profile', array['Own']);
  if bd.id is null or (not v_own and not kafaa_has_grant('skills_profile', array['A'])) then
    return kafaa_refuse('badge.revoke', 'badges', p_badge, 'not_found', 'Badge not found');
  end if;
  v_role := case when v_own then kafaa_acting_role('skills_profile', array['Own']) else kafaa_acting_role('skills_profile', array['A']) end;
  if bd.status = 'revoked' then return kafaa_refuse('badge.revoke', 'badges', p_badge, 'conflict', 'This badge is already revoked', v_role); end if;
  if length(v_why) < 3 or length(v_why) > 500 then return kafaa_refuse('badge.revoke', 'badges', p_badge, 'invalid', 'Give a short reason (3 to 500 characters)', v_role); end if;
  update kafaa_badges set status = 'revoked', revoked_at = now(), revoke_reason = v_why where id = bd.id;
  update kafaa_skill_evidence set active = false where ref_table = 'badges' and ref_id = bd.id and active;
  perform kafaa_skills_apply(bd.person_id, current_date);
  l := kafaa_ledger('kafaa.badge.revoke', format('Badge %s revoked', bd.public_slug));
  a := kafaa_audit('badge.revoke', 'badges', bd.id, 'ok', case when v_own then 'withdrawn by holder: ' else 'revoked: ' end || v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_own then 'Badge withdrawn' else 'Badge revoked' end, a, l);
end $$;

-- ───────────── RPC: public verification by share slug (F04). Anyone; rate-limited (20 a minute per badge, 600 a minute overall);
-- every call is audited. Returns the signed credential (holder initials only) and its effective status.
create or replace function kafaa_verify_badge(p_slug text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text := left(trim(coalesce(p_slug, '')), 64); bd kafaa_badges; v_status text; a kafaa_audit_events;
begin
  if (select count(*) from kafaa_audit_events e where e.action = 'badge.verify' and e.ts > now() - interval '1 minute' and e.entity_id = v_slug) >= 20
     or (select count(*) from kafaa_audit_events e where e.action = 'badge.verify' and e.ts > now() - interval '1 minute') >= 600 then
    return kafaa_refuse('badge.verify', 'badges', nullif(v_slug, ''), 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  select * into bd from kafaa_badges where public_slug = v_slug;
  if bd.id is null or v_slug = '' then return kafaa_refuse('badge.verify', 'badges', nullif(v_slug, ''), 'not_found', 'No Kafa''a badge has this link'); end if;
  v_status := kafaa_badge_status(bd);
  a := kafaa_audit('badge.verify', 'badges', v_slug, 'ok', v_status, 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Badge found', a, null, jsonb_build_object('found', true, 'slug', v_slug, 'status', v_status, 'credential', bd.credential,
    'key_id', bd.key_id, 'checked_on', to_char(current_date, 'YYYY-MM-DD'), 'notice', 'Internal Kafa''a credential; not a FANR certificate or licence.'));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; RPCs to authenticated; verification also to anon.
revoke execute on function kafaa_ed_le(bytea), kafaa_ed_le32(numeric), kafaa_ed_base_mul(numeric), kafaa_ed25519_sign(bytea, bytea, bytea), kafaa_b64url(bytea), kafaa_jcs(jsonb),
  kafaa_badge_issuer_seed(), kafaa_badge_issuer_pub(), kafaa_course_alignment(text), kafaa_badge_credential(text, text, text, text, text, date, date, date, text, text),
  kafaa_badge_sign(jsonb), kafaa_badge_status(kafaa_badges) from public, anon, authenticated;
revoke execute on function kafaa_claim_skill(text, integer, text, text), kafaa_issue_badge(text), kafaa_revoke_badge(text, text), kafaa_verify_badge(text) from public, anon;
grant execute on function kafaa_claim_skill(text, integer, text, text), kafaa_issue_badge(text), kafaa_revoke_badge(text, text), kafaa_verify_badge(text) to authenticated;
grant execute on function kafaa_verify_badge(text) to anon;
