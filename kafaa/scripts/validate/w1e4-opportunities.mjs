// [W1 · E4 · F08] PGlite checks for 20261009114001_kafaa_w1e4_opportunities.sql: RLS on the marketplace tables, line-manager
// routing parity with src/modules/m20/domain.ts, HR aggregates parity and suppression, and the full RPC flow with the card's
// acceptance criteria (release_required, maker_checker, restricted kinds refused and audited, ojt evidence on completion).
import { readFileSync } from 'node:fs';
import { lineManagerOf, computeStats } from '../../src/modules/m20/domain.ts';

export default async function w1e4Checks({ db, as, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  // extra test identities (test-only NEXUS profiles; disjoint uid range 1401+)
  let n = 1400;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['ops-ceo', 'Operations CEO'], ['outage-manager', 'Outage Manager']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W1E4 · F08 opportunity marketplace');

  // ── RLS
  ok((await count(null, 'kafaa_opportunities')) === 0 && (await count(null, 'kafaa_opportunity_applications')) === 0, 'anonymous visitors read no opportunities or applications');
  const listed = T.opportunities.filter((o) => o.listed).length;
  ok((await count('k-ro', 'kafaa_opportunities')) === listed && (await count('k-ro', 'kafaa_opportunities', "status = 'draft'")) === 0, `staff read the ${listed} listed opportunities and no other poster's draft`);
  ok((await count('sro', 'kafaa_opportunities', "status = 'draft'")) === 1, 'the poster reads their own draft');
  ok((await count('gulfhydro-qa', 'kafaa_opportunities')) === 0, 'partner users read no opportunities');
  const kro = await as('k-ro', 'select person_id, poster_id, releaser_id, line_manager_id from kafaa_opportunity_applications');
  ok(kro.length === T.opportunity_applications.filter((a) => a.person_id === 'p-k-ro').length && kro.every((a) => a.person_id === 'p-k-ro'), 'an employee reads only their own applications (not every application through the staff R grant)');
  const sroApps = await as('sro', 'select person_id, poster_id, releaser_id, line_manager_id from kafaa_opportunity_applications');
  ok(sroApps.length > 0 && sroApps.every((a) => [a.person_id, a.poster_id, a.releaser_id, a.line_manager_id].includes('p-sro')), 'a manager reads only applications they posted, must release, or line-manage');
  ok((await count('k-hr-analyst', 'kafaa_opportunity_applications')) === 0 && (await count('k-auditor', 'kafaa_opportunity_applications')) === T.opportunity_applications.length, 'HR analysts read no individual applications; auditors read all');
  ok((await count('k-ro', 'kafaa_opportunity_saves')) === T.opportunity_saves.filter((s) => s.person_id === 'p-k-ro').length && (await count('sro', 'kafaa_opportunity_saves')) === 0, 'saved items are private to their owner');
  let direct = false;
  try { await as('training-mgr', `insert into kafaa_opportunities (id, posted_by, kind, title_en, title_ar, summary_en, summary_ar, hours_week, start_on, end_on, location_type) values ('x', 'p-training-mgr', 'project', 'x', 'x', 'x', 'x', 1, current_date, current_date, 'office')`); } catch { direct = true; }
  let direct2 = false;
  try { await as('sro', `update kafaa_opportunity_applications set status = 'selected' where poster_id = 'p-sro'`); direct2 = (await q(`select count(*)::int n from kafaa_opportunity_applications where poster_id = 'p-sro' and status = 'selected'`))[0].n === T.opportunity_applications.filter((a) => a.poster_id === 'p-sro' && a.status === 'selected').length; } catch { direct2 = true; }
  ok(direct && direct2, 'opportunities and applications cannot be written directly (RPC only)');

  // ── parity: line-manager routing and HR aggregates (as the table owner)
  const staff = T.people.filter((p) => p.kind === 'staff');
  const lm = await q(`select id, kafaa_opp_line_manager(id) as lm from kafaa_people where kind = 'staff'`);
  const today = (await q(`select current_date::text as d`))[0].d;
  const lmDiff = lm.filter((r) => r.lm !== lineManagerOf(r.id, T.people, T.role_assignments, today));
  ok(lm.length === staff.length && lmDiff.length === 0, `SQL line-manager routing equals the TS rule for all ${staff.length} staff${lmDiff.length ? ` (first diff ${lmDiff[0].id})` : ''}`);
  const statsSql = (await as('k-hr-analyst', 'select kafaa_opportunity_stats() as s'))[0].s;
  const ev = T.skill_evidence.filter((e) => e.kind === 'ojt' && e.ref_table === 'opportunity_applications' && e.active).length;
  const statsTs = computeStats(T.opportunities, T.opportunity_applications, ev);
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
  ok(canon(statsSql) === canon(statsTs), 'SQL HR aggregates equal the TS computeStats over the seed');
  ok(statsSql.by_family.some((f) => f.suppressed && f.applications === null) && statsSql.by_family.some((f) => !f.suppressed && f.applicants >= 10) && statsSql.by_family.every((f) => f.suppressed || f.applicants >= 10),
    'applications by family are suppressed below 10 applicants (counts only, never names)');
  ok((await as('k-ro', 'select kafaa_opportunity_stats() as s'))[0].s === null && (await as('k-auditor', 'select kafaa_opportunity_stats() as s'))[0].s !== null, 'employees get no HR aggregates; auditors do');

  // ── RPC flow
  const rpc = async (persona, sql, p = []) => (await as(persona, sql, p))[0].r;
  const base = { kind: 'project', title_en: 'Validator test project', title_ar: 'مشروع اختبار المدقق', summary_en: 'A short synthetic project used by the validator.', summary_ar: 'مشروع اصطناعي قصير يستخدمه المدقق للاختبار.',
    skills_needed: ['sk-hu-01'], skills_gained: ['sk-hu-02-brief', 'sk-ld-01-coach'], hours_week: 4, start_on: today, end_on: today, seats: 1, location_type: 'office', eligible_families: [], priority_flags: [], status: 'open' };
  const post = (persona, p) => rpc(persona, 'select kafaa_post_opportunity($1::jsonb) as r', [JSON.stringify(p)]);
  const sec = await post('training-mgr', { ...base, kind: 'security' });
  const prot = await post('training-mgr', { ...base, location_type: 'protected_area' });
  const secSkill = await post('training-mgr', { ...base, skills_gained: ['sk-sa-01'] });
  const audited = await q(`select count(*)::int n from kafaa_audit_events where action = 'opportunity.post' and outcome = 'refused' and reason like 'restricted_kind:%'`);
  ok(!sec.ok && sec.code === 'restricted_kind' && !prot.ok && prot.code === 'restricted_kind' && !secSkill.ok && secSkill.code === 'restricted_kind' && audited[0].n >= 3 && (await q(`select count(*)::int n from kafaa_opportunities where kind not in ('project','outage_support','shadowing','oe_review','knowledge_capture','outreach','research')`))[0].n === 0,
    'security, protected-area and security-skill opportunities are refused (restricted_kind) and audited; none is stored');
  const emp = await post('k-ro', base);
  const bad = await post('training-mgr', { ...base, hours_week: 40 });
  ok(!emp.ok && emp.code === 'forbidden' && !bad.ok && bad.code === 'invalid', 'employees cannot post; invalid input is refused');
  const created = await post('training-mgr', base);
  const oppId = created.data?.id;
  ok(created.ok && !!oppId, 'the training manager posts an opportunity');

  const apply = await rpc('k-ro', 'select kafaa_apply_opportunity($1, $2) as r', [oppId, 'Validator application']);
  const appId = apply.data?.id;
  ok(apply.ok && apply.data.releaser_id === 'p-sro' && apply.data.skip_level === false, "an application routes the release to the applicant's line manager (Crew B shift supervisor)");
  const dup = await rpc('k-ro', 'select kafaa_apply_opportunity($1, $2) as r', [oppId, '']);
  ok(!dup.ok && dup.code === 'conflict', 'a second live application to the same opportunity is refused');
  const early = await rpc('training-mgr', `select kafaa_select_applicant($1, 'selected', '') as r`, [appId]);
  ok(!early.ok && early.code === 'release_required', 'selecting before the line-manager release is refused (release_required)');
  const posterRel = await rpc('training-mgr', `select kafaa_release_decision($1, 'release', '') as r`, [appId]);
  ok(!posterRel.ok && posterRel.code === 'maker_checker', 'the poster cannot release an applicant (maker_checker)');
  const other = await rpc('ops-ceo', `select kafaa_release_decision($1, 'release', '') as r`, [appId]);
  ok(!other.ok && other.code === 'not_found', 'a manager who is not on the application cannot see or release it');
  const rel = await rpc('sro', `select kafaa_release_decision($1, 'release', 'Released for two days a week') as r`, [appId]);
  ok(rel.ok && rel.data.status === 'released', 'the line manager releases the applicant');
  const sel = await rpc('training-mgr', `select kafaa_select_applicant($1, 'selected', '') as r`, [appId]);
  const filled = (await q('select status from kafaa_opportunities where id = $1', [oppId]))[0].status;
  ok(sel.ok && sel.ledger_seq != null && filled === 'filled', 'the poster selects after release; the selection is in the NEXUS ledger and the one seat is filled');
  const self = await rpc('k-ro', `select kafaa_complete_opportunity($1, '{"sk-hu-02-brief":2}'::jsonb, 'Done well') as r`, [appId]);
  const badLv = await rpc('training-mgr', `select kafaa_complete_opportunity($1, '{"sk-pf-01":3}'::jsonb, 'Done well') as r`, [appId]);
  ok(!self.ok && self.code === 'maker_checker' && !badLv.ok && badLv.code === 'invalid', 'applicants cannot sign off their own work; only skills gained can be rated');
  const before = (await q(`select level from kafaa_person_skills where id = 'ps:p-k-ro:sk-ld-01-coach'`))[0];
  const done = await rpc('training-mgr', `select kafaa_complete_opportunity($1, '{"sk-hu-02-brief":2,"sk-ld-01-coach":3}'::jsonb, 'Ran two capture interviews and wrote the summary') as r`, [appId]);
  const evRows = await as('k-ro', `select id, kind, basis, level from kafaa_skill_evidence where ref_id = $1 order by id`, [appId]);
  const state = await as('k-ro', `select level, reasons from kafaa_person_skills where id = 'ps:p-k-ro:sk-ld-01-coach'`);
  ok(done.ok && done.ledger_seq != null && evRows.length === 2 && evRows.every((e) => e.kind === 'ojt' && e.basis === 'evidenced') && state[0]?.reasons.some((r) => r.code === 'ojt' && r.evidence_id === `se:ojt:${appId}:sk-ld-01-coach`) && state[0].level >= (before?.level ?? 0),
    'completion sign-off writes ojt evidence (basis evidenced) and the applicant\'s passport state shows it (ledger row written)');

  // maker-checker on a direct report: the line manager posted it, so the release goes to their own line manager
  const sroOpp = (await post('sro', { ...base, title_en: 'Crew B validator project', title_ar: 'مشروع اختبار للطاقم ب', eligible_families: ['operations'] })).data.id;
  const a2 = await rpc('k-ro', 'select kafaa_apply_opportunity($1, $2) as r', [sroOpp, '']);
  const mc = await rpc('sro', `select kafaa_release_decision($1, 'release', '') as r`, [a2.data.id]);
  const noReason = await rpc('ops-ceo', `select kafaa_release_decision($1, 'decline', '') as r`, [a2.data.id]);
  const skip = await rpc('ops-ceo', `select kafaa_release_decision($1, 'decline', 'Needed on shift this month') as r`, [a2.data.id]);
  ok(a2.ok && a2.data.skip_level && a2.data.releaser_id === 'p-ops-ceo' && !mc.ok && mc.code === 'maker_checker' && skip.ok && !noReason.ok,
    'a poster cannot release their own direct report onto their own opportunity (maker_checker); the skip-level manager decides');
  const audits = await q(`select count(*)::int n from kafaa_audit_events where action like 'opportunity.%'`);
  ok(audits[0].n >= 15, 'every marketplace RPC call writes an audit row (refusals included)');
}
