-- kafaa_fs9qa_integration_p1 (1/1) · from supabase/migrations/20261010299001_kafaa_fs9qa_integration.sql
-- Apply with apply_migration name "kafaa_fs9qa_integration_p1". Additive and idempotent; kafaa_* objects only.
-- [FS QA · wave I integration] Cross-feature wiring of FS78-FS84 on the integration branch (fsI-integration-qa, stacked on fsH-integration-qa).
-- Additive and idempotent: three create-or-replace redefinitions of internal FS32 kafaa_* functions (same signatures, still executable by no
-- API role). No table, column, policy, trigger or row is created or changed; nothing is removed; no NEXUS object is touched; no data statement.
-- Proof: scripts/validate/fsqa9-integration.mjs (PGlite: SQL = TS on the final seed, idempotence, grants, RLS). Tests:
-- tests/unit/fsqa9-integration.test.tsx. Seed invariants: scripts/seed/ext/fsqa9-integration.mjs (FINALIZE_LAST).
--   Wiring that needs no SQL here (proved by the validator on the final seed):
--   - FS78 <- FS30/FS18: balances are shown in FS30 credit units (1 credit = 10 notional hours, as kafaa_cr_compute); only FS18 outcome-gated
--     catalogue items (kafaa_xr_check) can be charged; the FS30 earned-credit ledger stays separate (an entitlement is not an earned credit).
--   - FS79/FS80/FS82/FS83 -> F01: certificate, builder, grant-output and visit evidence use recorded kinds (credential, ojt, rating, ojt), so
--     kafaa_skills_apply keeps them without a redefinition; kafaa_skill_states_v2 and kafaa_skills_apply keep their wave-D bodies.
--   - FS80 <- FS36: every gallery entry references its kafaa_ai_systems row (foreign key kafaa_automations_system_id_fk).
--   - FS81: kafaa_transition_plans has one read rule (own_profile Own on person_id); HR reads through the SECURITY DEFINER RPCs; a manager in
--     scope reads no plan of a team member (settled decision; deviation from the src/auth/policy.ts transformation comment, logged).
--   - FS84 <- F11: kafaa_team_coverage (fs95) reads horizon 'current' targets only; FS79 evidence counts in the inventory only once verified.
--   1. FS79 -> FS32 (M17 learner record): a verified, unexpired external certificate is a record item of kind 'xcert' whose status is its
--      trust tier (kafaa_xc_trust_tier); its record statement names the issuer and the tier. The share reference check accepts 'xcert:'.

-- 1a. kafaa_lr_refs_ok: copied from the fs43 body (20261010243001, the only one); the only change is the 'xcert' kind.
create or replace function kafaa_lr_refs_ok(p text[]) returns boolean language sql immutable set search_path = public as $$
  select coalesce(bool_and(r ~ '^(mc|badge|xcert|qual|skill):[A-Za-z0-9._:-]{1,120}$'), true) from unnest(p) r
$$;

-- 1b. kafaa_lr_items: copied from the fs43 body (the only one); the only change is the xcert branch (order 3; qual 4, skill 5 keep their
-- relative order) = recordItems() in src/modules/m17/learnerRecord.ts.
create or replace function kafaa_lr_items(p_person text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ref', x.ref, 'kind', x.kind, 'id', x.id, 'code', x.code, 'title_en', x.t_en, 'title_ar', x.t_ar, 'status', x.st, 'level', x.lvl, 'band', x.band, 'date', x.dt)
    order by x.o, x.ref collate "C"), '[]'::jsonb)
  from (
    select 1 o, 'mc:' || a.id ref, 'mc' kind, a.id, a.def_code code, coalesce(d.title_en, a.def_code) t_en, coalesce(d.title_ar, a.def_code) t_ar,
      kafaa_mc_view(a, p_today) ->> 'status' st, null::integer lvl, null::text band, to_char(a.issued_on, 'YYYY-MM-DD') dt
    from kafaa_microcred_awards a left join kafaa_microcred_defs d on d.id = a.def_id
    where a.person_id = p_person and a.status = 'awarded' and kafaa_mc_view(a, p_today) ->> 'status' in ('active', 'renewal_due')
    union all
    select 2, 'badge:' || b.id, 'badge', b.id, coalesce(b.achievement ->> 'code', ''), coalesce(b.achievement ->> 'name_en', ''), coalesce(b.achievement ->> 'name_ar', ''), 'active', null, null, to_char(b.issued_on, 'YYYY-MM-DD')
    from kafaa_badges b
    where b.person_id = p_person and b.status <> 'revoked' and (b.valid_to is null or b.valid_to >= p_today)
      and not exists (select 1 from kafaa_certificates c where b.source_table = 'certificates' and c.id = b.source_id
        and (c.status in ('revoked', 'expired') or (c.valid_to is not null and c.valid_to < p_today)))
    union all
    -- FS79 -> FS32 (wave I integration): verified external certificates, not expired; the status is the trust tier
    select 3, 'xcert:' || xc.id, 'xcert', xc.id, coalesce(xc.credential_ref, ''), coalesce(xc.title, ''), coalesce(xc.title, ''), kafaa_xc_trust_tier(xc), null, null, to_char(xc.issued_on, 'YYYY-MM-DD')
    from kafaa_external_certs xc
    where xc.person_id = p_person and xc.status = 'verified' and (xc.expires_on is null or xc.expires_on >= p_today)
    union all
    select 4, 'qual:' || r.id, 'qual', r.id, coalesce(s.code, ''), s.title_en, s.title_ar,
      case when r.status in ('qualified', 'due') and (r.expires_on is null or r.expires_on >= p_today) then 'qualified' else 'not_qualified' end, null, null, null
    from kafaa_qual_records r join kafaa_qual_standards s on s.id = r.standard_id
    where r.person_id = p_person and not coalesce(s.security_restricted, false) and not coalesce(r.security_mirror_only, false)
    union all
    select 5, 'skill:' || k.id, 'skill', k.id, coalesce(k.code, ''), k.name_en, k.name_ar, ps.basis, ps.level, ps.confidence_band, null
    from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id left join kafaa_competencies c on c.id = k.competency_id
    where ps.person_id = p_person and ps.active is true and ps.level >= 1 and k.area <> 'security' and coalesce(c.domain, '') <> 'security'
  ) x
$$;

-- 1c. kafaa_lr_bundle: copied from the fs43 body (the only one); the only change is the xcert record statement (= xcertStatement()).
create or replace function kafaa_lr_bundle(p_person text, p_refs text[], p_today date, p_id text, p_valid date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_items jsonb; v_init text; it jsonb; v_vcs jsonb := '[]'::jsonb; v_assoc jsonb := '[]'::jsonb; a kafaa_microcred_awards; c kafaa_microcred_awards; cid text; v_shared text[];
  v_issuer jsonb := jsonb_build_object('id', 'urn:kafaa:issuer:demo-tenant', 'type', jsonb_build_array('Profile'), 'name', 'Kafa''a demo tenant', 'url', '/kafaa/.well-known/kafaa-issuer.json');
  v_day text := to_char(p_today, 'YYYY-MM-DD'); v_qual boolean; v jsonb; v_subj jsonb; v_xiss text;
begin
  select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = p_person;
  v_init := coalesce(v_init, '—');
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_items from jsonb_array_elements(kafaa_lr_items(p_person, p_today)) with ordinality x(e, o) where e ->> 'ref' = any(coalesce(p_refs, '{}'::text[]));
  for it in select e from jsonb_array_elements(v_items) e loop
    if it ->> 'kind' = 'mc' then
      v_vcs := v_vcs || jsonb_build_array(coalesce((select x.credential from kafaa_microcred_awards x where x.id = it ->> 'id'), '{}'::jsonb));
    elsif it ->> 'kind' = 'badge' then
      v_vcs := v_vcs || jsonb_build_array(coalesce((select x.credential from kafaa_badges x where x.id = it ->> 'id'), '{}'::jsonb));
    elsif it ->> 'kind' = 'xcert' then
      -- FS79 -> FS32 (wave I integration): a Kafa'a record statement for a verified external certificate, with its issuer and trust tier
      v_xiss := coalesce((select x.issuer from kafaa_external_certs x where x.id = it ->> 'id'), '');
      v_vcs := v_vcs || jsonb_build_array(jsonb_build_object(
        '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
        'id', 'urn:kafaa:clr:' || p_id || ':xcert:' || (it ->> 'id'),
        'type', jsonb_build_array('VerifiableCredential', 'AchievementCredential'),
        'name', it ->> 'title_en',
        'issuer', v_issuer,
        'validFrom', v_day || 'T00:00:00Z',
        'credentialSubject', jsonb_build_object('type', jsonb_build_array('AchievementSubject'), 'holderInitials', v_init,
          'achievement', jsonb_build_object(
            'id', 'urn:kafaa:external-certificate:' || (it ->> 'id'),
            'type', jsonb_build_array('Achievement'),
            'achievementType', 'Certificate',
            'humanCode', it ->> 'code', 'name', it ->> 'title_en', 'nameAr', it ->> 'title_ar',
            'criteria', jsonb_build_object('narrative', 'External certificate issued by ' || v_xiss || ', verified for Kafa''a with the issuer (trust tier: '
              || case it ->> 'status' when 'enec_assessed' then 'ENEC-assessed' when 'accredited' then 'accredited third party' when 'vendor_self_serve' then 'vendor self-serve' else it ->> 'status' end
              || '). Kafa''a is not the issuer and not an authority.')),
          'kafaaTrustTier', it ->> 'status', 'kafaaIssuer', v_xiss)));
    else
      v_qual := it ->> 'kind' = 'qual';
      v_subj := jsonb_build_object('type', jsonb_build_array('AchievementSubject'), 'holderInitials', v_init,
        'achievement', jsonb_build_object(
          'id', case when v_qual then 'urn:kafaa:qualification-mirror:' || (it ->> 'code') else 'urn:kafaa:skill:' || (it ->> 'id') end,
          'type', jsonb_build_array('Achievement'),
          'achievementType', case when v_qual then 'ext:QualificationMirror' else 'Competency' end,
          'humanCode', it ->> 'code', 'name', it ->> 'title_en', 'nameAr', it ->> 'title_ar',
          'criteria', jsonb_build_object('narrative', case when v_qual then 'Mirrored from the licensee''s system of record as qualified or not qualified only; Kafa''a is not an authority.'
            else 'Skill state in the Kafa''a skills catalogue: level ' || (it ->> 'level') || ' of 4, ' || (it ->> 'status') || ' (provenance).' end)));
      v_subj := v_subj || case when v_qual then jsonb_build_object('kafaaStatus', it ->> 'status')
        else jsonb_build_object('kafaaLevel', it -> 'level', 'kafaaProvenance', it ->> 'status', 'kafaaConfidenceBand', it -> 'band') end;
      v_vcs := v_vcs || jsonb_build_array(jsonb_build_object(
        '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
        'id', 'urn:kafaa:clr:' || p_id || ':' || (it ->> 'kind') || ':' || (it ->> 'id'),
        'type', jsonb_build_array('VerifiableCredential', 'AchievementCredential'),
        'name', it ->> 'title_en',
        'issuer', v_issuer,
        'validFrom', v_day || 'T00:00:00Z',
        'credentialSubject', v_subj));
    end if;
  end loop;
  select coalesce(array_agg(e ->> 'id'), '{}'::text[]) into v_shared from jsonb_array_elements(v_items) e where e ->> 'kind' = 'mc';
  for it in select e from jsonb_array_elements(v_items) e where e ->> 'kind' = 'mc' loop
    select * into a from kafaa_microcred_awards where id = it ->> 'id';
    for cid in select x from unnest(coalesce(a.component_award_ids, '{}'::text[])) x order by x collate "C" loop
      if not cid = any(v_shared) then continue; end if;
      select * into c from kafaa_microcred_awards where id = cid;
      v_assoc := v_assoc || jsonb_build_array(jsonb_build_object('type', 'Association', 'associationType', 'isParentOf', 'sourceId', 'urn:kafaa:badge:' || a.public_slug, 'targetId', 'urn:kafaa:badge:' || c.public_slug));
    end loop;
  end loop;
  v := jsonb_build_object(
    '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
    'id', 'urn:kafaa:clr:' || p_id,
    'type', jsonb_build_array('VerifiableCredential', 'ClrCredential'),
    'name', 'Kafa''a learner record',
    'nameAr', 'سجل المتعلم من كفاءة',
    'issuer', v_issuer,
    'validFrom', v_day || 'T00:00:00Z',
    'credentialSubject', jsonb_build_object('type', jsonb_build_array('ClrSubject'), 'holderInitials', v_init, 'verifiableCredential', v_vcs)
      || case when jsonb_array_length(v_assoc) > 0 then jsonb_build_object('association', v_assoc) else '{}'::jsonb end,
    'kafaaItems', coalesce((select jsonb_agg(e - 'id' order by o) from jsonb_array_elements(v_items) with ordinality x(e, o)), '[]'::jsonb),
    'kafaaNotice', 'Kafa''a learner record (internal recognition). Qualification lines mirror the licensee''s systems as qualified or not qualified only; Kafa''a is not an authority and nothing here is a FANR certificate or licence.');
  if p_valid is not null then v := v || jsonb_build_object('validUntil', to_char(p_valid, 'YYYY-MM-DD') || 'T00:00:00Z'); end if;
  return v;
end $$;

-- Grants unchanged (create or replace keeps them); restated so a fresh database ends the same: the helpers are executed by no API role.
revoke execute on function kafaa_lr_items(text, date), kafaa_lr_bundle(text, text[], date, text, date) from public, anon, authenticated;
