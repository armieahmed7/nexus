// FS04 (FS wave A · E3, M11) seed: one future-skill keyspace and the corrected radar scenarios.
//   * future_skill_map: every ADVANCE skill (as-*; from the F01 catalogue mapping skills.adv_skill_ids plus a few foundation skills that
//     transfer or adapt), every radar key and every gap-plan key resolved to catalogue skills (sk-*), with relation and need level.
//   * adv_skills.sk_ids, future_skills.sk_id / target_level, skill_gap_plans.sk_id back-filled from the map.
//   * Scenario B (SIMULATED) gets its own sourced demand assumptions (the G4 seed carried Scenario A's values into B because
//     "Scenario B (SIMULATED)" contains an "A"). The B values keep the same total as A, so the mean ADVANCE index the F35 skills
//     outlook reads (src/modules/m07/outlook.ts) is unchanged and its seeded results stay valid.
//   * Four more synthetic HR gap-plan actions (one keyed directly to a catalogue skill). Role cards only, no names, no headcount.
// Readiness is never seeded: rpc.futureRadar computes it from person_skills (src/modules/m11/keyspace.ts).
import { mapId, rowsOf, resolveSk, unresolvedKeys, scenarioDifferences } from '../../../src/modules/m11/keyspace.ts';
import { publicTextIsClean } from '../../../src/domain/future.ts';

const AS_OF = '2026-10-10';
const A = 'Scenario A (SIMULATED)';
const B = 'Scenario B (SIMULATED)';
// Public sources for the scenario assumptions (research pack scratchpad/fs/nuclear_energy.md, read 10 Oct 2026).
const EXTRA = {
  'iaea-ngt310': { label: 'IAEA · NG-T-3.10 Workforce Planning for New Nuclear Power Programmes (2011)', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf' },
  'ans-canada-smr': { label: 'ANS · Education and training to support Canadian nuclear workforce development (Nov 2025)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/' },
  'iea-wee-2025': { label: 'NucNet · IEA World Energy Employment 2025: nuclear jobs growth (Dec 2025)', url: 'https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025' },
  'iaea-ai-bulletin': { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence' },
};

// Radar keys -> catalogue skills: [sk_id, relation, need_level, note_en, note_ar]; the first row is the primary skill.
const RADAR = {
  'liquid-metal': [
    ['sk-pf-02-advcool', 'new', 2, 'The new capability itself: liquid-metal coolant systems.', 'القدرة الجديدة نفسها: أنظمة التبريد بالمعادن السائلة.'],
    ['sk-ch-01-advchem', 'new', 2, 'Sodium and lead coolant chemistry.', 'كيمياء مبرّدات الصوديوم والرصاص.'],
    ['sk-pf-02', 'adapts', 3, 'Thermal-hydraulics at qualified level adapts to liquid-metal heat transfer.', 'تتكيّف الهيدروليكا الحرارية بمستوى مؤهل مع انتقال الحرارة في المعادن السائلة.'],
  ],
  'salt-chemistry': [
    ['sk-ch-01-advchem', 'new', 2, 'Molten-salt chemistry and corrosion control.', 'كيمياء الأملاح المنصهرة وضبط التآكل.'],
    ['sk-ch-01', 'adapts', 3, 'Water chemistry control at qualified level adapts to salt chemistry.', 'يتكيّف ضبط كيمياء المياه بمستوى مؤهل مع كيمياء الأملاح.'],
    ['sk-ch-02', 'adapts', 3, 'Radiochemistry and effluent monitoring carry over with new matrices.', 'تنتقل الكيمياء الإشعاعية ومراقبة المخلفات مع مصفوفات جديدة.'],
  ],
  'gas-coolant': [
    ['sk-pf-02-advcool', 'new', 2, 'Helium coolant systems are part of the advanced-coolant skill.', 'أنظمة التبريد بالهيليوم جزء من مهارة المبرّدات المتقدمة.'],
    ['sk-pf-02', 'adapts', 2, 'Thermodynamics and heat transfer adapt to gas cooling.', 'تتكيّف الديناميكا الحرارية وانتقال الحرارة مع التبريد بالغاز.'],
    ['sk-pf-01-advfuel', 'new', 2, 'TRISO fuel and graphite core materials.', 'وقود TRISO ومواد القلب الغرافيتية.'],
  ],
  'remote-ops': [
    ['sk-da-01-remote', 'new', 2, 'Remote monitoring and oversight of autonomous control.', 'المراقبة عن بعد والإشراف على التحكم الذاتي.'],
    ['sk-co-01-rounds', 'adapts', 3, 'Field rounds and equipment monitoring adapt to remote surveillance.', 'تتكيّف الجولات الميدانية ومراقبة المعدات مع المراقبة عن بعد.'],
    ['sk-da-01', 'adapts', 2, 'Digital tools and data literacy at practitioner level.', 'الأدوات الرقمية ومحو الأمية البيانية بمستوى ممارس.'],
  ],
  'bwr-ops': [
    ['sk-pf-03-rcs', 'adapts', 3, 'Reactor coolant system knowledge adapts to a boiling water design.', 'تتكيّف معرفة نظام تبريد المفاعل مع تصميم الماء المغلي.'],
    ['sk-co-01', 'transfers', 3, 'Procedure use and adherence transfers as it is.', 'ينتقل استخدام الإجراءات والالتزام بها كما هو.'],
    ['sk-co-03', 'transfers', 3, 'Reactivity management transfers.', 'تنتقل إدارة التفاعلية.'],
  ],
  'owners-engineer': [
    ['sk-en-01-project', 'adapts', 2, 'Project controls and owner\'s engineering adapt to projects abroad.', 'تتكيّف ضوابط المشاريع وهندسة المالك مع المشاريع في الخارج.'],
    ['sk-en-01', 'transfers', 3, 'Configuration management and design control transfer.', 'تنتقل إدارة التهيئة وضبط التصميم.'],
    ['sk-qa-01', 'transfers', 3, 'NQA-1 quality assurance transfers to vendor oversight.', 'ينتقل ضمان الجودة وفق NQA-1 إلى الإشراف على الموردين.'],
  ],
  'digital-twins': [
    ['sk-da-01-twins', 'new', 2, 'Digital twins and plant data models.', 'التوائم الرقمية ونماذج بيانات المحطة.'],
    ['sk-en-02-perf', 'adapts', 2, 'System performance trending adapts to model-based monitoring.', 'يتكيّف تتبّع أداء الأنظمة مع المراقبة القائمة على النماذج.'],
    ['sk-da-01-analysis', 'adapts', 2, 'Data analysis and visualisation.', 'تحليل البيانات وتصويرها.'],
    ['sk-en-02', 'adapts', 3, 'System health monitoring at qualified level.', 'مراقبة سلامة الأنظمة بمستوى مؤهل.'],
  ],
  'ai-governance': [
    ['sk-da-02', 'new', 2, 'Governed use of AI.', 'الاستخدام المحوكم للذكاء الاصطناعي.'],
    ['sk-da-02-review', 'new', 2, 'Reviewing AI outputs under governance: the duty to verify and challenge.', 'مراجعة مخرجات الذكاء الاصطناعي ضمن الحوكمة: واجب التحقق والاعتراض.'],
    ['sk-da-01', 'adapts', 2, 'Digital tools and data literacy at practitioner level.', 'الأدوات الرقمية ومحو الأمية البيانية بمستوى ممارس.'],
  ],
};
// Foundation skills added to a few ADVANCE skills beyond the F01 catalogue mapping: [as-id, sk_id, relation, need, note_en, note_ar].
const ADV_EXTRA = [
  ['as-passive-safety', 'sk-ns-01', 'adapts', 3, 'Defence in depth adapts to passive safety functions.', 'يتكيّف الدفاع في العمق مع وظائف السلامة الخاملة.'],
  ['as-new-licensing-basis', 'sk-ns-02', 'adapts', 3, 'Technical specifications and the current licensing basis.', 'المواصفات الفنية وأساس الترخيص الحالي.'],
  ['as-conduct-of-ops', 'sk-co-01', 'transfers', 3, 'Procedure use and adherence.', 'استخدام الإجراءات والالتزام بها.'],
  ['as-reactivity', 'sk-co-03', 'transfers', 3, 'Reactivity management.', 'إدارة التفاعلية.'],
  ['as-radiological-work', 'sk-rp-02', 'transfers', 2, 'ALARA planning and radiation work permits.', 'تخطيط ALARA وتصاريح العمل الإشعاعي.'],
  ['as-digital-twins', 'sk-da-02', 'adapts', 2, 'Governed use of AI around the twin.', 'الاستخدام المحوكم للذكاء الاصطناعي حول التوأم الرقمي.'],
];

// Scenario demand index (SIMULATED, 0-100) with the assumption behind it. A keeps the G4 values; B is new and sums to the same total.
const SCN = {
  [A]: {
    sources: ['wnn-advance', 'iaea-ngt310'],
    rows: {
      'liquid-metal': [20, 'Fast-reactor partners stay at memorandum stage; liquid-metal skills serve evaluation and research collaboration only.', 'يبقى شركاء المفاعلات السريعة في مرحلة مذكرات التفاهم؛ وتخدم مهارات المعادن السائلة التقييم والتعاون البحثي فقط.'],
      'salt-chemistry': [37, 'Molten-salt research ties continue with academic partners; chemistry demand stays exploratory.', 'تستمر روابط أبحاث الأملاح المنصهرة مع الشركاء الأكاديميين؛ ويبقى الطلب على الكيمياء استكشافياً.'],
      'gas-coolant': [54, 'High-temperature gas reactors are studied for process heat with industrial users; engineers need working knowledge of helium systems.', 'تُدرس المفاعلات الغازية عالية الحرارة لحرارة العمليات مع المستخدمين الصناعيين؛ ويحتاج المهندسون إلى معرفة عملية بأنظمة الهيليوم.'],
      'remote-ops': [71, 'Microreactor and digital-plant studies make remote monitoring a recurring evaluation theme.', 'تجعل دراسات المفاعلات المتناهية الصغر والمحطة الرقمية المراقبة عن بعد محوراً متكرراً في التقييم.'],
      'bwr-ops': [28, 'Small boiling water designs are one option among several; operators need orientation only.', 'تصاميم الماء المغلي الصغيرة خيار من بين عدة خيارات؛ ويحتاج المشغّلون إلى التعريف فقط.'],
      'owners-engineer': [45, 'Advisory work abroad keeps owner\'s-engineer skills in steady demand.', 'يُبقي العمل الاستشاري في الخارج الطلب على مهارات مهندس المالك ثابتاً.'],
      'digital-twins': [62, 'Plant-data platforms broaden digital-twin work, always separate from reactor control systems.', 'توسّع منصات بيانات المحطة العمل على التوائم الرقمية، بمعزل دائم عن أنظمة التحكم في المفاعل.'],
      'ai-governance': [79, 'Governed AI use spreads across functions; every AI-assisted workflow needs people who verify and challenge outputs.', 'ينتشر الاستخدام المحوكم للذكاء الاصطناعي في الوظائف؛ ويحتاج كل مسار عمل مدعوم بالذكاء الاصطناعي إلى من يتحقق من المخرجات ويعترض عليها.'],
    },
  },
  [B]: {
    sources: ['ans-canada-smr', 'iea-wee-2025', 'iaea-ngt310'],
    rows: {
      'liquid-metal': [14, 'A light-water SMR option leads the evaluation; fast-reactor work drops to a watching brief.', 'يتصدّر خيار المفاعل الصغير بالماء الخفيف التقييم؛ ويتراجع العمل على المفاعلات السريعة إلى المتابعة.'],
      'salt-chemistry': [12, 'Molten-salt research continues only through academic partners.', 'تستمر أبحاث الأملاح المنصهرة عبر الشركاء الأكاديميين فقط.'],
      'gas-coolant': [30, 'Process-heat studies continue at a lower intensity than in Scenario A.', 'تستمر دراسات حرارة العمليات بوتيرة أقل من السيناريو أ.'],
      'remote-ops': [58, 'Remote monitoring matters for multi-module control rooms, less than for microreactors.', 'تهمّ المراقبة عن بعد غرف التحكم متعددة الوحدات، بدرجة أقل من المفاعلات المتناهية الصغر.'],
      'bwr-ops': [86, 'Boiling water systems, passive safety and conduct of operations become the main reskilling need, as in SMR workforce programmes abroad.', 'تصبح أنظمة الماء المغلي والسلامة الخاملة وإدارة العمليات الحاجة الرئيسية لإعادة التأهيل، كما في برامج القوى العاملة للمفاعلات الصغيرة في الخارج.'],
      'owners-engineer': [64, 'Owner\'s-engineer skills rise to oversee a vendor-led SMR project.', 'ترتفع الحاجة إلى مهارات مهندس المالك للإشراف على مشروع مفاعل صغير يقوده المورّد.'],
      'digital-twins': [60, 'Digital twins support design review and construction, much as in Scenario A.', 'تدعم التوائم الرقمية مراجعة التصميم والإنشاء، كما في السيناريو أ تقريباً.'],
      'ai-governance': [72, 'Governed AI use still spreads, a little behind the SMR project in priority.', 'يستمر انتشار الاستخدام المحوكم للذكاء الاصطناعي، بأولوية أقل قليلاً من مشروع المفاعل الصغير.'],
    },
  },
};

const PLANS = [
  ['gp-4', 'bwr-ops', B, 'reskill', 'Operations Training (role)', '2027-Q3', 'active', 'Cross-over module on boiling water systems and passive safety for senior operators, built on SMR workforce programmes abroad.', 'p-k-hr-analyst', -9],
  ['gp-5', 'ai-governance', A, 'train', 'Digital Transformation (role)', '2027-Q1', 'active', 'Governed-AI essentials with an output-verification drill for every function using AI assistants.', 'p-chco', -15],
  ['gp-6', 'digital-twins', A, 'partner', 'Engineering (role)', '2027-Q4', 'draft', 'Explore a twin-validation short course with a university partner; twins stay separate from reactor control.', 'p-k-hr-analyst', -3],
  ['gp-7', 'sk-da-02-review', B, 'train', 'Nuclear Training (role)', '2028-Q1', 'draft', 'Keyed directly to the catalogue skill: practise reviewing AI outputs and recording the challenge.', 'p-k-hr-analyst', -1],
];

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export default function build(T, ctx) {
  const today = ctx?.DEMO_TODAY ?? '2026-10-08';
  const reg = new Map((T.sources ?? []).map((s) => [s.id, s]));
  const S = (ids) => ids.map((id) => {
    const r = reg.get(id) ?? EXTRA[id];
    if (!r) throw new Error(`fs04: unknown source ${id}`);
    return { id, label: r.label, url: r.url, as_of: r.accessed ?? AS_OF };
  });
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const sec = (id) => skills.get(id)?.area === 'security';
  const map = [];
  const add = (key, key_kind, sk_id, relation, need_level, note_en, note_ar, primary_sk) => {
    if (!skills.has(sk_id)) throw new Error(`fs04: unknown catalogue skill ${sk_id}`);
    if (sec(sk_id)) throw new Error(`fs04: security skill ${sk_id} on the future-skill map`);
    const id = mapId(key, sk_id);
    if (map.some((m) => m.id === id)) return;
    map.push({ id, key, key_kind, sk_id, relation, need_level, primary_sk, active: true, note_en, note_ar, sort: map.filter((m) => m.key === key).length + 1, updated_by: null, updated_at: `${today}T00:00:00Z` });
  };

  // ADVANCE skills: the F01 mapping (skills.adv_skill_ids) with the ADVANCE relation, then foundation extras.
  for (const a of [...T.adv_skills].sort((x, y) => x.sort - y.sort)) {
    const mapped = T.skills.filter((s) => (s.adv_skill_ids ?? []).includes(a.id)).sort((x, y) => (x.id < y.id ? -1 : 1));
    mapped.forEach((s, i) => add(a.id, 'adv_skill', s.id, a.relation, 2, a.skill_en, a.skill_ar, i === 0));
  }
  for (const [as, sk, rel, need, en, ar] of ADV_EXTRA) add(as, 'adv_skill', sk, rel, need, en, ar, false);
  // Radar keys (also every gap-plan key: the seeded plans use radar keys or catalogue ids)
  for (const [key, rows] of Object.entries(RADAR)) rows.forEach(([sk, rel, need, en, ar], i) => add(key, 'radar', sk, rel, need, en, ar, i === 0));
  T.future_skill_map = map;

  for (const a of T.adv_skills) a.sk_ids = rowsOf(map, a.id).map((m) => m.sk_id);

  // Radar scenarios: own sourced assumptions; mean index unchanged (F35 reads it).
  const sumBefore = T.future_skills.reduce((s, f) => s + Number(f.value), 0);
  for (const f of T.future_skills) {
    const sc = SCN[f.scenario];
    const r = sc?.rows[f.skill_key];
    if (!r) throw new Error(`fs04: no assumption for ${f.scenario} / ${f.skill_key}`);
    f.value = r[0];
    f.assumption_en = `${r[1]} SIMULATED.`;
    f.assumption_ar = `${r[2]} (محاكاة)`;
    f.sources = S(sc.sources);
    f.sk_id = resolveSk(map, f.skill_key);
    f.target_level = 2;
  }
  const sumAfter = T.future_skills.reduce((s, f) => s + Number(f.value), 0);
  if (sumAfter !== sumBefore) throw new Error(`fs04: radar total changed (${sumBefore} -> ${sumAfter}); the F35 outlook reads the mean`);
  const d = scenarioDifferences(T.future_skills, A, B);
  if (d.differ < 6) throw new Error(`fs04: scenarios differ on ${d.differ} of ${d.total} skills`);

  // Gap plans: re-keyed to catalogue skills (the old key stays as the label), plus four more synthetic HR actions.
  for (const [id, key, scenario, action, owner_role, target_quarter, status, note, by, days] of PLANS) {
    T.skill_gap_plans.push({ id, skill_key: key, scenario, action, owner_role, target_quarter, status, note, created_by: by, created_at: `${addDays(today, days)}T08:30:00Z`, updated_at: null });
  }
  for (const p of T.skill_gap_plans) p.sk_id = p.skill_key.startsWith('sk-') ? p.skill_key : resolveSk(map, p.skill_key);

  const bad = unresolvedKeys({ advSkills: T.adv_skills, futureSkills: T.future_skills, plans: T.skill_gap_plans, map, skills: T.skills });
  if (bad.length) throw new Error(`fs04: keys without a catalogue skill: ${bad.join(', ')}`);
  if (!publicTextIsClean(map.flatMap((m) => [m.note_en, m.note_ar]))) throw new Error('fs04: map notes fail publicTextIsClean');
}
