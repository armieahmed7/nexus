// FS23 Behaviourally anchored descriptors + FS24 Scale mapping and Authority recognition (FS wave C · E4, module M02) seed.
//  1. level_attributes: generic attributes (essence, autonomy, influence, complexity, knowledge, behaviours) x the four Kafa'a levels,
//     SFIA 9 style, each with the SFIA 9 level of responsibility it corresponds to.
//  2. skill_level_ranges: for every skill (120) the levels where it exists, its track (technical / behavioural) and the published
//     rationale (full 1-4; licence-like plant tasks 2-4; leading 2-4; advanced-reactor skills 1-3 "not operated"; fusion 1-2 "watch";
//     security and cyber hygiene 1-2 "awareness only"; declining or obsolete practices 1-3).
//  3. skill_descriptors: one published row per skill and level in range: a skill-specific level essence and 2-4 observable indicators
//     (2 at level 1, 4 at the skill's key level, 3 otherwise) in EN and AR, with evidence modes; composed from the behaviour
//     families and per-skill anchors in fs23-descriptors.data.mjs. Every row passes checkDescriptor (the rule SQL kafaa_sd_check
//     mirrors). Plus one draft outside a range (sk-ld-01 level 1) and one edited row (version 2), so the editor shows the lifecycle.
//  4. scale_maps: the five external scales (SFIA 9, SkillsFuture, DigComp, UNESCO AI, UAE NQF), their levels from the source, and
//     the map from each Kafa'a band (not yet, 1-4, Authority) with the fit and a note; every row cites its source and an as-of date.
//  5. authority_recognitions: synthetic panel decisions on level-4 holders (two recognised, two awaiting the HR director, one
//     "not yet"), proposed by the training manager and decided by the HR director (maker-checker). Notifications for the open ones.
// Runs as a FINALIZE_LAST finalizer ("fs23" sorts after fs02, whose finalizer appends the FS02 skills, and after fs08, which adds
// the skill frameworks). Synthetic people only.
import { ANCHORS, ADVANCED_F01, FAMILIES, LEADING, LEVEL_ATTRIBUTES, RATIONALE } from './fs23-descriptors.data.mjs';
import { ATTRIBUTES, checkDescriptor, checkRange, descriptorId, isTemplated } from '../../../src/modules/m02/descriptors.ts';
import { checkPropose, addYearsIso, authorityId, rowCitesSource } from '../../../src/modules/m02/authority.ts';

export const FINALIZE_LAST = true;
const READ_ON = '2026-10-10';
const EDITOR = 'p-training-mgr';
const AT = '2026-10-09T08:00:00Z';

// Arabic: the clitics بـ / لـ join the anchor (ب + الـ = بالـ, ل + الـ = للـ), so no tatweel is left in the text.
const joinAr = (pat, k, v) => pat.replace(new RegExp(`بـ\\{${k}\\}`, 'g'), `ب${v}`).replace(new RegExp(`لـ\\{${k}\\}`, 'g'), v.startsWith('ال') ? `لل${v.slice(2)}` : `ل${v}`);
const fill = (pat, a) => ['o', 's', 'w'].reduce((p, k) => joinAr(p, k, a[k]), pat).replace(/\{o\}/g, a.o).replace(/\{s\}/g, a.s).replace(/\{w\}/g, a.w);
const both = (pair, anchors) => [fill(pair[0], { o: anchors.o[0], s: anchors.s[0], w: anchors.w[0] }), fill(pair[1], { o: anchors.o[1], s: anchors.s[1], w: anchors.w[1] })];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function familyOf(s) {
  if (s.fs_area === 'transversal') return 'behavioural';
  if (s.fs_area === 'ai_data') return 'digital';
  if (s.fs_area === 'green_energy') return 'green';
  if (s.fs_area === 'advanced_reactor' || ADVANCED_F01.includes(s.id)) return 'advanced';
  if (s.fs_area === 'cyber_hygiene' || s.area === 'security') return 'cyber';
  if (s.fs_area === 'digital_plant') return s.area === 'maintenance' ? 'maintenance' : s.area === 'operations' ? 'plant' : 'digital';
  return ({ plant_systems: 'plant', operations: 'plant', maintenance: 'maintenance', radiation_chemistry: 'radchem', engineering: 'engineering', project: 'engineering',
    safety: 'safety', quality: 'safety', emergency: 'emergency', human_performance: 'behavioural', leadership: 'behavioural', digital: 'digital' })[s.area] ?? 'engineering';
}
export function rangeOf(s) {
  const fam = familyOf(s);
  if (fam === 'cyber') return { basis: 'awareness_only', min: 1, max: 2 };
  if (s.id === 'sk-fs-adv-fusion') return { basis: 'watch', min: 1, max: 2 };
  if (fam === 'advanced') return { basis: 'not_operated', min: 1, max: 3 };
  if (s.lifecycle === 'declining' || s.lifecycle === 'obsolete') return { basis: 'declining', min: 1, max: 3 };
  if (LEADING.includes(s.id)) return { basis: 'leading', min: 2, max: 4 };
  if (s.skill_type === 'licence_like') return { basis: 'licence_like', min: 2, max: 4 };
  return { basis: 'full', min: 1, max: 4 };
}
/** Indicators for a skill at a level: 2 at level 1, 4 at the key level, else 3; patterns rotate by skill so neighbours differ. */
export function composeDescriptor(s, level) {
  const fam = FAMILIES[familyOf(s)];
  const a = ANCHORS[s.id];
  if (!a) throw new Error(`fs23: no anchors for ${s.id}`);
  const L = fam[level];
  if (!L) throw new Error(`fs23: family ${familyOf(s)} has no level ${level}`);
  const n = level === Number(s.key_level ?? 2) ? 4 : level === 1 ? 2 : 3;
  const start = hash(`${s.id}:${level}`) % 4;
  const picks = Array.from({ length: n }, (_, i) => L.i[(start + i) % 4]).map((p) => both(p, a));
  const [een, ear] = both(L.e, a);
  return { essence_en: een, essence_ar: ear, indicators_en: picks.map((p) => p[0]), indicators_ar: picks.map((p) => p[1]), evidence_modes: [...L.m] };
}

// ───────────── FS24 scale map: external scales from the sources the FS01 benchmark rows cite (read 2026-10-10)
const SRC = {
  sfia9: 'https://sfia-online.org/en/sfia-9/responsibilities',
  skillsfuture: 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf',
  digcomp: 'https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en',
  unesco_ai: 'https://gcedclearinghouse.org/en/node/146447',
  uae_nqf: 'https://uaelegislation.gov.ae/en/legislations/2615/download',
};
const BM = { sfia9: 'SFIA9', skillsfuture: 'SSG-SF', digcomp: 'DIGCOMP', unesco_ai: 'AI-LIT', uae_nqf: 'UAE-NQF' };
const n = (k, en, ar) => ({ n: k, en, ar });
const SCALES = {
  sfia9: { levels: [n(1, 'Follow', 'يتبع'), n(2, 'Assist', 'يساعد'), n(3, 'Apply', 'يطبّق'), n(4, 'Enable', 'يمكّن'), n(5, 'Ensure, advise', 'يضمن ويستشير'), n(6, 'Initiate, influence', 'يبادر ويؤثر'), n(7, 'Set strategy, inspire, mobilise', 'يضع الاستراتيجية ويُلهم ويحشد')],
    note: ['Seven levels of responsibility, defined by generic attributes that apply to every skill; skills are defined only at the levels where they exist.', 'سبعة مستويات للمسؤولية تحددها سمات عامة تنطبق على كل مهارة، ولا تُعرَّف المهارات إلا في المستويات التي توجد فيها.'] },
  skillsfuture: { levels: [1, 2, 3, 4, 5, 6].map((k) => n(k, `Proficiency level ${k}`, `مستوى الإتقان ${k}`)),
    note: ['Technical skills and competencies use proficiency levels 1 to 6; critical core skills use Basic, Intermediate and Advanced.', 'تستخدم المهارات والكفاءات التقنية مستويات إتقان من 1 إلى 6، وتستخدم المهارات الأساسية الحرجة مستويات أساسي ومتوسط ومتقدم.'] },
  digcomp: { levels: [n(1, 'Foundation', 'تأسيسي'), n(2, 'Foundation', 'تأسيسي'), n(3, 'Intermediate', 'متوسط'), n(4, 'Intermediate', 'متوسط'), n(5, 'Advanced', 'متقدم'), n(6, 'Advanced', 'متقدم'), n(7, 'Highly specialised', 'متخصص جداً'), n(8, 'Highly specialised', 'متخصص جداً')],
    note: ['Eight proficiency levels in four bands for each of the 21 competences; applies to digital skills only.', 'ثمانية مستويات إتقان في أربع فئات لكل كفاءة من الكفاءات الإحدى والعشرين، وتنطبق على المهارات الرقمية فقط.'] },
  unesco_ai: { levels: [n(1, 'Understand', 'يفهم'), n(2, 'Apply', 'يطبّق'), n(3, 'Create', 'يبتكر')],
    note: ['Three progression levels for the student framework (Understand, Apply, Create); applies to AI skills only. Secondary summaries; confirm against the UNESCO original.', 'ثلاثة مستويات تدرّج في إطار الطلاب (يفهم، يطبّق، يبتكر)، وتنطبق على مهارات الذكاء الاصطناعي فقط. مصدرها ملخصات ثانوية، ويلزم التأكد منها في النص الأصلي لليونسكو.'] },
  uae_nqf: { levels: Array.from({ length: 10 }, (_, i) => n(i + 1, `NQF level ${i + 1}`, `المستوى ${i + 1} في الإطار الوطني للمؤهلات`)),
    note: ['Ten levels, each defining the knowledge, skills and competence of a qualification (Cabinet Resolution on the National Qualifications Framework).', 'عشرة مستويات يحدد كل منها المعرفة والمهارات والكفاءة المطلوبة لمؤهل ما (قرار مجلس الوزراء بشأن الإطار الوطني للمؤهلات).'] },
};
// [band, from, to, fit, note_en, note_ar]
const NY = ['Below level 1: not yet held or not yet assessed. Kafa\'a shows "not yet", never zero.', 'دون المستوى الأول: لم تُكتسب المهارة بعد أو لم تُقيَّم بعد. تعرض كفاءة "ليس بعد" ولا تعرض صفراً.'];
const MAPS = {
  sfia9: [
    ['not_yet', null, null, 'none', ...NY],
    ['l1', 1, 2, 'close', 'Awareness covers SFIA Follow and Assist: close direction, routine tasks.', 'يغطي مستوى الإلمام مستويي "يتبع" و"يساعد" في SFIA: توجيه مباشر ومهام روتينية.'],
    ['l2', 3, 3, 'close', 'Practitioner matches Apply: routine work under general direction.', 'يطابق مستوى الممارس مستوى "يطبّق": أعمال روتينية بتوجيه عام.'],
    ['l3', 4, 4, 'close', 'Qualified matches Enable: independent work and checking others.', 'يطابق مستوى المؤهَّل مستوى "يمكّن": عمل مستقل ومراجعة عمل الآخرين.'],
    ['l4', 5, 5, 'close', 'Expert matches Ensure, advise: sets the standard and advises across teams.', 'يطابق مستوى الخبير مستوى "يضمن ويستشير": يضع المعيار ويقدّم المشورة عبر الفرق.'],
    ['authority', 6, 7, 'loose', 'Authority is recognition, not a level: SFIA 6-7 also carry organisational accountability an Authority may not hold.', 'الصفة المرجعية اعتراف وليست مستوى: يتضمن المستويان 6 و7 في SFIA مسؤولية مؤسسية قد لا يحملها المرجع.'],
  ],
  skillsfuture: [
    ['not_yet', null, null, 'none', ...NY],
    ['l1', 1, 1, 'close', 'Awareness matches proficiency level 1.', 'يطابق مستوى الإلمام مستوى الإتقان 1.'],
    ['l2', 2, 3, 'loose', 'Practitioner spans levels 2 and 3: SkillsFuture splits supervised practice in two.', 'يمتد مستوى الممارس على المستويين 2 و3: تقسم SkillsFuture الممارسة تحت الإشراف إلى مستويين.'],
    ['l3', 4, 4, 'close', 'Qualified matches level 4: independent and accountable.', 'يطابق مستوى المؤهَّل المستوى 4: عمل مستقل ومسؤول.'],
    ['l4', 5, 5, 'close', 'Expert matches level 5: leads practice and develops others.', 'يطابق مستوى الخبير المستوى 5: يقود الممارسة ويطوّر الآخرين.'],
    ['authority', 6, 6, 'loose', 'Authority corresponds loosely to level 6 (sector-level thought leadership); it is a recognition, not a level.', 'تقابل الصفة المرجعية المستوى 6 تقريباً (ريادة فكرية على مستوى القطاع)، وهي اعتراف وليست مستوى.'],
  ],
  digcomp: [
    ['not_yet', null, null, 'none', ...NY],
    ['l1', 1, 2, 'close', 'Awareness matches the Foundation band (1-2).', 'يطابق مستوى الإلمام الفئة التأسيسية (1-2).'],
    ['l2', 3, 4, 'close', 'Practitioner matches the Intermediate band (3-4).', 'يطابق مستوى الممارس الفئة المتوسطة (3-4).'],
    ['l3', 5, 6, 'close', 'Qualified matches the Advanced band (5-6).', 'يطابق مستوى المؤهَّل الفئة المتقدمة (5-6).'],
    ['l4', 7, 8, 'close', 'Expert matches the Highly specialised band (7-8).', 'يطابق مستوى الخبير فئة المتخصص جداً (7-8).'],
    ['authority', 8, 8, 'loose', 'DigComp has nothing above level 8; Authority is a recognition on top of it, not a level.', 'لا يوجد في DigComp ما يتجاوز المستوى 8، والصفة المرجعية اعتراف إضافي وليست مستوى.'],
  ],
  unesco_ai: [
    ['not_yet', null, null, 'none', ...NY],
    ['l1', 1, 1, 'close', 'Awareness matches Understand.', 'يطابق مستوى الإلمام مستوى "يفهم".'],
    ['l2', 2, 2, 'close', 'Practitioner matches Apply.', 'يطابق مستوى الممارس مستوى "يطبّق".'],
    ['l3', 2, 2, 'loose', 'Qualified still reads as Apply: UNESCO has no separate independent level.', 'يبقى مستوى المؤهَّل ضمن "يطبّق": لا يوجد في إطار اليونسكو مستوى مستقل منفصل.'],
    ['l4', 3, 3, 'loose', 'Expert reads as Create: designing and improving AI use, not only applying it.', 'يقابل مستوى الخبير مستوى "يبتكر": تصميم استخدام الذكاء الاصطناعي وتحسينه لا تطبيقه فقط.'],
    ['authority', 3, 3, 'loose', 'Nothing above Create; Authority is a recognition, not a level.', 'لا شيء فوق "يبتكر"، والصفة المرجعية اعتراف وليست مستوى.'],
  ],
  uae_nqf: [
    ['not_yet', null, null, 'none', ...NY],
    ['l1', 3, 4, 'loose', 'NQF levels describe qualifications, not job proficiency: indicative only until NQC-recognised assessors review it.', 'تصف مستويات الإطار الوطني المؤهلات لا الإتقان الوظيفي: الربط إرشادي فقط حتى يراجعه مقيّمون معتمدون من المركز الوطني للمؤهلات.'],
    ['l2', 4, 5, 'loose', 'Indicative: supervised practice in a regulated workplace.', 'إرشادي: ممارسة تحت الإشراف في بيئة عمل منظَّمة.'],
    ['l3', 5, 6, 'loose', 'Indicative: independent practice to a qualification standard.', 'إرشادي: ممارسة مستقلة وفق معيار تأهيل.'],
    ['l4', 7, 7, 'loose', 'Indicative: specialist practice that sets standards for others.', 'إرشادي: ممارسة تخصصية تضع المعايير للآخرين.'],
    ['authority', 8, 8, 'loose', 'Indicative only: no qualification is awarded by an Authority recognition, and Kafa\'a is not a recognition authority.', 'إرشادي فقط: لا يُمنح أي مؤهل بموجب الاعتراف بالصفة المرجعية، وكفاءة ليست جهة اعتماد.'],
  ],
};
export function scaleRows() {
  const rows = [];
  let sort = 0;
  for (const fw of Object.keys(SCALES)) {
    const sc = SCALES[fw];
    rows.push({ id: `sm:${fw}:scale`, framework: fw, row_kind: 'scale', band: null, levels: sc.levels, level_count: sc.levels.length, ext_from: null, ext_to: null, fit: null,
      label_en: '', label_ar: '', note_en: sc.note[0], note_ar: sc.note[1], source_url: SRC[fw], as_of: READ_ON, benchmark_id: BM[fw], sort: sort++ });
    for (const [band, from, to, fit, en, ar] of MAPS[fw]) {
      const lv = from == null ? null : sc.levels.filter((l) => l.n >= from && l.n <= to);
      const uniq = (xs) => [...new Set(xs)].join(' / ');
      rows.push({ id: `sm:${fw}:${band}`, framework: fw, row_kind: 'map', band, levels: [], level_count: null, ext_from: from, ext_to: to, fit,
        label_en: lv ? uniq(lv.map((l) => l.en)) : '', label_ar: lv ? uniq(lv.map((l) => l.ar)) : '', note_en: en, note_ar: ar, source_url: SRC[fw], as_of: READ_ON, benchmark_id: BM[fw], sort: sort++ });
    }
  }
  return rows;
}

// ───────────── FS24 Authority recognitions (synthetic): [person, skill, status, proposed_on, decided_on, panel, citation_en, citation_ar, note_en]
const PANEL = ['hr_director', 'training_manager', 'skill_owner', 'external_peer'];
const AUTH = [
  ['w-sro-01', 'sk-co-03', 'recognised', '2026-06-02', '2026-06-16', PANEL,
    'Sets the reactivity management standard used on every unit: wrote the reactivity plan review guide and leads the simulator scenarios that test it.',
    'يضع معيار إدارة التفاعلية المعتمد في جميع الوحدات: كتب دليل مراجعة خطط التفاعلية ويقود سيناريوهات المحاكي التي تختبرها.', null],
  ['p-sro', 'sk-ld-02', 'recognised', '2026-08-25', '2026-09-08', ['hr_director', 'training_manager', 'line_manager', 'external_peer'],
    'Recognised across crews for conservative decisions under uncertainty; the decision-making debriefs led on shift are now part of licensed operator continuing training.',
    'يحظى بالاعتراف عبر الأطقم لاتخاذه قرارات متحفظة في ظروف عدم اليقين؛ وأصبحت جلسات مراجعة القرارات التي يقودها في النوبة جزءاً من التدريب المستمر للمشغلين المرخصين.', null],
  ['w-rp-01', 'sk-rp-01', 'proposed', '2026-10-06', null, ['hr_director', 'training_manager', 'skill_owner'],
    'Leads the dose-limit refresher used for every new radiation worker and the reviews of dose trends shared with peer plants.',
    'يقود دورة التذكير بحدود الجرعات لكل عامل إشعاعي جديد، ومراجعات اتجاهات الجرعات التي تُشارك مع المحطات النظيرة.', null],
  ['w-qa-01', 'sk-qa-01', 'proposed', '2026-10-08', null, ['hr_director', 'training_manager', 'skill_owner', 'senior_instructor'],
    'Interprets NQA-1 requirements for suppliers and site teams; the supplier quality briefings written are used by procurement and quality alike.',
    'يفسّر متطلبات NQA-1 للموردين وفرق الموقع؛ وتستخدم إحاطات جودة الموردين التي أعدّها إدارتا المشتريات والجودة على حد سواء.', null],
  ['p-ep-manager', 'sk-ep-01', 'not_yet', '2026-08-04', '2026-08-20', ['hr_director', 'training_manager', 'external_peer'],
    'Runs the emergency response organisation drills for the site and coaches every new position holder.',
    'يدير تمارين منظمة الاستجابة للطوارئ في الموقع ويوجّه كل شاغل منصب جديد.',
    'Strong drill record. The panel would like evidence of standard-setting beyond the site plan, such as a reviewed change to the emergency plan, before recognising Authority.'],
];

export default function build() {}

export function finalize(T) {
  const skills = T.skills;
  const byId = new Map(skills.map((s) => [s.id, s]));
  const core = new Map(skills.filter((s) => s.core).map((s) => [s.competency_id, s]));
  // 1. level attributes
  T.level_attributes = [];
  for (const lv of [1, 2, 3, 4]) {
    ATTRIBUTES.forEach((attr, i) => {
      const [en, ar] = LEVEL_ATTRIBUTES.levels[lv][attr];
      const [nen, nar] = LEVEL_ATTRIBUTES.names[attr];
      if (isTemplated(en) || isTemplated(ar)) throw new Error(`fs23: level attribute ${lv}/${attr} reuses a template`);
      T.level_attributes.push({ id: `la:${lv}:${attr}`, level: lv, attribute: attr, name_en: nen, name_ar: nar, text_en: en, text_ar: ar, sfia_levels: LEVEL_ATTRIBUTES.sfia[lv], sort: lv * 10 + i });
    });
  }
  // 2 + 3. ranges and descriptors
  T.skill_level_ranges = [];
  T.skill_descriptors = [];
  for (const s of skills) {
    const r = rangeOf(s);
    const parent = core.get(s.competency_id);
    const [ren, rar] = RATIONALE[r.basis];
    const rationale_en = ren.replace('{parent}', parent && parent.id !== s.id ? parent.name_en : 'the core skill');
    const rationale_ar = rar.replace('{parent}', parent && parent.id !== s.id ? parent.name_ar : 'المهارة الأساسية');
    const range = { id: `slr:${s.id}`, skill_id: s.id, min_level: r.min, max_level: r.max, basis: r.basis, track: familyOf(s) === 'behavioural' ? 'behavioural' : 'technical',
      rationale_en, rationale_ar, version: 1, updated_by: EDITOR, updated_at: AT };
    T.skill_level_ranges.push(range);
    for (let lv = r.min; lv <= r.max; lv++) {
      const d = composeDescriptor(s, lv);
      const row = { id: descriptorId(s.id, lv), skill_id: s.id, level: lv, ...d, status: 'published', listed: true, version: 1, created_by: EDITOR, created_at: AT, updated_by: EDITOR, updated_at: AT };
      const sk = { id: s.id, area: s.area, fs_area: s.fs_area ?? null, lifecycle: s.lifecycle === 'obsolete' ? 'stable' : s.lifecycle }; // obsolete skills keep descriptors written before
      const c = checkDescriptor({ ...row, publish: true }, { skill: sk, range: { min_level: r.min, max_level: r.max } });
      if (c !== 'ok') throw new Error(`fs23: ${row.id} fails ${c}`);
      T.skill_descriptors.push(row);
    }
    const rc = checkRange({ skill_id: s.id, min_level: r.min, max_level: r.max, basis: r.basis, rationale_en, rationale_ar }, { skill: { ...s, lifecycle: s.lifecycle === 'obsolete' ? 'stable' : s.lifecycle }, levels: [1, 2, 3, 4].filter((l) => l >= r.min && l <= r.max), current: null });
    if (rc !== 'ok') throw new Error(`fs23: range of ${s.id} fails ${rc}`);
  }
  // an edited row (version 2, by an instructor) and a draft outside a range (a proposal to define level 1 of Leading effective teams)
  const ver = T.skill_descriptors.find((d) => d.id === 'sd:sk-fs-ai-verify:3');
  Object.assign(ver, { indicators_en: [...ver.indicators_en.slice(0, 3), 'Records every AI output it relied on, with the controlled source used to verify it.'],
    indicators_ar: [...ver.indicators_ar.slice(0, 3), 'يسجّل كل مخرجات ذكاء اصطناعي اعتمد عليها، مع المصدر المعتمد الذي استُخدم للتحقق منها.'], version: 2, updated_by: 'p-k-instructor', updated_at: '2026-10-09T13:20:00Z' });
  const draft = {
    id: descriptorId('sk-ld-01', 1), skill_id: 'sk-ld-01', level: 1,
    essence_en: 'Knows what good team leadership looks like on shift and supports the team lead.', essence_ar: 'يعرف ملامح القيادة الجيدة للفريق في النوبة ويدعم قائد الفريق.',
    indicators_en: ['Describes how the team lead sets priorities at the start of a shift.', 'Speaks up in team briefs and follows through on assigned actions.'],
    indicators_ar: ['يصف كيف يحدد قائد الفريق الأولويات في بداية النوبة.', 'يبدي رأيه في إحاطات الفريق وينفّذ الإجراءات المسندة إليه.'],
    evidence_modes: ['interview', 'peer'], status: 'draft', listed: false, version: 1, created_by: 'p-k-instructor', created_at: '2026-10-09T15:00:00Z', updated_by: 'p-k-instructor', updated_at: '2026-10-09T15:00:00Z',
  };
  if (checkDescriptor({ ...draft, publish: false }, { skill: byId.get('sk-ld-01'), range: { min_level: 2, max_level: 4 } }) !== 'ok') throw new Error('fs23: draft fails');
  T.skill_descriptors.push(draft);
  // 4. scale maps (frameworks come from FS08)
  const fws = new Set((T.skill_frameworks ?? []).map((f) => f.id));
  const bms = new Set((T.benchmarks ?? []).map((b) => b.id));
  T.scale_maps = scaleRows();
  for (const r of T.scale_maps) {
    if (!fws.has(r.framework)) throw new Error(`fs23: scale map ${r.id} names unknown framework ${r.framework}`);
    if (!bms.has(r.benchmark_id)) throw new Error(`fs23: scale map ${r.id} follows unknown benchmark ${r.benchmark_id}`);
    if (!rowCitesSource(r)) throw new Error(`fs23: scale map ${r.id} cites no https source`);
  }
  // 5. Authority recognitions (checked with the propose rule against the derived states)
  const people = new Map(T.people.map((p) => [p.id, p]));
  T.authority_recognitions = AUTH.map(([pid, sk, status, proposed, decided, panel, cen, car, note]) => {
    const p = people.get(pid);
    const s = byId.get(sk);
    const ps = (T.person_skills ?? []).find((x) => x.person_id === pid && x.skill_id === sk && x.active !== false);
    const c = checkPropose({ panel, citation_en: cen, citation_ar: car }, { me: EDITOR, person: p, skill: s, level: ps ? ps.level : 0, open: false });
    if (c !== 'ok') throw new Error(`fs23: authority ${pid} ${sk} fails ${c}`);
    const recognised = status === 'recognised';
    return {
      id: authorityId(pid, sk, 1), person_id: pid, person_name: p.display_name ?? '', person_name_ar: p.display_name_ar || p.display_name || '', skill_id: sk, status, panel, citation_en: cen, citation_ar: car,
      level_at_proposal: 4, basis_at_proposal: ps.basis, proposed_by: EDITOR, proposed_role: 'training_manager', proposed_on: proposed,
      decided_by: decided ? 'p-chco' : null, decided_role: decided ? 'hr_director' : null, decided_on: decided, decision_note: note, recognised_on: recognised ? decided : null,
      review_due: recognised ? addYearsIso(decided, 3) : null, withdrawn_by: null, withdrawn_on: null, created_at: `${proposed}T09:00:00Z`, updated_at: `${decided ?? proposed}T09:00:00Z`,
    };
  });
  if (Array.isArray(T.notifications)) {
    for (const r of T.authority_recognitions.filter((x) => x.status === 'proposed')) {
      const s = byId.get(r.skill_id);
      T.notifications.push({ id: `nt-ar-${r.id}-proposed-p-chco`, person_id: 'p-chco', kind: 'skills', title_en: `Authority recognition awaiting your decision: ${s.name_en}`, title_ar: `اعتراف بصفة مرجعية بانتظار قرارك: ${s.name_ar}`,
        body_en: null, body_ar: null, link: '/admin/authority', severity: 'info', created_at: `${r.proposed_on}T09:00:00Z`, read_at: null });
    }
  }
}
