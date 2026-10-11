/**
 * FS29 (future skills, wave D · E2, module M34): recognition of prior learning (RPL). Pure and import-free.
 *
 * Flow (ILO RPL: request, evidence, assessor, credit):
 *   open      the person (recognition Own) asks for credit on a skill at a level, or on a current micro-credential, with a short
 *             narrative. An assessor (recognition A) may open a request on behalf of a contractor (F33), who has no Kafa'a grant.
 *   attach    the evidence pack is assembled from the person's own records (rplOptions = SQL kafaa_rpl_options): acknowledged OJT
 *             practice (F38), simulator debriefs (F28), the qualification mirror (qualified or not qualified only), signed-off work
 *             engagements (F08 gigs, F15 rotations, F33 contract engagements), plus supervisor attestations the named supervisor
 *             confirms (attestRpl). Security-restricted items are listed without detail and can never be attached
 *             (`security_restricted`).
 *   submit    at least 2 items, one of them a record (not only attestations).
 *   decide    maker-checker: an assessor recommends full, partial or not-yet credit with a rationale and the notional hours
 *             recognised (maker); a second assessor confirms or returns it (checker). Neither can be the person. On confirmation
 *             credit is written as validated F01 evidence (kind credential, ref_table rpl_requests) and skills are recomputed, an RPL
 *             statement is stored (EN/AR), the credit ledger (FS30) is refreshed and a NEXUS ledger row is written.
 *   export    an NQC-ready pack of the request, evidence and decision for review by NQC-recognised assessors. It names roles, not
 *             assessors, carries initials only, and never uses FANR, licence or certification wording: Kafa'a is not a licensing,
 *             regulatory or awarding authority.
 *
 * SQL mirror (supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql): kafaa_rpl_options = rplOptions, kafaa_rpl_check_open =
 * checkOpen, kafaa_rpl_check_attach = checkAttach, kafaa_rpl_check_submit = checkSubmit, kafaa_rpl_check_decide = checkDecide,
 * kafaa_rpl_statement = rplStatement, kafaa_rpl_pack = buildRplPack, kafaa_rpl_message = RPL_MSG.
 */
export const EVIDENCE_KINDS = ['ojt', 'simulator', 'qualification', 'engagement', 'attestation'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const RECORD_KINDS = ['ojt', 'simulator', 'qualification', 'engagement'] as const;
export const OUTCOMES = ['full', 'partial', 'not_yet'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const STATUSES = ['draft', 'submitted', 'recommended', 'decided', 'withdrawn'] as const;
export type RplStatus = (typeof STATUSES)[number];
export const OPEN_STATUSES = ['draft', 'submitted', 'recommended'];
export const SUBMIT_ACTIONS = ['open', 'attach', 'detach', 'submit', 'withdraw'] as const;
export const DECIDE_ACTIONS = ['recommend', 'confirm', 'return'] as const;
export const MIN_EVIDENCE = 2;
export const MAX_EVIDENCE = 12;
export const NARRATIVE_MIN = 20;
export const NARRATIVE_MAX = 800;
export const RATIONALE_MIN = 20;
export const RATIONALE_MAX = 800;
export const NOTE_MIN = 10;
export const NOTE_MAX = 400;
export const ATTEST_MIN = 20;
export const ATTEST_MAX = 600;
export const HOURS_MAX = 600;
export const LEVEL_NAMES: Record<number, { en: string; ar: string }> = {
  1: { en: 'Awareness', ar: 'إلمام' }, 2: { en: 'Practitioner', ar: 'ممارس' }, 3: { en: 'Independent', ar: 'مستقل' }, 4: { en: 'Expert', ar: 'خبير' },
};
export const KIND_LABEL: Record<EvidenceKind, { en: string; ar: string }> = {
  ojt: { en: 'on-the-job practice', ar: 'الممارسة أثناء العمل' },
  simulator: { en: 'simulator debriefs', ar: 'جلسات استخلاص المحاكي' },
  qualification: { en: 'qualification mirror', ar: 'مرآة سجل التأهيل' },
  engagement: { en: 'work engagements', ar: 'مهام العمل' },
  attestation: { en: 'supervisor attestations', ar: 'إفادات المشرفين' },
};
export const RESTRICTED_TITLE = { en: 'Security-restricted record', ar: 'سجل مقيّد أمنياً' };
export const RESTRICTED_DETAIL = { en: 'Follows the security career path; never part of an RPL pack', ar: 'يتبع المسار المهني الأمني؛ لا يدخل أبداً في حزمة الاعتراف' };
const MODE: Record<string, { en: string; ar: string }> = {
  walkthrough: { en: 'Walkthrough', ar: 'جولة شرح' }, simulate: { en: 'Simulated', ar: 'محاكاة' }, perform: { en: 'Performed', ar: 'أداء فعلي' },
};
const POSITION: Record<string, { en: string; ar: string }> = {
  ss: { en: 'Shift supervisor', ar: 'مشرف الوردية' }, sro: { en: 'Senior reactor operator', ar: 'مشغّل مفاعل أول' }, ro: { en: 'Reactor operator', ar: 'مشغّل مفاعل' },
  sta: { en: 'Shift technical advisor', ar: 'مستشار الوردية الفني' }, lo: { en: 'Local operator', ar: 'مشغّل محلي' },
};
const CATEGORY: Record<string, { en: string; ar: string }> = {
  normal: { en: 'normal', ar: 'عادي' }, abnormal: { en: 'abnormal', ar: 'غير اعتيادي' }, emergency: { en: 'emergency', ar: 'طوارئ' }, severe_accident: { en: 'severe accident', ar: 'حادث جسيم' },
};
const OPP_KIND: Record<string, { en: string; ar: string }> = {
  project: { en: 'Project', ar: 'مشروع' }, outage_support: { en: 'Outage support', ar: 'دعم الانقطاع' }, shadowing: { en: 'Shadowing', ar: 'مرافقة' },
  oe_review: { en: 'Operating experience review', ar: 'مراجعة الخبرة التشغيلية' }, knowledge_capture: { en: 'Knowledge capture', ar: 'توثيق المعرفة' },
  outreach: { en: 'Outreach', ar: 'تواصل' }, research: { en: 'Research', ar: 'بحث' },
};
const QUALIFIED = ['qualified', 'renewed', 'due'];
const MIRROR_STATUSES = ['qualified', 'renewed', 'due', 'expired', 'suspended'];

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const s = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const isInt = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.trunc(v) === v;
const d10 = (v: unknown) => (v == null || v === '' ? null : String(v).slice(0, 10));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const uniqSorted = (xs: string[]) => [...new Set(xs)].sort(cmp);
export const requestId = (person: string, n: number) => `rpl-${person}-${String(n).padStart(2, '0')}`;
export const evidenceRowId = (request: string, n: number) => `rpe-${request}-${String(n).padStart(2, '0')}`;
export const rplEvidenceId = (request: string, skill: string) => `se:rpl:${request}:${skill}`;

// ───────────── Evidence options (rplOptions = SQL kafaa_rpl_options)
export interface RplOption {
  kind: Exclude<EvidenceKind, 'attestation'>;
  ref_table: string;
  ref_id: string;
  title_en: string;
  title_ar: string;
  detail_en: string;
  detail_ar: string;
  observed_on: string | null;
  mirror: boolean;
  mirror_status: 'qualified' | 'not_qualified' | null;
  skill_ids: string[];
  restricted: boolean;
}
export interface OptionWorld {
  ojt_logs: Row[]; task_items: Row[]; qual_standards: Row[]; crew_debrief_members: Row[]; sim_scenarios: Row[]; competencies: Row[];
  qual_records: Row[]; skill_evidence: Row[]; opportunity_applications: Row[]; opportunities: Row[]; rotation_placements: Row[];
  contractor_engagements: Row[]; job_roles: Row[]; skills: Row[];
}
const KIND_RANK: Record<string, number> = { ojt: 1, simulator: 2, qualification: 3, engagement: 4 };
export function rplOptions(person: string, w: OptionWorld): RplOption[] {
  const skills = new Map(w.skills.map((k) => [k.id as string, k]));
  const okSkill = (id: string) => { const k = skills.get(id); return !!k && k.area !== 'security'; };
  const std = new Map(w.qual_standards.map((x) => [x.id as string, x]));
  const task = new Map(w.task_items.map((x) => [x.id as string, x]));
  const scen = new Map(w.sim_scenarios.map((x) => [x.id as string, x]));
  const secComp = new Set(w.competencies.filter((c) => c.domain === 'security').map((c) => String(c.id)));
  const roles = new Map(w.job_roles.map((r) => [r.id as string, r]));
  const opps = new Map(w.opportunities.map((o) => [o.id as string, o]));
  const out: RplOption[] = [];
  const push = (o: Omit<RplOption, 'title_en' | 'title_ar' | 'detail_en' | 'detail_ar' | 'skill_ids'> & { title: { en: string; ar: string }; detail: { en: string; ar: string }; skill_ids: string[] }) => {
    const r = o.restricted;
    out.push({
      kind: o.kind, ref_table: o.ref_table, ref_id: o.ref_id, title_en: r ? RESTRICTED_TITLE.en : o.title.en, title_ar: r ? RESTRICTED_TITLE.ar : o.title.ar,
      detail_en: r ? RESTRICTED_DETAIL.en : o.detail.en, detail_ar: r ? RESTRICTED_DETAIL.ar : o.detail.ar, observed_on: o.observed_on, mirror: o.mirror,
      mirror_status: r ? null : o.mirror_status, skill_ids: r ? [] : uniqSorted(o.skill_ids.filter(okSkill)), restricted: r,
    });
  };
  for (const l of w.ojt_logs) {
    if (l.person_id !== person || l.status !== 'acknowledged') continue;
    const t = task.get(l.task_id);
    const st = std.get(l.standard_id);
    const m = MODE[l.mode] ?? { en: String(l.mode), ar: String(l.mode) };
    push({
      kind: 'ojt', ref_table: 'ojt_logs', ref_id: l.id, observed_on: d10(l.on_date), mirror: false, mirror_status: null, restricted: !!st?.security_restricted,
      title: { en: String(t?.statement_en ?? l.task_id), ar: String(t?.statement_ar || t?.statement_en || l.task_id) },
      detail: { en: `${m.en} · acknowledged by the preceptor`, ar: `${m.ar} · أقرّها الموجّه` },
      skill_ids: w.skills.filter((k) => (k.evidence_keys ?? []).includes(l.task_id) || (k.evidence_keys ?? []).includes(l.standard_id)).map((k) => k.id),
    });
  }
  for (const mem of w.crew_debrief_members) {
    if (mem.person_id !== person || !mem.present) continue;
    const sc = scen.get(mem.scenario_id);
    const comps: string[] = (sc?.competency_ids ?? []).map(String);
    const p = POSITION[mem.position] ?? { en: String(mem.position), ar: String(mem.position) };
    const c = CATEGORY[sc?.category] ?? { en: String(sc?.category ?? ''), ar: String(sc?.category ?? '') };
    push({
      kind: 'simulator', ref_table: 'crew_debrief_members', ref_id: mem.id, observed_on: d10(mem.held_on), mirror: false, mirror_status: null, restricted: comps.some((x) => secComp.has(x)),
      title: { en: String(sc?.title_en ?? mem.scenario_id), ar: String(sc?.title_ar ?? mem.scenario_id) },
      detail: { en: `${p.en} · ${c.en} scenario · instructor debrief`, ar: `${p.ar} · سيناريو ${c.ar} · استخلاص مع المدرّب` },
      skill_ids: w.skills.filter((k) => k.core && comps.includes(String(k.competency_id))).map((k) => k.id),
    });
  }
  for (const q of w.qual_records) {
    if (q.person_id !== person || !MIRROR_STATUSES.includes(q.status)) continue;
    const st = std.get(q.standard_id);
    const ok = QUALIFIED.includes(q.status);
    push({
      kind: 'qualification', ref_table: 'qual_records', ref_id: q.id, observed_on: d10(q.qualified_on) ?? d10(q.last_synced), mirror: true,
      mirror_status: ok ? 'qualified' : 'not_qualified', restricted: !!st?.security_restricted || !!q.security_mirror_only,
      title: { en: String(st?.title_en ?? q.standard_id), ar: String(st?.title_ar ?? q.standard_id) },
      detail: ok ? { en: 'Mirror of the licensee record: qualified', ar: 'مرآة سجل جهة التشغيل: مؤهَّل' } : { en: 'Mirror of the licensee record: not qualified', ar: 'مرآة سجل جهة التشغيل: غير مؤهَّل' },
      skill_ids: w.skill_evidence.filter((e) => e.ref_table === 'qual_records' && e.ref_id === q.id && e.active !== false).map((e) => e.skill_id),
    });
  }
  for (const a of w.opportunity_applications) {
    if (a.person_id !== person || a.status !== 'completed') continue;
    const o = opps.get(a.opportunity_id);
    const gained: string[] = (o?.skills_gained ?? []).map(String);
    const k = OPP_KIND[o?.kind] ?? { en: 'Gig', ar: 'مهمة' };
    push({
      kind: 'engagement', ref_table: 'opportunity_applications', ref_id: a.id, observed_on: d10(a.completed_at), mirror: false, mirror_status: null,
      restricted: gained.some((x) => skills.get(x)?.area === 'security'),
      title: { en: String(o?.title_en ?? a.opportunity_id), ar: String(o?.title_ar ?? a.opportunity_id) },
      detail: { en: `${k.en} gig · completed and signed off`, ar: `مهمة ${k.ar} · مكتملة ومعتمدة` }, skill_ids: gained,
    });
  }
  for (const r of w.rotation_placements) {
    if (r.person_id !== person || r.status !== 'signed_off') continue;
    push({
      kind: 'engagement', ref_table: 'rotation_placements', ref_id: r.id, observed_on: d10(r.ends_on), mirror: false, mirror_status: null,
      restricted: !!(r.host_role_id && roles.get(r.host_role_id)?.security_sensitive),
      title: { en: String(r.host_team_en), ar: String(r.host_team_ar) },
      detail: { en: 'Rotation placement · signed off by the host', ar: 'تدوير وظيفي · اعتمده المضيف' },
      skill_ids: (Array.isArray(r.objectives) ? r.objectives : []).map((o: Row) => String(o?.skill_id ?? '')),
    });
  }
  for (const e of w.contractor_engagements) {
    if (e.person_id !== person || e.status !== 'signed_off') continue;
    push({
      kind: 'engagement', ref_table: 'contractor_engagements', ref_id: e.id, observed_on: d10(e.ended_on), mirror: true, mirror_status: null,
      restricted: !!(e.role_id && roles.get(e.role_id)?.security_sensitive),
      title: { en: String(e.title_en), ar: String(e.title_ar) },
      detail: { en: `Contract engagement ${e.ref_code} · signed off (mirror)`, ar: `مهمة تعاقدية ${e.ref_code} · معتمدة (مرآة)` },
      skill_ids: (Array.isArray(e.skills) ? e.skills : []).map((x: Row) => String(x?.skill_id ?? '')),
    });
  }
  return out.sort((a, b) => (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || (a.observed_on === b.observed_on ? 0 : a.observed_on == null ? 1 : b.observed_on == null ? -1 : a.observed_on > b.observed_on ? -1 : 1) || cmp(a.ref_table, b.ref_table) || cmp(a.ref_id, b.ref_id));
}

// ───────────── submitRpl checks
export interface OpenInput { person_id?: unknown; target_kind?: unknown; skill_id?: unknown; microcred_def_id?: unknown; level?: unknown; narrative_en?: unknown; narrative_ar?: unknown }
export interface OpenCtx {
  me: string;
  /** The caller holds recognition A (an assessor). */
  assessor: boolean;
  /** The caller holds recognition Own (staff). */
  own: boolean;
  person: { id: string; kind: string; status: string } | null;
  skill: { id: string; area: string; fs_area?: string | null; lifecycle?: string | null } | null;
  /** FS23 range of the skill, when one is published. */
  range: { min_level: number; max_level: number } | null;
  def: { id: string; status: string; restricted: boolean } | null;
  /** The person already holds the target (skill at the level with verified or evidenced basis; the micro-credential awarded). */
  held: boolean;
  /** An open request (draft, submitted, recommended) exists for the same person and target. */
  open: boolean;
}
export type OpenCode = 'ok' | 'forbidden' | 'person' | 'behalf' | 'target' | 'skill' | 'restricted' | 'obsolete' | 'level' | 'credential' | 'held' | 'conflict' | 'narrative';
/** checkOpen(): 'ok' or the first failing code (same order as SQL kafaa_rpl_check_open). */
export function checkOpen(input: OpenInput, ctx: OpenCtx): OpenCode {
  const pid = s(input.person_id) || ctx.me;
  const behalf = pid !== ctx.me;
  if (behalf ? !ctx.assessor : !ctx.own) return 'forbidden';
  const p = ctx.person;
  if (!p || p.status !== 'active' || (p.kind !== 'staff' && p.kind !== 'contractor')) return 'person';
  if (behalf && p.kind !== 'contractor') return 'behalf';
  const tk = s(input.target_kind);
  if (tk !== 'skill' && tk !== 'credential') return 'target';
  if (tk === 'skill') {
    const k = ctx.skill;
    if (!k) return 'skill';
    if (k.area === 'security' || k.fs_area === 'cyber_hygiene') return 'restricted';
    if (k.lifecycle === 'obsolete') return 'obsolete';
    if (!isInt(input.level) || (input.level as number) < 1 || (input.level as number) > 4) return 'level';
    if (ctx.range && ((input.level as number) < ctx.range.min_level || (input.level as number) > ctx.range.max_level)) return 'level';
  } else {
    const d = ctx.def;
    if (!d || d.status !== 'current') return 'credential';
    if (d.restricted) return 'restricted';
  }
  if (ctx.held) return 'held';
  if (ctx.open) return 'conflict';
  const en = s(input.narrative_en);
  const ar = s(input.narrative_ar);
  if (en.length < NARRATIVE_MIN || en.length > NARRATIVE_MAX || ar.length > NARRATIVE_MAX || (ar.length > 0 && ar.length < NARRATIVE_MIN)) return 'narrative';
  return 'ok';
}

export interface AttachInput { kind?: unknown; ref_table?: unknown; ref_id?: unknown; attester_id?: unknown; note?: unknown }
export interface AttachCtx {
  /** Number of active evidence rows already on the request. */
  count: number;
  option: RplOption | null;
  /** An active row with the same ref (or the same attester) is already attached. */
  duplicate: boolean;
  attester: { id: string; kind: string; status: string } | null;
  person: string;
  opener: string;
}
export type AttachCode = 'ok' | 'limit' | 'kind' | 'item' | 'security_restricted' | 'duplicate' | 'attester' | 'note';
/** checkAttach(): request state and ownership are checked first by the RPC (see stateFor); same order as SQL kafaa_rpl_check_attach. */
export function checkAttach(input: AttachInput, ctx: AttachCtx): AttachCode {
  if (ctx.count >= MAX_EVIDENCE) return 'limit';
  const k = s(input.kind);
  if (!(EVIDENCE_KINDS as readonly string[]).includes(k)) return 'kind';
  if (k === 'attestation') {
    const a = ctx.attester;
    if (!a || a.kind !== 'staff' || a.status !== 'active' || a.id === ctx.person || a.id === ctx.opener) return 'attester';
    if (ctx.duplicate) return 'duplicate';
    const n = s(input.note);
    if (n.length < NOTE_MIN || n.length > NOTE_MAX) return 'note';
    return 'ok';
  }
  const o = ctx.option;
  if (!o || o.kind !== k) return 'item';
  if (o.restricted) return 'security_restricted';
  if (ctx.duplicate) return 'duplicate';
  return 'ok';
}
export interface SubmitEvidence { kind: string; active: boolean; attestation_status?: string | null }
export type SubmitCode = 'ok' | 'too_few' | 'records';
export function checkSubmit(evidence: SubmitEvidence[]): SubmitCode {
  const act = evidence.filter((e) => e.active && !(e.kind === 'attestation' && e.attestation_status === 'declined'));
  if (act.length < MIN_EVIDENCE) return 'too_few';
  if (!act.some((e) => e.kind !== 'attestation')) return 'records';
  return 'ok';
}

// ───────────── attestRpl
export type AttestCode = 'ok' | 'not_found' | 'not_attester' | 'state' | 'text';
export function checkAttest(input: { confirm?: unknown; text_en?: unknown; text_ar?: unknown }, row: { kind: string; attester_id?: string | null; attestation_status?: string | null; active: boolean } | null, reqStatus: string | null, me: string): AttestCode {
  if (!row || row.kind !== 'attestation' || !row.active) return 'not_found';
  if (row.attester_id !== me) return 'not_attester';
  if (row.attestation_status !== 'requested' || !reqStatus || !OPEN_STATUSES.includes(reqStatus)) return 'state';
  const en = s(input.text_en);
  const ar = s(input.text_ar);
  if (input.confirm === true) {
    if (en.length < ATTEST_MIN || en.length > ATTEST_MAX || ar.length > ATTEST_MAX || (ar.length > 0 && ar.length < ATTEST_MIN)) return 'text';
  } else if (en.length < NOTE_MIN || en.length > NOTE_MAX) return 'text';
  return 'ok';
}

// ───────────── decideRpl (maker-checker)
export interface DecideInput { action?: unknown; outcome?: unknown; credited_level?: unknown; hours?: unknown; rationale_en?: unknown; rationale_ar?: unknown; note?: unknown }
export interface DecideRow { status: string; person_id: string; opened_by: string; recommended_by?: string | null; target_kind: string; level?: number | null }
export type DecideCode = 'ok' | 'action' | 'state' | 'self' | 'maker_checker' | 'outcome' | 'level' | 'hours' | 'rationale' | 'note';
/** checkDecide(): for a request row and an assessor caller (recognition A checked by the RPC first); same order as SQL kafaa_rpl_check_decide. */
export function checkDecide(input: DecideInput, row: DecideRow, me: string, maxAlign = 0): DecideCode {
  const a = s(input.action);
  if (!(DECIDE_ACTIONS as readonly string[]).includes(a)) return 'action';
  if (a === 'recommend' ? row.status !== 'submitted' : row.status !== 'recommended') return 'state';
  if (row.person_id === me) return 'self';
  if (a !== 'recommend' && row.recommended_by === me) return 'maker_checker';
  if (a === 'return') {
    const n = s(input.note);
    return n.length < NOTE_MIN || n.length > NOTE_MAX ? 'note' : 'ok';
  }
  if (a === 'confirm') return 'ok';
  const o = s(input.outcome);
  if (!(OUTCOMES as readonly string[]).includes(o)) return 'outcome';
  const cl = input.credited_level;
  if (row.target_kind === 'skill') {
    const want = Number(row.level ?? 0);
    if (o === 'full' && !(isInt(cl) && cl === want)) return 'level';
    if (o === 'partial' && !(isInt(cl) && (cl as number) >= 1 && (cl as number) < want)) return 'level';
    if (o === 'not_yet' && cl != null) return 'level';
  } else {
    if (cl != null) return 'level';
    if (o === 'partial' && maxAlign < 2) return 'level';
  }
  const h = input.hours;
  if (!isInt(h) || (h as number) < 0 || (h as number) > HOURS_MAX || (o === 'not_yet' ? h !== 0 : (h as number) < 1)) return 'hours';
  const en = s(input.rationale_en);
  const ar = s(input.rationale_ar);
  if (en.length < RATIONALE_MIN || ar.length < RATIONALE_MIN || en.length > RATIONALE_MAX || ar.length > RATIONALE_MAX) return 'rationale';
  return 'ok';
}

/** Skills and levels credited on confirmation: the skill at the credited level, or the credential's alignment (full) / one level
 *  lower where that is at least 1 (partial). Not-yet credits nothing. */
export function creditedSkills(row: { outcome?: string | null; target_kind: string; skill_id?: string | null; credited_level?: number | null }, alignment: { skill_id: string; level: number }[]): { skill_id: string; level: number }[] {
  if (row.outcome !== 'full' && row.outcome !== 'partial') return [];
  if (row.target_kind === 'skill') return row.skill_id && row.credited_level ? [{ skill_id: row.skill_id, level: Number(row.credited_level) }] : [];
  const out = alignment.map((a) => ({ skill_id: a.skill_id, level: row.outcome === 'full' ? Number(a.level) : Number(a.level) - 1 })).filter((a) => a.level >= 1);
  return out.sort((x, y) => cmp(x.skill_id, y.skill_id));
}

export const RPL_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to work on recognition of prior learning',
  forbidden: 'Staff open their own RPL requests; assessors open requests on behalf of contractors',
  forbidden_assessor: 'Only RPL assessors (instructors, the training manager and the HR director) recommend or confirm credit',
  forbidden_export: 'Only the person and RPL assessors or auditors can export an RPL pack',
  action: 'Choose a valid action',
  person: 'Choose an active member of staff or contractor',
  behalf: 'Assessors open requests on behalf of contractors only; staff open their own',
  target: 'Choose a skill or a micro-credential',
  skill: 'Skill not found',
  restricted: 'Security and cyber-hygiene skills are not recognised individually: they follow the security career path',
  obsolete: 'This skill is obsolete',
  level: 'Choose a level from 1 to 4 where the skill exists',
  credential: 'Choose a current micro-credential',
  held: 'You already hold this at that level: nothing to recognise',
  conflict: 'There is already an open RPL request for this',
  narrative: 'Describe your experience in English (20 to 800 characters); Arabic is optional (20 to 800)',
  not_found: 'Request or evidence item not found',
  owner: 'Only the person who opened the request can change it',
  state: 'This request is not in a state that allows that action',
  limit: 'An evidence pack holds at most 12 items',
  kind: 'Choose an evidence type from the list',
  item: 'That record is not one of your attachable records',
  security_restricted: 'Security-restricted records cannot be attached to an RPL pack',
  duplicate: 'That item is already in the pack',
  attester: 'Choose an active member of staff other than yourself (and other than the assessor who opened the request)',
  note: 'Give a note of 10 to 400 characters',
  too_few: 'Attach at least 2 evidence items before submitting',
  records: 'Attach at least one record (practice, simulator, qualification or engagement), not only attestations',
  not_attester: 'Only the named supervisor can answer this attestation',
  text: 'Write the attestation in English (20 to 600 characters; Arabic optional) or a decline note of 10 to 400 characters',
  self: 'Nobody decides their own RPL request',
  maker_checker: 'The assessor who recommended this cannot confirm or return it: a second assessor is needed',
  outcome: 'Choose full, partial or not-yet credit',
  level_decide: 'Full credit is at the requested level; partial credit is a lower level; not-yet credits no level',
  hours: 'Give the recognised notional hours as a whole number (1 to 600; 0 for not yet)',
  rationale: 'Write the rationale in English and Arabic (20 to 800 characters each)',
};
/** Message key for a check code (decide 'level' has its own text). */
export const rplMsgKey = (code: string, decide = false) => (decide && code === 'level' ? 'level_decide' : code);
export const rplResultCode = (c: string): string =>
  ({ forbidden: 'forbidden', behalf: 'forbidden', skill: 'not_found', credential: 'not_found', not_found: 'not_found', item: 'not_found', owner: 'forbidden', not_attester: 'forbidden',
    restricted: 'security_restricted', security_restricted: 'security_restricted', obsolete: 'obsolete', held: 'not_eligible', conflict: 'conflict', duplicate: 'conflict',
    self: 'maker_checker', maker_checker: 'maker_checker', limit: 'limit', state: 'invalid' } as Record<string, string>)[c] ?? 'invalid';

// ───────────── RPL statement (rplStatement = SQL kafaa_rpl_statement)
export interface StatementRow { id: string; outcome: string; credited_level?: number | null; hours: number; nqf_level?: number | null; target_title_en: string; target_title_ar: string; decided_on: string }
/** Counted evidence: active rows, attestations only when confirmed. */
export const countedEvidence = <T extends { kind: string; active: boolean; attestation_status?: string | null }>(ev: T[]) => ev.filter((e) => e.active && (e.kind !== 'attestation' || e.attestation_status === 'confirmed'));
export function rplStatement(r: StatementRow, evidence: { kind: string; active: boolean; attestation_status?: string | null }[]): { en: string; ar: string } {
  const ev = countedEvidence(evidence);
  const kinds = EVIDENCE_KINDS.filter((k) => ev.some((e) => e.kind === k));
  const kEn = kinds.map((k) => KIND_LABEL[k].en).join(', ');
  const kAr = kinds.map((k) => KIND_LABEL[k].ar).join('، ');
  const n = ev.length;
  const date = String(r.decided_on).slice(0, 10);
  const h = Math.max(0, Math.trunc(Number(r.hours) || 0));
  const cr = `${Math.trunc(h / 10)}.${h % 10}`;
  const tail = { en: "Kafa'a is not a regulatory or awarding authority.", ar: 'كفاءة ليست جهة تنظيمية أو مانحة للمؤهلات.' };
  if (r.outcome === 'not_yet') {
    return {
      en: `Recognition of prior learning (internal record ${r.id}): not yet credited for ${r.target_title_en}; ${n} evidence items (${kEn}) were reviewed by two assessors on ${date}. The rationale names what to add. ${tail.en}`,
      ar: `الاعتراف بالتعلم السابق (سجل داخلي ${r.id}): لم يُعتمد بعد في ${r.target_title_ar}؛ راجع مقيّمان اثنان ${n} من عناصر الأدلة (${kAr}) بتاريخ ${date}. يوضح المبرر ما ينبغي إضافته. ${tail.ar}`,
    };
  }
  const l = r.credited_level ? Number(r.credited_level) : null;
  const lvEn = l ? ` at level ${l} (${LEVEL_NAMES[l].en})` : '';
  const lvAr = l ? ` بالمستوى ${l} (${LEVEL_NAMES[l].ar})` : '';
  const nqfEn = r.nqf_level ? `NQF level ${r.nqf_level}, ` : '';
  const nqfAr = r.nqf_level ? `المستوى ${r.nqf_level} في الإطار الوطني للمؤهلات، ` : '';
  return {
    en: `Recognition of prior learning (internal record ${r.id}): ${r.outcome === 'full' ? 'full credit' : 'partial credit'} for ${r.target_title_en}${lvEn}, assessed on ${n} evidence items (${kEn}) and decided by two assessors on ${date}. Indicative: ${nqfEn}${cr} credits; indicative until agreed with the NQC and the partner. ${tail.en}`,
    ar: `الاعتراف بالتعلم السابق (سجل داخلي ${r.id}): ${r.outcome === 'full' ? 'اعتراف كامل' : 'اعتراف جزئي'} في ${r.target_title_ar}${lvAr}، بناءً على ${n} من عناصر الأدلة (${kAr}) وبقرار من مقيّمَين اثنين بتاريخ ${date}. إرشادي: ${nqfAr}${cr} رصيد؛ إرشادي إلى حين الاتفاق مع المركز الوطني للمؤهلات والشريك. ${tail.ar}`,
  };
}

// ───────────── NQC-ready export pack (buildRplPack = SQL kafaa_rpl_pack)
export const PACK_FORMAT = 'kafaa-rpl-pack/1';
export const PACK_NOTICE = {
  en: "Prepared by Kafa'a, a concept skills platform, for review by assessors recognised by the National Qualifications Centre (NQC). Kafa'a is not a regulatory or awarding authority; NQF levels and credits are indicative until agreed with the NQC and the partner. Qualification entries mirror the licensee's records as qualified or not qualified only. Synthetic demo data.",
  ar: 'أعدّتها كفاءة، وهي منصة مهارات تجريبية، لمراجعة مقيّمين معترف بهم من المركز الوطني للمؤهلات. كفاءة ليست جهة تنظيمية أو مانحة للمؤهلات؛ ومستويات الإطار الوطني والأرصدة إرشادية إلى حين الاتفاق مع المركز والشريك. تعكس بنود التأهيل سجلات جهة التشغيل بصفة مؤهَّل أو غير مؤهَّل فقط. بيانات تجريبية اصطناعية.',
};
export const PACK_FRAMEWORKS = [
  { id: 'UAE-NQF', url: 'https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses' },
  { id: 'ILO-RPL', url: 'https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning' },
];
/** No FANR wording in an export: a parenthesis naming FANR is dropped, any other mention reads "the regulator" (SQL kafaa_rpl_mask). */
export const maskFanr = (text: string) => text
  .replace(/\s*\([^)"]*(FANR|Federal Authority for Nuclear Regulation)[^)"]*\)/gi, '')
  .replace(/(\bthe )?(FANR|Federal Authority for Nuclear Regulation)/gi, 'the regulator')
  .replace(/الهيئة الاتحادية للرقابة النووية/g, 'الجهة الرقابية');
export const FANR_WORDING = /fanr|federal authority for nuclear regulation|الهيئة الاتحادية للرقابة النووية/i;
export function buildRplPack(r: Row, evidence: Row[], person: { initials: string; kind: string; job_role_id?: string | null }): Record<string, unknown> {
  return JSON.parse(maskFanr(JSON.stringify(packRaw(r, evidence, person))));
}
function packRaw(r: Row, evidence: Row[], person: { initials: string; kind: string; job_role_id?: string | null }): Record<string, unknown> {
  const ev = [...evidence].filter((e) => e.active).sort((a, b) => cmp(a.id, b.id));
  return {
    format: PACK_FORMAT,
    reference: r.id,
    subject: { initials: person.initials, kind: person.kind, job_role_id: person.job_role_id ?? null },
    target: { kind: r.target_kind, id: r.target_kind === 'skill' ? r.skill_id : r.microcred_def_id, title_en: r.target_title_en, title_ar: r.target_title_ar, level_requested: r.level ?? null },
    narrative: { en: r.narrative_en ?? '', ar: r.narrative_ar ?? '' },
    evidence: ev.map((e) => ({
      kind: e.kind, title_en: e.title_en, title_ar: e.title_ar, detail_en: e.detail_en, detail_ar: e.detail_ar, observed_on: d10(e.observed_on),
      mirror_status: e.mirror_status ?? null, attestation: e.kind === 'attestation' ? { role_en: e.attester_role_en ?? '', role_ar: e.attester_role_ar ?? '', status: e.attestation_status, text_en: e.attestation_en ?? '', text_ar: e.attestation_ar ?? '' } : null,
    })),
    decision: {
      outcome: r.outcome, credited_level: r.credited_level ?? null, notional_hours: Number(r.hours ?? 0), credits_text: `${Math.trunc(Number(r.hours ?? 0) / 10)}.${Number(r.hours ?? 0) % 10}`,
      nqf_level_indicative: r.nqf_level ?? null, recommended_role: r.recommended_role, confirmed_role: r.decided_role, decided_on: d10(r.decided_on), rationale_en: r.rationale_en, rationale_ar: r.rationale_ar,
    },
    statement: { en: r.rpl_statement_en, ar: r.rpl_statement_ar },
    frameworks: PACK_FRAMEWORKS,
    notice: PACK_NOTICE,
  };
}
/** Export wording check (FS29 acceptance): no FANR wording anywhere in the pack (EN or AR). */
export const packIsClean = (pack: unknown) => !FANR_WORDING.test(JSON.stringify(pack));

// ───────────── Advisory sufficiency (pages only; the assessor decides)
export interface AdviceReason { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }>; weight?: number }
export interface Advice { score: number; need: number; outcome: Outcome; level: number | null; hours: number; reasons: AdviceReason[] }
const WEIGHT: Record<string, number> = { ojt: 2, simulator: 2, qualification: 3, engagement: 2, attestation: 2 };
/** rplAdvice(): a deterministic suggestion with reasons. Weights per item (qualification 3, others 2; attestations only when
 *  confirmed; not-qualified mirrors 0), x0.5 when the item does not name the target skill, x0.5 when older than 5 years.
 *  Need = 2 + 2 x level. Levels 3-4 also need two kinds of evidence and a confirmed attestation. */
export function rplAdvice(level: number, evidence: { kind: string; active: boolean; observed_on?: string | null; mirror_status?: string | null; attestation_status?: string | null; skill_ids?: string[] | null; title_en?: string; title_ar?: string }[], targetSkills: string[], today: string): Advice {
  const reasons: AdviceReason[] = [];
  let score = 0;
  const kinds = new Set<string>();
  let attested = false;
  const t = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  for (const e of evidence) {
    if (!e.active) continue;
    let w = WEIGHT[e.kind] ?? 0;
    if (e.kind === 'qualification' && e.mirror_status !== 'qualified') w = 0;
    if (e.kind === 'attestation' && e.attestation_status !== 'confirmed') w = 0;
    const direct = e.kind === 'attestation' || (e.skill_ids ?? []).some((x) => targetSkills.includes(x));
    if (!direct) w *= 0.5;
    const old = e.observed_on ? t - Date.parse(`${String(e.observed_on).slice(0, 10)}T00:00:00Z`) > 1826 * 86400000 : false;
    if (old) w *= 0.5;
    if (w > 0) { kinds.add(e.kind); score += w; }
    if (e.kind === 'attestation' && e.attestation_status === 'confirmed') attested = true;
    reasons.push({ code: e.kind, key: `m34.why.${w === 0 ? 'zero' : direct ? 'direct' : 'related'}`, vars: { item: { en: String(e.title_en ?? e.kind), ar: String(e.title_ar ?? e.kind) }, w: Math.round(w * 10) / 10 }, weight: w });
  }
  const need = 2 + 2 * level;
  const deep = level >= 3;
  const deepOk = !deep || (kinds.size >= 2 && attested);
  let outcome: Outcome = 'not_yet';
  let lv: number | null = null;
  if (score >= need && deepOk) { outcome = 'full'; lv = level; }
  else if (score >= need * 0.6 && level >= 2) { outcome = 'partial'; lv = level - 1; }
  reasons.push({ code: 'need', key: 'm34.why.need', vars: { score: Math.round(score * 10) / 10, need } });
  if (deep && !deepOk) reasons.push({ code: 'deep', key: 'm34.why.deep' });
  return { score: Math.round(score * 10) / 10, need, outcome, level: lv, hours: outcome === 'not_yet' ? 0 : (lv ?? level) * 30, reasons };
}
