/**
 * FS54 Skills council and taxonomy change tracker + FS55 fairness snapshots and datasheet (wave F · E3, M16): every acceptance criterion
 * on the local path, one named test each, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (same rules, same
 * results, RLS, the guard trigger, ledger rows) is checked by scripts/validate/fs63-taxonomy-governance.mjs (PGlite).
 * The FS55 criterion "every ranked surface in the app has a card" is tests/unit/fs63-engine-lint.test.ts.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { hasKey } from '../../src/i18n';
import en16 from '../../src/i18n/m16.en.json';
import ar16 from '../../src/i18n/m16.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m16/routes';
import { localHealthData, localSurfaceData } from '../../src/modules/m16/backend/local';
import { CHANGE_KINDS, GOV_MSG, INCLUSION_KEYS, LIMITS, REQUEST_STATUSES, decideProblem, inclusionChecks, methodologyNotices, normName, proposeProblem, taxonomyHealth, voteOutcome, type ProposeInput, type SkillLite } from '../../src/modules/m16/taxonomyGov';
import { MODEL_RISK_GATES, MODEL_RISK_SECTIONS, RANKED_SURFACES, SURFACE_METRICS, datasheet, surfaceSnapshot, type SurfaceData } from '../../src/modules/m16/surfaces';
import { FOUR_FIFTHS, isoWeek, weeklyDates } from '../../src/modules/m16/fairness';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { skillGuard } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';

const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
const TODAY = S.meta.demo_today;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const ledger = () => [...b.raw('ledger_local')];
const skill = (id: string) => b.rawGet('skills', id) as Record<string, any> | undefined;
const openOn = () => new Set(b.raw('skill_change_requests').filter((r) => ['submitted', 'first_approved', 'first_rejected'].includes(r.status as string)).map((r) => r.skill_id));
/** A live skill no open request covers, so a fresh proposal on it is not a duplicate. */
const freeSkill = (pred: (s: Record<string, any>) => boolean = () => true) => b.raw('skills').find((s) => s.lifecycle !== 'obsolete' && !openOn().has(s.id) && pred(s))! as Record<string, any>;
const DEV = 'Developed on the simulator with a coached scenario that only exercises this skill.';
const ASM = 'Assessed by a job performance measure observed by a qualified assessor.';
const WHY = 'The catalogue needs this change to stay current.';

describe('FS54 schema, routes, RBAC and i18n', () => {
  it('has the change-request and change-log tables with RPC-only writes; the log is public, a request is read by its proposer', () => {
    for (const t of ['skill_change_requests', 'skill_changes', 'surface_fairness']) { expect(SCHEMA[t], t).toBeTruthy(); expect(SCHEMA[t].write.mode, t).toBe('rpc'); }
    expect(SCHEMA.skill_changes.read.map((r) => r.res)).toEqual(['skills_taxonomy']);
    expect(SCHEMA.skill_change_requests.read).toEqual([{ res: 'own_profile', person: 'proposed_by' }]);
    for (const c of ['kernel_surface', 'ranks', 'fairness_metric', 'fairness_none']) expect(SCHEMA.engine_cards.cols[c], c).toBeTruthy();
  });
  it('registers the six pages with their guards and EN + AR titles', () => {
    const r = (id: string) => routes.find((x) => x.id === id)!;
    expect(r('skills-changes').path).toBe('/skills/changes');
    expect(r('skills-change-propose').guard.grant).toEqual({ res: 'skills_taxonomy', levels: ['W'] });
    expect(r('admin-skills-council').guard.anyRole).toEqual(['admin', 'training_manager', 'hr_director', 'auditor']);
    expect(r('admin-skills-health').guard.anyRole).toEqual(['admin', 'training_manager', 'hr_director', 'hr_analyst', 'auditor']);
    expect(r('skills-datasheet').path).toBe('/skills/datasheet');
    expect(r('admin-model-risk').path).toBe('/admin/ai-transparency/model-risk');
    for (const id of ['skills-changes', 'skills-change-propose', 'admin-skills-council', 'admin-skills-health', 'skills-datasheet', 'admin-model-risk']) {
      expect(hasKey(`m16.routes.${id}.title`), id).toBe(true);
      expect((ar16 as any).routes[id].title, id).toMatch(/[؀-ۿ]/);
    }
  });
  it('every kind, status, inclusion check, refusal message, role and model-risk field has a label in both languages', () => {
    for (const d of [en16, ar16] as any[]) {
      for (const k of CHANGE_KINDS) expect(d.gov.kind[k] && d.gov.kindHelp[k] && d.gov.prop.effect[k], k).toBeTruthy();
      for (const s of REQUEST_STATUSES) expect(d.gov.status[s], s).toBeTruthy();
      for (const k of INCLUSION_KEYS) expect(d.gov.inc[k] && d.gov.incHelp[k], k).toBeTruthy();
      for (const c of Object.keys(GOV_MSG)) expect(d.gov.msg[c], c).toBeTruthy();
      for (const r of ['employee', 'training_manager', 'hr_director', 'admin', 'auditor', 'unknown']) expect(d.gov.role[r], r).toBeTruthy();
      for (const s of MODEL_RISK_SECTIONS) { expect(d.mr.section[s.id] && d.mr.sectionHelp[s.id], s.id).toBeTruthy(); for (const f of s.fields) expect(d.mr.field[f.id] && d.mr.prompt[f.id], f.id).toBeTruthy(); }
      for (const m of SURFACE_METRICS) expect(d.reg.metric[m.metric] && d.reg.metricHelp[m.metric], m.metric).toBeTruthy();
      for (const s of RANKED_SURFACES) { expect(d.reg.kernel[s.kernel], s.kernel).toBeTruthy(); expect(d.reg.ranks[s.ranks], s.ranks).toBeTruthy(); if ('none' in s.fairness) expect(d.reg.none[s.fairness.none]).toBeTruthy(); }
    }
  });
  it('staff propose, council members decide, auditors read the queue; nobody else does', async () => {
    await as('k-ro');
    expect((await b.rpc.decideSkillChange('scr-051', 'approve')).code).toBe('forbidden');
    await expect(b.rpc.skillCouncilQueue()).rejects.toThrow();
    await as('k-auditor');
    expect((await b.rpc.skillCouncilQueue()).length).toBe(T.skill_change_requests.length);
    expect((await b.rpc.decideSkillChange('scr-051', 'approve')).code).toBe('forbidden');
    expect((await b.rpc.proposeSkillChange({ kind: 'retire', skill_id: freeSkill().id, rationale: WHY, development: DEV, assessment: ASM })).code).toBe('forbidden');
    for (const p of ['alnoor-gm', 'k-student']) { await as(p); expect((await b.rpc.proposeSkillChange({ kind: 'retire', skill_id: 'x', rationale: WHY })).code, p).toBe('forbidden'); }
    await as(null);
    expect((await b.rpc.proposeSkillChange({ kind: 'retire', skill_id: 'x', rationale: WHY })).code).toBe('not_signed_in');
    expect((await b.list('skill_changes')).length).toBe(T.skill_changes.length);
  });
});

describe('FS54 change requests and the inclusion rule', () => {
  it('a proposal is checked against the inclusion rule (distinct development and assessment, distinct names, a public source)', () => {
    const skills = T.skills as SkillLite[];
    const comps = T.competencies.map((c) => c.id);
    const add: ProposeInput = { kind: 'add', proposal: { name_en: 'Reactor isotope logistics', name_ar: 'لوجستيات نظائر المفاعل', area: skills[0].area, competency_id: comps[0], key_level: 2, source_label: 'IAEA', source_url: 'https://www.iaea.org/x' }, rationale: WHY, development: DEV, assessment: ASM };
    expect(inclusionChecks(add, skills, comps).every((c) => c.ok)).toBe(true);
    const fail = (x: ProposeInput) => inclusionChecks(x, skills, comps).filter((c) => !c.ok).map((c) => c.key);
    expect(fail({ ...add, development: 'short' })).toEqual(['development']);
    expect(fail({ ...add, assessment: '' })).toEqual(['assessment']);
    expect(fail({ ...add, proposal: { ...add.proposal, source_url: 'http://insecure.example' } })).toEqual(['source']);
    expect(fail({ ...add, proposal: { ...add.proposal, name_en: ` ${skills[0].name_en.toUpperCase()} ` } })).toEqual(['distinct_name']);
    expect(normName('  Reactor   Physics ')).toBe('reactor physics');
    expect(normName('إدارة')).toBe(normName('اداره'));
    expect(proposeProblem({ ...add, rationale: 'short' }, skills, comps, [])).toBe('rationale');
    expect(proposeProblem({ ...add, kind: 'merge' }, skills, comps, [])).toBe('kind');
  });
  it('proposes a change: stored as submitted with the checks, audited, visible to the proposer only; a second request on the same skill is a duplicate', async () => {
    await as('k-ro');
    const s = freeSkill();
    const r = await b.rpc.proposeSkillChange({ kind: 'retire', skill_id: s.id, proposal: { replaced_by: null }, rationale: WHY, development: DEV, assessment: ASM });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ status: 'submitted' });
    const row = b.rawGet('skill_change_requests', r.data!.id)!;
    expect(row).toMatchObject({ kind: 'retire', skill_id: s.id, proposed_by: 'p-k-ro', proposed_role: 'employee', votes: [] });
    expect((row.inclusion as { ok: boolean }[]).every((c) => c.ok)).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'skills.propose_change', outcome: 'ok' });
    expect((await b.list('skill_change_requests')).map((x) => x.id)).toContain(r.data!.id);
    expect((await b.list('skill_change_requests')).every((x) => x.proposed_by === 'p-k-ro')).toBe(true);
    const again = await b.rpc.proposeSkillChange({ kind: 'relevel', skill_id: s.id, proposal: { key_level: 3 }, rationale: WHY, development: DEV, assessment: ASM });
    expect(again).toMatchObject({ ok: false, code: 'conflict', message: GOV_MSG.duplicate });
    await as('k-hr-analyst');
    expect((await b.list('skill_change_requests')).some((x) => x.id === r.data!.id)).toBe(false);
  });
});

describe('FS54 acceptance: a retire request marks the skill obsolete and never deletes it', () => {
  it('A retire request marks the skill obsolete and never deletes it', async () => {
    const n0 = b.raw('skills').length;
    const target = { ...freeSkill((s) => s.lifecycle !== 'emerging') }; // a copy: the local store updates rows in place
    const repl = freeSkill((s) => s.id !== target.id);
    await as('k-ro');
    const p = await b.rpc.proposeSkillChange({ kind: 'retire', skill_id: target.id, proposal: { replaced_by: repl.id }, rationale: WHY, development: DEV, assessment: ASM });
    expect(p.ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.decideSkillChange(p.data!.id, 'approve')).data!.status).toBe('first_approved');
    await as('chco');
    const d = await b.rpc.decideSkillChange(p.data!.id, 'approve');
    expect(d.data).toMatchObject({ status: 'published', new_skill_ids: [] });
    expect(b.raw('skills').length).toBe(n0);
    const after = skill(target.id)!;
    // a retire changes the lifecycle, not the definition: the version stays (SQL kafaa_fs63_apply does the same)
    expect(after).toMatchObject({ lifecycle: 'obsolete', obsolete_on: todayIso(), replaced_by: repl.id, version: Number(target.version ?? 1) });
    expect(after.name_en).toBe(target.name_en);
    const ch = b.rawGet('skill_changes', d.data!.change_id!)!;
    expect(ch).toMatchObject({ kind: 'retire', skill_id: target.id, methodology: true, effective_on: todayIso() });
    expect((ch.before as any).lifecycle).toBe(target.lifecycle);
    expect((ch.after as any).lifecycle).toBe('obsolete');
    // the FS02 guard (same rule as the SQL trigger kafaa_fs_skill_guard) refuses to bring it back or lower its version
    expect(skillGuard(after as never, { ...after, lifecycle: 'growing', obsolete_on: null } as never)).toBeTruthy();
    expect(skillGuard(after as never, { ...after, version: Number(after.version ?? 1) - 1 } as never)).toBeTruthy();
    // a split also keeps the original, obsolete, and adds the parts
    const seedSplit = b.rawGet('skill_change_requests', 'scr-052')!;
    await as('k-admin');
    const sp = await b.rpc.decideSkillChange('scr-052', 'approve');
    expect(sp.data!.status).toBe('published');
    expect(sp.data!.new_skill_ids.length).toBe((seedSplit.proposal as any).parts.length);
    expect(skill('sk-fs-ai-dataeng')).toMatchObject({ lifecycle: 'obsolete', replaced_by: sp.data!.new_skill_ids[0] });
    expect(b.raw('skills').length).toBe(n0 + sp.data!.new_skill_ids.length);
    // the public log keeps the seeded retire of sk-fs-dp-paperwp, still readable as obsolete
    expect(skill('sk-fs-dp-paperwp')).toMatchObject({ lifecycle: 'obsolete' });
  });
});

describe('FS54 acceptance: every decision needs two approvers and writes a ledger row', () => {
  it('Every decision needs two approvers and writes a ledger row', async () => {
    await as('k-ro');
    const p = await b.rpc.proposeSkillChange({ kind: 'relevel', skill_id: freeSkill((s) => Number(s.key_level) < 4).id, proposal: { key_level: 4 }, rationale: WHY, development: DEV, assessment: ASM });
    expect(p.ok).toBe(true);
    const id = p.data!.id;
    // the proposer can never vote, even holding the council grant (maker-checker)
    expect(decideProblem(b.rawGet('skill_change_requests', id) as never, 'p-k-ro', 'approve', null)).toBe('own_request');
    let l0 = ledger().length;
    await as('training-mgr');
    const first = await b.rpc.decideSkillChange(id, 'approve');
    expect(first.data).toMatchObject({ status: 'first_approved', change_id: null });
    expect(ledger().length).toBe(l0 + 1);
    expect(lastAudit()).toMatchObject({ action: 'skills.decide_change', outcome: 'ok', ledger_status: 'written' });
    expect(b.raw('skill_changes').length).toBe(T.skill_changes.length);
    // one person cannot give both decisions
    const twice = await b.rpc.decideSkillChange(id, 'approve');
    expect(twice).toMatchObject({ ok: false, message: GOV_MSG.second_approver });
    expect(ledger().length).toBe(l0 + 1);
    // the second, different member publishes: a second ledger row, both roles on the public change
    l0 = ledger().length;
    await as('chco');
    const second = await b.rpc.decideSkillChange(id, 'approve');
    expect(second.data!.status).toBe('published');
    expect(ledger().length).toBe(l0 + 1);
    const ch = b.rawGet('skill_changes', second.data!.change_id!)!;
    expect(ch.decided_roles).toEqual(['training_manager', 'hr_director']);
    expect(ch.ledger_seq).toBe(second.ledger_seq);
    const req = b.rawGet('skill_change_requests', id)!;
    expect(req).toMatchObject({ first_by: 'p-training-mgr', second_by: 'p-chco', status: 'published' });
    expect((req.votes as unknown[]).length).toBe(2);
    // a rejection also needs two members, and a note; disagreeing votes send it back for a fresh pair
    await as('k-admin');
    expect((await b.rpc.decideSkillChange('scr-051', 'reject', 'short')).message).toBe(GOV_MSG.note);
    expect((await b.rpc.decideSkillChange('scr-051', 'reject', 'This duplicates an existing skill name.')).data!.status).toBe('first_rejected');
    await as('training-mgr');
    expect((await b.rpc.decideSkillChange('scr-051', 'approve')).data!.status).toBe('submitted');
    expect(b.rawGet('skill_change_requests', 'scr-051')).toMatchObject({ first_by: null, first_decision: null, status: 'submitted' });
    expect(voteOutcome('first_rejected', 'reject', 'reject')).toMatchObject({ status: 'rejected', final: true, publish: false });
    expect(voteOutcome('first_approved', 'approve', 'approve')).toMatchObject({ status: 'published', final: true, publish: true });
    // every seeded closed request has two different deciders, neither the proposer
    for (const r of T.skill_change_requests.filter((x) => ['published', 'rejected'].includes(x.status))) {
      expect(r.first_by && r.second_by && r.first_by !== r.second_by, r.id).toBeTruthy();
      expect([r.first_by, r.second_by], r.id).not.toContain(r.proposed_by);
    }
  });
});

describe('FS54 acceptance: staleness and orphan rate are computed, with drill-down lists', () => {
  it('Staleness and orphan rate are computed, with drill-down lists', async () => {
    await as('training-mgr');
    const h = await b.rpc.taxonomyHealth();
    const NOW = todayIso();
    const live = T.skills.filter((s) => s.lifecycle !== 'obsolete');
    expect(h.summary.live).toBe(live.length);
    expect(h.skills.map((x) => x.skill_id)).toEqual(live.map((s) => s.id).sort());
    // each summary number is the size of its drill-down list
    expect(h.summary.overdue).toBe(h.skills.filter((x) => x.review === 'overdue').length);
    expect(h.summary.overdue).toBe(live.filter((s) => s.review_due && s.review_due < NOW).length);
    expect(h.summary.due_soon).toBe(h.skills.filter((x) => x.review === 'due_soon').length);
    expect(h.summary.orphans).toBe(h.skills.filter((x) => x.orphan).length);
    expect(h.summary.untaught).toBe(h.skills.filter((x) => !x.taught).length);
    expect(h.summary.no_role).toBe(h.skills.filter((x) => !x.role).length);
    expect(h.summary.stale_rate).toBeCloseTo(h.summary.overdue / h.summary.live, 4);
    expect(h.summary.orphan_rate).toBeCloseTo(h.summary.orphans / h.summary.live, 4);
    for (const x of h.skills.filter((y) => y.review === 'overdue')) expect(x.days_overdue!, x.skill_id).toBeGreaterThan(0);
    for (const x of h.skills) expect(x.orphan, x.skill_id).toBe(!x.taught && !x.role);
    expect(h.summary.overdue + h.summary.untaught).toBeGreaterThan(0); // the drill-downs have something to show
    expect(taxonomyHealth(localHealthData(b), NOW)).toEqual(h);
    // a published addition starts as an orphan and appears in the orphan list
    await as('k-ro');
    const comp = T.competencies[0].id;
    const p = await b.rpc.proposeSkillChange({ kind: 'add', proposal: { name_en: 'Isotope shipment planning', name_ar: 'تخطيط شحن النظائر', area: T.skills[0].area, competency_id: comp, key_level: 2,
      source_label: 'IAEA', source_url: 'https://www.iaea.org/topics/transport' }, rationale: WHY, development: DEV, assessment: ASM });
    expect(p.ok).toBe(true);
    await as('training-mgr'); await b.rpc.decideSkillChange(p.data!.id, 'approve');
    await as('k-admin');
    const d = await b.rpc.decideSkillChange(p.data!.id, 'approve');
    const added = d.data!.new_skill_ids[0];
    expect(skill(added)).toMatchObject({ lifecycle: 'emerging', version: 1 });
    const h2 = await b.rpc.taxonomyHealth();
    expect(h2.summary.orphans).toBe(h.summary.orphans + 1);
    expect(h2.skills.find((x) => x.skill_id === added)).toMatchObject({ orphan: true, review: 'ok' });
    await as(null);
    await expect(b.rpc.taxonomyHealth()).rejects.toThrow();
  });
  it('the methodology banner shows recent methodology changes for the dashboards they touch, for ninety days', () => {
    const notes = methodologyNotices(T.skill_changes, 'catalogue', TODAY);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((c) => c.methodology && c.dashboards.includes('catalogue'))).toBe(true);
    expect(methodologyNotices(T.skill_changes, 'catalogue', '2027-06-01')).toEqual([]);
    expect(methodologyNotices(T.skill_changes, 'skills_outlook', TODAY).length).toBeGreaterThan(0);
  });
});

describe('FS55 acceptance: datasheet numbers are generated from data, not typed', () => {
  it('Datasheet numbers are generated from data, not typed', () => {
    const ds = datasheet(T.skills, T.skill_changes, TODAY);
    expect(ds.size.skills).toBe(T.skills.length);
    expect(ds.size.live).toBe(T.skills.filter((s) => s.lifecycle !== 'obsolete').length);
    expect(ds.size.obsolete).toBe(T.skills.filter((s) => s.lifecycle === 'obsolete').length);
    expect(Object.values(ds.size.by_lifecycle).reduce((a, x) => a + x, 0)).toBe(T.skills.length);
    expect(ds.languages.name_ar).toBe(T.skills.filter((s) => s.name_ar?.trim()).length);
    expect(ds.cadence.changes_12m).toBe(T.skill_changes.filter((c) => c.effective_on <= TODAY && c.effective_on > '2025-10-11').length);
    expect(ds.inference.ranked_surfaces).toBe(RANKED_SURFACES.length);
    expect(ds.bias.min_group).toBe(MIN_GROUP_SIZE);
    expect(ds.bias.four_fifths_pct).toBe(Math.round(FOUR_FIFTHS * 100));
    // change the data and the numbers follow
    const more = [...T.skills, { ...T.skills[0], id: 'sk-test', lifecycle: 'obsolete', sources: [{ label: 'x', url: 'https://example.org/a' }] }];
    const ds2 = datasheet(more, [...T.skill_changes, { id: 'sc-x', kind: 'retire', effective_on: TODAY, methodology: true }], TODAY);
    expect([ds2.size.skills, ds2.size.obsolete, ds2.cadence.changes_12m, ds2.cadence.methodology_12m]).toEqual([ds.size.skills + 1, ds.size.obsolete + 1, ds.cadence.changes_12m + 1, ds.cadence.methodology_12m + 1]);
    expect(ds2.sources.domains).toBe(ds.sources.domains + (ds.sources.top_domains.some((d) => d.domain === 'example.org') ? 0 : 1));
    // no figure is typed into the copy: datasheet strings carry no digits (numbers arrive through placeholders) ...
    const digits: string[] = [];
    const walk = (o: any, p: string) => { for (const [k, v] of Object.entries(o)) typeof v === 'string' ? (/[0-9٠-٩]/.test(v.replace(/\{[a-z]+\}/gi, '')) && digits.push(p + k)) : walk(v, `${p}${k}.`); };
    walk((en16 as any).ds, 'en.'); walk((ar16 as any).ds, 'ar.');
    expect(digits).toEqual([]);
    // ... and the page renders only computed values (no numeric literal is passed as a number to a tile or a sentence)
    const page = readFileSync('src/modules/m16/DatasheetPage.tsx', 'utf8');
    expect(page).toContain('datasheet(skills, changes, todayIso())');
    expect(page.match(/value=\{['"`]?\d/g) ?? []).toEqual([]);
    expect(page.match(/:\s*n\(\d/g) ?? []).toEqual([]);
  });
});

/** Synthetic population for the FS55 fairness rules: n people per group, k of them reached by each surface's outcome. */
function synth(groups: { g: 'f' | 'm'; nat: 'uae' | 'other'; n: number; k: number }[]): SurfaceData {
  const people: SurfaceData['people'] = [];
  const runs: Record<string, unknown>[] = [], fit: Record<string, unknown>[] = [];
  let i = 0;
  for (const x of groups) for (let j = 0; j < x.n; j++) {
    const id = `p${++i}`;
    people.push({ id, kind: 'staff', status: 'active', job_role_id: 'r', hire_date: '2020-01-01', gender: x.g, nationality_flag: x.nat });
    if (j < x.k) { runs.push({ person_id: id, as_of: '2026-10-01', items: [{ kind: 'course' }, { kind: 'opportunity' }] }); fit.push({ person_id: id, status: 'completed', completed_at: '2026-10-02T08:00:00Z' }); }
  }
  return { people, digestRuns: runs, advisorSessions: [], pathwayEnrolments: [], externalCompletions: [], fitnessAttempts: fit, opportunities: [], applications: [], twinAttempts: [], adaptiveAttempts: [], instructorTracks: [] };
}

describe('FS55 acceptance: fairness snapshots run for each new surface and suppress groups under 10', () => {
  it('Fairness snapshots run for each new surface and suppress groups under 10', async () => {
    // every new surface with an outcome gets a comparison by gender and nationality
    const rows = surfaceSnapshot(synth([{ g: 'f', nat: 'uae', n: 12, k: 3 }, { g: 'm', nat: 'uae', n: 30, k: 12 }, { g: 'm', nat: 'other', n: 9, k: 4 }]), '2026-10-08');
    expect(new Set(rows.map((r) => r.metric))).toEqual(new Set(SURFACE_METRICS.map((m) => m.metric)));
    for (const m of SURFACE_METRICS) for (const dim of ['gender', 'nationality']) expect(rows.filter((r) => r.metric === m.metric && r.dimension === dim).length, `${m.metric}:${dim}`).toBe(2);
    const dg = rows.filter((r) => r.metric === 'digest_suggested');
    // nationality: the "other" group has 9 people, so the whole comparison is suppressed (no count, rate or flag for any group)
    expect(dg.filter((r) => r.dimension === 'nationality').every((r) => r.suppressed && r.n === null && r.positives === null && r.rate === null && r.ratio === null && !r.flagged)).toBe(true);
    // gender: 12 women with 3 reached (25%) against 39 men with 16 (41%): flagged under four-fifths
    expect(dg.find((r) => r.dimension === 'gender' && r.group_key === 'f')).toMatchObject({ n: 12, positives: 3, suppressed: false, flagged: true });
    expect(dg.find((r) => r.dimension === 'gender' && r.group_key === 'm')).toMatchObject({ n: 39, positives: 16, ratio: 1, flagged: false });
    expect(rows.find((r) => r.id === `sf:${isoWeek('2026-10-08')}:digest_suggested:gender:f`)).toBeTruthy();
    // the local RPC: admin / AI governance stores this week's rows for every surface metric, audited and ledgered, re-runnable
    await as('ai-governance');
    const l0 = ledger().length;
    const r = await b.rpc.runSurfaceFairness(null);
    expect(r.ok).toBe(true);
    expect(r.data!.rows).toBe(SURFACE_METRICS.length * 4);
    const stored = b.raw('surface_fairness').filter((x) => x.period === r.data!.period);
    expect(stored).toHaveLength(SURFACE_METRICS.length * 4);
    expect(stored.map(({ run_by, created_at, ...x }) => x).sort((a, c) => (a.id < c.id ? -1 : 1))).toEqual(surfaceSnapshot(localSurfaceData(b), r.data!.as_of).map(({ surface, ...x }) => x).sort((a, c) => (a.id < c.id ? -1 : 1)));
    expect(ledger().length).toBe(l0 + 1);
    expect(lastAudit()).toMatchObject({ action: 'fairness.surface_snapshot', outcome: 'ok', ledger_status: 'written' });
    expect((await b.rpc.runSurfaceFairness(null)).ok).toBe(true);
    expect(b.raw('surface_fairness').filter((x) => x.period === r.data!.period)).toHaveLength(SURFACE_METRICS.length * 4);
    for (const p of ['k-ro', 'k-auditor', 'chco']) { await as(p); expect((await b.rpc.runSurfaceFairness(null)).code, p).toBe('forbidden'); }
    // the seed holds ten weekly snapshots; this week's equals the rules on the seed, with a suppressed comparison
    const days = [...new Set(T.surface_fairness.map((x) => x.as_of))].sort();
    expect(days).toEqual(weeklyDates(TODAY, 10));
    expect(T.surface_fairness.filter((x) => x.as_of === TODAY)).toHaveLength(SURFACE_METRICS.length * 4);
    // no stored group is ever smaller than the minimum: a small group shows as a suppressed comparison, never as a count
    expect(T.surface_fairness.filter((x) => x.n != null && x.n < MIN_GROUP_SIZE)).toEqual([]);
    expect(T.surface_fairness.filter((x) => x.suppressed && (x.n != null || x.rate != null || x.flagged))).toEqual([]);
  });
  it('the model-risk template lists its gate items, and the gateway is off so every surface runs its deterministic engine', () => {
    expect(MODEL_RISK_GATES.length).toBeGreaterThanOrEqual(12);
    expect(MODEL_RISK_GATES).toContain('fairness.suppression');
    expect(MODEL_RISK_GATES).toContain('oversight.fallback');
    expect(datasheet(T.skills, T.skill_changes, TODAY).inference.model_slots_enabled).toBe(0);
    expect(MODEL_RISK_SECTIONS.flatMap((s) => s.fields).filter((f) => f.from).length).toBeGreaterThanOrEqual(8);
  });
});

describe('FS54 seed', () => {
  it('holds a year of published changes (the FS02 future skills and a retirement), and open requests at every council step', () => {
    expect(T.skill_changes.length).toBeGreaterThanOrEqual(40);
    expect(T.skill_changes.some((c) => c.kind === 'retire' && c.skill_id === 'sk-fs-dp-paperwp')).toBe(true);
    for (const c of T.skill_changes) { expect(c.decided_roles.length, c.id).toBe(2); expect(c.summary_en && c.summary_ar, c.id).toBeTruthy(); }
    const st = new Set(T.skill_change_requests.map((r) => r.status));
    for (const s of REQUEST_STATUSES) expect(st.has(s), s).toBe(true);
    expect(LIMITS.rationale).toBe(10);
  });
});
