// M28 LocalBackend RPC implementations for FS wave H · E1 (FS70 ENEC Skills on the Rise + manager pulse, FS71 hot technologies and
// in-demand badges, FS72 "Skills you may have"). Spread into makeLocalM28 (backend/local.ts). 1:1 mirror of
// supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql: the same checks in the same order, the same refusal codes and messages
// (RS_MSG, HT_MSG, SSG_MSG), one audit row for every refusal and every write, ledger rows when a list or badge set is published and when a
// fairness snapshot runs. Rules: src/modules/m28/{signals,technologies,suggestions,suggestFairness}.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { RS_MSG, pulseOpen, pulseSummary, quarterClosed, quarterComputable, risingSkills, shareOk, signalInputFromTables, teamOk } from '../signals';
import { HT_MSG, HT_PROBLEM_TEXT, SOURCE_TABLES, badgeInputFromTables, techProblem, technologyBadges, type TechInput } from '../technologies';
import { RESPONSES, SSG_MSG, evidenceId, inferSuggestions, refreshPlan, responseStatus, ssgWorldFromTables, suppressedUntil, type SuggestResponse } from '../suggestions';
import { suggestionFairness } from '../suggestFairness';
import type { M28Rpc, PulseInput, SuggestionStats, TagInput } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Fs70Keys = 'computeSkillSignals' | 'publishSkillSignals' | 'submitManagerPulse' | 'managerPulseSummary' | 'saveTechnology' | 'tagTechnology' | 'computeTechnologyBadges'
  | 'publishTechnologyBadges' | 'refreshSkillSuggestions' | 'respondSuggestion' | 'runSuggestionFairness' | 'suggestionStats';
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const PULSE_YEAR_MSG = 'Choose a pulse year from 2025 to the current year';
const SUMMARY_MAX = 600;
const sup = (n: number) => (n < 10 ? null : n);

export function makeLocalFs70(b: LocalBackend, h: LocalRpcHelpers): Pick<M28Rpc, Fs70Keys> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const ok = <T,>(message: string, data: T) => ({ ok: true, code: 'ok', message, data }) as Result<T>;

  return {
    // ───────────── FS70
    async computeSkillSignals(quarter) {
      await b.whenReady();
      type R = import('../signals').RisingResult;
      const q = typeof quarter === 'string' ? quarter : '';
      if (!me()) return h.refuse<R>('skill_signals.compute', 'skill_signals', q || null, 'not_signed_in', RS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A'])) return h.refuse<R>('skill_signals.compute', 'skill_signals', q || null, 'forbidden', RS_MSG.forbidden_compute);
      const role = ctx().actingRole('workforce_strategy', ['Agg', 'R', 'W', 'A']);
      if (!quarterComputable(q, todayIso())) return h.refuse<R>('skill_signals.compute', 'skill_signals', q || null, 'invalid', RS_MSG.invalid_quarter, role);
      return ok('Skills on the Rise computed', risingSkills(signalInputFromTables(raw), q)!);
    },

    async publishSkillSignals(quarter, summaryEn, summaryAr) {
      await b.whenReady();
      type R = { id: string; quarter: string; now: number; growing: number };
      const q = typeof quarter === 'string' ? quarter : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('skill_signals.publish', 'skill_signal_runs', q || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['W', 'A'])) return refuse('forbidden', RS_MSG.forbidden_publish);
      const role = ctx().actingRole('workforce_strategy', ['W', 'A']);
      const today = todayIso();
      if (!quarterComputable(q, today)) return refuse('invalid', RS_MSG.invalid_quarter, role);
      if (!quarterClosed(q, today)) return refuse('open_quarter', RS_MSG.open_quarter, role);
      const id = `ssr:${q}`;
      if (get('skill_signal_runs', id) || raw('skill_signal_runs').some((r) => r.quarter === q)) return refuse('published', RS_MSG.published, role);
      const res = risingSkills(signalInputFromTables(raw), q)!;
      const ts = nowTs();
      ins('skill_signal_runs', { id, quarter: q, method: res.method, status: 'published', counts: res.counts, published_by: pid, published_role: role, published_at: ts,
        summary_en: txt(summaryEn).slice(0, SUMMARY_MAX), summary_ar: txt(summaryAr).slice(0, SUMMARY_MAX) });
      for (const r of res.rows) ins('skill_signals', { id: `ss:${q}:${r.skill_id}`, run_id: id, quarter: q, skill_id: r.skill_id, category: r.category, rank: r.rank, score: r.score,
        moved_by: r.moved_by, signals: r.signals, families: r.families, reasons: r.reasons, published_at: ts });
      return h.done<R>('skill_signals.publish', 'skill_signal_runs', id, `${q} ${res.counts.now} now ${res.counts.growing} growing`, role, 'kafaa.skills.signals_publish',
        `ENEC Skills on the Rise ${q} published: ${res.counts.now} in demand now, ${res.counts.growing} growing`, 'Skills on the Rise published', { id, quarter: q, now: res.counts.now, growing: res.counts.growing }, ['skill_signal_runs', 'skill_signals']);
    },

    async submitManagerPulse(input: PulseInput) {
      await b.whenReady();
      type R = { id: string; year: number; share_pct: number };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('manager_pulse.submit', 'manager_pulse', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', RS_MSG.not_signed_in);
      if (!ctx().has('transformation', ['Scope'])) return refuse('forbidden', RS_MSG.pulse_forbidden);
      const role = ctx().actingRole('transformation', ['Scope']);
      const today = todayIso();
      if (!pulseOpen(today)) return refuse('closed', RS_MSG.pulse_closed, role);
      if (!input || typeof input !== 'object' || !shareOk(input.share_pct) || !teamOk(input.team_size)) return refuse('invalid', RS_MSG.pulse_invalid, role);
      const year = Number(today.slice(0, 4));
      const id = `mp:${year}:${pid}`;
      const fam = (get('people', pid)?.job_family_id as string | undefined) ?? null;
      const ts = nowTs();
      if (get('manager_pulse', id)) upd('manager_pulse', id, { share_pct: input.share_pct, team_size: input.team_size ?? null, family_id: fam, updated_at: ts });
      else ins('manager_pulse', { id, year, person_id: pid, family_id: fam, team_size: input.team_size ?? null, share_pct: input.share_pct, submitted_at: ts, updated_at: ts });
      return h.done<R>('manager_pulse.submit', 'manager_pulse', id, `${year} ${input.share_pct}%`, role, null, '', 'Thank you: your answer is saved', { id, year, share_pct: input.share_pct }, ['manager_pulse']);
    },

    async managerPulseSummary(year) {
      await b.whenReady();
      type R = import('../signals').PulseSummary;
      if (!me()) return h.refuse<R>('manager_pulse.summary', 'manager_pulse', null, 'not_signed_in', RS_MSG.not_signed_in);
      if (!ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A']) && !ctx().has('transformation', ['Agg'])) return h.refuse<R>('manager_pulse.summary', 'manager_pulse', null, 'forbidden', RS_MSG.pulse_read_forbidden);
      const role = ctx().actingRole('workforce_strategy', ['Agg', 'R', 'W', 'A']) ?? ctx().actingRole('transformation', ['Agg']);
      const now = Number(todayIso().slice(0, 4));
      if (!Number.isInteger(year) || year < 2025 || year > now) return h.refuse<R>('manager_pulse.summary', 'manager_pulse', null, 'invalid', PULSE_YEAR_MSG, role);
      return ok('Manager pulse', pulseSummary(raw('manager_pulse') as never, year));
    },

    // ───────────── FS71
    async saveTechnology(input: TechInput) {
      await b.whenReady();
      type R = { id: string; version: number };
      const tid = typeof input?.id === 'string' && input.id ? input.id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('technology.save', 'technologies', tid, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', HT_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', HT_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const cur = get('technologies', tid);
      const pr = techProblem(input, raw('skills').map((s) => s.id as string), !cur);
      if (pr) return refuse('invalid', HT_MSG.invalid + HT_PROBLEM_TEXT[pr], role);
      const id = input.id as string;
      const ts = nowTs();
      const version = cur ? Number(cur.version) + 1 : 1;
      const patch = { name_en: txt(input.name_en), name_ar: txt(input.name_ar), description_en: txt(input.description_en), description_ar: txt(input.description_ar), category: input.category,
        skill_ids: [...(input.skill_ids ?? [])], status: input.status ?? (cur?.status as string | undefined) ?? 'active', version, updated_by: pid, updated_at: ts };
      if (cur) upd('technologies', id, patch);
      else ins('technologies', { id, ...patch, created_by: pid, created_at: ts, sort: raw('technologies').reduce((m, r) => Math.max(m, Number(r.sort ?? 0)), 0) + 1 });
      return h.done<R>('technology.save', 'technologies', id, `v${version} ${patch.status}`, role, null, '', cur ? 'Technology saved' : 'Technology added', { id, version }, ['technologies']);
    },

    async tagTechnology(input: TagInput) {
      await b.whenReady();
      type R = { id: string; active: boolean };
      const tech = typeof input?.technology_id === 'string' ? input.technology_id : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('technology.tag', 'technology_links', tech || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', HT_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', HT_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const t = get('technologies', tech);
      if (!t || t.status !== 'active') return refuse('not_found', HT_MSG.not_found, role);
      const table = String(input.ref_table ?? '');
      const refId = typeof input.ref_id === 'string' ? input.ref_id : '';
      let src: { family_id: string | null; role_id: string | null; source_on: string } | null = null;
      if ((SOURCE_TABLES as readonly string[]).includes(table)) {
        if (table === 'opportunities') { const o = get('opportunities', refId); if (o && o.status !== 'draft') src = { family_id: o.family_id ?? null, role_id: o.host_role_id ?? null, source_on: d10(o.created_at) }; }
        else { const v = get('role_profile_versions', refId); if (v && (v.status === 'published' || v.status === 'superseded') && v.published_at) src = { family_id: (get('job_roles', v.role_id)?.family_id as string | undefined) ?? null, role_id: v.role_id, source_on: d10(v.published_at) }; }
      }
      if (!src) return refuse('source_not_found', HT_MSG.source_not_found, role);
      const id = `tl:${tech}:${table}:${refId}`;
      const cur = get('technology_links', id);
      const active = input.active !== false;
      if ((cur && cur.active === active) || (!cur && !active)) return refuse('no_change', HT_MSG.no_change, role);
      if (cur) upd('technology_links', id, { active, ...src, linked_by: pid, linked_at: nowTs() });
      else ins('technology_links', { id, technology_id: tech, ref_table: table, ref_id: refId, ...src, active, linked_by: pid, linked_at: nowTs() });
      return h.done<R>('technology.tag', 'technology_links', id, active ? 'tagged' : 'untagged', role, null, '', active ? 'Technology tag added' : 'Technology tag removed', { id, active }, ['technology_links']);
    },

    async computeTechnologyBadges(quarter) {
      await b.whenReady();
      type R = import('../technologies').BadgeResult;
      const q = typeof quarter === 'string' ? quarter : '';
      if (!me()) return h.refuse<R>('technology.badges_compute', 'technology_badges', q || null, 'not_signed_in', HT_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return h.refuse<R>('technology.badges_compute', 'technology_badges', q || null, 'forbidden', HT_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      if (!quarterComputable(q, todayIso())) return h.refuse<R>('technology.badges_compute', 'technology_badges', q || null, 'invalid', HT_MSG.invalid_quarter, role);
      return ok('Technology badges computed', technologyBadges(badgeInputFromTables(raw), q)!);
    },

    async publishTechnologyBadges(quarter) {
      await b.whenReady();
      type R = { quarter: string; hot: number; roles: number };
      const q = typeof quarter === 'string' ? quarter : '';
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('technology.badges_publish', 'technology_badges', q || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', HT_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', HT_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const today = todayIso();
      if (!quarterComputable(q, today)) return refuse('invalid', HT_MSG.invalid_quarter, role);
      if (!quarterClosed(q, today)) return refuse('open_quarter', HT_MSG.open_quarter, role);
      if (raw('technology_badges').some((x) => x.quarter === q)) return refuse('published', HT_MSG.published, role);
      const res = technologyBadges(badgeInputFromTables(raw), q)!;
      if (!res.hot.length && !res.roles.length) return refuse('no_change', HT_MSG.no_change, role);
      const ts = nowTs();
      for (const x of res.hot) ins('technology_badges', { id: `tb:${q}:enec:${x.technology_id}`, quarter: q, technology_id: x.technology_id, scope: 'enec', role_id: null, rank: x.rank, sources: x.sources,
        families: x.families, recent: x.recent, via_profile: false, family_opportunities: 0, criteria: res.criteria, published_by: pid, published_at: ts });
      for (const x of res.roles) ins('technology_badges', { id: `tb:${q}:${x.role_id}:${x.technology_id}`, quarter: q, technology_id: x.technology_id, scope: 'role', role_id: x.role_id, rank: null, sources: 0,
        families: 0, recent: 0, via_profile: x.via_profile, family_opportunities: x.family_opportunities, criteria: res.criteria, published_by: pid, published_at: ts });
      return h.done<R>('technology.badges_publish', 'technology_badges', q, `${q} ${res.hot.length} hot ${res.roles.length} role badges`, role, 'kafaa.skills.technology_badges_publish',
        `Technology badges ${q} published: ${res.hot.length} hot across ENEC, ${res.roles.length} in demand for a role`, 'Technology badges published', { quarter: q, hot: res.hot.length, roles: res.roles.length }, ['technology_badges']);
    },

    // ───────────── FS72
    async refreshSkillSuggestions() {
      await b.whenReady();
      type R = { open: number; added: number; expired: number };
      const pid = me();
      if (!pid) return h.refuse<R>('skill_suggestions.refresh', 'skill_suggestions', null, 'not_signed_in', SSG_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return h.refuse<R>('skill_suggestions.refresh', 'skill_suggestions', null, 'forbidden', SSG_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const today = todayIso();
      const cands = inferSuggestions(ssgWorldFromTables(raw), pid, today);
      const plan = refreshPlan(pid, raw('skill_suggestions') as never, cands, today);
      const ts = nowTs();
      for (const r of plan.inserts) ins('skill_suggestions', { ...r, updated_at: ts });
      for (const u of plan.updates) upd('skill_suggestions', u.id, { ...u.patch, updated_at: ts });
      const { open, added, expired } = plan;
      return h.done<R>('skill_suggestions.refresh', 'skill_suggestions', pid, `${open} open ${added} added ${expired} expired`, role, null, '', 'Suggestions refreshed', { open, added, expired }, ['skill_suggestions']);
    },

    async respondSuggestion(id, response: SuggestResponse) {
      await b.whenReady();
      type R = { id: string; status: string; evidence_id: string | null; suppressed_until: string | null };
      const sid = typeof id === 'string' && id ? id : null;
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('skill_suggestions.respond', 'skill_suggestions', sid, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', SSG_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', SSG_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!(RESPONSES as readonly string[]).includes(String(response))) return refuse('invalid', SSG_MSG.invalid, role);
      const cur = get('skill_suggestions', sid);
      if (!cur || cur.person_id !== pid) return refuse('not_found', SSG_MSG.not_found, role);
      if (cur.status !== 'open') return refuse('closed', SSG_MSG.closed, role);
      const today = todayIso();
      const status = responseStatus(response);
      const ts = nowTs();
      if (response === 'confirm') {
        const eid = evidenceId(pid, cur.skill_id);
        const name = (get('skills', cur.skill_id)?.name_en as string | undefined) ?? cur.skill_id;
        const ev = { kind: 'rating', ref_table: 'skill_suggestions', ref_id: cur.id, level: Math.min(2, Number(cur.level)), basis: 'claimed', status: 'current', observed_on: today,
          note: `Confirmed suggestion: ${name}`, recorded_by: pid, active: true };
        if (get('skill_evidence', eid)) upd('skill_evidence', eid, ev);
        else ins('skill_evidence', { id: eid, person_id: pid, skill_id: cur.skill_id, ...ev, created_at: ts, org_id: null, contractor: false });
        upd('skill_suggestions', cur.id, { status, responded_on: today, evidence_id: eid, updated_at: ts, version: Number(cur.version) + 1 });
        await applySkills(b, pid, today);
        return h.done<R>('skill_suggestions.respond', 'skill_suggestions', cur.id, `confirmed ${cur.skill_id} L${Math.min(2, Number(cur.level))}`, role, null, '', 'Added to your skills profile as your own claim',
          { id: cur.id, status, evidence_id: eid, suppressed_until: null }, ['skill_suggestions', 'skill_evidence', 'person_skills']);
      }
      const until = suppressedUntil(today);
      upd('skill_suggestions', cur.id, { status, responded_on: today, suppressed_until: until, updated_at: ts, version: Number(cur.version) + 1 });
      return h.done<R>('skill_suggestions.respond', 'skill_suggestions', cur.id, `${status} ${cur.skill_id}`, role, null, '', status === 'rejected' ? 'Suggestion hidden for 180 days' : 'Noted: not you. Hidden for 180 days',
        { id: cur.id, status, evidence_id: null, suppressed_until: until }, ['skill_suggestions']);
    },

    async runSuggestionFairness(asOf) {
      await b.whenReady();
      type R = { period: string; as_of: string; rows: number; flagged: number; suppressed: number };
      const pid = me();
      const today = todayIso();
      const day = asOf ? d10(asOf) : today;
      if (!pid) return h.refuse<R>('fairness.suggestion_snapshot', 'skill_suggestion_fairness', day, 'not_signed_in', SSG_MSG.not_signed_in);
      const role = ctx().actingRole('integrations', ['A']);
      if (!role) return h.refuse<R>('fairness.suggestion_snapshot', 'skill_suggestion_fairness', day, 'forbidden', SSG_MSG.forbidden_fairness);
      const t0 = Date.parse(`${today}T00:00:00Z`), t1 = Date.parse(`${day}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(t1) || t1 > t0 || t1 < t0 - 366 * 86_400_000) return h.refuse<R>('fairness.suggestion_snapshot', 'skill_suggestion_fairness', day, 'invalid', SSG_MSG.invalid_date, role);
      const rows = suggestionFairness(raw('people') as never, raw('skill_suggestions') as never, day);
      const ts = nowTs();
      for (const r of rows) {
        const row = { ...r, run_by: pid, created_at: ts };
        if (get('skill_suggestion_fairness', r.id)) upd('skill_suggestion_fairness', r.id, row); else ins('skill_suggestion_fairness', row);
      }
      const flagged = rows.filter((r) => r.flagged).length, suppressedN = rows.filter((r) => r.suppressed).length;
      const period = rows[0]?.period ?? '';
      return h.done<R>('fairness.suggestion_snapshot', 'skill_suggestion_fairness', period, `${rows.length} rows ${flagged} flagged ${suppressedN} suppressed`, role, 'kafaa.ai.suggestion_fairness',
        `Skill-suggestion fairness snapshot ${period}: ${flagged} flagged, ${suppressedN} suppressed`, 'Fairness snapshot stored', { period, as_of: day, rows: rows.length, flagged, suppressed: suppressedN }, ['skill_suggestion_fairness']);
    },

    async suggestionStats() {
      await b.whenReady();
      type R = SuggestionStats;
      if (!me()) return h.refuse<R>('skill_suggestions.stats', 'skill_suggestions', null, 'not_signed_in', SSG_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Agg', 'A']) && !ctx().has('workforce_strategy', ['Agg', 'R', 'W', 'A']) && !ctx().has('integrations', ['R', 'A']))
        return h.refuse<R>('skill_suggestions.stats', 'skill_suggestions', null, 'forbidden', SSG_MSG.forbidden_stats);
      const rows = raw('skill_suggestions');
      const n = (s: string) => rows.filter((r) => r.status === s).length;
      const conf = n('confirmed'), den = conf + n('rejected') + n('not_me');
      const data: R = { people: sup(new Set(rows.map((r) => r.person_id)).size), open: sup(n('open')), confirmed: sup(conf), rejected: sup(n('rejected')), not_me: sup(n('not_me')), expired: sup(n('expired')),
        confirm_rate: den >= 10 ? Math.floor((conf * 2000 + den) / (2 * den)) / 10 : null, suppressed: false };
      data.suppressed = [data.people, data.open, data.confirmed, data.rejected, data.not_me, data.expired].some((x) => x === null);
      return ok('Suggestion statistics', data);
    },
  };
}
