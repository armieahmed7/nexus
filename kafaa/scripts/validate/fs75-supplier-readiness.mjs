// [FS wave G · E5 · fsGe5] PGlite checks for 20261010275001_kafaa_fs75_supplier_readiness.sql.
//   FS68: SQL kafaa_fr_compute = TS supplierFutureReadiness for every organisation (and on a what-if with more contractors); partners see
//         only their own organisation (alnoor-gm vs gulfhydro-qa); an organisation under 10 contractors returns no counts; suggestion
//         reasons are the F33 codes; staff and anonymous visitors get nothing.
//   FS69: SQL = TS for the pre-check from every seeded share; only shared items reach the evaluator; links expire and revoke; the check
//         writes no skill evidence, no skill state, no qualification record and no equivalency status; self and on-behalf creation with the
//         consent reference; RLS on the table; grants.
import { readFileSync } from 'node:fs';
import { supplierFutureReadiness } from '../../src/modules/m09/futureReadiness.ts';
import { PA_MSG, checkSummary, precheckFromShare, prearrivalProblem, sharedItems } from '../../src/modules/m09/prearrival.ts';
import { recordItems } from '../../src/modules/m17/learnerRecord.ts';

export default async function fs75Checks({ db, as, count, ok, uid }) {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 7500;
  for (const persona of ['k-contractor', 'k-instructor', 'k-auditor', 'alnoor-gm', 'gulfhydro-qa', 'training-mgr', 'sro', 'k-admin']) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [persona]]);
  }
  console.log('FS75 · FS68 supplier future-skills readiness, FS69 contractor pre-arrival check');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const rpc = async (persona, fn, args = []) => (await as(persona, `select ${fn} as r`, args))[0].r;
  const rows = async (table, where = 'true') => (await q(`select to_jsonb(x) j from ${table} x where ${where}`)).map((r) => r.j);
  const today = (await q('select current_date::text as d'))[0].d;
  const digest = async (table) => (await q(`select count(*)::int n, md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')) d from ${table} t`))[0];

  // ── FS68: SQL = TS
  const frWorld = async () => ({
    orgs: await rows('kafaa_organisations'), people: await rows('kafaa_people'), states: await rows('kafaa_person_skills'), skills: await rows('kafaa_skills'),
    comps: await rows('kafaa_competencies'), targets: await rows('kafaa_contract_role_targets'), profiles: await rows('kafaa_role_profile_versions'), roles: await rows('kafaa_job_roles'),
    courses: await rows('kafaa_courses'),
  });
  let W = await frWorld();
  const ts = supplierFutureReadiness(W, null);
  const sql = (await q('select kafaa_fr_compute(null) r'))[0].r;
  ok(canon(ts) === canon(sql) && ts.length >= 3, `FS68: kafaa_fr_compute = supplierFutureReadiness for all ${ts.length} supplier organisations (requirements, counts, groups, suggestions, academy gaps)`);
  for (const o of ts) {
    const one = (await q('select kafaa_fr_compute($1) r', [[o.org_id]]))[0].r;
    if (canon(one) !== canon(supplierFutureReadiness(W, [o.org_id]))) { ok(false, `FS68: SQL = TS for ${o.org_id}`); break; }
  }
  const supp = ts.filter((o) => o.suppressed);
  ok(supp.length >= 1 && supp.every((o) => o.n === null && o.future_pct === null && o.roles.every((r) => r.today_pct === null && r.future_pct === null && r.future.every((f) => f.met === null && f.bridge === null && f.fresh === null && f.pct === null)) && o.groups.every((g) => g.pct === null)),
    `FS68: organisations with fewer than 10 contractors (${supp.map((o) => o.org_id).join(', ')}) return no counts at all`);
  ok(ts.filter((o) => !o.suppressed).every((o) => o.n >= 10), 'FS68: shown organisations have at least 10 contractors');
  const codes = new Set(ts.flatMap((o) => o.suggestions.flatMap((s) => s.reasons.map((r) => r.code))));
  ok(ts.every((o) => o.suggestions.length > 0 && o.suggestions.every((s) => s.reasons.length >= 2 && ['academy_course', 'enec_course'].includes(s.reasons[0].code) && s.reasons.slice(1).every((r) => r.code === 'closes_gap')))
    && [...codes].every((c) => ['academy_course', 'enec_course', 'closes_gap'].includes(c)), 'FS68: every course suggestion carries the F33 engine reasons (academy_course / enec_course + closes_gap)');
  ok(ts.every((o) => o.roles.every((r) => r.profile_id && r.future.every((f) => f.now_level === null || f.level > f.now_level))), 'FS68: future requirements are the 2030 needs the role\'s current profile does not ask for (or asks lower)');
  // what-if: more contractors in the suppressed organisation (rolled back) -> values appear and still match
  if (supp.length) {
    await db.exec('begin');
    try {
      const o = supp[0].org_id;
      for (let i = 1; i <= 10 - (W.people.filter((p) => p.org_id === o && p.kind === 'contractor' && p.status === 'active').length) + 1; i++)
        await db.query(`insert into kafaa_people (id, display_name, display_name_ar, initials, kind, org_id, status, synthetic) values ($1, 'Test contractor', 'مقاول اختبار', 'TC', 'contractor', $2, 'active', true)`, [`zz-fs75-${i}`, o]);
      const W2 = await frWorld();
      const t2 = supplierFutureReadiness(W2, [o]);
      const s2 = (await q('select kafaa_fr_compute($1) r', [[o]]))[0].r;
      ok(canon(t2) === canon(s2) && t2[0].suppressed === false && t2[0].n >= 10, `FS68 what-if: ${o} with 10+ contractors shows values (SQL = TS)`);
    } finally { await db.exec('rollback'); }
  }
  // access
  const ag = await rpc('alnoor-gm', 'kafaa_supplier_future_readiness()');
  const gh = await rpc('gulfhydro-qa', 'kafaa_supplier_future_readiness()');
  ok(ag.allowed && ag.scope === 'own' && ag.orgs.length === 1 && ag.orgs[0].org_id === 'org-alnoor' && gh.orgs.length === 1 && gh.orgs[0].org_id === 'org-gulfhydro' && gh.orgs[0].suppressed,
    'FS68: alnoor-gm sees only Al Noor; gulfhydro-qa sees only Gulf Hydro-Valve (suppressed: under 10 contractors)');
  const tm = await rpc('training-mgr', 'kafaa_supplier_future_readiness()');
  const au = await rpc('k-auditor', 'kafaa_supplier_future_readiness()');
  const ad = await rpc('k-admin', 'kafaa_supplier_future_readiness()');
  ok(tm.scope === 'all' && au.scope === 'all' && ad.scope === 'all' && canon(tm.orgs) === canon(sql), 'FS68: ENEC evaluators (equivalency A), auditors and supplier management (partner_org A) see every supplier organisation');
  const sr = await rpc('sro', 'kafaa_supplier_future_readiness()');
  let anonDenied = false;
  try { await as(null, 'select kafaa_supplier_future_readiness()'); } catch { anonDenied = true; }
  ok(sr.allowed === false && sr.orgs.length === 0 && anonDenied, 'FS68: staff get nothing; anonymous visitors cannot call it');

  // ── FS69
  const D = {};
  const load = async () => { for (const t of ['microcred_awards', 'microcred_defs', 'badges', 'certificates', 'qual_records', 'qual_standards', 'person_skills', 'skills', 'competencies', 'people', 'task_items', 'task_skill_links', 'courses', 'record_shares', 'prearrival_shares']) D[t] = await rows(`kafaa_${t}`); };
  await load();
  const world = (pid) => ({ today, person: pid, initials: D.people.find((p) => p.id === pid)?.initials || '—', microcred_awards: D.microcred_awards, microcred_defs: D.microcred_defs, badges: D.badges,
    certificates: D.certificates, qual_records: D.qual_records, qual_standards: D.qual_standards, person_skills: D.person_skills, skills: D.skills, competencies: D.competencies });
  const shareOf = (r) => D.record_shares.find((s) => s.id === r.share_id);
  const viewOf = (s) => (s.revoked_at ? 'revoked' : String(s.expires_on).slice(0, 10) < today ? 'expired' : 'active');
  const seeded = D.prearrival_shares;
  ok(seeded.length >= 6 && new Set(seeded.map((r) => viewOf(shareOf(r)))).size === 3 && seeded.some((r) => r.created_via === 'self') && seeded.some((r) => r.created_via === 'on_behalf' && r.consent_ref.length >= 3),
    `FS69: ${seeded.length} seeded pre-arrival shares (active, expired, revoked; self and on behalf with a consent reference)`);
  // seeded summaries reproduce
  let sumOk = 0; let checkedN = 0;
  for (const r of seeded.filter((x) => x.check_summary)) {
    checkedN++;
    const shared = sharedItems(recordItems(world(r.person_id)), shareOf(r).items);
    const p = precheckFromShare(r.id, r.person_id, shared, { standard: D.qual_standards.find((s) => s.id === r.standard_id), tasks: D.task_items, links: D.task_skill_links, skills: D.skills, comps: D.competencies, courses: D.courses });
    if (canon(checkSummary(p)) === canon(r.check_summary)) sumOk++;
  }
  ok(checkedN > 0 && sumOk === checkedN, `FS69: the ${checkedN} stored check summaries reproduce from the shared items (precheckFromShare)`);
  // SQL = TS pre-check for every seeded share x the standards of its role (shared items only)
  let par = 0; let parN = 0;
  for (const r of seeded) {
    const shared = sharedItems(recordItems(world(r.person_id)), shareOf(r).items);
    const sqlShared = (await q('select kafaa_pa_shared($1, $2, current_date) r', [r.person_id, shareOf(r).items]))[0].r;
    for (const std of D.qual_standards.filter((s) => s.status === 'current' && !s.security_restricted)) {
      parN++;
      const t = precheckFromShare(r.id, r.person_id, shared, { standard: std, tasks: D.task_items, links: D.task_skill_links, skills: D.skills, comps: D.competencies, courses: D.courses });
      const s = (await q('select kafaa_pa_check($1, $2, $3, $4) r', [r.id, r.person_id, JSON.stringify(sqlShared), std.id]))[0].r;
      if (canon(t) === canon(s)) par++;
    }
  }
  ok(parN > 0 && par === parN, `FS69: kafaa_pa_check = precheckFromShare for ${parN} share x standard pairs`);
  // list parity
  const tsRows = (await rpc('k-instructor', 'kafaa_prearrival_shares()'));
  ok(tsRows.length === seeded.length && tsRows[0].status === 'active' && tsRows.every((x) => !('items' in x) && !('token' in x)), 'FS69: the evaluator list has every share, active first, without items or tokens');
  ok((await rpc('alnoor-gm', 'kafaa_prearrival_shares()')).every((x) => x.org_id === 'org-alnoor') && (await rpc('gulfhydro-qa', 'kafaa_prearrival_shares()')).every((x) => x.org_id === 'org-gulfhydro')
    && (await rpc('k-contractor', 'kafaa_prearrival_shares()')).every((x) => x.person_id === 'p-k-contractor') && (await rpc('sro', 'kafaa_prearrival_shares()')).length === 0,
    'FS69: partner admins list their organisation only, a contractor their own shares, staff nothing');
  // RLS on the table
  ok((await count('alnoor-gm', 'kafaa_prearrival_shares', `org_id <> 'org-alnoor'`)) === 0 && (await count('gulfhydro-qa', 'kafaa_prearrival_shares', `org_id <> 'org-gulfhydro'`)) === 0
    && (await count('k-contractor', 'kafaa_prearrival_shares', `person_id <> kafaa_me()`)) === 0 && (await count('k-contractor', 'kafaa_prearrival_shares')) >= 1
    && (await count('k-instructor', 'kafaa_prearrival_shares')) === seeded.length && (await count('sro', 'kafaa_prearrival_shares')) === 0 && (await count(null, 'kafaa_prearrival_shares')) === 0,
    'FS69 RLS: contractor own, partner admin own organisation, evaluators all, staff and anonymous none');
  ok((await count('k-instructor', 'kafaa_record_shares', `id like 'rs-pa-%'`)) === 0, 'FS69: evaluators cannot read the FS32 share rows (items and tokens) directly');
  let direct = 0;
  for (const s of [`insert into kafaa_prearrival_shares (id, share_id, person_id, org_id, standard_id, mobilise_on, created_via, created_by) values ('x','rs-pa-kcontractor-mech','c-alnoor-01','org-alnoor','qs-mech',current_date,'self','x')`,
    `update kafaa_prearrival_shares set check_summary = '{}'::jsonb where id = 'pa-calnoor01-mech' returning id`]) {
    try { const r = await as('k-instructor', s); if (!r.length) direct++; } catch { direct++; }
  }
  ok(direct === 2, 'FS69: the table cannot be written directly (RPC only)');

  // only shared items reach the evaluator
  const act = seeded.find((r) => r.id === 'pa-calnoor01-mech');
  const det = await rpc('k-instructor', `kafaa_prearrival_share('${act.id}')`);
  const held = recordItems(world(act.person_id)).map((i) => i.ref);
  const unshared = held.filter((x) => !shareOf(act).items.includes(x));
  ok(det.ok && det.data.items.length === shareOf(act).items.length && det.data.items.every((i) => shareOf(act).items.includes(i.ref)) && unshared.length > 0 && !JSON.stringify(det.data).includes(unshared[0].replace('skill:', '"'))
    && !('token' in det.data), `FS69: the evaluator sees the ${det.data?.items?.length} shared items only (${unshared.length} held items stay hidden, no token)`);
  const ex = seeded.find((r) => viewOf(shareOf(r)) === 'expired');
  const rv = seeded.find((r) => viewOf(shareOf(r)) === 'revoked');
  const dEx = await rpc('k-instructor', `kafaa_prearrival_share('${ex.id}')`);
  ok(dEx.ok && dEx.data.status === 'expired' && dEx.data.items.length === 0, 'FS69: an expired link shows nothing personal');
  // the check writes no evidence and no qualification status
  const before = {};
  const guarded = ['kafaa_skill_evidence', 'kafaa_person_skills', 'kafaa_qual_records', 'kafaa_evaluations', 'kafaa_equivalency_requests'];
  for (const t of guarded) before[t] = await digest(t);
  const run = await rpc('k-instructor', `kafaa_precheck_from_share('${act.id}', null)`);
  const after = {};
  for (const t of guarded) after[t] = await digest(t);
  const tsRun = precheckFromShare(act.id, act.person_id, sharedItems(recordItems(world(act.person_id)), shareOf(act).items), { standard: D.qual_standards.find((s) => s.id === act.standard_id), tasks: D.task_items, links: D.task_skill_links, skills: D.skills, comps: D.competencies, courses: D.courses });
  const stored = (await rows('kafaa_prearrival_shares', `id = '${act.id}'`))[0];
  ok(run.ok && canon(run.data) === canon(tsRun) && run.data.skills_used === shareOf(act).items.length && guarded.every((t) => canon(before[t]) === canon(after[t])) && canon(stored.check_summary) === canon(checkSummary(tsRun)),
    'FS69: precheckFromShare (SQL = TS) stores only its summary: skill evidence, skill states, qualification records, evaluations and equivalency requests unchanged');
  ok(run.message === PA_MSG.check_ok && (await q(`select count(*)::int n from kafaa_audit_events where action = 'prearrival.precheck' and entity_id = $1`, [act.id]))[0].n >= 1, 'FS69: the check is audited (no ledger) and says it is guidance');
  ok((await rpc('k-instructor', `kafaa_precheck_from_share('${ex.id}', null)`)).code === 'expired' && (await rpc('k-instructor', `kafaa_precheck_from_share('${rv.id}', null)`)).code === 'revoked',
    'FS69: an expired link and a revoked link are refused (the link expires as set)');
  ok((await rpc('k-auditor', `kafaa_precheck_from_share('${act.id}', null)`)).code === 'forbidden' && (await rpc('alnoor-gm', `kafaa_precheck_from_share('${act.id}', null)`)).code === 'forbidden'
    && (await rpc('k-contractor', `kafaa_precheck_from_share('${act.id}', null)`)).code === 'forbidden', 'FS69: only ENEC evaluators run the check (auditors read, partners and contractors cannot run it)');
  ok((await rpc('k-instructor', `kafaa_precheck_from_share('${act.id}', 'qs-sec-officer')`)).code !== 'ok' && (await rpc('alnoor-gm', `kafaa_prearrival_share('${act.id}')`)).code === 'not_found', 'FS69: unknown or security standards refused; partner admins do not open the shared items');

  // create: self, on behalf with consent, refusals
  const kItems = recordItems(world('p-k-contractor')).filter((i) => i.kind === 'skill').slice(0, 2).map((i) => i.ref);
  const plus = (d) => new Date(Date.parse(`${today}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
  const base = { items: kItems, label: 'Pre-arrival test share', expires_on: plus(30), mobilise_on: plus(20), consents: { items: true, preview: true, share: true }, standard_id: 'qs-mech' };
  ok(prearrivalProblem(base, recordItems(world('p-k-contractor')), today, false) === 'ok', 'FS69: TS accepts the self share input');
  const self = await rpc('k-contractor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify(base)]);
  const selfRow = self.ok ? (await rows('kafaa_prearrival_shares', `id = '${self.data.id}'`))[0] : null;
  const selfShare = self.ok ? (await rows('kafaa_record_shares', `id = '${self.data.share_id}'`))[0] : null;
  ok(self.ok && selfRow?.created_via === 'self' && selfRow.org_id === 'org-dhafra' && selfShare?.consents?.purpose === 'prearrival' && canon(selfShare.items) === canon(kItems) && selfShare.token === self.data.token,
    'FS69: a contractor creates their own pre-arrival share (FS32 link + M09 row)');
  const noRef = await rpc('k-instructor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify({ ...base, person_id: 'c-alnoor-02', items: recordItems(world('c-alnoor-02')).slice(0, 2).map((i) => i.ref) })]);
  const behalfIn = { ...base, person_id: 'c-alnoor-02', items: recordItems(world('c-alnoor-02')).slice(0, 2).map((i) => i.ref), consent_ref: 'ALN-CF-TEST-01' };
  const behalf = await rpc('k-instructor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify(behalfIn)]);
  ok(noRef.code === 'consent_ref' && behalf.ok && (await rows('kafaa_prearrival_shares', `id = '${behalf.data.id}'`))[0]?.created_via === 'on_behalf'
    && (await q(`select count(*)::int n from kafaa_notifications where id = $1 and kind = 'prearrival' and person_id = 'c-alnoor-02'`, [`nt-pa-${behalf.data.id}-created`]))[0].n === 1,
    'FS69: an evaluator records a share on the contractor\'s behalf only with the consent reference, and the contractor is notified');
  ok(behalf.ledger_seq != null || behalf.audit_seq != null, 'FS69: creation is audited and goes to the ledger');
  const refusals = [
    await rpc('alnoor-gm', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify(behalfIn)]),
    await rpc('sro', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify(base)]),
    await rpc('k-contractor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify({ ...base, mobilise_on: plus(40) })]),
    await rpc('k-contractor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify({ ...base, consents: { items: true, preview: false, share: true } })]),
    await rpc('k-contractor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify({ ...base, items: ['skill:sk-ld-02'] })]),
    await rpc('k-instructor', 'kafaa_create_prearrival_share($1::jsonb)', [JSON.stringify({ ...behalfIn, person_id: 'p-sro' })]),
  ];
  ok(canon(refusals.map((r) => r.code)) === canon(['forbidden', 'forbidden', 'mobilise', 'consent_required', 'not_shareable', 'not_found']),
    `FS69: refusals forbidden (partner admin on behalf, staff), mobilise after expiry, consent missing, unshareable item, staff person (${refusals.map((r) => r.code).join(', ')})`);
  // revoke
  const rv1 = await rpc('k-instructor', `kafaa_revoke_prearrival_share('${behalf.data.id}', null)`);
  const rv2 = await rpc('k-instructor', `kafaa_revoke_prearrival_share('${behalf.data.id}', 'Contractor asked by phone')`);
  const rv3 = await rpc('k-contractor', `kafaa_revoke_prearrival_share('${self.data.id}', null)`);
  const rv4 = await rpc('k-contractor', `kafaa_revoke_prearrival_share('${self.data.id}', null)`);
  ok(rv1.code === 'invalid' && rv2.ok && rv3.ok && rv4.code === 'already_closed' && (await rpc('k-instructor', `kafaa_precheck_from_share('${self.data.id}', null)`)).code === 'revoked'
    && (await rpc('k-instructor', `kafaa_prearrival_share('${self.data.id}')`)).data.items.length === 0,
    'FS69: the contractor revokes at any time; an evaluator revokes on request with a reason; a revoked link shows nothing and cannot be checked');
  // verify page (FS32) still shows only the shared items for an active contractor share
  const tok = D.record_shares.find((s) => s.id === act.share_id).token;
  const vr = await rpc(null, `kafaa_verify_record_share('${tok}')`);
  ok(vr.ok && vr.data.status === 'active' && vr.data.item_count === shareOf(act).items.length, 'FS69: the FS32 public verify page shows the shared items only (initials only)');

  // grants and migration text
  const internal = ['kafaa_fr_compute(text[])', 'kafaa_fr_status(text,text,text,integer)', 'kafaa_pa_check(text,text,jsonb,text)', 'kafaa_pa_precheck_compute(text,text,jsonb)', 'kafaa_pa_row(kafaa_prearrival_shares,date)'];
  const g1 = (await q(`select count(*)::int n from unnest($1::text[]) f where has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')`, [internal]))[0].n;
  const pub = ['kafaa_supplier_future_readiness()', 'kafaa_prearrival_shares()', 'kafaa_create_prearrival_share(jsonb)', 'kafaa_precheck_from_share(text,text)', 'kafaa_prearrival_share(text)', 'kafaa_revoke_prearrival_share(text,text)', 'kafaa_prearrival_items(text)', 'kafaa_prearrival_contractors()'];
  const g2 = (await q(`select count(*)::int n from unnest($1::text[]) f where has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute')`, [pub]))[0].n;
  ok(g1 === 0 && g2 === 0, 'FS75 grants: helpers executable by no API role; the 8 RPCs by authenticated only');
  const mig = readFileSync('supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql', 'utf8');
  const objs = [...mig.matchAll(/create (?:or replace function|table if not exists|index if not exists|policy) ([a-z_]+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(mig) && objs.every((o) => o.startsWith('kafaa_')) && [...mig.matchAll(/alter table ([a-z_]+)/g)].every((m) => m[1].startsWith('kafaa_')),
    'FS75 migration: additive kafaa_* objects only, no removal words');
}
