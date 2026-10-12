// FS80 Automation and agent gallery with builder credit: LocalBackend RPCs (wave I E2), spread into makeLocalM29.
// 1:1 mirror of supabase/migrations/20261010292001_kafaa_fs92_automation_gallery.sql: the same checks in the same order, the same
// refusal codes and messages (ATM_MSG, ATM_PROBLEM_TEXT), the same audit rows, ledger rows and F01 evidence rows. Pages never import this file.
// Shared write (like the SQL SECURITY DEFINER functions): one F01 skill_evidence row per entry for its builder
// `se:ojt:<automation>:sk-fs-ai-automation` (kind ojt = recorded work evidence, basis validated, ref_table automations, level 2 from the
// first adopter, 3 from REUSE_AT) + applySkills for the builder. Nothing runs: the entry is metadata only.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { aiRung, type RungCell, type SkillTrackRow, type StateLite } from '../fluency';
import { isStaff } from '../fitness';
import {
  BUILDER_SKILL, STATUS_AFTER, adoptProblem, automationProblem, builderEvidenceId, builderLevel, decisionProblem, editable, galleryStats,
  type AutomationInput, type Decision,
} from '../automations';
import type { AutomationAdopted, AutomationDecided, AutomationSaved, AutomationStatsView, M29Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');

/** User-facing refusal messages (identical in SQL). */
export const ATM_MSG = {
  not_signed_in: 'Sign in to use the automation gallery',
  forbidden: 'The automation gallery is for ENEC staff',
  forbidden_decide: 'Only AI governance (admin) decides gallery entries',
  not_found: 'Gallery entry not found',
  locked: 'Only a draft or returned entry can change; AI governance retires approved entries',
  invalid: 'Check the entry: ',
  maker_checker: 'The builder and the accountable owner never decide their own entry',
  state: 'This entry is not waiting for that decision',
  note: 'Give a reason (5 to 400 characters, plain text) when you return, reject or retire an entry',
  decision: 'Choose approve, return, reject or retire',
  not_open: 'Only approved entries can be adopted',
  own_build: 'Builders do not adopt their own entry: adoption counts reuse by others',
  already: 'You have already adopted this entry',
  rung_low: 'This entry needs a higher rung on the AI fluency ladder; the sandbox drills and the fitness check help you get there',
  adopt_note: 'Keep the note to 200 characters of plain text',
} as const;
export const ATM_PROBLEM_TEXT: Record<string, string> = {
  title: 'a title in English and Arabic (up to 120 characters)',
  kind: 'choose workflow, agent, template or report',
  purpose: 'a purpose in English and Arabic (up to 600 characters)',
  data: 'the data it uses in English and Arabic (up to 400 characters)',
  classes: 'choose one or more data classes',
  system: 'choose the AI-system register entry it runs on',
  system_closed: 'the AI system must be published in the register (not a draft or retired)',
  owner: 'the accountable owner must be ENEC staff',
  oversight: 'the human check on its output in English and Arabic (up to 400 characters)',
  benefit: 'the expected benefit in English and Arabic (up to 300 characters)',
  how: 'how to use it in English and Arabic (up to 600 characters)',
  rung: 'the minimum rung must be 1, 2 or 3',
  action: 'save as a draft or submit',
  code: 'metadata only: no code, scripts, links or file names; Kafa\'a never runs automations',
  secret: 'never include credentials or passwords',
  restricted: 'entries never touch plant security',
  claim: 'Kafa\'a does not certify; remove certification or compliance wording',
};

export function makeLocalFs80(b: LocalBackend, h: LocalRpcHelpers): Pick<M29Rpc, 'submitAutomation' | 'decideAutomation' | 'adoptAutomation' | 'automationStats'> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const rungOf = (pid: string) => {
    const states = raw('person_skills').filter((s) => s.active && s.person_id === pid) as StateLite[];
    return aiRung(pid, raw('ai_rungs') as unknown as RungCell[], raw('ai_skill_tracks') as unknown as SkillTrackRow[], states).rung;
  };

  return {
    async submitAutomation(input: AutomationInput) {
      await b.whenReady();
      type R = AutomationSaved;
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.automation.submit', 'automations', given, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', ATM_MSG.not_signed_in);
      const a = ctx();
      if (!a.has('ai_literacy', ['Own', 'W'])) return refuse('forbidden', ATM_MSG.forbidden);
      const role = a.actingRole('ai_literacy', ['Own', 'W']);
      const cur = given ? get('automations', given) : undefined;
      // someone else's entry reads as not found (the builder is the only editor)
      if (given && (!cur || cur.builder_person_id !== pid)) return refuse('not_found', ATM_MSG.not_found, role);
      if (cur && !editable(cur.status)) return refuse('locked', ATM_MSG.locked, role);
      const staff = raw('people').filter((p) => isStaff(p as never)).map((p) => p.id as string);
      const problem = automationProblem(input, { systems: raw('ai_systems').map((s) => ({ id: s.id, status: s.status })), staff });
      if (problem) return refuse('invalid', ATM_MSG.invalid + ATM_PROBLEM_TEXT[problem], role);
      const id = cur ? cur.id : `atm-${hex(4)}`;
      const version = cur ? Number(cur.version) + 1 : 1;
      const status = input.action === 'submit' ? 'submitted' : (cur?.status === 'returned' ? 'returned' : 'draft');
      const ts = nowTs();
      const hist = [...(cur?.history ?? []), { at: ts, by: pid, action: input.action, version, note: '' }];
      const patch = {
        title_en: t(input.title_en), title_ar: t(input.title_ar), kind: input.kind, purpose_en: t(input.purpose_en), purpose_ar: t(input.purpose_ar),
        data_used_en: t(input.data_used_en), data_used_ar: t(input.data_used_ar), data_classes: [...input.data_classes], system_id: input.system_id, owner_person_id: input.owner_person_id,
        builder_en: get('people', pid)?.display_name ?? '', builder_ar: get('people', pid)?.display_name_ar ?? '',
        owner_en: get('people', input.owner_person_id)?.display_name ?? '', owner_ar: get('people', input.owner_person_id)?.display_name_ar ?? '',
        family_id: get('people', pid)?.job_family_id ?? null, oversight_en: t(input.oversight_en), oversight_ar: t(input.oversight_ar), benefit_en: t(input.benefit_en), benefit_ar: t(input.benefit_ar),
        how_en: t(input.how_en), how_ar: t(input.how_ar), min_rung: input.min_rung, status, listed: false, version, metadata_only: true,
        submitted_at: input.action === 'submit' ? ts : (cur?.submitted_at ?? null), history: hist, updated_at: ts,
      };
      if (cur) upd('automations', id, patch);
      else ins('automations', { id, ...patch, builder_person_id: pid, adoption_count: 0, first_adopted_on: null, builder_level: 0, decided_by: null, decided_at: null, decision_note: '', open_read: false, created_at: ts });
      return h.done<R>('ai.automation.submit', 'automations', id, `v${version} ${status}`, role, null, '', input.action === 'submit' ? 'Sent to AI governance' : 'Draft saved',
        { id, version, status }, ['automations']);
    },

    async decideAutomation(input) {
      await b.whenReady();
      type R = AutomationDecided;
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.automation.decide', 'automations', given, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', ATM_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['A'])) return refuse('forbidden', ATM_MSG.forbidden_decide);
      const role = ctx().actingRole('ai_literacy', ['A']);
      const cur = get('automations', given);
      if (!cur) return refuse('not_found', ATM_MSG.not_found, role);
      const decision = typeof input?.decision === 'string' ? input.decision : '';
      const problem = decisionProblem(cur as never, decision, input?.note, pid);
      if (problem === 'maker_checker') return refuse('maker_checker', ATM_MSG.maker_checker, role);
      if (problem === 'state') return refuse('invalid', ATM_MSG.state, role);
      if (problem === 'note') return refuse('invalid', ATM_MSG.note, role);
      if (problem === 'decision') return refuse('invalid', ATM_MSG.decision, role);
      if (problem) return refuse('invalid', ATM_MSG.invalid + ATM_PROBLEM_TEXT[problem], role);
      const status = STATUS_AFTER[decision as Decision];
      const listed = status === 'approved';
      const ts = nowTs();
      const note = t(input?.note);
      upd('automations', cur.id, {
        status, listed, decided_by: pid, decided_at: ts, decision_note: note, updated_at: ts,
        history: [...(cur.history ?? []), { at: ts, by: pid, action: decision, version: Number(cur.version), note }],
      });
      const led = decision === 'approve' || decision === 'retire' ? 'kafaa.ai.automation' : null;
      return h.done<R>('ai.automation.decide', 'automations', cur.id, `${decision} v${cur.version}`, role, led, `Automation gallery: ${cur.title_en} ${status}`,
        decision === 'approve' ? 'Entry approved and listed' : decision === 'return' ? 'Entry returned to the builder' : decision === 'reject' ? 'Entry rejected' : 'Entry retired',
        { id: cur.id, status, decision, listed }, ['automations']);
    },

    async adoptAutomation(input) {
      await b.whenReady();
      type R = AutomationAdopted;
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.automation.adopt', 'automations', given, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', ATM_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['Own'])) return refuse('forbidden', ATM_MSG.forbidden);
      const role = ctx().actingRole('ai_literacy', ['Own']);
      const cur = get('automations', given);
      // an entry the caller may not read (not listed, not theirs) reads as not found
      if (!cur || !(cur.listed || cur.builder_person_id === pid)) return refuse('not_found', ATM_MSG.not_found, role);
      const already = raw('automation_adoptions').some((x) => x.automation_id === cur.id && x.person_id === pid);
      const problem = adoptProblem(cur as never, { person_id: pid, rung: rungOf(pid) }, already, input?.note);
      if (problem === 'not_approved') return refuse('invalid', ATM_MSG.not_open, role);
      if (problem === 'own_build') return refuse('own_build', ATM_MSG.own_build, role);
      if (problem === 'already') return refuse('already', ATM_MSG.already, role);
      if (problem === 'rung_low') return refuse('rung_low', ATM_MSG.rung_low, role);
      if (problem) return refuse('invalid', ATM_MSG.adopt_note, role);
      const today = todayIso();
      const ts = nowTs();
      const aid = `aad-${hex(8)}`;
      ins('automation_adoptions', { id: aid, automation_id: cur.id, person_id: pid, family_id: get('people', pid)?.job_family_id ?? null, adopted_on: today, note: t(input?.note), open_read: false, created_at: ts });
      const n = Number(cur.adoption_count) + 1;
      const first = !cur.first_adopted_on;
      const level = builderLevel(cur.status, n);
      const wrote = level > Number(cur.builder_level ?? 0);
      upd('automations', cur.id, { adoption_count: n, first_adopted_on: cur.first_adopted_on ?? today, builder_level: Math.max(level, Number(cur.builder_level ?? 0)), updated_at: ts });
      if (wrote) {
        const eid = builderEvidenceId(cur.id);
        const row = { level, basis: 'validated', status: 'current', observed_on: today, note: `Automation gallery ${cur.id}: approved, ${n} adopter${n === 1 ? '' : 's'}`, active: true };
        if (get('skill_evidence', eid)) upd('skill_evidence', eid, row);
        else ins('skill_evidence', { id: eid, person_id: cur.builder_person_id, skill_id: BUILDER_SKILL, kind: 'ojt', ref_table: 'automations', ref_id: cur.id, ...row, recorded_by: cur.decided_by ?? pid, created_at: ts });
        await applySkills(b, cur.builder_person_id, today);
      }
      return h.done<R>('ai.automation.adopt', 'automations', cur.id, `adopter ${n}${wrote ? ` builder L${level}` : ''}`, role, wrote ? 'kafaa.ai.builder_credit' : null,
        `Automation gallery ${cur.id}: builder credit level ${level} (${n} adopters)`, wrote ? 'Adopted; the builder\'s credit was recorded' : 'Adopted',
        { id: cur.id, adoption_id: aid, adoption_count: n, first_adoption: first, builder_level: Math.max(level, Number(cur.builder_level ?? 0)), evidence_written: wrote },
        ['automations', 'automation_adoptions', 'skill_evidence', 'person_skills']);
    },

    async automationStats() {
      await b.whenReady();
      if (!me()) return null;
      const a = ctx();
      if (!(a.has('ai_literacy', ['Agg', 'A']) || a.has('audit_log', ['R']))) return null;
      const st = galleryStats(raw('automations') as never, raw('automation_adoptions') as never, MIN_GROUP_SIZE);
      const out: AutomationStatsView = { ...st, as_of: todayIso() };
      return out;
    },
  };
}
