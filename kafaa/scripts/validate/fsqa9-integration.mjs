// [FS QA · wave I integration] PGlite checks for 20261010299001_kafaa_fs9qa_integration.sql (cross-feature wiring of FS78-FS84).
//  1. FS79 -> FS32: kafaa_lr_items = recordItems() and kafaa_lr_bundle = buildBundle() for every holder of an external certificate (TS
//     reads the database as it is now), today and after a certificate's expiry; verified certificates are items of kind xcert whose status
//     is the trust tier (kafaa_xc_trust_tier); unverified ones never are.
//  2. FS79 -> FS32 flow (rolled back): the holder shares a verified certificate in a record link, the public verify page shows it with its
//     tier and issuer; once a verifier revokes the certificate it leaves the record and the shared link (no stale credential).
//  3. FS79/FS80/FS82/FS83 -> F01 (rolled back): evidence with ref_table external_certs, automations, grant_applications and
//     consortium_visits survives kafaa_skills_apply (recorded kinds), so no redefinition of kafaa_skill_states_v2 / kafaa_skills_apply.
//  4. FS81 (settled decision): a manager in scope (sro, crew B) reads no transition plan of a team member, neither from the table nor
//     through kafaa_transition_plan_view / kafaa_transition_plans; the person reads their own; HR (transformation A) reads all through
//     the RPCs; the training manager, HR analysts and auditors read none.
//  5. FS80 <- FS36: every gallery entry references a kafaa_ai_systems row (foreign key present).
//  6. The QA migration is additive (no removal word; three internal FS32 functions replaced; no table, policy or row), the helpers stay
//     executable by no API role; md5s for the live comparison.
import { readFileSync } from 'node:fs';

const FILE = 'supabase/migrations/20261010299001_kafaa_fs9qa_integration.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const norm = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(norm) : v);

export default async function fsqa9Checks({ db, one, ok, uid }) {
  console.log('FS QA · wave I integration (FS78-FS84; FS79 trust tier in the M17 learner record)');
  const LR = await import('../../src/modules/m17/learnerRecord.ts');
  const XC = await import('../../src/modules/m34/extcerts.ts');
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const md5 = async (names) => Object.fromEntries((await q(`select p.proname n, md5(p.prosrc) m from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = any($1)`, [names])).map((r) => [r.n, r.m]));
  let n = 9900;
  for (const [persona, role] of [['sro', 'Shift Manager · licensed SRO'], ['chco', 'Chief Human Capital Officer'], ['training-mgr', 'Training Manager'], ['k-hr-analyst', 'HR analyst'], ['k-auditor', 'Auditor'], ['k-ro', 'Reactor Operator'], ['k-admin', 'Admin']]) {
    if (uid[persona]) continue;
    const row = await q1('select user_id from profiles where persona_id = $1', [persona]);
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const rpc = async (who, s, p = []) => (await one(who, `select ${s} r`, p)).r;
  const day = (await q1(`select to_char(current_date, 'YYYY-MM-DD') d`)).d;
  const load = async (t) => (await q(`select * from kafaa_${t} order by id collate "C"`)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, norm(v)])));
  const D = {};
  for (const t of ['microcred_awards', 'microcred_defs', 'badges', 'certificates', 'qual_records', 'qual_standards', 'person_skills', 'skills', 'competencies', 'people', 'external_certs']) D[t] = await load(t);
  for (const r of D.person_skills) r.confidence = Number(r.confidence);
  const rw = (pid, today) => ({ today, person: pid, initials: D.people.find((p) => p.id === pid)?.initials || '—', microcred_awards: D.microcred_awards, microcred_defs: D.microcred_defs, badges: D.badges,
    certificates: D.certificates, qual_records: D.qual_records, qual_standards: D.qual_standards, person_skills: D.person_skills, skills: D.skills, competencies: D.competencies, external_certs: D.external_certs });

  // 1. SQL = TS for every certificate holder, today and after an expiry
  const holders = [...new Set(D.external_certs.map((c) => c.person_id))].sort();
  const later = '2029-09-16'; // after xc-p-k-ro-02's expiry (it is not verified: the item set must not change because of it)
  let idiff = [], bdiff = [], xitems = 0;
  for (const pid of holders) for (const d of [day, later]) {
    const s = (await q('select kafaa_lr_items($1, $2::date) i', [pid, d]))[0].i;
    const t = LR.recordItems(rw(pid, d));
    if (canon(s) !== canon(t)) idiff.push(`${pid}@${d}`);
    if (d === day) xitems += t.filter((i) => i.kind === 'xcert').length;
    const refs = t.map((i) => i.ref);
    const sb = (await q('select kafaa_lr_bundle($1, $2::text[], $3::date, $4, null) b', [pid, refs, d, `fsqa9:${pid}`]))[0].b;
    const tb = LR.buildBundle(rw(pid, d), refs, { id: `fsqa9:${pid}`, issued_on: d, valid_until: null });
    if (canon(sb) !== canon(tb) || LR.validateClr(sb).length) bdiff.push(`${pid}@${d}`);
  }
  ok(idiff.length === 0, `FS79 -> FS32: SQL kafaa_lr_items = recordItems() for ${holders.length} certificate holders on two days${idiff.length ? ` (${idiff[0]})` : ''}`);
  ok(bdiff.length === 0, `FS79 -> FS32: SQL kafaa_lr_bundle = buildBundle() and CLR-shaped for the full records of ${holders.length} holders${bdiff.length ? ` (${bdiff[0]})` : ''}`);
  const verifiedNow = D.external_certs.filter((c) => c.status === 'verified' && !(c.expires_on && String(c.expires_on).slice(0, 10) < day));
  const sqlX = [];
  for (const pid of holders) for (const e of (await q('select kafaa_lr_items($1, current_date) i', [pid]))[0].i) if (e.kind === 'xcert') sqlX.push(e);
  ok(xitems === verifiedNow.length && sqlX.length === verifiedNow.length && sqlX.every((e) => { const c = D.external_certs.find((x) => x.id === e.id); return c && e.status === XC.trustTier(c) && e.status !== 'claimed'; })
    && !sqlX.some((e) => ['submitted', 'rejected', 'withdrawn', 'revoked'].includes(D.external_certs.find((x) => x.id === e.id)?.status)),
  `FS79 -> FS32: the ${verifiedNow.length} verified certificates are record items whose status is the trust tier; submitted, rejected, withdrawn and revoked ones never are`);
  const refsOk = await q1(`select kafaa_lr_refs_ok(array['xcert:xc-p-sro-01','mc:a','badge:b','qual:c','skill:d']) a, kafaa_lr_refs_ok(array['cert:x']) b`);
  ok(refsOk.a === true && refsOk.b === false, 'kafaa_lr_refs_ok accepts the xcert kind and still refuses unknown kinds');

  // 2. share flow (rolled back)
  await db.exec('begin');
  try {
    const items = (await q(`select kafaa_lr_items('p-sro', current_date) i`))[0].i;
    const xref = items.find((i) => i.kind === 'xcert')?.ref;
    const other = items.find((i) => i.kind === 'skill')?.ref;
    const mk = await rpc('sro', 'kafaa_create_record_share($1::jsonb)', [JSON.stringify({ items: [xref, other].filter(Boolean), label: 'Secondment application', expires_on: (await q1(`select to_char(current_date + 30, 'YYYY-MM-DD') d`)).d, consents: { items: true, preview: true, share: true } })]);
    const v1 = mk?.ok ? (await rpc(null, 'kafaa_verify_record_share($1)', [mk.data.token]))?.data : null; // a Result: { ok, code, data: VerifyResult }
    const it1 = (v1?.clr?.kafaaItems ?? []).find((i) => i.kind === 'xcert');
    const vc1 = (v1?.clr?.credentialSubject?.verifiableCredential ?? []).find((c) => String(c.id).includes(':xcert:'));
    ok(!!xref && mk?.ok && v1?.found !== false && v1?.clr && it1?.status === 'accredited' && vc1?.credentialSubject?.kafaaTrustTier === 'accredited' && vc1?.credentialSubject?.achievement?.achievementType === 'Certificate'
      && /not the issuer and not an authority/.test(vc1?.credentialSubject?.achievement?.criteria?.narrative ?? '') && v1.holder_initials && !JSON.stringify(v1).includes('display_name'),
    'FS79 -> FS32: the holder (sro) shares a verified certificate; the public verify page shows it with its trust tier (accredited) and issuer, initials only, "not an authority"');
    const rv = await rpc('training-mgr', 'kafaa_verify_external_cert($1::jsonb)', [JSON.stringify({ id: 'xc-p-sro-01', decision: 'revoke', note: 'Issuer withdrew the certificate' })]);
    const after = (await q(`select kafaa_lr_items('p-sro', current_date) i`))[0].i;
    const v2 = (await rpc(null, 'kafaa_verify_record_share($1)', [mk.data.token]))?.data;
    ok(rv?.ok && !after.some((i) => i.kind === 'xcert') && !(v2?.clr?.kafaaItems ?? []).some((i) => i.kind === 'xcert') && (v2?.clr?.kafaaItems ?? []).length === 1,
      'FS79 -> FS32: after a verifier revokes the certificate it leaves the learner record and the shared link (no stale credential)');
  } finally { await db.exec('rollback'); }

  // 3. wave-I evidence survives kafaa_skills_apply (rolled back)
  await db.exec('begin');
  try {
    const sk = (await q1(`select id from kafaa_skills where area <> 'security' and lifecycle is distinct from 'retired' order by id collate "C" limit 1`)).id;
    const rows = [['se:fsqa9:gr', 'rating', 'grant_applications', 'ga-fsqa9'], ['se:fsqa9:cv', 'ojt', 'consortium_visits', 'cv-fsqa9'], ['se:fsqa9:atm', 'ojt', 'automations', 'atm-fsqa9']];
    for (const [id, kind, rt, ref] of rows) {
      await db.query(`insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at, contractor)
        values ($1, 'p-sro', $2, $3, $4, $5, 2, 'validated', 'current', current_date, 'fsqa9 check', 'p-chco', true, now(), false)`, [id, sk, kind, rt, ref]);
    }
    const xcBefore = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'external_certs' and active`)).n);
    for (const p of ['p-sro', 'p-nse', 'p-buyer']) await db.query(`select kafaa_skills_apply($1, current_date)`, [p]);
    const kept = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where id like 'se:fsqa9:%' and active`)).n);
    const xcAfter = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'external_certs' and active`)).n);
    const st = await q1(`select level, basis from kafaa_person_skills where person_id = 'p-sro' and skill_id = $1 and active`, [sk]);
    ok(kept === 3 && xcAfter === xcBefore && st && Number(st.level) >= 2,
      'FS79/FS80/FS82/FS83 -> F01: certificate, builder, grant-output and visit evidence (recorded kinds) survive kafaa_skills_apply and count in the skill state');
  } finally { await db.exec('rollback'); }
  const sv = await md5(['kafaa_skill_states_v2', 'kafaa_skills_apply']);
  ok(sv.kafaa_skill_states_v2 === '6beb9870b28196ae60892c7a2a932a19' && sv.kafaa_skills_apply === 'aef7f55da8c445b49e3290b1e74367cb', 'kafaa_skill_states_v2 and kafaa_skills_apply keep their pre-wave bodies (no redefinition in wave I)');

  // 4. FS81: person and HR only
  const team = ['p-k-ro', 'w-lo-02', 'w-ro-01'];
  const tbl = Number((await one('sro', `select count(*)::int n from kafaa_transition_plans where person_id <> 'p-sro'`)).n);
  const own = Number((await one('sro', `select count(*)::int n from kafaa_transition_plans where person_id = 'p-sro'`)).n);
  const viewTeam = await Promise.all(['tp-w-lo-02-1', 'tp-w-ro-01-1', 'tp-p-k-ro-1'].map((id) => rpc('sro', 'kafaa_transition_plan_view($1)', [id])));
  const listMgr = await rpc('sro', 'kafaa_transition_plans()');
  const hr = await rpc('chco', 'kafaa_transition_plans()');
  const others = {};
  for (const p of ['training-mgr', 'k-hr-analyst', 'k-auditor', 'k-admin']) others[p] = [Number((await one(p, `select count(*)::int n from kafaa_transition_plans`)).n), await rpc(p, 'kafaa_transition_plans()'), await rpc(p, `kafaa_transition_plan_view('tp-w-lo-02-1')`)];
  const total = Number((await q1('select count(*)::int n from kafaa_transition_plans')).n);
  const teamPlans = Number((await q1('select count(*)::int n from kafaa_transition_plans where person_id = any($1)', [team])).n);
  ok(teamPlans >= 3 && tbl === 0 && own === 1 && viewTeam.every((v) => v === null) && listMgr === null && Array.isArray(hr) && hr.length === total
    && Object.values(others).every(([c, l, v]) => c === 0 && l === null && v === null),
  `FS81 (settled): the manager in scope (sro) reads none of the ${teamPlans} team plans (table, plan view, board), only their own; HR reads all ${total}; training manager, HR analyst, auditor and admin read none`);

  // 5. FS80 <- FS36
  const fk = await q1(`select count(*)::int n from pg_constraint where conname = 'kafaa_automations_system_id_fk'`);
  const orphan = await q1(`select count(*)::int n from kafaa_automations a where not exists (select 1 from kafaa_ai_systems s where s.id = a.system_id)`);
  ok(fk.n === 1 && orphan.n === 0 && Number((await q1('select count(*)::int n from kafaa_automations')).n) > 0, 'FS80 <- FS36: every gallery entry references its AI-system register row (foreign key kafaa_automations_system_id_fk)');

  // 6. the migration
  const words = ['dr' + 'op', 'del' + 'ete', 'trun' + 'cate'];
  const creates = [...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]).sort();
  const bad = words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(sql));
  ok(!bad.length && !/\b(insert|update|alter|create table|create policy|create trigger|grant)\b/i.test(sql.replace(/--[^\n]*/g, '')) && JSON.stringify(creates) === JSON.stringify(['kafaa_lr_bundle', 'kafaa_lr_items', 'kafaa_lr_refs_ok']),
    'the QA migration is additive: three internal FS32 functions replaced, no removal word, no table, row, policy or grant');
  const g = await q(`select routine_name r, grantee from information_schema.routine_privileges where routine_name in ('kafaa_lr_items', 'kafaa_lr_bundle') and grantee in ('anon', 'authenticated', 'PUBLIC')`);
  ok(g.length === 0, 'kafaa_lr_items and kafaa_lr_bundle stay executable by no API role');
  const m = await md5(['kafaa_lr_refs_ok', 'kafaa_lr_items', 'kafaa_lr_bundle']);
  console.log(`    md5 ${Object.entries(m).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
}
