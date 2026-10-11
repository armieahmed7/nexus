// [W2 · E5 · F16, F17] PGlite checks for 20261009125001_kafaa_w2e5_leadership.sql: RLS on the M22 tables, SQL = TS parity of the
// 360 summary, HR aggregates, posting blocker and expert finder, and the RPC flows with the cards' acceptance criteria
// (self_nominate, maker-checker decisions, 360 shown only with >= 5 responses, opted-in experts only, restricted posts refused
// with the category (never the text) in the audit row, no email or phone in any payload).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { summarise360, computeLeadershipStats, postGuard, hasContactDetails, POST_FLOOR, BEHAVIOUR_IDS } from '../../src/modules/m22/domain.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

export default async function w2e5Checks({ db, as, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  // extra test identities (test-only NEXUS profiles; disjoint uid range 2501+)
  let n = 2500;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector'], ['outage-planner', 'Outage Planner'], ['work-control', 'Work Control'], ['ops-ceo', 'Operations CEO'], ['head-sq', 'Head of Supplier Quality']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W2E5 · F16 leadership journeys, F17 communities of practice');

  // ── parity on a pristine database (earlier checks in this run change rows)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const names = new Map(T.people.map((p) => [p.id, { name: p.display_name, name_ar: p.display_name_ar || p.display_name }]));
  const subjects = [...new Set(T.leadership_360_requests.map((r) => r.subject_id))];
  const diffs = [];
  for (const s of subjects) {
    for (const c of [null, '2026-H1', '2026-H2']) {
      const sql = (await fq('select kafaa_lead_360_summary($1, $2) j', [s, c]))[0].j;
      const ts = summarise360(s, c, T.leadership_360_requests, T.leadership_360, names);
      if (canon(sql) !== canon(ts)) diffs.push(`${s}/${c}`);
    }
  }
  ok(diffs.length === 0, `SQL 360 summary equals summarise360() for ${subjects.length} subjects x 3 cycle choices${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
  const statsSql = (await fq('select kafaa_lead_stats_compute() j'))[0].j;
  const statsTs = computeLeadershipStats(T.leadership_360, T.people, T.leadership_nominations, 10);
  ok(canon(statsSql) === canon(statsTs), 'SQL HR aggregates equal computeLeadershipStats() over the seed');
  ok(statsTs.cycle === '2026-H1' && statsTs.by_level.some((l) => !l.suppressed && l.subjects >= 10) && statsTs.by_level.some((l) => l.suppressed && l.subjects === null && l.scores === null)
    && statsTs.by_level.every((l) => l.suppressed || l.subjects >= 10) && statsTs.nominations.some((x) => x.suppressed && x.n === null),
    'HR 360 aggregates: grades with fewer than 10 subjects (and nomination counts under 10) are suppressed');
  // posting blocker parity over every floor pattern, the refusal policies and ordinary text in both languages
  const corpus = [
    ...Object.values(POST_FLOOR).flat().map((p) => `Question about ${p.toUpperCase()} please`),
    ...T.refusal_policies.flatMap((p) => p.patterns.map((x) => `قل لي ${x}`)),
    'ما هي الترتيبات الأمنيّة في المحطة؟', 'أين تقع الكاميرات', 'How do I prepare for continuing simulator training?', 'Tips for shift turnover notes', 'نصائح لتسليم الوردية',
    'Outage lessons learned on work packages', 'The alarmed operator stayed calm', 'Call me on +971 50 123 4567', 'mail a.b@example.org', 'Plan for 2024-2025 outage', 'ring 050 123 4567', 'session 2026-10-21 at 09:00',
    ...T.posts.map((p) => p.body), ...T.threads.map((t) => t.title),
  ];
  const gd = [];
  for (const text of corpus) {
    const r = (await fq('select kafaa_cop_guard($1) g, kafaa_cop_contact($1) c', [text]))[0];
    if (r.g !== postGuard(text, T.refusal_policies) || r.c !== hasContactDetails(text)) gd.push(text);
  }
  ok(gd.length === 0, `SQL posting blocker and contact check equal postGuard()/hasContactDetails() on ${corpus.length} texts${gd.length ? ` (first diff "${gd[0]}")` : ''}`);
  ok(Object.values(POST_FLOOR).flat().every((p) => postGuard(`x ${p} x`) !== null), 'every G5 refusal-floor pattern for security, safeguards and cyber is blocked in posts');
  await fresh.close();

  // ── RLS
  ok((await count(null, 'kafaa_leadership_programmes')) === T.leadership_programmes.length && (await count(null, 'kafaa_leadership_nominations')) === 0 && (await count(null, 'kafaa_communities')) === 0
    && (await count(null, 'kafaa_threads')) === 0 && (await count(null, 'kafaa_expert_optin')) === 0, 'anonymous visitors read the public programme facts only');
  // FS47 (fsEe4): the Future Leaders track row cites its own research sources (INMA, NNTP), not the CNS report
  const progs = await as(null, `select * from kafaa_leadership_programmes where id <> 'prog-future-leaders'`);
  ok(progs.every((g) => Array.isArray(g.sources) && g.sources.length && g.sources.every((s) => /^https:\/\//.test(s.url) && s.id === 'cns10' && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of ?? ''))) && progs.filter((g) => g.completions != null).every((g) => g.fact_en.length > 10 && [null, 2024].includes(g.completions_year)),
    'every programme fact (duration, 2024 completions) links to the CNS report with an as-of date');
  ok((await count('k-ro', 'kafaa_leadership_nominations')) === T.leadership_nominations.filter((x) => x.person_id === 'p-k-ro').length, 'an employee reads only their own nominations');
  const sroN = await as('sro', 'select person_id, nominated_by from kafaa_leadership_nominations');
  ok(sroN.length > 1 && sroN.every((x) => x.nominated_by === 'p-sro' || ['B'].includes(T.people.find((p) => p.id === x.person_id)?.crew) || x.person_id === 'p-sro'), 'a line manager reads nominations in their scope and the ones they made');
  ok((await count('chco', 'kafaa_leadership_nominations')) === T.leadership_nominations.length && (await count('training-mgr', 'kafaa_leadership_nominations')) === T.leadership_nominations.length && (await count('gulfhydro-qa', 'kafaa_leadership_nominations')) === 0,
    'the HR authority and the training manager read every nomination; partners none');
  ok((await count('sro', 'kafaa_leadership_360')) === 0 && (await count('chco', 'kafaa_leadership_360')) === 0 && (await count('k-admin', 'kafaa_leadership_360')) === 0 && (await count('k-auditor', 'kafaa_leadership_360')) === 0,
    'individual 360 responses are unreadable through the API (subjects, HR, admins and auditors alike)');
  ok((await count('k-ro', 'kafaa_leadership_360_requests')) === T.leadership_360_requests.filter((r) => r.rater_id === 'p-k-ro').length && (await count('k-ro', 'kafaa_leadership_360_requests', `rater_id <> 'p-k-ro'`)) === 0,
    'a 360 invitation is readable by its rater only (the subject sees counts through kafaa_my_360)');
  ok((await count('k-ro', 'kafaa_communities')) === 7 && (await count('gulfhydro-qa', 'kafaa_communities')) === 0 && (await count('k-ro', 'kafaa_ks_sessions')) === T.ks_sessions.length,
    'staff read the communities and the session catalogue; partners do not');
  ok((await count('k-ro', 'kafaa_posts', `status <> 'published'`)) === 0 && (await count('k-auditor', 'kafaa_posts')) === T.posts.length && (await count('k-ro', 'kafaa_threads', 'not visible')) === 0,
    'staff read published posts only; auditors read every post (held and hidden too)');
  const vis = T.expert_optin.filter((o) => o.visible).length;
  ok((await count('k-ro', 'kafaa_expert_optin')) === vis && (await count('k-ro', 'kafaa_expert_optin', 'not visible')) === 0, 'staff read visible expert profiles only; hidden opt-ins stay private');
  ok((await count('k-ro', 'kafaa_expert_requests', `requester_id <> 'p-k-ro' and expert_id <> 'p-k-ro'`)) === 0 && (await count('qc-inspector', 'kafaa_expert_requests')) === T.expert_requests.filter((r) => r.requester_id === 'p-qc-inspector' || r.expert_id === 'p-qc-inspector').length,
    'expert requests are readable by the requester and the expert only');
  let direct = 0;
  for (const sql of [`insert into kafaa_threads (id, community_id, title, author_id) values ('x', 'cop-ops', 'x', 'p-k-ro')`, `update kafaa_leadership_nominations set status = 'approved' where person_id = 'p-k-ro'`, `insert into kafaa_expert_optin (id, person_id) values ('eo:x', 'p-k-ro')`]) {
    try { const r = await as('k-ro', `${sql} returning 1`); if (!r.length) direct++; } catch { direct++; }
  }
  ok(direct === 3, 'M22 tables cannot be written directly (RPC only)');

  // ── F16 nominations
  const r = async (persona, sql, p) => (await one(persona, `select ${sql} r`, p)).r;
  const aud = async () => (await q(`select action, outcome, reason, ledger_status from kafaa_audit_events order by seq desc limit 1`))[0];
  const selfN = await r('k-ro', `kafaa_nominate_leader('p-k-ro', 'prog-estadad', 'I would like to grow as a leader in the crew')`);
  const selfA = await aud();
  const selfM = await r('sro', `kafaa_nominate_leader('p-sro', 'prog-cld', 'Ready for the next leadership step')`);
  ok(selfN.code === 'self_nominate' && selfA.outcome === 'refused' && selfA.action === 'leadership.nominate' && selfM.code === 'self_nominate', 'a nominee cannot nominate themselves (self_nominate, audited), even a manager');
  const notMgr = await r('qc-inspector', `kafaa_nominate_leader('w-qa-01', 'prog-intilaqa', 'Ready to lead the inspection team')`);
  const scope = await r('sro', `kafaa_nominate_leader('p-qc-inspector', 'prog-estadad', 'Strong questioning attitude in reviews')`);
  const dup = await r('sro', `kafaa_nominate_leader('p-k-ro', 'prog-let', 'Ready to lead a control-room team')`);
  const nonNom = await r('sro', `kafaa_nominate_leader('w-ro-01', 'prog-mentoring', 'Would benefit from a mentor')`);
  const short = await r('sro', `kafaa_nominate_leader('w-ro-01', 'prog-fas', 'ok')`);
  const good = await r('sro', `kafaa_nominate_leader('w-ro-01', 'prog-fas', 'Acts as peer checker for new operators; ready for FAS')`);
  if (process.env.W2E5_DEBUG) console.log({ notMgr, scope, dup, nonNom, short, good });
  ok(notMgr.code === 'forbidden' && scope.code === 'not_in_scope' && dup.code === 'conflict' && nonNom.code === 'invalid' && short.code === 'invalid' && good.ok && good.data.status === 'nominated',
    'nominations: managers only, people in scope only, one open nomination per programme, nominable programmes, a real reason');
  ok((await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-${good.data.id}-nominated`]))[0].n === 1, 'the nominee is notified of the nomination');
  const sroDecide = await r('sro', `kafaa_decide_nomination($1, 'approved', '')`, [good.data.id]);
  const noNote = await r('training-mgr', `kafaa_decide_nomination($1, 'declined', '')`, [good.data.id]);
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const approve = await r('chco', `kafaa_decide_nomination($1, 'approved', 'Welcome to LET')`, [good.data.id]);
  const approveA = await aud();
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const again = await r('training-mgr', `kafaa_decide_nomination($1, 'declined', 'Changed my mind')`, [good.data.id]);
  ok(sroDecide.code === 'forbidden' && noNote.code === 'invalid' && approve.ok && approveA.ledger_status === 'written' && led1 === led0 + 1 && again.code === 'invalid',
    'decisions: HR authority or training manager only, a reason to decline, ledger row on approval, decided once');
  // maker-checker: the nominator and the nominee never decide (rows inserted as the table owner)
  await db.query(`insert into kafaa_leadership_nominations (id, person_id, programme_id, nominated_by, reason, cycle, status) values ('ln-t1', 'w-corp-01', 'prog-estadad', 'p-chco', 'Test nomination by HR', '2026-H2', 'nominated'), ('ln-t2', 'p-training-mgr', 'prog-cld', 'p-ops-ceo', 'Test nomination of the decider', '2026-H2', 'nominated')`);
  const mc1 = await r('chco', `kafaa_decide_nomination('ln-t1', 'approved', '')`);
  const mc2 = await r('training-mgr', `kafaa_decide_nomination('ln-t2', 'approved', '')`);
  ok(mc1.code === 'maker_checker' && mc2.code === 'maker_checker', 'maker-checker: the nominator cannot decide their nomination, nor can the nominee');

  // ── F16 360
  const sroMine = await r('sro', `kafaa_my_360(null)`);
  const kroMine = await r('k-ro', `kafaa_my_360(null)`);
  const raterIds = new Set(T.leadership_360_requests.filter((x) => x.rater_kind !== 'self').map((x) => x.rater_id));
  ok(sroMine.enough === true && sroMine.responded >= 5 && sroMine.behaviours.length === BEHAVIOUR_IDS.length && kroMine.enough === false && kroMine.responded < 5 && kroMine.behaviours === null,
    `360 results appear only with at least 5 responses (sro ${sroMine.responded}: shown; k-ro ${kroMine.responded}: "not enough responses")`);
  ok(![...raterIds].some((id) => JSON.stringify(sroMine).includes(`"${id}"`)), 'the 360 view carries no rater ids, only names of invitees and aggregate scores');
  const few = await r('head-sq', `kafaa_request_360($1::jsonb)`, [JSON.stringify(['w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04'].map((id) => ({ person_id: id, kind: 'peer' })))]);
  const selfR = await r('ops-ceo', `kafaa_request_360($1::jsonb)`, [JSON.stringify(['p-ops-ceo', 'w-ro-02', 'w-ro-03', 'w-ro-04', 'w-ro-05'].map((id) => ({ person_id: id, kind: 'peer' })))]);
  const req = await r('ops-ceo', `kafaa_request_360($1::jsonb)`, [JSON.stringify([{ person_id: 'p-sro', kind: 'report' }, ...['w-ss-01', 'w-ss-02', 'p-work-control', 'p-chem-sup'].map((id) => ({ person_id: id, kind: 'peer' }))])]);
  const reqRows = await q(`select rater_kind, count(*)::int n from kafaa_leadership_360_requests where subject_id = 'p-ops-ceo' and cycle = kafaa_lead_cycle(current_date) group by rater_kind`);
  ok(few.code === 'too_few' && selfR.code === 'invalid' && req.ok && req.data.invited === 5 && reqRows.find((x) => x.rater_kind === 'self')?.n === 1, '360 requests: at least 5 colleagues, never yourself; a self rating is added');
  const kroReq = 'l3q-2026-H2-p-k-ro-p-sro';
  const bad = await r('sro', `kafaa_submit_360($1, '{"b-safety-values":6}'::jsonb)`, [kroReq]);
  const other = await r('k-ro', `kafaa_submit_360($1, $2::jsonb)`, [kroReq, JSON.stringify(Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 4])))]);
  const sub = await r('sro', `kafaa_submit_360($1, $2::jsonb)`, [kroReq, JSON.stringify(Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 4])))]);
  const twice = await r('sro', `kafaa_submit_360($1, $2::jsonb)`, [kroReq, JSON.stringify(Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 3])))]);
  const stored = await q(`select to_jsonb(x) j from kafaa_leadership_360 x where subject_id = 'p-k-ro' and cycle = '2026-H2' and rater_kind = 'manager'`);
  if (process.env.W2E5_DEBUG) console.log({ bad, other, sub, twice, stored });
  ok(bad.code === 'invalid' && other.code === 'not_found' && sub.ok && twice.code === 'conflict' && stored.length === 1 && !JSON.stringify(stored[0].j).includes('p-sro'), '360 ratings: every behaviour 1-5, only the invited rater, once; the response row has no rater id');
  const kroAfter = await r('k-ro', `kafaa_my_360(null)`);
  ok(kroAfter.responded === kroMine.responded + 1 && (kroAfter.enough ? kroAfter.behaviours.length === 8 : kroAfter.behaviours === null), 'a submitted rating counts towards the subject\'s threshold');
  const st = await r('chco', 'kafaa_leadership_stats()');
  const stAud = await r('k-auditor', 'kafaa_leadership_stats()');
  ok(st && stAud && (await r('k-ro', 'kafaa_leadership_stats()')) === null && (await r('sro', 'kafaa_leadership_stats()')) === null, 'HR aggregates: HR and auditors only (null for employees and line managers)');

  // ── F17 communities
  const join = await r('k-ro', `kafaa_join_community('cop-maint', true)`);
  const leave = await r('k-ro', `kafaa_join_community('cop-maint', false)`);
  const stew = await r('sro', `kafaa_join_community('cop-ops', false)`);
  const pj = await r('gulfhydro-qa', `kafaa_join_community('cop-ops', true)`);
  ok(join.ok && join.data.member && leave.ok && !leave.data.member && stew.code === 'conflict' && pj.code === 'forbidden', 'join and leave; stewards stay; partners cannot join');
  const post = (persona, p) => r(persona, `kafaa_post_thread($1::jsonb)`, [JSON.stringify(p)]);
  const nm = await post('qc-inspector', { community_id: 'cop-ops', title: 'A question for operations', body: 'How do you plan a long surveillance?' });
  const sec = await post('k-ro', { community_id: 'cop-ops', title: 'Plant question', body: 'Where are the CCTV cameras near the perimeter fence?' });
  const secA = await aud();
  const secAr = await post('k-ro', { community_id: 'cop-ops', title: 'سؤال عن المحطة', body: 'ما هي الترتيبات الأمنية في المحطة بالتفصيل؟' });
  const saf = await post('k-ro', { community_id: 'cop-ops', title: 'Fuel question', body: 'Does anyone know the nuclear material inventory figures?' });
  const cyb = await post('k-ro', { community_id: 'cop-ops', title: 'Access question', body: 'What is the password for the training network?' });
  const contact = await post('k-ro', { community_id: 'cop-ops', title: 'Contact me', body: 'Message me at someone@example.com or +971 50 123 4567 for notes' });
  if (process.env.W2E5_DEBUG) console.log({ nm, sec, secAr, saf, cyb, contact });
  ok(nm.code === 'not_member' && sec.code === 'restricted_content' && secAr.code === 'restricted_content' && saf.code === 'restricted_content' && cyb.code === 'restricted_content' && contact.code === 'contact_details',
    'posts: members only; security, safeguards and cyber content refused in English and Arabic; contact details refused');
  ok(secA.outcome === 'refused' && /security/.test(secA.reason) && !/cctv|camera|perimeter|fence/i.test(secA.reason ?? ''), 'a refused post is audited with its category, never its text');
  const okPost = await post('k-ro', { community_id: 'cop-ops', title: 'Night shift focus tips', body: 'What helps you stay focused on the last hours of a night shift?' });
  ok(okPost.ok && okPost.data.status === 'published' && (await count('qc-inspector', 'kafaa_threads', `id = '${okPost.data.thread_id}'`)) === 1, 'a member with earlier published posts posts straight away and staff can read it');
  await r('outage-planner', `kafaa_join_community('cop-maint', true)`);
  const first = await post('outage-planner', { community_id: 'cop-maint', title: 'Outage scope for digital I&C work', body: 'How do you estimate troubleshooting time for digital I&C work in outage scope?' });
  const queueSteward = await r('work-control', 'kafaa_moderation_queue()');
  const queueOther = await r('k-ro', 'kafaa_moderation_queue()');
  ok(first.ok && first.data.status === 'held' && queueSteward.some((x) => x.post_id === first.data.post_id) && queueOther.length === 0 && (await count('k-ro', 'kafaa_posts', `id = '${first.data.post_id}'`)) === 0
    && (await count('outage-planner', 'kafaa_posts', `id = '${first.data.post_id}'`)) === 1, 'a first post is held for the stewards (queue for stewards only; author still sees it)');
  const modOther = await r('k-ro', `kafaa_moderate_post($1, 'publish', '')`, [first.data.post_id]);
  const pub = await r('work-control', `kafaa_moderate_post($1, 'publish', '')`, [first.data.post_id]);
  const own = await r('sro', `kafaa_moderate_post('po-001-2', 'hide', 'Testing own post')`);
  const hideNoNote = await r('sro', `kafaa_moderate_post('po-001-3', 'hide', '')`);
  ok(modOther.code === 'forbidden' && pub.ok && (await count('k-ro', 'kafaa_threads', `id = '${first.data.thread_id}'`)) === 1 && own.code === 'maker_checker' && hideNoNote.code === 'invalid',
    'moderation: stewards only, never their own post, a reason to hide; publishing makes the thread visible');
  const second = await post('outage-planner', { thread_id: first.data.thread_id, community_id: 'cop-maint', body: 'Thanks, I will try the walkdown approach next time.' });
  ok(second.ok && second.data.status === 'published', 'once a first post is published, later posts publish directly');

  // ── F17 expert finder
  const optSec = await r('k-ro', `kafaa_set_expert_optin(array['sk-sa-01'], true, '')`);
  const optLow = await r('k-ro', `kafaa_set_expert_optin(array['sk-ch-02'], true, '')`);
  const optOk = await r('k-ro', `kafaa_set_expert_optin(array['sk-co-02'], true, 'Shift turnover practice')`);
  const found = await r('qc-inspector', `kafaa_find_experts('sk-co-02')`);
  await r('k-ro', `kafaa_set_expert_optin(array['sk-co-02'], false, '')`);
  const found2 = await r('qc-inspector', `kafaa_find_experts('sk-co-02')`);
  if (process.env.W2E5_DEBUG) console.log({ optSec, optLow, optOk, f: found.map((e) => e.person_id) });
  ok(optSec.code === 'security_restricted' && optLow.code === 'level_too_low' && optOk.ok && found.some((e) => e.person_id === 'p-k-ro') && !found2.some((e) => e.person_id === 'p-k-ro'),
    'expert opt-in: level 3+ skills only, never security skills; hiding removes the person from the finder at once');
  const all = await r('qc-inspector', 'kafaa_find_experts(null)');
  const visIds = new Set((await q(`select person_id from kafaa_expert_optin where visible`)).map((x) => x.person_id));
  ok(all.length > 0 && all.every((e) => visIds.has(e.person_id) && e.skills.every((s) => s.level >= 3)) && !all.some((e) => e.person_id === 'p-outage-planner' || e.person_id === 'w-eng-04'),
    'people who did not opt in (or hid their profile) never appear in the expert finder');
  ok((await r('gulfhydro-qa', 'kafaa_find_experts(null)')).length === 0, 'partners get no expert results');
  let anonFind = false;
  try { await as(null, `select kafaa_find_experts(null)`); } catch { anonFind = true; }
  ok(anonFind, 'anonymous callers cannot execute the expert finder');
  const er = await r('qc-inspector', `kafaa_request_expert('p-sro', 'sk-co-02', 'Could you explain how you structure the turnover brief?')`);
  const erSelf = await r('sro', `kafaa_request_expert('p-sro', 'sk-co-02', 'Asking myself a question here')`);
  const erHidden = await r('qc-inspector', `kafaa_request_expert('w-eng-04', 'sk-en-02', 'Could you help with design reviews please?')`);
  const erPhone = await r('qc-inspector', `kafaa_request_expert('p-sro', 'sk-co-03', 'Please call me on 050 123 4567 tomorrow')`);
  const ans1 = await r('qc-inspector', `kafaa_answer_expert_request($1, 'accepted', '')`, [er.data.id]);
  const ans2 = await r('sro', `kafaa_answer_expert_request($1, 'accepted', 'Yes, after the crew brief on Tuesday.')`, [er.data.id]);
  const ans3 = await r('sro', `kafaa_answer_expert_request($1, 'declined', '')`, [er.data.id]);
  ok(er.ok && erSelf.code === 'conflict' && erHidden.code === 'not_found' && erPhone.code === 'contact_details' && ans1.code === 'forbidden' && ans2.ok && ans3.code === 'invalid',
    'expert requests: in-app only, never to yourself or a hidden expert, no phone numbers; only the expert answers, once');

  // ── no email or phone in any M22 payload
  const payloads = [
    ...(await q(`select to_jsonb(x)::text j from kafaa_threads x union all select to_jsonb(x)::text from kafaa_posts x union all select to_jsonb(x)::text from kafaa_expert_optin x union all select to_jsonb(x)::text from kafaa_expert_requests x union all select to_jsonb(x)::text from kafaa_community_members x union all select to_jsonb(x)::text from kafaa_leadership_nominations x union all select to_jsonb(x)::text from kafaa_ks_sessions x`)).map((x) => x.j),
    JSON.stringify(all), JSON.stringify(sroMine), JSON.stringify(queueSteward),
  ];
  // Generated ids (kafaa_lead_rid: random hex) can contain "00" plus 8 digits by chance: drop id values before the phone test.
  const noIds = (p) => p.replace(/"(?:id|[a-z_]+_id)"\s*:\s*"[^"]*"/g, '""');
  ok(payloads.every((p) => !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(p) && !/(\+|00)[0-9]{8,}/.test(noIds(p).replace(/[\s()-]/g, ''))), `no email address or phone number in any M22 row or RPC payload (${payloads.length} payloads)`);
}
