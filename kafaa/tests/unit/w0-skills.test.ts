/** F01 (wave 0) acceptance: skills core. Local path; the SQL path is checked by scripts/validate/w0-skills.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { decayModelFrom, deriveSkillState, deriveStates, gatherEvidence, statesDigestText, skillReasons, type Evidence, type SkillSources } from '../../src/domain/skills';
import { sha256Hex } from '../../src/data/audit';
import { hasKey } from '../../src/i18n';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
const src = (tables: Record<string, any[]> = T): SkillSources => ({
  skills: tables.skills, competencies: tables.competencies, role_competencies: tables.role_competencies, qual_standards: tables.qual_standards, qual_records: tables.qual_records,
  training_records: tables.training_records, courses: tables.courses, attempts: tables.attempts, assessment_forms: tables.assessment_forms, jpm_results: tables.jpm_results, jpms: tables.jpms,
});
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('F01 seeded skill state', () => {
  it('all 368 synthetic people (345 + 23 F33 contractors) have a skill state, and each state lists at least one reason that links to its evidence row', () => {
    const people = new Set(T.people.map((p) => p.id));
    expect(people.size).toBe(368); // W5E2 (F33): 23 synthetic contractor staff added
    const withState = new Set(T.person_skills.map((s) => s.person_id));
    expect([...people].filter((p) => !withState.has(p))).toEqual([]);
    const ev = new Map(T.skill_evidence.map((e) => [e.id, e]));
    for (const s of T.person_skills) {
      expect(s.reasons.length, s.id).toBeGreaterThan(0);
      for (const r of s.reasons) {
        const e = ev.get(r.evidence_id);
        expect(e, `${s.id} -> ${r.evidence_id}`).toBeTruthy();
        expect(e.person_id === s.person_id && e.skill_id === s.skill_id).toBe(true);
      }
    }
  });
  it('the catalogue has about 60 skills under the 29 competencies, one core skill each, and maps every adv_skill', () => {
    expect(T.skills.length).toBeGreaterThanOrEqual(60);
    expect(new Set(T.skills.filter((s) => s.core).map((s) => s.competency_id)).size).toBe(T.competencies.length);
    const mapped = new Set(T.skills.flatMap((s) => s.adv_skill_ids));
    expect(T.adv_skills.every((a) => mapped.has(a.id))).toBe(true);
  });
  it('the seed states equal a fresh derivation (builder and domain functions agree)', () => {
    const recorded = T.skill_evidence.filter((e) => ['rating', 'ojt', 'credential'].includes(e.kind) || ['fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'lectures', 'knowledge_assets'].includes(String(e.ref_table)) /* FS10, FS21/FS22, FS44 */);
    const fresh = deriveStates([...gatherEvidence(src(), { person: null, now: NOW }), ...recorded] as Evidence[], NOW, decayModelFrom(T.engine_settings, T.skills)); // FS03: per-class half-lives
    expect(statesDigestText(fresh)).toBe(statesDigestText(T.person_skills));
  });
  it('every reason renders through an i18n key', () => {
    for (const s of T.person_skills.slice(0, 300)) for (const r of skillReasons(s.reasons)) expect(hasKey(r.key), r.key).toBe(true);
  });
});

describe('F01 derivation rules', () => {
  it('a qualification record that is current (qualView) yields verified; the same record expired yields at most evidenced with a lapsed reason', () => {
    const cur = gatherEvidence(src(), { person: 'p-k-ro', now: NOW }).filter((e) => e.ref_id === 'qr-p-k-ro-qs-ro');
    expect(cur.length).toBeGreaterThan(0);
    expect(cur.every((e) => e.basis === 'verified' && e.status === 'current')).toBe(true);
    const later = '2027-09-01'; // after expires_on 2027-08-08
    const lap = gatherEvidence(src(), { person: 'p-k-ro', now: later }).filter((e) => e.ref_id === 'qr-p-k-ro-qs-ro');
    expect(lap.every((e) => e.basis === 'evidenced' && e.status === 'lapsed')).toBe(true);
    const st = deriveSkillState(lap.filter((e) => e.skill_id === 'sk-pf-01'), later)!;
    expect(st.basis).not.toBe('verified');
    expect(st.reasons.some((r) => r.code === 'qual_lapsed')).toBe(true);
    expect(st.level).toBeLessThan(cur.find((e) => e.skill_id === 'sk-pf-01')!.level);
    // status expired in the record itself behaves the same
    const expired = { ...T.qual_records.find((r) => r.id === 'qr-p-k-ro-qs-ro'), status: 'expired' };
    const ev = gatherEvidence(src({ ...T, qual_records: [expired] }), { person: 'p-k-ro', now: NOW }).filter((e) => e.kind === 'qual');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.basis === 'evidenced' && e.status === 'lapsed')).toBe(true);
  });
  it('no security-restricted task id or title appears in any skill evidence row; restricted standards add only security skills', () => {
    const restricted = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
    const secComp = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
    const secSkill = new Set(T.skills.filter((s) => secComp.has(s.competency_id)).map((s) => s.id));
    // add a restricted task and a JPM on it to prove neither reaches the evidence
    const task = { id: 'qs-sec-t-hidden', standard_id: [...restricted][0], code: 'SEC-T1', statement_en: 'Hidden security task statement', statement_ar: 'مهمة', method: 'jpm', evaluator_role: 'x', critical: true, sort: 1 };
    const jpm = { id: 'jpm-sec-hidden', task_id: task.id, standard_id: task.standard_id, code: 'J', title_en: 'Hidden security JPM', title_ar: 'x', critical_steps: [] };
    const holder = T.qual_records.find((r) => restricted.has(r.standard_id))!;
    const tables = { ...T, task_items: [...T.task_items, task], jpms: [...T.jpms, jpm], jpm_results: [...T.jpm_results, { id: 'jr-sec', jpm_id: jpm.id, person_id: holder.person_id, evaluator_person_id: 'p-k-instructor', date: NOW, steps: [], critical_failed: false, score_pct: 100, result: 'pass', signed: true }] };
    const ev = gatherEvidence(src(tables), { person: null, now: NOW });
    const secTasks = tables.task_items.filter((t) => restricted.has(t.standard_id));
    for (const e of [...ev, ...T.skill_evidence]) {
      const blob = JSON.stringify(e);
      for (const t of secTasks) {
        expect(blob.includes(t.id)).toBe(false);
        expect(blob.includes(t.statement_en)).toBe(false);
      }
      expect(['task_items', 'evaluations'].includes(e.ref_table)).toBe(false);
    }
    expect(ev.some((e) => e.ref_id === 'jr-sec')).toBe(false);
    const fromRestricted = ev.filter((e) => e.kind === 'qual' && restricted.has(T.qual_records.find((r) => r.id === e.ref_id)?.standard_id));
    expect(fromRestricted.length).toBeGreaterThan(0);
    expect(fromRestricted.every((e) => secSkill.has(e.skill_id))).toBe(true);
  });
  it('recency decay: non-qualification evidence halves its confidence every 36 months and counts one level lower after that', () => {
    const e = (on: string): Evidence => ({ id: 'x', person_id: 'p', skill_id: 's', kind: 'course', ref_table: 'training_records', ref_id: 'tr', level: 2, basis: 'evidenced', status: 'current', observed_on: on });
    const fresh = deriveSkillState([e(NOW)], NOW)!;
    const old = deriveSkillState([e('2022-10-01')], NOW)!;
    expect(fresh.confidence).toBe(0.8);
    expect(old.confidence).toBeLessThan(0.4);
    expect(old.level).toBe(1);
    expect(old.reasons[0].ageing).toBe(true);
    // a current qualification does not decay
    const q = deriveSkillState([{ ...e('2019-01-01'), kind: 'qual', basis: 'verified', level: 3 }], NOW)!;
    expect(q.confidence).toBe(0.99); // FS03: verified weighs 1.0 in the calibrated blend (capped at 0.99); was 0.95
    expect(q.level).toBe(3);
  });
  it('claims never outrank evidence: a claimed level 4 next to verified level 2 gives verified 2', () => {
    const base = { person_id: 'p', skill_id: 's', ref_table: 'x', status: 'current' as const, observed_on: NOW };
    const st = deriveSkillState([{ ...base, id: 'a', kind: 'rating', ref_id: 'a', level: 4, basis: 'claimed' }, { ...base, id: 'b', kind: 'qual', ref_id: 'b', level: 2, basis: 'verified' }], NOW)!;
    expect(st.basis).toBe('verified');
    expect(st.level).toBe(2);
  });
});

describe('F01 rpc.recomputeSkills', () => {
  it('is deterministic: two runs give byte-identical output and rows', async () => {
    await as('training-mgr');
    const r1 = await b.rpc.recomputeSkills(null);
    const rows1 = JSON.stringify(b.raw('person_skills'));
    const ev1 = JSON.stringify(b.raw('skill_evidence'));
    const r2 = await b.rpc.recomputeSkills(null);
    expect(r1.ok && r2.ok).toBe(true);
    expect(JSON.stringify(r2.data)).toBe(JSON.stringify(r1.data));
    expect(JSON.stringify(b.raw('person_skills'))).toBe(rows1);
    expect(JSON.stringify(b.raw('skill_evidence'))).toBe(ev1);
    expect(r1.data!.people).toBe(368); // W5E2 (F33)
  });
  it('local recompute at the demo date reproduces the seeded states (digest)', async () => {
    const r = await applySkills(b, null, NOW);
    expect(r.digest).toBe(await sha256Hex(statesDigestText(T.person_skills)));
  });
  it('self, manager in scope and training manager may recompute; others are refused and audited; no ledger write', async () => {
    await as('k-ro');
    expect((await b.rpc.recomputeSkills('p-k-ro')).ok).toBe(true);
    const other = await b.rpc.recomputeSkills('w-ro-01');
    expect(other.code).toBe('forbidden');
    expect((await b.rpc.recomputeSkills(null)).code).toBe('forbidden');
    await as('sro');
    const inScope = await b.rpc.recomputeSkills('w-ro-01');
    expect(inScope.ok).toBe(true);
    expect(inScope.ledger_seq ?? null).toBeNull();
    expect((await b.rpc.recomputeSkills('p-k-hr-analyst')).code).toBe('forbidden');
    await as('k-observer');
    expect((await b.rpc.recomputeSkills('p-k-observer')).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.recomputeSkills('p-k-ro')).code).toBe('not_signed_in');
    const audit = b.raw('audit_events').filter((a) => a.action === 'skills.recompute');
    expect(audit.filter((a) => a.outcome === 'refused').length).toBeGreaterThanOrEqual(4);
    expect(audit.every((a) => a.ledger_status === 'not_applicable')).toBe(true);
    expect(b.raw('ledger_local').length).toBe(0);
  });
  it('a lapsed qualification is reflected after recompute, and recorded evidence survives', async () => {
    await as('training-mgr');
    b.rawUpdate('qual_records', 'qr-p-k-ro-qs-ro', { status: 'expired' });
    const claims = b.raw('skill_evidence').filter((e) => e.kind === 'rating').length;
    await b.rpc.recomputeSkills('p-k-ro');
    const st = b.rawGet('person_skills', 'ps:p-k-ro:sk-co-03')!;
    expect(st.basis).not.toBe('verified');
    expect((st.reasons as { code: string }[]).some((r) => r.code === 'qual_lapsed')).toBe(true);
    expect(b.raw('skill_evidence').filter((e) => e.kind === 'rating').length).toBe(claims);
  });
  it('skill tables follow skills_profile: own rows, scope for managers, nothing for partners, HR or anonymous', async () => {
    await as('k-ro');
    const own = await b.list('person_skills');
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.person_id === 'p-k-ro')).toBe(true);
    await as('sro');
    const sro = await b.list('person_skills');
    const crew = new Map(b.raw('people').map((p) => [p.id, p.crew]));
    expect(sro.every((r) => r.person_id === 'p-sro' || crew.get(r.person_id) === 'B')).toBe(true);
    await as('k-hr-analyst');
    expect((await b.list('person_skills')).every((r) => r.person_id === 'p-k-hr-analyst')).toBe(true);
    // W5E2 (F33): a partner admin reads only their organisation's contractor rows; an auditor contractor rows and their own; anonymous nothing
    await as('alnoor-gm');
    const pa = await b.list('skill_evidence');
    expect(pa.length).toBeGreaterThan(0);
    expect(pa.every((r) => r.org_id === 'org-alnoor' && r.contractor === true)).toBe(true);
    await as('k-auditor');
    expect((await b.list('skill_evidence')).every((r) => r.contractor === true || r.person_id === 'p-k-auditor')).toBe(true);
    await as(null);
    expect(await b.list('skill_evidence')).toEqual([]);
    await as(null);
    expect((await b.list('skills')).length).toBe(T.skills.length);
    expect((await b.insert('person_skills', { id: 'x' } as never)).ok).toBe(false);
  });
});

describe('F02 rpc.setEngineWeights', () => {
  it('admins switch engines (audited); others are refused; weights are validated', async () => {
    await as('k-admin');
    expect((await b.rpc.setEngineWeights('recommend', 'model')).ok).toBe(true);
    expect(b.rawGet('engine_settings', 'recommend')!.engine).toBe('model');
    expect((await b.rpc.setEngineWeights('recommend', 'deterministic', { core: 11 })).code).toBe('invalid');
    expect((await b.rpc.setEngineWeights('nope', 'deterministic')).code).toBe('invalid');
    await as('training-mgr');
    expect((await b.rpc.setEngineWeights('recommend', 'deterministic')).code).toBe('forbidden');
    expect(b.raw('audit_events').filter((a) => a.action === 'engine.settings').length).toBe(4);
  });
});
