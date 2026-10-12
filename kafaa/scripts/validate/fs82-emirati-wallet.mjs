// [FS wave H · E2 · FS73 + FS74] PGlite checks for 20261010282001_kafaa_fs82_emirati_wallet.sql (National Alignment, M37).
// Seed (the SIMULATED pipeline mirror and the wallet target load unchanged; the wallet target is tagged to two national strategies);
// SQL = TS parity on the database state (kafaa_ep_add_months, kafaa_ep_roles, kafaa_ep_core for every scope, kafaa_fw_status for every
// active staff member, kafaa_fw_counter_core, kafaa_fw_target_problem, kafaa_fw_items, and the five redefined FS62 functions with the
// wallet target), also after generated edits inside a rolled-back transaction; acceptance (every cell under 10 suppressed, concept roles
// never enter, the page's RPC refused to observers, partners and managers, nationality only inside the aggregate, wallet status from
// evidence only, the target is a leadership setting with who and when); RLS; the five RPCs (refusals, audit, ledger, plan writes);
// grants; the migration is additive. Prints the md5 of every new or redefined function body and the digest of every new table.
import { readFileSync } from 'node:fs';
import { addMonths, emiratiPipeline, pipelineRoles, pipelineWorldFrom, EP_MIN } from '../../src/modules/m37/pipeline.ts';
import { ITEM_PLAN_KIND, ITEM_TITLE, WALLET_ITEMS, planActivityId, targetProblem, walletCounter, walletStatus, walletWorld } from '../../src/modules/m37/wallet.ts';
import { effectiveLinks, measureOf, nationalReport, targetView, worldFrom, TARGET_TABLES } from '../../src/modules/m37/national.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const NEW = ['pipeline_mirror', 'wallet_targets'];
const FUNCS = ['kafaa_ep_add_months', 'kafaa_ep_allowed', 'kafaa_ep_roles', 'kafaa_ep_area', 'kafaa_ep_core', 'kafaa_fw_items', 'kafaa_fw_status', 'kafaa_fw_target_view', 'kafaa_fw_counter_core',
  'kafaa_fw_target_problem', 'kafaa_emirati_pipeline', 'kafaa_my_future_wallet', 'kafaa_future_wallet_counter', 'kafaa_set_wallet_target', 'kafaa_add_wallet_to_plan',
  'kafaa_na_target', 'kafaa_na_link_problem', 'kafaa_na_links', 'kafaa_na_measure', 'kafaa_na_report_core'];
const RPCS = ['kafaa_add_wallet_to_plan', 'kafaa_emirati_pipeline', 'kafaa_future_wallet_counter', 'kafaa_my_future_wallet', 'kafaa_set_wallet_target'];
const EP = ['people', 'job_roles', 'job_families', 'role_outlook_labels', 'succession_slates', 'successors', 'pipeline_mirror'];
const FW = ['people', 'person_skills', 'microcred_awards', 'ai_rungs', 'ai_skill_tracks', 'cec_competences', 'core_skills', 'wallet_targets'];
const NA = ['national_tags', 'tag_links', 'skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills',
  'ai_org_targets', 'cec_role_targets', 'job_families', 'people', 'person_skills', 'courses', 'enrolments', 'training_records', 'pathway_enrolments', 'microcred_awards', 'applications',
  'leadership_nominations', 'ai_rungs', 'ai_skill_tracks', 'wallet_targets', 'core_skills'];

/** Every people count in a pipeline result (successor, ready-by, progression and retention cells); role counts and shares are not people. */
const peopleCells = (ep) => [ep.total, ...ep.areas].flatMap((a) => [a.successors.emirati, a.successors.all, ...Object.values(a.successors.bands), ...a.ready_by.map((x) => x.n),
  a.progression.emirati, a.progression.all, ...a.progression.by_year.map((x) => x.n), ...a.retention.flatMap((x) => [x.cohort, x.retained])]);

export default async function fs82Checks({ db, as, one, count, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave H · E2 · FS73 Emirati pipeline by competency + FS74 Future Skills Wallet target (M37)');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/_at$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : typeof v === 'string' && /^-?\d+\.\d+$/.test(v) ? Number(v) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);
  const load = async (list) => { const D = {}; for (const t of list) D[t] = await rows(t); return (n) => D[n] ?? []; };
  const today = (await q(`select to_char(current_date, 'YYYY-MM-DD') d`))[0].d;
  const audits = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const ledgers = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  // test identities used here beyond the shared ones (a manager, an employee, an auditor role card)
  let n = 8200;
  for (const persona of ['nse', 'presenter']) {
    if (uid[persona]) continue;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,'enec-ops','employee',$4) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, [persona]]);
  }

  // ── seed
  const byId = (a) => [...a].sort((x, y) => (x.id < y.id ? -1 : 1));
  const D = {}; for (const t of NEW) D[t] = await rows(t);
  ok(NEW.every((t) => D[t].length === S[t].length && same(D[t].map((r) => r.id), byId(S[t]).map((r) => r.id)))
    && same(D.pipeline_mirror.map((r) => [r.id, r.nationality_flag, r.hired_on, r.left_on, r.authorised_on]), byId(S.pipeline_mirror).map((r) => [r.id, r.nationality_flag, r.hired_on, r.left_on, r.authorised_on]))
    && D.wallet_targets.length === 1 && D.wallet_targets[0].pct === 60 && D.wallet_targets[0].due_on === '2027-12-31' && D.wallet_targets[0].set_by === 'p-chco',
    `seed: ${D.pipeline_mirror.length} SIMULATED mirror spells and the wallet target (60 % by 2027-12-31, set by the HR director role card) load unchanged`);
  ok(D.pipeline_mirror.every((r) => r.simulated === true && r.open_read === false && r.source === 'SIMULATED HR mirror')
    && !(await q(`select column_name from information_schema.columns where table_name = 'kafaa_pipeline_mirror' and column_name in ('person_id', 'name', 'display_name', 'gender', 'age')`)).length,
    'FS73 mirror: every row is SIMULATED, de-identified (no person id, name, gender or age column) and closed to direct reads');

  // ── FS73: SQL = TS
  const monthCases = ['2024-01-31', '2024-02-29', '2023-01-31', '2026-10-12', '2025-12-31', '2026-03-31', '2016-08-30'];
  const amSql = (await q('select to_char(kafaa_ep_add_months(d::date, n), \'YYYY-MM-DD\') r from unnest($1::text[]) d cross join unnest(array[1, 12, 24, 36, -36, -1, 13]) n order by d, n', [monthCases])).map((r) => r.r);
  const amTs = [...monthCases].sort().flatMap((d) => [-36, -1, 1, 12, 13, 24, 36].map((k) => addMonths(d, k)));
  ok(same(amSql, amTs), `SQL kafaa_ep_add_months = addMonths on ${amTs.length} cases (month ends and leap years clamp the same way)`);
  const scopes = ['all', 'critical', 'future', 'bogus', null];
  const parity = async (label) => {
    const W = pipelineWorldFrom(await load(EP));
    const rolesOk = same((await q('select kafaa_ep_roles() j'))[0].j, pipelineRoles(W));
    const diffs = [];
    for (const s of scopes) if (!same((await q('select kafaa_ep_core($1, current_date) j', [s]))[0].j, emiratiPipeline(W, s, today))) diffs.push(String(s));
    ok(rolesOk && !diffs.length, `SQL kafaa_ep_roles / kafaa_ep_core = pipelineRoles / emiratiPipeline for ${scopes.length} scopes (${label})${diffs.length ? ` (diff ${diffs[0]})` : ''}`);
    return W;
  };
  const W1 = await parity('seed');
  const ep = emiratiPipeline(W1, 'all', today);
  const roleRows = await rows('job_roles');
  ok(ep.roles.length >= 10 && ep.roles.every((r) => roleRows.find((j) => j.id === r.role_id)?.lifecycle === 'current' && !roleRows.find((j) => j.id === r.role_id)?.security_sensitive)
    && ep.roles.some((r) => r.critical) && ep.roles.some((r) => r.future && !r.critical),
    `FS73: ${ep.roles.length} critical and future roles (critical, or a growing FS16 outlook); concept and security-sensitive roles never enter`);
  const cells = scopes.slice(0, 3).flatMap((s) => peopleCells(emiratiPipeline(W1, s, today)));
  ok(cells.every((v) => v === null || v >= EP_MIN) && cells.some((v) => v === null) && cells.some((v) => v !== null)
    && [ep.total, ...ep.areas].every((a) => (a.successors.share_pct === null || (a.successors.emirati !== null && a.successors.all !== null)) && a.retention.every((x) => x.pct === null || (x.cohort !== null && x.retained !== null))),
    `acceptance FS73: every cell under 10 is suppressed (${cells.filter((v) => v === null).length} of ${cells.length} people cells null, the rest 10 or more; a share only beside its count and base)`);
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      update kafaa_people set nationality_flag = 'uae' where id in (select person_id from kafaa_successors where person_id is not null order by id limit 4);
      update kafaa_successors set months = null where id in (select id from kafaa_successors where readiness <> 'ready_now' order by id limit 3);
      update kafaa_successors set status = 'withdrawn' where id in (select id from kafaa_successors order by id desc limit 2);
      update kafaa_role_outlook_labels set label = 'growing' where id in (select id from kafaa_role_outlook_labels where not archived and label <> 'growing' order by id limit 2);
      insert into kafaa_succession_slates (id, role_id, period, status, critical, leadership, incumbent_en, incumbent_ar, target_bench, listed, sort)
        select 'ss-x-concept', id, '2026-H2', 'draft', true, false, 'x', 'x', 2, true, 99 from kafaa_job_roles where lifecycle = 'concept' order by id limit 1;
      insert into kafaa_successors (id, slate_id, person_id, cover_source, readiness, months, status, proposed_at)
        select 'sx-x-concept-' || p.id, 'ss-x-concept', p.id, 'internal', 'ready_now', 0, 'confirmed', now() from kafaa_people p where p.kind = 'staff' and p.nationality_flag = 'uae' order by p.id limit 12;
      insert into kafaa_pipeline_mirror (id, role_id, nationality_flag, hired_on, left_on, authorised_on)
        select 'epm-x-' || g, 'shift-supervisor', case when g % 3 = 0 then 'other' else 'uae' end, date '2021-01-31' + (g * 17), case when g % 4 = 0 then date '2024-02-29' + g end, case when g % 5 = 0 then date '2023-03-31' + g end
        from generate_series(1, 9) g;`);
    const W2 = await parity('generated edits: nationality changes, missing month estimates, withdrawn successors, new growing outlooks, a slate on a concept role, small mirror groups');
    const ep2 = emiratiPipeline(W2, 'all', today);
    const c2 = peopleCells(ep2);
    ok(!ep2.roles.some((r) => roleRows.find((j) => j.id === r.role_id)?.lifecycle !== 'current') && c2.every((v) => v === null || v >= EP_MIN),
      'acceptance FS73: a slate on a concept role never enters (QA_A gap: M23 reads audited here) and small mirror groups stay suppressed after the edits');
  } finally { await db.exec('rollback'); }

  // ── FS73 access
  const allowed = {}; for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'presenter']) allowed[p] = (await one(p, 'select kafaa_emirati_pipeline($1) r', ['all'])).r;
  const refused = {}; for (const p of ['k-observer', 'alnoor-gm', 'gulfhydro-qa', 'k-university', 'sro', 'training-mgr', 'nse', 'k-admin']) refused[p] = (await one(p, 'select kafaa_emirati_pipeline() r')).r;
  let anonEp = false; try { await as(null, `select kafaa_emirati_pipeline('all')`); } catch { anonEp = true; }
  const a0 = await audits(); await one('chco', `select kafaa_emirati_pipeline('critical') r`);
  const coreAll = (await q(`select kafaa_ep_core('all', current_date) j`))[0].j;
  ok(Object.values(allowed).every((r) => r && same(r, coreAll)) && Object.values(refused).every((r) => r === null) && anonEp && (await audits()) === a0 && !JSON.stringify(coreAll).includes('"p-') && !JSON.stringify(coreAll).includes('"w-'),
    'acceptance FS73: HR analyst, HR director and auditors read the pipeline; observers, partners (admin and user), universities, managers, the training manager, employees and platform admins get null; anonymous cannot execute; reads are not audited and carry no person ids');
  const scoring = (await q(`select coalesce(array_agg(distinct f), '{}') f from kafaa_engine_cards c, unnest(c.scoring_functions) f where f like 'sql:%'`))[0].f;
  const bodies = await q(`select proname, prosrc from pg_proc where proname = any($1)`, [FUNCS]);
  ok(!scoring.some((f) => /kafaa_(ep|fw)_|emirati|wallet/.test(f)) && bodies.filter((b) => /nationality_flag/.test(b.prosrc)).map((b) => b.proname).sort().join(',') === 'kafaa_ep_area'
    && bodies.every((b) => !/\bgender\b|birth_date/.test(b.prosrc)),
    'acceptance FS73: nationality is read only inside the suppressed aggregate (kafaa_ep_area); no engine card scores with an FS73/FS74 function; no function reads gender or age');

  // ── FS74: SQL = TS
  const wParity = async (label) => {
    const raw = await load(FW);
    const ww = walletWorld(raw);
    const staff = raw('people').filter((p) => p.kind === 'staff' && p.status === 'active');
    const st = await q(`select p.id, kafaa_fw_status(p.id, current_date) j from kafaa_people p where p.kind = 'staff' and p.status = 'active' order by p.id`);
    const diffs = st.filter((r) => !same(r.j, walletStatus(r.id, ww.inputsFor(r.id), today))).map((r) => r.id);
    const counter = (await q('select kafaa_fw_counter_core(current_date) j'))[0].j;
    ok(!diffs.length && st.length === staff.length && same(counter, walletCounter(ww, today)),
      `SQL kafaa_fw_status / kafaa_fw_counter_core = walletStatus / walletCounter for all ${st.length} active staff (${label})${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
    return { ww, counter };
  };
  const { ww: ww1, counter: c1 } = await wParity('seed');
  ok(c1.staff >= 10 && c1.target && c1.target.pct === 60 && c1.target.due_on === '2027-12-31' && c1.target.set_by === 'p-chco' && /role card/.test(c1.target.set_by_name_en) && c1.target.set_at
    && c1.items.every((i) => i.n === null || i.n >= 10) && c1.distribution.every((d) => d.n === null || d.n >= 10) && c1.families.every((f) => [f.staff, f.complete].every((v) => v === null || v >= 10))
    && !c1.families.some((f) => ['security', 'safeguards', 'cyber'].includes(f.family_id)),
    `acceptance FS74: the counter shows its target (${c1.target?.pct} % by ${c1.target?.due_on}) with who set it (${c1.target?.set_by_name_en}) and when (${c1.target?.set_at}); every count under 10 suppressed; security, safeguards and cyber never broken out`);
  await db.exec('begin');
  try {
    const pid = (await q(`select s.person_id from kafaa_person_skills s join kafaa_people p on p.id = s.person_id where p.kind = 'staff' and p.status = 'active' and s.active
      and s.skill_id = 'sk-da-01' and s.basis in ('verified', 'evidenced', 'validated') order by s.person_id limit 1`))[0]?.person_id;
    const other = (await q(`select p.id from kafaa_people p where p.kind = 'staff' and p.status = 'active' and not exists (select 1 from kafaa_person_skills s where s.person_id = p.id and s.skill_id = 'sk-da-01' and s.active) order by p.id limit 1`))[0].id;
    const before = (await q('select kafaa_fw_status($1, current_date) j', [other]))[0].j;
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis, active) values ('ps:${other}:sk-da-01', '${other}', 'sk-da-01', 4, 0.4, 'claimed', true) on conflict (id) do update set level = 4, basis = 'claimed', active = true;
      update kafaa_person_skills set basis = 'claimed' where person_id = '${pid}' and skill_id = 'sk-da-01';
      update kafaa_microcred_awards set valid_to = current_date - 1 where id in (select id from kafaa_microcred_awards where def_code = 'MC-CYBER-HYGIENE' and status = 'awarded' order by id limit 3);
      update kafaa_microcred_awards set status = 'revoked' where id in (select id from kafaa_microcred_awards where def_code = 'MC-CYBER-HYGIENE' and status = 'awarded' order by id desc limit 2);
      update kafaa_person_skills set basis = 'claimed' where id in (select id from kafaa_person_skills where active and skill_id like 'sk-fs-ai-%' order by id limit 12);
      update kafaa_core_skills set status = 'retired' where id in (select id from kafaa_core_skills order by id limit 2);`);
    const after = (await q('select kafaa_fw_status($1, current_date) j', [other]))[0].j;
    const lost = (await q('select kafaa_fw_status($1, current_date) j', [pid]))[0].j;
    await wParity('generated edits: a high self-rating, claimed plant-data states, expired and revoked cyber awards, claimed AI states, retired core skills');
    ok(before.items[2].met === false && after.items[2].met === false && lost.items[2].met === false,
      'acceptance FS74: wallet status is computed from evidence only: a level-4 self-rating does not earn plant-data basics, and a state that becomes self-claimed no longer counts');
  } finally { await db.exec('rollback'); }
  const tCases = [
    { pct: 60, due_on: '2027-12-31', note_en: 'A leadership decision for the demo.', note_ar: 'قرار قيادي للعرض التوضيحي هنا.' },
    { pct: 0, due_on: '2027-12-31', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' }, { pct: 60.5, due_on: '2027-12-31', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' },
    { pct: '60', due_on: '2027-12-31', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' }, { pct: 101, due_on: '2027-12-31', note_en: 'x', note_ar: 'x' },
    { pct: 60, due_on: '2027-02-30', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' }, { pct: 60, due_on: today, note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' },
    { pct: 60, due_on: '2036-01-01', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' }, { pct: 60, due_on: '27-12-31', note_en: 'A leadership decision.', note_ar: 'قرار قيادي للعرض.' },
    { pct: 60, due_on: '2027-12-31', note_en: 'short', note_ar: 'قرار قيادي للعرض.' }, { pct: 60, due_on: '2027-12-31', note_en: 'A leadership decision.', note_ar: '' },
    { pct: 60, due_on: '2027-12-31', note_en: 'Covers a headcount of all staff on site.', note_ar: 'قرار قيادي للعرض.' }, {}, { due_on: '2027-12-31' },
  ];
  const tpSql = (await q('select kafaa_fw_target_problem(x, current_date) p from jsonb_array_elements($1::jsonb) x', [JSON.stringify(tCases)])).map((r) => r.p);
  const items = (await q('select kafaa_fw_items() j'))[0].j;
  ok(same(tpSql, tCases.map((c) => targetProblem(c, today))) && tpSql[0] === null && new Set(tpSql.filter(Boolean)).size >= 4
    && same(items, WALLET_ITEMS.map((k) => ({ key: k, kind: ITEM_PLAN_KIND[k], title_en: ITEM_TITLE[k].en, title_ar: ITEM_TITLE[k].ar }))),
    `SQL kafaa_fw_target_problem / kafaa_fw_items = targetProblem / ITEM_TITLE and ITEM_PLAN_KIND (${tCases.length} cases, ${new Set(tpSql.filter(Boolean)).size} problem codes)`);

  // ── FS62 hand-off: the wallet target in the national-alignment layer
  const NW = worldFrom(await load(NA));
  const tvOk = same((await q(`select kafaa_na_target('wallet_targets', 'wt-core-five') v`))[0].v, targetView(NW, 'wallet_targets', 'wt-core-five'));
  const effOk = same((await q('select kafaa_na_links() j'))[0].j, effectiveLinks(NW));
  const filters = [{}, { tag_id: 'nt-jahiz' }, { tag_id: 'nt-ai-2031' }, { kind: 'target' }, { strategy: 'jahiz', kind: 'target' }];
  const repDiffs = [];
  for (const f of filters) for (const m of [true, false]) if (!same((await q('select kafaa_na_report_core($1::jsonb, $2) j', [JSON.stringify(f), m]))[0].j, nationalReport(NW, f, m))) repDiffs.push(`${JSON.stringify(f)}/${m}`);
  const meas = (await q(`select kafaa_na_measure('wallet_targets', 'wt-core-five') m`))[0].m;
  const rep = nationalReport(NW, { kind: 'target' }, true);
  const linkOk = (await q(`select kafaa_na_link_problem('{"tag_id":"nt-nes-2031","target_table":"wallet_targets","target_id":"wt-core-five","active":true,"note_en":"A test link to the wallet.","note_ar":"رابط اختبار إلى المحفظة."}'::jsonb,
    (select t from kafaa_national_tags t where id = 'nt-nes-2031'), kafaa_na_target('wallet_targets', 'wt-core-five'), true) p`))[0].p === null;
  ok(TARGET_TABLES.wallet_targets?.kind === 'target' && tvOk && effOk && !repDiffs.length && linkOk
    && rep.items.filter((i) => i.target_table === 'wallet_targets').map((i) => i.tag_id).sort().join(',') === 'nt-ai-2031,nt-jahiz' && meas.kind === 'wallet_share' && meas.target === 60 && meas.due_on === '2027-12-31'
    && (meas.n === null || meas.n >= 10),
    `wiring FS62 <- FS74: the wallet target is a target table (SQL kafaa_na_target / kafaa_na_links / kafaa_na_report_core / kafaa_na_link_problem = TS), tagged to Jahiz and the AI strategy, measured as the suppressed wallet share against ${meas.target} % by ${meas.due_on}${repDiffs.length ? ` (diff ${repDiffs[0]})` : ''}`);

  // ── RLS
  const seen = {};
  for (const p of [null, 'sro', 'nse', 'k-auditor', 'chco', 'k-hr-analyst', 'k-admin', 'alnoor-gm', 'k-university', 'k-observer']) seen[p ?? 'anon'] = await Promise.all(NEW.map((t) => count(p, `kafaa_${t}`)));
  ok(Object.values(seen).every((v) => v[0] === 0) && ['sro', 'nse', 'k-auditor', 'chco', 'k-hr-analyst', 'k-admin'].every((p) => seen[p][1] === 1) && ['anon', 'alnoor-gm', 'k-university', 'k-observer'].every((p) => seen[p][1] === 0),
    `RLS: nobody reads a mirror row directly (only the aggregate RPC); staff, HR, admins and auditors read the wallet target (national_alignment R); anonymous, partners, universities and observers read nothing (${JSON.stringify(seen)})`);
  let direct = false;
  try { await as('chco', `update kafaa_wallet_targets set pct = 10 where id = 'wt-core-five'`); direct = (await q(`select pct from kafaa_wallet_targets where id = 'wt-core-five'`))[0].pct === 60; } catch { direct = true; }
  ok(direct, 'the wallet target cannot be written through the API, only through setWalletTarget');

  // ── RPCs (inside a rolled-back transaction)
  const mine = (await one('nse', 'select kafaa_my_future_wallet() r')).r;
  const raw1 = await load(FW);
  const nulls = [(await one('alnoor-gm', 'select kafaa_my_future_wallet() r')).r, (await one('k-observer', 'select kafaa_my_future_wallet() r')).r, (await one('k-auditor', 'select kafaa_my_future_wallet() r')).r];
  ok(mine && mine.person_id === 'p-nse' && same(mine.status, walletStatus('p-nse', walletWorld(raw1).inputsFor('p-nse'), today)) && mine.target?.id === 'wt-core-five' && nulls.every((x) => x === null),
    'kafaa_my_future_wallet: an employee reads their own wallet (= walletStatus) with the target; partners, observers and auditors (no skills_profile Own) get null');
  const cnt = { chco: (await one('chco', 'select kafaa_future_wallet_counter() r')).r, hra: (await one('k-hr-analyst', 'select kafaa_future_wallet_counter() r')).r, adm: (await one('k-admin', 'select kafaa_future_wallet_counter() r')).r };
  const cntNo = [(await one('sro', 'select kafaa_future_wallet_counter() r')).r, (await one('k-auditor', 'select kafaa_future_wallet_counter() r')).r, (await one('k-observer', 'select kafaa_future_wallet_counter() r')).r];
  ok(Object.values(cnt).every((c) => c && same(c, c1)) && cntNo.every((x) => x === null), 'kafaa_future_wallet_counter: HR analyst, HR director and admins (national_alignment Agg/W/A) read the counter; staff, auditors and observers get null');
  await db.exec('begin');
  try {
    const A = await audits(); const L = await ledgers();
    const set = (p, x) => one(p, 'select kafaa_set_wallet_target($1::jsonb) r', [JSON.stringify(x)]);
    const good = { pct: 65, due_on: '2028-06-30', note_en: 'Leadership raised the demo target after the wave H review.', note_ar: 'رفعت القيادة هدف العرض التوضيحي بعد مراجعة الموجة.' };
    const r1 = (await set('sro', good)).r; const r2 = (await set('k-hr-analyst', good)).r; const r3 = (await set('k-admin', good)).r;
    const r4 = (await set('chco', { ...good, pct: 0 })).r; const r5 = (await set('chco', { ...good, pct: 60, due_on: '2027-12-31' })).r;
    const r6 = (await set('chco', good)).r;
    const row = (await rows('wallet_targets'))[0];
    const tv = (await one('chco', 'select kafaa_future_wallet_counter() r')).r.target;
    ok(!r1.ok && r1.code === 'forbidden' && !r2.ok && r2.code === 'forbidden' && !r3.ok && r3.code === 'forbidden' && !r4.ok && r4.code === 'invalid' && /percentage/.test(r4.message)
      && !r5.ok && r5.code === 'unchanged' && r6.ok && r6.data.version === 2 && row.pct === 65 && row.due_on === '2028-06-30' && row.history.length === 1 && row.history[0].pct === 60
      && row.history[0].set_by === 'p-chco' && row.history[0].set_at === '2026-10-05T09:00:00Z' && tv.pct === 65 && tv.version === 2 && tv.set_by === 'p-chco' && tv.set_at.startsWith(today)
      && (await audits()) === A + 6 && (await ledgers()) === L + 1,
      'acceptance FS74 (kafaa_set_wallet_target): the target date and value are a leadership setting: staff, the HR analyst and platform admins refused, a bad value or an unchanged target refused; the HR director sets it (version 2, the earlier setting kept in history with who and when, ledger); every call audited');
    // plan: nse (employee) and an auditor
    const before = (await q(`select count(*)::int n from kafaa_plan_activities where person_id = 'p-nse'`))[0].n;
    const p1 = (await one('nse', 'select kafaa_add_wallet_to_plan() r')).r;
    const p2 = (await one('nse', 'select kafaa_add_wallet_to_plan() r')).r;
    const acts = await q(`select * from kafaa_plan_activities where person_id = 'p-nse' and id like 'pa-fs74-%' order by id`);
    const open = mine.status.items.filter((i) => !i.met).map((i) => i.key);
    const pa = (await one('k-auditor', 'select kafaa_add_wallet_to_plan() r')).r;
    const pb = (await one('alnoor-gm', 'select kafaa_add_wallet_to_plan() r')).r;
    const back = (await one('nse', 'select kafaa_my_future_wallet() r')).r;
    ok(p1.ok && p1.data.created === open.length && p2.ok && p2.data.created === 0 && p2.data.existing === open.length && acts.length === open.length
      && acts.every((a) => a.plan_id === p1.data.plan_id && a.status === 'planned' && a.due_on && a.title_ar) && acts.map((a) => a.id).sort().join(',') === open.map((k) => planActivityId('p-nse', k)).sort().join(',')
      && (await q(`select count(*)::int n from kafaa_plan_activities where person_id = 'p-nse'`))[0].n === before + open.length && !pa.ok && pa.code === 'forbidden' && !pb.ok && pb.code === 'forbidden'
      && open.every((k) => back.in_plan[k] === 'planned') && back.plan?.id === p1.data.plan_id,
      `acceptance FS74 (kafaa_add_wallet_to_plan): the wallet links to the development plan: ${open.length} open items become plan activities (${p1.data.plan_created ? 'a draft plan is created' : 'in the open plan'}), never twice; auditors and partners refused; the wallet shows them as in the plan`);
  } finally { await db.exec('rollback'); }

  // ── grants
  const grants = await q(`select routine_name, grantee from information_schema.routine_privileges where routine_name = any($1) and grantee in ('anon', 'authenticated') order by 1, 2`, [FUNCS]);
  let internal = 0;
  for (const f of [`kafaa_ep_core('all', current_date)`, `kafaa_ep_roles()`, `kafaa_fw_status('p-nse', current_date)`, `kafaa_fw_counter_core(current_date)`, `kafaa_fw_target_view()`, `kafaa_na_measure('wallet_targets', 'wt-core-five')`]) {
    try { await as('chco', `select ${f}`); } catch { internal++; }
  }
  ok(internal === 6 && same(grants.map((g) => `${g.routine_name}:${g.grantee}`), RPCS.map((r) => `${r}:authenticated`)),
    `internal rules are not executable by API roles; authenticated executes only the five RPCs, anon none (${grants.map((g) => g.routine_name).join(', ')})`);

  // ── additive migration
  const sql = readFileSync('supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql', 'utf8');
  const created = [...sql.matchAll(/create (?:table if not exists|or replace function|(?:unique )?index if not exists|trigger) (\w+)/g)].map((m) => m[1]);
  const altered = [...sql.matchAll(/alter (?:table|policy \w+ on) (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && created.every((x) => x.startsWith('kafaa_')) && altered.every((x) => x.startsWith('kafaa_')) && !/\binsert into (?!kafaa_)|\bupdate (?!kafaa_)\w+ set\b/i.test(sql),
    `the migration is additive: ${created.length} kafaa_* objects created or redefined, no removal words, writes and alters only kafaa_* objects (inside the RPCs)`);

  // ── digests for the live comparison
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  console.log(`    fs82 function md5: ${md5.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const t of [...NEW, 'tag_links']) {
    const d = (await q(`select count(*)::int n, left(md5(coalesce(string_agg(t.id, '|' order by t.id), '')), 8) ids, left(md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')), 8) rws from kafaa_${t} t`))[0];
    console.log(`    fs82 digest kafaa_${t}: ${d.n} rows, ids ${d.ids}, rows ${d.rws}`);
  }
  const pa = (await q(`select count(*)::int n, left(md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')), 8) rws from kafaa_plan_activities t where id like 'pa-fs74-%'`))[0];
  console.log(`    fs82 digest kafaa_plan_activities (pa-fs74-*): ${pa.n} rows, rows ${pa.rws}`);
  void ww1;
}
