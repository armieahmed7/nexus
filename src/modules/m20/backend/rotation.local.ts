// F15 Rotations and job shadowing: LocalBackend RPC implementations (owner: W2 · E4). Spread into makeLocalM20 (backend/local.ts).
// 1:1 mirror of supabase/migrations/20261009124001_kafaa_w2e4_rotations.sql: same checks in the same order, the same refusal codes
// and messages (src/modules/m20/rotation.ts RMSG), the same audit rows and ledger rows. Change both together. Pages never import this.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import type { Level, PlatformRole } from '../../../auth/policy';
import { applySkills } from '../../../data/local/rpc.w0';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { lineManagerOf } from '../domain';
import {
  RMSG, RESTRICTED_FAMILIES, RESTRICTED_SKILL_AREAS, SITE_FAMILIES, SHADOW_MAX_OPEN,
  cleanObjectiveLevels, cleanProgress, computeBoard, consentAfter, dayNo, objectivesMet, ownerRoleOf, planPlacements, rotationEvidence,
  signerFor, skillLevels, computeCandidates, type RotationCandidate, validateHost, validateShadow, validateTemplate, type Objective, type RotationBoard, type Step,
} from '../rotation';
import type { F15Rpc } from './rpc';

type Placement = RowOf<'rotation_placements'>;
type Shadow = RowOf<'shadow_requests'>;
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : -1);
const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

export function makeLocalF15(b: LocalBackend, h: LocalRpcHelpers): F15Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const ownerRole = () => ownerRoleOf((r, lv) => ctx().roleGrant(r as PlatformRole, 'opportunities', lv as Level));
  const hostCtx = () => ({ people: b.raw('people') as never, assignments: b.raw('role_assignments') as never, today: todayIso() });
  const lm = (id: string) => lineManagerOf(id, b.raw('people') as never, b.raw('role_assignments') as never, todayIso());
  const notify = (id: string, person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad' = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind: 'rotation', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const shHist = (r: Shadow, status: string, note: string | null) => [...((r.history as unknown as unknown[]) ?? []), { at: nowTs(), status, by: me(), note }];
  const writeEvidence = async (refTable: 'rotation_placements' | 'shadow_requests', ref: { id: string; person_id: string }, levels: Record<string, number>, title: string) => {
    const today = todayIso();
    const ids: string[] = [];
    for (const [skill, level] of Object.entries(levels).sort(([x], [y]) => (x < y ? -1 : 1))) {
      const e = rotationEvidence(refTable, ref, skill, level, today, me()!, title);
      ids.push(e.id);
      if (b.rawGet('skill_evidence', e.id)) b.rawUpdate('skill_evidence', e.id, { level: e.level, observed_on: e.observed_on, active: true } as never);
      else b.rawInsert('skill_evidence', { ...e, created_at: nowTs() } as never);
    }
    await applySkills(b, ref.person_id, today);
    return ids;
  };

  return {
    async saveRotationTemplate(p) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.template', 'rotation_templates', p?.id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = ownerRole();
      if (!role) return refuse('forbidden', RMSG.forbidden_owner);
      const existing = p?.id ? b.rawGet('rotation_templates', p.id) : undefined;
      if (p?.id && (!existing || !ctx().canReadRow('rotation_templates', existing as never))) return refuse('not_found', RMSG.template_not_found, role);
      if (existing && existing.owner_id !== who && role !== 'training_manager') return refuse('forbidden', RMSG.forbidden_template, role);
      const v = validateTemplate(p, { skills: b.raw('skills') as never, families: b.raw('job_families').map((f) => f.id), roles: b.raw('job_roles').map((r) => r.id), sources: b.raw('sources').map((s) => s.id) }, hostCtx());
      if ('code' in v) return refuse(v.code, v.message, role);
      const status = p.status ?? 'active';
      const srcs = (p.source_ids ?? []).map((id) => { const s = b.rawGet('sources', id)!; return { id: s.id, label: s.label, url: s.url }; });
      const ts = nowTs();
      const row = {
        programme: p.programme as never, title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), summary_en: p.summary_en.trim(), summary_ar: p.summary_ar.trim(),
        duration_min_months: p.duration_min_months, duration_max_months: p.duration_max_months, steps: v.steps as never, eligible_families: [...(p.eligible_families ?? [])],
        sources: srcs as never, status: status as never, listed: status !== 'draft', updated_at: ts,
      };
      const id = existing?.id ?? `rt-${hex()}`;
      if (existing) b.rawUpdate('rotation_templates', id, row as never);
      else b.rawInsert('rotation_templates', { id, owner_id: who, created_at: ts, ...row } as never);
      return h.done<R>('rotation.template', 'rotation_templates', id, `${p.programme} ${status}`, role, null, '', existing ? 'Programme updated' : status === 'draft' ? 'Draft saved' : 'Programme saved', { id, status }, ['rotation_templates']);
    },

    async saveRotationCohort(p) {
      await b.whenReady();
      type R = { id: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.cohort', 'rotation_cohorts', p?.id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = ownerRole();
      if (!role) return refuse('forbidden', RMSG.forbidden_owner);
      const existing = p?.id ? b.rawGet('rotation_cohorts', p.id) : undefined;
      if (p?.id && (!existing || !ctx().canReadRow('rotation_cohorts', existing as never))) return refuse('not_found', RMSG.cohort_not_found, role);
      if (existing && existing.owner_id !== who && role !== 'training_manager') return refuse('forbidden', RMSG.forbidden_template, role);
      const t = b.rawGet('rotation_templates', String(p?.template_id ?? ''));
      if (!t || !ctx().canReadRow('rotation_templates', t as never) || t.status === 'retired') return refuse('not_found', RMSG.template_not_found, role);
      const status = p.status ?? 'running';
      if (len(p.name_en) < 3 || len(p.name_en) > 120 || len(p.name_ar) < 3 || len(p.name_ar) > 120 || !isDate(p.intake_on) || !['planned', 'running', 'completed'].includes(status))
        return refuse('invalid', RMSG.invalid_cohort_text, role);
      const ts = nowTs();
      const id = existing?.id ?? `rc-${hex()}`;
      const row = { template_id: t.id, programme: t.programme, name_en: p.name_en.trim(), name_ar: p.name_ar.trim(), intake_on: p.intake_on, status: status as never, listed: true, updated_at: ts };
      if (existing) b.rawUpdate('rotation_cohorts', id, row as never);
      else b.rawInsert('rotation_cohorts', { id, owner_id: who, created_at: ts, ...row } as never);
      return h.done<R>('rotation.cohort', 'rotation_cohorts', id, `${t.id} ${status}`, role, null, '', existing ? 'Cohort updated' : 'Cohort created', { id }, ['rotation_cohorts']);
    },

    async enrolRotation(templateId, personId, cohortId, startOn) {
      await b.whenReady();
      type R = { enrolment_id: string; placement_ids: string[]; signers: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.enrol', 'rotation_placements', personId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = ownerRole();
      if (!role) return refuse('forbidden', RMSG.forbidden_owner);
      const t = b.rawGet('rotation_templates', String(templateId ?? ''));
      if (!t || !ctx().canReadRow('rotation_templates', t as never)) return refuse('not_found', RMSG.template_not_found, role);
      if (t.status !== 'active') return refuse('invalid', RMSG.template_inactive, role);
      const p = b.rawGet('people', String(personId ?? ''));
      if (!p || p.kind !== 'staff' || p.status === 'leaver') return refuse('not_found', RMSG.person_not_found, role);
      if (cohortId) {
        const c = b.rawGet('rotation_cohorts', cohortId);
        if (!c) return refuse('not_found', RMSG.cohort_not_found, role);
        if (c.template_id !== t.id || c.status === 'completed') return refuse('invalid', RMSG.cohort_mismatch, role);
      }
      if ((t.eligible_families ?? []).length && !(t.eligible_families ?? []).includes(p.job_family_id ?? '')) return refuse('not_eligible', RMSG.not_eligible, role);
      const today = todayIso();
      if (!isDate(startOn) || startOn < today || dayNo(startOn) - dayNo(today) > 365) return refuse('invalid', RMSG.invalid_start, role);
      if (b.raw('rotation_placements').some((x) => x.person_id === p.id && x.template_id === t.id && x.status !== 'cancelled')) return refuse('conflict', RMSG.already_enrolled, role);
      const steps = (t.steps as unknown as Step[]) ?? [];
      const plan = planPlacements(steps, startOn);
      const routes = plan.map((x) => signerFor(p.id, x.step.host_manager_id, b.raw('people') as never, b.raw('role_assignments') as never, today));
      if (routes.some((r) => !r.signer)) return refuse('no_host', RMSG.no_host, role);
      const enrolment = `re-${hex()}`;
      const ts = nowTs();
      const ids: string[] = [];
      plan.forEach((x, i) => {
        const id = `rp-${enrolment.slice(3)}-${x.step.seq}`;
        ids.push(id);
        b.rawInsert('rotation_placements', {
          id, enrolment_id: enrolment, person_id: p.id, template_id: t.id, cohort_id: cohortId || null, seq: x.step.seq, family_id: x.step.family_id,
          host_team_en: x.step.host_team_en, host_team_ar: x.step.host_team_ar, host_role_id: x.step.host_role_id ?? null, host_manager_id: x.step.host_manager_id,
          host_name: x.step.host_name_en ?? '', host_name_ar: x.step.host_name_ar ?? '',
          line_manager_id: routes[i].lineManager, signer_id: routes[i].signer, skip_level: routes[i].skipLevel, starts_on: x.starts_on, ends_on: x.ends_on,
          site_induction: !!x.step.site_induction, objectives: x.step.objectives as never, status: 'planned', checkin: null, checkin_at: null, checkin_by: null,
          signed_off_by: null, signed_off_at: null, outcome_note: null, outcome_levels: {} as never, evidence_ids: [], enrolled_by: who,
          person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
          open_read: false, created_at: ts, updated_at: ts,
        } as never);
      });
      notify(`nt-${enrolment}-enrolled`, p.id, `You are enrolled: ${t.title_en}`, `تم تسجيلك: ${t.title_ar}`, '/opportunities/rotations/my', 'ok');
      notify(`nt-${enrolment}-host`, steps[0]?.host_manager_id, `New rotation placement to host: ${t.title_en}`, `تناوب جديد للاستضافة: ${t.title_ar}`, '/opportunities/rotations/host', 'info');
      return h.done<R>('rotation.enrol', 'rotation_placements', enrolment, `${p.id} -> ${t.id} (${ids.length} placements from ${startOn})`, role, 'kafaa.rotation.enrol', `Rotation ${t.id} enrolment ${enrolment} for ${p.id}`,
        'Enrolled; placement plan created', { enrolment_id: enrolment, placement_ids: ids, signers: routes.map((r) => r.signer!) }, ['rotation_placements', 'notifications']);
    },

    async placementCheckin(placementId, progress, note) {
      await b.whenReady();
      type R = { checkin_at: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.checkin', 'rotation_placements', placementId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const x = b.rawGet('rotation_placements', String(placementId ?? ''));
      if (!x || !ctx().canReadRow('rotation_placements', x as never)) return refuse('not_found', RMSG.placement_not_found);
      const role = ctx().actingRole('opportunities', ['Own', 'A']);
      if (![x.person_id, x.host_manager_id, x.signer_id].includes(who)) return refuse('forbidden', RMSG.forbidden_checkin, role);
      if (x.status === 'signed_off' || x.status === 'cancelled') return refuse('invalid', RMSG.closed, role);
      if (x.starts_on > todayIso()) return refuse('invalid', RMSG.not_started, role);
      if (x.checkin_at) return refuse('conflict', RMSG.checkin_done, role);
      const pr = cleanProgress(progress, (x.objectives as unknown as Objective[]) ?? []);
      if (!pr) return refuse('invalid', RMSG.invalid_progress, role);
      const text = String(note ?? '').trim();
      if (text.length < 5 || text.length > 1000) return refuse('invalid', RMSG.invalid_note, role);
      const ts = nowTs();
      b.rawUpdate('rotation_placements', x.id, { checkin: { at: ts, by: who, progress: pr, note: text } as never, checkin_at: ts, checkin_by: who, status: 'active', updated_at: ts } as never);
      const other = who === x.person_id ? x.signer_id : x.person_id;
      notify(`nt-${x.id}-checkin`, other, `Mid-point check-in recorded: ${x.host_team_en}`, `تم تسجيل مراجعة منتصف المدة: ${x.host_team_ar}`, who === x.person_id ? '/opportunities/rotations/host' : '/opportunities/rotations/my', 'info');
      return h.done<R>('rotation.checkin', 'rotation_placements', x.id, Object.values(pr).filter((v) => v === 'at_risk').length ? 'at risk' : 'on track', role, null, '', 'Mid-point check-in recorded', { checkin_at: ts }, ['rotation_placements', 'notifications']);
    },

    async signoffPlacement(placementId, levels, note) {
      await b.whenReady();
      type R = { evidence_ids: string[]; met: number; total: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.signoff', 'rotation_placements', placementId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const x = b.rawGet('rotation_placements', String(placementId ?? ''));
      if (!x || !ctx().canReadRow('rotation_placements', x as never)) return refuse('not_found', RMSG.placement_not_found);
      const role = ctx().actingRole('opportunities', ['A']);
      if (x.person_id === who) return refuse('maker_checker', RMSG.self_signoff, role);
      if (x.line_manager_id === who && x.host_manager_id === who) return refuse('maker_checker', RMSG.maker_checker, role);
      if (x.signer_id !== who || !role) return refuse('forbidden', RMSG.forbidden_signoff, role);
      if (x.status === 'signed_off' || x.status === 'cancelled') return refuse('invalid', RMSG.closed, role);
      if (x.starts_on > todayIso()) return refuse('invalid', RMSG.not_started, role);
      if (!x.checkin_at) return refuse('checkin_required', RMSG.checkin_required, role);
      const objectives = (x.objectives as unknown as Objective[]) ?? [];
      const lv = cleanObjectiveLevels(levels, objectives);
      if (!lv) return refuse('invalid', RMSG.invalid_levels, role);
      const text = String(note ?? '').trim();
      if (text.length < 5 || text.length > 1000) return refuse('invalid', RMSG.invalid_note, role);
      const t = b.rawGet('rotation_templates', x.template_id);
      const ids = await writeEvidence('rotation_placements', x, skillLevels(lv, objectives), `${t?.title_en ?? x.template_id} · ${x.host_team_en}`);
      const ts = nowTs();
      const met = objectivesMet(lv, objectives);
      b.rawUpdate('rotation_placements', x.id, { status: 'signed_off', signed_off_by: who, signed_off_at: ts, outcome_note: text, outcome_levels: lv as never, evidence_ids: ids, updated_at: ts } as never);
      notify(`nt-${x.id}-signed_off`, x.person_id, `Placement signed off: ${x.host_team_en}. Your skills passport is updated`, `تم اعتماد التناوب: ${x.host_team_ar}. تم تحديث جواز مهاراتك`, '/opportunities/rotations/my', 'ok');
      return h.done<R>('rotation.signoff', 'rotation_placements', x.id, `${met}/${objectives.length} objectives met; ${ids.length} ojt evidence rows`, role, 'kafaa.rotation.signoff',
        `Placement ${x.id} signed off for ${x.person_id} (${met}/${objectives.length} objectives)`, 'Placement signed off; skills evidence recorded', { evidence_ids: ids, met, total: objectives.length },
        ['rotation_placements', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async setShadowHost(p) {
      await b.whenReady();
      type R = { id: string; active: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('shadow.host', 'shadow_hosts', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      const person = b.rawGet('people', who);
      if (!role || !person || person.kind !== 'staff') return refuse('forbidden', RMSG.forbidden_host, role);
      if (RESTRICTED_FAMILIES.includes(person.job_family_id ?? '')) return refuse('restricted_kind', RMSG.restricted_host, role);
      const bad = validateHost(p, b.raw('skills') as never);
      if (bad) return refuse(bad.code, bad.message, role);
      const id = `sh:${who}`;
      const active = p.active !== false;
      const prev = b.rawGet('shadow_hosts', id);
      const row = active
        ? { skill_ids: [...p.skill_ids], max_days_month: p.max_days_month, note_en: (p.note_en ?? '').trim() || null, note_ar: (p.note_ar ?? '').trim() || null, active: true, listed: true }
        : { active: false, listed: false };
      const base = { name: person.display_name, name_ar: person.display_name_ar || person.display_name, role_id: person.job_role_id ?? null, family_id: person.job_family_id ?? null, site_induction: SITE_FAMILIES.includes(person.job_family_id ?? ''), updated_at: nowTs() };
      if (prev) b.rawUpdate('shadow_hosts', id, { ...base, ...row } as never);
      else b.rawInsert('shadow_hosts', { id, person_id: who, skill_ids: [], max_days_month: 2, note_en: null, note_ar: null, ...base, ...row } as never);
      return h.done<R>('shadow.host', 'shadow_hosts', id, active ? 'listed' : 'unlisted', role, null, '', active ? 'You are listed as a shadowing host' : 'You are no longer listed as a host', { id, active }, ['shadow_hosts']);
    },

    async requestShadow(p) {
      await b.whenReady();
      type R = { id: string; line_manager_id: string; same_person: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('shadow.request', 'shadow_requests', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      const person = b.rawGet('people', who);
      if (!role || !person || person.kind !== 'staff') return refuse('forbidden', RMSG.forbidden_shadow, role);
      const host = b.raw('shadow_hosts').find((x) => x.person_id === p?.host_id && x.active && x.listed);
      const hp = host ? b.rawGet('people', host.person_id) : undefined;
      if (!host || !hp || hp.status === 'leaver') return refuse('not_found', RMSG.host_not_found, role);
      const area = new Map(b.raw('skills').map((s) => [s.id, s.area]));
      if (RESTRICTED_FAMILIES.includes(hp.job_family_id ?? '') || (Array.isArray(p.skill_ids) ? p.skill_ids : []).some((s) => RESTRICTED_SKILL_AREAS.includes(area.get(s) ?? ''))) return refuse('restricted_kind', RMSG.restricted_shadow, role);
      if (host.person_id === who) return refuse('conflict', RMSG.self_shadow, role);
      const today = todayIso();
      const bad = validateShadow(p, host as never, today);
      if (bad) return refuse(bad.code, bad.message, role);
      const open = b.raw('shadow_requests').filter((x) => x.person_id === who && (x.status === 'requested' || x.status === 'approved'));
      if (open.length >= SHADOW_MAX_OPEN) return refuse('conflict', RMSG.too_many_open, role);
      if (open.some((x) => x.host_id === host.person_id)) return refuse('conflict', RMSG.duplicate_open, role);
      const mgr = lm(who);
      if (!mgr) return refuse('no_line_manager', RMSG.no_line_manager, role);
      const id = `sr-${hex()}`;
      const ts = nowTs();
      const purpose = p.purpose.trim();
      b.rawInsert('shadow_requests', {
        id, person_id: who, host_id: host.person_id, line_manager_id: mgr, host_family_id: hp.job_family_id ?? null, host_role_id: hp.job_role_id ?? null,
        start_on: p.start_on, days: p.days, skill_ids: [...p.skill_ids], purpose, status: 'requested', host_consent: null, manager_consent: null, host_note: null, manager_note: null,
        site_induction: !!host.site_induction, person_name: person.display_name, person_name_ar: person.display_name_ar || person.display_name, person_role_id: person.job_role_id ?? null,
        person_family_id: person.job_family_id ?? null, host_name: host.name, host_name_ar: host.name_ar, reflection: null, completed_at: null, evidence_ids: [],
        history: [{ at: ts, status: 'requested', by: who, note: purpose }] as never, open_read: false, created_at: ts, updated_at: ts,
      } as never);
      notify(`nt-${id}-host`, host.person_id, `Shadowing request from ${person.display_name}`, `طلب مرافقة من ${person.display_name_ar || person.display_name}`, '/opportunities/rotations/host', 'info');
      if (mgr !== host.person_id) notify(`nt-${id}-manager`, mgr, `Shadowing consent needed: ${person.display_name}`, `مطلوب موافقتك على المرافقة: ${person.display_name_ar || person.display_name}`, '/opportunities/rotations/host', 'info');
      return h.done<R>('shadow.request', 'shadow_requests', id, `${host.person_id} ${p.days}d from ${p.start_on}`, role, null, '', 'Request sent to the host and your line manager', { id, line_manager_id: mgr, same_person: mgr === host.person_id }, ['shadow_requests', 'notifications']);
    },

    async decideShadow(requestId, decision, note = '') {
      await b.whenReady();
      type R = { status: string; evidence_ids?: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('shadow.decide', 'shadow_requests', requestId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RMSG.not_signed_in);
      const r = b.rawGet('shadow_requests', String(requestId ?? ''));
      if (!r || !ctx().canReadRow('shadow_requests', r as never)) return refuse('not_found', RMSG.shadow_not_found);
      const role = ctx().actingRole('opportunities', ['Own', 'A']);
      if (!['approve', 'decline', 'withdraw', 'complete'].includes(decision)) return refuse('invalid', RMSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      const ts = nowTs();
      if (decision === 'withdraw') {
        if (r.person_id !== who) return refuse('forbidden', RMSG.forbidden_withdraw, role);
        if (r.status !== 'requested' && r.status !== 'approved') return refuse('invalid', RMSG.shadow_closed, role);
        b.rawUpdate('shadow_requests', r.id, { status: 'withdrawn', history: shHist(r, 'withdrawn', text || null) as never, updated_at: ts } as never);
        return h.done<R>('shadow.decide', 'shadow_requests', r.id, `${r.status} -> withdrawn`, role, null, '', 'Request withdrawn', { status: 'withdrawn' }, ['shadow_requests']);
      }
      if (decision === 'complete') {
        if (r.host_id !== who) return refuse('forbidden', RMSG.forbidden_complete, role);
        if (r.status !== 'approved') return refuse('invalid', RMSG.not_approved, role);
        if (r.start_on > todayIso()) return refuse('invalid', RMSG.shadow_not_started, role);
        if (text.length < 5 || text.length > 1000) return refuse('invalid', RMSG.invalid_note, role);
        const ids = await writeEvidence('shadow_requests', r, Object.fromEntries((r.skill_ids ?? []).map((s) => [s, 1])), `${r.host_name} (${r.days} d)`);
        b.rawUpdate('shadow_requests', r.id, { status: 'completed', reflection: text, completed_at: ts, evidence_ids: ids, history: shHist(r, 'completed', text) as never, updated_at: ts } as never);
        notify(`nt-${r.id}-completed`, r.person_id, `Shadowing confirmed by ${r.host_name}. Your skills passport is updated`, `أكّد ${r.host_name_ar} المرافقة. تم تحديث جواز مهاراتك`, '/opportunities/rotations/my', 'ok');
        return h.done<R>('shadow.decide', 'shadow_requests', r.id, `completed; ${ids.length} ojt evidence rows`, role, 'kafaa.shadow.complete', `Shadowing ${r.id} completed for ${r.person_id} (${ids.length} skills)`,
          'Shadowing confirmed; skills evidence recorded', { status: 'completed', evidence_ids: ids }, ['shadow_requests', 'skill_evidence', 'person_skills', 'notifications']);
      }
      if (who !== r.host_id && who !== r.line_manager_id) return refuse('forbidden', RMSG.forbidden_consent, role);
      if (r.status !== 'requested') return refuse('invalid', RMSG.shadow_closed, role);
      if (decision === 'decline' && text.length < 5) return refuse('invalid', RMSG.decline_reason, role);
      if ((who === r.host_id ? r.host_consent != null : true) && (who === r.line_manager_id ? r.manager_consent != null : true)) return refuse('conflict', RMSG.already_consented, role);
      const c = consentAfter(r as never, who, decision === 'approve');
      b.rawUpdate('shadow_requests', r.id, {
        host_consent: c.host_consent, manager_consent: c.manager_consent, status: c.status as never,
        ...(who === r.host_id ? { host_note: text || null } : {}), ...(who === r.line_manager_id ? { manager_note: text || null } : {}),
        history: shHist(r, decision === 'approve' ? (c.status === 'approved' ? 'approved' : 'consented') : 'declined', text || null) as never, updated_at: ts,
      } as never);
      if (c.status !== 'requested')
        notify(`nt-${r.id}-${c.status}`, r.person_id, c.status === 'approved' ? `Shadowing approved with ${r.host_name}` : `Shadowing declined: ${r.host_name}`, c.status === 'approved' ? `تمت الموافقة على مرافقة ${r.host_name_ar}` : `رُفض طلب مرافقة ${r.host_name_ar}`, '/opportunities/rotations/my', c.status === 'approved' ? 'ok' : 'warn');
      return h.done<R>('shadow.decide', 'shadow_requests', r.id, `${decision} by ${who === r.host_id ? (who === r.line_manager_id ? 'host and line manager' : 'host') : 'line manager'} -> ${c.status}`, role, null, '',
        c.status === 'approved' ? 'Shadowing approved' : c.status === 'declined' ? 'Request declined' : 'Consent recorded; waiting for the other consent', { status: c.status }, ['shadow_requests', 'notifications']);
    },

    async rotationBoard(): Promise<RotationBoard | null> {
      await b.whenReady();
      const c = ctx();
      if (!me() || !(c.has('opportunities', ['Agg', 'A']) || c.has('audit_log', ['R']))) return null;
      const ev = b.raw('skill_evidence').filter((e) => e.kind === 'ojt' && e.ref_table === 'rotation_placements' && e.active).length;
      return computeBoard(b.raw('rotation_templates') as never, b.raw('rotation_cohorts') as never, b.raw('rotation_placements') as never, b.raw('shadow_requests') as never, ev, todayIso());
    },

    async rotationCandidates(templateId): Promise<RotationCandidate[] | null> {
      await b.whenReady();
      if (!me() || !ownerRole()) return null;
      const t = templateId ? b.rawGet('rotation_templates', templateId) : null;
      if (templateId && (!t || !ctx().canReadRow('rotation_templates', t as never))) return null;
      return computeCandidates((t ?? null) as never, b.raw('people') as never, b.raw('rotation_placements') as never, hostCtx());
    },
  };
}

export type { Placement as RotationPlacement, Shadow as ShadowRequest };
