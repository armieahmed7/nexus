// FS36 AI-literacy register + FS37 governed AI sandbox drills: LocalBackend RPCs (wave D E5), spread into makeLocalM29.
// 1:1 mirror of supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql: the same checks in the same order, the same
// refusal codes and messages (REG_MSG, DR_MSG), the same audit rows, ledger rows and F01 evidence rows. Pages never import this file.
// Shared write (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:assessment:<attempt>:<skill>` (kind assessment,
// ref_table ai_drill_attempts, basis evidenced, level <= 2) + applySkills for the taker.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { aiRung, type RungCell, type SkillTrackRow, type StateLite } from '../fluency';
import { isStaff } from '../fitness';
import { THRESHOLD, coverage, rawSystemPct, systemProblem, type CellLite, type GroupLite, type PersonRung, type SystemInput, type SystemLite } from '../register';
import { drillProblem, drillStats, normFlags, scoreDrill, submissionProblem, type DrillInput, type DrillKey } from '../drills';
import type { AiCoverageView, DrillResult, M29Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');

/** User-facing refusal messages (identical in SQL). */
export const REG_MSG = {
  not_signed_in: 'Sign in to use the AI-literacy register',
  forbidden: 'Only AI governance (admin) maintains the AI-literacy register',
  not_found: 'Register entry not found',
  invalid: 'Check the register entry: ',
  full_low: 'Fully implemented needs at least 80% of the system\'s users covered on the AI fluency ladder; coverage is below that today',
} as const;
export const REG_PROBLEM_TEXT: Record<string, string> = {
  name: 'a name in English and Arabic (up to 120 characters)', purpose: 'a purpose in English and Arabic (up to 600 characters)', ai_role: 'ENEC\'s role must be provider or deployer',
  use_class: 'choose an approved-use class', maturity: 'choose planned, partially rolled out or fully implemented', status: 'choose draft, published or retired',
  simulated: 'say whether the system is simulated', owner: 'the owner must be ENEC staff', oversight: 'the human-oversight rule in English and Arabic (up to 400 characters)',
  measures: 'up to 6 literacy measures with English and Arabic titles (a published entry needs at least one)', groups: '1 to 8 user groups, each with English and Arabic labels and a side',
  rung: 'each group needs a required rung from 1 to 4', families: 'each group needs job families or all staff', cells: 'extra cells must come from a higher rung than the group\'s rung',
  claim: 'Kafa\'a does not certify or declare compliance; remove compliance or certification wording',
};
export const DR_MSG = {
  not_signed_in: 'Sign in to take a sandbox drill',
  forbidden: 'Sandbox drills are for ENEC staff',
  forbidden_edit: 'Only the training manager edits sandbox drills',
  not_found: 'Drill not found',
  closed: 'This drill is not open',
  invalid: 'Check your answers: ',
  invalid_drill: 'Check the drill: ',
} as const;
export const SUB_PROBLEM_TEXT: Record<string, string> = {
  shape: 'flags and answers are required', segment: 'flag only parts of the summary shown', kind: 'choose a kind of error for every flag', protocol: 'answer every protocol step',
};
export const DRILL_PROBLEM_TEXT: Record<string, string> = {
  texts: 'title, summary and scenario in English and Arabic', difficulty: 'difficulty must be 1, 2 or 3', level: 'the evidence level must be 1 or 2', skill: 'choose an AI-literacy skill',
  status: 'choose draft, published or retired', minutes: 'an estimate from 3 to 30 minutes', synthetic: 'documents must be synthetic (code SYN-XX-000) with a title and revision',
  doc: '3 to 12 numbered procedure steps in both languages', output: 'a tool name and 3 to 12 summary segments with unique ids in both languages',
  protocol: '3 to 5 protocol steps with 2 to 4 options in both languages', errors: '2 to 5 planted errors on different segments, each with a kind and explanations',
  key: 'an answer and explanation for every protocol step, at least one critical', pass: 'a pass mark from 50 to 95', restricted: 'drills never touch plant security',
};

export function makeLocalFs36(b: LocalBackend, h: LocalRpcHelpers): Pick<M29Rpc, 'aiLiteracyCoverage' | 'saveAiSystem' | 'submitDrill' | 'drillStats' | 'saveDrill'> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const cells = () => raw('ai_rungs').map((c) => ({ id: c.id, rung: Number(c.rung), dimension: c.dimension })) as CellLite[];
  const peopleRungs = (): PersonRung[] => {
    const by = new Map<string, StateLite[]>();
    for (const s of raw('person_skills')) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    const rc = raw('ai_rungs') as unknown as RungCell[];
    const tr = raw('ai_skill_tracks') as unknown as SkillTrackRow[];
    return raw('people').filter((p) => isStaff(p as never)).sort((x, y) => (x.id < y.id ? -1 : 1)).map((p) => {
      const r = aiRung(p.id, rc, tr, by.get(p.id) ?? []);
      return { person_id: p.id, family_id: p.job_family_id ?? null, rung: r.rung, met: r.cells.filter((c) => c.met).map((c) => c.id) };
    });
  };
  const groupsOf = (sid: string) => raw('ai_system_users').filter((g) => g.system_id === sid);
  const toGroup = (g: Row): GroupLite => ({ id: g.id, system_id: g.system_id, family_ids: [...(g.family_ids ?? [])], all_staff: !!g.all_staff, side: g.side, required_rung: Number(g.required_rung),
    required_cells: [...(g.required_cells ?? [])], active: !!g.active, sort: Number(g.sort) });

  return {
    async aiLiteracyCoverage() {
      await b.whenReady();
      const pid = me();
      if (!pid) return null;
      const a = ctx();
      const full = a.has('ai_literacy', ['Agg', 'A']) || a.has('audit_log', ['R']);
      const drafts = a.has('ai_literacy', ['A']) || a.has('audit_log', ['R']);
      const systems = raw('ai_systems').filter((s) => s.status !== 'retired' && (full ? (s.listed || drafts) : s.owner_person_id === pid && s.listed));
      if (!full && systems.length === 0) return null;
      const ids = new Set(systems.map((s) => s.id));
      const cov = coverage(systems.map((s) => ({ id: s.id, status: s.status, maturity: s.maturity, owner_person_id: s.owner_person_id, sort: Number(s.sort) })) as SystemLite[],
        raw('ai_system_users').filter((g) => ids.has(g.system_id)).map(toGroup), peopleRungs(), cells(), MIN_GROUP_SIZE, THRESHOLD);
      const out: AiCoverageView = { ...cov, scope: full ? 'all' : 'owner', as_of: todayIso() };
      return out;
    },

    async saveAiSystem(input: SystemInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string; maturity: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.register.save', 'ai_systems', given, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', REG_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['A'])) return refuse('forbidden', REG_MSG.forbidden);
      const role = ctx().actingRole('ai_literacy', ['A']);
      const cur = given ? get('ai_systems', given) : undefined;
      if (given && !cur) return refuse('not_found', REG_MSG.not_found, role);
      const staff = raw('people').filter((p) => isStaff(p as never)).map((p) => p.id as string);
      const problem = systemProblem(input, { families: raw('job_families').map((f) => f.id), cells: cells(), staff });
      if (problem) return refuse('invalid', REG_MSG.invalid + REG_PROBLEM_TEXT[problem], role);
      const ng = input.groups.map((g) => ({ family_ids: g.family_ids, all_staff: g.all_staff, required_rung: g.required_rung, required_cells: g.required_cells, active: true }));
      if (input.maturity === 'full' && rawSystemPct(ng, peopleRungs()) < THRESHOLD) return refuse('invalid', REG_MSG.full_low, role);
      const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const listed = input.status === 'published';
      const owner = get('people', input.owner_person_id)!;
      const id = cur ? cur.id : `ais-${hex(4)}`;
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = {
        name_en: t(input.name_en), name_ar: t(input.name_ar), purpose_en: t(input.purpose_en), purpose_ar: t(input.purpose_ar), ai_role: input.ai_role, use_class: input.use_class, maturity: input.maturity,
        simulated: input.simulated, owner_person_id: input.owner_person_id, owner_en: owner.display_name, owner_ar: owner.display_name_ar, oversight_en: t(input.oversight_en), oversight_ar: t(input.oversight_ar),
        measures: input.measures.map((m) => ({ kind: m.kind, ref: typeof m.ref === 'string' && m.ref.trim() ? m.ref.trim() : null, title_en: t(m.title_en), title_ar: t(m.title_ar) })),
        status: input.status, listed, version, review_due: typeof input.review_due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.review_due) ? input.review_due : null, as_of: todayIso(), updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('ai_systems', id, patch);
      else ins('ai_systems', { id, ...patch, sources: [], benchmark_ids: ['AI-LIT', 'UAE-AI'], sort: raw('ai_systems').reduce((m, s) => Math.max(m, Number(s.sort)), 0) + 1 });
      const existing = groupsOf(id);
      const keep = new Set<string>();
      let n = existing.length;
      input.groups.forEach((g, i) => {
        const old = typeof g.id === 'string' && g.id ? existing.find((x) => x.id === g.id) : undefined;
        const gid = old ? old.id : `${id}-g${++n}`;
        keep.add(gid);
        const row = { label_en: t(g.label_en), label_ar: t(g.label_ar), family_ids: g.all_staff ? [] : [...g.family_ids], all_staff: g.all_staff, side: g.side, required_rung: g.required_rung,
          required_cells: [...g.required_cells], rationale_en: t(g.rationale_en), rationale_ar: t(g.rationale_ar), active: true, listed, sort: i + 1 };
        if (old) upd('ai_system_users', gid, row); else ins('ai_system_users', { id: gid, system_id: id, ...row });
      });
      for (const g of existing) if (!keep.has(g.id) && (g.active || g.listed)) upd('ai_system_users', g.id, { active: false, listed: false });
      return h.done<R>('ai.register.save', 'ai_systems', id, `v${version} ${input.status} ${input.maturity}`, role, listed ? 'kafaa.ai.register' : null,
        `AI-literacy register: ${t(input.name_en)} v${version} ${input.maturity}`, cur ? 'Register entry saved' : 'Register entry added', { id, version, status: input.status, maturity: input.maturity },
        ['ai_systems', 'ai_system_users']);
    },

    async submitDrill(input) {
      await b.whenReady();
      type R = DrillResult;
      const did = typeof input?.drill_id === 'string' ? input.drill_id : '';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.drill.submit', 'ai_drill_attempts', did || null, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', DR_MSG.not_signed_in);
      if (!ctx().has('ai_literacy', ['Own'])) return refuse('forbidden', DR_MSG.forbidden);
      const role = ctx().actingRole('ai_literacy', ['Own']);
      const d = get('ai_drills', did);
      const key = raw('ai_drill_keys').find((k) => k.drill_id === did);
      if (!d || !key) return refuse('not_found', DR_MSG.not_found, role);
      if (d.status !== 'published') return refuse('invalid', DR_MSG.closed, role);
      const flags = input?.flags as never;
      const answers = input?.answers as never;
      const problem = submissionProblem(d as never, flags, answers);
      if (problem) return refuse('invalid', DR_MSG.invalid + SUB_PROBLEM_TEXT[problem], role);
      const sc = scoreDrill({ errors: key.errors, protocol: key.protocol, pass_pct: Number(key.pass_pct) } as DrillKey, flags, answers, Number(d.level));
      const today = todayIso();
      const mine = raw('ai_drill_attempts').filter((a) => a.person_id === pid && a.drill_id === did);
      const aid = `da-${hex(8)}`;
      const evidence = sc.passed ? [{ skill_id: d.skill_id as string, level: sc.level }] : [];
      const earlier = new Set(mine.map((a) => a.id));
      // The latest attempt on a drill replaces earlier evidence from the same drill (kept, inactive).
      for (const old of raw('skill_evidence').filter((x) => x.person_id === pid && x.ref_table === 'ai_drill_attempts' && x.active && earlier.has(x.ref_id))) upd('skill_evidence', old.id, { active: false });
      const { reasons, ...rest } = sc;
      ins('ai_drill_attempts', {
        id: aid, person_id: pid, drill_id: did, drill_version: Number(d.version), attempt_no: mine.length + 1, flags: normFlags(flags), answers: (answers as unknown as Row[]).map((x) => ({ id: x.id, choice: x.choice })),
        points: sc.points, max_points: sc.max, pct: sc.pct, found: sc.found, errors: sc.errors, false_flags: sc.false_flags, critical_ok: sc.critical_ok, passed: sc.passed, level: sc.level,
        feedback: sc.feedback, reasons, evidence, submitted_at: nowTs(),
      });
      for (const e of evidence) {
        ins('skill_evidence', {
          id: evidenceId('assessment', aid, e.skill_id), person_id: pid, skill_id: e.skill_id, kind: 'assessment', ref_table: 'ai_drill_attempts', ref_id: aid, level: e.level, basis: 'evidenced', status: 'current',
          observed_on: today, note: `AI sandbox drill ${did}`, recorded_by: pid, active: true, created_at: nowTs(),
        });
      }
      await applySkills(b, pid, today);
      const data: R = { ...rest, reasons, attempt_id: aid, drill_id: did, attempt_no: mine.length + 1, pass_pct: Number(key.pass_pct), evidence };
      return h.done<R>('ai.drill.submit', 'ai_drill_attempts', aid, `${did} ${sc.pct}% ${sc.passed ? `pass L${sc.level}` : 'not yet'}`, role, sc.passed ? 'kafaa.ai.drill' : null,
        `AI sandbox drill ${did}: passed at level ${sc.level}`, sc.passed ? 'Drill passed' : 'Drill submitted', data, ['ai_drill_attempts', 'skill_evidence', 'person_skills']);
    },

    async drillStats() {
      await b.whenReady();
      if (!me()) return null;
      const a = ctx();
      if (!(a.has('ai_literacy', ['W', 'Agg']) || a.has('secure_items', ['W', 'A']))) return null;
      return drillStats(raw('ai_drill_attempts') as never, raw('ai_drills').filter((d) => d.status !== 'retired').map((d) => d.id), MIN_GROUP_SIZE);
    },

    async saveDrill(input: DrillInput) {
      await b.whenReady();
      type R = { id: string; version: number; status: string };
      const given = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('ai.drill.save', 'ai_drills', given, code, msg, role);
      const pid = me();
      if (!pid) return refuse('not_signed_in', DR_MSG.not_signed_in);
      if (!(ctx().has('ai_literacy', ['W']) && ctx().has('secure_items', ['W', 'A']))) return refuse('forbidden', DR_MSG.forbidden_edit);
      const role = ctx().actingRole('ai_literacy', ['W']);
      const cur = given ? get('ai_drills', given) : undefined;
      if (given && !cur) return refuse('not_found', DR_MSG.not_found, role);
      const lit = raw('ai_skill_tracks').filter((x) => x.track === 'literacy').map((x) => x.skill_id as string);
      const problem = drillProblem(input, lit);
      if (problem) return refuse('invalid', DR_MSG.invalid_drill + DRILL_PROBLEM_TEXT[problem], role);
      const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const id = cur ? cur.id : `ad-${hex(4)}`;
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = {
        title_en: t(input.title_en), title_ar: t(input.title_ar), summary_en: t(input.summary_en), summary_ar: t(input.summary_ar), scenario_en: t(input.scenario_en), scenario_ar: t(input.scenario_ar),
        difficulty: input.difficulty, level: input.level, skill_id: input.skill_id, doc: input.doc, output: input.output, protocol: input.protocol, est_minutes: input.est_minutes, synthetic: true,
        status: input.status, listed: input.status === 'published', version, updated_by: pid, updated_at: nowTs(),
      };
      if (cur) upd('ai_drills', id, patch);
      else ins('ai_drills', { id, ...patch, sources: [], sort: raw('ai_drills').reduce((m, d) => Math.max(m, Number(d.sort)), 0) + 1 });
      const kid = `adk-${id}`;
      const krow = { errors: input.key.errors, protocol: input.key.protocol, pass_pct: input.key.pass_pct };
      if (get('ai_drill_keys', kid)) upd('ai_drill_keys', kid, krow); else ins('ai_drill_keys', { id: kid, drill_id: id, ...krow });
      return h.done<R>('ai.drill.save', 'ai_drills', id, `v${version} ${input.status}`, role, null, '', cur ? 'Drill saved' : 'Drill added', { id, version, status: input.status }, ['ai_drills', 'ai_drill_keys']);
    },
  };
}
