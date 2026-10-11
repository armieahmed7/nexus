// [FS wave A · E4 · FS05] PGlite checks for 20261010214001_kafaa_fs14_role_profiles.sql: the seeded profiles and concept roles
// (FS05 acceptance), RLS (published public; drafts for training, admins, SAT reviewers and auditors only), kafaa_rpv_check = TS
// checkVersion on a battery of inputs, and kafaa_save_role_profile_version: RBAC, refusals, draft -> publish -> supersede,
// stored requirements = TS normaliseReqs, audit always and NEXUS ledger on publish only.
import { readFileSync } from 'node:fs';
import { checkVersion, normaliseReqs, profileTextIsClean, publishedByHorizon, reqsOf } from '../../src/modules/m01/roleProfiles.ts';
import { findPaths } from '../../src/domain/careerGraph.ts';
import { publicTextIsClean } from '../../src/domain/future.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export default async function fs14Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const V = 'kafaa_role_profile_versions';

  // ── seed digest: every seeded version row is in the database unchanged
  const dbRows = await q(`select id, role_id, horizon, version, status, is_public, path_only, requirements, drivers, rationale_en, rationale_ar, sources, supersedes_id, superseded_by_id from ${V} order by id`);
  const seedRows = [...T.role_profile_versions].sort((a, b) => (a.id < b.id ? -1 : 1)).map(({ id, role_id, horizon, version, status, is_public, path_only, requirements, drivers, rationale_en, rationale_ar, sources, supersedes_id, superseded_by_id }) => ({ id, role_id, horizon, version, status, is_public, path_only, requirements, drivers, rationale_en, rationale_ar, sources, supersedes_id, superseded_by_id }));
  ok(dbRows.length === seedRows.length && same(dbRows, seedRows), `the ${seedRows.length} seeded role profile versions load unchanged (row digest = seed.json)`);

  // ── FS05 acceptance on what an anonymous visitor reads
  const pub = await as(null, `select * from ${V}`);
  ok(pub.length === T.role_profile_versions.filter((v) => v.status === 'published').length && pub.every((v) => v.status === 'published' && v.is_public), `anonymous visitors read the ${pub.length} published versions only (no drafts, no superseded history)`);
  const roles = await as(null, `select id, lifecycle, security_sensitive from kafaa_job_roles`);
  const current = roles.filter((r) => r.lifecycle === 'current');
  const concepts = roles.filter((r) => r.lifecycle === 'concept');
  const with2030 = current.filter((r) => publishedByHorizon(pub, r.id)['2030']);
  ok(current.length === 28 && with2030.length === 28, `28 of 28 current roles have a published 2030 version (${with2030.length})`);
  const edges = await as(null, `select * from kafaa_career_paths`);
  const future = edges.filter((e) => e.kind === 'future');
  const conceptOk = concepts.filter((r) => {
    const v = publishedByHorizon(pub, r.id);
    return reqsOf(v['2035'] ?? v['2030']).length >= 4 && future.some((e) => e.to_role_id === r.id);
  });
  ok(concepts.length === 11 && conceptOk.length === 11 && concepts.every((r) => T.future_roles.some((f) => f.id === r.id)), `11 of 11 concept future roles (same ids as M11) have at least 4 requirements and an inbound future edge (${conceptOk.length})`);
  ok(future.every((e) => current.some((r) => r.id === e.from_role_id) && concepts.some((r) => r.id === e.to_role_id)) && concepts.every((r) => { const n = future.filter((e) => e.to_role_id === r.id).length; return n >= 1 && n <= 3; }), `future edges run from a current role to a concept role, 1 to 3 per concept role (${future.length} edges)`);
  const unreachable = concepts.filter((r) => !current.some((c) => findPaths(edges, c.id, r.id).length > 0));
  ok(unreachable.length === 0, `findPaths reaches every concept role from at least one current role${unreachable.length ? ` (missing ${unreachable[0].id})` : ''}`);
  const pubText = [...pub.flatMap((v) => [v.rationale_en, v.rationale_ar, v.requirements]), ...(await as(null, `select summary_en, summary_ar, qualifications_en, qualifications_ar, training_path_en, training_path_ar, basis_note from kafaa_job_roles where lifecycle = 'concept'`)).flatMap(Object.values), ...future.flatMap((e) => [e.label_en, e.label_ar, e.conditions])];
  ok(profileTextIsClean(pubText) && publicTextIsClean(pubText), 'public profile text, concept roles and future edges pass profileTextIsClean and publicTextIsClean (no headcount, sites or deployment claims)');
  const sec = roles.filter((r) => r.security_sensitive);
  ok(sec.length === 3 && pub.filter((v) => sec.some((r) => r.id === v.role_id)).every((v) => v.path_only && v.requirements.length === 0) && pub.filter((v) => sec.some((r) => r.id === v.role_id)).length === 9, 'security, safeguards and cyber roles carry path-level versions only (no requirements) at now, 2030 and 2035');
  ok(pub.every((v) => v.sources.length > 0 && v.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of ?? ''))), 'every published version cites https sources with an as-of date');

  // ── drafts and history: training manager, admins, instructors (SAT review) and auditors only
  const hidden = T.role_profile_versions.filter((v) => v.status !== 'published').length;
  const all = T.role_profile_versions.length;
  const seen = {};
  for (const p of ['training-mgr', 'k-admin', 'k-auditor', 'k-instructor', 'k-ro', 'sro', 'k-hr-analyst', 'chco', 'alnoor-gm']) seen[p] = await count(p, V);
  ok(hidden >= 3 && ['training-mgr', 'k-admin', 'k-auditor', 'k-instructor'].every((p) => seen[p] === all) && ['k-ro', 'sro', 'k-hr-analyst', 'chco', 'alnoor-gm'].every((p) => seen[p] === all - hidden),
    `drafts and superseded versions (${hidden}) are read by the training manager, admins, instructors and auditors only (${JSON.stringify(seen)})`);

  // ── kafaa_rpv_check = checkVersion (TS) on a battery of inputs
  const ctxFor = (roleId) => {
    const r = T.job_roles.find((x) => x.id === roleId);
    return { role: r ? { id: r.id, lifecycle: r.lifecycle, security_sensitive: !!r.security_sensitive } : null, competencies: new Map(T.competencies.map((c) => [c.id, c.domain])), skills: new Map(T.skills.map((s) => [s.id, s.area])) };
  };
  const ro30 = T.role_profile_versions.find((v) => v.id === 'rpv-reactor-operator-2030-v2');
  const base = { role_id: 'reactor-operator', horizon: '2035', requirements: ro30.requirements, drivers: ['ai_assistance'], rationale_en: 'A planning assumption for the 2035 operator profile.', rationale_ar: 'افتراض تخطيطي لملف المشغّل لعام 2035.', sources: ro30.sources, publish: true };
  const R = (o) => ({ ...base, ...o });
  const req = (id, level = 2, extra = {}) => ({ kind: id.startsWith('sk-') ? 'skill' : 'competency', ref_id: id, level, importance: 'important', why_en: '', why_ar: '', driver: null, ...extra });
  const cases = [
    base, R({ publish: false }), R({ horizon: 'x' }), R({ drivers: ['bad'] }), R({ drivers: 'digital_ic' }), R({ rationale_en: 'short' }), R({ rationale_ar: '   ' }), R({ role_id: 'nope' }),
    R({ requirements: 'x' }), R({ requirements: Array.from({ length: 31 }, (_, i) => req(T.skills[i].id)) }), R({ requirements: [req('sk-da-01', 0)] }), R({ requirements: [req('sk-da-01', 2.5)] }), R({ requirements: [req('sk-da-01', '2')] }),
    R({ requirements: [req('sk-da-01', 2, { importance: 'x' })] }), R({ requirements: [req('sk-da-01', 2, { driver: 'bad' })] }), R({ requirements: [req('sk-da-01'), req('sk-da-01', 3)] }), R({ requirements: [req('zz-01')] }), R({ requirements: [req('sk-zz')] }),
    R({ role_id: 'cyber-security-engineer', requirements: [req('sk-da-01')] }), R({ role_id: 'cyber-security-engineer', requirements: [] }), R({ requirements: [req('sk-sa-01')] }), R({ requirements: [req('sa-01')] }),
    R({ rationale_en: 'We will need 40 engineers for this new unit by 2035.' }), R({ rationale_ar: 'سيتم بناء وحدات جديدة وفق هذا الملف التخطيطي.' }), R({ rationale_en: 'Deployment has been approved for the new design in this plan.' }), R({ rationale_en: 'Planning assumption; no deployment decision implied here.' }),
    R({ requirements: [req('sk-da-01', 2, { why_en: 'A candidate site needs this skill.' })] }), R({ sources: [] }), R({ sources: [{ id: 'x', label: 'x', url: 'http://example.org' }] }), R({ sources: [{ id: 'x', label: ' ', url: 'https://example.org' }] }),
    R({ role_id: 'fr-digital-twin', requirements: [req('sk-da-01-twins', 3), req('en-02', 3), req('sk-da-01')] }), R({ role_id: 'fr-digital-twin', requirements: [req('sk-da-01-twins', 3), req('en-02', 3), req('sk-da-01')], publish: false }),
    R({ requirements: [] }), R({ requirements: [], publish: false }), R({ requirements: [req('sk-da-01', 2, { driver: 'digital_ic' })], drivers: [] }),
  ];
  const diffs = [];
  for (const [i, c] of cases.entries()) {
    const sql = (await q(`select kafaa_rpv_check($1::jsonb) as c`, [JSON.stringify(c)]))[0].c;
    const ts = checkVersion(c, ctxFor(c.role_id));
    if (sql !== ts) diffs.push(`#${i} sql=${sql} ts=${ts}`);
  }
  const codes = new Set(cases.map((c) => checkVersion(c, ctxFor(c.role_id))));
  ok(diffs.length === 0 && codes.size === 9, `kafaa_rpv_check = checkVersion() on ${cases.length} inputs covering all ${codes.size} outcomes${diffs.length ? ` (${diffs.join('; ')})` : ''}`);

  // ── kafaa_save_role_profile_version
  const call = async (persona, input) => (await one(persona, `select kafaa_save_role_profile_version($1::jsonb) r`, [JSON.stringify(input)])).r;
  const forb = await Promise.all(['k-ro', 'sro', 'k-instructor', 'k-hr-analyst', 'k-auditor'].map((p) => call(p, R({ publish: false }))));
  let anonDenied = false;
  try { await as(null, `select kafaa_save_role_profile_version('{}'::jsonb)`); } catch { anonDenied = true; }
  ok(forb.every((r) => r.code === 'forbidden') && anonDenied, 'only the training manager or an admin can save profiles (operators, managers, instructors, HR and auditors are refused; anonymous callers cannot execute it)');
  const led = async () => (await q('select count(*)::int n from ledger_entries'))[0].n;
  const led0 = await led();
  const d1 = await call('training-mgr', R({ publish: false }));
  const row1 = (await q(`select * from ${V} where id = $1`, [d1.data?.id]))[0];
  const aud1 = (await q(`select action, outcome, ledger_status, actor_role from kafaa_audit_events where entity_id = $1 order by seq desc limit 1`, [d1.data?.id]))[0];
  ok(d1.ok && d1.data.id === 'rpv-reactor-operator-2035-v2' && row1.status === 'draft' && !row1.is_public && (await led()) === led0 && aud1.action === 'role_profile.save' && aud1.ledger_status === 'not_applicable' && aud1.actor_role === 'training_manager',
    'a draft gets the next version number, stays private, and is audited without a ledger write');
  ok(same(row1.requirements, normaliseReqs(base.requirements)) && same(row1.drivers, [...new Set([...base.drivers, ...base.requirements.map((r) => r.driver).filter(Boolean)])].sort()), 'stored requirements and drivers equal normaliseReqs() and the TS driver union');
  ok((await count(null, V, `id = 'rpv-reactor-operator-2035-v2'`)) === 0 && (await count('k-auditor', V, `id = 'rpv-reactor-operator-2035-v2'`)) === 1, 'the new draft is invisible to the public and visible to auditors');
  const d2 = await call('training-mgr', R({ publish: false, rationale_en: 'A revised planning assumption for the 2035 operator profile.' }));
  ok(d2.ok && d2.data.id === d1.data.id && (await count('training-mgr', V, `role_id = 'reactor-operator' and horizon = '2035' and status = 'draft'`)) === 1, 'saving again updates the same open draft (one draft per role and horizon)');
  const p1 = await call('k-admin', R({ publish: true }));
  const now = await q(`select id, status, is_public, supersedes_id, superseded_by_id from ${V} where role_id = 'reactor-operator' and horizon = '2035' order by version`);
  const aud2 = (await q(`select action, ledger_status, ledger_seq from kafaa_audit_events where entity_id = $1 order by seq desc limit 1`, [p1.data?.id]))[0];
  ok(p1.ok && p1.data.supersedes_id === 'rpv-reactor-operator-2035-v1' && now[0].status === 'superseded' && !now[0].is_public && now[0].superseded_by_id === p1.data.id && now[1].status === 'published' && now[1].is_public && now[1].supersedes_id === 'rpv-reactor-operator-2035-v1',
    'publishing supersedes the previous published version and makes the new one public');
  ok(aud2.action === 'role_profile.publish' && aud2.ledger_status !== 'not_applicable' && (aud2.ledger_status === 'skipped' || (await led()) === led0 + 1), `publishing is audited with a NEXUS ledger write (${aud2.ledger_status})`);
  const ref = await Promise.all([
    call('training-mgr', R({ role_id: 'cyber-security-engineer', requirements: [req('sk-da-01')] })),
    call('training-mgr', R({ rationale_en: 'We will need 40 engineers for this new unit by 2035.' })),
    call('training-mgr', R({ role_id: 'fr-digital-twin', requirements: [req('sk-da-01-twins', 3)] })),
    call('training-mgr', R({ sources: [] })),
    call('training-mgr', R({ requirements: [req('sk-zz')] })),
    call('training-mgr', R({ requirements: [req('sk-da-01', 5)] })),
  ]);
  ok(same(ref.map((r) => r.code), ['security_restricted', 'unclean_text', 'too_few', 'source_required', 'unknown_ref', 'invalid_requirements']), `refusals: ${ref.map((r) => r.code).join(', ')}`);
  const refusedAudit = (await q(`select count(*)::int n from kafaa_audit_events where action = 'role_profile.save' and outcome = 'refused'`))[0].n;
  ok(refusedAudit >= 11, 'every refusal writes an audit row');
  const sec1 = await call('training-mgr', R({ role_id: 'safeguards-specialist', horizon: '2030', requirements: [], drivers: [], publish: true }));
  ok(sec1.ok && (await q(`select path_only from ${V} where id = $1`, [sec1.data.id]))[0].path_only === true, 'a security role can be republished at path level (no requirements, path_only)');
  let direct = false;
  try { await as('training-mgr', `insert into ${V} (id, role_id, horizon, rationale_en, rationale_ar, as_of) values ('x', 'reactor-operator', 'now', 'x', 'x', current_date)`); } catch { direct = true; }
  let internal = false;
  try { await as('training-mgr', `select kafaa_rpv_check('{}'::jsonb)`); } catch { internal = true; }
  ok(direct && internal, 'profile rows cannot be written directly, and the internal check is not executable by API roles');
}
