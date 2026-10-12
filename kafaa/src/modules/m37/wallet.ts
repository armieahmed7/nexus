// FS74 Future Skills Wallet target (M37 National Alignment, FS wave H · E2). Pure rules shared by the pages, the LocalBackend, the
// seed builder, the unit tests and the PGlite validator, mirrored 1:1 by SQL in
// supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql:
//   walletStatus()   = kafaa_fw_status     the core-five wallet of one person, from evidence only (a self-rating never counts):
//                                          1 AI fluency rung 2 (FS09 aiRung = kafaa_ai_rung), 2 cyber hygiene (the FS31 micro-credential
//                                          MC-CYBER-HYGIENE, awarded and in date), 3 plant-data basics (the FS02 skill sk-da-01 at level 1+
//                                          with counted evidence), 4 one Nuclear Critical Core Skill at level 2+ (FS25, counted evidence),
//                                          5 CleanEnergyComp L1 (FS41 cecLevel = kafaa_cec_level)
//   walletCounter()  = kafaa_fw_counter    the organisation counter: active staff with a complete wallet against the dated target that
//                                          leadership set (kafaa_wallet_targets: value, date, who and when, history); every count under 10
//                                          suppressed; security, safeguards and cyber families never broken out
//   targetProblem()  = kafaa_fw_target_problem   checks run by setWalletTarget (the HR director, workforce_strategy A)
//   planEntries()    = kafaa_fw_plan_entries     the development-plan activities for the open items (addWalletToPlan)
// Import-free except `.ts` rule files that are themselves import-free (node scripts load this file directly).
import type { Reason } from '../../domain/engines/types';
import { publicTextIsClean } from '../../domain/future.ts';
import { aiRung } from '../m29/fluency.ts';
import { cecLevel } from '../m32/cec.ts';

export const WALLET_ITEMS = ['ai_rung2', 'cyber_hygiene', 'plant_data', 'core_skill', 'cec_l1'] as const;
export type WalletKey = (typeof WALLET_ITEMS)[number];
export const WALLET_RULE = { ai_rung: 2, cyber_code: 'MC-CYBER-HYGIENE', plant_skill: 'sk-da-01', plant_level: 1, core_level: 2, cec_level: 1 } as const;
export const COUNTED = ['verified', 'evidenced', 'validated'];
export const FW_MIN = 10;
export const NO_BREAKOUT = ['security', 'safeguards', 'cyber'];
export const WALLET_TARGET_ID = 'wt-core-five';
export const WALLET_METRIC = 'core_five_complete';
export const TARGET_MAX_DATE = '2035-12-31';
/** Where each item is earned in Kafa'a (the "next step" link) and the plan activity kind it becomes. */
export const ITEM_ROUTE: Record<WalletKey, string> = {
  ai_rung2: '/my/ai-fluency', cyber_hygiene: '/my/skills/credentials/c/MC-CYBER-HYGIENE', plant_data: '/skills/sk-da-01', core_skill: '/my/core-skills', cec_l1: '/my/clean-energy',
};
export const ITEM_PLAN_KIND: Record<WalletKey, string> = { ai_rung2: 'assessment', cyber_hygiene: 'assessment', plant_data: 'course', core_skill: 'ojt', cec_l1: 'course' };
export const ITEM_TITLE: Record<WalletKey, { en: string; ar: string }> = {
  ai_rung2: { en: 'Future Skills Wallet: reach AI fluency rung 2 (Practitioner)', ar: 'محفظة مهارات المستقبل: بلوغ الدرجة 2 في الطلاقة في الذكاء الاصطناعي (ممارِس)' },
  cyber_hygiene: { en: 'Future Skills Wallet: earn the cyber hygiene micro-credential', ar: 'محفظة مهارات المستقبل: الحصول على الاعتماد المصغّر في النظافة السيبرانية' },
  plant_data: { en: 'Future Skills Wallet: show plant-data basics with evidence', ar: 'محفظة مهارات المستقبل: إثبات أساسيات بيانات المحطة بالأدلة' },
  core_skill: { en: 'Future Skills Wallet: practise one critical core skill to level 2', ar: 'محفظة مهارات المستقبل: ممارسة مهارة أساسية حرجة واحدة حتى المستوى 2' },
  cec_l1: { en: 'Future Skills Wallet: reach CleanEnergyComp level 1', ar: 'محفظة مهارات المستقبل: بلوغ المستوى 1 في كفاءات الطاقة النظيفة' },
};
export const OPEN_PLAN = ['draft', 'submitted', 'approved', 'active'];
export const PLAN_RANK: Record<string, number> = { active: 0, approved: 1, submitted: 2, draft: 3 };

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const day = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
/** A timestamp in the SQL form: UTC, seconds, Z (identical to to_char(... at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')). */
export const isoZ = (v: unknown) => new Date(v instanceof Date ? v.getTime() : String(v)).toISOString().slice(0, 19) + 'Z';
const sup = (n: number) => (n >= FW_MIN ? n : null);
/** One-decimal percentage a / b, half up, in integers (identical in SQL kafaa_na_pct1). */
export const fwPct = (a: number, b: number) => Math.floor((2000 * a + b) / (2 * b)) / 10;
const share = (n: number, base: number) => (n >= FW_MIN && base >= FW_MIN ? fwPct(n, base) : null);

export interface WalletItem { key: WalletKey; met: boolean; level: number | null; ref_table: string | null; ref_id: string | null; until: string | null }
export interface WalletStatus { items: WalletItem[]; met: number; complete: boolean }
export interface WalletInputs {
  cells: Row[]; tracks: Row[]; cec: Row[]; core: Row[];
  /** the person's active skill states */
  states: Row[];
  /** the person's micro-credential awards */
  awards: Row[];
}

/** The core-five wallet of one person, from evidence only. */
export function walletStatus(personId: string, inp: WalletInputs, today: string): WalletStatus {
  const st = inp.states.filter((s) => s.active !== false);
  const rung = aiRung(personId, inp.cells as never, inp.tracks as never, st.map((s) => ({ skill_id: s.skill_id, level: Number(s.level), active: true, basis: s.basis })) as never).rung;
  const award = inp.awards.filter((a) => a.def_code === WALLET_RULE.cyber_code && a.status === 'awarded' && (a.valid_to == null || cmp(day(a.valid_to)!, today) >= 0))
    .sort((a, b) => cmp(String(day(b.issued_on) ?? ''), String(day(a.issued_on) ?? '')) || cmp(String(a.id), String(b.id)))[0];
  const counted = st.filter((s) => COUNTED.includes(s.basis) && Number(s.level) >= 1);
  const plant = counted.filter((s) => s.skill_id === WALLET_RULE.plant_skill).sort((a, b) => Number(b.level) - Number(a.level) || cmp(String(a.id ?? ''), String(b.id ?? '')))[0];
  const core = inp.core.filter((c) => (c.status ?? 'active') === 'active').sort((a, b) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id))
    .map((c) => ({ id: c.id, level: Math.min(3, Math.floor(Math.max(0, ...counted.filter((s) => (c.skill_ids ?? []).includes(s.skill_id)).map((s) => Number(s.level))))) }))
    .sort((a, b) => b.level - a.level)[0];
  const cec = cecLevel(inp.cec as never, st.map((s) => ({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, level: s.level, basis: s.basis, active: true })) as never);
  const items: WalletItem[] = [
    { key: 'ai_rung2', met: rung >= WALLET_RULE.ai_rung, level: rung, ref_table: null, ref_id: null, until: null },
    { key: 'cyber_hygiene', met: !!award, level: null, ref_table: award ? 'microcred_awards' : null, ref_id: award ? award.id : null, until: award ? day(award.valid_to) : null },
    { key: 'plant_data', met: !!plant && Number(plant.level) >= WALLET_RULE.plant_level, level: plant ? Number(plant.level) : null, ref_table: plant ? 'person_skills' : null, ref_id: plant ? (plant.id ?? null) : null, until: null },
    { key: 'core_skill', met: !!core && core.level >= WALLET_RULE.core_level, level: core && core.level > 0 ? core.level : null, ref_table: core && core.level > 0 ? 'core_skills' : null, ref_id: core && core.level > 0 ? core.id : null, until: null },
    { key: 'cec_l1', met: cec >= WALLET_RULE.cec_level, level: cec, ref_table: null, ref_id: null, until: null },
  ];
  const met = items.filter((i) => i.met).length;
  return { items, met, complete: met === WALLET_ITEMS.length };
}

/** Build every active staff member's inputs once (pages, local backend, validator, seed). */
export function walletWorld(raw: (t: string) => Row[]) {
  const states = new Map<string, Row[]>(); const awards = new Map<string, Row[]>();
  for (const s of raw('person_skills') ?? []) if (s.active) (states.get(s.person_id) ?? states.set(s.person_id, []).get(s.person_id)!).push(s);
  for (const a of raw('microcred_awards') ?? []) (awards.get(a.person_id) ?? awards.set(a.person_id, []).get(a.person_id)!).push(a);
  const base = { cells: raw('ai_rungs') ?? [], tracks: raw('ai_skill_tracks') ?? [], cec: raw('cec_competences') ?? [], core: raw('core_skills') ?? [] };
  return {
    people: (raw('people') ?? []) as Row[], targets: (raw('wallet_targets') ?? []) as Row[],
    inputsFor: (pid: string): WalletInputs => ({ ...base, states: states.get(pid) ?? [], awards: awards.get(pid) ?? [] }),
  };
}
export type WalletWorld = ReturnType<typeof walletWorld>;

export interface TargetView {
  id: string; metric: string; pct: number; due_on: string; set_by: string; set_by_role: string; set_at: string; set_by_name_en: string; set_by_name_ar: string;
  note_en: string; note_ar: string; version: number; history: Row[]; benchmark_ids: string[]; sources: Row[];
}
/** The active leadership setting with the name of the role card that set it. */
export function targetViewOf(targets: Row[], people: Row[]): TargetView | null {
  const t = targets.filter((x) => x.metric === WALLET_METRIC && x.status === 'active').sort((a, b) => cmp(a.id, b.id))[0];
  if (!t) return null;
  const p = people.find((x) => x.id === t.set_by);
  return {
    id: t.id, metric: t.metric, pct: Number(t.pct), due_on: day(t.due_on)!, set_by: t.set_by, set_by_role: t.set_by_role, set_at: isoZ(t.set_at),
    set_by_name_en: p?.display_name ?? t.set_by, set_by_name_ar: p?.display_name_ar ?? p?.display_name ?? t.set_by,
    note_en: t.note_en, note_ar: t.note_ar, version: Number(t.version), history: t.history ?? [], benchmark_ids: t.benchmark_ids ?? [], sources: t.sources ?? [],
  };
}

export interface CounterFamily { family_id: string; staff: number | null; complete: number | null; pct: number | null; items: Record<WalletKey, number | null> }
export interface WalletCounter {
  as_of: string; staff: number | null; complete: number | null; pct: number | null; gap: number | null; target: TargetView | null;
  items: { key: WalletKey; n: number | null; pct: number | null }[]; distribution: { met: number; n: number | null }[]; families: CounterFamily[];
}
/** The organisation counter (active staff), suppressed under 10. */
export function walletCounter(w: WalletWorld, today: string): WalletCounter {
  const staff = w.people.filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => cmp(a.id, b.id));
  const rows = staff.map((p) => ({ fam: p.job_family_id as string | null, s: walletStatus(p.id, w.inputsFor(p.id), today) }));
  const n = rows.length;
  const complete = rows.filter((r) => r.s.complete).length;
  const pct = share(complete, n);
  const target = targetViewOf(w.targets, w.people);
  const famIds = [...new Set(rows.map((r) => r.fam).filter((f): f is string => !!f && !NO_BREAKOUT.includes(f)))].sort(cmp);
  return {
    as_of: today, staff: sup(n), complete: n >= FW_MIN ? sup(complete) : null, pct, gap: pct != null && target ? (target.pct * 10 - Math.round(pct * 10)) / 10 : null, target,
    items: WALLET_ITEMS.map((k, i) => { const m = rows.filter((r) => r.s.items[i].met).length; return { key: k, n: n >= FW_MIN ? sup(m) : null, pct: share(m, n) }; }),
    distribution: [0, 1, 2, 3, 4, 5].map((k) => ({ met: k, n: n >= FW_MIN ? sup(rows.filter((r) => r.s.met === k).length) : null })),
    families: famIds.map((f) => {
      const fr = rows.filter((r) => r.fam === f); const c = fr.filter((r) => r.s.complete).length;
      return {
        family_id: f, staff: sup(fr.length), complete: fr.length >= FW_MIN ? sup(c) : null, pct: share(c, fr.length),
        items: Object.fromEntries(WALLET_ITEMS.map((k, i) => [k, share(fr.filter((r) => r.s.items[i].met).length, fr.length)])) as Record<WalletKey, number | null>,
      };
    }),
  };
}

// ───────────── the leadership setting
export interface TargetInput { pct: number; due_on: string; note_en: string; note_ar: string }
/** A trimmed string of lo..hi characters (identical to SQL kafaa_na_len: trims spaces, tabs and line breaks, counts characters). */
const len = (v: unknown, lo: number, hi: number) => { const n = typeof v === 'string' ? [...v.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '')].length : 0; return n >= lo && n <= hi; };
/** First problem of a target setting (null = ok). */
export function targetProblem(p: TargetInput, today: string): string | null {
  if (typeof p?.pct !== 'number' || !Number.isInteger(p.pct) || p.pct < 1 || p.pct > 100) return 'pct';
  if (typeof p?.due_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.due_on) || Number.isNaN(Date.parse(`${p.due_on}T00:00:00Z`)) || new Date(`${p.due_on}T00:00:00Z`).toISOString().slice(0, 10) !== p.due_on) return 'due';
  if (cmp(p.due_on, today) <= 0 || cmp(p.due_on, TARGET_MAX_DATE) > 0) return 'due';
  if (!len(p.note_en, 10, 300) || !len(p.note_ar, 10, 300)) return 'note';
  if (!publicTextIsClean([p.note_en, p.note_ar])) return 'clean';
  return null;
}

// ───────────── the development plan
/** The person's open plan the wallet goes to: active first, then approved, submitted, draft; then by id. */
export function planFor(plans: Row[], personId: string): Row | null {
  return plans.filter((p) => p.person_id === personId && OPEN_PLAN.includes(p.status)).sort((a, b) => PLAN_RANK[a.status] - PLAN_RANK[b.status] || cmp(a.id, b.id))[0] ?? null;
}
export const planActivityId = (personId: string, key: WalletKey) => `pa-fs74-${personId}-${key}`;
/** The activities to add for the open items: one per item, never twice (same id, or the same title already in the plan). */
export function planEntries(status: WalletStatus, personId: string, planId: string, activities: Row[], dueOn: string | null) {
  const add: Row[] = []; const existing: string[] = [];
  for (const it of status.items) {
    if (it.met) continue;
    const id = planActivityId(personId, it.key);
    if (activities.some((a) => a.id === id || (a.plan_id === planId && a.title_en === ITEM_TITLE[it.key].en))) { existing.push(it.key); continue; }
    add.push({ id, plan_id: planId, person_id: personId, kind: ITEM_PLAN_KIND[it.key], title_en: ITEM_TITLE[it.key].en, title_ar: ITEM_TITLE[it.key].ar, due_on: dueOn, status: 'planned', course_id: null });
  }
  return { add, existing };
}
/** Plan status of each item for the person (the activity with the wallet id, wherever it sits). */
export function inPlan(activities: Row[], personId: string): Partial<Record<WalletKey, string>> {
  const out: Partial<Record<WalletKey, string>> = {};
  for (const k of WALLET_ITEMS) { const a = activities.find((x) => x.id === planActivityId(personId, k)); if (a) out[k] = a.status; }
  return out;
}

export interface MyWallet {
  person_id: string; family_id: string | null; as_of: string; status: WalletStatus; plan: { id: string; status: string } | null;
  in_plan: Partial<Record<WalletKey, string>>; target: TargetView | null;
}

/** Why an item reads met or open (UI explanation, from the item's evidence fields). */
export function itemReasons(it: WalletItem): Reason[] {
  const base = `m37.fw.reason.${it.key}`;
  const r: Reason[] = [{ code: `fw_${it.key}_${it.met ? 'met' : 'open'}`, key: `${base}.${it.met ? 'met' : 'open'}`, vars: { level: it.level ?? 0 },
    ...(it.ref_table && it.ref_id ? { ref: { table: it.ref_table, id: it.ref_id } } : {}) }];
  r.push({ code: 'fw_evidence_only', key: 'm37.fw.reason.evidenceOnly' });
  return r;
}
