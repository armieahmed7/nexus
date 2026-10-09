// F34 Student-to-career journey (W5 · E3, M06): pure rules shared by the pages, the LocalBackend RPCs, the seed builder and the
// tests. The SQL mirror lives in supabase/migrations/20261009153001_kafaa_w5e3_journey.sql (kafaa_sj_*); the PGlite checks in
// scripts/validate/w5e3-journey.mjs prove SQL = TS on every seeded journey. Keep both in lockstep.
// Import-free on purpose (node seed scripts load this file directly).
//
// Rules of the feature (BACKLOG F34): the interest explorer is deterministic and non-scoring (it shows which answers point to a
// job family, never a score); nothing is stored for anonymous visitors; no student is ranked or rejected; HR sees aggregates
// only, every cell under 10 suppressed.

export const JOURNEY_STAGES = ['school', 'finishing_school', 'university', 'graduate'] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];
/** Programme routes a student can pick on the board (talent_programmes ids). */
export const JOURNEY_ROUTES = ['dnt', 'energy-pioneers', 'gdp', 'gpo'] as const;
export type JourneyRoute = (typeof JOURNEY_ROUTES)[number];
export const STARTER_PROGRAMME = 'mustaqbali';
/** F32 micro-credential definition id the starter credential refers to (optional hand-off; no foreign key). */
export const STARTER_DEF_ID = 'mc-student-mustaqbali';
export const CHECK_VALUES = ['done', 'yes', 'no', 'unsure'] as const;
export const CHECK_KEY_RE = /^[a-z0-9:_-]{1,40}$/;
export const MAX_CHECK_KEYS = 40;
export const MAX_FAMILIES = 3;
export const MIN_GROUP = 10;

export const journeyId = (person: string) => `sj-${person}`;
export const starterId = (person: string) => `spf-${person}-mustaqbali`;
export const starterNoticeId = (person: string) => `nt-spf-${person}-mustaqbali`;

/** The four stations of the board, left to right (right to left in Arabic). */
export const BOARD_STEPS = ['explore', 'mustaqbali', 'route', 'first_role'] as const;
export type BoardStep = (typeof BOARD_STEPS)[number];

/** Where each life stage stands on the board, and which routes fit it first. */
export const STAGE_STEP: Record<JourneyStage, BoardStep> = { school: 'explore', finishing_school: 'route', university: 'route', graduate: 'route' };
export const STAGE_ROUTES: Record<JourneyStage, JourneyRoute[]> = {
  school: ['dnt', 'energy-pioneers'],
  finishing_school: ['dnt', 'energy-pioneers'],
  university: ['energy-pioneers'],
  graduate: ['gdp', 'gpo'],
};
/** First roles each route leads to (M01 job_roles ids; same links as the programme pages). */
export const ROUTE_ROLES: Record<JourneyRoute, string[]> = {
  dnt: ['local-operator', 'maintenance-technician-engineer'],
  'energy-pioneers': ['systems-design-plant-engineer', 'reactor-engineer-core-physicist'],
  gdp: ['systems-design-plant-engineer', 'corporate-professional'],
  gpo: ['local-operator', 'reactor-operator', 'senior-reactor-operator'],
};
/** Job families each route usually feeds (used only to explain a suggestion, never to exclude anyone). */
export const ROUTE_FAMILIES: Record<JourneyRoute, string[]> = {
  dnt: ['operations', 'maintenance', 'radiation-protection', 'chemistry', 'fire-protection'],
  'energy-pioneers': ['engineering', 'nuclear-fuel', 'licensing', 'cyber', 'environment', 'chemistry'],
  gdp: ['engineering', 'corporate', 'supply-chain', 'quality', 'licensing', 'training', 'outage', 'health-safety', 'emergency-preparedness', 'environment', 'oversight'],
  gpo: ['operations'],
};
/** Readiness checklist: preparation steps per route (keys prep:<route>:<item>). Non-binding; stored only for signed-in students. */
export const PREP_ITEMS: Record<JourneyRoute | 'mustaqbali', string[]> = {
  mustaqbali: ['school_ok', 'family', 'practice', 'register'],
  dnt: ['finish_g12', 'certificate', 'info_session', 'practice', 'family', 'apply'],
  'energy-pioneers': ['subjects', 'university', 'info_session', 'practice', 'family', 'apply'],
  gdp: ['degree', 'cv', 'info_session', 'practice', 'apply'],
  gpo: ['degree_eng', 'cv', 'shift', 'practice', 'apply'],
};
export const prepKey = (route: string, item: string) => `prep:${route}:${item}`;
export const eligKey = (programme: string, i: number) => `elig:${programme}:${i}`;

// ───────────── interest explorer
export interface JourneyOption {
  id: string;
  en: string;
  ar: string;
  families: string[];
  route?: string | null;
}
export interface JourneyQuestionRow {
  id: string;
  sort: number;
  prompt_en: string;
  prompt_ar: string;
  options: unknown;
}
export type Answers = Record<string, string>;
export const optionsOf = (q: { options: unknown }): JourneyOption[] => (Array.isArray(q.options) ? (q.options as JourneyOption[]) : []);
const bySort = <T extends { sort: number; id: string }>(a: T, b: T) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** null when every key is a question id and every value one of its option ids; otherwise a user-facing message. */
export function validateAnswers(questions: JourneyQuestionRow[], answers: unknown): string | null {
  if (answers == null) return null;
  if (typeof answers !== 'object' || Array.isArray(answers)) return 'Answers must be an object of question and option ids';
  const byId = new Map(questions.map((q) => [q.id, q]));
  const entries = Object.entries(answers as Record<string, unknown>);
  // Order-independent (same message as SQL whatever the key order): any unknown question first, then any unknown answer.
  if (entries.some(([k]) => !byId.has(k))) return 'Unknown question';
  if (entries.some(([k, v]) => typeof v !== 'string' || !optionsOf(byId.get(k)!).some((o) => o.id === v))) return 'Unknown answer';
  return null;
}

export interface FamilyHit {
  id: string;
  hits: number;
  /** Question ids whose chosen option pointed to this family, in question order. */
  questions: string[];
}
export interface Exploration {
  /** Up to three families, strongest first; a family needs two answers pointing to it unless it is the only lead. */
  families: FamilyHit[];
  /** Route suggested by a study-length answer, or null. */
  route: string | null;
  answered: number;
}

/**
 * Deterministic mapping from answers to job families. Every chosen option adds one hit to each family it names. Families are
 * ordered by hits (descending), then job_families.sort, then id; the first is kept when it has a hit, the next two only with two
 * or more hits. No score is shown: pages explain a family with the answers that point to it.
 */
export function exploreInterests(questions: JourneyQuestionRow[], answers: Answers | null | undefined, familySort: Record<string, number> = {}): Exploration {
  const a = answers ?? {};
  const tally = new Map<string, FamilyHit>();
  let route: string | null = null;
  let answered = 0;
  for (const q of [...questions].sort(bySort)) {
    const pick = a[q.id];
    if (!pick) continue;
    const opt = optionsOf(q).find((o) => o.id === pick);
    if (!opt) continue;
    answered++;
    if (route === null && opt.route) route = opt.route;
    for (const f of [...new Set(opt.families)]) {
      const h = tally.get(f) ?? { id: f, hits: 0, questions: [] };
      h.hits++;
      h.questions.push(q.id);
      tally.set(f, h);
    }
  }
  const ord = (id: string) => familySort[id] ?? 999;
  const ranked = [...tally.values()].sort((x, y) => y.hits - x.hits || ord(x.id) - ord(y.id) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const families = ranked.filter((h, i) => i < MAX_FAMILIES && (h.hits >= 2 || i === 0));
  return { families, route, answered };
}

/** Families named by any option, in job-family order: the fixed list the HR aggregate reports on. */
export function explorerFamilies(questions: JourneyQuestionRow[], familySort: Record<string, number> = {}): string[] {
  const s = new Set<string>();
  for (const q of questions) for (const o of optionsOf(q)) for (const f of o.families) s.add(f);
  const ord = (id: string) => familySort[id] ?? 999;
  return [...s].sort((x, y) => ord(x) - ord(y) || (x < y ? -1 : x > y ? 1 : 0));
}

// ───────────── route suggestion (explained, never exclusive)
export interface RouteSuggestion {
  route: JourneyRoute | null;
  /** Why: 'chosen' (the student picked it), 'study' (study-length answer), 'stage' (life stage), plus 'family' when a matched family fits. */
  why: ('chosen' | 'study' | 'stage' | 'family')[];
  /** Matched families the route usually feeds. */
  fits: string[];
}
export const isRoute = (r: unknown): r is JourneyRoute => typeof r === 'string' && (JOURNEY_ROUTES as readonly string[]).includes(r);
export const isStage = (s: unknown): s is JourneyStage => typeof s === 'string' && (JOURNEY_STAGES as readonly string[]).includes(s);

export function suggestRoute(stage: string | null | undefined, chosen: string | null | undefined, exploration: Exploration | null): RouteSuggestion {
  const why: RouteSuggestion['why'] = [];
  let route: JourneyRoute | null = null;
  if (isRoute(chosen)) { route = chosen; why.push('chosen'); }
  else if (exploration && isRoute(exploration.route)) { route = exploration.route; why.push('study'); }
  else if (isStage(stage)) { route = STAGE_ROUTES[stage][0]; why.push('stage'); }
  const fits = route ? (exploration?.families ?? []).map((f) => f.id).filter((f) => ROUTE_FAMILIES[route!].includes(f)) : [];
  if (fits.length) why.push('family');
  return { route, why, fits };
}

// ───────────── readiness checklist (non-binding; stored only when signed in)
export type CheckValue = (typeof CHECK_VALUES)[number];
export function validateChecklist(c: unknown): string | null {
  if (c == null) return null;
  if (typeof c !== 'object' || Array.isArray(c)) return 'The checklist must be an object';
  const e = Object.entries(c as Record<string, unknown>);
  if (e.length > MAX_CHECK_KEYS) return `At most ${MAX_CHECK_KEYS} checklist items`;
  if (e.some(([k]) => !CHECK_KEY_RE.test(k))) return 'Unknown checklist item';
  if (e.some(([, v]) => typeof v !== 'string' || !(CHECK_VALUES as readonly string[]).includes(v))) return 'Unknown checklist value';
  return null;
}
/** The next preparation step not yet done for a route (or null when all are done). Shown instead of any progress score. */
export function nextStep(route: string, checklist: Record<string, string> | null | undefined): string | null {
  const items = PREP_ITEMS[route as JourneyRoute] ?? [];
  return items.find((i) => (checklist ?? {})[prepKey(route, i)] !== 'done') ?? null;
}
/** Non-binding eligibility reading of the published criteria answers: never a decision. */
export function eligibilityView(answers: (string | undefined)[]): 'unanswered' | 'meets' | 'check' | 'unsure' {
  if (!answers.length || answers.some((a) => !a)) return 'unanswered';
  if (answers.some((a) => a === 'no')) return 'check';
  if (answers.some((a) => a === 'unsure')) return 'unsure';
  return 'meets';
}

// ───────────── saved row (TS mirror of kafaa_save_student_journey)
export interface SaveJourneyInput {
  stage?: string | null;
  route?: string | null;
  answers?: Answers | null;
  checklist?: Record<string, string> | null;
  clear?: boolean;
}
export function validateJourneyInput(questions: JourneyQuestionRow[], input: SaveJourneyInput | null | undefined): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Nothing to save';
  if (input.clear === true) return null;
  if (input.stage != null && !isStage(input.stage)) return 'Unknown stage';
  if (input.route != null && !isRoute(input.route)) return 'Unknown route';
  return validateAnswers(questions, input.answers) ?? validateChecklist(input.checklist);
}
/** interests and milestones json exactly as both backends store them. */
export function journeyPayload(questions: JourneyQuestionRow[], input: SaveJourneyInput, familySort: Record<string, number>) {
  const answers: Answers = { ...(input.answers ?? {}) };
  const ex = exploreInterests(questions, answers, familySort);
  const sortedAnswers = Object.fromEntries(Object.keys(answers).sort().map((k) => [k, answers[k]]));
  const checklist = input.checklist ?? {};
  return {
    stage: isStage(input.stage) ? input.stage : null,
    route: isRoute(input.route) ? input.route : null,
    interests: { answers: sortedAnswers, families: ex.families.map((f) => f.id), explorer_route: ex.route },
    milestones: { checklist: Object.fromEntries(Object.keys(checklist).sort().map((k) => [k, checklist[k]])) },
  };
}

// ───────────── HR aggregate (TS mirror of kafaa_journey_aggregate)
export interface AggCell {
  n: number | null;
  suppressed: boolean;
}
export interface AggRow extends AggCell {
  key: string;
}
export interface JourneyAggregate {
  total: AggCell;
  routed: AggCell;
  applied: AggCell;
  credentials: AggCell;
  by_stage: AggRow[];
  by_route: AggRow[];
  by_family: AggRow[];
  /** Mustaqbali participants waiting for a starter credential; only for applications A (null otherwise). */
  pending_credentials: number | null;
}
export const cellOf = (n: number, min = MIN_GROUP): AggCell => (n < min ? { n: null, suppressed: true } : { n, suppressed: false });

type Row = Record<string, unknown>;
const famsOf = (j: Row): string[] => {
  const i = j.interests as { families?: unknown } | null;
  return Array.isArray(i?.families) ? (i!.families as string[]) : [];
};
/** A journey counts when it is not cleared and holds a stage, a route or at least one family. */
export const liveJourney = (j: Row) => j.cleared_at == null && (j.stage != null || j.route != null || famsOf(j).length > 0);

export function starterEligible(applicationsIn: object[], portfolioIn: object[]): string[] {
  const applications = applicationsIn as Row[];
  const portfolio = portfolioIn as Row[];
  const has = new Set(portfolio.map((p) => p.id as string));
  return [...new Set(applications.filter((a) => a.programme_id === STARTER_PROGRAMME && a.stage === 'accepted').map((a) => a.person_id as string))]
    .filter((p) => !has.has(starterId(p)))
    .sort();
}

export function computeJourneyAggregate(
  inputIn: { journeys: object[]; applications: object[]; portfolio: object[]; families: string[] },
  canAct: boolean,
  min = MIN_GROUP,
): JourneyAggregate {
  const input = inputIn as { journeys: Row[]; applications: Row[]; portfolio: Row[]; families: string[] };
  const live = input.journeys.filter(liveJourney);
  const people = (rows: Row[]) => new Set(rows.map((j) => j.person_id as string)).size;
  const applied = live.filter((j) => j.route != null && input.applications.some((a) => a.person_id === j.person_id && a.programme_id === j.route && a.stage !== 'withdrawn'));
  const creds = new Set(input.portfolio.filter((p) => p.kind === 'microcred' && p.status === 'issued').map((p) => p.person_id as string)).size;
  const row = (key: string, rows: Row[]): AggRow => ({ key, ...cellOf(people(rows), min) });
  return {
    total: cellOf(people(live), min),
    routed: cellOf(people(live.filter((j) => j.route != null)), min),
    applied: cellOf(people(applied), min),
    credentials: cellOf(creds, min),
    by_stage: JOURNEY_STAGES.map((s) => row(s, live.filter((j) => j.stage === s))),
    by_route: [...JOURNEY_ROUTES.map((r) => row(r, live.filter((j) => j.route === r))), row('undecided', live.filter((j) => j.route == null))],
    by_family: input.families.map((f) => row(f, live.filter((j) => famsOf(j).includes(f)))),
    pending_credentials: canAct ? starterEligible(input.applications, input.portfolio).length : null,
  };
}

/** The starter credential row issued for a Mustaqbali participant (synthetic; never a FANR certification). */
export function starterRow(person: string, today: string) {
  return {
    id: starterId(person), person_id: person, kind: 'microcred' as const,
    title_en: 'Mustaqbali starter credential', title_ar: 'شهادة البداية من برنامج مستقبلي',
    issuer_en: "Kafa'a talent pipeline (synthetic record)", issuer_ar: 'مسار المواهب في كفاءة (سجل تجريبي)',
    programme_id: STARTER_PROGRAMME, microcred_def_id: STARTER_DEF_ID, status: 'issued' as const, issued_on: today,
    evidence_en: 'Took part in the two-week Mustaqbali STEM experience (accepted participant).',
    evidence_ar: 'شارك في تجربة مستقبلي للعلوم والتكنولوجيا لمدة أسبوعين (مشارك مقبول).',
    sample: true, open_read: false,
  };
}

/** Public copy check: student-facing journey text never shows a score, a rank or a percentage. */
export function noScoreText(s: string): boolean {
  return !/%|\bscore\b|\brank(ed|ing)?\b|\bpercentile\b|درجة التقييم|ترتيب/i.test(s);
}
