/**
 * FS30 (future skills, wave D · E2, module M34): NQF levels and learning credits. Pure and import-free.
 *
 *   tags      kafaa_credit_tags: an indicative UAE NQF level (1-10) and a credit value on a course, a pathway or a micro-credential.
 *             1 credit = 10 notional learning hours (CREDIT_HOURS). Every tag is indicative until agreed with the National
 *             Qualifications Centre (NQC) and the partner; the flag is fixed (DB check) and every screen says so in EN and AR.
 *   ledger    kafaa_credit_ledger: one row per completed, tagged item (course passed or completed, pathway completed, micro-credential
 *             awarded) plus each RPL decision that recognised hours (FS29). Rows are rebuilt by creditsFor() (SQL kafaa_cr_compute)
 *             and never deleted: an item that no longer counts is marked `reversed`. The total is the sum of counted rows (in tenths,
 *             so TS and SQL add up exactly).
 *   stacks    kafaa_credit_stacks: 30-credit stacks shown toward an indicative external award with a partner university that is still
 *             to be agreed. Progress counts tagged items in the stack (at or above the stack's minimum item level) and RPL credit up to
 *             the stack's RPL cap.
 *
 * SQL mirror (supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql): kafaa_cr_compute = creditsFor, kafaa_cr_check_tag =
 * checkTag, kafaa_cr_message = CR_MSG.
 */
export const CREDIT_HOURS = 10;
export const ITEM_KINDS = ['course', 'pathway', 'microcred'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const LEDGER_KINDS = ['course', 'pathway', 'microcred', 'rpl'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];
export const NQF_MIN = 1;
export const NQF_MAX = 10;
export const HOURS_MIN = 1;
export const HOURS_MAX = 1200;
export const BASIS_MIN = 20;
export const BASIS_MAX = 300;
export const STACK_CREDITS = 30;
/** Indicative NQF level for each Kafa'a level: the lower bound of the FS24 published map (kafaa_scale_maps, uae_nqf l1..l4). */
export const NQF_BY_LEVEL: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 7 };
export const nqfForLevel = (level: number | null | undefined): number | null => (level && NQF_BY_LEVEL[level] ? NQF_BY_LEVEL[level] : null);
/** Credits for whole notional hours (1 credit = 10 hours), exact to one decimal. */
export const creditsOf = (hours: number): number => Math.max(0, Math.trunc(Number(hours) || 0)) / CREDIT_HOURS;
/** "2.4" style text (always one decimal, Latin digits): used inside stored statements, never for display. */
export const creditsText = (hours: number): string => `${Math.trunc(Math.max(0, Math.trunc(Number(hours) || 0)) / 10)}.${Math.max(0, Math.trunc(Number(hours) || 0)) % 10}`;
export const COMPLETED_RESULTS = ['passed', 'completed'];
export const tagId = (kind: string, item: string) => `ct:${kind}:${item}`;
export const ledgerId = (person: string, kind: string, item: string) => `cl:${person}:${kind}:${item}`;

const s = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const isInt = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.trunc(v) === v;
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────── Tag editing (frameworks W/A)
export interface TagInput {
  item_kind?: unknown;
  item_id?: unknown;
  nqf_level?: unknown;
  notional_hours?: unknown;
  basis_en?: unknown;
  basis_ar?: unknown;
  stack_ids?: unknown;
  /** true retires an existing tag (it stops counting; the ledger rows that used it are reversed at the next sync). */
  retire?: unknown;
}
export interface TagCtx {
  /** The item the tag is for (null when missing); `live` = published pathway, current micro-credential or any course. */
  item: { id: string; live: boolean } | null;
  stacks: string[];
  existing: { id: string; status: string } | null;
}
export type TagCode = 'ok' | 'kind' | 'item' | 'not_live' | 'not_found' | 'nqf' | 'hours' | 'basis' | 'stack';
/** checkTag(): 'ok' or the first failing code (same order as SQL kafaa_cr_check_tag). */
export function checkTag(input: TagInput, ctx: TagCtx): TagCode {
  if (!(ITEM_KINDS as readonly string[]).includes(s(input.item_kind))) return 'kind';
  if (!ctx.item) return 'item';
  if (input.retire === true) return ctx.existing && ctx.existing.status === 'published' ? 'ok' : 'not_found';
  if (!ctx.item.live) return 'not_live';
  if (!isInt(input.nqf_level) || (input.nqf_level as number) < NQF_MIN || (input.nqf_level as number) > NQF_MAX) return 'nqf';
  if (!isInt(input.notional_hours) || (input.notional_hours as number) < HOURS_MIN || (input.notional_hours as number) > HOURS_MAX) return 'hours';
  const en = s(input.basis_en);
  const ar = s(input.basis_ar);
  if (en.length < BASIS_MIN || ar.length < BASIS_MIN || en.length > BASIS_MAX || ar.length > BASIS_MAX) return 'basis';
  const st = input.stack_ids == null ? [] : input.stack_ids;
  if (!Array.isArray(st) || st.length > 4 || st.some((x) => typeof x !== 'string' || !ctx.stacks.includes(x)) || new Set(st).size !== st.length) return 'stack';
  return 'ok';
}
export const CR_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to work with learning credits',
  forbidden: 'Only framework owners (instructors, the training manager and admins) tag learning with NQF levels and credits',
  forbidden_sync: 'You can refresh your own credit ledger; framework owners and assessors refresh anyone\'s',
  kind: 'Choose a course, a pathway or a micro-credential',
  item: 'Learning item not found',
  not_live: 'Only courses, published pathways and current micro-credentials are tagged',
  not_found: 'There is no published tag to retire',
  nqf: 'Choose an indicative NQF level from 1 to 10',
  hours: 'Give the notional learning hours as a whole number from 1 to 1200 (1 credit = 10 hours)',
  basis: 'Explain how the level and hours were estimated in English and Arabic (20 to 300 characters each)',
  stack: 'Choose up to 4 different stacks from the list',
};
export const crResultCode = (c: string): string => ({ item: 'not_found', not_found: 'not_found' } as Record<string, string>)[c] ?? 'invalid';

// ───────────── Ledger (creditsFor = SQL kafaa_cr_compute)
export interface TagLite { id: string; item_kind: string; item_id: string; status: string; notional_hours: number; nqf_level: number; stack_ids: string[]; title_en: string; title_ar: string }
export interface CreditWorld {
  training_records: { id: string; person_id: string; course_id: string; completed_on: string; result: string }[];
  pathway_enrolments: { id: string; person_id: string; pathway_id: string; status: string; completed_on?: string | null }[];
  microcred_awards: { id: string; person_id: string; def_id: string; status: string; issued_on?: string | null }[];
  rpl_requests: { id: string; person_id: string; status: string; outcome?: string | null; hours?: number | null; nqf_level?: number | null; decided_on?: string | null; target_title_en: string; target_title_ar: string; target_skill_ids?: string[] | null }[];
  credit_tags: TagLite[];
  credit_stacks: { id: string; skill_ids: string[] }[];
}
export interface LedgerRow {
  id: string;
  person_id: string;
  item_kind: LedgerKind;
  item_id: string;
  tag_id: string | null;
  title_en: string;
  title_ar: string;
  completed_on: string;
  source_table: string;
  source_id: string;
  notional_hours: number;
  credits: number;
  nqf_level: number | null;
  stack_ids: string[];
}

/** Earliest completion per item (ties: smallest source id). */
function earliest<T extends { id: string }>(rows: T[], key: (r: T) => string, date: (r: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const cur = out.get(k);
    if (!cur || date(r) < date(cur) || (date(r) === date(cur) && r.id < cur.id)) out.set(k, r);
  }
  return out;
}

/** creditsFor(): the ledger rows a person should have now, sorted by id. */
export function creditsFor(person: string, w: CreditWorld): LedgerRow[] {
  const tags = new Map<string, TagLite>();
  for (const t of w.credit_tags) if (t.status === 'published') tags.set(`${t.item_kind}|${t.item_id}`, t);
  const out: LedgerRow[] = [];
  const add = (kind: ItemKind, item: string, table: string, src: { id: string }, on: string) => {
    const t = tags.get(`${kind}|${item}`);
    if (!t) return;
    out.push({
      id: ledgerId(person, kind, item), person_id: person, item_kind: kind, item_id: item, tag_id: t.id, title_en: t.title_en, title_ar: t.title_ar,
      completed_on: on, source_table: table, source_id: src.id, notional_hours: Number(t.notional_hours), credits: creditsOf(t.notional_hours), nqf_level: Number(t.nqf_level),
      stack_ids: [...(t.stack_ids ?? [])].sort(cmp),
    });
  };
  const tr = earliest(w.training_records.filter((r) => r.person_id === person && COMPLETED_RESULTS.includes(r.result) && r.completed_on), (r) => r.course_id, (r) => d10(r.completed_on)!);
  for (const [course, r] of tr) add('course', course, 'training_records', r, d10(r.completed_on)!);
  const pe = earliest(w.pathway_enrolments.filter((r) => r.person_id === person && r.status === 'completed' && r.completed_on), (r) => r.pathway_id, (r) => d10(r.completed_on)!);
  for (const [pw, r] of pe) add('pathway', pw, 'pathway_enrolments', r, d10(r.completed_on)!);
  const ma = earliest(w.microcred_awards.filter((r) => r.person_id === person && r.status === 'awarded' && r.issued_on), (r) => r.def_id, (r) => d10(r.issued_on)!);
  for (const [def, r] of ma) add('microcred', def, 'microcred_awards', r, d10(r.issued_on)!);
  for (const r of w.rpl_requests) {
    if (r.person_id !== person || r.status !== 'decided' || (r.outcome !== 'full' && r.outcome !== 'partial') || !(Number(r.hours) > 0) || !r.decided_on) continue;
    const sk = new Set(r.target_skill_ids ?? []);
    out.push({
      id: ledgerId(person, 'rpl', r.id), person_id: person, item_kind: 'rpl', item_id: r.id, tag_id: null,
      title_en: `RPL: ${r.target_title_en}`, title_ar: `اعتراف بالتعلم السابق: ${r.target_title_ar}`, completed_on: d10(r.decided_on)!, source_table: 'rpl_requests', source_id: r.id,
      notional_hours: Number(r.hours), credits: creditsOf(Number(r.hours)), nqf_level: r.nqf_level ?? null,
      stack_ids: w.credit_stacks.filter((st) => (st.skill_ids ?? []).some((x) => sk.has(x))).map((st) => st.id).sort(cmp),
    });
  }
  return out.sort((a, b) => cmp(a.id, b.id));
}
/** Total credits of counted rows, added in tenths (exact). */
export const ledgerTotal = (rows: { notional_hours: number; status?: string }[]): number =>
  rows.filter((r) => (r.status ?? 'counted') === 'counted').reduce((a, r) => a + Math.trunc(Number(r.notional_hours) || 0), 0) / CREDIT_HOURS;

/** Compare the stored ledger with creditsFor(): rows to add or change, and stored counted rows that no longer count. */
export function ledgerDiff(stored: (LedgerRow & { status: string })[], want: LedgerRow[]): { upsert: LedgerRow[]; reverse: string[] } {
  const cur = new Map(stored.map((r) => [r.id, r]));
  const ids = new Set(want.map((r) => r.id));
  const upsert = want.filter((r) => {
    const c = cur.get(r.id);
    return !c || c.status !== 'counted' || Number(c.notional_hours) !== r.notional_hours || (c.nqf_level ?? null) !== r.nqf_level || c.tag_id !== r.tag_id
      || d10(c.completed_on) !== r.completed_on || c.source_id !== r.source_id || c.title_en !== r.title_en || JSON.stringify([...(c.stack_ids ?? [])].sort(cmp)) !== JSON.stringify(r.stack_ids);
  });
  const reverse = stored.filter((r) => r.status === 'counted' && !ids.has(r.id)).map((r) => r.id).sort(cmp);
  return { upsert, reverse };
}

// ───────────── Stacks (pages)
export interface StackLite { id: string; credits_required: number; rpl_max: number; min_item_nqf: number }
export interface StackProgress { id: string; hours: number; credits: number; rpl_credits: number; rpl_capped: boolean; items: number; pct: number; remaining: number; complete: boolean }
/** Progress toward one stack: counted rows naming it at or above its minimum item level; RPL credit up to the cap. */
export function stackProgress(stack: StackLite, rows: { item_kind: string; notional_hours: number; nqf_level: number | null; stack_ids: string[]; status?: string }[]): StackProgress {
  let hours = 0;
  let rpl = 0;
  let items = 0;
  for (const r of rows) {
    if ((r.status ?? 'counted') !== 'counted' || !(r.stack_ids ?? []).includes(stack.id) || (r.nqf_level ?? 0) < stack.min_item_nqf) continue;
    items++;
    if (r.item_kind === 'rpl') rpl += Math.trunc(Number(r.notional_hours) || 0);
    else hours += Math.trunc(Number(r.notional_hours) || 0);
  }
  const cap = stack.rpl_max * CREDIT_HOURS;
  const rplUsed = Math.min(rpl, cap);
  const total = hours + rplUsed;
  const need = stack.credits_required * CREDIT_HOURS;
  return {
    id: stack.id, hours: total, credits: total / CREDIT_HOURS, rpl_credits: rplUsed / CREDIT_HOURS, rpl_capped: rpl > cap, items,
    pct: need > 0 ? Math.min(100, Math.round((total / need) * 100)) : 0, remaining: Math.max(0, need - total) / CREDIT_HOURS, complete: total >= need,
  };
}

/** Coverage KPI for the tag editor: live items with and without a published tag. */
export function tagCoverage(items: { kind: string; id: string; live: boolean }[], tags: { item_kind: string; item_id: string; status: string }[]) {
  const pub = new Set(tags.filter((t) => t.status === 'published').map((t) => `${t.item_kind}|${t.item_id}`));
  const out: Record<string, { live: number; tagged: number; missing: string[] }> = {};
  for (const k of ITEM_KINDS) out[k] = { live: 0, tagged: 0, missing: [] };
  for (const it of items) {
    if (!it.live || !out[it.kind]) continue;
    out[it.kind].live++;
    if (pub.has(`${it.kind}|${it.id}`)) out[it.kind].tagged++;
    else out[it.kind].missing.push(it.id);
  }
  return out;
}
