// M16 LocalBackend RPCs added by W3 · E5 (F24 Recommendation transparency, opt-out and fairness monitor). Installed on every
// LocalRpc by src/data/ext/local.ts (spread after makeW0LocalRpc, so setEngineWeights here replaces the wave-0 one).
// 1:1 mirror of supabase/migrations/20261009135001_kafaa_w3e5_transparency.sql: same checks in the same order, refusal codes,
// messages, audit rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { SCHEMA } from '../../../data/schema';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { SURFACES } from '../../../domain/engines/types';
import { OPTOUT_SURFACES, fairnessSnapshot, isoWeek, type FairnessData } from '../fairness';
import { ENGINE_MSG, RATIONALE_MIN, sameWeights, validHalfLives, validWeights } from '../transparency'; // FS03: validHalfLives
import type { DecideResult, EngineChangeResult, M16Rpc, OptoutResult, OptoutStat, ProposeResult, SnapshotResult, SurfaceSnapshotResult, TaxonomyHealth } from './rpc';
// FS54 / FS55 (wave F · E3): 1:1 mirror of supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql
import { GOV_MSG, govResultCode, changePlan, clean, decideProblem, inclusionChecks, inclusionOk, nextId, proposeProblem, requestTitle, taxonomyHealth, voteOutcome, type HealthData, type Proposal, type RequestRow, type SkillLite } from '../taxonomyGov';
import { surfaceSnapshot, type SurfaceData } from '../surfaces';
import { skillGuard } from '../../../domain/taxonomy';

/** Everything the fairness monitor reads, straight from the in-memory tables (no RLS: the RPC is the gate). */
export function localFairnessData(b: LocalBackend): FairnessData {
  const raw = (t: string) => b.raw(t as never) as unknown as never[];
  return {
    people: raw('people'), roles: raw('job_roles'), edges: raw('career_paths'), roleComps: raw('role_competencies'), competencies: raw('competencies'), skills: raw('skills'),
    states: raw('person_skills'), licences: raw('licences'), standards: raw('qual_standards'), qualRecords: raw('qual_records'), programmes: raw('programmes'), courses: raw('courses'),
    trainingRecords: raw('training_records'), enrolments: raw('enrolments'), weights: (b.rawGet('engine_settings', 'recommend')?.weights ?? undefined) as never,
    optouts: raw('reco_optouts'), applications: raw('opportunity_applications'), mentoring: raw('mentoring_requests'), nominations: raw('leadership_nominations'),
    placements: Object.prototype.hasOwnProperty.call(SCHEMA, 'review_placements') ? raw('review_placements') : null,
  };
}

/** FS54: the catalogue tables the staleness and orphan-rate audit reads (TAUGHT_BY in taxonomyGov.ts). */
export function localHealthData(b: LocalBackend): HealthData {
  const raw = (t: string) => (Object.prototype.hasOwnProperty.call(SCHEMA, t) ? (b.raw(t as never) as unknown as Record<string, unknown>[]) : []);
  return {
    skills: raw('skills') as unknown as SkillLite[], courses: raw('courses'), courseSkillLinks: raw('course_skill_links'), pathways: raw('pathways'), standards: raw('qual_standards'),
    adaptiveBanks: raw('adaptive_banks'), adaptiveItems: raw('adaptive_items'), perfTasks: raw('performance_tasks'), twinScenarios: raw('twin_scenarios'), aiDrills: raw('ai_drills'),
    fitnessAreas: raw('fitness_areas'), profileVersions: raw('role_profile_versions'), roleCompetencies: raw('role_competencies'), taskSkills: raw('jta_task_skills'),
  };
}
/** FS55: the rows the surface fairness snapshot reads. */
export function localSurfaceData(b: LocalBackend): SurfaceData {
  const raw = (t: string) => (Object.prototype.hasOwnProperty.call(SCHEMA, t) ? (b.raw(t as never) as unknown as Record<string, unknown>[]) : []);
  return {
    people: raw('people') as never, digestRuns: raw('digest_runs'), advisorSessions: raw('advisor_sessions'), pathwayEnrolments: raw('pathway_enrolments'), externalCompletions: raw('external_completions'),
    fitnessAttempts: raw('fitness_attempts'), opportunities: raw('opportunities'), applications: raw('opportunity_applications'), twinAttempts: raw('twin_attempts'),
    adaptiveAttempts: raw('adaptive_attempts'), instructorTracks: raw('instructor_tracks'),
  };
}

export function makeLocalM16(b: LocalBackend, h: LocalRpcHelpers): M16Rpc {
  /** The shared write of changeEngineWeights and setEngineWeights (SQL kafaa_engine_apply_change). */
  const applyChange = async (surface: string, engine: string, weights: Record<string, number> | null, rationale: string | null, role: string, message: string): Promise<Result<EngineChangeResult>> => {
    const row0 = b.rawGet('engine_settings', surface);
    // copy before the update: rawUpdate changes the stored row in place
    const cur = row0 ? { engine: row0.engine, weights: { ...((row0.weights ?? {}) as Record<string, number>) } } : null;
    const ts = nowTs();
    const after = weights ?? cur?.weights ?? {};
    const row = { engine, weights: after, updated_by: b.identity().personId, updated_at: ts };
    if (row0) b.rawUpdate('engine_settings', surface, row as never);
    else b.rawInsert('engine_settings', { id: surface, surface, ...row } as never);
    const n = b.raw('engine_changes').filter((c) => c.surface === surface).length;
    const id = `ec:${surface}:${String(n + 1).padStart(3, '0')}`;
    const cards = b.raw('engine_cards').filter((c) => c.engine_surface === surface).map((c) => c.id).sort();
    b.rawInsert('engine_changes', {
      id, surface, engine_before: cur?.engine ?? null, engine_after: engine, weights_before: cur?.weights ?? {}, weights_after: after, rationale, card_ids: cards,
      changed_by: b.identity().personId, changed_by_role: role, changed_at: ts, audit_seq: null, ledger_seq: null,
    } as never);
    for (const c of cards) { const card = b.rawGet('engine_cards', c)!; b.rawUpdate('engine_cards', c, { version: card.version + 1, last_changed_at: ts, last_change_id: id } as never); }
    const r = await h.done<EngineChangeResult>('engine.settings', 'engine_settings', surface, `${surface}: ${engine}${rationale ? ` (${rationale})` : ''}`, role, 'kafaa.ai.engine_change',
      `Engine settings for ${surface}: ${cur?.engine ?? 'default'} -> ${engine}; change ${id}`, message, { change_id: id, surface, engine, cards }, ['engine_settings', 'engine_changes', 'engine_cards']);
    b.rawUpdate('engine_changes', id, { audit_seq: r.audit_seq ?? null, ledger_seq: r.ledger_seq ?? null } as never);
    return r;
  };
  const engineChecks = (surface: string, engine: string, weights: unknown, refuse: (code: string, msg: string, r?: string | null) => Promise<Result<never>>, role: string | null) => {
    if (!role) return refuse('forbidden', ENGINE_MSG.forbidden, null);
    if (!surface || !SURFACES.includes(surface as never)) return refuse('invalid', ENGINE_MSG.surface);
    if (engine !== 'deterministic' && engine !== 'model') return refuse('invalid', ENGINE_MSG.engine);
    if (weights != null && !validWeights(weights, surface)) return refuse('invalid', ENGINE_MSG.weights);
    if (surface === 'skills' && weights != null && !validHalfLives(weights as Record<string, number>)) return refuse('invalid', ENGINE_MSG.halfLife); // FS03
    return null;
  };

  return {
    async setRecoOptout(surface, optedOut, reason = null) {
      await b.whenReady();
      type R = OptoutResult;
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reco.optout', 'reco_optouts', surface ?? null, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to change your recommendation settings');
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Recommendations are for staff with a skills profile');
      if (!OPTOUT_SURFACES.includes(surface as never) || typeof optedOut !== 'boolean') return refuse('invalid', 'Unknown recommendation surface', role);
      const why = (reason ?? '').trim();
      if (why.length > 500) return refuse('invalid', 'Keep the reason under 500 characters', role);
      const id = `ro:${me}:${surface}`;
      const cur = b.rawGet('reco_optouts', id);
      const ts = nowTs();
      if (cur) b.rawUpdate('reco_optouts', id, { opted_out: optedOut, reason: why || null, updated_at: ts } as never);
      else b.rawInsert('reco_optouts', { id, person_id: me, surface, opted_out: optedOut, reason: why || null, created_at: ts, updated_at: ts } as never);
      return h.done<R>('reco.optout', 'reco_optouts', id, `${surface}: ${optedOut ? 'opted out' : 'opted in'}`, role, 'kafaa.ai.optout',
        `${optedOut ? 'Opted out of' : 'Opted back in to'} ${surface} recommendations`, optedOut ? 'Ranked suggestions are off for this surface' : 'Ranked suggestions are back on for this surface',
        { id, surface, opted_out: optedOut }, ['reco_optouts']);
    },

    async runFairnessSnapshot(asOf = null) {
      await b.whenReady();
      type R = SnapshotResult;
      const role = b.access().actingRole('integrations', ['A']);
      const today = todayIso();
      const day = asOf ?? today;
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse<R>('fairness.snapshot', 'fairness_snapshots', day, code, msg, r);
      if (!role) return refuse('forbidden', 'Only a platform admin or AI governance lead may run the fairness snapshot', null);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || day > today || day < new Date(Date.parse(today) - 366 * 86_400_000).toISOString().slice(0, 10))
        return refuse('invalid', 'Choose a date within the last year');
      const rows = fairnessSnapshot(localFairnessData(b), day);
      const ts = nowTs();
      const by = b.identity().personId;
      for (const r of rows) {
        const row = { ...r, run_by: by, created_at: ts };
        if (b.rawGet('fairness_snapshots', r.id)) b.rawUpdate('fairness_snapshots', r.id, row as never);
        else b.rawInsert('fairness_snapshots', row as never);
      }
      const flagged = new Set(rows.filter((r) => r.flagged).map((r) => `${r.metric}:${r.dimension}`)).size;
      const suppressed = new Set(rows.filter((r) => r.suppressed).map((r) => `${r.metric}:${r.dimension}`)).size;
      const period = isoWeek(day);
      const hipo = rows.find((r) => r.metric === 'hipo_pool')?.source ?? 'leadership_nominations';
      return h.done<R>('fairness.snapshot', 'fairness_snapshots', period, `${period}: ${rows.length} rows, ${flagged} flagged, ${suppressed} suppressed`, role, 'kafaa.ai.fairness_snapshot',
        `Fairness snapshot ${period} (as of ${day}): ${flagged} comparisons below four-fifths, ${suppressed} suppressed`, 'Fairness snapshot saved',
        { period, as_of: day, rows: rows.length, flagged, suppressed, hipo_source: hipo }, ['fairness_snapshots']);
    },

    async changeEngineWeights(surface, engine, weights, rationale) {
      await b.whenReady();
      type R = EngineChangeResult;
      const role = b.access().actingRole('integrations', ['A']);
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse<R>('engine.settings', 'engine_settings', surface ?? null, code, msg, r) as Promise<Result<never>>;
      const bad = await engineChecks(surface, engine, weights, refuse, role);
      if (bad) return bad;
      const why = (rationale ?? '').trim();
      if (why.length < RATIONALE_MIN || why.length > 500) return refuse('invalid', ENGINE_MSG.rationale);
      const cur = b.rawGet('engine_settings', surface);
      if (cur && cur.engine === engine && (weights == null || sameWeights(cur.weights as Record<string, number>, weights))) return refuse('no_change', ENGINE_MSG.noChange);
      return applyChange(surface, engine, weights, why, role!, 'Engine settings changed and logged');
    },

    async setEngineWeights(surface, engine, weights = null) {
      await b.whenReady();
      const role = b.access().actingRole('integrations', ['A']);
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse('engine.settings', 'engine_settings', surface, code, msg, r) as Promise<Result<never>>;
      const bad = await engineChecks(surface, engine, weights, refuse, role);
      if (bad) return bad;
      return applyChange(surface, engine, weights ?? null, null, role!, 'Engine settings saved');
    },

    async optoutStats() {
      await b.whenReady();
      const ctx = b.access();
      if (!ctx.has('integrations', ['R', 'A']) && !ctx.has('skills_profile', ['Agg', 'A'])) throw new Error("Kafa'a · opt-out counts are aggregate-only and restricted");
      return OPTOUT_SURFACES.map((surface): OptoutStat => {
        const n = new Set(b.raw('reco_optouts').filter((o) => o.surface === surface && o.opted_out).map((o) => o.person_id)).size;
        return { surface, n: n < MIN_GROUP_SIZE ? null : n, suppressed: n < MIN_GROUP_SIZE };
      });
    },

    // ───────────── FS54: skills council and taxonomy change tracker
    async proposeSkillChange(input) {
      await b.whenReady();
      type R = ProposeResult;
      const me = b.identity().personId;
      const x = { ...(input ?? {}) } as typeof input;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.propose_change', 'skill_change_requests', x?.skill_id ?? null, code, msg, role);
      if (!me) return refuse('not_signed_in', GOV_MSG.not_signed_in);
      const role = b.access().actingRole('skills_taxonomy', ['W']);
      if (!role) return refuse('forbidden', GOV_MSG.forbidden_propose);
      const skills = b.raw('skills') as unknown as SkillLite[];
      const comps = b.raw('competencies').map((c) => c.id as string);
      const reqs = b.raw('skill_change_requests') as unknown as RequestRow[];
      const bad = proposeProblem(x, skills, comps, reqs);
      if (bad) return refuse(govResultCode(bad), GOV_MSG[bad], role);
      const id = nextId('scr', reqs.map((r) => r.id));
      const target = x.skill_id ? skills.find((k) => k.id === x.skill_id) ?? null : null;
      const proposal = (x.proposal ?? {}) as Proposal;
      const title = requestTitle(x.kind, target, proposal);
      const ts = nowTs();
      b.rawInsert('skill_change_requests', {
        id, kind: x.kind, skill_id: x.kind === 'add' ? null : x.skill_id, title_en: title.en, title_ar: title.ar, proposal, rationale: clean(x.rationale), development: clean(x.development),
        assessment: clean(x.assessment), inclusion: inclusionChecks(x, skills, comps), status: 'submitted', proposed_by: me, proposed_role: role, proposed_at: ts, votes: [],
        first_by: null, first_decision: null, second_by: null, decided_at: null, change_id: null, updated_at: ts,
      } as never);
      return h.done<R>('skills.propose_change', 'skill_change_requests', id, `${x.kind} ${x.skill_id ?? clean(proposal.name_en)}`, role, null, '', 'Change request sent to the skills council',
        { id, status: 'submitted', title_en: title.en, title_ar: title.ar }, ['skill_change_requests']);
    },

    async decideSkillChange(id, decision, note = null) {
      await b.whenReady();
      type R = DecideResult;
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.decide_change', 'skill_change_requests', id ?? null, code, msg, role);
      if (!me) return refuse('not_signed_in', GOV_MSG.not_signed_in);
      const role = b.access().actingRole('skills_taxonomy', ['A']);
      if (!role) return refuse('forbidden', GOV_MSG.forbidden_decide);
      const r = (b.rawGet('skill_change_requests', id) ?? null) as unknown as RequestRow | null;
      const bad = decideProblem(r, me, decision, note);
      if (bad) return refuse(govResultCode(bad), GOV_MSG[bad], role);
      const req = r!;
      const out = voteOutcome(req.status, req.first_decision, decision);
      const skills = b.raw('skills') as unknown as SkillLite[];
      const comps = b.raw('competencies').map((c) => c.id as string);
      if (out.publish && !inclusionOk(inclusionChecks({ kind: req.kind, skill_id: req.skill_id, proposal: req.proposal, rationale: req.rationale, development: req.development, assessment: req.assessment }, skills, comps)))
        return refuse('conflict', GOV_MSG.stale, role);
      const ts = nowTs();
      const vote = { by: me, role, decision, note: clean(note) || null, at: ts };
      const votes = [...(Array.isArray(req.votes) ? req.votes : []), vote];
      let changeId: string | null = null;
      let newIds: string[] = [];
      if (out.publish) {
        const today = todayIso();
        const plan = changePlan(req, skills, today);
        for (const u of plan.updates) {
          const before = b.rawGet('skills', u.id)!;
          const why = skillGuard(before as never, { ...before, ...u.patch } as never);
          if (why) return refuse('conflict', why, role);
        }
        for (const n of plan.inserts) b.rawInsert('skills', n as never);
        for (const u of plan.updates) b.rawUpdate('skills', u.id, u.patch as never);
        changeId = nextId('sc', b.raw('skill_changes').map((c) => c.id as string));
        newIds = plan.change.new_skill_ids;
        const first = votes.find((v) => v.by === req.first_by)?.role ?? null;
        b.rawInsert('skill_changes', { ...plan.change, id: changeId, decided_roles: [first, role].filter(Boolean), published_at: ts, ledger_seq: null } as never);
      }
      const patch: Record<string, unknown> = { status: out.status, votes, updated_at: ts };
      if (req.status === 'submitted') { patch.first_by = me; patch.first_decision = decision; }
      else if (out.final) { patch.second_by = me; patch.decided_at = ts; patch.change_id = changeId; }
      else { patch.first_by = null; patch.first_decision = null; }
      b.rawUpdate('skill_change_requests', req.id, patch as never);
      const what = out.status === 'published' ? 'published' : out.status === 'rejected' ? 'rejected' : req.status === 'submitted' ? `first ${decision}` : 'votes differ, back to submitted';
      const res = await h.done<R>('skills.decide_change', 'skill_change_requests', req.id, `${decision}: ${what}`, role,
        out.status === 'published' ? 'kafaa.skills.change_published' : out.status === 'rejected' ? 'kafaa.skills.change_rejected' : 'kafaa.skills.council_vote',
        `Skills council ${decision} on ${req.id} (${req.kind}${req.skill_id ? ` ${req.skill_id}` : ''}): ${what}; maker-checker, two different council members`,
        out.status === 'published' ? 'Change published to the catalogue and the public change log' : out.status === 'rejected' ? 'Request rejected by two council members'
          : req.status === 'submitted' ? (decision === 'approve' ? 'First approval recorded: a second council member decides' : 'First rejection recorded: a second council member confirms or overturns it')
            : 'Votes differ: the request goes back to the council for a fresh pair of decisions',
        { id: req.id, status: out.status, change_id: changeId, new_skill_ids: newIds },
        out.publish ? ['skill_change_requests', 'skill_changes', 'skills'] : ['skill_change_requests']);
      if (changeId) b.rawUpdate('skill_changes', changeId, { ledger_seq: res.ledger_seq ?? null } as never);
      return res;
    },

    async skillCouncilQueue() {
      await b.whenReady();
      const ctx = b.access();
      if (!ctx.has('skills_taxonomy', ['A']) && !ctx.has('audit_log', ['R'])) throw new Error(`Kafa'a · ${GOV_MSG.forbidden_queue}`);
      return (b.raw('skill_change_requests') as unknown as RequestRow[]).slice().sort((x, y) => (x.proposed_at < y.proposed_at ? 1 : x.proposed_at > y.proposed_at ? -1 : x.id < y.id ? 1 : -1));
    },

    async taxonomyHealth(): Promise<TaxonomyHealth> {
      await b.whenReady();
      if (!b.identity().personId) throw new Error(`Kafa'a · ${GOV_MSG.not_signed_in}`);
      return taxonomyHealth(localHealthData(b), todayIso());
    },

    // ───────────── FS55: fairness snapshot of the new ranked surfaces
    async runSurfaceFairness(asOf = null) {
      await b.whenReady();
      type R = SurfaceSnapshotResult;
      const role = b.access().actingRole('integrations', ['A']);
      const today = todayIso();
      const day = asOf ?? today;
      const refuse = (code: string, msg: string, r: string | null = role) => h.refuse<R>('fairness.surface_snapshot', 'surface_fairness', day, code, msg, r);
      if (!role) return refuse('forbidden', 'Only a platform admin or AI governance lead may run the fairness snapshot', null);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || day > today || day < new Date(Date.parse(today) - 366 * 86_400_000).toISOString().slice(0, 10))
        return refuse('invalid', 'Choose a date within the last year');
      const rows = surfaceSnapshot(localSurfaceData(b), day);
      const ts = nowTs();
      const by = b.identity().personId;
      for (const r of rows) {
        const row = { id: r.id, period: r.period, as_of: r.as_of, card: r.card, metric: r.metric, dimension: r.dimension, group_key: r.group_key, n: r.n, positives: r.positives, rate: r.rate, ratio: r.ratio,
          suppressed: r.suppressed, flagged: r.flagged, source: r.source, run_by: by, created_at: ts };
        if (b.rawGet('surface_fairness', r.id)) b.rawUpdate('surface_fairness', r.id, row as never);
        else b.rawInsert('surface_fairness', row as never);
      }
      const flagged = new Set(rows.filter((r) => r.flagged).map((r) => `${r.metric}:${r.dimension}`)).size;
      const suppressed = new Set(rows.filter((r) => r.suppressed).map((r) => `${r.metric}:${r.dimension}`)).size;
      const period = isoWeek(day);
      return h.done<R>('fairness.surface_snapshot', 'surface_fairness', period, `${period}: ${rows.length} rows, ${flagged} flagged, ${suppressed} suppressed`, role, 'kafaa.ai.surface_fairness',
        `Ranked-surface fairness snapshot ${period} (as of ${day}): ${flagged} comparisons below four-fifths, ${suppressed} suppressed`, 'Ranked-surface fairness snapshot saved',
        { period, as_of: day, rows: rows.length, flagged, suppressed }, ['surface_fairness']);
    },
  };
}
