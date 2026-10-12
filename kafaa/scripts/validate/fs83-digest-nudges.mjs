// [FS wave H · E3 · fsHe3 · FS75] PGlite checks for 20261010283001_kafaa_fs83_digest_nudges.sql (future-skills nudges in the digest).
//  - SQL = TS: kafaa_dg_compute equals buildDigestItems() and kafaa_dg_future equals the FS75 part of gatherDigest() for every person on
//    days before and after the release (2026-10-12), on the database's own rows (so earlier checks' writes are included), plus synthetic
//    edge cases inside a rolled-back transaction: a fast-decay lapse, a dated goal, an undated goal, FS70 "growing" signals (a stand-in
//    kafaa_skill_signals table), a marketplace opt-out and an AI-literacy cell gap.
//  - Release gate: nothing FS75 adds appears before 2026-10-12 (the seeded digests stay valid).
//  - At most 7 items, at most 2 future items, idempotent per period (kafaa_build_digest twice), mutes ('future' can be muted, expiry not),
//    digest stats list 8 kinds, the new helper is closed to API roles, the method rows are public, the migration is additive.
import { readFileSync } from 'node:fs';

const TABLES = ['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
  'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
  'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits', 'roleplay_sessions',
  'role_profile_versions', 'skill_goals', 'skill_goal_plans', 'pathways', 'pathway_enrolments', 'ai_rungs', 'ai_skill_tracks', 'ai_systems', 'ai_system_users', 'skill_signals', 'fellowship_milestones'];
const FILE = 'supabase/migrations/20261010283001_kafaa_fs83_digest_nudges.sql';

export default async function fs83Checks({ db, as, count, ok, uid }) {
  const R = await import('../../src/shell/digest/rules.ts');
  const F = await import('../../src/shell/digest/future.ts');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  let n = 8300;
  for (const persona of ['k-instructor', 'k-hr-analyst', 'k-admin', 'k-auditor', 'training-mgr', 'sro', 'nse', 'chem-sup']) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [persona]]);
  }
  console.log('FS83 · FS75 future-skills nudges in the weekly digest');
  // Earlier validators replay older migrations on the shared database (fs25-future-roles replays the fs6qa file, which holds the previous
  // kafaa_dg_gather body); replay this file first so the checks below run on the final FS75 bodies (idempotent, as on the live project).
  await db.exec(readFileSync(FILE, 'utf8'));
  const load = async () => {
    const d = {};
    for (const t of TABLES) {
      const exists = (await q('select to_regclass($1) is not null as e', [`public.kafaa_${t}`]))[0].e;
      d[t] = exists ? (await q(`select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) j from kafaa_${t} x`))[0].j : [];
    }
    return d;
  };
  const prefsOf = (d, pid) => R.prefsOf((d.__prefs ?? []).find((p) => p.person_id === pid));
  const withPrefs = async (d) => { d.__prefs = (await q(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) j from kafaa_digest_prefs x`))[0].j; return d; };
  const futOf = (xs) => xs.filter((i) => i.kind === 'future' || i.ref_table === 'fellowship_milestones').sort((a, b) => (a.id < b.id ? -1 : 1));
  const parity = async (d, people, dates, label) => {
    const diffs = []; let items = 0, fut = 0;
    for (const day of dates) {
      for (const pid of people) {
        const sql = (await q('select kafaa_dg_compute($1, $2::date, $3::jsonb) r', [pid, day, '{}']))[0].r;
        const ts = R.buildDigestItems(d, pid, day, prefsOf(d, pid));
        items += ts.length;
        if (canon(sql) !== canon(ts)) diffs.push(`${pid}@${day} compute`);
        const sf = (await q('select kafaa_dg_future($1, $2::date, $3::jsonb) r', [pid, day, '[]']))[0].r;
        const tf = futOf(R.gatherDigest(d, pid, day));
        // the gig topic skips ids already gathered: compare against SQL run with the gathered items
        const sf2 = futOf((await q('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [pid, day, '{}']))[0].r);
        fut += tf.length;
        if (canon(sf2) !== canon(tf)) diffs.push(`${pid}@${day} future`);
        if (day < F.FS75_FROM && sf.length) diffs.push(`${pid}@${day} pre-release item`);
      }
    }
    ok(diffs.length === 0, `${label}: SQL = TS for ${people.length} people x ${dates.length} days (${items} composed items, ${fut} FS75 candidates)${diffs.length ? `; first diffs ${diffs.slice(0, 4).join(', ')}` : ''}`);
    return fut;
  };

  // ── 1. SQL = TS on the database's rows, before and after the release
  const d0 = await withPrefs(await load());
  const everyone = d0.people.map((p) => p.id);
  const staff = d0.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id);
  const preFut = await parity(d0, everyone, ['2026-10-08', '2026-10-11'], 'before the release (2026-10-08, 2026-10-11)');
  ok(preFut === 0, 'release gate: no FS75 item on any day before 2026-10-12, so the seeded digests (2026-W38..W41) are unchanged');
  const postFut = await parity(d0, everyone, ['2026-10-12'], 'release day 2026-10-12, every person');
  await parity(d0, staff, ['2026-10-19', '2026-11-02', '2026-12-01'], 'later days, every active staff member');
  const topics = {};
  for (const pid of staff) for (const i of futOf(R.gatherDigest(d0, pid, '2026-10-12'))) topics[F.futureTopic(i) ?? 'fellowship'] = (topics[F.futureTopic(i) ?? 'fellowship'] ?? 0) + 1;
  ok(postFut > 50 && ['role_profile', 'ai_literacy', 'pathway', 'fellowship'].every((k) => topics[k] > 0), `seeded data gives FS75 nudges on 2026-10-12: ${JSON.stringify(topics)}`);

  // ── 2. at most 7 items, at most 2 future items, urgency order, deep link and reasons on every item
  const all = (await q(`select p.id, kafaa_dg_compute(p.id, '2026-10-12'::date, '{}'::jsonb) r from kafaa_people p`)).map((x) => x.r);
  const known = new Set(Object.keys(JSON.parse(readFileSync('src/i18n/digest.en.json', 'utf8')).why));
  ok(all.every((xs) => xs.length <= R.DIGEST_MAX && xs.filter((x) => x.kind === 'future').length <= R.CAPS.future && xs.every((x, i) => i === 0 || x.urgency >= xs[i - 1].urgency)),
    'every digest keeps at most 7 items and at most 2 future-skills items, ordered by urgency');
  const fItems = all.flat().filter((x) => x.kind === 'future' || x.ref_table === 'fellowship_milestones');
  ok(fItems.length > 0 && fItems.every((x) => /^\/[a-z]/.test(x.link) && !x.link.startsWith('//') && x.why.length > 0 && x.why.every((w) => known.has(w.code)) && x.title_ar && x.title_en),
    `every FS75 item has an internal deep link, a title in EN and AR and reasons with digest.why keys (${fItems.length} items)`);

  // ── 3. synthetic edge cases (rolled back)
  await db.exec('begin');
  try {
    const me = 'p-nse';
    const fast = (await q(`select ps.id, ps.skill_id, ps.level from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id
                           where ps.person_id = $1 and kafaa_skill_decay_class(s.area, s.decay_class) = 'fast' order by ps.id limit 1`, [me]))[0];
    const fsk = (await q(`select s.id from kafaa_skills s where kafaa_skill_decay_class(s.area, s.decay_class) = 'fast' order by s.id offset 3 limit 1`))[0].id;
    // a held level-3 fast skill whose newest level-3 evidence passes 18 months on 2026-11-19, beside a level-2 row
    const reasons = [{ code: 'assessment', evidence_id: 'se:x1', level: 3, basis: 'evidenced', observed_on: '2025-05-20', ageing: false, source: 'assessment', w: 0.5, hl: 18 },
      { code: 'course', evidence_id: 'se:x2', level: 2, basis: 'evidenced', observed_on: '2026-01-01', ageing: false, source: 'training', w: 0.6, hl: 18 }];
    if (fast) await db.query('update kafaa_person_skills set level = 3, reasons = $2::jsonb, active = true where id = $1', [fast.id, JSON.stringify(reasons)]);
    await db.query(`insert into kafaa_skill_goal_plans (id, person_id, skill_id, target_level, target_date, status, shared, open_read, created_at, updated_at)
                    values ('sg:fs83:due', $1, $2, 3, '2026-10-30', 'active', false, false, now(), now()) on conflict (id) do nothing`, [me, fsk]);
    await db.query(`insert into kafaa_skill_goals (id, person_id, skill_id, target_level, status, source, created_at, updated_at)
                    values ('sg:fs83:undated', 'p-sro', $1, 2, 'active', 'skills_explorer', '2026-10-09T08:00:00Z', now()) on conflict (id) do nothing`, [fsk]);
    // FS70 shape (fsHe1): runs + rows (quarter, skill_id, category now|growing, rank, families). Stand-in tables when FS70 is not merged yet.
    if ((await q(`select to_regclass('public.kafaa_skill_signals') is null as e`))[0].e) {
      await db.exec(`create table kafaa_skill_signal_runs (id text primary key, quarter text, method text, status text, published_by text);
                     create table kafaa_skill_signals (id text primary key, run_id text, quarter text, skill_id text, category text, rank integer, score integer, families text[] not null default '{}')`);
    }
    const fam = (await q(`select job_family_id f from kafaa_people where id = 'p-chem-sup'`))[0].f;
    for (const [id, qtr] of [['fs83-r2', '2026-Q2'], ['fs83-r3', '2026-Q3']]) { // after the FS70 merge the seeded runs of these quarters are used
      await db.query(`insert into kafaa_skill_signal_runs (id, quarter, method, status, published_by) select $1, $2, 'v1', 'published', 'p-k-hr-analyst'
                      where not exists (select 1 from kafaa_skill_signal_runs where quarter = $2)`, [id, qtr]);
    }
    const run = async (qtr) => (await q('select id from kafaa_skill_signal_runs where quarter = $1 order by id limit 1', [qtr]))[0].id;
    const [r2, r3] = [await run('2026-Q2'), await run('2026-Q3')];
    await db.query(`insert into kafaa_skill_signals (id, run_id, quarter, skill_id, category, rank, score, families) values
      ('fs83-s1', $2, '2026-Q3', 'sk-fs-gr-ghg', 'growing', 0, 40, array[$1]::text[]), ('fs83-s2', $2, '2026-Q3', 'sk-fs-ai-verify', 'growing', 0, 90, '{}'::text[]),
      ('fs83-s4', $2, '2026-Q3', 'sk-fs-tr-systems', 'now', 0, 80, array[$1]::text[]), ('fs83-s5', $3, '2026-Q2', 'sk-fs-ai-prompt', 'growing', 0, 99, array[$1]::text[])
      on conflict do nothing`, [fam, r3, r2]);
    await db.query(`insert into kafaa_reco_optouts (id, person_id, surface, opted_out, updated_at) values ('ro:fs83', 'p-qc-inspector', 'marketplace', true, now()) on conflict do nothing`);
    await db.query(`update kafaa_reco_optouts set opted_out = true where person_id = 'p-qc-inspector' and surface = 'marketplace'`);
    const d1 = await withPrefs(await load());
    const who = ['p-nse', 'p-sro', 'p-chem-sup', 'p-k-ro', 'p-qc-inspector', 'p-buyer', 'p-training-mgr', 'p-fuel-pm'];
    await parity(d1, who, ['2026-10-12', '2026-10-30', '2026-11-15', '2026-11-25'], 'synthetic edge cases (decay, goals, FS70 signals, opt-out)');
    const g = (pid, day) => futOf(R.gatherDigest(d1, pid, day));
    const nse = g('p-nse', '2026-10-12');
    ok(!fast || nse.some((i) => i.ref_table === 'person_skills' && i.due_on === '2026-11-19'), 'decay: a held level-3 fast skill whose level-3 evidence turns 18 months old is flagged, dated by its half-life');
    ok(nse.some((i) => i.ref_table === 'skill_goal_plans' && i.days === 18) && g('p-nse', '2026-12-05').every((i) => i.ref_table !== 'skill_goal_plans'),
      'goal: a dated FS33 goal shows within 30 days of its date and drops out 30 days after it');
    ok(g('p-sro', '2026-10-12').some((i) => i.ref_table === 'skill_goals'), 'goal: an FS07 goal without a dated plan asks for a date');
    const chem = g('p-chem-sup', '2026-10-12');
    ok(chem.some((i) => i.ref_table === 'skill_signals' && i.ref_id === 'sk-fs-gr-ghg') && !chem.some((i) => i.ref_id === 'sk-fs-ai-prompt' || i.ref_id === 'sk-fs-tr-systems'),
      'rising skill: a growing skill on the latest FS70 list for my family is nudged first; an older quarter and an "in demand now" row are not');
    ok(g('p-sro', '2026-10-12').every((i) => i.ref_id !== 'sk-fs-gr-ghg'), 'rising skill: a family signal reaches only that family');
    ok(!g('p-qc-inspector', '2026-10-12').some((i) => i.ref_table === 'opportunities'), 'future gig: none after an opt-out of marketplace ranking (F24)');
    ok(g('p-nse', '2026-10-11').length === 0, 'the same synthetic rows give nothing on 2026-10-11 (release gate)');
  } finally {
    await db.exec('rollback');
  }

  // ── 4. mutes, idempotence per period, stats, grants, RLS
  const me = 'k-hr-analyst';
  const pid = (await q('select id from kafaa_people where persona_id = $1', [me]))[0]?.id;
  const setP = async (muted) => (await as(me, `select kafaa_set_digest_prefs($1::jsonb) r`, [JSON.stringify({ enabled: true, frequency: 'weekly', quiet_start: null, quiet_end: null, muted_kinds: muted })]))[0].r;
  const m1 = await setP(['future']);
  const m2 = await setP(['expiry', 'future']);
  const m3 = await setP(['future', 'bogus']);
  const muted = pid ? (await q(`select kafaa_dg_compute($1, '2026-10-12'::date, '{}'::jsonb) r`, [pid]))[0].r : [];
  ok(m1.ok && !m2.ok && m2.code === 'invalid' && !m3.ok && muted.every((i) => i.kind !== 'future'), "'future' can be muted (and then never shows); expiry still cannot be muted; unknown kinds are refused");
  await setP([]);
  // (prefs reset just above: on, weekly, no quiet hours, nothing muted; earlier checks may already have built this period's run)
  const b1 = (await as(me, `select kafaa_build_digest('{}'::jsonb) r`))[0].r;
  const b2 = (await as(me, `select kafaa_build_digest('{}'::jsonb) r`))[0].r;
  const runs = Number((await q('select count(*)::int n from kafaa_digest_runs where id = $1', [b1.data?.run_id ?? '-']))[0].n);
  ok(b1.ok && b2.ok && b2.data.created === false && b2.data.run_id === b1.data.run_id && canon(b2.data.items) === canon(b1.data.items) && runs === 1 && b1.data.items.length <= 7,
    `idempotent per period: two builds in ${b1.data?.period} give one run with the same ${b1.data?.items?.length} items${b1.ok ? '' : ` (${b1.code}: ${b1.message})`}`);
  const st = (await as('k-admin', 'select kafaa_digest_stats() r'))[0].r;
  ok(st.kinds.length === 8 && st.kinds.some((k) => k.kind === 'future'), 'digest statistics list 8 kinds including future (counts under 10 suppressed)');
  const anonF = await as(null, `select kafaa_dg_future('p-nse', '2026-10-12'::date, '[]'::jsonb) r`).then(() => 'ran', (e) => e.message);
  const authF = await as('nse', `select kafaa_dg_future('p-nse', '2026-10-12'::date, '[]'::jsonb) r`).then(() => 'ran', (e) => e.message);
  ok(anonF !== 'ran' && authF !== 'ran', 'kafaa_dg_future is closed to anon and authenticated (internal helper)');
  ok((await count(null, 'kafaa_digest_nudge_rules')) === 8 && (await count('nse', 'kafaa_digest_nudge_rules')) === 8, 'the 8 published nudge rules are public reference rows');
  const sqlText = readFileSync(FILE, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(sqlText) && !/alter table (?!kafaa_)/i.test(sqlText) && !/create (or replace )?function (?!kafaa_)/i.test(sqlText), 'the migration is additive: kafaa_* objects only, no removal statements');

  // ── 5. function bodies and table digest (for the live comparison)
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                       and p.proname in ('kafaa_dg_future', 'kafaa_dg_gather', 'kafaa_dg_compose', 'kafaa_set_digest_prefs', 'kafaa_digest_stats') order by 1`);
  console.log(`    md5: ${md5.map((r) => `${r.proname} ${r.m}`).join(' · ')}`);
  const dg = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) d from kafaa_digest_nudge_rules t`))[0];
  console.log(`    kafaa_digest_nudge_rules: ${dg.n} rows, digest ${dg.d}`);
}
