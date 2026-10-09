/**
 * F30 Learning record store: the Kafa'a xAPI 2.0 profile (IEEE 9274.1.1-2023 shape), pure and import-free so node scripts
 * (scripts/seed/ext/f30-lrs.mjs, scripts/validate/w4e4-lrs.mjs) load it directly.
 *
 *   validateStatement(input, env)  the JSON-schema check behind rpc.storeStatement (SQL mirror: kafaa_xapi_validate)
 *   draftFor(source, row, lookups) what each Kafa'a emitter records for a source row (SQL mirror: kafaa_xapi_d_* functions)
 *   toXapi(row)                    the stored row as an xAPI 2.0 statement (export, statement view)
 *   xapiId(source, ref)            deterministic statement id (uuid layout over md5), identical in SQL
 *
 * Profile rules: the actor is a Kafa'a account (homePage + person id) and never an mbox, mbox_sha1sum, openid or name; no
 * free-text `response` (it could carry assessment content); no secure assessment item id anywhere; verbs and activity types
 * come from the registries below. Change this file and supabase/migrations/20261009144001_kafaa_w4e4_lrs.sql together.
 */

export const XAPI_HOME = 'https://kafaa.example';
export const ACTIVITY_BASE = `${XAPI_HOME}/xapi/activities/`;
export const EXT = `${XAPI_HOME}/xapi/ext/`;
export const XAPI_VERSION = '2.0.0';
export const MAX_STATEMENT_CHARS = 8000;

export const VERBS = ['completed', 'passed', 'failed', 'answered', 'attended', 'experienced', 'attempted', 'progressed'] as const;
export type Verb = (typeof VERBS)[number];
export const VERB_IRI: Record<Verb, string> = Object.fromEntries(VERBS.map((v) => [v, `http://adlnet.gov/expapi/verbs/${v}`])) as Record<Verb, string>;
export const VERB_DISPLAY: Record<Verb, { en: string; ar: string }> = {
  completed: { en: 'completed', ar: 'أكمل' },
  passed: { en: 'passed', ar: 'اجتاز' },
  failed: { en: 'failed', ar: 'لم يجتز' },
  answered: { en: 'answered', ar: 'أجاب عن' },
  attended: { en: 'attended', ar: 'حضر' },
  experienced: { en: 'experienced', ar: 'خاض تجربة' },
  attempted: { en: 'attempted', ar: 'حاول' },
  progressed: { en: 'progressed', ar: 'تقدّم في' },
};

export const OBJECT_TYPES = ['course', 'module', 'scenario', 'task', 'refresher', 'opportunity', 'rotation', 'shadowing', 'jpm', 'mentoring', 'knowledge_asset', 'activity'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
const ADL = 'http://adlnet.gov/expapi/activities/';
export const ACTIVITY_TYPE_IRI: Record<ObjectType, string | null> = {
  course: `${ADL}course`, module: `${ADL}module`, scenario: `${ADL}simulation`, task: `${ADL}performance`, refresher: `${ADL}assessment`,
  opportunity: `${XAPI_HOME}/xapi/activity-types/opportunity`, rotation: `${XAPI_HOME}/xapi/activity-types/rotation`, shadowing: `${XAPI_HOME}/xapi/activity-types/shadowing`,
  jpm: `${ADL}performance`, mentoring: `${ADL}meeting`, knowledge_asset: `${XAPI_HOME}/xapi/activity-types/knowledge-asset`, activity: null,
};

export const SOURCES = ['m04_course', 'f14_refresher', 'f08_opportunity', 'f15_rotation', 'f15_shadowing', 'm05_jpm', 'f13_mentoring', 'f21_knowledge', 'f28_simulator', 'f38_ojt', 'console'] as const;
export type Source = (typeof SOURCES)[number];
/** The emitter registry: which Kafa'a event writes which statement. `planned` emitters belong to features not built yet (F28, F38). */
export const EMITTERS: { source: Source; module: string; feature: string; table: string; verbs: Verb[]; object_type: ObjectType; status: 'live' | 'planned' | 'console'; route: string | null }[] = [
  { source: 'm04_course', module: 'M04', feature: 'M04', table: 'training_records', verbs: ['completed', 'failed'], object_type: 'course', status: 'live', route: '/my/learning' },
  { source: 'f14_refresher', module: 'M19', feature: 'F14', table: 'refresh_state', verbs: ['answered'], object_type: 'refresher', status: 'live', route: '/my/coach/refresh' },
  { source: 'f08_opportunity', module: 'M20', feature: 'F08', table: 'opportunity_applications', verbs: ['completed'], object_type: 'opportunity', status: 'live', route: '/opportunities/my' },
  { source: 'f15_rotation', module: 'M20', feature: 'F15', table: 'rotation_placements', verbs: ['completed'], object_type: 'rotation', status: 'live', route: '/opportunities/rotations/my' },
  { source: 'f15_shadowing', module: 'M20', feature: 'F15', table: 'shadow_requests', verbs: ['experienced'], object_type: 'shadowing', status: 'live', route: '/opportunities/rotations/shadow' },
  { source: 'm05_jpm', module: 'M05', feature: 'M05', table: 'jpm_results', verbs: ['passed', 'failed'], object_type: 'jpm', status: 'live', route: '/training/jpm' },
  { source: 'f13_mentoring', module: 'M04', feature: 'F13', table: 'mentoring_sessions', verbs: ['attended'], object_type: 'mentoring', status: 'live', route: '/my/mentoring' },
  { source: 'f21_knowledge', module: 'M24', feature: 'F21', table: 'asset_uses', verbs: ['experienced'], object_type: 'knowledge_asset', status: 'live', route: '/knowledge' },
  { source: 'f28_simulator', module: 'M04', feature: 'F28', table: 'crew_debriefs', verbs: ['completed', 'attended'], object_type: 'scenario', status: 'planned', route: null },
  { source: 'f38_ojt', module: 'M02', feature: 'F38', table: 'ojt_logs', verbs: ['attempted'], object_type: 'task', status: 'planned', route: null },
  { source: 'console', module: 'M27', feature: 'F30', table: '—', verbs: [...VERBS], object_type: 'activity', status: 'console', route: '/training/lrs/console' },
];

export interface LangMap { en: string; ar: string }
/** A row of kafaa_xapi_statements. */
export interface StatementRow {
  id: string;
  actor_person_id: string;
  verb: Verb;
  object_type: ObjectType;
  object_id: string;
  object_name: LangMap | Record<string, string>;
  result: Record<string, unknown> | null;
  context: Record<string, unknown>;
  occurred_at: string;
  stored_at: string;
  source: Source;
  source_ref: string;
  stored_by: string | null;
  version: string;
}

// ───────────── md5 (sync; same digest as SQL md5()) and deterministic ids
const SH = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const KK = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5(input: string): string {
  const msg = new TextEncoder().encode(input);
  const len = msg.length;
  const blocks = ((len + 8) >>> 6) + 1;
  const w = new Uint32Array(blocks * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= msg[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[blocks * 16 - 2] = (len * 8) >>> 0;
  w[blocks * 16 - 1] = Math.floor((len * 8) / 2 ** 32);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let k = 0; k < blocks; k++) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + KK[i] + w[k * 16 + g]) >>> 0;
      B = (B + ((sum << SH[i]) | (sum >>> (32 - SH[i])))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const hex = (n: number) => [0, 1, 2, 3].map((i) => ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')).join('');
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}
/** Statement id: md5(source:ref) laid out as a UUID (version 8, RFC 9562 custom). SQL: kafaa_xapi_id(source, ref). */
export function xapiId(source: string, ref: string): string {
  const x = md5(`${source}:${ref}`);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-8${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`;
}
/** Refresher answers never carry the practice item id: the reference is a hash of the state row plus the attempt number. */
export function refresherRef(stateId: string, attempts: number): string {
  return `${md5(stateId).slice(0, 16)}:${attempts}`;
}

// ───────────── times
export const noonOf = (d: string) => `${String(d).slice(0, 10)}T12:00:00Z`;
const ms = (t: string) => Date.parse(t);
/** Canonical second-precision UTC ISO string. */
export const isoTs = (t: string | Date) => new Date(Math.floor((typeof t === 'string' ? Date.parse(t) : t.getTime()) / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const earliest = (a: string, b: string) => (ms(a) <= ms(b) ? a : b);
/** Trim a number the way SQL trim_scale(numeric)::text does for the demo's values (integers or short decimals). */
const numText = (n: unknown) => String(Number(n));

// ───────────── emitters: source row -> statement draft (SQL mirror: kafaa_xapi_d_<source>)
export interface Titled { title_en?: string | null; title_ar?: string | null }
export interface EmitLookups {
  course(id: string): Titled | undefined;
  competency(id: string): { name_en?: string | null; name_ar?: string | null } | undefined;
  opportunity(id: string): Titled | undefined;
  template(id: string): Titled | undefined;
  role(id: string): Titled | undefined;
  jpm(id: string): (Titled & { standard_id?: string | null }) | undefined;
  standard(id: string): { security_restricted?: boolean | null } | undefined;
  asset(id: string): Titled | undefined;
  agreement(id: string): { mentoring_type?: string | null } | undefined;
}
export const MENTORING_NAMES: Record<string, LangMap> = {
  career: { en: 'Career mentoring', ar: 'إرشاد مهني' },
  knowledge_transfer: { en: 'Knowledge-transfer mentoring', ar: 'إرشاد لنقل المعرفة' },
  leadership: { en: 'Leadership mentoring', ar: 'إرشاد قيادي' },
  reverse: { en: 'Reverse mentoring', ar: 'إرشاد عكسي' },
  peer_onboarding: { en: 'Peer onboarding', ar: 'إرشاد الأقران عند الانضمام' },
};
const MENTORING_DEFAULT: LangMap = { en: 'Mentoring', ar: 'إرشاد' };
const SHADOW_DEFAULT: LangMap = { en: 'Job shadowing', ar: 'التظليل الوظيفي' };
const titled = (x: Titled | undefined, id: string): LangMap => ({ en: x?.title_en || id, ar: x?.title_ar || x?.title_en || id });
const record = (table: string, id: string) => ({ extensions: { [`${EXT}record`]: `${table}/${id}` } });

export type Draft = Omit<StatementRow, 'stored_by' | 'version'> & { stored_by: null; version: string };
type R = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));

/**
 * The statement a Kafa'a emitter records for a source row, or null when the row emits nothing (security-restricted JPM).
 * `stored` is when the LRS stores it (now for live emitters; the experience time for seeded and backfilled rows).
 */
export function draftFor(source: Source, row: R, L: EmitLookups, stored?: string): Draft | null {
  const make = (ref: string, actor: string, verb: Verb, type: ObjectType, objectId: string, name: LangMap, result: R | null, context: R, occurred: string): Draft => {
    const st = isoTs(stored ?? occurred);
    return {
      id: xapiId(source, ref), actor_person_id: actor, verb, object_type: type, object_id: objectId, object_name: name, result, context,
      occurred_at: isoTs(stored ? earliest(occurred, stored) : occurred), stored_at: st, source, source_ref: ref, stored_by: null, version: XAPI_VERSION,
    };
  };
  switch (source) {
    case 'm04_course': {
      const res = s(row.result);
      const failed = res === 'failed';
      const result: R = { completion: true };
      if (res === 'passed') result.success = true;
      if (failed) result.success = false;
      if (Number(row.hours) > 0) result.duration = `PT${numText(row.hours)}H`;
      return make(s(row.id), s(row.person_id), failed ? 'failed' : 'completed', 'course', s(row.course_id), titled(L.course(s(row.course_id)), s(row.course_id)), result, record('training_records', s(row.id)), noonOf(s(row.completed_on)));
    }
    case 'f14_refresher': {
      const comp = L.competency(s(row.competency_id));
      const name = { en: comp?.name_en || s(row.competency_id), ar: comp?.name_ar || comp?.name_en || s(row.competency_id) };
      return make(refresherRef(s(row.id), Number(row.attempts)), s(row.person_id), 'answered', 'refresher', s(row.competency_id), name,
        { success: row.last_result === 'correct' }, { extensions: { [`${EXT}leitner-box`]: Number(row.box) } }, isoTs(s(row.last_at ?? row.created_at)));
    }
    case 'f08_opportunity':
      return make(s(row.id), s(row.person_id), 'completed', 'opportunity', s(row.opportunity_id), titled(L.opportunity(s(row.opportunity_id)), s(row.opportunity_id)),
        { completion: true, success: true }, record('opportunity_applications', s(row.id)), isoTs(s(row.completed_at ?? row.updated_at)));
    case 'f15_rotation':
      return make(s(row.id), s(row.person_id), 'completed', 'rotation', s(row.template_id), titled(L.template(s(row.template_id)), s(row.template_id)),
        { completion: true, success: true }, record('rotation_placements', s(row.id)), isoTs(s(row.signed_off_at ?? row.updated_at)));
    case 'f15_shadowing': {
      const role = row.host_role_id ? s(row.host_role_id) : null;
      const name = role ? titled(L.role(role), role) : SHADOW_DEFAULT;
      return make(s(row.id), s(row.person_id), 'experienced', 'shadowing', role ?? s(row.id), name, { completion: true, duration: `P${numText(row.days)}D` },
        record('shadow_requests', s(row.id)), isoTs(s(row.completed_at ?? row.updated_at)));
    }
    case 'm05_jpm': {
      const j = L.jpm(s(row.jpm_id));
      if (j?.standard_id && L.standard(j.standard_id)?.security_restricted) return null;
      const pct = Number(row.score_pct);
      const pass = row.result === 'pass';
      return make(s(row.id), s(row.person_id), pass ? 'passed' : 'failed', 'jpm', s(row.jpm_id), titled(j, s(row.jpm_id)),
        { completion: true, success: pass, score: { scaled: Math.round(pct * 100) / 10000, raw: pct, min: 0, max: 100 } }, record('jpm_results', s(row.id)), noonOf(s(row.date)));
    }
    case 'f13_mentoring': {
      const type = L.agreement(s(row.agreement_id))?.mentoring_type ?? '';
      return make(s(row.id), s(row.person_id), 'attended', 'mentoring', s(row.agreement_id), MENTORING_NAMES[type] ?? MENTORING_DEFAULT,
        { duration: `PT${numText(row.minutes)}M` }, record('mentoring_sessions', s(row.id)), noonOf(s(row.held_on)));
    }
    case 'f21_knowledge':
      return make(s(row.id), s(row.person_id), 'experienced', 'knowledge_asset', s(row.asset_id), titled(L.asset(s(row.asset_id)), s(row.asset_id)), null,
        record('asset_uses', s(row.id)), noonOf(s(row.used_on)));
    default:
      return null;
  }
}

/** Lookups over plain table arrays (seed builder, tests). */
export function lookupsFrom(T: Record<string, R[]>): EmitLookups {
  const idx = (t: string) => new Map((T[t] ?? []).map((r) => [String(r.id), r]));
  const m = { course: idx('courses'), competency: idx('competencies'), opportunity: idx('opportunities'), template: idx('rotation_templates'), role: idx('job_roles'),
    jpm: idx('jpms'), standard: idx('qual_standards'), asset: idx('knowledge_assets'), agreement: idx('mentoring_agreements') };
  return {
    course: (id) => m.course.get(id) as Titled, competency: (id) => m.competency.get(id) as never, opportunity: (id) => m.opportunity.get(id) as Titled,
    template: (id) => m.template.get(id) as Titled, role: (id) => m.role.get(id) as Titled, jpm: (id) => m.jpm.get(id) as never, standard: (id) => m.standard.get(id) as never,
    asset: (id) => m.asset.get(id) as Titled, agreement: (id) => m.agreement.get(id) as never,
  };
}

/** Which source rows emit (used for seeded/backfilled statements; live emitters fire on the same transitions). */
export function sourceRows(T: Record<string, R[]>): [Source, R][] {
  const out: [Source, R][] = [];
  for (const r of T.training_records ?? []) out.push(['m04_course', r]);
  for (const r of T.refresh_state ?? []) if (Number(r.attempts) > 0) out.push(['f14_refresher', r]);
  for (const r of T.opportunity_applications ?? []) if (r.status === 'completed') out.push(['f08_opportunity', r]);
  for (const r of T.rotation_placements ?? []) if (r.status === 'signed_off') out.push(['f15_rotation', r]);
  for (const r of T.shadow_requests ?? []) if (r.status === 'completed') out.push(['f15_shadowing', r]);
  for (const r of T.jpm_results ?? []) out.push(['m05_jpm', r]);
  for (const r of T.mentoring_sessions ?? []) out.push(['f13_mentoring', r]);
  for (const r of T.asset_uses ?? []) out.push(['f21_knowledge', r]);
  return out;
}
/** Every statement the emitters would have stored for the given tables (stored = experience time). SQL: kafaa_xapi_source_rows(). */
export function backfill(T: Record<string, R[]>): Draft[] {
  const L = lookupsFrom(T);
  const out: Draft[] = [];
  for (const [src, row] of sourceRows(T)) {
    const d = draftFor(src, row, L);
    if (d) out.push(d);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ───────────── xAPI 2.0 view of a stored row
export function activityIri(type: string, id: string): string {
  return `${ACTIVITY_BASE}${type}/${id}`;
}
export function toXapi(row: Pick<StatementRow, 'id' | 'actor_person_id' | 'verb' | 'object_type' | 'object_id' | 'object_name' | 'result' | 'context' | 'occurred_at' | 'stored_at' | 'version'>): Record<string, unknown> {
  const name = row.object_name as Record<string, string>;
  const typeIri = ACTIVITY_TYPE_IRI[row.object_type];
  const definition: Record<string, unknown> = {};
  if (name?.en || name?.ar) definition.name = { ...(name.en ? { 'en-US': name.en } : {}), ...(name.ar ? { 'ar-AE': name.ar } : {}) };
  if (typeIri) definition.type = typeIri;
  const ctx = { platform: "Kafa'a", ...(row.context ?? {}) };
  return {
    id: row.id,
    actor: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: row.actor_person_id } },
    verb: { id: VERB_IRI[row.verb], display: { 'en-US': VERB_DISPLAY[row.verb].en, 'ar-AE': VERB_DISPLAY[row.verb].ar } },
    object: { objectType: 'Activity', id: activityIri(row.object_type, row.object_id), ...(Object.keys(definition).length ? { definition } : {}) },
    ...(row.result ? { result: row.result } : {}),
    context: ctx,
    timestamp: isoTs(row.occurred_at),
    stored: isoTs(row.stored_at),
    authority: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: 'kafaa-lrs' } },
    version: row.version || XAPI_VERSION,
  };
}
/** JSON lines export (own data right): one xAPI statement per line, oldest first. */
export function toJsonLines(rows: Parameters<typeof toXapi>[0][]): string {
  return [...rows].sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at) || (a.id < b.id ? -1 : 1)).map((r) => JSON.stringify(toXapi(r))).join('\n') + (rows.length ? '\n' : '');
}

// ───────────── statement validation (SQL mirror: kafaa_xapi_validate)
export type SchemaErrorCode =
  | 'not_object' | 'too_large' | 'unknown_field' | 'lrs_field' | 'id_format'
  | 'actor_required' | 'actor_type' | 'mbox_not_allowed' | 'name_not_allowed' | 'account_required' | 'account_home' | 'unknown_person'
  | 'verb_required' | 'verb_unknown' | 'display_format'
  | 'object_required' | 'object_type' | 'object_iri' | 'object_kind' | 'name_format' | 'secure_content'
  | 'result_format' | 'score_range' | 'bool_format' | 'duration_format' | 'response_not_allowed'
  | 'context_format' | 'registration_format' | 'extension_key'
  | 'timestamp_format' | 'timestamp_future' | 'version_unsupported';
export interface SchemaError { path: string; code: SchemaErrorCode }
export interface ValidateEnv {
  isPerson: (id: string) => boolean;
  /** Ids of secure-bank assessment items (never allowed anywhere in a statement). */
  secureItemIds: readonly string[];
  now: Date;
}
export interface Mapped {
  id: string | null;
  actor_person_id: string;
  verb: Verb;
  object_type: ObjectType;
  object_id: string;
  object_name: Record<string, string>;
  result: Record<string, unknown> | null;
  context: Record<string, unknown>;
  occurred_at: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OBJ_ID = /^[A-Za-z0-9:._-]{1,80}$/;
const DURATION = /^P(?=\d|T\d)(\d+(\.\d+)?Y)?(\d+(\.\d+)?M)?(\d+(\.\d+)?W)?(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d+)?S)?)?$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const IRI = /^https?:\/\/\S+$/;
const TOP = ['id', 'actor', 'verb', 'object', 'result', 'context', 'timestamp', 'version'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isLangMap = (v: unknown) => isObj(v) && Object.values(v).every((x) => typeof x === 'string' && x.length <= 200);
/** Word-bounded occurrence of an id inside a text (ids are [A-Za-z0-9_-]). */
export function containsId(text: string, id: string): boolean {
  let i = text.indexOf(id);
  const word = (c: string | undefined) => !!c && /[A-Za-z0-9_-]/.test(c);
  while (i >= 0) {
    if (!word(text[i - 1]) && !word(text[i + id.length])) return true;
    i = text.indexOf(id, i + 1);
  }
  return false;
}

/** Check a statement against the Kafa'a xAPI 2.0 profile. Errors are in check order; `mapped` is set when there are none. */
export function validateStatement(input: unknown, env: ValidateEnv): { errors: SchemaError[]; mapped: Mapped | null } {
  const errors: SchemaError[] = [];
  const err = (path: string, code: SchemaErrorCode) => errors.push({ path, code });
  if (!isObj(input)) return { errors: [{ path: '$', code: 'not_object' }], mapped: null };
  const text = JSON.stringify(input);
  if (text.length > MAX_STATEMENT_CHARS) return { errors: [{ path: '$', code: 'too_large' }], mapped: null };
  for (const k of Object.keys(input).sort()) {
    if (k === 'stored' || k === 'authority') err(k, 'lrs_field');
    else if (!TOP.includes(k)) err(k, 'unknown_field');
  }
  if (input.id !== undefined && (typeof input.id !== 'string' || !UUID.test(input.id))) err('id', 'id_format');
  // actor: a Kafa'a account only
  const a = input.actor;
  let actor = '';
  if (!isObj(a)) err('actor', 'actor_required');
  else {
    if (a.objectType !== undefined && a.objectType !== 'Agent') err('actor.objectType', 'actor_type');
    for (const k of ['mbox', 'mbox_sha1sum', 'openid']) if (a[k] !== undefined) err(`actor.${k}`, 'mbox_not_allowed');
    if (a.name !== undefined) err('actor.name', 'name_not_allowed');
    for (const k of Object.keys(a).sort()) if (!['objectType', 'account', 'mbox', 'mbox_sha1sum', 'openid', 'name'].includes(k)) err(`actor.${k}`, 'unknown_field');
    const acc = a.account;
    if (!isObj(acc) || typeof acc.name !== 'string' || typeof acc.homePage !== 'string') err('actor.account', 'account_required');
    else if (acc.homePage !== XAPI_HOME) err('actor.account.homePage', 'account_home');
    else if (!env.isPerson(acc.name)) err('actor.account.name', 'unknown_person');
    else actor = acc.name;
  }
  // verb: from the registry
  const v = input.verb;
  let verb: Verb | null = null;
  if (!isObj(v) || typeof v.id !== 'string') err('verb', 'verb_required');
  else {
    verb = (VERBS.find((x) => VERB_IRI[x] === v.id) ?? null) as Verb | null;
    if (!verb) err('verb.id', 'verb_unknown');
    if (v.display !== undefined && !isLangMap(v.display)) err('verb.display', 'display_format');
    for (const k of Object.keys(v).sort()) if (!['id', 'display'].includes(k)) err(`verb.${k}`, 'unknown_field');
  }
  // object: a Kafa'a activity
  const o = input.object;
  let otype: ObjectType | null = null;
  let oid = '';
  let oname: Record<string, string> = {};
  if (!isObj(o) || typeof o.id !== 'string') err('object', 'object_required');
  else {
    if (o.objectType !== undefined && o.objectType !== 'Activity') err('object.objectType', 'object_type');
    const rest = o.id.startsWith(ACTIVITY_BASE) ? o.id.slice(ACTIVITY_BASE.length) : null;
    const slash = rest ? rest.indexOf('/') : -1;
    if (!rest || slash < 1 || !OBJ_ID.test(rest.slice(slash + 1))) err('object.id', 'object_iri');
    else {
      const ty = rest.slice(0, slash);
      if (!(OBJECT_TYPES as readonly string[]).includes(ty)) err('object.id', 'object_kind');
      else { otype = ty as ObjectType; oid = rest.slice(slash + 1); }
    }
    const def = o.definition;
    if (def !== undefined) {
      if (!isObj(def)) err('object.definition', 'name_format');
      else {
        if (def.name !== undefined && !isLangMap(def.name)) err('object.definition.name', 'name_format');
        if (def.type !== undefined && (typeof def.type !== 'string' || !IRI.test(def.type))) err('object.definition.type', 'object_iri');
        for (const k of Object.keys(def).sort()) if (!['name', 'type', 'description'].includes(k)) err(`object.definition.${k}`, 'unknown_field');
        if (def.description !== undefined && !isLangMap(def.description)) err('object.definition.description', 'name_format');
        if (isObj(def.name)) {
          const n = def.name as Record<string, string>;
          const en = n['en-US'] ?? n.en ?? n['en-GB'];
          const ar = n['ar-AE'] ?? n.ar;
          oname = { ...(en ? { en } : {}), ...(ar ? { ar } : {}) };
        }
      }
    }
    for (const k of Object.keys(o).sort()) if (!['objectType', 'id', 'definition'].includes(k)) err(`object.${k}`, 'unknown_field');
  }
  // result: no free-text response; score within range
  const r = input.result;
  if (r !== undefined) {
    if (!isObj(r)) err('result', 'result_format');
    else {
      if (r.response !== undefined) err('result.response', 'response_not_allowed');
      for (const k of ['success', 'completion']) if (r[k] !== undefined && typeof r[k] !== 'boolean') err(`result.${k}`, 'bool_format');
      if (r.duration !== undefined && (typeof r.duration !== 'string' || !DURATION.test(r.duration))) err('result.duration', 'duration_format');
      if (r.score !== undefined) {
        const sc = r.score;
        const num = (x: unknown) => x === undefined || typeof x === 'number';
        if (!isObj(sc) || !num(sc.scaled) || !num(sc.raw) || !num(sc.min) || !num(sc.max)) err('result.score', 'score_range');
        else {
          const { scaled, raw, min, max } = sc as Record<string, number | undefined>;
          if ((scaled !== undefined && (scaled < -1 || scaled > 1)) || (min !== undefined && max !== undefined && min > max) || (raw !== undefined && ((min !== undefined && raw < min) || (max !== undefined && raw > max)))) err('result.score', 'score_range');
          for (const k of Object.keys(sc).sort()) if (!['scaled', 'raw', 'min', 'max'].includes(k)) err(`result.score.${k}`, 'unknown_field');
        }
      }
      if (r.extensions !== undefined && (!isObj(r.extensions) || Object.keys(r.extensions).some((k) => !IRI.test(k)))) err('result.extensions', 'extension_key');
      for (const k of Object.keys(r).sort()) if (!['success', 'completion', 'duration', 'score', 'extensions', 'response'].includes(k)) err(`result.${k}`, 'unknown_field');
    }
  }
  // context: registration, platform, language, extensions only (no instructor or team: they would name people)
  const c = input.context;
  if (c !== undefined) {
    if (!isObj(c)) err('context', 'context_format');
    else {
      if (c.registration !== undefined && (typeof c.registration !== 'string' || !UUID.test(c.registration))) err('context.registration', 'registration_format');
      for (const k of ['platform', 'language']) if (c[k] !== undefined && (typeof c[k] !== 'string' || (c[k] as string).length > 40)) err(`context.${k}`, 'context_format');
      if (c.extensions !== undefined && (!isObj(c.extensions) || Object.keys(c.extensions).some((k) => !IRI.test(k)))) err('context.extensions', 'extension_key');
      for (const k of Object.keys(c).sort()) if (!['registration', 'platform', 'language', 'extensions'].includes(k)) err(`context.${k}`, 'unknown_field');
    }
  }
  // timestamp and version
  let occurred: string | null = null;
  if (input.timestamp !== undefined) {
    if (typeof input.timestamp !== 'string' || !TS.test(input.timestamp) || Number.isNaN(Date.parse(input.timestamp))) err('timestamp', 'timestamp_format');
    else if (Date.parse(input.timestamp) > env.now.getTime() + 24 * 3600 * 1000) err('timestamp', 'timestamp_future');
    else occurred = isoTs(input.timestamp);
  }
  if (input.version !== undefined && (typeof input.version !== 'string' || !/^(2\.0(\.\d+)?|1\.0(\.\d+)?)$/.test(input.version))) err('version', 'version_unsupported');
  // secure assessment content: no secure item id anywhere in the statement (object or any text)
  if (otype && env.secureItemIds.includes(oid)) err('object.id', 'secure_content');
  else if (env.secureItemIds.some((id) => containsId(text, id))) err('$', 'secure_content');
  if (errors.length || !verb || !otype) return { errors, mapped: null };
  const ctxIn = isObj(c) ? c : {};
  const context: Record<string, unknown> = {};
  for (const k of ['registration', 'language', 'extensions']) if (ctxIn[k] !== undefined) context[k] = ctxIn[k];
  return {
    errors,
    mapped: {
      id: typeof input.id === 'string' ? input.id : null, actor_person_id: actor, verb, object_type: otype, object_id: oid, object_name: oname,
      result: isObj(r) ? (r as Record<string, unknown>) : null, context, occurred_at: occurred,
    },
  };
}

// ───────────── reading helpers for pages
export function durationMinutes(d: unknown): number {
  if (typeof d !== 'string') return 0;
  const m = d.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const [, dd, hh, mm, ss] = m.map((x) => (x ? Number(x) : 0));
  return Math.round(dd * 8 * 60 + hh * 60 + mm + ss / 60); // a working day counts 8 hours
}
export interface LearningSummary { statements: number; completions: number; minutes: number; bySource: Record<string, number>; byVerb: Record<string, number>; byMonth: Record<string, number>; first: string | null; last: string | null }
export function summarise(rows: Pick<StatementRow, 'verb' | 'source' | 'result' | 'occurred_at'>[]): LearningSummary {
  const out: LearningSummary = { statements: rows.length, completions: 0, minutes: 0, bySource: {}, byVerb: {}, byMonth: {}, first: null, last: null };
  for (const r of rows) {
    if (r.verb === 'completed' || r.verb === 'passed') out.completions++;
    out.minutes += durationMinutes((r.result as Record<string, unknown> | null)?.duration);
    out.bySource[r.source] = (out.bySource[r.source] ?? 0) + 1;
    out.byVerb[r.verb] = (out.byVerb[r.verb] ?? 0) + 1;
    const mo = isoTs(r.occurred_at).slice(0, 7);
    out.byMonth[mo] = (out.byMonth[mo] ?? 0) + 1;
    if (!out.first || ms(r.occurred_at) < ms(out.first)) out.first = r.occurred_at;
    if (!out.last || ms(r.occurred_at) > ms(out.last)) out.last = r.occurred_at;
  }
  return out;
}

/** The refusal message for schema errors (same text as kafaa_store_statement): the first three errors by path and code. */
export function schemaErrorMessage(errors: SchemaError[]): string {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const first = [...errors].sort((a, b) => cmp(a.path, b.path) || cmp(a.code, b.code)).slice(0, 3).map((e) => `${e.path}: ${e.code}`).join('; ');
  return `Statement does not match the Kafa'a xAPI 2.0 profile (${errors.length} error(s)): ${first}`;
}

// ───────────── analytics aggregate (SQL mirror: kafaa_lrs_aggregate): a cell shows only when it covers `min` or more people
export interface LrsCell { dim: 'month' | 'verb' | 'source' | 'type' | 'month_verb'; key: string; key2: string | null; statements: number | null; actors: number | null; suppressed: boolean }
export interface LrsTop { object_type: ObjectType; object_id: string; name_en: string | null; name_ar: string | null; statements: number; actors: number }
export interface LrsAggregate { min_group: number; statements: number; actors: number | null; cells: LrsCell[]; top: LrsTop[] }
const cmpS = (a: string, c: string) => (a < c ? -1 : a > c ? 1 : 0);
export function lrsAggregateOf(rows: StatementRow[], min: number): LrsAggregate {
  const groups = new Map<string, { dim: LrsCell['dim']; key: string; key2: string | null; n: number; people: Set<string> }>();
  const add = (dim: LrsCell['dim'], key: string, key2: string | null, s: StatementRow) => {
    const k = `${dim}\u0000${key}\u0000${key2 ?? ''}`;
    const g = groups.get(k) ?? groups.set(k, { dim, key, key2, n: 0, people: new Set() }).get(k)!;
    g.n++;
    g.people.add(s.actor_person_id);
  };
  const objects = new Map<string, { object_type: StatementRow['object_type']; object_id: string; en: string | null; ar: string | null; n: number; people: Set<string> }>();
  const maxS = (a: string | null, v: unknown) => (typeof v !== 'string' ? a : a == null || v > a ? v : a);
  const actors = new Set<string>();
  for (const s of rows) {
    const month = isoTs(s.occurred_at).slice(0, 7);
    actors.add(s.actor_person_id);
    add('month', month, null, s);
    add('verb', s.verb, null, s);
    add('source', s.source, null, s);
    add('type', s.object_type, null, s);
    add('month_verb', month, s.verb, s);
    const ok = `${s.object_type}\u0000${s.object_id}`;
    const o = objects.get(ok) ?? objects.set(ok, { object_type: s.object_type, object_id: s.object_id, en: null, ar: null, n: 0, people: new Set() }).get(ok)!;
    const nm = (s.object_name ?? {}) as Record<string, unknown>;
    o.en = maxS(o.en, nm.en);
    o.ar = maxS(o.ar, nm.ar);
    o.n++;
    o.people.add(s.actor_person_id);
  }
  const cells: LrsCell[] = [...groups.values()]
    .sort((a, c) => cmpS(a.dim, c.dim) || cmpS(a.key, c.key) || (a.key2 == null ? (c.key2 == null ? 0 : 1) : c.key2 == null ? -1 : cmpS(a.key2, c.key2)))
    .map((g) => {
      const sup = g.people.size < min;
      return { dim: g.dim, key: g.key, key2: g.key2, statements: sup ? null : g.n, actors: sup ? null : g.people.size, suppressed: sup };
    });
  const top: LrsTop[] = [...objects.values()]
    .filter((o) => o.people.size >= min)
    .sort((a, c) => c.people.size - a.people.size || c.n - a.n || cmpS(a.object_type, c.object_type) || cmpS(a.object_id, c.object_id))
    .slice(0, 12)
    .map((o) => ({ object_type: o.object_type, object_id: o.object_id, name_en: o.en, name_ar: o.ar, statements: o.n, actors: o.people.size }));
  return { min_group: min, statements: rows.length, actors: actors.size < min ? null : actors.size, cells, top };
}
