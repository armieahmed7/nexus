/**
 * Kafa'a platform access policy: THE single source of truth.
 *
 * - The LocalBackend enforces it in the browser (src/data/local/access.ts).
 * - scripts/gen-policy.mjs renders it into supabase/migrations/0002_kafaa_policy.sql
 *   (table kafaa_policy_matrix + helper functions used by every RLS policy).
 * - scripts/gen-policy.mjs also renders docs/RBAC.md.
 *
 * Source: KAFAA-SPEC-001 Section 7 "Platform access matrix". Kafa'a additions are marked [K].
 * This file must stay dependency-free (no imports) because node scripts import it directly.
 */

export const PLATFORM_ROLES = [
  'public',
  'applicant',
  'employee',
  'licensed_operator',
  'manager',
  'instructor',
  'training_manager', // [K] framework owner + training approvals
  'licensing_coord',
  'hr_analyst',
  'hr_director', // [K] named HR authority (CHCO office): approves observer releases, records HR decisions
  'partner_user',
  'partner_admin',
  'university',
  'observer',
  'editor',
  'ecp_officer', // [K] Employee Concerns Program referral log owner
  'admin',
  'auditor',
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * Access codes (spec Section 7):
 *  R read · Own own records · Scope records in the user's assigned scope · Agg aggregate only ·
 *  W create or edit · A approve or decide · OwnOrg own organisation's records · OrgW write own organisation's records
 */
export const LEVELS = ['R', 'Own', 'Scope', 'Agg', 'W', 'A', 'OwnOrg', 'OrgW'] as const;
export type Level = (typeof LEVELS)[number];

export const RESOURCES = [
  'public_content',
  'own_profile',
  'applications',
  'qual_records',
  'signoff',
  'frameworks',
  'licence',
  'medical_flag',
  'training',
  'secure_items',
  'workforce_analytics',
  'observer_release',
  'partner_org',
  'equivalency',
  'cohorts',
  'dalil_config',
  'users_roles',
  'audit_log',
  'concern_cases', // [K]
  'internal_content', // [K] OE lessons, internal course content, safety-culture learning
  'dev_plans', // [K]
  'research', // [K] proposals and screening
  'talent_content', // [K] vacancies, programme pages, events
  'notifications', // [K]
  'integrations', // [K]
  // F01 (wave 0) [K]: resources for the M17-M27 additional features (BACKLOG.md section 3)
  'skills_profile',
  'opportunities',
  'talent_review',
  'knowledge',
  'learning_analytics',
  'sat',
  'lrs',
  // FS01 (future skills, wave A) [K]: resources for the M28-M37 future-skills features (scratchpad fs/PLAN.md section 2)
  'skills_taxonomy',
  'ai_literacy',
  'transformation',
  'recognition',
  'workforce_strategy',
  'ecosystem',
  'national_alignment',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const RESOURCE_LABELS: Record<Resource, string> = {
  public_content: 'Public pages, directory, Dalil public',
  own_profile: 'Own profile, settings, data rights',
  applications: 'Programme applications',
  qual_records: 'Qualification record',
  signoff: 'Sign off task evaluation or JPM',
  frameworks: 'Qualification standards and frameworks',
  licence: 'Licence tracker (RO/SRO)',
  medical_flag: 'Medical due flag',
  training: 'Training catalogue (internal) and enrolment',
  secure_items: 'Secure exam items',
  workforce_analytics: 'Workforce and Emiratization analytics',
  observer_release: 'Release report to an observer',
  partner_org: 'Partner organisation records',
  equivalency: 'Contractor equivalency',
  cohorts: 'Scholar and intern cohorts',
  dalil_config: 'Dalil configuration, corpus, logs',
  users_roles: 'Users, roles and scopes',
  audit_log: 'Audit log',
  concern_cases: '[K] ECP referral log (no concern text)',
  internal_content: '[K] Internal learning content and OE lessons',
  dev_plans: '[K] Individual development plans',
  research: '[K] Research proposals and screening',
  talent_content: '[K] Vacancies, programme pages and events',
  notifications: '[K] Notifications',
  integrations: '[K] Integrations and sync status',
  skills_profile: '[K] Person skill state, skill evidence and claims (F01)',
  opportunities: '[K] Opportunity marketplace, rotations and alumni reserve',
  talent_review: '[K] Talent review and succession (confidential)',
  knowledge: '[K] Knowledge continuity: KLRA and captured knowledge',
  learning_analytics: '[K] Training effectiveness and needs analytics',
  sat: '[K] SAT analysis and accreditation workbench',
  lrs: '[K] Learning record store (xAPI statements)',
  skills_taxonomy: '[K] Skills taxonomy governance: change proposals, council decisions, public change log (FS54)',
  ai_literacy: '[K] AI and digital fluency: ladder, fitness checks, AI-literacy register, sandbox (FS09/FS10/FS36/FS37/FS80)',
  transformation: '[K] Role transformation: 2030/2035 role profiles, task exposure, transition plans (FS05/FS06/FS11/FS12/FS81)',
  recognition: '[K] Recognition of prior learning, NQF levels, credits and learning balance (FS24/FS29/FS30/FS78/FS79)',
  workforce_strategy: '[K] Workforce strategy and disclosure: critical skills, forecasts, ISO 30414 pack, pilots (FS50/FS51/FS60/FS61)',
  ecosystem: '[K] Skills ecosystem: regional plan, pledges, fellowships, grants, consortium cohorts (FS64-FS69, FS82/FS83)',
  national_alignment: '[K] National-strategy alignment and MoHRE mapping (FS62/FS63)',
};

export const ROLE_LABELS: Record<PlatformRole, { en: string; ar: string; tier: 'public' | 'applicant' | 'staff' | 'elevated' | 'partner' | 'observer' | 'admin' }> = {
  public: { en: 'Public', ar: 'العامة', tier: 'public' },
  applicant: { en: 'Applicant / student', ar: 'متقدّم / طالب', tier: 'applicant' },
  employee: { en: 'Employee / trainee', ar: 'موظف / متدرّب', tier: 'staff' },
  licensed_operator: { en: 'Licensed operator', ar: 'مشغّل مرخّص', tier: 'staff' },
  manager: { en: 'Line manager / shift supervisor', ar: 'مدير مباشر / مشرف وردية', tier: 'elevated' },
  instructor: { en: 'Instructor / evaluator', ar: 'مدرّب / مقيّم', tier: 'elevated' },
  training_manager: { en: 'Training manager', ar: 'مدير التدريب', tier: 'elevated' },
  licensing_coord: { en: 'Licensing coordinator', ar: 'منسّق الترخيص', tier: 'elevated' },
  hr_analyst: { en: 'HR / Emiratization analyst', ar: 'محلل الموارد البشرية والتوطين', tier: 'elevated' },
  hr_director: { en: 'HR authority (CHCO office)', ar: 'سلطة الموارد البشرية (مكتب الرئيس التنفيذي لرأس المال البشري)', tier: 'elevated' },
  partner_user: { en: 'Partner user', ar: 'مستخدم شريك', tier: 'partner' },
  partner_admin: { en: 'Partner admin', ar: 'مسؤول الشريك', tier: 'partner' },
  university: { en: 'University partner', ar: 'شريك جامعي', tier: 'partner' },
  observer: { en: 'Observer (read-only)', ar: 'مراقب (قراءة فقط)', tier: 'observer' },
  editor: { en: 'Content editor', ar: 'محرر المحتوى', tier: 'admin' },
  ecp_officer: { en: 'ECP officer', ar: 'مسؤول برنامج مخاوف الموظفين', tier: 'elevated' },
  admin: { en: 'Platform admin', ar: 'مسؤول المنصة', tier: 'admin' },
  auditor: { en: 'Auditor', ar: 'مدقّق', tier: 'admin' },
};

type Row = Partial<Record<PlatformRole, Level[]>>;
const ALL_SIGNED_IN: PlatformRole[] = PLATFORM_ROLES.filter((r) => r !== 'public') as PlatformRole[];
const STAFF: PlatformRole[] = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin', 'auditor'];
const fill = (roles: PlatformRole[], l: Level[]): Row => Object.fromEntries(roles.map((r) => [r, l])) as Row;

/** The matrix. Missing entries mean "·" (none). Deny by default. */
export const MATRIX: Record<Resource, Row> = {
  public_content: { ...fill(PLATFORM_ROLES as unknown as PlatformRole[], ['R']), editor: ['R', 'W'], admin: ['R', 'A'] },
  own_profile: fill(ALL_SIGNED_IN, ['Own']),
  applications: { applicant: ['Own'], employee: ['Own'], hr_analyst: ['Agg'], hr_director: ['Agg', 'A'], auditor: ['R'] },
  qual_records: {
    employee: ['Own'], licensed_operator: ['Own'], manager: ['Own', 'Scope'], instructor: ['Own', 'Scope'], training_manager: ['Own', 'Scope'],
    licensing_coord: ['Own', 'Scope'], hr_analyst: ['Own', 'Agg'], auditor: ['R'],
  },
  signoff: { instructor: ['A'], training_manager: ['A'] },
  frameworks: {
    public: ['R'], applicant: ['R'], employee: ['R'], licensed_operator: ['R'], manager: ['R'], instructor: ['R', 'W'], training_manager: ['R', 'W'],
    licensing_coord: ['R'], hr_analyst: ['R'], hr_director: ['R'], university: ['R'], admin: ['R', 'A'], auditor: ['R'], editor: ['R'], ecp_officer: ['R'],
  },
  licence: { licensed_operator: ['Own'], manager: ['Scope'], licensing_coord: ['R', 'W'], hr_analyst: ['Agg'], auditor: ['R'] },
  medical_flag: { licensed_operator: ['Own'], licensing_coord: ['Scope'] },
  training: {
    employee: ['Own'], licensed_operator: ['Own'], manager: ['Own', 'A'], instructor: ['Own', 'W'], training_manager: ['Own', 'W', 'A'], licensing_coord: ['Own', 'R'],
    hr_analyst: ['Own', 'R'], partner_user: ['Own'], partner_admin: ['Own', 'OwnOrg'], auditor: ['R'],
  },
  secure_items: { instructor: ['W'], training_manager: ['W', 'A'] },
  workforce_analytics: { manager: ['Agg'], hr_analyst: ['Agg'], hr_director: ['Agg'], observer: ['Agg'], auditor: ['R'] },
  observer_release: { hr_analyst: ['W'], hr_director: ['W', 'A'], admin: ['A'], auditor: ['R'] },
  partner_org: { partner_user: ['OwnOrg'], partner_admin: ['OwnOrg', 'OrgW'], university: ['OwnOrg'], admin: ['R', 'A'], auditor: ['R'] },
  equivalency: { instructor: ['A'], training_manager: ['A'], partner_admin: ['OwnOrg', 'OrgW'], auditor: ['R'] },
  cohorts: { applicant: ['Own'], hr_analyst: ['Scope'], hr_director: ['Scope'], university: ['Scope'], auditor: ['R'] },
  dalil_config: { editor: ['W'], admin: ['A'], auditor: ['R'] },
  users_roles: { partner_admin: ['OwnOrg', 'OrgW'], admin: ['R', 'W'], auditor: ['R'] },
  audit_log: { admin: ['R'], auditor: ['R'] },
  concern_cases: { ecp_officer: ['R', 'A'] },
  internal_content: { ...fill(STAFF, ['R']), editor: ['R', 'W'], training_manager: ['R', 'W'], instructor: ['R', 'W'] },
  dev_plans: { employee: ['Own'], licensed_operator: ['Own'], manager: ['Own', 'Scope', 'A'], training_manager: ['Own', 'Scope'], auditor: ['R'] },
  research: { partner_user: ['OwnOrg', 'OrgW'], partner_admin: ['OwnOrg', 'OrgW'], university: ['OwnOrg', 'OrgW'], admin: ['R', 'A'], auditor: ['R'] },
  talent_content: { ...fill(PLATFORM_ROLES as unknown as PlatformRole[], ['R']), hr_analyst: ['R', 'W'], hr_director: ['R', 'W'], editor: ['R', 'W'], admin: ['R', 'A'] },
  notifications: fill(ALL_SIGNED_IN, ['Own']),
  integrations: { admin: ['R', 'A'], auditor: ['R'] },
  // ── F01 (wave 0). Exact grants from the BACKLOG.md feature cards; row rules live in each table's read rule.
  // skills_profile: every staff role reads its own skill state; managers and instructors their scope; training_manager
  // also A (recompute-all); HR aggregates only. Partners excluded until F33. Auditors read the audit log, not skills.
  skills_profile: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['Own']),
    manager: ['Own', 'Scope'], instructor: ['Own', 'Scope'], training_manager: ['Own', 'Scope', 'A'], hr_analyst: ['Own', 'Agg'], hr_director: ['Own', 'Agg'],
  },
  // opportunities (F08/F15/F23): staff read (Own for their applications); managers and training_manager post (W) and decide (A).
  opportunities: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['R', 'Own']),
    manager: ['R', 'Own', 'W', 'A'], training_manager: ['R', 'Own', 'W', 'A'], hr_analyst: ['R', 'Own', 'Agg'], hr_director: ['R', 'Own', 'Agg', 'A'], auditor: ['R'],
  },
  // talent_review (F18/F19, confidential): managers their own team, HR BP in scope, HR director decides. Employees none; auditor none (audit log only).
  talent_review: { manager: ['Scope'], hr_analyst: ['Scope', 'Agg'], hr_director: ['R', 'A'] },
  // knowledge (F20/F21): captured knowledge readable by staff; KLRA rows must use Scope/Agg/A-only rules (never staff R).
  knowledge: {
    ...fill(STAFF, ['R']), manager: ['R', 'Scope'], training_manager: ['R', 'W', 'A'], instructor: ['R', 'W'], hr_analyst: ['R', 'Agg'], hr_director: ['R', 'Agg'],
  },
  // learning_analytics (F25/F26): learners own L1; managers W on L3 for their team; training_manager decides.
  learning_analytics: {
    employee: ['Own'], licensed_operator: ['Own'], manager: ['Own', 'Agg', 'W'], instructor: ['Own', 'Agg'], training_manager: ['Own', 'Agg', 'W', 'A'],
    hr_analyst: ['Agg'], hr_director: ['Agg'], auditor: ['R'],
  },
  // sat (F27/F29): training staff write; training_manager approves; auditor reads.
  sat: { instructor: ['R', 'W'], training_manager: ['R', 'W', 'A'], auditor: ['R'] },
  // lrs (F30): own statements; instructors and managers in scope; analytics aggregate; writes only through RPCs.
  lrs: {
    employee: ['Own'], licensed_operator: ['Own'], manager: ['Own', 'Scope'], instructor: ['Own', 'Scope'], training_manager: ['Own', 'Scope', 'Agg'],
    hr_analyst: ['Agg'], auditor: ['R'],
  },
  // ── FS01 (future skills, wave A). Grants follow the RBAC lines of the FS cards (PLAN.md); existing roles only, no new role.
  // Caveat (as for knowledge): R/W/A on a resource reads every row of a table whose read rule names it. Tables holding personal
  // rows must use person/org rules (Own/Scope/OwnOrg) or an always-false open_read column, never a bare { res } rule.
  // skills_taxonomy (FS54): everyone reads the public change log; staff propose (W); the skills council decides (A).
  skills_taxonomy: {
    ...fill(PLATFORM_ROLES as unknown as PlatformRole[], ['R']),
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['R', 'W']),
    training_manager: ['R', 'W', 'A'], hr_director: ['R', 'W', 'A'], admin: ['R', 'W', 'A'], auditor: ['R'],
  },
  // ai_literacy (FS09/FS10/FS36/FS37/FS80): my rung and attempts (Own), staff read published registers and the gallery (R);
  // HR aggregates; training_manager writes items; admin (incl. ai-governance) maintains the register and decides (A).
  ai_literacy: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['R', 'Own']),
    hr_analyst: ['R', 'Own', 'Agg'], hr_director: ['R', 'Own', 'Agg'], training_manager: ['R', 'Own', 'W'], admin: ['R', 'Own', 'W', 'A'], auditor: ['R'],
  },
  // transformation (FS05/FS06/FS11/FS12/FS81): staff read role views; managers their team's transition plans; HR aggregates and
  // decides transition plans; training_manager and HR director edit role profiles.
  transformation: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['R', 'Own']),
    manager: ['R', 'Own', 'Scope'], training_manager: ['R', 'Own', 'W'], hr_analyst: ['R', 'Own', 'Agg'], hr_director: ['R', 'Own', 'Agg', 'W', 'A'], auditor: ['R'],
  },
  // recognition (FS24/FS29/FS30/FS78/FS79): I request RPL and see my credits (Own); assessors and the HR authority decide (A);
  // line managers see their team's balance (Scope); HR aggregates; auditors read.
  recognition: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['Own']),
    manager: ['Own', 'Scope'], instructor: ['Own', 'A'], training_manager: ['Own', 'A'], hr_analyst: ['Own', 'Agg'], hr_director: ['Own', 'Agg', 'A'], auditor: ['R'],
  },
  // workforce_strategy (FS50/FS51/FS60/FS61; wave H: FS70 skill signals, FS74 wallet target (A), FS77 intake baselines and induction plans (W)): never public; HR analyst aggregates and drafts; HR director decides; auditors read.
  workforce_strategy: { hr_analyst: ['Agg', 'W'], hr_director: ['Agg', 'W', 'A'], training_manager: ['Agg'], admin: ['R'], auditor: ['R'] },
  // ecosystem (FS64-FS69, FS82, FS83; FS77 uses talent_content R + workforce_strategy W instead, wave-H QA): partners read released aggregates and write their own organisation's commitments;
  // staff apply for grants (Own); HR runs and decides the programmes.
  ecosystem: {
    ...fill(STAFF.filter((r) => r !== 'auditor'), ['R', 'Own']),
    partner_user: ['R', 'OwnOrg'], partner_admin: ['R', 'OwnOrg', 'OrgW'], university: ['R', 'OwnOrg', 'OrgW'],
    hr_analyst: ['R', 'Own', 'Agg', 'W'], hr_director: ['R', 'Own', 'Agg', 'W', 'A'], admin: ['R', 'Own', 'A'], auditor: ['R'],
  },
  // national_alignment (FS62/FS63): staff read; admin and the HR director maintain the mapping.
  national_alignment: {
    ...fill(STAFF, ['R']), hr_analyst: ['R', 'Agg'], hr_director: ['R', 'W'], admin: ['R', 'W', 'A'],
  },
};

/** Grants for a set of roles on a resource. Every caller implicitly holds 'public'. */
export function grantsFor(roles: readonly PlatformRole[], resource: Resource): Set<Level> {
  const out = new Set<Level>();
  const all = roles.includes('public') ? roles : [...roles, 'public' as PlatformRole];
  for (const r of all) for (const l of MATRIX[resource][r] ?? []) out.add(l);
  return out;
}

export function hasAny(roles: readonly PlatformRole[], resource: Resource, levels: readonly Level[]): boolean {
  const g = grantsFor(roles, resource);
  return levels.some((l) => g.has(l));
}

/** Read everything in the resource (R/W/A grant). */
export function canReadAll(roles: readonly PlatformRole[], resource: Resource): boolean {
  return hasAny(roles, resource, ['R', 'W', 'A']);
}
export function canWrite(roles: readonly PlatformRole[], resource: Resource): boolean {
  return hasAny(roles, resource, ['W', 'A']);
}
export function canDecide(roles: readonly PlatformRole[], resource: Resource): boolean {
  return hasAny(roles, resource, ['A']);
}
export function canSeeAggregate(roles: readonly PlatformRole[], resource: Resource): boolean {
  return hasAny(roles, resource, ['Agg', 'R']);
}

/** Minimum group size for aggregate people analytics (spec M07: proposed 10). */
export const MIN_GROUP_SIZE = 10;

/** Spec-level business constants shared by both backends. */
export const RULES = {
  expiryNoticeDays: [90, 60, 30] as const,
  licenceRenewalTaskMonths: 12,
  fanrExamNoticeDays: 60,
  fanrExamReminderDays: 75,
  lapseReportWorkingDays: 3,
  withdrawalAfterYearsNonValid: 2,
  candidateListDaysBeforeStart: 60,
  trainingPlanReportMonths: 6,
  shiftMin8h: 7,
  shiftMin12h: 5,
  sroRoleShiftMin: 2,
  medicalIntervalMonths: 12,
  certificateYears: 5,
  /** A licence mirror older than this is "stale"; the UI must stop showing "valid". */
  staleSyncHours: 72,
  /** UAE weekend for working-day clocks (Saturday, Sunday since 2022). */
  weekendDays: [0, 6] as const,
};

/** Levels one role carries on a resource (no implicit 'public'). Mirrors a kafaa_policy_matrix lookup. */
export function levelsOf(role: PlatformRole, resource: Resource): Level[] {
  return MATRIX[resource][role] ?? [];
}
