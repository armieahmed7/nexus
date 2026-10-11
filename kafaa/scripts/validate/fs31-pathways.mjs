// [FS wave C · E1 · FS17 + FS18] PGlite checks for 20261010231001_kafaa_fs31_pathways_catalogue.sql (future-skill learning pathways and
// the curated, outcome-gated external catalogue).
// Seed sanity (every future skill has a published L1 pathway, envelopes and weekly hours, external items cite https provider URLs and an
// as-of date); SQL = TS parity on a pristine database: kafaa_pw_resolve = resolvePathway for every pathway, kafaa_pw_progress =
// pathwayProgress for every enrolment and three personas on every pathway, kafaa_pw_peer = peerStats, kafaa_pw_problems = pathwayProblems
// and kafaa_xr_check = catalogueCheck on the seed plus malformed inputs; RLS (published rows for staff, drafts for training staff, own
// progress only, nothing for anonymous or partner users); RPC flows (start / complete / withdraw refusals, the training-manager-only edits,
// the publish gate refusing items that fail the criteria, self-declared completions with an xAPI statement and no skill evidence, the gap
// backlog refresh); audit rows on refusals; helpers not executable by API roles.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { catalogueCheck, pathwayProblems, pathwayProgress, peerStats, recordsOf, resolvePathway } from '../../src/modules/m19/pathways.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const TODAY = new Date().toISOString().slice(0, 10);

export default async function fs31Checks({ db, as, one, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave C · E1 · FS17 future-skill learning pathways + FS18 curated external catalogue');
  const content = { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs, fitness: T.fitness_areas, adaptive: T.adaptive_banks, tasks: T.performance_tasks }; // FS wave C QA: FS21/FS22 assessment items
  const pub = T.pathways.filter((p) => p.status === 'published');

  // ── seed sanity (acceptance)
  const fs = T.skills.filter((s) => s.fs_area && s.lifecycle !== 'obsolete' && s.area !== 'security');
  ok(fs.every((s) => pub.some((p) => p.skill_id === s.id && p.level === 1)), `acceptance: every one of the ${fs.length} future skills has a published L1 pathway`);
  ok(T.pathways.every((p) => p.envelope_months >= 3 && p.envelope_months <= 6 && Number(p.weekly_hours) > 0), `acceptance: all ${T.pathways.length} pathways state a 3-6 month envelope and weekly hours`);
  ok(T.pathways.every((p) => pathwayProblems({ ...p, steps: T.pathway_steps.filter((s) => s.pathway_id === p.id) }, T.skills).length === 0), 'seed: every pathway passes pathwayProblems (sequence learn -> practice -> assess, hours inside the envelope)');
  ok(T.external_resources.every((x) => /^https:\/\//.test(x.provider_url) && /^https:\/\//.test(x.url) && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of) && x.sources.length > 0), `acceptance: all ${T.external_resources.length} external items cite an https provider URL, a source and an as-of date`);
  ok(T.external_resources.filter((x) => x.status === 'published').every((x) => catalogueCheck(x, T.catalogue_criteria, T.skills, TODAY).ok), 'seed: every published external item meets the published criteria');

  // ── parity on a pristine database
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const diffR = [];
  const resolved = new Map();
  for (const p of T.pathways) {
    const s = (await fq('select kafaa_pw_resolve($1) j', [p.id]))[0].j;
    const t = resolvePathway(p, T.pathway_steps, content);
    resolved.set(p.id, t);
    if (canon(s) !== canon(t)) diffR.push(p.id);
  }
  ok(diffR.length === 0, `SQL kafaa_pw_resolve equals resolvePathway() for all ${T.pathways.length} pathways${diffR.length ? ` (first diff ${diffR[0]})` : ''}`);
  const nReq = [...resolved.values()].filter((r) => T.pathways.find((p) => p.id === r.pathway_id).status === 'published').reduce((n, r) => n + r.requested, 0);
  const openGaps = T.pathway_gaps.filter((g) => g.status === 'open'); // FS wave C QA: steps FS19/FS21/FS22 fill are kept as "filled"
  ok(nReq === openGaps.length && openGaps.every((g) => resolved.get(g.pathway_id).steps.find((s) => s.step_id === g.step_id)?.status === 'requested')
    && T.pathway_gaps.filter((g) => g.status === 'filled').every((g) => resolved.get(g.pathway_id).steps.find((s) => s.step_id === g.step_id)?.status === 'resolved'), `acceptance: the ${nReq} requested steps are exactly the open gap backlog (FS57 feed)`);
  const recT = { training_records: T.training_records, external_completions: T.external_completions, opportunity_applications: T.opportunity_applications, microcred_awards: T.microcred_awards, fitness_attempts: T.fitness_attempts, adaptive_attempts: T.adaptive_attempts, task_attempts: T.task_attempts };
  const pairs = [...T.pathway_enrolments.map((e) => [e.person_id, e.pathway_id]), ...['p-k-ro', 'p-sro', 'p-training-mgr'].flatMap((pid) => pub.map((p) => [pid, p.id]))];
  const diffP = [];
  for (const [pid, pw] of pairs) {
    const s = (await fq('select kafaa_pw_progress($1, $2) j', [pid, pw]))[0].j;
    if (canon(s) !== canon(pathwayProgress(resolved.get(pw), recordsOf(pid, recT)))) diffP.push(`${pid}/${pw}`);
  }
  ok(diffP.length === 0, `SQL kafaa_pw_progress equals pathwayProgress() on ${pairs.length} person x pathway pairs${diffP.length ? ` (${diffP[0]})` : ''}`);
  const diffS = [];
  for (const p of T.pathways) for (const min of [10, 3]) {
    const s = (await fq('select kafaa_pw_peer($1, $2) j', [p.id, min]))[0].j;
    if (canon(s) !== canon(peerStats(T.pathway_enrolments, p.id, min))) diffS.push(`${p.id}@${min}`);
  }
  ok(diffS.length === 0, `SQL kafaa_pw_peer equals peerStats() for every pathway at two group sizes${diffS.length ? ` (${diffS[0]})` : ''}`);
  const peers = pub.map((p) => peerStats(T.pathway_enrolments, p.id, 10));
  ok(peers.some((x) => !x.suppressed && x.completed >= 10) && peers.some((x) => x.suppressed) && peers.every((x) => x.suppressed ? x.median_weeks === null && x.completed === null : x.completed >= 10),
    `acceptance: colleagues' completion times show only with 10 or more completions (${peers.filter((x) => !x.suppressed).length} pathways visible, the rest suppressed)`);

  const base = { ...T.pathways[0], steps: T.pathway_steps.filter((s) => s.pathway_id === T.pathways[0].id).map((s) => ({ kind: s.kind, title_en: s.title_en, title_ar: s.title_ar, hours: s.hours, pins: s.pins })) };
  const st = base.steps;
  const pCases = [base, { ...base, skill_id: 'sk-fs-dp-paperwp' }, { ...base, skill_id: 'sk-co-01' }, { ...base, level: 4 }, { ...base, level: 1.5 }, { ...base, level: '1' }, { ...base, title_ar: ' ' },
    { ...base, envelope_months: 2 }, { ...base, envelope_months: 7 }, { ...base, weekly_hours: 0.25 }, { ...base, weekly_hours: 11 }, { ...base, steps: st.slice(0, 2) }, { ...base, steps: [st[1], st[0], st[2]] },
    { ...base, steps: [st[0], st[0], st[2]] }, { ...base, steps: st.map((s) => ({ ...s, hours: 30 })) }, { ...base, steps: st.map((s, i) => (i === 0 ? { ...s, pins: ['bogus'] } : s)) },
    { ...base, steps: st.map((s, i) => (i === 0 ? { ...s, kind: 'watch' } : s)) }, { ...base, steps: 'x' }, { ...base, steps: st.map((s) => ({ ...s, pins: null })) }, {}];
  const diffQ = [];
  for (const c of pCases) { const s = (await fq('select kafaa_pw_problems($1::jsonb) p', [JSON.stringify(c)]))[0].p; if (canon(s) !== canon(pathwayProblems(c, T.skills))) diffQ.push(JSON.stringify(pathwayProblems(c, T.skills))); }
  ok(diffQ.length === 0, `SQL kafaa_pw_problems equals pathwayProblems() on ${pCases.length} valid and malformed pathways${diffQ.length ? ` (${diffQ[0]})` : ''}`);
  const x0 = T.external_resources.find((x) => x.id === 'xr-elements-of-ai');
  const xCases = [...T.external_resources, { ...x0, url: 'http://x.org' }, { ...x0, provider_url: 'ftp://x' }, { ...x0, as_of: '2099-01-01' }, { ...x0, as_of: '2026-02-30' }, { ...x0, skills: [] },
    { ...x0, skills: [{ skill_id: 'sk-co-01', level: 1 }] }, { ...x0, skills: [{ skill_id: 'sk-fs-ai-use', level: 4 }] }, { ...x0, languages: ['xx'] }, { ...x0, languages: [] }, { ...x0, cost_band: 'cheap' },
    { ...x0, format: 'podcast' }, { ...x0, hours: 0 }, { ...x0, hours: null }, { ...x0, criteria: { relevance: 1, standing: 3, language: 2 } }, { ...x0, criteria: { relevance: 3, standing: 2 } },
    { ...x0, criteria: [] }, { ...x0, criteria: { relevance: 2.5, standing: 3, language: 2 } }, { ...x0, title_ar: '' }, {}];
  const diffX = [];
  for (const c of xCases) { const s = (await fq('select kafaa_xr_check($1::jsonb, $2::date) j', [JSON.stringify(c), TODAY]))[0].j; if (canon(s) !== canon(catalogueCheck(c, T.catalogue_criteria, T.skills, TODAY))) diffX.push(c.id ?? JSON.stringify(c).slice(0, 50)); }
  ok(diffX.length === 0, `SQL kafaa_xr_check equals catalogueCheck() on ${xCases.length} resources (seed + malformed)${diffX.length ? ` (${diffX[0]})` : ''}`);
  await fresh.close();

  // ── RLS (shared database)
  ok((await count(null, 'kafaa_pathways')) === 0 && (await count(null, 'kafaa_external_resources')) === 0 && (await count(null, 'kafaa_pathway_enrolments')) === 0, 'anonymous users read no pathway, resource or progress row');
  ok((await count('alnoor-gm', 'kafaa_pathways')) === 0 && (await count('alnoor-gm', 'kafaa_external_resources')) === 0, 'partner users read no pathway or external resource');
  ok((await count('sro', 'kafaa_pathways')) === pub.length && (await count('sro', 'kafaa_pathways', "status = 'draft'")) === 0, `staff read the ${pub.length} published pathways and no draft`);
  ok((await count('training-mgr', 'kafaa_pathways', "status = 'draft'")) >= 1 && (await count('k-auditor', 'kafaa_pathway_gaps')) === T.pathway_gaps.length, 'training staff see drafts; auditors and training staff read the gap backlog');
  ok((await count('sro', 'kafaa_pathway_gaps')) === 0, 'staff without training rights do not read the gap backlog');
  ok((await count('sro', 'kafaa_external_resources')) === T.external_resources.filter((x) => x.status === 'published').length, 'staff read published external resources only (drafts and retired items hidden)');
  ok((await count('sro', 'kafaa_pathway_enrolments', "person_id <> 'p-sro'")) === 0 && (await count('training-mgr', 'kafaa_pathway_enrolments', "person_id <> 'p-training-mgr'")) === 0, 'progress rows are private: nobody reads another person\'s pathway progress');

  // ── reads through the RPCs
  const cat = (await one('sro', 'select kafaa_pathway_catalogue() j')).j;
  ok(cat && cat.pathways.length === pub.length && cat.min_group === 10 && cat.pathways.every((p) => p.envelope_months >= 3 && p.weekly_hours > 0 && (p.peer.suppressed ? p.peer.median_weeks === null : p.peer.completed >= 10)), 'kafaa_pathway_catalogue: every published pathway with envelope, weekly hours and suppressed peer times');
  ok((await one(null, 'select 1 x').catch(() => null)) !== undefined, 'anon session sanity');
  let anonDenied = false;
  try { await as(null, 'select kafaa_pathway_catalogue()'); } catch { anonDenied = true; }
  ok(anonDenied, 'anonymous users cannot execute the pathway RPCs');
  ok((await one('alnoor-gm', 'select kafaa_pathway_catalogue() j')).j === null, 'partner users get no catalogue (internal_content)');

  // ── RPC flows
  const res = async (persona, sql, p = []) => (await one(persona, sql, p)).r;
  const audits = async () => Number((await db.query(`select count(*)::int n from kafaa_audit_events where action like 'pathway.%' or action like 'external.%'`)).rows[0].n);
  const a0 = await audits();
  ok((await res('sro', `select kafaa_save_pathway('{}'::jsonb) r`)).code === 'forbidden', 'only the training manager edits pathways (staff refused)');
  const inv = await res('training-mgr', 'select kafaa_save_pathway($1::jsonb) r', [JSON.stringify({ ...base, id: undefined, envelope_months: 9 })]);
  ok(inv.code === 'invalid' && inv.message.includes('envelope'), 'savePathway refuses an envelope outside 3-6 months');
  const okSave = await res('training-mgr', 'select kafaa_save_pathway($1::jsonb) r', [JSON.stringify({ ...base, id: base.id, status: 'published', title_en: `${base.title_en} (rev)` })]);
  ok(okSave.ok && okSave.data.version === 2, 'savePathway: an edit bumps the version and the new steps become current');
  ok((await db.query('select count(*)::int n from kafaa_pathway_steps where pathway_id = $1', [base.id])).rows[0].n === 6, 'earlier step versions are kept (never deleted)');
  const target = pub.find((p) => p.skill_id === 'sk-fs-gr-esg' && p.level === 1);
  const held = (await db.query(`select count(*)::int n from kafaa_person_skills where person_id = 'p-sro' and skill_id = $1 and active and level >= 1`, [target.skill_id])).rows[0].n;
  ok(held === 0, 'flow setup: the SRO does not hold the ESG skill');
  const r1 = await res('sro', 'select kafaa_start_pathway($1) r', [target.id]);
  ok(r1.ok && r1.data.status === 'active', 'startPathway: staff start a published pathway');
  ok((await res('sro', 'select kafaa_start_pathway($1) r', [target.id])).code === 'already', 'startPathway refuses a pathway already followed');
  ok((await res('sro', 'select kafaa_start_pathway($1) r', ['pw-ai-automation-l3'])).code === 'not_found', 'drafts cannot be started');
  ok((await res('sro', 'select kafaa_complete_pathway($1) r', [target.id])).code === 'steps_open', 'completePathway refuses while steps are open (progress is derived, never typed in)');
  // FS18: two new resources for the ESG skill (learn + assess, practice), the publish gate, then self-declared completions
  const xr = (o) => ({ title_ar: 'مورد اختبار', provider_en: 'Test University', provider_ar: 'جامعة الاختبار', provider_url: 'https://example.org', cost_band: 'free', languages: ['en'], as_of: TODAY,
    skills: [{ skill_id: 'sk-fs-gr-esg', level: 1 }], criteria: { relevance: 3, standing: 3, assessment: 2, language: 2 }, ...o });
  const s1 = await res('training-mgr', 'select kafaa_save_external_resource($1::jsonb) r', [JSON.stringify(xr({ title_en: 'ESG basics test course', url: 'https://example.org/esg', format: 'course', has_assessment: true, hours: 6 }))]);
  const s2 = await res('training-mgr', 'select kafaa_save_external_resource($1::jsonb) r', [JSON.stringify(xr({ title_en: 'ESG reporting placement test', url: 'https://example.org/esg2', format: 'programme', criteria: { relevance: 1, standing: 3, language: 2 } }))]);
  ok(s1.ok && s1.data.status === 'draft' && s1.data.id === 'xr-esg-basics-test-course' && s2.ok, 'saveExternalResource stores drafts (slug ids)');
  const pr = await res('training-mgr', 'select kafaa_publish_external_resource($1) r', [s2.data.id]);
  ok(pr.code === 'criteria_failed' && pr.message.includes('relevance'), 'acceptance: an item failing the criteria cannot be published (RPC refusal names the criterion)');
  ok((await res('training-mgr', 'select kafaa_publish_external_resource($1) r', ['xr-iaea-nuclear-security-elearning'])).code === 'criteria_failed', 'the seeded security e-learning draft is refused');
  await res('training-mgr', 'select kafaa_save_external_resource($1::jsonb) r', [JSON.stringify({ ...xr({ title_en: 'ESG reporting placement test', url: 'https://example.org/esg2', format: 'programme' }), id: s2.data.id })]);
  ok((await res('training-mgr', 'select kafaa_publish_external_resource($1) r', [s1.data.id])).ok && (await res('training-mgr', 'select kafaa_publish_external_resource($1) r', [s2.data.id])).ok, 'publishing succeeds once the criteria are met');
  ok((await res('sro', 'select kafaa_publish_external_resource($1) r', [s1.data.id])).code === 'forbidden', 'staff cannot publish');
  const ev0 = (await db.query(`select count(*)::int n from kafaa_skill_evidence where person_id = 'p-sro'`)).rows[0].n;
  const st0 = (await db.query(`select coalesce(string_agg(skill_id || ':' || level || ':' || basis, ',' order by skill_id), '') s from kafaa_person_skills where person_id = 'p-sro' and active`)).rows[0].s;
  ok((await res('sro', 'select kafaa_record_external_completion($1::jsonb) r', [JSON.stringify({ resource_id: s1.data.id, completed_on: '2099-01-01' })])).code === 'invalid', 'a completion date in the future is refused');
  const c1 = await res('sro', 'select kafaa_record_external_completion($1::jsonb) r', [JSON.stringify({ resource_id: s1.data.id, completed_on: TODAY, note: 'Done in two evenings' })]);
  const c2 = await res('sro', 'select kafaa_record_external_completion($1::jsonb) r', [JSON.stringify({ resource_id: s2.data.id, completed_on: TODAY })]);
  ok(c1.ok && c1.data.evidence === 'self_declared' && c2.ok, 'recordExternalCompletion stores a self-declared completion');
  ok((await res('sro', 'select kafaa_record_external_completion($1::jsonb) r', [JSON.stringify({ resource_id: s1.data.id, completed_on: TODAY })])).code === 'duplicate', 'one completion per person and resource');
  ok((await res('sro', 'select kafaa_record_external_completion($1::jsonb) r', [JSON.stringify({ resource_id: 'xr-iaea-nuclear-security-elearning', completed_on: TODAY })])).code === 'not_published', 'drafts cannot be recorded');
  const stmt = (await db.query('select * from kafaa_xapi_statements where id = $1', [c1.data.statement_id])).rows[0];
  ok(stmt && stmt.verb === 'experienced' && stmt.actor_person_id === 'p-sro' && stmt.stored_by === 'p-sro' && stmt.context.extensions['https://kafaa.example/xapi/ext/evidence'] === 'self-declared', 'the completion is an xAPI "experienced" statement labelled self-declared');
  const ev1 = (await db.query(`select count(*)::int n from kafaa_skill_evidence where person_id = 'p-sro'`)).rows[0].n;
  const st1 = (await db.query(`select coalesce(string_agg(skill_id || ':' || level || ':' || basis, ',' order by skill_id), '') s from kafaa_person_skills where person_id = 'p-sro' and active`)).rows[0].s;
  ok(ev1 === ev0 && st1 === st0, 'acceptance: self-declared completions never become skill evidence (evidence and skill states unchanged)');
  const det = (await one('sro', 'select kafaa_pathway_detail($1) j', [target.id])).j;
  ok(det.mine && det.mine.progress.complete && det.mine.progress.self_declared === 3 && det.resolved.steps.every((s) => s.items.some((i) => i.external)), 'progress: every step is done through the self-declared external items and labelled so');
  const done = await res('sro', 'select kafaa_complete_pathway($1) r', [target.id]);
  ok(done.ok && done.data.self_declared === 3, 'completePathway succeeds when every step is done and reports the self-declared steps');
  ok((await res('training-mgr', 'select kafaa_retire_external_resource($1, $2) r', [s2.data.id, 'x'])).code === 'invalid' && (await res('training-mgr', 'select kafaa_retire_external_resource($1, $2) r', [s2.data.id, 'Test resource retired'])).ok, 'retire needs a reason of 5-300 characters');
  const g = await res('training-mgr', 'select kafaa_refresh_pathway_gaps() r');
  ok(g.ok && g.data.filled >= 1, `refreshPathwayGaps: the ESG steps now resolve and leave the backlog (${g.data.filled} filled, ${g.data.open} open)`);
  ok((await res('sro', 'select kafaa_refresh_pathway_gaps() r')).code === 'forbidden', 'only the training manager refreshes the gap backlog');
  ok((await res('sro', 'select kafaa_withdraw_pathway($1, null) r', [target.id])).code === 'not_active', 'withdrawPathway needs an active pathway');
  ok((await audits()) - a0 >= 20, 'every write, including refusals, wrote an audit row');
  ok((await db.query(`select count(*)::int n from ledger_entries where reason like '%pathway%'`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n === 0, 'no NEXUS ledger rows');
  let helper = false;
  try { await as('k-admin', `select kafaa_pw_resolve('pw-ai-use-l1')`); } catch { helper = true; }
  ok(helper, 'resolver and check helpers are not executable by API roles');
  void uid;
}
