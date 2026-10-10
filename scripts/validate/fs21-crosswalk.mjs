// [FS wave B · E1 · FS07 + FS08] PGlite checks for 20261010221001_kafaa_fs21_skills_crosswalk.sql: the seeded crosswalk loads unchanged
// (row digest = seed.json), FS08 acceptance on what anonymous visitors read (>= 95% of skills aligned, every published row cites https
// and an as-of date, no drafts or retired rows), RLS for drafts and goals, kafaa_al_check = TS checkAlignment and the level-map
// canonicaliser = TS on a battery of inputs, the refusal messages = AL_MSG, and the RPC flows (save, publish, maker-checker review,
// retire, duplicate, obsolete; skill goals) with one audit row per call and no ledger rows.
import { readFileSync } from 'node:fs';
import { AL_MSG, alResultCode, canonLevelMap, checkAlignment } from '../../src/modules/m28/crosswalk.ts';
import { GOAL_MSG } from '../../src/modules/m28/crosswalk.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));

export default async function fs21Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const A = 'kafaa_skill_alignments';
  const COLS = ['id', 'skill_id', 'framework', 'external_code', 'label_en', 'label_ar', 'label_ar_official', 'external_meta', 'match_type', 'level_map', 'note_en', 'note_ar', 'source_url', 'as_of', 'status', 'listed', 'reviewed_by', 'reviewed_role', 'reviewed_on', 'retired_reason', 'retired_on', 'version', 'sort'];
  const pickRow = (r) => Object.fromEntries(COLS.map((c) => [c, ['as_of', 'reviewed_on', 'retired_on'].includes(c) ? d10(r[c]) : r[c] ?? null]));

  // ── seed digest
  const dbRows = (await q(`select * from ${A} order by id`)).map(pickRow);
  const seedRows = [...T.skill_alignments].sort((a, b) => (a.id < b.id ? -1 : 1)).map(pickRow);
  ok(dbRows.length === seedRows.length && same(dbRows, seedRows), `the ${seedRows.length} seeded alignments load unchanged (row digest = seed.json)`);
  const fw = await q(`select * from kafaa_skill_frameworks order by sort`);
  ok(fw.length === 11 && same(fw.map((f) => [f.id, f.benchmark_id, f.url, d10(f.as_of)]), T.skill_frameworks.map((f) => [f.id, f.benchmark_id, f.url, f.as_of])), '11 frameworks load unchanged, each following an FS01 benchmark row');
  const goals = await q(`select id, person_id, skill_id, target_level, status from kafaa_skill_goals order by id`);
  ok(same(goals, [...T.skill_goals].sort((a, b) => (a.id < b.id ? -1 : 1)).map(({ id, person_id, skill_id, target_level, status }) => ({ id, person_id, skill_id, target_level, status }))), `the ${goals.length} seeded skill goals load unchanged`);

  // ── FS08 acceptance on the anonymous payload
  const pub = await as(null, `select * from ${A}`);
  const skills = await as(null, `select id, lifecycle from kafaa_skills`);
  const aligned = new Set(pub.map((r) => r.skill_id));
  ok(pub.length === T.skill_alignments.filter((r) => r.status === 'published').length && pub.every((r) => r.status === 'published' && r.listed), `anonymous visitors read the ${pub.length} published alignments only (no drafts, no retired rows)`);
  ok(aligned.size / skills.length >= 0.95, `${aligned.size} of ${skills.length} skills (${Math.round((aligned.size / skills.length) * 1000) / 10}%) have at least one published alignment (>= 95%)`);
  ok(pub.every((r) => /^https:\/\//.test(r.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(d10(r.as_of))), '100% of published alignments cite an https source and an as-of date');
  ok(pub.filter((r) => r.external_code).every((r) => ({ esco: /^http:\/\/data\.europa\.eu\/esco\/skill\//, onet: /^[1-7]\.[A-Z]/, sfia9: /^[A-Z]{4}$/, digcomp: /^[1-5]\.[1-6]$/ })[r.framework]?.test(r.external_code)),
    'codes appear only for frameworks whose codes were copied from the source (ESCO URIs, O*NET element ids, SFIA 9 codes, DigComp numbers)');
  ok(pub.some((r) => !r.reviewed_by) && pub.some((r) => r.reviewed_by) && pub.filter((r) => r.reviewed_by).every((r) => r.reviewed_by !== 'p-training-mgr'), 'seeded rows mix indicative and reviewed; no reviewer reviewed their own edit');
  ok((await count(null, 'kafaa_skill_frameworks')) === 11 && (await count(null, 'kafaa_skill_goals')) === 0, 'anonymous visitors read the framework registry and no skill goals');

  // ── RLS: drafts and retired rows for framework owners, admins and auditors; goals own rows only
  const all = T.skill_alignments.length;
  const nPub = pub.length;
  const seen = {};
  for (const p of ['training-mgr', 'k-instructor', 'k-admin', 'k-auditor', 'sro', 'k-hr-analyst', 'chco', 'alnoor-gm']) seen[p] = await count(p, A);
  ok(['training-mgr', 'k-instructor', 'k-admin', 'k-auditor'].every((p) => seen[p] === all) && ['sro', 'k-hr-analyst', 'chco', 'alnoor-gm'].every((p) => seen[p] === nPub), `drafts and retired rows (${all - nPub}) are read by framework owners, admins and auditors only (${JSON.stringify(seen)})`);
  const sroGoals = T.skill_goals.filter((g) => g.person_id === 'p-sro').length;
  ok((await count('sro', 'kafaa_skill_goals')) === sroGoals && (await count('training-mgr', 'kafaa_skill_goals')) === 0 && (await count('k-admin', 'kafaa_skill_goals')) === 0, `skill goals: a person reads their own rows only (sro ${sroGoals}; training manager and admin none of others')`);

  // ── kafaa_al_check = checkAlignment (TS) on a battery of inputs
  const today = d10((await q(`select current_date d`))[0].d);
  const ctx = { skills: new Map(skills.map((s) => [s.id, { lifecycle: s.lifecycle }])), frameworks: new Set(fw.map((f) => f.id)), rows: (await q(`select id, skill_id, framework, external_code, label_en, status from ${A}`)), today };
  const base = { skill_id: 'sk-fs-ai-use', framework: 'lightcast', external_code: null, label_en: 'Generative AI', label_ar: 'الذكاء الاصطناعي التوليدي', match_type: 'broad', level_map: {}, note_en: '', note_ar: '', source_url: 'https://lightcast.io/blog/open-skills-taxonomy', as_of: '2026-10-01', publish: true };
  const R = (o) => ({ ...base, ...o });
  const esco0 = T.skill_alignments.find((r) => r.framework === 'esco' && r.status === 'published');
  const cases = [
    [base], [R({ skill_id: 'sk-nope' })], [R({ skill_id: 'sk-fs-dp-paperwp' })], [R({ framework: 'linkedin' })], [R({ label_en: '' })], [R({ label_ar: '   ' })], [R({ label_en: 'x'.repeat(201) })],
    [R({ match_type: 'similar' })], [R({ match_type: 3 })], [R({ framework: 'esco', external_code: 'ESCO-123' })], [R({ framework: 'esco', external_code: esco0.external_code, label_en: 'other' })],
    [R({ framework: 'onet', external_code: '2.A.2.a' })], [R({ framework: 'onet', external_code: '2.a.2' })], [R({ framework: 'sfia9', external_code: 'DAAN' })], [R({ framework: 'sfia9', external_code: 'daan' })],
    [R({ framework: 'digcomp', external_code: '4.2' })], [R({ framework: 'digcomp', external_code: '6.1' })], [R({ external_code: 'has space' })], [R({ external_code: 'LC-123' })],
    [R({ source_url: 'http://example.org' })], [R({ source_url: 'https://' })], [R({ source_url: 7 })], [R({ as_of: '2026-02-30' })], [R({ as_of: '2999-01-01' })], [R({ as_of: '1999-12-31' })], [R({ as_of: '10/10/2026' })],
    [R({ level_map: { 1: 'Basic', 4: 'Advanced' } })], [R({ level_map: { 5: 'x' } })], [R({ level_map: { 1: '' } })], [R({ level_map: { 1: 3 } })], [R({ level_map: ['a'] })], [R({ level_map: null })], [R({ level_map: { 2: 'x'.repeat(41) } })],
    [R({ note_en: 'n'.repeat(501) })], [R({ skill_id: esco0.skill_id, framework: 'esco', external_code: esco0.external_code, label_en: 'x' })],
    [R({ skill_id: 'sk-fs-tr-creative', framework: 'skillsfuture', label_en: ' creative thinking ' })],
    [R({ id: esco0.id, skill_id: esco0.skill_id, framework: 'esco', external_code: esco0.external_code, label_en: esco0.label_en }), esco0.id],
    [R({ id: esco0.id, skill_id: 'sk-da-01', framework: 'esco' }), esco0.id], [R({ id: 'al:sk-da-01:sfia9:datm-retired', skill_id: 'sk-da-01', framework: 'sfia9' }), 'al:sk-da-01:sfia9:datm-retired'],
    [R({ id: 'al:sk-fs-dp-paperwp:esco:x', skill_id: 'sk-fs-dp-paperwp' }), T.skill_alignments.find((r) => r.skill_id === 'sk-fs-dp-paperwp')?.id],
  ];
  const diffs = [];
  const codes = new Set();
  for (const [i, [c, exId]] of cases.entries()) {
    const ex = exId ? (await q(`select * from ${A} where id = $1`, [exId]))[0] : null;
    const sql = (await q(`select kafaa_al_check($1::jsonb, ${ex ? `(select r from ${A} r where r.id = $2)` : 'null::kafaa_skill_alignments'}) as c`, ex ? [JSON.stringify(c), exId] : [JSON.stringify(c)]))[0].c;
    const ts = checkAlignment(c, ctx, ex ? { skill_id: ex.skill_id, framework: ex.framework, status: ex.status } : null);
    codes.add(ts);
    if (sql !== ts) diffs.push(`#${i} sql=${sql} ts=${ts}`);
  }
  ok(diffs.length === 0 && codes.size >= 14, `kafaa_al_check = checkAlignment (TS) on ${cases.length} inputs covering ${codes.size} outcomes${diffs.length ? ` (${diffs.join('; ')})` : ''}`);
  const maps = [{}, { 1: ' Basic ', 3: 'Advanced' }, { 4: 'x', 2: 'y', 1: 'z' }, { 1: '', 2: 'b' }, null];
  const mDiff = [];
  for (const m of maps) { const sql = (await q(`select kafaa_al_canon_level_map($1::jsonb) m`, [JSON.stringify(m)]))[0].m; if (!same(sql, canonLevelMap(m))) mDiff.push(JSON.stringify(m)); }
  ok(mDiff.length === 0, `kafaa_al_canon_level_map = canonLevelMap (TS) on ${maps.length} maps${mDiff.length ? ` (${mDiff.join(' ')})` : ''}`);
  const msgDiff = [];
  for (const [k, v] of Object.entries(AL_MSG)) { const m = (await q(`select kafaa_al_message($1) m`, [k]))[0].m; if (m !== v) msgDiff.push(k); }
  const rcDiff = [];
  for (const k of Object.keys(AL_MSG)) { const m = (await q(`select kafaa_al_result_code($1) c`, [k]))[0].c; if (m !== alResultCode(k)) rcDiff.push(k); }
  ok(msgDiff.length === 0 && rcDiff.length === 0, `refusal messages and result codes = AL_MSG / alResultCode (${Object.keys(AL_MSG).length} codes)${msgDiff.length + rcDiff.length ? ` ${[...msgDiff, ...rcDiff]}` : ''}`);

  // ── RPC flows (audit row on every call, never a ledger row)
  const auditN = async () => Number((await q(`select count(*)::int n from kafaa_audit_events`))[0].n);
  const ledgerN = async () => Number((await q(`select count(*)::int n from ledger_entries`).catch(() => [{ n: 0 }]))[0].n);
  const a0 = await auditN();
  const l0 = await ledgerN();
  const save = (p, input) => one(p, `select kafaa_save_alignment($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r);
  const review = (p, id) => one(p, `select kafaa_review_alignment($1) r`, [id]).then((x) => x.r);
  const retire = (p, id, why) => one(p, `select kafaa_retire_alignment($1, $2) r`, [id, why]).then((x) => x.r);
  const r1 = await save('k-auditor', base);
  const r2 = await save('sro', base);
  ok(r1.code === 'forbidden' && r2.code === 'forbidden' && r1.message === AL_MSG.forbidden, 'auditors and staff without frameworks W/A cannot edit the crosswalk (forbidden)');
  const d = await save('training-mgr', { ...base, publish: false });
  const id = d.data?.id;
  ok(d.ok && /^al:sk-fs-ai-use:lightcast:[0-9a-f]{8}$/.test(id) && d.data.status === 'draft' && (await count(null, A, `id = '${id}'`)) === 0 && (await count('k-instructor', A, `id = '${id}'`)) === 1, 'the training manager adds a draft: hidden from the public, visible to framework owners');
  const dup = await save('k-instructor', { ...base, label_en: ' generative ai ' });
  ok(dup.code === 'conflict' && dup.message === AL_MSG.duplicate, 'a second active row for the same entry is refused (conflict)');
  const p2 = await save('training-mgr', { ...base, id, publish: true, level_map: { 2: 'Applied' } });
  const row2 = (await q(`select * from ${A} where id = $1`, [id]))[0];
  ok(p2.ok && p2.data.version === 2 && row2.status === 'published' && row2.listed && same(row2.level_map, { 2: 'Applied' }) && (await count(null, A, `id = '${id}'`)) === 1, 'publishing bumps the version to 2 and lists the row publicly');
  const mk = await review('training-mgr', id);
  ok(mk.code === 'maker_checker' && mk.message === AL_MSG.maker_checker, 'the last editor cannot review their own edit (maker_checker)');
  const rv = await review('k-instructor', id);
  const row3 = (await q(`select * from ${A} where id = $1`, [id]))[0];
  ok(rv.ok && row3.reviewed_by === 'p-k-instructor' && row3.reviewed_role === 'instructor' && (await review('k-admin', id)).code === 'no_change', 'another framework owner reviews it (reviewer and role stored); a second review is no_change');
  const e3 = await save('k-admin', { ...base, id, publish: true, match_type: 'close' });
  const row4 = (await q(`select * from ${A} where id = $1`, [id]))[0];
  ok(e3.ok && e3.data.version === 3 && row4.reviewed_by === null && row4.updated_by === 'p-k-admin', 'an edit makes the row indicative again (review cleared, version 3)');
  const short = await retire('k-admin', id, 'no');
  const rt = await retire('k-admin', id, 'Replaced by a coded Lightcast row');
  const again = await save('k-admin', { ...base, id });
  ok(short.code === 'invalid' && rt.ok && (await count(null, A, `id = '${id}'`)) === 0 && (await count('k-auditor', A, `id = '${id}' and status = 'retired'`)) === 1 && again.code === 'retired', 'retire needs a reason; a retired row stays (never deleted), leaves the public crosswalk and cannot be edited');
  const ob = await save('training-mgr', { ...base, skill_id: 'sk-fs-dp-paperwp' });
  const im = await save('training-mgr', { ...base, id: esco0.id, skill_id: 'sk-da-01', framework: 'esco' });
  ok(ob.code === 'obsolete' && im.code === 'invalid' && im.message === AL_MSG.immutable, 'no new alignment for an obsolete skill; skill and framework of a row are immutable');
  // goals
  const g = (p, s, lv, act = true) => one(p, `select kafaa_set_skill_goal($1, $2, $3) r`, [s, lv, act]).then((x) => x.r);
  const g1 = await g('sro', 'sk-fs-ai-verify', 2);
  const gs = await g('sro', 'sk-sa-01', 2);
  const go = await g('sro', 'sk-fs-dp-paperwp', 2);
  const gl = await g('sro', 'sk-fs-ai-use', 5);
  const ga = await g('k-auditor', 'sk-fs-ai-use', 2);
  const gr = await g('sro', 'sk-fs-ai-verify', null, false);
  const gr2 = await g('sro', 'sk-fs-ai-verify', null, false);
  ok(g1.ok && g1.data.status === 'active' && gs.code === 'restricted' && gs.message === GOAL_MSG.restricted && go.code === 'obsolete' && gl.code === 'invalid' && ga.code === 'forbidden' && gr.ok && gr.data.status === 'removed' && gr2.code === 'no_change',
    'skill goals: add, refusals (security, obsolete, level, no passport), remove, remove again (no_change)');
  const calls = 21;
  ok((await auditN()) - a0 === calls && (await ledgerN()) === l0, `every call wrote exactly one audit row (${calls}), and none wrote a NEXUS ledger row`);
  const exec = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth from pg_proc p where p.proname like 'kafaa_al_%' or p.proname in ('kafaa_save_alignment', 'kafaa_review_alignment', 'kafaa_retire_alignment', 'kafaa_set_skill_goal')`);
  ok(exec.length === 13 && exec.every((x) => !x.anon) && exec.filter((x) => x.auth).map((x) => x.proname).sort().join(',') === 'kafaa_retire_alignment,kafaa_review_alignment,kafaa_save_alignment,kafaa_set_skill_goal', 'anon executes none of the FS07/FS08 functions; authenticated only the 4 RPCs');
  const sqlText = readFileSync('supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql', 'utf8').replace(/--.*$/gm, '');
  ok(!/\b(drop|truncate|delete\s+from)\b/i.test(sqlText) && [...sqlText.matchAll(/\b(?:alter|create)\s+(?:table|policy|function|or replace function|index if not exists|trigger)\s+(?:if not exists\s+)?(?:kafaa_read\s+on\s+)?([a-z_]+)/gi)].every((m) => m[1].startsWith('kafaa_')), 'the migration only touches kafaa_* objects and never drops, deletes or truncates');
}
