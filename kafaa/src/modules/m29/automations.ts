// FS80 Automation and agent gallery with builder credit: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder
// and (mirrored in SQL) supabase/migrations/20261010292001_kafaa_fs92_automation_gallery.sql (kafaa_atm_*). Import-free apart from types
// (node seed and validator scripts load it directly).
//
// Benchmarks: UAE-PEERS (ADNOC AI upskilling and EGA Academy: staff building governed AI tools at work) and AI-LIT (EU AI Act Article 4
// AI-literacy practice repository and UNESCO AI Competency Frameworks: literacy shown by governed use). Kafa'a is not a regulator.
//
//  - An entry (kafaa_automations) is METADATA ONLY: what the automation or agent is for, the data it uses, its accountable owner, the
//    human check on its output, how to use it in plain words, and the AI-system register row (FS36 kafaa_ai_systems) it runs on. There is
//    no code column, no file, no link: text that looks like code, a script, a URL or a credential is refused (automationProblem), and the
//    table carries a `metadata_only` check. Kafa'a never runs an automation.
//  - Lifecycle: draft -> submitted -> approved | returned (edit, submit again) | rejected; approved -> retired. AI governance
//    (ai_literacy A) decides; maker-checker: the builder and the accountable owner never decide their own entry.
//  - Adoption: staff record that they reuse an approved entry (one row per person, never the builder). The counter on the entry is the
//    number of adopters. The FS36 register says which rung the system's users need: an adopter below the entry's minimum FS09 rung is refused.
//  - Builder credit (recorded F01 evidence): only once the entry is approved AND has its first adopter, the builder receives one `ojt`
//    (work) row, basis validated, ref_table automations, on the AI-engineering skill "Automation design" (BUILDER_SKILL): level 2 from
//    the first adopter, level 3 from REUSE_AT adopters. Engineering-track skills never raise the FS09 literacy rung (fluency.ts).
//    Retiring an entry keeps the evidence (the build happened); nothing else ever writes it.
//  - Statistics: adopters by job family and builders are people counts, suppressed under MIN_GROUP_SIZE; security, safeguards and cyber
//    families are never broken out. The per-entry adoption counter is the feature itself (reuse of a tool, not a people aggregate).
import type { Reason } from '../../domain/engines/types';

export const AUTOMATION_KINDS = ['workflow', 'agent', 'template', 'report'] as const;
export const DATA_CLASSES = ['public', 'internal', 'controlled_docs', 'personal'] as const;
export const AUTOMATION_STATUSES = ['draft', 'submitted', 'returned', 'approved', 'rejected', 'retired'] as const;
export const DECISIONS = ['approve', 'return', 'reject', 'retire'] as const;
export const SUBMIT_ACTIONS = ['draft', 'submit'] as const;
/** The AI-engineering skill builder credit goes to (FS02 `sk-fs-ai-automation`, track engineering). */
export const BUILDER_SKILL = 'sk-fs-ai-automation';
/** Adopters from which the builder evidence rises from level 2 to level 3 (validated reuse). */
export const REUSE_AT = 5;
export const BUILDER_LEVEL_FIRST = 2;
export const BUILDER_LEVEL_REUSE = 3;
/** Families never broken out in statistics (security-sensitive content stays out). */
export const HIDDEN_FAMILIES = ['security', 'safeguards', 'cyber'];
export const LIMITS = { title: 120, purpose: 600, data: 400, oversight: 400, benefit: 300, how: 600, note: 400, adopt_note: 200 } as const;

/** Text that would make an entry more than metadata: code, scripts, executable links, credentials (lower-cased substring match, EN and AR).
 *  Same list in SQL (kafaa_atm_code_terms). */
export const CODE_TERMS = [
  'http://', 'https://', 'www.', 'ftp://', 'file://', 'javascript:', 'vbscript:', 'data:text', 'data:application', '<script', '<iframe', '<?php', '```', '#!/',
  'eval(', 'exec(', 'require(', 'import(', 'function(', '=>', '${', '{{', '<%', 'powershell', 'cmd.exe', '.exe', '.ps1', '.bat', '.vbs', '.py', '.js',
  'curl ', 'wget ', 'sudo ', 'insert into', 'macro(',
];
export const SECRET_TERMS = ['password', 'passwd', 'api key', 'apikey', 'api_key', 'secret=', 'token=', 'bearer ', 'كلمة المرور', 'كلمة السر'];
/** Plant-security wording an entry may never touch (same list as the FS37 drills, plus control-system access). */
export const RESTRICTED_TERMS = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code',
  'firewall rule', 'network diagram', 'ip address', 'control system access', 'plant control network'];
/** Kafa'a does not certify (same idea as the FS36 register wording check). */
export const CLAIM_TERMS = ['certified', 'certifies', 'compliant', 'complies with', 'approved by fanr', 'fanr approved', 'licensed by', 'معتمد من', 'ممتثل', 'مرخص من'];

export type AutomationKind = (typeof AUTOMATION_KINDS)[number];
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export type Decision = (typeof DECISIONS)[number];

export interface AutomationInput {
  id?: string | null;
  title_en: string; title_ar: string;
  kind: string;
  purpose_en: string; purpose_ar: string;
  data_used_en: string; data_used_ar: string;
  data_classes: string[];
  system_id: string;
  owner_person_id: string;
  oversight_en: string; oversight_ar: string;
  benefit_en: string; benefit_ar: string;
  how_en: string; how_ar: string;
  min_rung: number;
  /** 'draft' saves; 'submit' sends it to AI governance. */
  action: string;
}
export interface SystemRef { id: string; status: string }
export interface AutomationLite {
  id: string; status: string; builder_person_id: string; owner_person_id: string; system_id: string; min_rung: number;
  adoption_count: number; first_adopted_on?: string | null; builder_level?: number; decided_at?: string | null; family_id?: string | null; kind?: string;
}
export interface AdoptionLite { id: string; automation_id: string; person_id: string; family_id?: string | null; adopted_on: string }

const s = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const textsOf = (i: AutomationInput) => [i.title_en, i.title_ar, i.purpose_en, i.purpose_ar, i.data_used_en, i.data_used_ar, i.oversight_en, i.oversight_ar, i.benefit_en, i.benefit_ar, i.how_en, i.how_ar];
const hit = (texts: unknown[], terms: string[]) => { const all = texts.map((x) => (typeof x === 'string' ? x : '')).join(' \n ').toLowerCase(); return terms.some((w) => all.includes(w)); };
/** True when a text would carry code, a script, a link or a credential (the "metadata only" rule). */
export const looksLikeCode = (text: string) => hit([text], CODE_TERMS);

/** First problem code of a submitted entry, or null (mirror of SQL kafaa_atm_problem). Order matters: both sides return the same first code. */
export function automationProblem(i: AutomationInput, ctx: { systems: SystemRef[]; staff: string[] }): string | null {
  if (!s(i?.title_en, LIMITS.title) || !s(i?.title_ar, LIMITS.title)) return 'title';
  if (!(AUTOMATION_KINDS as readonly string[]).includes(i.kind)) return 'kind';
  if (!s(i.purpose_en, LIMITS.purpose) || !s(i.purpose_ar, LIMITS.purpose)) return 'purpose';
  if (!s(i.data_used_en, LIMITS.data) || !s(i.data_used_ar, LIMITS.data)) return 'data';
  if (!Array.isArray(i.data_classes) || i.data_classes.length < 1 || i.data_classes.length > DATA_CLASSES.length || new Set(i.data_classes).size !== i.data_classes.length
    || i.data_classes.some((c) => !(DATA_CLASSES as readonly string[]).includes(c))) return 'classes';
  const sys = ctx.systems.find((x) => x.id === i.system_id);
  if (!sys) return 'system';
  if (sys.status !== 'published') return 'system_closed';
  if (!ctx.staff.includes(i.owner_person_id)) return 'owner';
  if (!s(i.oversight_en, LIMITS.oversight) || !s(i.oversight_ar, LIMITS.oversight)) return 'oversight';
  if (!s(i.benefit_en, LIMITS.benefit) || !s(i.benefit_ar, LIMITS.benefit)) return 'benefit';
  if (!s(i.how_en, LIMITS.how) || !s(i.how_ar, LIMITS.how)) return 'how';
  if (!Number.isInteger(i.min_rung) || i.min_rung < 1 || i.min_rung > 3) return 'rung';
  if (!(SUBMIT_ACTIONS as readonly string[]).includes(i.action)) return 'action';
  const texts = textsOf(i);
  if (hit(texts, CODE_TERMS)) return 'code';
  if (hit(texts, SECRET_TERMS)) return 'secret';
  if (hit(texts, RESTRICTED_TERMS)) return 'restricted';
  if (hit(texts, CLAIM_TERMS)) return 'claim';
  return null;
}

/** Whether the builder may (still) edit the entry: only their own draft or returned entry. */
export const editable = (status: string) => status === 'draft' || status === 'returned';

/** First refusal of a governance decision, or null (mirror of SQL kafaa_atm_decision_problem). */
export function decisionProblem(a: Pick<AutomationLite, 'status' | 'builder_person_id' | 'owner_person_id'>, decision: string, note: string | null | undefined, decider: string): string | null {
  if (!(DECISIONS as readonly string[]).includes(decision)) return 'decision';
  if (decider === a.builder_person_id || decider === a.owner_person_id) return 'maker_checker';
  if (decision === 'retire' ? a.status !== 'approved' : a.status !== 'submitted') return 'state';
  const n = typeof note === 'string' ? note.trim() : '';
  if (n.length > LIMITS.note) return 'note';
  if (decision !== 'approve' && n.length < 5) return 'note';
  if (hit([n], CODE_TERMS)) return 'code';
  return null;
}
export const STATUS_AFTER: Record<Decision, AutomationStatus> = { approve: 'approved', return: 'returned', reject: 'rejected', retire: 'retired' };

/** First refusal of an adoption, or null (mirror of SQL kafaa_atm_adopt_problem). */
export function adoptProblem(a: Pick<AutomationLite, 'status' | 'builder_person_id' | 'min_rung'>, me: { person_id: string; rung: number }, already: boolean, note?: string | null): string | null {
  if (a.status !== 'approved') return 'not_approved';
  if (a.builder_person_id === me.person_id) return 'own_build';
  if (already) return 'already';
  if (me.rung < Number(a.min_rung)) return 'rung_low';
  const n = typeof note === 'string' ? note.trim() : '';
  if (n.length > LIMITS.adopt_note || hit([n], CODE_TERMS)) return 'note';
  return null;
}

/** Builder evidence level for an entry: 0 until approved and adopted once; 2 from the first adopter; 3 from REUSE_AT adopters.
 *  A retired entry keeps what it earned. Mirror of SQL kafaa_atm_level. */
export function builderLevel(status: string, adopters: number): number {
  if (!(status === 'approved' || status === 'retired') || adopters < 1) return 0;
  return adopters >= REUSE_AT ? BUILDER_LEVEL_REUSE : BUILDER_LEVEL_FIRST;
}
/** F01 evidence id of an entry's builder credit (one row per entry, its level rises in place). */
export const builderEvidenceId = (automationId: string) => `se:ojt:${automationId}:${BUILDER_SKILL}`;

/** Why the builder credit is what it is (WhyThis reasons, keys under m29.atm.why). */
export function creditReasons(a: Pick<AutomationLite, 'id' | 'status' | 'adoption_count' | 'first_adopted_on' | 'decided_at'>): Reason[] {
  const n = Number(a.adoption_count ?? 0);
  const lvl = builderLevel(a.status, n);
  const out: Reason[] = [];
  if (a.status === 'approved' || a.status === 'retired') out.push({ code: 'approved', key: 'm29.atm.why.approved', vars: { date: String(a.decided_at ?? '').slice(0, 10) } });
  else out.push({ code: 'not_approved', key: 'm29.atm.why.notApproved' });
  if (n >= 1) out.push({ code: 'adopted', key: 'm29.atm.why.adopted', vars: { n, date: String(a.first_adopted_on ?? '').slice(0, 10) } });
  else out.push({ code: 'no_adopter', key: 'm29.atm.why.noAdopter' });
  if (lvl > 0) out.push({ code: 'level', key: lvl >= BUILDER_LEVEL_REUSE ? 'm29.atm.why.level3' : 'm29.atm.why.level2', vars: { level: lvl, at: REUSE_AT }, ref: { table: 'skill_evidence', id: builderEvidenceId(a.id) } });
  else out.push({ code: 'none', key: 'm29.atm.why.none' });
  out.push({ code: 'engineering', key: 'm29.atm.why.engineering' });
  return out;
}

export interface GalleryStats {
  entries: Record<string, number>;
  approved: number;
  adoptions: number;
  /** Distinct builders of approved entries (people: suppressed under minGroup). */
  builders: number | null;
  /** Distinct adopters (people: suppressed under minGroup). */
  adopters: number | null;
  credited: number | null;
  families: { family_id: string; adopters: number | null }[];
  systems: { system_id: string; entries: number; adoptions: number }[];
  kinds: { kind: string; entries: number }[];
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Gallery statistics for AI governance (mirror of SQL kafaa_atm_stats_core). Entries are tools (not suppressed); people counts are. */
export function galleryStats(rows: AutomationLite[], adoptions: AdoptionLite[], minGroup: number): GalleryStats {
  const entries: Record<string, number> = Object.fromEntries(AUTOMATION_STATUSES.map((x) => [x, 0]));
  for (const r of rows) entries[r.status] = (entries[r.status] ?? 0) + 1;
  const sup = (n: number) => (n >= minGroup ? n : null);
  const approvedRows = rows.filter((r) => r.status === 'approved' || r.status === 'retired');
  const builders = new Set(rows.filter((r) => r.status === 'approved').map((r) => r.builder_person_id)).size;
  const adopters = new Set(adoptions.map((a) => a.person_id)).size;
  const credited = new Set(approvedRows.filter((r) => builderLevel(r.status, Number(r.adoption_count)) > 0).map((r) => r.builder_person_id)).size;
  const fam = new Map<string, Set<string>>();
  for (const a of adoptions) { const f = a.family_id && !HIDDEN_FAMILIES.includes(a.family_id) ? a.family_id : 'other'; (fam.get(f) ?? fam.set(f, new Set()).get(f)!).add(a.person_id); }
  const families = [...fam.entries()].map(([family_id, set]) => ({ family_id, adopters: sup(set.size) })).sort((a, b) => (a.family_id === 'other' ? 1 : 0) - (b.family_id === 'other' ? 1 : 0) || cmp(a.family_id, b.family_id));
  const sys = new Map<string, { entries: number; adoptions: number }>();
  for (const r of rows.filter((x) => x.status === 'approved')) { const c = sys.get(r.system_id) ?? { entries: 0, adoptions: 0 }; c.entries++; c.adoptions += Number(r.adoption_count); sys.set(r.system_id, c); }
  const systems = [...sys.entries()].map(([system_id, c]) => ({ system_id, ...c })).sort((a, b) => cmp(a.system_id, b.system_id));
  const kinds = AUTOMATION_KINDS.map((k) => ({ kind: k as string, entries: rows.filter((r) => r.status === 'approved' && r.kind === k).length }));
  return { entries, approved: entries.approved, adoptions: adoptions.length, builders: sup(builders), adopters: sup(adopters), credited: sup(credited), families, systems, kinds };
}

/** Gallery order (not a personal ranking): most adopters first, then the newest decision, then the id. */
export function sortGallery<T extends Pick<AutomationLite, 'id' | 'adoption_count' | 'decided_at'>>(rows: T[], by: 'adopted' | 'newest' = 'adopted'): T[] {
  return [...rows].sort((a, b) => (by === 'adopted' ? Number(b.adoption_count) - Number(a.adoption_count) : 0)
    || cmp(String(b.decided_at ?? ''), String(a.decided_at ?? '')) || cmp(a.id, b.id));
}
