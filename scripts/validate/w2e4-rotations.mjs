// [W2 · E4 · F15] PGlite checks for 20261009124001_kafaa_w2e4_rotations.sql: RLS on the rotation and shadowing tables, SQL = TS
// parity (template validation, sign-off routing, programme board with suppression), and the full RPC flows with the card's
// acceptance criteria (host sign-off writes evidence and updates the passport; maker_checker for the person and for a line
// manager who is also host; cohort tiles suppressed below 10; GDP template seeded with its sourced 18 to 36 month duration).
import { readFileSync } from 'node:fs';
import { computeBoard, computeCandidates, signerFor, validateTemplate } from '../../src/modules/m20/rotation.ts';

export default async function w2e4Checks({ db, as, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 2400;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['ops-ceo', 'Operations CEO'], ['outage-manager', 'Outage Manager'], ['chem-sup', 'Chemistry Supervisor'], ['head-sq', 'Head of Supplier Quality'], ['qc-inspector', 'QC Receiving Inspector']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W2E4 · F15 rotations and job shadowing');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const today = (await q('select current_date::text as d'))[0].d;

  // ── RLS
  const tabs = ['kafaa_rotation_templates', 'kafaa_rotation_cohorts', 'kafaa_rotation_placements', 'kafaa_shadow_hosts', 'kafaa_shadow_requests'];
  ok((await Promise.all(tabs.map((t) => count(null, t)))).every((c) => c === 0), 'anonymous visitors read no rotation or shadowing rows');
  const listed = T.rotation_templates.filter((t) => t.listed).length;
  ok((await count('k-ro', 'kafaa_rotation_templates')) === listed && (await count('k-ro', 'kafaa_rotation_templates', "status = 'draft'")) === 0 && (await count('chco', 'kafaa_rotation_templates', "status = 'draft'")) === 1,
    `staff read the ${listed} published programmes; a draft is visible to its owner only`);
  ok((await count('k-ro', 'kafaa_rotation_cohorts')) === T.rotation_cohorts.length && (await count('gulfhydro-qa', 'kafaa_rotation_templates')) === 0, 'staff read the cohort list; partner users read no programmes');
  const kro = await as('k-ro', 'select person_id from kafaa_rotation_placements');
  ok(kro.length === T.rotation_placements.filter((p) => p.person_id === 'p-k-ro').length && kro.every((p) => p.person_id === 'p-k-ro'), 'a person on rotation reads only their own placements');
  const hsq = await as('head-sq', 'select person_id, host_manager_id, signer_id, line_manager_id, enrolled_by from kafaa_rotation_placements');
  ok(hsq.length > 0 && hsq.every((p) => [p.person_id, p.host_manager_id, p.signer_id, p.line_manager_id, p.enrolled_by].includes('p-head-sq')), 'a host manager reads only placements they host, sign off or line-manage');
  ok((await count('k-hr-analyst', 'kafaa_rotation_placements')) === 0 && (await count('k-hr-analyst', 'kafaa_shadow_requests')) === 0 && (await count('k-auditor', 'kafaa_rotation_placements')) === T.rotation_placements.length,
    'HR analysts read no individual placements or requests (board only); auditors read all');
  ok((await count('chco', 'kafaa_rotation_placements')) === T.rotation_placements.filter((p) => p.enrolled_by === 'p-chco').length, 'a programme owner reads the placements they enrolled');
  ok((await count('k-ro', 'kafaa_shadow_hosts')) === T.shadow_hosts.filter((h) => h.listed).length && (await count('k-ro', 'kafaa_shadow_requests')) === T.shadow_requests.filter((r) => r.person_id === 'p-k-ro').length,
    'staff read the listed shadowing hosts; shadowing requests are private to requester, host and line manager');
  let direct = false;
  try { await as('chco', `insert into kafaa_rotation_cohorts (id, template_id, programme, owner_id, name_en, name_ar, intake_on) values ('x', 'rt-gdp-engineering', 'gdp', 'p-chco', 'x', 'x', current_date)`); } catch { direct = true; }
  ok(direct, 'rotation tables cannot be written directly (RPC only)');

  // ── GDP template sourced duration
  const gdp = (await q(`select duration_min_months a, duration_max_months b, sources, steps from kafaa_rotation_templates where id = 'rt-gdp-engineering'`))[0];
  const gdpMonths = gdp.steps.reduce((s, x) => s + x.months, 0);
  ok(gdp.a === 18 && gdp.b === 36 && gdp.sources.some((s) => s.id === 'enec-careers' && /^https:\/\//.test(s.url)) && gdpMonths >= 18 && gdpMonths <= 36, 'the GDP template seeds with its sourced 18 to 36 month duration and a source link');

  // ── parity (pristine seed rows)
  const ctxTs = { people: T.people, assignments: T.role_assignments, today };
  const ref = { skills: T.skills, families: T.job_families.map((f) => f.id), roles: T.job_roles.map((r) => r.id), sources: T.sources.map((s) => s.id) };
  const inputs = T.rotation_templates.map((t) => ({ programme: t.programme, title_en: t.title_en, title_ar: t.title_ar, summary_en: t.summary_en, summary_ar: t.summary_ar, duration_min_months: t.duration_min_months, duration_max_months: t.duration_max_months, steps: t.steps, eligible_families: t.eligible_families, source_ids: t.sources.map((s) => s.id), status: t.status }));
  const g = inputs[0];
  inputs.push(
    { ...g, steps: [{ ...g.steps[0], family_id: 'security' }] }, { ...g, steps: [{ ...g.steps[0], objectives: [{ skill_id: 'sk-sa-01', level: 1, text_en: 'Security work', text_ar: 'عمل أمني' }] }] },
    { ...g, programme: 'apprentice' }, { ...g, title_ar: 'x' }, { ...g, duration_min_months: 40, duration_max_months: 30 }, { ...g, steps: [] }, { ...g, steps: [{ ...g.steps[0], months: 13 }] },
    { ...g, steps: [{ ...g.steps[0], host_manager_id: 'w-lo-01' }] }, { ...g, steps: [{ ...g.steps[0], host_manager_id: null, family_id: 'engineering' }] }, { ...g, duration_min_months: 30 },
    { ...g, eligible_families: ['nope'] }, { ...g, source_ids: ['nope'] }, { ...g, status: 'paused' }, { ...g, steps: [{ ...g.steps[0], site_induction: 'yes' }] },
    { ...g, steps: [{ ...g.steps[0], objectives: [g.steps[0].objectives[0], g.steps[0].objectives[0]] }] }, { ...g, steps: [{ ...g.steps[0], host_manager_id: null, family_id: 'quality', site_induction: null }], duration_min_months: 6 },
  );
  let vdiff = 0;
  for (const inp of inputs) {
    const sql = (await q('select kafaa_rot_validate_template($1::jsonb, current_date) v', [JSON.stringify(inp)]))[0].v;
    const ts = validateTemplate(inp, ref, ctxTs);
    if (canon(sql) !== canon(ts)) { vdiff++; if (vdiff === 1) console.log('    first diff', canon(sql).slice(0, 300), '\n    vs', canon(ts).slice(0, 300)); }
  }
  ok(vdiff === 0, `template validation and normalisation: SQL = TS for ${inputs.length} inputs (${T.rotation_templates.length} seeded, ${inputs.length - T.rotation_templates.length} refusals)`);
  const routes = await q('select id, person_id, host_manager_id, kafaa_rot_signer(person_id, host_manager_id) r from kafaa_rotation_placements');
  const rdiff = routes.filter((x) => { const t = signerFor(x.person_id, x.host_manager_id, T.people, T.role_assignments, today); return t.signer !== x.r.signer || t.skipLevel !== x.r.skip_level || t.lineManager !== x.r.line_manager; });
  ok(rdiff.length === 0 && routes.some((x) => x.r.skip_level), `sign-off routing (host, or skip level when the host is the line manager): SQL = TS for ${routes.length} placements`);
  const board = (await as('k-hr-analyst', 'select kafaa_rotation_board() b'))[0].b;
  const ev = T.skill_evidence.filter((e) => e.kind === 'ojt' && e.ref_table === 'rotation_placements' && e.active).length;
  const boardTs = computeBoard(T.rotation_templates, T.rotation_cohorts, T.rotation_placements, T.shadow_requests, ev, today);
  ok(canon(board) === canon(boardTs), 'SQL programme board equals the TS computeBoard over the seed');
  ok(board.cohorts.some((c) => c.suppressed && c.participants === null && c.met_pct === null) && board.cohorts.some((c) => !c.suppressed) && board.cohorts.every((c) => c.suppressed || c.participants >= 10)
    && board.by_family.every((f) => f.suppressed || f.people >= 10), 'cohort tiles and family rows are suppressed below 10 people (counts only, never names)');
  ok((await as('k-ro', 'select kafaa_rotation_board() b'))[0].b === null && (await as('k-auditor', 'select kafaa_rotation_board() b'))[0].b !== null && (await as('chco', 'select kafaa_rotation_board() b'))[0].b !== null,
    'employees get no programme board; HR and auditors do');
  const candSql = (await as('chco', `select kafaa_rotation_candidates('rt-gpo-field') c`))[0].c;
  // earlier checks change people rows (e.g. a leaver), so compare against the live rows
  const livePeople = await q('select id, kind, status, display_name, display_name_ar, job_role_id, job_family_id from kafaa_people');
  const liveRa = await q('select person_id, role, scope_type, scope_value, status, expires_at::text as expires_at from kafaa_role_assignments');
  const liveCtx = { people: livePeople, assignments: liveRa, today };
  const candTs = computeCandidates(T.rotation_templates.find((t) => t.id === 'rt-gpo-field'), livePeople, T.rotation_placements, liveCtx);
  const candAll = (await as('chco', `select kafaa_rotation_candidates(null) c`))[0].c;
  ok(canon(candSql) === canon(candTs) && canon(candAll) === canon(computeCandidates(null, livePeople, T.rotation_placements, liveCtx)) && candSql.some((c) => c.can_host) && candSql.some((c) => c.enrolled) && candSql.some((c) => !c.eligible) && (await as('k-ro', `select kafaa_rotation_candidates('rt-gpo-field') c`))[0].c === null && (await as('sro', `select kafaa_rotation_candidates('rt-gpo-field') c`))[0].c === null,
    `enrolment candidates (programme owners only): SQL = TS for ${candTs.length} staff`);

  // ── RPC flow: templates and cohorts
  const rpc = async (persona, sql, p = []) => (await as(persona, sql, p))[0].r;
  const tplIn = { programme: 'cross_functional', title_en: 'Validator rotation programme', title_ar: 'برنامج تناوب للاختبار', summary_en: 'A synthetic two-placement rotation used by the validator only.', summary_ar: 'تناوب اصطناعي من مرحلتين يستخدمه المدقق للاختبار فقط.',
    duration_min_months: 2, duration_max_months: 6, source_ids: [], eligible_families: [], status: 'active',
    steps: [
      { family_id: 'operations', host_team_en: 'Crew B field operations', host_team_ar: 'العمليات الميدانية للطاقم ب', host_manager_id: 'p-sro', months: 1, objectives: [{ skill_id: 'sk-co-01-rounds', level: 2, text_en: 'Complete rounds on two systems', text_ar: 'إكمال الجولات على نظامين' }, { skill_id: 'sk-hu-01-star', level: 2, text_en: 'Self-check every manipulation', text_ar: 'التحقق الذاتي في كل عملية' }] },
      { family_id: 'outage', host_team_en: 'Outage planning', host_team_ar: 'تخطيط الانقطاعات', months: 2, objectives: [{ skill_id: 'sk-mp-01-outage', level: 2, text_en: 'Plan one outage window', text_ar: 'تخطيط نافذة انقطاع واحدة' }] },
    ] };
  const save = (persona, p) => rpc(persona, 'select kafaa_save_rotation_template($1::jsonb) r', [JSON.stringify(p)]);
  const emp = await save('k-ro', tplIn);
  const mgr = await save('sro', tplIn);
  const sec = await save('chco', { ...tplIn, steps: [{ ...tplIn.steps[0], family_id: 'security' }] });
  const secAudit = (await q(`select count(*)::int n from kafaa_audit_events where action = 'rotation.template' and outcome = 'refused' and reason like 'restricted_kind:%'`))[0].n;
  const total = await save('chco', { ...tplIn, duration_min_months: 6 });
  ok(!emp.ok && emp.code === 'forbidden' && !mgr.ok && mgr.code === 'forbidden' && !sec.ok && sec.code === 'restricted_kind' && secAudit >= 1 && !total.ok && total.code === 'invalid',
    'only HR programme owners save programmes; security placements are refused and audited; placements must add up to the duration');
  const created = await save('chco', tplIn);
  const tid = created.data?.id;
  const stored = (await q('select steps from kafaa_rotation_templates where id = $1', [tid]))[0]?.steps;
  ok(created.ok && stored?.[1]?.host_manager_id === 'p-outage-manager' && stored?.[0]?.objectives?.[1]?.id === 'o1-2' && stored?.[0]?.site_induction === true, 'the CHCO office saves a programme; hosts default to the family manager and objectives get stable ids');
  const other = await save('k-hr-analyst', { ...tplIn, id: tid, title_en: 'Changed by another analyst' });
  const tm = await save('training-mgr', { ...tplIn, id: tid, title_en: 'Validator rotation programme v2' });
  ok(!other.ok && other.code === 'forbidden' && tm.ok, "another HR analyst cannot change the owner's programme; the training manager can");
  const coh = await rpc('chco', 'select kafaa_save_rotation_cohort($1::jsonb) r', [JSON.stringify({ template_id: tid, name_en: 'Validator cohort', name_ar: 'دفعة الاختبار', intake_on: today })]);
  ok(coh.ok && !!coh.data?.id, 'a programme owner creates a cohort');

  // ── enrolment
  const enrol = (persona, t, pers, c, start) => rpc(persona, 'select kafaa_enrol_rotation($1, $2, $3, $4) r', [t, pers, c, start]);
  const e0 = await enrol('sro', tid, 'p-k-ro', coh.data.id, today);
  const eDraft = await enrol('chco', 'rt-digital-draft', 'p-k-ro', null, today);
  const ePast = await enrol('chco', tid, 'p-k-ro', coh.data.id, '2020-01-01');
  const eMis = await enrol('chco', tid, 'p-k-ro', 'rc-gdp-2025', today);
  const e1 = await enrol('chco', tid, 'p-k-ro', coh.data.id, today);
  const eDup = await enrol('chco', tid, 'p-k-ro', coh.data.id, today);
  const pl = await q('select id, seq, signer_id, skip_level, line_manager_id, host_manager_id, starts_on::text s, ends_on::text e from kafaa_rotation_placements where enrolment_id = $1 order by seq', [e1.data?.enrolment_id]);
  ok(!e0.ok && e0.code === 'forbidden' && !eDraft.ok && eDraft.code === 'invalid' && !ePast.ok && !eMis.ok && eMis.code === 'invalid' && e1.ok && e1.ledger_seq != null && !eDup.ok && eDup.code === 'conflict',
    'programme owners enrol (ledger row); managers cannot; drafts, past starts, another programme\'s cohort and double enrolment are refused');
  ok(pl.length === 2 && pl[0].s === today && pl[0].host_manager_id === 'p-sro' && pl[0].line_manager_id === 'p-sro' && pl[0].skip_level && pl[0].signer_id === 'p-ops-ceo' && pl[1].signer_id === 'p-outage-manager' && !pl[1].skip_level,
    'the placement plan is consecutive; when the host is the line manager, the sign-off goes to the host\'s own line manager');
  const [p1, p2] = pl;

  // ── check-in and sign-off
  const ck = (persona, id, prog, note) => rpc(persona, 'select kafaa_placement_checkin($1, $2::jsonb, $3) r', [id, JSON.stringify(prog), note]);
  const early = await rpc('ops-ceo', `select kafaa_signoff_placement($1, '{"o1-1":2}'::jsonb, 'Signed off by the skip-level manager') r`, [p1.id]);
  const ckBad = await ck('k-ro', p1.id, { 'o1-1': 'on_track' }, 'Settled in well');
  const ckOut = await ck('outage-manager', p1.id, { 'o1-1': 'on_track', 'o1-2': 'met' }, 'Not my placement');
  const ckFuture = await ck('k-ro', p2.id, { 'o2-1': 'on_track' }, 'Too early to check in');
  const ckOk = await ck('k-ro', p1.id, { 'o1-1': 'on_track', 'o1-2': 'at_risk' }, 'Rounds going well; self-checking needs practice');
  const ckDup = await ck('sro', p1.id, { 'o1-1': 'met', 'o1-2': 'met' }, 'Host view of the check-in');
  ok(!early.ok && early.code === 'checkin_required' && !ckBad.ok && ckBad.code === 'invalid' && !ckOut.ok && ckOut.code === 'not_found' && !ckFuture.ok && ckFuture.code === 'invalid' && ckOk.ok && !ckDup.ok && ckDup.code === 'conflict',
    'the mid-point check-in needs a status for every objective, a started placement and the person or host; it is recorded once; sign-off needs it first');
  const self = await rpc('k-ro', `select kafaa_signoff_placement($1, '{"o1-1":2}'::jsonb, 'I did it all') r`, [p1.id]);
  const lmHost = await rpc('sro', `select kafaa_signoff_placement($1, '{"o1-1":2}'::jsonb, 'Signed by host and line manager') r`, [p1.id]);
  const notSigner = await rpc('outage-manager', `select kafaa_signoff_placement($1, '{"o1-1":2}'::jsonb, 'Not the signer') r`, [p1.id]);
  const badLv = await rpc('ops-ceo', `select kafaa_signoff_placement($1, '{"o9-9":2}'::jsonb, 'Bad objective id') r`, [p1.id]);
  ok(!self.ok && self.code === 'maker_checker' && !lmHost.ok && lmHost.code === 'maker_checker' && !notSigner.ok && notSigner.code === 'not_found' && !badLv.ok && badLv.code === 'invalid',
    'a placement cannot be signed off by the rotating person or by their line manager who is also host (maker_checker); only objectives can be rated');
  const before = (await q(`select level from kafaa_person_skills where id = 'ps:p-k-ro:sk-co-01-rounds'`))[0]?.level ?? 0;
  const so = await rpc('ops-ceo', `select kafaa_signoff_placement($1, '{"o1-1":3,"o1-2":1}'::jsonb, 'Confident on rounds; self-checking improving') r`, [p1.id]);
  const evRows = await as('k-ro', 'select id, kind, basis, level from kafaa_skill_evidence where ref_id = $1 order by id', [p1.id]);
  const st = (await as('k-ro', `select level, reasons from kafaa_person_skills where id = 'ps:p-k-ro:sk-co-01-rounds'`))[0];
  ok(so.ok && so.ledger_seq != null && so.data.met === 1 && so.data.total === 2 && evRows.length === 2 && evRows.every((e) => e.kind === 'ojt' && e.basis === 'evidenced') && st?.reasons.some((r) => r.code === 'ojt' && r.evidence_id === `se:ojt:${p1.id}:sk-co-01-rounds`) && st.level >= before,
    'host sign-off writes ojt evidence (basis evidenced) and the passport state shows it (ledger row written)');
  const again = await rpc('ops-ceo', `select kafaa_signoff_placement($1, '{"o1-1":3}'::jsonb, 'Second time') r`, [p1.id]);
  ok(!again.ok && again.code === 'invalid', 'a signed-off placement is closed');

  // ── shadowing hosts and requests
  const host = (persona, p) => rpc(persona, 'select kafaa_set_shadow_host($1::jsonb) r', [JSON.stringify(p)]);
  const hSec = await host('k-admin', { active: true, skill_ids: ['sk-da-01'], max_days_month: 2 });
  const hSkill = await host('k-ro', { active: true, skill_ids: ['sk-sa-01'], max_days_month: 2 });
  const hOk = await host('k-ro', { active: true, skill_ids: ['sk-co-01', 'sk-hu-02-brief'], max_days_month: 2, note_en: 'Crew B days', note_ar: 'أيام الطاقم ب' });
  ok(!hSec.ok && hSec.code === 'restricted_kind' && !hSkill.ok && hSkill.code === 'restricted_kind' && hOk.ok, 'security, cyber and safeguards staff and skills cannot host shadowing; others list themselves');
  const req = (persona, p) => rpc(persona, 'select kafaa_request_shadow($1::jsonb) r', [JSON.stringify(p)]);
  const base = { host_id: 'p-chem-sup', start_on: today, days: 2, skill_ids: ['sk-ch-02-labqa'], purpose: 'Learn laboratory quality control for outage support.' };
  const rSelf = await req('k-ro', { ...base, host_id: 'p-k-ro', skill_ids: ['sk-co-01'] });
  const rDays = await req('k-ro', { ...base, days: 6 });
  const rSkill = await req('k-ro', { ...base, skill_ids: ['sk-ch-01'] });
  const rDup = await req('k-ro', { ...base, host_id: 'p-rp-lead', skill_ids: ['sk-rp-01'] });
  const rGone = await req('k-ro', { ...base, host_id: 'p-doa-signatory', skill_ids: ['sk-en-01-project'] });
  const r1 = await req('k-ro', base);
  ok(!rSelf.ok && rSelf.code === 'conflict' && !rDays.ok && rDays.code === 'invalid' && !rSkill.ok && rSkill.code === 'invalid' && !rDup.ok && rDup.code === 'conflict' && !rGone.ok && rGone.code === 'not_found'
    && r1.ok && r1.data.line_manager_id === 'p-sro' && r1.data.same_person === false, 'shadowing is 1 to 5 days on skills the host offers; self, duplicate and unlisted hosts are refused; the request goes to host and line manager');
  const dec = (persona, d, note = '') => rpc(persona, 'select kafaa_decide_shadow($1, $2, $3) r', [r1.data.id, d, note]);
  const dOut = await dec('ops-ceo', 'approve');
  const dSelf = await dec('k-ro', 'approve');
  const dHost = await dec('chem-sup', 'approve');
  const dHost2 = await dec('chem-sup', 'approve');
  const dEarly = await dec('chem-sup', 'complete', 'Too early');
  const dNoReason = await dec('sro', 'decline');
  const dMgr = await dec('sro', 'approve');
  const status = (await q('select status, host_consent, manager_consent from kafaa_shadow_requests where id = $1', [r1.data.id]))[0];
  ok(!dOut.ok && dOut.code === 'not_found' && !dSelf.ok && dSelf.code === 'forbidden' && dHost.ok && dHost.data.status === 'requested' && !dHost2.ok && dHost2.code === 'conflict' && !dEarly.ok && !dNoReason.ok
    && dMgr.ok && status.status === 'approved' && status.host_consent && status.manager_consent, 'shadowing needs the consent of both the host and the line manager; each consents once');
  const dDone = await dec('chem-sup', 'complete', 'Ran two QC checks with the team');
  const ev2 = await as('k-ro', 'select kind, basis, level from kafaa_skill_evidence where ref_id = $1', [r1.data.id]);
  ok(dDone.ok && dDone.ledger_seq != null && ev2.length === 1 && ev2[0].kind === 'ojt' && ev2[0].level === 1, 'the host confirms completed shadowing: ojt evidence at level 1 and a ledger row');
  const audits = (await q(`select count(*)::int n from kafaa_audit_events where action like 'rotation.%' or action like 'shadow.%'`))[0].n;
  ok(audits >= 40, `every rotation and shadowing RPC call writes an audit row, refusals included (${audits})`);
}
