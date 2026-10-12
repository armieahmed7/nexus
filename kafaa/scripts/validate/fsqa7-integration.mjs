// [FS QA · wave G integration] PGlite checks for 20261010279001_kafaa_fs7qa_integration.sql (cross-feature wiring of FS60-FS69 and the FS48
// mentoring card carried over from wave E).
//  1. FS60 inputs: kafaa_hcd_compute reproduces both stored quarters on the final seed (every wave-G builder ran); the metrics name their
//     input tables (FS50 register, FS09/FS36 AI rungs, training records, xAPI statements, FS30 credits) and those tables exist.
//  2. FS61: kafaa_spl_reference = referenceOf(kafaa_benchmarks) (listed FSC row, https source); no M35 page or string types the figure.
//  3. FS62: kafaa_na_links derives the FS41 Net Zero and FS02 Jahiz links and carries the FS09/FS36 AI target link (= effectiveLinks).
//  4. FS64 <- FS51: every released demand row = kafaa_rg_rows of a released forecast; partners and universities read no forecast row.
//  5. FS66 <- FS57/FS08 + 3.9: an endorsement writes programme evidence; kafaa_skills_apply keeps it (recorded by kind credential).
//  6. FS69 -> FS32: kafaa_verify_record_share labels a pre-arrival share ('prearrival'), other shares 'record'; closed links stay empty.
//  7. Partner isolation: alnoor-gm and gulfhydro-qa never read each other's FS64 commitments, FS65 pledges or FS68 readiness.
//  8. FS48: the guarded card statement moves a v13 card to v14 with the FS48 wording (from the pre-FS48 text and from the FS55-reconciled
//     text), changes nothing on a second run or on the local v2 card.
//  9. RLS perf form on the 15 new wave-G tables; additivity and grants of the QA migration; md5s for the live comparison.
import { readFileSync, readdirSync } from 'node:fs';
import { referenceOf } from '../../src/modules/m35/pilots.ts';
import { effectiveLinks } from '../../src/modules/m37/national.ts';
import { applyFs48CardStep } from '../seed/ext/fsqa7-integration.mjs';

const FILE = 'supabase/migrations/20261010279001_kafaa_fs7qa_integration.sql';
const NEW_TABLES = ['hc_metrics', 'hc_disclosures', 'skill_pilots', 'national_tags', 'tag_links', 'role_occupations', 'regional_demand', 'provider_commitments', 'pledges',
  'pledge_progress', 'programme_alignments', 'programme_graduates', 'fellowships', 'fellowship_milestones', 'prearrival_shares'];
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined && v[k] !== null).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const addYears = (d, n) => `${Number(d.slice(0, 4)) + n}${d.slice(4)}`;

export default async function fsqa7Checks({ db, as, one, ok, uid }) {
  console.log('FS QA · wave G integration (FS60-FS69, FS48 card)');
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const rows = async (t, where = 'true') => (await q(`select to_jsonb(x) j from kafaa_${t} x where ${where} order by id`)).map((r) => r.j);
  const md5 = async (names) => Object.fromEntries((await q(`select p.proname n, md5(p.prosrc) m from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = any($1)`, [names])).map((r) => [r.n, r.m]));
  let n = 7900;
  for (const persona of ['alnoor-gm', 'gulfhydro-qa', 'k-university', 'k-admin', 'chco', 'k-contractor']) {
    if (uid[persona]) continue;
    const row = await q1('select user_id from profiles where persona_id = $1', [persona]);
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [persona]]);
  }

  // 1. FS60 inputs reproduce from the formula on the final seed
  const hd = await rows('hc_disclosures');
  const hcDiff = [];
  for (const d of hd) if (canon((await q1('select kafaa_hcd_compute($1) r', [d.period])).r) !== canon(d.metric_values)) hcDiff.push(d.period);
  const metrics = await rows('hc_metrics');
  const srcTables = [...new Set(metrics.flatMap((m) => m.source_tables ?? []))];
  const missingSrc = [];
  for (const t of srcTables) if (!(await q1('select to_regclass($1) r', [`public.kafaa_${t}`])).r) missingSrc.push(t);
  const need = ['critical_skills', 'ai_rungs', 'training_records', 'xapi_statements', 'credit_ledger']; // FS50, FS09/FS36, training records, xAPI hours, FS30 credits
  ok(hd.length === 2 && hcDiff.length === 0 && missingSrc.length === 0 && need.every((t) => srcTables.includes(t)),
    `FS60 inputs: kafaa_hcd_compute reproduces both stored quarters on the final seed (after every wave-G builder); the ${metrics.length} metrics read ${srcTables.length} existing tables incl. ${need.join(', ')}${hcDiff.length ? ` (differ: ${hcDiff})` : ''}${missingSrc.length ? ` (missing: ${missingSrc})` : ''}`);

  // 2. FS61 reference from kafaa_benchmarks, never typed
  const bench = await rows('benchmarks');
  const ref = referenceOf(bench);
  const refSql = (await q1('select kafaa_spl_reference() r')).r;
  const m35 = readdirSync('src/modules/m35').filter((f) => /\.(tsx?)$/.test(f)).map((f) => readFileSync(`src/modules/m35/${f}`, 'utf8')).join('\n');
  const strings = ['en', 'ar'].map((l) => readFileSync(`src/i18n/m35.${l}.json`, 'utf8')).join('\n');
  const typed = /\b78\s*%|78 ?٪|٧٨/.test(strings) || /['"`]78\b|\b78['"`]/.test(m35);
  ok(canon(refSql) === canon(ref) && ref?.value === bench.find((b) => b.id === 'FSC').figures.find((f) => f.key === 'adoption_rate').value && bench.find((b) => b.id === 'FSC').listed && !typed,
    `FS61: the adoption reference (${ref?.value} %) is the listed FSC row of kafaa_benchmarks (SQL kafaa_spl_reference = referenceOf); no M35 page or string types it`);

  // 3. FS62 links FS41 / FS02 / FS09 as data
  const linksSql = (await q1('select kafaa_na_links() r')).r;
  const linksTs = effectiveLinks({ tags: await rows('national_tags'), links: await rows('tag_links'), skills: await rows('skills'), cec_competences: await rows('cec_competences') });
  const cnt = (xs, f) => xs.filter(f).length;
  const nz = cnt(linksSql, (l) => l.basis === 'net_zero'), jz = cnt(linksSql, (l) => l.basis === 'future_group'), ai = cnt(linksSql, (l) => l.target_table === 'ai_org_targets');
  ok(canon(linksSql.map((l) => [l.tag_id, l.target_table, l.target_id, l.basis]).sort()) === canon(linksTs.map((l) => [l.tag_id, l.target_table, l.target_id, l.basis]).sort()) && nz === 12 && jz > 0 && ai > 0,
    `FS62: FS41 Net Zero (${nz} competences) and FS02 Jahiz groups (${jz} skills) are derived at read time, the FS09/FS36 AI target is a curated link (${ai}); SQL kafaa_na_links = effectiveLinks (${linksSql.length} links)`);

  // 4. FS64 <- FS51: released aggregates only
  const dem = await rows('regional_demand');
  const fcs = new Map((await rows('skill_forecasts')).map((f) => [f.id, f]));
  const dBad = [];
  for (const rel of new Set(dem.map((r) => r.release_id))) {
    const rs = dem.filter((r) => r.release_id === rel);
    const f = fcs.get(rs[0].forecast_id);
    const want = f?.status === 'released' ? (await q1('select kafaa_rg_rows($1::jsonb, $2) r', [JSON.stringify(f.results), f.scenario])).r : null;
    const pick = (r) => canon([r.area, r.year, r.demand_low, r.demand_high, r.gap_low, r.gap_high, r.gap_plan, r.suppressed]);
    if (!want || canon(rs.map(pick).sort()) !== canon(want.map(pick).sort())) dBad.push(rel);
  }
  const fcRead = [];
  for (const p of ['alnoor-gm', 'gulfhydro-qa', 'k-university']) fcRead.push(Number((await as(p, 'select count(*)::int n from kafaa_skill_forecasts'))[0].n));
  const demRead = Number((await as('alnoor-gm', 'select count(*)::int n from kafaa_regional_demand'))[0].n);
  ok(dem.length > 0 && dBad.length === 0 && fcRead.every((x) => x === 0) && demRead === dem.filter((r) => r.released).length,
    `FS64 <- FS51: the ${dem.length} released demand rows equal kafaa_rg_rows of their released forecast; partners and universities read ${demRead} demand rows and no forecast row`);

  // 5. FS66 evidence at hire is recorded evidence (kept by kafaa_skills_apply)
  await db.exec('begin');
  try {
    const today = (await q1('select current_date::text d')).d;
    const dBase = { decision: 'endorse', note: 'All criteria checked by the reviewer', criteria: { assessment: true, placement: true, accreditation: true }, covers_from: addYears(today, -1) };
    const e = (await one('k-admin', 'select kafaa_endorse_programme($1, $2::jsonb) r', ['ua-ku-bsc-nuc', JSON.stringify({ ...dBase, covers_from: null })])).r;
    const ev = await q(`select person_id, id from kafaa_skill_evidence where ref_table = 'programme_alignments' and active order by id`);
    const people = [...new Set(ev.map((r) => r.person_id))];
    for (const p of people) await q('select kafaa_skills_apply($1, current_date)', [p]);
    const kept = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'programme_alignments' and active and id = any($1::text[])`, [ev.map((r) => r.id)])).n);
    const states = Number((await q1(`select count(*)::int n from kafaa_person_skills where person_id = any($1::text[]) and active`, [people])).n);
    const lists = ['tests/unit/fs11-catalogue.test.ts', 'tests/unit/fsqa1-integration.test.tsx', 'scripts/validate/fs11-foundation.mjs', 'scripts/validate/fsqa1-integration.mjs'].every((f) => readFileSync(f, 'utf8').includes("'programme_alignments'"));
    ok(e.ok && ev.length > 0 && kept === ev.length && states > 0 && lists,
      `FS66 <- 3.9: an endorsement writes ${ev.length} programme evidence rows for ${people.length} graduates; kafaa_skills_apply keeps every one (kind credential is recorded) and the shared invariant lists name programme_alignments`);
  } finally { await db.exec('rollback'); }

  // 6. FS69 -> FS32 verify label
  const shares = await rows('record_shares');
  const pa = await rows('prearrival_shares');
  const today6 = (await q1('select current_date::text d')).d;
  const paActive = pa.find((p) => { const s = shares.find((x) => x.id === p.share_id); return s && !s.revoked_at && String(s.expires_on).slice(0, 10) >= today6; });
  const tokOf = (id) => shares.find((s) => s.id === id)?.token;
  const vPa = (await one(null, 'select kafaa_verify_record_share($1) r', [tokOf(paActive.share_id)])).r;
  const vRec = (await one(null, 'select kafaa_verify_record_share($1) r', [tokOf('rs-kro-digital-rotation')])).r;
  const paClosed = shares.find((s) => s.id.startsWith('rs-pa-') && s.revoked_at);
  const vClosed = paClosed ? (await one(null, 'select kafaa_verify_record_share($1) r', [paClosed.token])).r : null;
  ok(vPa.ok && vPa.data.status === 'active' && vPa.data.purpose === 'prearrival' && vRec.ok && vRec.data.purpose === 'record' && vClosed?.ok && vClosed.data.status === 'revoked' && !('purpose' in vClosed.data) && !('clr' in vClosed.data),
    'FS69 -> FS32: the public verify page labels a contractor pre-arrival share (purpose prearrival), a staff share reads record, and a revoked link still shows nothing about the holder');

  // 7. Partner isolation (FS64, FS65, FS68)
  const iso = [];
  for (const [p, mine, other] of [['alnoor-gm', 'org-alnoor', 'org-gulfhydro'], ['gulfhydro-qa', 'org-gulfhydro', 'org-alnoor']]) {
    const c = await as(p, 'select org_id from kafaa_provider_commitments');
    const pl = await as(p, 'select org_id from kafaa_pledges');
    const fr = (await one(p, 'select kafaa_supplier_future_readiness() r')).r;
    const frOrgs = (fr?.orgs ?? []).map((o) => o.org_id);
    const leak = [...c, ...pl].filter((r) => r.org_id !== mine).length + frOrgs.filter((o) => o !== mine).length;
    iso.push({ p, c: c.length, pl: pl.length, fr: frOrgs.length, leak, other });
  }
  ok(iso.every((x) => x.leak === 0 && x.fr === 1) && iso.some((x) => x.c > 0) && iso.some((x) => x.pl > 0),
    `partner isolation: ${iso.map((x) => `${x.p} reads ${x.c} commitments, ${x.pl} pledges, ${x.fr} readiness org (none of ${x.other})`).join('; ')}`);

  // 8. FS48 mentoring card (guarded on version 13)
  const card = async () => (await q1(`select to_jsonb(c) j from kafaa_engine_cards c where id = 'mentoring'`)).j;
  const seeded = await card();
  const pick = (c) => canon({ v: c.version, at: String(c.last_changed_at).slice(0, 10), f: c.scoring_functions, i: c.inputs_used, le: c.limitations_en, la: c.limitations_ar });
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true)`);
    await db.exec(sql);
    const localSame = pick(await card()) === pick(seeded);
    const pre = { ...seeded, version: 13, scoring_functions: ['src/modules/m04/match.ts#rankMentors'], inputs_used: seeded.inputs_used.filter((x) => x.key !== 'wfn_participants'),
      limitations_en: 'Only mentors who opted in and have capacity appear.', limitations_ar: 'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية.' };
    const setCard = (c) => q(`update kafaa_engine_cards set version = $1, scoring_functions = $2::text[], inputs_used = $3::jsonb, limitations_en = $4, limitations_ar = $5 where id = 'mentoring'`,
      [c.version, c.scoring_functions, JSON.stringify(c.inputs_used), c.limitations_en, c.limitations_ar]);
    await setCard(pre);
    await db.exec(sql);
    const a1 = await card();
    await db.exec(sql);
    const a2 = await card();
    const want = applyFs48CardStep(pre);
    await setCard({ ...seeded, version: 13 }); // after the wave-F FS55 reconciliation: FS48 content, still version 13
    await db.exec(sql);
    const b1 = await card();
    ok(localSame && pick(a1) === pick(want) && a1.version === 14 && pick(a2) === pick(a1) && b1.version === 14 && canon([b1.scoring_functions, b1.inputs_used, b1.limitations_en, b1.limitations_ar]) === canon([seeded.scoring_functions, seeded.inputs_used, seeded.limitations_en, seeded.limitations_ar]),
      'FS48: the guarded statement moves a v13 mentoring card to v14 with the FS48 wording (from the pre-FS48 text = applyFs48CardStep, and from the FS55-reconciled text), a second run changes nothing, and the local v2 card is untouched');
  } finally { await db.exec('rollback'); }

  // 9. RLS perf, additivity and grants
  const pol = await q(`select tablename, qual from pg_policies where schemaname = 'public' and cmd = 'SELECT' and tablename = any($1)`, [NEW_TABLES.map((x) => `kafaa_${x}`)]);
  const bare = pol.filter((p) => /(?<!SELECT )kafaa_has_grant\(|(?<!SELECT )kafaa_me\(\)/.test(p.qual ?? ''));
  ok(new Set(pol.map((p) => p.tablename)).size === NEW_TABLES.length && bare.length === 0,
    `RLS perf: the read policies of the ${NEW_TABLES.length} new wave-G tables evaluate caller-only helpers once per statement${bare.length ? ` (${[...new Set(bare.map((p) => p.tablename))].join(', ')})` : ''}`);
  const body = sql.replace(/--.*$/gm, '');
  const top = body.replace(/\$\$[\s\S]*?\$\$/g, "''"); // statements outside function bodies
  const fns = [...body.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  const upd = [...top.matchAll(/\bupdate (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && !/\balter\b/i.test(body) && !/\bcreate (table|index|policy|trigger)\b/i.test(body) && !/\binsert into\b/i.test(top)
    && canon(fns) === canon(['kafaa_verify_record_share']) && canon(upd) === canon(['kafaa_engine_cards']) && /where c\.id = 'mentoring' and c\.version = 13;/.test(body),
  'the QA migration has no removal word, no ALTER, no new object or row: one function replaced (same signature) and one update guarded on the mentoring card at version 13');
  const g = await q1(`select has_function_privilege('anon', 'kafaa_verify_record_share(text)', 'execute') a, has_function_privilege('authenticated', 'kafaa_verify_record_share(text)', 'execute') u`);
  const m = await md5(['kafaa_verify_record_share']);
  ok(g.a === true && g.u === true, `kafaa_verify_record_share keeps its grants (anon and authenticated) — md5 ${m.kafaa_verify_record_share}`);
}
