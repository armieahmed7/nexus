/**
 * F33 Contractor and supplier skills passport (W5 · E2, M09): pure rules shared by the pages, the LocalBackend RPCs
 * (src/modules/m09/backend/local.ts), the seed builder (scripts/seed/ext/f33-contractor-passport.mjs) and, rule for rule, the SQL in
 * supabase/migrations/20261009152001_kafaa_w5e2_contractor_passport.sql (kafaa_cp_*). PGlite proves SQL = TS
 * (scripts/validate/w5e2-contractor-passport.mjs). Import-free apart from types: node loads this file directly.
 *
 * Kafa'a prepares contractors; ENEC evaluators decide equivalency. A passport, a pre-check or a badge is never a qualification,
 * an equivalency decision or a FANR certification.
 *
 * Evidence written for contractor people (recorded kinds, so F01 recomputes keep them):
 *   se:credential:<certificate>:<skill>     supplier academy certificate (M09 academy), basis evidenced, the F04 course alignment level
 *   se:credential:<equivalency>:<skill>     ENEC equivalency decision "equivalent" on a standard, basis validated, the standard's levels
 *   se:ojt:<engagement>:<skill>             ENEC supervisor sign-off at the end of an engagement (SIMULATED work-history mirror)
 */
import type { BiText, Ranked, Reason } from '../../domain/engines/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export const CP_PERSON_KINDS = ['contractor', 'partner'];
export const CP_ORG_KINDS = ['supplier'];
export const HEADCOUNT_BANDS = ['1-4', '5-9', '10-24', '25+'] as const;
export type HeadcountBand = (typeof HEADCOUNT_BANDS)[number];
export const BAND_MIN: Record<HeadcountBand, number> = { '1-4': 1, '5-9': 5, '10-24': 10, '25+': 25 };
export const RESTRICTED_FAMILIES = ['security', 'cyber', 'safeguards'];
export const CP_REF_TABLES = ['certificates', 'equivalency_requests', 'contractor_engagements'];
export const LEVEL_MAX = 4;
export const SUGGESTION_MAX = 4;
/** Programmes whose courses a contractor can be pointed to for a gap: the supplier academy and ENEC technical initial/continuing
 *  training (never licensed-operator, leadership or security programmes). */
export const GAP_PROGRAMMES = ['supplier-academy', 'get', 'hu-core', 'maint-init', 'maint-cont', 'rp-init', 'rp-cont', 'chem-init', 'chem-cont', 'eng-init', 'eng-cont', 'ero'];

/** Refusal and result messages (same text in SQL). */
export const CPMSG = {
  not_signed_in: 'Sign in first',
  not_found_person: 'Passport not found',
  not_found_standard: 'Qualification standard not found',
  security: "Security qualifications are not handled through equivalency in Kafa'a",
  precheck_ok: 'Pre-check ready. It is guidance only: an ENEC evaluator decides equivalency.',
  target_forbidden: 'Only an ENEC partner administrator may set contracted role profiles',
  target_org: 'Organisation not found among supplier organisations',
  target_role: 'Role not found among published roles',
  target_security: 'Security, cyber and safeguards roles are not contracted through the passport',
  target_band: 'Choose a headcount band: 1-4, 5-9, 10-24 or 25+',
  target_text: 'Contract reference and scope must be 200 characters or fewer',
  target_ok: 'Contracted role profile saved',
  badge_forbidden: 'Only a contractor can wrap their own supplier academy certificate',
  badge_not_found: 'No supplier academy certificate of yours has this number',
  badge_revoked: 'This certificate is revoked: a badge cannot be issued',
  badge_expired: 'This certificate has expired: a badge cannot be issued',
  badge_security: 'Security-related training shows as qualified or not qualified only and is never issued as a badge',
  badge_duplicate: 'You already hold an active badge for this course',
  badge_ok: 'Badge issued and signed',
} as const;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
export const evId = (kind: string, ref: string, skill: string) => `se:${kind}:${ref}:${skill}`;
export const m09r = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m09.reasons.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });

/** The supplier organisation whose contractor passport this person carries, or null (staff, universities, international partners). */
export function contractorOrgOf(person: Row | null | undefined, orgKind: (orgId: string) => string | null | undefined): string | null {
  if (!person || !CP_PERSON_KINDS.includes(person.kind) || !person.org_id) return null;
  return CP_ORG_KINDS.includes(String(orgKind(person.org_id) ?? '')) ? person.org_id : null;
}

export interface SkillLite { id: string; competency_id: string; core: boolean; key_level: number; evidence_keys: string[]; area: string; sort: number; name_en?: string; name_ar?: string; code?: string }
/** Security skills (area security or a security-domain competency) never enter the contractor passport. */
export const securityCompsOf = (comps: Row[]) => new Set(comps.filter((c) => c.domain === 'security').map((c) => c.id as string));
export const isSecuritySkill = (s: Pick<SkillLite, 'area' | 'competency_id'>, sec: Set<string>) => s.area === 'security' || sec.has(s.competency_id);

/** Skills a course evidences: the F04 alignment (kafaa_course_alignment): core skill of each course competency, skills keyed to the course. */
export function courseSkills(course: Row, skills: SkillLite[], sec: Set<string>): { skill_id: string; level: number }[] {
  const cap = course.qualifying ? 2 : 1;
  const comps: string[] = course.competency_ids ?? [];
  return skills
    .filter((s) => !isSecuritySkill(s, sec))
    .map((s) => ({ s, level: Math.max(s.core && comps.includes(s.competency_id) ? cap : 0, (s.evidence_keys ?? []).includes(course.id) ? Math.min(s.key_level, cap) : 0) }))
    .filter((x) => x.level > 0)
    .sort((a, b) => a.s.sort - b.s.sort || cmp(a.s.id, b.s.id))
    .map(({ s, level }) => ({ skill_id: s.id, level }));
}

/** Skills a qualification standard evidences (F01 qualification mapping, cap 4); security standards and skills map to nothing. */
export function standardSkills(std: Row | null | undefined, skills: SkillLite[], roleComps: Row[], sec: Set<string>): { skill_id: string; level: number }[] {
  if (!std || std.security_restricted) return [];
  const req = new Map<string, number>();
  for (const rc of roleComps) if ((std.role_ids ?? []).includes(rc.role_id)) req.set(rc.competency_id, Math.max(req.get(rc.competency_id) ?? 0, Number(rc.required_level)));
  return skills
    .filter((s) => !isSecuritySkill(s, sec))
    .map((s) => ({ s, level: Math.max(s.core && req.has(s.competency_id) ? req.get(s.competency_id)! : 0, (s.evidence_keys ?? []).includes(std.id) ? Math.min(s.key_level, LEVEL_MAX) : 0) }))
    .filter((x) => x.level > 0)
    .sort((a, b) => a.s.sort - b.s.sort || cmp(a.s.id, b.s.id))
    .map(({ s, level }) => ({ skill_id: s.id, level }));
}

export interface CpWorld {
  skills: SkillLite[];
  comps: Row[];
  courses: Row[];
  standards: Row[];
  roleComps: Row[];
  certificates: Row[];
  equivalency: Row[];
  engagements: Row[];
}
export interface CpEvidence {
  id: string; person_id: string; skill_id: string; kind: 'credential' | 'ojt'; ref_table: string; ref_id: string; level: number;
  basis: 'evidenced' | 'validated'; status: 'current' | 'lapsed'; observed_on: string; note: string; active: boolean;
}
/** Evidence the contractor passport holds for one person (sorted by id). Expired or revoked certificates give inactive, lapsed rows. */
export function contractorEvidence(personId: string, w: CpWorld, today: string): CpEvidence[] {
  const sec = securityCompsOf(w.comps);
  const skillOk = new Map(w.skills.filter((s) => !isSecuritySkill(s, sec)).map((s) => [s.id, s]));
  const course = new Map(w.courses.map((c) => [c.id, c]));
  const std = new Map(w.standards.map((s) => [s.id, s]));
  const out = new Map<string, CpEvidence>();
  const put = (e: CpEvidence) => { if (!out.has(e.id)) out.set(e.id, e); };
  for (const c of w.certificates) {
    if (c.person_id !== personId) continue;
    const co = course.get(c.course_id);
    if (!co) continue;
    const live = c.status === 'valid' && (!c.valid_to || d10(c.valid_to)! >= today);
    for (const x of courseSkills(co, w.skills, sec))
      put({ id: evId('credential', c.id, x.skill_id), person_id: personId, skill_id: x.skill_id, kind: 'credential', ref_table: 'certificates', ref_id: c.id, level: x.level, basis: 'evidenced', status: live ? 'current' : 'lapsed', observed_on: d10(c.issued_on)!, note: 'Supplier academy certificate', active: live });
  }
  for (const r of w.equivalency) {
    if (r.person_id !== personId || r.status !== 'equivalent') continue;
    for (const x of standardSkills(std.get(r.standard_id), w.skills, w.roleComps, sec))
      put({ id: evId('credential', r.id, x.skill_id), person_id: personId, skill_id: x.skill_id, kind: 'credential', ref_table: 'equivalency_requests', ref_id: r.id, level: x.level, basis: 'validated', status: 'current', observed_on: d10(r.decided_at ?? r.submitted_at)!, note: 'ENEC equivalency decision', active: true });
  }
  for (const g of w.engagements) {
    if (g.person_id !== personId || g.status !== 'signed_off' || !g.ended_on) continue;
    for (const s of Array.isArray(g.skills) ? g.skills : []) {
      const lvl = Math.trunc(Number(s?.level));
      if (!skillOk.has(s?.skill_id) || !(lvl >= 1)) continue;
      put({ id: evId('ojt', g.id, s.skill_id), person_id: personId, skill_id: s.skill_id, kind: 'ojt', ref_table: 'contractor_engagements', ref_id: g.id, level: Math.min(lvl, LEVEL_MAX), basis: 'evidenced', status: 'current', observed_on: d10(g.ended_on)!, note: 'ENEC engagement sign-off', active: true });
    }
  }
  return [...out.values()].sort((a, b) => cmp(a.id, b.id));
}

// ───────────── equivalency pre-check (read-only; rpc.equivalencyPrecheck = kafaa_cp_precheck_compute)
export type LinkState = 'strong' | 'claimed' | 'near' | 'none';
export type TaskStatus = 'likely' | 'partial' | 'gap';
export type Outlook = 'already_equivalent' | 'likely_equivalent' | 'review' | 'training_likely';
export interface PrecheckLink { skill_id: string; need: number; have: number; basis: string; state: LinkState }
export interface PrecheckTask { task_id: string; critical: boolean; status: TaskStatus; prior: boolean; links: PrecheckLink[]; reasons: Reason[] }
export interface Precheck {
  person_id: string; standard_id: string; total: number; likely: number; partial: number; gaps: number; critical_gaps: number; coverage: number;
  outlook: Outlook; open_request_id: string | null; equivalent_request_id: string | null; prior_request_id: string | null;
  tasks: PrecheckTask[]; suggestions: Ranked[];
}
export interface PrecheckInput {
  person_id: string;
  standard: Row;
  tasks: Row[]; // task_items (any order)
  links: Row[]; // task_skill_links (any order)
  states: Row[]; // person_skills of the person (active rows are used)
  skills: SkillLite[];
  comps: Row[];
  requests: Row[]; // equivalency_requests (any; filtered to the person and standard)
  courses: Row[];
}
const bi = (s: SkillLite | undefined): BiText => ({ en: s?.name_en ?? s?.id ?? '', ar: s?.name_ar ?? s?.id ?? '' });
export function linkState(have: number, basis: string, need: number): LinkState {
  if (have >= need) return basis === 'claimed' ? 'claimed' : 'strong';
  return have > 0 && have === need - 1 ? 'near' : 'none';
}
/** Most recent first: submitted_at desc, then id desc. */
const byRecent = (a: Row, b: Row) => cmp(String(b.submitted_at ?? ''), String(a.submitted_at ?? '')) || cmp(String(b.id), String(a.id));

export function precheck(i: PrecheckInput): Precheck {
  const skillBy = new Map(i.skills.map((s) => [s.id, s]));
  const sec = securityCompsOf(i.comps);
  const stateBy = new Map(i.states.filter((s) => s.active !== false).map((s) => [s.skill_id, s]));
  const reqs = i.requests.filter((r) => r.person_id === i.person_id && r.standard_id === i.standard.id).sort(byRecent);
  const equivalent = reqs.find((r) => r.status === 'equivalent') ?? null;
  const open = reqs.find((r) => r.status === 'submitted' || r.status === 'under_review') ?? null;
  const priorReq = reqs.find((r) => (r.status === 'training_required' || r.status === 'under_review') && (Array.isArray(r.mapping) ? r.mapping : []).some((m: Row) => m?.covered === true)) ?? null;
  const priorCovered = new Set<string>((Array.isArray(priorReq?.mapping) ? priorReq!.mapping : []).filter((m: Row) => m?.covered === true).map((m: Row) => String(m.task_id)));
  const tasks = [...i.tasks].filter((t) => t.standard_id === i.standard.id).sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id));
  const out: PrecheckTask[] = [];
  for (const t of tasks) {
    const links = i.links.filter((l) => l.task_id === t.id && skillBy.has(l.skill_id) && !isSecuritySkill(skillBy.get(l.skill_id)!, sec))
      .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.skill_id, b.skill_id))
      .map((l): PrecheckLink => {
        const st = stateBy.get(l.skill_id);
        const have = Number(st?.level ?? 0);
        const basis = st && have > 0 ? String(st.basis) : 'none';
        return { skill_id: l.skill_id, need: Number(l.need_level), have, basis, state: linkState(have, basis, Number(l.need_level)) };
      });
    const prior = priorCovered.has(t.id);
      const none = links.filter((l) => l.state === 'none').length;
    // likely: an evaluator already mapped it as covered, or the primary skill is held with records and no linked skill is missing
    const status: TaskStatus = prior || (links.length > 0 && links[0].state === 'strong' && none === 0) ? 'likely' : links.some((l) => l.state !== 'none') ? 'partial' : 'gap';
    const reasons: Reason[] = [];
    if (prior) reasons.push(m09r('prior_mapping', { date: d10(priorReq!.decided_at ?? priorReq!.submitted_at)! }, { table: 'equivalency_requests', id: priorReq!.id }));
    for (const l of links) reasons.push(m09r(`link_${l.state}`, { skill: bi(skillBy.get(l.skill_id)), have: l.have, need: l.need }, { table: 'skills', id: l.skill_id }));
    if (!links.length && !prior) reasons.push(m09r('no_link'));
    out.push({ task_id: t.id, critical: t.critical === true, status, prior, links, reasons });
  }
  const total = out.length;
  const likely = out.filter((t) => t.status === 'likely').length;
  const partial = out.filter((t) => t.status === 'partial').length;
  const gaps = total - likely - partial;
  const critical_gaps = out.filter((t) => t.critical && t.status === 'gap').length;
  const coverage = total ? Math.floor(((2 * likely + partial) * 100 + total) / (2 * total)) : 0;
  const outlook: Outlook = equivalent ? 'already_equivalent' : total > 0 && likely === total ? 'likely_equivalent' : critical_gaps > 0 ? 'training_likely' : 'review';
  // Suggestions: courses that evidence the skills behind tasks not yet likely (supplier academy first).
  // weight 2 for a task's primary skill, 1 otherwise (the highest weight a skill gets on any task)
  const gapSkills = new Map<string, number>();
  for (const t of out) if (t.status !== 'likely') t.links.forEach((l, n) => { if (l.state !== 'strong') gapSkills.set(l.skill_id, Math.max(gapSkills.get(l.skill_id) ?? 0, n === 0 ? 2 : 1)); });
  const suggestions: Ranked[] = [];
  for (const c of i.courses) {
    if (!GAP_PROGRAMMES.includes(c.programme_id) || (c.competency_ids ?? []).some((id: string) => sec.has(id))) continue;
    const covers = courseSkills(c, i.skills, sec).filter((x) => gapSkills.has(x.skill_id)).map((x) => x.skill_id);
    if (!covers.length) continue;
    const supplier = c.audience === 'supplier';
    suggestions.push({
      id: c.id,
      score: covers.reduce((a, s) => a + gapSkills.get(s)!, 0) + (supplier ? 0.5 : 0),
      reasons: [m09r(supplier ? 'academy_course' : 'enec_course', { code: { en: String(c.code ?? ''), ar: String(c.code ?? '') } }, { table: 'courses', id: c.id }),
        ...covers.map((s) => m09r('closes_gap', { skill: bi(skillBy.get(s)) }, { table: 'skills', id: s }))],
    });
  }
  suggestions.sort((a, b) => b.score - a.score || cmp(a.id, b.id));
  return {
    person_id: i.person_id, standard_id: i.standard.id, total, likely, partial, gaps, critical_gaps, coverage, outlook,
    open_request_id: open?.id ?? null, equivalent_request_id: equivalent?.id ?? null, prior_request_id: priorReq?.id ?? null,
    tasks: out, suggestions: suggestions.slice(0, SUGGESTION_MAX),
  };
}

/** Evidence items to prefill an equivalency request from the passport (names only; files stay with the supplier). */
export function evidenceFromPassport(certs: Row[], engagements: Row[], courseCode: (id: string) => string): { name: string; kind: string }[] {
  const out: { name: string; kind: string }[] = [];
  for (const c of [...certs].filter((c) => c.status === 'valid').sort((a, b) => cmp(String(a.id), String(b.id)))) out.push({ name: `Supplier academy certificate ${c.id} (${courseCode(c.course_id)})`, kind: 'certificate' });
  for (const g of [...engagements].filter((g) => g.status === 'signed_off').sort((a, b) => cmp(String(a.id), String(b.id)))) out.push({ name: `ENEC engagement sign-off ${g.ref_code}`, kind: 'other' });
  return out.slice(0, 10);
}

// ───────────── contracted role targets (rpc.setContractRoleTarget = kafaa_set_contract_role_target)
export interface TargetInput { org_id: string; role_id: string; headcount_band: string; contract_ref?: string | null; scope_en?: string | null; scope_ar?: string | null; active?: boolean }
export const targetId = (orgId: string, roleId: string) => `crt-${orgId}-${roleId}`;

/**
 * Hand-curated task → skill map for every non-security qualification standard (seeded into task_skill_links). Each task lists the
 * skills that evidence it, primary first, with the level the task needs.
 */
export const TASK_LINKS: Record<string, [string, number][]> = {
  'qs-lo-turbine-t1': [['sk-co-01-rounds', 2], ['sk-co-01', 2]],
  'qs-lo-turbine-t2': [['sk-pf-03-steam', 2], ['sk-co-01', 2]],
  'qs-lo-turbine-t3': [['sk-mp-01-outage', 2], ['sk-hu-01-star', 2]],
  'qs-lo-turbine-t4': [['sk-co-02', 2], ['sk-co-01-rounds', 2]],
  'qs-lo-turbine-t5': [['sk-hu-01', 2], ['sk-co-02', 2]],
  'qs-lo-aux-t1': [['sk-co-01-rounds', 2], ['sk-pf-03-aux', 2]],
  'qs-lo-aux-t2': [['sk-co-01', 2], ['sk-hu-01-star', 2]],
  'qs-lo-aux-t3': [['sk-rp-01', 2]],
  'qs-lo-aux-t4': [['sk-sc-01', 2], ['sk-co-01-rounds', 1]],
  'qs-ro-t1': [['sk-co-03-startup', 3], ['sk-pf-01-core', 2]],
  'qs-ro-t2': [['sk-co-01-eop', 3], ['sk-pf-03-eccs', 3]],
  'qs-ro-t3': [['sk-co-03', 3], ['sk-hu-01', 2]],
  'qs-ro-t4': [['sk-co-02', 3]],
  'qs-ro-t5': [['sk-pf-01', 3], ['sk-pf-02', 3]],
  'qs-sro-t1': [['sk-ld-02-decide', 3], ['sk-co-01-eop', 3]],
  'qs-sro-t2': [['sk-ns-02-techspec', 3]],
  'qs-sro-t3': [['sk-hu-02-brief', 3]],
  'qs-sro-t4': [['sk-ld-02', 3]],
  'qs-mech-t1': [['sk-mp-01-mech', 3], ['sk-mp-01', 2]],
  'qs-mech-t2': [['sk-mp-01-mech', 2]],
  'qs-mech-t3': [['sk-hu-01-star', 2], ['sk-qa-01', 2]],
  'qs-mech-t4': [['sk-mp-01', 2], ['sk-co-01', 2]],
  'qs-elec-t1': [['sk-mp-01-elec', 3], ['sk-mp-02', 2]],
  'qs-elec-t2': [['sk-mp-01-elec', 3], ['sk-hu-01-star', 2]],
  'qs-elec-t3': [['sk-mp-01-elec', 2], ['sk-pf-03-elec', 2]],
  'qs-ic-t1': [['sk-mp-02', 3], ['sk-mp-02-dic', 2]],
  'qs-ic-t2': [['sk-mp-02-dic', 2]],
  'qs-ic-t3': [['sk-mp-02', 2], ['sk-qa-01', 2]],
  'qs-rp-t1': [['sk-rp-02-survey', 3]],
  'qs-rp-t2': [['sk-rp-02', 3]],
  'qs-rp-t3': [['sk-rp-01-dose', 2], ['sk-mp-02', 2]],
  'qs-rp-t4': [['sk-rp-02', 2], ['sk-hu-02-brief', 2]],
  'qs-chem-t1': [['sk-ch-01-primary', 3], ['sk-rp-01', 2]],
  'qs-chem-t2': [['sk-ch-01', 2], ['sk-ch-02-labqa', 2]],
  'qs-chem-t3': [['sk-ch-02-labqa', 2]],
  'qs-eng-t1': [['sk-en-02-perf', 2], ['sk-en-02', 2]],
  'qs-eng-t2': [['sk-en-01-mods', 3], ['sk-en-01', 2]],
  'qs-eng-t3': [['sk-ns-02', 2], ['sk-en-02', 2]],
  'qs-ero-t1': [['sk-ep-01-ero', 2], ['sk-ep-01', 2]],
  'qs-ero-t2': [['sk-ep-02', 2], ['sk-ep-01-ero', 2]],
  'qs-fire-t1': [['sk-ep-02-fire', 3]],
  'qs-fire-t2': [['sk-ep-02-fire', 3], ['sk-ep-02', 2]],
  'qs-instr-t1': [['sk-ld-01-instruct', 2]],
  'qs-instr-t2': [['sk-ld-01-instruct', 3], ['sk-ld-01-coach', 2]],
  'qs-instr-t3': [['sk-ld-01-instruct', 3]],
  'qs-qa-t1': [['sk-qa-01', 3], ['sk-qa-01-inspect', 2]],
  'qs-qa-t2': [['sk-qa-01', 3], ['sk-ld-01', 2]],
  'qs-wc-t1': [['sk-mp-01-outage', 2], ['sk-ns-02-techspec', 2]],
  'qs-wc-t2': [['sk-hu-01-star', 2], ['sk-mp-01-outage', 2]],
  'qs-get-t1': [['sk-sc-01', 1], ['sk-rp-01', 1]],
  'qs-get-t2': [['sk-hu-01', 1], ['sk-hu-01-star', 1]],
};
/** task_skill_links rows from TASK_LINKS (ids `tsl-<task>-<n>`). */
export function taskLinkRows(tasks: Row[]): Row[] {
  const std = new Map(tasks.map((t) => [t.id, t.standard_id]));
  const rows: Row[] = [];
  for (const [task, links] of Object.entries(TASK_LINKS)) {
    if (!std.has(task)) continue;
    links.forEach(([skill, need], n) => rows.push({ id: `tsl-${task}-${n + 1}`, standard_id: std.get(task), task_id: task, skill_id: skill, need_level: need, sort: n + 1 }));
  }
  return rows.sort((a, b) => cmp(a.id, b.id));
}
