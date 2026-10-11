// [FS wave E · E5 · FS49] PGlite checks for 20261010255001_kafaa_fs55_ai_safety_culture.sql (safety culture for an AI-augmented plant, M08).
// Seed acceptance (every HU card in EN and AR links a live drill or lesson; every international lesson carries a public https source, its
// year and an as-of date; questioning attitude and decision-making carry AI examples); SQL = TS parity of the content rules
// (kafaa_fs49_hu_problems = huCardProblems, kafaa_fs49_lesson_problems = lessonProblems) on every seeded row plus generated mutants, with
// and without references; the guard trigger for API writers (direct RLS writes, refusals by code); RLS (HU cards public, lessons staff
// only, writes for internal_content W only); the guarded migration replay equals the seed and never overwrites an edited row; grants;
// additivity. Writes run inside a transaction that is rolled back. Prints the function md5s and table digests for the live comparison.
import { readFileSync } from 'node:fs';
import { CUE_IDS, SITUATIONS, huCardProblems, lessonProblems, matchSituation } from '../../src/modules/m08/aiCulture.ts';

const MIG = 'supabase/migrations/20261010255001_kafaa_fs55_ai_safety_culture.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' && !(v instanceof Date) ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : v instanceof Date ? JSON.stringify(v.toISOString().slice(0, 10)) : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const FNS = ['kafaa_fs49_cue_ids', 'kafaa_fs49_blank', 'kafaa_fs49_bi_ok', 'kafaa_fs49_hu_problems', 'kafaa_fs49_lesson_problems', 'kafaa_fs49_content_guard'];

export default async function fs55Checks({ db, as, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave E · E5 · FS49 safety culture for an AI-augmented plant');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── seed acceptance
  const liveDrills = new Set(T.ai_drills.filter((d) => d.status === 'published' && d.listed).map((d) => d.id));
  const pubLessons = new Set(T.oe_lessons.filter((o) => o.status === 'published').map((o) => o.id));
  const aiCards = T.hu_tools.filter((h) => h.topic === 'ai_automation');
  ok(aiCards.length === 4 && ['hu-ai-bias', 'hu-ai-mode', 'hu-ai-reliance', 'hu-ai-verify'].every((id) => aiCards.some((h) => h.id === id)),
    'seed: the four AI-era HU cards (automation bias, mode awareness, over-reliance, verify against the controlled source)');
  ok(T.hu_tools.length === 12 && T.hu_tools.every((h) => h.name_en.trim() && h.name_ar.trim() && h.description_en.trim() && h.description_ar.trim() && /[؀-ۿ]/.test(h.name_ar) && /[؀-ۿ]/.test(h.description_ar))
    && T.hu_tools.every((h) => h.drill_ids.some((d) => liveDrills.has(d)) || h.lesson_ids.some((l) => pubLessons.has(l))),
    'acceptance (FS49): each of the 12 HU tool cards exists in EN and AR and links at least one published drill or lesson');
  const aiL = T.oe_lessons.filter((o) => o.topic === 'ai_automation');
  ok(aiL.length === 7 && aiL.every((o) => o.status === 'published' && o.sample === false && o.deidentified && o.reviewed_on && o.reviewing_body
    && o.sources.length >= 1 && o.sources.every((s) => /^https:\/\//.test(s.url) && s.label && Number.isInteger(s.year) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of))),
    'acceptance (FS49): all 7 international lessons on automation and digital systems carry a public https source, its year and an as-of date');
  const packs = ['nuclear_energy', 'corporate_platforms', 'global_frameworks'].map((f) => { try { return readFileSync(`../docs/kafaa/ref/research/${f}.md`, 'utf8'); } catch { return null; } });
  if (packs.every(Boolean)) ok(aiL.every((o) => o.sources.every((s) => packs.some((p) => p.includes(s.url.replace(/^https:\/\//, ''))))), 'every lesson source URL is one of the research-pack sources (no invented sources)');
  ok(T.sc_traits.filter((t) => t.ai_behaviours.length).map((t) => t.id).join() === 'trait-2,trait-5' && T.sc_traits.filter((t) => t.ai_behaviours.length).every((t) => t.ai_prompts.length >= 2 && t.ai_hu_ids.length >= 2),
    'seed: questioning attitude (trait-2) and decision-making (trait-5) carry AI behaviours, prompts and linked HU cards; no other trait changed');
  ok(SITUATIONS.every((s) => matchSituation(s.id, T.hu_tools).length >= 1 && matchSituation(s.id, T.hu_tools)[0].card.topic === 'ai_automation'), 'every situation matches HU cards, led by an AI-era card');

  // ── SQL = TS on the seeded rows
  const huRows = (await q('select to_jsonb(t) j from kafaa_hu_tools t order by id')).map((r) => r.j);
  const leRows = (await q('select to_jsonb(t) j from kafaa_oe_lessons t order by id')).map((r) => r.j);
  const refs = { drills: (await q('select id from kafaa_ai_drills')).map((r) => r.id), lessons: leRows.map((r) => r.id), traits: (await q('select id from kafaa_sc_traits')).map((r) => r.id) };
  ok(huRows.length === 12 && leRows.length === 13, 'database: 12 HU cards and 13 OE lessons after migrations + seed (applied twice)');
  ok(canon((await q('select kafaa_fs49_cue_ids() c'))[0].c) === canon(CUE_IDS), 'SQL cue list equals CUE_IDS');
  const sqlHu = async (j, r) => (await q('select kafaa_fs49_hu_problems($1::jsonb, $2) v', [JSON.stringify(j), r]))[0].v;
  const sqlLe = async (j, r) => (await q('select kafaa_fs49_lesson_problems($1::jsonb, $2) v', [JSON.stringify(j), r]))[0].v;
  let diff = [];
  for (const h of huRows) { const s = await sqlHu(h, true); if (canon(s) !== canon(huCardProblems(h, refs)) || s.length) diff.push(h.id); }
  ok(diff.length === 0, `SQL kafaa_fs49_hu_problems equals huCardProblems (no problem) for all ${huRows.length} seeded cards${diff.length ? ` (${diff[0]})` : ''}`);
  diff = [];
  for (const l of leRows) { const s = await sqlLe(l, true); if (canon(s) !== canon(lessonProblems(l, { drills: refs.drills })) || s.length) diff.push(l.id); }
  ok(diff.length === 0, `SQL kafaa_fs49_lesson_problems equals lessonProblems (no problem) for all ${leRows.length} seeded lessons${diff.length ? ` (${diff[0]})` : ''}`);

  // ── SQL = TS on generated mutants (with and without references)
  let seed = 49;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pickOf = (a) => a[Math.floor(rand() * a.length)];
  const blanks = ['', ' ', '\t\n', null, 7, 'x', 'نص'];
  const huMut = [
    (c) => ({ ...c, name_en: pickOf(blanks) }), (c) => ({ ...c, name_ar: pickOf(blanks) }), (c) => ({ ...c, description_ar: pickOf(blanks) }),
    (c) => ({ ...c, ai_en: pickOf(blanks) }), (c) => ({ ...c, ai_ar: pickOf(blanks) }), (c) => ({ ...c, trap_en: pickOf(blanks) }), (c) => ({ ...c, example_ar: pickOf(blanks) }),
    (c) => ({ ...c, topic: c.topic === 'classic' ? 'ai_automation' : 'classic' }),
    (c) => ({ ...c, practice: pickOf([[], null, 'x', [{ en: 'a', ar: 'ب' }], [{ en: 'a', ar: 'ب' }, { en: 'c', ar: 'د' }], [{ en: 'a' }, { en: 'b', ar: 'ج' }], [{ en: ' ', ar: 'ب' }, { en: 'b', ar: 'ج' }], ['x', 'y'], [{ en: 1, ar: 'ب' }, { en: 'c', ar: 'د' }]]) }),
    (c) => ({ ...c, cues: pickOf([[], ['mode'], ['nope'], ['mode', 3], 'mode', null, CUE_IDS.slice(0, 4)]) }),
    (c) => ({ ...c, drill_ids: pickOf([[], ['ad-valve-lineup'], ['ad-nope'], ['ad-outage-scope']]) }),
    (c) => ({ ...c, lesson_ids: pickOf([[], ['oe-1'], ['oe-nope'], ['oe-ai-03']]) }),
    (c) => ({ ...c, trait_ids: pickOf([[], ['trait-2'], ['trait-99']]) }),
    (c) => { const x = { ...c }; delete x[pickOf(['practice', 'cues', 'drill_ids', 'name_en', 'ai_ar'])]; return x; },
  ];
  diff = [];
  let nh = 0;
  for (let g = 0; g < 360; g++) {
    let c = pickOf(huRows);
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) c = pickOf(huMut)(c);
    for (const r of [true, false]) {
      nh++;
      const s = await sqlHu(c, r), t = huCardProblems(c, r ? refs : null);
      if (canon(s) !== canon(t)) diff.push(`${g}/${r}: sql ${canon(s)} ts ${canon(t)}`);
    }
  }
  ok(diff.length === 0, `SQL kafaa_fs49_hu_problems equals huCardProblems on ${nh} generated cards${diff.length ? ` (${diff[0]})` : ''}`);
  const src0 = { label: 'L', url: 'https://example.org/x', year: 2025, as_of: '2026-10-10' };
  const leMut = [
    (l) => ({ ...l, topic: l.topic === 'general' ? 'ai_automation' : 'general' }), (l) => ({ ...l, title_ar: pickOf(blanks) }), (l) => ({ ...l, lesson_en: pickOf(blanks) }),
    (l) => ({ ...l, sources: pickOf([[], null, 'x', [src0], [src0, { ...src0, url: 'http://example.org' }], [{ ...src0, url: 'https://a b' }], [{ ...src0, label: ' ' }], [{ ...src0, year: 2025.5 }],
      [{ ...src0, year: '2025' }], [{ ...src0, year: 1980 }], [{ ...src0, year: 2025.0 }], [{ ...src0, as_of: '2026-10' }], [{ ...src0, as_of: null }], ['x'], [{}], [{ ...src0, url: 7 }]]) }),
    (l) => ({ ...l, drill_ids: pickOf([[], ['ad-mov-pm'], ['ad-nope']]) }), (l) => ({ ...l, hu_ids: pickOf([[], ['hu-nope']]) }),
  ];
  diff = [];
  let nl = 0;
  for (let g = 0; g < 300; g++) {
    let l = pickOf(leRows);
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) l = pickOf(leMut)(l);
    for (const r of [true, false]) {
      nl++;
      const s = await sqlLe(l, r), t = lessonProblems(l, r ? { drills: refs.drills } : null);
      if (canon(s) !== canon(t)) diff.push(`${g}/${r}: sql ${canon(s)} ts ${canon(t)}`);
    }
  }
  ok(diff.length === 0, `SQL kafaa_fs49_lesson_problems equals lessonProblems on ${nl} generated lessons${diff.length ? ` (${diff[0]})` : ''}`);

  // ── RLS
  ok((await count(null, 'kafaa_hu_tools')) === 12 && (await count(null, 'kafaa_hu_tools', "topic = 'ai_automation' and cardinality(drill_ids) > 0")) === 4, 'anonymous visitors read all 12 HU cards (public), with their drill links');
  const anonLessons = await count(null, 'kafaa_oe_lessons').catch(() => 0);
  ok(anonLessons === 0 && (await count('sro', 'kafaa_oe_lessons', "topic = 'ai_automation'")) === 7, 'OE lessons stay staff-only: anon reads none, staff read the 7 sourced AI lessons');

  // ── writes and the guard (inside a rolled-back transaction)
  const tryAs = async (persona, sql, params = []) => {
    await db.exec('savepoint fs55');
    try {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
      await db.exec(persona ? 'set local role authenticated' : 'set local role anon');
      const rows = (await db.query(sql, params)).rows;
      await db.exec('reset role');
      await db.exec('release savepoint fs55');
      return { ok: true, rows };
    } catch (e) {
      await db.exec('rollback to savepoint fs55');
      await db.exec('reset role');
      return { ok: false, msg: String(e.message) };
    }
  };
  await db.exec('begin');
  try {
    const ed1 = await tryAs('training-mgr', `update kafaa_hu_tools set ai_en = 'Edited angle', ai_ar = 'زاوية معدلة' where id = 'hu-6' returning id`);
    ok(ed1.ok && ed1.rows.length === 1, 'the training manager (internal_content W) edits an HU card directly');
    const nolink = await tryAs('training-mgr', `update kafaa_hu_tools set drill_ids = '{}', lesson_ids = '{}' where id = 'hu-ai-bias' returning id`);
    const unk = await tryAs('k-instructor', `update kafaa_hu_tools set drill_ids = array['ad-nope'] where id = 'hu-ai-mode' returning id`);
    const noar = await tryAs('training-mgr', `update kafaa_hu_tools set name_ar = ' ' where id = 'hu-3' returning id`);
    ok(!nolink.ok && /kafaa_fs49: links/.test(nolink.msg) && !unk.ok && /kafaa_fs49: drill_unknown/.test(unk.msg) && !noar.ok && /kafaa_fs49: name/.test(noar.msg),
      'the guard refuses a card with no drill or lesson, an unknown drill and a missing Arabic name (codes in the message)');
    const card = { id: 'hu-ai-test', name_en: 'Test card', name_ar: 'بطاقة اختبار', description_en: 'd', description_ar: 'و', kind: 'conditional', topic: 'ai_automation', sort: 9, ai_en: '', ai_ar: '', trap_en: 't', trap_ar: 'ت', example_en: 'e', example_ar: 'م',
      practice: [{ en: 'a', ar: 'أ' }, { en: 'b', ar: 'ب' }], cues: ['mode'], trait_ids: [], drill_ids: ['ad-valve-lineup'], lesson_ids: [] };
    const ins = await tryAs('training-mgr', `insert into kafaa_hu_tools select * from jsonb_populate_record(null::kafaa_hu_tools, $1::jsonb) returning id`, [JSON.stringify(card)]);
    const insBad = await tryAs('training-mgr', `insert into kafaa_hu_tools select * from jsonb_populate_record(null::kafaa_hu_tools, $1::jsonb) returning id`, [JSON.stringify({ ...card, id: 'hu-ai-test2', practice: [{ en: 'a', ar: 'أ' }] })]);
    ok(ins.ok && !insBad.ok && /kafaa_fs49: practice/.test(insBad.msg), 'a complete new AI-era card is accepted; one with a single practice step is refused');
    const emp = await tryAs('sro', `update kafaa_hu_tools set ai_en = 'x' where id = 'hu-1' returning id`);
    const anonW = await tryAs(null, `update kafaa_hu_tools set ai_en = 'x' where id = 'hu-1' returning id`);
    ok(emp.ok && emp.rows.length === 0 && (anonW.ok ? anonW.rows.length === 0 : true), 'staff without internal_content W and anonymous visitors cannot change HU cards (RLS)');
    const le = { id: 'oe-ai-test', title_en: 'T', title_ar: 'ع', summary_en: 'S', summary_ar: 'م', lesson_en: 'L', lesson_ar: 'د', source_kind: 'IAEA', reviewed_on: '2026-10-10', reviewing_body: 'OE Screening Committee', status: 'draft', topic: 'ai_automation', sources: [], sample: false, trait_ids: [], deidentified: true, affected_standard_ids: [], hu_ids: [], drill_ids: [] };
    const leBad = await tryAs('training-mgr', `insert into kafaa_oe_lessons select * from jsonb_populate_record(null::kafaa_oe_lessons, $1::jsonb) returning id`, [JSON.stringify(le)]);
    const leOk = await tryAs('training-mgr', `insert into kafaa_oe_lessons select * from jsonb_populate_record(null::kafaa_oe_lessons, $1::jsonb) returning id`, [JSON.stringify({ ...le, sources: [src0] })]);
    const leGen = await tryAs('training-mgr', `insert into kafaa_oe_lessons select * from jsonb_populate_record(null::kafaa_oe_lessons, $1::jsonb) returning id`, [JSON.stringify({ ...le, id: 'oe-gen-test', topic: 'general' })]);
    const leHttp = await tryAs('training-mgr', `update kafaa_oe_lessons set sources = $1::jsonb where id = 'oe-ai-01' returning id`, [JSON.stringify([{ ...src0, url: 'http://example.org' }])]);
    ok(!leBad.ok && /kafaa_fs49: sources/.test(leBad.msg) && leOk.ok && leGen.ok && !leHttp.ok && /source_url/.test(leHttp.msg),
      'acceptance (FS49): an AI lesson without a public https source is refused; general lessons keep their existing rules');
    // guarded migration replay: the pre-FS49 live rows (defaults) become exactly the seeded rows; edited rows are never overwritten
    await db.exec('reset role');
    await db.exec(`set local session_replication_role = replica`);
    await db.exec(`update kafaa_hu_tools set topic = 'classic', sort = 0, ai_en = '', ai_ar = '', cues = '{}', trait_ids = '{}', drill_ids = '{}', lesson_ids = '{}' where id in ('hu-1','hu-2','hu-3','hu-4','hu-5','hu-7','hu-8')`);
    await db.exec(`update kafaa_sc_traits set ai_behaviours = '[]', ai_prompts = '[]', ai_hu_ids = '{}'`);
    await db.exec(`set local session_replication_role = origin`);
    await db.exec(readFileSync(MIG, 'utf8'));
    await db.exec(readFileSync(MIG, 'utf8'));
    const cols = ['topic', 'sort', 'ai_en', 'ai_ar', 'cues', 'trait_ids', 'drill_ids', 'lesson_ids'];
    const hu = await q(`select id, ${cols.join(', ')} from kafaa_hu_tools where id like 'hu-_' order by id`);
    const want = T.hu_tools.filter((h) => /^hu-\d$/.test(h.id)).sort((a, b) => (a.id < b.id ? -1 : 1)).map((h) => Object.fromEntries([['id', h.id], ...cols.map((c) => [c, h[c]])]));
    want.find((w) => w.id === 'hu-6').ai_en = 'Edited angle';
    want.find((w) => w.id === 'hu-6').ai_ar = 'زاوية معدلة';
    const tr = await q(`select id, ai_behaviours, ai_prompts, ai_hu_ids from kafaa_sc_traits order by n`);
    const wantTr = [...T.sc_traits].sort((a, b) => a.n - b.n).map((t) => ({ id: t.id, ai_behaviours: t.ai_behaviours, ai_prompts: t.ai_prompts, ai_hu_ids: t.ai_hu_ids }));
    ok(canon(hu) === canon(want) && canon(tr) === canon(wantTr), 'migration replay on pre-FS49 rows gives exactly the seeded HU and trait values (twice: idempotent); an edited card is not overwritten');
  } finally {
    await db.exec('rollback');
    await db.exec('reset role');
  }

  // ── grants and additivity
  const grants = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u from pg_proc p where p.proname like 'kafaa\\_fs49\\_%'`);
  ok(grants.length === FNS.length && grants.every((g) => !g.a && !g.u), `none of the ${FNS.length} FS49 functions is executable by anon or authenticated (internal rules and the guard)`);
  ok((await q(`select tgname from pg_trigger where tgname in ('kafaa_fs49_hu_tools_guard', 'kafaa_fs49_oe_lessons_guard')`)).length === 2, 'the content guard triggers are installed on kafaa_hu_tools and kafaa_oe_lessons');
  const sql = readFileSync(MIG, 'utf8');
  const forbidden = ['dr' + 'op', 'del' + 'ete', 'trun' + 'cate'];
  ok(!forbidden.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(sql)) && [...sql.matchAll(/alter table\s+(\w+)/gi)].every((m) => m[1].startsWith('kafaa_'))
    && [...sql.matchAll(/create or replace function\s+(\w+)/gi)].every((m) => m[1].startsWith('kafaa_fs49_')) && !/create policy|grant execute/i.test(sql),
    'migration is additive: kafaa_* objects only, no removal words, no new policy and no grant to API roles');

  // ── digests for the live comparison (handover 3.10)
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'kafaa\\_fs49\\_%' order by 1`);
  console.log(`    fs49 function md5: ${md5.map((r) => `${r.proname} ${r.m}`).join('; ')}`);
  for (const t of ['kafaa_hu_tools', 'kafaa_oe_lessons', 'kafaa_sc_traits']) {
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) d from public.${t} t`))[0];
    console.log(`    digest ${t}: ${d.n}:${d.d}`);
  }
}
