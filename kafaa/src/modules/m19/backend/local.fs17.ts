// FS17 + FS18 (FS wave C · E1, M19) LocalBackend RPCs, spread into makeLocalM19 (backend/local.ts). 1:1 mirror of
// supabase/migrations/20261010231001_kafaa_fs31_pathways_catalogue.sql: the same checks in the same order, the same refusal codes and
// messages (PW_MSG), one audit row per write (also on refusals), no NEXUS ledger rows. Pages never import this file.
// Shared write (like the SQL SECURITY DEFINER function): recordExternalCompletion appends one F30 xAPI statement ("experienced",
// source console, stored_by the learner, context evidence self-declared). It never writes skill evidence.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { xapiId } from '../../m27/xapi';
import {
  MAX_ACTIVE_PATHWAYS, PW_MSG, catalogueCheck, envelopeWeeks, pathwayProblems, pathwayProgress, peerStats, recordsOf, resolvePathway,
  type Content, type CriterionRow, type PathwayRow, type SkillRef, type StepRow,
} from '../pathways';
import type { ExternalInput, M19PathwaysRpc, PathwayDetail, PathwaySummary } from './rpc.fs17';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const EXT = 'https://kafaa.example/xapi/ext/';
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const slugOf = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
const XR_FIELDS = ['title_en', 'title_ar', 'provider_en', 'provider_ar', 'provider_url', 'url', 'format', 'hours', 'duration_en', 'duration_ar', 'cost_band', 'languages', 'skills',
  'has_assessment', 'summary_en', 'summary_ar', 'criteria', 'criteria_note_en', 'criteria_note_ar', 'as_of'] as const;

export function makeLocalFs17(b: LocalBackend, h: LocalRpcHelpers): M19PathwaysRpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const content = (): Content => ({ courses: raw('courses') as never, externals: raw('external_resources') as never, opportunities: raw('opportunities') as never, credentials: raw('microcred_defs') as never, fitness: raw('fitness_areas') as never, adaptive: raw('adaptive_banks') as never, tasks: raw('performance_tasks') as never });
  const skills = () => raw('skills') as unknown as SkillRef[];
  const criteria = () => raw('catalogue_criteria') as unknown as CriterionRow[];
  const steps = () => raw('pathway_steps') as unknown as StepRow[];
  const canPreview = () => ctx().has('sat', ['R', 'W', 'A']) || ctx().has('audit_log', ['R']);
  const isTm = () => ctx().roles.includes('training_manager');
  const resolve = (p: Row) => resolvePathway(p as PathwayRow, steps(), content());
  const progressOf = (person: string, p: Row) => pathwayProgress(resolve(p), recordsOf(person, {
    training_records: raw('training_records'), external_completions: raw('external_completions'), opportunity_applications: raw('opportunity_applications'),
    microcred_awards: raw('microcred_awards'), fitness_attempts: raw('fitness_attempts'), adaptive_attempts: raw('adaptive_attempts'), task_attempts: raw('task_attempts'),
  }));
  const enrolId = (person: string, pw: string) => `pe:${person}:${pw}`;

  return {
    async pathwayCatalogue() {
      await b.whenReady();
      if (!me() || !ctx().has('internal_content', ['R'])) return null;
      const pid = me()!;
      const enrol = raw('pathway_enrolments');
      const list: PathwaySummary[] = raw('pathways').filter((p) => p.status === 'published')
        .sort((a, c) => Number(a.sort) - Number(c.sort) || (a.id < c.id ? -1 : 1))
        .map((p) => {
          const r = resolve(p);
          return {
            id: p.id, skill_id: p.skill_id, level: Number(p.level), envelope_months: Number(p.envelope_months), weekly_hours: Number(p.weekly_hours), weeks: r.weeks,
            total_hours: r.total_hours, steps: r.steps.length, requested: r.requested, peer: peerStats(enrol, p.id, MIN_GROUP_SIZE),
            mine: (get('pathway_enrolments', enrolId(pid, p.id))?.status as string | undefined) ?? null,
          };
        });
      return { min_group: MIN_GROUP_SIZE, pathways: list };
    },

    async pathwayDetail(pathwayId) {
      await b.whenReady();
      if (!me() || !ctx().has('internal_content', ['R'])) return null;
      const p = get('pathways', pathwayId);
      if (!p || (p.status !== 'published' && !canPreview())) return null;
      const pid = me()!;
      const e = get('pathway_enrolments', enrolId(pid, p.id));
      const own = ctx().has('skills_profile', ['Own']);
      const d: PathwayDetail = {
        pathway_id: p.id, resolved: resolve(p), peer: peerStats(raw('pathway_enrolments'), p.id, MIN_GROUP_SIZE),
        mine: e && own ? { enrolment_id: e.id, status: e.status, started_on: String(e.started_on), completed_on: e.completed_on ?? null, progress: progressOf(pid, p) } : null,
        can_follow: own && p.status === 'published',
      };
      return d;
    },

    async startPathway(pathwayId) {
      await b.whenReady();
      type R = { id: string; status: string };
      const pid = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('pathway.start', 'pathway_enrolments', pathwayId ?? null, code, msg, role);
      if (!pid) return refuse('not_signed_in', PW_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', PW_MSG.forbidden);
      const p = get('pathways', pathwayId);
      if (!p || p.status !== 'published') return refuse('not_found', PW_MSG.not_found, role);
      const id = enrolId(pid, p.id);
      const e = get('pathway_enrolments', id);
      if (e && e.status !== 'withdrawn') return refuse('already', PW_MSG.already, role);
      const held = raw('person_skills').some((s) => s.person_id === pid && s.skill_id === p.skill_id && s.active !== false && Number(s.level) >= Number(p.level));
      if (held) return refuse('held', PW_MSG.held, role);
      if (raw('pathway_enrolments').filter((x) => x.person_id === pid && x.status === 'active').length >= MAX_ACTIVE_PATHWAYS) return refuse('too_many', PW_MSG.too_many, role);
      const row = { status: 'active', started_on: todayIso(), completed_on: null, withdrawn_on: null, withdrawn_reason: null, steps_done: [], updated_at: nowTs() };
      if (e) upd('pathway_enrolments', id, row); else ins('pathway_enrolments', { id, person_id: pid, pathway_id: p.id, ...row });
      return h.done<R>('pathway.start', 'pathway_enrolments', id, `${p.id} started`, role, null, '', 'Pathway started', { id, status: 'active' }, ['pathway_enrolments']);
    },

    async completePathway(pathwayId) {
      await b.whenReady();
      type R = { id: string; status: string; self_declared: number };
      const pid = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('pathway.complete', 'pathway_enrolments', pathwayId ?? null, code, msg, role);
      if (!pid) return refuse('not_signed_in', PW_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', PW_MSG.forbidden);
      const p = get('pathways', pathwayId);
      const id = p ? enrolId(pid, p.id) : '';
      const e = p ? get('pathway_enrolments', id) : undefined;
      if (!p || !e || e.status !== 'active') return refuse('not_active', PW_MSG.not_active, role);
      const pr = progressOf(pid, p);
      if (!pr.complete) return refuse('steps_open', PW_MSG.steps_open, role);
      upd('pathway_enrolments', id, { status: 'completed', completed_on: todayIso(), steps_done: pr.steps, updated_at: nowTs() });
      return h.done<R>('pathway.complete', 'pathway_enrolments', id, `${p.id} completed (${pr.self_declared} self-declared step(s))`, role, null, '', 'Pathway complete', { id, status: 'completed', self_declared: pr.self_declared }, ['pathway_enrolments']);
    },

    async withdrawPathway(pathwayId, reason = null) {
      await b.whenReady();
      type R = { id: string; status: string };
      const pid = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('pathway.withdraw', 'pathway_enrolments', pathwayId ?? null, code, msg, role);
      if (!pid) return refuse('not_signed_in', PW_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', PW_MSG.forbidden);
      const id = enrolId(pid, String(pathwayId));
      const e = get('pathway_enrolments', id);
      if (!e || e.status !== 'active') return refuse('not_active', PW_MSG.not_active, role);
      const why = reason == null ? null : String(reason).trim() || null;
      if (why && why.length > 300) return refuse('invalid', PW_MSG.xr_note, role);
      upd('pathway_enrolments', id, { status: 'withdrawn', withdrawn_on: todayIso(), withdrawn_reason: why, updated_at: nowTs() });
      return h.done<R>('pathway.withdraw', 'pathway_enrolments', id, `${pathwayId} left`, role, null, '', 'Pathway left', { id, status: 'withdrawn' }, ['pathway_enrolments']);
    },

    async savePathway(input) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const p = (input ?? {}) as Row;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('pathway.save', 'pathways', typeof p.id === 'string' ? p.id : null, code, msg, role);
      if (!me()) return refuse('not_signed_in', PW_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', PW_MSG.forbidden_edit, ctx().actingRole('internal_content', ['R']));
      const role = 'training_manager';
      const status = p.status ?? 'draft';
      const probs = pathwayProblems(p, skills());
      if (!['draft', 'published', 'retired'].includes(status)) probs.push('status');
      if (probs.length) return refuse('invalid', PW_MSG.invalid + probs.join(', '), role);
      const id = typeof p.id === 'string' && p.id ? p.id : `pw-${String(p.skill_id).replace(/^sk-fs-/, '')}-l${p.level}`;
      const old = get('pathways', id);
      if (!p.id && old) return refuse('conflict', 'A pathway for this skill and level already exists; edit it instead', role);
      if (old && (old.skill_id !== p.skill_id || Number(old.level) !== p.level)) return refuse('invalid', `${PW_MSG.invalid}skill`, role);
      const version = old ? Number(old.version) + 1 : 1;
      const row = {
        skill_id: p.skill_id, level: p.level, title_en: String(p.title_en).trim(), title_ar: String(p.title_ar).trim(), summary_en: String(p.summary_en ?? '').trim(), summary_ar: String(p.summary_ar ?? '').trim(),
        outcome_en: String(p.outcome_en ?? '').trim(), outcome_ar: String(p.outcome_ar ?? '').trim(), envelope_months: p.envelope_months, weekly_hours: p.weekly_hours,
        status, listed: status === 'published', version, updated_by: me(), updated_at: nowTs(),
      };
      if (old) upd('pathways', id, row); else ins('pathways', { id, benchmark_ids: ['ENTITLE', 'CORP', 'LIGHTCAST'], sources: [], sort: 9000, ...row });
      (p.steps as Row[]).forEach((s, i) => ins('pathway_steps', {
        id: `${id}:v${version}:s${i + 1}`, pathway_id: id, n: i + 1, kind: s.kind, title_en: String(s.title_en).trim(), title_ar: String(s.title_ar).trim(), hours: s.hours,
        pins: Array.isArray(s.pins) ? s.pins : [], auto: s.auto !== false, version,
      }));
      return h.done<R>('pathway.save', 'pathways', id, `${id} v${version} ${status}`, role, null, '', 'Pathway saved', { id, version, status }, ['pathways', 'pathway_steps']);
    },

    async refreshPathwayGaps() {
      await b.whenReady();
      type R = { open: number; filled: number; added: number };
      if (!me()) return h.refuse<R>('pathway.gaps', 'pathway_gaps', null, 'not_signed_in', PW_MSG.not_signed_in);
      if (!isTm()) return h.refuse<R>('pathway.gaps', 'pathway_gaps', null, 'forbidden', PW_MSG.forbidden_edit, ctx().actingRole('internal_content', ['R']));
      const today = todayIso();
      const want = new Map<string, Row>();
      for (const p of raw('pathways').filter((x) => x.status === 'published')) {
        for (const s of resolve(p).steps.filter((x) => x.status === 'requested')) want.set(`pg:${s.step_id}`, { pathway_id: p.id, step_id: s.step_id, skill_id: p.skill_id, level: Number(p.level), kind: s.kind });
      }
      let added = 0;
      for (const [id, g] of [...want.entries()].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
        const old = get('pathway_gaps', id);
        if (!old) { ins('pathway_gaps', { id, ...g, status: 'open', first_seen: today, last_checked: today, filled_on: null }); added++; }
        else upd('pathway_gaps', id, { status: 'open', last_checked: today, filled_on: null });
      }
      for (const g of raw('pathway_gaps').filter((x) => x.status === 'open' && !want.has(x.id))) upd('pathway_gaps', g.id, { status: 'filled', filled_on: today, last_checked: today });
      const all = raw('pathway_gaps');
      const data = { open: all.filter((x) => x.status === 'open').length, filled: all.filter((x) => x.status === 'filled').length, added };
      return h.done<R>('pathway.gaps', 'pathway_gaps', null, `${data.open} open, ${data.filled} filled, ${added} new`, 'training_manager', null, '', 'Gap backlog refreshed', data, ['pathway_gaps']);
    },

    async checkExternalResource(input) {
      await b.whenReady();
      return catalogueCheck((input ?? {}) as Row, criteria(), skills(), todayIso());
    },

    async saveExternalResource(input) {
      await b.whenReady();
      type R = { id: string; version: number; status: string; check: ReturnType<typeof catalogueCheck> };
      const x = (input ?? {}) as ExternalInput & Row;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('external.save', 'external_resources', typeof x.id === 'string' ? x.id : null, code, msg, role);
      if (!me()) return refuse('not_signed_in', PW_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', PW_MSG.forbidden_edit, ctx().actingRole('internal_content', ['R']));
      const role = 'training_manager';
      const chk = catalogueCheck(x, criteria(), skills(), todayIso());
      if (chk.problems.length) return refuse('invalid', PW_MSG.xr_invalid + chk.problems.join(', '), role);
      const id = typeof x.id === 'string' && x.id ? x.id : `xr-${slugOf(String(x.title_en))}`;
      const old = get('external_resources', id);
      if (!x.id && old) return refuse('conflict', 'A resource with this title already exists; edit it instead', role);
      if (old && old.status === 'published' && chk.failing.length) return refuse('criteria_failed', PW_MSG.xr_criteria + chk.failing.join(', '), role);
      const version = old ? Number(old.version) + 1 : 1;
      const row: Row = {};
      for (const k of XR_FIELDS) row[k] = (x as Row)[k] ?? null;
      row.hours = x.hours ?? null;
      for (const k of ['duration_en', 'duration_ar', 'summary_en', 'summary_ar', 'criteria_note_en', 'criteria_note_ar']) row[k] = String((x as Row)[k] ?? '').trim();
      row.has_assessment = !!x.has_assessment;
      row.criteria = x.criteria ?? {};
      const status = old ? old.status : 'draft';
      Object.assign(row, { version, status, listed: status === 'published', updated_by: me(), updated_at: nowTs() });
      if (old) upd('external_resources', id, row); else ins('external_resources', { id, sources: [], created_by: me(), sort: 9000, ...row });
      return h.done<R>('external.save', 'external_resources', id, `${id} v${version}`, role, null, '', 'Resource saved', { id, version, status, check: chk }, ['external_resources']);
    },

    async publishExternalResource(id) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('external.publish', 'external_resources', id ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', PW_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', PW_MSG.forbidden_edit, ctx().actingRole('internal_content', ['R']));
      const role = 'training_manager';
      const x = get('external_resources', id);
      if (!x) return refuse('not_found', PW_MSG.xr_not_found, role);
      const chk = catalogueCheck(x, criteria(), skills(), todayIso());
      if (chk.problems.length) return refuse('invalid', PW_MSG.xr_invalid + chk.problems.join(', '), role);
      if (chk.failing.length) return refuse('criteria_failed', PW_MSG.xr_criteria + chk.failing.join(', '), role);
      upd('external_resources', id, { status: 'published', listed: true, published_by: me(), published_on: todayIso(), retired_reason: null, retired_on: null, updated_at: nowTs() });
      return h.done<R>('external.publish', 'external_resources', id, `${id} published`, role, null, '', 'Resource published', { id, status: 'published' }, ['external_resources']);
    },

    async retireExternalResource(id, reason) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('external.retire', 'external_resources', id ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', PW_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', PW_MSG.forbidden_edit, ctx().actingRole('internal_content', ['R']));
      const role = 'training_manager';
      const x = get('external_resources', id);
      if (!x) return refuse('not_found', PW_MSG.xr_not_found, role);
      const why = String(reason ?? '').trim();
      if (why.length < 5 || why.length > 300) return refuse('invalid', PW_MSG.xr_reason, role);
      upd('external_resources', id, { status: 'retired', listed: false, retired_reason: why, retired_on: todayIso(), updated_at: nowTs() });
      return h.done<R>('external.retire', 'external_resources', id, `${id} retired: ${why}`, role, null, '', 'Resource retired', { id, status: 'retired' }, ['external_resources']);
    },

    async recordExternalCompletion(input) {
      await b.whenReady();
      type R = { id: string; evidence: 'self_declared'; statement_id: string };
      const pid = me();
      const rid = input?.resource_id ?? null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('external.complete', 'external_completions', rid, code, msg, role);
      if (!pid) return refuse('not_signed_in', PW_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', PW_MSG.forbidden);
      const x = get('external_resources', rid);
      if (!x || x.status !== 'published') return refuse('not_published', PW_MSG.xr_not_published, role);
      const on = input?.completed_on;
      if (!isDate(on) || (on as string) > todayIso()) return refuse('invalid', PW_MSG.xr_date, role);
      const note = input?.note == null ? null : String(input.note).trim() || null;
      if (note && note.length > 300) return refuse('invalid', PW_MSG.xr_note, role);
      const id = `xc:${pid}:${x.id}`;
      if (get('external_completions', id)) return refuse('duplicate', PW_MSG.xr_duplicate, role);
      const ts = nowTs().replace(/\.\d{3}Z$/, 'Z');
      const noon = `${on}T12:00:00Z`;
      const sid = xapiId('console', `fs18:${id}`);
      ins('external_completions', { id, person_id: pid, resource_id: x.id, completed_on: on, note, evidence: 'self_declared', statement_id: sid, created_at: ts });
      ins('xapi_statements', {
        id: sid, actor_person_id: pid, verb: 'experienced', object_type: 'activity', object_id: `external/${x.id}`, object_name: { en: x.title_en, ar: x.title_ar || x.title_en },
        result: { completion: true }, context: { extensions: { [`${EXT}record`]: `external_completions/${id}`, [`${EXT}evidence`]: 'self-declared' } },
        occurred_at: noon < ts ? noon : ts, stored_at: ts, source: 'console', source_ref: `fs18:${id}`, stored_by: pid, version: '2.0.0',
      });
      return h.done<R>('external.complete', 'external_completions', id, `${x.id} self-declared`, role, null, '', 'Completion recorded (self-declared)', { id, evidence: 'self_declared', statement_id: sid }, ['external_completions', 'xapi_statements']);
    },
  };
}
export { envelopeWeeks };
