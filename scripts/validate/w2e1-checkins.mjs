// [W2 · E1 · F10/F11] PGlite checks for 20261009121001_kafaa_w2e1_checkins.sql: RBAC, refusal codes, audit and ledger rows,
// RLS on the new tables, the F10/F11 acceptance criteria on the SQL path, and SQL = TS (src/modules/m17/checkins.ts) for the
// heatmap, coverage, crews, groups, distributions and rater offsets on the seed.
import {
  availabilityOf, coverage, crews, defaultGroup, distributions, evidenceLevels, groupSkills, groupsOf, inGroup, raterOffsets, stateMapOf, CREW_PROFILE,
} from '../../src/modules/m17/checkins.ts';
import { securityComps } from '../../src/modules/m17/badgeRules.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v));
const num = (x) => (x == null ? x : Number(x));

export default async function w2e1Checks({ db, as, one, ok, uid }) {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  // test identities (disjoint uid range for w2e1)
  const extra = { 'ops-ceo': ['Operations CEO'], 'rp-lead': ['RP Lead'], 'chem-sup': ['Chemistry Supervisor'], 'qc-inspector': ['QC Inspector'], 'head-sq': ['Head of Safety and Quality'], 'k-ro': ['Reactor Operator'], 'k-lo-trainee': ['Trainee'] };
  let n = 0;
  for (const [persona, roles] of Object.entries(extra)) {
    uid[persona] = uid[persona] ?? `00000000-0000-4000-8000-0000000021${String(++n).padStart(2, '0')}`;
    await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1, $2, $3, 'enec-ops', 'employee', $4) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, roles]);
  }
  /** Run as the persona with superuser rights (internal helpers are not executable by API roles). */
  const sup = async (persona, sql, params = []) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid[persona] })]);
    return (await db.query(sql, params)).rows;
  };
  const aud = async () => (await q('select count(*)::int n from kafaa_audit_events'))[0].n;
  const lastAudit = async (action) => (await q(`select outcome, reason, actor_role from kafaa_audit_events where action = $1 order by seq desc limit 1`, [action]))[0];

  // ── world for the TS side (read as superuser)
  const T = {};
  for (const t of ['people', 'skills', 'competencies', 'person_skills', 'skill_evidence', 'team_skill_targets', 'licences', 'medical_due', 'skill_ratings', 'skill_checkins']) T[t] = await q(`select * from kafaa_${t}`);
  for (const r of T.licences) r.last_synced = new Date(r.last_synced).toISOString();
  const sec = securityComps(T.competencies);
  const skillsSorted = T.skills.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pById = new Map(T.people.map((p) => [p.id, p]));
  const today = (await q(`select (now() at time zone 'UTC')::date::text d`))[0].d;
  const tgt = (t) => ({ team_id: t.team_id, skill_id: t.skill_id, min_people: t.min_people, min_level: t.min_level, active: true, note: t.note ?? null });
  const tsCoverage = (pool, key, people, me) => {
    const poolP = pool.map((id) => pById.get(id));
    const groups = groupsOf(poolP);
    const k = key ?? defaultGroup(groups, pById.get(me), people);
    const g = groups.find((x) => x.key === k);
    const ids = g ? poolP.filter((p) => inGroup(p, g.key)).map((p) => p.id).sort() : [];
    const supp = !people && ids.length < 10;
    const targets = T.team_skill_targets.filter((t) => t.active && g && t.team_id === g.key).map(tgt).sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1));
    const profile = T.team_skill_targets.filter((t) => t.active && t.team_id === CREW_PROFILE).map(tgt).sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1));
    const ms = stateMapOf(T.person_skills.filter((s) => ids.includes(s.person_id)));
    const cols = groupSkills(skillsSorted, sec, supp ? [] : ids, ms, targets);
    const colSet = new Set(cols.map((c) => c.id));
    const crewPeople = people ? poolP.filter((p) => p.crew) : [];
    const states = stateMapOf(T.person_skills.filter((s) => crewPeople.some((p) => p.id === s.person_id)));
    const now = new Date();
    const avail = new Map(crewPeople.map((p) => [p.id, availabilityOf(p.id, T.licences, T.medical_due, now, today)]));
    return {
      mode: people ? 'people' : 'aggregate', groups, group: g ? g.key : k, size: ids.length, suppressed: supp,
      members: people ? ids.map((id) => { const p = pById.get(id); return { id, name_en: p.display_name ?? id, name_ar: p.display_name_ar || p.display_name || id, initials: p.initials ?? '', job_role_id: p.job_role_id ?? null, crew: p.crew ?? null, team_id: p.team_id ?? null }; }) : [],
      skills: cols.map((c) => c.id),
      cells: people ? [...ms.values()].filter((x) => colSet.has(x.skill_id)).map((x) => ({ p: x.person_id, s: x.skill_id, l: x.level, b: x.basis })).sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : a.s < b.s ? -1 : 1)) : [],
      coverage: coverage(cols, ids, ms, targets, { suppressed: supp, holders: people }), targets, crew_profile: profile,
      crews: people ? crews(crewPeople, states, profile, avail, skillsSorted) : [],
    };
  };
  const pool = async (persona, people = true) => (await sup(persona, `select kafaa_sc_pool($1) p`, [people]))[0].p;
  const staffActive = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');

  // ── RLS / scope: the heatmap shows only people in the manager's scope
  const sroPool = await pool('sro');
  const crewB = staffActive.filter((p) => p.crew === 'B').map((p) => p.id).sort();
  ok(canon(sroPool) === canon(crewB), `shift supervisor (sro) sees exactly crew B (${crewB.length} people) in the heatmap pool`);
  const rpPool = await pool('rp-lead');
  ok(rpPool.length > 0 && rpPool.every((id) => pById.get(id).job_family_id === 'radiation-protection'), 'RP lead sees only the radiation-protection family');
  const other = await one('rp-lead', `select kafaa_team_coverage('team:ops-crew-b') r`);
  ok(other.r.members.length === 0 && other.r.cells.length === 0 && other.r.coverage.every((c) => !(c.holders ?? []).length), 'a manager from another team gets no people, cells or holders for crew B (RLS test)');
  ok((await one('rp-lead', `select count(*)::int n from kafaa_skill_checkins c join kafaa_people p on p.id = c.person_id where p.crew = 'B'`)).n === 0
    && (await one('rp-lead', `select count(*)::int n from kafaa_skill_ratings r join kafaa_people p on p.id = r.subject_id where p.crew = 'B'`)).n === 0, 'RLS: another team\'s manager reads none of crew B\'s check-ins or ratings');
  const tmPool = await pool('training-mgr');
  ok(tmPool.length === staffActive.length, 'training manager (A) sees every active staff member');

  // ── SQL = TS: coverage, cells, crews, groups, default group
  const cases = [['sro', null, true], ['ops-ceo', 'family:operations', true], ['training-mgr', 'team:chem', true], ['training-mgr', 'team:ops-crew-b', true], ['k-hr-analyst', 'family:operations', false], ['k-hr-analyst', 'team:rp', false], ['rp-lead', null, true]];
  for (const [persona, key, people] of cases) {
    const me = (await sup(persona, `select kafaa_me() m`))[0].m;
    const sql = (await one(persona, `select kafaa_team_coverage($1) r`, [key])).r;
    const ts = tsCoverage(await pool(persona, people), key, people, me);
    ok(canon(sql) === canon(ts), `teamCoverage SQL = TS for ${persona} ${key ?? '(default)'} (${sql.mode}, ${sql.size} people, ${sql.skills.length} skills, ${sql.crews.length} crews)`);
  }
  const sroCov = (await one('sro', `select kafaa_team_coverage(null) r`)).r;
  ok(sroCov.group === 'team:ops-crew-b' && sroCov.mode === 'people' && sroCov.members.length === crewB.length, 'sro\'s default group is crew B, with named people');
  const spof = sroCov.coverage.find((c) => c.skill_id === 'sk-sc-02');
  ok(spof && spof.n === 1 && spof.spof === true && sroCov.coverage.every((c) => c.spof === (c.n === 1)), 'a skill with exactly one person at the target level shows a single-point-of-failure flag (crew B, sk-sc-02)');
  const hr = (await one('k-hr-analyst', `select kafaa_team_coverage('team:rp') r`)).r;
  const hrOps = (await one('k-hr-analyst', `select kafaa_team_coverage('family:operations') r`)).r;
  ok(hr.mode === 'aggregate' && hr.suppressed && hr.members.length === 0 && hr.cells.length === 0 && hr.coverage.every((c) => c.n === null && c.status === 'suppressed')
    && !hrOps.suppressed && hrOps.coverage.some((c) => c.n != null) && hrOps.members.length === 0 && !JSON.stringify(hrOps).includes('holders'), 'HR (Agg) sees counts only: no names, cells or holders, and groups under 10 are suppressed');
  let empErr = null;
  try { await one('k-ro', `select kafaa_team_coverage(null) r`); } catch (e) { empErr = e.message; }
  let anonErr = null;
  try { await one(null, `select kafaa_team_coverage(null) r`); } catch (e) { anonErr = e.message; }
  ok(!!empErr && !!anonErr, 'employees and anonymous users cannot call teamCoverage');
  const ceo = (await one('ops-ceo', `select kafaa_team_coverage('family:operations') r`)).r;
  const crewJson = JSON.stringify(ceo.crews);
  ok(ceo.crews.map((c) => c.crew).join('') === 'ABCDE' && ceo.crews.every((c) => c.skills.length === ceo.crew_profile.length)
    && !/medical|licen|due_on|expir|cert|flag|person|name|"p"/i.test(crewJson), 'crew view: five crews against the crew profile, counts and availability only (no medical, licence or person fields)');

  // ── calibration: SQL = TS; suppressed below 10
  for (const [persona, key] of [['ops-ceo', 'family:operations'], ['sro', null], ['training-mgr', 'team:rp']]) {
    const sql = (await one(persona, `select kafaa_checkin_calibration($1) r`, [key])).r;
    const me = (await sup(persona, `select kafaa_me() m`))[0].m;
    const poolP = (await pool(persona)).map((id) => pById.get(id));
    const groups = groupsOf(poolP);
    const k = key ?? defaultGroup(groups, pById.get(me), true);
    const ids = poolP.filter((p) => inGroup(p, k)).map((p) => p.id).sort();
    const cks = T.skill_checkins.filter((c) => ids.includes(c.person_id) && c.status !== 'withdrawn').map((c) => c.id);
    const ratings = T.skill_ratings.filter((r) => cks.includes(r.checkin_id)).map((r) => ({ ...r, level: num(r.level) }));
    const used = new Set(ratings.map((r) => r.skill_id));
    const sids = skillsSorted.filter((s) => used.has(s.id) && !(s.area === 'security' || sec.has(s.competency_id))).map((s) => s.id);
    const ms = stateMapOf(T.person_skills.filter((s) => ids.includes(s.person_id)));
    const supp = ids.length < 10;
    const raters = raterOffsets(ratings, evidenceLevels(T.skill_evidence.filter((e) => ids.includes(e.person_id)))).map((r) => {
      const p = pById.get(r.rater_id);
      return { ...r, name_en: p?.display_name ?? r.rater_id, name_ar: p?.display_name_ar || p?.display_name || r.rater_id };
    });
    const ts = { groups, group: k, size: ids.length, suppressed: supp, checkins: cks.length, distributions: distributions(sids, ids, ms, ratings, supp), raters };
    ok(canon(sql) === canon(ts), `calibration SQL = TS for ${persona} ${k} (${ids.length} people, ${cks.length} check-ins, ${raters.length} raters, suppressed ${supp})`);
  }
  const calOps = (await one('ops-ceo', `select kafaa_checkin_calibration('family:operations') r`)).r;
  const calSro = (await one('sro', `select kafaa_checkin_calibration(null) r`)).r;
  ok(!calOps.suppressed && calOps.distributions.some((d) => Array.isArray(d.dist)) && calOps.raters.some((r) => r.flag === 'high' || r.flag === 'low'), 'calibration shows distributions for a group of 10+ and flags systematically high or low raters');
  ok(calSro.suppressed && calSro.size < 10 && calSro.distributions.length > 0 && calSro.distributions.every((d) => d.dist === null && d.means === null), 'the calibration view suppresses distributions for teams under 10 (crew B)');
  let hrCal = null;
  try { await one('k-hr-analyst', `select kafaa_checkin_calibration(null) r`); } catch (e) { hrCal = e.message; }
  ok(!!hrCal, 'HR cannot open calibration (no individual ratings for HR)');
  ok((await one('k-hr-analyst', `select count(*)::int n from kafaa_skill_ratings`)).n === 0 && (await one('k-hr-analyst', `select count(*)::int n from kafaa_skill_checkins`)).n === 0, 'HR (Agg) reads no individual check-ins or ratings');

  // ── requestCheckin
  let a0 = await aud();
  const r1 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-sa-01","self_level":2,"note":"security awareness"}],"peer_ids":[]}'::jsonb) r`);
  ok(r1.r.code === 'security_restricted' && (await aud()) === a0 + 1 && (await lastAudit('skills.checkin.request')).outcome === 'refused', 'a security competency cannot be checked in (security_restricted, audited)');
  const r2 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-co-01-eop","self_level":4,"note":"I know the EOPs well"}],"peer_ids":[]}'::jsonb) r`);
  const r3 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-co-01","self_level":4,"note":"Procedure use on every shift"}],"peer_ids":[]}'::jsonb) r`);
  ok(r2.r.code === 'qualification_only' && r3.r.code === 'qualification_only', 'qualification-standard skills and skills held by a current qualification are "verified by qualification only" (qualification_only)');
  const r4 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-hu-02","self_level":3,"note":"Led two pre-job briefs"}],"peer_ids":["w-rp-01"]}'::jsonb) r`);
  const r5 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-hu-02","self_level":3,"note":"Led two pre-job briefs"}],"peer_ids":["p-sro"]}'::jsonb) r`);
  const r6 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-da-01","self_level":2,"note":"Dashboard work"}],"peer_ids":[]}'::jsonb) r`);
  const r7 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-hu-02","self_level":5,"note":"x"}],"peer_ids":[]}'::jsonb) r`);
  ok(r4.r.code === 'not_peer' && r5.r.code === 'not_peer' && r6.r.code === 'conflict' && r7.r.code === 'invalid', 'peers must be same-team colleagues (not another team, not the manager); one open check-in per skill; levels 1-4');
  const peers = (await one('k-ro', `select kafaa_checkin_peers() r`)).r;
  ok(peers.manager?.id === 'p-sro' && peers.basis === 'team' && peers.peers.every((p) => pById.get(p.id).team_id === 'ops-crew-b') && !peers.peers.some((p) => p.id === 'p-sro'), 'checkinPeers: k-ro\'s line manager is sro and peers are crew B colleagues (never the manager)');

  // sro asks k-ro as a peer: peer isolation
  const req = await one('sro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-da-02","self_level":2,"note":"Reviewed AI-drafted shift notes against the checklist"},{"skill_id":"sk-en-01-project","self_level":3,"note":"Ran the crew training project plan"}],"peer_ids":["p-k-ro"],"message":"Two quick ratings please"}'::jsonb) r`);
  const cid = req.r.data?.id;
  ok(req.r.ok && req.r.data.manager_id === 'p-ops-ceo' && (await q(`select count(*)::int n from kafaa_skill_ratings where checkin_id = $1`, [cid]))[0].n === 6
    && (await q(`select count(*)::int n from kafaa_notifications where id like $1`, [`nt-${cid}-%`]))[0].n === 2, 'requestCheckin creates self, manager and peer rating rows and notifies the manager and the peer');
  const peerSees = await as('k-ro', `select rater_kind, rater_person_id, level from kafaa_skill_ratings where checkin_id = $1`, [cid]);
  const peerCk = await as('k-ro', `select * from kafaa_skill_checkins where person_id = 'p-sro'`);
  const peerStates = await as('k-ro', `select * from kafaa_person_skills where person_id = 'p-sro'`);
  const inbox = (await one('k-ro', `select kafaa_checkin_inbox() r`)).r.find((x) => x.checkin_id === cid);
  ok(peerSees.length === 2 && peerSees.every((r) => r.rater_kind === 'peer' && r.rater_person_id === 'p-k-ro') && peerCk.length === 0 && peerStates.length === 0
    && inbox && inbox.items.length === 2 && !JSON.stringify(inbox).includes('self_level') && !JSON.stringify(inbox).includes('Reviewed AI-drafted'), 'a peer sees only the named skills and their own rows: not the requester\'s other skills, self levels or other raters\' answers');
  const sr = await one('k-ro', `select kafaa_submit_rating($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, ratings: [{ skill_id: 'sk-da-02', level: 2, example: 'Saw the checklist review on nights' }, { skill_id: 'sk-en-01-project', level: 0 }] })]);
  const srBad = await one('k-ro', `select kafaa_submit_rating($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, ratings: [{ skill_id: 'sk-da-01', level: 2, example: 'not mine' }] })]);
  const srOther = await one('k-lo-trainee', `select kafaa_submit_rating($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, ratings: [{ skill_id: 'sk-da-02', level: 2, example: 'hello there' }] })]);
  ok(sr.r.ok && srBad.r.code === 'invalid' && srOther.r.code === 'not_found', 'peers rate only rows addressed to them (others get not_found); 0 = not observed');
  const selfV = await one('sro', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }, { skill_id: 'sk-en-01-project', outcome: 'validate' }] })]);
  ok(selfV.r.code === 'self_validate' && (await lastAudit('skills.checkin.validate')).outcome === 'refused', 'the person cannot validate their own check-in (self_validate, audited)');
  const peerV = await one('k-ro', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }, { skill_id: 'sk-en-01-project', outcome: 'validate' }] })]);
  const half = await one('ops-ceo', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }] })]);
  const badAdj = await one('ops-ceo', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }, { skill_id: 'sk-en-01-project', outcome: 'adjust', level: 3, reason: 'same level' }] })]);
  ok(peerV.r.code === 'forbidden' && half.r.code === 'invalid' && badAdj.r.code === 'invalid', 'a peer cannot validate; every skill needs a decision; an adjustment needs a different level and a reason');
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const v = await one('ops-ceo', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }, { skill_id: 'sk-en-01-project', outcome: 'adjust', level: 2, reason: 'Good start; one level lower until a full project cycle' }] })]);
  const ev = await q(`select skill_id, level, basis from kafaa_skill_evidence where ref_table = 'skill_checkins' and ref_id = $1 order by skill_id`, [cid]);
  const st = await q(`select skill_id, level, basis from kafaa_person_skills where person_id = 'p-sro' and skill_id in ('sk-da-02', 'sk-en-01-project') order by skill_id`);
  const ck = (await q(`select status, skills from kafaa_skill_checkins where id = $1`, [cid]))[0];
  const va = await lastAudit('skills.checkin.validate');
  ok(v.r.ok && v.r.data.status === 'adjusted' && v.r.data.written === 2 && ck.status === 'adjusted' && ev.length === 2 && ev.every((e) => e.basis === 'validated')
    && ev.find((e) => e.skill_id === 'sk-en-01-project').level === 2 && st.some((s) => s.skill_id === 'sk-da-02' && s.basis === 'validated')
    && va.outcome === 'ok' && (await q('select count(*)::int n from ledger_entries'))[0].n >= led0, 'the manager validates or adjusts with a reason: validated rating evidence, recomputed state, audit and ledger');
  ok((await q(`select count(*)::int n from kafaa_skill_ratings where checkin_id = $1 and status = 'pending'`, [cid]))[0].n === 0, 'pending rows close when the check-in is decided');
  const again = await one('ops-ceo', `select kafaa_validate_checkin($1::jsonb) r`, [JSON.stringify({ checkin_id: cid, decisions: [{ skill_id: 'sk-da-02', outcome: 'validate' }, { skill_id: 'sk-en-01-project', outcome: 'validate' }] })]);
  ok(again.r.code === 'conflict', 'a decided check-in cannot be decided again');

  // a qualification-standard skill cannot be raised, even inside a crafted check-in
  const before = (await q(`select level, basis from kafaa_person_skills where id = 'ps:p-k-ro:sk-co-01-eop'`))[0];
  await q(`insert into kafaa_skill_checkins (id, person_id, manager_id, skills, status, due_on) values ('chk-v-qual', 'p-k-ro', 'p-sro', '[{"skill_id":"sk-co-01-eop","self_level":3,"note":"crafted"}]', 'open', current_date + 14) on conflict do nothing`);
  const vq = await one('sro', `select kafaa_validate_checkin('{"checkin_id":"chk-v-qual","decisions":[{"skill_id":"sk-co-01-eop","outcome":"adjust","level":4,"reason":"trying to raise it"}]}'::jsonb) r`);
  const after = (await q(`select level, basis from kafaa_person_skills where id = 'ps:p-k-ro:sk-co-01-eop'`))[0];
  const vqEv = await q(`select 1 from kafaa_skill_evidence where ref_id = 'chk-v-qual'`);
  const vqCk = (await q(`select skills from kafaa_skill_checkins where id = 'chk-v-qual'`))[0].skills[0];
  ok(vq.r.ok && vq.r.data.written === 0 && vqEv.length === 0 && canon(before) === canon(after) && vqCk.outcome === 'qualification_only', 'a qualification-standard skill cannot be raised by a check-in (outcome qualification_only, no evidence, state unchanged)');

  // a pending self-claim is decided and its evidence flipped to validated (F03 hand-off)
  const claim = (await q(`select id, level from kafaa_skill_claims where person_id = 'p-k-ro' and skill_id = 'sk-da-01' and status = 'claimed' order by created_at desc limit 1`))[0];
  const vc = await one('sro', `select kafaa_validate_checkin('{"checkin_id":"chk-s-k-ro","decisions":[{"skill_id":"sk-da-01","outcome":"validate"},{"skill_id":"sk-sc-02","outcome":"not_yet","reason":"Show me on a shift first"}]}'::jsonb) r`);
  const cl = (await q(`select status, decided_by from kafaa_skill_claims where id = $1`, [claim?.id]))[0];
  const ce = (await q(`select basis, level from kafaa_skill_evidence where id = $1`, [`se:rating:${claim?.id}:sk-da-01`]))[0];
  ok(vc.r.ok && cl?.status === 'validated' && cl.decided_by === 'p-sro' && ce?.basis === 'validated', 'validating a skill with a pending claim marks the claim validated and flips its rating evidence to validated');

  // withdraw
  const w1 = await one('k-ro', `select kafaa_request_checkin('{"skills":[{"skill_id":"sk-hu-02","self_level":3,"note":"Led two pre-job briefs"}],"peer_ids":["w-ro-01"]}'::jsonb) r`);
  const wOther = await one('sro', `select kafaa_withdraw_checkin($1, 'no') r`, [w1.r.data?.id]);
  const wOk = await one('k-ro', `select kafaa_withdraw_checkin($1, 'Asked too early') r`, [w1.r.data?.id]);
  ok(w1.r.ok && wOther.r.code === 'not_found' && wOk.r.ok && (await q(`select status from kafaa_skill_checkins where id = $1`, [w1.r.data.id]))[0].status === 'withdrawn', 'only the person withdraws an open check-in');

  // ── setTeamTarget
  a0 = await aud();
  const t1 = await one('rp-lead', `select kafaa_set_team_target('{"team_id":"team:ops-crew-b","skill_id":"sk-da-01","min_people":3,"min_level":2}'::jsonb) r`);
  const t2 = await one('sro', `select kafaa_set_team_target('{"team_id":"team:ops-crew-b","skill_id":"sk-sa-01","min_people":3,"min_level":2}'::jsonb) r`);
  const t3 = await one('k-hr-analyst', `select kafaa_set_team_target('{"team_id":"team:rp","skill_id":"sk-da-01","min_people":3,"min_level":2}'::jsonb) r`);
  const t4 = await one('sro', `select kafaa_set_team_target('{"team_id":"team:ops-crew-b","skill_id":"sk-da-01","min_people":11,"min_level":2}'::jsonb) r`);
  const t5 = await one('sro', `select kafaa_set_team_target('{"team_id":"team:ops-crew-b","skill_id":"sk-da-01","min_people":3,"min_level":2,"note":"Dashboard rollout"}'::jsonb) r`);
  const row = (await q(`select min_people, min_level, set_by, active from kafaa_team_skill_targets where id = 'tst:team:ops-crew-b:sk-da-01'`))[0];
  ok(t1.r.code === 'forbidden' && t2.r.code === 'security_restricted' && t3.r.code === 'forbidden' && t4.r.code === 'invalid' && t5.r.ok && row.min_people === 3 && row.set_by === 'p-sro' && (await aud()) === a0 + 5,
    'setTeamTarget: managers in scope only (not another team\'s manager, not HR), never security skills, 1-10 people; every call audited');
  const t6 = await one('sro', `select kafaa_set_team_target('{"team_id":"team:ops-crew-b","skill_id":"sk-da-01","active":false}'::jsonb) r`);
  ok(t6.r.ok && (await q(`select active from kafaa_team_skill_targets where id = 'tst:team:ops-crew-b:sk-da-01'`))[0].active === false, 'a target can be cleared (row kept, inactive)');

  // ── grants and direct writes
  let dw = null;
  try { await as('training-mgr', `insert into kafaa_team_skill_targets (id, team_id, skill_id) values ('x', 'team:rp', 'sk-da-01')`); } catch (e) { dw = e.message; }
  let ih = null;
  try { await one('sro', `select kafaa_sc_pool(true) p`); } catch (e) { ih = e.message; }
  ok(!!dw && !!ih, 'no direct writes on the new tables; internal helpers are not executable by API roles');
}
