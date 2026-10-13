// [Audit2 2026-10-13] PGlite checks for the final-audit migrations 20261013100001 .. 20261013100009 (live-apply bundle:
// docs/kafaa/ref/live_apply/audit2/). Every data-changing check runs inside a transaction that is rolled back, so later validators see the
// seed unchanged.
//  1. kafaa_client_ip: cf-connecting-ip, else the LAST X-Forwarded-For hop; kafaa_rl_hit counts per window; helpers closed to API roles.
//  2. kafaa_dalil_turn: a spoofed first hop does not change the key; the global anonymous cap refuses; answers marked 'browser'.
//  3. verification links: one audit row per link and outcome per hour; per-link, per-IP and per-kind caps from kafaa_rate_limits.
//  4. kafaa_submit_contact: anon cannot insert directly; the RPC derives the mailbox, keeps the part-04 bounds and throttles.
//  5. kafaa_people column grants; kafaa_scholars without the self branch; one SELECT policy on scholar cohorts; helper search paths.
//  6. digest order: owed approvals before future-dated ones from 2026-10-12 (SQL kafaa_dg_compose = TS composeDigest), unchanged before.
//  7. re-applying reopens a withdrawn application (same id, no new row).
//  8. kafaa_job_roles.basis_note_ar exists; 9. at most one open enrolment per person and course (partial unique index).
import { readFileSync } from 'node:fs';

const MIGS = ['20261013100001_kafaa_audit2_rate_limits', '20261013100002_kafaa_audit2_dalil_turn', '20261013100003_kafaa_audit2_verify_links',
  '20261013100004_kafaa_audit2_contact_rpc', '20261013100005_kafaa_audit2_people_scholars', '20261013100006_kafaa_audit2_digest_order',
  '20261013100007_kafaa_audit2_reapply', '20261013100008_kafaa_audit2_role_notes_ar', '20261013100009_kafaa_audit2_enrolment_open_unique'];

export default async function audit2Checks({ db, as, one, ok, uid }) {
  console.log('Audit2 2026-10-13 fixes (rate limits, Dalil, verification links, contact RPC, people/scholars, digest order, re-apply, enrolments)');
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const q1 = async (sql, params = []) => (await q(sql, params))[0];
  const R = await import('../../src/shell/digest/rules.ts');
  let n = 9200;
  for (const persona of ['k-student', 'nse']) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing',
      [uid[persona], `${persona}@test`, persona, 'enec-ops', persona === 'k-student' ? 'applicant' : 'employee', [persona]]);
  }
  const headers = (h) => db.query(`select set_config('request.headers', $1, false)`, [h ? JSON.stringify(h) : '']);
  const fails = async (persona, sql, params = []) => {
    await db.exec('savepoint a2');
    try { await as(persona, sql, params); await db.exec('release savepoint a2'); return null; } catch (e) { await db.exec('rollback to savepoint a2'); return e.message; }
  };
  const audits = async (action, entity) => Number((await q1(`select count(*)::int n from kafaa_audit_events where action = $1 and ($2::text is null or entity_id = $2)`, [action, entity ?? null])).n);

  // static: the migrations touch kafaa_* objects only and never update or delete rows
  for (const m of MIGS) {
    // top-level statements only (function bodies may update their own rows, e.g. counters): no UPDATE / DELETE / TRUNCATE of rows, every
    // created, altered or dropped object is a kafaa_* one, and no default privileges
    const top = readFileSync(`supabase/migrations/${m}.sql`, 'utf8').replace(/--.*$/gm, '').replace(/\$\$[\s\S]*?\$\$/g, '$$$$');
    const targets = [...top.matchAll(/\b(?:create|alter|drop)\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|function|policy|index|trigger)\s+(?:if\s+(?:not\s+)?exists\s+)?(\w+)(?:\s+on\s+(\w+))?/gi)]
      .flatMap((x) => [x[2], x[3]].filter(Boolean));
    ok(!/^\s*(update|delete|truncate)\b/im.test(top) && targets.length > 0 && targets.every((t) => /^kafaa_/.test(t)) && !/default privileges/i.test(top),
      `${m}: kafaa_* objects only (${[...new Set(targets)].length} objects), no row UPDATE/DELETE, no default privileges`);
  }

  await db.exec('begin');
  try {
    // ── 1. client IP and counters
    await headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' });
    ok((await q1('select kafaa_client_ip() ip')).ip === '198.51.100.7', 'kafaa_client_ip uses the last X-Forwarded-For hop (the one the platform appends), not the client-chosen first');
    await headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7', 'cf-connecting-ip': '192.0.2.44' });
    ok((await q1('select kafaa_client_ip() ip')).ip === '192.0.2.44', 'kafaa_client_ip prefers cf-connecting-ip (set by the edge)');
    await headers(null);
    ok((await q1('select kafaa_client_ip() ip')).ip === null, 'kafaa_client_ip is null without request headers (local calls)');
    const h = [];
    for (let k = 0; k < 3; k++) h.push((await q1(`select kafaa_rl_hit('a2.test', 'k', interval '1 minute') n`)).n);
    await db.query(`update kafaa_rate_limits set window_start = now() - interval '2 minutes' where id = 'a2.test:k'`);
    h.push((await q1(`select kafaa_rl_hit('a2.test', 'k', interval '1 minute') n`)).n);
    ok(h.join(',') === '1,2,3,1', `kafaa_rl_hit counts within a window and restarts after it (${h})`);
    const closed = [];
    for (const f of ['kafaa_client_ip()', 'kafaa_rl_hit(text, text, interval)', 'kafaa_verify_limited(text, text)', 'kafaa_verify_audit(text, text, text, text, text)', 'kafaa_verify_refuse(text, text, text, text, text)']) {
      const g = await q1(`select has_function_privilege('anon', $1, 'execute') a, has_function_privilege('authenticated', $1, 'execute') u`, [f]);
      if (g.a || g.u) closed.push(f);
    }
    ok(closed.length === 0, `the rate-limit helpers are executable by no API role (${closed.join(', ') || 'none open'})`);
    ok((await fails(null, `insert into kafaa_rate_limits (id, bucket, key) values ('x', 'x', 'x')`)) !== null && (await as('nse', 'select count(*)::int n from kafaa_rate_limits'))[0].n === 0
      && (await as('k-auditor', 'select count(*)::int n from kafaa_rate_limits'))[0].n > 0, 'rate-limit counters: nobody writes them directly; auditors read them, staff do not');

    // ── 2. Dalil
    const turn = async (hdr, extra = {}) => {
      await headers(hdr);
      const r = (await one(null, 'select kafaa_dalil_turn($1::jsonb) r', [JSON.stringify({ mode: 'public', client_key: 'a2-browser', question: 'What are the RO entry requirements?', answer: 'Three routes.', citations: [{ label: 'FANR-REG-17', url: 'https://www.fanr.gov.ae' }], refused: false, intent: 'entry_requirements', ...extra })])).r;
      await headers(null);
      return r;
    };
    const t1 = await turn({ 'x-forwarded-for': '203.0.113.1, 198.51.100.50' });
    const t2 = await turn({ 'x-forwarded-for': '203.0.113.2, 198.51.100.50' });
    const keys = await q(`select distinct client_key from kafaa_advisor_sessions where id = any($1)`, [[t1.data.session_id, t2.data.session_id]]);
    ok(t1.ok && t2.ok && keys.length === 1 && keys[0].client_key === `ip-${(await q1(`select md5('198.51.100.50') m`)).m}`, 'Dalil: a spoofed first X-Forwarded-For hop does not change the anonymous rate-limit key');
    ok(t2.data.used === 2, `Dalil: both questions count against the same per-hour limit (used ${t2.data.used})`);
    const ans = await q(`select speaker, answer_source from kafaa_advisor_turns where session_id = $1 order by id`, [t1.data.session_id]);
    ok(ans.some((x) => x.speaker === 'dalil' && x.answer_source === 'browser') && ans.every((x) => x.speaker !== 'user' || x.answer_source === null), 'Dalil: the recorded answer is marked answer_source = browser (composed in the visitor\'s browser); user turns carry none');
    const bad = await turn({ 'x-forwarded-for': '198.51.100.51' }, { citations: 'not-an-array' });
    ok(bad.ok && (await q1(`select citations from kafaa_advisor_turns where session_id = $1 and speaker = 'dalil'`, [bad.data.session_id])).citations.length === 0, 'Dalil: citations that are not a JSON array are stored as []');
    await db.query(`update kafaa_rate_limits set n = 120, window_start = now() where id = 'dalil.anon:*'`);
    const a0 = await audits('dalil.turn');
    const busy = await turn({ 'x-forwarded-for': '198.51.100.52' });
    const busy2 = await turn({ 'x-forwarded-for': '198.51.100.53' });
    ok(busy.ok === false && busy.code === 'rate_limited' && busy2.code === 'rate_limited' && (await audits('dalil.turn')) === a0 + 1, 'Dalil: over 120 anonymous questions a minute (all visitors) is refused, audited once per minute');
    await db.query(`update kafaa_rate_limits set n = 0 where id = 'dalil.anon:*'`);
    const staffT = (await one('nse', 'select kafaa_dalil_turn($1::jsonb) r', [JSON.stringify({ mode: 'staff', question: 'What is due?', answer: 'Nothing.', citations: [], refused: false, intent: 'x' })])).r;
    ok(staffT.ok, 'Dalil: signed-in staff are not counted against the anonymous cap');
    const g = await q1(`select has_function_privilege('anon', 'kafaa_dalil_turn(jsonb)', 'execute') a, has_function_privilege('authenticated', 'kafaa_dalil_turn(jsonb)', 'execute') u`);
    ok(g.a && g.u, 'kafaa_dalil_turn keeps its grants (anon and authenticated)');

    // ── 3. verification links
    const slug = (await q1(`select public_slug s from kafaa_badges where public_slug is not null order by id limit 1`)).s;
    const b0 = await audits('badge.verify', slug);
    const v1 = (await one(null, 'select kafaa_verify_badge($1) r', [slug])).r;
    const v2 = (await one(null, 'select kafaa_verify_badge($1) r', [slug])).r;
    const v3 = (await one(null, 'select kafaa_verify_badge($1) r', [slug])).r;
    ok(v1.ok && v2.ok && v3.ok && (await audits('badge.verify', slug)) === b0 + 1 && v1.audit_seq != null && v2.audit_seq == null,
      'badge check: three page views, one aggregated audit row for the hour (the first view)');
    const nf0 = await audits('badge.verify', 'kb-a2-nope');
    for (let k = 0; k < 3; k++) await one(null, 'select kafaa_verify_badge($1) r', ['kb-a2-nope']);
    ok((await audits('badge.verify', 'kb-a2-nope')) === nf0 + 1, 'unknown badge links: one refusal audit row per hour, not one per view');
    let lim = null;
    for (let k = 0; k < 20 && !lim; k++) { const x = (await one(null, 'select kafaa_verify_badge($1) r', [slug])).r; if (!x.ok) lim = x.code; }
    ok(lim === 'rate_limited', 'badge check: the 21st check of one link within a minute is refused (rate_limited)');
    await headers({ 'cf-connecting-ip': '192.0.2.200' });
    await db.query(`insert into kafaa_rate_limits (id, bucket, key, n) values ('verify.ip:ip-' || md5('192.0.2.200'), 'verify.ip', 'ip-' || md5('192.0.2.200'), 60)
      on conflict (id) do update set n = 60, window_start = now()`);
    const ipLim = (await one(null, 'select kafaa_verify_microcred($1) r', ['mc-a2-any'])).r;
    await headers({ 'cf-connecting-ip': '192.0.2.201' });
    const otherIp = (await one(null, 'select kafaa_verify_microcred($1) r', ['mc-a2-any'])).r;
    await headers(null);
    ok(ipLim.code === 'rate_limited' && otherIp.code === 'not_found', 'verification: over 60 checks a minute from one client IP (all kinds together) is refused; another IP is not');
    await db.query(`insert into kafaa_rate_limits (id, bucket, key, n) values ('verify.record.all:*', 'verify.record.all', '*', 600) on conflict (id) do update set n = 600, window_start = now()`);
    const recLim = (await one(null, 'select kafaa_verify_record_share($1) r', ['0'.repeat(32)])).r;
    ok(recLim.code === 'rate_limited', 'learner-record links: the per-kind cap of 600 a minute still holds');
    const vg = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a from pg_proc p where p.proname in ('kafaa_verify_badge', 'kafaa_verify_microcred', 'kafaa_verify_record_share')`);
    ok(vg.length === 3 && vg.every((x) => x.a), 'the three verification functions stay callable by anon');

    // ── 4. contact form
    ok((await q1(`select has_table_privilege('anon', 'kafaa_contact_requests', 'INSERT') t, has_any_column_privilege('anon', 'kafaa_contact_requests', 'INSERT') c`)).c === false,
      'anon holds no INSERT on kafaa_contact_requests (table or column): the forms send through kafaa_submit_contact');
    ok((await fails(null, `insert into kafaa_contact_requests (id, topic, route_to, message) values ('con-a2-direct', 'careers', 'Careers team (role mailbox)', 'Direct insert')`)) !== null,
      'a signed-out direct INSERT is refused');
    ok((await fails('nse', `insert into kafaa_contact_requests (id, topic, route_to, message) values ('con-a2-direct2', 'careers', 'Careers team (role mailbox)', 'Direct insert')`)) !== null,
      'a signed-in non-admin direct INSERT is refused (policy: admins only)');
    const send = async (p, persona = null) => (await one(persona, 'select kafaa_submit_contact($1::jsonb) r', [JSON.stringify(p)])).r;
    const c1 = await send({ topic: 'careers', message: 'I would like to know more about the programmes.', status: 'routed', lang: 'ar', consent_contact: true, name: 'Test', email: 'a@example.org', retention_until: (await q1(`select (current_date + 180)::text d`)).d });
    const row = c1.ok ? await q1(`select route_to, status, lang, consent_contact from kafaa_contact_requests where id = $1`, [c1.data.id]) : null;
    ok(c1.ok && row?.route_to === 'Careers team (role mailbox)' && row.status === 'routed' && row.lang === 'ar' && row.consent_contact === true, 'kafaa_submit_contact (anon): the public form payload is stored with the topic\'s mailbox');
    const c2 = await send({ topic: 'suppliers', message: 'Company: Co', name: 'Co', email: 's@example.org' });
    ok(c2.ok && (await q1(`select route_to, status from kafaa_contact_requests where id = $1`, [c2.data.id])).status === 'new', 'kafaa_submit_contact: the supplier interest payload is stored (default status new)');
    const badC = [
      [{ topic: 'nope', message: 'hello' }, 'an unknown topic'], [{ topic: 'careers', message: 'hello', status: 'closed' }, 'a closed status'],
      [{ topic: 'careers', message: '' }, 'an empty message'], [{ topic: 'careers', message: 'x'.repeat(4001) }, 'a message over 4000 characters'],
      [{ topic: 'careers', message: 'hello', name: 'n'.repeat(201) }, 'a name over 200 characters'], [{ topic: 'careers', message: 'hello', email: 'e'.repeat(321) }, 'an email over 320 characters'],
      [{ topic: 'careers', message: 'hello', retention_until: '2099-01-01' }, 'a retention over 400 days'], [{ topic: 'careers', message: 'hello', retention_until: 'soon' }, 'a retention that is not a date'],
    ];
    for (const [p, what] of badC) { const r = await send(p); ok(r.ok === false && r.code === 'invalid', `kafaa_submit_contact refuses ${what}`); }
    // throttle: 5 per 10 minutes per client (here: no headers, signed out -> the shared anonymous key, already used twice above)
    const res = [];
    for (let k = 0; k < 4; k++) res.push((await send({ topic: 'other', message: `Throttle ${k}` })).code);
    ok(res.join(',') === 'ok,ok,ok,rate_limited', `kafaa_submit_contact: the 6th request from one client within 10 minutes is refused (${res})`);
    await headers({ 'cf-connecting-ip': '192.0.2.77' });
    const ipOk = await send({ topic: 'other', message: 'From another client' });
    await headers(null);
    ok(ipOk.ok, 'kafaa_submit_contact: another client (IP) is not throttled by the first');
    const cg = await q1(`select has_function_privilege('anon', 'kafaa_submit_contact(jsonb)', 'execute') a, has_function_privilege('authenticated', 'kafaa_submit_contact(jsonb)', 'execute') u`);
    ok(cg.a && cg.u, 'kafaa_submit_contact is callable signed out and signed in');
    ok((await as('k-admin', `update kafaa_contact_requests set status = 'closed' where id = $1 returning id`, [c1.data.id])).length === 1, 'admins still close a request (status column)');

    // ── 5. people, scholars, scholar cohorts, search paths
    const pp = await q1(`select has_column_privilege('authenticated', 'kafaa_people', 'persona_id', 'UPDATE') pu, has_column_privilege('authenticated', 'kafaa_people', 'status', 'UPDATE') su,
      has_column_privilege('authenticated', 'kafaa_people', 'org_id', 'UPDATE') ou, has_column_privilege('authenticated', 'kafaa_people', 'language', 'UPDATE') lu,
      has_column_privilege('authenticated', 'kafaa_people', 'persona_id', 'INSERT') pi, has_table_privilege('authenticated', 'kafaa_people', 'UPDATE') tu`);
    ok(!pp.pu && !pp.su && !pp.ou && pp.lu && !pp.pi && !pp.tu, 'kafaa_people: signed-in users cannot write persona_id, status or org_id (column grants); profile fields stay writable');
    const gmPerson = (await q1(`select id from kafaa_people where org_id = 'org-alnoor' and persona_id is null order by id limit 1`))?.id;
    ok(gmPerson && (await fails('alnoor-gm', `update kafaa_people set persona_id = 'vp-rnd' where id = $1`, [gmPerson])) !== null, 'a partner admin cannot bind a persona to a person of its organisation');
    ok((await fails('alnoor-gm', `update kafaa_people set status = 'leaver' where id = $1`, [gmPerson])) !== null, 'a partner admin cannot change a person\'s status directly');
    ok((await fails('alnoor-gm', `update kafaa_people set crew = crew where id = $1`, [gmPerson])) === null, 'a partner admin still edits ordinary fields of its own people');
    const adm = await as('k-admin', `update kafaa_people set language = 'ar' where id = 'p-k-student' returning id`);
    ok(adm.length === 1, 'an administrator still edits profile fields directly');
    const cohort = (await q1(`select id, university_org_id from kafaa_scholar_cohorts order by id limit 1`));
    ok((await fails('k-student', `insert into kafaa_scholars (id, person_id, cohort_id, university_org_id, status) values ('sch-a2-self', 'p-k-student', $1, $2, 'in_study')`, [cohort.id, cohort.university_org_id])) !== null,
      'an applicant cannot create their own scholar record (no self branch)');
    const ownSch = (await q1(`select id from kafaa_scholars where person_id = 'p-k-graduate' limit 1`))?.id;
    const gradUid = uid['k-graduate'];
    if (gradUid) ok((await as('k-graduate', `update kafaa_scholars set status = 'in_study' where id = $1 returning id`, [ownSch])).length === 0, 'a scholar cannot change their own record');
    const pol = await q(`select policyname, cmd, with_check from pg_policies where tablename = 'kafaa_scholars' and cmd in ('INSERT', 'UPDATE')`);
    ok(pol.length === 2 && pol.every((x) => !/kafaa_me/.test(x.with_check ?? '')), 'kafaa_scholars insert/update policies have no self branch');
    const sc = await q(`select policyname from pg_policies where tablename = 'kafaa_scholar_cohorts' and cmd = 'SELECT'`);
    ok(sc.length === 1 && sc[0].policyname === 'kafaa_read', 'kafaa_scholar_cohorts has one SELECT policy');
    ok((await as('k-university', 'select count(*)::int n from kafaa_scholar_cohorts'))[0].n > 0, 'the university partner still reads the cohorts at its university');
    const sp = await q(`select proname, proconfig from pg_proc where proname in ('kafaa_mnt_trim', 'kafaa_mnt_ratings')`);
    ok(sp.length === 2 && sp.every((x) => (x.proconfig ?? []).includes('search_path=public')), 'kafaa_mnt_trim and kafaa_mnt_ratings have search_path = public');

    // ── 6. digest order (SQL compose = TS compose on the same candidates)
    const people = (await q(`select id from kafaa_people where status = 'active' order by id`)).map((x) => x.id);
    let diffs = [], moved = 0;
    const canon = (xs) => JSON.stringify(xs.map((i) => i.id));
    for (const day of ['2026-10-11', '2026-10-13', '2026-10-19', '2026-11-23']) {
      for (const pid of people) {
        const cands = (await q1('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [pid, day, '{}'])).r;
        if (!cands.some((i) => i.kind === 'approval')) continue;
        const sql = (await q1('select kafaa_dg_compose($1::jsonb, $2::text[]) r', [JSON.stringify(cands), []])).r;
        const ts = R.composeDigest(cands, { muted_kinds: [] });
        if (canon(sql) !== canon(ts)) diffs.push(`${pid}@${day}`);
        const old = [...cands].filter((i) => i.kind === 'approval').sort((a, b) => a.urgency - b.urgency || (a.days ?? 1e5) - (b.days ?? 1e5) || (a.id < b.id ? -1 : 1)).slice(0, 3).map((i) => i.id).join();
        if (old !== ts.filter((i) => i.kind === 'approval').map((i) => i.id).join()) { moved++; if (day < '2026-10-12') diffs.push(`${pid}@${day} changed before the release`); }
      }
    }
    ok(diffs.length === 0, `digest: SQL kafaa_dg_compose = TS composeDigest for every active person with approvals on 2026-10-11, 10-13, 10-19 and 11-23; nothing changes before 2026-10-12 (${moved} approval lists reordered later)${diffs.length ? `; diffs ${diffs.slice(0, 4)}` : ''}`);
    const tm = (await q1(`select kafaa_dg_compute('p-training-mgr', '2026-10-13'::date, '{}'::jsonb) r`)).r.filter((i) => i.kind === 'approval');
    ok(tm.some((i) => i.ref_table === 'plant_visits') && tm.some((i) => i.ref_table === 'roleplay_sessions') && !tm.some((i) => i.ref_table === 'prearrival_shares'),
      `the training manager's 2026-10-13 digest keeps the owed plant visit and role-play review ahead of pre-arrival checks due in weeks (${tm.map((i) => i.ref_table)})`);
    const tm2 = (await q1(`select kafaa_dg_compute('p-training-mgr', '2026-11-23'::date, '{}'::jsonb) r`)).r.filter((i) => i.kind === 'approval');
    ok(tm2.some((i) => i.ref_table === 'prearrival_shares' && i.days <= 14), `within 14 days of mobilisation the pre-arrival check ranks by days again and is in the digest (2026-11-23: ${tm2.map((i) => `${i.ref_table}:${i.days}`)})`);

    // ── 7. re-apply
    const apps0 = Number((await q1(`select count(*)::int n from kafaa_applications`)).n);
    const s1 = (await one('k-student', `select kafaa_submit_application('gpo', '{}'::jsonb) r`)).r;
    const w1 = s1.ok ? (await one('k-student', `select kafaa_withdraw_application($1, 'a2') r`, [s1.data.id])).r : null;
    const s2 = (await one('k-student', `select kafaa_submit_application('gpo', '{"nationality":"uae"}'::jsonb) r`)).r;
    const ap = s2.ok ? await q1(`select stage, decision, delete_after, nationality_flag from kafaa_applications where id = $1`, [s2.data.id]) : null;
    const ev = s2.ok ? await q(`select stage from kafaa_application_events where application_id = $1 order by ts, id`, [s2.data.id]) : [];
    ok(s1.ok && w1?.ok && s2.ok && s2.data.id === s1.data.id && Number((await q1(`select count(*)::int n from kafaa_applications`)).n) === apps0 + 1
      && ap.stage === 'submitted' && ap.decision === 'none' && ap.delete_after === null && ap.nationality_flag === 'uae' && ev.length === 3,
      're-applying after withdrawing reopens the same application (same id, one row, history kept, deletion schedule cleared)');
    const dup = (await one('k-student', `select kafaa_submit_application('gpo', '{}'::jsonb) r`)).r;
    ok(dup.code === 'conflict', 'an open application still refuses a second one');

    // ── 8. role notes
    ok((await q1(`select count(*)::int n from information_schema.columns where table_name = 'kafaa_job_roles' and column_name = 'basis_note_ar'`)).n === 1, 'kafaa_job_roles.basis_note_ar exists');

    // ── 9. open enrolments
    ok((await q1(`select count(*)::int n from pg_indexes where indexname = 'kafaa_enrolments_open_person_course_uniq'`)).n === 1, 'partial unique index on open enrolments exists');
    const e = await q1(`select person_id, course_id, org_id from kafaa_enrolments where status = 'enrolled' order by id limit 1`);
    let dupErr = null;
    await db.exec('savepoint en');
    try { await db.query(`insert into kafaa_enrolments (id, person_id, course_id, status, source) values ('en-a2-dup', $1, $2, 'assigned', 'manager')`, [e.person_id, e.course_id]); } catch (x) { dupErr = x.message; }
    await db.exec('rollback to savepoint en');
    ok(/duplicate key|unique/i.test(dupErr ?? ''), 'a second open enrolment for the same person and course is refused');
    let cancelledOk = true;
    await db.exec('savepoint en2');
    try { await db.query(`insert into kafaa_enrolments (id, person_id, course_id, status, source) values ('en-a2-closed', $1, $2, 'cancelled', 'manager')`, [e.person_id, e.course_id]); } catch { cancelledOk = false; }
    await db.exec('rollback to savepoint en2');
    ok(cancelledOk, 'closed enrolments (cancelled, completed, failed) are not limited');
    const guard = readFileSync('supabase/migrations/20261013100009_kafaa_audit2_enrolment_open_unique.sql', 'utf8').replace(/--.*$/gm, '');
    ok(/raise exception/.test(guard) && guard.indexOf('raise exception') < guard.indexOf('create unique index'), 'the index part first refuses (raise exception) while duplicates exist');
  } finally {
    await db.exec('rollback');
    await db.query(`select set_config('request.headers', '', false)`);
  }
}
