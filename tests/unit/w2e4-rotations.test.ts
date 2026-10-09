/** F15 Rotations and job shadowing (W2 · E4): every acceptance criterion on the local path, the rules, the recommenders, the
 *  seed and i18n. The SQL path is checked by scripts/validate/w2e4-rotations.mjs (PGlite, SQL = TS parity). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { skillReasons } from '../../src/domain/skills';
import {
  MIN_GROUP, PROGRAMMES, RESTRICTED_FAMILIES, RMSG, addMonths, cleanObjectiveLevels, cleanProgress, computeBoard, consentAfter, midpoint, phaseOf, planPlacements,
  signerFor, validateShadow, validateTemplate, type TemplateInput,
} from '../../src/modules/m20/rotation';
import { rankHosts, rankProgrammes } from '../../src/modules/m20/rotationMatch';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const today = iso(0);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (prefix: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action.startsWith(prefix) && (!outcome || a.outcome === outcome));
const secSkills = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.id));
const tplIn: TemplateInput = {
  programme: 'cross_functional', title_en: 'Unit test rotation programme', title_ar: 'برنامج تناوب لاختبار الوحدة', summary_en: 'A synthetic two-placement rotation used by the unit tests.', summary_ar: 'تناوب اصطناعي من مرحلتين تستخدمه اختبارات الوحدة.',
  duration_min_months: 2, duration_max_months: 6, source_ids: [], eligible_families: [], status: 'active',
  steps: [
    { family_id: 'operations', host_team_en: 'Crew B field operations', host_team_ar: 'العمليات الميدانية للطاقم ب', host_manager_id: 'p-sro', months: 1, objectives: [{ skill_id: 'sk-co-01-rounds', level: 2, text_en: 'Complete rounds on two systems', text_ar: 'إكمال الجولات على نظامين' }, { skill_id: 'sk-hu-01-star', level: 2, text_en: 'Self-check every manipulation', text_ar: 'التحقق الذاتي في كل عملية' }] },
    { family_id: 'outage', host_team_en: 'Outage planning', host_team_ar: 'تخطيط الانقطاعات', months: 2, objectives: [{ skill_id: 'sk-mp-01-outage', level: 2, text_en: 'Plan one outage window', text_ar: 'تخطيط نافذة انقطاع واحدة' }] },
  ],
};
/** chco creates the unit-test programme and enrols k-ro from today; returns the two placements. */
async function enrolKro() {
  await as('chco');
  const tpl = await b.rpc.saveRotationTemplate(tplIn);
  expect(tpl.ok, tpl.message).toBe(true);
  const e = await b.rpc.enrolRotation(tpl.data!.id, 'p-k-ro', null, today);
  expect(e.ok, e.message).toBe(true);
  const rows = b.raw('rotation_placements').filter((p) => p.enrolment_id === e.data!.enrolment_id).sort((x, y) => x.seq - y.seq);
  return { tplId: tpl.data!.id, e, p1: rows[0], p2: rows[1] };
}

describe('F15 seed', () => {
  it('the GDP template seeds with its sourced duration of 18 to 36 months and a source link', () => {
    const gdp = T.rotation_templates.find((t) => t.programme === 'gdp')!;
    expect([gdp.duration_min_months, gdp.duration_max_months]).toEqual([18, 36]);
    expect(gdp.sources.some((s: any) => s.id === 'enec-careers' && s.url.startsWith('https://'))).toBe(true);
    const months = gdp.steps.reduce((a: number, s: any) => a + s.months, 0);
    expect(months).toBeGreaterThanOrEqual(18);
    expect(months).toBeLessThanOrEqual(36);
    expect(T.talent_programmes.find((p) => p.id === 'gdp')!.duration_en).toMatch(/18-36 months/);
  });
  it('has GDP, GPO and DNT cohorts (synthetic) plus cross-functional and high-potential ones, above and below the suppression threshold', () => {
    expect(new Set(T.rotation_cohorts.map((c) => c.programme))).toEqual(new Set(PROGRAMMES));
    const sizes = T.rotation_cohorts.map((c) => new Set(T.rotation_placements.filter((p) => p.cohort_id === c.id).map((p) => p.person_id)).size);
    expect(sizes.some((n) => n >= MIN_GROUP)).toBe(true);
    expect(sizes.some((n) => n > 0 && n < MIN_GROUP)).toBe(true);
    expect(T.rotation_cohorts.every((c) => /synthetic/i.test(c.name_en))).toBe(true);
    const staff = new Map(T.people.map((p) => [p.id, p]));
    expect(T.rotation_placements.every((p) => staff.get(p.person_id)?.kind === 'staff' && staff.get(p.person_id)?.status !== 'leaver')).toBe(true);
  });
  it('no placement, objective, host or request is security, cyber or safeguards work; plant placements carry only the site-induction flag', () => {
    for (const t of T.rotation_templates) for (const s of t.steps) {
      expect(RESTRICTED_FAMILIES).not.toContain(s.family_id);
      expect(s.objectives.some((o: any) => secSkills.has(o.skill_id))).toBe(false);
    }
    expect(T.shadow_hosts.some((h) => RESTRICTED_FAMILIES.includes(h.family_id) || h.skill_ids.some((s: string) => secSkills.has(s)))).toBe(false);
    expect(T.rotation_placements.some((p) => p.site_induction)).toBe(true);
    const cols = Object.keys(T.rotation_placements[0]);
    expect(cols.some((c) => /access|clearance|badge|zone/i.test(c))).toBe(false);
  });
  it('every seeded placement is routed by the shared maker-checker rule, and signed-off placements carry their ojt evidence', () => {
    for (const p of T.rotation_placements) {
      const r = signerFor(p.person_id, p.host_manager_id, T.people, T.role_assignments, '2026-10-08');
      expect([p.signer_id, p.skip_level, p.line_manager_id], p.id).toEqual([r.signer, r.skipLevel, r.lineManager]);
      expect(p.signer_id).not.toBe(p.person_id);
      if (p.skip_level) expect(p.signer_id).not.toBe(p.host_manager_id);
    }
    expect(T.rotation_placements.filter((p) => p.skip_level).length).toBeGreaterThan(5);
    const done = T.rotation_placements.filter((p) => p.status === 'signed_off');
    expect(done.length).toBeGreaterThan(20);
    for (const p of done) {
      expect(p.checkin_at, p.id).toBeTruthy();
      for (const id of p.evidence_ids) expect(T.skill_evidence.find((e) => e.id === id && e.kind === 'ojt' && e.basis === 'evidenced' && e.ref_table === 'rotation_placements'), id).toBeTruthy();
    }
    // the evidence reaches the derived skill state (F03 passport)
    const p = done[0];
    const st = T.person_skills.find((s) => s.person_id === p.person_id && s.reasons.some((r: any) => r.evidence_id === p.evidence_ids[0]));
    expect(st).toBeTruthy();
    for (const r of skillReasons(st.reasons)) expect(hasKey(r.key), r.key).toBe(true);
    // k-ro keeps exactly its F08 ojt states (the F08 tests pin them)
    expect(T.rotation_placements.some((x) => x.person_id === 'p-k-ro' && x.status === 'signed_off')).toBe(false);
  });
  it('shadowing requests cover every state and every completed one carries level-1 evidence', () => {
    expect(new Set(T.shadow_requests.map((r) => r.status))).toEqual(new Set(['requested', 'approved', 'declined', 'withdrawn', 'completed']));
    for (const r of T.shadow_requests.filter((x) => x.status === 'completed')) {
      expect(r.evidence_ids.length).toBe(r.skill_ids.length);
      for (const id of r.evidence_ids) expect(T.skill_evidence.find((e) => e.id === id)?.level).toBe(1);
    }
    for (const r of T.shadow_requests) expect(r.days).toBeGreaterThanOrEqual(1), expect(r.days).toBeLessThanOrEqual(5);
  });
});

describe('F15 rules', () => {
  const ref = { skills: T.skills, families: T.job_families.map((f) => f.id), roles: T.job_roles.map((r) => r.id), sources: T.sources.map((s) => s.id) };
  const hosts = { people: T.people, assignments: T.role_assignments, today: '2026-10-08' };
  it('validateTemplate refuses restricted placements first, then checks text, durations, steps, hosts and the total', () => {
    expect(validateTemplate({ ...tplIn, steps: [{ ...tplIn.steps[0], family_id: 'cyber' }] }, ref, hosts)).toMatchObject({ code: 'restricted_kind' });
    expect(validateTemplate({ ...tplIn, steps: [{ ...tplIn.steps[0], objectives: [{ skill_id: 'sk-sa-01', level: 1, text_en: 'Security patrol', text_ar: 'دورية أمنية' }] }] }, ref, hosts)).toMatchObject({ code: 'restricted_kind' });
    expect(validateTemplate({ ...tplIn, duration_min_months: 6 }, ref, hosts)).toMatchObject({ message: RMSG.invalid_total });
    expect(validateTemplate({ ...tplIn, steps: [{ ...tplIn.steps[0], host_manager_id: 'w-lo-01' }] }, ref, hosts)).toMatchObject({ message: RMSG.invalid_host });
    const ok = validateTemplate(tplIn, ref, hosts) as { steps: any[] };
    expect(ok.steps[1].host_manager_id).toBe('p-outage-manager');
    expect(ok.steps[0].objectives.map((o: any) => o.id)).toEqual(['o1-1', 'o1-2']);
    expect(ok.steps[0].site_induction).toBe(true);
    expect(ok.steps[0].host_name_en).toMatch(/role card/);
  });
  it('plans consecutive placements with month-end clamping like SQL', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    const ok = validateTemplate(tplIn, ref, hosts) as { steps: any[] };
    const plan = planPlacements(ok.steps, '2026-11-01');
    expect(plan.map((p) => [p.starts_on, p.ends_on])).toEqual([['2026-11-01', '2026-11-30'], ['2026-12-01', '2027-01-31']]);
    expect(midpoint('2026-11-01', '2026-11-30')).toBe('2026-11-15');
    expect(phaseOf({ status: 'active', starts_on: '2026-11-01', ends_on: '2026-11-30' }, '2026-12-02')).toBe('overdue');
  });
  it('check-in progress and sign-off levels accept objective ids only', () => {
    const objs = [{ id: 'o1-1', skill_id: 'a', level: 2, text_en: '', text_ar: '' }, { id: 'o1-2', skill_id: 'b', level: 1, text_en: '', text_ar: '' }];
    expect(cleanProgress({ 'o1-1': 'on_track' }, objs)).toBeNull();
    expect(cleanProgress({ 'o1-1': 'on_track', 'o1-2': 'at_risk' }, objs)).toEqual({ 'o1-1': 'on_track', 'o1-2': 'at_risk' });
    expect(cleanObjectiveLevels({ 'o1-1': 4 }, objs)).toBeNull();
    expect(cleanObjectiveLevels({ 'o9-9': 2 }, objs)).toBeNull();
    expect(cleanObjectiveLevels({ 'o1-1': 0, 'o1-2': 0 }, objs)).toBeNull();
    expect(cleanObjectiveLevels({ 'o1-1': 3, 'o1-2': 0 }, objs)).toEqual({ 'o1-1': 3 });
  });
  it('shadowing is 1 to 5 days on skills the host offers; one consent counts twice when host and line manager are the same person', () => {
    const host = { skill_ids: ['sk-ch-02-labqa'] };
    const base = { host_id: 'p-chem-sup', start_on: today, days: 2, skill_ids: ['sk-ch-02-labqa'], purpose: 'Learn laboratory QA for outages.' };
    expect(validateShadow({ ...base, days: 6 }, host, today)).toMatchObject({ message: RMSG.invalid_days });
    expect(validateShadow({ ...base, skill_ids: ['sk-ch-01'] }, host, today)).toMatchObject({ message: RMSG.invalid_shadow_skills });
    expect(validateShadow(base, host, today)).toBeNull();
    expect(consentAfter({ host_id: 'h', line_manager_id: 'h', host_consent: null, manager_consent: null }, 'h', true).status).toBe('approved');
    expect(consentAfter({ host_id: 'h', line_manager_id: 'm', host_consent: null, manager_consent: null }, 'h', true).status).toBe('requested');
    expect(consentAfter({ host_id: 'h', line_manager_id: 'm', host_consent: true, manager_consent: null }, 'm', false).status).toBe('declined');
  });
});

describe('F15 acceptance (local backend)', () => {
  it('host sign-off writes evidence and updates the passport', async () => {
    const { p1 } = await enrolKro();
    await as('k-ro');
    expect((await b.rpc.placementCheckin(p1.id, { 'o1-1': 'on_track', 'o1-2': 'at_risk' }, 'Rounds going well; self-checking needs practice')).ok).toBe(true);
    await as('ops-ceo');
    const so = await b.rpc.signoffPlacement(p1.id, { 'o1-1': 3, 'o1-2': 1 }, 'Confident on rounds; self-checking improving');
    expect(so.ok, so.message).toBe(true);
    expect(so.data).toMatchObject({ met: 1, total: 2 });
    expect(so.data!.evidence_ids).toEqual([`se:ojt:${p1.id}:sk-co-01-rounds`, `se:ojt:${p1.id}:sk-hu-01-star`]);
    const ev = b.rawGet('skill_evidence', `se:ojt:${p1.id}:sk-co-01-rounds`)!;
    expect(ev).toMatchObject({ kind: 'ojt', basis: 'evidenced', level: 3, person_id: 'p-k-ro', ref_table: 'rotation_placements' });
    await as('k-ro');
    const states = await b.list('person_skills', { filter: { person_id: 'p-k-ro', skill_id: 'sk-co-01-rounds' } });
    expect(states[0].reasons.some((r: any) => r.code === 'ojt' && r.evidence_id === ev.id)).toBe(true);
    expect(b.raw('ledger_local').some((l: any) => String(l.action ?? l.ledger_action ?? '').includes('rotation.signoff') || JSON.stringify(l).includes('kafaa.rotation.signoff'))).toBe(true);
    expect(b.rawGet('rotation_placements', p1.id)!.status).toBe('signed_off');
  });
  it('a placement cannot be signed off by the rotating person or by their line manager who is also host (maker_checker)', async () => {
    const { p1 } = await enrolKro();
    expect(p1).toMatchObject({ host_manager_id: 'p-sro', line_manager_id: 'p-sro', skip_level: true, signer_id: 'p-ops-ceo' });
    await as('k-ro');
    await b.rpc.placementCheckin(p1.id, { 'o1-1': 'on_track', 'o1-2': 'on_track' }, 'All on track so far');
    const self = await b.rpc.signoffPlacement(p1.id, { 'o1-1': 2 }, 'I signed my own');
    expect(self).toMatchObject({ ok: false, code: 'maker_checker' });
    await as('sro');
    const lmHost = await b.rpc.signoffPlacement(p1.id, { 'o1-1': 2 }, 'Host and line manager');
    expect(lmHost).toMatchObject({ ok: false, code: 'maker_checker', message: RMSG.maker_checker });
    expect(audits('rotation.signoff', 'refused').length).toBe(2);
    await as('outage-manager');
    expect((await b.rpc.signoffPlacement(p1.id, { 'o1-1': 2 }, 'Not my placement')).code).toBe('not_found');
  });
  it('sign-off needs the mid-point check-in, a started placement and objective-only levels', async () => {
    const { p1, p2 } = await enrolKro();
    await as('ops-ceo');
    expect((await b.rpc.signoffPlacement(p1.id, { 'o1-1': 2 }, 'Before check-in')).code).toBe('checkin_required');
    await as('k-ro');
    expect((await b.rpc.placementCheckin(p2.id, { 'o2-1': 'on_track' }, 'Too early')).code).toBe('invalid');
    expect((await b.rpc.placementCheckin(p1.id, { 'o1-1': 'on_track' }, 'Missing one objective')).message).toBe(RMSG.invalid_progress);
    expect((await b.rpc.placementCheckin(p1.id, { 'o1-1': 'on_track', 'o1-2': 'met' }, 'Fine so far')).ok).toBe(true);
    await as('sro');
    expect((await b.rpc.placementCheckin(p1.id, { 'o1-1': 'met', 'o1-2': 'met' }, 'Second check-in')).code).toBe('conflict');
    await as('ops-ceo');
    expect((await b.rpc.signoffPlacement(p1.id, { 'o9-9': 2 }, 'Bad objective')).code).toBe('invalid');
  });
  it('cohort tiles are suppressed below 10 (board for HR and auditors only)', async () => {
    await as('k-hr-analyst');
    const board = (await b.rpc.rotationBoard())!;
    expect(board).not.toBeNull();
    expect(board.cohorts.length).toBe(T.rotation_cohorts.length);
    for (const c of board.cohorts) {
      const n = new Set(T.rotation_placements.filter((p) => p.cohort_id === c.cohort_id).map((p) => p.person_id)).size;
      expect(c.suppressed, c.cohort_id).toBe(n < 10);
      if (c.suppressed) expect([c.participants, c.placements, c.met_pct, c.progress_pct, c.checkins_done]).toEqual([null, null, null, null, null]);
      else expect(c.participants).toBeGreaterThanOrEqual(10);
    }
    expect(board.by_family.every((f) => f.suppressed || (f.people ?? 0) >= 10)).toBe(true);
    expect(JSON.stringify(board)).not.toMatch(/p-k-ro|w-lo-0|display_name/);
    const ts = computeBoard(T.rotation_templates, T.rotation_cohorts, T.rotation_placements, T.shadow_requests, 0, today);
    expect(ts.cohorts.map((c) => c.suppressed)).toEqual(board.cohorts.map((c) => c.suppressed));
    await as('k-ro');
    expect(await b.rpc.rotationBoard()).toBeNull();
    await as('k-auditor');
    expect(await b.rpc.rotationBoard()).not.toBeNull();
  });
  it('HR programme owners write templates (W); managers and employees cannot; restricted placements are refused and audited', async () => {
    await as('sro');
    expect((await b.rpc.saveRotationTemplate(tplIn)).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.saveRotationTemplate(tplIn)).code).toBe('forbidden');
    await as('k-hr-analyst');
    const sec = await b.rpc.saveRotationTemplate({ ...tplIn, steps: [{ ...tplIn.steps[0], family_id: 'security' }] });
    expect(sec).toMatchObject({ ok: false, code: 'restricted_kind' });
    expect(audits('rotation.template', 'refused').some((a) => String(a.reason).startsWith('restricted_kind'))).toBe(true);
    const created = await b.rpc.saveRotationTemplate({ ...tplIn, status: 'draft' });
    expect(created.ok).toBe(true);
    await as('k-ro');
    expect((await b.list('rotation_templates')).some((x) => x.id === created.data!.id)).toBe(false);
    await as('chco');
    expect((await b.rpc.saveRotationTemplate({ ...tplIn, id: created.data!.id })).code).toBe('not_found');
    await as('training-mgr');
    expect((await b.rpc.saveRotationTemplate({ ...tplIn, id: 'rt-gdp-engineering', title_en: 'GDP engineering rotation, revised' })).ok).toBe(true);
  });
  it('enrolment is by programme owners, builds the plan and the sign-off route, writes a ledger row and refuses duplicates', async () => {
    const { tplId, e } = await enrolKro();
    expect(e.data!.signers).toEqual(['p-ops-ceo', 'p-outage-manager']);
    expect(e.ledger_seq).not.toBeNull();
    expect((await b.rpc.enrolRotation(tplId, 'p-k-ro', null, today)).code).toBe('conflict');
    expect((await b.rpc.enrolRotation('rt-digital-draft', 'p-k-ro', null, today)).code).toBe('invalid');
    expect((await b.rpc.enrolRotation(tplId, 'p-k-ro', 'rc-gdp-2025', today)).code).toBe('invalid');
    expect((await b.rpc.enrolRotation('rt-gpo-field', 'p-qc-inspector', null, today)).code).toBe('not_eligible');
    expect((await b.rpc.enrolRotation(tplId, 'w-mnt-08', null, today)).code).toBe('not_found');
    await as('sro');
    expect((await b.rpc.enrolRotation(tplId, 'p-k-ro', null, today)).code).toBe('forbidden');
    expect(await b.rpc.rotationCandidates(tplId)).toBeNull();
    await as('chco');
    const c = (await b.rpc.rotationCandidates('rt-gpo-field'))!;
    expect(c.some((x) => x.enrolled) && c.some((x) => !x.eligible) && c.some((x) => x.can_host)).toBe(true);
  });
  it('shadowing needs the consent of host and line manager; the host confirms completion and evidence is written', async () => {
    await as('k-ro');
    const base = { host_id: 'p-chem-sup', start_on: today, days: 2, skill_ids: ['sk-ch-02-labqa'], purpose: 'Learn laboratory quality control for outage support.' };
    expect((await b.rpc.requestShadow({ ...base, host_id: 'p-rp-lead', skill_ids: ['sk-rp-01'] })).code).toBe('conflict');
    expect((await b.rpc.requestShadow({ ...base, host_id: 'p-doa-signatory', skill_ids: ['sk-en-01-project'] })).code).toBe('not_found');
    const r = await b.rpc.requestShadow(base);
    expect(r.ok, r.message).toBe(true);
    expect(r.data).toMatchObject({ line_manager_id: 'p-sro', same_person: false });
    expect((await b.rpc.decideShadow(r.data!.id, 'approve')).code).toBe('forbidden');
    await as('chem-sup');
    expect((await b.rpc.decideShadow(r.data!.id, 'approve')).data!.status).toBe('requested');
    expect((await b.rpc.decideShadow(r.data!.id, 'approve')).code).toBe('conflict');
    await as('sro');
    expect((await b.rpc.decideShadow(r.data!.id, 'decline', '')).code).toBe('invalid');
    expect((await b.rpc.decideShadow(r.data!.id, 'approve')).data!.status).toBe('approved');
    await as('chem-sup');
    const done = await b.rpc.decideShadow(r.data!.id, 'complete', 'Ran two QC checks with the team');
    expect(done.ok).toBe(true);
    expect(b.rawGet('skill_evidence', `se:ojt:${r.data!.id}:sk-ch-02-labqa`)).toMatchObject({ level: 1, kind: 'ojt', basis: 'evidenced' });
  });
  it('security, cyber and safeguards staff cannot host shadowing; security skills cannot be offered', async () => {
    await as('k-admin');
    expect((await b.rpc.setShadowHost({ active: true, skill_ids: ['sk-da-01'], max_days_month: 2 })).code).toBe('restricted_kind');
    await as('k-ro');
    expect((await b.rpc.setShadowHost({ active: true, skill_ids: ['sk-sa-01'], max_days_month: 2 })).code).toBe('restricted_kind');
    expect((await b.rpc.setShadowHost({ active: true, skill_ids: ['sk-co-01'], max_days_month: 2, note_en: 'Crew B days' })).ok).toBe(true);
    expect((await b.rpc.requestShadow({ host_id: 'p-k-ro', start_on: today, days: 1, skill_ids: ['sk-co-01'], purpose: 'Shadow myself, which is refused.' })).code).toBe('conflict');
  });
  it('RLS: placements and requests are private to the people named on them; HR reads none; auditors read all', async () => {
    await as('k-ro');
    expect((await b.list('rotation_placements')).every((p) => p.person_id === 'p-k-ro')).toBe(true);
    await as('k-hr-analyst');
    expect(await b.list('rotation_placements')).toHaveLength(0);
    expect(await b.list('shadow_requests')).toHaveLength(0);
    await as('head-sq');
    const hs = await b.list('rotation_placements');
    expect(hs.length).toBeGreaterThan(0);
    expect(hs.every((p) => [p.person_id, p.host_manager_id, p.signer_id, p.line_manager_id, p.enrolled_by].includes('p-head-sq'))).toBe(true);
    await as('k-auditor');
    expect(await b.list('rotation_placements')).toHaveLength(T.rotation_placements.length);
  });
});

describe('F15 recommenders and i18n', () => {
  const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro');
  const ctx = { states, skills: T.skills, roleComps: T.role_competencies, targetRole: 'senior-reactor-operator', family: 'operations' };
  it('programmes and hosts are ranked with reasons (lint clean, every reason key in EN and AR)', () => {
    const p = rankProgrammes(T.rotation_templates.filter((t) => t.status === 'active'), ctx);
    const h = rankHosts(T.shadow_hosts.filter((x) => x.listed), 'p-k-ro', ctx);
    expect(lintRanked(p)).toEqual([]);
    expect(lintRanked(h)).toEqual([]);
    expect(h.some((x) => x.item!.host.person_id === 'p-k-ro')).toBe(false);
    for (const r of [...p, ...h]) for (const reason of r.reasons) { expect(hasKey(reason.key), reason.key).toBe(true); }
    expect(p.find((x) => x.id === 'rt-gpo-field')!.item!.eligible).toBe(true);
    expect(p.find((x) => x.id === 'rt-gdp-engineering')!.item!.eligible).toBe(true);
  });
  it('every RMSG, programme, phase, progress and status label exists in both languages', () => {
    for (const k of ['gdp', 'gpo', 'dnt', 'cross_functional', 'hipo']) expect(hasKey(`m20.rot.programme.${k}`)).toBe(true);
    for (const k of ['upcoming', 'in_progress', 'overdue', 'signed_off', 'cancelled']) expect(hasKey(`m20.rot.phase.${k}`)).toBe(true);
    for (const k of ['requested', 'approved', 'declined', 'withdrawn', 'completed']) expect(hasKey(`m20.rot.shadowStatus.${k}`)).toBe(true);
    for (const k of ['on_track', 'at_risk', 'met']) expect(hasKey(`m20.rot.progress.${k}`)).toBe(true);
    for (const id of ['rotations', 'rotations-my', 'rotations-shadow', 'rotations-host', 'rotations-board', 'rotations-design', 'rotation-programme']) expect(hasKey(`m20.routes.${id}.title`)).toBe(true);
  });
});
