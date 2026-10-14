// [FS QA · wave H integration] PGlite checks for 20261010289001_kafaa_fs8qa_integration.sql (cross-feature wiring of FS70-FS77).
//  1. FS69 -> F36 + FS70 -> FS75: on a fresh database (every migration + the final seed, as the live apply leaves it) kafaa_dg_gather /
//     kafaa_dg_compose equal the TS rules (gatherDigest / buildDigestItems) for every person on the release day and a week later, for the
//     approval and future items (the parts wave H owns); the rising-skill nudges come from the stored FS70 rows; the pre-arrival checks owed
//     reach only the evaluator who opened the share on the contractor's behalf, never before 2026-10-12; a check, a revoked link or a past
//     mobilisation date removes the item; at most 7 items.
//  2. FS75: kafaa_build_digest twice gives one run per period with the same items (idempotent).
//  3. FS72 -> FS55 + 3.9: the skill_suggestions engine card and fairness rows exist; no manager, HR or auditor reads someone else's
//     suggestion; the owner's confirmation writes rating evidence with basis claimed (level <= 2, ref_table skill_suggestions) that
//     kafaa_skills_apply keeps.
//  4. FS74 <- FS72: the confirmed (claimed) suggestion never moves kafaa_fw_status; kafaa_fw_status = walletStatus() for every active staff
//     member; FS62 links the wallet target (kafaa_na_links = effectiveLinks).
//  5. FS73: kafaa_emirati_pipeline answers the HR analyst, the HR director and auditors only; observers, partners and line managers get
//     nothing.
//  6. FS77: kafaa_ib_for gives every induction plan's baseline (or the plan is stale by planStale()).
//  7. The QA migration is additive (no removal word, no ALTER, no new object or row, one internal function replaced), kafaa_dg_future is
//     still executable by no API role, kafaa_dg_gather keeps the fs83 body; md5s for the live comparison.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const FILE = 'supabase/migrations/20261010289001_kafaa_fs8qa_integration.sql';
const FS83 = 'supabase/migrations/20261010283001_kafaa_fs83_digest_nudges.sql';
const TABLES = ['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
  'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
  'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits', 'roleplay_sessions', 'role_assignments' /* readiness 2026-10-13 */,
  'role_profile_versions', 'skill_goals', 'skill_goal_plans', 'pathways', 'pathway_enrolments', 'ai_rungs', 'ai_skill_tracks', 'ai_systems', 'ai_system_users', 'skill_signals', 'fellowship_milestones',
  'prearrival_shares', 'record_shares', 'organisations'];
const WALLET_TABLES = ['people', 'person_skills', 'microcred_awards', 'ai_rungs', 'ai_skill_tracks', 'cec_competences', 'core_skills', 'wallet_targets'];
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fsqa8Checks({ db, as, one, ok, uid }) {
  console.log('FS QA · wave H integration (FS70-FS77, FS69 pre-arrival checks in the digest)');
  const R = await import('../../src/shell/digest/rules.ts');
  const F = await import('../../src/shell/digest/future.ts');
  const W = await import('../../src/modules/m37/wallet.ts');
  const N = await import('../../src/modules/m37/national.ts');
  const ST = await import('../../src/modules/m06/starter.ts');
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const md5 = async (names) => Object.fromEntries((await q(`select p.proname n, md5(p.prosrc) m from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = any($1)`, [names])).map((r) => [r.n, r.m]));
  let n = 8800;
  for (const persona of ['k-hr-analyst', 'chco', 'k-auditor', 'k-observer', 'alnoor-gm', 'sro', 'training-mgr', 'k-admin', 'ai-governance']) {
    if (uid[persona]) continue;
    const row = await q1('select user_id from profiles where persona_id = $1', [persona]);
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [persona]]);
  }

  // 1. SQL = TS on a fresh database (the shared one carries rows earlier validators wrote, and older digest bodies they replayed)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const f of readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (s, p = []) => (await fresh.query(s, p)).rows;
  const load = async (tables) => {
    const d = {};
    for (const t of tables) d[t] = (await fq(`select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) j from kafaa_${t} x`))[0].j;
    return d;
  };
  const d = await load(TABLES);
  const people = d.people.map((p) => p.id);
  const owns = (i) => i.kind === 'approval' || i.kind === 'future';
  const sortId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
  const diffs = []; let rising = 0; let over = 0; const owed = []; let early = 0;
  for (const day of [F.FS75_FROM, '2026-10-19']) {
    for (const pid of people) {
      const sg = (await fq('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [pid, day, '{}']))[0].r;
      const tg = R.gatherDigest(d, pid, day);
      if (canon(sortId(sg.filter(owns))) !== canon(sortId(tg.filter(owns)))) diffs.push(`${pid}@${day} gather`);
      const sc = (await fq('select kafaa_dg_compose($1::jsonb, $2::text[]) r', [JSON.stringify(sg), []]))[0].r;
      const tc = R.composeDigest(tg, { muted_kinds: [] });
      if (canon(sc.filter(owns)) !== canon(tc.filter(owns))) diffs.push(`${pid}@${day} compose`);
      if (sc.length > 7) over++;
      if (day === F.FS75_FROM) {
        rising += sg.filter((i) => i.ref_table === 'skill_signals').length;
        for (const i of sg) if (i.ref_table === 'prearrival_shares') owed.push([pid, i.ref_id, i.days]);
      }
    }
  }
  for (const pid of people) if ((await fq(`select kafaa_dg_gather($1, '2026-10-11'::date, '{}'::jsonb) r`, [pid]))[0].r.some((i) => i.ref_table === 'prearrival_shares')) early++;
  const latest = d.skill_signals.reduce((m, r) => (r.quarter > m ? r.quarter : m), '');
  const risingOk = rising > 0;
  ok(diffs.length === 0 && risingOk && over === 0,
    `FS75 SQL = TS (approvals + future items, gather and compose) for ${people.length} people on ${F.FS75_FROM} and 2026-10-19; ${rising} rising-skill nudges from the stored ${latest} FS70 list; never more than 7 items${diffs.length ? ` (differ: ${diffs.slice(0, 5)})` : ''}`);
  const paOk = owed.every(([pid, id]) => { const pa = d.prearrival_shares.find((x) => x.id === id); return pa && pa.created_via === 'on_behalf' && pa.created_by === pid && !pa.checked_at; });
  // a check, a revoked link or a passed mobilisation removes the item (rolled back)
  const [tm, first] = owed[0] ?? [];
  const has = async (pid, id, day = F.FS75_FROM) => (await fq('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [pid, day, '{}']))[0].r.some((i) => i.id === `approval:prearrival_shares:${id}`);
  const gone = [];
  if (first) {
    const pa = d.prearrival_shares.find((x) => x.id === first);
    for (const step of [`update kafaa_prearrival_shares set checked_at = now(), checked_by = '${tm}' where id = '${first}'`, `update kafaa_record_shares set revoked_at = now() where id = '${pa.share_id}'`,
      `update kafaa_prearrival_shares set mobilise_on = date '2026-10-11' where id = '${first}'`, `update kafaa_prearrival_shares set created_via = 'self' where id = '${first}'`]) {
      await fresh.exec('begin');
      try { await fresh.exec(`select set_config('kafaa.seeding', 'on', true); ${step}`); gone.push(!(await has(tm, first))); } finally { await fresh.exec('rollback'); }
    }
  }
  ok(owed.length > 0 && paOk && early === 0 && gone.length === 4 && gone.every(Boolean),
    `FS69 -> F36: ${owed.length} pre-arrival checks owed on ${F.FS75_FROM} (${[...new Set(owed.map((x) => x[0]))].join(', ')}), each to the evaluator who opened the share on the contractor's behalf, dated by mobilisation; none before the release; a check, a revoked link, a passed mobilisation or a self-made share removes it`);

  // 4. FS74 on the fresh database: kafaa_fw_status = walletStatus for every active staff member; FS62 links the target
  const wd = await load(WALLET_TABLES);
  const ww = W.walletWorld((t) => wd[t] ?? []);
  const staff = wd.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id);
  const wDiff = [];
  for (const pid of staff) {
    const s = (await fq('select kafaa_fw_status($1, $2::date) r', [pid, F.FS75_FROM]))[0].r;
    const t = W.walletStatus(pid, ww.inputsFor(pid), F.FS75_FROM);
    if (Number(s.met) !== t.met || !!s.complete !== t.complete || canon(s.items.map((i) => [i.key, i.met])) !== canon(t.items.map((i) => [i.key, i.met]))) wDiff.push(pid);
  }
  const nl = (await fq('select kafaa_na_links() r'))[0].r.filter((l) => l.target_table === 'wallet_targets');
  const tl = N.effectiveLinks({ tags: (await load(['national_tags'])).national_tags, links: (await load(['tag_links'])).tag_links, skills: d.skills, cec_competences: (await load(['cec_competences'])).cec_competences })
    .filter((l) => l.target_table === 'wallet_targets');
  ok(wDiff.length === 0 && nl.length > 0 && canon(nl.map((l) => [l.tag_id, l.target_id]).sort()) === canon(tl.map((l) => [l.tag_id, l.target_id]).sort()),
    `FS74: kafaa_fw_status = walletStatus() for ${staff.length} active staff (evidence only); FS62 links the wallet target to ${nl.map((l) => l.tag_id).join(', ')} (kafaa_na_links = effectiveLinks)${wDiff.length ? ` (differ: ${wDiff.slice(0, 5)})` : ''}`);

  // 6. FS77 induction plans read the baseline of their intake year
  const plans = (await load(['induction_plans'])).induction_plans;
  const bls = (await load(['intake_baselines'])).intake_baselines;
  const ibBad = [];
  for (const p of plans) {
    const bid = (await fq('select (kafaa_ib_for($1, $2)).id r', [Number(p.intake_year), p.programme]))[0].r ?? null;
    if ((bid ?? null) !== (p.baseline_id ?? null) && !ST.planStale(p, bls)) ibBad.push(p.id);
  }
  ok(plans.length > 0 && ibBad.length === 0, `FS77: kafaa_ib_for names every induction plan's baseline (${plans.length} plans; ${plans.filter((p) => ST.planStale(p, bls)).length} stale by planStale)${ibBad.length ? ` (differ: ${ibBad})` : ''}`);
  await fresh.close();

  // On the shared database: replay fs83 then this file (earlier validators replay older digest bodies), as the live apply order does.
  await db.exec(readFileSync(FS83, 'utf8'));
  await db.exec(sql);
  await db.exec(sql); // idempotent
  // audit 2026-10-13: a later migration redefines kafaa_dg_compose (owed approvals before future-dated ones); replay it after the older
  // body so the shared database keeps the final one, as the live apply order does
  for (const m of readdirSync('supabase/migrations').filter((f) => f > '20261010289999' && f.endsWith('.sql')).sort()) {
    const body = readFileSync(`supabase/migrations/${m}`, 'utf8');
    if (/create or replace function kafaa_dg_compose\(/.test(body)) await db.exec(body);
  }

  // 2. idempotent per period
  await db.exec('begin');
  try {
    const b1 = (await one('training-mgr', 'select kafaa_build_digest($1::jsonb) r', ['{}'])).r;
    const b2 = (await one('training-mgr', 'select kafaa_build_digest($1::jsonb) r', ['{}'])).r;
    const runs = Number((await q1(`select count(*)::int n from kafaa_digest_runs where person_id = 'p-training-mgr' and period = $1`, [b1?.data?.period ?? ''])).n);
    ok((b1.ok || b1.code === 'quiet_hours') && (!b1.ok || (b2.ok && b2.data.created === false && canon(b2.data.items) === canon(b1.data.items) && runs === 1 && b1.data.items.length <= 7)),
      `FS75: kafaa_build_digest twice for the training manager gives one run for ${b1?.data?.period ?? '(quiet hours)'} with the same ${b1?.data?.items?.length ?? 0} items (idempotent per period, at most 7)`);
  } finally { await db.exec('rollback'); }

  // 3. FS72 -> FS55 + 3.9 (and 4: the claim never moves the wallet)
  const card = await q1(`select inputs_excluded from kafaa_engine_cards where id = 'skill_suggestions'`);
  const excl = (card?.inputs_excluded ?? []).map((x) => (typeof x === 'string' ? x : x.key));
  const fair = Number((await q1('select count(*)::int n from kafaa_skill_suggestion_fairness')).n);
  const reads = {};
  for (const [p, me] of [['sro', 'p-sro'], ['chco', 'p-chco'], ['k-hr-analyst', 'p-k-hr-analyst'], ['k-auditor', 'p-k-auditor'], ['training-mgr', 'p-training-mgr']]) reads[p] = Number((await one(p, 'select count(*)::int n from kafaa_skill_suggestions where person_id <> $1', [me])).n);
  const sug = await q1(`select id, skill_id from kafaa_skill_suggestions where person_id = 'p-sro' and status = 'open' order by id limit 1`);
  await db.exec('begin');
  try {
    const before = (await q1(`select kafaa_fw_status('p-sro', current_date) r`)).r;
    const r = (await one('sro', 'select kafaa_respond_suggestion($1, $2) r', [sug.id, 'confirm'])).r;
    const ev = await q(`select id, kind, basis, level from kafaa_skill_evidence where ref_table = 'skill_suggestions' and ref_id = $1 and active`, [sug.id]);
    await q(`select kafaa_skills_apply('p-sro', current_date)`);
    const kept = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'skill_suggestions' and ref_id = $1 and active`, [sug.id])).n);
    const after = (await q1(`select kafaa_fw_status('p-sro', current_date) r`)).r;
    const mgr = Number((await one('sro', `select count(*)::int n from kafaa_skill_suggestions where person_id <> 'p-sro'`)).n);
    ok(['gender', 'nationality_flag', 'age'].every((k) => excl.includes(k)) && fair > 0 && Object.values(reads).every((x) => x === 0) && mgr === 0,
      `FS72 -> FS55: the skill_suggestions card excludes the protected inputs and has ${fair} fairness rows; nobody reads another person's suggestion (${Object.entries(reads).map(([p, x]) => `${p} ${x}`).join(', ')})`);
    ok(r.ok && ev.length === 1 && ev[0].kind === 'rating' && ev[0].basis === 'claimed' && Number(ev[0].level) <= 2 && kept === 1 && Number(after.met) === Number(before.met) && canon(after.items.map((i) => i.met)) === canon(before.items.map((i) => i.met)),
      `FS72 -> 3.9 / FS74: a confirmed suggestion writes one rating evidence row (basis claimed, level ${ev[0]?.level}) that kafaa_skills_apply keeps, and the wallet stays at ${before.met} of 5 (claimed never counts)`);
  } finally { await db.exec('rollback'); }

  // 5. FS73 guard
  const pip = {};
  for (const p of ['k-hr-analyst', 'chco', 'k-auditor', 'k-observer', 'alnoor-gm', 'sro', 'training-mgr', 'k-admin']) {
    const r = (await one(p, 'select kafaa_emirati_pipeline($1) r', ['all'])).r;
    pip[p] = !!(r && (r.ok === undefined ? true : r.ok) && (r.data ?? r));
  }
  ok(pip['k-hr-analyst'] && pip.chco && pip['k-auditor'] && !pip['k-observer'] && !pip['alnoor-gm'] && !pip.sro && !pip['training-mgr'] && !pip['k-admin'],
    `FS73: kafaa_emirati_pipeline answers ${Object.entries(pip).filter(([, v]) => v).map(([p]) => p).join(', ')}; observers, partners, line managers, the training manager and admins get nothing`);

  // 7. additivity, grants, md5s
  const body = sql.replace(/--.*$/gm, '');
  const top = body.replace(/\$\$[\s\S]*?\$\$/g, "''");
  const fns = [...body.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && !/\balter\b/i.test(body) && !/\bcreate (table|index|policy|trigger)\b/i.test(body) && !/\b(insert into|update)\b/i.test(top)
    && canon(fns) === canon(['kafaa_dg_future']),
  'the QA migration has no removal word, no ALTER, no new object, no data statement: one internal function replaced (same signature)');
  const g = await q1(`select has_function_privilege('anon', 'kafaa_dg_future(text, date, jsonb)', 'execute') a, has_function_privilege('authenticated', 'kafaa_dg_future(text, date, jsonb)', 'execute') u`);
  const m = await md5(['kafaa_dg_future', 'kafaa_dg_gather', 'kafaa_dg_compose']);
  ok(!g.a && !g.u && m.kafaa_dg_gather === '348c20506e3134ec9c9ec8c5f2481fde',
    `kafaa_dg_future stays closed to API roles — md5 kafaa_dg_future ${m.kafaa_dg_future}, kafaa_dg_gather ${m.kafaa_dg_gather} (fs83 body), kafaa_dg_compose ${m.kafaa_dg_compose}`);
}
