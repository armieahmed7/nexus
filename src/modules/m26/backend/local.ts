// M26 LocalBackend RPC implementations (owner: W4 · E2 · F27 SAT analysis workbench, F29 Accreditation readiness).
// 1:1 mirror of supabase/migrations/20261009142001_kafaa_w4e2_sat.sql: same checks in the same order, the same refusal codes and
// messages (SAT_MSG in ../sat.ts, ACCR_MSG in ../accr.ts), the same audit rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { SCHEMA } from '../../../data/schema';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  DECISIONS, NOTE_MAX, RESTRICTED_FAMILIES, RESTRICTED_TITLE, SAT_MSG, SUMMARY_MIN, between, changeImpact, proposal, validDif,
  type Decision, type Impact, type LinkLite,
} from '../sat';
import { ACCR_MSG, GAP_MAX, OWNER_ROLES, addDaysIso, cycleOf, isGap, selfEvalState, soleAuthor, validEvidence, validRating } from '../accr';
import { evidenceFacts, type EvidenceData } from '../evidence';
import type { M26Rpc, SurveyTask } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const isoDay = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const day = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
export const roleAbbr = (roleId: string) => roleId.split('-').map((x) => x.charAt(0)).join('').toUpperCase();

export function makeLocalM26(b: LocalBackend, h: LocalRpcHelpers): M26Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const opt = (t: string, col: string) => (SCHEMA[t] && col in SCHEMA[t].cols ? raw(t) : null);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const today = () => todayIso();
  const has = (levels: ('R' | 'W' | 'A')[]) => ctx().has('sat', levels);
  const nameOf = (id: string | null | undefined) => { const p = get('people', id); return { en: p?.display_name ?? '', ar: p?.display_name_ar || p?.display_name || '' }; };
  const restrictedRole = (roleId: string | null | undefined) => { const r = get('job_roles', roleId); return !!r && (!!r.security_sensitive || RESTRICTED_FAMILIES.includes(r.family_id)); };
  const ratingsOf = (taskId: string) => raw('dif_ratings').filter((r) => r.task_id === taskId && r.active !== false);
  const linksOf = (taskId: string) => raw('task_objectives').filter((l) => l.task_id === taskId && l.active);
  const impactOf = (task: Row): Impact => changeImpact({
    task: { id: task.id, standard_id: task.standard_id ?? null, task_item_id: task.task_item_id ?? null, restricted: !!task.restricted },
    links: raw('task_objectives') as LinkLite[], objectives: raw('sat_objectives') as never, courses: raw('courses') as never, jpms: raw('jpms') as never,
    standards: raw('qual_standards') as never, items: raw('items') as never,
  });
  const ensureAnalysis = (roleId: string) => {
    const id = `jta-${roleId}`;
    if (!get('jta_analyses', id)) ins('jta_analyses', { id, role_id: roleId, status: 'draft', version: 1, owner_id: me(), restricted: false, notes_en: '', notes_ar: '', history: [], updated_at: nowTs() });
  };
  const criteriaCount = () => raw('accr_criteria').length;
  const refreshSelfEval = (seId: string) => {
    const xs = raw('accr_assessments').filter((a) => a.selfeval_id === seId);
    const s = selfEvalState(xs as never, criteriaCount());
    upd('accr_selfevals', seId, { rated: s.rated, gaps: s.gaps, authors: s.authors, readiness: s.readiness, updated_at: nowTs() });
    return s;
  };

  return {
    // ───────────────────────────── F27
    async saveJtaTask(input) {
      await b.whenReady();
      type R = { id: string };
      const tid = str(input?.id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.task.save', 'jta_tasks', tid || str(input?.role_id) || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const roleId = str(input?.role_id);
      if (!get('job_roles', roleId)) return refuse('not_found', SAT_MSG.role_not_found, role);
      if (restrictedRole(roleId)) return refuse('restricted', SAT_MSG.restricted_role, role);
      const en = str(input?.title_en), ar = str(input?.title_ar), den = str(input?.duty_en), dar = str(input?.duty_ar);
      if (!between(en, 5, 200) || !between(ar, 5, 200) || den.length > 200 || dar.length > 200) return refuse('invalid', SAT_MSG.title_invalid, role);
      if (tid) {
        const t = get('jta_tasks', tid);
        if (!t || t.role_id !== roleId) return refuse('not_found', SAT_MSG.not_found, role);
        if (t.restricted) return refuse('restricted', SAT_MSG.restricted, role);
        if (t.status !== 'active') return refuse('invalid', SAT_MSG.retired, role);
        if (linksOf(tid).length) return refuse('change_required', SAT_MSG.change_linked, role);
        upd('jta_tasks', tid, { title_en: en, title_ar: ar, duty_en: den, duty_ar: dar, critical: !!input?.critical, changed_at: nowTs() });
        return h.done<R>('sat.task.save', 'jta_tasks', tid, 'edited', role, null, '', 'Task saved', { id: tid }, ['jta_tasks']);
      }
      const inRole = raw('jta_tasks').filter((t) => t.role_id === roleId);
      const id = rid('jt');
      ensureAnalysis(roleId);
      ins('jta_tasks', {
        id, role_id: roleId, code: `${roleAbbr(roleId)}-J${String(inRole.length + 1).padStart(2, '0')}`, title_en: en, title_ar: ar, duty_en: den, duty_ar: dar, source: 'jta_survey',
        task_item_id: null, standard_id: null, critical: !!input?.critical, restricted: false, status: 'active', decision: 'pending', decision_by: null, decision_on: null, decision_note: null,
        override: false, version: 1, created_by: me(), created_at: nowTs(), changed_at: nowTs(), sort: inRole.reduce((m, t) => Math.max(m, Number(t.sort) || 0), 0) + 1,
      });
      return h.done<R>('sat.task.save', 'jta_tasks', id, `added to ${roleId}`, role, null, '', 'Task added to the inventory', { id }, ['jta_tasks', 'jta_analyses']);
    },

    async rateDif(taskId, d, i, f, note = '') {
      await b.whenReady();
      type R = { id: string; proposal: ReturnType<typeof proposal> };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.dif.rate', 'dif_ratings', taskId || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      const t = get('jta_tasks', taskId);
      const staff = has(['W', 'A']);
      const an = t ? get('jta_analyses', `jta-${t.role_id}`) : undefined;
      const sme = !!raw('sme_profiles').find((s) => s.person_id === who) && !!t && get('people', who)?.job_role_id === t.role_id;
      if (!staff && !sme) return refuse('forbidden', SAT_MSG.forbidden_rate);
      const role = staff ? ctx().actingRole('sat', ['W', 'A']) : ctx().actingRole('own_profile', ['Own']);
      if (!t) return refuse('not_found', SAT_MSG.not_found, role);
      if (t.restricted) return refuse('restricted', SAT_MSG.restricted, role);
      if (t.status !== 'active') return refuse('invalid', SAT_MSG.retired, role);
      if (!staff && an?.status !== 'survey') return refuse('survey_closed', SAT_MSG.survey_closed, role);
      if (!validDif(d) || !validDif(i) || !validDif(f)) return refuse('invalid', SAT_MSG.dif_range, role);
      const n = str(note);
      if (n.length > NOTE_MAX) return refuse('invalid', SAT_MSG.note_long, role);
      const id = `dif:${taskId}:${who}`;
      const kind = staff ? (has(['A']) ? 'developer' : 'instructor') : 'sme';
      const row = { task_id: taskId, rater_person_id: who, d, i, f, note: n, rater_kind: kind, rated_on: today(), active: true };
      if (get('dif_ratings', id)) upd('dif_ratings', id, row); else ins('dif_ratings', { id, ...row });
      const p = proposal(ratingsOf(taskId) as never);
      return h.done<R>('sat.dif.rate', 'dif_ratings', id, `D${d} I${i} F${f}`, role, null, '', 'Rating saved', { id, proposal: p }, ['dif_ratings']);
    },

    async decideTraining(taskId, decision, note = '') {
      await b.whenReady();
      type R = { decision: Decision; override: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.decide', 'jta_tasks', taskId || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', SAT_MSG.forbidden_decide);
      const role = ctx().actingRole('sat', ['A']);
      const t = get('jta_tasks', taskId);
      if (!t) return refuse('not_found', SAT_MSG.not_found, role);
      if (t.restricted) return refuse('restricted', SAT_MSG.restricted, role);
      if (t.status !== 'active') return refuse('invalid', SAT_MSG.retired, role);
      if (!DECISIONS.includes(decision)) return refuse('invalid', SAT_MSG.decision_invalid, role);
      const n = str(note);
      if (n.length > NOTE_MAX) return refuse('invalid', SAT_MSG.note_long, role);
      const p = proposal(ratingsOf(taskId) as never);
      if (p.status !== 'proposed') return refuse('insufficient_ratings', SAT_MSG.insufficient, role);
      const override = decision !== p.decision;
      if (override && n.length < 10) return refuse('note_required', SAT_MSG.note_required, role);
      upd('jta_tasks', taskId, { decision, decision_by: me(), decision_on: today(), decision_note: n || null, override, changed_at: nowTs() });
      return h.done<R>('sat.decide', 'jta_tasks', taskId, `${decision}${override ? ` (rule: ${p.decision})` : ''}`, role, 'kafaa.sat.training_decision',
        `${t.code}: ${decision}${override ? ' (override)' : ''}`, 'Training decision recorded', { decision, override }, ['jta_tasks']);
    },

    async saveObjective(input) {
      await b.whenReady();
      type R = { id: string };
      const oid = str(input?.id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.objective.save', 'sat_objectives', oid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const kind = input?.kind;
      const en = str(input?.text_en), ar = str(input?.text_ar);
      if ((kind !== 'terminal' && kind !== 'enabling') || !between(en, 10, 400) || !between(ar, 10, 400)) return refuse('invalid', SAT_MSG.objective_invalid, role);
      const courseId = str(input?.course_id) || null, moduleId = str(input?.module_id) || null, compId = str(input?.competency_id) || null, roleId = str(input?.role_id) || null;
      if (courseId && !get('courses', courseId)) return refuse('not_found', SAT_MSG.course_not_found, role);
      if (moduleId && get('course_modules', moduleId)?.course_id !== courseId) return refuse('not_found', SAT_MSG.module_not_found, role);
      if (compId && (!get('competencies', compId) || get('competencies', compId)?.domain === 'security')) return refuse('invalid', SAT_MSG.objective_invalid, role);
      if (roleId && !get('job_roles', roleId)) return refuse('not_found', SAT_MSG.role_not_found, role);
      if (roleId && restrictedRole(roleId)) return refuse('restricted', SAT_MSG.restricted_role, role);
      if (oid) {
        const o = get('sat_objectives', oid);
        if (!o) return refuse('not_found', SAT_MSG.objective_not_found, role);
        upd('sat_objectives', oid, { kind, text_en: en, text_ar: ar, module_id: moduleId, competency_id: compId, updated_at: nowTs() });
        return h.done<R>('sat.objective.save', 'sat_objectives', oid, 'edited', role, null, '', 'Objective saved', { id: oid }, ['sat_objectives']);
      }
      const id = rid('obj-sat');
      const n = raw('sat_objectives').filter((o) => o.source === 'sat').length + 1;
      ins('sat_objectives', { id, code: `SAT-${String(n).padStart(3, '0')}`, kind, text_en: en, text_ar: ar, course_id: courseId, module_id: moduleId, competency_id: compId, role_id: roleId, source: 'sat', status: 'active', created_by: me(), updated_at: nowTs() });
      return h.done<R>('sat.objective.save', 'sat_objectives', id, 'written', role, null, '', 'Objective written', { id }, ['sat_objectives']);
    },

    async linkObjective(input) {
      await b.whenReady();
      type R = { id: string; active: boolean };
      const taskId = str(input?.task_id), objId = str(input?.objective_ref);
      const id = `to:${taskId}:${objId}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.link', 'task_objectives', taskId ? id : null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const t = get('jta_tasks', taskId);
      if (!t) return refuse('not_found', SAT_MSG.not_found, role);
      if (t.restricted) return refuse('restricted', SAT_MSG.restricted, role);
      if (t.status !== 'active') return refuse('invalid', SAT_MSG.retired, role);
      const cur = get('task_objectives', id);
      if (input?.active === false) {
        if (!cur || !cur.active) return refuse('not_found', SAT_MSG.link_missing, role);
        upd('task_objectives', id, { active: false, linked_by: me(), linked_at: nowTs() });
        return h.done<R>('sat.link', 'task_objectives', id, 'unlinked', role, null, '', 'Link removed', { id, active: false }, ['task_objectives']);
      }
      const o = get('sat_objectives', objId);
      if (!o) return refuse('not_found', SAT_MSG.objective_not_found, role);
      if (o.status !== 'active') return refuse('invalid', SAT_MSG.objective_retired, role);
      if (cur?.active) return refuse('conflict', SAT_MSG.link_exists, role);
      const courseId = str(input?.course_id) || o.course_id || null;
      const moduleId = str(input?.module_id) || null;
      const jpmId = str(input?.jpm_id) || null;
      if (courseId && !get('courses', courseId)) return refuse('not_found', SAT_MSG.course_not_found, role);
      if (moduleId && get('course_modules', moduleId)?.course_id !== courseId) return refuse('not_found', SAT_MSG.module_not_found, role);
      if (jpmId) {
        const j = get('jpms', jpmId);
        if (!j) return refuse('not_found', SAT_MSG.jpm_not_found, role);
        if (get('qual_standards', j.standard_id)?.security_restricted) return refuse('restricted', SAT_MSG.jpm_restricted, role);
      }
      const row = { task_id: taskId, objective_ref: objId, course_id: courseId, module_id: moduleId, jpm_id: jpmId, active: true, linked_by: me(), linked_at: nowTs() };
      if (cur) upd('task_objectives', id, row); else ins('task_objectives', { id, ...row });
      return h.done<R>('sat.link', 'task_objectives', id, `linked${courseId ? ` ${courseId}` : ''}${jpmId ? ` ${jpmId}` : ''}`, role, null, '', 'Objective linked', { id, active: true }, ['task_objectives']);
    },

    async satImpact(taskId) {
      await b.whenReady();
      if (!me() || !has(['R', 'W', 'A'])) return null;
      const t = get('jta_tasks', taskId);
      return t ? impactOf(t) : null;
    },

    async openSatChange(input) {
      await b.whenReady();
      type R = { id: string; items: number; impact: Impact };
      const taskId = str(input?.task_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.change.open', 'sat_changes', taskId || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const t = get('jta_tasks', taskId);
      if (!t) return refuse('not_found', SAT_MSG.not_found, role);
      if (t.restricted) return refuse('restricted', SAT_MSG.restricted, role);
      if (t.status !== 'active') return refuse('invalid', SAT_MSG.retired, role);
      if (raw('sat_changes').some((c) => c.task_id === taskId && c.status === 'open')) return refuse('conflict', SAT_MSG.change_open, role);
      const kind = input?.kind;
      if (kind !== 'modified' && kind !== 'retired') return refuse('invalid', SAT_MSG.change_kind, role);
      const summary = str(input?.summary);
      if (!between(summary, SUMMARY_MIN, NOTE_MAX)) return refuse('invalid', SAT_MSG.change_summary, role);
      const trig = input?.trigger ?? 'task_change';
      if (!['task_change', 'effectiveness', 'oe', 'regulatory'].includes(trig)) return refuse('invalid', SAT_MSG.change_kind, role);
      const en = str(input?.title_en), ar = str(input?.title_ar);
      const retitle = kind === 'modified' && (en !== '' || ar !== '');
      if (retitle && (!between(en, 5, 200) || !between(ar, 5, 200))) return refuse('invalid', SAT_MSG.title_invalid, role);
      const impact = impactOf(t);
      const id = rid('sc');
      const nm = nameOf(who);
      const before = { title_en: t.title_en, title_ar: t.title_ar, version: Number(t.version), status: t.status };
      const after = kind === 'retired' ? { ...before, status: 'retired' } : { title_en: retitle ? en : t.title_en, title_ar: retitle ? ar : t.title_ar, version: Number(t.version) + 1, status: 'active' };
      const items = [...impact.courses.map((c) => ({ kind: 'course', ...c })), ...impact.standards.map((s) => ({ kind: 'standard', ...s }))];
      ins('sat_changes', {
        id, task_id: taskId, role_id: t.role_id, kind, trigger: trig, summary, before, after, impact, status: items.length ? 'open' : 'closed',
        opened_by: who, opened_by_name: nm.en, opened_by_name_ar: nm.ar, opened_at: nowTs(), closed_at: items.length ? null : nowTs(),
      });
      items.forEach((x, k) => ins('sat_change_items', { id: `${id}-${k + 1}`, change_id: id, kind: x.kind, ref_id: x.id, title_en: `${x.code} · ${x.title_en}`, title_ar: `${x.code} · ${x.title_ar}`, status: 'open', note: '', revision_id: null, closed_by: null, closed_at: null, sort: k + 1 }));
      upd('jta_tasks', taskId, { title_en: after.title_en, title_ar: after.title_ar, version: after.version, status: after.status, changed_at: nowTs() });
      return h.done<R>('sat.change.open', 'sat_changes', id, `${kind}: ${impact.courses.length} courses, ${impact.standards.length} standards, ${impact.jpms.length} JPMs, ${impact.items.length} items`, role,
        'kafaa.sat.change_open', `${t.code} ${kind}: ${items.length} review items`, `Change recorded: ${items.length} review items opened`, { id, items: items.length, impact }, ['sat_changes', 'sat_change_items', 'jta_tasks']);
    },

    async resolveSatChangeItem(itemId, outcome, note = '') {
      await b.whenReady();
      type R = { status: string; change_status: string; revision_id: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.change.item', 'sat_change_items', itemId || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const it = get('sat_change_items', itemId);
      if (!it) return refuse('not_found', SAT_MSG.item_not_found, role);
      if (it.status !== 'open') return refuse('invalid', SAT_MSG.item_closed, role);
      const okOutcome = it.kind === 'course' ? ['updated', 'no_change'] : ['revised', 'no_change'];
      if (!okOutcome.includes(outcome)) return refuse('invalid', SAT_MSG.item_outcome, role);
      const n = str(note);
      if (n.length > NOTE_MAX) return refuse('invalid', SAT_MSG.note_long, role);
      if (outcome === 'no_change' && n.length < 5) return refuse('invalid', SAT_MSG.item_note, role);
      let revision: string | null = null;
      if (outcome === 'revised') {
        const succ = raw('qual_standards').filter((q) => q.supersedes_id === it.ref_id).sort((x, y) => (x.id < y.id ? -1 : 1))[0];
        if (!succ) return refuse('not_revised', SAT_MSG.not_revised, role);
        revision = succ.id;
      }
      upd('sat_change_items', itemId, { status: outcome, note: n, revision_id: revision, closed_by: me(), closed_at: nowTs() });
      const open = raw('sat_change_items').filter((x) => x.change_id === it.change_id && x.status === 'open').length;
      const ch = get('sat_changes', it.change_id)!;
      if (open === 0) {
        upd('sat_changes', ch.id, { status: 'closed', closed_at: nowTs() });
        return h.done<R>('sat.change.item', 'sat_change_items', itemId, `${outcome}; change closed`, role, 'kafaa.sat.change_close', `${ch.id} closed`, 'Review item closed; the change is complete',
          { status: outcome, change_status: 'closed', revision_id: revision }, ['sat_change_items', 'sat_changes']);
      }
      return h.done<R>('sat.change.item', 'sat_change_items', itemId, outcome, role, null, '', 'Review item closed', { status: outcome, change_status: 'open', revision_id: revision }, ['sat_change_items', 'sat_changes']);
    },

    async setAnalysisStatus(roleId, status) {
      await b.whenReady();
      type R = { status: string };
      const id = `jta-${roleId}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.analysis.status', 'jta_analyses', roleId ? id : null, code, msg, role);
      if (!me()) return refuse('not_signed_in', SAT_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', SAT_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      if (!get('job_roles', roleId)) return refuse('not_found', SAT_MSG.role_not_found, role);
      if (restrictedRole(roleId)) return refuse('restricted', SAT_MSG.restricted_role, role);
      const a = get('jta_analyses', id);
      const from = a?.status ?? 'draft';
      const ok = (from === 'draft' && status === 'survey') || (from === 'survey' && status === 'draft') || (from !== 'approved' && status === 'approved') || (from === 'approved' && status === 'draft');
      if (!ok) return refuse('invalid', SAT_MSG.analysis_status, role);
      if ((status === 'approved' || from === 'approved') && !has(['A'])) return refuse('forbidden', SAT_MSG.approve_forbidden, role);
      const actRole = status === 'approved' || from === 'approved' ? ctx().actingRole('sat', ['A']) : role;
      if (status === 'approved' && raw('jta_tasks').some((t) => t.role_id === roleId && t.status === 'active' && !t.restricted && t.decision === 'pending')) return refuse('undecided', SAT_MSG.analysis_undecided, actRole);
      ensureAnalysis(roleId);
      const cur = get('jta_analyses', id)!;
      const patch: Row = { status, updated_at: nowTs(), history: [...(cur.history ?? []), { at: nowTs(), by: me(), from, to: status }] };
      if (status === 'survey') patch.survey_opened_on = today();
      if (status === 'approved') { patch.approved_by = me(); patch.approved_on = today(); }
      if (from === 'approved' && status === 'draft') patch.version = Number(cur.version) + 1;
      upd('jta_analyses', id, patch);
      if (status === 'survey') {
        const r = get('job_roles', roleId)!;
        for (const sp of raw('sme_profiles').filter((x) => get('people', x.person_id)?.job_role_id === roleId)) {
          const nid = `nt-dif-${roleId}-${today()}-${sp.person_id}`;
          if (!get('notifications', nid)) ins('notifications', { id: nid, person_id: sp.person_id, kind: 'sat', title_en: `DIF survey open: ${r.title_en}`, title_ar: `استبيان الصعوبة والأهمية والتكرار مفتوح: ${r.title_ar}`, link: '/training/sat/survey', severity: 'info', created_at: nowTs() });
        }
      }
      if (status === 'approved') return h.done<R>('sat.analysis.status', 'jta_analyses', id, `${from} -> ${status}`, actRole, 'kafaa.sat.analysis_approve', `${roleId} job analysis v${cur.version} approved`, 'Job analysis approved', { status }, ['jta_analyses']);
      return h.done<R>('sat.analysis.status', 'jta_analyses', id, `${from} -> ${status}`, actRole, null, '', status === 'survey' ? 'DIF survey opened' : 'Job analysis back in draft', { status }, ['jta_analyses', 'notifications']);
    },

    async difSurvey() {
      await b.whenReady();
      const who = me();
      const none = { open: false, role_id: null, tasks: [] as SurveyTask[] };
      if (!who) return none;
      const p = get('people', who);
      const roleId = p?.job_role_id ?? null;
      if (!roleId) return none;
      const isSme = raw('sme_profiles').some((s) => s.person_id === who);
      if (!isSme && !has(['W', 'A'])) return none;
      const a = get('jta_analyses', `jta-${roleId}`);
      if (!a || a.status !== 'survey' || a.restricted || restrictedRole(roleId)) return { ...none, role_id: roleId };
      const tasks = raw('jta_tasks').filter((t) => t.role_id === roleId && t.status === 'active' && !t.restricted).sort((x, y) => (Number(x.sort) - Number(y.sort)) || (x.id < y.id ? -1 : 1)).map((t) => {
        const mine = get('dif_ratings', `dif:${t.id}:${who}`);
        return {
          id: t.id, role_id: t.role_id, code: t.code, title_en: t.title_en, title_ar: t.title_ar, duty_en: t.duty_en ?? '', duty_ar: t.duty_ar ?? '', critical: !!t.critical,
          mine: mine && mine.active !== false ? { d: Number(mine.d), i: Number(mine.i), f: Number(mine.f), note: mine.note ?? '' } : null, raters: ratingsOf(t.id).length,
        };
      });
      return { open: true, role_id: roleId, tasks };
    },

    // ───────────────────────────── F29
    async openSelfEval(programmeId) {
      await b.whenReady();
      type R = { id: string; cycle: string };
      const cycle = cycleOf(today());
      const id = `ase-${programmeId}-${cycle}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('accr.selfeval.open', 'accr_selfevals', programmeId ? id : null, code, msg, role);
      if (!me()) return refuse('not_signed_in', ACCR_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', ACCR_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const p = get('accr_programmes', programmeId);
      if (!p || !p.active) return refuse('not_found', ACCR_MSG.programme_not_found, role);
      if (raw('accr_selfevals').some((s) => s.programme_id === programmeId && s.status === 'draft')) return refuse('conflict', ACCR_MSG.draft_exists, role);
      if (get('accr_selfevals', id)) return refuse('conflict', ACCR_MSG.cycle_done, role);
      ins('accr_selfevals', { id, programme_id: programmeId, cycle, status: 'draft', opened_by: me(), opened_on: today(), finalised_by: null, finalised_by_name: '', finalised_by_name_ar: '', finalised_at: null, readiness: 0, rated: 0, gaps: 0, authors: [], summary_en: '', summary_ar: '', updated_at: nowTs() });
      return h.done<R>('accr.selfeval.open', 'accr_selfevals', id, cycle, role, null, '', `Self-evaluation ${cycle} opened`, { id, cycle }, ['accr_selfevals']);
    },

    async rateCriterion(input) {
      await b.whenReady();
      type R = { id: string; readiness: number; gaps: number };
      const seId = str(input?.selfeval_id), cId = str(input?.criterion_id);
      const id = `aa:${seId}:${cId}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('accr.rate', 'accr_assessments', seId ? id : null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ACCR_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', ACCR_MSG.forbidden);
      const role = ctx().actingRole('sat', ['W', 'A']);
      const se = get('accr_selfevals', seId);
      if (!se) return refuse('not_found', ACCR_MSG.selfeval_not_found, role);
      if (se.status !== 'draft') return refuse('invalid', ACCR_MSG.not_draft, role);
      if (!get('accr_criteria', cId)) return refuse('not_found', ACCR_MSG.criterion_not_found, role);
      const rating = input?.rating;
      if (!validRating(rating)) return refuse('invalid', ACCR_MSG.rating_invalid, role);
      if (!validEvidence(input?.evidence)) return refuse('invalid', ACCR_MSG.evidence_invalid, role);
      const gap = str(input?.gap_en), note = str(input?.note);
      if (gap.length > GAP_MAX || note.length > GAP_MAX) return refuse('invalid', ACCR_MSG.gap_long, role);
      const owner = str(input?.owner_role) || null, due = str(input?.due_on) || null;
      if (isGap(rating) && (!owner || !(OWNER_ROLES as readonly string[]).includes(owner) || !isoDay(due) || (due as string) < today() || (due as string) > addDaysIso(today(), 365))) return refuse('invalid', ACCR_MSG.gap_owner, role);
      const nm = nameOf(who);
      const cur = get('accr_assessments', id);
      const row = {
        selfeval_id: seId, programme_id: se.programme_id, criterion_id: cId, rating, evidence: input.evidence.map((e) => ({ kind: e.kind, ref: e.ref, route: e.route, label_en: e.label_en, label_ar: e.label_ar })),
        gap_en: isGap(rating) ? gap : '', owner_role: isGap(rating) ? owner : null, due_on: isGap(rating) ? due : null, note, rated_by: who, rated_by_name: nm.en, rated_by_name_ar: nm.ar, rated_at: nowTs(),
        history: [...(cur?.history ?? []), { at: nowTs(), by: who, rating }],
      };
      if (cur) upd('accr_assessments', id, row); else ins('accr_assessments', { id, ...row });
      const s = refreshSelfEval(seId);
      return h.done<R>('accr.rate', 'accr_assessments', id, `rating ${rating}${isGap(rating) ? ` gap -> ${owner} by ${due}` : ''}`, role, null, '', 'Criterion rated', { id, readiness: s.readiness, gaps: s.gaps }, ['accr_assessments', 'accr_selfevals']);
    },

    async finaliseSelfEval(selfEvalId) {
      await b.whenReady();
      type R = { status: string; readiness: number; gaps: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('accr.finalise', 'accr_selfevals', selfEvalId || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ACCR_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', ACCR_MSG.forbidden_finalise);
      const role = ctx().actingRole('sat', ['A']);
      const se = get('accr_selfevals', selfEvalId);
      if (!se) return refuse('not_found', ACCR_MSG.selfeval_not_found, role);
      if (se.status !== 'draft') return refuse('invalid', ACCR_MSG.not_draft, role);
      const xs = raw('accr_assessments').filter((a) => a.selfeval_id === selfEvalId);
      const s = selfEvalState(xs as never, criteriaCount());
      if (!s.complete) return refuse('incomplete', ACCR_MSG.incomplete, role);
      if (s.unowned) return refuse('gaps_unowned', ACCR_MSG.gaps_unowned, role);
      if (soleAuthor(s.authors, who)) return refuse('maker_checker', ACCR_MSG.maker_checker, role);
      const nm = nameOf(who);
      upd('accr_selfevals', selfEvalId, { status: 'finalised', finalised_by: who, finalised_by_name: nm.en, finalised_by_name_ar: nm.ar, finalised_at: nowTs(), readiness: s.readiness, rated: s.rated, gaps: s.gaps, authors: s.authors, updated_at: nowTs() });
      return h.done<R>('accr.finalise', 'accr_selfevals', selfEvalId, `readiness ${s.readiness}%, ${s.gaps} gaps`, role, 'kafaa.accr.finalise', `${se.programme_id} ${se.cycle} self-evaluation finalised (${s.readiness}%)`,
        'Self-evaluation finalised', { status: 'finalised', readiness: s.readiness, gaps: s.gaps }, ['accr_selfevals']);
    },

    async accrEvidence(programmeId) {
      await b.whenReady();
      if (!me() || !has(['R', 'W', 'A'])) return null;
      const p = get('accr_programmes', programmeId);
      if (!p) return null;
      const d: EvidenceData = {
        programme: { id: p.id, role_ids: [...(p.role_ids ?? [])], standard_ids: [...(p.standard_ids ?? [])], course_ids: [...(p.course_ids ?? [])] },
        analyses: raw('jta_analyses').map((a) => ({ role_id: a.role_id, restricted: !!a.restricted })),
        tasks: raw('jta_tasks') as never, links: raw('task_objectives') as never, objectives: raw('sat_objectives') as never, roleComps: raw('role_competencies') as never, courses: raw('courses') as never,
        items: raw('items') as never, forms: raw('assessment_forms').map((f) => ({ id: f.id, course_id: f.course_id ?? null })), attempts: raw('attempts').map((a) => ({ form_id: a.form_id, released: !!a.released })),
        evaluatorQuals: raw('evaluator_quals').map((e) => ({ person_id: e.person_id, standard_id: e.standard_id, valid_to: day(e.valid_to) })),
        qualRecords: raw('qual_records').map((r) => ({ id: r.id, person_id: r.person_id, standard_id: r.standard_id, status: r.status })),
        evaluations: raw('evaluations').map((e) => ({ record_id: e.record_id, date: day(e.date), supervisor_ack_at: e.supervisor_ack_at ?? null })),
        trainingRecords: raw('training_records').map((r) => ({ course_id: r.course_id, completed_on: day(r.completed_on), result: r.result })),
        sessions: raw('sessions').map((s) => ({ course_id: s.course_id, status: s.status ?? 'scheduled' })),
        l3: opt('l3_observations', 'course_id')?.map((x) => ({ course_id: x.course_id ?? null })) ?? null,
        tracks: SCHEMA.instructor_tracks ? raw('instructor_tracks') : null,
      };
      return { programme_id: programmeId, today: today(), facts: evidenceFacts(d, today()) };
    },
  };
}
