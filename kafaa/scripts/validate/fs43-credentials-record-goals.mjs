// [FS wave D · E3 · FS31 + FS32 + FS33] PGlite checks for 20261010243001_kafaa_fs43_credentials_record_goals.sql (future-skills
// micro-credentials with a strategic tier, the CLR-shaped learner record with selective disclosure, skill goals with a date).
// SQL = TS parity on the seed: kafaa_mc_eligibility (adaptive and task criteria, integrity voids) = eligibility(), kafaa_mc_validate_def =
// validateDef(), kafaa_fc_unlocks / kafaa_fc_target_check / kafaa_fc_report = unlocksFor / targetCheck / strategicReport, kafaa_lr_items /
// kafaa_lr_bundle = recordItems / buildBundle; acceptance (copy check, satisfiable, strategic credentials unlock the gigs that name them,
// expired or revoked links show nothing personal, no security or medical detail, CLR-shaped bundle, managers see goals only when shared);
// RPC flows and refusals; RLS; grants; additivity.
import { readFileSync } from 'node:fs';
import { eligibility, validateDef, hasRegulatoryWording } from '../../src/modules/m17/microcred.ts';
import { FS31_CODES, satisfiability, strategicReport, targetCheck, unlocksFor } from '../../src/modules/m17/futureCreds.ts';
import { RESTRICTED_RECORD, buildBundle, recordItems, validateClr } from '../../src/modules/m17/learnerRecord.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const DAY = '2026-10-11';
const MIG = 'supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql';

export default async function fs43Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave D · E3 · FS31 strategic micro-credentials + FS32 learner record + FS33 skill goals');
  const q = async (sql, p = []) => { await db.exec('reset role'); return (await db.query(sql, p)).rows; };
  let n = 4301;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  for (const [p, r] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector'], ['buyer', 'Buyer'], ['nse', 'Nuclear Safety Engineer']]) await addProfile(p, r);
  const rpc = async (who, sql, p = []) => (await one(who, `select ${sql} r`, p)).r;
  // TS sees the database as it is now (earlier validators may have added attempts or awards): rows with dates as ISO strings
  const norm = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(norm) : v);
  const load = async (t) => (await q(`select * from kafaa_${t} order by id collate "C"`)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, norm(v)])));
  const D = {};
  for (const t of ['microcred_defs', 'microcred_awards', 'microcred_unlocks', 'courses', 'training_records', 'attempts', 'opportunities', 'opportunity_applications', 'person_skills', 'adaptive_attempts',
    'task_attempts', 'integrity_reports', 'rotation_templates', 'rotation_placements', 'people', 'badges', 'certificates', 'qual_records', 'qual_standards', 'skills', 'competencies', 'record_shares', 'skill_goal_plans']) D[t] = await load(t);
  for (const r of D.person_skills) { r.confidence = Number(r.confidence); }
  const staff = D.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();

  // ── FS31 seed: definitions, copy check, satisfiability, tier
  const defs = T.microcred_defs;
  const fs31 = defs.filter((d) => FS31_CODES.includes(d.code) && d.status === 'current');
  ok(fs31.length >= 8 && FS31_CODES.every((c) => fs31.some((d) => d.code === c)), `FS31: ${fs31.length} new published definitions (${FS31_CODES.join(', ')})`);
  ok(defs.find((d) => d.id === 'mcd-mc-twins-v1')?.status === 'superseded' && defs.find((d) => d.id === 'mcd-mc-twins-v2')?.status === 'current', 'FS31: MC-TWINS is published as v2 (the F32 draft v1 is superseded, never deleted)');
  const w = { defs, courses: T.courses, forms: T.assessment_forms, opportunities: T.opportunities, skills: T.skills, competencies: T.competencies, job_roles: T.job_roles, qual_standards: T.qual_standards, adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks };
  const vSql = [];
  for (const d of fs31) {
    const input = { ...d, stacks_into: null };
    const ts = validateDef(input, { ...w, defs: defs.filter((x) => x.id !== d.id) }).code;
    const sq = (await q(`select kafaa_mc_validate_def($1::jsonb) c`, [JSON.stringify({ ...input, code: `${d.code}-CHK` })]))[0].c;
    vSql.push(ts === 'ok' && sq === 'ok' && !hasRegulatoryWording(d.title_en, d.title_ar, d.summary_en, d.summary_ar, ...d.criteria.flatMap((c) => [c.label_en, c.label_ar])));
  }
  ok(vSql.every(Boolean), 'AC: every FS31 definition passes the regulatory-wording copy check and the definition rules (TS validateDef = SQL kafaa_mc_validate_def = ok)');
  const bad = { ...fs31[0], code: 'MC-BAD-COPY', title_en: 'FANR certified AI assurer' };
  ok((await q(`select kafaa_mc_validate_def($1::jsonb) c`, [JSON.stringify(bad)]))[0].c === 'regulatory_wording' && validateDef(bad, w).code === 'regulatory_wording', 'copy check: a title reading as a FANR certificate is refused (TS = SQL)');
  const secBank = { ...fs31[0], code: 'MC-BAD-BANK', criteria: [{ key: 'a', kind: 'adaptive', ref: 'ab-none', min_level: 2, label_en: 'Bank that is not there', label_ar: 'بنك غير موجود' }] };
  ok((await q(`select kafaa_mc_validate_def($1::jsonb) c`, [JSON.stringify(secBank)]))[0].c === 'invalid' && validateDef(secBank, w).code === 'invalid', 'an adaptive criterion must name an active FS21 bank (TS = SQL)');
  const content = { courses: T.courses, course_skill_links: T.course_skill_links, adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks, opportunities: T.opportunities, skills: T.skills };
  const unsat = defs.filter((d) => FS31_CODES.includes(d.code) || d.code === 'MC-H2-HEAT').filter((d) => !satisfiability(d, content).ok);
  ok(unsat.length === 0, `AC: every FS31 definition (published and draft) is satisfiable through existing or FS19 content${unsat.length ? ` (${unsat.map((d) => d.id).join(', ')})` : ''}`);
  const strat = defs.filter((d) => d.status === 'current' && d.strategic === true).map((d) => d.code).sort();
  ok(strat.length === 3 && (await q(`select count(*)::int n from kafaa_microcred_defs where strategic`))[0].n === 3, `strategic tier: ${strat.join(', ')}`);

  // ── SQL = TS: eligibility with the new criteria (counted attempts, integrity voids)
  const world = (rows) => ({ today: DAY, defs: D.microcred_defs, awards: D.microcred_awards, courses: D.courses, training_records: D.training_records, attempts: D.attempts, opportunities: D.opportunities,
    opportunity_applications: D.opportunity_applications, person_skills: D.person_skills, adaptive_attempts: D.adaptive_attempts, task_attempts: D.task_attempts, integrity_reports: rows.reports ?? D.integrity_reports });
  const w0 = world({});
  const diffs = [];
  let checked = 0;
  const fs31D = D.microcred_defs.filter((d) => fs31.some((x) => x.id === d.id));
  for (const pid of staff) for (const d of fs31D) {
    const s = (await q(`select kafaa_mc_eligibility(d, $1, $2::date) e from kafaa_microcred_defs d where d.id = $3`, [pid, DAY, d.id]))[0].e;
    checked++;
    if (!same(s, eligibility(d, pid, w0))) diffs.push(`${pid}/${d.code}`);
  }
  ok(diffs.length === 0, `SQL kafaa_mc_eligibility equals eligibility() for ${checked} person x FS31 definition pairs${diffs.length ? ` (${diffs[0]})` : ''}`);
  const held = T.microcred_awards.filter((a) => FS31_CODES.includes(a.def_code) && a.status === 'awarded');
  ok(held.length >= 60 && held.every((a) => a.key_id === 'key-1' && a.public_slug && a.credential?.proof?.proofValue) && held.every((a) => T.skill_evidence.some((e) => e.ref_table === 'microcred_awards' && e.ref_id === a.id)),
    `seed: ${held.length} FS31 awards, signed with the server key, each with its F01 credential evidence`);
  // voiding the integrity report of the attempt an award rests on removes the criterion (both sides)
  const rep = D.integrity_reports.find((r) => r.kind === 'adaptive' && r.decision !== 'voided' && D.adaptive_attempts.some((a) => a.id === r.attempt_id && a.bank_id === 'ab-ai-literacy' && a.status === 'completed' && a.estimate >= 2 && a.counts !== false));
  if (rep) {
    const at = D.adaptive_attempts.find((a) => a.id === rep.attempt_id);
    const d = D.microcred_defs.find((x) => x.code === 'MC-QUESTION-AI' && x.status === 'current');
    await q('begin');
    await q(`update kafaa_integrity_reports set decision = 'voided' where id = $1`, [rep.id]);
    const s = (await q(`select kafaa_mc_eligibility(d, $1, $2::date) e from kafaa_microcred_defs d where d.id = $3`, [at.person_id, DAY, d.id]))[0].e;
    await q('rollback');
    const t = eligibility(d, at.person_id, world({ reports: D.integrity_reports.map((r) => (r.id === rep.id ? { ...r, decision: 'voided' } : r)) }));
    const crit = (e) => e.criteria.find((c) => c.kind === 'adaptive');
    ok(same(s, t) && crit(t).evidence.every((e) => e.id !== at.id), 'an adaptive attempt whose integrity report is voided never counts (TS = SQL)');
  } else ok(false, 'seed has a gating adaptive attempt with an integrity report');

  // ── FS31 unlocks, target check and report
  const uw = { today: DAY, defs: D.microcred_defs, awards: D.microcred_awards, unlocks: D.microcred_unlocks, opportunities: D.opportunities, rotation_templates: D.rotation_templates };
  const ud = [];
  for (const pid of staff) {
    const s = (await q(`select kafaa_fc_unlocks($1, $2::date) u`, [pid, DAY]))[0].u;
    if (!same(s, unlocksFor(pid, uw))) ud.push(pid);
  }
  ok(ud.length === 0, `SQL kafaa_fc_unlocks equals unlocksFor() for all ${staff.length} staff${ud.length ? ` (${ud[0]})` : ''}`);
  const tg = [];
  for (const u of D.microcred_unlocks) for (const pid of ['p-k-ro', 'p-sro', 'p-qc-inspector', 'p-buyer', ...staff.slice(0, 12)]) {
    const s = (await q(`select kafaa_fc_target_check($1, $2, $3, $4::date) c`, [pid, u.target_kind, u.target_id, DAY]))[0].c;
    if (!same(s, targetCheck(pid, u.target_kind, u.target_id, uw))) tg.push(`${pid}/${u.id}`);
  }
  ok(tg.length === 0, `SQL kafaa_fc_target_check equals targetCheck() on every unlock target${tg.length ? ` (${tg[0]})` : ''}`);
  const kro = unlocksFor('p-k-ro', uw);
  const pilot = kro.find((u) => u.target_id === 'opp-governed-ai-pilot');
  const nonHolder = staff.find((p) => !D.microcred_awards.some((a) => a.person_id === p && a.def_code === 'MC-AI-ASSURER' && a.status === 'awarded'));
  ok(pilot?.unlocked === true && pilot.strategic && targetCheck(nonHolder, 'opportunity', 'opp-governed-ai-pilot', uw).unlocked === false && targetCheck(nonHolder, 'opportunity', 'opp-governed-ai-pilot', uw).named === true,
    'AC: a strategic credential unlocks the gig that names it (k-ro holds MC-AI-ASSURER: the governed AI pilot is open; a non-holder sees it locked)');
  const rpS = (await q(`select kafaa_fc_report($1::date) r`, [DAY]))[0].r;
  const rpT = strategicReport({ today: DAY, defs: D.microcred_defs, awards: D.microcred_awards, people: D.people, opportunity_applications: D.opportunity_applications, rotation_placements: D.rotation_placements });
  ok(same(rpS, rpT) && rpT.rows.length === 3 && rpT.rows.every((r) => (r.suppressed ? r.holders === null && r.rate === null : r.holders >= 10)), `SQL kafaa_fc_report equals strategicReport() (correlation with internal moves; groups under 10 suppressed: ${rpT.rows.map((r) => `${r.code} ${r.suppressed ? 'suppressed' : r.holders}`).join(', ')})`);

  // ── FS31 RPCs
  const led = async () => (await q('select count(*)::int n from ledger_entries'))[0].n;
  const l0 = await led();
  const sOff = await rpc('training-mgr', `kafaa_set_microcred_strategic('MC-AI-ASSURER', false, 'Pilot paused for a quarter')`);
  const l1 = await led();
  const kroOff = (await rpc('k-ro', `kafaa_credential_target_check('opportunity', 'opp-governed-ai-pilot')`));
  const sOn = await rpc('training-mgr', `kafaa_set_microcred_strategic('MC-AI-ASSURER', true, 'Pilot resumes')`);
  const kroOn = (await rpc('k-ro', `kafaa_credential_target_check('opportunity', 'opp-governed-ai-pilot')`));
  ok(sOff.ok && l1 === l0 + 1 && kroOff.named === false && sOn.ok && kroOn.named && kroOn.unlocked && kroOn.held.includes('MC-AI-ASSURER'),
    'tier: framework owners move a credential out of and back into the strategic tier (ledger); out of the tier it unlocks nothing');
  ok((await rpc('sro', `kafaa_set_microcred_strategic('MC-TWINS', false, 'Not my call')`)).code === 'forbidden' && (await rpc('training-mgr', `kafaa_set_microcred_strategic('MC-TWINS', true, 'Already')`)).code === 'no_change'
    && (await rpc('training-mgr', `kafaa_set_microcred_strategic('MC-NONE', true, 'x x x')`)).code === 'not_found' && (await rpc('training-mgr', `kafaa_set_microcred_strategic('MC-TWINS', false, 'x')`)).code === 'invalid',
    'tier refusals: forbidden (managers), no_change, not_found, a reason is required');
  const unl = { def_code: 'MC-TWINS', target_kind: 'opportunity', target_id: 'opp-outage-schedule-analytics', note_en: 'Twin-based schedule checks', note_ar: 'فحوصات الجدول بالتوأم الرقمي' };
  const u1 = await rpc('training-mgr', `kafaa_set_credential_unlock($1::jsonb)`, [JSON.stringify(unl)]);
  const u2 = await rpc('training-mgr', `kafaa_set_credential_unlock($1::jsonb)`, [JSON.stringify({ ...unl, active: false })]);
  await q(`insert into kafaa_rotation_templates (id, programme, owner_id, title_en, title_ar, summary_en, summary_ar, duration_min_months, duration_max_months, steps, eligible_families, sources, status, listed)
    values ('rt-fs43-sec', 'cross_functional', 'p-training-mgr', 'Security test rotation', 'تدوير اختباري', 'x', 'x', 3, 6, '[]'::jsonb, array['security'], '[]'::jsonb, 'draft', false) on conflict do nothing`).catch(() => {});
  const u3 = await rpc('training-mgr', `kafaa_set_credential_unlock($1::jsonb)`, [JSON.stringify({ ...unl, target_kind: 'rotation', target_id: 'rt-fs43-sec' })]);
  const u4 = await rpc('buyer', `kafaa_set_credential_unlock($1::jsonb)`, [JSON.stringify(unl)]);
  const u5 = await rpc('training-mgr', `kafaa_set_credential_unlock($1::jsonb)`, [JSON.stringify({ ...unl, target_id: 'opp-none' })]);
  ok(u1.ok && u1.data.active && u2.ok && u2.data.active === false && u3.code === 'security_restricted' && u4.code === 'forbidden' && u5.code === 'invalid',
    'unlocks: framework owners name and switch off a gig; a security placement is refused; staff are forbidden; unknown targets are invalid');
  const cu = await one('sro', `select kafaa_credential_unlocks('p-k-ro') r`);
  const cuB = await one('buyer', `select kafaa_credential_unlocks('p-k-ro') r`);
  ok(cu.r.allowed && cu.r.items.length >= 4 && cuB.r.allowed === false, 'credentialUnlocks: a manager in scope reads a person\'s unlocks; a colleague outside scope is refused');
  const repSro = await rpc('sro', 'kafaa_strategic_report()');
  const repTm = await rpc('training-mgr', 'kafaa_strategic_report()');
  const repHr = await rpc('k-hr-analyst', 'kafaa_strategic_report()');
  const repAu = await rpc('k-auditor', 'kafaa_strategic_report()');
  ok(repSro.allowed === false && repTm.allowed && repHr.allowed && repAu.allowed && repTm.rows.length === 3, 'strategic report: training manager, HR and auditors read it; line managers do not');

  // ── FS32 items and bundle parity, CLR shape, nothing restricted
  const rw = (pid) => ({ today: DAY, person: pid, initials: D.people.find((p) => p.id === pid)?.initials || '—', microcred_awards: D.microcred_awards, microcred_defs: D.microcred_defs, badges: D.badges,
    certificates: D.certificates, qual_records: D.qual_records, qual_standards: D.qual_standards, person_skills: D.person_skills, skills: D.skills, competencies: D.competencies });
  const idiff = [];
  for (const pid of staff) { const s = (await q(`select kafaa_lr_items($1, $2::date) i`, [pid, DAY]))[0].i; if (!same(s, recordItems(rw(pid)))) idiff.push(pid); }
  ok(idiff.length === 0, `SQL kafaa_lr_items equals recordItems() for all ${staff.length} staff${idiff.length ? ` (${idiff[0]})` : ''}`);
  const bdiff = [], shape = [], leak = [];
  const people = [...D.record_shares.map((s) => [s.person_id, s.items, s.id, String(s.expires_on).slice(0, 10)]), ...staff.filter((_, i) => i % 5 === 0).map((p) => [p, recordItems(rw(p)).map((x) => x.ref), `all:${p}`, null])];
  for (const [pid, refs, id, exp] of people) {
    const s = (await q(`select kafaa_lr_bundle($1, $2::text[], $3::date, $4, $5::date) b`, [pid, refs, DAY, id, exp]))[0].b;
    const t = buildBundle(rw(pid), refs, { id, issued_on: DAY, valid_until: exp });
    if (!same(s, t)) bdiff.push(id);
    if (validateClr(s).length) shape.push(`${id}: ${validateClr(s)[0]}`);
    const txt = JSON.stringify(s);
    const lm = txt.match(/qs-sec|sk-sa-01|"sa-01"|medical/i) || txt.match(RESTRICTED_RECORD) || (txt.includes(String(D.people.find((p) => p.id === pid)?.display_name ?? '§')) ? ['name'] : null);
    if (lm) leak.push(`${id}: ${lm[0]}`);
  }
  ok(bdiff.length === 0, `SQL kafaa_lr_bundle equals buildBundle() for ${people.length} bundles (seeded shares and full records)${bdiff.length ? ` (${bdiff[0]})` : ''}`);
  ok(shape.length === 0, `AC: every bundle validates against the CLR 2.0-shaped schema (ClrCredential, ClrSubject, embedded credentials, associations)${shape.length ? ` (${shape[0]})` : ''}`);
  ok(leak.length === 0 && T.qual_records.some((r) => r.standard_id === 'qs-sec'), `AC: no bundle carries a security standard or skill, a medical detail or a name (holder initials only)${leak.length ? ` (${leak[0]})` : ''}`);

  // ── FS32 verify, shares, RLS
  const tok = (id) => T.record_shares.find((s) => s.id === id).token;
  const act = await rpc(null, 'kafaa_verify_record_share($1)', [tok('rs-kro-digital-rotation')]);
  const exp = await rpc(null, 'kafaa_verify_record_share($1)', [tok('rs-kro-mentoring-2026')]);
  const rev = await rpc(null, 'kafaa_verify_record_share($1)', [tok('rs-kro-old-draft')]);
  const none = await rpc(null, 'kafaa_verify_record_share($1)', ['0'.repeat(32)]);
  const shared = T.record_shares.find((s) => s.id === 'rs-kro-digital-rotation').items;
  ok(act.ok && act.data.status === 'active' && act.data.holder_initials === 'RO' && same(act.data.clr.kafaaItems.map((i) => i.ref), shared) && !JSON.stringify(act.data).includes(String(D.people.find((p) => p.id === 'p-k-ro')?.display_name ?? '§')),
    `verify: an active link shows exactly the shared items with initials only (anonymous)${act.ok ? ` (${act.data.status} ${act.data.holder_initials} ${JSON.stringify(act.data.clr?.kafaaItems?.map((i) => i.ref))} vs ${JSON.stringify(shared)})` : ` (${act.code})`}`);
  const personal = (d) => ['clr', 'holder_initials', 'item_count', 'expires_on'].some((k) => k in d) || JSON.stringify(d).includes('RO');
  ok(exp.ok && exp.data.status === 'expired' && !personal(exp.data) && rev.ok && rev.data.status === 'revoked' && !personal(rev.data) && none.code === 'not_found',
    'AC: an expired or revoked link shows nothing personal; an unknown link is not found');
  const v0 = (await q(`select views from kafaa_record_shares where id = 'rs-sro-iaea-secondment'`))[0].views;
  let last;
  for (let i = 0; i < 21; i++) last = await rpc(null, 'kafaa_verify_record_share($1)', [tok('rs-sro-iaea-secondment')]);
  const v1 = (await q(`select views from kafaa_record_shares where id = 'rs-sro-iaea-secondment'`))[0].views;
  ok(last.code === 'rate_limited' && v1 === v0 + 20, 'verify is rate-limited (20 a minute per link) and counts views');
  const kroItems = recordItems(rw('p-k-ro'));
  const pick = kroItems.filter((i) => i.kind === 'mc' || i.kind === 'qual').slice(0, 3).map((i) => i.ref);
  const share = (body) => rpc('k-ro', 'kafaa_create_record_share($1::jsonb)', [JSON.stringify(body)]);
  const base = { items: pick, label: 'Rotation application', expires_on: '2026-12-01', consents: { items: true, preview: true, share: true } };
  const r1 = await share({ ...base, consents: { items: true, preview: false, share: true } });
  const r2 = await share({ ...base, items: [...pick, 'qual:qr-p-sro-qs-ro'] });
  const r3 = await share({ ...base, expires_on: '2027-03-01' });
  const r4 = await share({ ...base, items: ['skill:sk-sa-01'] });
  const l2 = await led();
  const r5 = await share(base);
  ok(r1.code === 'consent_required' && r2.code === 'not_shareable' && r3.code === 'invalid' && r4.code === 'not_shareable' && r5.ok && (await led()) === l2 + 1,
    'createShare: all three consent gates, own and shareable items only (never a security skill), expiry within 90 days; the share is recorded in the ledger');
  const created = (await q(`select * from kafaa_record_shares where id = $1`, [r5.data.id]))[0];
  ok(created.person_id === 'p-k-ro' && created.items.length === 3 && created.consents.items && created.consents.preview && created.consents.share && created.token === r5.data.token, 'createShare stores the items, the three consents and a random token');
  ok((await rpc('sro', 'kafaa_revoke_record_share($1, $2)', [r5.data.id, 'not mine'])).code === 'not_found', 'only the holder can revoke a share link');
  const rv = await rpc('k-ro', 'kafaa_revoke_record_share($1, $2)', [r5.data.id, 'Rotation closed']);
  const after = await rpc(null, 'kafaa_verify_record_share($1)', [r5.data.token]);
  ok(rv.ok && after.data.status === 'revoked' && !after.data.clr && (await rpc('k-ro', 'kafaa_revoke_record_share($1, $2)', [r5.data.id, 'again'])).code === 'already_closed', 'revoke: the link then shows nothing personal; a second revoke is refused');
  const cnt = async (who, table, where = 'true') => Number((await one(who, `select count(*)::int n from ${table} where ${where}`)).n);
  ok(await cnt(null, 'kafaa_record_shares') === 0 && await cnt('sro', 'kafaa_record_shares', `person_id = 'p-k-ro'`) === 0 && await cnt('training-mgr', 'kafaa_record_shares', `person_id = 'p-k-ro'`) === 0
    && await cnt('k-ro', 'kafaa_record_shares') === T.record_shares.filter((s) => s.person_id === 'p-k-ro').length + 1, 'RLS: share links are Own only (no manager, training manager or anonymous read)');
  const lr = await rpc('k-ro', 'kafaa_learner_record(null)');
  ok(lr.allowed && lr.items.length === kroItems.length && validateClr(lr.bundle).length === 0 && (await rpc('k-auditor', 'kafaa_learner_record(null)')).allowed === false, 'learnerRecord: my items and the preview bundle (staff only)');

  // ── FS33 goals: RLS (shared only), RPCs, trigger
  const sroSees = (await one('sro', `select coalesce(array_agg(id order by id), '{}') a from kafaa_skill_goal_plans where person_id = 'p-k-ro'`)).a;
  const kroShared = T.skill_goal_plans.filter((p) => p.person_id === 'p-k-ro' && p.shared).map((p) => p.id).sort();
  ok(same(sroSees, kroShared) && kroShared.length === 2 && await cnt('k-ro', 'kafaa_skill_goal_plans', `person_id = 'p-k-ro'`) === 3,
    'AC (RLS): the line manager sees only the goals k-ro shared (2 of 3); k-ro sees all three');
  ok(await cnt('k-hr-analyst', 'kafaa_skill_goal_plans') === 0 && await cnt(null, 'kafaa_skill_goal_plans') === 0 && await cnt('buyer', 'kafaa_skill_goal_plans', `person_id <> 'p-buyer'`) === 0
    && await cnt('training-mgr', 'kafaa_skill_goal_plans', 'not shared') === 0, 'RLS: HR, colleagues and anonymous visitors see no goal; nobody else ever sees a private goal');
  const goal = (who, body) => rpc(who, 'kafaa_save_skill_goal($1::jsonb)', [JSON.stringify(body)]);
  const g0 = { skill_id: 'sk-fs-gr-circular', target_level: 2, target_date: '2027-05-31', note: 'Waste stewardship project', shared: true };
  const gr = [await goal('k-ro', { ...g0, skill_id: 'sk-sa-01' }), await goal('k-ro', { ...g0, skill_id: 'sk-fs-dp-paperlog' }), await goal('k-ro', { ...g0, target_date: '2026-10-12' }), await goal('k-ro', { ...g0, target_level: 5 }), await goal('k-auditor', g0)];
  const obsolete = T.skills.find((s) => s.lifecycle === 'obsolete')?.id;
  ok(gr[0].code === 'restricted' && (obsolete !== 'sk-fs-dp-paperlog' || gr[1].code === 'obsolete') && gr[2].code === 'invalid' && gr[3].code === 'invalid' && gr[4].code === 'forbidden',
    'saveSkillGoal refusals: security skills, obsolete skills, a date under two weeks, a level over 4, people without a passport');
  const g1 = await goal('k-ro', g0);
  const row = (await q(`select g.status gs, g.source, p.* from kafaa_skill_goals g join kafaa_skill_goal_plans p on p.id = g.id where g.id = 'sg:p-k-ro:sk-fs-gr-circular'`))[0];
  ok(g1.ok && row.gs === 'active' && row.source === 'fs33' && row.shared && row.share_person === 'p-k-ro' && String(row.target_date instanceof Date ? row.target_date.toISOString() : row.target_date).startsWith('2027-05-3')
    && await cnt('sro', 'kafaa_skill_goal_plans', `id = 'sg:p-k-ro:sk-fs-gr-circular'`) === 1, 'saveSkillGoal writes FS07\'s goal row (the Coach reads it) and the plan; shared, the manager sees it');
  const sh = await rpc('k-ro', `kafaa_share_skill_goal('sk-fs-gr-circular', false)`);
  ok(sh.ok && await cnt('sro', 'kafaa_skill_goal_plans', `id = 'sg:p-k-ro:sk-fs-gr-circular'`) === 0 && (await rpc('k-ro', `kafaa_share_skill_goal('sk-fs-gr-circular', false)`)).code === 'no_change', 'shareSkillGoal: private again, the manager no longer sees it');
  await rpc('k-ro', `kafaa_share_skill_goal('sk-fs-gr-circular', true)`);
  const wd = await rpc('k-ro', `kafaa_withdraw_skill_goal('sk-fs-gr-circular')`);
  const wrow = (await q(`select g.status gs, p.status, p.shared, p.share_person from kafaa_skill_goals g join kafaa_skill_goal_plans p on p.id = g.id where g.id = 'sg:p-k-ro:sk-fs-gr-circular'`))[0];
  ok(wd.ok && wrow.gs === 'removed' && wrow.status === 'removed' && !wrow.shared && wrow.share_person === null && await cnt('sro', 'kafaa_skill_goal_plans', `id = 'sg:p-k-ro:sk-fs-gr-circular'`) === 0
    && (await rpc('k-ro', `kafaa_withdraw_skill_goal('sk-fs-gr-circular')`)).code === 'no_goal', 'AC: a goal can be withdrawn at any time (unshared; FS07\'s row removed so the Coach stops weighing it)');
  const fs07 = await rpc('k-ro', `kafaa_set_skill_goal('sk-fs-adv-passive', 2, false)`);
  const trg = (await q(`select status, shared, share_person from kafaa_skill_goal_plans where id = 'sg:p-k-ro:sk-fs-adv-passive'`))[0];
  ok(fs07.ok && trg.status === 'removed' && !trg.shared && trg.share_person === null, 'removing a goal from the FS07 skill page also unshares its plan (trigger = local subscription)');
  const fresh = await rpc('k-ro', `kafaa_set_skill_goal('sk-fs-gr-climaterisk', 2, true)`);
  ok(fresh.ok && (await rpc('k-ro', `kafaa_share_skill_goal('sk-fs-gr-climaterisk', true)`)).code === 'no_plan', 'a goal added without a date cannot be shared until it has a plan');
  let ck = false;
  try { await q(`update kafaa_skill_goal_plans set share_person = 'p-sro' where id = 'sg:p-k-ro:sk-fs-ai-verify'`); } catch { ck = true; }
  ok(ck, 'table check: share_person can only be the goal\'s own person while active and shared');

  // ── grants and additivity
  const rpcs = ['kafaa_set_microcred_strategic', 'kafaa_set_credential_unlock', 'kafaa_credential_unlocks', 'kafaa_credential_target_check', 'kafaa_strategic_report', 'kafaa_learner_record',
    'kafaa_create_record_share', 'kafaa_revoke_record_share', 'kafaa_verify_record_share', 'kafaa_save_skill_goal', 'kafaa_withdraw_skill_goal', 'kafaa_share_skill_goal'];
  const helpers = ['kafaa_fc_held', 'kafaa_fc_unlocks', 'kafaa_fc_target_check', 'kafaa_fc_moves', 'kafaa_fc_report', 'kafaa_fc_unlock_problem', 'kafaa_lr_items', 'kafaa_lr_bundle', 'kafaa_lr_share_problem', 'kafaa_sg_problem'];
  const can = async (role, fn) => (await q(`select bool_or(has_function_privilege($1, p.oid, 'execute')) x from pg_proc p where p.proname = $2`, [role, fn]))[0].x;
  const g = { auth: [], anon: [], helper: [] };
  for (const f of rpcs) { if (await can('authenticated', f)) g.auth.push(f); if (await can('anon', f)) g.anon.push(f); }
  for (const f of helpers) if ((await can('authenticated', f)) || (await can('anon', f))) g.helper.push(f);
  ok(g.auth.length === rpcs.length && same(g.anon, ['kafaa_verify_record_share']) && g.helper.length === 0, `grants: ${g.auth.length} RPCs for signed-in users, only verify for anonymous visitors, helpers for nobody`);
  const sql = readFileSync(MIG, 'utf8');
  const fns = [...sql.matchAll(/create or replace function\s+(\w+)/g)].map((m) => m[1]);
  ok(fns.every((f) => f.startsWith('kafaa_')) && !/\bdrop\s+(table|function|policy|trigger|index)|\bdelete\s+from\b|\btruncate\b/i.test(sql) && [...sql.matchAll(/(?:alter|create)\s+table(?: if not exists)?\s+(\w+)/g)].every((m) => m[1].startsWith('kafaa_')),
    `additive: ${fns.length} kafaa_* functions, kafaa_* tables only, no drop, delete or truncate`);
}
