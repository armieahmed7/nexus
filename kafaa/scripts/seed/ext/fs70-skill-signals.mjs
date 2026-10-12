// FS wave H · E1 seed (FS70 ENEC Skills on the Rise + manager pulse, FS71 hot technologies and in-demand badges, FS72 "Skills you may
// have", M28 Skills Intelligence). FINALIZE_LAST: finalize() runs after F01/FS02/FS03 and the wave B-G builders have derived the final
// skill states, so every stored list, badge set and suggestion equals what the rules (src/modules/m28/{signals,technologies,suggestions}.ts)
// and the SQL (kafaa_rs_compute, kafaa_ht_compute, kafaa_ssg_candidates) give on the seeded data (checked by scripts/validate/fs81-*.mjs
// and tests/unit/fs81-*). A later builder that adds dated evidence, goals, opportunities or role-profile versions in a past quarter
// changes what those quarters compute; published lists are kept as published (by design), so the checks name the builder to rerun.
// Synthetic only: publishers and pulse respondents are role cards; no new person, no evidence written (no confirmed suggestion is seeded,
// so no skill state changes).
//  - technologies: 17 generic technology tags (never a vendor or product brand), EN/AR, category and related skills.
//  - technology_links: the training manager tagged every opportunity (not a draft) and every published role-profile version with the
//    technologies whose related skills it names (curated on 2026-10-10 from the skills each source lists).
//  - technology_badges: published badge lists for 2026-Q2 and 2026-Q3 (kept per quarter; 2026-Q1 had no badge to publish).
//  - skill_signal_runs / skill_signals: published Skills on the Rise lists for 2025-Q4, 2026-Q1 (nothing crossed a threshold: published
//    empty), 2026-Q2 and 2026-Q3.
//  - manager_pulse: 2025 (11 line managers) and 2026 (13 so far; the shift supervisor role card `sro` has not answered, for the demo).
//  - skill_suggestions: every active staff member's suggestions as of 2026-10-11, after three earlier answers (k-ro rejected one on
//    2026-08-20, still hidden; k-ro said "not me" to one on 2026-03-05, which returned after 180 days with its history; sro rejected one
//    on 2026-09-02).
//  - skill_suggestion_fairness: the surface's fairness snapshot of 2026-10-11 (F24 rules: groups under 10 suppress the comparison).
//  - engine_cards: the "skill_suggestions" card (FS55 lint; RANKED_SURFACES entry in src/modules/m16/surfaces.ts).
import { risingSkills, signalInputFromTables, quarterBounds } from '../../../src/modules/m28/signals.ts';
import { technologyBadges, badgeInputFromTables, techProblem, brandHits } from '../../../src/modules/m28/technologies.ts';
import { inferSuggestions, refreshPlan, ssgWorldFromTables, suppressedUntil, suggestionId } from '../../../src/modules/m28/suggestions.ts';
import { suggestionFairness } from '../../../src/modules/m28/suggestFairness.ts';
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { remapRequirements } from './fsqa1-integration.mjs';

export const FINALIZE_LAST = true;
export const SUGGEST_DAY = '2026-10-11';
const TM = 'p-training-mgr';

/** [id, category, name_en, name_ar, description_en, description_ar, skills] */
export const TECHS = [
  ['tech-process-historian', 'plant_data', 'Plant process historian and trend data', 'مؤرخ بيانات العمليات واتجاهات المحطة',
    'Time-series records of plant parameters used to trend equipment and system performance and to check data quality.', 'سجلات زمنية لمعاملات المحطة تُستخدم لتتبّع اتجاهات أداء المعدات والأنظمة والتحقق من جودة البيانات.', ['sk-fs-ai-plantdata', 'sk-en-02-perf', 'sk-en-02']],
  ['tech-condition-monitoring', 'analytics', 'Condition-monitoring analytics', 'تحليلات مراقبة الحالة',
    'Vibration, thermal and performance analytics that flag equipment drifting from normal so engineers can triage early.', 'تحليلات الاهتزاز والحرارة والأداء التي تنبّه إلى المعدات التي تنحرف عن وضعها الطبيعي ليتمكن المهندسون من الفرز مبكراً.', ['sk-fs-ai-anomaly', 'sk-en-02-perf']],
  ['tech-dashboards', 'analytics', 'Data visualisation dashboards', 'لوحات عرض البيانات المرئية',
    'Dashboards that turn exported plant, outage and training data into charts people can act on, with the data source shown.', 'لوحات تحوّل بيانات المحطة والانقطاعات والتدريب المصدّرة إلى رسوم بيانية يمكن العمل بها، مع إظهار مصدر البيانات.', ['sk-da-01-analysis', 'sk-da-01']],
  ['tech-scripting', 'automation', 'General-purpose scripting for engineering analysis', 'البرمجة النصية العامة للتحليل الهندسي',
    'Short scripts that repeat an engineering calculation or clean a data export the same way every time, reviewed like any calculation.', 'نصوص برمجية قصيرة تكرر حساباً هندسياً أو تنظّف بيانات مصدّرة بالطريقة نفسها كل مرة، وتُراجع مثل أي حساب.', ['sk-da-01-scripting']],
  ['tech-workflow-automation', 'automation', 'Low-code workflow automation', 'أتمتة سير العمل منخفضة البرمجة',
    'Configured workflows that route forms, approvals and reminders without custom code, inside the approved digital estate.', 'مسارات عمل مهيأة توجّه النماذج والموافقات والتذكيرات دون برمجة مخصصة، ضمن البيئة الرقمية المعتمدة.', ['sk-fs-ai-automation']],
  ['tech-data-pipelines', 'plant_data', 'Data pipelines and data-quality checks', 'خطوط البيانات وفحوص جودتها',
    'Repeatable extracts, transformations and quality checks that move records between systems without manual retyping.', 'عمليات استخراج وتحويل وفحص جودة قابلة للتكرار تنقل السجلات بين الأنظمة دون إعادة إدخال يدوية.', ['sk-fs-ai-dataeng', 'sk-fs-ai-data-care']],
  ['tech-twin-platform', 'digital_twin', 'Digital-twin modelling platform', 'منصة نمذجة التوائم الرقمية',
    'Physics and data models of plant systems that are validated against measured behaviour before anyone relies on them.', 'نماذج فيزيائية وبيانية لأنظمة المحطة يُتحقق منها مقابل السلوك المقاس قبل الاعتماد عليها.', ['sk-da-01-twins', 'sk-fs-ai-twin']],
  ['tech-remote-monitoring', 'digital_twin', 'Remote monitoring of automated control', 'المراقبة عن بُعد للتحكم المؤتمت',
    'Displays and alarms that let people oversee automated or remotely operated functions and know when to take control.', 'شاشات وإنذارات تتيح الإشراف على الوظائف المؤتمتة أو المشغّلة عن بُعد ومعرفة متى يجب التدخل.', ['sk-da-01-remote']],
  ['tech-ar-inspection', 'inspection', 'Augmented-reality inspection and guidance', 'الفحص والإرشاد بالواقع المعزز',
    'Head-worn or tablet overlays that show step guidance, labels and checkpoints in the field and in training rooms.', 'طبقات عرض على الرأس أو الجهاز اللوحي تُظهر إرشاد الخطوات والملصقات ونقاط التحقق في الموقع وفي قاعات التدريب.', ['sk-fs-ai-xr']],
  ['tech-remote-inspection', 'inspection', 'Robotic and remote inspection', 'الفحص الآلي والفحص عن بُعد',
    'Crawlers, drones and remote cameras that inspect areas that are hard or high-dose to reach, with the data logged.', 'زواحف وطائرات مسيّرة وكاميرات عن بُعد تفحص المناطق الصعبة أو عالية الجرعة، مع تسجيل البيانات.', ['sk-fs-dp-robotics', 'sk-mp-01-remote']],
  ['tech-erounds', 'work_management', 'Mobile electronic operator rounds', 'جولات المشغّل الإلكترونية على الأجهزة المحمولة',
    'Handheld rounds that capture readings against limits in the field and replace paper log sheets.', 'جولات بالأجهزة المحمولة تسجّل القراءات مقابل الحدود في الموقع وتحل محل سجلات الورق.', ['sk-fs-dp-rounds', 'sk-co-01-rounds']],
  ['tech-ework', 'work_management', 'Electronic work packages and maintenance management', 'حزم العمل الإلكترونية وإدارة الصيانة',
    'Work orders, packages and sign-offs held electronically from planning to close-out, with the history kept.', 'أوامر العمل والحزم والاعتمادات محفوظة إلكترونياً من التخطيط حتى الإغلاق، مع الاحتفاظ بالسجل.', ['sk-fs-dp-ework', 'sk-mp-01']],
  ['tech-scheduling', 'work_management', 'Critical-path outage scheduling', 'جدولة الانقطاعات بالمسار الحرج',
    'Schedules that link outage activities, resources and windows so slippage on the critical path shows early.', 'جداول تربط أنشطة الانقطاع والموارد والنوافذ الزمنية لتظهر التأخيرات على المسار الحرج مبكراً.', ['sk-mp-01-outage']],
  ['tech-genai-assistant', 'ai_tools', 'Governed generative-AI assistants', 'مساعدات الذكاء الاصطناعي التوليدي الخاضعة للحوكمة',
    'Approved assistants for drafting, search and summaries, used under the AI register rules and always checked by a person.', 'مساعدات معتمدة للصياغة والبحث والتلخيص، تُستخدم وفق قواعد سجل الذكاء الاصطناعي ويراجعها شخص دائماً.', ['sk-fs-ai-use', 'sk-fs-ai-verify', 'sk-fs-ai-prompt', 'sk-da-02', 'sk-da-02-review']],
  ['tech-digital-ic-diagnostics', 'plant_data', 'Digital I&C platform diagnostics', 'تشخيص منصة القياس والتحكم الرقمية',
    'Self-diagnostics and maintenance displays of the digital instrumentation and control platform, read by trained technicians.', 'التشخيص الذاتي وشاشات الصيانة لمنصة القياس والتحكم الرقمية، ويقرؤها فنيون مدرّبون.', ['sk-mp-02-dic', 'sk-fs-dp-dic']],
  ['tech-lab-information', 'analytics', 'Laboratory information management', 'إدارة معلومات المختبر',
    'Sample tracking, results and instrument records for the chemistry laboratories, with review and approval kept.', 'تتبّع العينات والنتائج وسجلات الأجهزة لمختبرات الكيمياء، مع الاحتفاظ بالمراجعة والاعتماد.', ['sk-ch-02-labqa']],
  ['tech-dose-tracking', 'plant_data', 'Electronic dosimetry and dose tracking', 'قياس الجرعات الإلكتروني وتتبّعها',
    'Electronic dosimeters and dose records that follow exposure against work permits and planning estimates.', 'مقاييس جرعات إلكترونية وسجلات جرعات تتابع التعرض مقابل تصاريح العمل وتقديرات التخطيط.', ['sk-rp-01-dose']],
  ['tech-eprocurement', 'work_management', 'Electronic procurement and supplier portals', 'المشتريات الإلكترونية وبوابات الموردين',
    'Requisitions, bids and supplier documents handled electronically, with technical and quality reviews recorded.', 'طلبات الشراء والعطاءات ووثائق الموردين تُدار إلكترونياً، مع تسجيل المراجعات الفنية ومراجعات الجودة.', ['sk-fs-dp-procurement']],
];

/** [year, person, share_pct, team_size, submitted_on] synthetic answers from line-manager role cards */
const PULSE = [
  [2025, 'p-group-ceo', 30, 40, '2025-10-02'], [2025, 'p-cpo', 25, 18, '2025-10-06'], [2025, 'p-head-sq', 20, 14, '2025-10-08'], [2025, 'p-ciso', 45, 12, '2025-09-30'],
  [2025, 'p-ops-ceo', 25, 60, '2025-10-13'], [2025, 'p-outage-manager', 30, 22, '2025-10-20'], [2025, 'p-work-control', 35, 16, '2025-11-03'], [2025, 'p-dra', 20, 9, '2025-10-27'],
  [2025, 'p-ep-manager', 15, 11, '2025-11-10'], [2025, 'p-rp-lead', 25, 13, '2025-11-17'], [2025, 'p-chem-sup', 30, 10, '2025-12-01'],
  [2026, 'p-group-ceo', 40, 40, '2026-09-21'], [2026, 'p-cpo', 35, 18, '2026-09-22'], [2026, 'p-head-sq', 30, 14, '2026-09-24'], [2026, 'p-ciso', 55, 12, '2026-09-23'],
  [2026, 'p-incident-commander', 50, 8, '2026-09-25'], [2026, 'p-ops-ceo', 35, 60, '2026-09-28'], [2026, 'p-outage-manager', 40, 22, '2026-09-29'], [2026, 'p-work-control', 45, 16, '2026-09-30'],
  [2026, 'p-dra', 30, 9, '2026-10-01'], [2026, 'p-emergency-director', 25, 20, '2026-10-02'], [2026, 'p-ep-manager', 20, 11, '2026-10-05'], [2026, 'p-rp-lead', 35, 13, '2026-10-06'],
  [2026, 'p-chem-sup', 40, 10, '2026-10-07'],
];

/** [quarter, publisher, role, published_at] */
const RUNS = [['2025-Q4', 'p-k-hr-analyst', 'hr_analyst', '2026-01-12T08:00:00Z'], ['2026-Q1', 'p-k-hr-analyst', 'hr_analyst', '2026-04-09T08:00:00Z'],
  ['2026-Q2', 'p-chco', 'hr_director', '2026-07-08T08:00:00Z'], ['2026-Q3', 'p-k-hr-analyst', 'hr_analyst', '2026-10-06T08:00:00Z']];
const BADGE_RUNS = [['2026-Q1', '2026-04-07T08:00:00Z'], ['2026-Q2', '2026-07-07T08:00:00Z'], ['2026-Q3', '2026-10-07T08:00:00Z']];
/** earlier answers to suggestions: [person, skill, status, responded_on] (applied before the 2026-10-11 suggestions) */
export const ANSWERS = [['p-k-ro', 'sk-ch-01-primary', 'rejected', '2026-08-20'], ['p-k-ro', 'sk-pf-03-aux', 'not_me', '2026-03-05'], ['p-sro', 'sk-sc-02', 'rejected', '2026-09-02']];

export const CARD = {
  id: 'skill_suggestions', engine_surface: 'skills', module: 'M28', route: '/my/skills/suggestions', feature: 'FS72',
  title_en: 'Skills you may have', title_ar: 'مهارات قد تمتلكها',
  purpose_en: 'Suggests up to six skills I may already have, from my work and learning records, so I can confirm, reject or say "not me". Nothing is shown to anyone else until I confirm.',
  purpose_ar: 'يقترح حتى ست مهارات قد أمتلكها بالفعل، من سجلات عملي وتعلّمي، لأؤكدها أو أرفضها أو أقول "لا تخصني". لا يظهر شيء لأي شخص آخر حتى أؤكد.',
  owner_en: 'Training Manager (role card)', owner_ar: 'مدير التدريب (بطاقة دور)',
  inputs_used: [
    { key: 'person_skills', en: 'The skills I already hold and how each is evidenced (held skills are never suggested)', ar: 'المهارات التي أمتلكها وكيف ثبتت كل منها (لا تُقترح المهارات المثبتة)' },
    { key: 'opportunity_applications', en: 'Gigs and opportunities I completed, and which skills the signed-off outcome levelled', ar: 'الفرص والمهام التي أكملتها، والمهارات التي حدّد مستواها الاعتماد النهائي' },
    { key: 'contributions', en: 'My validated expert contributions (lectures and knowledge assets)', ar: 'مساهماتي الخبيرة المعتمدة (المحاضرات وأصول المعرفة)' },
    { key: 'xapi_statements', en: 'My learning-record statements in the last year (refresher answers, simulator scenarios, knowledge assets used)', ar: 'بيانات سجل تعلّمي خلال العام الماضي (إجابات المراجعات وسيناريوهات المحاكي وأصول المعرفة المستخدمة)' },
    { key: 'skill_co_occurrence', en: 'Which skills staff hold together (counts only, groups under 10 never used, me excluded)', ar: 'المهارات التي يمتلكها الموظفون معاً (أعداد فقط، لا تُستخدم المجموعات الأقل من 10، وأنا مستبعد)' },
    { key: 'skills_adjacency', en: 'The catalogue\'s list of skills next to each other', ar: 'قائمة الكتالوج للمهارات المتجاورة' },
  ],
  inputs_excluded: ['gender', 'nationality_flag', 'age'],
  scoring_functions: ['src/modules/m28/suggestions.ts#inferSuggestions', 'sql:kafaa_ssg_candidates'],
  weight_keys: [],
  output_en: 'Up to six suggestions, strongest first, each with its reasons; confirming adds my own claim (never more than claimed), rejecting or "not me" hides it for 180 days.',
  output_ar: 'حتى ستة اقتراحات، الأقوى أولاً، لكل منها أسبابه؛ التأكيد يضيف ادعائي الخاص (ولا يتجاوز درجة الادعاء)، والرفض أو "لا تخصني" يخفيه 180 يوماً.',
  oversight_en: 'The rules and points are published on the card and the page; suggestions are private to me and never reach a manager. It never decides anything on its own: I choose, and a claim stays a claim until someone validates it.',
  oversight_ar: 'القواعد والنقاط منشورة على البطاقة والصفحة؛ والاقتراحات خاصة بي ولا تصل إلى أي مدير. لا يقرّر شيئاً بمفرده: أنا من يختار، ويبقى الادعاء ادعاءً حتى يعتمده شخص.',
  limitations_en: 'It only sees what Kafa\'a records; a skill learned elsewhere will not be suggested. Co-occurrence reflects who holds what today, not what a role needs.',
  limitations_ar: 'لا يرى إلا ما تسجّله كفاءة؛ ولن تُقترح مهارة اكتُسبت في مكان آخر. ويعكس الاقتران من يمتلك ماذا اليوم، لا ما يحتاجه الدور.',
  opt_out: false, version: 1, last_changed_at: '2026-10-11T00:00:00Z', last_change_id: null,
  sources: [
    { label: 'TechWolf · Workday customer story (skills inference with governance)', url: 'https://www.techwolf.ai/customer-stories/workday', as_of: '2026-10-11' },
    { label: 'LinkedIn Economic Graph research', url: 'https://economicgraph.linkedin.com/research', as_of: '2026-10-11' },
  ],
  sort: 35, kernel_surface: 'rules', ranks: 'content', fairness_metric: 'suggestion_offered', fairness_none: null,
};

const names = (T) => new Map(T.skills.map((s) => [s.id, s]));
function summary(T, res) {
  const s = names(T);
  const top = (cat) => res.rows.filter((r) => r.category === cat).slice(0, 3).map((r) => s.get(r.skill_id));
  const n = res.counts;
  if (!n.now && !n.growing) return ['No skill crossed the published thresholds this quarter: every signal was under 10 or did not rise enough.', 'لم تتجاوز أي مهارة العتبات المنشورة هذا الربع: كانت كل إشارة أقل من 10 أو لم ترتفع بما يكفي.'];
  const en = [], ar = [];
  if (n.now) { en.push(`${n.now} in demand now (led by ${top('now').map((x) => x.name_en).join(', ')})`); ar.push(`${n.now} مطلوبة الآن (في مقدمتها ${top('now').map((x) => x.name_ar).join('، ')})`); }
  if (n.growing) { en.push(`${n.growing} growing (led by ${top('growing').map((x) => x.name_en).join(', ')})`); ar.push(`${n.growing} في نمو (في مقدمتها ${top('growing').map((x) => x.name_ar).join('، ')})`); }
  return [`${en.join('; ')}.`, `${ar.join('؛ ')}.`];
}

export default function build(T) {
  T.technologies = [];
  T.manager_pulse = PULSE.map(([year, person, share_pct, team_size, on]) => {
    const p = T.people.find((x) => x.id === person);
    if (!p) throw new Error(`fs70: pulse person ${person} missing`);
    return { id: `mp:${year}:${person}`, year, person_id: person, family_id: p.job_family_id ?? null, team_size, share_pct, submitted_at: `${on}T09:00:00Z`, updated_at: `${on}T09:00:00Z` };
  });
  T.skill_signal_runs = T.skill_signal_runs ?? [];
  T.skill_signals = T.skill_signals ?? [];
  T.technology_links = T.technology_links ?? [];
  T.technology_badges = T.technology_badges ?? [];
  T.skill_suggestions = T.skill_suggestions ?? [];
  T.skill_suggestion_fairness = T.skill_suggestion_fairness ?? [];
}

/** Tag every non-draft opportunity and every published role-profile version with the technologies whose related skills it names. */
export function buildLinks(T, versions = T.role_profile_versions) {
  const roleFam = new Map(T.job_roles.map((r) => [r.id, r.family_id ?? null]));
  const out = [];
  const add = (tech, table, ref, family_id, role_id, on) => out.push({ id: `tl:${tech}:${table}:${ref}`, technology_id: tech, ref_table: table, ref_id: ref, family_id, role_id, source_on: on, active: true, linked_by: TM, linked_at: '2026-10-10T09:00:00Z' });
  for (const t of T.technologies) {
    const sk = new Set(t.skill_ids);
    for (const o of [...T.opportunities].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (o.status === 'draft') continue;
      if ([...(o.skills_needed ?? []), ...(o.skills_gained ?? [])].some((s) => sk.has(s))) add(t.id, 'opportunities', o.id, o.family_id ?? null, o.host_role_id ?? null, String(o.created_at).slice(0, 10));
    }
    for (const v of [...versions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (!(v.status === 'published' || v.status === 'superseded') || !v.published_at) continue;
      if ((v.requirements ?? []).some((r) => r.kind === 'skill' && sk.has(r.ref_id))) add(t.id, 'role_profile_versions', v.id, roleFam.get(v.role_id) ?? null, v.role_id, String(v.published_at).slice(0, 10));
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The role-profile versions as the wave-A integration (fsqa1, FINALIZE_LAST after this builder) leaves them: 2030/2035 requirements that
 *  name an F01 skill with an FS02 future equivalent point at the future skill. Read-only copy; T.role_profile_versions is not changed here. */
export function finalVersions(T) {
  return (T.role_profile_versions ?? []).map((v) => (v.horizon === 'now' || !(v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? v : { ...v, requirements: remapRequirements(v.requirements) }));
}

export function finalize(T) {
  const versions = finalVersions(T);
  const raw = (t) => (t === 'role_profile_versions' ? versions : T[t] ?? []);
  // FS71: the catalogue (the FS02 skills exist only after fs02's finalize), links and the published badge lists
  T.technologies = TECHS.map(([id, category, name_en, name_ar, description_en, description_ar, skill_ids], i) => ({
    id, name_en, name_ar, description_en, description_ar, category, skill_ids, status: 'active', version: 1, created_by: TM, created_at: '2026-10-10T08:00:00Z', updated_by: null, updated_at: '2026-10-10T08:00:00Z', sort: i + 1,
  }));
  const skillIds = T.skills.map((s) => s.id);
  for (const t of T.technologies) {
    const p = techProblem({ ...t, status: 'active' }, skillIds, true);
    if (p || brandHits(`${t.name_en} ${t.name_ar} ${t.description_en} ${t.description_ar}`).length) throw new Error(`fs70: technology ${t.id} fails the catalogue check (${p ?? 'brand'})`);
  }
  T.technology_links = buildLinks(T, versions);
  T.technology_badges = [];
  for (const [q, at] of BADGE_RUNS) {
    const res = technologyBadges(badgeInputFromTables(raw), q);
    if (!res.hot.length && !res.roles.length) continue; // nothing to publish for that quarter (the RPC refuses an empty list too)
    for (const x of res.hot) T.technology_badges.push({ id: `tb:${q}:enec:${x.technology_id}`, quarter: q, technology_id: x.technology_id, scope: 'enec', role_id: null, rank: x.rank, sources: x.sources, families: x.families,
      recent: x.recent, via_profile: false, family_opportunities: 0, criteria: res.criteria, published_by: TM, published_at: at });
    for (const x of res.roles) T.technology_badges.push({ id: `tb:${q}:${x.role_id}:${x.technology_id}`, quarter: q, technology_id: x.technology_id, scope: 'role', role_id: x.role_id, rank: null, sources: 0, families: 0,
      recent: 0, via_profile: x.via_profile, family_opportunities: x.family_opportunities, criteria: res.criteria, published_by: TM, published_at: at });
  }
  // FS70: the published Skills on the Rise lists
  T.skill_signal_runs = [];
  T.skill_signals = [];
  const inp = signalInputFromTables(raw);
  for (const [q, by, role, at] of RUNS) {
    if (!quarterBounds(q)) throw new Error(`fs70: bad quarter ${q}`);
    const res = risingSkills(inp, q);
    const [se, sa] = summary(T, res);
    T.skill_signal_runs.push({ id: `ssr:${q}`, quarter: q, method: res.method, status: 'published', counts: res.counts, published_by: by, published_role: role, published_at: at, summary_en: se, summary_ar: sa });
    for (const r of res.rows) T.skill_signals.push({ id: `ss:${q}:${r.skill_id}`, run_id: `ssr:${q}`, quarter: q, skill_id: r.skill_id, category: r.category, rank: r.rank, score: r.score, moved_by: r.moved_by,
      signals: r.signals, families: r.families, reasons: r.reasons, published_at: at });
  }
  // FS72: earlier answers, then every active staff member's suggestions on SUGGEST_DAY
  const rows = [];
  const w0 = ssgWorldFromTables(raw);
  for (const [person, skill, status, on] of ANSWERS) {
    const c = inferSuggestions({ ...w0, suggestions: [] }, person, SUGGEST_DAY).find((x) => x.skill_id === skill);
    if (!c) throw new Error(`fs70: ${person} ${skill} is not a suggestion on ${SUGGEST_DAY}`);
    const first = new Date(Date.parse(`${on}T00:00:00Z`) - 9 * 86_400_000).toISOString().slice(0, 10);
    rows.push({ id: suggestionId(person, skill), person_id: person, skill_id: skill, status, level: c.level, score: c.score, sources: c.sources, reasons: c.reasons, first_on: first, generated_on: first,
      responded_on: on, suppressed_until: suppressedUntil(on), evidence_id: null, history: [], version: 2, updated_at: `${on}T10:00:00Z` });
  }
  T.skill_suggestions = rows;
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();
  const w = ssgWorldFromTables(raw);
  for (const pid of staff) {
    const plan = refreshPlan(pid, T.skill_suggestions, inferSuggestions(w, pid, SUGGEST_DAY), SUGGEST_DAY);
    for (const r of plan.inserts) T.skill_suggestions.push({ ...r, updated_at: `${SUGGEST_DAY}T06:00:00Z` });
    for (const u of plan.updates) Object.assign(T.skill_suggestions.find((r) => r.id === u.id), u.patch, { updated_at: `${SUGGEST_DAY}T06:00:00Z` });
  }
  T.skill_suggestions.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.skill_suggestion_fairness = suggestionFairness(T.people, T.skill_suggestions, SUGGEST_DAY).map((r) => ({ ...r, run_by: 'p-ai-governance', created_at: `${SUGGEST_DAY}T07:00:00Z` }));
  // FS55: the engine card of the new ranked surface
  if (!T.engine_cards.some((c) => c.id === CARD.id)) T.engine_cards.push({ ...CARD });
  const open = T.skill_suggestions.filter((r) => r.status === 'open').length;
  console.log(`fs70: ${T.skill_signal_runs.length} Skills on the Rise lists (${T.skill_signals.length} rows), ${T.manager_pulse.length} pulse answers; ${T.technologies.length} technologies, ${T.technology_links.length} tags, `
    + `${T.technology_badges.length} badges over ${new Set(T.technology_badges.map((x) => x.quarter)).size} quarters; ${open} open suggestions for ${new Set(T.skill_suggestions.filter((r) => r.status === 'open').map((r) => r.person_id)).size} people, `
    + `${T.skill_suggestions.filter((r) => r.status !== 'open').length} answered; ${T.skill_suggestion_fairness.length} fairness rows; engine card ${CARD.id}`);
}
