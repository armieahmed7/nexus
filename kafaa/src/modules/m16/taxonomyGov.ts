/**
 * FS54 Skills council and taxonomy change tracker: pure rules shared by both backends, the pages, the seed builder and the
 * PGlite validator (import-free apart from .ts domain files, so node scripts load it directly).
 * SQL mirror: supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql (kafaa_fs63_*); scripts/validate/fs63-taxonomy-governance.mjs
 * proves SQL = TS on the seed and on generated cases. Change both together.
 *
 *  - Change requests add, rename, split, retire or re-level a skill. Each is checked against the inclusion rule: a skill is in the
 *    catalogue only when it is developed and assessed distinctly from every other skill (SFIA 9 / ESCO practice), so a request states
 *    how the skill is developed and how it is assessed, its names must not collide with another live skill, and new skills cite an
 *    https source.
 *  - Maker-checker: every decision needs two different council members (skills_taxonomy A), neither of them the proposer. The first
 *    vote records approve or reject; a second member who agrees closes the request (published or rejected); one who disagrees sends
 *    it back to submitted with both votes kept. Every vote writes a NEXUS ledger row.
 *  - Publishing applies the change to the catalogue through the FS02 guard paths: a retired (or split) skill is marked obsolete with
 *    its date and replacement and is never removed (trigger kafaa_fs_skill_guard); renames and re-levels raise the version; every
 *    published change gets a row in the public change log with its methodology flag and the dashboards it affects.
 *  - Staleness (definitions past their review date) and the orphan-rate audit (skills that no course, pathway, assessment or role
 *    uses) are computed from the catalogue, never entered (TAUGHT_BY is the shared "taught by" definition for FS57).
 */
import { DECAY_CLASSES, FS_AREAS, OWNER_ROLES, REVIEW_CYCLE_MONTHS, addMonthsIso, levelEssence, reviewState, type DecayClass } from '../../domain/taxonomy.ts';

export const CHANGE_KINDS = ['add', 'rename', 'split', 'retire', 'relevel'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const REQUEST_STATUSES = ['submitted', 'first_approved', 'first_rejected', 'published', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const OPEN_STATUSES: RequestStatus[] = ['submitted', 'first_approved', 'first_rejected'];
export const DECISIONS = ['approve', 'reject'] as const;
export type Decision = (typeof DECISIONS)[number];
/** The skill areas of the F01 catalogue (same list as the skills.area check). */
export const SKILL_AREAS = ['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'digital', 'project'] as const;
export const INCLUSION_KEYS = ['skill', 'names', 'distinct_name', 'development', 'assessment', 'source', 'replacement', 'level'] as const;
export type InclusionKey = (typeof INCLUSION_KEYS)[number];
/** Minimum lengths: a development or assessment statement, the rationale, and the note on a rejection. */
export const LIMITS = { statement: 20, rationale: 10, rationaleMax: 1000, note: 10, noteMax: 500, nameMax: 120 } as const;
/** How long a methodology banner stays on an affected dashboard after a change is published. */
export const BANNER_DAYS = 90;
/** Dashboards whose numbers move when the catalogue changes (keys, not routes: the integration lead mounts the banner by key). */
export const DASHBOARDS = ['catalogue', 'skills_outlook', 'skill_forecasts', 'skills_health', 'datasheet'] as const;
export type DashboardKey = (typeof DASHBOARDS)[number];

/** User-facing refusal messages (SQL kafaa_fs63_msg returns the same text). */
export const GOV_MSG = {
  not_signed_in: 'Sign in to propose or decide a skill change',
  forbidden_propose: 'Only staff may propose a change to the skills catalogue',
  forbidden_decide: 'Only skills council members (training manager, HR director, platform admin) decide skill changes',
  kind: 'Choose add, rename, split, retire or re-level',
  rationale: 'Give a rationale of 10 to 1,000 characters: the council reads it before deciding',
  not_found: 'That skill or request does not exist',
  duplicate: 'An open request already covers this skill: comment on it instead of opening a second one',
  inclusion: 'The proposal does not meet the inclusion rule (distinct development and assessment, distinct names, a source for new skills)',
  decision: 'Choose approve or reject',
  closed: 'This request is already decided',
  own_request: 'Maker-checker: you proposed this change, so two other council members decide it',
  second_approver: 'Maker-checker: you already voted on this request; a different council member gives the second decision',
  note: 'Give the reason for a rejection (10 to 500 characters): it is shown to the proposer',
  stale: 'The catalogue changed since this request was made: it no longer applies as written',
  forbidden_queue: 'Only skills council members and auditors see the council queue',
} as const;
export type GovCode = keyof typeof GOV_MSG;
/** The Result code a refusal carries (SQL kafaa_fs63_code): input problems are invalid, collisions conflict, maker-checker breaches maker_checker. */
export function govResultCode(c: GovCode): string {
  if (c === 'kind' || c === 'rationale' || c === 'inclusion' || c === 'decision' || c === 'note') return 'invalid';
  if (c === 'duplicate' || c === 'closed' || c === 'stale') return 'conflict';
  if (c === 'own_request' || c === 'second_approver') return 'maker_checker';
  if (c === 'forbidden_propose' || c === 'forbidden_decide' || c === 'forbidden_queue') return 'forbidden';
  return c;
}

// ───────────── Types

export interface SkillLite {
  id: string; code: string; competency_id: string; name_en: string; name_ar: string; area: string; core?: boolean; key_level: number;
  evidence_keys?: string[] | null; adjacent_ids?: string[] | null; adv_skill_ids?: string[] | null; description_en?: string | null; description_ar?: string | null; sources?: unknown;
  sort?: number | null; reusability?: string | null; skill_type?: string | null; lifecycle?: string | null; decay_class?: string | null;
  owner_role?: string | null; version?: number | null; review_due?: string | null; level_essence_en?: string | null; level_essence_ar?: string | null;
  alt_labels_en?: string[] | null; alt_labels_ar?: string[] | null; future_group?: string | null; fs_area?: string | null; benchmark_ids?: string[] | null;
  obsolete_on?: string | null; replaced_by?: string | null;
}
export interface Part { name_en?: string | null; name_ar?: string | null; description_en?: string | null; description_ar?: string | null }
export interface Proposal {
  name_en?: string | null; name_ar?: string | null; description_en?: string | null; description_ar?: string | null;
  area?: string | null; competency_id?: string | null; fs_area?: string | null; key_level?: number | null; decay_class?: string | null; owner_role?: string | null;
  source_label?: string | null; source_url?: string | null;
  parts?: Part[] | null; replaced_by?: string | null;
  level_essence_en?: string | null; level_essence_ar?: string | null;
}
export interface ProposeInput { kind: string; skill_id?: string | null; proposal?: Proposal | null; rationale?: string | null; development?: string | null; assessment?: string | null }
export interface Vote { by: string; role: string; decision: Decision; note: string | null; at: string }
export interface RequestRow {
  id: string; kind: ChangeKind; skill_id: string | null; title_en: string; title_ar: string; proposal: Proposal; rationale: string; development: string; assessment: string;
  inclusion: { key: InclusionKey; ok: boolean }[]; status: RequestStatus; proposed_by: string; proposed_role: string | null; proposed_at: string;
  votes: Vote[]; first_by: string | null; first_decision: Decision | null; second_by: string | null; decided_at: string | null; change_id: string | null;
}
export interface ChangeRow {
  id: string; request_id: string | null; kind: ChangeKind; skill_id: string; skill_code: string; skill_name_en: string; skill_name_ar: string;
  summary_en: string; summary_ar: string; before: Record<string, unknown>; after: Record<string, unknown>; version_before: number | null; version_after: number | null;
  new_skill_ids: string[]; replaced_by: string | null; effective_on: string; methodology: boolean; dashboards: DashboardKey[]; decided_roles: string[];
  proposed_role: string | null; published_at: string; ledger_seq: number | null; sources: { label: string; url: string }[];
}

// ───────────── Small helpers (SQL: kafaa_fs63_blank, kafaa_fs63_norm)

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** Blank: not a string, or only spaces, tabs and line breaks. */
export const blank = (v: unknown): boolean => str(v).replace(/[ \t\n\r]/g, '') === '';
/** Trim spaces, tabs and line breaks at both ends (SQL btrim(x, E' \t\r\n')). */
export const clean = (v: unknown): string => str(v).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
export const isHttpsUrl = (u: unknown): boolean => typeof u === 'string' && /^https:\/\/[^\s/$.?#][^\s]*$/i.test(u);
/**
 * Name key for collision checks: lower case, Arabic diacritics and tatweel removed, alef / alef maqsura / ta marbuta folded,
 * runs of spaces collapsed, trimmed. SQL: kafaa_fs63_norm.
 */
export function normName(s: unknown): string {
  return str(s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[ \t\r\n]+/g, ' ').replace(/^ | $/g, '');
}
const live = (s: SkillLite) => s.lifecycle !== 'obsolete';
const levelOk = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4;
const nameOk = (en: unknown, ar: unknown) => !blank(en) && !blank(ar) && clean(en).length <= LIMITS.nameMax && clean(ar).length <= LIMITS.nameMax;
const partsOf = (p: Proposal | null | undefined): Part[] => (Array.isArray(p?.parts) ? (p!.parts as Part[]) : []);

/** Names a proposal introduces (add, rename: one; split: every part). */
export function proposedNames(kind: string, p: Proposal | null | undefined): { en: string; ar: string }[] {
  if (kind === 'add' || kind === 'rename') return [{ en: str(p?.name_en), ar: str(p?.name_ar) }];
  if (kind === 'split') return partsOf(p).map((x) => ({ en: str(x?.name_en), ar: str(x?.name_ar) }));
  return [];
}

// ───────────── The inclusion rule

/**
 * The inclusion checks in a fixed order (same as SQL kafaa_fs63_inclusion). Every key is always present; a key that does not apply
 * to the kind is ok. `skills` is the whole catalogue, `competencies` the competency ids.
 */
export function inclusionChecks(x: ProposeInput, skills: SkillLite[], competencies: string[]): { key: InclusionKey; ok: boolean }[] {
  const kind = x.kind;
  const p = (x.proposal ?? {}) as Proposal;
  const target = x.skill_id ? skills.find((s) => s.id === x.skill_id) ?? null : null;
  const out: { key: InclusionKey; ok: boolean }[] = [];
  // skill: the target exists and is live (add has none)
  out.push({ key: 'skill', ok: kind === 'add' ? !x.skill_id : !!target && live(target) });
  // names
  let names = true;
  if (kind === 'add' || kind === 'rename') names = nameOk(p.name_en, p.name_ar);
  else if (kind === 'split') { const ps = partsOf(p); names = ps.length >= 2 && ps.length <= 4 && ps.every((q) => !!q && typeof q === 'object' && nameOk(q.name_en, q.name_ar)); }
  out.push({ key: 'names', ok: names });
  // distinct names: no collision with another live skill's names or alternative labels, nor between the parts; a rename must change the name
  let distinct = true;
  const nm = proposedNames(kind, p);
  if (nm.length) {
    const taken = new Set<string>();
    for (const s of skills) {
      if (!live(s) || (kind !== 'split' && s.id === x.skill_id)) continue;
      for (const v of [s.name_en, s.name_ar, ...(s.alt_labels_en ?? []), ...(s.alt_labels_ar ?? [])]) { const k = normName(v); if (k) taken.add(k); }
    }
    const seen = new Set<string>();
    for (const n of nm) {
      for (const k of [normName(n.en), normName(n.ar)]) {
        if (!k || taken.has(k) || seen.has(k)) distinct = false;
        seen.add(k);
      }
    }
    if (kind === 'rename' && target && normName(p.name_en) === normName(target.name_en) && normName(p.name_ar) === normName(target.name_ar)) distinct = false;
  }
  out.push({ key: 'distinct_name', ok: distinct });
  out.push({ key: 'development', ok: clean(x.development).length >= LIMITS.statement });
  out.push({ key: 'assessment', ok: clean(x.assessment).length >= LIMITS.statement });
  // source: new skills cite an https source; a split inherits the original's sources
  out.push({ key: 'source', ok: kind !== 'add' || (isHttpsUrl(p.source_url) && !blank(p.source_label)) });
  // replacement: a retire may name a live replacement that is another skill
  let repl = true;
  if (kind === 'retire' && p.replaced_by != null) {
    const r = skills.find((s) => s.id === p.replaced_by);
    repl = !!r && live(r) && r.id !== x.skill_id;
  }
  out.push({ key: 'replacement', ok: repl });
  // level: add needs a key level 1-4 (and a known competency and area); a re-level changes the key level or the level essence
  let lvl = true;
  if (kind === 'add') lvl = levelOk(p.key_level ?? 2) && competencies.includes(str(p.competency_id)) && (SKILL_AREAS as readonly string[]).includes(str(p.area));
  else if (kind === 'relevel') {
    lvl = levelOk(p.key_level) && !!target
      && (p.key_level !== target.key_level || (!blank(p.level_essence_en) && clean(p.level_essence_en) !== clean(target.level_essence_en)) || (!blank(p.level_essence_ar) && clean(p.level_essence_ar) !== clean(target.level_essence_ar)));
  }
  out.push({ key: 'level', ok: lvl });
  return out;
}
export const inclusionOk = (checks: { ok: boolean }[]): boolean => checks.every((c) => c.ok);

/** Refusal code of a proposal (order = SQL kafaa_propose_skill_change): kind, rationale, not_found, duplicate, inclusion; null = accepted. */
export function proposeProblem(x: ProposeInput, skills: SkillLite[], competencies: string[], open: Pick<RequestRow, 'kind' | 'skill_id' | 'proposal' | 'status'>[]): GovCode | null {
  if (!(CHANGE_KINDS as readonly string[]).includes(x.kind)) return 'kind';
  const why = clean(x.rationale);
  if (why.length < LIMITS.rationale || why.length > LIMITS.rationaleMax) return 'rationale';
  if (x.kind !== 'add' && !skills.some((s) => s.id === x.skill_id)) return 'not_found';
  const openRows = open.filter((r) => OPEN_STATUSES.includes(r.status));
  if (x.kind !== 'add' && openRows.some((r) => r.skill_id === x.skill_id)) return 'duplicate';
  if (x.kind === 'add' && openRows.some((r) => r.kind === 'add' && normName(r.proposal?.name_en) === normName(x.proposal?.name_en))) return 'duplicate';
  if (!inclusionOk(inclusionChecks(x, skills, competencies))) return 'inclusion';
  return null;
}

/** Refusal code of a council vote (order = SQL kafaa_decide_skill_change after the grant check): null = the vote counts. */
export function decideProblem(r: Pick<RequestRow, 'status' | 'proposed_by' | 'first_by'> | null | undefined, me: string, decision: unknown, note: unknown): GovCode | null {
  if (!r) return 'not_found';
  if (decision !== 'approve' && decision !== 'reject') return 'decision';
  if (!OPEN_STATUSES.includes(r.status)) return 'closed';
  if (r.proposed_by === me) return 'own_request';
  if (r.status !== 'submitted' && r.first_by === me) return 'second_approver';
  const n = clean(note);
  if ((decision === 'reject' && n.length < LIMITS.note) || n.length > LIMITS.noteMax) return 'note';
  return null;
}

/** What a valid vote does: record the first vote, close the request (second vote agrees) or send it back (second vote disagrees). */
export function voteOutcome(status: RequestStatus, firstDecision: Decision | null, decision: Decision): { status: RequestStatus; final: boolean; publish: boolean } {
  if (status === 'submitted') return { status: decision === 'approve' ? 'first_approved' : 'first_rejected', final: false, publish: false };
  if (firstDecision === decision) return { status: decision === 'approve' ? 'published' : 'rejected', final: true, publish: decision === 'approve' };
  return { status: 'submitted', final: false, publish: false };
}

// ───────────── Titles, ids and the change plan

const q = (s: string) => `"${s}"`;
const qa = (s: string) => `«${s}»`;
/** A short title of the request (EN, AR), from the kind and names (SQL kafaa_fs63_title). */
export function requestTitle(kind: string, skill: Pick<SkillLite, 'name_en' | 'name_ar'> | null, p: Proposal | null | undefined): { en: string; ar: string } {
  const sEn = clean(skill?.name_en), sAr = clean(skill?.name_ar);
  const parts = partsOf(p);
  switch (kind) {
    case 'add': return { en: `Add ${q(clean(p?.name_en))}`, ar: `إضافة ${qa(clean(p?.name_ar))}` };
    case 'rename': return { en: `Rename ${q(sEn)} to ${q(clean(p?.name_en))}`, ar: `إعادة تسمية ${qa(sAr)} إلى ${qa(clean(p?.name_ar))}` };
    case 'split': return { en: `Split ${q(sEn)} into ${parts.length} skills`, ar: `تقسيم ${qa(sAr)} إلى ${parts.length} مهارات` };
    case 'retire': return { en: `Retire ${q(sEn)}`, ar: `إيقاف ${qa(sAr)}` };
    default: return { en: `Re-level ${q(sEn)} to key level ${Number(p?.key_level)}`, ar: `إعادة تحديد مستوى ${qa(sAr)} إلى المستوى المحوري ${Number(p?.key_level)}` };
  }
}
/** Next sequential id with a prefix (scr-001, sc-001): the highest numeric suffix plus one (SQL kafaa_fs63_next_id). */
export function nextId(prefix: string, ids: string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of ids) { const m = re.exec(id); if (m) max = Math.max(max, Number(m[1])); }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
/** Which dashboards a change moves, and whether it is a methodology change (counts or levels change). */
export function changeImpact(kind: ChangeKind): { methodology: boolean; dashboards: DashboardKey[] } {
  if (kind === 'rename') return { methodology: false, dashboards: ['catalogue'] };
  if (kind === 'relevel') return { methodology: true, dashboards: ['catalogue', 'skills_outlook', 'skill_forecasts', 'skills_health'] };
  return { methodology: true, dashboards: [...DASHBOARDS] };
}
const SNAP = ['name_en', 'name_ar', 'key_level', 'lifecycle', 'version', 'obsolete_on', 'replaced_by', 'review_due', 'level_essence_en', 'level_essence_ar', 'alt_labels_en', 'alt_labels_ar'] as const;
/** The catalogue fields a change log row records before and after (fixed key order). */
export function snapshot(s: Partial<SkillLite> | null): Record<string, unknown> {
  if (!s) return {};
  return Object.fromEntries(SNAP.map((k) => [k, (s as Record<string, unknown>)[k] ?? null]));
}
const reviewDueFrom = (today: string, decay: string | null | undefined) => addMonthsIso(today, REVIEW_CYCLE_MONTHS[(decay ?? 'standard') as DecayClass] ?? 24);
const srcList = (v: unknown): { label: string; url: string }[] => (Array.isArray(v) ? (v as { label?: unknown; url?: unknown }[]) : [])
  .filter((x) => x && isHttpsUrl(x.url)).map((x) => ({ label: str(x.label), url: str(x.url) }));

export interface Plan {
  inserts: SkillLite[];
  updates: { id: string; patch: Partial<SkillLite> }[];
  change: Omit<ChangeRow, 'id' | 'published_at' | 'ledger_seq' | 'decided_roles'>;
}
/**
 * The catalogue change a published request makes (SQL kafaa_fs63_apply builds the same rows). New skills: id sk-c-<request number>
 * (split parts get a, b, c ...), version 1, generic level essence, review due one review cycle after today; retire and split mark
 * the original obsolete (never removed) with today's date and the replacement; rename and re-level raise the version and restart
 * the review clock; a rename keeps the old names as alternative labels.
 */
export function changePlan(r: Pick<RequestRow, 'id' | 'kind' | 'skill_id' | 'proposal' | 'proposed_role'>, skills: SkillLite[], today: string): Plan {
  const p = (r.proposal ?? {}) as Proposal;
  const num = r.id.replace(/^scr-/, '');
  const s = r.skill_id ? skills.find((x) => x.id === r.skill_id) ?? null : null;
  const maxSort = skills.reduce((m, x) => Math.max(m, Number(x.sort ?? 0)), 0);
  const impact = changeImpact(r.kind);
  const base = { request_id: r.id, kind: r.kind, effective_on: today, methodology: impact.methodology, dashboards: impact.dashboards, proposed_role: r.proposed_role ?? null };
  const fresh = (id: string, code: string, i: number, f: { name_en: string; name_ar: string; description_en: string; description_ar: string }, from: SkillLite | null): SkillLite => {
    const key = from ? from.key_level : Number(p.key_level ?? 2);
    // proposal values outside the catalogue's lists fall back to the defaults (decay standard, owner nuclear training, no future area)
    const decay = from ? from.decay_class ?? 'standard' : (DECAY_CLASSES as readonly string[]).includes(str(p.decay_class)) ? str(p.decay_class) : 'standard';
    const owner = (OWNER_ROLES as readonly string[]).includes(str(p.owner_role)) ? str(p.owner_role) : 'nuclear_training';
    const area = (FS_AREAS as readonly string[]).includes(str(p.fs_area)) ? str(p.fs_area) : null;
    const ess = levelEssence(key, { en: f.name_en, ar: f.name_ar });
    return {
      id, code, competency_id: from ? from.competency_id : str(p.competency_id), name_en: f.name_en, name_ar: f.name_ar, area: from ? from.area : str(p.area), core: false, key_level: key,
      evidence_keys: [], adjacent_ids: from ? [from.id] : [], adv_skill_ids: [], description_en: f.description_en, description_ar: f.description_ar,
      sources: from ? srcList(from.sources) : [{ label: clean(p.source_label), url: clean(p.source_url) }], sort: maxSort + 1 + i,
      reusability: from ? from.reusability ?? 'sector_specific' : 'sector_specific', skill_type: from ? from.skill_type ?? 'specialised' : 'specialised',
      lifecycle: from ? (from.lifecycle === 'obsolete' ? 'stable' : from.lifecycle ?? 'stable') : 'emerging', decay_class: decay,
      owner_role: from ? from.owner_role ?? 'nuclear_training' : owner, version: 1, review_due: reviewDueFrom(today, decay),
      level_essence_en: ess.en, level_essence_ar: ess.ar, alt_labels_en: [], alt_labels_ar: [], future_group: from ? from.future_group ?? null : null,
      fs_area: from ? from.fs_area ?? null : area, benchmark_ids: from ? [...(from.benchmark_ids ?? [])] : [], obsolete_on: null, replaced_by: null,
    };
  };
  if (r.kind === 'add') {
    const n = fresh(`sk-c-${num}`, `SC-${num}`, 0, { name_en: clean(p.name_en), name_ar: clean(p.name_ar), description_en: clean(p.description_en), description_ar: clean(p.description_ar) }, null);
    return { inserts: [n], updates: [], change: { ...base, skill_id: n.id, skill_code: n.code, skill_name_en: n.name_en, skill_name_ar: n.name_ar, summary_en: `Added ${q(n.name_en)}`, summary_ar: `أُضيفت ${qa(n.name_ar)}`,
      before: {}, after: snapshot(n), version_before: null, version_after: 1, new_skill_ids: [n.id], replaced_by: null, sources: srcList(n.sources) } };
  }
  const sk = s!;
  if (r.kind === 'split') {
    const parts = partsOf(p).map((x, i) => fresh(`sk-c-${num}${String.fromCharCode(97 + i)}`, `SC-${num}${String.fromCharCode(65 + i)}`, i,
      { name_en: clean(x.name_en), name_ar: clean(x.name_ar), description_en: clean(x.description_en), description_ar: clean(x.description_ar) }, sk));
    const patch: Partial<SkillLite> = { lifecycle: 'obsolete', obsolete_on: today, replaced_by: parts[0].id };
    return { inserts: parts, updates: [{ id: sk.id, patch }], change: { ...base, skill_id: sk.id, skill_code: sk.code, skill_name_en: sk.name_en, skill_name_ar: sk.name_ar,
      summary_en: `Split ${q(sk.name_en)} into ${parts.map((x) => q(x.name_en)).join(' and ')}`, summary_ar: `قُسّمت ${qa(sk.name_ar)} إلى ${parts.map((x) => qa(x.name_ar)).join(' و')}`,
      before: snapshot(sk), after: snapshot({ ...sk, ...patch }), version_before: Number(sk.version ?? 1), version_after: Number(sk.version ?? 1), new_skill_ids: parts.map((x) => x.id), replaced_by: parts[0].id, sources: srcList(sk.sources) } };
  }
  if (r.kind === 'retire') {
    const repl = p.replaced_by ? skills.find((x) => x.id === p.replaced_by) ?? null : null;
    const patch: Partial<SkillLite> = { lifecycle: 'obsolete', obsolete_on: today, replaced_by: repl ? repl.id : null };
    return { inserts: [], updates: [{ id: sk.id, patch }], change: { ...base, skill_id: sk.id, skill_code: sk.code, skill_name_en: sk.name_en, skill_name_ar: sk.name_ar,
      summary_en: repl ? `Retired ${q(sk.name_en)}, replaced by ${q(repl.name_en)}` : `Retired ${q(sk.name_en)}`,
      summary_ar: repl ? `أُوقفت ${qa(sk.name_ar)} وحلّت محلها ${qa(repl.name_ar)}` : `أُوقفت ${qa(sk.name_ar)}`,
      before: snapshot(sk), after: snapshot({ ...sk, ...patch }), version_before: Number(sk.version ?? 1), version_after: Number(sk.version ?? 1), new_skill_ids: [], replaced_by: patch.replaced_by ?? null, sources: srcList(sk.sources) } };
  }
  if (r.kind === 'rename') {
    const en = clean(p.name_en), ar = clean(p.name_ar);
    const addLabel = (list: string[] | null | undefined, v: string) => { const l = [...(list ?? [])]; if (v && !l.some((x) => normName(x) === normName(v))) l.push(v); return l; };
    const patch: Partial<SkillLite> = { name_en: en, name_ar: ar, alt_labels_en: addLabel(sk.alt_labels_en, sk.name_en), alt_labels_ar: addLabel(sk.alt_labels_ar, sk.name_ar),
      version: Number(sk.version ?? 1) + 1, review_due: reviewDueFrom(today, sk.decay_class) };
    return { inserts: [], updates: [{ id: sk.id, patch }], change: { ...base, skill_id: sk.id, skill_code: sk.code, skill_name_en: en, skill_name_ar: ar,
      summary_en: `Renamed ${q(sk.name_en)} to ${q(en)}`, summary_ar: `أُعيدت تسمية ${qa(sk.name_ar)} إلى ${qa(ar)}`,
      before: snapshot(sk), after: snapshot({ ...sk, ...patch }), version_before: Number(sk.version ?? 1), version_after: Number(sk.version ?? 1) + 1, new_skill_ids: [], replaced_by: null, sources: srcList(sk.sources) } };
  }
  // relevel
  const key = Number(p.key_level);
  const gen = levelEssence(key, { en: sk.name_en, ar: sk.name_ar });
  const patch: Partial<SkillLite> = { key_level: key, level_essence_en: blank(p.level_essence_en) ? gen.en : clean(p.level_essence_en), level_essence_ar: blank(p.level_essence_ar) ? gen.ar : clean(p.level_essence_ar),
    version: Number(sk.version ?? 1) + 1, review_due: reviewDueFrom(today, sk.decay_class) };
  return { inserts: [], updates: [{ id: sk.id, patch }], change: { ...base, skill_id: sk.id, skill_code: sk.code, skill_name_en: sk.name_en, skill_name_ar: sk.name_ar,
    summary_en: `Re-levelled ${q(sk.name_en)}: key level ${sk.key_level} to ${key}`, summary_ar: `أُعيد تحديد مستوى ${qa(sk.name_ar)}: المستوى المحوري من ${sk.key_level} إلى ${key}`,
    before: snapshot(sk), after: snapshot({ ...sk, ...patch }), version_before: Number(sk.version ?? 1), version_after: Number(sk.version ?? 1) + 1, new_skill_ids: [], replaced_by: null, sources: srcList(sk.sources) } };
}

// ───────────── Methodology banner

/** Published methodology changes that touch a dashboard within BANNER_DAYS of today, newest first. */
export function methodologyNotices<C extends { id: string; methodology: boolean; dashboards: readonly string[] | null; effective_on: string }>(changes: C[], dashboard: DashboardKey, today: string, days = BANNER_DAYS): C[] {
  const t = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  return changes.filter((c) => c.methodology && (c.dashboards ?? []).includes(dashboard)
    && Date.parse(`${String(c.effective_on).slice(0, 10)}T00:00:00Z`) <= t && t - Date.parse(`${String(c.effective_on).slice(0, 10)}T00:00:00Z`) <= days * 86_400_000)
    .sort((a, b) => (a.effective_on < b.effective_on ? 1 : a.effective_on > b.effective_on ? -1 : a.id < b.id ? 1 : -1));
}

// ───────────── Staleness and the orphan-rate audit

/**
 * "Taught by", shared with FS57 curriculum coverage (one definition; reconcile in the wave QA step if FS57 differs):
 *  course      a course whose id is one of the skill's evidence keys, an active FS19 course-skill link, or (core skills) a course
 *              that develops the skill's competency;
 *  pathway     a published FS17 pathway for the skill;
 *  assessment  a current qualification standard among the evidence keys, an active adaptive bank or item (FS21), an active
 *              performance task (FS22), a published twin drill (FS40) or AI drill (FS37), or a fitness-check area (FS10).
 * A skill is used by a role when a published, non path-only role profile requires it (directly, or through its competency for a core
 * skill), a role requires its competency (core skills), or an active task in the job and task analysis links it.
 * Orphan: a live skill that nothing teaches, assesses or requires (no course, pathway, assessment or role).
 */
export const TAUGHT_BY = {
  course: ['skills.evidence_keys -> courses', 'course_skill_links (active)', 'courses.competency_ids (core skills)'],
  pathway: ['pathways (published)'],
  assessment: ['skills.evidence_keys -> qual_standards (current)', 'adaptive_banks.skill_ids (active)', 'adaptive_items (active)', 'performance_tasks (active)', 'twin_scenarios (published)', 'ai_drills (published)', 'fitness_areas'],
  role: ['role_profile_versions (published, not path-only)', 'role_competencies (core skills)', 'jta_task_skills (active)'],
} as const;

type R = Record<string, unknown>;
export interface HealthData {
  skills: SkillLite[]; courses: R[]; courseSkillLinks: R[]; pathways: R[]; standards: R[]; adaptiveBanks: R[]; adaptiveItems: R[]; perfTasks: R[];
  twinScenarios: R[]; aiDrills: R[]; fitnessAreas: R[]; profileVersions: R[]; roleCompetencies: R[]; taskSkills: R[];
}
export interface SkillHealth {
  skill_id: string; review: 'none' | 'ok' | 'due_soon' | 'overdue'; days_overdue: number | null;
  course: boolean; pathway: boolean; assessment: boolean; role: boolean; taught: boolean; orphan: boolean;
}
export interface HealthSummary {
  as_of: string; skills: number; live: number; overdue: number; due_soon: number; no_review: number; stale_rate: number | null;
  no_course: number; no_pathway: number; no_assessment: number; no_role: number; untaught: number; orphans: number; orphan_rate: number | null;
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === 'string' && v.startsWith('[') ? (() => { try { return JSON.parse(v) as unknown[]; } catch { return []; } })() : []);
const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** Per live skill (sorted by id) the review state and what teaches, assesses or requires it, plus the summary (SQL kafaa_fs63_health). */
export function taxonomyHealth(d: HealthData, today: string): { summary: HealthSummary; skills: SkillHealth[] } {
  const day = today.slice(0, 10);
  const courseIds = new Set(d.courses.map((c) => str(c.id)));
  const stdIds = new Set(d.standards.filter((s) => s.status === 'current').map((s) => str(s.id)));
  const courseByComp = new Map<string, boolean>();
  for (const c of d.courses) for (const k of arr(c.competency_ids)) courseByComp.set(str(k), true);
  const linked = new Set(d.courseSkillLinks.filter((l) => l.active !== false).map((l) => str(l.skill_id)));
  const pw = new Set(d.pathways.filter((p) => p.status === 'published').map((p) => str(p.skill_id)));
  const asm = new Set<string>();
  for (const b of d.adaptiveBanks) if (b.status === 'active') for (const k of arr(b.skill_ids)) asm.add(str(k));
  for (const i of d.adaptiveItems) if (i.status === 'active') asm.add(str(i.skill_id));
  for (const t of d.perfTasks) if (t.status === 'active') for (const k of arr(t.skill_ids)) asm.add(str(k));
  for (const t of d.twinScenarios) if (t.status === 'published') for (const k of arr(t.skill_ids)) asm.add(str(k));
  for (const t of d.aiDrills) if (t.status === 'published') asm.add(str(t.skill_id));
  for (const a of d.fitnessAreas) for (const k of arr(a.skill_ids)) asm.add(str(k));
  const roleSkill = new Set<string>(), roleComp = new Set<string>();
  for (const v of d.profileVersions) {
    if (v.status !== 'published' || v.path_only === true) continue;
    for (const q0 of arr(v.requirements) as R[]) { if (q0?.kind === 'skill') roleSkill.add(str(q0.ref_id)); else if (q0?.kind === 'competency') roleComp.add(str(q0.ref_id)); }
  }
  for (const rc of d.roleCompetencies) roleComp.add(str(rc.competency_id));
  for (const ts of d.taskSkills) if (ts.active !== false) roleSkill.add(str(ts.skill_id));
  const rows: SkillHealth[] = [];
  const t = Date.parse(`${day}T00:00:00Z`);
  for (const s of [...d.skills].filter((x) => x.lifecycle !== 'obsolete').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const keys = s.evidence_keys ?? [];
    const course = keys.some((k) => courseIds.has(k)) || linked.has(s.id) || (!!s.core && courseByComp.has(s.competency_id));
    const pathway = pw.has(s.id);
    const assessment = keys.some((k) => stdIds.has(k)) || asm.has(s.id);
    const role = roleSkill.has(s.id) || (!!s.core && roleComp.has(s.competency_id));
    const review = reviewState(s.review_due ?? null, day);
    const taught = course || pathway || assessment;
    rows.push({ skill_id: s.id, review, days_overdue: review === 'overdue' ? Math.round((t - Date.parse(`${String(s.review_due).slice(0, 10)}T00:00:00Z`)) / 86_400_000) : null,
      course, pathway, assessment, role, taught, orphan: !taught && !role });
  }
  const n = rows.length;
  const c = (f: (x: SkillHealth) => boolean) => rows.filter(f).length;
  const overdue = c((x) => x.review === 'overdue');
  const orphans = c((x) => x.orphan);
  return {
    summary: {
      as_of: day, skills: d.skills.length, live: n, overdue, due_soon: c((x) => x.review === 'due_soon'), no_review: c((x) => x.review === 'none'), stale_rate: n ? r4(overdue / n) : null,
      no_course: c((x) => !x.course), no_pathway: c((x) => !x.pathway), no_assessment: c((x) => !x.assessment), no_role: c((x) => !x.role), untaught: c((x) => !x.taught),
      orphans, orphan_rate: n ? r4(orphans / n) : null,
    },
    skills: rows,
  };
}
