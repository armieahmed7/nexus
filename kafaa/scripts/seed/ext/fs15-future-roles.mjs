// [FS wave B · E5] FS15 Future roles in the Navigator and Roadmap + FS16 Role outlook labels with published criteria (M18).
//  - role_moves: a SIMULATED, anonymised mirror of past role changes (no person ids) along the published progression edges, so
//    the Navigator can say how many colleagues made a move and the median months in the previous role (suppressed under 10).
//  - role_outlook_criteria: criteria version 1 (2024-2025: demand growth and shortfall) and version 2 (from 2026: plus the FS05
//    change size), with thresholds, precedence and sources (ONET, CORP, FORECAST).
//  - role_outlook_labels + role_outlook_components: 2026 labels computed by the published rule from the F35 released outlook and
//    the FS05 profiles (src/modules/m18/outlookLabels.ts, = SQL kafaa_fs16_*); 2024 and 2025 are kept as archived labels
//    (SIMULATED archive values) under criteria version 1.
//  - engine_cards.navigator (F24 card): version 2 names the FS05 profiles and the move mirror as inputs and the new scoring
//    functions. The live database gets the same card from the FS25 migration (guarded update).
// FINALIZE_LAST: runs after f35 (released outlook) and before fsqa1, whose FS02 remap of 2030/2035 requirements is applied here
// with the same function, so the labels match the final profiles whatever the order.
import { computeLabels, outlookLabel, r1, labelId } from '../../../src/modules/m18/outlookLabels.ts';
import { remapRequirements } from './fsqa1-integration.mjs';
import { FUTURE_SKILL_EQUIVALENT as EQ } from '../../../src/domain/taxonomy.ts';

export const FINALIZE_LAST = true;
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const AS_OF = '2026-10-10';
const CUR_YEAR = 2026;

/** Moves per published progression edge (edge id -> count): some above 10 (shown), some below (suppressed). */
export const MOVES_PER_EDGE = {
  'lo-ro': 26, 'ro-sro': 15, 'lo-sro-bsc': 7, 'sro-ss': 6, 'sro-instructor': 4, 'ro-workcontrol': 12, 'lo-workcontrol': 9, 'sro-outage': 3,
  'eng-sta': 5, 'maint-tech-eng': 11, 'maint-outage': 8, 'rp-env': 4, 'chem-env': 3, 'qa-procurement': 10, 'ops-hu': 5, 'ops-npi': 4,
  'eng-licensing': 6, 'eng-reactor': 5, 'fire-ep': 4, 'hse-hu': 3, 'corp-procurement': 6,
};

const SRC = {
  onet: { id: 'onet-bright', label: 'O*NET OnLine · Bright Outlook occupations (criteria)', url: 'https://onetcenter.org/bright.html', as_of: AS_OF },
  corp: { id: 'clo-att', label: 'Chief Learning Officer · AT&T: a fixed gaze toward the future', url: 'https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/', as_of: AS_OF },
  forecast: { id: 'skills-england-2030', label: 'Skills England · Assessment of priority skills to 2030', url: 'https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030', as_of: AS_OF },
};
export const CRITERIA = [
  {
    id: 'olc-v1', version: 1, year_from: 2024,
    thresholds: { growth_min_pct: 5, shortfall_min_pct: 0, change_min_pct: null, base_year: 2025, horizon_year: 2030 },
    precedence: ['growing', 'stable'], components: ['growth', 'shortfall'],
    summary_en: 'Version 1 (2024 to 2025). Growing: projected demand for the skill families the role needs grows by 5% or more to 2030 and is above the people who hold them. Stable: otherwise. There was no profile-change component before the 2030 role profiles existed.',
    summary_ar: 'الإصدار 1 (2024 إلى 2025). متنامٍ: يزداد الطلب المتوقع على فئات المهارات التي يحتاجها الدور بنسبة 5% أو أكثر حتى 2030 ويتجاوز عدد حامليها. مستقر: خلاف ذلك. لم يكن هناك مكوّن لتغيّر الملف قبل وجود ملفات الأدوار لعام 2030.',
    sources: [SRC.onet, SRC.forecast], benchmark_ids: ['ONET', 'FORECAST'], as_of: '2025-01-15', status: 'retired',
  },
  {
    id: 'olc-v2', version: 2, year_from: 2026,
    thresholds: { growth_min_pct: 5, shortfall_min_pct: 0, change_min_pct: 30, base_year: 2026, horizon_year: 2030 },
    precedence: ['changing', 'growing', 'stable'], components: ['change', 'growth', 'shortfall'],
    summary_en: 'Version 2 (from 2026). Changing: the 2030 role profile adds or raises at least 30% of today\'s requirement weight. Growing: otherwise, when projected demand for the role\'s skill families grows by 5% or more to 2030 and is above the people who hold them. Stable: neither. The first rule that matches wins.',
    summary_ar: 'الإصدار 2 (اعتباراً من 2026). متغيّر: يضيف ملف الدور لعام 2030 أو يرفع ما لا يقل عن 30% من وزن متطلبات اليوم. متنامٍ: خلاف ذلك، عندما يزداد الطلب المتوقع على فئات مهارات الدور بنسبة 5% أو أكثر حتى 2030 ويتجاوز عدد حامليها. مستقر: لا هذا ولا ذاك. تُطبَّق أول قاعدة تنطبق.',
    sources: [SRC.onet, SRC.corp, SRC.forecast], benchmark_ids: ['ONET', 'CORP', 'FORECAST'], as_of: AS_OF, status: 'published',
  },
];

/** F24 navigator card, version 2 (FS15): the same JSON the FS25 migration writes live. */
export const NAV_CARD_PATCH = {
  inputs_used_add: [
    { key: 'role_profile_versions', en: 'FS05 role profiles for concept future roles (the 2030 profile, else 2035): planning assumptions, no deployment decision implied', ar: 'ملفات أدوار FS05 للأدوار المستقبلية المفاهيمية (ملف 2030، وإلا 2035): افتراضات تخطيطية، ولا قرار نشر ضمني' },
    { key: 'role_moves', en: 'How many colleagues made a move and the median months in the previous role (SIMULATED anonymised mirror; counts under 10 suppressed)', ar: 'عدد الزملاء الذين أجروا الانتقال ووسيط الأشهر في الدور السابق (نسخة محاكاة مجهولة الهوية؛ تُحجب الأعداد الأقل من 10)' },
  ],
  scoring_add: ['src/modules/m18/futureRoles.ts#conceptReadiness', 'src/modules/m18/futureRoles.ts#transitionEvidence', 'sql:kafaa_fs15_concept_readiness_compute', 'sql:kafaa_fs15_transition_compute'],
  limitations_en: 'Covers only skills Kafa\'a holds evidence for; it does not measure performance, potential or motivation. Security roles show the path only. Concept future roles are measured against their FS05 profile: no vacancy and no deployment decision implied, never "ready now". The F24 fairness metric counts current roles only.',
  limitations_ar: 'يغطي فقط المهارات التي لدى كفاءة أدلة عليها؛ ولا يقيس الأداء أو الإمكانات أو الدافعية. تعرض أدوار الأمن المسار فقط. تُقاس الأدوار المستقبلية المفاهيمية مقابل ملف FS05 الخاص بها: لا وظيفة شاغرة ولا قرار نشر ضمني، ولا تصنَّف أبداً "جاهز الآن". يحتسب مقياس العدالة في F24 الأدوار الحالية فقط.',
  feature: 'F05 · F06 · FS15',
};

function buildMoves(T) {
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  const out = [];
  for (const e of T.career_paths) {
    const n = MOVES_PER_EDGE[e.id];
    if (!n) continue;
    if ((e.kind ?? 'current') === 'future' || !e.from_role_id || roles.get(e.from_role_id)?.security_sensitive || roles.get(e.to_role_id)?.security_sensitive) throw new Error(`fs15 seed: edge ${e.id} cannot carry moves`);
    const need = (e.conditions ?? []).reduce((m, c) => (c.kind === 'months' && typeof c.value === 'number' ? Math.max(m, c.value) : m), 0);
    for (let i = 1; i <= n; i++) {
      const h = hash(`${e.id}:${i}`);
      const months = need > 0 ? need + (h % 19) : 18 + (h % 43);
      const y = 2014 + (h % 12);
      const m = 1 + ((h >>> 8) % 12);
      const day = 1 + ((h >>> 16) % 27);
      out.push({ id: `mv-${e.id}-${String(i).padStart(2, '0')}`, from_role_id: e.from_role_id, to_role_id: e.to_role_id, moved_on: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, months_before: months, kind: e.type === 'vertical' ? 'progression' : 'lateral', simulated: true, source: 'SIMULATED HR mirror' });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export default function build() {}

export function finalize(T) {
  // FS15: move mirror
  T.role_moves = buildMoves(T);
  // FS16: criteria, 2026 labels from the rule, 2024-2025 archived labels under criteria v1
  T.role_outlook_criteria = CRITERIA.map((c) => ({ ...c }));
  const versions = (T.role_profile_versions ?? []).map((v) => (v.horizon !== 'now' && (v.requirements ?? []).some((r) => r.kind === 'skill' && EQ[r.ref_id]) ? { ...v, requirements: remapRequirements(v.requirements) } : v));
  const released = (T.skill_outlooks ?? []).filter((o) => o.status === 'released').sort((a, b) => (String(b.released_at) < String(a.released_at) ? -1 : String(b.released_at) > String(a.released_at) ? 1 : a.id < b.id ? -1 : 1))[0];
  if (!released) throw new Error('fs16 seed: no released F35 outlook');
  const data = { roles: T.job_roles, roleComps: T.role_competencies, skills: T.skills, outlook: { id: released.id, results: released.results }, versions };
  const v1 = CRITERIA[0], v2 = CRITERIA[1];
  const cur = computeLabels(data, v2, CUR_YEAR);
  if (cur.length !== 25) throw new Error(`fs16 seed: expected 25 labelled roles, got ${cur.length}`);
  const labels = [], comps = [];
  const push = (r, year, criteria, components, archived, at) => {
    const label = outlookLabel(components, criteria.thresholds);
    labels.push({ id: labelId(r.role_id, year), role_id: r.role_id, year, label, criteria_id: criteria.id, archived, as_of: at.slice(0, 10), published_by_role: 'hr_director', published_at: at });
    comps.push({ id: labelId(r.role_id, year), role_id: r.role_id, year, criteria_id: criteria.id, components, computed_at: at });
  };
  for (const r of cur) {
    const c = r.components;
    for (const [year, f, ds] of [[2024, 0.45, 15], [2025, 0.7, 8]]) {
      const g = c.growth_pct == null ? null : r1(c.growth_pct * f);
      const s = c.shortfall_pct == null ? null : r1(c.shortfall_pct - ds);
      push(r, year, v1, { growth_pct: g, shortfall_pct: s, change_pct: null, families: [], change: null, outlook_id: null, base_year: year, horizon_year: 2030, archived: true }, true, `${year}-01-15T08:00:00Z`);
    }
    push(r, CUR_YEAR, v2, c, false, '2026-10-02T08:00:00Z');
  }
  T.role_outlook_labels = labels.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.role_outlook_components = comps.sort((a, b) => (a.id < b.id ? -1 : 1));
  // F24 navigator card v2
  const card = (T.engine_cards ?? []).find((c) => c.id === 'navigator');
  if (card && !card.scoring_functions.includes(NAV_CARD_PATCH.scoring_add[0])) {
    card.inputs_used = [...card.inputs_used, ...NAV_CARD_PATCH.inputs_used_add];
    card.scoring_functions = [...card.scoring_functions, ...NAV_CARD_PATCH.scoring_add];
    card.limitations_en = NAV_CARD_PATCH.limitations_en;
    card.limitations_ar = NAV_CARD_PATCH.limitations_ar;
    card.feature = NAV_CARD_PATCH.feature;
    card.version = (card.version ?? 1) + 1;
    card.last_changed_at = '2026-10-10T00:00:00Z';
  }
  const n = (k) => labels.filter((l) => l.year === CUR_YEAR && l.label === k).length;
  console.log(`fs15/16: ${T.role_moves.length} SIMULATED role moves, ${labels.length} outlook labels (2026: ${n('changing')} changing, ${n('growing')} growing, ${n('stable')} stable)`);
}
