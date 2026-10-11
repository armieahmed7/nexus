/**
 * FS27 Future-skills gig channel with a time envelope (FS wave D · E1, M20): pure rules shared by the LocalBackend
 * (backend/fs27.local.ts), the seed builder (scripts/seed/ext/fs27-future-gigs.mjs), the pages and the tests.
 * Node loads this file directly, so it imports only domain.ts (and types).
 * SQL mirror: supabase/migrations/20261010241001_kafaa_fs41_future_gigs_secondments.sql (kafaa_fs27_* helpers,
 * kafaa_request_envelope, kafaa_approve_envelope, kafaa_future_gig_stats and the redefined kafaa_post_opportunity /
 * kafaa_apply_opportunity). Same checks, same order, same refusal codes and messages: change both together.
 *
 * - Five channels: ADVANCE study support, digital innovation, governed AI pilots, data clean-up, knowledge capture.
 * - A time envelope is a share of working time (5, 10, 15 or 20 % of a 40-hour week) for future-skills gigs in one quarter.
 *   The person asks once; the line manager of record approves once (maker-checker: never the person, never the poster).
 * - Applying to a future gig inside an approved envelope skips the per-gig release while the envelope's live gigs plus this one
 *   stay within its weekly hours. Otherwise the ordinary F08 release by the line manager applies.
 * - Completion writes ojt evidence against the posted skills through the existing F08 path (completeOpportunity).
 */
import type { Reason } from '../../domain/engines/types';

export const CHANNELS = ['advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture'] as const;
export type Channel = (typeof CHANNELS)[number];
export const ENV_PCTS = [5, 10, 15, 20] as const;
export const WEEK_HOURS = 40;
export const ENV_STATUSES = ['requested', 'approved', 'declined', 'withdrawn'] as const;
/** Envelopes that block a second request for the same period. */
export const LIVE_ENV = ['requested', 'approved'];
/** Applications that use envelope hours. */
export const ENV_APP_STATUSES = ['applied', 'released', 'selected'];
export const MIN_GROUP = 10;
/** Future-skill lifecycles that make a gig worth growing into (FS02). */
export const LIFECYCLE_WEIGHT: Record<string, number> = { emerging: 1, growing: 0.8, stable: 0.5, declining: 0.2, obsolete: 0 };

export const EMSG = {
  not_signed_in: 'Sign in to use future-skills gigs',
  forbidden_request: 'Only staff can ask for a time envelope',
  invalid_pct: 'Choose 5, 10, 15 or 20 % of your working time',
  invalid_period: 'Choose this quarter or the next one',
  invalid_channels: 'Choose one or more of the five future-skills channels',
  invalid_reason: 'Say in a sentence why you want the time (10 to 400 characters)',
  duplicate: 'You already have a time envelope requested or approved for this quarter',
  no_line_manager: 'No line manager is recorded for you; ask HR to update your record',
  not_found: 'Time envelope not found',
  invalid_decision: 'Unknown decision',
  maker_checker: 'You cannot approve your own time envelope',
  forbidden_decide: 'Only your line manager approves your time envelope',
  not_requested: 'This time envelope is not waiting for a decision',
  decline_reason: 'Give a reason when you decline',
  forbidden_withdraw: 'Only the person who asked can withdraw a time envelope',
  not_withdrawable: 'This time envelope can no longer be withdrawn',
  invalid_channel: 'Unknown future-skills channel',
  channel_needs_future_skill: 'A future-skills gig must grow at least one future skill from the catalogue',
} as const;

// ───────────── dates (UTC calendar days, like SQL)
const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const dayNo = (d: string) => Math.floor(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86_400_000);
const fromDay = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromDay(dayNo(d) + n);
/** '2026-Q4' for any date in October to December 2026. */
export function quarterOf(d: string): string {
  const [y, m] = d.slice(0, 10).split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
/** First and last day of a quarter like '2026-Q4'; null when the text is not a quarter. */
export function quarterBounds(period: string): { start: string; end: string } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(String(period ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const q = Number(m[2]);
  const start = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
  const nextStart = q === 4 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  return { start, end: addDays(nextStart, -1) };
}
/** The quarters a person can ask for: this one and the next one. */
export function openPeriods(today: string): string[] {
  const cur = quarterOf(today);
  const b = quarterBounds(cur)!;
  return [cur, quarterOf(addDays(b.end, 1))];
}
/** Weekly hours an envelope covers: pct of a 40-hour week (5 % = 2 h, 10 % = 4 h, 15 % = 6 h, 20 % = 8 h). */
export const capHours = (pct: number) => Math.round((pct * WEEK_HOURS) / 100);

// ───────────── envelope request
export interface EnvelopeInput { pct: number; period: string; channels: string[]; reason: string }
export function validateEnvelope(p: EnvelopeInput, today: string): { code: string; message: string } | null {
  if (typeof p?.pct !== 'number' || !(ENV_PCTS as readonly number[]).includes(p.pct)) return { code: 'invalid', message: EMSG.invalid_pct };
  if (!openPeriods(today).includes(String(p.period))) return { code: 'invalid', message: EMSG.invalid_period };
  const ch = Array.isArray(p.channels) ? p.channels : null;
  if (!ch || ch.length < 1 || ch.length > CHANNELS.length || new Set(ch).size !== ch.length || ch.some((c) => !(CHANNELS as readonly string[]).includes(String(c))))
    return { code: 'invalid', message: EMSG.invalid_channels };
  const r = typeof p.reason === 'string' ? p.reason.trim().length : 0;
  if (r < 10 || r > 400) return { code: 'invalid', message: EMSG.invalid_reason };
  return null;
}
/** Channels in the canonical order. */
export const sortChannels = (ch: string[]) => CHANNELS.filter((c) => ch.includes(c));

/** Posting rule (after the F08 checks): a channel must be known and the gig must grow at least one current future skill. */
export function channelProblem(channel: unknown, gained: string[], skills: { id: string; fs_area?: string | null; lifecycle?: string | null }[]): { code: string; message: string } | null {
  if (channel == null || channel === '') return null;
  if (!(CHANNELS as readonly string[]).includes(String(channel))) return { code: 'invalid', message: EMSG.invalid_channel };
  const fs = new Map(skills.map((s) => [s.id, s]));
  if (!(gained ?? []).some((id) => { const s = fs.get(id); return !!s && !!s.fs_area && s.lifecycle !== 'obsolete'; })) return { code: 'invalid', message: EMSG.channel_needs_future_skill };
  return null;
}

// ───────────── envelope fit
export interface EnvRow { id: string; person_id: string; approver_id?: string | null; line_manager_id?: string | null; pct: number; cap_hours: number; period: string; starts_on: string; ends_on: string; channels: string[] | null; status: string }
export interface GigRow { id: string; posted_by: string; channel?: string | null; hours_week: number; start_on: string; end_on: string; status?: string; title_en?: string; title_ar?: string }
export interface EnvAppRow { id: string; opportunity_id: string; person_id: string; status: string; envelope_id?: string | null }
export type FitCode = 'fits' | 'not_future' | 'no_envelope' | 'poster_is_approver' | 'over_limit';
export interface Fit { code: FitCode; fits: boolean; envelope_id: string | null; used: number; cap: number; after: number }

/** Hours a week already used by an envelope: the gigs of its live applications. */
export function envelopeUsed(envId: string, apps: EnvAppRow[], gigs: Map<string, { hours_week: number }>): number {
  return apps.filter((a) => a.envelope_id === envId && ENV_APP_STATUSES.includes(a.status)).reduce((t, a) => t + (gigs.get(a.opportunity_id)?.hours_week ?? 0), 0);
}
/**
 * Does applying to `gig` skip the per-gig release? Candidates: my approved envelopes still running whose channels include the gig's
 * channel and whose quarter overlaps the gig, oldest first (starts_on, then id). The first candidate whose approver did not post the gig
 * and whose used hours plus this gig stay within its cap is used. Otherwise the code says why not.
 */
export function envelopeFit(person: string, gig: GigRow, envs: EnvRow[], apps: EnvAppRow[], gigs: Map<string, { hours_week: number }>, today: string): Fit {
  const none = (code: FitCode, env: EnvRow | null = null, used = 0): Fit => ({ code, fits: false, envelope_id: env?.id ?? null, used, cap: env?.cap_hours ?? 0, after: used + (gig.hours_week ?? 0) });
  if (!gig.channel) return none('not_future');
  const cands = envs
    .filter((e) => e.person_id === person && e.status === 'approved' && e.ends_on >= today && (e.channels ?? []).includes(gig.channel!) && gig.start_on <= e.ends_on && gig.end_on >= e.starts_on)
    .sort((a, b) => (a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!cands.length) return none('no_envelope');
  let first: Fit | null = null;
  for (const e of cands) {
    const used = envelopeUsed(e.id, apps, gigs);
    if (e.approver_id === gig.posted_by) { first ??= none('poster_is_approver', e, used); continue; }
    if (used + gig.hours_week <= e.cap_hours) return { code: 'fits', fits: true, envelope_id: e.id, used, cap: e.cap_hours, after: used + gig.hours_week };
    first ??= none('over_limit', e, used);
  }
  return first!;
}

/** Envelope view for the pages: used and remaining weekly hours and the applications counted. */
export function envelopeView(env: EnvRow, apps: EnvAppRow[], gigs: Map<string, { hours_week: number }>, today: string) {
  const used = envelopeUsed(env.id, apps, gigs);
  const phase = env.status !== 'approved' ? env.status : env.ends_on < today ? 'ended' : env.starts_on > today ? 'upcoming' : 'running';
  return { used, cap: env.cap_hours, remaining: Math.max(0, env.cap_hours - used), pctUsed: env.cap_hours ? Math.min(100, Math.round((used / env.cap_hours) * 100)) : 0, phase, apps: apps.filter((a) => a.envelope_id === env.id) };
}

// ───────────── ranking future gigs for me (deterministic, reasons for <WhyThis>)
export interface FsSkill { id: string; name_en: string; name_ar: string; fs_area?: string | null; lifecycle?: string | null; area?: string }
export interface RankedGig<G> { id: string; score: number; reasons: Reason[]; item: { gig: G; fit: Fit; future: string[] } }
const bi = (s: FsSkill | undefined, id: string) => ({ en: s?.name_en ?? id, ar: s?.name_ar ?? s?.name_en ?? id });
/**
 * Score = mean over the gig's future skills of (room to grow to level 2) x lifecycle weight, plus 0.15 when it fits my envelope.
 * Reasons name each future skill, my level, its lifecycle, and the envelope outcome.
 */
export function rankFutureGigs<G extends GigRow & { skills_gained: string[] }>(gigs: G[], skills: FsSkill[], levels: Map<string, number>, fitOf: (g: G) => Fit): RankedGig<G>[] {
  const sk = new Map(skills.map((s) => [s.id, s]));
  const out = gigs.filter((g) => !!g.channel).map((g) => {
    const future = (g.skills_gained ?? []).filter((id) => !!sk.get(id)?.fs_area);
    const reasons: Reason[] = [{ code: 'channel', key: `m20.fs.reason.channel.${g.channel}`, weight: 0 }];
    let sum = 0;
    for (const id of future) {
      const s = sk.get(id);
      const lv = levels.get(id) ?? 0;
      const room = Math.max(0, 2 - lv) / 2;
      const w = LIFECYCLE_WEIGHT[s?.lifecycle ?? 'stable'] ?? 0.5;
      sum += room * w;
      reasons.push({ code: lv >= 2 ? 'deepens' : 'grows', key: lv >= 2 ? 'm20.fs.reason.deepens' : 'm20.fs.reason.grows', vars: { skill: bi(s, id), level: lv }, ref: { table: 'skills', id }, weight: Math.round(room * w * 100) / 100 });
      if (s?.lifecycle === 'emerging' || s?.lifecycle === 'growing') reasons.push({ code: `lifecycle_${s.lifecycle}`, key: `m20.fs.reason.lifecycle.${s.lifecycle}`, vars: { skill: bi(s, id) }, ref: { table: 'skills', id } });
    }
    const fit = fitOf(g);
    reasons.push({ code: `envelope_${fit.code}`, key: `m20.fs.reason.envelope.${fit.code}`, vars: { used: fit.used, cap: fit.cap, hours: g.hours_week }, weight: fit.fits ? 0.15 : 0 });
    const score = Math.round(((future.length ? sum / future.length : 0) * 0.85 + (fit.fits ? 0.15 : 0)) * 1000) / 1000;
    return { id: g.id, score, reasons, item: { gig: g, fit, future } };
  });
  return out.sort((a, b) => b.score - a.score || (a.item.gig.start_on < b.item.gig.start_on ? -1 : a.item.gig.start_on > b.item.gig.start_on ? 1 : a.id < b.id ? -1 : 1));
}

// ───────────── HR aggregates (both backends; SQL mirror kafaa_fs27_stats_compute)
export interface FutureGigStats {
  channels: { channel: string; open: number; total: number }[];
  open_future: number; open_all: number; share_open_future: number;
  envelopes: { requested: number; approved: number; declined: number; withdrawn: number; people: number | null; avg_pct: number | null; suppressed: boolean };
  via_envelope: { applications: number | null; selected: number | null; completed: number | null; people: number | null; suppressed: boolean };
  evidence_rows: number;
  min_group: number;
}
type StatOpp = { id: string; status: string; channel?: string | null };
type StatApp = { person_id: string; status: string; envelope_id?: string | null; opportunity_id: string };
type StatEnv = { person_id: string; status: string; pct: number };
export function computeFutureStats(opps: StatOpp[], apps: StatApp[], envs: StatEnv[], evidenceRows: number): FutureGigStats {
  const open = opps.filter((o) => o.status === 'open');
  const openFuture = open.filter((o) => !!o.channel).length;
  const approved = envs.filter((e) => e.status === 'approved');
  const envPeople = new Set(approved.map((e) => e.person_id)).size;
  const envSup = envPeople < MIN_GROUP;
  const via = apps.filter((a) => !!a.envelope_id && a.status !== 'withdrawn');
  const viaPeople = new Set(via.map((a) => a.person_id)).size;
  const viaSup = viaPeople < MIN_GROUP;
  return {
    channels: CHANNELS.map((c) => ({ channel: c, open: open.filter((o) => o.channel === c).length, total: opps.filter((o) => o.channel === c && o.status !== 'draft').length })),
    open_future: openFuture,
    open_all: open.length,
    share_open_future: open.length ? Math.round((openFuture / open.length) * 1000) / 1000 : 0,
    envelopes: {
      requested: envs.filter((e) => e.status === 'requested').length, approved: approved.length, declined: envs.filter((e) => e.status === 'declined').length, withdrawn: envs.filter((e) => e.status === 'withdrawn').length,
      people: envSup ? null : envPeople, avg_pct: envSup ? null : Math.round((approved.reduce((t, e) => t + e.pct, 0) / approved.length) * 10) / 10, suppressed: envSup,
    },
    via_envelope: {
      applications: viaSup ? null : via.length, selected: viaSup ? null : via.filter((a) => a.status === 'selected' || a.status === 'completed').length,
      completed: viaSup ? null : via.filter((a) => a.status === 'completed').length, people: viaSup ? null : viaPeople, suppressed: viaSup,
    },
    evidence_rows: evidenceRows,
    min_group: MIN_GROUP,
  };
}

/** Design references shown on the gigs page (research pack corporate_platforms.md A1/A2; read 2026-10-10). Figures are never typed here. */
export const FS27_REFS = [
  { id: 'unilever-flex', label_en: 'Unilever Flex Experiences: employees give a few hours a week to projects, with the time agreed up front', label_ar: 'تجارب Unilever المرنة: يخصص الموظفون بضع ساعات أسبوعياً للمشاريع مع الاتفاق على الوقت مسبقاً', url: 'https://www.hrmagazine.co.uk/article-details/international-case-study-unilevers-internal-project-platform', as_of: '2026-10-10' },
  { id: 'schneider-otm', label_en: 'Schneider Electric Open Talent Market: positions, projects and mentoring in one feed', label_ar: 'سوق المواهب المفتوح لدى Schneider Electric: الوظائف والمشاريع والإرشاد في قائمة واحدة', url: 'https://gloat.com/wp-content/uploads/Schneider-Electric-Gloat-Case-Study.pdf', as_of: '2026-10-10' },
] as const;
