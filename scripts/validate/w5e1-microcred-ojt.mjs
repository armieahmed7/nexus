// [W5 · E1 · F32 + F38] PGlite checks for 20261009151001_kafaa_w5e1_microcred_ojt.sql.
// F32: RLS; SQL = TS for eligibility (every staff member x every published definition), award status, definition validation and the
//      credential builder (rebuilt and re-signed = seeded, byte for byte); the flows: award, approval with maker-checker, renewal,
//      stacking only with valid components, expired/revoked components flag the stack "renewal due", the copy check, public verify.
// F38: RLS; SQL = TS for entry validation and readiness; the flows: restricted tasks refused, idempotent client keys (one entry and
//      one xAPI statement), a practice entry never changes qualification records or evaluations, preceptor acknowledgement,
//      evaluation requests and their hand-off to kafaa_signoff_evaluation.
import { readFileSync } from 'node:fs';
import { canon } from '../../src/modules/m17/badgeCrypto.ts';
import { signingText, verifyCredential } from '../../src/modules/m17/issuer.ts';
import { publicPayloadProblems } from '../../src/modules/m17/publicPayload.ts';
import { alignedSkills, awardView, buildMicrocredCredential, eligibility, hasRegulatoryWording, validateDef } from '../../src/modules/m17/microcred.ts';
import { readiness, validateLog } from '../../src/modules/m02/ojt.ts';

export default async function w5e1Checks({ db, as, count, ok, uid }) {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 5100;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['k-lo-trainee', 'Local Operator'], ['qc-inspector', 'QC Inspector'], ['sq-lead', 'Supply Quality Lead'], ['head-sq', 'Head of Supply Quality'], ['chco', 'CHCO']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W5E1 · F32 micro-credentials, F38 OJT logbook');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const rpc = async (persona, fn, args = []) => (await as(persona, `select ${fn} as r`, args))[0].r;
  const rows = async (table, where = 'true') => (await q(`select to_jsonb(x) j from ${table} x where ${where}`)).map((r) => r.j);
  const today = (await q('select current_date::text d'))[0].d;
  const world = async () => ({
    today, defs: await rows('kafaa_microcred_defs'), awards: await rows('kafaa_microcred_awards'), courses: await rows('kafaa_courses'), training_records: await rows('kafaa_training_records'),
    attempts: await rows('kafaa_attempts'), opportunities: await rows('kafaa_opportunities'), opportunity_applications: await rows('kafaa_opportunity_applications'), person_skills: await rows('kafaa_person_skills'),
    // FS31 (fsDe3): adaptive and task criteria read FS21/FS22 results (voided by an integrity decision never count)
    adaptive_attempts: await rows('kafaa_adaptive_attempts'), task_attempts: await rows('kafaa_task_attempts'), integrity_reports: await rows('kafaa_integrity_reports'),
  });

  // ═════════════ F32
  ok((await count(null, 'kafaa_microcred_defs')) === T.microcred_defs.length && (await count(null, 'kafaa_microcred_awards')) === 0, 'anonymous visitors read the micro-credential catalogue but no award');
  const kroAwards = await count('k-ro', 'kafaa_microcred_awards');
  ok(kroAwards >= 4 && (await count('k-ro', 'kafaa_microcred_awards', 'person_id <> kafaa_me()')) === 0, `an employee reads only their own awards (${kroAwards})`);
  ok((await count('training-mgr', 'kafaa_microcred_awards')) === (await q('select count(*)::int n from kafaa_microcred_awards'))[0].n, 'the training manager (skills_profile A) reads every award');
  ok((await count('chco', 'kafaa_microcred_awards', 'person_id <> kafaa_me()')) === 0, 'HR (aggregates only) reads no one else\'s award');
  ok((await count('sro', 'kafaa_microcred_awards', "person_id <> kafaa_me() and person_id not in (select id from kafaa_people where crew = 'B')")) === 0, 'a shift supervisor reads awards of crew B only');

  // eligibility: SQL = TS for every staff member x every published definition (state of this database)
  {
    const w = await world();
    const sql = await q(`select p.id pid, d.code, kafaa_mc_eligibility(d, p.id, current_date) e from kafaa_people p cross join kafaa_microcred_defs d
      where p.kind = 'staff' and d.status = 'current' order by p.id collate "C", d.code collate "C"`);
    let diff = null;
    for (const r of sql) {
      const def = w.defs.find((d) => d.code === r.code && d.status === 'current');
      const ts = eligibility(def, r.pid, w);
      if (canon(ts) !== canon(r.e)) { diff = `${r.pid} ${r.code}\n    sql ${canon(r.e)}\n    ts  ${canon(ts)}`; break; }
    }
    const elig = sql.filter((r) => r.e.auto_met).length;
    ok(!diff && sql.length > 1000 && elig > 50, `eligibility SQL = TS for ${sql.length} person x definition pairs (${elig} met)${diff ? `; first diff ${diff}` : ''}`);
    const views = await q(`select a.id, kafaa_mc_view(a, current_date) v from kafaa_microcred_awards a order by a.id collate "C"`);
    const vdiff = views.find((r) => canon(awardView(w.awards.find((a) => a.id === r.id), today, w.awards)) !== canon(r.v));
    ok(!vdiff && views.length === T.microcred_awards.length, `award status SQL = TS for all ${views.length} seeded awards${vdiff ? `; first diff ${vdiff.id}` : ''}`);
    const states = new Set(views.map((r) => r.v.status));
    ok(['active', 'renewal_due', 'expired', 'superseded', 'pending_approval', 'revoked', 'declined'].every((s) => states.has(s)), 'the seed holds active, renewal-due, expired, renewed, pending, revoked and declined awards');
    const stackDue = views.find((r) => r.id.startsWith('mca-w-lo-02-mc-outage-pro'));
    ok(stackDue?.v.status === 'renewal_due' && stackDue.v.reason === 'component', 'an expired component flags the seeded stacked credential "renewal due" (w-lo-02, Outage professional)');

    // credential builder + signer: SQL rebuild of every seeded award = the TS-built, TS-signed seed, byte for byte
    const aw = await q(`select a.*, to_char(a.issued_on, 'YYYY-MM-DD') issued_on, to_char(a.valid_to, 'YYYY-MM-DD') valid_to, a.credential::text ct from kafaa_microcred_awards a where a.status in ('awarded', 'superseded', 'revoked') and a.key_id = 'key-1' order by a.id collate "C"`);
    let same = 0, tsSame = 0, sig = 0;
    for (const a of aw) {
      const d = w.defs.find((x) => x.id === a.def_id);
      const comps = (a.component_award_ids ?? []).map((id) => { const c = w.awards.find((x) => x.id === id); const cd = w.defs.find((x) => x.code === c.def_code && x.status === 'current'); return { slug: c.public_slug, code: c.def_code, title_en: cd.title_en }; });
      const [{ j }] = await q(`select kafaa_badge_sign(kafaa_mc_credential($1, d, $2, $3::date, $4::date, $5::jsonb, 'key-1'))::text j from kafaa_microcred_defs d where d.id = $6`,
        [a.public_slug, a.holder_initials, a.issued_on, a.valid_to, JSON.stringify(comps), a.def_id]);
      const stored = JSON.parse(a.ct);
      if (canon(JSON.parse(j)) === canon(stored)) same++;
      const tsCred = buildMicrocredCredential({ slug: a.public_slug, def: d, holderInitials: a.holder_initials, issuedOn: String(a.issued_on).slice(0, 10), validTo: a.valid_to ? String(a.valid_to).slice(0, 10) : null,
        alignment: alignedSkills(d, T.skills, T.competencies), components: comps, keyId: 'key-1' });
      if (signingText(tsCred) === signingText(stored)) tsSame++;
      if (verifyCredential(stored).outcome === 'valid') sig++;
    }
    ok(aw.length > 50 && same === aw.length && tsSame === aw.length && sig === aw.length, `all ${aw.length} seeded micro-credentials: SQL builder + signer = TS builder + signer, every Ed25519 proof verifies (${same}/${tsSame}/${sig})`);
    ok(w.defs.every((d) => !hasRegulatoryWording(d.title_en, d.title_ar, d.summary_en, d.summary_ar, ...d.criteria.flatMap((c) => [c.label_en, c.label_ar]))), 'copy check: no seeded definition reads as a FANR certificate, licence or qualification');
  }

  // definition validation: SQL = TS on crafted inputs (copy check, security, mirrors, shapes)
  {
    const dw = { defs: await rows('kafaa_microcred_defs'), courses: await rows('kafaa_courses'), forms: await rows('kafaa_assessment_forms'), opportunities: await rows('kafaa_opportunities'),
      skills: await rows('kafaa_skills'), competencies: await rows('kafaa_competencies'), job_roles: await rows('kafaa_job_roles'), qual_standards: await rows('kafaa_qual_standards') };
    const base = { code: 'MC-QA-AWARE', kind: 'micro', area: 'quality', level: 'foundation', title_en: 'Quality awareness in the field', title_ar: 'الوعي بالجودة في الميدان',
      summary_en: 'Applies NQA-1 quality requirements on the job.', summary_ar: 'يطبّق متطلبات الجودة NQA-1 في العمل.', validity_months: 24, hours: 6, stacks_into: null,
      criteria: [{ key: 'qa', kind: 'skill', ref: 'sk-qa-01', min_level: 2, label_en: 'NQA-1 quality requirements at level 2', label_ar: 'متطلبات الجودة NQA-1 بمستوى 2' },
        { key: 'brief', kind: 'manual', ref: '', min_level: null, label_en: 'Field observation by a supervisor', label_ar: 'ملاحظة ميدانية من المشرف' }],
      alignment: [{ skill_id: 'sk-qa-01', level: 2 }], role_ids: ['quality-assurance-qc'] };
    const cases = [
      ['valid', base],
      ['regulatory EN', { ...base, title_en: 'FANR certified quality inspector' }],
      ['regulatory AR', { ...base, summary_ar: 'يمنح ترخيص العمل في المحطة للمتدرب.' }],
      ['licence label', { ...base, criteria: [{ ...base.criteria[0], label_en: 'Holds a reactor operator licence' }] }],
      ['security skill', { ...base, criteria: [{ ...base.criteria[0], ref: 'sk-sa-01' }] }],
      ['security course', { ...base, criteria: [{ key: 'c', kind: 'course', ref: 'c-sec-aw', min_level: null, label_en: 'Security awareness course', label_ar: 'دورة التوعية الأمنية' }] }],
      ['security alignment', { ...base, alignment: [{ skill_id: 'sk-sa-01', level: 1 }] }],
      ['mirror', { ...base, criteria: [{ key: 'q', kind: 'course', ref: 'qs-ro', min_level: null, label_en: 'Qualified on the RO card', label_ar: 'مؤهل على بطاقة المشغل' }] }],
      ['bad code', { ...base, code: 'qa-aware' }],
      ['string validity', { ...base, validity_months: '24' }],
      ['manual with ref', { ...base, criteria: [{ ...base.criteria[1], ref: 'x' }] }],
      ['stack into micro', { ...base, stacks_into: 'MC-HU-PRAC' }],
      ['unknown role', { ...base, role_ids: ['astronaut'] }],
      ['duplicate key', { ...base, criteria: [base.criteria[0], { ...base.criteria[0] }] }],
    ];
    const res = [];
    for (const [name, c] of cases) res.push([name, validateDef(c, dw).code, (await q('select kafaa_mc_validate_def($1::jsonb) v', [JSON.stringify(c)]))[0].v]);
    ok(res.every(([, a, b]) => a === b), `definition validation SQL = TS on ${res.length} cases${res.filter(([, a, b]) => a !== b).map(([x, a, b]) => `; ${x}: ts ${a} sql ${b}`).join('')}`);
    ok(res[0][1] === 'ok' && res[1][1] === 'regulatory_wording' && res[2][1] === 'regulatory_wording' && res[3][1] === 'regulatory_wording' && res[4][1] === 'security_restricted'
      && res[5][1] === 'security_restricted' && res[6][1] === 'security_restricted' && res[7][1] === 'mirror_only' && res.slice(8).every(([, a]) => a === 'invalid'),
    'copy check refuses FANR / licence wording (EN and AR); security courses, skills and alignment refused; mirrors refused; shapes enforced');

    // definitions RPCs: framework owners only; draft -> publish (ledger) -> new version supersedes -> retire
    ok((await rpc('k-ro', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify(base)])).code === 'forbidden', 'an employee cannot manage micro-credential definitions');
    const wr = await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify({ ...base, title_en: 'Quality awareness: FANR licence holder' })]);
    const wrA = (await q(`select outcome from kafaa_audit_events where action = 'microcred.def_save' order by seq desc limit 1`))[0];
    ok(wr.code === 'regulatory_wording' && wrA.outcome === 'refused', 'saving a definition that implies FANR certification is refused and audited');
    const s1 = await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify(base)]);
    const s1b = await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify({ ...base, hours: 8 })]);
    ok(s1.ok && s1.data.version === 1 && (await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify({ ...base, hours: 8 })])).code === 'conflict' && !s1b.ok, 'a new code is saved as draft version 1; a second create with the same code is refused');
    const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
    const p1 = await rpc('training-mgr', `kafaa_set_microcred_def_status($1, 'current', 'Pilot with the QC team')`, [s1.data.id]);
    const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
    ok(p1.ok && led1 === led0 + 1 && (await count(null, 'kafaa_microcred_defs', `id = '${s1.data.id}' and status = 'current'`)) === 1, 'publishing a draft makes it current and appends to the NEXUS ledger');
    const v2 = await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify({ ...base, id: s1.data.id, hours: 10, change_reason: 'More field time' })]);
    const p2 = await rpc('training-mgr', `kafaa_set_microcred_def_status($1, 'current', null)`, [v2.data?.id]);
    const vs = await q(`select version, status, supersedes_id from kafaa_microcred_defs where code = 'MC-QA-AWARE' order by version`);
    ok(v2.ok && v2.data.version === 2 && p2.ok && vs[0].status === 'superseded' && vs[1].status === 'current' && vs[1].supersedes_id === s1.data.id, 'revising creates version 2; publishing it supersedes version 1 (versioned like qualification standards)');
    const stk = await rpc('training-mgr', 'kafaa_save_microcred_def($1::jsonb)', [JSON.stringify({ ...base, code: 'MC-QA-STACK', kind: 'stack', criteria: [] })]);
    ok(stk.ok && (await rpc('training-mgr', `kafaa_set_microcred_def_status($1, 'current', null)`, [stk.data.id])).code === 'invalid', 'a stacked credential cannot be published without two published components');
    const rt = await rpc('training-mgr', `kafaa_set_microcred_def_status($1, 'retired', 'Pilot finished')`, [v2.data.id]);
    ok(rt.ok && (await rpc('training-mgr', `kafaa_set_microcred_def_status($1, 'retired', 'again')`, [v2.data.id])).code === 'conflict', 'a published definition is retired once (holders keep their awards)');
  }

  // award flows
  {
    const e0 = await rpc('qc-inspector', 'kafaa_microcred_eligibility(null, $1)', ['MC-DATA-FOUND']);
    ok(e0.allowed && e0.items[0].eligible === true, 'the QC inspector is eligible for Plant data foundations from validated and evidenced skills');
    ok((await rpc('k-ro', 'kafaa_microcred_eligibility($1, null)', ['p-qc-inspector'])).code === 'forbidden', 'an employee cannot read someone else\'s eligibility');
    ok((await rpc('head-sq', 'kafaa_microcred_eligibility($1, null)', ['p-qc-inspector'])).allowed === true, 'a line manager reads eligibility for a person in scope');
    const before = (await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'microcred_awards'`))[0].n;
    const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
    const a1 = await rpc('qc-inspector', 'kafaa_award_microcred($1)', ['MC-DATA-FOUND']);
    const row = (await q(`select * from kafaa_microcred_awards where id = $1`, [a1.data?.id]))[0];
    const evN = (await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'microcred_awards' and ref_id = $1 and kind = 'credential' and basis = 'evidenced'`, [a1.data?.id]))[0].n;
    ok(a1.ok && row.status === 'awarded' && verifyCredential(row.credential).outcome === 'valid' && row.credential.credentialSubject.achievement.achievementType === 'MicroCredential'
      && evN === 1 && (await q('select count(*)::int n from ledger_entries'))[0].n === led0 + 1 && before + 1 === (await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'microcred_awards'`))[0].n,
    'an eligible employee earns a signed Open Badges 3.0 micro-credential (key-1), F01 credential evidence and a ledger entry');
    ok((await rpc('qc-inspector', 'kafaa_award_microcred($1)', ['MC-DATA-FOUND'])).code === 'already_awarded', 'an active micro-credential is not issued twice');
    ok((await rpc('qc-inspector', 'kafaa_award_microcred($1)', ['MC-COACH'])).code === 'not_eligible' && (await rpc('qc-inspector', 'kafaa_award_microcred($1)', ['MC-H2-HEAT'])).code === 'not_found',
      'not eligible -> not_eligible; a draft definition cannot be earned');
    // eligibility is reproducible from the listed evidence: the snapshot rows exist and satisfy each met criterion
    const snap = row.evidence.filter((c) => c.status === 'met');
    const backed = [];
    for (const c of snap) for (const e of c.evidence) backed.push((await q(`select count(*)::int n from kafaa_${e.table} where id = $1 and person_id = 'p-qc-inspector'`, [e.id]))[0].n === 1);
    ok(snap.length === 2 && backed.length === 2 && backed.every(Boolean), 'the stored evidence snapshot lists the rows each met criterion rests on');
    // verify (public)
    const v = await rpc(null, 'kafaa_verify_microcred($1)', [row.public_slug]);
    ok(v.ok && v.data.status === 'active' && publicPayloadProblems(v.data).length === 0 && v.data.credential.credentialSubject.holderInitials && !JSON.stringify(v.data).includes('p-qc-inspector'),
      'public verification returns the signed credential with initials only (no person id, name, email or photo)');
    ok((await rpc(null, 'kafaa_verify_microcred($1)', ['mcnope'])).code === 'not_found', 'an unknown link is not found (audited)');

    // manual criteria: request -> training manager approval (maker-checker)
    const pend = (await q(`select id from kafaa_microcred_awards where person_id = 'p-sro' and status = 'pending_approval'`))[0];
    ok(!!pend && (await rpc('sro', `kafaa_decide_microcred_award($1, 'approve', 'Looks good')`, [pend.id])).code === 'forbidden', 'only a training manager approves manual criteria');
    await db.query(`insert into kafaa_microcred_awards (id, def_id, def_code, def_version, person_id, holder_initials, status, evidence, component_award_ids, credential)
      select 'mca-pglite-tm', id, code, version, 'p-training-mgr', 'TM', 'pending_approval', '[]', '{}', '{}' from kafaa_microcred_defs where code = 'MC-PROJECT' and status = 'current' on conflict do nothing`);
    ok((await rpc('training-mgr', `kafaa_decide_microcred_award('mca-pglite-tm', 'approve', 'My own request')`)).code === 'maker_checker', 'a training manager cannot approve their own micro-credential (maker_checker)');
    const ap = await rpc('training-mgr', `kafaa_decide_microcred_award($1, 'approve', 'Project brief and close-out reviewed')`, [pend.id]);
    const apRow = (await q(`select * from kafaa_microcred_awards where id = $1`, [pend.id]))[0];
    ok(ap.ok && apRow.status === 'awarded' && apRow.decided_by === 'p-training-mgr' && apRow.evidence.find((c) => c.kind === 'manual')?.status === 'met' && verifyCredential(apRow.credential).outcome === 'valid',
      'the approval re-checks the evidence, marks the manual criterion met and signs the credential');
    const req = await rpc('k-ro', 'kafaa_award_microcred($1)', ['MC-PROJECT']);
    ok(req.code === 'not_eligible' || (req.ok && req.data.status === 'pending_approval'), 'a definition with manual criteria becomes a request, never a direct award');

    // stacking: issue only when every component is valid; a revoked or expired component flags the stack
    const stack = (await q(`select * from kafaa_microcred_awards where person_id = 'p-k-ro' and def_code = 'MC-HP-CHAMPION' and status = 'awarded'`))[0];
    const scwe = (await q(`select * from kafaa_microcred_awards where person_id = 'p-k-ro' and def_code = 'MC-SCWE' and status = 'awarded'`))[0];
    const view = async (id) => (await q(`select kafaa_mc_view(a, current_date) v from kafaa_microcred_awards a where id = $1`, [id]))[0].v;
    ok((await view(stack.id)).status === 'active', 'k-ro holds the Human performance champion stack with every component valid');
    const rv = await rpc('k-ro', 'kafaa_revoke_microcred($1, $2)', [scwe.id, 'Withdrawn for the test']);
    const sv = await view(stack.id);
    ok(rv.ok && sv.status === 'renewal_due' && sv.reason === 'component', 'withdrawing a component flags the stacked credential "renewal due"');
    ok((await rpc('k-ro', 'kafaa_award_microcred($1)', ['MC-HP-CHAMPION'])).code === 'not_eligible', 'the stack cannot be renewed while a component is not valid');
    const re = await rpc('k-ro', 'kafaa_award_microcred($1)', ['MC-SCWE']);
    const rs = await rpc('k-ro', 'kafaa_award_microcred($1)', ['MC-HP-CHAMPION']);
    const newStack = (await q(`select * from kafaa_microcred_awards where id = $1`, [rs.data?.id]))[0];
    ok(re.ok && rs.ok && newStack.renewed_from === stack.id && (await q(`select status from kafaa_microcred_awards where id = $1`, [stack.id]))[0].status === 'superseded'
      && (await view(newStack.id)).status === 'active' && newStack.component_award_ids.includes(re.data.id), 'after the component is earned again the stack renews (old award superseded, new one lists the valid components)');
    // expiry of a component (the component's validity ends)
    const hu = (await q(`select * from kafaa_microcred_awards where person_id = 'p-k-ro' and def_code = 'MC-HU-PRAC' and status = 'awarded'`))[0];
    await db.query(`update kafaa_microcred_awards set valid_to = current_date - 1 where id = $1`, [hu.id]);
    const ev2 = await view(newStack.id);
    await db.query(`update kafaa_microcred_awards set valid_to = $2 where id = $1`, [hu.id, hu.valid_to]);
    ok(ev2.status === 'renewal_due' && ev2.reason === 'component' && (await view(newStack.id)).status === 'active', 'an expired component flags the stacked credential "renewal due"');
    // sweep and stats
    const sw = await rpc('training-mgr', 'kafaa_microcred_sweep()');
    const sw2 = await rpc('training-mgr', 'kafaa_microcred_sweep()');
    ok(sw.ok && sw.data.notices > 0 && sw2.data.notices === 0 && (await rpc('k-ro', 'kafaa_microcred_sweep()')).code === 'forbidden', 'the renewal sweep sends each notice once (training manager only)');
    const stE = await rpc('training-mgr', 'kafaa_microcred_stats()');
    const stA = await rpc('chco', 'kafaa_microcred_stats()');
    ok(stE.allowed && stE.exact && stE.rows.some((r) => r.holders > 0) && stA.allowed && !stA.exact && stA.rows.every((r) => r.holders === null || r.holders >= 10) && (await rpc('k-ro', 'kafaa_microcred_stats()')).allowed === false,
      'statistics: exact for the training manager, holders under 10 suppressed for HR aggregates, nothing for employees');
    ok((await q(`select count(*)::int n from pg_proc p where p.proname like 'kafaa_mc_%' and has_function_privilege('authenticated', p.oid, 'execute')`))[0].n === 0, 'micro-credential helpers are not executable by API roles');
  }

  // ═════════════ F38
  ok((await count(null, 'kafaa_ojt_logs')) === 0 && (await count(null, 'kafaa_ojt_eval_requests')) === 0, 'anonymous visitors read no OJT entries');
  ok((await count('qc-inspector', 'kafaa_ojt_logs')) === T.ojt_logs.filter((l) => l.person_id === 'p-qc-inspector').length && (await count('qc-inspector', 'kafaa_ojt_logs', 'person_id <> kafaa_me()')) === 0, 'a trainee reads their own entries only');
  const sqlAddressed = T.ojt_logs.filter((l) => l.preceptor_person_id === 'p-sq-lead').length;
  ok((await count('sq-lead', 'kafaa_ojt_logs', `preceptor_person_id = kafaa_me()`)) === sqlAddressed && (await count('k-ro', 'kafaa_ojt_logs')) === 0, 'a preceptor reads the entries addressed to them; an unrelated employee reads none');
  ok((await count('sro', 'kafaa_ojt_logs', "person_id not in (select id from kafaa_people where crew = 'B')")) === 0, 'a shift supervisor reads entries of crew B only');
  {
    // SQL = TS: validation and readiness
    const cases = [
      { client_key: 'ojt:test:000001', task_id: 'x', on_date: today, mode: 'perform', preceptor_person_id: 'x', confidence: 3 },
      { client_key: 'short', task_id: 'x', on_date: today, mode: 'perform', preceptor_person_id: 'x', confidence: 3 },
      { client_key: 'ojt:test:000002', task_id: 'x', on_date: '2099-01-01', mode: 'perform', preceptor_person_id: 'x', confidence: 3 },
      { client_key: 'ojt:test:000003', task_id: 'x', on_date: '2020-01-01', mode: 'perform', preceptor_person_id: 'x', confidence: 3 },
      { client_key: 'ojt:test:000004', task_id: 'x', on_date: today, mode: 'teleport', preceptor_person_id: 'x', confidence: 3 },
      { client_key: 'ojt:test:000005', task_id: 'x', on_date: today, mode: 'walkthrough', preceptor_person_id: 'x', confidence: '3' },
      { client_key: 'ojt:test:000006', task_id: 'x', on_date: today, mode: 'simulate', preceptor_person_id: 'x', confidence: 6 },
      { client_key: 'ojt:test:000007', task_id: 'x', on_date: today, mode: 'simulate', preceptor_person_id: 'x', confidence: 2, note: 'x'.repeat(501) },
      { client_key: 'ojt:test:000008', task_id: 'x', on_date: '2026-02-30', mode: 'simulate', preceptor_person_id: 'x', confidence: 2 },
    ];
    const res = [];
    for (const c of cases) res.push([validateLog(c, today), (await q('select kafaa_ojt_validate($1::jsonb, current_date) v', [JSON.stringify(c)]))[0].v]);
    ok(res.every(([a, b]) => a === b) && res[0][0] === 'ok' && res[1][0] === 'bad_key' && res.slice(2).every(([a]) => a === 'invalid'), `entry validation SQL = TS on ${res.length} cases`);
    const logs = await rows('kafaa_ojt_logs');
    const pairs = [...new Set(logs.map((l) => `${l.person_id}|${l.task_id}`))];
    let rd = 0, rdiff = null;
    for (const p of pairs) {
      const [pid, tid] = p.split('|');
      const task = (await q('select id, critical from kafaa_task_items where id = $1', [tid]))[0];
      const sql = (await q('select kafaa_ojt_readiness($1, $2, $3) r', [pid, tid, task.critical]))[0].r;
      const tsr = readiness(task, logs.filter((l) => l.person_id === pid));
      if (canon(sql) === canon(tsr)) rd++; else if (!rdiff) rdiff = `${p}: sql ${canon(sql)} ts ${canon(tsr)}`;
    }
    ok(rd === pairs.length && pairs.length > 10, `readiness SQL = TS for all ${pairs.length} trainee x task pairs${rdiff ? `; ${rdiff}` : ''}`);
    const stmts = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f38_ojt'`))[0].n;
    ok(stmts === T.ojt_logs.length, `every seeded OJT entry has exactly one xAPI statement (${stmts})`);
  }
  {
    const digest = async () => (await q(`select md5(string_agg(to_jsonb(x)::text, '|' order by x.id collate "C")) d from kafaa_qual_records x`))[0].d + (await q(`select md5(string_agg(to_jsonb(x)::text, '|' order by x.id collate "C")) d from kafaa_evaluations x`))[0].d;
    const q0 = await digest();
    const st0 = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f38_ojt'`))[0].n;
    const entry = { client_key: 'ojt:pglite:qc-0001', task_id: 'qs-qa-t2', on_date: today, mode: 'perform', preceptor_person_id: 'p-sq-lead', confidence: 4, conditions: 'Supplier audit', note: 'Led the closing meeting.' };
    const l1 = await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify(entry)]);
    const l2 = await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...entry, offline: true })]);
    const st1 = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f38_ojt'`))[0].n;
    const stmt = (await q(`select * from kafaa_xapi_statements where source = 'f38_ojt' and source_ref = $1`, [l1.data?.id]))[0];
    ok(l1.ok && !l1.data.duplicate && l2.ok && l2.data.duplicate && l2.data.id === l1.data.id && (await q(`select count(*)::int n from kafaa_ojt_logs where client_key = $1`, [entry.client_key]))[0].n === 1,
      'the same client key syncs exactly once (a re-sent offline entry records nothing new)');
    ok(st1 === st0 + 1 && stmt?.verb === 'attempted' && stmt.object_type === 'task' && stmt.object_id === 'qs-qa-t2' && !JSON.stringify(stmt).includes('closing meeting'), 'a practice entry emits one xAPI `attempted` statement to the F30 store (no free text)');
    ok((await digest()) === q0, 'a practice entry never changes qualification records or evaluations');
    // refusals
    await db.query(`insert into kafaa_task_items (id, standard_id, code, statement_en, statement_ar, method, evaluator_role) values ('qs-sec-pglite', 'qs-sec', 'SEC-X', 'Restricted task', 'مهمة مقيدة', 'ojt', 'Security evaluator') on conflict do nothing`);
    const k = (s) => JSON.stringify({ ...entry, client_key: `ojt:pglite:${s}` });
    const sec = await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...entry, client_key: 'ojt:pglite:sec1', task_id: 'qs-sec-pglite' })]);
    const secA = (await q(`select outcome from kafaa_audit_events where action = 'ojt.log' order by seq desc limit 1`))[0];
    ok(sec.code === 'security_restricted' && secA.outcome === 'refused', 'a security-restricted task cannot be logged (security_restricted, audited)');
    ok((await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...JSON.parse(k('self')), preceptor_person_id: 'p-qc-inspector' })])).code === 'self_preceptor'
      && (await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...JSON.parse(k('kro')), preceptor_person_id: 'p-k-ro' })])).code === 'not_preceptor'
      && (await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...JSON.parse(k('cls')), task_id: 'qs-get-t2' })])).code === 'not_practice_task'
      && (await rpc('qc-inspector', 'kafaa_log_practice($1::jsonb)', [JSON.stringify({ ...JSON.parse(k('ro')), task_id: 'qs-ro-t1' })])).code === 'not_applicable'
      && (await rpc(null, 'kafaa_log_practice($1::jsonb)', [k('anon')]).then(() => false, () => true)),
    'preceptor must be qualified and not the trainee; classroom items and other standards refused; anonymous callers cannot execute');
  }
  {
    // preceptor acknowledgement
    const pending = (await q(`select id from kafaa_ojt_logs where person_id = 'p-qc-inspector' and status = 'pending_ack' and preceptor_person_id = 'p-sq-lead' order by id collate "C" limit 1`))[0];
    ok((await rpc('k-ro', 'kafaa_ack_practice($1::jsonb)', [JSON.stringify({ log_id: pending.id, decision: 'acknowledge', feedback: 'ok fine', ready: true })])).code === 'not_preceptor', 'only the preceptor named on the entry can acknowledge it');
    const a1 = await rpc('sq-lead', 'kafaa_ack_practice($1::jsonb)', [JSON.stringify({ log_id: pending.id, decision: 'acknowledge', feedback: 'Good audit leadership; findings factual.', ready: false })]);
    ok(a1.ok && a1.data.status === 'acknowledged' && (await rpc('sq-lead', 'kafaa_ack_practice($1::jsonb)', [JSON.stringify({ log_id: pending.id, decision: 'acknowledge', feedback: 'again', ready: false })])).code === 'conflict',
      'the preceptor acknowledges an entry once, with feedback');
    // evaluation request
    ok((await rpc('qc-inspector', 'kafaa_request_evaluation($1, $2, null)', ['qs-qa-t2', 'p-head-sq'])).code === 'not_ready', 'a task without enough supervised performances and a preceptor "ready" cannot be sent for evaluation');
    ok((await rpc('qc-inspector', 'kafaa_request_evaluation($1, $2, null)', ['qs-qa-t1', 'p-qc-inspector'])).code === 'self_evaluator'
      && (await rpc('qc-inspector', 'kafaa_request_evaluation($1, $2, null)', ['qs-qa-t1', 'p-k-ro'])).code === 'not_evaluator', 'the evaluator must be someone else with a current evaluator qualification');
    const r1 = await rpc('qc-inspector', 'kafaa_request_evaluation($1, $2, $3)', ['qs-qa-t1', 'p-head-sq', 'Available Tuesday']);
    ok(r1.ok && (await rpc('qc-inspector', 'kafaa_request_evaluation($1, $2, null)', ['qs-qa-t1', 'p-head-sq'])).code === 'already_requested'
      && (await count('head-sq', 'kafaa_ojt_eval_requests', `id = '${r1.data.id}'`)) === 1, 'a ready task is handed to the evaluator (one open request per task)');
    ok((await rpc('head-sq', `kafaa_close_evaluation_request($1, 'complete', null)`, [r1.data.id])).code === 'no_evaluation', 'the request closes only after the evaluator has signed the task off');
    const so = await rpc('head-sq', 'kafaa_signoff_evaluation($1::jsonb)', [JSON.stringify({ record_id: 'qr-p-qc-inspector-qs-qa', task_id: 'qs-qa-t1', result: 'pass' })]);
    const cl = await rpc('head-sq', `kafaa_close_evaluation_request($1, 'complete', 'Signed off')`, [r1.data.id]);
    ok(so.ok && cl.ok && cl.data.evaluation_id === so.data.evaluation_id && cl.data.result === 'pass', 'the evaluator signs off through M02 (kafaa_signoff_evaluation) and the request records that evaluation');
    ok((await q(`select count(*)::int n from pg_proc p where (p.proname like 'kafaa_ojt_%' and p.proname <> 'kafaa_ojt_preceptors') and has_function_privilege('authenticated', p.oid, 'execute')`))[0].n === 0
      && (await rpc('qc-inspector', 'kafaa_ojt_preceptors($1)', ['qs-qa-t2'])).some((p) => p.id === 'p-sq-lead'), 'OJT helpers are internal; the preceptor list names qualified colleagues');
  }
}
