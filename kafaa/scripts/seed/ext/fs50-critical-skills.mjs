// FS wave F · E1 seed (FS50 Critical Future-Skills Register + FS51 three-scenario skill forecasts, M35 Workforce Strategy and Disclosure).
// FINALIZE_LAST: runs after F01/FS02/FS03 have derived the final skill states (and after every wave-E builder, before fsqa*; no later
// builder changes person_skills), so every stored number equals what the RPCs compute on the seeded data (checked by
// scripts/validate/fs61-strategy-forecasts.mjs and tests/unit/fs61-*). Synthetic only: owners and reviewers are role cards.
//  - critical_skills: 13 register rows (11 adopted, 2 drafts by the HR analyst) on FS02 / F01 skills, every row with an owner (function +
//    role card), people-equivalent targets by year, KPIs, a build / buy / borrow / bot decision with its rationale in EN and AR, and the
//    FS04 gap plans of the same skill (5 of the 7 plans are linked). Progress is never stored: the board computes it.
//  - critical_skill_reviews: 2026-Q3 reviews (register opened 2026-07-01) by the HR director with the computed progress snapshot; one
//    decision change (digital twin validation: buy -> borrow). Two rows adopted in Q3 have no Q3 review, so they read "overdue" in Q4.
//  - skill_forecasts: the 2025 pilot refresh (established 71-skill catalogue: a different method basis, so year-on-year comparison is
//    blocked), the released 2026 annual refresh (plan against ADVANCE) and two 2026 drafts. Results computed with the RPC rules.
import { forecastFor, forecastInputFromTables, simulatedName } from '../../../src/modules/m35/forecast.ts';
import { boardInputFromTables, criticalBoard, criticalProblem } from '../../../src/modules/m35/critical.ts';
import { publicTextIsClean } from '../../../src/domain/future.ts';
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { remapRequirements } from './fsqa1-integration.mjs';

export const FINALIZE_LAST = true;
const BENCH = ['IAEA-WFP', 'ISO30414', 'FORECAST'];

const ROWS = [
  {
    skill_id: 'sk-fs-ai-verify', owner_function: 'digital_ai_governance', owner_person_id: 'p-ai-governance', target_level: 2,
    targets: [{ year: 2026, pe: 1800 }, { year: 2028, pe: 2200 }, { year: 2030, pe: 2600 }, { year: 2035, pe: 2900 }],
    kpis: [{ kind: 'holders_pe', target: 2000 }, { kind: 'share_l3', target: 25 }, { kind: 'forecast_gap_mid', target: 0 }], decision: 'build',
    rationale_en: 'Every 2030 and 2035 role profile asks people to check AI output before anyone acts on it. The skill is learnt on the job with the FS10 check and FS21 assessment, so ENEC builds it in-house through the AI fluency ladder.',
    rationale_ar: 'تطلب ملفات الأدوار لعامي 2030 و2035 من الجميع التحقق من مخرجات الذكاء الاصطناعي قبل التصرف بناءً عليها. وتُكتسب هذه المهارة في العمل عبر فحص الجاهزية والتقييم التكيفي، لذا تبنيها الشركة داخلياً من خلال سلّم الطلاقة في الذكاء الاصطناعي.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 1, reviewed: { rating: 'on_track', on: '2026-09-28T09:00:00Z' },
  },
  {
    skill_id: 'sk-fs-ai-plantdata', owner_function: 'engineering', owner_person_id: 'p-sme-reviewer', target_level: 2,
    targets: [{ year: 2026, pe: 2200 }, { year: 2030, pe: 2700 }, { year: 2035, pe: 3000 }],
    kpis: [{ kind: 'holders_pe', target: 2400 }, { kind: 'share_l3', target: 15 }], decision: 'build',
    rationale_en: 'Plant-data quality decides whether condition monitoring and digital twins can be trusted. Engineers and technicians already hold the basics; targeted practice moves them to working level without new hires.',
    rationale_ar: 'تحدد جودة بيانات المحطة مدى الثقة في مراقبة الحالة والتوائم الرقمية. ويمتلك المهندسون والفنيون الأساسيات بالفعل، وتنقلهم الممارسة الموجّهة إلى مستوى العمل دون تعيينات جديدة.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 2, reviewed: { rating: 'met', on: '2026-09-28T09:20:00Z' },
  },
  {
    skill_id: 'sk-fs-ai-twin', owner_function: 'digital_ai_governance', owner_person_id: 'p-ai-governance', target_level: 2,
    targets: [{ year: 2026, pe: 1200 }, { year: 2028, pe: 1500 }, { year: 2030, pe: 1800 }],
    kpis: [{ kind: 'holders_pe', target: 1200 }, { kind: 'share_l3', target: 20 }], decision: 'borrow',
    rationale_en: 'Validating a digital twin needs vendor model knowledge that ENEC does not hold yet. A partner secondment and joint reviews borrow it for the first twins while the twin drills build the internal base.',
    rationale_ar: 'يتطلب التحقق من صحة التوأم الرقمي معرفة بنماذج المورّد لا تملكها الشركة بعد. لذلك تُستعار هذه المعرفة عبر انتداب لدى شريك ومراجعات مشتركة للتوائم الأولى، بينما تبني تمارين التوأم الرقمي القاعدة الداخلية.',
    history: { decision: 'buy', rationale_en: 'Hire two twin validation specialists from the market.', rationale_ar: 'تعيين اختصاصيَّين في التحقق من التوائم الرقمية من السوق.' },
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 3, reviewed: { rating: 'at_risk', on: '2026-09-29T08:30:00Z', decision_before: 'buy' },
  },
  {
    skill_id: 'sk-da-01-twins', owner_function: 'digital_ai_governance', owner_person_id: 'p-ai-governance', target_level: 2,
    targets: [{ year: 2027, pe: 300 }, { year: 2030, pe: 700 }],
    kpis: [{ kind: 'holders_pe', target: 300 }, { kind: 'plans_active', target: 1 }], decision: 'borrow',
    rationale_en: 'Digital twin and plant data models are new to the fleet. The FS04 partner plan brings in a research partner course; until ten or more people hold the skill, progress stays suppressed by design.',
    rationale_ar: 'التوائم الرقمية ونماذج بيانات المحطة جديدة على الأسطول. وتستقدم خطة الشريك دورة من شريك بحثي، وإلى أن يمتلك عشرة أشخاص أو أكثر هذه المهارة يبقى التقدم محجوباً عن قصد.',
    gap_plan_ids: ['gp-6'], status: 'active', adopted_on: '2026-07-01', sort: 4, reviewed: { rating: 'off_track', on: '2026-09-29T08:45:00Z' },
  },
  {
    skill_id: 'sk-pf-03-rcs', owner_function: 'operations', owner_person_id: 'p-ops-ceo', target_level: 3,
    targets: [{ year: 2026, pe: 600 }, { year: 2028, pe: 650 }, { year: 2030, pe: 700 }],
    kpis: [{ kind: 'holders_pe', target: 600 }, { kind: 'plans_active', target: 1 }, { kind: 'forecast_gap_mid', target: 50 }], decision: 'build',
    rationale_en: 'Reactor coolant system knowledge at qualified level underpins licensed operation and the handover from KHNP support. Reskilling through the FS04 plan and the operator pipeline keeps it inside ENEC.',
    rationale_ar: 'تشكّل معرفة نظام تبريد المفاعل على مستوى التأهيل أساس التشغيل المرخّص والتسليم من دعم كيبكو. ويحافظ عليها إعادة التأهيل عبر خطة سد الفجوة ومسار المشغلين داخل الشركة.',
    gap_plan_ids: ['gp-4'], status: 'active', adopted_on: '2026-07-01', sort: 5, reviewed: { rating: 'at_risk', on: '2026-09-29T09:10:00Z' },
  },
  {
    skill_id: 'sk-co-01', owner_function: 'operations', owner_person_id: 'p-sro', target_level: 3,
    targets: [{ year: 2026, pe: 950 }, { year: 2030, pe: 1000 }, { year: 2035, pe: 1050 }],
    kpis: [{ kind: 'holders_pe', target: 950 }, { kind: 'forecast_gap_mid', target: 100 }], decision: 'build',
    rationale_en: 'Procedure use and adherence is a licensed-operator foundation that cannot be bought in. The operator and DNT pipelines build it; the forecast gap shows how much the pipeline must add before 2030.',
    rationale_ar: 'يمثل استخدام الإجراءات والالتزام بها أساساً للمشغلين المرخّصين لا يمكن شراؤه من السوق. وتبنيه مسارات المشغلين والدبلوم الوطني، وتُظهر فجوة التوقع ما يجب أن يضيفه المسار قبل 2030.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 6, reviewed: { rating: 'on_track', on: '2026-09-29T09:30:00Z' },
  },
  {
    skill_id: 'sk-hu-01', owner_function: 'human_performance', owner_person_id: 'p-training-mgr', target_level: 3,
    targets: [{ year: 2026, pe: 1300 }, { year: 2030, pe: 1500 }],
    kpis: [{ kind: 'holders_pe', target: 1300 }, { kind: 'share_l3', target: 60 }], decision: 'build',
    rationale_en: 'Core human performance tools carry the safety culture into an AI-augmented plant. They are taught and observed in-house, so the register tracks qualified-level coverage rather than hiring.',
    rationale_ar: 'تنقل الأدوات الأساسية للأداء البشري ثقافة السلامة إلى محطة معززة بالذكاء الاصطناعي. وتُدرَّس وتُلاحظ داخلياً، لذا يتابع السجل نسبة التغطية على مستوى التأهيل بدلاً من التعيين.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 7, reviewed: { rating: 'on_track', on: '2026-09-30T07:40:00Z' },
  },
  {
    skill_id: 'sk-fs-gr-ghg', owner_function: 'sustainability', owner_person_id: 'p-head-sustainability', target_level: 2,
    targets: [{ year: 2026, pe: 700 }, { year: 2028, pe: 900 }, { year: 2030, pe: 1100 }],
    kpis: [{ kind: 'holders_pe', target: 700 }], decision: 'buy',
    rationale_en: 'Greenhouse-gas accounting is needed now for disclosure and clean energy certificates. Two experienced carbon accountants are hired to lead it while the FS43 track grows managers to working level.',
    rationale_ar: 'تحتاج الشركة إلى محاسبة غازات الاحتباس الحراري الآن لأغراض الإفصاح وشهادات الطاقة النظيفة. ويُعيَّن محاسبان متمرسان في الكربون لقيادة العمل بينما يطوّر مسار الإدارة البيئية المديرين إلى مستوى العمل.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-07-01', sort: 8, reviewed: { rating: 'on_track', on: '2026-09-30T08:00:00Z' },
  },
  {
    skill_id: 'sk-pf-02-advcool', owner_function: 'advanced_reactors', owner_person_id: 'p-sme-reviewer', target_level: 1,
    targets: [{ year: 2027, pe: 150 }, { year: 2030, pe: 400 }],
    kpis: [{ kind: 'plans_active', target: 1 }, { kind: 'holders_pe', target: 150 }], decision: 'borrow',
    rationale_en: 'Awareness of advanced coolant systems prepares for any future advanced-reactor work; no deployment decision implied. A research partner short course is borrowed through the FS04 plan.',
    rationale_ar: 'يهيّئ الإلمام بأنظمة التبريد المتقدمة لأي عمل مستقبلي في المفاعلات المتقدمة دون أي قرار نشر. وتُستعار دورة قصيرة من شريك بحثي عبر خطة سد الفجوة.',
    gap_plan_ids: ['gp-1'], status: 'active', adopted_on: '2026-07-01', sort: 9, reviewed: { rating: 'off_track', on: '2026-09-30T08:20:00Z' },
  },
  {
    skill_id: 'sk-fs-cy-phishing', owner_function: 'cyber_awareness', owner_person_id: 'p-ciso', target_level: 2,
    targets: [{ year: 2026, pe: 2500 }, { year: 2027, pe: 2800 }],
    kpis: [{ kind: 'holders_pe', target: 2500 }, { kind: 'share_l3', target: 30 }], decision: 'build',
    rationale_en: 'All-staff phishing awareness is a cyber hygiene baseline for a digital plant. It is awareness content for everyone, built through the annual campaign and the FS10 check.',
    rationale_ar: 'يُعد الوعي بالتصيّد الاحتيالي لجميع الموظفين أساساً للنظافة السيبرانية في محطة رقمية. وهو محتوى توعوي للجميع يُبنى عبر الحملة السنوية وفحص الجاهزية الرقمية.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-08-17', sort: 10,
  },
  {
    skill_id: 'sk-fs-dp-rounds', owner_function: 'operations', owner_person_id: 'p-work-control', target_level: 2,
    targets: [{ year: 2028, pe: 200 }, { year: 2032, pe: 500 }],
    kpis: [{ kind: 'holders_pe', target: 200 }], decision: 'bot',
    rationale_en: 'Routine operator rounds move to tablets and robotic inspection where approved. The decision is to automate the data collection and keep people on judgement, so fewer people need the skill than today\'s rounds.',
    rationale_ar: 'تنتقل الجولات التشغيلية الروتينية إلى الأجهزة اللوحية والفحص الروبوتي حيث يُعتمد ذلك. والقرار هو أتمتة جمع البيانات وإبقاء الإنسان على الحكم والتقدير، لذا يحتاج إلى المهارة عدد أقل من الجولات الحالية.',
    gap_plan_ids: [], status: 'active', adopted_on: '2026-09-15', sort: 11,
  },
  {
    skill_id: 'sk-en-01-project', owner_function: 'engineering', owner_person_id: 'p-outage-manager', target_level: 2,
    targets: [{ year: 2027, pe: 300 }, { year: 2030, pe: 450 }],
    kpis: [{ kind: 'holders_pe', target: 300 }, { kind: 'plans_active', target: 1 }], decision: 'buy',
    rationale_en: 'Project controls and owner\'s engineering grow with new-build studies and major modifications. Proposed: hire experienced project controllers while the FS04 training plan develops internal planners.',
    rationale_ar: 'يتزايد الطلب على ضبط المشاريع وهندسة المالك مع دراسات البناء الجديد والتعديلات الكبرى. المقترح: تعيين مراقبي مشاريع متمرسين بينما تطوّر خطة التدريب المخططين الداخليين.',
    gap_plan_ids: ['gp-3'], status: 'draft', adopted_on: null, sort: 12, by: 'p-k-hr-analyst',
  },
  {
    skill_id: 'sk-da-02', owner_function: 'digital_ai_governance', owner_person_id: 'p-ai-governance', target_level: 2,
    targets: [{ year: 2027, pe: 400 }, { year: 2030, pe: 900 }],
    kpis: [{ kind: 'holders_pe', target: 400 }, { kind: 'plans_active', target: 1 }], decision: 'build',
    rationale_en: 'Leaders need to know which AI uses are allowed and how they are governed before tools spread. Proposed: build it through the FS04 training plan and the AI-literacy register.',
    rationale_ar: 'يحتاج القادة إلى معرفة استخدامات الذكاء الاصطناعي المسموح بها وكيفية حوكمتها قبل انتشار الأدوات. المقترح: بناؤها عبر خطة التدريب وسجل محو الأمية في الذكاء الاصطناعي.',
    gap_plan_ids: ['gp-5'], status: 'draft', adopted_on: null, sort: 13, by: 'p-k-hr-analyst',
  },
];
const NOTES = {
  met: ['Target for the year reached; keep the practice drills running.', 'تحقق هدف العام؛ نستمر في تمارين الممارسة.'],
  on_track: ['Progress within reach of this year\'s target; no change to the decision.', 'التقدم قريب من هدف هذا العام؛ لا تغيير في القرار.'],
  at_risk: ['Below the trajectory; owner to bring a recovery step to the next review.', 'أدنى من المسار المتوقع؛ يقدّم المالك خطوة تعافٍ في المراجعة القادمة.'],
  off_track: ['Too few holders to measure yet; the linked plan must start this quarter.', 'عدد الحائزين أقل من أن يُقاس بعد؛ يجب أن تبدأ الخطة المرتبطة هذا الربع.'],
};

const FORECASTS = [
  {
    id: 'sf-2025-v1', cycle: 2025, version: 1, name: '2025 pilot refresh, established catalogue (SIMULATED)', scenario: 'baseline', params: { catalogue: 'established' },
    status: 'released', by: 'p-chco', created: '2025-11-10T08:00:00Z', released: '2025-11-20T09:00:00Z',
    summary_en: 'Pilot cycle on the established catalogue only, before the future skills were added. Kept for the record; its method basis differs from the 2026 cycle, so the two are not compared side by side. SIMULATED.',
    summary_ar: 'دورة تجريبية على الفهرس المعتمد فقط قبل إضافة مهارات المستقبل. محفوظة للسجل؛ يختلف أساس منهجيتها عن دورة 2026، لذا لا تُقارن الدورتان جنباً إلى جنب. محاكاة.',
  },
  {
    id: 'sf-2026-v1', cycle: 2026, version: 1, name: '2026 annual refresh (SIMULATED)', scenario: 'advance', params: {},
    status: 'released', by: 'p-chco', created: '2026-10-02T08:00:00Z', released: '2026-10-06T09:00:00Z',
    summary_en: 'Annual refresh on the full catalogue with the three scenarios. Plan against the ADVANCE band: digital and AI verification skills open the widest gaps as the 2030 role profiles land, and operations skills need the pipeline to keep pace. SIMULATED: a planning band, not a forecast.',
    summary_ar: 'التحديث السنوي على الفهرس الكامل بالسيناريوهات الثلاثة. يُخطَّط وفق نطاق برنامج ADVANCE: تفتح المهارات الرقمية ومهارات التحقق من الذكاء الاصطناعي أوسع الفجوات مع دخول ملفات أدوار 2030، وتحتاج مهارات العمليات إلى مسار يواكبها. محاكاة: نطاق للتخطيط وليس توقعاً.',
  },
  { id: 'sf-2026-v2', cycle: 2026, version: 2, name: 'Two more units from 2032 (SIMULATED)', scenario: 'baseline', params: { scenario_id: 'scn-1' }, status: 'draft', by: 'p-k-hr-analyst', created: '2026-10-07T10:00:00Z' },
  { id: 'sf-2026-v3', cycle: 2026, version: 3, name: 'Faster development push (SIMULATED)', scenario: 'accelerated', params: { develop_rate: 25, pipeline_factor: 1.2 }, status: 'draft', by: 'p-chco', created: '2026-10-08T07:30:00Z' },
];

export default function build() {}

export function finalize(T) {
  // ── FS51 forecasts first (the register's forecast KPI reads the released 2026 version)
  T.skill_forecasts = T.skill_forecasts ?? [];
  // fsqa1 (FINALIZE_LAST, runs after this file) re-points 2030/2035 requirements to the FS02 equivalents; the forecast must see the
  // final profiles, so it reads them through the same idempotent remapRequirements (read-only import; T is not changed here).
  const profiles = (T.role_profile_versions ?? []).map((v) => (v.horizon !== 'now' && (v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? { ...v, requirements: remapRequirements(v.requirements) } : v));
  const inp = forecastInputFromTables((t) => (t === 'role_profile_versions' ? profiles : T[t] ?? []));
  for (const f of FORECASTS) {
    const r = forecastFor(inp, f.params);
    if (r.code !== 'ok') throw new Error(`fs50 seed: forecast ${f.id} ${r.code}`);
    if (f.name !== simulatedName(f.name)) throw new Error(`fs50 seed: ${f.id} name must be marked SIMULATED`);
    if (f.summary_en && !publicTextIsClean([f.name, f.summary_en, f.summary_ar])) throw new Error(`fs50 seed: ${f.id} release text is not clean`);
    T.skill_forecasts.push({
      id: f.id, cycle: f.cycle, version: f.version, name: f.name, scenario: f.scenario, params: r.result.params, results: r.result, basis: r.result.basis, method: r.result.method,
      status: f.status, summary_en: f.summary_en ?? '', summary_ar: f.summary_ar ?? '', created_by: f.by, created_at: f.created, updated_at: f.released ?? f.created,
      released_by: f.released ? 'p-chco' : null, released_at: f.released ?? null, superseded_by: null, simulated: true,
    });
  }
  // ── FS50 register rows
  T.critical_skills = T.critical_skills ?? [];
  T.critical_skill_reviews = T.critical_skill_reviews ?? [];
  const ctx = {
    skills: Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])),
    owners: T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id),
    plans: Object.fromEntries(T.skill_gap_plans.map((g) => [g.id, { sk_id: g.sk_id ?? null }])),
  };
  for (const r of ROWS) {
    const problem = criticalProblem(r, ctx);
    if (problem) throw new Error(`fs50 seed: ${r.skill_id} ${problem}`);
    const by = r.by ?? 'p-chco';
    const created = r.adopted_on ? `${r.adopted_on}T08:00:00Z` : '2026-10-05T08:00:00Z';
    T.critical_skills.push({
      id: `cs-${r.skill_id}`, skill_id: r.skill_id, owner_function: r.owner_function, owner_person_id: r.owner_person_id, target_level: r.target_level,
      targets: r.targets, kpis: r.kpis, decision: r.decision, rationale_en: r.rationale_en, rationale_ar: r.rationale_ar,
      decision_history: r.history ? [{ ...r.history, until: r.reviewed.on.slice(0, 10), by: 'p-chco' }] : [],
      gap_plan_ids: r.gap_plan_ids, status: r.status, adopted_on: r.adopted_on, version: r.history ? 2 : 1, sort: r.sort, benchmark_ids: BENCH,
      created_by: by, created_at: created, updated_by: r.history ? 'p-chco' : by, updated_at: r.history ? r.reviewed.on : created,
    });
  }
  // ── 2026-Q3 reviews with the computed progress snapshot
  const board = criticalBoard(boardInputFromTables((t) => T[t] ?? []), '2026-09-30');
  for (const r of ROWS.filter((x) => x.reviewed)) {
    const id = `cs-${r.skill_id}`;
    const progress = board.rows.find((x) => x.id === id).progress;
    const [en, ar] = NOTES[r.reviewed.rating];
    T.critical_skill_reviews.push({
      id: `csr-${id}-2026-Q3`, critical_skill_id: id, quarter: '2026-Q3', rating: r.reviewed.rating, progress,
      note_en: r.reviewed.decision_before ? `${en} Decision changed from buy to borrow: a partner secondment is faster than hiring.` : en,
      note_ar: r.reviewed.decision_before ? `${ar} تغيّر القرار من الشراء إلى الاستعارة: الانتداب لدى شريك أسرع من التعيين.` : ar,
      decision_before: r.reviewed.decision_before ?? r.decision, decision_after: r.decision, reviewed_by: 'p-chco', reviewed_at: r.reviewed.on,
    });
  }
}
