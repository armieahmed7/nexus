// FS wave G · E3 seed (FS64 Regional skills plan for Al Dhafra + FS65 Skills pledges ledger, M36 Skills Ecosystem).
// FINALIZE_LAST: the regional demand rows are built from the stored FS51 forecast results (fs50 finalize), with the same rule the release
// RPC uses (src/modules/m36/regional.ts demandRows = SQL kafaa_rg_rows), so stored rows = a recompute. Synthetic only: every
// commitment and pledge is SAMPLE demo data (`sample: true`), never a statement by a named institution; people are role cards.
//  - organisations: two synthetic local training providers (Al Dhafra Technical Institute, Ruwais Vocational Training Institute), kind
//    university, category synthetic, not publicly listed (M09 table, additive seed rows, logged in the CONTRACT changelog).
//  - regional_demand: release rdr-2025-1 (current), built from the released 2025 FS51 pilot refresh (sf-2025-v1) and released on
//    2026-01-20 by the HR director. The released 2026 annual refresh (sf-2026-v1) is NOT yet shared with providers: the HR director's demo
//    action on /ecosystem/regional-plan/release.
//  - provider_commitments: 13 commitments by 7 providers (synthetic suppliers Al Noor, Gulf Hydro-Valve, Tarsus, Liwa; the two synthetic
//    institutes; Khalifa University as the k-university persona's organisation, SAMPLE), with term plans from 2025S2, delivery reported
//    for started terms, ENEC acknowledgements and queries, and one withdrawal. Every row passes the commit check as of its creation date.
//  - pledges + pledge_progress: 16 pledges by 11 organisations (ENEC entities registered by HR, suppliers, institutes, SAMPLE), quarterly
//    snapshots to 2026-09-30; statuses met, in progress, not started and lapsed all occur; some ledger cells are suppressed (one
//    organisation, or 1-9 people).
import { commitmentProblem, deliveryProblem, demandRows, termState } from '../../../src/modules/m36/regional.ts';
import { pledgeProblem, progressProblem } from '../../../src/modules/m36/pledges.ts';

export const FINALIZE_LAST = true;

export const NEW_ORGS = [
  {
    id: 'org-dhafra-tech', name_en: 'Al Dhafra Technical Institute (synthetic)', name_ar: 'معهد الظفرة التقني (افتراضي)', short: 'ADTI', kind: 'university', category: 'synthetic',
    categories: ['synthetic'], rel_types: ['provider'], relationship_en: 'Synthetic local training provider in the FS64 regional skills plan demo.',
    relationship_ar: 'جهة تدريب محلية افتراضية في عرض خطة المهارات الإقليمية.', status: 'active', dates: '', country: 'AE', binding: false, public_listed: false, synthetic: true,
    nexus_org_id: null, icv_score: null, sources: [], contact_route: null,
  },
  {
    id: 'org-ruwais-vti', name_en: 'Ruwais Vocational Training Institute (synthetic)', name_ar: 'معهد الرويس للتدريب المهني (افتراضي)', short: 'RVTI', kind: 'university', category: 'synthetic',
    categories: ['synthetic'], rel_types: ['provider'], relationship_en: 'Synthetic vocational training provider in the FS64 regional skills plan demo.',
    relationship_ar: 'جهة تدريب مهني افتراضية في عرض خطة المهارات الإقليمية.', status: 'active', dates: '', country: 'AE', binding: false, public_listed: false, synthetic: true,
    nexus_org_id: null, icv_score: null, sources: [], contact_route: null,
  },
];

const RELEASE = {
  id: 'rdr-2025-1', forecast: 'sf-2025-v1', at: '2026-01-20T08:00:00Z', by: 'p-chco',
  note_en: 'Forward skill demand for the Al Dhafra region from the 2025 pilot refresh. Bands cover the three planning scenarios; small cells are suppressed. Please respond with planned cohorts and course changes.',
  note_ar: 'الطلب المستقبلي على المهارات في منطقة الظفرة من التحديث التجريبي لعام 2025. تغطي النطاقات سيناريوهات التخطيط الثلاثة، وتُحجب الخلايا الصغيرة. يرجى الرد بالدفعات المخطط لها وتعديلات المقررات.',
};

// [id, org, area, kind, level, created, title_en, title_ar, summary_en, summary_ar, plan [[term, seats]], delivery [[term, enrolled, completed, reportedAt]], hr [status, note, at], withdrawn [reason, at]]
const COMMITMENTS = [
  ['pc-org-dhafra-tech-1', 'org-dhafra-tech', 'operations', 'cohort', 2, '2026-02-10',
    'Process plant technician diploma cohort', 'دفعة دبلوم فني محطات المعالجة',
    'A two-term diploma cohort in plant operations fundamentals, procedure use and shift communication, with a placement at the plant training centre.',
    'دفعة دبلوم على فصلين في أساسيات تشغيل المحطات واستخدام الإجراءات والتواصل بين المناوبات، مع تدريب ميداني في مركز التدريب.',
    [['2025S2', 24], ['2026S1', 24], ['2026S2', 24], ['2027S1', 30]], [['2025S2', 23, 21, '2026-08-05T09:00:00Z'], ['2026S1', 25, 0, '2026-09-28T09:00:00Z']], ['acknowledged', null, '2026-02-18T10:00:00Z'], null],
  ['pc-org-dhafra-tech-2', 'org-dhafra-tech', 'radiation_chemistry', 'course_change', 2, '2026-03-02',
    'Radiation protection technician module', 'وحدة فني الوقاية من الإشعاع',
    'The existing chemistry technician programme adds a radiation protection module with dosimetry practice and contamination control.',
    'يضيف برنامج فني الكيمياء الحالي وحدة في الوقاية من الإشعاع تشمل تطبيقات قياس الجرعات ومكافحة التلوث.',
    [['2026S1', 18], ['2026S2', 18], ['2027S1', 18]], [['2026S1', 11, 0, '2026-09-30T09:00:00Z']], ['pending', null, null], null],
  ['pc-org-ruwais-vti-1', 'org-ruwais-vti', 'maintenance', 'apprenticeship', 2, '2026-02-20',
    'Mechanical maintenance apprenticeship', 'تلمذة مهنية في الصيانة الميكانيكية',
    'An employer-linked apprenticeship in rotating equipment, pumps and valves, assessed against the plant maintenance skills.',
    'تلمذة مهنية مرتبطة بأصحاب العمل في المعدات الدوارة والمضخات والصمامات، تُقيَّم وفق مهارات الصيانة في المحطة.',
    [['2025S2', 16], ['2026S1', 16], ['2026S2', 20]], [['2025S2', 9, 7, '2026-08-12T09:00:00Z'], ['2026S1', 15, 0, '2026-09-29T09:00:00Z']],
    ['queried', 'The first term filled 9 of 16 places. Please share the recruitment plan for the next intake.', '2026-08-20T09:00:00Z'], null],
  ['pc-org-ruwais-vti-2', 'org-ruwais-vti', 'emergency', 'new_course', 1, '2026-06-15',
    'First-responder short course for industrial sites', 'دورة قصيرة للمستجيبين الأوائل في المواقع الصناعية',
    'A new short course on emergency response roles, muster and communication for workers across the region\'s industrial sites.',
    'دورة قصيرة جديدة حول أدوار الاستجابة للطوارئ والتجمع والتواصل للعاملين في المواقع الصناعية بالمنطقة.',
    [['2026S2', 40], ['2027S1', 40]], [], ['pending', null, null], null],
  ['pc-ku-1', 'ku', 'digital', 'course_change', 3, '2026-03-15',
    'Graduate elective: digital instrumentation and plant data', 'مقرر اختياري للدراسات العليا: الأجهزة الرقمية وبيانات المحطة',
    'A graduate elective on digital instrumentation and control, plant data quality and the validation of data-driven tools.',
    'مقرر اختياري للدراسات العليا في الأجهزة والتحكم الرقمي وجودة بيانات المحطة والتحقق من الأدوات المعتمدة على البيانات.',
    [['2026S1', 20], ['2026S2', 20]], [['2026S1', 19, 0, '2026-09-25T09:00:00Z']], ['acknowledged', null, '2026-03-25T09:00:00Z'], null],
  ['pc-ku-2', 'ku', 'human_performance', 'new_course', 2, '2026-05-10',
    'Human performance and safety culture module', 'وحدة الأداء البشري وثقافة السلامة',
    'A module for engineering undergraduates on human performance tools, error traps and safety culture in high-reliability industries.',
    'وحدة لطلاب البكالوريوس في الهندسة حول أدوات الأداء البشري ومصائد الأخطاء وثقافة السلامة في الصناعات عالية الموثوقية.',
    [['2026S2', 60], ['2027S2', 60]], [], ['acknowledged', null, '2026-05-20T09:00:00Z'], null],
  ['pc-ku-3', 'ku', 'plant_systems', 'cohort', 2, '2026-02-05',
    'Reactor plant systems spring school', 'المدرسة الربيعية لأنظمة محطات المفاعلات',
    'An intensive spring school on primary and secondary plant systems for final-year engineering students.',
    'مدرسة ربيعية مكثفة حول أنظمة المحطة الأولية والثانوية لطلاب السنة النهائية في الهندسة.',
    [['2025S2', 30]], [['2025S2', 30, 28, '2026-07-10T09:00:00Z']], ['acknowledged', null, '2026-02-12T09:00:00Z'], null],
  ['pc-org-alnoor-1', 'org-alnoor', 'maintenance', 'apprenticeship', 2, '2026-02-25',
    'Precision machining apprenticeship for nuclear-grade parts', 'تلمذة مهنية في التشغيل الدقيق للقطع النووية',
    'Apprentices learn precision machining, measurement and documentation to the quality standard required for nuclear-grade parts.',
    'يتعلم المتدربون التشغيل الدقيق والقياس والتوثيق وفق معيار الجودة المطلوب للقطع ذات الدرجة النووية.',
    [['2025S2', 12], ['2026S1', 12], ['2026S2', 12]], [['2025S2', 12, 11, '2026-08-03T09:00:00Z'], ['2026S1', 12, 0, '2026-09-22T09:00:00Z']], ['acknowledged', null, '2026-03-04T09:00:00Z'], null],
  ['pc-org-alnoor-2', 'org-alnoor', 'quality', 'course_change', 2, '2026-07-01',
    'Quality inspection and NDT refresher', 'تحديث مهارات فحص الجودة والاختبارات غير الإتلافية',
    'The in-house inspection course adds non-destructive testing practice and a records module aligned with the plant quality skills.',
    'يضيف مقرر الفحص الداخلي تطبيقات الاختبارات غير الإتلافية ووحدة للسجلات متوافقة مع مهارات الجودة في المحطة.',
    [['2026S1', 20], ['2026S2', 20]], [], ['pending', null, null], null],
  ['pc-org-gulfhydro-1', 'org-gulfhydro', 'maintenance', 'cohort', 2, '2026-03-10',
    'Valve maintenance technician cohort', 'دفعة فنيي صيانة الصمامات',
    'A cohort of valve technicians trained on maintenance, testing and documentation of safety-related valves.',
    'دفعة من فنيي الصمامات يتدربون على صيانة الصمامات المرتبطة بالسلامة واختبارها وتوثيقها.',
    [['2025S2', 10], ['2026S1', 10], ['2026S2', 10]], [['2025S2', 7, 6, '2026-08-08T09:00:00Z'], ['2026S1', 9, 0, '2026-09-26T09:00:00Z']],
    ['queried', 'Please confirm whether the second-term places will be filled.', '2026-08-25T09:00:00Z'], null],
  ['pc-org-gulfhydro-2', 'org-gulfhydro', 'safety', 'new_course', 1, '2026-09-01',
    'Engineering safety basics for supplier staff', 'أساسيات السلامة الهندسية لموظفي الموردين',
    'A new course on safety classification, change control and reporting for supplier engineers working on plant components.',
    'مقرر جديد حول تصنيف السلامة وضبط التغيير والإبلاغ لمهندسي الموردين العاملين على مكونات المحطة.',
    [['2026S2', 25]], [], ['pending', null, null], null],
  ['pc-org-tarsus-1', 'org-tarsus', 'leadership', 'course_change', 2, '2026-04-12',
    'Leadership for site supervisors', 'القيادة لمشرفي المواقع',
    'The supervisor course adds coaching, pre-job briefings and raising concerns, for supervisors who lead teams on ENEC work.',
    'يضيف مقرر المشرفين التوجيه وإحاطات ما قبل العمل ورفع المخاوف، للمشرفين الذين يقودون فرقاً في أعمال الشركة.',
    [['2026S1', 15], ['2026S2', 15]], [['2026S1', 14, 0, '2026-09-24T09:00:00Z']], ['acknowledged', null, '2026-04-20T09:00:00Z'], null],
  ['pc-org-liwa-1', 'org-liwa', 'quality', 'cohort', 2, '2026-03-20',
    'Forging quality control cohort', 'دفعة ضبط جودة التشكيل',
    'A cohort on forging quality control, material traceability and inspection records.',
    'دفعة حول ضبط جودة التشكيل وتتبع المواد وسجلات الفحص.',
    [['2026S2', 12], ['2027S1', 12]], [], ['pending', null, null], ['Our training centre refurbishment moves the course to 2027; we will commit again then.', '2026-07-15T09:00:00Z']],
];

// [org, area, people, target, pledged_on, title_en, title_ar, dept_en, dept_ar, progress [[as_of, started, completed]]]
const PLEDGES = [
  ['enec-ops', 'cyber_hygiene', 1200, '2026-12-31', '2025-12-15', 'Cyber hygiene for every operations employee', 'النظافة السيبرانية لكل موظف في العمليات', 'Operations training', 'تدريب العمليات',
    [['2026-03-31', 620, 410], ['2026-06-30', 980, 760], ['2026-09-30', 1150, 960]]],
  ['enec-ops', 'ai_data', 300, '2027-12-31', '2026-01-20', 'AI output checking for operations engineers', 'التحقق من مخرجات الذكاء الاصطناعي لمهندسي العمليات', 'Operations engineering', 'هندسة العمليات',
    [['2026-03-31', 40, 0], ['2026-06-30', 95, 22], ['2026-09-30', 140, 61]]],
  ['enec-ops', 'digital_plant', 180, '2028-06-30', '2026-02-10', 'Digital rounds and plant data for field operators', 'الجولات الرقمية وبيانات المحطة للمشغلين الميدانيين', 'Field operations', 'العمليات الميدانية',
    [['2026-06-30', 30, 0], ['2026-09-30', 64, 18]]],
  ['enec', 'transversal', 400, '2027-06-30', '2026-01-10', 'Transversal core skills for new graduates', 'المهارات الأساسية المشتركة للخريجين الجدد', 'Corporate human capital', 'رأس المال البشري المؤسسي',
    [['2026-03-31', 120, 30], ['2026-06-30', 210, 95], ['2026-09-30', 260, 150]]],
  ['enec-con', 'green_energy', 60, '2027-12-31', '2026-03-05', 'Energy transition basics for consultants', 'أساسيات التحول في الطاقة للاستشاريين', 'Consulting services', 'الخدمات الاستشارية',
    [['2026-06-30', 12, 0], ['2026-09-30', 21, 6]]],
  ['enec', 'advanced_reactor', 40, '2028-12-31', '2026-04-15', 'Advanced reactor foundations for engineers', 'أسس المفاعلات المتقدمة للمهندسين', 'Advanced reactors programme', 'برنامج المفاعلات المتقدمة',
    [['2026-09-30', 8, 0]]],
  ['org-alnoor', 'quality', 25, '2027-06-30', '2026-02-01', 'Quality records and inspection skills for machinists', 'مهارات سجلات الجودة والفحص للعاملين في التشغيل', null, null,
    [['2026-03-31', 6, 0], ['2026-06-30', 12, 5], ['2026-09-30', 15, 9]]],
  ['org-alnoor', 'digital_plant', 12, '2027-12-31', '2026-05-12', 'Digital work packages for field technicians', 'حزم العمل الرقمية للفنيين الميدانيين', null, null,
    [['2026-09-30', 4, 0]]],
  ['org-gulfhydro', 'maintenance', 30, '2027-03-31', '2026-01-25', 'Valve maintenance upskilling for technicians', 'رفع مهارات صيانة الصمامات للفنيين', null, null,
    [['2026-03-31', 10, 0], ['2026-06-30', 18, 8], ['2026-09-30', 22, 14]]],
  ['org-gulfhydro', 'cyber_hygiene', 45, '2026-09-30', '2025-12-20', 'Cyber hygiene for all staff', 'النظافة السيبرانية لجميع الموظفين', null, null,
    [['2026-03-31', 30, 18], ['2026-06-30', 44, 39], ['2026-09-30', 47, 46]]],
  ['org-dhafra', 'safety', 80, '2027-06-30', '2026-02-15', 'Industrial safety basics for site crews', 'أساسيات السلامة الصناعية لطواقم المواقع', null, null,
    [['2026-03-31', 20, 0], ['2026-06-30', 42, 25], ['2026-09-30', 58, 40]]],
  ['org-tarsus', 'quality', 18, '2026-09-30', '2026-01-05', 'Casting inspection refresher', 'تحديث مهارات فحص المسبوكات',
    null, null, [['2026-03-31', 5, 0], ['2026-06-30', 11, 6], ['2026-09-30', 14, 11]]],
  ['org-liwa', 'maintenance', 12, '2027-09-30', '2026-06-01', 'Forging press maintenance skills', 'مهارات صيانة مكابس التشكيل', null, null, []],
  ['ku', 'ai_data', 150, '2028-06-30', '2026-03-01', 'Applied AI and data skills for engineering students', 'مهارات الذكاء الاصطناعي والبيانات التطبيقية لطلاب الهندسة', 'College of Engineering', 'كلية الهندسة',
    [['2026-06-30', 60, 0], ['2026-09-30', 85, 40]]],
  ['org-dhafra-tech', 'operations', 90, '2027-12-31', '2026-02-12', 'Plant operations fundamentals for technician students', 'أساسيات تشغيل المحطات لطلاب الفنيين', null, null,
    [['2026-06-30', 24, 0], ['2026-09-30', 49, 21]]],
  ['org-ruwais-vti', 'emergency', 60, '2027-06-30', '2026-06-20', 'Emergency response awareness for trainees', 'التوعية بالاستجابة للطوارئ للمتدربين', null, null,
    [['2026-09-30', 0, 0]]],
];

export default function build(T) {
  T.organisations = T.organisations ?? [];
  for (const o of NEW_ORGS) if (!T.organisations.some((x) => x.id === o.id)) T.organisations.push({ ...o });
}

export function finalize(T) {
  const skills = T.skills ?? [];
  const skillArea = Object.fromEntries(skills.map((s) => [s.id, s.area]));
  const orgs = new Map((T.organisations ?? []).map((o) => [o.id, o]));
  // ── FS64 release rdr-2025-1 (stored rows = demandRows(released forecast))
  const f = (T.skill_forecasts ?? []).find((x) => x.id === RELEASE.forecast);
  if (!f || f.status !== 'released') throw new Error(`fs64: ${RELEASE.forecast} must be a released FS51 forecast`);
  const rows = demandRows(f.results, f.scenario, skillArea);
  if (!rows.length) throw new Error('fs64: the release has no rows');
  T.regional_demand = T.regional_demand ?? [];
  for (const r of rows) {
    T.regional_demand.push({
      id: `${RELEASE.id}-${r.area}-${r.year}`, release_id: RELEASE.id, forecast_id: f.id, forecast_name: f.name, cycle: Number(f.cycle), region: 'al_dhafra', scenario: f.scenario,
      area: r.area, year: r.year, demand_low: r.demand_low, demand_high: r.demand_high, gap_low: r.gap_low, gap_high: r.gap_high, gap_plan: r.gap_plan, skills_n: r.skills_n,
      withheld_n: r.withheld_n, skill_ids: r.skill_ids, suppressed: r.suppressed, note_en: RELEASE.note_en, note_ar: RELEASE.note_ar, status: 'current', released: true,
      released_by: RELEASE.by, released_at: RELEASE.at, simulated: true,
    });
  }
  const areas = [...new Set(rows.map((r) => r.area))];
  const ctxSkills = Object.fromEntries(skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  // ── FS64 commitments
  T.provider_commitments = T.provider_commitments ?? [];
  for (const [id, org, area, kind, level, created, te, ta, se, sa, plan, delivery, hr, wd] of COMMITMENTS) {
    const o = orgs.get(org);
    if (!o) throw new Error(`fs64: unknown organisation ${org}`);
    const skill_ids = rows.find((r) => r.area === area && r.year === 2030)?.skill_ids.slice(0, 3) ?? [];
    const pl = plan.map(([term, seats]) => ({ term, seats }));
    const input = { area, kind, title_en: te, title_ar: ta, summary_en: se, summary_ar: sa, skill_ids, level, plan: pl };
    const problem = commitmentProblem(input, { areas, skills: ctxSkills, today: created });
    if (problem) throw new Error(`fs64: commitment ${id} fails the commit check (${problem}) as of ${created}`);
    const del = delivery.map(([term, enrolled, completed, at]) => {
      const d = { term, enrolled, completed };
      const p = deliveryProblem({ commitment_id: id, ...d }, pl, at.slice(0, 10));
      if (p) throw new Error(`fs64: ${id} delivery ${term} fails the check (${p})`);
      return { ...d, note: null, reported_by: '', reported_at: at };
    });
    const by = org === 'org-alnoor' ? 'p-alnoor-gm' : org === 'org-gulfhydro' ? 'p-gulfhydro-qa' : org === 'ku' ? 'p-k-university' : null;
    // providers without a demo persona report through their own administrator account (not seeded as a person): created_by names the organisation
    const actor = by ?? `${org}:admin`;
    for (const d of del) d.reported_by = actor;
    const ts = `${created}T09:00:00Z`;
    const history = [{ action: 'create', version: 1, at: ts, by: actor, plan: pl }];
    if (wd) history.push({ action: 'withdraw', version: 1, at: wd[1], by: actor, reason: wd[0] });
    if (del.some((d) => termState(d.term, '2026-10-08') === 'future')) throw new Error(`fs64: ${id} reports a future term`);
    T.provider_commitments.push({
      id, org_id: org, org_name_en: o.name_en, org_name_ar: o.name_ar, org_kind: o.kind, release_id: RELEASE.id, area, kind, title_en: te, title_ar: ta, summary_en: se, summary_ar: sa,
      skill_ids, level, plan: pl, delivery: del, status: wd ? 'withdrawn' : 'active', withdrawn_reason: wd ? wd[0] : null,
      hr_status: hr[0], hr_note: hr[1], hr_by: hr[0] === 'pending' ? null : 'p-chco', hr_at: hr[2], version: 1, history,
      created_by: actor, created_at: ts, updated_by: actor, updated_at: wd ? wd[1] : (del.at(-1)?.reported_at ?? ts), open_read: false, sample: true,
    });
  }
  // ── FS65 pledges and progress
  T.pledges = T.pledges ?? [];
  T.pledge_progress = T.pledge_progress ?? [];
  const seq = new Map();
  for (const [org, area, people, target, on, te, ta, de, da, progress] of PLEDGES) {
    const o = orgs.get(org);
    if (!o) throw new Error(`fs65: unknown organisation ${org}`);
    const n = (seq.get(org) ?? 0) + 1;
    seq.set(org, n);
    const id = `pl-${org}-${n}`;
    const problem = pledgeProblem({ area, people, target_date: target, title_en: te, title_ar: ta, department_en: de, department_ar: da }, on);
    if (problem) throw new Error(`fs65: pledge ${id} fails the register check (${problem}) as of ${on}`);
    const actor = o.kind === 'group_entity' ? 'p-chco' : org === 'org-alnoor' ? 'p-alnoor-gm' : org === 'org-gulfhydro' ? 'p-gulfhydro-qa' : org === 'ku' ? 'p-k-university' : `${org}:admin`;
    T.pledges.push({
      id, org_id: org, org_name_en: o.name_en, org_name_ar: o.name_ar, org_kind: o.kind, area, people, target_date: target, pledged_on: on, title_en: te, title_ar: ta,
      department_en: de, department_ar: da, status: 'active', created_by: actor, created_at: `${on}T09:00:00Z`, updated_at: `${on}T09:00:00Z`, open_read: false, sample: true,
    });
    let prev = null;
    for (const [as_of, started, completed] of progress) {
      const p = progressProblem({ pledge_id: id, as_of, started, completed }, { pledged_on: on }, prev, '2026-10-08');
      if (p) throw new Error(`fs65: progress ${id} ${as_of} fails the check (${p})`);
      T.pledge_progress.push({ id: `pp-${id}-${as_of}`, pledge_id: id, org_id: org, as_of, started, completed, note_en: null, note_ar: null, reported_by: actor, reported_at: `${as_of}T12:00:00Z`, open_read: false });
      prev = { as_of, started, completed };
    }
  }
  console.log(`fs64/65: regional release ${RELEASE.id} (${rows.length} rows, ${areas.length} areas, from ${f.id}); ${T.provider_commitments.length} provider commitments by ${new Set(T.provider_commitments.map((c) => c.org_id)).size} providers; ${T.pledges.length} pledges by ${new Set(T.pledges.map((p) => p.org_id)).size} organisations, ${T.pledge_progress.length} progress snapshots; ${NEW_ORGS.length} synthetic providers added`);
}
