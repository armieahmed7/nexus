// [FS wave G · E2 · FS62 + FS63] PGlite checks for 20261010272001_kafaa_fs72_national_alignment.sql (National Alignment, M37).
// Seed (the three M37 tables load unchanged; every tag in EN and AR, sourced from the research pack with its tier, flagged tags explained;
// no typed totals; 28 current roles mapped, every code pending review); SQL = TS parity on the database state (kafaa_na_tier,
// kafaa_na_typed_free, kafaa_na_tag_problem, kafaa_na_link_problem, kafaa_na_links, kafaa_na_report_core for every filter with and
// without measures, kafaa_ro_problem, kafaa_ro_code_problem, kafaa_ro_trend_core), also after generated edits of the data inside a
// rolled-back transaction (the report follows the data: no stored total); DB guards (code only when verified, concept roles refused);
// RLS (national_alignment readers only); the seven RPCs (refusals, audit, ledger, maker-checker); grants; the migration is additive.
// Prints the md5 of every new function body and the row digest of every new table for the live comparison.
import { readFileSync } from 'node:fs';
import {
  effectiveLinks, linkProblem, nationalReport, sourceTier, tagProblem, tagSourceView, targetView, typedTotalFree, worldFrom, STRATEGIES,
} from '../../src/modules/m37/national.ts';
import { codeProblem, indicativeLevel, occupationProblem, occupationTrend } from '../../src/modules/m37/occupations.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const M37 = ['national_tags', 'tag_links', 'role_occupations'];
const FUNCS = ['kafaa_ro_guard', 'kafaa_na_host', 'kafaa_na_tier', 'kafaa_na_typed_free', 'kafaa_na_len', 'kafaa_na_str', 'kafaa_na_tag_problem', 'kafaa_na_target', 'kafaa_na_link_problem',
  'kafaa_na_links', 'kafaa_na_pct1', 'kafaa_na_sup', 'kafaa_na_holders', 'kafaa_na_measure', 'kafaa_na_group_name', 'kafaa_na_report_core', 'kafaa_ro_indicative', 'kafaa_ro_problem',
  'kafaa_ro_code_problem', 'kafaa_ro_trend_core', 'kafaa_national_report', 'kafaa_save_national_tag', 'kafaa_set_tag_link', 'kafaa_save_role_occupation', 'kafaa_verify_occupation_code',
  'kafaa_clear_occupation_code', 'kafaa_occupation_trend'];
const RPCS = ['kafaa_clear_occupation_code', 'kafaa_national_report', 'kafaa_occupation_trend', 'kafaa_save_national_tag', 'kafaa_save_role_occupation', 'kafaa_set_tag_link', 'kafaa_verify_occupation_code'];
const WORLD = ['national_tags', 'tag_links', 'skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills',
  'ai_org_targets', 'cec_role_targets', 'job_families', 'people', 'person_skills', 'courses', 'enrolments', 'training_records', 'pathway_enrolments', 'microcred_awards', 'applications',
  'leadership_nominations', 'ai_rungs', 'ai_skill_tracks'];

export default async function fs72Checks({ db, as, one, count, ok }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const pack = readFileSync('../docs/kafaa/ref/research/national_systems.md', 'utf8');
  console.log('FS wave G · E2 · FS62 national-strategy alignment + FS63 MoHRE occupation mapping (M37)');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/_at$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : typeof v === 'string' && /^-?\d+\.\d+$/.test(v) ? Number(v) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);
  const world = async () => { const D = {}; for (const t of WORLD) D[t] = await rows(t); return worldFrom((n) => D[n] ?? []); };
  const today = (await q(`select to_char(current_date, 'YYYY-MM-DD') d`))[0].d;

  // ── seed: the M37 tables load unchanged
  const byIdSort = (a) => [...a].sort((x, y) => (x.id < y.id ? -1 : 1));
  const D = {}; for (const t of M37) D[t] = await rows(t);
  ok(M37.every((t) => D[t].length === S[t].length && same(D[t].map((r) => r.id), byIdSort(S[t]).map((r) => r.id)))
    && same(D.national_tags.map((r) => [r.id, r.sources, r.name_ar, r.summary_ar]), byIdSort(S.national_tags).map((r) => [r.id, r.sources, r.name_ar, r.summary_ar]))
    && same(D.role_occupations.map((r) => [r.id, r.skill_level, r.history]), byIdSort(S.role_occupations).map((r) => [r.id, r.skill_level, r.history])),
    `seed: ${M37.map((t) => `${D[t].length} ${t}`).join(', ')} load unchanged`);

  // ── FS62 acceptance on the database rows
  const tags = D.national_tags;
  const tierSql = await q(`select u, kafaa_na_tier(u) t from (select distinct e ->> 'url' u from kafaa_national_tags, jsonb_array_elements(sources) e) x order by 1`);
  ok(tags.every((t) => t.sources.length >= 1 && t.sources.every((s) => /^https:\/\//.test(s.url) && s.as_of && s.tier === sourceTier(s.url) && pack.includes(s.url)))
    && tierSql.every((r) => r.t === sourceTier(r.u)),
    `acceptance FS62: every tag cites a source from the research pack with an as-of date; tiers stored = sourceTier = SQL kafaa_na_tier (${tierSql.length} URLs)`);
  const views = tags.map((t) => [t, tagSourceView(t.sources, t.source_scope)]);
  const flagged = views.filter(([, v]) => v.flagged).map(([t]) => t.id).sort();
  ok(views.every(([t, v]) => !v.flagged || (t.source_note_en && t.source_note_ar)) && same(flagged, ['nt-centennial-2071', 'nt-net-zero-2050', 'nt-we-uae-2031', 'nt-we-uae-2031-economy', 'nt-we-uae-2031-society'].sort())
    && views.filter(([, v]) => !v.flagged).every(([, v]) => v.primary.tier === 'official'),
    `acceptance FS62 (settled decision): each tag cites the most official URL the pack gives; ${flagged.length} tags whose best source is secondary or indirect are flagged${views.filter(([t, v]) => v.flagged && t.parent_id === null).every(([t]) => t.source_note_en) ? ' and explain why in EN and AR' : ''}`);
  const strategies = new Set(tags.filter((t) => t.kind === 'strategy').map((t) => t.strategy));
  ok(STRATEGIES.every((s) => strategies.has(s)) && tags.filter((t) => t.strategy === 'jahiz' && t.kind === 'group').map((t) => t.future_group).sort().join(',') === 'data_ai,digital,new_economy,ten_x',
    'the six strategies of the card are tagged (NES 2031, We the UAE 2031, AI 2031, Net Zero 2050, Jahiz groups, Centennial 2071); the four Jahiz groups reuse the FS02 future_group values');
  ok(tags.every((t) => t.name_en && t.summary_en && /[؀-ۿ]/.test(t.name_ar) && /[؀-ۿ]/.test(t.summary_ar)) && D.tag_links.every((l) => l.note_en && /[؀-ۿ]/.test(l.note_ar)),
    'acceptance FS62: every tag (name and summary) and every link note exists in EN and AR');
  const texts = [...tags.flatMap((t) => [t.name_en, t.name_ar, t.summary_en, t.summary_ar, t.owner_en ?? '', t.owner_ar ?? '', t.source_note_en ?? '', t.source_note_ar ?? '']), ...D.tag_links.flatMap((l) => [l.note_en, l.note_ar])];
  const mutants = [...texts.slice(0, 40), '2031 and 2050', 'reach 610,000', '10X Skills', 'مهارات 10X', 'خلال ٢٠٣١', 'in 2030s', 'abc2031', '2031x', 'A10X', '10Xs', 'twenty 20', 'year 1999', '٣ مهارات', 'no digits here', ''];
  const tf = (await q('select x, kafaa_na_typed_free(array[x]) f from unnest($1::text[]) x', [mutants])).map((r) => r.f);
  ok(typedTotalFree(texts) && same(tf, mutants.map((m) => typedTotalFree([m]))), `acceptance FS62: no typed totals in tag or link text (years and the 10X name only); SQL kafaa_na_typed_free = typedTotalFree on ${mutants.length} cases`);
  const numericCols = (await q(`select table_name, column_name from information_schema.columns where table_name = any($1) and data_type in ('integer', 'numeric', 'double precision', 'bigint') order by 1, 2`, [M37.map((t) => `kafaa_${t}`)])).map((r) => `${r.table_name}.${r.column_name}`);
  ok(same(numericCols, ['kafaa_national_tags.horizon_year', 'kafaa_national_tags.sort', 'kafaa_national_tags.version', 'kafaa_role_occupations.skill_level', 'kafaa_role_occupations.version']),
    `acceptance FS62: no table stores a total, count or measure (numeric columns: ${numericCols.join(', ')})`);

  // ── SQL = TS: tag and link problems on the seed and generated mutants
  const tagCases = [];
  for (const t of tags) {
    tagCases.push(t, { ...t, id: undefined }, { ...t, name_ar: 'x' }, { ...t, code: 'bad code' }, { ...t, summary_en: 'Reaches 610,000 workers by 2031.' }, { ...t, summary_en: `${t.summary_en} The headcount is shown.` },
      { ...t, sources: [] }, { ...t, sources: [{ label: 'x', url: 'http://u.ae', as_of: '2026-10-10' }] }, { ...t, sources: [{ ...t.sources[0], as_of: '2099-01-01' }] },
      { ...t, horizon_year: 2101 }, { ...t, horizon_year: 2031.5 }, { ...t, source_scope: 'other' }, { ...t, status: 'gone' }, { ...t, strategy: 'x' }, { ...t, kind: 'theme' },
      { ...t, parent_id: t.parent_id ? null : 'nt-nes-2031' }, { ...t, parent_id: t.parent_id ? 'nt-jahiz' : null }, { ...t, owner_en: 'Owner 12' });
  }
  const tpSql = (await q('select kafaa_na_tag_problem(x, $2::date) p from jsonb_array_elements($1::jsonb) x', [JSON.stringify(tagCases), today])).map((r) => r.p);
  const tpTs = tagCases.map((c) => tagProblem(c, { tags, today }));
  ok(same(tpSql, tpTs) && tpTs.filter((p) => p === null).length >= tags.length, `SQL kafaa_na_tag_problem = tagProblem on ${tagCases.length} cases (seed tags pass; ${new Set(tpTs.filter(Boolean)).size} problem codes exercised)`);
  const W0 = await world();
  const linkCases = [];
  for (const l of D.tag_links) linkCases.push({ ...l }, { ...l, note_ar: '' }, { ...l, note_en: 'Covers 40 roles in total.' }, { ...l, active: false, note_en: '' }, { ...l, target_id: 'nope' }, { ...l, target_table: 'people' });
  linkCases.push({ tag_id: 'nt-jahiz-digital', target_table: 'skills', target_id: 'sk-fs-cy-phishing', active: true, note_en: 'A derived link that should be refused.', note_ar: 'رابط مشتق يجب رفضه هنا.' },
    { tag_id: 'nt-net-zero-2050', target_table: 'cec_competences', target_id: 'cec-3-1', active: true, note_en: 'A derived link that should be refused.', note_ar: 'رابط مشتق يجب رفضه هنا.' },
    { tag_id: 'nt-nes-2031', target_table: 'skills', target_id: (W0.skills.find((s) => s.area === 'security') ?? {}).id ?? 'none', active: true, note_en: 'Security skills stay out of tags.', note_ar: 'مهارات الأمن تبقى خارج الوسوم.' },
    { tag_id: 'nt-missing', target_table: 'skills', target_id: 'sk-fs-ai-use', active: true, note_en: 'Unknown tag link here.', note_ar: 'وسم غير معروف هنا الآن.' });
  const lpSql = [];
  for (const c of linkCases) lpSql.push((await q(`select kafaa_na_link_problem($1::jsonb, (select t from kafaa_national_tags t where id = $2), kafaa_na_target($3, $4), $5) p`,
    [JSON.stringify(c), c.tag_id, c.target_table, c.target_id, c.active !== false]))[0].p);
  const lpTs = linkCases.map((c) => { const v = targetView(W0, c.target_table, c.target_id); return linkProblem({ ...c, active: c.active !== false }, W0.tags.find((t) => t.id === c.tag_id), { exists: v.exists, area: v.area }); });
  const tvOk = [];
  for (const [table, id] of [...new Set(linkCases.map((c) => `${c.target_table}|${c.target_id}`))].map((k) => k.split('|'))) tvOk.push(same((await q('select kafaa_na_target($1, $2) v', [table, id]))[0].v, targetView(W0, table, id)));
  ok(same(lpSql, lpTs) && tvOk.every(Boolean) && lpTs.includes('derived') && lpTs.includes('security'),
    `SQL kafaa_na_link_problem / kafaa_na_target = linkProblem / targetView on ${linkCases.length} cases (derived Jahiz / Net Zero links and security skills refused)`);

  // ── SQL = TS: effective links and the report, for every filter, with and without measures
  const filters = [{}, ...STRATEGIES.map((s) => ({ strategy: s })), ...tags.map((t) => ({ tag_id: t.id })), { kind: 'skill' }, { kind: 'programme' }, { kind: 'target' },
    { strategy: 'net_zero_2050', kind: 'target' }, { tag_id: 'nt-ai-2031', kind: 'programme' }, { strategy: 'bogus', kind: 'x' }, { tag_id: 'nt-unknown' }];
  const parity = async (label) => {
    const W = await world();
    const effOk = same((await q('select kafaa_na_links() j'))[0].j, effectiveLinks(W));
    const diffs = [];
    for (const f of filters) for (const m of [true, false]) {
      const s = (await q('select kafaa_na_report_core($1::jsonb, $2) j', [JSON.stringify(f), m]))[0].j;
      if (!same(s, nationalReport(W, f, m))) diffs.push(`${JSON.stringify(f)}/${m}`);
    }
    ok(effOk && diffs.length === 0, `SQL kafaa_na_links / kafaa_na_report_core = effectiveLinks / nationalReport for ${filters.length} filters x measures on/off (${label})${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
    return W;
  };
  const W1 = await parity('seed');
  const full = nationalReport(W1, {}, true);
  const eff = effectiveLinks(W1);
  ok(eff.filter((l) => l.basis === 'future_group').length === W1.skills.filter((s) => ['digital', 'ten_x', 'data_ai', 'new_economy'].includes(s.future_group) && s.lifecycle !== 'obsolete').length
    && eff.filter((l) => l.basis === 'net_zero').length === W1.cec_competences.filter((c) => c.net_zero).length && !eff.some((l) => l.basis !== 'curated' && l.link_id),
    `wiring FS02/FS41: ${eff.filter((l) => l.basis === 'future_group').length} Jahiz-group links come from skills.future_group and ${eff.filter((l) => l.basis === 'net_zero').length} Net Zero links from cec_competences.net_zero, computed and never stored`);
  ok(full.items.some((i) => i.target_table === 'ai_org_targets' && i.tag_id === 'nt-ai-2031') && full.items.every((i) => i.reasons.length >= 1)
    && full.items.every((i) => i.measure === null || i.measure.n === null || i.measure.n >= 10) && full.tags.every((t) => t.reach === null || t.reach >= 10)
    && full.items.every((i) => i.measure === null || i.measure.base === null || i.measure.base >= 10) && full.items.some((i) => i.measure && i.measure.n !== null),
    'the report: FS09/FS36 AI target tagged to the AI strategy; every item explains its link; every count under 10 suppressed; some measures are shown');

  // generated edits inside a rolled-back transaction: the report follows the data (no stored total)
  const reachOf = (r, id) => r.tags.find((t) => t.tag_id === id)?.reach ?? null;
  const countOf = (r, id, k) => r.tags.find((t) => t.tag_id === id)?.[k] ?? null;
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      update kafaa_skills set future_group = 'digital' where id = 'sk-fs-tr-analytical';
      update kafaa_tag_links set active = false where id in (select id from kafaa_tag_links order by id limit 3);
      update kafaa_national_tags set status = 'retired' where id = 'nt-we-uae-2031-economy';
      update kafaa_person_skills set basis = 'claimed' where id in (select id from kafaa_person_skills where active and skill_id like 'sk-fs-ai-%' order by id limit 15);
      update kafaa_pathways set status = 'draft', listed = false where id = 'pw-ai-use-l1';`);
    const W2 = await parity('generated edits: a Jahiz group change, unlinked rows, a retired pillar, claimed-only states, a draft pathway');
    const r2 = nationalReport(W2, {}, true);
    ok(countOf(r2, 'nt-jahiz-digital', 'skills') === countOf(full, 'nt-jahiz-digital', 'skills') + 1 && !r2.tags.some((t) => t.tag_id === 'nt-we-uae-2031-economy')
      && r2.items.some((i) => i.target_id === 'pw-ai-use-l1' && i.status === 'inactive' && i.reasons.some((x) => x.code === 'na_inactive')),
      'acceptance FS62: reports are filters over the data: changing a skill\'s Jahiz group, retiring a pillar or drafting a pathway changes the report at once, with no stored total to edit');
    void reachOf;
  } finally { await db.exec('rollback'); }

  // ── FS63 acceptance on the database rows
  const roles = await rows('job_roles');
  const occ = D.role_occupations;
  ok(occ.length === 28 && occ.every((o) => roles.find((r) => r.id === o.role_id)?.lifecycle === 'current') && !occ.some((o) => o.role_id.startsWith('fr-'))
    && occ.every((o) => o.skill_level === indicativeLevel(roles.find((r) => r.id === o.role_id).education) && o.level_basis === 'education_rule'),
    'FS63: the 28 current roles carry an occupation label and the indicative level from the education rule; concept roles have no row');
  ok(occ.every((o) => o.code_status === 'pending_review' && o.mohre_code === null && o.code_source === null),
    'acceptance FS63 (settled decision): no code is shown unless verified; the research pack verifies none, so every role reads "code pending review"');
  let ckRefused = false; let guardRefused = false;
  await db.exec('begin');
  try {
    try { await db.exec(`update kafaa_role_occupations set mohre_code = '1234' where id = 'ro-reactor-operator'`); } catch { ckRefused = true; }
  } finally { await db.exec('rollback'); }
  await db.exec('begin');
  try {
    try { await db.exec(`insert into kafaa_role_occupations (id, role_id, label_en, label_ar, skill_level, updated_by) select 'ro-x', id, 'Concept', 'مفهوم', 1, 'p-chco' from kafaa_job_roles where lifecycle = 'concept' limit 1`); } catch { guardRefused = true; }
  } finally { await db.exec('rollback'); }
  ok(ckRefused && guardRefused, 'DB guards: a code without a verified source is refused (kafaa_role_occupations_code_ck); a concept role cannot be mapped (kafaa_ro_guard)');
  const occCases = [];
  for (const o of occ.slice(0, 10)) occCases.push({ ...o }, { ...o, skill_level: 4 }, { ...o, level_basis: 'reviewed' }, { ...o, level_basis: 'reviewed', skill_level: 2, rationale_en: 'Licensed role reviewed against the classification.', rationale_ar: 'دور مرخّص تمت مراجعته مقابل التصنيف المعتمد.' },
    { ...o, label_ar: '' }, { ...o, label_en: 'Operator 3' }, { ...o, skill_level: 6 }, { ...o, skill_level: '2' }, { ...o, level_basis: 'other' });
  const concept = roles.find((r) => r.lifecycle === 'concept');
  occCases.push({ ...occ[0], role_id: concept.id }, { ...occ[0], role_id: 'nope' });
  const opSql = (await q('select kafaa_ro_problem(x) p from jsonb_array_elements($1::jsonb) x', [JSON.stringify(occCases)])).map((r) => r.p);
  const opTs = occCases.map((c) => occupationProblem(c, roles.find((r) => r.id === c.role_id)));
  const codeCases = [
    { code: '1234.5', source_label: 'MoHRE classification', source_url: 'https://www.mohre.gov.ae/en/x', source_as_of: '2026-10-10' },
    { code: '1234', source_label: 'u.ae classification page', source_url: 'https://u.ae/en/x', source_as_of: '2026-10-10' },
    { code: '1234', source_label: 'Khaleej Times', source_url: 'https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme', source_as_of: '2026-10-10' },
    { code: 'ab', source_label: 'MoHRE', source_url: 'https://www.mohre.gov.ae', source_as_of: '2026-10-10' },
    { code: '1234', source_label: 'MoHRE', source_url: 'http://www.mohre.gov.ae', source_as_of: '2026-10-10' },
    { code: '1234', source_label: 'MoHRE', source_url: 'https://www.mohre.gov.ae', source_as_of: '2099-01-01' },
    { code: '1234', source_label: 'x', source_url: 'https://www.mohre.gov.ae', source_as_of: '2026-10-10' },
    { code: '1234', source_label: 'Fake domain', source_url: 'https://mohre.gov.ae.example.com', source_as_of: '2026-10-10' },
  ];
  const cpSql = (await q('select kafaa_ro_code_problem(x, $2::date) p from jsonb_array_elements($1::jsonb) x', [JSON.stringify(codeCases), today])).map((r) => r.p);
  ok(same(opSql, opTs) && same(cpSql, codeCases.map((c) => codeProblem(c, today))) && cpSql[2] === 'host' && cpSql[7] === 'host' && cpSql[0] === null,
    `SQL kafaa_ro_problem / kafaa_ro_code_problem = occupationProblem / codeProblem (${occCases.length} + ${codeCases.length} cases; press pages and look-alike domains never verify a code)`);
  const tr = (await q('select kafaa_ro_trend_core(current_date) j'))[0].j;
  const people = await rows('people');
  const trTs = occupationTrend(people, occ, today);
  ok(same(tr, trTs) && tr.simulated === true && tr.years.every((y) => (y.total === null || y.total >= 10) && y.levels.every((l) => l.n === null || l.n >= 10)) && tr.years.some((y) => y.levels.some((l) => l.n === null)) && tr.years.some((y) => y.upper_pct !== null),
    `acceptance FS63: the uplift trend is SIMULATED and every cell under 10 is suppressed; SQL kafaa_ro_trend_core = occupationTrend (${tr.years.length} years, ${tr.years.flatMap((y) => y.levels).filter((l) => l.n === null).length} level cells suppressed)`);

  // ── RLS: national_alignment readers only
  const seen = {};
  for (const p of [null, 'sro', 'k-auditor', 'chco', 'k-hr-analyst', 'alnoor-gm', 'k-university', 'k-observer']) seen[p ?? 'anon'] = await Promise.all(M37.map((t) => count(p, `kafaa_${t}`)));
  const fullN = M37.map((t) => S[t].length);
  ok(['sro', 'k-auditor', 'chco', 'k-hr-analyst'].every((p) => same(seen[p], fullN)) && ['anon', 'alnoor-gm', 'k-university', 'k-observer'].every((p) => same(seen[p], [0, 0, 0])),
    `RLS: staff, HR and auditors read tags, links and mappings (national_alignment R); anonymous, partners, universities and observers read nothing (${JSON.stringify(seen)})`);
  let direct = false;
  try { await as('chco', `insert into kafaa_tag_links (id, tag_id, target_table, target_id, note_en, note_ar, created_by) values ('x', 'nt-nes-2031', 'skills', 'sk-fs-ai-use', 'x', 'x', 'x')`); } catch { direct = true; }
  ok(direct, 'tags, links and mappings cannot be written through the API, only through the RPCs');

  // ── RPCs (inside a rolled-back transaction)
  const audits = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const ledgers = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const rep = (await one('k-hr-analyst', 'select kafaa_national_report($1::jsonb) r', [JSON.stringify({ strategy: 'ai_2031' })])).r;
  const repStaff = (await one('sro', 'select kafaa_national_report($1::jsonb) r', [JSON.stringify({ strategy: 'ai_2031' })])).r;
  const nulls = [(await one('alnoor-gm', 'select kafaa_national_report() r')).r, (await one('k-observer', 'select kafaa_national_report() r')).r, (await one('sro', 'select kafaa_occupation_trend() r')).r];
  let anon = 0; for (const f of ['kafaa_national_report()', 'kafaa_occupation_trend()']) { try { await as(null, `select ${f}`); } catch { anon++; } }
  const a0 = await audits();
  const tr2 = (await one('chco', 'select kafaa_occupation_trend() r')).r;
  ok(rep && rep.measures === true && same(rep, (await q('select kafaa_na_report_core($1::jsonb, true) j', [JSON.stringify({ strategy: 'ai_2031' })]))[0].j)
    && repStaff && repStaff.measures === false && repStaff.items.every((i) => i.measure === null) && repStaff.tags.every((t) => t.reach === null)
    && nulls.every((x) => x === null) && anon === 2 && same(tr2, tr) && (await audits()) === a0 && !JSON.stringify(rep).includes('"p-'),
    'kafaa_national_report: HR (Agg) gets measures, staff (R) the same filter without measures, partners and observers null, anonymous cannot execute; reads are not audited and carry no person ids; HR director reads the trend');
  await db.exec('begin');
  try {
    const A = await audits(); const L = await ledgers();
    const newTag = { strategy: 'nes_2031', kind: 'goal', parent_id: 'nt-nes-2031', code: 'NES-DIGITAL', name_en: 'Digital skills for the workforce', name_ar: 'المهارات الرقمية للقوى العاملة',
      summary_en: 'A goal added in the demo to show how a new goal is tagged and reported.', summary_ar: 'هدف أُضيف في العرض التوضيحي لبيان كيفية وسم هدف جديد والإبلاغ عنه.', sources: [{ label: 'u.ae NES page', url: 'https://u.ae/about-the-uae', as_of: '2026-10-10' }] };
    const forb = (await one('sro', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify(newTag)])).r;
    const typed = (await one('chco', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify({ ...newTag, summary_en: 'A goal for the national workforce, reaching 610,000 by 2031.' })])).r;
    const add = (await one('chco', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify(newTag)])).r;
    const dupe = (await one('k-admin', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify(newTag)])).r;
    const strat2 = (await one('chco', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify({ ...newTag, kind: 'strategy', parent_id: null, code: 'NES-AGAIN' })])).r;
    const row = (await q(`select * from kafaa_national_tags where id = 'nt-nes-digital'`))[0];
    ok(!forb.ok && forb.code === 'forbidden' && !typed.ok && typed.code === 'invalid' && /typed number/.test(typed.message) && add.ok && add.data.id === 'nt-nes-digital' && row?.sources[0].tier === 'official'
      && !dupe.ok && dupe.code === 'code_taken' && !strat2.ok && strat2.code === 'conflict' && (await audits()) === A + 5 && (await ledgers()) === L + 1,
      'kafaa_save_national_tag: staff refused; a typed total refused; the HR director adds a goal (tier computed, ledger); duplicate codes and a second strategy-level tag refused; every call audited');
    const link = (await one('chco', 'select kafaa_set_tag_link($1::jsonb) r', [JSON.stringify({ tag_id: 'nt-nes-digital', target_table: 'skills', target_id: 'sk-fs-dp-rounds', active: true, note_en: 'Digital rounds are a workforce digital skill.', note_ar: 'الجولات الرقمية مهارة رقمية للقوى العاملة.' })])).r;
    const derived = (await one('chco', 'select kafaa_set_tag_link($1::jsonb) r', [JSON.stringify({ tag_id: 'nt-jahiz-digital', target_table: 'skills', target_id: 'sk-fs-ai-use', active: true, note_en: 'Should be refused as derived.', note_ar: 'يجب رفضه لأنه مشتق من البيانات.' })])).r;
    const unlink = (await one('k-admin', 'select kafaa_set_tag_link($1::jsonb) r', [JSON.stringify({ tag_id: 'nt-nes-digital', target_table: 'skills', target_id: 'sk-fs-dp-rounds', active: false })])).r;
    const ghost = (await one('chco', 'select kafaa_set_tag_link($1::jsonb) r', [JSON.stringify({ tag_id: 'nt-nes-digital', target_table: 'skills', target_id: 'sk-fs-ai-use', active: false })])).r;
    const lrow = (await q(`select * from kafaa_tag_links where id = 'tl:nt-nes-digital:skills:sk-fs-dp-rounds'`))[0];
    ok(link.ok && !derived.ok && /derived/.test(derived.message) && unlink.ok && unlink.data.active === false && lrow && lrow.active === false && lrow.note_en.startsWith('Digital') && !ghost.ok && ghost.code === 'not_found',
      'kafaa_set_tag_link: links a skill; a derived Jahiz link refused; unlinking deactivates the row (kept with its note); unlinking a link that never existed is not found');
    const retireParent = (await one('chco', 'select kafaa_save_national_tag($1::jsonb) r', [JSON.stringify({ ...tags.find((t) => t.id === 'nt-nes-2031'), status: 'retired' })])).r;
    ok(!retireParent.ok && /retire its pillars/.test(retireParent.message), 'a strategy-level tag with active goals cannot be retired before them');
    // FS63
    const L2 = await ledgers();
    const occIn = { role_id: 'reactor-operator', label_en: 'Nuclear reactor operator', label_ar: 'مشغّل مفاعل نووي', skill_level: 2, level_basis: 'reviewed', rationale_en: 'Licensed role reviewed: higher than the entry education suggests.', rationale_ar: 'دور مرخّص تمت مراجعته: أعلى مما يوحي به مؤهل الدخول.' };
    const staffSave = (await one('sro', 'select kafaa_save_role_occupation($1::jsonb) r', [JSON.stringify(occIn)])).r;
    const conceptSave = (await one('chco', 'select kafaa_save_role_occupation($1::jsonb) r', [JSON.stringify({ ...occIn, role_id: concept.id })])).r;
    const save = (await one('chco', 'select kafaa_save_role_occupation($1::jsonb) r', [JSON.stringify(occIn)])).r;
    const code = { role_id: 'reactor-operator', code: '3131.1', source_label: 'MoHRE classification (test)', source_url: 'https://www.mohre.gov.ae/en/test', source_as_of: '2026-10-10' };
    const hrVerify = (await one('chco', 'select kafaa_verify_occupation_code($1::jsonb) r', [JSON.stringify(code)])).r;
    const press = (await one('k-admin', 'select kafaa_verify_occupation_code($1::jsonb) r', [JSON.stringify({ ...code, source_url: 'https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme' })])).r;
    const verify = (await one('k-admin', 'select kafaa_verify_occupation_code($1::jsonb) r', [JSON.stringify(code)])).r;
    const vrow = (await q(`select * from kafaa_role_occupations where id = 'ro-reactor-operator'`))[0];
    const adminSave = (await one('k-admin', 'select kafaa_save_role_occupation($1::jsonb) r', [JSON.stringify({ ...occIn, role_id: 'local-operator', skill_level: 3, level_basis: 'education_rule' })])).r;
    const selfVerify = (await one('k-admin', 'select kafaa_verify_occupation_code($1::jsonb) r', [JSON.stringify({ ...code, role_id: 'local-operator' })])).r;
    const clearShort = (await one('k-admin', 'select kafaa_clear_occupation_code($1, $2) r', ['reactor-operator', 'short'])).r;
    const clear = (await one('ai-governance', 'select kafaa_clear_occupation_code($1, $2) r', ['reactor-operator', 'Source page withdrawn; re-check needed.'])).r;
    const crow = (await q(`select * from kafaa_role_occupations where id = 'ro-reactor-operator'`))[0];
    ok(!staffSave.ok && staffSave.code === 'forbidden' && !conceptSave.ok && /concept roles/.test(conceptSave.message) && save.ok && !hrVerify.ok && hrVerify.code === 'forbidden'
      && !press.ok && /official UAE government/.test(press.message) && verify.ok && vrow.code_status === 'verified' && vrow.mohre_code === '3131.1' && vrow.verified_on
      && adminSave.ok && !selfVerify.ok && selfVerify.code === 'maker_checker' && !clearShort.ok && clear.ok && crow.code_status === 'pending_review' && crow.mohre_code === null
      && crow.history.map((h) => h.change).join(',') === 'save,save,verify,clear' && (await ledgers()) === L2 + 2,
      'FS63 RPCs: staff refused; concept roles refused; HR director edits a level with a rationale but cannot verify a code; a press page never verifies; the admin verifies from an official page (ledger); the last editor cannot verify (maker-checker); clearing needs a reason and returns "pending review" (ledger)');
  } finally { await db.exec('rollback'); }

  // ── grants: authenticated executes only the seven RPCs, anon none; helpers by nobody
  const grants = await q(`select routine_name, grantee from information_schema.routine_privileges where routine_name = any($1) and grantee in ('anon', 'authenticated') order by 1, 2`, [FUNCS]);
  let internal = 0;
  for (const f of ["kafaa_na_links()", "kafaa_na_report_core('{}', true)", "kafaa_ro_trend_core(current_date)", "kafaa_na_measure('skills', 'sk-fs-ai-use')", "kafaa_na_target('skills', 'sk-fs-ai-use')"]) { try { await as('chco', `select ${f}`); } catch { internal++; } }
  ok(internal === 5 && same(grants.map((g) => `${g.routine_name}:${g.grantee}`), RPCS.map((r) => `${r}:authenticated`)),
    `internal rules are not executable by API roles; authenticated executes only the seven RPCs, anon none (${grants.map((g) => g.routine_name).join(', ')})`);

  // ── additive migration
  const sql = readFileSync('supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql', 'utf8');
  const created = [...sql.matchAll(/create (?:table if not exists|or replace function|(?:unique )?index if not exists|trigger) (\w+)/g)].map((m) => m[1]);
  const altered = [...sql.matchAll(/alter (?:table|policy \w+ on) (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && created.every((n) => n.startsWith('kafaa_')) && altered.every((n) => n.startsWith('kafaa_')) && !/\binsert into\b(?![^;]*kafaa_)|\bupdate (?!kafaa_)\w+ set\b/i.test(sql),
    `the migration is additive: ${created.length} kafaa_* objects created, no removal words, writes and alters only kafaa_* objects (inside the RPCs)`);

  // ── digests for the live comparison
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  console.log(`    fs72 function md5: ${md5.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const t of M37) {
    const d = (await q(`select count(*)::int n, left(md5(coalesce(string_agg(t.id, '|' order by t.id), '')), 8) ids, left(md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')), 8) rws from kafaa_${t} t`))[0];
    console.log(`    fs72 digest kafaa_${t}: ${d.n} rows, ids ${d.ids}, rows ${d.rws}`);
  }
}
