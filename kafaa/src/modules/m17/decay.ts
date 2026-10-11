/**
 * FS03 Honest skill states (future-skills wave A · E2, M17): pure rules shared by the pages, the LocalBackend RPCs, the seed builder,
 * the PGlite validator and the tests. Import-free apart from other pure modules (node scripts load this file directly).
 *
 *  - FS03_MSG / checkHalfLives: refusal messages and checks of rpc.setSkillHalfLives (SQL kafaa_set_skill_half_lives uses the same text).
 *  - confidenceStats: the aggregate behind /admin/skills-confidence (SQL kafaa_fs03_stats; cells naming fewer than 10 people are null).
 *  - sourceRecord: the multi-source record of one skill (self, peers, manager or expert validation, assessment, work, qualification,
 *    training, credential), each row with its date, provenance and weight; peer ratings are shown but never counted on their own.
 *  - projectSkill / nextDrop: how confidence would decay if nothing new were recorded (same deriveSkillState as the server).
 *  - raiseActions: what would raise confidence (validate, refresh, use it at work, earn a micro-credential), each with reasons.
 *  - readinessRange: the Navigator's "how sure" range: readiness counting every skill vs counting only the skills we are fairly sure of.
 *  - methodNotice: the methodology-change banner (FORECAST): the FS03 method date, or a later half-life change by an admin.
 * The skill-state maths itself (decay classes, half-lives, blend, Wilson band) lives in src/domain/skills.ts.
 */
import {
  DECAY_CLASSES, HALF_LIFE_KEYS, HALF_LIFE_RANGE, bandOf, decayClassOf, deriveSkillState, halfLifeMonths,
  type ConfidenceBand, type DecayClass, type DecayModel, type Evidence, type EvidenceSource, type StoredReason,
} from '../../domain/skills.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export interface Reason { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }>; ref?: { table: string; id: string } }
const MIN_GROUP = 10; // MIN_GROUP_SIZE (src/auth/policy.ts); kept literal so node scripts load this file without the policy module
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const dk = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m17.dk.why.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
export const BANDS: ConfidenceBand[] = ['low', 'medium', 'high'];
const BAND_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

// ───────────── rpc.setSkillHalfLives
export const FS03_MSG = {
  not_signed_in: 'Sign in to change the skill half-lives',
  forbidden: 'Only a platform admin may change the skill half-lives',
  invalid_hl: 'Half-lives are whole months from 6 to 120, and fast may not be longer than standard, nor standard longer than slow',
  invalid_why: 'Give a rationale of 10 to 500 characters: it is shown in the change log',
  no_change: 'Nothing changed: the half-lives are already set this way',
  saved: 'Half-lives saved and every skill state recomputed',
  stats_forbidden: "Kafa'a · skill confidence statistics are aggregate-only and restricted",
} as const;
export interface HalfLivesInput { fast: number; standard: number; slow: number; rationale: string }
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= HALF_LIFE_RANGE.min && v <= HALF_LIFE_RANGE.max;
/** Same order as SQL: the three numbers (whole months, 6-120, fast <= standard <= slow), then the rationale (10-500 characters). */
export function checkHalfLives(i: Partial<HalfLivesInput> | null | undefined): 'ok' | 'invalid_hl' | 'invalid_why' {
  if (!i || !whole(i.fast) || !whole(i.standard) || !whole(i.slow) || i.fast > i.standard || i.standard > i.slow) return 'invalid_hl';
  const why = String(i.rationale ?? '').trim();
  if (why.length < 10 || why.length > 500) return 'invalid_why';
  return 'ok';
}
/** The preview object the stats RPC accepts: only the three half-life keys with numeric values. */
export function previewWeights(hl: Record<string, unknown> | null | undefined): Record<string, number> | null {
  if (hl == null) return null;
  return Object.fromEntries(Object.entries(hl).filter(([k, v]) => Object.values(HALF_LIFE_KEYS).includes(k) && typeof v === 'number' && Number.isFinite(v))) as Record<string, number>;
}
export const toWeights = (m: { fast: number; standard: number; slow: number }) => ({ [HALF_LIFE_KEYS.fast]: m.fast, [HALF_LIFE_KEYS.standard]: m.standard, [HALF_LIFE_KEYS.slow]: m.slow });

// ───────────── aggregates (SQL kafaa_fs03_stats)
export interface StateLite { id: string; person_id: string; skill_id: string; level: number; confidence_band: string; reasons?: StoredReason[] | unknown; active?: boolean | null }
export interface Cell { states: number | null; suppressed: boolean }
export interface ConfidenceStats {
  allowed: true;
  as_of: string;
  months: Record<DecayClass, number>;
  classes: { id: DecayClass; skills: number; areas: string[] }[];
  bands: { band: ConfidenceBand; states: number | null; people: number | null }[];
  by_class: ({ cls: DecayClass; band: ConfidenceBand } & Cell)[];
  by_area: ({ area: string; band: ConfidenceBand } & Cell)[];
  ageing: { states: number | null; people: number | null };
  backfill: { awards: number; with_evidence: number; evidence_rows: number };
  last_change: { id: string; changed_at: string; weights_before: unknown; weights_after: unknown; rationale: string | null } | null;
  preview: null | {
    months: Record<DecayClass, number>;
    transitions: { from: ConfidenceBand; to: ConfidenceBand; states: number | null; suppressed: boolean }[];
    changed: number | null; people: number | null; level_down: number | null; level_up: number | null;
  };
}
export interface StatsInput {
  /** Stored person_skills rows (active ones count). */
  states: StateLite[];
  skills: { id: string; area: string; decay_class?: string | null }[];
  awards: { id: string; status: string; issued_on?: string | null }[];
  evidence: { ref_table: string; ref_id: string }[];
  changes: { id: string; surface: string; changed_at: string; weights_before?: unknown; weights_after?: unknown; rationale?: string | null }[];
  weights: Record<string, unknown> | null | undefined;
  today: string;
  /** Preview: states derived now with the current settings and with the preview half-lives (same evidence). */
  preview?: { weights: Record<string, unknown>; now: StateLite[]; next: StateLite[] } | null;
}
const people = (rows: { person_id: string }[]) => new Set(rows.map((r) => r.person_id)).size;
const gated = (rows: { person_id: string }[]) => (people(rows) < MIN_GROUP ? null : rows.length);
export function confidenceStats(i: StatsInput): ConfidenceStats {
  const skill = new Map(i.skills.map((s) => [s.id, s]));
  const st = i.states.filter((s) => s.active !== false && skill.has(s.skill_id)).map((s) => {
    const k = skill.get(s.skill_id)!;
    const r0 = Array.isArray(s.reasons) ? (s.reasons as StoredReason[])[0] : undefined;
    return { person_id: s.person_id, band: s.confidence_band as ConfidenceBand, cls: decayClassOf(k), area: k.area, ageing: !!r0?.ageing };
  });
  const cells = <K extends string>(key: (x: (typeof st)[number]) => K, order: (a: K, b: K) => number) => {
    const m = new Map<string, (typeof st)[number][]>();
    for (const x of st) { const k = `${key(x)}|${x.band}`; (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
    return [...m.entries()].map(([k, rows]) => { const [g, band] = k.split('|'); return { g: g as K, band: band as ConfidenceBand, states: people(rows) < MIN_GROUP ? null : rows.length, suppressed: people(rows) < MIN_GROUP }; })
      .sort((a, b) => order(a.g, b.g) || BAND_RANK[a.band] - BAND_RANK[b.band]);
  };
  const clsRank = (c: DecayClass) => DECAY_CLASSES.indexOf(c);
  const aw = i.awards.filter((a) => ['awarded', 'superseded', 'revoked'].includes(a.status) && a.issued_on);
  const evAw = i.evidence.filter((e) => e.ref_table === 'microcred_awards');
  const evIds = new Set(evAw.map((e) => e.ref_id));
  const last = [...i.changes].filter((c) => c.surface === 'skills').sort((a, b) => cmp(String(b.changed_at), String(a.changed_at)) || cmp(b.id, a.id))[0];
  let preview: ConfidenceStats['preview'] = null;
  if (i.preview) {
    const next = new Map(i.preview.next.map((s) => [s.id, s]));
    const j = i.preview.now.filter((a) => next.has(a.id)).map((a) => { const b = next.get(a.id)!; return { person_id: a.person_id, f: a.confidence_band as ConfidenceBand, t: b.confidence_band as ConfidenceBand, la: a.level, lb: b.level }; });
    const moved = j.filter((x) => x.f !== x.t);
    const tr: NonNullable<ConfidenceStats['preview']>['transitions'] = [];
    for (const f of BANDS) for (const t of BANDS) {
      if (f === t) continue;
      const rows = moved.filter((x) => x.f === f && x.t === t);
      if (rows.length) tr.push({ from: f, to: t, states: people(rows) < MIN_GROUP ? null : rows.length, suppressed: people(rows) < MIN_GROUP });
    }
    preview = {
      months: halfLifeMonths({ ...(i.weights ?? {}), ...i.preview.weights }),
      transitions: tr,
      changed: gated(moved), people: people(moved) < MIN_GROUP ? null : people(moved),
      level_down: gated(j.filter((x) => x.lb < x.la)), level_up: gated(j.filter((x) => x.lb > x.la)),
    };
  }
  const allSkills = i.skills.map((s) => ({ cls: decayClassOf(s), area: s.area }));
  return {
    allowed: true,
    as_of: i.today,
    months: halfLifeMonths(i.weights),
    classes: DECAY_CLASSES.map((c) => ({ id: c, skills: allSkills.filter((s) => s.cls === c).length, areas: [...new Set(allSkills.filter((s) => s.cls === c).map((s) => s.area))].sort(cmp) })),
    bands: BANDS.map((b) => { const rows = st.filter((x) => x.band === b); return { band: b, states: gated(rows), people: people(rows) < MIN_GROUP ? null : people(rows) }; }),
    by_class: cells((x) => x.cls, (a, b) => clsRank(a) - clsRank(b)).map(({ g, ...c }) => ({ cls: g, ...c })),
    by_area: cells((x) => x.area, cmp).map(({ g, ...c }) => ({ area: g, ...c })),
    ageing: (() => { const rows = st.filter((x) => x.ageing); return { states: gated(rows), people: people(rows) < MIN_GROUP ? null : people(rows) }; })(),
    backfill: { awards: aw.length, with_evidence: aw.filter((a) => evIds.has(a.id)).length, evidence_rows: evAw.length },
    last_change: last ? { id: last.id, changed_at: last.changed_at, weights_before: last.weights_before ?? {}, weights_after: last.weights_after ?? {}, rationale: last.rationale ?? null } : null,
    preview,
  };
}

// ───────────── the multi-source record of one skill
export type RecordSource = EvidenceSource | 'peer';
/** Display order: what the person says, what colleagues say, then the records. */
export const RECORD_ORDER: RecordSource[] = ['self', 'peer', 'validation', 'assessment', 'work', 'qualification', 'training', 'credential'];
export interface RecordRow { id: string; kind: string; basis: string; level: number; observed_on: string; w: number | null; ageing: boolean; ref_table: string; ref_id: string; note?: string | null; recorded_by?: string | null; counted: boolean }
export interface RecordEntry { source: RecordSource; counted: boolean; best: number | null; rows: RecordRow[] }
export interface PeerRating { id: string; subject_id: string; skill_id: string; rater_kind: string; level?: number | null; status: string; at?: string | null; example?: string | null }
export function sourceRecord(state: { reasons?: StoredReason[] | unknown } | null, evidence: Row[], peers: PeerRating[] = []): RecordEntry[] {
  const reasons = new Map(((Array.isArray(state?.reasons) ? state!.reasons : []) as StoredReason[]).map((r) => [r.evidence_id, r]));
  const by = new Map<RecordSource, RecordRow[]>();
  for (const e of evidence) {
    if (e.active === false) continue;
    const r = reasons.get(e.id);
    const src: RecordSource = r?.source ?? (e.kind === 'qual' ? 'qualification' : e.kind === 'course' ? 'training' : e.kind === 'assessment' || e.kind === 'jpm' ? 'assessment' : e.kind === 'rating' ? (e.basis === 'claimed' ? 'self' : 'validation') : e.kind === 'ojt' ? 'work' : 'credential');
    const row: RecordRow = { id: e.id, kind: e.kind, basis: e.basis, level: r?.level ?? e.level, observed_on: String(e.observed_on).slice(0, 10), w: typeof r?.w === 'number' ? r.w : null, ageing: !!r?.ageing, ref_table: e.ref_table, ref_id: e.ref_id, note: e.note ?? null, recorded_by: e.recorded_by ?? null, counted: !!r };
    (by.get(src) ?? by.set(src, []).get(src)!).push(row);
  }
  const pr = peers.filter((p) => p.rater_kind === 'peer' && p.status === 'submitted' && Number(p.level) > 0);
  if (pr.length) by.set('peer', pr.map((p) => ({ id: p.id, kind: 'peer_rating', basis: 'claimed', level: Number(p.level), observed_on: String(p.at ?? '').slice(0, 10), w: null, ageing: false, ref_table: 'skill_ratings', ref_id: p.id, note: p.example ?? null, recorded_by: null, counted: false })));
  return RECORD_ORDER.filter((s) => by.has(s)).map((s) => {
    const rows = by.get(s)!.sort((a, b) => (b.w ?? -1) - (a.w ?? -1) || cmp(b.observed_on, a.observed_on) || cmp(a.id, b.id));
    const ws = rows.filter((r) => r.counted && r.w != null).map((r) => r.w!);
    return { source: s, counted: ws.length > 0, best: ws.length ? Math.max(...ws) : null, rows };
  });
}

// ───────────── projection: confidence if nothing new is recorded
export const addMonthsIso = (d: string, n: number) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
};
export interface ProjectionPoint { month: number; date: string; confidence: number; low: number; high: number; band: ConfidenceBand; level: number }
/** Re-runs the server's state rule on the same evidence at later dates (qualification records are assumed to stay current). */
export function projectSkill(evidence: Evidence[], model: DecayModel, from: string, months: number[] = [0, 3, 6, 9, 12, 18, 24, 30, 36]): ProjectionPoint[] {
  const out: ProjectionPoint[] = [];
  for (const m of months) {
    const date = addMonthsIso(from, m);
    const s = deriveSkillState(evidence, date, model);
    if (!s) continue;
    out.push({ month: m, date, confidence: s.confidence, low: s.conf_low, high: s.conf_high, band: s.confidence_band, level: s.level });
  }
  return out;
}
/** First projected point whose band (or level) is lower than today's. */
export function nextDrop(points: ProjectionPoint[]): ProjectionPoint | null {
  const p0 = points[0];
  if (!p0) return null;
  return points.find((p) => BAND_RANK[p.band] < BAND_RANK[p0.band] || p.level < p0.level) ?? null;
}

// ───────────── what would raise it
export type RaiseKind = 'validate' | 'refresh' | 'work' | 'credential' | 'requal';
export interface RaiseAction { kind: RaiseKind; to: string; reasons: Reason[] }
export function raiseActions(i: {
  skill: { id: string; code: string; evidence_keys?: string[] | null };
  record: RecordEntry[];
  qualificationOnly: boolean;
  security: boolean;
  drop: ProjectionPoint | null;
  ageing: boolean;
  refresher: { id: string; code: string } | null;
  microcred: { code: string } | null;
}): RaiseAction[] {
  if (i.security) return [];
  const has = (s: RecordSource) => i.record.some((r) => r.source === s && r.counted);
  const out: RaiseAction[] = [];
  if (i.qualificationOnly) out.push({ kind: 'requal', to: '/my/quals', reasons: [dk('requal', { code: i.skill.code })] });
  else if (!has('validation') && !has('qualification')) out.push({ kind: 'validate', to: `/my/skills/checkins?skills=${encodeURIComponent(i.skill.id)}`, reasons: [dk(has('self') ? 'validate_self' : i.record.length === 0 ? 'validate_none' : 'validate_add')] });
  if (i.refresher && (i.ageing || i.drop)) out.push({ kind: 'refresh', to: `/learn/course/${i.refresher.id}`, reasons: [i.ageing ? dk('refresh_ageing', { course: i.refresher.code }) : dk('refresh_drop', { course: i.refresher.code, date: i.drop!.date })] });
  if (!has('work') && !i.qualificationOnly) out.push({ kind: 'work', to: '/opportunities', reasons: [dk('work')] });
  if (i.microcred && !has('credential')) out.push({ kind: 'credential', to: `/my/skills/credentials?code=${encodeURIComponent(i.microcred.code)}`, reasons: [dk('credential', { code: i.microcred.code })] });
  return out;
}

// ───────────── the Navigator readiness range
export interface ReadinessRange { pct: number; pctSure: number; band: ConfidenceBand; unsure: { competency_id: string; skill_id: string; band: ConfidenceBand; level: number }[]; reasons: Reason[] }
const IMP: Record<string, number> = { core: 3, important: 2, useful: 1 };
/**
 * Readiness (same weighted coverage as F05 careerReadiness) counting every skill, and counting only skills whose band is medium or high.
 * The band is the cautious end of the interval of the skills that carry the readiness, weighted by the points each contributes.
 */
export function readinessRange(i: {
  states: { skill_id: string; level: number; confidence_band?: string | null; conf_low?: number | string | null; active?: boolean | null }[];
  skills: { id: string; competency_id: string; core: boolean }[];
  roleComps: { role_id: string; competency_id: string; required_level: number; importance: string }[];
  roleId: string;
  weights?: Record<string, number>;
}): ReadinessRange | null {
  const reqs = i.roleComps.filter((r) => r.role_id === i.roleId);
  if (!reqs.length) return null;
  const sk = new Map(i.skills.map((s) => [s.id, s]));
  const provider = (sure: boolean) => {
    const core = new Map<string, Row>(), any = new Map<string, Row>();
    for (const s of i.states) {
      if (s.active === false || s.level <= 0) continue;
      if (sure && (s.confidence_band ?? 'low') === 'low') continue;
      const k = sk.get(s.skill_id);
      if (!k) continue;
      const m = k.core ? core : any;
      const cur = m.get(k.competency_id);
      if (!cur || s.level > cur.level) m.set(k.competency_id, s);
    }
    for (const [c, s] of any) if (!core.has(c)) core.set(c, s);
    return core;
  };
  const score = (have: Map<string, Row>) => {
    let num = 0, den = 0;
    const pts: { comp: string; s: Row; p: number }[] = [];
    for (const r of reqs) {
      const s = have.get(r.competency_id);
      const h = s?.level ?? 0;
      const wt = typeof i.weights?.[r.importance] === 'number' ? i.weights[r.importance] : (IMP[r.importance] ?? 1);
      const p = (Math.min(h, r.required_level) / r.required_level) * wt;
      num += p; den += wt;
      if (s && p > 0) pts.push({ comp: r.competency_id, s, p });
    }
    return { pct: den ? Math.round((num / den) * 100) : 0, pts };
  };
  const all = score(provider(false));
  const sure = score(provider(true));
  const tot = all.pts.reduce((a, x) => a + x.p, 0);
  const m = tot ? all.pts.reduce((a, x) => a + x.p * Number(x.s.conf_low ?? 0), 0) / tot : 0;
  const band = bandOf(Math.round(m * 100) / 100);
  const unsure = all.pts.filter((x) => (x.s.confidence_band ?? 'low') === 'low').map((x) => ({ competency_id: x.comp, skill_id: x.s.skill_id, band: 'low' as ConfidenceBand, level: x.s.level }))
    .sort((a, b) => cmp(a.competency_id, b.competency_id));
  const reasons: Reason[] = [dk('ready_all', { pct: all.pct }), dk('ready_sure', { pct: sure.pct })];
  if (unsure.length) reasons.push(dk('ready_unsure', { n: unsure.length }));
  reasons.push(dk(`ready_band_${band}`));
  return { pct: all.pct, pctSure: sure.pct, band, unsure, reasons };
}

// ───────────── methodology-change banner (FORECAST)
/** The date FS03 changed how confidence is calculated (numbers before it are not comparable). */
export const METHOD_SINCE = '2026-10-10';
export const METHOD_NOTICE_DAYS = 120;
const dayNo = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
/** The latest method change still inside the notice window: an admin's half-life change (engine_settings.updated_by set) or FS03 itself. */
export function methodNotice(settings: { updated_by?: string | null; updated_at?: string | null } | null | undefined, today: string): { kind: 'fs03' | 'half_lives'; since: string } | null {
  const admin = settings?.updated_by && settings.updated_at ? String(settings.updated_at).slice(0, 10) : null;
  const pickDate = admin && admin > METHOD_SINCE ? { kind: 'half_lives' as const, since: admin } : { kind: 'fs03' as const, since: METHOD_SINCE };
  const age = dayNo(today) - dayNo(pickDate.since);
  return age >= 0 && age <= METHOD_NOTICE_DAYS ? pickDate : null;
}

// ───────────── benchmarks (FS01 kafaa_benchmarks rows when present; this fallback mirrors PLAN.md section 4)
export interface BenchRow { id: string; name_en: string; name_ar: string; year: string; urls: string[] }
export const FS03_BENCHMARKS: BenchRow[] = [
  { id: 'WEF-FOJ', name_en: 'WEF Future of Jobs Report 2025', name_ar: 'تقرير مستقبل الوظائف 2025 الصادر عن المنتدى الاقتصادي العالمي', year: '2025', urls: ['https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/'] },
  { id: 'SKILLS-TECH', name_en: 'Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play', name_ar: 'آليات منصات المهارات: Workday/TechWolf وDegreed وWorkera وPluralsight وCredly ولعب الأدوار بالذكاء الاصطناعي', year: '2024-2026', urls: ['https://www.techwolf.ai/customer-stories/workday', 'https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/'] },
  { id: 'FORECAST', name_en: 'Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035', name_ar: 'المهارات ذات الأولوية حتى 2030 لهيئة المهارات في إنجلترا وخطط المهارات المحلية؛ وتوقعات المهارات لمركز Cedefop حتى 2035', year: '2025', urls: ['https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030', 'https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast'] },
];

/** Months label of a class half-life for a skill row. */
export const classOfSkill = (s: { area?: string | null; decay_class?: string | null } | null | undefined): DecayClass => decayClassOf(s);
