// M24 LocalBackend RPC implementations (owner: W3 · E2 · F20 KLRA, F21 Knowledge capture studio).
// 1:1 mirror of supabase/migrations/20261009132001_kafaa_w3e2_knowledge.sql: same checks in the same order, the same refusal
// codes and messages (src/modules/m24/klra.ts KLRA_MSG, capture.ts KC_MSG), the same audit rows and ledger rows.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { levelsOf, type PlatformRole, type Resource } from '../../../auth/policy';
import { hasContactDetails, postGuard } from '../../m22/domain';
import {
  ACTION_KINDS, DEFAULT_THRESHOLDS, KLRA_MSG, OPEN_ACTION, OWNER_ROLES, actionOverdue, addDaysIso, assessmentReasons, bandOf, computeHeatmap, coversPosition,
  mitigationState, proposeFactors, quarterEndIso, quarterOfIso, validFactor, validPeriod, validThresholds, type PositionLite, type Thresholds,
} from '../klra';
import { DEPARTING_BANDS, KC_MSG, LIMITS, REVIEW_KINDS, SME_AVAILABILITY, SME_KINDS, SYSTEM_FAMILIES, TEMPLATE_IDS, assetText, between, restrictedGuidance, reviewState, wordCount, type KeyPoint } from '../capture';
import type { Suggestion } from '../enrich';
import type { CaptureSessionView, KlraAction, KlraPosition, KlraRow, M24Rpc, QueueAsset, ReviewView } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const isoDay = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const uniq = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.filter((x) => typeof x === 'string'))] as string[] : null);

export function makeLocalM24(b: LocalBackend, h: LocalRpcHelpers): M24Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const today = () => todayIso();
  const person = (id: string | null | undefined) => get('people', id);
  const nameOf = (id: string | null | undefined) => { const p = person(id); return { en: p?.display_name ?? '', ar: p?.display_name_ar || p?.display_name || '' }; };
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !person(pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'knowledge', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const has = (levels: ('R' | 'W' | 'A' | 'Scope' | 'Agg')[]) => ctx().has('knowledge', levels);
  /** Does a given person (not the caller) hold one of these levels on a resource through an active role assignment? */
  const personHas = (pid: string, res: Resource, levels: string[]) =>
    raw('role_assignments').some((a) => a.person_id === pid && a.status === 'active' && (!a.expires_at || String(a.expires_at) >= today()) && levelsOf(a.role as PlatformRole, res).some((l) => levels.includes(l)));
  const thresholds = (): Thresholds => { const s = get('klra_settings', 'default'); return s ? { high: Number(s.high_threshold), medium: Number(s.medium_threshold) } : { ...DEFAULT_THRESHOLDS }; };
  const scopeAssignments = () => b.identity().assignments.filter((a) => a.status === 'active' && levelsOf(a.role, 'knowledge').includes('Scope'));
  /** KM owner (knowledge A) sees every position; a department head (knowledge Scope) the positions in scope. */
  const posVisible = (pos: Row) => has(['A']) || (pos.person_id ? ctx().inScope('knowledge', pos.person_id) : scopeAssignments().some((a) => coversPosition(a, pos)));
  const actingRole = () => (has(['A']) ? ctx().actingRole('knowledge', ['A']) : has(['Scope']) ? ctx().actingRole('knowledge', ['Scope']) : null);
  const assetsFor = (posId: string) => raw('knowledge_assets').filter((a) => a.position_id === posId && a.status === 'published').length;
  const posView = (p: Row): KlraPosition => ({
    id: p.id, person_id: p.person_id ?? null, role_id: p.role_id ?? null, family_id: p.family_id ?? null, department: p.department, kind: p.kind, title_en: p.title_en, title_ar: p.title_ar,
    holder_en: p.holder_en, holder_ar: p.holder_ar, retirement_band: p.retirement_band, contract_kind: p.contract_kind, contract_end_band: p.contract_end_band, criticality: p.criticality,
    spof_skill_ids: [...(p.spof_skill_ids ?? [])], codified_base: Number(p.codified_base), replace_months: Number(p.replace_months), feed_as_of: String(p.feed_as_of).slice(0, 10),
  });
  const actView = (a: Row): KlraAction => ({
    id: a.id, assessment_id: a.assessment_id, position_id: a.position_id, period: a.period, kind: a.kind, owner_role: a.owner_role, due_on: String(a.due_on).slice(0, 10), status: a.status,
    note: a.note ?? '', ref_table: a.ref_table ?? null, ref_id: a.ref_id ?? null, outcome: a.outcome ?? null, created_at: a.created_at, closed_at: a.closed_at ?? null, overdue: actionOverdue(a as never, today()),
  });
  const actionsOf = (assessmentId: string) => raw('klra_actions').filter((x) => x.assessment_id === assessmentId).sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : x.id < y.id ? -1 : 1));
  const rowView = (a: Row, pos: Row, t: Thresholds): KlraRow => {
    const acts = actionsOf(a.id);
    const band = bandOf(Number(a.total), t);
    return {
      id: a.id, period: a.period, position_id: a.position_id, department: a.department, attrition_factor: Number(a.attrition_factor), position_factor: Number(a.position_factor), total: Number(a.total),
      proposed_attrition: Number(a.proposed_attrition), proposed_position: Number(a.proposed_position), adjusted: !!a.adjusted, note: a.note ?? null, reasons: a.reasons ?? [], drivers: a.drivers ?? {},
      assessed_by_name: a.assessed_by_name, assessed_by_name_ar: a.assessed_by_name_ar, assessed_at: a.assessed_at,
      band, mitigation: mitigationState(band, a.period, acts as never, today()), position: posView(pos), actions: acts.map(actView),
    };
  };
  const sortRows = (rows: KlraRow[]) => rows.sort((x, y) => y.total - x.total || (x.position_id < y.position_id ? -1 : 1));
  // content screening shared with M22 communities (security, safeguards, cyber floor + refusal policies; contact details)
  const policies = () => raw('refusal_policies').map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const screen = (text: string): { code: string; msg: string } | null => {
    const cat = postGuard(text, policies());
    if (cat) return { code: 'restricted_content', msg: restrictedGuidance(cat) };
    if (hasContactDetails(text)) return { code: 'contact_details', msg: KC_MSG.contact };
    return null;
  };
  const secComps = () => new Set(raw('competencies').filter((c) => c.domain === 'security').map((c) => c.id));
  const okSkills = (ids: string[] | null, max: number) => {
    if (!ids || ids.length > max) return false;
    const sec = secComps();
    return ids.every((id) => { const s = get('skills', id); return !!s && s.area !== 'security' && !sec.has(s.competency_id); });
  };
  const okStandards = (ids: string[] | null, max: number) => !!ids && ids.length <= max && ids.every((id) => { const q = get('qual_standards', id); return !!q && !q.security_restricted; });
  const sessionView = (s: Row): CaptureSessionView => ({
    id: s.id, sme_id: s.sme_id, interviewer_id: s.interviewer_id, created_by: s.created_by, template: s.template, title: s.title, lang: s.lang, status: s.status,
    planned_on: String(s.planned_on).slice(0, 10), held_on: s.held_on ? String(s.held_on).slice(0, 10) : null, duration_min: Number(s.duration_min), skill_ids: [...(s.skill_ids ?? [])], standard_ids: [...(s.standard_ids ?? [])],
    position_id: s.position_id ?? null, action_id: s.action_id ?? null, transcript: s.transcript ?? '', transcript_words: Number(s.transcript_words ?? 0), notes: s.notes ?? '', asset_id: s.asset_id ?? null,
    asset_status: s.asset_id ? get('knowledge_assets', s.asset_id)?.status ?? null : null, sme_name: s.sme_name, sme_name_ar: s.sme_name_ar, interviewer_name: s.interviewer_name, interviewer_name_ar: s.interviewer_name_ar,
    created_at: s.created_at, updated_at: s.updated_at,
  });
  const hist = (status: string, note: string | null = null) => ({ at: nowTs(), status, by: me(), note });

  return {
    // ───────────────────────────── F20
    async klraRegister(period) {
      await b.whenReady();
      const t = thresholds();
      const current = quarterOfIso(today());
      const p = validPeriod(period) ? (period as string) : current;
      const mode = !me() ? 'none' : has(['A']) ? 'all' : has(['Scope']) ? 'scope' : has(['Agg']) ? 'agg' : 'none';
      const base = { mode, period: p, current, quarter_end: quarterEndIso(p), thresholds: t, rows: [] as KlraRow[], pending: [] as KlraPosition[] };
      if (mode === 'none' || mode === 'agg') return { ...base, periods: [current] } as never;
      const pos = new Map(raw('klra_positions').filter(posVisible).map((x) => [x.id, x]));
      const asses = raw('klra_assessments').filter((a) => pos.has(a.position_id));
      const periods = [...new Set([current, ...asses.map((a) => a.period)])].sort();
      const rows = sortRows(asses.filter((a) => a.period === p).map((a) => rowView(a, pos.get(a.position_id)!, t)));
      const done = new Set(rows.map((r) => r.position_id));
      const pending = p === current ? [...pos.values()].filter((x) => x.active && !done.has(x.id)).sort((x, y) => (x.id < y.id ? -1 : 1)).map(posView) : [];
      return { ...base, periods, rows, pending } as never;
    },

    async klraHeatmap(period) {
      await b.whenReady();
      if (!me() || !has(['A', 'Scope', 'Agg'])) return null;
      const p = validPeriod(period) ? (period as string) : quarterOfIso(today());
      return computeHeatmap(raw('klra_assessments') as never, raw('klra_actions') as never, thresholds(), p);
    },

    async klraPosition(positionId) {
      await b.whenReady();
      const pos = get('klra_positions', positionId);
      if (!me() || !pos || !posVisible(pos)) return null;
      const t = thresholds();
      const prop = proposeFactors(pos as PositionLite, assetsFor(pos.id));
      const history = raw('klra_assessments').filter((a) => a.position_id === pos.id).sort((x, y) => (x.period < y.period ? 1 : -1)).map((a) => rowView(a, pos, t));
      const assets = raw('knowledge_assets').filter((a) => a.position_id === pos.id).sort((x, y) => (x.id < y.id ? -1 : 1)).map((a) => ({ id: a.id, title_en: a.title_en, title_ar: a.title_ar, status: a.status }));
      const sessions = raw('capture_sessions').filter((s) => s.position_id === pos.id).sort((x, y) => (x.id < y.id ? -1 : 1)).map((s) => ({ id: s.id, title: s.title, status: s.status, planned_on: String(s.planned_on).slice(0, 10) }));
      return { position: posView(pos), thresholds: t, current: quarterOfIso(today()), proposal: { attrition: prop.attrition, position: prop.position, total: prop.total, drivers: prop.drivers, reasons: prop.reasons }, history, assets, sessions };
    },

    async assessPosition(input) {
      await b.whenReady();
      type R = { id: string; total: number; band: 'high' | 'medium' | 'low' };
      const pid = str(input?.position_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('klra.assess', 'klra_assessments', pid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KLRA_MSG.not_signed_in);
      const role = actingRole();
      if (!role) return refuse('forbidden', KLRA_MSG.forbidden);
      const pos = get('klra_positions', pid);
      if (!pos || !posVisible(pos)) return refuse('not_found', KLRA_MSG.not_found, role);
      if (!pos.active) return refuse('invalid', KLRA_MSG.inactive, role);
      const a = input?.attrition_factor, p = input?.position_factor;
      if (!validFactor(a) || !validFactor(p)) return refuse('invalid', KLRA_MSG.factors, role);
      const note = str(input?.note);
      if (note.length > LIMITS.NOTE_MAX) return refuse('invalid', KLRA_MSG.note_long, role);
      const prop = proposeFactors(pos as PositionLite, assetsFor(pos.id));
      const adjusted = a !== prop.attrition || p !== prop.position;
      if (adjusted && note.length < 10) return refuse('note_required', KLRA_MSG.note_required, role);
      const period = quarterOfIso(today());
      const id = `klra:${period}:${pos.id}`;
      const n = nameOf(who);
      const row = {
        period, position_id: pos.id, person_id: pos.person_id ?? null, department: pos.department, attrition_factor: a, position_factor: p, total: (a as number) * (p as number),
        proposed_attrition: prop.attrition, proposed_position: prop.position, adjusted, note: note || null, reasons: assessmentReasons(prop, a as number, p as number), drivers: prop.drivers,
        assessed_by: who, assessed_by_name: n.en, assessed_by_name_ar: n.ar, assessed_at: nowTs(), open_read: false,
      };
      if (get('klra_assessments', id)) upd('klra_assessments', id, row); else ins('klra_assessments', { id, ...row });
      const total = (a as number) * (p as number);
      const band = bandOf(total, thresholds());
      return h.done<R>('klra.assess', 'klra_assessments', id, `${a}x${p}=${total}${adjusted ? ' adjusted' : ''}`, role, null, '', 'Assessment saved', { id, total, band }, ['klra_assessments']);
    },

    async reassessQuarter(period) {
      await b.whenReady();
      type R = { period: string; created: number; skipped: number };
      const current = quarterOfIso(today());
      const p = period == null || period === '' ? current : String(period);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('klra.reassess', 'klra_assessments', p, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KLRA_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', KLRA_MSG.forbidden_owner);
      const role = ctx().actingRole('knowledge', ['A']);
      if (p !== current) return refuse('closed_period', KLRA_MSG.closed_period, role);
      const n = nameOf(who);
      let created = 0, skipped = 0;
      for (const pos of raw('klra_positions').filter((x) => x.active).sort((x, y) => (x.id < y.id ? -1 : 1))) {
        const id = `klra:${p}:${pos.id}`;
        if (get('klra_assessments', id)) { skipped++; continue; }
        const prop = proposeFactors(pos as PositionLite, assetsFor(pos.id));
        ins('klra_assessments', {
          id, period: p, position_id: pos.id, person_id: pos.person_id ?? null, department: pos.department, attrition_factor: prop.attrition, position_factor: prop.position, total: prop.total,
          proposed_attrition: prop.attrition, proposed_position: prop.position, adjusted: false, note: null, reasons: prop.reasons, drivers: prop.drivers,
          assessed_by: who, assessed_by_name: n.en, assessed_by_name_ar: n.ar, assessed_at: nowTs(), open_read: false,
        });
        created++;
      }
      return h.done<R>('klra.reassess', 'klra_assessments', p, `${created} assessed, ${skipped} already assessed`, role, 'kafaa.klra.reassess', `KLRA ${p}: ${created} positions assessed`, `${created} positions assessed for ${p}`, { period: p, created, skipped }, ['klra_assessments']);
    },

    async planMitigation(input) {
      await b.whenReady();
      type R = { id: string };
      const aid = str(input?.assessment_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('klra.mitigate', 'klra_actions', aid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KLRA_MSG.not_signed_in);
      const role = actingRole();
      if (!role) return refuse('forbidden', KLRA_MSG.forbidden);
      const a = get('klra_assessments', aid);
      const pos = a ? get('klra_positions', a.position_id) : undefined;
      if (!a || !pos || !posVisible(pos)) return refuse('not_found', KLRA_MSG.assessment_not_found, role);
      if (!(ACTION_KINDS as readonly string[]).includes(input?.kind)) return refuse('invalid', KLRA_MSG.kind, role);
      if (!(OWNER_ROLES as readonly string[]).includes(input?.owner_role)) return refuse('invalid', KLRA_MSG.owner, role);
      const due = input?.due_on;
      if (!isoDay(due) || due < today() || due > addDaysIso(today(), 365)) return refuse('invalid', KLRA_MSG.due, role);
      const note = str(input?.note);
      if (note.length > LIMITS.NOTE_MAX) return refuse('invalid', KLRA_MSG.note_long, role);
      if (raw('klra_actions').some((x) => x.assessment_id === aid && x.kind === input.kind && OPEN_ACTION.includes(x.status))) return refuse('conflict', KLRA_MSG.duplicate, role);
      const id = rid('ka');
      ins('klra_actions', { id, assessment_id: aid, position_id: pos.id, person_id: pos.person_id ?? null, period: a.period, kind: input.kind, owner_role: input.owner_role, due_on: due, status: 'planned', note, ref_table: null, ref_id: null, outcome: null, created_by: who, created_at: nowTs(), closed_by: null, closed_at: null, open_read: false });
      return h.done<R>('klra.mitigate', 'klra_actions', id, `${input.kind} for ${pos.id}`, role, null, '', 'Mitigation action planned', { id }, ['klra_actions']);
    },

    async closeAction(id, outcome, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('klra.action.close', 'klra_actions', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KLRA_MSG.not_signed_in);
      const role = actingRole();
      if (!role) return refuse('forbidden', KLRA_MSG.forbidden);
      const x = get('klra_actions', id);
      const pos = x ? get('klra_positions', x.position_id) : undefined;
      if (!x || !pos || !posVisible(pos)) return refuse('not_found', KLRA_MSG.action_not_found, role);
      if (!OPEN_ACTION.includes(x.status)) return refuse('invalid', KLRA_MSG.not_open, role);
      if (outcome !== 'done' && outcome !== 'cancelled') return refuse('invalid', KLRA_MSG.outcome, role);
      const text = str(note);
      if (text.length > LIMITS.NOTE_MAX) return refuse('invalid', KLRA_MSG.note_long, role);
      if (outcome === 'cancelled' && text.length < 5) return refuse('invalid', KLRA_MSG.cancel_note, role);
      upd('klra_actions', id, { status: outcome, outcome: text || null, closed_by: who, closed_at: nowTs() });
      return h.done<R>('klra.action.close', 'klra_actions', id, outcome, role, null, '', outcome === 'done' ? 'Action closed as done' : 'Action cancelled', { status: outcome }, ['klra_actions']);
    },

    async setKlraThresholds(high, medium) {
      await b.whenReady();
      type R = Thresholds;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('klra.thresholds', 'klra_settings', 'default', code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KLRA_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', KLRA_MSG.forbidden_owner);
      const role = ctx().actingRole('knowledge', ['A']);
      if (!validThresholds(high, medium)) return refuse('invalid', KLRA_MSG.thresholds, role);
      const cur = get('klra_settings', 'default');
      const entry = { at: nowTs(), by: who, high, medium };
      if (cur) upd('klra_settings', 'default', { high_threshold: high, medium_threshold: medium, updated_by: who, updated_at: nowTs(), history: [...(cur.history ?? []), entry] });
      else ins('klra_settings', { id: 'default', high_threshold: high, medium_threshold: medium, updated_by: who, updated_at: nowTs(), history: [entry], open_read: false });
      return h.done<R>('klra.thresholds', 'klra_settings', 'default', `high ${high}, medium ${medium}`, role, 'kafaa.klra.thresholds', `KLRA thresholds set: high >= ${high}, medium >= ${medium}`, 'Thresholds saved', { high, medium }, ['klra_settings', 'klra_assessments']);
    },

    // ───────────────────────────── F21
    async setSmeProfile(input) {
      await b.whenReady();
      type R = { id: string; listed: boolean };
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.sme', 'sme_profiles', who ? `sme:${who}` : null, code, msg, role);
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', KC_MSG.forbidden);
      if (!(SME_KINDS as readonly string[]).includes(input?.kind)) return refuse('invalid', KC_MSG.sme_kind, role);
      if (!(SME_AVAILABILITY as readonly string[]).includes(input?.availability)) return refuse('invalid', KC_MSG.availability, role);
      if (!(DEPARTING_BANDS as readonly string[]).includes(input?.departing_band)) return refuse('invalid', KC_MSG.band, role);
      const skills = uniq(input?.skill_ids);
      if (!skills || !skills.length || !okSkills(skills, LIMITS.SKILLS)) return refuse('invalid', KC_MSG.skills, role);
      const headline = str(input?.headline);
      if (headline.length > LIMITS.HEADLINE_MAX) return refuse('invalid', KC_MSG.headline, role);
      const bad = headline ? screen(headline) : null;
      if (bad) return refuse(bad.code, bad.msg, role);
      const id = `sme:${who}`;
      const p = person(who)!;
      const n = nameOf(who);
      const row = { person_id: who, kind: input.kind, skill_ids: skills, availability: input.availability, departing_band: input.departing_band, listed: input.listed === true, headline, person_name: n.en, person_name_ar: n.ar, role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null, updated_at: nowTs() };
      if (get('sme_profiles', id)) upd('sme_profiles', id, row); else ins('sme_profiles', { id, ...row });
      return h.done<R>('knowledge.sme', 'sme_profiles', id, input.listed === true ? 'listed' : 'not listed', role, null, '', 'SME profile saved', { id, listed: input.listed === true }, ['sme_profiles']);
    },

    async planCapture(input) {
      await b.whenReady();
      type R = { id: string };
      const sme = str(input?.sme_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.capture.plan', 'capture_sessions', sme || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['R'])) return refuse('forbidden', KC_MSG.forbidden);
      const sp = person(sme);
      if (!sp || sp.status !== 'active' || (sp.kind !== 'staff' && sp.kind !== 'contractor')) return refuse('not_found', KC_MSG.sme_not_found);
      const role = has(['W', 'A']) ? ctx().actingRole('knowledge', ['W', 'A']) : has(['Scope']) && ctx().inScope('knowledge', sme) ? ctx().actingRole('knowledge', ['Scope']) : null;
      if (!role) return refuse('forbidden', KC_MSG.forbidden_plan);
      const iv = str(input?.interviewer_id) || who;
      const ip = person(iv);
      if (iv === sme || !ip || ip.status !== 'active' || ip.kind !== 'staff' || !personHas(iv, 'knowledge', ['W', 'A', 'Scope'])) return refuse('invalid', KC_MSG.interviewer, role);
      if (!(TEMPLATE_IDS as readonly string[]).includes(input?.template)) return refuse('invalid', KC_MSG.template, role);
      if (!isoDay(input?.planned_on) || input.planned_on < today() || input.planned_on > addDaysIso(today(), LIMITS.PLAN_DAYS)) return refuse('invalid', KC_MSG.planned_on, role);
      const title = str(input?.title);
      if (!between(title, LIMITS.TITLE)) return refuse('invalid', KC_MSG.title, role);
      const bad = screen(title);
      if (bad) return refuse(bad.code, bad.msg, role);
      const skills = uniq(input?.skill_ids ?? []);
      if (!okSkills(skills, LIMITS.SKILLS)) return refuse('invalid', KC_MSG.skills, role);
      const stds = uniq(input?.standard_ids ?? []);
      if (!okStandards(stds, LIMITS.STANDARDS)) return refuse('invalid', KC_MSG.standards, role);
      const posId = str(input?.position_id) || null;
      if (posId) { const pos = get('klra_positions', posId); if (!pos || !posVisible(pos)) return refuse('not_found', KLRA_MSG.not_found, role); }
      const actId = str(input?.action_id) || null;
      let act: Row | undefined;
      if (actId) {
        act = get('klra_actions', actId);
        if (!act || !OPEN_ACTION.includes(act.status) || !['capture', 'documentation'].includes(act.kind) || (posId && act.position_id !== posId) || !posVisible(get('klra_positions', act.position_id) ?? {})) return refuse('not_found', KC_MSG.action_not_found, role);
      }
      const id = rid('cs');
      const ts = nowTs();
      const sn = nameOf(sme), inn = nameOf(iv);
      ins('capture_sessions', {
        id, sme_id: sme, interviewer_id: iv, created_by: who, template: input.template, title, lang: input?.lang === 'ar' ? 'ar' : 'en', status: 'planned', planned_on: input.planned_on, held_on: null, duration_min: 60,
        skill_ids: skills, standard_ids: stds, position_id: posId ?? act?.position_id ?? null, action_id: actId, transcript: '', transcript_words: 0, notes: '', asset_id: null,
        sme_name: sn.en, sme_name_ar: sn.ar, interviewer_name: inn.en, interviewer_name_ar: inn.ar, history: [hist('planned')], created_at: ts, updated_at: ts,
      });
      if (act) upd('klra_actions', act.id, { status: 'in_progress', ref_table: 'capture_sessions', ref_id: id });
      if (!get('sme_profiles', `sme:${sme}`)) ins('sme_profiles', { id: `sme:${sme}`, person_id: sme, kind: 'staff', skill_ids: skills, availability: 'available', departing_band: 'unspecified', listed: false, headline: '', person_name: sn.en, person_name_ar: sn.ar, role_id: sp.job_role_id ?? null, family_id: sp.job_family_id ?? null, updated_at: ts });
      notify(`nt-${id}-sme`, sme, `Knowledge capture interview planned: ${title}`, `تم التخطيط لمقابلة لحفظ المعرفة: ${title}`, `/knowledge/capture/${id}`);
      if (iv !== who) notify(`nt-${id}-iv`, iv, `You will interview ${sn.en}: ${title}`, `ستجري مقابلة مع ${sn.ar}: ${title}`, `/knowledge/capture/${id}`);
      return h.done<R>('knowledge.capture.plan', 'capture_sessions', id, `${input.template} with ${sme}`, role, null, '', 'Capture session planned', { id }, ['capture_sessions', 'klra_actions', 'sme_profiles', 'notifications']);
    },

    async recordCapture(id, input) {
      await b.whenReady();
      type R = { status: string; words: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.capture.record', 'capture_sessions', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      const s = get('capture_sessions', id);
      if (!s) return refuse('not_found', KC_MSG.session_not_found);
      const owner = has(['A']);
      if (!(owner || s.sme_id === who || s.interviewer_id === who)) return refuse('forbidden', KC_MSG.not_participant);
      const role = owner ? ctx().actingRole('knowledge', ['A']) : ctx().actingRole('knowledge', ['R']);
      const to = input?.status;
      const ok = (to === 'cancelled' && ['planned', 'held'].includes(s.status)) || (to === 'held' && s.status === 'planned') || (to === 'transcribed' && ['planned', 'held'].includes(s.status));
      if (!ok) return refuse('invalid', KC_MSG.transition, role);
      const notes = input?.notes == null ? s.notes ?? '' : str(input.notes);
      if (notes.length > LIMITS.NOTE_MAX) return refuse('invalid', KC_MSG.notes, role);
      const patch: Row = { status: to, notes, updated_at: nowTs(), history: [...(s.history ?? []), hist(to)] };
      if (to === 'held' || to === 'transcribed') {
        const held = input?.held_on || s.held_on || (String(s.planned_on).slice(0, 10) <= today() ? String(s.planned_on).slice(0, 10) : null) || today();
        if (!isoDay(held) || held > today()) return refuse('invalid', KC_MSG.held_on, role);
        patch.held_on = held;
      }
      let words = Number(s.transcript_words ?? 0);
      if (to === 'transcribed') {
        const tr = typeof input?.transcript === 'string' ? input.transcript.trim() : '';
        if (!between(tr, LIMITS.TRANSCRIPT)) return refuse('invalid', KC_MSG.transcript, role);
        const bad = screen(tr);
        if (bad) return refuse(bad.code, bad.msg, role);
        words = wordCount(tr);
        patch.transcript = tr;
        patch.transcript_words = words;
      }
      upd('capture_sessions', id, patch);
      return h.done<R>('knowledge.capture.record', 'capture_sessions', id, to, role, null, '', to === 'transcribed' ? 'Transcript uploaded' : to === 'held' ? 'Session marked as held' : 'Session cancelled', { status: to, words }, ['capture_sessions']);
    },

    async captureBoard() {
      await b.whenReady();
      const who = me();
      if (!who) return { mode: 'mine', can_plan: false, sessions: [] };
      const all = has(['A']);
      const sessions = raw('capture_sessions').filter((s) => all || s.sme_id === who || s.interviewer_id === who || s.created_by === who)
        .sort((x, y) => (x.planned_on < y.planned_on ? 1 : x.planned_on > y.planned_on ? -1 : x.id < y.id ? -1 : 1)).map(sessionView);
      return { mode: all ? 'all' : 'mine', can_plan: has(['W', 'A', 'Scope']), sessions };
    },

    async submitAsset(input) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.submit', 'knowledge_assets', str(input?.id) || str(input?.session_id) || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['R'])) return refuse('forbidden', KC_MSG.forbidden);
      const isSme = !!get('sme_profiles', `sme:${who}`);
      const role = has(['W', 'A']) ? ctx().actingRole('knowledge', ['W', 'A']) : isSme ? ctx().actingRole('knowledge', ['R']) : null;
      if (!role) return refuse('forbidden', KC_MSG.forbidden_author);
      const existing = str(input?.id) ? get('knowledge_assets', str(input.id)) : undefined;
      if (str(input?.id) && !existing) return refuse('not_found', KC_MSG.asset_not_found, role);
      if (existing && existing.author_id !== who) return refuse('forbidden', KC_MSG.not_author, role);
      if (existing && existing.status !== 'draft') return refuse('invalid', KC_MSG.not_editable, role);
      const sid = str(input?.session_id) || existing?.source_session_id || null;
      const sess = sid ? get('capture_sessions', sid) : undefined;
      if (sid && (!sess || !(sess.sme_id === who || sess.interviewer_id === who) || sess.status !== 'transcribed' || (sess.asset_id && sess.asset_id !== existing?.id))) return refuse('invalid', KC_MSG.session_state, role);
      const v = { title_en: str(input?.title_en), title_ar: str(input?.title_ar), summary_en: str(input?.summary_en), summary_ar: str(input?.summary_ar), body: str(input?.body) };
      if (!between(v.title_en, LIMITS.TITLE) || !between(v.title_ar, LIMITS.TITLE)) return refuse('invalid', KC_MSG.title, role);
      if (!between(v.summary_en, LIMITS.SUMMARY) || !between(v.summary_ar, LIMITS.SUMMARY)) return refuse('invalid', KC_MSG.summary, role);
      if (!between(v.body, LIMITS.BODY)) return refuse('invalid', KC_MSG.body, role);
      const kp = Array.isArray(input?.key_points) ? input.key_points : null;
      if (!kp || kp.length < LIMITS.KEY_POINTS[0] || kp.length > LIMITS.KEY_POINTS[1] || kp.some((k) => !k || !between(k.en, [1, LIMITS.KEY_POINT_MAX]) || !between(k.ar, [1, LIMITS.KEY_POINT_MAX]))) return refuse('invalid', KC_MSG.key_points, role);
      const points: KeyPoint[] = kp.map((k) => ({ en: k.en.trim(), ar: k.ar.trim() }));
      const skills = uniq(input?.skill_ids ?? []);
      if (!okSkills(skills, LIMITS.SKILLS)) return refuse('invalid', KC_MSG.skills, role);
      const stds = uniq(input?.standard_ids ?? []);
      if (!okStandards(stds, LIMITS.STANDARDS)) return refuse('invalid', KC_MSG.standards, role);
      if (!(SYSTEM_FAMILIES as readonly string[]).includes(input?.system_family)) return refuse('invalid', KC_MSG.family, role);
      const bad = screen(assetText({ ...v, key_points: points }));
      if (bad) return refuse(bad.code, bad.msg, role);
      const refOk = (k: string, r: string) => !!get(k === 'skill' ? 'skills' : k === 'oe' ? 'oe_lessons' : 'courses', r) && (k !== 'skill' || okSkills([r], 1));
      const sugg: Suggestion[] = (Array.isArray(input?.suggestions) ? input.suggestions : [])
        .filter((s) => s && ['skill', 'oe', 'course'].includes(s.kind) && typeof s.ref === 'string' && refOk(s.kind, s.ref))
        .slice(0, LIMITS.SUGGESTIONS)
        .map((s) => ({ kind: s.kind, ref: s.ref, score: typeof s.score === 'number' && Number.isFinite(s.score) ? Math.round(s.score * 100) / 100 : 0, terms: (Array.isArray(s.terms) ? s.terms : []).filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 40)), decision: 'pending' as const }));
      const submit = input?.submit === true;
      const ts = nowTs();
      const status = submit ? 'review' : 'draft';
      const an = nameOf(who);
      const smeId = sess?.sme_id ?? existing?.sme_id ?? who;
      const sn = nameOf(smeId);
      const id = existing?.id ?? rid('kas');
      const row = {
        ...v, body_lang: input?.body_lang === 'ar' ? 'ar' : 'en', key_points: points, skill_ids: skills, standard_ids: stds, system_family: input.system_family, status, published: false, suggestions: sugg,
        source_session_id: sid, position_id: sess?.position_id ?? existing?.position_id ?? null, template: sess?.template ?? existing?.template ?? null,
        sme_id: smeId, sme_name: sn.en, sme_name_ar: sn.ar, updated_at: ts,
      };
      if (existing) {
        const reviewed = raw('asset_reviews').filter((r) => r.asset_id === id && !r.superseded);
        for (const r of reviewed) upd('asset_reviews', r.id, { superseded: true });
        upd('knowledge_assets', id, { ...row, version: Number(existing.version) + (submit && existing.submitted_at ? 1 : 0), submitted_at: submit ? ts : existing.submitted_at ?? null });
      } else {
        ins('knowledge_assets', {
          id, ...row, requal_standard_ids: [], oe_ids: [], course_ids: [], reviewers: [], author_id: who, author_name: an.en, author_name_ar: an.ar, used_by: 0, version: 1,
          submitted_at: submit ? ts : null, published_at: null, published_by: null, withdrawn_at: null, withdrawn_reason: null, created_at: ts,
        });
      }
      if (sess) upd('capture_sessions', sess.id, { asset_id: id, updated_at: ts });
      return h.done<R>('knowledge.asset.submit', 'knowledge_assets', id, status, role, null, '', submit ? 'Sent for review: a technical review and a security and content check' : 'Draft saved', { id, status }, ['knowledge_assets', 'asset_reviews', 'capture_sessions']);
    },

    async reviewQueue() {
      await b.whenReady();
      if (!me() || !has(['W', 'A'])) return { can_review: false, can_publish: false, items: [] };
      const items: QueueAsset[] = raw('knowledge_assets').filter((a) => a.status === 'review')
        .sort((x, y) => (String(x.submitted_at) < String(y.submitted_at) ? -1 : String(x.submitted_at) > String(y.submitted_at) ? 1 : x.id < y.id ? -1 : 1))
        .map((a) => ({
          id: a.id, title_en: a.title_en, title_ar: a.title_ar, summary_en: a.summary_en, summary_ar: a.summary_ar, body: a.body, body_lang: a.body_lang, key_points: a.key_points ?? [],
          skill_ids: [...(a.skill_ids ?? [])], standard_ids: [...(a.standard_ids ?? [])], oe_ids: [...(a.oe_ids ?? [])], course_ids: [...(a.course_ids ?? [])], system_family: a.system_family, status: a.status,
          suggestions: a.suggestions ?? [], author_id: a.author_id, sme_id: a.sme_id, author_name: a.author_name, author_name_ar: a.author_name_ar, sme_name: a.sme_name, sme_name_ar: a.sme_name_ar,
          template: a.template ?? null, source_session_id: a.source_session_id ?? null, version: Number(a.version), submitted_at: a.submitted_at ?? null,
          reviews: raw('asset_reviews').filter((r) => r.asset_id === a.id).sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : x.id < y.id ? -1 : 1))
            .map((r): ReviewView => ({ id: r.id, reviewer_id: r.reviewer_id, reviewer_name: r.reviewer_name, reviewer_name_ar: r.reviewer_name_ar, kind: r.kind, outcome: r.outcome, note: r.note ?? '', checks: r.checks ?? {}, created_at: r.created_at, superseded: !!r.superseded })),
        }));
      return { can_review: true, can_publish: has(['A']), items };
    },

    async reviewAsset(input) {
      await b.whenReady();
      type R = { id: string; status: string };
      const aid = str(input?.asset_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.review', 'knowledge_assets', aid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['W', 'A'])) return refuse('forbidden', KC_MSG.forbidden_review);
      const role = ctx().actingRole('knowledge', ['W', 'A']);
      const a = get('knowledge_assets', aid);
      if (!a) return refuse('not_found', KC_MSG.asset_not_found, role);
      if (a.status !== 'review') return refuse('invalid', KC_MSG.not_in_review, role);
      if (a.author_id === who || a.sme_id === who) return refuse('maker_checker', KC_MSG.own_asset, role);
      if (!(REVIEW_KINDS as readonly string[]).includes(input?.kind)) return refuse('invalid', KC_MSG.review_kind, role);
      if (input?.outcome !== 'pass' && input?.outcome !== 'changes') return refuse('invalid', KC_MSG.review_outcome, role);
      const note = str(input?.note);
      if (note.length > LIMITS.NOTE_MAX) return refuse('invalid', KC_MSG.notes, role);
      if (input.outcome === 'changes' && note.length < 10) return refuse('invalid', KC_MSG.review_note, role);
      if (raw('asset_reviews').some((r) => r.asset_id === aid && r.reviewer_id === who && !r.superseded)) return refuse('conflict', KC_MSG.already_reviewed, role);
      const checks = { accurate: input?.checks?.accurate === true, deidentified: input?.checks?.deidentified === true, no_security: input?.checks?.no_security === true };
      const sugg: Suggestion[] = a.suggestions ?? [];
      const dec = input?.decisions && typeof input.decisions === 'object' ? input.decisions : {};
      const keyOf = (s: Suggestion) => `${s.kind}:${s.ref}`;
      if (input.outcome === 'pass' && input.kind === 'security') {
        if (!checks.deidentified || !checks.no_security) return refuse('invalid', KC_MSG.security_checks, role);
        const bad = screen(assetText(a as never));
        if (bad) return refuse(bad.code, bad.msg, role);
      }
      if (input.outcome === 'pass' && input.kind === 'technical' && (!checks.accurate || sugg.some((s) => dec[keyOf(s)] !== 'accepted' && dec[keyOf(s)] !== 'rejected'))) return refuse('invalid', KC_MSG.technical_checks, role);
      const decisions: Record<string, string> = {};
      if (input.kind === 'technical') for (const s of sugg) if (dec[keyOf(s)] === 'accepted' || dec[keyOf(s)] === 'rejected') decisions[keyOf(s)] = dec[keyOf(s)] as string;
      const id = rid('arv');
      const n = nameOf(who);
      ins('asset_reviews', { id, asset_id: aid, asset_author_id: a.author_id, reviewer_id: who, kind: input.kind, outcome: input.outcome, note, checks, decisions, reviewer_name: n.en, reviewer_name_ar: n.ar, superseded: false, version: Number(a.version), created_at: nowTs() });
      const patch: Row = { updated_at: nowTs() };
      if (input.kind === 'technical' && Object.keys(decisions).length) {
        const next = sugg.map((s) => (decisions[keyOf(s)] ? { ...s, decision: decisions[keyOf(s)] } : s));
        const acc = (k: string) => next.filter((s) => s.kind === k && s.decision === 'accepted').map((s) => s.ref);
        patch.suggestions = next;
        patch.skill_ids = [...new Set([...(a.skill_ids ?? []), ...acc('skill')])];
        patch.oe_ids = [...new Set([...(a.oe_ids ?? []), ...acc('oe')])];
        patch.course_ids = [...new Set([...(a.course_ids ?? []), ...acc('course')])];
      }
      if (input.outcome === 'changes') patch.status = 'draft';
      upd('knowledge_assets', aid, patch);
      const status = input.outcome === 'changes' ? 'draft' : 'review';
      if (input.outcome === 'changes') notify(`nt-${id}`, a.author_id, `Changes requested on "${a.title_en}"`, `مطلوب تعديلات على "${a.title_ar}"`, '/knowledge/capture', 'warn');
      return h.done<R>('knowledge.asset.review', 'knowledge_assets', aid, `${input.kind}:${input.outcome}`, role, null, '', input.outcome === 'pass' ? 'Review recorded' : 'Sent back to the author with your changes', { id, status }, ['asset_reviews', 'knowledge_assets', 'notifications']);
    },

    async publishAsset(id) {
      await b.whenReady();
      type R = { status: string; action_closed: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.publish', 'knowledge_assets', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', KC_MSG.forbidden_publish);
      const role = ctx().actingRole('knowledge', ['A']);
      const a = get('knowledge_assets', id);
      if (!a) return refuse('not_found', KC_MSG.asset_not_found, role);
      if (a.status !== 'review') return refuse('invalid', KC_MSG.not_in_review, role);
      if (a.author_id === who || a.sme_id === who) return refuse('maker_checker', KC_MSG.own_asset, role);
      const st = reviewState(raw('asset_reviews').filter((r) => r.asset_id === id) as never, a.author_id, a.sme_id);
      if (!st.ready) return refuse('reviews_missing', KC_MSG.reviews_missing, role);
      const bad = screen(assetText(a as never));
      if (bad) return refuse(bad.code, bad.msg, role);
      const ts = nowTs();
      upd('knowledge_assets', id, { status: 'published', published: true, reviewers: [st.technical!.reviewer_id, st.security!.reviewer_id], published_at: ts, published_by: who, updated_at: ts });
      let closed: string | null = null;
      const sess = a.source_session_id ? get('capture_sessions', a.source_session_id) : undefined;
      const act = sess?.action_id ? get('klra_actions', sess.action_id) : undefined;
      if (act && OPEN_ACTION.includes(act.status)) { upd('klra_actions', act.id, { status: 'done', outcome: `Knowledge asset published: ${id}`, closed_by: who, closed_at: ts }); closed = act.id; }
      notify(`nt-${id}-published`, a.author_id, `Published: ${a.title_en}`, `تم النشر: ${a.title_ar}`, `/knowledge/assets/${id}`, 'ok');
      if (a.sme_id !== a.author_id) notify(`nt-${id}-published-sme`, a.sme_id, `Your knowledge was published: ${a.title_en}`, `تم نشر معرفتك: ${a.title_ar}`, `/knowledge/assets/${id}`, 'ok');
      return h.done<R>('knowledge.asset.publish', 'knowledge_assets', id, `reviewers ${st.technical!.reviewer_id}, ${st.security!.reviewer_id}`, role, 'kafaa.knowledge.publish', `Knowledge asset ${id} published`, 'Published to the knowledge base', { status: 'published', action_closed: closed }, ['knowledge_assets', 'klra_actions', 'notifications']);
    },

    async withdrawAsset(id, reason) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.withdraw', 'knowledge_assets', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      const a = get('knowledge_assets', id);
      if (!a || !(a.published || a.author_id === who || a.sme_id === who || has(['A']))) return refuse('not_found', KC_MSG.asset_not_found);
      if (!(has(['A']) || a.author_id === who)) return refuse('forbidden', KC_MSG.forbidden_withdraw);
      const role = has(['A']) ? ctx().actingRole('knowledge', ['A']) : ctx().actingRole('knowledge', ['R']);
      if (a.status !== 'published') return refuse('invalid', KC_MSG.not_published, role);
      const text = str(reason);
      if (!between(text, LIMITS.REASON)) return refuse('invalid', KC_MSG.withdraw_reason, role);
      const ts = nowTs();
      upd('knowledge_assets', id, { status: 'withdrawn', published: false, withdrawn_at: ts, withdrawn_reason: text, updated_at: ts });
      return h.done<R>('knowledge.asset.withdraw', 'knowledge_assets', id, text, role, 'kafaa.knowledge.withdraw', `Knowledge asset ${id} withdrawn`, 'Withdrawn: it no longer appears in search', { status: 'withdrawn' }, ['knowledge_assets']);
    },

    async attachAssetRequal(id, standardIds) {
      await b.whenReady();
      type R = { requal_standard_ids: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.requal', 'knowledge_assets', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['A'])) return refuse('forbidden', KC_MSG.forbidden_publish);
      const role = ctx().actingRole('knowledge', ['A']);
      const a = get('knowledge_assets', id);
      if (!a) return refuse('not_found', KC_MSG.asset_not_found, role);
      if (a.status !== 'published') return refuse('invalid', KC_MSG.not_published, role);
      const stds = uniq(standardIds);
      if (!okStandards(stds, LIMITS.REQUAL)) return refuse('invalid', KC_MSG.requal, role);
      upd('knowledge_assets', id, { requal_standard_ids: stds, updated_at: nowTs() });
      return h.done<R>('knowledge.asset.requal', 'knowledge_assets', id, (stds as string[]).join(',') || 'none', role, null, '', 'Read-before-requalification standards saved', { requal_standard_ids: stds as string[] }, ['knowledge_assets']);
    },

    async markAssetUsed(id) {
      await b.whenReady();
      type R = { used_by: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('knowledge.asset.use', 'knowledge_assets', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', KC_MSG.not_signed_in);
      if (!has(['R'])) return refuse('forbidden', KC_MSG.forbidden);
      const role = ctx().actingRole('knowledge', ['R']);
      const a = get('knowledge_assets', id);
      if (!a || !a.published) return refuse('not_found', KC_MSG.asset_not_found, role);
      const uid = `au:${id}:${who}`;
      if (!get('asset_uses', uid)) ins('asset_uses', { id: uid, asset_id: id, person_id: who, used_on: today() });
      const n = raw('asset_uses').filter((u) => u.asset_id === id).length;
      upd('knowledge_assets', id, { used_by: n });
      return h.done<R>('knowledge.asset.use', 'asset_uses', uid, null, role, null, '', 'Marked as used', { used_by: n }, ['asset_uses', 'knowledge_assets']);
    },
  };
}
