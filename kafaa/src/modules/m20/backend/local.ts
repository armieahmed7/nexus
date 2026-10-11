// M20 LocalBackend RPC implementations (owner: W1 · F08). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql: same checks in the same order, the same
// refusal codes and messages (src/modules/m20/domain.ts MSG), the same audit rows and ledger rows. Change both together.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import { applySkills } from '../../../data/local/rpc.w0';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MSG, LIVE_APP_STATUSES, canTransition, cleanLevels, computeStats, ojtEvidence, releaserFor, validateOpportunity, type HistoryEntry, type OppStats } from '../domain';
import type { M20Rpc } from './rpc';
import { makeLocalF15 } from './rotation.local';
import { makeLocalF23 } from './reserve.local';
import { makeLocalFS27 } from './fs27.local';
import { channelProblem, envelopeFit } from '../futureGigs';
import { targetCheck } from '../../m17/futureCreds'; // FS wave D QA: strategic-credential gate (FS31)

type Opp = RowOf<'opportunities'>;
type App = RowOf<'opportunity_applications'>;
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('')}`;

export function makeLocalM20(b: LocalBackend, h: LocalRpcHelpers): M20Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const hist = (a: App, status: string, note: string | null = null): HistoryEntry[] => [...((a.history as HistoryEntry[] | null) ?? []), { at: nowTs(), status, by: me(), note }];
  const notify = (id: string, person: string | null | undefined, kind: string, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad' = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind, title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const visibleApp = (id: string): App | undefined => {
    const a = b.rawGet('opportunity_applications', id);
    return a && ctx().canReadRow('opportunity_applications', a as never) ? a : undefined;
  };

  return {
    ...makeLocalF15(b, h),
    ...makeLocalF23(b, h),
    ...makeLocalFS27(b, h),
    async postOpportunity(p) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.post', 'opportunities', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in_post);
      const role = ctx().actingRole('opportunities', ['W', 'A']);
      if (!role) return refuse('forbidden', MSG.forbidden_post);
      const bad = validateOpportunity(p, b.raw('skills') as never, b.raw('job_families').map((f) => f.id), todayIso());
      if (bad) return refuse(bad.code, bad.message, role);
      // FS27: a future-skills channel must be known and the gig must grow at least one future skill
      const cbad = channelProblem(p.channel, p.skills_gained ?? [], b.raw('skills') as never);
      if (cbad) return refuse(cbad.code, cbad.message, role);
      const poster = b.rawGet('people', who)!;
      const id = rid('opp');
      const status = p.status ?? 'open';
      const ts = nowTs();
      b.rawInsert('opportunities', {
        id, posted_by: who, org_id: poster.org_id ?? null, family_id: poster.job_family_id ?? null, host_role_id: poster.job_role_id ?? null, host_team: poster.team_id ?? null,
        kind: p.kind as never, title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), summary_en: p.summary_en.trim(), summary_ar: p.summary_ar.trim(),
        skills_needed: [...p.skills_needed], skills_gained: [...p.skills_gained], hours_week: p.hours_week, start_on: p.start_on, end_on: p.end_on, seats: p.seats, seats_taken: 0,
        location_type: p.location_type as never, eligible_families: [...(p.eligible_families ?? [])], priority_flags: [...(p.priority_flags ?? [])],
        status, listed: status !== 'draft', created_at: ts, updated_at: ts, channel: p.channel ? p.channel : null,
      } as never);
      return h.done<R>('opportunity.post', 'opportunities', id, `${p.kind} ${status}`, role, null, '', status === 'draft' ? 'Draft saved' : 'Opportunity posted', { id, status }, ['opportunities']);
    },

    async setOpportunityStatus(id, status) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.status', 'opportunities', id, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const o = b.rawGet('opportunities', id);
      if (!o || !ctx().canReadRow('opportunities', o as never)) return refuse('not_found', MSG.not_found);
      const role = o.posted_by === who ? ctx().actingRole('opportunities', ['W', 'A']) : ctx().roleGrant('training_manager', 'opportunities', 'A') ? 'training_manager' : null;
      if (!role) return refuse('forbidden', MSG.forbidden_status);
      if (!canTransition(o.status, status)) return refuse('invalid', MSG.invalid_transition, role);
      b.rawUpdate('opportunities', id, { status, listed: true, updated_at: nowTs() } as never);
      if (status === 'closed')
        for (const a of b.raw('opportunity_applications').filter((x) => x.opportunity_id === id && (x.status === 'applied' || x.status === 'released')))
          b.rawUpdate('opportunity_applications', a.id, { status: 'not_selected', decided_by: who, decided_at: nowTs(), history: hist(a, 'not_selected', 'Opportunity closed'), updated_at: nowTs() } as never);
      return h.done<R>('opportunity.status', 'opportunities', id, `${o.status} -> ${status}`, role, null, '', status === 'open' ? 'Opportunity open' : 'Opportunity closed', { status }, ['opportunities', 'opportunity_applications']);
    },

    async applyOpportunity(opportunityId, note) {
      await b.whenReady();
      type R = { id: string; releaser_id: string; skip_level: boolean; envelope_id: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.apply', 'opportunities', opportunityId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      if (!role) return refuse('forbidden', MSG.forbidden_apply);
      const o = b.rawGet('opportunities', opportunityId);
      if (!o || !ctx().canReadRow('opportunities', o as never)) return refuse('not_found', MSG.not_found, role);
      if (o.status !== 'open') return refuse('invalid', MSG.not_open, role);
      if (o.posted_by === who) return refuse('conflict', MSG.own_opportunity, role);
      const p = b.rawGet('people', who)!;
      if ((o.eligible_families ?? []).length && !(o.eligible_families ?? []).includes(p.job_family_id ?? '')) return refuse('not_eligible', MSG.not_eligible, role);
      // FS wave D QA (FS31 -> FS27/F08): a gig that names a strategic credential is open to holders only (kafaa_fc_target_check)
      const tc = targetCheck(who, 'opportunity', opportunityId, { today: todayIso(), defs: b.raw('microcred_defs') as never, awards: b.raw('microcred_awards') as never,
        unlocks: b.raw('microcred_unlocks' as never) as never, opportunities: b.raw('opportunities') as never, rotation_templates: b.raw('rotation_templates') as never });
      if (tc.named && !tc.unlocked) return refuse('credential_required', MSG.credential_required, role);
      if (b.raw('opportunity_applications').some((a) => a.opportunity_id === opportunityId && a.person_id === who && LIVE_APP_STATUSES.includes(a.status as never))) return refuse('conflict', MSG.already_applied, role);
      const text = String(note ?? '').trim();
      if (text.length > 500) return refuse('invalid', MSG.invalid_note, role);
      const r = releaserFor(who, o.posted_by, b.raw('people') as never, b.raw('role_assignments') as never, todayIso());
      if (!r.releaser) return refuse('no_line_manager', MSG.no_line_manager, role);
      const id = rid('oa');
      const ts = nowTs();
      // FS27: inside an approved time envelope the per-gig release is skipped (released at once by the envelope's approver)
      const fit = envelopeFit(who, o as never, b.raw('time_envelopes') as never, b.raw('opportunity_applications') as never, new Map(b.raw('opportunities').map((x) => [x.id, x])), todayIso());
      const env = fit.fits ? b.rawGet('time_envelopes', fit.envelope_id!) : undefined;
      const history: HistoryEntry[] = [{ at: ts, status: 'applied', by: who, note: text || null }];
      if (env) history.push({ at: ts, status: 'released', by: env.approver_id ?? null, note: `Within the approved time envelope ${env.period} (${env.pct}%)` });
      b.rawInsert('opportunity_applications', {
        id, opportunity_id: opportunityId, person_id: who, note: text, status: env ? 'released' : 'applied', history,
        applicant_name: p.display_name, applicant_name_ar: p.display_name_ar || p.display_name, applicant_role_id: p.job_role_id ?? null, applicant_family_id: p.job_family_id ?? null,
        poster_id: o.posted_by, line_manager_id: r.lineManager, releaser_id: r.releaser, skip_level: r.skipLevel, outcome_levels: {}, evidence_ids: [], open_read: false, created_at: ts, updated_at: ts,
        released_by: env ? env.approver_id ?? null : null, released_at: env ? ts : null, envelope_id: env ? env.id : null,
      } as never);
      if (env) {
        notify(`nt-${id}-released`, o.posted_by, 'opportunity', `Applicant released (time envelope): ${o.title_en}`, `تم الإفراج عن متقدّم (وقت مخصص): ${o.title_ar}`, '/opportunities/manage', 'info');
        notify(`nt-${id}-envelope`, env.approver_id, 'opportunity', `Time envelope used: ${p.display_name} joined ${o.title_en}`, `استُخدم الوقت المخصص: ${p.display_name_ar || p.display_name} انضم إلى ${o.title_ar}`, '/opportunities/envelopes', 'info');
        return h.done<R>('opportunity.apply', 'opportunity_applications', id, `${opportunityId} -> released within envelope ${env.id}`, role, null, '', 'Application released within your approved time envelope', { id, releaser_id: r.releaser, skip_level: r.skipLevel, envelope_id: env.id }, ['opportunity_applications', 'notifications']);
      }
      notify(`nt-${id}-applied`, r.releaser, 'opportunity', `Release request: ${o.title_en}`, `طلب إفراج: ${o.title_ar}`, '/opportunities/manage', 'info');
      return h.done<R>('opportunity.apply', 'opportunity_applications', id, `${opportunityId} -> release by ${r.releaser}${r.skipLevel ? ' (skip level)' : ''}`, role, null, '', 'Application sent to your line manager for release', { id, releaser_id: r.releaser, skip_level: r.skipLevel, envelope_id: null }, ['opportunity_applications', 'notifications']);
    },

    async releaseDecision(applicationId, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.release', 'opportunity_applications', applicationId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const a = visibleApp(applicationId);
      if (!a) return refuse('not_found', MSG.app_not_found);
      const role = ctx().actingRole('opportunities', ['A', 'Own']);
      if (a.poster_id === who) return refuse('maker_checker', MSG.maker_checker, role);
      if (a.releaser_id !== who) return refuse('forbidden', MSG.forbidden_release, role);
      if (a.status !== 'applied') return refuse('invalid', MSG.not_waiting_release, role);
      if (decision !== 'release' && decision !== 'decline') return refuse('invalid', MSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      if (decision === 'decline' && text.length < 5) return refuse('invalid', MSG.decline_reason, role);
      const status = decision === 'release' ? 'released' : 'declined_release';
      const ts = nowTs();
      b.rawUpdate('opportunity_applications', a.id, { status, released_by: who, released_at: ts, history: hist(a, status, text || null), updated_at: ts } as never);
      const o = b.rawGet('opportunities', a.opportunity_id)!;
      if (status === 'released') notify(`nt-${a.id}-released`, a.poster_id, 'opportunity', `Applicant released: ${o.title_en}`, `تم الإفراج عن متقدّم: ${o.title_ar}`, '/opportunities/manage', 'info');
      notify(`nt-${a.id}-${status}`, a.person_id, 'opportunity', status === 'released' ? `Your manager released you for: ${o.title_en}` : `Release declined: ${o.title_en}`, status === 'released' ? `أفرج عنك مديرك لـ: ${o.title_ar}` : `رُفض الإفراج: ${o.title_ar}`, '/opportunities/my', status === 'released' ? 'ok' : 'warn');
      return h.done<R>('opportunity.release', 'opportunity_applications', a.id, status, role, null, '', status === 'released' ? 'Applicant released' : 'Release declined', { status }, ['opportunity_applications', 'notifications']);
    },

    async selectApplicant(applicationId, decision, note = '') {
      await b.whenReady();
      type R = { status: string; filled: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.select', 'opportunity_applications', applicationId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const a = visibleApp(applicationId);
      if (!a) return refuse('not_found', MSG.app_not_found);
      const role = ctx().actingRole('opportunities', ['W', 'A']);
      if (a.poster_id !== who || !role) return refuse('forbidden', MSG.forbidden_select, role);
      if (decision !== 'selected' && decision !== 'not_selected') return refuse('invalid', MSG.invalid_decision, role);
      if (decision === 'selected' && a.status === 'applied') return refuse('release_required', MSG.release_required, role);
      if (decision === 'selected' && a.status === 'declined_release') return refuse('release_required', MSG.release_required, role);
      if (a.status !== 'released' && a.status !== 'applied') return refuse('invalid', MSG.already_decided, role);
      const o = b.rawGet('opportunities', a.opportunity_id)!;
      const taken = b.raw('opportunity_applications').filter((x) => x.opportunity_id === o.id && (x.status === 'selected' || x.status === 'completed')).length;
      if (decision === 'selected' && taken >= o.seats) return refuse('conflict', MSG.no_seats, role);
      const ts = nowTs();
      b.rawUpdate('opportunity_applications', a.id, { status: decision, decided_by: who, decided_at: ts, history: hist(a, decision, String(note ?? '').trim() || null), updated_at: ts } as never);
      const filled = decision === 'selected' && taken + 1 >= o.seats;
      if (decision === 'selected') b.rawUpdate('opportunities', o.id, { seats_taken: taken + 1, ...(filled ? { status: 'filled' } : {}), updated_at: ts } as never);
      notify(`nt-${a.id}-${decision}`, a.person_id, 'opportunity', decision === 'selected' ? `You were selected: ${o.title_en}` : `Not selected this time: ${o.title_en}`, decision === 'selected' ? `تم اختيارك: ${o.title_ar}` : `لم يتم اختيارك هذه المرة: ${o.title_ar}`, '/opportunities/my', decision === 'selected' ? 'ok' : 'info');
      return h.done<R>('opportunity.select', 'opportunity_applications', a.id, decision, role, 'kafaa.opportunity.select', `Application ${a.id} to ${o.id}: ${decision}`, decision === 'selected' ? 'Applicant selected' : 'Applicant not selected', { status: decision, filled }, ['opportunity_applications', 'opportunities', 'notifications']);
    },

    async completeOpportunity(applicationId, levels, note) {
      await b.whenReady();
      type R = { evidence_ids: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.complete', 'opportunity_applications', applicationId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const a = visibleApp(applicationId);
      if (!a) return refuse('not_found', MSG.app_not_found);
      const role = ctx().actingRole('opportunities', ['W', 'A']);
      if (a.person_id === who) return refuse('maker_checker', MSG.self_signoff, role);
      if (a.poster_id !== who || !role) return refuse('forbidden', MSG.forbidden_complete, role);
      if (a.status !== 'selected') return refuse('invalid', MSG.not_selected_yet, role);
      const o = b.rawGet('opportunities', a.opportunity_id)!;
      const lv = cleanLevels(levels, o.skills_gained ?? []);
      if (!lv) return refuse('invalid', MSG.invalid_levels, role);
      const text = String(note ?? '').trim();
      if (text.length < 5) return refuse('invalid', MSG.outcome_note, role);
      const today = todayIso();
      const ids: string[] = [];
      for (const [skill, level] of Object.entries(lv).sort(([x], [y]) => (x < y ? -1 : 1))) {
        const e = ojtEvidence(a, skill, level, today, who, o.title_en);
        ids.push(e.id);
        if (b.rawGet('skill_evidence', e.id)) b.rawUpdate('skill_evidence', e.id, { level: e.level, observed_on: e.observed_on, active: true } as never);
        else b.rawInsert('skill_evidence', { ...e, created_at: nowTs() } as never);
      }
      await applySkills(b, a.person_id, today);
      const ts = nowTs();
      b.rawUpdate('opportunity_applications', a.id, { status: 'completed', completed_at: ts, outcome_note: text, outcome_levels: lv, evidence_ids: ids, history: hist(a, 'completed', text), updated_at: ts } as never);
      notify(`nt-${a.id}-completed`, a.person_id, 'opportunity', `Signed off: ${o.title_en}. Your skills passport is updated`, `تم الاعتماد: ${o.title_ar}. تم تحديث جواز مهاراتك`, '/opportunities/my', 'ok');
      return h.done<R>('opportunity.complete', 'opportunity_applications', a.id, `${ids.length} ojt evidence rows`, role, 'kafaa.opportunity.complete', `Opportunity ${o.id} outcome signed off for ${a.id} (${ids.length} skills)`, 'Outcome signed off; skills evidence recorded', { evidence_ids: ids }, ['opportunity_applications', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async withdrawOpportunityApplication(applicationId) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.withdraw', 'opportunity_applications', applicationId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const a = visibleApp(applicationId);
      if (!a) return refuse('not_found', MSG.app_not_found);
      const role = ctx().actingRole('opportunities', ['Own']);
      if (a.person_id !== who) return refuse('forbidden', MSG.forbidden_withdraw, role);
      if (!['applied', 'released', 'selected'].includes(a.status)) return refuse('invalid', MSG.not_withdrawable, role);
      const ts = nowTs();
      b.rawUpdate('opportunity_applications', a.id, { status: 'withdrawn', history: hist(a, 'withdrawn'), updated_at: ts } as never);
      const o = b.rawGet('opportunities', a.opportunity_id);
      if (o && a.status === 'selected') b.rawUpdate('opportunities', o.id, { seats_taken: Math.max(0, (o.seats_taken ?? 0) - 1), ...(o.status === 'filled' ? { status: 'open' } : {}), updated_at: ts } as never);
      return h.done<R>('opportunity.withdraw', 'opportunity_applications', a.id, `${a.status} -> withdrawn`, role, null, '', 'Application withdrawn', { status: 'withdrawn' }, ['opportunity_applications', 'opportunities']);
    },

    async saveOpportunity(opportunityId, saved) {
      await b.whenReady();
      type R = { saved: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('opportunity.save', 'opportunity_saves', opportunityId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      if (!role) return refuse('forbidden', MSG.forbidden_save);
      const o = b.rawGet('opportunities', opportunityId);
      if (!o || !ctx().canReadRow('opportunities', o as never)) return refuse('not_found', MSG.not_found, role);
      const id = `os:${who}:${opportunityId}`;
      const flag = saved !== false;
      if (b.rawGet('opportunity_saves', id)) b.rawUpdate('opportunity_saves', id, { saved: flag, updated_at: nowTs() } as never);
      else b.rawInsert('opportunity_saves', { id, person_id: who, opportunity_id: opportunityId, saved: flag, open_read: false, updated_at: nowTs() } as never);
      return h.done<R>('opportunity.save', 'opportunity_saves', id, flag ? 'saved' : 'unsaved', role, null, '', flag ? 'Saved' : 'Removed from saved', { saved: flag }, ['opportunity_saves']);
    },

    async opportunityStats(): Promise<OppStats | null> {
      await b.whenReady();
      const c = ctx();
      if (!me() || !(c.has('opportunities', ['Agg', 'A']) || c.has('audit_log', ['R']))) return null;
      const ev = b.raw('skill_evidence').filter((e) => e.kind === 'ojt' && e.ref_table === 'opportunity_applications' && e.active).length;
      return computeStats(b.raw('opportunities') as never, b.raw('opportunity_applications') as never, ev);
    },
  };
}

