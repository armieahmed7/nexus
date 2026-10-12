// [FS wave H · E1 · FS70 + FS71 + FS72] PGlite checks for 20261010281001_kafaa_fs81_skill_signals.sql (M28 Skills Intelligence).
// Seed (4 published Skills on the Rise lists, 24 manager-pulse answers, 18 generic technologies with their tags and 2 published badge
// quarters, every active staff member's suggestions on 2026-10-11 with three earlier answers, the surface's fairness snapshot and its
// engine card); SQL = TS parity on the database state: kafaa_rs_compute = risingSkills for every quarter 2025-Q1..2026-Q4 and malformed
// ones, kafaa_rs_bounds / kafaa_rs_prev, kafaa_mp_summary = pulseSummary (incl. 9 vs 10 responses), kafaa_ht_brand_hits = brandHits,
// kafaa_ht_problem = techProblem, kafaa_ht_compute = technologyBadges, kafaa_ssg_candidates = inferSuggestions for every active staff
// member on three days (incl. the 180-day boundary), kafaa_ssg_fairness_compute = suggestionFairness; the stored rows equal the rules;
// suppression; RLS (no suggestion readable by a manager or anyone but the person); the twelve RPCs with RBAC, audit and ledger rows (flows
// inside a rolled-back transaction); check constraints; grants; additivity. Prints the md5 of every new function body and every new table's
// digest (for the live comparison).
import { readFileSync } from 'node:fs';
import { FIRST_QUARTER, MIN_SIGNAL, RS_MSG, prevQuarter, pulseSummary, quarterBounds, risingSkills, signalInputFromTables } from '../../src/modules/m28/signals.ts';
import { BRAND_DENY, HT_MSG, HT_PROBLEM_TEXT, badgeInputFromTables, brandHits, techProblem, technologyBadges } from '../../src/modules/m28/technologies.ts';
import { SSG_MSG, inferSuggestions, ssgWorldFromTables } from '../../src/modules/m28/suggestions.ts';
import { suggestionFairness } from '../../src/modules/m28/suggestFairness.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const MIG = 'supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql';
const TABLES = ['skill_signal_runs', 'skill_signals', 'manager_pulse', 'technologies', 'technology_links', 'technology_badges', 'skill_suggestions', 'skill_suggestion_fairness'];
const FUNCS = ['kafaa_fs81_msg', 'kafaa_rs_bounds', 'kafaa_rs_prev', 'kafaa_rs_computable', 'kafaa_rs_closed', 'kafaa_rs_counts', 'kafaa_rs_compute', 'kafaa_mp_median', 'kafaa_mp_summary',
  'kafaa_compute_skill_signals', 'kafaa_publish_skill_signals', 'kafaa_submit_manager_pulse', 'kafaa_manager_pulse_summary', 'kafaa_ht_brand_hits', 'kafaa_ht_len', 'kafaa_ht_text',
  'kafaa_ht_problem', 'kafaa_ht_window', 'kafaa_ht_compute', 'kafaa_save_technology', 'kafaa_tag_technology', 'kafaa_compute_technology_badges', 'kafaa_publish_technology_badges',
  'kafaa_ssg_candidates', 'kafaa_ssg_fairness_compute', 'kafaa_refresh_skill_suggestions', 'kafaa_respond_suggestion', 'kafaa_run_suggestion_fairness', 'kafaa_suggestion_stats'];
const RPCS = ["kafaa_compute_skill_signals('2026-Q3')", "kafaa_publish_skill_signals('2026-Q3', '', '')", "kafaa_submit_manager_pulse('{}'::jsonb)", 'kafaa_manager_pulse_summary(2026)',
  "kafaa_save_technology('{}'::jsonb)", "kafaa_tag_technology('{}'::jsonb)", "kafaa_compute_technology_badges('2026-Q3')", "kafaa_publish_technology_badges('2026-Q3')",
  'kafaa_refresh_skill_suggestions()', "kafaa_respond_suggestion('x', 'confirm')", 'kafaa_run_suggestion_fairness(null)', 'kafaa_suggestion_stats()'];
const INPUT_TABLES = ['skills', 'people', 'skill_evidence', 'skill_goals', 'opportunities', 'role_profile_versions', 'job_roles', 'person_skills', 'xapi_statements', 'sim_scenarios',
  'knowledge_assets', 'opportunity_applications', 'contributions', 'skill_suggestions', 'technologies', 'technology_links', 'manager_pulse'];
const QUARTERS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'];
const DAY = '2026-10-11';

export default async function fs81Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  console.log('FS wave H · E1 · FS70 ENEC Skills on the Rise + FS71 hot technologies + FS72 skills you may have (M28)');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const q1 = async (sql, p = []) => (await q(sql, p))[0];
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/(_at|^ts)$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const dbRows = async () => { const D = {}; for (const t of INPUT_TABLES) D[t] = (await q(`select * from kafaa_${t} order by id`)).map(fix); return D; };
  let k = 0;
  for (const [persona, roles] of [['k-ro', ['Reactor Operator']], ['buyer', ['Buyer']], ['ops-ceo', ['CEO, Operations']]]) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-0000000081${String(++k).padStart(2, '0')}`;
    await q('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', roles]);
  }

  // ── seed sanity and acceptance on the seed
  const runs = T.skill_signal_runs, sig = T.skill_signals, techs = T.technologies, badges = T.technology_badges, sug = T.skill_suggestions;
  ok(runs.length === 4 && ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'].every((x) => runs.some((r) => r.quarter === x)) && sig.length > 10 && sig.every((r) => runs.some((x) => x.id === r.run_id)),
    `seed: ${runs.length} published Skills on the Rise lists (${sig.length} listed skills), one per ended quarter`);
  ok(sig.every((r) => r.moved_by.length > 0 && r.reasons.length >= r.moved_by.length && r.moved_by.every((m) => r.signals.find((c) => c.key === m)?.moved === true)),
    'acceptance (FS70): each listed skill shows which signals moved it (moved_by, each with its reason)');
  ok(sig.every((r) => r.signals.every((c) => (c.value === null || c.value >= MIN_SIGNAL) && (c.prev === null || c.prev >= MIN_SIGNAL))) && sig.some((r) => r.signals.some((c) => c.value === null)),
    'acceptance (FS70): every signal under 10 is suppressed (no stored value or previous value under 10)');
  ok(techs.length >= 15 && techs.every((t) => techProblem(t, T.skills.map((s) => s.id), true) === null && brandHits(`${t.id} ${t.name_en} ${t.name_ar} ${t.description_en} ${t.description_ar}`).length === 0),
    `acceptance (FS71): no vendor brand name in any of the ${techs.length} technology tags (deny-list of ${BRAND_DENY.length} names, EN/AR)`);
  ok(new Set(badges.map((b) => b.quarter)).size >= 2 && badges.some((b) => b.scope === 'enec') && badges.some((b) => b.scope === 'role'), `seed: badge lists kept for ${[...new Set(badges.map((b) => b.quarter))].sort().join(', ')}`);
  const open = sug.filter((r) => r.status === 'open');
  const perPerson = new Map(); for (const r of open) perPerson.set(r.person_id, (perPerson.get(r.person_id) ?? 0) + 1);
  ok(open.length > 100 && [...perPerson.values()].every((n) => n <= 6) && sug.some((r) => r.status === 'rejected') && sug.some((r) => (r.history ?? []).length > 0) && !sug.some((r) => r.status === 'confirmed'),
    `seed: ${open.length} open suggestions for ${perPerson.size} people (at most 6 each), earlier answers kept, none confirmed (no evidence seeded)`);
  ok(T.engine_cards.some((c) => c.id === 'skill_suggestions' && c.fairness_metric === 'suggestion_offered' && c.inputs_excluded.join() === 'gender,nationality_flag,age')
    && T.skill_suggestion_fairness.length === 4, 'acceptance (FS72): the surface has an engine card (protected inputs excluded) and a fairness snapshot');

  // ── parity on the database state
  const D = await dbRows();
  const raw = (t) => D[t] ?? [];
  const inp = signalInputFromTables(raw);
  let bad = [];
  for (const x of [...QUARTERS, '2026-Q5', 'x', '']) { const a = (await q1('select kafaa_rs_compute($1) r', [x])).r; if (!same(a, risingSkills(inp, x))) bad.push(x || "''"); }
  ok(bad.length === 0, `FS70: SQL kafaa_rs_compute = TS risingSkills for ${QUARTERS.length} quarters and 3 malformed ones${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  let bOk = true;
  for (const x of ['2026-Q1', '2025-Q4', '2024-Q2', '2026-Q5', '2026Q1', '1999-Q1', '']) {
    const r = await q1('select kafaa_rs_bounds($1) b, kafaa_rs_prev($1) p', [x]);
    if (!same(r.b, quarterBounds(x)) || r.p !== prevQuarter(x)) bOk = false;
  }
  ok(bOk, 'FS70: kafaa_rs_bounds = quarterBounds and kafaa_rs_prev = prevQuarter');
  // stored = rule is a property of the generated seed: compute on seed.json (earlier validators in migrations:validate commit rows of their own)
  const inpSeed = signalInputFromTables((t) => T[t] ?? []);
  const storedOk = runs.every((r) => { const c = risingSkills(inpSeed, r.quarter); return same(r.counts, c.counts) && same(sig.filter((x) => x.run_id === r.id).sort((a, b) => (a.category < b.category ? 1 : a.category > b.category ? -1 : a.rank - b.rank)).map(({ skill_id, category, rank, score, moved_by, signals, families, reasons }) => ({ skill_id, category, rank, score, moved_by, signals, families, reasons })), c.rows); });
  ok(storedOk, 'FS70: every published list equals what the rule computes on the seeded data (computed, never typed; rerun fs70 finalize if a later builder adds dated evidence)');
  bad = [];
  for (const y of [2025, 2026, 2024]) { const a = (await q1('select kafaa_mp_summary($1) r', [y])).r; if (!same(a, pulseSummary(D.manager_pulse, y))) bad.push(y); }
  ok(bad.length === 0, `FS70: SQL kafaa_mp_summary = TS pulseSummary for 2024-2026${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  await db.exec('begin');
  try {
    const mgr = D.people.filter((p) => p.kind === 'staff').slice(0, 10).map((p) => p.id);
    for (const [i, p] of mgr.slice(0, 9).entries()) await q('insert into kafaa_manager_pulse (id, year, person_id, family_id, share_pct) values ($1, 2024, $2, $3, $4)', [`mp:2024:${p}`, p, 'ops', 10 * i]);
    const nine2 = (await q1('select kafaa_mp_summary(2024) r')).r; // 9 responses
    const rows2 = (await q('select * from kafaa_manager_pulse')).map(fix);
    await q('insert into kafaa_manager_pulse (id, year, person_id, family_id, share_pct) values ($1, 2024, $2, null, 90)', [`mp:2024:${mgr[9]}`, mgr[9]]);
    const nine = (await q1('select kafaa_mp_summary(2024) r')).r; // 10 responses: 9 ops + 1 none
    const rows = (await q('select * from kafaa_manager_pulse')).map(fix);
    ok(same(nine, pulseSummary(rows, 2024)) && nine.responses === 10 && nine.families.every((f) => f.n === null) && same(nine2, pulseSummary(rows2, 2024)) && nine2.suppressed === true && nine2.median === null,
      'acceptance (FS70): the pulse is an aggregate only: 10 responses show a median, 9 show nothing; families and bands under 10 are suppressed (SQL = TS)');
  } finally { await db.exec('rollback'); }

  const probes = ['Plant historian', 'OSIsoft PI System trends', 'PI system', 'pip install', 'Excel sheets', 'excellent work', 'Power BI', 'powerbird', 'تحليل مايكروسوفت', 'مايكروسوفتي', 'SAP', 'sapling',
    'meta-data', 'IBM Maximo', 'aws-cli', 'ChatGPT', 'chat gpt', '', null, 'Python-based scripting', 'pythonic', 'AUTODESK', 'auto desk', 'Unreal Engine', 'scripting (general purpose)'];
  let hOk = true;
  for (const p of probes) { const a = (await q1('select kafaa_ht_brand_hits($1) h', [p])).h; if (!same(a, brandHits(p))) { hOk = false; console.log('    brand differs', p, a, brandHits(p)); } }
  ok(hOk && brandHits('OSIsoft PI System trends').length === 2 && brandHits('excellent work').length === 0 && brandHits('تحليل مايكروسوفت').length === 1, `FS71: kafaa_ht_brand_hits = brandHits for ${probes.length} probes (whole words, EN/AR)`);
  const skills = D.skills.map((s) => s.id);
  const base = { id: 'tech-check-tool', name_en: 'Check tool', name_ar: 'أداة فحص', description_en: 'A generic checking tool used in the field for tests.', description_ar: 'أداة فحص عامة تُستخدم في الموقع للاختبارات.', category: 'inspection', skill_ids: ['sk-co-01'] };
  const tp = [[base, true], [{ ...base, id: 'TECH-x' }, true], [{ ...base, id: 'TECH-x' }, false], [{ ...base, name_ar: 'English' }, true], [{ ...base, name_en: 'ab' }, true], [{ ...base, description_en: 'short' }, true],
    [{ ...base, name_en: 'Siemens checker' }, true], [{ ...base, description_ar: 'أداة فحص من مايكروسوفت تستخدم في الموقع' }, true], [{ ...base, id: 'tech-tableau-views' }, true], [{ ...base, category: 'cloud' }, true],
    [{ ...base, skill_ids: ['sk-nope'] }, true], [{ ...base, skill_ids: ['sk-co-01', 'sk-co-01'] }, true], [{ ...base, skill_ids: 'sk-co-01' }, true], [{ ...base, skill_ids: null }, true],
    [{ ...base, status: 'gone' }, true], [{ ...base, status: 'retired' }, false], [null, true], [{ ...base, category: 5 }, true]];
  const tpSql = [];
  for (const [x, isNew] of tp) tpSql.push((await q1('select kafaa_ht_problem($1::jsonb, $2) c', [JSON.stringify(x), isNew])).c);
  ok(tp.every(([x, isNew], i) => (techProblem(x, skills, isNew) ?? null) === tpSql[i]) && tpSql[0] === null && tpSql[2] === null && tpSql[6] === 'brand' && tpSql[7] === 'brand' && tpSql[8] === 'brand',
    `FS71: kafaa_ht_problem = techProblem for ${tp.length} probes (${tpSql.filter(Boolean).join(', ')})`);
  const binp = badgeInputFromTables(raw);
  bad = [];
  for (const x of [...QUARTERS, 'x']) { const a = (await q1('select kafaa_ht_compute($1) r', [x])).r; if (!same(a, technologyBadges(binp, x))) bad.push(x); }
  ok(bad.length === 0, `acceptance (FS71): the badges reproduce from the published criteria: SQL kafaa_ht_compute = TS technologyBadges for ${QUARTERS.length} quarters${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  const bq = [...new Set(badges.map((b) => b.quarter))];
  const binpSeed = badgeInputFromTables((t) => T[t] ?? []);
  ok(bq.every((x) => { const c = technologyBadges(binpSeed, x); const st = badges.filter((b) => b.quarter === x);
    return same(st.filter((b) => b.scope === 'enec').sort((a, b) => a.rank - b.rank).map((b) => [b.technology_id, b.rank, b.sources, b.families, b.recent]), c.hot.map((h) => [h.technology_id, h.rank, h.sources, h.families, h.recent]))
      && same(st.filter((b) => b.scope === 'role').map((b) => `${b.role_id}|${b.technology_id}|${b.via_profile}|${b.family_opportunities}`).sort(), c.roles.map((r) => `${r.role_id}|${r.technology_id}|${r.via_profile}|${r.family_opportunities}`).sort()); }),
  'FS71: every stored badge list equals what the criteria give on the seeded data');
  const w = ssgWorldFromTables(raw);
  const staff = D.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id);
  for (const day of [DAY, '2027-02-15', '2027-02-16']) {
    bad = [];
    for (const p of staff) { const a = (await q1('select kafaa_ssg_candidates($1, $2::date) r', [p, day])).r; if (!same(a, inferSuggestions(w, p, day))) bad.push(p); }
    ok(bad.length === 0, `FS72: SQL kafaa_ssg_candidates = TS inferSuggestions for all ${staff.length} active staff on ${day}${bad.length ? ` (differ: ${bad.slice(0, 3).join(', ')})` : ''}`);
  }
  const rej = sug.find((r) => r.person_id === 'p-k-ro' && r.status === 'rejected');
  const before = inferSuggestions(w, 'p-k-ro', '2027-02-15').some((c) => c.skill_id === rej.skill_id);
  const onDay = inferSuggestions({ ...w, suggestions: w.suggestions }, 'p-k-ro', rej.suppressed_until).some((c) => c.skill_id === rej.skill_id);
  const reopened = sug.find((r) => r.person_id === 'p-k-ro' && (r.history ?? []).length > 0);
  ok(rej.suppressed_until === '2027-02-16' && !before && !inferSuggestions(w, 'p-k-ro', DAY).some((c) => c.skill_id === rej.skill_id) && onDay && reopened?.status === 'open' && reopened.history[0].status === 'not_me',
    'acceptance (FS72): a rejected suggestion does not return for 180 days (hidden on 2027-02-15, back on 2027-02-16); a "not me" from March returned after its 180 days with the answer kept in history');
  const wSeed = ssgWorldFromTables((t) => T[t] ?? []);
  const storedSug = open.every((r) => { const c = inferSuggestions(wSeed, r.person_id, DAY).find((x) => x.skill_id === r.skill_id); return c && c.score === r.score && c.level === r.level && same(c.sources, r.sources) && same(c.reasons, r.reasons); })
    && T.people.filter((p) => p.kind === 'staff' && p.status === 'active').every((p) => inferSuggestions(wSeed, p.id, DAY).length === open.filter((r) => r.person_id === p.id).length);
  ok(storedSug, 'FS72: every stored open suggestion equals the rule on 2026-10-11 (sources, reasons, score, level)');
  ok(open.every((r) => r.level <= 2 && r.reasons.length === r.sources.length && r.reasons.every((x) => /^m28\.ssg\.reason\./.test(x.key))), 'FS72: every suggestion carries one reason per source (i18n keys for WhyThis); levels never above 2');
  const fair = (await q1('select kafaa_ssg_fairness_compute($1::date) r', [DAY])).r;
  const fts = suggestionFairness(D.people, D.skill_suggestions, DAY);
  const fStored = (await q("select id, period, to_char(as_of, 'YYYY-MM-DD') as_of, card, metric, dimension, group_key, n, positives, rate::float8 rate, ratio::float8 ratio, suppressed, flagged, source from kafaa_skill_suggestion_fairness order by id"));
  ok(same(fair, fts) && same(fStored, [...fts].sort((a, b) => (a.id < b.id ? -1 : 1))) && fts.every((r) => (r.suppressed ? r.n === null && r.rate === null : r.n >= 10)),
    'acceptance (FS72): the fairness snapshot follows the F24 rules (SQL kafaa_ssg_fairness_compute = TS suggestionFairness = the stored rows; groups under 10 suppress the comparison)');
  // messages: SQL = TS
  const msgs = [['rs.not_signed_in', RS_MSG.not_signed_in], ['rs.published', RS_MSG.published], ['rs.pulse_closed', RS_MSG.pulse_closed], ['rs.pulse_read_forbidden', RS_MSG.pulse_read_forbidden],
    ['ht.forbidden', HT_MSG.forbidden], ['ht.p.brand', HT_PROBLEM_TEXT.brand], ['ht.published', HT_MSG.published], ['ssg.not_found', SSG_MSG.not_found], ['ssg.closed', SSG_MSG.closed],
    ['ssg.forbidden_fairness', SSG_MSG.forbidden_fairness], ['ssg.forbidden_stats', SSG_MSG.forbidden_stats]];
  let mOk = true; for (const [c, m] of msgs) if ((await q1('select kafaa_fs81_msg($1) m', [c])).m !== m) mOk = false;
  ok(mOk, 'refusal messages: SQL kafaa_fs81_msg = TS RS_MSG / HT_MSG / SSG_MSG');

  // ── RLS
  const rd = async (p, t, where = 'true') => Number((await one(p, `select count(*)::int n from kafaa_${t} where ${where}`)).n);
  let rls = true;
  for (const t of ['skill_signal_runs', 'skill_signals', 'technologies', 'technology_links', 'technology_badges']) {
    for (const p of ['sro', 'k-ro', 'k-hr-analyst', 'training-mgr', 'k-auditor', 'k-admin']) if ((await rd(p, t)) !== T[t].length) rls = false;
    for (const p of [null, 'alnoor-gm', 'k-observer', 'k-university']) if ((await rd(p, t)) !== 0) rls = false;
  }
  ok(rls, 'RLS (FS70/FS71): staff read the published lists, technologies, tags and badges (internal_content R); anonymous visitors, partners, observers and universities read nothing');
  const sroOwn = sug.filter((r) => r.person_id === 'p-sro').length, kroOwn = sug.filter((r) => r.person_id === 'p-k-ro').length;
  const sugRead = { sro: await rd('sro', 'skill_suggestions'), kro: await rd('k-ro', 'skill_suggestions'), sroOfKro: await rd('sro', 'skill_suggestions', "person_id = 'p-k-ro'"),
    tm: await rd('training-mgr', 'skill_suggestions', "person_id <> 'p-training-mgr'"), hr: await rd('k-hr-analyst', 'skill_suggestions', "person_id <> 'p-k-hr-analyst'"), chco: await rd('chco', 'skill_suggestions', "person_id <> 'p-chco'"),
    aud: await rd('k-auditor', 'skill_suggestions'), adm: await rd('k-admin', 'skill_suggestions', "person_id <> 'p-k-admin'"), anon: await rd(null, 'skill_suggestions') };
  const krManager = D.people.find((p) => p.id === 'p-k-ro')?.manager_id;
  ok(sroOwn > 0 && kroOwn > 0 && sugRead.sro === sroOwn && sugRead.kro === kroOwn && sugRead.sroOfKro === 0 && sugRead.tm === 0 && sugRead.hr === 0 && sugRead.chco === 0 && sugRead.aud === 0 && sugRead.adm === 0 && sugRead.anon === 0,
    `acceptance (FS72): no suggestion is readable by a manager (sro${krManager === 'p-sro' ? ', k-ro\'s line manager,' : ''} reads 0 of k-ro's ${kroOwn}), HR, the training manager, admins or auditors; each person reads only their own`);
  const pulseRead = { hr: await rd('k-hr-analyst', 'manager_pulse'), tm: await rd('training-mgr', 'manager_pulse'), opsOwn: await rd('ops-ceo', 'manager_pulse'), sro: await rd('sro', 'manager_pulse') };
  ok(pulseRead.hr === 0 && pulseRead.tm === 0 && pulseRead.opsOwn === D.manager_pulse.filter((r) => r.person_id === 'p-ops-ceo').length && pulseRead.opsOwn > 0 && pulseRead.sro === 0,
    'RLS (FS70): pulse answers are read by the manager who gave them only; HR and the training manager see aggregates through the RPC');
  const fRead = { adm: await rd('k-admin', 'skill_suggestion_fairness'), aud: await rd('k-auditor', 'skill_suggestion_fairness'), hr: await rd('k-hr-analyst', 'skill_suggestion_fairness'), sro: await rd('sro', 'skill_suggestion_fairness'), anon: await rd(null, 'skill_suggestion_fairness') };
  ok(fRead.adm === 4 && fRead.aud === 4 && fRead.hr === 4 && fRead.sro === 0 && fRead.anon === 0, 'RLS (FS72): the fairness snapshot is read by admins, auditors and HR (aggregates only), not by staff or anonymous visitors');
  let direct = 0;
  for (const sql of ["update kafaa_skill_suggestions set status = 'confirmed' where person_id = 'p-k-ro'", "insert into kafaa_skill_signal_runs (id, quarter, method, published_by) values ('ssr:2025-Q1', '2025-Q1', 'x', 'p-k-ro')",
    "update kafaa_technologies set name_en = 'Siemens' where id = 'tech-dashboards'"]) {
    try { await one('k-ro', `${sql} returning 1`); } catch { direct++; }
  }
  ok(direct === 3 && (await q1("select count(*)::int n from kafaa_skill_suggestions where status = 'confirmed'")).n === 0, 'writes only through the RPCs (no direct update or insert by API roles)');
  let ck = 0;
  await db.exec('begin');
  for (const sql of ["update kafaa_skill_suggestions set status = 'confirmed' where id = (select id from kafaa_skill_suggestions where status = 'open' limit 1)",
    "update kafaa_skill_suggestions set suppressed_until = responded_on + 30 where status = 'rejected'", "update kafaa_skill_suggestions set level = 3 where status = 'open'",
    "insert into kafaa_manager_pulse (id, year, person_id, share_pct) values ('mp:2026:p-sro', 2026, 'p-sro', 120)", "insert into kafaa_skill_signal_runs (id, quarter, method, published_by) values ('ssr:x', '2025-Q1', 'x', 'p-k-ro')"]) {
    await db.exec('savepoint c'); try { await db.exec(sql); } catch { ck++; } await db.exec('rollback to savepoint c');
  }
  await db.exec('rollback');
  ok(ck === 5, 'check constraints: a confirmation names its evidence, a rejection hides for exactly 180 days, suggestions stay claims (level <= 2), pulse answers are 0-100 %, run ids follow the quarter');

  // ── grants
  let anonDenied = 0;
  for (const f of RPCS) { try { await one(null, `select ${f}`); } catch { anonDenied++; } }
  ok(anonDenied === RPCS.length, `grants: anonymous visitors cannot execute the ${RPCS.length} RPCs`);
  let helperDenied = 0;
  const HELPERS = ["kafaa_rs_compute('2026-Q3')", "kafaa_rs_counts('2026-Q3')", 'kafaa_mp_summary(2026)', "kafaa_ht_compute('2026-Q3')", "kafaa_ht_brand_hits('x')", "kafaa_ssg_candidates('p-k-ro', current_date)", 'kafaa_ssg_fairness_compute(current_date)', "kafaa_fs81_msg('x')"];
  for (const f of HELPERS) { try { await one('k-admin', `select ${f}`); } catch { helperDenied++; } }
  ok(helperDenied === HELPERS.length, 'grants: internal helpers are not executable by signed-in users');

  // ── RPC flows (inside a rolled-back transaction)
  await db.exec('begin');
  try {
    const today = (await q1('select current_date::text d')).d;
    const call = async (p, sql, params = []) => (await one(p, `select ${sql} r`, params)).r;
    const lastAudit = async (action) => (await q1('select ledger_seq, ledger_status, outcome from kafaa_audit_events where action = $1 order by seq desc limit 1', [action]));
    const audits = async (action) => Number((await q1('select count(*)::int n from kafaa_audit_events where action = $1', [action])).n);
    // FS70 compute and publish
    const c1 = await call('k-hr-analyst', 'kafaa_compute_skill_signals($1)', ['2026-Q3']);
    const a0 = await audits('skill_signals.compute');
    const c2 = await call('sro', 'kafaa_compute_skill_signals($1)', ['2026-Q3']), c3 = await call('chco', 'kafaa_compute_skill_signals($1)', ['2024-Q4']), c4 = await call('k-auditor', 'kafaa_compute_skill_signals($1)', ['2026-Q2']);
    ok(c1.ok && same(c1.data, risingSkills(inp, '2026-Q3')) && c2.code === 'forbidden' && c3.code === 'invalid' && c4.ok && (await audits('skill_signals.compute')) === a0 + 2,
      'computeSkillSignals: HR and auditors compute (TS = SQL); staff are refused; quarters before 2025-Q1 are refused; refusals are audited');
    const p1 = await call('training-mgr', 'kafaa_publish_skill_signals($1, $2, $3)', ['2025-Q3', '', '']);
    const p2 = await call('k-hr-analyst', 'kafaa_publish_skill_signals($1, $2, $3)', ['2026-Q3', '', '']);
    const curQ = `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
    const p3 = await call('k-hr-analyst', 'kafaa_publish_skill_signals($1, $2, $3)', [curQ, '', '']);
    const p4 = await call('k-hr-analyst', 'kafaa_publish_skill_signals($1, $2, $3)', ['2025-Q3', 'Two skills growing.', 'مهارتان في نمو.']);
    const p4a = await lastAudit('skill_signals.publish');
    const rows25 = (await q("select skill_id, category, rank, score, moved_by, signals, families, reasons from kafaa_skill_signals where quarter = '2025-Q3' order by category desc, rank"));
    const p5 = await call('k-hr-analyst', 'kafaa_publish_skill_signals($1, $2, $3)', ['2025-Q3', '', '']);
    ok(p1.code === 'forbidden' && p2.code === 'published' && p3.code === 'open_quarter' && p4.ok && p4a.ledger_status === 'written' && p4a.ledger_seq != null && same(rows25, risingSkills(inp, '2025-Q3').rows)
      && p5.code === 'published', 'acceptance (FS70): publishSkillSignals: HR publishes an ended quarter (audit + ledger, rows = the rule); the training manager is refused; the current quarter is refused; a published quarter is kept (refused, never overwritten)');
    // pulse
    const open_ = (await q1("select to_char(current_date, 'MM-DD') between '09-15' and '12-15' o")).o;
    const s1 = await call('sro', 'kafaa_submit_manager_pulse($1::jsonb)', [JSON.stringify({ share_pct: 45, team_size: 12 })]);
    const s2 = await call('k-ro', 'kafaa_submit_manager_pulse($1::jsonb)', [JSON.stringify({ share_pct: 45 })]);
    const s3 = await call('sro', 'kafaa_submit_manager_pulse($1::jsonb)', [JSON.stringify({ share_pct: 120 })]);
    const s4 = await call('sro', 'kafaa_submit_manager_pulse($1::jsonb)', [JSON.stringify({ share_pct: 50 })]);
    const sroRow = await rd('sro', 'manager_pulse');
    ok(open_ ? (s1.ok && s2.code === 'forbidden' && s3.code === 'invalid' && s4.ok && s4.data.share_pct === 50 && sroRow === 1) : (s1.code === 'closed' && s2.code === 'forbidden'),
      `submitManagerPulse: a line manager answers while the pulse is open (${open_ ? 'open today' : 'closed today'}; answering again updates); staff without a team are refused; 0-100 % only`);
    const m1 = await call('k-hr-analyst', 'kafaa_manager_pulse_summary($1)', [2026]), m2 = await call('sro', 'kafaa_manager_pulse_summary($1)', [2026]), m3 = await call('chco', 'kafaa_manager_pulse_summary($1)', [2019]);
    ok(m1.ok && same(m1.data, pulseSummary((await q('select * from kafaa_manager_pulse')).map(fix), 2026)) && m2.code === 'forbidden' && m3.code === 'invalid', 'managerPulseSummary: HR reads the aggregate (TS = SQL); a manager cannot read it; years outside 2025..now refused');
    // FS71
    const t1 = await call('training-mgr', 'kafaa_save_technology($1::jsonb)', [JSON.stringify({ ...base, name_en: 'Splunk log search' })]);
    const t2 = await call('sro', 'kafaa_save_technology($1::jsonb)', [JSON.stringify(base)]);
    const t3 = await call('training-mgr', 'kafaa_save_technology($1::jsonb)', [JSON.stringify(base)]);
    const t4 = await call('training-mgr', 'kafaa_save_technology($1::jsonb)', [JSON.stringify({ ...base, name_en: 'Check tool v2' })]);
    ok(t1.code === 'invalid' && /brand/.test(t1.message) && t2.code === 'forbidden' && t3.ok && t3.data.version === 1 && t4.ok && t4.data.version === 2,
      'acceptance (FS71): saveTechnology refuses a vendor brand name; framework owners add and version generic tags; staff are refused');
    const g1 = await call('training-mgr', 'kafaa_tag_technology($1::jsonb)', [JSON.stringify({ technology_id: 'tech-check-tool', ref_table: 'opportunities', ref_id: 'opp-rp-dose-desk', active: true })]);
    const g2 = await call('training-mgr', 'kafaa_tag_technology($1::jsonb)', [JSON.stringify({ technology_id: 'tech-check-tool', ref_table: 'opportunities', ref_id: 'opp-rp-dose-desk', active: true })]);
    const g3 = await call('training-mgr', 'kafaa_tag_technology($1::jsonb)', [JSON.stringify({ technology_id: 'tech-check-tool', ref_table: 'opportunities', ref_id: 'opp-nope', active: true })]);
    const g4 = await call('training-mgr', 'kafaa_tag_technology($1::jsonb)', [JSON.stringify({ technology_id: 'tech-check-tool', ref_table: 'opportunities', ref_id: 'opp-crewb-procedure-usability', active: true })]);
    const link = await q1("select family_id, source_on::text so from kafaa_technology_links where id = 'tl:tech-check-tool:opportunities:opp-rp-dose-desk'");
    const g5 = await call('training-mgr', 'kafaa_tag_technology($1::jsonb)', [JSON.stringify({ technology_id: 'tech-check-tool', ref_table: 'opportunities', ref_id: 'opp-rp-dose-desk', active: false })]);
    const opp = D.opportunities.find((o) => o.id === 'opp-rp-dose-desk');
    ok(g1.ok && g2.code === 'no_change' && g3.code === 'source_not_found' && g4.code === 'source_not_found' && g5.ok && link.family_id === opp.family_id && link.so === String(opp.created_at).slice(0, 10),
      'tagTechnology: a tag takes its family and date from the source server-side; no duplicates; unknown and draft sources refused; untagging keeps the row inactive');
    const b1 = await call('training-mgr', 'kafaa_compute_technology_badges($1)', ['2026-Q3']);
    const b2 = await call('training-mgr', 'kafaa_publish_technology_badges($1)', ['2026-Q3']);
    const b3 = await call('training-mgr', 'kafaa_publish_technology_badges($1)', [curQ]);
    const b4 = await call('training-mgr', 'kafaa_publish_technology_badges($1)', ['2025-Q2']);
    const b5 = await call('k-hr-analyst', 'kafaa_compute_technology_badges($1)', ['2026-Q3']);
    const b0 = await audits('technology.badges_publish');
    ok(b1.ok && same(b1.data, technologyBadges(badgeInputFromTables((t) => (t === 'technologies' ? [...D.technologies, { id: 'tech-check-tool', status: 'active' }] : t === 'technology_links' ? D.technology_links : raw(t))), '2026-Q3'))
      && b2.code === 'published' && b3.code === 'open_quarter' && b4.code === 'no_change' && b5.code === 'forbidden' && b0 >= 3,
    'acceptance (FS71): past badge lists are kept per quarter (a published quarter is refused, never overwritten); the open quarter and an empty quarter cannot publish; computing is for framework owners');
    // FS72
    const kroIds = (await q("select id, skill_id, status from kafaa_skill_suggestions where person_id = 'p-k-ro' order by id"));
    const sroIds = (await q("select id from kafaa_skill_suggestions where person_id = 'p-sro' and status = 'open' order by id"));
    const r1 = await call('k-ro', 'kafaa_refresh_skill_suggestions()');
    const wNow = ssgWorldFromTables((t) => raw(t));
    const tsNow = inferSuggestions(wNow, 'p-k-ro', today);
    ok(r1.ok && r1.data.open === tsNow.length, `refreshSkillSuggestions: k-ro's suggestions recomputed for ${today} (${r1.data.open} open = TS); audited`);
    const target = (await q("select id, skill_id, level from kafaa_skill_suggestions where person_id = 'p-k-ro' and status = 'open' order by score desc, skill_id limit 2"));
    const x1 = await call('k-ro', 'kafaa_respond_suggestion($1, $2)', [sroIds[0].id, 'confirm']);
    const x2 = await call('sro', 'kafaa_respond_suggestion($1, $2)', [target[0].id, 'confirm']);
    const x3 = await call('k-ro', 'kafaa_respond_suggestion($1, $2)', [target[0].id, 'love']);
    const x4 = await call('k-ro', 'kafaa_respond_suggestion($1, $2)', [target[0].id, 'confirm']);
    const ev = await q1('select kind, basis, ref_table, ref_id, level, active from kafaa_skill_evidence where id = $1', [x4.data?.evidence_id ?? '']);
    const st = await q1("select basis, level from kafaa_person_skills where person_id = 'p-k-ro' and skill_id = $1 and active", [target[0].skill_id]);
    const x5 = await call('k-ro', 'kafaa_respond_suggestion($1, $2)', [target[0].id, 'reject']);
    const x6 = await call('k-ro', 'kafaa_respond_suggestion($1, $2)', [target[1].id, 'reject']);
    const rejRow = await q1('select suppressed_until::text u, responded_on::text r from kafaa_skill_suggestions where id = $1', [target[1].id]);
    const r2 = await call('k-ro', 'kafaa_refresh_skill_suggestions()');
    const after = (await q("select skill_id, status from kafaa_skill_suggestions where person_id = 'p-k-ro'"));
    const sroSeesKro = await rd('sro', 'skill_suggestions', "person_id = 'p-k-ro'");
    const sroSeesEv = Number((await one('sro', "select count(*)::int n from kafaa_skill_evidence where person_id = 'p-k-ro' and ref_table = 'skill_suggestions'")).n);
    ok(x1.code === 'not_found' && x2.code === 'not_found' && x3.code === 'invalid' && x4.ok && ev?.kind === 'rating' && ev.basis === 'claimed' && ev.ref_table === 'skill_suggestions' && ev.level === Math.min(2, target[0].level) && ev.active
      && st?.basis === 'claimed' && x5.code === 'closed' && x6.ok && rejRow.u === x6.data.suppressed_until && Date.parse(rejRow.u) - Date.parse(rejRow.r) === 180 * 86_400_000 && r2.ok
      && after.find((r) => r.skill_id === target[0].skill_id)?.status === 'confirmed' && after.find((r) => r.skill_id === target[1].skill_id)?.status === 'rejected' && sroSeesKro === 0 && sroSeesEv === 1,
    'acceptance (FS72): confirm writes k-ro\'s own claimed evidence (kind rating, ref_table skill_suggestions) and updates the skill state; someone else\'s suggestion reads as not found; a rejection hides it for 180 days and a refresh does not bring it back; the manager sees the confirmed claim, never the suggestions');
    void kroIds;
    const f1 = await call('k-admin', 'kafaa_run_suggestion_fairness($1::date)', [null]);
    const f1a = await lastAudit('fairness.suggestion_snapshot');
    const f2 = await call('sro', 'kafaa_run_suggestion_fairness($1::date)', [null]);
    const f3 = await call('k-admin', "kafaa_run_suggestion_fairness(current_date + 3)");
    ok(f1.ok && f1.data.rows === 4 && f1a.ledger_status === 'written' && f2.code === 'forbidden' && f3.code === 'invalid', 'runSuggestionFairness: admins store this week\'s snapshot (audit + ledger); staff refused; future dates refused');
    const z1 = await call('k-hr-analyst', 'kafaa_suggestion_stats()'), z2 = await call('sro', 'kafaa_suggestion_stats()');
    ok(z1.ok && z1.data.open >= 10 && z1.data.rejected === null && z1.data.suppressed === true && z2.code === 'forbidden', 'suggestionStats: HR reads counts by status with every count under 10 suppressed; staff are refused');
  } finally {
    await db.exec('rollback');
  }

  // ── additivity, function bodies and table digests (for the live comparison)
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/create\s+or\s+replace\s+function\s+(kafaa_skill_states_v2|kafaa_skills_apply|kafaa_fairness_|kafaa_dg_gather|kafaa_so_base)\b/i.test(text)
    && /insert into kafaa_engine_cards[\s\S]*on conflict \(id\) do nothing/.test(text) && !/^\s*update\s/im.test(text.replace(/--.*$/gm, '').replace(/\$\$[\s\S]*?\$\$/g, '')),
  'additive: the FS81 migration names no destructive statement, alters only kafaa_* tables, redefines no shared function and updates no existing row (the card is inserted on conflict do nothing)');
  void FIRST_QUARTER;
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  ok(md5s.length === FUNCS.length, `functions: ${md5s.length} new function bodies present`);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m.slice(0, 8)}`).join(' ')}`);
  for (const t of TABLES) {
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x`))[0];
    console.log(`    digest kafaa_${t} ${d.n} ${d.dg}`);
  }
  const card = (await q("select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_engine_cards x where id = 'skill_suggestions'"))[0];
  console.log(`    digest kafaa_engine_cards[skill_suggestions] ${card.n} ${card.dg}`);
}
