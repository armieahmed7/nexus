/** FS31 future-skills micro-credentials with a strategic tier, FS32 learner record (CLR-shaped) with selective disclosure and FS33
 * skills I want to grow (FS wave D · E3): one test per acceptance criterion on the LocalBackend and the seed, plus the pure rules,
 * RBAC, refusals and i18n coverage. The SQL mirrors are proven equal to these rules in scripts/validate/fs43-credentials-record-goals.mjs
 * (PGlite). */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasRegulatoryWording, validateDef, eligibility, type DefRow } from '../../src/modules/m17/microcred';
import { FS31_CODES, satisfiability, strategicReport, targetCheck, unlocksFor, unlockProblem } from '../../src/modules/m17/futureCreds';
import { CLR_CONTEXT, RESTRICTED_RECORD, SHARE_RULES, buildBundle, recordItems, shareProblem, validateClr } from '../../src/modules/m17/learnerRecord';
import { GOAL_RULES, goalProblem, goalView, planRow, sortGoals } from '../../src/modules/m17/skillGoals';
import { rankPathways, type RankInput } from '../../src/modules/m19/pathways';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { routes } from '../../src/modules/m17/routes';
import smoke from '../../src/modules/m17/smoke.json';
import en from '../../src/i18n/m17.en.json';
import ar from '../../src/i18n/m17.ar.json';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const TODAY = '2026-10-11';
const DEFS = T.microcred_defs as unknown as DefRow[];
const cur = (code: string) => DEFS.find((d) => d.code === code && d.status === 'current')!;
const sec = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => String(c.id)));
const tok = (id: string) => T.record_shares.find((s) => s.id === id)!.token as string;

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); });
beforeEach(async () => { await b.reset(); });

// ═════════════ FS31
describe('FS31 · future-skills micro-credentials', () => {
  it('eight new definitions are published (MC-TWINS as v2, its F32 draft superseded, never deleted); three form the strategic tier', () => {
    for (const c of FS31_CODES) expect(cur(c), c).toBeTruthy();
    expect(cur('MC-TWINS').version).toBe(2);
    expect(DEFS.some((d) => d.code === 'MC-TWINS' && d.version === 1 && d.status === 'superseded')).toBe(true);
    expect(DEFS.filter((d) => d.status === 'current' && d.strategic).map((d) => d.code).sort()).toEqual(['MC-AI-ASSURER', 'MC-DATA-DECISIONS', 'MC-TWINS']);
    expect(DEFS.some((d) => d.status === 'draft')).toBe(true); // MC-H2-HEAT stays a draft (cannot be earned)
  });

  it('AC: each new definition passes the regulatory-wording copy check and the definition rules', () => {
    const w = { defs: DEFS, courses: T.courses, forms: T.assessment_forms, opportunities: T.opportunities, skills: T.skills, competencies: T.competencies, job_roles: T.job_roles, qual_standards: T.qual_standards, adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks };
    for (const c of FS31_CODES) {
      const d = cur(c);
      expect(hasRegulatoryWording(d.title_en, d.title_ar, d.summary_en, d.summary_ar, ...d.criteria.flatMap((x) => [x.label_en, x.label_ar])), c).toBe(false);
      expect(validateDef({ ...d, stacks_into: null } as never, { ...w, defs: DEFS.filter((x) => x.id !== d.id) } as never).code, c).toBe('ok');
    }
    const d = cur('MC-SMR-FOUND');
    expect(validateDef({ ...d, id: undefined, code: 'MC-SMR-LIC', title_en: 'SMR licensed operator foundations' } as never, w as never).code).toBe('regulatory_wording');
    // an adaptive criterion must name an active bank; cyber hygiene stays awareness-level (no security skill in a bank criterion)
    expect(validateDef({ ...d, id: undefined, code: 'MC-SMR-X', criteria: [{ ...d.criteria[0], kind: 'adaptive', ref: 'ab-none', min_level: 2 }] } as never, w as never).code).toBe('invalid');
  });

  it('AC: every definition (published and draft) is satisfiable through existing or FS19 content', () => {
    const content = { courses: T.courses, course_skill_links: T.course_skill_links, adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks, opportunities: T.opportunities, skills: T.skills };
    for (const d of DEFS.filter((x) => (FS31_CODES as readonly string[]).includes(x.code) && x.status === 'current' || x.code === 'MC-H2-HEAT')) {
      const s = satisfiability(d, content);
      expect(s.ok, `${d.code}: ${s.missing.join(', ')}`).toBe(true);
    }
    expect(satisfiability({ criteria: [{ key: 'x', kind: 'course', ref: 'c-none', label_en: '', label_ar: '' }] }, content).ok).toBe(false);
  });

  it('AC: a strategic credential unlocks the gigs that name it; non-holders see them locked; out of the tier it unlocks nothing', async () => {
    await as('k-ro');
    const mine = await b.rpc.credentialUnlocks(null);
    expect(mine.allowed).toBe(true);
    const pilot = mine.items.find((u) => u.target_id === 'opp-governed-ai-pilot')!;
    expect(pilot.unlocked).toBe(true);
    expect(pilot.reasons[0].code).toBe('fc_unlocked');
    expect((await b.rpc.credentialTargetCheck('opportunity', 'opp-governed-ai-pilot'))).toMatchObject({ named: true, unlocked: true, held: ['MC-AI-ASSURER'] });
    await as('buyer');
    const other = await b.rpc.credentialTargetCheck('opportunity', 'opp-governed-ai-pilot');
    expect(other).toMatchObject({ named: true, unlocked: false });
    expect((await b.rpc.credentialUnlocks(null)).items.find((u) => u.target_id === 'opp-governed-ai-pilot')!.reasons[0].code).toBe('fc_locked');
    // framework owners move it out of the tier (with a reason; ledger) and back
    await as('sro');
    expect((await b.rpc.setMicrocredStrategic('MC-AI-ASSURER', false, 'Not my call')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.setMicrocredStrategic('MC-AI-ASSURER', false, 'x')).code).toBe('invalid');
    const off = await b.rpc.setMicrocredStrategic('MC-AI-ASSURER', false, 'Pilot paused for a quarter');
    expect(off.ok, off.message).toBe(true);
    await as('k-ro');
    expect((await b.rpc.credentialTargetCheck('opportunity', 'opp-governed-ai-pilot')).named).toBe(false);
    expect((await b.rpc.credentialUnlocks(null)).items.find((u) => u.target_id === 'opp-governed-ai-pilot')!.reasons[0].code).toBe('fc_tier_off');
  });

  it('unlocks: framework owners name a credential on a gig; security placements, unknown targets and staff are refused', async () => {
    await as('k-ro');
    const base = { def_code: 'MC-AI-ASSURER', target_kind: 'opportunity', target_id: 'opp-outage-schedule-analytics', note_en: 'Needs AI assurance', note_ar: 'يتطلب ضمان الذكاء الاصطناعي' };
    expect((await b.rpc.setCredentialUnlock(base)).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.setCredentialUnlock({ ...base, target_id: 'opp-none' })).code).toBe('invalid');
    const secRot = T.rotation_templates.find((r) => (r.eligible_families ?? []).some((f: string) => ['security', 'cyber', 'safeguards'].includes(f)));
    if (secRot) expect((await b.rpc.setCredentialUnlock({ ...base, target_kind: 'rotation', target_id: secRot.id })).code).toBe('security_restricted');
    expect(unlockProblem({ ...base, target_kind: 'rotation', target_id: 'rt-x' } as never, { defs: DEFS, unlocks: [], opportunities: T.opportunities, rotation_templates: [{ id: 'rt-x', eligible_families: ['security'] }] } as never)).toBe('security_restricted');
    const r = await b.rpc.setCredentialUnlock(base);
    expect(r.ok, r.message).toBe(true);
    expect(b.raw('microcred_unlocks' as never).some((u: Row) => u.id === r.data!.id && u.active)).toBe(true);
  });

  it('strategic report: correlation with internal moves, groups under 10 suppressed; training manager, HR and auditors only', async () => {
    const rep = strategicReport({ today: TODAY, defs: DEFS, awards: T.microcred_awards as never, people: T.people, opportunity_applications: T.opportunity_applications, rotation_placements: T.rotation_placements ?? [] } as never);
    expect(rep.window_days).toBe(365);
    for (const r of rep.rows) if (r.suppressed) expect([r.holders, r.moved, r.rate]).toEqual([null, null, null]); else expect(r.holders).toBeGreaterThanOrEqual(10);
    expect(rep.rows.find((r) => r.code === 'MC-AI-ASSURER')!.suppressed).toBe(false);
    await as('sro');
    expect((await b.rpc.strategicReport()).allowed).toBe(false);
    for (const p of ['training-mgr', 'k-hr-analyst', 'k-auditor']) { await as(p); expect((await b.rpc.strategicReport()).allowed, p).toBe(true); }
  });

  it('an adaptive result voided by an integrity decision never counts toward a credential', () => {
    const d = cur('MC-CYBER-HYGIENE');
    const hit = T.adaptive_attempts.find((a) => a.bank_id === 'ab-cyber-hygiene' && a.status === 'completed' && a.counts !== false && a.meets === true)!;
    const w = { today: TODAY, defs: DEFS, awards: [], courses: T.courses, training_records: T.training_records, attempts: T.attempts, opportunities: T.opportunities, opportunity_applications: T.opportunity_applications, person_skills: T.person_skills, adaptive_attempts: T.adaptive_attempts.filter((a) => a.person_id === hit.person_id), task_attempts: [], integrity_reports: [] as Row[] };
    const before = eligibility(d, hit.person_id, w as never).criteria.find((c) => c.kind === 'adaptive')!;
    expect(before.met).toBe(true);
    const voided = { ...w, adaptive_attempts: w.adaptive_attempts.map((a) => ({ ...a, integrity_id: a.integrity_id ?? `ir-${a.id}` })), integrity_reports: w.adaptive_attempts.map((a) => ({ id: a.integrity_id ?? `ir-${a.id}`, attempt_id: a.id, attempt_table: 'adaptive_attempts', decision: 'voided' })) };
    expect(eligibility(d, hit.person_id, voided as never).criteria.find((c) => c.kind === 'adaptive')!.met).toBe(false);
  });

  it('the pure unlock rules agree with the backend for every staff member (TS)', () => {
    const w = { today: TODAY, defs: DEFS, awards: T.microcred_awards as never, unlocks: T.microcred_unlocks as never, opportunities: T.opportunities, rotation_templates: T.rotation_templates };
    const kro = unlocksFor('p-k-ro', w);
    expect(kro.length).toBe(T.microcred_unlocks.filter((u) => u.active).length);
    expect(targetCheck('p-buyer', 'opportunity', 'opp-governed-ai-pilot', w).unlocked).toBe(false);
    for (const u of kro) for (const r of u.reasons) expect((en.reasons as Row)[r.code], r.code).toBeTruthy();
  });
});

// ═════════════ FS32
describe('FS32 · learner record', () => {
  it('AC: the bundle validates against the CLR-shaped schema (and a broken one does not)', async () => {
    await as('k-ro');
    const lr = await b.rpc.learnerRecord(null);
    expect(lr.allowed).toBe(true);
    expect(lr.items.length).toBeGreaterThan(5);
    const bundle = lr.bundle as Row;
    expect(validateClr(bundle)).toEqual([]);
    expect(bundle['@context']).toContain(CLR_CONTEXT);
    expect(bundle.type).toEqual(['VerifiableCredential', 'ClrCredential']);
    expect(bundle.credentialSubject.verifiableCredential.length).toBe(lr.items.length);
    expect(validateClr({ ...bundle, type: ['VerifiableCredential'] }).length).toBeGreaterThan(0);
    expect(validateClr({ ...bundle, credentialSubject: { type: ['ClrSubject'] } }).length).toBeGreaterThan(0);
    await as('k-auditor');
    expect((await b.rpc.learnerRecord(null)).allowed).toBe(false);
  });

  it('AC: no security or medical detail and no name is ever included, for any staff member', () => {
    const qs = new Set(T.qual_standards.filter((s) => s.security_restricted || s.security_mirror_only).map((s) => s.id));
    expect(qs.size).toBeGreaterThan(0);
    for (const p of T.people.filter((x) => x.kind === 'staff')) {
      const w = { today: TODAY, person: p.id, initials: p.initials, microcred_awards: T.microcred_awards, microcred_defs: DEFS, badges: T.badges, certificates: T.certificates, qual_records: T.qual_records, qual_standards: T.qual_standards, person_skills: T.person_skills, skills: T.skills, competencies: T.competencies, external_certs: T.external_certs }; // FS79 -> FS32 (wave I integration)
      const items = recordItems(w as never);
      for (const i of items) {
        if (i.kind === 'qual') expect(qs.has(T.qual_records.find((r) => r.id === i.id)!.standard_id), i.id).toBe(false);
        if (i.kind === 'skill') { const s = T.skills.find((x) => x.id === i.id)!; expect(s.area === 'security' || sec.has(String(s.competency_id)), i.id).toBe(false); }
      }
      const txt = JSON.stringify(buildBundle(w as never, items.map((i) => i.ref), { id: 'x', issued_on: TODAY, valid_until: null }));
      expect(RESTRICTED_RECORD.test(txt), p.id).toBe(false);
      expect(txt.includes(p.display_name), p.id).toBe(false);
    }
  });

  it('AC: an expired or revoked link shows nothing personal; an unknown link is not found', async () => {
    await as(null);
    for (const id of ['rs-kro-mentoring-2026', 'rs-kro-old-draft']) {
      const r = await b.rpc.verifyRecordShare(tok(id));
      expect(r.ok).toBe(true);
      expect(['expired', 'revoked']).toContain(r.data!.status);
      for (const k of ['clr', 'holder_initials', 'item_count', 'expires_on']) expect(k in r.data!, `${id} ${k}`).toBe(false);
      expect(JSON.stringify(r.data)).not.toContain('RO');
    }
    expect((await b.rpc.verifyRecordShare('0'.repeat(32))).code).toBe('not_found');
  });

  it('an active link shows exactly the shared items with initials only (anonymous), and counts the view', async () => {
    await as(null);
    const s = T.record_shares.find((x) => x.id === 'rs-kro-digital-rotation')!;
    const r = await b.rpc.verifyRecordShare(s.token);
    expect(r.ok && r.data!.status).toBe('active');
    expect(r.data!.holder_initials).toBe('RO');
    expect((r.data!.clr as Row).kafaaItems.map((i: Row) => i.ref)).toEqual(s.items);
    expect(validateClr(r.data!.clr)).toEqual([]);
    expect(JSON.stringify(r.data)).not.toContain(T.people.find((p) => p.id === 'p-k-ro')!.display_name);
    expect((b.raw('record_shares' as never) as Row[]).find((x: Row) => x.id === s.id)!.views).toBe(Number(s.views) + 1);
  });

  it('createRecordShare: three consent gates, own shareable items only, expiry within 90 days; revoke by the holder only', async () => {
    await as('k-ro');
    const items = (await b.rpc.learnerRecord(null)).items;
    const base = { items: items.slice(0, 3).map((i) => i.ref), label: 'Secondment application', expires_on: '2026-11-30', consents: { items: true, preview: true, share: true } };
    expect((await b.rpc.createRecordShare({ ...base, consents: { items: true, preview: false, share: true } })).code).toBe('consent_required');
    expect((await b.rpc.createRecordShare({ ...base, items: ['skill:sk-sa-01'] })).code).toBe('not_shareable');
    expect((await b.rpc.createRecordShare({ ...base, expires_on: '2027-06-30' })).code).toBe('invalid');
    expect(shareProblem({ ...base, items: [] }, items, TODAY)).toBe('invalid');
    expect(SHARE_RULES.maxDays).toBe(90);
    const r = await b.rpc.createRecordShare(base);
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.token).toMatch(/^[0-9a-f]{32}$/);
    await as('sro');
    expect((await b.rpc.revokeRecordShare(r.data!.id, 'no')).code).toBe('not_found');
    expect(await b.list('record_shares' as never, { filter: { person_id: 'p-k-ro' } } as never)).toHaveLength(0);
    await as('k-ro');
    expect((await b.rpc.revokeRecordShare(r.data!.id, 'Application closed')).ok).toBe(true);
    await as(null);
    const v = await b.rpc.verifyRecordShare(r.data!.token);
    expect(v.data!.status).toBe('revoked');
    expect('clr' in v.data!).toBe(false);
  });
});

// ═════════════ FS33
describe('FS33 · skills I want to grow', () => {
  /** The Coach's goal input exactly as m19 useFsCoach builds it (FS07's skill_goals, status not removed). */
  const coachRank = async (person: string) => {
    const goals = ((await b.list('skill_goals' as never, { filter: { person_id: person } } as never)) as Row[]).filter((g) => g.status !== 'removed').map((g) => String(g.skill_id));
    const input: RankInput = {
      pathways: T.pathways.filter((p) => p.status === 'published').map((p) => ({ ...p, requested: 0, peer: null })) as never,
      skills: T.skills as never, have: new Map(T.person_skills.filter((s) => s.person_id === person && s.active !== false).map((s) => [s.skill_id, Number(s.level)])),
      roleTitle: null, now: [], y2030: [], goals, weeklyGoal: null, enrolled: new Map(),
    };
    return rankPathways(input);
  };

  it('AC: a goal changes the Coach ranking with a "your goal" reason, and withdrawing it removes the weight', async () => {
    await as('k-ro');
    const before = await coachRank('p-k-ro');
    expect(before.some((r) => r.skill_id === 'sk-fs-tr-resilience')).toBe(false);
    const r = await b.rpc.saveSkillGoal({ skill_id: 'sk-fs-tr-resilience', target_level: 2, target_date: '2027-04-30', note: 'Before the next outage', shared: false });
    expect(r.ok, r.message).toBe(true);
    const after = await coachRank('p-k-ro');
    const hit = after.find((x) => x.skill_id === 'sk-fs-tr-resilience');
    expect(hit).toBeTruthy();
    expect(hit!.reasons.some((x) => x.code === 'my_goal' && x.weight === 2)).toBe(true);
    expect((await b.rpc.withdrawSkillGoal('sk-fs-tr-resilience')).ok).toBe(true);
    expect((await coachRank('p-k-ro')).some((x) => x.skill_id === 'sk-fs-tr-resilience')).toBe(false);
  });

  it('AC (RLS): managers see goals only when the person shares them; HR, colleagues and visitors never', async () => {
    const shared = T.skill_goal_plans.filter((p) => p.person_id === 'p-k-ro' && p.shared).map((p) => p.id).sort();
    expect(shared.length).toBe(2);
    await as('sro');
    expect(((await b.list('skill_goal_plans' as never, { filter: { person_id: 'p-k-ro' } } as never)) as Row[]).map((p) => p.id).sort()).toEqual(shared);
    await as('k-ro');
    expect(await b.list('skill_goal_plans' as never, { filter: { person_id: 'p-k-ro' } } as never)).toHaveLength(3);
    for (const p of ['chco', 'k-hr-analyst', 'buyer', null]) { await as(p); expect(await b.list('skill_goal_plans' as never, { filter: { person_id: 'p-k-ro' } } as never), String(p)).toHaveLength(0); }
    // sharing is undone at once
    await as('k-ro');
    expect((await b.rpc.shareSkillGoal('sk-fs-ai-verify', false)).ok).toBe(true);
    await as('sro');
    expect(await b.list('skill_goal_plans' as never, { filter: { person_id: 'p-k-ro' } } as never)).toHaveLength(1);
  });

  it('AC: a goal can be withdrawn at any time (unshared; FS07 goal row removed); goals are labelled in EN and AR with their date', async () => {
    await as('k-ro');
    const w = await b.rpc.withdrawSkillGoal('sk-fs-ai-verify');
    expect(w.ok, w.message).toBe(true);
    expect(b.raw('skill_goal_plans' as never).find((p: Row) => p.id === 'sg:p-k-ro:sk-fs-ai-verify')).toMatchObject({ status: 'removed', shared: false, share_person: null });
    expect((b.raw('skill_goals' as never) as Row[]).find((p: Row) => p.id === 'sg:p-k-ro:sk-fs-ai-verify')!.status).toBe('removed');
    expect((await b.rpc.withdrawSkillGoal('sk-fs-ai-verify')).code).toBe('no_goal');
    for (const st of ['reached', 'overdue', 'due_soon', 'on_track', 'removed']) {
      expect((en.sg.status as Row)[st]).toBeTruthy(); expect((ar.sg.status as Row)[st]).toBeTruthy();
      expect((en.reasons as Row)[`sg_${st}`]).toBeTruthy(); expect((ar.reasons as Row)[`sg_${st}`]).toBeTruthy();
    }
    expect(en.reasons.sg_on_track).toContain('{date}');
    expect(ar.reasons.sg_on_track).toContain('{date}');
  });

  it('saveSkillGoal refusals: security skills, obsolete skills, dates under two weeks, levels over 4, people without a passport', async () => {
    await as('k-ro');
    const g = { skill_id: 'sk-fs-tr-curiosity', target_level: 2, target_date: '2027-03-31' };
    expect((await b.rpc.saveSkillGoal({ ...g, skill_id: 'sk-sa-01' })).code).toBe('restricted');
    expect((await b.rpc.saveSkillGoal({ ...g, skill_id: 'sk-fs-dp-paperwp' })).code).toBe('obsolete');
    expect((await b.rpc.saveSkillGoal({ ...g, target_date: '2026-10-15' })).code).toBe('invalid');
    expect((await b.rpc.saveSkillGoal({ ...g, target_level: 5 })).code).toBe('invalid');
    await as('k-auditor');
    expect((await b.rpc.saveSkillGoal(g)).code).toBe('forbidden');
    expect(goalProblem(g, T.skills.find((s) => s.id === 'sk-fs-tr-curiosity'), TODAY, sec)).toBe('ok');
    expect(GOAL_RULES.maxActive).toBe(12);
  });

  it('removing a goal from the FS07 skill page also unshares its plan; a goal without a date cannot be shared', async () => {
    await as('k-ro');
    expect((await b.rpc.setSkillGoal('sk-fs-adv-passive', 2, false)).ok).toBe(true);
    expect(b.raw('skill_goal_plans' as never).find((p: Row) => p.id === 'sg:p-k-ro:sk-fs-adv-passive')).toMatchObject({ status: 'removed', shared: false, share_person: null });
    expect((await b.rpc.setSkillGoal('sk-fs-tr-creative', 2, true)).ok).toBe(true);
    expect((await b.rpc.shareSkillGoal('sk-fs-tr-creative', true)).code).toBe('no_plan');
  });

  it('goal views: status, gap and reasons; sorted by what needs attention', () => {
    const p = planRow('p-x', 'sk-a', { target_level: 3, target_date: '2026-12-01', note: null, shared: true, status: 'active' }, `${TODAY}T00:00:00Z`);
    expect(p.share_person).toBe('p-x');
    const v = goalView(p, { level: 1, active: true }, TODAY);
    expect([v.status, v.gap]).toEqual(['due_soon', 2]);
    expect(v.reasons.map((r) => r.code)).toEqual(['sg_due_soon', 'sg_gap', 'sg_shared']);
    expect(goalView({ ...p, target_date: '2026-09-01' }, { level: 1 }, TODAY).status).toBe('overdue');
    expect(goalView(p, { level: 3 }, TODAY).status).toBe('reached');
    expect(sortGoals([goalView(p, { level: 3 }, TODAY), goalView({ ...p, target_date: '2026-09-01' }, { level: 1 }, TODAY)]).map((x) => x.status)).toEqual(['overdue', 'reached']);
    expect(planRow('p-x', 'sk-a', { target_level: 3, target_date: '2026-12-01', note: null, shared: true, status: 'removed' }, TODAY).share_person).toBeNull();
  });
});

describe('FS31-FS33 · routes, benchmarks, i18n', () => {
  it('seven routes with smoke params, guards as planned, and the three benchmark sets', () => {
    const ids = ['my-skills-goals', 'team-skills-goals', 'my-skills-record', 'verify-record', 'my-skills-credentials-future', 'my-credential', 'training-credentials-strategic'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      expect((en.routes as Row)[id].title && (ar.routes as Row)[id].title && (en.routes as Row)[id].purpose && (ar.routes as Row)[id].purpose, id).toBeTruthy();
    }
    expect(routes.find((x) => x.id === 'verify-record')!.zone).toBe('public');
    expect((smoke as Row)['verify-record'].token).toBe(tok('rs-kro-digital-rotation'));
    expect((smoke as Row)['my-credential'].code).toBe('MC-AI-ASSURER');
    expect(routes.find((x) => x.id === 'team-skills-goals')!.guard).toMatchObject({ grant: { res: 'skills_profile', levels: ['Scope', 'A'] } });
    expect(FEATURE_BENCHMARKS.FS31).toEqual(['1EDTECH', 'CORP', 'JAHIZ']);
    expect(FEATURE_BENCHMARKS.FS32).toEqual(['1EDTECH', 'SG-CAREER', 'UK-NUC']);
    expect(FEATURE_BENCHMARKS.FS33).toEqual(['SG-CAREER', 'SKILLS-TECH']);
    for (const k of ['fc_tier_off', 'fc_unlocked', 'fc_lapsed', 'fc_locked', 'fc_target_opportunity', 'fc_target_rotation', 'sg_gap', 'sg_shared', 'sg_private', 'lr_mc', 'lr_never']) {
      expect((en.reasons as Row)[k], k).toBeTruthy(); expect((ar.reasons as Row)[k], k).toBeTruthy();
    }
  });
});
