// FS wave F · E2 seed: FS52 AI and automation exposure in the skills outlook + FS53 external benchmark lines (M07).
// build(): kafaa_benchmark_values, one row per FS01 figure used on the workforce dashboards, copied from kafaa_benchmarks.figures (value,
//   unit, scale, labels, as-of date and one of the benchmark's https URLs are taken from the registry, never typed here). Each row records
//   its verification tier from the research packs (docs/kafaa/ref/research/*.md): only "primary" figures are drawn; figures the packs flag
//   as secondary or unverified are stored held, with the reason, and their value is never shown (settled decision for wave F).
// finalize(): FINALIZE_LAST ("fs52" sorts after f35 and every earlier FS builder that refreshes the stored outlooks): checks only, no
//   writes. (1) Every stored outlook equals the outlook recomputed with automation adoption 0, byte for byte (FS52 acceptance). (2) The
//   F35 stress test still reads "every visible family falls short". (3) Every benchmark value passes benchmarkValueProblems (FS53).
// The FS52 automation factor itself needs no seed rows: it reads the FS06 task layer (jta_tasks, jta_task_skills) that FS06 seeded.
import { benchmarkValueProblems } from '../../../src/modules/m07/market.ts';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';

export const FINALIZE_LAST = true;

/** One entry per stored row: benchmark id, figure key, metric, verification tier and research-pack reference, whether it is drawn, the internal measure it sits beside, the dashboards, notes or the held reason (EN and AR). */
const SPEC = [
  {
    bench: 'SSG-SF', key: 'ai_aided_tasks', metric: 'ai_task_share', verification: 'primary', shown: true, compare: 'ai_task_share', dashboards: ['skills_outlook', 'overview'],
    pack: 'research/national_systems.md §1.2 (SSG Factsheet 2, primary PDF verified by direct download)',
    note_en: 'Singapore, about 37,000 key work tasks scored for AI potential. Its method differs from the FS06 exposure rule (augment or partly automatable): read it as context, not a target.',
    note_ar: 'سنغافورة، نحو 37,000 مهمة عمل رئيسية قُيّمت لإمكانات الذكاء الاصطناعي. تختلف منهجيتها عن قاعدة التعرّض في FS06 (تعزيز أو أتمتة جزئية): اقرأها سياقاً لا هدفاً.',
  },
  {
    bench: 'FORECAST', key: 'priority_demand_growth_2030', metric: 'demand_growth_2030', verification: 'primary', shown: true, compare: 'demand_growth_2030', dashboards: ['skills_outlook', 'overview'],
    pack: 'research/national_systems.md §3.1 (Skills England, primary, read directly from the report)',
    note_en: 'United Kingdom, priority-occupation employment 2025 to 2030 across ten sectors. ENEC\'s figure is SIMULATED demand for skill families 2026 to 2030: context, not a like-for-like comparison.',
    note_ar: 'المملكة المتحدة، التوظيف في المهن ذات الأولوية من 2025 إلى 2030 في عشرة قطاعات. رقم مؤسسة الإمارات للطاقة النووية طلب محاكى لفئات المهارات من 2026 إلى 2030: سياق وليس مقارنة مباشرة.',
  },
  {
    bench: 'DIGCOMP', key: 'above_basic_eu_2023', metric: 'digital_above_basic', verification: 'primary', shown: true, compare: 'digital_holders', dashboards: ['skills_outlook', 'overview'],
    pack: 'research/global_frameworks.md §9 (JRC DigComp page, read directly 2026-10-10)',
    note_en: 'All EU adults with above-basic digital skills (2023). ENEC\'s figure is staff at Practitioner level or above in the digital skill family, a higher bar: read it as context.',
    note_ar: 'جميع البالغين في الاتحاد الأوروبي ممن لديهم مهارات رقمية فوق الأساسية (2023). رقم المؤسسة هو الموظفون بمستوى ممارس فأعلى في فئة المهارات الرقمية، وهو معيار أعلى: اقرأه سياقاً.',
  },
  {
    bench: 'UK-NUC', key: 'new_jobs_2030', metric: 'new_nuclear_jobs_2030', verification: 'primary', shown: true, compare: null, dashboards: ['skills_outlook'],
    pack: 'research/nuclear_energy.md §9 (World Nuclear News, verified: curl 2026-10-10)',
    note_en: 'A national sector target for the United Kingdom, shown as market context only; it is not compared with any ENEC number.',
    note_ar: 'هدف قطاعي وطني في المملكة المتحدة، يُعرض سياقاً للسوق فقط ولا يُقارن بأي رقم للمؤسسة.',
  },
  {
    bench: 'WEF-FOJ', key: 'core_skills_change_2030', metric: 'core_skills_change_2030', verification: 'secondary', shown: false, compare: null, dashboards: [],
    pack: 'research/global_frameworks.md §1 [WEF-secondary]: weforum.org was blocked from the research container',
    held_en: 'Held back: the research pack corroborates this figure from secondary reports only (weforum.org could not be read). It returns once someone reads the WEF page itself.',
    held_ar: 'محجوب: يؤكد ملف البحث هذا الرقم من تقارير ثانوية فقط (تعذّرت قراءة موقع المنتدى). يعود بعد قراءة صفحة المنتدى نفسها.',
  },
  {
    bench: 'ENERGY-JOBS', key: 'firms_reporting_shortages', metric: 'firms_reporting_shortages', verification: 'secondary', shown: false, compare: null, dashboards: [],
    pack: 'research/nuclear_energy.md §16 [secondary]: trade-press reports of the IEA survey',
    held_en: 'Held back: the research pack takes the IEA survey result from trade press [secondary]. It returns once the IEA report itself is read.',
    held_ar: 'محجوب: يأخذ ملف البحث نتيجة مسح الوكالة الدولية للطاقة من الصحافة المتخصصة [ثانوي]. يعود بعد قراءة تقرير الوكالة نفسه.',
  },
  {
    bench: 'ENERGY-JOBS', key: 'energy_jobs_2024', metric: 'energy_jobs', verification: 'secondary', shown: false, compare: null, dashboards: [],
    pack: 'research/nuclear_energy.md §16 [secondary]: trade-press reports of World Energy Employment 2025',
    held_en: 'Held back: secondary in the research pack (trade-press summary of the IEA report).',
    held_ar: 'محجوب: ثانوي في ملف البحث (ملخص صحفي لتقرير الوكالة الدولية للطاقة).',
  },
  {
    bench: 'EU-PACT', key: 'people_trained', metric: 'people_trained', verification: 'secondary', shown: false, compare: null, dashboards: [],
    pack: 'research/global_frameworks.md §7: the 2025 total is reported by euricse.eu and cepis.org; the Commission page linked reports the 2024 survey',
    held_en: 'Held back: the linked Commission page reports the 2024 survey; the cumulative 2025 total comes from secondary sites. It returns once the Commission publishes it.',
    held_ar: 'محجوب: صفحة المفوضية المرتبطة تعرض مسح 2024؛ أما إجمالي 2025 التراكمي فمصدره مواقع ثانوية. يعود بعد نشر المفوضية له.',
  },
  {
    bench: 'SMR-WF', key: 'hires_2023_2033', metric: 'sector_hires', verification: 'secondary', shown: false, compare: null, dashboards: [], url: 2,
    pack: 'research/nuclear_energy.md §11 [secondary]: MATCH figures from GIFEN/EDF summaries',
    held_en: 'Held back: secondary in the research pack (MATCH programme summaries).',
    held_ar: 'محجوب: ثانوي في ملف البحث (ملخصات برنامج MATCH).',
  },
  {
    bench: 'UAE-PEERS', key: 'staff_trained_ai', metric: 'peer_ai_trained', verification: 'secondary', shown: false, compare: null, dashboards: [],
    pack: 'research/corporate_platforms.md A11 [S, company-reported]',
    held_en: 'Held back: company-reported and tagged secondary [S] in the research pack.',
    held_ar: 'محجوب: رقم أعلنته الشركة ومصنّف ثانوياً [S] في ملف البحث.',
  },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function build(T) {
  const rows = [];
  SPEC.forEach((s, i) => {
    const b = (T.benchmarks ?? []).find((x) => x.id === s.bench);
    const f = (b?.figures ?? []).find((x) => x.key === s.key);
    if (!b || !f) throw new Error(`fs52 seed: figure ${s.bench}/${s.key} is not in kafaa_benchmarks`);
    rows.push({
      id: `bv-${slug(s.bench)}-${slug(s.key)}`, benchmark_id: b.id, figure_key: f.key, metric: s.metric, label_en: f.label_en, label_ar: f.label_ar,
      value: f.value, unit: f.unit, scale_max: f.scale_max ?? null, as_of: b.as_of, source_url: b.urls[s.url ?? 0],
      verification: s.verification, shown: s.shown, held_reason_en: s.held_en ?? '', held_reason_ar: s.held_ar ?? '', pack_ref: s.pack,
      compare_to: s.compare, dashboards: s.dashboards, note_en: s.note_en ?? '', note_ar: s.note_ar ?? '', sort: (i + 1) * 10,
    });
  });
  T.benchmark_values = rows;
}

export function finalize(T) {
  // FS53: every row is an exact copy of a sourced figure; only primary figures are drawn
  for (const r of T.benchmark_values) {
    const p = benchmarkValueProblems(r, T.benchmarks);
    if (p.length) throw new Error(`fs52 seed: benchmark value ${r.id}: ${p.join(', ')}`);
  }
  // FS52: adoption 0 reproduces every stored outlook byte for byte
  const inp = inputFromTables((t) => T[t] ?? []);
  for (const o of T.skill_outlooks ?? []) {
    for (const params of [o.params, { ...o.params, automation_adoption: 0 }]) {
      const r = outlookFor(inp, params);
      if (r.code !== 'ok' || JSON.stringify(r.result) !== JSON.stringify(o.results)) throw new Error(`fs52 seed: outlook ${o.id} differs from its stored results with automation adoption 0`);
    }
  }
  const stress = (T.skill_outlooks ?? []).find((o) => o.id === 'so-attrition-stress');
  if (stress && stress.results.totals.families_short !== stress.results.totals.visible) throw new Error('fs52 seed: the F35 stress test no longer reads every visible family short');
}
