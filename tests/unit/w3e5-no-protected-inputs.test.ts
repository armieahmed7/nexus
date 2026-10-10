/**
 * F24 acceptance: "A unit test proves no scoring function reads gender, nationality_flag or age fields."
 * Every scoring function named on an engine card is checked twice:
 *  1. statically: its source (from the declaration to the next export, comments and strings removed) names no protected field;
 *  2. at run time: it is called on seed data in which EVERY input row carries gender, nationality_flag, age and birth_date,
 *     each row wrapped in a Proxy that records any read of those properties. No read may happen.
 * The SQL scoring functions on the cards are checked by scripts/validate/w3e5-transparency.mjs (pg_proc bodies).
 * The fairness monitor (src/modules/m16/fairness.ts) reads gender and nationality on purpose: it measures outcomes and scores nobody.
 */
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { SCHEMA } from '../../src/data/schema';
import { PROTECTED_INPUTS, functionBody, protectedRefs } from '../../src/modules/m16/transparency';
import { careerReadiness, reachableRoles } from '../../src/modules/m18/career';
import { careerMoves, readiness, coursesForGaps, byGapClosure } from '../../src/domain/engines/rank';
import { competencyLevels } from '../../src/domain/engines/skills';
import { buildCoachFeed } from '../../src/modules/m19/coach';
import { coachInputFrom, type CoachTables } from '../../src/modules/m19/inputs';
import { matchOpportunities } from '../../src/modules/m20/match';
import { deriveStates, gatherEvidence } from '../../src/domain/skills';
import { rankMentors } from '../../src/modules/m04/match';
import { reportingChain } from '../../src/modules/m04/mentoring';
import { rankHosts, rankProgrammes } from '../../src/modules/m20/rotationMatch';
import { rankExperts, type ExpertRow } from '../../src/modules/m22/domain';
import { rankBridges, rankFutureRoles, rankResources, readinessIndex } from '../../src/modules/m21/future';
import { inputFor, previewEvidence, readinessV2 } from '../../src/modules/m21/readiness'; // FS13
import { careerFacts } from '../../src/modules/m18/career';
import { conceptReadiness, transitionEvidence } from '../../src/modules/m18/futureRoles';

type Rows = Record<string, any>[];
const S = seed as unknown as { tables: Record<string, Rows>; meta: { demo_today: string } };
const NOW = S.meta.demo_today;
const PROTECTED = new Set<string>(PROTECTED_INPUTS);
const reads: string[] = [];
/**
 * Every row gets the protected attributes, and any read of them is recorded. A whole-row copy ({ ...row }, which some
 * rankers use to return the item) enumerates the keys and reads each in order: that is a copy into the result, not an input
 * to the score, so reads that follow an ownKeys enumeration in key order are not counted.
 */
const copying = new WeakMap<object, string[]>();
const trapRow = (r: Record<string, any>, table: string) =>
  new Proxy({ ...r, gender: r.gender ?? 'f', nationality_flag: r.nationality_flag ?? 'uae', nationality: 'uae', age: 41, age_band: '35-44', birth_date: '1985-03-01' }, {
    ownKeys(t) { const ks = Reflect.ownKeys(t); copying.set(t, ks.filter((k): k is string => typeof k === 'string')); return ks; },
    get(t, k, rcv) {
      const q = copying.get(t);
      if (q && q[0] === k) { q.shift(); if (!q.length) copying.delete(t); return Reflect.get(t, k, rcv); }
      if (q) copying.delete(t);
      if (typeof k === 'string' && PROTECTED.has(k)) reads.push(`${table}.${k}`);
      return Reflect.get(t, k, rcv);
    },
  });
const T: Record<string, Rows> = Object.fromEntries(Object.entries(S.tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.map((r) => (r && typeof r === 'object' ? trapRow(r, name) : r)) : rows]));
const person = (id: string) => T.people.find((p) => p.id === id)!;
const statesOf = (id: string) => T.person_skills.filter((s) => s.person_id === id && s.active !== false);
const ME = 'p-k-ro';
const ROLE = 'reactor-operator';
const careerData = () => ({ people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
  licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments });
const have = () => competencyLevels(statesOf(ME) as never, T.skills as never);
const fs13Tables = () => ({ techs: T.adv_technologies, advSkills: T.adv_skills, map: T.future_skill_map, skills: T.skills, resources: T.future_resources, states: T.person_skills, enrolments: T.enrolments, trainingRecords: T.training_records, trackProgress: T.future_track_progress }) as never;
const rotCtx = () => ({ states: statesOf(ME) as never, skills: T.skills as never, roleComps: T.role_competencies as never, targetRole: 'senior-reactor-operator', family: 'operations' });

/** One runner per scoring function named on the engine cards (file#function). Each runs on trapped seed rows. */
const RUN: Record<string, () => unknown> = {
  'src/modules/m18/career.ts#careerReadiness': () => careerReadiness(careerData() as never, ME, [...reachableRoles(T.career_paths as never, ROLE, 2).keys()], NOW),
  'src/modules/m18/career.ts#reachableRoles': () => reachableRoles(T.career_paths as never, ROLE, 2),
  'src/domain/engines/rank.ts#careerMoves': () => careerMoves({ from: ROLE, edges: T.career_paths as never, roleComps: T.role_competencies as never, have: have(), maxSteps: 2, pathOnly: [] }),
  'src/domain/engines/rank.ts#readiness': () => readiness(have(), T.role_competencies as never, 'senior-reactor-operator'),
  'src/modules/m19/coach.ts#buildCoachFeed': () => buildCoachFeed(coachInputFrom({ ...(T as never as CoachTables), person: person(ME) as never }, NOW)!),
  'src/modules/m19/inputs.ts#coachInputFrom': () => coachInputFrom({ ...(T as never as CoachTables), person: person(ME) as never }, NOW),
  'src/domain/engines/rank.ts#coursesForGaps': () => coursesForGaps({ have: have(), currentRole: ROLE, targets: ['senior-reactor-operator'], roleComps: T.role_competencies as never, courses: T.courses as never }),
  'src/domain/engines/rank.ts#byGapClosure': () => byGapClosure(T.courses.map((c) => ({ id: c.id, effortHours: c.duration_hours, gives: c.competency_ids.map((k: string) => ({ key: k, level: 2 })) })),
    T.role_competencies.filter((r) => r.role_id === ROLE).map((r) => ({ key: r.competency_id, need: r.required_level, have: 0, importance: r.importance, weight: 1 }))),
  'src/modules/m20/match.ts#matchOpportunities': () => matchOpportunities({ opps: T.opportunities as never, states: statesOf(ME) as never, skills: T.skills as never, roleComps: T.role_competencies as never, currentRole: ROLE, targetRole: 'senior-reactor-operator', family: 'operations' }),
  'src/domain/skills.ts#deriveStates': () => deriveStates(T.skill_evidence.filter((e) => e.person_id === ME) as never, NOW),
  'src/domain/skills.ts#gatherEvidence': () => gatherEvidence({ skills: T.skills, competencies: T.competencies, role_competencies: T.role_competencies, qual_standards: T.qual_standards, qual_records: T.qual_records,
    training_records: T.training_records, courses: T.courses, attempts: T.attempts, assessment_forms: T.assessment_forms, jpm_results: T.jpm_results, jpms: T.jpms } as never, { person: ME, now: NOW }),
  'src/modules/m04/match.ts#rankMentors': () => rankMentors({ me: ME, roleId: ROLE, targets: ['senior-reactor-operator'], have: have(), roleComps: T.role_competencies as never, competencies: T.competencies as never, roles: T.job_roles as never,
    skills: T.skills as never, mentors: T.mentors as never, requests: T.mentoring_requests as never, lineManager: person(ME).manager_id ?? null, chain: reportingChain(ME, T.people as never, T.role_assignments as never, NOW) }),
  'src/modules/m20/rotationMatch.ts#rankProgrammes': () => rankProgrammes(T.rotation_templates as never, rotCtx()),
  'src/modules/m20/rotationMatch.ts#rankHosts': () => rankHosts(T.shadow_hosts as never, ME, rotCtx()),
  'src/modules/m22/domain.ts#rankExperts': () => rankExperts(T.expert_optin.map((x) => trapRow({ person_id: x.person_id, name: x.name ?? '', name_ar: x.name_ar ?? '', role_id: null, family_id: null, team_id: null, headline: x.headline ?? '',
    skills: statesOf(x.person_id).map((s) => ({ skill_id: s.skill_id, level: s.level, basis: s.basis })) }, 'experts')) as unknown as ExpertRow[], null),
  'src/modules/m21/future.ts#readinessIndex': () => readinessIndex(T.adv_technologies as never, T.adv_skills as never, T.skills as never, statesOf(ME) as never),
  'src/modules/m21/future.ts#rankBridges': () => rankBridges({ bridges: T.skill_bridges as never, families: readinessIndex(T.adv_technologies as never, T.adv_skills as never, T.skills as never, statesOf(ME) as never).families, myRole: ROLE, edges: T.career_paths as never }),
  'src/modules/m21/future.ts#rankFutureRoles': () => rankFutureRoles({ roles: T.future_roles as never, levels: readinessIndex(T.adv_technologies as never, T.adv_skills as never, T.skills as never, statesOf(ME) as never).levels, myRole: ROLE, edges: T.career_paths as never }),
  // FS15 (fsBe5): the Navigator card v2 lists the concept-role readiness and the transition evidence
  'src/modules/m18/futureRoles.ts#conceptReadiness': () => conceptReadiness({ roles: T.job_roles as never, versions: T.role_profile_versions as never, edges: T.career_paths as never, skills: T.skills as never,
    competencies: T.competencies as never, states: statesOf(ME) as never }, careerFacts(careerData() as never, ME, NOW), ME, null),
  'src/modules/m18/futureRoles.ts#transitionEvidence': () => transitionEvidence(T.role_moves as never, T.job_roles as never, ROLE, T.job_roles.map((r) => r.id)),
  'src/modules/m21/future.ts#rankResources': () => { const r = readinessIndex(T.adv_technologies as never, T.adv_skills as never, T.skills as never, statesOf(ME) as never); return r.families.map((f) => rankResources(T.future_resources as never, f)); },
  // FS13 readiness v2 (card "future", version 2)
  'src/modules/m21/readiness.ts#readinessV2': () => readinessV2(inputFor(ME, fs13Tables())),
  'src/modules/m21/readiness.ts#previewEvidence': () => previewEvidence(readinessV2(inputFor(ME, fs13Tables())), { courses: ['c-adv-intro'], tracks: ['trk-digital'] }),
};
const cardFns = [...new Set(S.tables.engine_cards.flatMap((c) => c.scoring_functions as string[]))];
const tsFns = cardFns.filter((f) => !f.startsWith('sql:'));

describe('F24: no scoring function reads gender, nationality or age', () => {
  it('every TypeScript scoring function on the engine cards has a runner here (nothing listed goes unchecked)', () => {
    expect(tsFns.length).toBeGreaterThanOrEqual(15);
    for (const f of tsFns) expect(RUN[f], f).toBeTypeOf('function');
  });
  it.each(tsFns)('%s: its source names no protected field', (ref) => {
    const [file, name] = ref.split('#');
    expect(existsSync(file), file).toBe(true);
    const body = functionBody(readFileSync(file, 'utf8'), name);
    expect(body, `${name} is exported from ${file}`).toBeTruthy();
    expect(protectedRefs(body!)).toEqual([]);
  });
  it.each(tsFns)('%s: run on rows that all carry gender, nationality and age, it never reads them', (ref) => {
    reads.length = 0;
    const out = RUN[ref]();
    expect(out).toBeTruthy();
    expect([...new Set(reads)]).toEqual([]);
  });
  it('the trap works: a function that reads gender or nationality is caught, a plain copy is not (controls)', () => {
    reads.length = 0;
    const biased = (rows: Rows) => rows.filter((p) => p.gender === 'm').length;
    biased(T.people);
    expect(reads.length).toBeGreaterThan(0);
    reads.length = 0;
    const copies = T.people.slice(0, 5).map((p) => ({ ...p, score: 1 }));
    expect(copies).toHaveLength(5);
    expect(reads).toEqual([]);
    const sneaky = (rows: Rows) => rows.map((p) => { const c = { ...p }; return (p.nationality_flag === 'uae' ? 1 : 0) + c.score; });
    sneaky(T.people.slice(0, 3));
    expect(reads).toContain('people.nationality_flag');
  });
  it('no table holds a person\'s age or birth date, so there is nothing to read', () => {
    const bad = Object.entries(SCHEMA).flatMap(([t, d]) => Object.keys(d.cols).filter((c) => /^(age|birth_date|date_of_birth|dob|birth_year)$/.test(c)).map((c) => `${t}.${c}`));
    expect(bad).toEqual([]);
  });
  it('the static scan itself catches a protected field in code but not in a comment or string', () => {
    expect(protectedRefs('const x = p.gender;')).toEqual(['gender']);
    expect(protectedRefs('const x = row["nationality_flag"];')).toEqual([]);
    expect(protectedRefs('// nationality is never an input\nconst y = 1;')).toEqual([]);
    expect(protectedRefs('if (p.nationality_flag === "uae") score += 1;')).toEqual(['nationality_flag']);
  });
});
