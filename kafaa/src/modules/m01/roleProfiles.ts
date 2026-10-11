/**
 * FS05 (wave A · E4) Future role profiles and 2030/2035 role horizons: pure rules, import-free so the seed builder, the
 * LocalBackend RPC, the PGlite validator and the pages share them. The SQL mirror is kafaa_rpv_check (and the publish logic of
 * kafaa_save_role_profile_version) in supabase/migrations/20261010214001_kafaa_fs14_role_profiles.sql; the validator proves
 * both give the same code for the same input.
 *
 * Every version is a planning assumption: "no deployment decision implied". Security, safeguards and cyber roles carry
 * path-level content only (no skill or competency requirements). Public text never carries headcount, sites or deployment claims.
 */

export const HORIZONS = ['now', '2030', '2035'] as const;
export type Horizon = (typeof HORIZONS)[number];
/** Technology drivers, the same vocabulary as the FS06 task layer (tech_driver) so FS11 can join them. */
export const DRIVERS = ['digital_ic', 'ai_assistance', 'robotics', 'smr_design', 'digital_twin'] as const;
export type Driver = (typeof DRIVERS)[number];
export const IMPORTANCE = ['core', 'important', 'useful'] as const;
export type Importance = (typeof IMPORTANCE)[number];
export const MAX_REQUIREMENTS = 30;
/** A concept future role needs at least this many requirements before its profile can be published. */
export const CONCEPT_MIN_REQUIREMENTS = 4;
export const RATIONALE_MIN = 20;
/** Skill areas and competency domains that never appear as a requirement (security content stays at career-path level). */
export const SECURITY_SKILL_AREA = 'security';
export const SECURITY_COMPETENCY_DOMAIN = 'security';

export interface ProfileReq {
  kind: 'competency' | 'skill';
  ref_id: string;
  level: number;
  importance: Importance;
  /** Why this requirement exists at this horizon (EN/AR); shown in "Why this?". */
  why_en?: string;
  why_ar?: string;
  driver?: Driver | null;
}
export interface ProfileSource {
  id: string;
  label: string;
  url: string;
  as_of?: string;
}
export interface VersionInput {
  role_id: string;
  horizon: string;
  requirements: ProfileReq[];
  drivers: string[];
  rationale_en: string;
  rationale_ar: string;
  sources: ProfileSource[];
  publish: boolean;
}
export interface RoleFacts {
  id: string;
  lifecycle: string;
  security_sensitive: boolean;
}
export interface CheckCtx {
  role: RoleFacts | null;
  /** competency id -> domain */
  competencies: Map<string, string>;
  /** skill id -> area */
  skills: Map<string, string>;
}
export type CheckCode = 'ok' | 'invalid' | 'not_found' | 'invalid_requirements' | 'unknown_ref' | 'security_restricted' | 'unclean_text' | 'source_required' | 'too_few';
export const CHECK_MESSAGES: Record<CheckCode, string> = {
  ok: 'ok',
  invalid: 'Choose a horizon (now, 2030 or 2035), known drivers and a rationale of at least 20 characters in English and Arabic',
  not_found: 'Role not found',
  invalid_requirements: 'Each requirement needs a kind, a reference, a level from 1 to 4 and an importance; no duplicates; at most 30',
  unknown_ref: 'A requirement points at an unknown competency or skill',
  security_restricted: 'Security, safeguards and cyber content stays at career-path level: no skill or competency requirements',
  unclean_text: 'Profile text must not mention headcount, sites or a deployment decision',
  source_required: 'Publishing needs at least one https source with a label',
  too_few: 'A published profile needs requirements (a concept future role at least 4)',
};

/** Headcount and site wording (M11's publicTextIsClean pattern, ASCII digits so SQL matches) plus deployment claims, in English and Arabic.
 *  The disclaimer itself ("no deployment decision implied") is allowed. */
export const HEADCOUNT_OR_SITE = /\b(headcount|fte|full[- ]time equivalents?|[0-9]+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\b/i;
export const DEPLOYMENT_CLAIM = /\b(will be deployed|to be deployed|decided to deploy|deployment (has been|is|was) (approved|decided|confirmed|planned)|construction (will|is planned to) (start|begin)|units? will be built)\b/i;
export const AR_UNCLEAN = /(عدد الموظفين|عدد العاملين|اختيار الموقع|الموقع المختار|سيتم نشر|تقرر نشر|تمت الموافقة على النشر|سيتم بناء|سيُبنى|سيبنى|[0-9]+\s*(موظف|موظفين|مشغل|مشغلين|مهندس|مهندسين|وظيفة|وظائف))/;
export function profileTextIsClean(values: unknown[]): boolean {
  return values.every((v) => {
    const s = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '';
    return !HEADCOUNT_OR_SITE.test(s) && !DEPLOYMENT_CLAIM.test(s) && !AR_UNCLEAN.test(s);
  });
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const reqKey = (r: Pick<ProfileReq, 'kind' | 'ref_id'>) => `${r.kind}:${r.ref_id}`;

/**
 * The first failing rule for a save (draft) or publish, in a fixed order that the SQL mirror (kafaa_rpv_check) follows:
 * invalid -> not_found -> invalid_requirements -> unknown_ref -> security_restricted -> unclean_text -> (publish only)
 * source_required -> too_few.
 */
export function checkVersion(input: VersionInput, ctx: CheckCtx): CheckCode {
  if (!input || !(HORIZONS as readonly string[]).includes(input.horizon)) return 'invalid';
  const drivers = Array.isArray(input.drivers) ? input.drivers : null;
  if (!drivers || drivers.some((d) => !(DRIVERS as readonly string[]).includes(d))) return 'invalid';
  if ((input.rationale_en ?? '').trim().length < RATIONALE_MIN || (input.rationale_ar ?? '').trim().length < RATIONALE_MIN) return 'invalid';
  if (!ctx.role) return 'not_found';
  const reqs = input.requirements;
  if (!Array.isArray(reqs) || reqs.length > MAX_REQUIREMENTS) return 'invalid_requirements';
  const seen = new Set<string>();
  for (const r of reqs) {
    if (!isObj(r) || (r.kind !== 'competency' && r.kind !== 'skill') || typeof r.ref_id !== 'string' || !r.ref_id) return 'invalid_requirements';
    if (typeof r.level !== 'number' || !Number.isInteger(r.level) || r.level < 1 || r.level > 4) return 'invalid_requirements';
    if (!(IMPORTANCE as readonly string[]).includes(r.importance as string)) return 'invalid_requirements';
    if (r.driver != null && !(DRIVERS as readonly string[]).includes(r.driver)) return 'invalid_requirements';
    if (seen.has(reqKey(r))) return 'invalid_requirements';
    seen.add(reqKey(r));
  }
  for (const r of reqs) if (!(r.kind === 'competency' ? ctx.competencies.has(r.ref_id) : ctx.skills.has(r.ref_id))) return 'unknown_ref';
  if (ctx.role.security_sensitive && reqs.length > 0) return 'security_restricted';
  for (const r of reqs) {
    if (r.kind === 'competency' && ctx.competencies.get(r.ref_id) === SECURITY_COMPETENCY_DOMAIN) return 'security_restricted';
    if (r.kind === 'skill' && ctx.skills.get(r.ref_id) === SECURITY_SKILL_AREA) return 'security_restricted';
  }
  const texts = [input.rationale_en, input.rationale_ar, ...reqs.flatMap((r) => [r.why_en ?? '', r.why_ar ?? ''])];
  if (!profileTextIsClean(texts)) return 'unclean_text';
  if (input.publish) {
    const src = Array.isArray(input.sources) ? input.sources : [];
    if (!src.some((s) => isObj(s) && typeof s.url === 'string' && /^https:\/\//.test(s.url) && typeof s.label === 'string' && s.label.trim().length > 0)) return 'source_required';
    const min = ctx.role.lifecycle === 'concept' ? CONCEPT_MIN_REQUIREMENTS : ctx.role.security_sensitive ? 0 : 1;
    if (reqs.length < min) return 'too_few';
  }
  return 'ok';
}

/** Requirements normalised for storage: fixed key order, sorted by kind then reference (the SQL stores the same order). */
export function normaliseReqs(reqs: ProfileReq[]): ProfileReq[] {
  return [...reqs]
    .map((r) => ({ kind: r.kind, ref_id: r.ref_id, level: r.level, importance: r.importance, why_en: r.why_en ?? '', why_ar: r.why_ar ?? '', driver: r.driver ?? null }))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.ref_id < b.ref_id ? -1 : a.ref_id > b.ref_id ? 1 : 0));
}

export const versionId = (roleId: string, horizon: string, version: number) => `rpv-${roleId}-${horizon}-v${version}`;

export interface VersionRow {
  id: string;
  role_id: string;
  horizon: string;
  version: number;
  status: string;
  path_only: boolean;
  requirements: unknown;
  drivers: string[];
  published_at?: string | null;
}
export const reqsOf = (v: Pick<VersionRow, 'requirements'> | null | undefined): ProfileReq[] => (v && Array.isArray(v.requirements) ? (v.requirements as ProfileReq[]) : []);

/** The current published version per horizon for one role (highest version wins). */
export function publishedByHorizon<V extends VersionRow>(rows: V[], roleId: string): Partial<Record<Horizon, V>> {
  const out: Partial<Record<Horizon, V>> = {};
  for (const v of rows) {
    if (v.role_id !== roleId || v.status !== 'published') continue;
    const h = v.horizon as Horizon;
    if (!out[h] || out[h]!.version < v.version) out[h] = v;
  }
  return out;
}

export type ChangeKind = 'new' | 'raised' | 'same' | 'lowered' | 'dropped';
export interface DiffRow {
  key: string;
  kind: ProfileReq['kind'];
  ref_id: string;
  change: ChangeKind;
  from: number;
  to: number;
  importance: Importance;
  req: ProfileReq;
}
/** What changes from one horizon to the next: new requirements, raised or lowered levels, unchanged and dropped ones. */
export function diffProfiles(prev: ProfileReq[], next: ProfileReq[]): DiffRow[] {
  const before = new Map(prev.map((r) => [reqKey(r), r]));
  const after = new Map(next.map((r) => [reqKey(r), r]));
  const rows: DiffRow[] = [];
  for (const [k, r] of after) {
    const p = before.get(k);
    const change: ChangeKind = !p ? 'new' : r.level > p.level ? 'raised' : r.level < p.level ? 'lowered' : 'same';
    rows.push({ key: k, kind: r.kind, ref_id: r.ref_id, change, from: p?.level ?? 0, to: r.level, importance: r.importance, req: r });
  }
  for (const [k, p] of before) if (!after.has(k)) rows.push({ key: k, kind: p.kind, ref_id: p.ref_id, change: 'dropped', from: p.level, to: 0, importance: p.importance, req: p });
  const order: Record<ChangeKind, number> = { new: 0, raised: 1, lowered: 2, same: 3, dropped: 4 };
  const imp: Record<string, number> = { core: 0, important: 1, useful: 2 };
  return rows.sort((a, b) => order[a.change] - order[b.change] || (imp[a.importance] ?? 3) - (imp[b.importance] ?? 3) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Size of a profile change: new requirements count their full level, raised ones the level increase. */
export function changeSize(prev: ProfileReq[], next: ProfileReq[]): { added: number; raised: number; dropped: number; score: number } {
  const d = diffProfiles(prev, next);
  const added = d.filter((x) => x.change === 'new').length;
  const raised = d.filter((x) => x.change === 'raised').length;
  const dropped = d.filter((x) => x.change === 'dropped').length;
  const score = d.reduce((s, x) => s + (x.change === 'new' ? x.to : x.change === 'raised' ? x.to - x.from : 0), 0);
  return { added, raised, dropped, score };
}

/** Does a profile ask for anything digital or AI (skill area 'digital' or competency domain 'digital')? */
export function asksDigital(reqs: ProfileReq[], skillArea: Map<string, string>, compDomain: Map<string, string>, aiOnly = false): boolean {
  return reqs.some((r) => {
    if (aiOnly) return r.ref_id === 'da-02' || r.ref_id.startsWith('sk-da-02');
    return r.kind === 'skill' ? skillArea.get(r.ref_id) === 'digital' : compDomain.get(r.ref_id) === 'digital';
  });
}

export interface ReasonLike {
  code: string;
  key: string;
  vars?: Record<string, string | number | { en: string; ar: string }>;
}
/** Reasons for "Why this?" on one requirement change (i18n keys under m01.fs05.why). */
export function reasonsFor(d: DiffRow, horizon: string): ReasonLike[] {
  const out: ReasonLike[] = [];
  if (d.change === 'new') out.push({ code: 'new', key: 'm01.fs05.why.new', vars: { horizon, level: d.to } });
  else if (d.change === 'raised') out.push({ code: 'raised', key: 'm01.fs05.why.raised', vars: { horizon, from: d.from, to: d.to } });
  else if (d.change === 'same') out.push({ code: 'same', key: 'm01.fs05.why.same', vars: { level: d.to } });
  else if (d.change === 'lowered') out.push({ code: 'lowered', key: 'm01.fs05.why.lowered', vars: { from: d.from, to: d.to } });
  if (d.req.driver) out.push({ code: 'driver', key: `m01.fs05.why.driver.${d.req.driver}` });
  if (d.req.why_en) out.push({ code: 'rationale', key: 'm01.fs05.why.text', vars: { text: { en: d.req.why_en, ar: d.req.why_ar || d.req.why_en } } });
  out.push({ code: 'importance', key: `m01.fs05.why.importance.${d.importance}` });
  out.push({ code: 'planning', key: 'm01.fs05.why.planning' });
  return out;
}
