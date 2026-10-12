/**
 * FS55 Engine cards, skills-ontology datasheet and model-risk template: pure rules and the ranked-surface registry
 * (import-free apart from .ts files, so node seed and validation scripts load it directly).
 *
 *  - RANKED_SURFACES: every place in the app that ranks or scores options for a person, with the engine card that explains it. Each
 *    entry claims the ranking functions (file#export) and the pages that ask the engine kernel for weights (useEngine). The lint test
 *    tests/unit/fs63-engine-lint.test.ts walks src/modules and src/shell with the TypeScript parser and fails when a ranking function
 *    (an exported function that returns Ranked results, or is named rank*, match*, suggest*, recommend*), a Dalil answer engine or a
 *    useEngine call is not claimed here, when a claimed function is missing from its card's scoring_functions, or when a card is
 *    missing. New ranked surfaces (for example FS72 in wave H) must add an entry and a card.
 *  - The engine_surface of a card is the stored engine setting its output depends on (skills, recommend, match, search: changing it
 *    bumps the card's version). kernel_surface says which engine-kernel surface serves it: transform and assess are defaults only
 *    (FS_SURFACES) because kafaa_engine_settings.surface keeps its four-value check, so their weights cannot be overridden or stored;
 *    "rules" means a fixed, published rule with no tunable weights.
 *  - SURFACE_METRICS: the FS55 fairness outcome per new ranked surface (people reached by the surface's outcome among active staff),
 *    compared by gender and nationality with the F24 rules (groups under 10 suppress the whole comparison; four-fifths flag).
 *    surfaceOutcomes() = SQL kafaa_fs63_fairness_compute (scripts/validate/fs63-taxonomy-governance.mjs proves SQL = TS).
 *  - datasheet(): the published skills-ontology datasheet, generated from the catalogue, the public change log and these registries.
 *  - MODEL_RISK_SECTIONS: the model-risk template for the day a server-side model gateway is approved (it is disabled today).
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import { DECAY_HALF_LIFE_MONTHS, REVIEW_CYCLE_MONTHS, reviewState } from '../../domain/taxonomy.ts';
import { FOUR_FIFTHS, METRICS, basePopulation, groupRows, statusAsOf, type FairnessData, type FairnessRow } from './fairness.ts';
import { PROTECTED_INPUTS } from './transparency.ts';

export type StoredSurface = 'skills' | 'recommend' | 'match' | 'search';
export type KernelSurface = StoredSurface | 'transform' | 'assess' | 'rules';
export const KERNEL_SURFACES: KernelSurface[] = ['skills', 'recommend', 'match', 'search', 'transform', 'assess', 'rules'];
export const RANKS = ['content', 'people', 'options'] as const;
export type Ranks = (typeof RANKS)[number];
/** Why a surface has no FS55 fairness outcome of its own. */
export const NO_FAIRNESS = ['f24', 'content', 'anonymous', 'no_outcome', 'non_staff'] as const;
export type NoFairness = (typeof NO_FAIRNESS)[number];

export interface RankedSurface {
  /** Engine card id (kafaa_engine_cards.id). */
  card: string;
  /** Wave that added the card: F24 (the eight original cards), FS55, or FSQA6 (the wave-F integration: FS50, FS52 and FS58 surfaces). */
  wave: 'F24' | 'FS55' | 'FSQA6';
  feature: string;
  module: string;
  route: string;
  stored: StoredSurface;
  kernel: KernelSurface;
  ranks: Ranks;
  /** Ranking functions (src path#export) this card explains; each must appear in the card's scoring_functions. */
  functions: string[];
  /** Pages and hooks that call useEngine() for this surface. */
  engineFiles: string[];
  /** The fairness outcome: an F24 metric, an FS55 surface metric, or the reason there is none. */
  fairness: { f24: string } | { metric: string } | { none: NoFairness };
}

const S = (card: string, wave: RankedSurface['wave'], feature: string, module: string, route: string, stored: StoredSurface, kernel: KernelSurface, ranks: Ranks,
  functions: string[], engineFiles: string[], fairness: RankedSurface['fairness']): RankedSurface => ({ card, wave, feature, module, route, stored, kernel, ranks, functions, engineFiles, fairness });

export const RANKED_SURFACES: RankedSurface[] = [
  // ── F24: the eight original cards (wave 3); the lint adds the FS15/FS13 rankers their pages use
  S('navigator', 'F24', 'F05 · F06 · FS15', 'M18', '/my/career', 'recommend', 'recommend', 'options',
    ['src/modules/m18/career.ts#careerReadiness', 'src/modules/m18/career.ts#reachableRoles', 'src/modules/m18/FutureRoles.tsx#rankConcepts'],
    ['src/modules/m18/MyCareerPage.tsx', 'src/modules/m18/MyRoadmapPage.tsx', 'src/modules/m18/FutureRoles.tsx'], { f24: 'navigator_ready' }),
  S('coach', 'F24', 'F07', 'M19', '/my/coach', 'recommend', 'recommend', 'content',
    ['src/modules/m19/coach.ts#buildCoachFeed', 'src/modules/m19/inputs.ts#coachInputFrom'], ['src/modules/m19/useCoachData.ts'], { none: 'f24' }),
  S('marketplace', 'F24', 'F08', 'M20', '/opportunities', 'match', 'match', 'options', ['src/modules/m20/match.ts#matchOpportunities'], ['src/modules/m20/ui.tsx'], { f24: 'opportunity_selected' }),
  S('talent_evidence', 'F24', 'F18', 'M23', '/talent/review', 'skills', 'skills', 'content', ['src/domain/skills.ts#deriveStates', 'src/domain/skills.ts#gatherEvidence'], [], { f24: 'hipo_pool' }),
  S('mentoring', 'F24', 'F13', 'M04', '/my/mentoring', 'match', 'match', 'people',
    ['src/modules/m04/match.ts#rankMentors', 'src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers'], ['src/modules/m04/useMentoring.ts'], { f24: 'mentoring_matched' }),
  S('rotations', 'F24', 'F15', 'M20', '/opportunities/rotations', 'match', 'match', 'options',
    ['src/modules/m20/rotationMatch.ts#rankProgrammes', 'src/modules/m20/rotationMatch.ts#rankHosts'],
    ['src/modules/m20/RotationsPage.tsx', 'src/modules/m20/ShadowPage.tsx', 'src/modules/m20/RotationTemplatePage.tsx'], { none: 'f24' }),
  S('experts', 'F24', 'F17', 'M22', '/communities/experts', 'match', 'match', 'people', ['src/modules/m22/domain.ts#rankExperts'], ['src/modules/m22/ExpertsPage.tsx'], { none: 'f24' }),
  S('future', 'F24', 'F09 · FS13', 'M21', '/my/future', 'recommend', 'recommend', 'options',
    ['src/modules/m21/future.ts#rankBridges', 'src/modules/m21/future.ts#rankFutureRoles', 'src/modules/m21/future.ts#rankResources', 'src/modules/m21/future.ts#bridgePlan', 'src/modules/m21/raises.ts#rankRaises'],
    ['src/modules/m21/MyFuturePage.tsx', 'src/modules/m21/MyFutureTechPage.tsx'], { none: 'f24' }),
  // ── FS55: the digest, Dalil, and every ranked surface added since F24 (waves 4-5 and FS waves A-E)
  S('digest', 'FS55', 'F36', 'Shell', '/my', 'match', 'match', 'options',
    ['src/shell/digest/rules.ts#gatherDigest', 'src/shell/digest/rules.ts#matchScore', 'src/shell/digest/rules.ts#composeDigest'], [], { metric: 'digest_suggested' }),
  S('dalil_career', 'FS55', 'F37', 'M13', '/ask', 'recommend', 'recommend', 'options', ['src/modules/m13/career/engine.ts#CareerEngine', 'src/modules/m13/career/context.ts#careerCtxFrom'], [], { metric: 'career_mode_used' }),
  S('dalil_answers', 'FS55', 'F14 · M13', 'M13', '/ask', 'search', 'search', 'content',
    ['src/modules/m13/dalil/engine.ts#RetrievalEngine', 'src/modules/m13/dalil/engine.ts#GuardedEngine', 'src/modules/m13/dalil/engine.ts#ModelGatewayEngine'], [], { none: 'anonymous' }),
  S('pathways', 'FS55', 'FS17', 'M19', '/my/pathways', 'recommend', 'rules', 'content', ['src/modules/m19/pathways.ts#rankPathways'], [], { metric: 'pathway_enrolled' }),
  S('externals', 'FS55', 'FS18', 'M19', '/learn/external', 'recommend', 'rules', 'content', ['src/modules/m19/pathways.ts#rankExternals'], [], { metric: 'external_completed' }),
  S('translator', 'FS55', 'FS34', 'M18', '/careers/translate', 'recommend', 'recommend', 'options',
    ['src/modules/m18/translate.ts#translate', 'src/modules/m18/translate.ts#coverageOf', 'src/modules/m18/CareersTranslatePage.tsx#rankTranslation'], ['src/modules/m18/CareersTranslatePage.tsx'], { none: 'anonymous' }),
  S('fitness', 'FS55', 'FS10 · FS37', 'M29', '/my/ai-fluency/check', 'skills', 'assess', 'content',
    ['src/modules/m29/fitness.ts#nextStep', 'src/modules/m29/fitness.ts#pickItem', 'src/modules/m29/fitness.ts#scoreAttempt', 'src/modules/m29/drills.ts#scoreDrill'], ['src/modules/m29/DrillsPage.tsx'], { metric: 'fitness_completed' }),
  S('future_gigs', 'FS55', 'FS27', 'M20', '/opportunities/future', 'match', 'rules', 'options', ['src/modules/m20/futureGigs.ts#rankFutureGigs'], [], { metric: 'gig_selected' }),
  S('smr_delta', 'FS55', 'FS38', 'M31', '/my/next-gen', 'skills', 'transform', 'options', ['src/modules/m31/nextgen.ts#deltaFor', 'src/modules/m31/nextgen.ts#readinessOf'], ['src/modules/m31/MyNextGenPage.tsx'], { none: 'no_outcome' }),
  S('twin_drills', 'FS55', 'FS40', 'M31', '/my/twin-drills', 'skills', 'assess', 'content', ['src/modules/m31/twin.ts#scoreTwinDrill', 'src/modules/m31/twin.ts#twinDrillsFor'], ['src/modules/m31/TwinDrillsPage.tsx'], { metric: 'twin_passed' }),
  S('role_2030', 'FS55', 'FS11 · FS12', 'M30', '/my/role-2030', 'skills', 'transform', 'content',
    ['src/modules/m30/transform.ts#transformRole', 'src/modules/m30/transform.ts#readinessFor', 'src/domain/engines/future.ts#taskExposure'], ['src/modules/m30/MyRole2030Page.tsx'], { none: 'no_outcome' }),
  S('adaptive', 'FS55', 'FS21', 'M05', '/my/assessments/adaptive', 'skills', 'assess', 'content',
    ['src/domain/engines/future.ts#nextItem', 'src/modules/m05/adaptive.ts#scoreAdaptive'], ['src/modules/m05/AdaptivePage.tsx', 'src/modules/m05/TrainingAdaptivePage.tsx'], { metric: 'adaptive_completed' }),
  S('instructors', 'FS55', 'F31', 'M02', '/training/instructors', 'match', 'match', 'people', ['src/modules/m02/instructorMatch.ts#rankSmeCandidates'],
    ['src/modules/m02/InstructorsPage.tsx', 'src/modules/m02/MyInstructorPage.tsx', 'src/modules/m02/TeamInstructorsPage.tsx'], { metric: 'instructor_nominated' }),
  S('reserve', 'FS55', 'F23', 'M20', '/opportunities/reserve', 'match', 'match', 'people',
    ['src/modules/m20/reserveMatch.ts#rankRequestsForMember', 'src/modules/m20/reserveMatch.ts#rankMembersForRequest'], ['src/modules/m20/ReserveDeskPage.tsx', 'src/modules/m20/ReserveMePage.tsx'], { none: 'non_staff' }),
  S('simulator', 'FS55', 'F28', 'M04', '/training/simulator', 'recommend', 'recommend', 'content', ['src/modules/m04/scenarios.ts#suggestScenarios'], ['src/modules/m04/simPlanner.tsx'], { none: 'content' }),
  S('knowledge_search', 'FS55', 'F20 · F21 · F30', 'M24', '/knowledge', 'search', 'search', 'content',
    ['src/modules/m24/kb.ts#searchKb', 'src/modules/m24/enrich.ts#bm25', 'src/modules/m24/enrich.ts#enrich'],
    ['src/modules/m24/KnowledgePage.tsx', 'src/modules/m24/AssetEditor.tsx', 'src/modules/m19/AskCoach.tsx', 'src/modules/m22/SessionsPage.tsx', 'src/modules/m27/LrsExplorerPage.tsx'], { none: 'content' }),
  S('klra', 'FS55', 'F20', 'M24', '/knowledge/klra', 'skills', 'skills', 'options', ['src/modules/m24/klra.ts#proposeFactors', 'src/modules/m24/klra.ts#computeHeatmap'], ['src/modules/m24/KlraPage.tsx'], { none: 'no_outcome' }),
  S('leadership', 'FS55', 'F16 · FS46 · FS47', 'M22', '/leadership', 'recommend', 'recommend', 'options', ['src/modules/m22/domain.ts#rankProgrammes', 'src/modules/m22/future.ts#coachFocus'],
    ['src/modules/m22/LeadershipPage.tsx'], { f24: 'hipo_pool' }),
  S('hu_situations', 'FS55', 'FS49', 'M08', '/my/safety-culture/ai', 'recommend', 'rules', 'content', ['src/modules/m08/aiCulture.ts#matchSituation'], [], { none: 'content' }),
  S('student_journey', 'FS55', 'F34', 'M06', '/pathways/journey', 'match', 'match', 'options', ['src/modules/m06/journeyUi.tsx#familyRanked', 'src/modules/m06/journey.ts#suggestRoute'],
    ['src/modules/m06/JourneyPage.tsx'], { none: 'non_staff' }),
  S('conversations', 'FS55', 'F12', 'M18', '/team/conversations', 'recommend', 'recommend', 'content', ['src/modules/m18/conversations.ts#suggestActions'], ['src/modules/m18/TeamConversationsPage.tsx'], { none: 'content' }),
  S('passport', 'FS55', 'F03 · F10 · F11', 'M17', '/my/skills', 'match', 'match', 'options', ['src/modules/m17/passport.ts#transferableStrengths', 'src/modules/m17/checkins.ts#teamActions'],
    ['src/modules/m17/PassportView.tsx'], { none: 'content' }),
  S('accreditation', 'FS55', 'F29', 'M26', '/training/accreditation', 'skills', 'rules', 'content', ['src/modules/m26/accr.ts#suggestFor'], [], { none: 'content' }),
  // ── FS wave F integration (fsqa6): the ranked lists wave F added (cards seeded by scripts/seed/ext/fsqa6-integration.mjs and inserted live by
  //    supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql). None ranks people: the register ranks its own rows, the outlook ranks
  //    skill families, the practice suggestion ranks scenarios.
  S('critical_attention', 'FSQA6', 'FS50', 'M35', '/workforce/critical-skills', 'skills', 'rules', 'options',
    ['src/modules/m35/critical.ts#attentionOf', 'src/modules/m35/critical.ts#criticalBoard'], [], { none: 'no_outcome' }),
  S('outlook_automation', 'FSQA6', 'FS52', 'M07', '/workforce/skills-outlook', 'skills', 'rules', 'options',
    ['src/modules/m07/outlook.ts#rankAutomation', 'src/modules/m07/outlook.ts#automationProfile'], [], { none: 'no_outcome' }),
  S('aps_next', 'FSQA6', 'FS58', 'M33', '/my/core-skills/problem-solving', 'recommend', 'rules', 'content',
    ['src/modules/m33/aps.ts#pickScenario', 'src/modules/m33/aps.ts#nextReasons'], [], { none: 'content' }),
];
/** The wave-F ranked surfaces the integration lead carded (fsqa6). */
export const FSQA6_CARDS = RANKED_SURFACES.filter((s) => s.wave === 'FSQA6').map((s) => s.card);
export const FS55_CARDS = RANKED_SURFACES.filter((s) => s.wave === 'FS55').map((s) => s.card);
/** Rankers FS55 adds to two F24 cards (their pages already call them); the seed and the migration append them once (version + 1). */
export const F24_ADDED_FUNCTIONS: Record<string, string[]> = {
  navigator: ['src/modules/m18/FutureRoles.tsx#rankConcepts'],
  future: ['src/modules/m21/future.ts#bridgePlan', 'src/modules/m21/raises.ts#rankRaises'],
};
/** Every TypeScript ranking function FS55 put on a card: checked for protected inputs by tests/unit/fs63-protected-inputs.test.ts. */
export const FS55_FUNCTIONS: string[] = [...new Set([...RANKED_SURFACES.filter((s) => s.wave === 'FS55').flatMap((s) => s.functions), ...Object.values(F24_ADDED_FUNCTIONS).flat()])];
/** The surfaces the FS55 card names explicitly (digest, Dalil career mode, pathways, externals, translator, fitness check, future gigs). */
export const NAMED_SURFACES = ['digest', 'dalil_career', 'pathways', 'externals', 'translator', 'fitness', 'future_gigs'] as const;

// ───────────── FS55 fairness outcomes per new ranked surface

export const SURFACE_METRICS = [
  { metric: 'digest_suggested', card: 'digest', source: 'digest_runs' },
  { metric: 'career_mode_used', card: 'dalil_career', source: 'advisor_sessions' },
  { metric: 'pathway_enrolled', card: 'pathways', source: 'pathway_enrolments' },
  { metric: 'external_completed', card: 'externals', source: 'external_completions' },
  { metric: 'fitness_completed', card: 'fitness', source: 'fitness_attempts' },
  { metric: 'gig_selected', card: 'future_gigs', source: 'opportunity_applications' },
  { metric: 'twin_passed', card: 'twin_drills', source: 'twin_attempts' },
  { metric: 'adaptive_completed', card: 'adaptive', source: 'adaptive_attempts' },
  { metric: 'instructor_nominated', card: 'instructors', source: 'instructor_tracks' },
] as const;
export type SurfaceMetric = (typeof SURFACE_METRICS)[number]['metric'];
/** Digest item kinds that come from a ranking (opportunity match, coach pick). */
export const DIGEST_RANKED_KINDS = ['opportunity', 'coach'];
export const GIG_SELECTED = ['selected', 'completed'];

type Row = Record<string, unknown>;
export interface SurfaceData {
  people: FairnessData['people'];
  digestRuns: Row[]; advisorSessions: Row[]; pathwayEnrolments: Row[]; externalCompletions: Row[]; fitnessAttempts: Row[];
  opportunities: Row[]; applications: Row[]; twinAttempts: Row[]; adaptiveAttempts: Row[]; instructorTracks: Row[];
}
export type SurfaceFairnessRow = Omit<FairnessRow, 'metric'> & { metric: SurfaceMetric; card: string };
const DAY = 86_400_000;
const items = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const s10 = (v: unknown) => String(v ?? '').slice(0, 10);

/** Per metric: every person in the population and whether the surface's outcome reached them by the as-of date (end of day UTC). */
export function surfaceOutcomes(d: SurfaceData, asOf: string): { metric: SurfaceMetric; card: string; source: string; people: Map<string, boolean> }[] {
  const day = asOf.slice(0, 10);
  const cut = Date.parse(`${day}T00:00:00Z`) + DAY;
  const base = basePopulation(d.people, day).map((p) => p.id);
  const hit = (ids: Iterable<unknown>) => { const s = new Set<string>(); for (const x of ids) if (typeof x === 'string') s.add(x); return new Map(base.map((id) => [id, s.has(id)] as const)); };
  const gigs = new Set(d.opportunities.filter((o) => o.channel != null).map((o) => o.id));
  const sets: Record<SurfaceMetric, Map<string, boolean>> = {
    digest_suggested: hit(d.digestRuns.filter((r) => s10(r.as_of) <= day && items(r.items).some((i) => DIGEST_RANKED_KINDS.includes(String(i?.kind)))).map((r) => r.person_id)),
    career_mode_used: hit(d.advisorSessions.filter((r) => r.mode === 'staff' && r.submode === 'career' && Date.parse(String(r.started_at)) < cut).map((r) => r.person_id)),
    pathway_enrolled: hit(d.pathwayEnrolments.filter((r) => !!r.started_on && s10(r.started_on) <= day && (!r.withdrawn_on || s10(r.withdrawn_on) > day)).map((r) => r.person_id)),
    external_completed: hit(d.externalCompletions.filter((r) => !!r.completed_on && s10(r.completed_on) <= day).map((r) => r.person_id)),
    fitness_completed: hit(d.fitnessAttempts.filter((r) => r.status === 'completed' && !!r.completed_at && Date.parse(String(r.completed_at)) < cut).map((r) => r.person_id)),
    gig_selected: hit(d.applications.filter((r) => gigs.has(r.opportunity_id) && GIG_SELECTED.includes(String(statusAsOf(r.history, day)))).map((r) => r.person_id)),
    twin_passed: hit(d.twinAttempts.filter((r) => r.passed === true && !!r.submitted_at && Date.parse(String(r.submitted_at)) < cut).map((r) => r.person_id)),
    adaptive_completed: hit(d.adaptiveAttempts.filter((r) => r.status === 'completed' && !!r.completed_at && Date.parse(String(r.completed_at)) < cut).map((r) => r.person_id)),
    instructor_nominated: hit(d.instructorTracks.filter((r) => !!r.started_on && s10(r.started_on) <= day).map((r) => r.person_id)),
  };
  return SURFACE_METRICS.map((m) => ({ metric: m.metric, card: m.card, source: m.source, people: sets[m.metric] }));
}

/** The FS55 snapshot rows for one as-of date (ids sf:<ISO week>:<metric>:<dimension>:<group>), fixed order. */
export function surfaceSnapshot(d: SurfaceData, asOf: string, minGroup = MIN_GROUP_SIZE): SurfaceFairnessRow[] {
  const byId = new Map(d.people.map((p) => [p.id, p as unknown as Record<string, unknown>]));
  const out: SurfaceFairnessRow[] = [];
  for (const m of surfaceOutcomes(d, asOf))
    for (const r of groupRows({ metric: m.metric, surface: m.card, source: m.source, people: m.people }, byId, asOf, minGroup, 'sf')) out.push({ ...r, metric: m.metric, card: m.card } as SurfaceFairnessRow);
  return out;
}

// ───────────── The skills-ontology datasheet (every number computed here, never typed in copy)

export interface DsSkill { id: string; lifecycle?: string | null; area?: string | null; fs_area?: string | null; skill_type?: string | null; reusability?: string | null; decay_class?: string | null;
  name_en?: string | null; name_ar?: string | null; description_en?: string | null; description_ar?: string | null; level_essence_en?: string | null; level_essence_ar?: string | null;
  alt_labels_en?: string[] | null; alt_labels_ar?: string[] | null; sources?: unknown; benchmark_ids?: string[] | null; review_due?: string | null; owner_role?: string | null; version?: number | null }
export interface DsChange { id: string; kind: string; effective_on: string; methodology?: boolean }
export interface Datasheet {
  as_of: string;
  size: { skills: number; live: number; obsolete: number; by_lifecycle: Record<string, number>; by_area: Record<string, number>; by_fs_area: Record<string, number>; by_type: Record<string, number>; by_reusability: Record<string, number>; owners: number };
  sources: { with_https: number; with_https_pct: number | null; domains: number; top_domains: { domain: string; skills: number }[]; benchmarks: number; sources_total: number };
  cadence: { changes_12m: number; by_kind: Record<string, number>; methodology_12m: number; last_change: string | null; overdue: number; due_soon: number; review_months: Record<string, number>; median_months_to_review: number | null; versioned: number };
  languages: { name_en: number; name_ar: number; description_en: number; description_ar: number; essence_en: number; essence_ar: number; alt_en: number; alt_ar: number; bilingual_pct: number | null };
  inference: { evidence_kinds: number; bases: number; half_lives: Record<string, number>; ranked_surfaces: number; cards_f24: number; cards_fs55: number; deterministic: number; model_slots_enabled: number };
  bias: { protected_inputs: number; min_group: number; four_fifths_pct: number; fairness_metrics: number; surfaces_without_metric: number };
}
/** F01 evidence kinds and bases (same lists as the skill_evidence checks). */
export const EVIDENCE_KINDS = ['qual', 'course', 'assessment', 'jpm', 'rating', 'ojt', 'credential'];
export const EVIDENCE_BASES = ['verified', 'evidenced', 'validated', 'claimed'];
const tally = (vals: (string | null | undefined)[]) => { const o: Record<string, number> = {}; for (const v of vals) { const k = v ?? 'none'; o[k] = (o[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))); };
const has = (v: unknown) => typeof v === 'string' && v.replace(/[ \t\n\r]/g, '') !== '';
const pct = (k: number, n: number) => (n ? Math.round((k / n) * 1000) / 10 : null);
const domainOf = (u: string) => { const m = /^https:\/\/([^/?#]+)/i.exec(u); return m ? m[1].toLowerCase().replace(/^www\./, '') : null; };

export function datasheet(skills: DsSkill[], changes: DsChange[], today: string): Datasheet {
  const day = today.slice(0, 10);
  const live = skills.filter((s) => s.lifecycle !== 'obsolete');
  const srcs = skills.map((s) => (Array.isArray(s.sources) ? (s.sources as { url?: unknown }[]) : []).map((x) => (typeof x?.url === 'string' ? x.url : '')).filter((u) => /^https:\/\//i.test(u)));
  const dom = new Map<string, Set<string>>();
  skills.forEach((s, i) => { for (const u of srcs[i]) { const d = domainOf(u); if (d) (dom.get(d) ?? dom.set(d, new Set()).get(d)!).add(s.id); } });
  const t = Date.parse(`${day}T00:00:00Z`);
  const yearAgo = t - 365 * DAY;
  const recent = changes.filter((c) => { const x = Date.parse(`${s10(c.effective_on)}T00:00:00Z`); return x <= t && x > yearAgo; });
  const months = live.filter((s) => s.review_due).map((s) => (Date.parse(`${s10(s.review_due)}T00:00:00Z`) - t) / (30.4375 * DAY)).sort((a, b) => a - b);
  const median = months.length ? Math.round((months.length % 2 ? months[(months.length - 1) / 2] : (months[months.length / 2 - 1] + months[months.length / 2]) / 2) * 10) / 10 : null;
  const bil = skills.filter((s) => has(s.name_en) && has(s.name_ar) && has(s.description_en) && has(s.description_ar)).length;
  const lastChange = [...changes].map((c) => s10(c.effective_on)).filter((x) => x <= day).sort().pop() ?? null;
  return {
    as_of: day,
    size: { skills: skills.length, live: live.length, obsolete: skills.length - live.length, by_lifecycle: tally(skills.map((s) => s.lifecycle)), by_area: tally(skills.map((s) => s.area)),
      by_fs_area: tally(skills.filter((s) => s.fs_area).map((s) => s.fs_area)), by_type: tally(skills.map((s) => s.skill_type)), by_reusability: tally(skills.map((s) => s.reusability)),
      owners: new Set(skills.map((s) => s.owner_role).filter(Boolean)).size },
    sources: { with_https: srcs.filter((x) => x.length > 0).length, with_https_pct: pct(srcs.filter((x) => x.length > 0).length, skills.length), domains: dom.size,
      top_domains: [...dom.entries()].map(([domain, ids]) => ({ domain, skills: ids.size })).sort((a, b) => b.skills - a.skills || (a.domain < b.domain ? -1 : 1)).slice(0, 8),
      benchmarks: new Set(skills.flatMap((s) => s.benchmark_ids ?? [])).size, sources_total: srcs.reduce((n, x) => n + x.length, 0) },
    cadence: { changes_12m: recent.length, by_kind: tally(recent.map((c) => c.kind)), methodology_12m: recent.filter((c) => c.methodology).length, last_change: lastChange,
      overdue: live.filter((s) => reviewState(s.review_due ?? null, day) === 'overdue').length, due_soon: live.filter((s) => reviewState(s.review_due ?? null, day) === 'due_soon').length,
      review_months: { ...REVIEW_CYCLE_MONTHS }, median_months_to_review: median, versioned: skills.filter((s) => Number(s.version ?? 1) > 1).length },
    languages: { name_en: skills.filter((s) => has(s.name_en)).length, name_ar: skills.filter((s) => has(s.name_ar)).length, description_en: skills.filter((s) => has(s.description_en)).length,
      description_ar: skills.filter((s) => has(s.description_ar)).length, essence_en: skills.filter((s) => has(s.level_essence_en)).length, essence_ar: skills.filter((s) => has(s.level_essence_ar)).length,
      alt_en: skills.reduce((n, s) => n + (s.alt_labels_en ?? []).length, 0), alt_ar: skills.reduce((n, s) => n + (s.alt_labels_ar ?? []).length, 0), bilingual_pct: pct(bil, skills.length) },
    inference: { evidence_kinds: EVIDENCE_KINDS.length, bases: EVIDENCE_BASES.length, half_lives: { ...DECAY_HALF_LIFE_MONTHS }, ranked_surfaces: RANKED_SURFACES.length,
      cards_f24: RANKED_SURFACES.filter((s) => s.wave === 'F24').length, cards_fs55: FS55_CARDS.length, deterministic: RANKED_SURFACES.length, model_slots_enabled: 0 },
    bias: { protected_inputs: PROTECTED_INPUTS.length, min_group: MIN_GROUP_SIZE, four_fifths_pct: Math.round(FOUR_FIFTHS * 100), fairness_metrics: METRICS.length + SURFACE_METRICS.length,
      surfaces_without_metric: RANKED_SURFACES.filter((s) => 'none' in s.fairness).length },
  };
}

// ───────────── Model-risk template (for the day a server-side model gateway is approved)

/**
 * Sections of the model-risk template, each with the fields a reviewer fills in. `from` names the engine-card field that pre-fills it
 * (the template is generated per card); `gate` marks the items that must be complete before a model engine may serve the surface.
 * Text lives in i18n (m16.mr.section.<id>, m16.mr.field.<id>).
 */
export const MODEL_RISK_SECTIONS: { id: string; fields: { id: string; from?: string; gate?: boolean }[] }[] = [
  { id: 'use', fields: [{ id: 'purpose', from: 'purpose', gate: true }, { id: 'decision', from: 'output', gate: true }, { id: 'out_of_scope', from: 'limitations' }, { id: 'owner', from: 'owner', gate: true }] },
  { id: 'data', fields: [{ id: 'inputs', from: 'inputs_used', gate: true }, { id: 'excluded', from: 'inputs_excluded', gate: true }, { id: 'provenance' }, { id: 'retention' }] },
  { id: 'model', fields: [{ id: 'provider' }, { id: 'version' }, { id: 'hosting', gate: true }, { id: 'baseline', from: 'scoring_functions', gate: true }] },
  { id: 'validation', fields: [{ id: 'evalset', gate: true }, { id: 'accuracy' }, { id: 'arabic', gate: true }, { id: 'refusals' }] },
  { id: 'fairness', fields: [{ id: 'metric', from: 'fairness_metric', gate: true }, { id: 'suppression', gate: true }, { id: 'protected', from: 'inputs_excluded' }] },
  { id: 'oversight', fields: [{ id: 'human', from: 'oversight', gate: true }, { id: 'explanation', gate: true }, { id: 'optout', from: 'opt_out' }, { id: 'fallback', gate: true }] },
  { id: 'monitoring', fields: [{ id: 'drift' }, { id: 'incidents', gate: true }, { id: 'review_cycle' }, { id: 'retire' }] },
];
export const MODEL_RISK_GATES = MODEL_RISK_SECTIONS.flatMap((s) => s.fields.filter((f) => f.gate).map((f) => `${s.id}.${f.id}`));
