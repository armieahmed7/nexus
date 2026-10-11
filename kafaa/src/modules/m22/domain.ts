/**
 * M22 Leadership and communities (W2 · E5): F16 Leadership journeys and F17 Communities of practice and expert finder.
 * Pure rules, import-free apart from types (scripts/seed/ext/f16-leadership-communities.mjs and the PGlite validator load
 * this file in node). SQL mirror: supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql. Change both together.
 */
import type { Ranked, Reason } from '../../domain/engines/types';

// ───────────────────────────── F16 · leadership ladder
export const STEPS = ['ic', 'first_line', 'manager', 'director', 'executive'] as const;
export type Step = (typeof STEPS)[number];
/** Operator ladder towards shift supervisor: INTILAQA is delivered to ROs and SROs as Leading Effective Teams (LET) [CNS Art. 11]. */
export const SHIFT_TRACK_ROLES = ['reactor-operator', 'senior-reactor-operator', 'shift-supervisor'];
export const FIRST_LINE_ROLES = ['senior-reactor-operator', 'shift-supervisor'];

export interface PersonLite {
  id: string;
  job_role_id?: string | null;
  job_family_id?: string | null;
  level?: string | null;
  team_id?: string | null;
  manager_id?: string | null;
  kind?: string | null;
  status?: string | null;
}

/** Where a person stands on the leadership ladder (deterministic, from the role card and grade). */
export function stepOf(p: Pick<PersonLite, 'job_role_id' | 'level'> | null | undefined): Step {
  if (!p) return 'ic';
  if (p.job_role_id && FIRST_LINE_ROLES.includes(p.job_role_id)) return 'first_line';
  if (p.level === 'leadership') return p.job_role_id ? 'manager' : 'executive';
  if (p.level === 'senior') return 'first_line';
  return 'ic';
}
export const nextStep = (s: Step): Step | null => STEPS[STEPS.indexOf(s) + 1] ?? null;
export const isShiftTrack = (p: Pick<PersonLite, 'job_role_id'> | null | undefined) => !!p?.job_role_id && SHIFT_TRACK_ROLES.includes(p.job_role_id);

/** Leadership competencies from the framework (F01 skills under LD-01/02, SC-01/02 and HU-02) with the level each step expects. */
export const LEAD_SKILLS = ['sk-ld-01', 'sk-ld-01-coach', 'sk-ld-02', 'sk-ld-02-decide', 'sk-sc-02', 'sk-sc-01', 'sk-hu-02-brief'] as const;
export const LEAD_TARGETS: Record<Exclude<Step, 'ic'>, Record<string, number>> = {
  first_line: { 'sk-ld-01': 2, 'sk-ld-01-coach': 2, 'sk-ld-02': 2, 'sk-ld-02-decide': 2, 'sk-sc-02': 2, 'sk-sc-01': 2, 'sk-hu-02-brief': 2 },
  manager: { 'sk-ld-01': 3, 'sk-ld-01-coach': 3, 'sk-ld-02': 3, 'sk-ld-02-decide': 2, 'sk-sc-02': 3, 'sk-sc-01': 3, 'sk-hu-02-brief': 2 },
  director: { 'sk-ld-01': 3, 'sk-ld-01-coach': 3, 'sk-ld-02': 4, 'sk-ld-02-decide': 3, 'sk-sc-02': 4, 'sk-sc-01': 3, 'sk-hu-02-brief': 2 },
  executive: { 'sk-ld-01': 4, 'sk-ld-01-coach': 3, 'sk-ld-02': 4, 'sk-ld-02-decide': 3, 'sk-sc-02': 4, 'sk-sc-01': 3, 'sk-hu-02-brief': 2 },
};
/** The step a person prepares for: the next one up (an executive keeps their own step). */
export const targetStep = (s: Step): Exclude<Step, 'ic'> => (nextStep(s) ?? s) as Exclude<Step, 'ic'>;

const r = (code: string, vars?: Reason['vars'], ref?: Reason['ref'], weight?: number): Reason => ({ code, key: `m22.reasons.${code}`, vars, ref, weight });
type Label = (id: string) => { en: string; ar: string };

export interface Readiness {
  step: Exclude<Step, 'ic'>;
  score: number;
  rows: { skill_id: string; have: number; need: number; basis: string | null; met: boolean }[];
  reasons: Reason[];
}
/** Readiness for a ladder step: Σ min(have, need) / Σ need over the leadership skills (gates and nominations are separate). */
export function leadershipReadiness(levels: Map<string, { level: number; basis?: string | null }>, step: Exclude<Step, 'ic'>, label: Label = (id) => ({ en: id, ar: id })): Readiness {
  const tgt = LEAD_TARGETS[step];
  let have = 0;
  let need = 0;
  const rows = LEAD_SKILLS.map((id) => {
    const s = levels.get(id);
    const h = s?.level ?? 0;
    have += Math.min(h, tgt[id]);
    need += tgt[id];
    return { skill_id: id, have: h, need: tgt[id], basis: s?.basis ?? null, met: h >= tgt[id] };
  });
  const score = need ? Math.round((have / need) * 100) / 100 : 0;
  const reasons: Reason[] = [r('readiness', { pct: Math.round(score * 100), step: { en: STEP_EN[step], ar: STEP_AR[step] } })];
  for (const x of [...rows].sort((a, b) => b.need - b.have - (a.need - a.have) || (a.skill_id < b.skill_id ? -1 : 1))) {
    if (x.met) reasons.push(r('met', { skill: label(x.skill_id), level: x.have }, { table: 'skills', id: x.skill_id }));
    else reasons.push(r('gap', { skill: label(x.skill_id), from: x.have, to: x.need }, { table: 'skills', id: x.skill_id }, x.need - x.have));
  }
  return { step, score, rows, reasons };
}
// Step names for reason variables (pages use m22.steps.* for headings).
export const STEP_EN: Record<Step, string> = { ic: 'Individual contributor', first_line: 'First-line leader', manager: 'Manager', director: 'Director', executive: 'Executive' };
export const STEP_AR: Record<Step, string> = { ic: 'مساهم فردي', first_line: 'قائد الخط الأول', manager: 'مدير', director: 'مدير أول', executive: 'قيادة تنفيذية' };

export interface ProgrammeLite {
  id: string;
  title_en: string;
  title_ar: string;
  steps: string[];
  mandatory_steps: string[];
  required_tracks: string[];
  skill_ids: string[];
  nominable: boolean;
  course_id?: string | null;
  duration_days?: number | null;
  sort?: number;
}
export interface NominationLite { id: string; person_id: string; programme_id: string; status: string }

/** Is the programme required for this person (mandatory at their step or the step they are moving into, or their track)? */
export function requiredFor(p: ProgrammeLite, person: PersonLite | null | undefined): 'track' | 'step' | null {
  if (!person) return null;
  if (isShiftTrack(person) && p.required_tracks.includes('shift')) return 'track';
  const s = stepOf(person);
  if (p.mandatory_steps.includes(s) || (s === 'ic' && p.mandatory_steps.includes('first_line'))) return 'step';
  return null;
}

/**
 * "What next in the academy?" Programmes ranked for one person: required for my track or step first, then programmes aimed
 * at my next step weighted by how much of my leadership gap they address. Every item carries reasons (F02 lint).
 */
export function rankProgrammes(progs: ProgrammeLite[], person: PersonLite | null | undefined, levels: Map<string, { level: number }>, nominations: NominationLite[], done: Set<string>, label: Label = (id) => ({ en: id, ar: id })): Ranked<ProgrammeLite>[] {
  const step = stepOf(person);
  const tgtStep = targetStep(step);
  const tgt = LEAD_TARGETS[tgtStep];
  const out: Ranked<ProgrammeLite>[] = [];
  for (const p of progs) {
    const reasons: Reason[] = [];
    let score = 0;
    const req = requiredFor(p, person);
    if (req === 'track') { score += 10; reasons.push(r('required_track')); }
    else if (req === 'step') { score += 8; reasons.push(r('required_step', { step: { en: STEP_EN[step === 'ic' ? 'first_line' : step], ar: STEP_AR[step === 'ic' ? 'first_line' : step] } })); }
    if (p.steps.includes(tgtStep)) { score += 3; reasons.push(r('for_step', { step: { en: STEP_EN[tgtStep], ar: STEP_AR[tgtStep] } })); }
    else if (p.steps.includes(step)) { score += 2; reasons.push(r('for_current', { step: { en: STEP_EN[step], ar: STEP_AR[step] } })); }
    let gap = 0;
    for (const s of p.skill_ids) {
      const need = tgt[s] ?? 0;
      const have = levels.get(s)?.level ?? 0;
      if (need > have) { gap += need - have; reasons.push(r('closes', { skill: label(s), from: have, to: need }, { table: 'skills', id: s }, need - have)); }
    }
    score += gap;
    const nom = nominations.filter((n) => n.programme_id === p.id && n.person_id === person?.id).sort((a, b) => (a.id < b.id ? 1 : -1))[0];
    if (nom) reasons.push(r(`nomination_${nom.status}`));
    if (p.course_id && done.has(p.course_id)) { score = 0; reasons.push(r('completed')); }
    if (!reasons.length) reasons.push(r('catalogue'));
    out.push({ id: p.id, score: Math.round(score * 100) / 100, reasons, item: p });
  }
  return out.sort((a, b) => b.score - a.score || (a.item!.sort ?? 0) - (b.item!.sort ?? 0) || (a.id < b.id ? -1 : 1));
}

// ───────────────────────────── F16 · nominations
export const NOMINATION_STATUSES = ['nominated', 'approved', 'declined', 'completed'] as const;
export const NOM_MSG = {
  not_signed_in: 'Sign in to use the leadership academy',
  forbidden_nominate: 'Only line managers can nominate someone for a leadership programme',
  self_nominate: 'You cannot nominate yourself; ask your line manager',
  not_found_person: 'Person not found',
  not_in_scope: 'You can nominate only people you manage',
  not_found_programme: 'Programme not found',
  not_nominable: 'This programme does not take nominations (see how to join on the programme page)',
  duplicate: 'This person already has an open nomination for this programme',
  reason: 'Give a reason of 10 to 500 characters (what the person is ready for)',
  not_found: 'Nomination not found',
  forbidden_decide: 'Only the HR authority or the training manager decides nominations',
  maker_checker: 'The person who made the nomination cannot decide it',
  self_decide: 'You cannot decide your own nomination',
  not_open: 'This nomination has already been decided',
  invalid_decision: 'Unknown decision',
  decline_note: 'Give a reason when you decline a nomination',
} as const;

// ───────────────────────────── F16 · leadership behaviours 360
/** Leadership behaviours rated in the 360, each linked to an INPO 12-012 safety-culture trait (M08 sc_traits). */
export const BEHAVIOURS = [
  { id: 'b-safety-values', trait: 'trait-4' },
  { id: 'b-accountability', trait: 'trait-1' },
  { id: 'b-questioning', trait: 'trait-2' },
  { id: 'b-communication', trait: 'trait-3' },
  { id: 'b-decisions', trait: 'trait-5' },
  { id: 'b-respect', trait: 'trait-6' },
  { id: 'b-learning', trait: 'trait-7' },
  { id: 'b-concerns', trait: 'trait-9' },
] as const;
export const BEHAVIOUR_IDS: string[] = BEHAVIOURS.map((b) => b.id);
/**
 * FS46 (wave E · E4): 360 form version 2 adds four future-leadership behaviours (leading digital change, leading AI-augmented teams
 * incl. when to override a tool, intrapreneurship (EntreComp) and inclusion). Form 1 keeps its eight behaviours and its generic
 * scale; a subject's cycle keeps the version of its first request, so results recorded under version 1 stay readable unchanged.
 */
export const FUTURE_BEHAVIOUR_IDS = ['b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion'] as const;
export const BEHAVIOUR_IDS_V2: string[] = [...BEHAVIOUR_IDS, ...FUTURE_BEHAVIOUR_IDS];
export const FORM_VERSIONS = [1, 2] as const;
export const CURRENT_FORM_VERSION = 2;
export const formBehaviours = (v: number | null | undefined): string[] => (v === 2 ? BEHAVIOUR_IDS_V2 : BEHAVIOUR_IDS);
/** The form version of a subject's cycle: the version its requests carry (all equal by construction), else the current one. */
export function formVersionFor(subject: string, cycle: string, reqs: { subject_id: string; cycle: string; form_version?: number | null }[]): number {
  const v = reqs.filter((q) => q.subject_id === subject && q.cycle === cycle).map((q) => q.form_version ?? 1);
  return v.length ? Math.max(...v) : CURRENT_FORM_VERSION;
}
export const MIN_360_RATERS = 5; // results appear only with at least 5 responses (self excluded)
export const MAX_360_INVITES = 12;
export const RATER_KINDS = ['manager', 'peer', 'report'] as const;
export const cycleOf = (iso: string) => `${iso.slice(0, 4)}-H${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`;
export const avg2 = (sum: number, n: number) => (n ? Math.round((sum * 100) / n) / 100 : null);

export interface R360 { cycle: string; subject_id: string; rater_kind: string; scores: Record<string, number>; form_version?: number | null }
export interface Req360 { id: string; cycle: string; subject_id: string; rater_id: string; rater_kind: string; status: string; form_version?: number | null }

/** Validate a 360 score sheet: every behaviour of the form version scored with a whole number from 1 to 5, nothing else. */
export function validScores(s: unknown, version = 1): Record<string, number> | null {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const o = s as Record<string, unknown>;
  const ids = formBehaviours(version);
  if (Object.keys(o).length !== ids.length) return null;
  const out: Record<string, number> = {};
  for (const id of ids) {
    const v = o[id];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return null;
    out[id] = v;
  }
  return out;
}

export interface My360 {
  cycle: string | null;
  cycles: string[];
  invited: number;
  responded: number;
  self_submitted: boolean;
  self_request_id: string | null;
  enough: boolean;
  min_raters: number;
  invitees: { name: string; name_ar: string; kind: string }[];
  behaviours: { id: string; self: number | null; others: number; low: number; high: number }[] | null;
  /** FS46: the form version of this cycle (1: eight behaviours, 2: twelve with anchors). */
  form_version: number;
}
/** The subject's own 360 view: aggregates only, and nothing until at least MIN_360_RATERS people (self excluded) responded. */
export function summarise360(me: string, cycle: string | null, reqs: Req360[], resps: R360[], names: Map<string, { name: string; name_ar: string }>): My360 {
  const mine = reqs.filter((q) => q.subject_id === me);
  const cycles = [...new Set(mine.map((q) => q.cycle))].sort().reverse();
  const c = cycle && cycles.includes(cycle) ? cycle : cycles[0] ?? null;
  const rq = mine.filter((q) => q.cycle === c);
  const version = rq.length ? Math.max(...rq.map((q) => q.form_version ?? 1)) : 1;
  const ids = formBehaviours(version);
  const others = rq.filter((q) => q.rater_kind !== 'self');
  const selfReq = rq.find((q) => q.rater_kind === 'self') ?? null;
  const rs = resps.filter((x) => x.subject_id === me && x.cycle === c && (x.form_version ?? 1) === version);
  const oth = rs.filter((x) => x.rater_kind !== 'self');
  const self = rs.find((x) => x.rater_kind === 'self') ?? null;
  const enough = oth.length >= MIN_360_RATERS;
  const invitees = [...others].sort((a, b) => (a.rater_id < b.rater_id ? -1 : 1)).map((q) => ({ name: names.get(q.rater_id)?.name ?? '', name_ar: names.get(q.rater_id)?.name_ar ?? '', kind: q.rater_kind }));
  return {
    cycle: c, cycles, invited: others.length, responded: oth.length, self_submitted: !!self, self_request_id: selfReq?.id ?? null, enough, min_raters: MIN_360_RATERS, invitees,
    form_version: version,
    behaviours: enough
      ? ids.map((id) => {
          const v = oth.map((x) => x.scores[id]);
          return { id, self: self ? self.scores[id] : null, others: avg2(v.reduce((a, b) => a + b, 0), v.length)!, low: Math.min(...v), high: Math.max(...v) };
        })
      : null,
  };
}

export interface LeadershipStats {
  cycle: string | null;
  by_level: { level: string; subjects: number | null; suppressed: boolean; scores: Record<string, number> | null }[];
  nominations: { status: string; n: number | null; suppressed: boolean }[];
}
export const LEVELS = ['entry', 'professional', 'senior', 'leadership', 'unknown'] as const;
/** HR aggregates: 360 averages per grade for subjects with enough responses, and nominations per status; cells under minGroup suppressed. */
export function computeLeadershipStats(all360: R360[], people: PersonLite[], noms: { status: string }[], minGroup: number): LeadershipStats {
  // FS46: this view stays the form-1 view (eight behaviours); form-2 results are aggregated by programme (computeProgrammeStats)
  const resps = all360.filter((x) => (x.form_version ?? 1) === 1);
  // the latest cycle in which at least one subject reached the response threshold (else the latest cycle at all)
  const cnt = new Map<string, number>();
  for (const x of resps) if (x.rater_kind !== 'self') cnt.set(`${x.cycle}|${x.subject_id}`, (cnt.get(`${x.cycle}|${x.subject_id}`) ?? 0) + 1);
  const ready = [...cnt.entries()].filter(([, n]) => n >= MIN_360_RATERS).map(([k]) => k.split('|')[0]);
  const cycle = (ready.length ? ready : resps.map((x) => x.cycle)).sort().reverse()[0] ?? null;
  const lv = new Map(people.map((p) => [p.id, p.level ?? 'unknown']));
  const rs = resps.filter((x) => x.cycle === cycle && x.rater_kind !== 'self');
  const bySubject = new Map<string, R360[]>();
  for (const x of rs) (bySubject.get(x.subject_id) ?? bySubject.set(x.subject_id, []).get(x.subject_id)!).push(x);
  const by_level = LEVELS.map((level) => {
    const subs = [...bySubject.entries()].filter(([s, xs]) => xs.length >= MIN_360_RATERS && (lv.get(s) ?? 'unknown') === level);
    const suppressed = subs.length < minGroup;
    let scores: Record<string, number> | null = null;
    if (!suppressed) {
      scores = {};
      const all = subs.flatMap(([, xs]) => xs);
      for (const id of BEHAVIOUR_IDS) scores[id] = avg2(all.reduce((a, x) => a + x.scores[id], 0), all.length)!;
    }
    return { level, subjects: suppressed ? null : subs.length, suppressed, scores };
  });
  const nominations = NOMINATION_STATUSES.map((status) => {
    const n = noms.filter((x) => x.status === status).length;
    return { status, n: n < minGroup ? null : n, suppressed: n < minGroup };
  });
  return { cycle, by_level, nominations };
}

// ───────────────────────────── F17 · communities
export const DISCIPLINES = ['operations', 'maintenance', 'chemistry', 'radiation_protection', 'engineering', 'digital_ai', 'human_performance'] as const;
export const POST_LIMIT_PER_DAY = 20;
export const EXPERT_MIN_LEVEL = 3;
export const EXPERT_REQUESTS_PER_DAY = 5;
export const COP_MSG = {
  not_signed_in: 'Sign in to take part in communities',
  forbidden: 'Communities are open to staff',
  not_found: 'Community not found',
  not_member: 'Join this community to post in it',
  thread_not_found: 'Thread not found',
  thread_closed: 'This thread is closed to new replies',
  title: 'Give a title of 5 to 140 characters',
  body: 'Write 10 to 2,000 characters',
  limit: 'You have reached today\'s posting limit (20 posts); try again tomorrow',
  contact: 'Not posted: remove email addresses and phone numbers. Use an in-app expert request to connect with someone',
  steward_leave: 'Stewards stay members of their community; ask the training manager to hand over first',
  post_not_found: 'Post not found',
  forbidden_moderate: 'Only the community stewards (or the training manager) moderate posts',
  own_post: 'You cannot moderate your own post; another steward reviews it',
  hide_note: 'Give a reason when you hide a post (5 to 300 characters)',
  invalid_decision: 'Unknown decision',
  already: 'This post already has that status',
  skills: 'Choose one to eight skills from the catalogue',
  security_skill: 'Security, safeguards and cyber skills are never listed in the expert finder',
  level_too_low: 'You can list only skills at level 3 or above in your skills passport',
  headline: 'Keep your headline under 140 characters',
  reply: 'Keep your reply under 300 characters',
  expert_not_found: 'Expert not found (they may have hidden their profile)',
  self_request: 'You cannot send an expert request to yourself',
  message: 'Write a message of 10 to 500 characters',
  request_limit: 'You can send up to five expert requests a day',
  request_not_found: 'Request not found',
  forbidden_answer: 'Only the expert who received the request can answer it',
  answered: 'This request has already been answered',
} as const;
/** The refusal message names the category (security, safeguards or cyber) so the audit row records it, never the text. */
export const restrictedMessage = (category: string) =>
  `Not posted: ${category} content is not allowed in communities. Share careers, learning and lessons learned, never plant security, safeguards or cyber details`;

/** Same normalisation in SQL (kafaa_cop_norm): lower case, Arabic diacritics and tatweel removed, letter forms unified, spaces collapsed. */
export function normPost(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}
/**
 * Posting blocker patterns: the G5 Dalil refusal floor (src/modules/m13/dalil/guard.ts, strong patterns) for the categories
 * that must never appear in a community post, plus enabled refusal_policies patterns for the same categories (added at run time).
 */
export const POST_FLOOR: Record<'security' | 'safeguards' | 'cyber', string[]> = {
  security: [
    'security arrangement', 'security arrangements', 'security plan', 'security measures', 'security setup', 'security system', 'security systems', 'perimeter', 'guard post', 'guard posts', 'guards', 'patrol', 'cctv', 'camera', 'cameras', 'weapon', 'armed', 'response force', 'physical protection system',
    'how is the plant protected', 'how is barakah protected', 'protected area', 'vital area', 'drone', 'drones', 'intrusion', 'access control system', 'badge reader', 'sabotage', 'attack the', 'attack on', 'break into', 'get into the plant', 'sneak', 'bypass security', 'security weakness', 'security gaps',
    'الترتيبات الأمنية', 'الإجراءات الأمنية', 'الحراس', 'الحراسة', 'كاميرات', 'السياج', 'الحماية المادية', 'نظام الحماية', 'هجوم', 'تخريب', 'طائرة مسيرة', 'طائرات مسيرة', 'اقتحام', 'التسلل',
  ],
  safeguards: ['nuclear material inventory', 'material accounting', 'material balance', 'enrichment level', 'how much uranium', 'how much plutonium', 'fuel inventory', 'where is the fuel stored', 'spent fuel location', 'where is the spent fuel', 'diversion', 'مخزون المواد النووية', 'كمية اليورانيوم', 'مكان تخزين الوقود'],
  cyber: ['firewall', 'network diagram', 'network architecture', 'scada', 'plc', 'vulnerab', 'password', 'passwords', 'ip address', 'hack', 'hacking', 'exploit', 'malware', 'ransomware', 'data diode bypass', 'جدار الحماية', 'كلمة المرور', 'ثغرة', 'اختراق'],
};
export const GUARD_CATEGORIES = ['security', 'safeguards', 'cyber'] as const;
export interface PolicyLite { category: string; patterns: string[]; enabled: boolean }

/** First blocked category in the text (security, safeguards, cyber), or null. Substring match on normalised text. */
export function postGuard(text: string, policies: PolicyLite[] = []): string | null {
  const n = normPost(text);
  for (const cat of GUARD_CATEGORIES) {
    const extra = policies.filter((p) => p.category === cat && p.enabled).flatMap((p) => p.patterns ?? []);
    for (const pat of [...POST_FLOOR[cat], ...extra]) {
      const q = normPost(pat);
      if (q && n.includes(q)) return cat;
    }
  }
  return null;
}
/** Email addresses and phone numbers (international prefix, or a local number starting with 0). */
export function hasContactDetails(text: string): boolean {
  const s = String(text ?? '');
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) return true;
  const d = s.replace(/[\s()-]/g, '');
  return /(\+|00)[0-9]{8,}/.test(d) || /(^|[^0-9])0[0-9]{8,9}([^0-9]|$)/.test(d);
}

export interface ExpertRow {
  person_id: string;
  name: string;
  name_ar: string;
  role_id: string | null;
  family_id: string | null;
  team_id: string | null;
  headline: string;
  skills: { skill_id: string; level: number; basis: string }[];
}
const BASIS_ORDER: Record<string, number> = { verified: 4, evidenced: 3, validated: 2, claimed: 1 };
/** Rank opted-in experts for a skill (or overall): level, then evidence strength, then breadth; each with reasons. */
export function rankExperts(rows: ExpertRow[], skillId: string | null, label: Label = (id) => ({ en: id, ar: id })): Ranked<ExpertRow>[] {
  const out: Ranked<ExpertRow>[] = [];
  for (const e of rows) {
    const sk = skillId ? e.skills.filter((s) => s.skill_id === skillId) : e.skills;
    if (!sk.length) continue;
    const best = [...sk].sort((a, b) => b.level - a.level || (BASIS_ORDER[b.basis] ?? 0) - (BASIS_ORDER[a.basis] ?? 0))[0];
    const score = best.level * 10 + (BASIS_ORDER[best.basis] ?? 0) + Math.min(e.skills.length, 8) / 10;
    const reasons: Reason[] = [r('expert_level', { skill: label(best.skill_id), level: best.level }, { table: 'skills', id: best.skill_id }), r(`expert_basis_${best.basis}`)];
    if (e.skills.length > 1) reasons.push(r('expert_breadth', { n: e.skills.length }));
    reasons.push(r('expert_optin'));
    out.push({ id: e.person_id, score: Math.round(score * 100) / 100, reasons, item: e });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

/** True when a post is the author's first published post in that community (first posts are held for a steward). */
export function firstPostHeld(isSteward: boolean, publishedBefore: number): boolean {
  return !isSteward && publishedBefore === 0;
}

// ───────────────────────────── F17 · session catalogue search documents (BM25 via the F02 SearchEngine)
export interface SessionLite {
  id: string; topic: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; presenter_role_en: string; presenter_role_ar: string; keywords: string[];
}
export const sessionDoc = (s: SessionLite) => ({
  id: s.id, kind: s.topic,
  title: { en: s.title_en, ar: s.title_ar },
  text: { en: `${s.summary_en} ${s.presenter_role_en}`, ar: `${s.summary_ar} ${s.presenter_role_ar}` },
  keywords: s.keywords ?? [],
});
