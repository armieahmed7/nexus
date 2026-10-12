/**
 * FS55 (wave F · E3): the F24 rule "no scoring function reads gender, nationality_flag or age" extended to every function named on the
 * 23 FS55 engine cards and to the functions FS55 appended to the navigator and future cards (FS55_FUNCTIONS in src/modules/m16/surfaces.ts;
 * tests/unit/w3e5-no-protected-inputs.test.ts covers the F24 functions and leaves these to this file).
 *  1. Statically, for every one of them: its source (an exported function, const or class, up to the next export; comments and strings
 *     removed) names no protected field.
 *  2. At run time, for every function that takes people or person-derived rows: it is called on seed rows that ALL carry gender,
 *     nationality_flag, nationality, age and birth_date, each row wrapped in a Proxy that records any read of those properties. No read may
 *     happen. The functions without a runner take no person record at all (they score answers, content, documents or plans); each is
 *     listed in NO_PERSON_INPUT with what it takes, and a test keeps the two lists complete and disjoint.
 * The SQL functions on the FS55 cards are checked by scripts/validate/fs63-taxonomy-governance.mjs (pg_proc bodies).
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { PROTECTED_INPUTS, functionBody, protectedRefs } from '../../src/modules/m16/transparency';
import { FS55_FUNCTIONS, RANKED_SURFACES } from '../../src/modules/m16/surfaces';
import { gatherDigest, matchScore, composeDigest, type DigestData } from '../../src/shell/digest/rules';
import { careerCtxFrom, type CareerTables } from '../../src/modules/m13/career/context';
import { rankPathways, rankExternals, type RankInput } from '../../src/modules/m19/pathways';
import { translate, coverageOf, heldOf, type OccupationTemplate, type TrData } from '../../src/modules/m18/translate';
import { rankTranslation } from '../../src/modules/m18/CareersTranslatePage';
import { rankFutureGigs } from '../../src/modules/m20/futureGigs';
import { deltaFor, readinessOf } from '../../src/modules/m31/nextgen';
import { readinessFor } from '../../src/modules/m30/transform';
import { rankSmeCandidates } from '../../src/modules/m02/instructorMatch';
import { rankMembersForRequest, rankRequestsForMember } from '../../src/modules/m20/reserveMatch';
import { rankProgrammes } from '../../src/modules/m22/domain';
import { coachFocus } from '../../src/modules/m22/future';
import { transferableStrengths } from '../../src/modules/m17/passport';
import { coverage, stateMapOf, teamActions } from '../../src/modules/m17/checkins';
import { securityComps } from '../../src/modules/m17/badgeRules';
import { competencyLevels } from '../../src/domain/engines/skills';
import { rankConcepts } from '../../src/modules/m18/FutureRoles';
import { conceptReadiness } from '../../src/modules/m18/futureRoles';
import { careerFacts } from '../../src/modules/m18/career';
import { bridgePlan, rankBridges, readinessIndex } from '../../src/modules/m21/future';
import { rankRaises } from '../../src/modules/m21/raises';
import { inputFor, readinessV2 } from '../../src/modules/m21/readiness';

type Rows = Record<string, any>[];
const S = seed as unknown as { tables: Record<string, Rows>; meta: { demo_today: string } };
const NOW = S.meta.demo_today;
const PROTECTED = new Set<string>(PROTECTED_INPUTS);
const reads: string[] = [];
/** Same trap as the F24 test: a whole-row copy ({ ...row }) enumerates and reads every key in order; that copy is not a score input. */
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
const ME = 'p-k-ro';
const ROLE = 'reactor-operator';
const person = (id: string) => T.people.find((p) => p.id === id)!;
const statesOf = (id: string) => T.person_skills.filter((s) => s.person_id === id && s.active !== false);
const bi = (x: string) => ({ en: x, ar: x });

const digestData = () => Object.fromEntries(['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions',
  'opportunities', 'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
  'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits', 'roleplay_sessions' /* FS wave F integration */].map((t) => [t, T[t] ?? []])) as unknown as DigestData;
const W = Object.fromEntries(Object.entries(S.tables.engine_settings.find((s) => s.id === 'recommend')!.weights).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
const TR = (): TrData => ({ roles: T.job_roles as never, roleComps: T.role_competencies as never, competencies: T.competencies as never, skills: T.skills as never, courses: T.courses as never, links: T.course_skill_links as never, packs: T.course_pack_items as never, edges: T.career_paths as never, weights: W });
const translation = () => { const tpl = (T.occupation_templates as unknown as OccupationTemplate[])[0]; return translate(TR(), heldOf(tpl), tpl.industry); };
const pathwayInput = (): RankInput => ({
  pathways: T.pathways.filter((p) => p.status === 'published').map((p) => trapRow({ ...p, requested: 0, peer: null }, 'pathways')) as never, skills: T.skills as never,
  have: new Map(statesOf(ME).map((s) => [s.skill_id as string, s.level as number])), roleTitle: bi('Reactor operator'),
  now: T.role_competencies.filter((r) => r.role_id === ROLE).map((r) => ({ kind: 'competency', ref_id: r.competency_id, level: r.required_level })) as never,
  y2030: [{ kind: 'skill', ref_id: 'sk-fs-ai-verify', level: 2 }] as never, goals: ['sk-fs-gr-ghg'], weeklyGoal: 2, enrolled: new Map(),
});
const fs13Tables = () => ({ techs: T.adv_technologies, advSkills: T.adv_skills, map: T.future_skill_map, skills: T.skills, resources: T.future_resources, states: T.person_skills, enrolments: T.enrolments, trainingRecords: T.training_records, trackProgress: T.future_track_progress }) as never;
const careerData = () => ({ people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
  licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments });
const levelsIndex = () => readinessIndex(T.adv_technologies as never, T.adv_skills as never, T.skills as never, statesOf(ME) as never);
const crew = () => T.people.filter((p) => p.kind === 'staff' && p.status !== 'inactive').slice(0, 24);
const crewStates = () => { const ids = new Set(crew().map((p) => p.id)); return stateMapOf(T.person_skills.filter((s) => ids.has(s.person_id)).map((s) => ({ person_id: s.person_id, skill_id: s.skill_id, level: s.level, basis: s.basis }))); };
const alumni = () => T.alumni.filter((m) => m.status === 'active');

/** One runner per FS55 function that takes people or person-derived rows. Each runs on trapped seed rows. */
const RUN: Record<string, () => unknown> = {
  'src/shell/digest/rules.ts#gatherDigest': () => T.people.filter((p) => p.kind === 'staff').slice(0, 40).flatMap((p) => gatherDigest(digestData(), p.id, NOW)),
  'src/shell/digest/rules.ts#matchScore': () => { const lv = new Map(statesOf(ME).map((s) => [s.skill_id as string, s.level as number])); const sk = new Map(T.skills.map((s) => [s.id as string, s]));
    return T.opportunities.map((o) => matchScore(o, lv, sk, T.role_competencies, ROLE, 'senior-reactor-operator', S.tables.engine_settings.find((s) => s.id === 'match')!.weights)); },
  'src/shell/digest/rules.ts#composeDigest': () => composeDigest(gatherDigest(digestData(), ME, NOW), { muted_kinds: [] }),
  'src/modules/m13/career/context.ts#careerCtxFrom': () => careerCtxFrom(T as unknown as CareerTables, ME, NOW),
  'src/modules/m19/pathways.ts#rankPathways': () => rankPathways(pathwayInput()),
  'src/modules/m19/pathways.ts#rankExternals': () => rankExternals(rankPathways(pathwayInput()), T.external_resources as never, T.skills as never),
  'src/modules/m18/translate.ts#translate': () => translation(),
  'src/modules/m18/translate.ts#coverageOf': () => coverageOf(new Map(statesOf(ME).map((s) => [s.skill_id as string, s.level as number])), T.role_competencies as never, 'senior-reactor-operator', W),
  'src/modules/m18/CareersTranslatePage.tsx#rankTranslation': () => rankTranslation(translation()),
  'src/modules/m20/futureGigs.ts#rankFutureGigs': () => rankFutureGigs(T.opportunities.filter((o) => o.channel && o.status === 'open') as never, T.skills as never, new Map(statesOf(ME).map((s) => [s.skill_id as string, s.level as number])),
    () => ({ code: 'no_envelope', fits: false, envelope_id: null, used: 0, cap: 0, after: 0 }) as never),
  'src/modules/m31/nextgen.ts#readinessOf': () => readinessOf(T.skills.slice(0, 20).map((s) => ({ skill_id: s.id, need: 2 })), statesOf(ME) as never),
  'src/modules/m31/nextgen.ts#deltaFor': () => T.smr_deltas.map((d) => deltaFor(d as never, null, statesOf(ME) as never, {})),
  'src/modules/m30/transform.ts#readinessFor': () => T.role_profile_versions.filter((v) => v.status === 'published' && Array.isArray(v.requirements)).slice(0, 6)
    .map((v) => readinessFor(v.requirements as never, statesOf(ME) as never, T.skills as never, v.horizon as never)),
  'src/modules/m02/instructorMatch.ts#rankSmeCandidates': () => rankSmeCandidates({ standardIds: ['qs-eng'], skills: T.skills, people: T.people, states: T.person_skills, smeProfiles: T.sme_profiles, smeMentors: T.mentors,
    onTrack: new Set(T.instructor_tracks.filter((t) => ['active', 'qualified', 'lapsed'].includes(t.status)).map((t) => t.person_id)), today: NOW } as never),
  'src/modules/m20/reserveMatch.ts#rankMembersForRequest': () => T.reserve_requests.map((r) => rankMembersForRequest(r as never, alumni() as never, T.skills as never, NOW)),
  'src/modules/m20/reserveMatch.ts#rankRequestsForMember': () => alumni().map((m) => rankRequestsForMember(m as never, T.reserve_requests.filter((r) => r.status === 'open') as never, T.skills as never, NOW)),
  'src/modules/m22/domain.ts#rankProgrammes': () => ['p-k-ro', 'p-sro', 'p-qc-inspector'].map((pid) => rankProgrammes(T.leadership_programmes as never, person(pid) as never,
    new Map(statesOf(pid).map((s) => [s.skill_id as string, { level: s.level as number }])), T.leadership_nominations as never, new Set())),
  'src/modules/m22/future.ts#coachFocus': () => [coachFocus(T.leadership_behaviours as never, null), coachFocus(T.leadership_behaviours as never, T.leadership_behaviours.map((b, i) => ({ id: b.id, self: 3 + (i % 2), others: 3.2 })))],
  'src/modules/m17/passport.ts#transferableStrengths': () => { const states = statesOf(ME); return transferableStrengths({ states, skills: T.skills, comps: T.competencies as never, have: competencyLevels(states as never, T.skills as never),
    roleComps: T.role_competencies, edges: T.career_paths, currentRole: ROLE, pathOnly: T.job_roles.filter((x) => x.security_sensitive).map((x) => x.id), roleLabels: Object.fromEntries(T.job_roles.map((x) => [x.id, bi(x.id)])) } as never); },
  'src/modules/m17/checkins.ts#teamActions': () => { const members = crew(); const states = crewStates(); const skills = T.skills.filter((s) => !s.obsolete_on).slice(0, 40);
    return teamActions({ rows: coverage(skills as never, members.map((m) => m.id), states, [], { holders: true }), members: members as never, states, skills: skills as never, courses: T.courses, secComps: securityComps(T.competencies as never),
      name: bi, skillName: bi, courseName: (c) => bi(String(c.code)) }); },
  'src/modules/m18/FutureRoles.tsx#rankConcepts': () => rankConcepts(conceptReadiness({ roles: T.job_roles as never, versions: T.role_profile_versions as never, edges: T.career_paths as never, skills: T.skills as never,
    competencies: T.competencies as never, states: statesOf(ME) as never }, careerFacts(careerData() as never, ME, NOW), ME, null) as never),
  'src/modules/m21/future.ts#bridgePlan': () => bridgePlan(rankBridges({ bridges: T.skill_bridges as never, families: levelsIndex().families, myRole: ROLE, edges: T.career_paths as never }) as never),
  'src/modules/m21/raises.ts#rankRaises': () => rankRaises(readinessV2(inputFor(ME, fs13Tables()))),
};

/** FS55 functions that take no person record: what each one scores instead. Static scan only (there is no person row to trap). */
const NO_PERSON_INPUT: Record<string, string> = {
  'src/modules/m13/career/engine.ts#CareerEngine': 'answer engine over the context careerCtxFrom builds (trapped above)',
  'src/modules/m13/dalil/engine.ts#RetrievalEngine': 'retrieval over the public and policy corpus (documents)',
  'src/modules/m13/dalil/engine.ts#GuardedEngine': 'wraps another answer engine with the refusal guard (text)',
  'src/modules/m13/dalil/engine.ts#ModelGatewayEngine': 'the disabled model slot (no rows)',
  'src/modules/m29/fitness.ts#nextStep': 'the next area and difficulty from answer responses',
  'src/modules/m29/fitness.ts#pickItem': 'a bank item for an area and difficulty',
  'src/modules/m29/fitness.ts#scoreAttempt': 'answer responses against the answer key',
  'src/modules/m29/drills.ts#scoreDrill': 'drill answers against the drill key',
  'src/modules/m31/twin.ts#scoreTwinDrill': 'a twin-drill submission against its key',
  'src/modules/m31/twin.ts#twinDrillsFor': 'scenarios filtered by skill ids',
  'src/modules/m30/transform.ts#transformRole': 'tasks of a role profile (content)',
  'src/domain/engines/future.ts#taskExposure': 'one task\'s exposure inputs (content)',
  'src/domain/engines/future.ts#nextItem': 'assessment answer history',
  'src/modules/m05/adaptive.ts#scoreAdaptive': 'adaptive responses against an item bank',
  'src/modules/m04/scenarios.ts#suggestScenarios': 'simulator scenarios against a cycle\'s competency coverage',
  'src/modules/m24/kb.ts#searchKb': 'knowledge documents for a query',
  'src/modules/m24/enrich.ts#bm25': 'documents for query terms',
  'src/modules/m24/enrich.ts#enrich': 'a document\'s text against reference lists',
  'src/modules/m24/klra.ts#proposeFactors': 'a position\'s knowledge-loss factors (position, not person)',
  'src/modules/m24/klra.ts#computeHeatmap': 'aggregated position assessments and actions',
  'src/modules/m08/aiCulture.ts#matchSituation': 'situation cards for a situation id (content)',
  'src/modules/m06/journeyUi.tsx#familyRanked': 'an anonymous explorer\'s quiz answers',
  'src/modules/m06/journey.ts#suggestRoute': 'a student\'s chosen stage and route',
  'src/modules/m18/conversations.ts#suggestActions': 'a conversation agenda and preparation (text) against courses',
  'src/modules/m26/accr.ts#suggestFor': 'accreditation evidence kinds against facts',
};

/**
 * The one reviewed exception: Dalil's retrieval engine prints a public programme's eligibility ("UAE nationals") from the programme
 * document. That is a content field of a programme row, not a person's attribute, and the engine ranks nobody with it.
 */
const CONTENT_FIELD = { ref: 'src/modules/m13/dalil/engine.ts#RetrievalEngine', snippet: 'say(lang, `nationality.${d.nationality}`)', inside: 'private programme(' };
const scanned = (ref: string, body: string) => (ref === CONTENT_FIELD.ref ? body.split(CONTENT_FIELD.snippet).join('') : body);

/** The source of an exported function, const or class, from its declaration to the next export. */
function declBody(src: string, name: string): string | null {
  const fn = functionBody(src, name);
  if (fn) return fn;
  const m = new RegExp(`(^|\\n)export\\s+(?:abstract\\s+)?class\\s+${name}\\b`).exec(src);
  if (!m) return null;
  const next = src.indexOf('\nexport ', m.index + 1 + (m[0].startsWith('\n') ? 1 : 0));
  return src.slice(m.index, next < 0 ? src.length : next);
}

describe('FS55: no function on the newer engine cards reads gender, nationality or age', () => {
  it('every FS55 function is either run on trapped rows here or listed as taking no person record (complete and disjoint)', () => {
    expect(FS55_FUNCTIONS.length).toBeGreaterThanOrEqual(40);
    const run = new Set(Object.keys(RUN)), none = new Set(Object.keys(NO_PERSON_INPUT));
    for (const f of FS55_FUNCTIONS) expect(run.has(f) !== none.has(f), f).toBe(true);
    for (const f of [...run, ...none]) expect(FS55_FUNCTIONS, f).toContain(f);
    // every function on a people-ranking surface has a runner
    for (const s of RANKED_SURFACES.filter((x) => x.wave === 'FS55' && x.ranks === 'people')) for (const f of s.functions) expect(run.has(f) || f.includes('engine.ts#'), `${s.card}: ${f}`).toBe(true);
  });
  it.each(FS55_FUNCTIONS)('%s: its source names no protected field', (ref) => {
    const [file, name] = ref.split('#');
    expect(existsSync(file), file).toBe(true);
    const body = declBody(readFileSync(file, 'utf8'), name);
    expect(body, `${name} is exported from ${file}`).toBeTruthy();
    expect(protectedRefs(scanned(ref, body!))).toEqual([]);
  });
  it('the content-field exception stays narrow: one programme eligibility label, inside the programme answer, on programme documents', () => {
    const src = readFileSync(CONTENT_FIELD.ref.split('#')[0], 'utf8');
    expect(src.split(CONTENT_FIELD.snippet).length - 1).toBe(1);
    const at = src.indexOf(CONTENT_FIELD.snippet);
    expect(src.lastIndexOf('private ', at)).toBe(src.lastIndexOf(CONTENT_FIELD.inside, at));
    expect(S.tables.people.some((p) => 'nationality' in p)).toBe(false);
  });
  it.each(Object.keys(RUN))('%s: run on rows that all carry gender, nationality and age, it never reads them', (ref) => {
    reads.length = 0;
    const out = RUN[ref]();
    expect(out).toBeTruthy();
    expect([...new Set(reads)]).toEqual([]);
  });
  it('the trap is armed: the people rows these functions see carry the protected attributes, and a biased ranker is caught', () => {
    reads.length = 0;
    expect(crew().length).toBeGreaterThanOrEqual(10);
    const biased = crew().filter((p) => p.nationality_flag === 'uae').length;
    expect(biased).toBeGreaterThanOrEqual(0);
    expect(reads.length).toBeGreaterThan(0);
  });
});
