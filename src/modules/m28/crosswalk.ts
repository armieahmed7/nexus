// FS08 (future skills, wave B · E1, M28) · International crosswalk and machine-readable framework export: pure rules.
// Import-free (seed builders, the PGlite validator and both backends load it). The SQL mirror is kafaa_al_check in
// supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql: the same checks in the same order, the same codes.
//
//  - An alignment links one Kafa'a skill to one external framework entry (ESCO, O*NET, SFIA 9, SkillsFuture, DigComp, UNESCO AI,
//    GreenComp, NICE, IAEA, UAE NQF, Lightcast) with a match type (exact, close, broad, partial), a level map, a source URL and an
//    as-of date. External codes are stored only when copied from the source; otherwise the row is label-level ("code pending review").
//  - Rows nobody has reviewed yet are "indicative" (shown in EN and AR); a reviewer must not be the last editor (maker-checker).
//  - The export is CASE-shaped (1EdTech Competencies and Academic Standards Exchange): CFDocument, CFItems, CFAssociations,
//    CFDefinitions, with deterministic UUIDs so the same catalogue always exports the same identifiers.

export const FRAMEWORK_IDS = ['esco', 'onet', 'sfia9', 'skillsfuture', 'digcomp', 'unesco_ai', 'greencomp', 'nice', 'iaea', 'uae_nqf', 'lightcast'] as const;
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];
export const MATCH_TYPES = ['exact', 'close', 'broad', 'partial'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
/** Strength of a match, used for sorting and for the "strongest match" of a skill. */
export const MATCH_RANK: Record<MatchType, number> = { exact: 4, close: 3, broad: 2, partial: 1 };
export const ALIGN_STATUSES = ['draft', 'published', 'retired'] as const;
export type AlignStatus = (typeof ALIGN_STATUSES)[number];

/** Code formats for frameworks whose codes we copy (POSIX-compatible: the SQL check uses the same patterns with ~). */
export const CODE_PATTERNS: Partial<Record<FrameworkId, string>> = {
  esco: '^http://data\\.europa\\.eu/esco/skill/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  onet: '^[1-7]\\.[A-Z](\\.[0-9a-z]+){0,3}$',
  sfia9: '^[A-Z]{4}$',
  digcomp: '^[1-5]\\.[1-6]$',
};
/** Any other framework: a short code made of letters, digits and . : / _ - (or no code at all: label-level). */
export const GENERIC_CODE = '^[A-Za-z0-9.:/_-]{1,64}$';
export const LABEL_MAX = 200;
export const NOTE_MAX = 500;
export const LEVEL_TEXT_MAX = 40;
export const REASON_MIN = 5;
export const REASON_MAX = 300;
export const HTTPS = '^https://[^[:space:]/$.?#][^[:space:]]*$';
const HTTPS_JS = /^https:\/\/[^\s/$.?#][^\s]*$/;

export const AL_MSG = {
  not_signed_in: 'Sign in to edit the skills crosswalk',
  forbidden: 'Only framework owners (instructors, the training manager and admins) edit the skills crosswalk',
  not_found: 'Alignment not found',
  skill_not_found: 'Skill not found',
  obsolete: 'This skill is obsolete: keep its existing alignments, but do not add new ones',
  framework: 'Choose one of the listed frameworks',
  label: 'Give the external label in English and Arabic (up to 200 characters each)',
  match: 'Choose a match type: exact, close, broad or partial',
  code: 'This code does not have the format the framework publishes. Leave it empty if you have not copied it from the source',
  url: 'Cite the source with an https link',
  as_of: 'Give the date you read the source (not in the future)',
  level_map: 'The level map takes Kafa\'a levels 1 to 4, each with a short external level (up to 40 characters)',
  note: 'Keep notes under 500 characters',
  duplicate: 'This skill already has an active alignment to that framework entry',
  immutable: 'The skill and framework of an alignment cannot change: retire it and add a new one',
  retired: 'This alignment is retired: add a new one instead',
  not_published: 'Publish the alignment before it is reviewed',
  already_reviewed: 'This alignment is already reviewed',
  maker_checker: 'A reviewer cannot review their own edit: ask another framework owner',
  reason: 'Give a reason of 5 to 300 characters',
} as const;
export type AlCode = keyof typeof AL_MSG | 'ok';

export interface AlignmentInput {
  id?: string | null;
  skill_id?: string;
  framework?: string;
  external_code?: string | null;
  label_en?: string;
  label_ar?: string;
  label_ar_official?: boolean;
  match_type?: string;
  level_map?: unknown;
  note_en?: string;
  note_ar?: string;
  source_url?: string;
  as_of?: string;
  publish?: boolean;
}
export interface AlignmentRow {
  id: string;
  skill_id: string;
  framework: string;
  external_code?: string | null;
  label_en: string;
  label_ar: string;
  label_ar_official?: boolean;
  external_meta?: unknown;
  match_type: string;
  level_map?: unknown;
  note_en?: string;
  note_ar?: string;
  source_url: string;
  as_of: string;
  status: string;
  listed?: boolean;
  reviewed_by?: string | null;
  reviewed_role?: string | null;
  reviewed_on?: string | null;
  version?: number;
  updated_by?: string | null;
  retired_reason?: string | null;
  sort?: number;
}
export interface CheckCtx {
  /** id -> { lifecycle } of every skill */
  skills: Map<string, { lifecycle: string }>;
  /** framework ids in the registry */
  frameworks: Set<string>;
  /** existing alignments (for the duplicate check) */
  rows: { id: string; skill_id: string; framework: string; external_code?: string | null; label_en: string; status: string }[];
  today: string;
}

const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
const isDate = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) && new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) === x;

/** Valid level map: a plain object with keys among "1".."4" and short non-empty string values. Empty object = no level map. */
export function validLevelMap(m: unknown): boolean {
  if (m == null) return true;
  if (typeof m !== 'object' || Array.isArray(m)) return false;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (!['1', '2', '3', '4'].includes(k)) return false;
    if (typeof v !== 'string' || !v.trim() || v.trim().length > LEVEL_TEXT_MAX) return false;
  }
  return true;
}
/** Canonical level map: trimmed values, keys in order. */
export function canonLevelMap(m: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!m || typeof m !== 'object') return out;
  for (const k of ['1', '2', '3', '4']) {
    const v = (m as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}
export function codeOk(framework: string, code: string | null | undefined): boolean {
  const c = s(code);
  if (!c) return true;
  const p = CODE_PATTERNS[framework as FrameworkId] ?? GENERIC_CODE;
  return new RegExp(p).test(c);
}
/** The duplicate key of an alignment: skill + framework + (code, else lower-case English label). */
export const dupKey = (r: { skill_id: string; framework: string; external_code?: string | null; label_en: string }) =>
  `${r.skill_id}|${r.framework}|${s(r.external_code) || `label:${s(r.label_en).toLowerCase()}`}`;

/**
 * Checks a saveAlignment input. Returns 'ok' or the first failing code (same order as SQL kafaa_al_check).
 * `existing` is the stored row when the input edits one.
 */
export function checkAlignment(input: AlignmentInput, ctx: CheckCtx, existing?: { skill_id: string; framework: string; status: string } | null): AlCode {
  const skillId = s(input.skill_id);
  const fw = s(input.framework);
  if (existing) {
    if (existing.status === 'retired') return 'retired';
    if (skillId !== existing.skill_id || fw !== existing.framework) return 'immutable';
  }
  const sk = ctx.skills.get(skillId);
  if (!sk) return 'skill_not_found';
  if (!existing && sk.lifecycle === 'obsolete') return 'obsolete';
  if (!ctx.frameworks.has(fw)) return 'framework';
  const en = s(input.label_en);
  const ar = s(input.label_ar);
  if (!en || !ar || en.length > LABEL_MAX || ar.length > LABEL_MAX) return 'label';
  if (!(MATCH_TYPES as readonly string[]).includes(s(input.match_type))) return 'match';
  if (!codeOk(fw, input.external_code)) return 'code';
  if (!HTTPS_JS.test(s(input.source_url))) return 'url';
  const asOf = s(input.as_of);
  if (!isDate(asOf) || asOf > ctx.today || asOf < '2000-01-01') return 'as_of';
  if (!validLevelMap(input.level_map)) return 'level_map';
  if (s(input.note_en).length > NOTE_MAX || s(input.note_ar).length > NOTE_MAX) return 'note';
  const key = dupKey({ skill_id: skillId, framework: fw, external_code: input.external_code, label_en: en });
  if (ctx.rows.some((r) => r.status !== 'retired' && r.id !== (input.id ?? '') && dupKey(r) === key)) return 'duplicate';
  return 'ok';
}

/** Indicative = not yet reviewed by a framework owner (shown as "indicative" in EN and AR). */
export const isIndicative = (r: { reviewed_by?: string | null }) => !r.reviewed_by;
/** Label-level = no external code copied from the source yet ("code pending review"). */
export const isLabelLevel = (r: { external_code?: string | null }) => !s(r.external_code);
/** Short display form of a code: the last URI segment for ESCO concept URIs (first 8 characters), else the code. */
export function shortCode(code: string | null | undefined): string {
  const c = s(code);
  if (!c) return '';
  if (c.startsWith('http')) return c.split('/').pop()!.slice(0, 8);
  return c;
}
export function sortAlignments<T extends { framework: string; match_type: string; label_en: string }>(rows: T[], order: readonly string[] = FRAMEWORK_IDS): T[] {
  const fi = (f: string) => { const i = order.indexOf(f); return i < 0 ? 99 : i; };
  return [...rows].sort((a, b) => fi(a.framework) - fi(b.framework) || (MATCH_RANK[b.match_type as MatchType] ?? 0) - (MATCH_RANK[a.match_type as MatchType] ?? 0) || (a.label_en < b.label_en ? -1 : a.label_en > b.label_en ? 1 : 0));
}

// ───────────── Coverage

export interface CoverageSkill { id: string; area: string; fs_area?: string | null; lifecycle: string }
export interface CoverageCell { n: number; total: number; pct: number }
/** Share of (non-obsolete) skills with at least one published alignment: overall, per framework, and framework x area. */
export function coverage(skills: CoverageSkill[], rows: { skill_id: string; framework: string; status: string }[], frameworks: readonly string[], areaOf: (s: CoverageSkill) => string = (x) => x.area) {
  const live = skills.filter((x) => x.lifecycle !== 'obsolete');
  const pub = rows.filter((r) => r.status === 'published');
  const has = new Map<string, Set<string>>();
  for (const r of pub) { if (!has.has(r.framework)) has.set(r.framework, new Set()); has.get(r.framework)!.add(r.skill_id); }
  const any = new Set(pub.map((r) => r.skill_id));
  const areas = [...new Set(live.map(areaOf))];
  const cell = (fw: string | null, area: string | null): CoverageCell => {
    const pool = live.filter((x) => area == null || areaOf(x) === area);
    const n = pool.filter((x) => (fw == null ? any.has(x.id) : has.get(fw)?.has(x.id))).length;
    return { n, total: pool.length, pct: pool.length ? Math.round((n / pool.length) * 1000) / 10 : 0 };
  };
  return {
    overall: cell(null, null),
    byFramework: Object.fromEntries(frameworks.map((f) => [f, cell(f, null)])) as Record<string, CoverageCell>,
    matrix: Object.fromEntries(frameworks.map((f) => [f, Object.fromEntries(areas.map((a) => [a, cell(f, a)]))])) as Record<string, Record<string, CoverageCell>>,
    byArea: Object.fromEntries(areas.map((a) => [a, cell(null, a)])) as Record<string, CoverageCell>,
    areas,
    unmapped: live.filter((x) => !any.has(x.id)).map((x) => x.id),
    emptyFrameworks: frameworks.filter((f) => !has.get(f)?.size),
  };
}

// ───────────── Deterministic identifiers (UUID-shaped, version 8 = custom, RFC 9562)

function h32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d);
  return (h ^ (h >>> 16)) >>> 0;
}
/** A stable UUID for a name: the same catalogue always exports the same CASE identifiers. */
export function stableUuid(name: string): string {
  const hex = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f].map((sd) => h32(name, sd).toString(16).padStart(8, '0')).join('');
  const v = `${hex.slice(0, 12)}8${hex.slice(13, 16)}${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 32)}`;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

// ───────────── CASE-shaped export (1EdTech CASE 1.0 package)

export interface ExportSkill {
  id: string; code: string; name_en: string; name_ar: string; area: string; fs_area?: string | null; lifecycle: string;
  description_en?: string; description_ar?: string; level_essence_en?: string; level_essence_ar?: string; key_level?: number;
  alt_labels_en?: string[] | null; alt_labels_ar?: string[] | null; reusability?: string; skill_type?: string; version?: number;
  obsolete_on?: string | null; replaced_by?: string | null; sort?: number;
}
export interface ExportFramework { id: string; name_en: string; name_ar: string; url: string }
export interface ExportOpts { lang: 'en' | 'ar'; generatedAt: string; baseUri: string; areaLabel: (area: string, lang: 'en' | 'ar') => string; version: string }

const ASSOC_FOR: Record<MatchType, string> = { exact: 'exactMatchOf', close: 'isRelatedTo', broad: 'isRelatedTo', partial: 'isRelatedTo' };

export function buildCasePackage(skills: ExportSkill[], rows: AlignmentRow[], frameworks: ExportFramework[], o: ExportOpts) {
  const L = (en: string | undefined, ar: string | undefined) => (o.lang === 'ar' ? (ar || en || '') : (en || ''));
  const docId = stableUuid('kafaa:skills-framework');
  const docUri = `${o.baseUri}/CFDocuments/${docId}`;
  const docRef = { title: o.lang === 'ar' ? 'إطار مهارات كفاءة' : "Kafa'a skills framework", identifier: docId, uri: docUri };
  const itemUri = (id: string) => `${o.baseUri}/CFItems/${id}`;
  const node = (title: string, identifier: string, uri: string) => ({ title, identifier, uri });
  const pub = rows.filter((r) => r.status === 'published');
  const areas = [...new Set(skills.map((x) => x.area))];
  const areaItems = areas.map((a, i) => {
    const identifier = stableUuid(`kafaa:area:${a}`);
    return { identifier, uri: itemUri(identifier), CFDocumentURI: docRef, fullStatement: o.areaLabel(a, o.lang), humanCodingScheme: a, listEnumeration: String(i + 1), CFItemType: 'Skill area', language: o.lang, lastChangeDateTime: o.generatedAt };
  });
  const areaId = new Map(areas.map((a, i) => [a, areaItems[i]]));
  const skillItems = [...skills].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.code < b.code ? -1 : 1)).map((x, i) => {
    const identifier = stableUuid(`kafaa:skill:${x.id}`);
    const item: Record<string, unknown> = {
      identifier, uri: itemUri(identifier), CFDocumentURI: docRef, fullStatement: L(x.name_en, x.name_ar), abbreviatedStatement: x.code,
      humanCodingScheme: x.code, listEnumeration: String(i + 1), CFItemType: 'Skill', language: o.lang, lastChangeDateTime: o.generatedAt,
      notes: L(x.level_essence_en, x.level_essence_ar), conceptKeywords: [x.area, ...(x.fs_area ? [x.fs_area] : []), x.reusability ?? '', x.skill_type ?? ''].filter(Boolean),
    };
    const alt = (o.lang === 'ar' ? x.alt_labels_ar : x.alt_labels_en) ?? [];
    if (alt.length) item.alternativeLabel = alt.join('; ');
    if (x.lifecycle === 'obsolete' && x.obsolete_on) item.statusEndDate = x.obsolete_on;
    return item;
  });
  const skillItem = new Map(skills.map((x) => [x.id, skillItems.find((it) => it.humanCodingScheme === x.code)!]));
  const groupings = frameworks.map((f) => ({ identifier: stableUuid(`kafaa:fw:${f.id}`), uri: `${o.baseUri}/CFAssociationGroupings/${stableUuid(`kafaa:fw:${f.id}`)}`, title: L(f.name_en, f.name_ar), description: f.url, lastChangeDateTime: o.generatedAt }));
  const grouping = new Map(frameworks.map((f, i) => [f.id, groupings[i]]));
  const assoc: Record<string, unknown>[] = [];
  let seq = 0;
  for (const x of skills) {
    const it = skillItem.get(x.id)!;
    const ar = areaId.get(x.area)!;
    const id = stableUuid(`kafaa:child:${x.id}`);
    assoc.push({ identifier: id, uri: `${o.baseUri}/CFAssociations/${id}`, associationType: 'isChildOf', CFDocumentURI: docRef, sequenceNumber: ++seq, lastChangeDateTime: o.generatedAt,
      originNodeURI: node(String(it.fullStatement), String(it.identifier), String(it.uri)), destinationNodeURI: node(String(ar.fullStatement), ar.identifier, ar.uri) });
    if (x.replaced_by && skillItem.get(x.replaced_by)) {
      const to = skillItem.get(x.replaced_by)!;
      const rid = stableUuid(`kafaa:replaced:${x.id}`);
      assoc.push({ identifier: rid, uri: `${o.baseUri}/CFAssociations/${rid}`, associationType: 'replacedBy', CFDocumentURI: docRef, sequenceNumber: ++seq, lastChangeDateTime: o.generatedAt,
        originNodeURI: node(String(it.fullStatement), String(it.identifier), String(it.uri)), destinationNodeURI: node(String(to.fullStatement), String(to.identifier), String(to.uri)) });
    }
  }
  for (const r of sortAlignments(pub)) {
    const it = skillItem.get(r.skill_id);
    const g = grouping.get(r.framework);
    if (!it || !g) continue;
    const id = stableUuid(`kafaa:al:${r.id}`);
    const extUri = r.external_code && /^https?:\/\//.test(r.external_code) ? r.external_code : r.source_url;
    const extId = r.external_code ? (r.external_code.startsWith('http') ? r.external_code.split('/').pop()! : `${r.framework}:${r.external_code}`) : `${r.framework}:pending:${stableUuid(r.id)}`;
    assoc.push({
      identifier: id, uri: `${o.baseUri}/CFAssociations/${id}`, associationType: ASSOC_FOR[r.match_type as MatchType] ?? 'isRelatedTo', CFDocumentURI: docRef, sequenceNumber: ++seq,
      lastChangeDateTime: o.generatedAt, CFAssociationGroupingURI: { title: g.title, identifier: g.identifier, uri: g.uri },
      originNodeURI: node(String(it.fullStatement), String(it.identifier), String(it.uri)),
      destinationNodeURI: node(L(r.label_en, r.label_ar), extId, extUri),
      notes: `match=${r.match_type}; ${isIndicative(r) ? 'indicative' : 'reviewed'}; ${isLabelLevel(r) ? 'code pending review' : `code=${r.external_code}`}; source=${r.source_url}; as_of=${r.as_of}`,
    });
  }
  return {
    CFDocument: {
      identifier: docId, uri: docUri, creator: "Kafa'a (ENEC NEXUS concept)", publisher: "Kafa'a", title: docRef.title,
      description: o.lang === 'ar' ? 'كتالوج المهارات المنشور مع مستويات الإلمام وروابط المطابقة مع الأطر الدولية (مفهوم تجريبي، بيانات اصطناعية أو عامة).' : 'The published skills catalogue with level essences and crosswalk links to international frameworks (concept demo; synthetic or public data).',
      language: o.lang, version: o.version, adoptionStatus: 'Draft', lastChangeDateTime: o.generatedAt, officialSourceURL: `${o.baseUri}/skills/frameworks`,
      subject: ['Skills', 'Nuclear energy', 'Future skills'],
    },
    CFItems: [...areaItems, ...skillItems],
    CFAssociations: assoc,
    CFDefinitions: {
      CFItemTypes: ['Skill area', 'Skill'].map((t) => ({ identifier: stableUuid(`kafaa:type:${t}`), uri: `${o.baseUri}/CFItemTypes/${stableUuid(`kafaa:type:${t}`)}`, title: t, description: t, hierarchyCode: t === 'Skill' ? '2' : '1', lastChangeDateTime: o.generatedAt })),
      CFAssociationGroupings: groupings,
    },
  };
}

// ───────────── The CASE-shaped JSON schema the export must validate against (subset of 1EdTech CASE 1.0 CFPackage)

const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const DT = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$';
const LINK = { type: 'object', required: ['title', 'identifier', 'uri'], properties: { title: { type: 'string', minLength: 1 }, identifier: { type: 'string', minLength: 1 }, uri: { type: 'string', minLength: 1 } } };
export const CASE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CASE-shaped CFPackage (Kafa\'a skills framework export)',
  type: 'object',
  required: ['CFDocument', 'CFItems', 'CFAssociations', 'CFDefinitions'],
  properties: {
    CFDocument: {
      type: 'object', required: ['identifier', 'uri', 'creator', 'title', 'lastChangeDateTime'],
      properties: { identifier: { type: 'string', pattern: UUID }, uri: { type: 'string' }, creator: { type: 'string', minLength: 1 }, title: { type: 'string', minLength: 1 }, lastChangeDateTime: { type: 'string', pattern: DT }, language: { type: 'string', enum: ['en', 'ar'] }, adoptionStatus: { type: 'string' }, subject: { type: 'array', items: { type: 'string' } } },
    },
    CFItems: {
      type: 'array', minItems: 1,
      items: { type: 'object', required: ['identifier', 'uri', 'fullStatement', 'CFDocumentURI', 'lastChangeDateTime'], properties: { identifier: { type: 'string', pattern: UUID }, uri: { type: 'string' }, fullStatement: { type: 'string', minLength: 1 }, humanCodingScheme: { type: 'string' }, CFItemType: { type: 'string' }, CFDocumentURI: LINK, lastChangeDateTime: { type: 'string', pattern: DT }, conceptKeywords: { type: 'array', items: { type: 'string' } }, statusEndDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } },
    },
    CFAssociations: {
      type: 'array',
      items: {
        type: 'object', required: ['identifier', 'uri', 'associationType', 'originNodeURI', 'destinationNodeURI', 'lastChangeDateTime'],
        properties: {
          identifier: { type: 'string', pattern: UUID }, uri: { type: 'string' },
          associationType: { type: 'string', enum: ['isChildOf', 'isPeerOf', 'isPartOf', 'exactMatchOf', 'precedes', 'isRelatedTo', 'replacedBy', 'exemplar', 'hasSkillLevel'] },
          originNodeURI: LINK, destinationNodeURI: LINK, CFDocumentURI: LINK, CFAssociationGroupingURI: LINK, lastChangeDateTime: { type: 'string', pattern: DT }, sequenceNumber: { type: 'integer' },
        },
      },
    },
    CFDefinitions: {
      type: 'object',
      properties: {
        CFItemTypes: { type: 'array', items: { type: 'object', required: ['identifier', 'uri', 'title'], properties: { identifier: { type: 'string', pattern: UUID } } } },
        CFAssociationGroupings: { type: 'array', items: { type: 'object', required: ['identifier', 'uri', 'title'], properties: { identifier: { type: 'string', pattern: UUID } } } },
      },
    },
  },
} as const;

/** A small JSON-schema validator (type, required, properties, items, enum, pattern, minItems, minLength). Returns error paths. */
export function validateJson(schema: unknown, data: unknown, path = '$'): string[] {
  const sc = schema as Record<string, unknown>;
  const errs: string[] = [];
  const type = sc.type as string | undefined;
  const t = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data === 'number' && Number.isInteger(data) ? 'integer' : typeof data;
  if (type && !(type === t || (type === 'number' && t === 'integer'))) return [`${path}: expected ${type}, got ${t}`];
  if (sc.enum && !(sc.enum as unknown[]).includes(data)) errs.push(`${path}: not in enum`);
  if (typeof data === 'string') {
    if (typeof sc.minLength === 'number' && data.length < sc.minLength) errs.push(`${path}: too short`);
    if (typeof sc.pattern === 'string' && !new RegExp(sc.pattern).test(data)) errs.push(`${path}: does not match ${sc.pattern}`);
  }
  if (Array.isArray(data)) {
    if (typeof sc.minItems === 'number' && data.length < sc.minItems) errs.push(`${path}: fewer than ${sc.minItems} items`);
    if (sc.items) data.forEach((x, i) => errs.push(...validateJson(sc.items, x, `${path}[${i}]`)));
  }
  if (t === 'object' && data) {
    for (const k of (sc.required as string[] | undefined) ?? []) if (!(k in (data as object))) errs.push(`${path}.${k}: required`);
    for (const [k, sub] of Object.entries((sc.properties as Record<string, unknown>) ?? {})) if (k in (data as object)) errs.push(...validateJson(sub, (data as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return errs;
}

// ───────────── CSV export

const csvCell = (v: unknown) => {
  const x = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};
export const CSV_COLUMNS = ['skill_code', 'skill_id', 'skill_name_en', 'skill_name_ar', 'framework', 'external_code', 'external_label_en', 'external_label_ar', 'match_type', 'review_state', 'level_map', 'source_url', 'as_of'] as const;
/** CSV (UTF-8 with BOM, so Arabic opens correctly in spreadsheets) of the published alignments. */
export function alignmentsCsv(skills: { id: string; code: string; name_en: string; name_ar: string }[], rows: AlignmentRow[]): string {
  const by = new Map(skills.map((x) => [x.id, x]));
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of sortAlignments(rows.filter((x) => x.status === 'published'))) {
    const sk = by.get(r.skill_id);
    if (!sk) continue;
    lines.push([sk.code, sk.id, sk.name_en, sk.name_ar, r.framework, r.external_code ?? '', r.label_en, r.label_ar, r.match_type, isIndicative(r) ? 'indicative' : 'reviewed', canonLevelMap(r.level_map), r.source_url, r.as_of].map(csvCell).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** The Result code a failing check returns (SQL kafaa_al_result_code is the same map). */
export function alResultCode(c: AlCode): string {
  switch (c) {
    case 'skill_not_found': return 'not_found';
    case 'duplicate': return 'conflict';
    case 'retired': return 'retired';
    case 'obsolete': return 'obsolete';
    default: return 'invalid';
  }
}

// ───────────── FS07 skill goals ("Add to my goals"; SQL kafaa_set_skill_goal uses the same messages)

export const GOAL_MAX_ACTIVE = 12;
export const GOAL_MSG = {
  not_signed_in: 'Sign in to keep skill goals',
  forbidden: 'Skill goals are for staff with a skills passport',
  not_found: 'Skill not found',
  restricted: 'Security skills are not personal goals: they follow the security career path',
  obsolete: 'This skill is obsolete: choose its replacement instead',
  invalid: 'Choose a target level from 1 to 4',
  limit: 'You can keep up to 12 active skill goals: remove one first',
  no_change: 'This skill is not on your goals',
} as const;
