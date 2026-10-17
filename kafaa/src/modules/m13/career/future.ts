/**
 * FS76 Dalil future-skills mode: four intents answered from the future-skills features, deterministic and cited (no LLM).
 *   future.role_2030       FS11 transformRole (my role: the rpc.roleTransformation map with tasks; any other role: the same rule over
 *                          the published FS05 profiles) + FS05 concept profiles. Public answers use the map's public summary and no numbers.
 *   future.ai_rung         FS09 aiRung + targetGap over my own skill states (self-ratings never count) against my family's ai_role_targets.
 *   future.skill_crosswalk FS07 skill page + FS08 published crosswalk rows (sortAlignments, shortCode), "code pending review" for label rows.
 *   future.pathway_gap     FS17 rankPathways (the Learning Coach's ranking, with its reasons) over my 2030 gaps; F24 coach opt-out = unranked.
 * answerFuture() returns null when the question is not one of these, so the caller's engine (career mode: CareerEngine; every other mode:
 * RetrievalEngine) answers as before. The guards (concern stop, security, decision, injection) sit in front in GuardedEngine.
 * Personal answers are built only from the caller's own rows, which RLS returns (future.*.personal); an anonymous caller has no personal
 * context, so it only ever gets public content (future.*.public, future.*.general, future.*.sign_in). Intents switched off by the AI owner
 * (kafaa_dalil_intents.enabled = false) answer `future.<kind>.off`. Never an eligibility decision; 2030 content is a planning assumption.
 */
import { translate } from '../../../i18n';
import type { DalilCitation, Repository, Table } from '../../../data/types';
import { SCHEMA } from '../../../data/schema';
import { sharedList } from '../../../data/sharedReads';
import type { Reason } from '../../../domain/engines/types';
import { hasAny, normText, tokenize, type Lang } from '../dalil/text';
import type { AnswerCard, AskInput, DalilAnswer, DalilLink } from '../dalil/types';
import { aiRung, rungKey, targetGap, type RungCell } from '../../m29/fluency';
import { transformRole, type RoleMap } from '../../m30/transform';
import { rankPathways, pathwaySkillOk, type Requirement, type SkillRef, type PeerStats } from '../../m19/pathways';
import { conceptProfile, isConcept, reqsOfVersion } from '../../m18/futureRoles';
import { shortCode, sortAlignments } from '../../m28/crosswalk';
import { findRole } from './roles';
import { CHANGE_WORDS, COURSE_WORDS, FUTURE_INTENTS, FW_WORDS, GAP_CLOSE_WORDS, MEANING_WORDS, PATHWAY_WORDS, ROLE_WORDS, RUNG_WORDS, YEAR_WORDS, type FutureKind } from './futureIntents';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const say = (lang: Lang, key: string, vars?: Record<string, string | number>) => translate(lang, `m13.future.${key}`, vars);
const bi = (row: Row | undefined | null, k: string, lang: Lang) => (row ? String((lang === 'ar' ? row[`${k}_ar`] : row[`${k}_en`]) || row[`${k}_en`] || '') : '');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const RESTRICTED = ['security', 'safeguards', 'cyber'];

/** Public catalogue rows every caller may read (anonymous visitors included; pathways read as [] for them). */
export interface FuturePublic {
  roles: Row[]; transformations: Row[]; versions: Row[]; rungs: Row[]; tracks: Row[]; targets: Row[]; families: Row[];
  skills: Row[]; competencies: Row[]; alignments: Row[]; frameworks: Row[]; pathways: Row[]; courses: Row[]; intents: Row[];
}
/** The signed-in person's own rows (RLS returns nothing else). */
export interface FuturePersonal {
  personId: string; roleId: string | null; familyId: string | null; states: Row[]; goals: string[]; enrolled: Map<string, string>; weeklyGoal: number | null;
  /** rpc.roleTransformation() for my role (task counts included); null falls back to transformRole over the published profiles. */
  myMap: RoleMap | null;
  /** FS17 catalogue figures (requests, peers) by pathway id, when the RPC answered. */
  catalogue: Map<string, { requested: number; peer: PeerStats | null }>;
  optouts: Set<string>;
}
export interface FutureCtx { pub: FuturePublic; me: FuturePersonal | null }

export const FUTURE_PUBLIC_TABLES = ['role_transformations', 'role_profile_versions', 'ai_rungs', 'ai_skill_tracks', 'ai_role_targets', 'job_families', 'skills', 'competencies', 'skill_alignments',
  'skill_frameworks', 'pathways', 'courses', 'job_roles', 'dalil_intents'] as Table[];
export const FUTURE_PERSONAL_TABLES = ['person_skills', 'skill_goals', 'future_goals', 'pathway_enrolments', 'learning_goals', 'reco_optouts', 'role_transformations'] as Table[];

const has = (x: string) => Object.prototype.hasOwnProperty.call(SCHEMA, x);
const safe = (repo: Repository, tb: string, q?: object): Promise<Row[]> => (has(tb) ? (repo.list(tb as Table, q as never) as Promise<Row[]>).catch(() => []) : Promise.resolve([]));
/** TECH-07: public catalogues are read once per backend and persona (shared with Dalil's corpus and the header search). */
const safeShared = (repo: Repository, tb: string, q?: object): Promise<Row[]> => (has(tb) ? (sharedList(repo, tb as Table, q as never) as Promise<Row[]>).catch(() => []) : Promise.resolve([]));

/** Pure: the public part from seed-shaped tables (tests, the release-gate evaluation). Drafts and unlisted rows are left out as RLS would for the public. */
export function futurePublicFrom(t: Record<string, Row[] | undefined>, opts: { staff: boolean }): FuturePublic {
  const L = (k: string) => t[k] ?? [];
  return {
    roles: L('job_roles').filter((r) => r.status !== 'draft'),
    transformations: L('role_transformations').filter((r) => opts.staff || r.is_public),
    versions: L('role_profile_versions').filter((v) => v.status === 'published' && (opts.staff || v.is_public !== false)),
    rungs: L('ai_rungs'), tracks: L('ai_skill_tracks'), targets: L('ai_role_targets'), families: L('job_families'),
    skills: L('skills'), competencies: L('competencies'), alignments: L('skill_alignments').filter((a) => a.status === 'published' && a.listed !== false),
    frameworks: L('skill_frameworks'), pathways: opts.staff ? L('pathways').filter((p) => p.status === 'published' && p.listed) : [], courses: L('courses'), intents: L('dalil_intents'),
  };
}
/** Pure: the personal part from seed-shaped tables (tests, evaluation). Only the person's own rows are kept. */
export function futurePersonalFrom(t: Record<string, Row[] | undefined>, me: string, myMap: RoleMap | null = null): FuturePersonal | null {
  const person = (t.people ?? []).find((p) => p.id === me);
  if (!person) return null;
  const mine = (k: string) => (t[k] ?? []).filter((r) => r.person_id === me);
  const goals = [...mine('skill_goals').filter((g) => g.status !== 'removed').map((g) => String(g.skill_id)), ...mine('future_goals').filter((g) => g.status === 'active').flatMap((g) => (g.skill_ids ?? []) as string[])];
  const weekly = mine('learning_goals')[0]?.hours_per_week;
  return {
    personId: me, roleId: person.job_role_id ?? null, familyId: person.job_family_id ?? null, states: mine('person_skills').filter((s) => s.active !== false),
    goals: [...new Set(goals)].sort(cmp), enrolled: new Map(mine('pathway_enrolments').filter((e) => e.status !== 'withdrawn').map((e) => [String(e.pathway_id), String(e.status)])),
    weeklyGoal: weekly != null && Number(weekly) > 0 ? Number(weekly) : null, myMap, catalogue: new Map(), optouts: new Set(mine('reco_optouts').filter((o) => o.opted_out).map((o) => String(o.surface))),
  };
}

/** Through the repository (both backends; RLS applies): public catalogues for everyone, pathways only where the caller may read them. */
export async function loadFuturePublic(repo: Repository, staff: boolean): Promise<FuturePublic> {
  const names = ['job_roles', 'role_transformations', 'role_profile_versions', 'ai_rungs', 'ai_skill_tracks', 'ai_role_targets', 'job_families', 'skills', 'competencies', 'skill_alignments', 'skill_frameworks', 'pathways', 'courses', 'dalil_intents'];
  const rows = await Promise.all(names.map((n) => safeShared(repo, n, n === 'role_profile_versions' || n === 'skill_alignments' ? { filter: { status: 'published' } } : n === 'job_roles' ? { order: [['sort', 'asc']] } : undefined)));
  return futurePublicFrom(Object.fromEntries(names.map((n, i) => [n, rows[i]])), { staff });
}
export async function loadFuturePersonal(repo: Repository, me: string): Promise<FuturePersonal | null> {
  const own = { filter: { person_id: me } };
  const [people, person_skills, skill_goals, future_goals, pathway_enrolments, learning_goals, reco_optouts] = await Promise.all([
    safe(repo, 'people', { filter: { id: me } }), safe(repo, 'person_skills', own), safe(repo, 'skill_goals', own), safe(repo, 'future_goals', own), safe(repo, 'pathway_enrolments', own),
    safe(repo, 'learning_goals', own), safe(repo, 'reco_optouts', own),
  ]);
  const rpc = repo.rpc as unknown as Record<string, ((...a: unknown[]) => Promise<unknown>) | undefined>;
  const view = (await rpc.roleTransformation?.(null, '2030').catch(() => null)) as { map?: RoleMap | null } | null | undefined;
  const cat = (await rpc.pathwayCatalogue?.().catch(() => null)) as { pathways?: { id: string; requested: number; peer: PeerStats | null }[] } | null | undefined;
  const p = futurePersonalFrom({ people, person_skills, skill_goals, future_goals, pathway_enrolments, learning_goals, reco_optouts }, me, view?.map ?? null);
  if (p && cat?.pathways) p.catalogue = new Map(cat.pathways.map((x) => [x.id, { requested: Number(x.requested ?? 0), peer: x.peer ?? null }]));
  return p;
}

// ───────────── detection
const SKILL_STOP = new Set(['skill', 'skil', 'code', 'mean', 'equival', 'framework', 'esco', 'onet', 'sfia', 'digcomp', 'definition', 'defin', 'crosswalk', 'what', 'مهار', 'معني', 'مقابل', 'رمز', 'تعريف']);
/** A skill named in the question (title or alternative label, either language): most of a title, or two of its words. */
export function findSkill(q: string, skills: Row[]): string | null {
  const qt = new Set(tokenize(q).filter((x) => !SKILL_STOP.has(x)));
  let best: string | null = null;
  let key = [0, 0];
  for (const s of skills) {
    if (s.lifecycle === 'obsolete') continue;
    for (const name of [s.name_en, s.name_ar, ...((s.alt_labels_en ?? []) as string[]), ...((s.alt_labels_ar ?? []) as string[])]) {
      const tt = new Set(tokenize(String(name ?? '')).filter((x) => x.length >= 3 && !SKILL_STOP.has(x)));
      if (!tt.size) continue;
      const overlap = [...tt].filter((x) => qt.has(x)).length;
      const ratio = overlap / tt.size;
      if ((overlap >= 2 || ratio >= 0.6) && overlap > 0 && (overlap > key[0] || (overlap === key[0] && ratio > key[1]))) { best = String(s.id); key = [overlap, ratio]; }
    }
  }
  return best;
}
/** Framework names a question can narrow the crosswalk to (only names that cannot be ordinary words). */
const FW_NAMES: [string[], string][] = [[['esco', 'إسكو', 'اسكو'], 'esco'], [['o*net', 'onet', 'o net'], 'onet'], [['sfia'], 'sfia9'], [['digcomp'], 'digcomp'], [['greencomp'], 'greencomp'],
  [['skillsfuture'], 'skillsfuture'], [['lightcast'], 'lightcast'], [['nice framework'], 'nice'], [['unesco ai', 'unesco framework'], 'unesco_ai']];
export interface FutureHit { kind: FutureKind; roleId: string | null; skillId: string | null; framework: string | null }
/** Which future intent a question asks, or null. Frameworks first, then the AI ladder, pathways, and the 2030 role question. */
export function detectFuture(question: string, pub: Pick<FuturePublic, 'roles' | 'skills' | 'frameworks'>): FutureHit | null {
  const norm = normText(question);
  const roleId = findRole(question, pub.roles);
  const fwHit = hasAny(norm, FW_WORDS);
  const named = FW_NAMES.find(([words]) => hasAny(norm, words));
  const fwId = named && pub.frameworks.some((f) => f.id === named[1]) ? named[1] : null;
  if (fwHit) return { kind: 'skill_crosswalk', roleId, skillId: findSkill(question, pub.skills), framework: fwId };
  if (hasAny(norm, RUNG_WORDS)) return { kind: 'ai_rung', roleId, skillId: null, framework: null };
  const pathWord = !!hasAny(norm, PATHWAY_WORDS), closeWord = !!hasAny(norm, GAP_CLOSE_WORDS), courseWord = !!hasAny(norm, COURSE_WORDS);
  // "pathway to SRO" is a career route (F05/F06); "which courses close my gaps" is the F07 courses intent
  if ((pathWord && (!roleId || closeWord)) || (closeWord && !roleId && !courseWord)) return { kind: 'pathway_gap', roleId: null, skillId: findSkill(question, pub.skills), framework: null };
  if (hasAny(norm, YEAR_WORDS) && (hasAny(norm, CHANGE_WORDS) || hasAny(norm, ROLE_WORDS)) && !hasAny(norm, ['how many', 'how much', 'كم'])) return { kind: 'role_2030', roleId, skillId: null, framework: null };
  if (hasAny(norm, ['how will my role change', 'how will my job change', 'how is my role changing', 'future of my role', 'future of my job', 'my role in the future', 'كيف سيتغير دوري', 'كيف ستتغير وظيفتي', 'مستقبل دوري', 'مستقبل وظيفتي'])) return { kind: 'role_2030', roleId, skillId: null, framework: null };
  if (hasAny(norm, MEANING_WORDS)) { const skillId = findSkill(question, pub.skills); if (skillId && !(roleId && hasAny(norm, ROLE_WORDS))) return { kind: 'skill_crosswalk', roleId: null, skillId, framework: null }; }
  return null;
}

// ───────────── answers
const R = (code: string, key: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
function answer(lang: Lang, intent: string, text: string, citations: (DalilCitation | null | undefined)[], extra: Partial<DalilAnswer> = {}): DalilAnswer {
  const seen = new Set<string>();
  const cites = citations.filter((c): c is DalilCitation => !!c && !!c.url && !seen.has(c.url) && !!seen.add(c.url));
  return { intent, lang, text, citations: cites, followUps: [], refused: false, confidence: 1, personal: false, ...extra };
}
const extSource = (sources: unknown): DalilCitation | null => {
  const s = (Array.isArray(sources) ? sources : []).find((x: Row) => typeof x?.url === 'string' && x.url.startsWith('https://')) as Row | undefined;
  return s ? { label: String(s.label ?? s.url), url: String(s.url) } : null;
};
const list = (lang: Lang, xs: string[]) => xs.join(lang === 'ar' ? '، ' : ', ');

/** Answer a future-skills question, or null when it is not one. `me` null = public content only. */
export function answerFuture(input: AskInput, f: FutureCtx | null | undefined, opts: { signedIn?: boolean } = {}): DalilAnswer | null {
  if (!f) return null;
  const hit = detectFuture(input.question, f.pub);
  if (!hit) return null;
  const lang = input.lang;
  const def = FUTURE_INTENTS.find((d) => d.kind === hit.kind)!;
  const row = f.pub.intents.find((r) => r.id === def.id);
  if (row && row.enabled === false) {
    return answer(lang, `${def.id}.off`, say(lang, 'off', { name: bi(row, 'title', lang) || (lang === 'ar' ? def.title_ar : def.title_en) }), [{ label: say(lang, 'cite.faq'), url: '/faq#faq-8' }],
      { followUps: followUps(lang, hit.kind), links: [{ label: say(lang, 'cite.skills'), to: '/skills' }] });
  }
  const signedIn = !!opts.signedIn || !!f.me;
  const a = hit.kind === 'role_2030' ? role2030(lang, hit, f, signedIn) : hit.kind === 'ai_rung' ? aiRungAnswer(lang, hit, f, signedIn) : hit.kind === 'skill_crosswalk' ? crosswalk(lang, hit, f) : pathwayGap(lang, hit, f, signedIn);
  return { ...a, followUps: a.followUps.length ? a.followUps : followUps(lang, hit.kind) };
}

/** Follow-up questions: the other future intents (never personal wording leaks into a public answer; questions only). */
function followUps(lang: Lang, kind: FutureKind): string[] {
  return (['role_2030', 'ai_rung', 'skill_crosswalk', 'pathway_gap'] as FutureKind[]).filter((k) => k !== kind).map((k) => say(lang, `follow.${k}`));
}

function roleTitle(f: FutureCtx, id: string | null | undefined, lang: Lang) { return bi(f.pub.roles.find((r) => r.id === id), 'title', lang) || String(id ?? ''); }
function reqName(f: FutureCtx, kind: string, refId: string, lang: Lang) {
  return kind === 'skill' ? bi(f.pub.skills.find((s) => s.id === refId), 'name', lang) || refId : bi(f.pub.competencies.find((c) => c.id === refId), 'name', lang) || refId;
}
const isRestricted = (role: Row | undefined) => !!role && (!!role.security_sensitive || RESTRICTED.includes(String(role.family_id)));

function role2030(lang: Lang, hit: FutureHit, f: FutureCtx, signedIn: boolean): DalilAnswer {
  const me = f.me;
  const target = hit.roleId ?? me?.roleId ?? null;
  const careers = { label: say(lang, 'cite.careers'), url: '/careers' };
  if (!target) {
    const signInLink: DalilLink[] = signedIn ? [] : [{ label: say(lang, 'cite.signIn'), to: '/sign-in?next=/ask?mode=future' }];
    const example = roleTitle(f, 'senior-reactor-operator', lang);
    return answer(lang, 'future.role_2030.general', `${say(lang, 'r30.general', { example })}${me ? '' : ` ${say(lang, signedIn ? 'r30.switchHint' : 'r30.signInHint')}`} ${say(lang, 'assumption')}`,
      [careers, extSource(FUTURE_INTENTS[0].sources)], { links: [{ label: say(lang, 'cite.careers'), to: '/careers' }, ...signInLink], followUps: [say(lang, 'follow.role_example', { role: example })] });
  }
  const role = f.pub.roles.find((r) => r.id === target);
  const title = roleTitle(f, target, lang);
  const roleCite = { label: title, url: `/careers/roles/${target}` };
  if (!role) return answer(lang, 'future.role_2030.general', say(lang, 'r30.general', { example: roleTitle(f, 'senior-reactor-operator', lang) }), [careers]);
  if (isRestricted(role)) return answer(lang, 'future.role_2030.path_only', say(lang, 'r30.pathOnly', { role: title }), [roleCite], { links: [{ label: title, to: roleCite.url }] });
  if (isConcept(role)) {
    const prof = conceptProfile(f.pub.versions as never, target);
    const reqs = reqsOfVersion(prof).slice().sort((a, b) => b.level - a.level || cmp(a.ref_id, b.ref_id)).slice(0, 4);
    const names = reqs.map((q) => reqName(f, q.kind, q.ref_id, lang));
    const personal = !!me;
    return answer(lang, `future.role_2030.concept${personal ? '.personal' : '.public'}`,
      `${prof ? say(lang, 'r30.concept', { role: title, horizon: prof.horizon, list: list(lang, names) }) : say(lang, 'r30.conceptNoProfile', { role: title })}${personal ? ` ${say(lang, 'r30.conceptAsk', { role: title })}` : ''} ${say(lang, 'assumption')}`,
      [roleCite, personal ? { label: say(lang, 'cite.roadmap'), url: `/my/career/roadmap?role=${target}` } : careers, extSource((prof as Row | null)?.sources)],
      { personal, indicative: personal, followUps: personal ? [say(lang, 'follow.concept_gap', { role: title })] : [], links: [{ label: title, to: roleCite.url }] });
  }
  const tr = f.pub.transformations.find((x) => x.role_id === target && x.status === 'published');
  const txCite = { label: say(lang, 'cite.transformation', { role: title }), url: `/careers/roles/${target}/transformation` };
  const drivers = (map: RoleMap | null) => (map ? map.drivers.map((d) => d.driver) : ((tr?.drivers ?? []) as string[])).map((d) => translate(lang, `m30.driver.${d}`));
  const archetype = tr?.archetype ? translate(lang, `m30.archetype.${tr.archetype}`) : '';
  if (!me) {
    // Public: the map's public summary, the drivers and the names of what the 2030 profile adds, no numbers (FS11 public rule).
    if (!tr) return answer(lang, 'future.role_2030.public', `${say(lang, 'r30.noMap', { role: title })} ${say(lang, 'assumption')}`, [roleCite, careers]);
    const map = transformRole({ role: role as never, map: tr as never, versions: f.pub.versions as never, tasks: [], taskSkills: [], levels: [], skills: f.pub.skills as never, courses: f.pub.courses as never, mine: null, horizon: '2030' });
    const added = map.added.filter((x) => x.horizon === '2030').slice(0, 3).map((x) => `${reqName(f, x.kind, x.ref_id, lang)} (${say(lang, `change.${x.change}`)})`);
    const ds = drivers(null);
    return answer(lang, 'future.role_2030.public', `${title}: ${bi(tr, 'public_summary', lang)}`, [txCite, roleCite, extSource(tr.sources)], {
      bullets: [...(archetype ? [say(lang, 'r30.archetype', { archetype })] : []), ...(ds.length ? [say(lang, 'r30.drivers', { list: list(lang, ds) })] : []), ...(added.length ? [say(lang, 'r30.publicAdded', { list: list(lang, added) })] : [])],
      links: [{ label: txCite.label, to: txCite.url }, ...(signedIn ? [] : [{ label: say(lang, 'cite.signIn'), to: '/sign-in?next=/ask?mode=future' }])],
    });
  }
  // Personal: my role's map from the RPC (with task counts) or the same rule over the published profiles, and my time-to-ready.
  const map: RoleMap = me.myMap && me.myMap.role_id === target ? me.myMap
    : transformRole({ role: role as never, map: (tr ?? null) as never, versions: f.pub.versions as never, tasks: [], taskSkills: [], levels: [], skills: f.pub.skills as never, courses: f.pub.courses as never, mine: me.states.map((s) => ({ skill_id: s.skill_id, level: Number(s.level), active: s.active !== false })), horizon: '2030' });
  const mineRole = target === me.roleId;
  const ds = drivers(map);
  const added = map.added.filter((x) => x.horizon === '2030');
  const parts = [archetype ? say(lang, 'r30.intro', { role: title, archetype, drivers: list(lang, ds) || '-' }) : say(lang, 'r30.introNoArch', { role: title, drivers: list(lang, ds) || '-' })];
  if (map.counts.rated > 0) parts.push(say(lang, 'r30.tasks', { rated: map.counts.rated, grow: map.counts.grow, augmented: map.counts.augmented, shrink: map.counts.shrink }));
  parts.push(say(lang, 'r30.added', { n: added.length }));
  if (map.me) parts.push(map.me.levels === 0 ? say(lang, 'r30.meReady') : say(lang, 'r30.me', { pct: map.me.ready_pct, months: map.me.months }));
  parts.push(say(lang, 'assumption'));
  const skillOk = (id: string | null) => !!id && f.pub.skills.some((s) => s.id === id && s.area !== 'security');
  const cards: AnswerCard[] = added.slice(0, 4).map((x) => ({
    id: `r30-${x.kind}-${x.ref_id}`, kind: 'skill', title: reqName(f, x.kind, x.ref_id, lang), sub: x.change === 'new' ? say(lang, 'r30.cardNew', { to: x.to }) : say(lang, 'r30.cardRaised', { from: x.from, to: x.to }),
    to: skillOk(x.skill_id) ? `/skills/${x.skill_id}` : `/careers/roles/${target}/transformation`, reasons: x.reasons,
  }));
  const gapLine = (map.me?.gaps ?? []).slice(0, 3).map((g) => say(lang, 'r30.gap', { skill: reqName(f, g.kind, g.ref_id, lang), have: g.have, need: g.need }));
  return answer(lang, 'future.role_2030.personal', parts.join(' '), [mineRole ? { label: say(lang, 'cite.myRole'), url: '/my/role-2030' } : null, txCite, roleCite, extSource(tr?.sources)], {
    personal: true, indicative: true, cards, bullets: [...(ds.length ? [say(lang, 'r30.drivers', { list: list(lang, ds) })] : []), ...gapLine],
    links: [...(mineRole ? [{ label: say(lang, 'cite.myRole'), to: '/my/role-2030' }] : []), { label: txCite.label, to: txCite.url }],
    followUps: [say(lang, 'follow.pathway_gap'), say(lang, 'follow.ai_rung')],
  });
}

function aiRungAnswer(lang: Lang, hit: FutureHit, f: FutureCtx, signedIn: boolean): DalilAnswer {
  const me = f.me;
  const ladder = { label: say(lang, 'cite.ladder'), url: '/learn/ai-fluency' };
  const src = extSource(f.pub.rungs[0]?.sources) ?? extSource(FUTURE_INTENTS[1].sources);
  const role = hit.roleId ? f.pub.roles.find((r) => r.id === hit.roleId) : null;
  const famId = role ? String(role.family_id ?? '') : me?.familyId ?? null;
  const target = famId ? f.pub.targets.find((x) => x.family_id === famId) : null;
  const rungName = (r: number) => translate(lang, `m29.rung.${rungKey(r)}`);
  const cellName = (id: string) => { const c = f.pub.rungs.find((x) => x.id === id); return c ? `${rungName(Number(c.rung))} · ${translate(lang, `m29.dim.${c.dimension}`)}` : id; };
  const famName = bi(f.pub.families.find((x) => x.id === famId), 'name', lang) || famId || '';
  const targetText = target ? say(lang, 'rung.target', { family: famName, rung: rungName(Number(target.rung)), plus: (target.plus_cells ?? []).length ? say(lang, 'rung.plus', { cells: list(lang, (target.plus_cells as string[]).map(cellName)) }) : '' }) : '';
  if (!me || (role && hit.roleId !== me.roleId)) {
    if (!target) {
      return answer(lang, me ? 'future.ai_rung.general' : 'future.ai_rung.public', `${say(lang, 'rung.overview')}${me ? '' : ` ${say(lang, signedIn ? 'rung.switch' : 'rung.signIn')}`}`, [ladder, src],
        { links: [{ label: ladder.label, to: ladder.url }], bullets: [1, 2, 3, 4].map((r) => `${rungName(r)}: ${bi(f.pub.rungs.find((c) => Number(c.rung) === r && c.dimension === 'mindset'), 'essence', lang)}`) });
    }
    const roleText = role ? say(lang, 'rung.forRole', { role: bi(role, 'title', lang) }) : '';
    return answer(lang, me ? 'future.ai_rung.role' : 'future.ai_rung.public', `${roleText}${targetText} ${say(lang, 'rung.claimed')}${me ? '' : ` ${say(lang, signedIn ? 'rung.switch' : 'rung.signIn')}`}`, [ladder, role ? { label: bi(role, 'title', lang), url: `/careers/roles/${role.id}` } : null, src],
      { links: [{ label: ladder.label, to: ladder.url }], bullets: [bi(target, 'rationale', lang)].filter(Boolean) });
  }
  const res = aiRung(me.personId, f.pub.rungs as unknown as RungCell[], f.pub.tracks as never, me.states as never);
  const gap = targetGap(res, target as never);
  const mine = res.rung > 0 ? say(lang, 'rung.mine', { rung: rungName(res.rung) }) : say(lang, 'rung.mineNone');
  const status = !target ? say(lang, 'rung.noFamily') : gap.met ? say(lang, 'rung.met') : say(lang, 'rung.missing', { n: gap.missing.length });
  const cards: AnswerCard[] = gap.missing.slice(0, 4).map((id) => {
    const c = f.pub.rungs.find((x) => x.id === id)!;
    const cell = res.cells.find((x) => x.id === id);
    const learn = (Array.isArray(c?.learning) ? c.learning : [])[0] as Row | undefined;
    const to = learn?.kind === 'course' ? `/learn/course/${learn.ref}` : learn?.kind === 'check' ? '/my/ai-fluency/check' : '/my/ai-fluency';
    const skills = (c?.skill_ids ?? []).filter((s: string) => f.pub.tracks.some((t) => t.skill_id === s && t.track === 'literacy')).map((s: string) => bi(f.pub.skills.find((x) => x.id === s), 'name', lang) || s);
    return { id: `rung-${id}`, kind: 'rung', title: cellName(id), sub: say(lang, 'rung.cellSub', { level: Number(c?.min_level ?? 1), skills: list(lang, skills.slice(0, 2)) }), to, status: 'not_met',
      reasons: [R('fs09_cell_gap', `m29.reason.gap.${c?.dimension}`, { rung: Number(c?.rung ?? 0), level: Number(c?.min_level ?? 1) }), R('fs76_have', 'm13.future.why.have', { have: cell?.have ?? 0, need: Number(c?.min_level ?? 1) }),
        ...(learn ? [R('fs76_learn', 'm13.future.why.learn', { item: { en: String(learn.title_en ?? ''), ar: String(learn.title_ar ?? learn.title_en ?? '') } })] : [])] };
  });
  return answer(lang, 'future.ai_rung.personal', [targetText, mine, status, say(lang, 'rung.claimed')].filter(Boolean).join(' '), [{ label: say(lang, 'cite.myFluency'), url: '/my/ai-fluency' }, ladder, src], {
    personal: true, indicative: true, cards, bullets: res.engineering.length ? [say(lang, 'rung.engineering', { n: res.engineering.length })] : [],
    links: [{ label: say(lang, 'cite.myFluency'), to: '/my/ai-fluency' }, { label: say(lang, 'cite.check'), to: '/my/ai-fluency/check' }],
    followUps: [say(lang, 'follow.pathway_gap'), say(lang, 'follow.role_2030')],
  });
}

function crosswalk(lang: Lang, hit: FutureHit, f: FutureCtx): DalilAnswer {
  const fwCite = { label: say(lang, 'cite.frameworks'), url: '/skills/frameworks' };
  const fwName = (id: string) => String(f.pub.frameworks.find((x) => x.id === id)?.short ?? id);
  if (!hit.skillId) {
    const example = bi(f.pub.skills.find((s) => s.id === 'sk-fs-ai-twin'), 'name', lang) || 'digital twin validation';
    return answer(lang, 'future.skill_crosswalk.general', say(lang, 'xw.general', { n: f.pub.frameworks.length, list: list(lang, f.pub.frameworks.slice(0, 5).map((x) => String(x.short))), example }), [fwCite, { label: say(lang, 'cite.skills'), url: '/skills' }, extSource(FUTURE_INTENTS[2].sources)],
      { links: [{ label: fwCite.label, to: fwCite.url }], followUps: [say(lang, 'follow.xw_example', { skill: example })] });
  }
  const s = f.pub.skills.find((x) => x.id === hit.skillId)!;
  const name = bi(s, 'name', lang);
  if (s.area === 'security') return answer(lang, 'future.skill_crosswalk.path_only', say(lang, 'xw.security', { skill: name }), [{ label: say(lang, 'cite.careers'), url: '/careers' }]);
  const skillCite = { label: say(lang, 'cite.skill', { skill: name }), url: `/skills/${s.id}` };
  let rows = sortAlignments(f.pub.alignments.filter((a) => a.skill_id === s.id) as never) as unknown as Row[];
  const all = rows.length;
  if (hit.framework) rows = rows.filter((a) => a.framework === hit.framework);
  const line = (a: Row) => say(lang, 'xw.row', {
    framework: fwName(a.framework), code: a.external_code ? `${shortCode(a.external_code)} ` : `${say(lang, 'xw.pending')} · `, label: bi(a, 'label', lang),
    match: say(lang, `xw.match.${a.match_type}`), review: say(lang, a.reviewed_by ? 'xw.review.reviewed' : 'xw.review.indicative'),
  });
  const intro = `${name} (${s.code}): ${bi(s, 'description', lang)}`;
  const tail = !all ? say(lang, 'xw.noRows') : hit.framework && !rows.length ? say(lang, 'xw.none', { framework: fwName(hit.framework) }) : say(lang, 'xw.rows', { n: new Set(rows.map((a) => a.framework)).size });
  const cards: AnswerCard[] = rows.slice(0, 4).map((a) => ({
    id: `xw-${a.id}`, kind: 'framework', title: `${fwName(a.framework)} · ${bi(a, 'label', lang)}`, sub: a.external_code ? shortCode(a.external_code) : say(lang, 'xw.pending'), to: `/skills/${s.id}`,
    reasons: [R('fs76_match', 'm13.future.why.match', { match: { en: translate('en', `m13.future.xw.match.${a.match_type}`), ar: translate('ar', `m13.future.xw.match.${a.match_type}`) } }, { table: 'skill_alignments', id: String(a.id) }),
      R('fs76_review', a.reviewed_by ? 'm13.future.why.reviewed' : 'm13.future.why.indicative'), ...(a.as_of ? [R('fs76_asof', 'm13.future.why.asOf', { date: String(a.as_of).slice(0, 10) })] : [])],
  }));
  const first = rows.find((a) => typeof a.source_url === 'string' && a.source_url.startsWith('https://'));
  return answer(lang, 'future.skill_crosswalk.public', `${intro} ${tail}`, [skillCite, fwCite, first ? { label: `${fwName(first.framework)} · ${bi(first, 'label', lang)}`, url: String(first.source_url) } : null], {
    bullets: rows.slice(0, 5).map(line), cards, links: [{ label: skillCite.label, to: skillCite.url }, { label: fwCite.label, to: fwCite.url }],
  });
}

function pathwayGap(lang: Lang, hit: FutureHit, f: FutureCtx, signedIn: boolean): DalilAnswer {
  const me = f.me;
  const skillsCite = { label: say(lang, 'cite.skills'), url: '/skills' };
  if (!me) {
    return answer(lang, signedIn ? 'future.pathway_gap.switch' : 'future.pathway_gap.sign_in', say(lang, signedIn ? 'pw.switch' : 'pw.signIn'), [skillsCite, { label: say(lang, 'cite.ladder'), url: '/learn/ai-fluency' }],
      { links: [signedIn ? { label: say(lang, 'cite.futureMode'), to: '/ask?mode=future' } : { label: say(lang, 'cite.signIn'), to: '/sign-in?next=/ask?mode=future' }, { label: skillsCite.label, to: '/skills' }] });
  }
  const coach = { label: say(lang, 'cite.coach'), url: '/my/coach' };
  const mineCite = { label: say(lang, 'cite.pathways'), url: '/my/pathways' };
  if (!f.pub.pathways.length) return answer(lang, 'future.pathway_gap.none', say(lang, 'pw.noAccess'), [mineCite, coach], { personal: true });
  const pubV = (h: string) => f.pub.versions.filter((v) => v.role_id === me.roleId && v.horizon === h).sort((a, b) => Number(b.version) - Number(a.version))[0];
  const have = new Map<string, number>();
  for (const x of me.states) have.set(x.skill_id, Math.max(have.get(x.skill_id) ?? 0, Number(x.level)));
  const role = f.pub.roles.find((r) => r.id === me.roleId);
  const pws = f.pub.pathways.filter((p) => !hit.skillId || p.skill_id === hit.skillId);
  const skillName = (id: string) => bi(f.pub.skills.find((s) => s.id === id), 'name', lang) || id;
  const pwCard = (p: Row, reasons?: Reason[]): AnswerCard => ({ id: `pw-${p.id}`, kind: 'pathway', title: bi(p, 'title', lang), sub: say(lang, 'pw.card', { level: Number(p.level), months: Number(p.envelope_months), hours: Number(p.weekly_hours) }), to: `/learn/pathways/${p.id}`, reasons });
  if (me.optouts.has('coach')) {
    const open = pws.filter((p) => !me.enrolled.has(p.id) && Number(p.level) === (have.get(p.skill_id) ?? 0) + 1).sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id)).slice(0, 3);
    return answer(lang, 'future.pathway_gap.personal', say(lang, 'pw.unranked', { n: open.length }), [...open.map((p) => ({ label: bi(p, 'title', lang), url: `/learn/pathways/${p.id}` })), mineCite, coach],
      { personal: true, unranked: true, cards: open.map((p) => pwCard(p)) });
  }
  const ranked = rankPathways({
    pathways: pws.map((p) => ({ id: p.id, skill_id: p.skill_id, level: Number(p.level), envelope_months: Number(p.envelope_months), weekly_hours: Number(p.weekly_hours), title_en: '', title_ar: '', requested: me.catalogue.get(p.id)?.requested, peer: me.catalogue.get(p.id)?.peer ?? null })),
    skills: f.pub.skills as unknown as SkillRef[], have, roleTitle: role ? { en: role.title_en, ar: role.title_ar } : null,
    now: (pubV('now')?.requirements ?? []) as Requirement[], y2030: (pubV('2030')?.requirements ?? []) as Requirement[], goals: me.goals, weeklyGoal: me.weeklyGoal, enrolled: me.enrolled,
  }).slice(0, 3);
  if (!ranked.length) {
    const sk = hit.skillId ? f.pub.skills.find((s) => s.id === hit.skillId) : null;
    const text = sk && !pathwaySkillOk(sk as never) ? say(lang, 'pw.noSkill', { skill: skillName(sk.id) }) : say(lang, 'pw.none');
    return answer(lang, 'future.pathway_gap.personal', text, [mineCite, coach, skillsCite], { personal: true });
  }
  const byId = new Map(f.pub.pathways.map((p) => [p.id, p]));
  const intro = hit.skillId ? say(lang, 'pw.introSkill', { skill: skillName(hit.skillId), n: ranked.length }) : say(lang, 'pw.intro', { n: ranked.length });
  return answer(lang, 'future.pathway_gap.personal', `${intro} ${say(lang, 'notDecision')}`, [...ranked.map((r) => ({ label: bi(byId.get(r.id), 'title', lang), url: `/learn/pathways/${r.id}` })), mineCite, coach], {
    personal: true, indicative: true, cards: ranked.map((r) => pwCard(byId.get(r.id)!, r.reasons as unknown as Reason[])),
    bullets: ranked.map((r) => `${bi(byId.get(r.id), 'title', lang)}: ${say(lang, 'pw.level', { skill: skillName(r.skill_id), from: have.get(r.skill_id) ?? 0, to: r.level })}`),
    links: [{ label: mineCite.label, to: mineCite.url }, { label: coach.label, to: coach.url }], followUps: [say(lang, 'follow.role_2030'), say(lang, 'follow.ai_rung')],
  });
}
