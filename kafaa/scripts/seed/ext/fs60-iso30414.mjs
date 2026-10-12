// FS wave G · E1 seed (FS60 ISO 30414 skills and capability disclosure pack + FS61 skills pilots registry, M35 Workforce Strategy and
// Disclosure). FINALIZE_LAST: runs after F01/FS02/FS03 and fs58 have derived the final skill states (fs58 re-derives role-play evidence)
// and after the FS50 register (fs50), before fsqa*; so every stored disclosure value equals what computeDisclosure() / the SQL
// kafaa_hcd_compute give on the seeded data (checked by scripts/validate/fs71-disclosure-pilots.mjs and tests/unit/fs71-*).
// A later builder that adds training records, LRS statements, credits or skill evidence changes the computed values: rerun
// recomputeDisclosures(T) (exported) after it, as the wave-F lead did for FS56.
// Synthetic only: owners, preparers, approvers and evaluators are role cards; every number is SIMULATED.
//  - hc_metrics: the 7-metric library mapped to the ISO 30414 area "Skills, Capabilities and Development" (definition, formula, data
//    source, owner function and role card, unit, basis), sourced to the ISO 30414:2025 committee page and the research packs' benchmarks.
//  - hc_disclosures: 2026-Q2 published (prepared by the HR analyst, every line approved by the HR director) and 2026-Q3 in review
//    (prepared 2026-10-06: two lines approved; three lines ready for the HR director; the critical-skills line was written by the HR
//    director, so he cannot approve it himself (maker-checker); the participation-gap line has no narrative yet, so it cannot publish).
//  - skill_pilots: 11 pilots (8 closed: 3 adopted, 1 expanded, 2 further funded, 2 not adopted, both failures kept visible; 1 signed off
//    and waiting for HR to close; 1 running; 1 draft). Adoption rate 6 of 8 = 75.0 %, shown against the FSC reference (78 %) read from
//    kafaa_benchmarks.
import { METRIC_SPEC, lineProblem, materialityOk, periodBounds } from '../../../src/modules/m35/disclosure.ts';
import { disclosureFromTables, staffRungs } from '../../../src/modules/m35/disclosureData.ts';
import { adoptionRate, pilotProblem, signoffProblem, closeProblem } from '../../../src/modules/m35/pilots.ts';
import { ensureCreditTags, rebuildLedger } from './fs29-rpl-credits.mjs';

export const FINALIZE_LAST = true;
const ISO_URL = 'https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html';

const TM = { id: 'p-training-mgr', en: 'Training Manager (role card)', ar: 'مدير التدريب (بطاقة دور)' };
const AIG = { id: 'p-ai-governance', en: 'AI Governance Lead (role card)', ar: 'قائد حوكمة الذكاء الاصطناعي (بطاقة دور)' };
const CHCO = { id: 'p-chco', en: 'Chief Human Capital Officer (role card)', ar: 'الرئيس التنفيذي لرأس المال البشري (بطاقة دور)' };

export const METRICS = [
  {
    id: 'hcm-trained', key: 'trained_pct', owner_function: 'nuclear_training', owner: TM, benchmark_ids: ['EU-PACT', 'ISO30414'], source_tables: ['training_records', 'xapi_statements', 'people'],
    name_en: 'Workforce trained this year', name_ar: 'نسبة القوى العاملة المدرَّبة هذا العام',
    definition_en: 'Share of active staff with at least one completed learning record between 1 January and the last day of the quarter. The headline coverage KPI.',
    definition_ar: 'نسبة الموظفين النشطين الذين لديهم سجل تعلّم مكتمل واحد على الأقل بين 1 يناير وآخر يوم في الربع. وهو مؤشر التغطية الرئيسي.',
    formula_en: 'People with a training record (passed, completed or attended) or a completed or passed learning-record-store statement, 1 January to quarter end, divided by active staff, times 100. Under 10 people: suppressed.',
    formula_ar: 'عدد الأشخاص الذين لديهم سجل تدريب (ناجح أو مكتمل أو حضور) أو بيان مكتمل أو ناجح في مخزن سجلات التعلّم، من 1 يناير حتى نهاية الربع، مقسوماً على الموظفين النشطين، مضروباً في 100. أقل من 10 أشخاص: محجوب.',
    source_en: 'Training records (M04) and the learning record store (M27, xAPI)', source_ar: 'سجلات التدريب (M04) ومخزن سجلات التعلّم (M27، xAPI)',
  },
  {
    id: 'hcm-active-learners', key: 'active_learners_pct', owner_function: 'nuclear_training', owner: TM, benchmark_ids: ['ISO30414'], source_tables: ['training_records', 'xapi_statements', 'people'],
    name_en: 'Quarterly active learners', name_ar: 'المتعلّمون النشطون في الربع',
    definition_en: 'Share of active staff with any recorded learning activity in the quarter: a course, refresher, simulator session, mentoring session, OJT task or knowledge asset.',
    definition_ar: 'نسبة الموظفين النشطين الذين لديهم أي نشاط تعلّم مسجّل خلال الربع: دورة أو تنشيط أو جلسة محاكي أو جلسة إرشاد أو مهمة تدريب أثناء العمل أو أصل معرفي.',
    formula_en: 'People with at least one learning-record-store statement or training record dated in the quarter, divided by active staff, times 100. Under 10 people: suppressed.',
    formula_ar: 'عدد الأشخاص الذين لديهم بيان واحد على الأقل في مخزن سجلات التعلّم أو سجل تدريب مؤرخ في الربع، مقسوماً على الموظفين النشطين، مضروباً في 100. أقل من 10 أشخاص: محجوب.',
    source_en: 'Learning record store (M27, xAPI) and training records (M04)', source_ar: 'مخزن سجلات التعلّم (M27، xAPI) وسجلات التدريب (M04)',
  },
  {
    id: 'hcm-hours', key: 'hours_per_employee', owner_function: 'nuclear_training', owner: TM, benchmark_ids: ['UAE-PEERS', 'ISO30414'], source_tables: ['training_records', 'xapi_statements', 'people'],
    name_en: 'Learning hours per employee', name_ar: 'ساعات التعلّم لكل موظف',
    definition_en: 'Recorded learning hours of active staff from 1 January to the end of the quarter, per active employee. Training-record hours count once, even though the same records also reach the learning record store.',
    definition_ar: 'ساعات التعلّم المسجّلة للموظفين النشطين من 1 يناير حتى نهاية الربع، لكل موظف نشط. تُحتسب ساعات سجلات التدريب مرة واحدة، رغم أن السجلات نفسها تصل أيضاً إلى مخزن سجلات التعلّم.',
    formula_en: '(Training-record hours + durations on learning-record-store statements from every other source, a working day = 8 hours), 1 January to quarter end, divided by active staff; one decimal.',
    formula_ar: '(ساعات سجلات التدريب + المدد المسجّلة على بيانات مخزن سجلات التعلّم من كل المصادر الأخرى، واليوم الوظيفي = 8 ساعات)، من 1 يناير حتى نهاية الربع، مقسومة على الموظفين النشطين؛ برقم عشري واحد.',
    source_en: 'Training records (M04) and the learning record store (M27, xAPI)', source_ar: 'سجلات التدريب (M04) ومخزن سجلات التعلّم (M27، xAPI)',
  },
  {
    id: 'hcm-ai-fundamentals', key: 'ai_fundamentals_pct', owner_function: 'digital_ai_governance', owner: AIG, benchmark_ids: ['UAE-PEERS', 'ISO30414'], source_tables: ['person_skills', 'ai_rungs', 'ai_skill_tracks', 'people'],
    name_en: 'AI-fundamentals coverage', name_ar: 'تغطية أساسيات الذكاء الاصطناعي',
    definition_en: 'Share of active staff at rung 1 (Aware) or higher on the FS09 AI fluency ladder, from counted skill states; self-ratings never count. Measured on the day the values are computed.',
    definition_ar: 'نسبة الموظفين النشطين في الدرجة 1 (مُدرِك) أو أعلى على سلّم الطلاقة في الذكاء الاصطناعي، استناداً إلى حالات المهارات المحتسبة؛ ولا يُحتسب التقييم الذاتي أبداً. يُقاس في يوم حساب القيم.',
    formula_en: 'People whose FS09 rung is 1 or more, divided by active staff, times 100. Under 10 people: suppressed.',
    formula_ar: 'عدد الأشخاص الذين تبلغ درجتهم 1 أو أكثر، مقسوماً على الموظفين النشطين، مضروباً في 100. أقل من 10 أشخاص: محجوب.',
    source_en: 'Skill states (F01) read through the FS09 AI fluency ladder (M29)', source_ar: 'حالات المهارات (F01) مقروءة عبر سلّم الطلاقة في الذكاء الاصطناعي (M29)',
  },
  {
    id: 'hcm-critical', key: 'critical_on_track_pct', owner_function: 'leadership_development', owner: CHCO, benchmark_ids: ['ISO30414'], source_tables: ['critical_skills', 'person_skills', 'workforce_snapshots'],
    name_en: 'Critical future skills on track', name_ar: 'مهارات المستقبل الحرجة على المسار',
    definition_en: 'Share of adopted FS50 critical future skills whose computed progress is met or on track for the year, on the last day of the quarter. Rows whose progress is suppressed (under 10 people) or that have no target this year are left out and counted separately.',
    definition_ar: 'نسبة مهارات المستقبل الحرجة المعتمدة في السجل التي يكون تقدّمها المحسوب محققاً أو على المسار لهذا العام، في آخر يوم من الربع. تُستبعد الصفوف المحجوب تقدّمها (أقل من 10 أشخاص) أو التي لا هدف لها هذا العام وتُعدّ على حدة.',
    formula_en: 'Adopted register rows with progress met or on track, divided by adopted rows with a measured progress, times 100 (register rows, not people).',
    formula_ar: 'صفوف السجل المعتمدة التي تقدّمها محقق أو على المسار، مقسومة على الصفوف المعتمدة ذات التقدّم المقاس، مضروبة في 100 (صفوف السجل، لا الأشخاص).',
    source_en: 'Critical Future-Skills Register (FS50, M35) and skill states (F01)', source_ar: 'سجل مهارات المستقبل الحرجة (FS50، M35) وحالات المهارات (F01)',
  },
  {
    id: 'hcm-credits', key: 'credits_per_employee', owner_function: 'nuclear_training', owner: TM, benchmark_ids: ['ISO30414'], source_tables: ['credit_ledger', 'people'],
    name_en: 'Learning credits per employee', name_ar: 'الأرصدة التعليمية لكل موظف',
    definition_en: 'FS30 learning credits counted for active staff from 1 January to the end of the quarter, per active employee (10 notional hours = 1 credit; reversed credits never count).',
    definition_ar: 'الأرصدة التعليمية المحتسبة للموظفين النشطين من 1 يناير حتى نهاية الربع، لكل موظف نشط (10 ساعات تعلّم افتراضية = رصيد واحد؛ ولا تُحتسب الأرصدة الملغاة).',
    formula_en: 'Notional hours of counted credit-ledger rows, 1 January to quarter end, divided by 10 and by active staff; two decimals.',
    formula_ar: 'الساعات الافتراضية لصفوف سجل الأرصدة المحتسبة، من 1 يناير حتى نهاية الربع، مقسومة على 10 وعلى الموظفين النشطين؛ برقمين عشريين.',
    source_en: 'Personal credit ledger (FS30, M34)', source_ar: 'سجل الأرصدة الشخصي (FS30، M34)',
  },
  {
    id: 'hcm-participation', key: 'participation_gap_pp', owner_function: 'human_performance', owner: CHCO, benchmark_ids: ['ISO30414'], source_tables: ['training_records', 'xapi_statements', 'people'],
    name_en: 'Participation gap by site, shift and grade', name_ar: 'فجوة المشاركة حسب الموقع والوردية والدرجة الوظيفية',
    definition_en: 'Who is not yet learning: the share trained this year for each site, shift crew and grade, and the largest gap between groups of one dimension. Groups under 10 people are suppressed; nationality and gender are never used.',
    definition_ar: 'من لم يبدأ التعلّم بعد: نسبة المدرَّبين هذا العام لكل موقع وطاقم وردية ودرجة وظيفية، وأكبر فجوة بين مجموعات البُعد الواحد. تُحجب المجموعات التي تقل عن 10 أشخاص؛ ولا تُستخدم الجنسية أو الجنس أبداً.',
    formula_en: 'For each dimension, the highest minus the lowest share trained this year among groups with at least 10 people, in percentage points; the largest of the three. Lower is better.',
    formula_ar: 'لكل بُعد، أعلى نسبة مدرَّبين هذا العام ناقص أدناها بين المجموعات التي تضم 10 أشخاص على الأقل، بالنقاط المئوية؛ ويؤخذ الأكبر من الأبعاد الثلاثة. الأقل أفضل.',
    source_en: 'Training records (M04), the learning record store (M27) and the people directory (site, shift crew, grade)', source_ar: 'سجلات التدريب (M04) ومخزن سجلات التعلّم (M27) ودليل الأشخاص (الموقع وطاقم الوردية والدرجة)',
  },
];

const MATERIALITY = {
  en: 'Materiality: a skills metric is disclosed when it informs a decision about safe and reliable operation, the 2030 handover or the future-skills programme, or when the board, a lender or the regulator asks for it. This pack follows the "Skills, Capabilities and Development" area; other ISO 30414 areas are reported elsewhere. Values are SIMULATED.',
  ar: 'الأهمية النسبية: يُفصح عن مقياس المهارات عندما يفيد قراراً يتعلق بالتشغيل الآمن والموثوق أو تسليم 2030 أو برنامج مهارات المستقبل، أو عندما يطلبه مجلس الإدارة أو جهة تمويل أو الجهة الرقابية. تتبع هذه الحزمة مجال "المهارات والقدرات والتطوير"؛ ويُبلّغ عن مجالات ISO 30414 الأخرى في مواضع أخرى. القيم محاكاة.',
};

const fmt = (v, unit) => (v == null ? 'suppressed' : unit === 'credits' ? v.toFixed(2) : v.toFixed(1));
const fmtAr = (v, unit) => (v == null ? 'محجوب' : unit === 'credits' ? v.toFixed(2) : v.toFixed(1));
const UNIT_EN = { pct: '%', hours: ' hours', credits: ' credits', pp: ' percentage points' };
const UNIT_AR = { pct: '%', hours: ' ساعة', credits: ' رصيد', pp: ' نقطة مئوية' };
/** Owner narratives and variance notes written from the computed values (never typed numbers). */
function narrativeFor(key, v, period) {
  const s = METRIC_SPEC[key];
  const val = `${fmt(v.value, s.unit)}${v.value == null ? '' : UNIT_EN[s.unit]}`;
  const valAr = `${fmtAr(v.value, s.unit)}${v.value == null ? '' : UNIT_AR[s.unit]}`;
  const N = {
    trained_pct: [`Coverage reached ${val} of active staff in ${period} (year to date). Mandatory refreshers and simulator requalification carry most of it; corporate functions trail the plant.`,
      `بلغت التغطية ${valAr} من الموظفين النشطين في ${period} (منذ بداية العام). تحمل دورات التنشيط الإلزامية وإعادة التأهيل على المحاكي معظمها؛ وتتأخر الوظائف المؤسسية عن المحطة.`],
    active_learners_pct: [`${val} of active staff recorded learning in ${period}. Activity follows the outage and refresher calendar, so quarters differ.`,
      `سجّل ${valAr} من الموظفين النشطين نشاط تعلّم في ${period}. يتبع النشاط تقويم فترات الإيقاف والتنشيط، لذلك تختلف الأرباع.`],
    hours_per_employee: [`${val} per employee year to date in ${period}, from training records and simulator, mentoring and OJT time in the learning record store.`,
      `${valAr} لكل موظف منذ بداية العام في ${period}، من سجلات التدريب ومن وقت المحاكي والإرشاد والتدريب أثناء العمل في مخزن سجلات التعلّم.`],
    ai_fundamentals_pct: [`${val} of active staff are at rung 1 (Aware) or higher on the AI fluency ladder. The all-staff AI basics module is the main route; self-ratings do not count.`,
      `${valAr} من الموظفين النشطين في الدرجة 1 (مُدرِك) أو أعلى على سلّم الطلاقة في الذكاء الاصطناعي. وحدة أساسيات الذكاء الاصطناعي لجميع الموظفين هي المسار الرئيسي؛ ولا يُحتسب التقييم الذاتي.`],
    critical_on_track_pct: [`${val} of the adopted critical future skills with measured progress are met or on track for the year; ${v.excluded} row(s) are suppressed or have no target this year.`,
      `${valAr} من مهارات المستقبل الحرجة المعتمدة ذات التقدّم المقاس محققة أو على المسار لهذا العام؛ و${v.excluded} صف(وف) محجوبة أو بلا هدف هذا العام.`],
    credits_per_employee: [`${val} per employee year to date in ${period}. Credits follow completed tagged courses, pathways and micro-credentials.`,
      `${valAr} لكل موظف منذ بداية العام في ${period}. تتبع الأرصدة الدورات والمسارات والشهادات المصغّرة المكتملة الموسومة.`],
    participation_gap_pp: [`The largest gap between groups of one dimension is ${val}. Most shift crews are under 10 people and are suppressed, so the gap reads site and grade.`,
      `أكبر فجوة بين مجموعات البُعد الواحد ${valAr}. معظم أطقم الورديات أقل من 10 أشخاص وهي محجوبة، لذلك تُقرأ الفجوة حسب الموقع والدرجة.`],
  }[key];
  const variance = v.prev_period == null
    ? ['First disclosure in this format: there is no earlier published value to compare with.', 'أول إفصاح بهذا الشكل: لا توجد قيمة منشورة سابقة للمقارنة.']
    : s.basis === 'ytd' && period.endsWith('-Q1')
      ? [`Year-to-date measure: it restarts on 1 January, so the change against ${v.prev_period} is not a trend.`, `مقياس منذ بداية العام: يبدأ من جديد في 1 يناير، لذلك فإن التغيّر مقارنة بـ ${v.prev_period} ليس اتجاهاً.`]
      : s.basis === 'point'
        ? [`Measured on the day the values were computed; change against ${v.prev_period}: ${fmt(v.variance, s.unit)}. Movement comes from new counted evidence, not from a change of method.`,
          `يُقاس في يوم حساب القيم؛ التغيّر مقارنة بـ ${v.prev_period}: ${fmtAr(v.variance, s.unit)}. يأتي التحرّك من أدلة محتسبة جديدة، لا من تغيير في المنهجية.`]
        : [`Change against ${v.prev_period}: ${fmt(v.variance, s.unit)}. ${s.basis === 'ytd' ? 'Year-to-date values accumulate through the year.' : 'Quarterly activity follows the training calendar.'}`,
          `التغيّر مقارنة بـ ${v.prev_period}: ${fmtAr(v.variance, s.unit)}. ${s.basis === 'ytd' ? 'تتراكم القيم منذ بداية العام على مدار السنة.' : 'يتبع النشاط الربعي تقويم التدريب.'}`];
  return { narrative_en: N[0], narrative_ar: N[1], variance_en: variance[0], variance_ar: variance[1] };
}

const DISCLOSURES = [
  { period: '2026-Q2', prepared: 'p-k-hr-analyst', computed_on: '2026-07-08', created: '2026-07-08T09:00:00Z', approve: { by: 'p-chco', at: '2026-07-15T10:00:00Z', ids: 'all' }, narratives: 'all' },
  {
    period: '2026-Q3', prepared: 'p-k-hr-analyst', computed_on: '2026-10-06', created: '2026-10-06T09:00:00Z',
    approve: { by: 'p-chco', at: '2026-10-07T11:00:00Z', ids: ['hcm-trained', 'hcm-hours'] },
    narratives: ['hcm-trained', 'hcm-active-learners', 'hcm-hours', 'hcm-ai-fundamentals', 'hcm-critical', 'hcm-credits'],
    /** the HR director wrote this line himself, so a second person must approve it */
    writtenBy: { 'hcm-critical': { by: 'p-chco', at: '2026-10-07T10:30:00Z' } },
  },
];

const P = (en, ar) => ({ en, ar });
const M = (key, en, ar, unit, baseline, target, pilot = null, comparison = null) => ({ key, label_en: en, label_ar: ar, unit, baseline, target, pilot, comparison });
export const PILOTS = [
  {
    id: 'sp-vr-outage-brief', owner: 'p-outage-manager', evaluator: 'p-independent-approver', skills: ['sk-fs-ai-xr', 'sk-mp-01-outage', 'sk-hu-02-brief'], start: '2025-09-01', end: '2026-02-28', n: [24, 26],
    title: P('VR pre-job briefing for outage valve work', 'إحاطة ما قبل العمل بالواقع الافتراضي لأعمال الصمامات خلال فترات الإيقاف'),
    hypothesis: P('Technicians who rehearse a valve job in VR before the outage make fewer first-time errors than technicians who get the standard classroom briefing.', 'يرتكب الفنيون الذين يتدرّبون على مهمة الصمام بالواقع الافتراضي قبل فترة الإيقاف أخطاءً أقل من المرة الأولى مقارنة بالفنيين الذين يتلقّون الإحاطة الصفية المعتادة.'),
    comparison: P('Maintenance crews on the other unit\'s outage, same valve job types, standard classroom briefing.', 'أطقم الصيانة في فترة إيقاف الوحدة الأخرى، بأنواع مهام الصمامات نفسها، مع الإحاطة الصفية المعتادة.'),
    metrics: [M('first_time_right', 'Jobs right first time', 'المهام المنجزة صحيحة من المرة الأولى', 'pct', 88, 93, 94, 89), M('rework_hours', 'Rework hours', 'ساعات إعادة العمل', 'hours', 120, 90, 84, 118)],
    status: 'closed', result: 'success', recommendation: 'adopted', adoption: 'adopted', signoff: '2026-03-12T09:00:00Z', closed: '2026-03-20T09:00:00Z',
    resultT: P('Jobs right first time rose to 94% against 89% in the comparison crews and rework hours fell by about a third. Briefing time grew by 20 minutes per job.', 'ارتفعت نسبة المهام المنجزة صحيحة من المرة الأولى إلى 94% مقابل 89% لدى أطقم المقارنة، وانخفضت ساعات إعادة العمل بنحو الثلث. وزاد وقت الإحاطة 20 دقيقة لكل مهمة.'),
    lessons: P('Keep the VR scene tied to the real work package; one headset per crew was enough.', 'إبقاء مشهد الواقع الافتراضي مرتبطاً بحزمة العمل الفعلية؛ وكانت نظارة واحدة لكل طاقم كافية.'),
  },
  {
    id: 'sp-ai-procedure-draft', owner: 'p-ai-governance', evaluator: 'p-compliance', skills: ['sk-fs-ai-verify', 'sk-fs-ai-use', 'sk-co-01'], start: '2025-11-01', end: '2026-04-30', n: [12, 12],
    title: P('AI-assisted first drafts of maintenance procedures', 'مسودات أولى لإجراءات الصيانة بمساعدة الذكاء الاصطناعي'),
    hypothesis: P('Procedure writers who start from an approved assistant\'s first draft finish a controlled revision faster without more review findings.', 'ينجز كتّاب الإجراءات الذين يبدؤون من مسودة أولى يعدّها مساعد معتمد مراجعةً مضبوطة أسرع دون زيادة في ملاحظات المراجعة.'),
    comparison: P('Writers revising procedures of the same type and length without the assistant during the same months.', 'كتّاب يراجعون إجراءات من النوع والطول نفسيهما دون المساعد خلال الأشهر نفسها.'),
    metrics: [M('drafting_days', 'Days to a reviewable draft', 'الأيام حتى مسودة قابلة للمراجعة', 'days', 12, 8, 8.5, 11.5), M('review_findings', 'Review findings per procedure', 'ملاحظات المراجعة لكل إجراء', 'count', 9, 9, 11, 9)],
    status: 'closed', result: 'mixed', recommendation: 'further_funded', adoption: 'further_funded', signoff: '2026-05-14T09:00:00Z', closed: '2026-05-25T09:00:00Z',
    resultT: P('Drafts were ready three days sooner, but reviewers raised more findings on wording copied from the assistant. Speed improved; quality did not.', 'كانت المسودات جاهزة قبل ثلاثة أيام، لكن المراجعين سجّلوا ملاحظات أكثر على صياغة منسوخة من المساعد. تحسّنت السرعة ولم تتحسّن الجودة.'),
    lessons: P('Fund a second round with the AI verification drill before writers use the assistant.', 'تمويل جولة ثانية مع تمرين التحقق من مخرجات الذكاء الاصطناعي قبل استخدام الكتّاب للمساعد.'),
  },
  {
    id: 'sp-sim-microdrills', owner: 'p-training-mgr', evaluator: 'p-independent-approver', skills: ['sk-co-01-eop', 'sk-co-02', 'sk-ld-02-decide'], start: '2025-10-01', end: '2026-03-31', n: [30, 28],
    title: P('20-minute simulator micro-drills between shifts', 'تمارين قصيرة على المحاكي مدتها 20 دقيقة بين الورديات'),
    hypothesis: P('Short, frequent simulator drills keep emergency-procedure entry times closer to standard than the annual long session alone.', 'تحافظ تمارين المحاكي القصيرة والمتكررة على أزمنة الدخول في إجراءات الطوارئ أقرب إلى المعيار مقارنة بالجلسة السنوية الطويلة وحدها.'),
    comparison: P('Crews on the annual long simulator session only, same quarter.', 'أطقم تكتفي بالجلسة السنوية الطويلة على المحاكي، في الربع نفسه.'),
    metrics: [M('entry_within_standard', 'Procedure entries within the standard time', 'الدخول في الإجراء ضمن الزمن المعياري', 'pct', 80, 90, 92, 81), M('drill_minutes', 'Simulator minutes per person', 'دقائق المحاكي لكل شخص', 'count', 240, 300, 320, 240)],
    status: 'closed', result: 'success', recommendation: 'expanded', adoption: 'expanded', signoff: '2026-04-09T09:00:00Z', closed: '2026-04-20T09:00:00Z',
    resultT: P('92% of procedure entries were within the standard time against 81% in the comparison crews; no extra simulator days were needed.', 'كانت 92% من حالات الدخول في الإجراء ضمن الزمن المعياري مقابل 81% لدى أطقم المقارنة؛ ولم تكن هناك حاجة إلى أيام محاكي إضافية.'),
    lessons: P('Book the slots in the shift pattern, not as overtime.', 'حجز الفترات ضمن نمط الوردية، لا كعمل إضافي.'),
  },
  {
    id: 'sp-peer-coaching', owner: 'p-training-mgr', evaluator: 'p-head-sq', skills: ['sk-ld-01-coach', 'sk-co-01-rounds'], start: '2025-09-15', end: '2026-03-15', n: [14, 15],
    title: P('Peer coaching circles for new shift technicians', 'حلقات إرشاد الأقران للفنيين الجدد في الورديات'),
    hypothesis: P('New technicians in a fortnightly peer coaching circle reach their first independent task sign-off sooner.', 'يصل الفنيون الجدد المشاركون في حلقة إرشاد أقران كل أسبوعين إلى أول اعتماد مستقل لمهمة في وقت أقرب.'),
    comparison: P('New technicians of the same intake with the usual mentor assignment only.', 'فنيون جدد من الدفعة نفسها مع تكليف المرشد المعتاد فقط.'),
    metrics: [M('days_to_signoff', 'Days to the first independent sign-off', 'الأيام حتى أول اعتماد مستقل', 'days', 120, 100, 118, 116), M('circle_attendance', 'Circle sessions attended', 'جلسات الحلقة التي تم حضورها', 'pct', 0, 80, 46, null)],
    status: 'closed', result: 'failed', recommendation: 'not_adopted', adoption: 'not_adopted', signoff: '2026-04-02T09:00:00Z', closed: '2026-04-14T09:00:00Z',
    resultT: P('No difference in time to sign-off (118 against 116 days). Attendance fell below half once outage season began.', 'لا فرق في الزمن حتى الاعتماد (118 مقابل 116 يوماً). وانخفض الحضور إلى أقل من النصف مع بدء موسم الإيقاف.'),
    lessons: P('Coaching that competes with shift work does not happen; build it into OJT instead.', 'الإرشاد الذي ينافس عمل الوردية لا يحدث؛ ينبغي دمجه في التدريب أثناء العمل بدلاً من ذلك.'),
  },
  {
    id: 'sp-mobile-ojt', owner: 'p-training-mgr', evaluator: 'p-compliance', skills: ['sk-fs-dp-ework', 'sk-mp-01'], start: '2025-12-01', end: '2026-05-31', n: [40, 38],
    title: P('Mobile sign-off for the OJT logbook', 'الاعتماد عبر الهاتف لسجل التدريب أثناء العمل'),
    hypothesis: P('Signing OJT tasks on a tablet at the job site shortens the wait for an evaluator\'s sign-off.', 'يؤدي اعتماد مهام التدريب أثناء العمل على جهاز لوحي في موقع العمل إلى تقصير انتظار اعتماد المقيّم.'),
    comparison: P('Paper logbooks signed in the training office, same job families.', 'سجلات ورقية تُعتمد في مكتب التدريب، للعائلات الوظيفية نفسها.'),
    metrics: [M('days_waiting', 'Days waiting for a sign-off', 'أيام انتظار الاعتماد', 'days', 9, 3, 2.5, 8.5)],
    status: 'closed', result: 'success', recommendation: 'adopted', adoption: 'adopted', signoff: '2026-06-10T09:00:00Z', closed: '2026-06-18T09:00:00Z',
    resultT: P('The wait for a sign-off fell from about nine days to under three; evaluators signed more tasks in the field.', 'انخفض انتظار الاعتماد من نحو تسعة أيام إلى أقل من ثلاثة؛ واعتمد المقيّمون مهام أكثر في الميدان.'),
    lessons: P('Offline mode mattered more than any other feature in the plant.', 'كان وضع العمل دون اتصال أهم من أي ميزة أخرى داخل المحطة.'),
  },
  {
    id: 'sp-gig-weeks', owner: 'p-chco', evaluator: 'p-independent-approver', skills: ['sk-fs-tr-curiosity', 'sk-fs-ai-automation'], start: '2026-01-15', end: '2026-06-15', n: [22, 25],
    title: P('Future-skills gig weeks', 'أسابيع المهام القصيرة لمهارات المستقبل'),
    hypothesis: P('A protected week on a future-skills gig raises the share of participants with new counted evidence within three months.', 'يرفع أسبوع محمي في مهمة قصيرة لمهارات المستقبل نسبة المشاركين الذين لديهم أدلة محتسبة جديدة خلال ثلاثة أشهر.'),
    comparison: P('Applicants to the same gigs who were not released that quarter.', 'متقدّمون للمهام نفسها لم يُفرَغوا في ذلك الربع.'),
    metrics: [M('new_evidence', 'Participants with new counted evidence', 'المشاركون الذين لديهم أدلة محتسبة جديدة', 'pct', 20, 50, 41, 22), M('backfill_days', 'Backfill days needed', 'أيام التغطية المطلوبة', 'days', 0, 60, 95, null)],
    status: 'closed', result: 'mixed', recommendation: 'further_funded', adoption: 'further_funded', signoff: '2026-07-02T09:00:00Z', closed: '2026-07-10T09:00:00Z',
    resultT: P('Evidence rose (41% against 22%), short of the 50% target, and backfill cost more days than planned.', 'ارتفعت الأدلة (41% مقابل 22%)، دون هدف 50%، وكلّفت التغطية أياماً أكثر من المخطط.'),
    lessons: P('Fund a second round with backfill agreed before release.', 'تمويل جولة ثانية مع الاتفاق على التغطية قبل الإفراغ.'),
  },
  {
    id: 'sp-twin-planner-drills', owner: 'p-ai-governance', evaluator: 'p-sme-reviewer', skills: ['sk-fs-ai-twin', 'sk-da-01-twins'], start: '2026-02-01', end: '2026-06-30', n: [9, 11],
    title: P('Digital-twin diagnosis drills for maintenance planners', 'تمارين التشخيص بالتوأم الرقمي لمخططي الصيانة'),
    hypothesis: P('Planners who practise twin diagnosis drills spot sensor drift in work requests earlier.', 'يكتشف المخططون الذين يتدرّبون على تمارين التشخيص بالتوأم الرقمي انحراف المستشعرات في طلبات العمل في وقت أبكر.'),
    comparison: P('Planners on the other unit without the drills.', 'مخططو الوحدة الأخرى دون التمارين.'),
    metrics: [M('drift_flagged', 'Drift cases flagged by planners', 'حالات الانحراف التي رصدها المخططون', 'pct', 30, 60, 28, 31)],
    status: 'closed', result: 'failed', recommendation: 'not_adopted', adoption: 'not_adopted', signoff: '2026-07-20T09:00:00Z', closed: '2026-07-28T09:00:00Z',
    resultT: P('No improvement: planners rarely see raw sensor data in their work, so the drills did not transfer. The pilot group was also below 10 people.', 'لا تحسّن: نادراً ما يرى المخططون بيانات المستشعرات الخام في عملهم، لذلك لم تنتقل التمارين إلى العمل. كما كانت مجموعة التجربة أقل من 10 أشخاص.'),
    lessons: P('Target the drills at system engineers, who handle the data; keep this failure in the registry.', 'توجيه التمارين إلى مهندسي الأنظمة الذين يتعاملون مع البيانات؛ وإبقاء هذا الإخفاق في السجل.'),
  },
  {
    id: 'sp-lecture-capture', owner: 'p-chco', evaluator: 'p-compliance', skills: ['sk-en-01', 'sk-fs-tr-curiosity'], start: '2025-10-15', end: '2026-04-15', n: [18, null],
    title: P('Expert lecture capture before retirement', 'تسجيل محاضرات الخبراء قبل التقاعد'),
    hypothesis: P('Recorded expert lectures with a short check let successors pass the role\'s knowledge check sooner.', 'تتيح محاضرات الخبراء المسجّلة مع اختبار قصير للخلفاء اجتياز اختبار المعرفة الخاص بالدور في وقت أقرب.'),
    comparison: P('Successors in earlier handovers, before the lecture library existed.', 'الخلفاء في عمليات تسليم سابقة، قبل وجود مكتبة المحاضرات.'),
    metrics: [M('days_to_check', 'Days to pass the knowledge check', 'الأيام حتى اجتياز اختبار المعرفة', 'days', 70, 50, 45, 72)],
    status: 'closed', result: 'success', recommendation: 'adopted', adoption: 'adopted', signoff: '2026-05-05T09:00:00Z', closed: '2026-05-12T09:00:00Z',
    resultT: P('Successors passed the knowledge check in about 45 days against 72 before the library.', 'اجتاز الخلفاء اختبار المعرفة في نحو 45 يوماً مقابل 72 يوماً قبل المكتبة.'),
    lessons: P('Record while the expert is still in post; edit lectures into short chapters.', 'التسجيل والخبير ما زال في منصبه؛ وتقسيم المحاضرات إلى فصول قصيرة.'),
  },
  {
    id: 'sp-ai-literacy-nudges', owner: 'p-ai-governance', evaluator: 'p-compliance', skills: ['sk-fs-ai-use', 'sk-da-02'], start: '2026-05-01', end: '2026-09-15', n: [60, 46],
    title: P('Weekly AI-literacy micro-lessons', 'دروس مصغّرة أسبوعية في الإلمام بالذكاء الاصطناعي'),
    hypothesis: P('Five-minute weekly micro-lessons move more staff to the Aware rung than the one-off module alone.', 'تنقل الدروس المصغّرة الأسبوعية لمدة خمس دقائق عدداً أكبر من الموظفين إلى درجة الإدراك مقارنة بالوحدة لمرة واحدة وحدها.'),
    comparison: P('Departments that kept the one-off AI basics module only.', 'إدارات اكتفت بوحدة أساسيات الذكاء الاصطناعي لمرة واحدة.'),
    metrics: [M('aware_share', 'Staff at the Aware rung or higher', 'الموظفون في درجة الإدراك أو أعلى', 'pct', 35, 55, 58, 39)],
    status: 'evaluating', result: 'success', recommendation: 'expanded', signoff: '2026-10-05T09:00:00Z',
    resultT: P('58% reached the Aware rung against 39% in the comparison departments; completion held through the summer.', 'بلغ 58% درجة الإدراك مقابل 39% في إدارات المقارنة؛ واستمر الإكمال خلال الصيف.'),
    lessons: P('Short and regular beats long and once; link each lesson to an approved tool.', 'القصير المنتظم أفضل من الطويل لمرة واحدة؛ مع ربط كل درس بأداة معتمدة.'),
  },
  {
    id: 'sp-adaptive-requal', owner: 'p-training-mgr', evaluator: 'p-independent-approver', skills: ['sk-co-01', 'sk-ns-02-techspec'], start: '2026-06-01', end: '2026-12-15', n: [26, 27],
    title: P('Adaptive requalification quizzes', 'اختبارات إعادة التأهيل التكيفية'),
    hypothesis: P('Adaptive quizzes that skip mastered topics cut requalification study time without lowering first-attempt pass rates.', 'تقلّص الاختبارات التكيفية التي تتخطى الموضوعات المتقنة وقت الدراسة لإعادة التأهيل دون خفض معدلات النجاح من المحاولة الأولى.'),
    comparison: P('Licensed operators on the fixed requalification quiz in the same cycle.', 'مشغّلون مرخّصون يخضعون لاختبار إعادة التأهيل الثابت في الدورة نفسها.'),
    metrics: [M('study_hours', 'Study hours per person', 'ساعات الدراسة لكل شخص', 'hours', 16, 11), M('first_pass', 'First-attempt pass rate', 'معدل النجاح من المحاولة الأولى', 'pct', 92, 92)],
    status: 'running',
  },
  {
    id: 'sp-rotation-buddies', owner: 'p-chco', evaluator: 'p-head-sq', skills: ['sk-fs-tr-crosscultural', 'sk-ld-01'], start: '2026-11-01', end: '2027-04-30', n: [null, null],
    title: P('Buddy system for future-role rotations', 'نظام الرفيق لمناوبات أدوار المستقبل'),
    hypothesis: P('A buddy in the host team helps people on future-role rotations reach useful work in the first month.', 'يساعد رفيق في الفريق المضيف الأشخاص في مناوبات أدوار المستقبل على الوصول إلى عمل مفيد خلال الشهر الأول.'),
    comparison: P('Rotations in the previous year, without a named buddy.', 'المناوبات في العام السابق، دون رفيق مسمّى.'),
    metrics: [M('useful_week', 'Week of the first useful deliverable', 'الأسبوع الذي يُسلَّم فيه أول ناتج مفيد', 'count', 6, 3)],
    status: 'draft',
  },
];

/** Recompute the stored disclosure values on the current tables (the HR analyst's last save), keeping narratives and approvals. */
export function recomputeDisclosures(T) {
  const rungs = staffRungs((t) => T[t] ?? []);
  const sorted = [...(T.hc_disclosures ?? [])].sort((a, b) => (a.period < b.period ? -1 : 1));
  for (const d of sorted) {
    const others = (t) => (t === 'hc_disclosures' ? sorted.filter((x) => x.period < d.period) : T[t] ?? []);
    d.metric_values = disclosureFromTables(others, d.period, rungs);
  }
}

/** fsqa4 (FINALIZE_LAST, runs after this file by name) tags the FS31 micro-credentials and rebuilds the credit ledger so their awards count;
 *  the disclosures must see that final ledger. A read-only view: the same two exported fs29 steps on a shallow copy (T is not changed). */
function finalView(T) {
  const V = { ...T };
  if (T.credit_tags && T.credit_stacks) { ensureCreditTags(V); rebuildLedger(V); }
  return V;
}

export default function build() {}

export function finalize(T) {
  // ── FS60 metric library
  T.hc_metrics = T.hc_metrics ?? [];
  METRICS.forEach((m, i) => {
    const s = METRIC_SPEC[m.key];
    if (!s) throw new Error(`fs60 seed: unknown metric key ${m.key}`);
    if (!T.people.some((p) => p.id === m.owner.id && p.kind === 'staff' && p.status === 'active')) throw new Error(`fs60 seed: owner ${m.owner.id} is not an active role card`);
    T.hc_metrics.push({
      id: m.id, key: m.key, iso_area: 'skills_capabilities_development', name_en: m.name_en, name_ar: m.name_ar, definition_en: m.definition_en, definition_ar: m.definition_ar,
      formula_en: m.formula_en, formula_ar: m.formula_ar, source_en: m.source_en, source_ar: m.source_ar, source_tables: m.source_tables, owner_function: m.owner_function,
      owner_person_id: m.owner.id, owner_en: m.owner.en, owner_ar: m.owner.ar, unit: s.unit, basis: s.basis, better: s.better, benchmark_ids: m.benchmark_ids,
      status: 'active', sort: i + 1, version: 1, simulated: true,
    });
  });
  const ids = METRICS.map((m) => m.id);
  // ── FS60 disclosures (values computed with the RPC rule; narratives written from the computed values)
  T.hc_disclosures = T.hc_disclosures ?? [];
  if (!materialityOk(MATERIALITY.en, MATERIALITY.ar)) throw new Error('fs60 seed: materiality statement');
  const V = finalView(T);
  const rungs = staffRungs((t) => V[t] ?? []);
  for (const d of DISCLOSURES) {
    const vals = disclosureFromTables((t) => V[t] ?? [], d.period, rungs);
    const narratives = {};
    for (const mid of d.narratives === 'all' ? ids : d.narratives) {
      const m = METRICS.find((x) => x.id === mid);
      const v = vals.metrics.find((x) => x.metric_id === mid);
      const n = narrativeFor(m.key, v, d.period);
      if (lineProblem({ metric_id: mid, ...n }, ids)) throw new Error(`fs60 seed: narrative ${d.period} ${mid} ${lineProblem({ metric_id: mid, ...n }, ids)}`);
      narratives[mid] = { ...n, ...(d.writtenBy?.[mid] ?? { by: d.prepared, at: d.created }) };
    }
    const approvals = {};
    for (const mid of d.approve.ids === 'all' ? ids : d.approve.ids) {
      if (!narratives[mid] || narratives[mid].by === d.approve.by) throw new Error(`fs60 seed: ${d.period} ${mid} approval breaks maker-checker`);
      approvals[mid] = { by: d.approve.by, at: d.approve.at };
    }
    const published = ids.every((m) => approvals[m]);
    const b = periodBounds(d.period);
    T.hc_disclosures.push({
      id: `hcd-${d.period}`, period: d.period, period_start: b.start, period_end: b.end, status: published ? 'published' : 'draft', metric_values: vals, narratives, approvals,
      materiality_en: MATERIALITY.en, materiality_ar: MATERIALITY.ar, method: vals.method, computed_on: d.computed_on, prepared_by: d.prepared, created_at: d.created,
      updated_by: d.approve.by, updated_at: d.approve.at, published_by: published ? d.approve.by : null, published_at: published ? d.approve.at : null,
      version: Object.keys(approvals).length ? 2 : 1, simulated: true,
    });
  }
  // ── FS61 pilots
  T.skill_pilots = T.skill_pilots ?? [];
  const pctx = (creator) => ({ staff: T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id), skills: T.skills.map((s) => s.id), creator });
  PILOTS.forEach((p, i) => {
    const creator = 'p-k-hr-analyst';
    const input = {
      id: p.id, title_en: p.title.en, title_ar: p.title.ar, hypothesis_en: p.hypothesis.en, hypothesis_ar: p.hypothesis.ar, comparison_en: p.comparison.en, comparison_ar: p.comparison.ar,
      pilot_n: p.n[0], comparison_n: p.n[1], owner_person_id: p.owner, evaluator_person_id: p.evaluator, metrics: p.metrics.map(({ pilot, comparison, ...m }) => m), // eslint-disable-line no-unused-vars
      skill_ids: p.skills, start_on: p.start, end_on: p.end, status: p.status === 'draft' ? 'draft' : 'running',
    };
    const pr = pilotProblem(input, pctx(creator), true);
    if (pr) throw new Error(`fs60 seed: pilot ${p.id} ${pr}`);
    const signed = p.status === 'evaluating' || p.status === 'closed';
    if (signed) {
      const so = { result: p.result, recommendation: p.recommendation, result_en: p.resultT.en, result_ar: p.resultT.ar, lessons_en: p.lessons.en, lessons_ar: p.lessons.ar,
        metric_results: p.metrics.map((m) => ({ key: m.key, pilot: m.pilot, comparison: m.comparison })) };
      const sp = signoffProblem(so, p.metrics.map((m) => m.key));
      if (sp) throw new Error(`fs60 seed: pilot ${p.id} sign-off ${sp}`);
    }
    if (p.status === 'closed' && closeProblem(p.adoption, p.result)) throw new Error(`fs60 seed: pilot ${p.id} adoption`);
    const createdAt = p.status === 'draft' ? '2026-10-02T08:00:00Z' : `${p.start}T08:00:00Z`;
    const last = p.closed ?? p.signoff ?? createdAt;
    T.skill_pilots.push({
      id: p.id, title_en: p.title.en, title_ar: p.title.ar, hypothesis_en: p.hypothesis.en, hypothesis_ar: p.hypothesis.ar, comparison_en: p.comparison.en, comparison_ar: p.comparison.ar,
      pilot_n: p.n[0], comparison_n: p.n[1], owner_person_id: p.owner, evaluator_person_id: p.evaluator,
      metrics: p.metrics.map((m) => ({ ...m, pilot: signed ? m.pilot : null, comparison: signed ? m.comparison : null })), skill_ids: p.skills, start_on: p.start, end_on: p.end,
      status: p.status, result: signed ? p.result : null, recommendation: signed ? p.recommendation : null, adoption: p.status === 'closed' ? p.adoption : null,
      result_en: signed ? p.resultT.en : '', result_ar: signed ? p.resultT.ar : '', lessons_en: signed ? p.lessons.en : '', lessons_ar: signed ? p.lessons.ar : '',
      signoff_by: signed ? p.evaluator : null, signoff_at: signed ? p.signoff : null, closed_by: p.status === 'closed' ? 'p-chco' : null, closed_at: p.status === 'closed' ? p.closed : null,
      published: p.status === 'closed', benchmark_ids: ['FSC'], created_by: creator, created_at: createdAt, updated_by: signed ? (p.status === 'closed' ? 'p-chco' : p.evaluator) : null, updated_at: last,
      version: p.status === 'closed' ? 3 : signed ? 2 : 1, sort: i + 1, simulated: true,
    });
  });
  const st = adoptionRate(T.skill_pilots);
  if (st.closed !== 8 || st.failed !== 2) throw new Error(`fs60 seed: expected 8 closed pilots with 2 failures, got ${st.closed}/${st.failed}`);
  const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3');
  console.log(`fs60/61: ${T.hc_metrics.length} ISO 30414 metrics; disclosures ${T.hc_disclosures.map((d) => `${d.period} ${d.status} (${Object.keys(d.approvals).length}/${ids.length} approved)`).join(', ')}; `
    + `2026-Q3 ${q3.metric_values.metrics.map((m) => `${m.key}=${m.value ?? 'suppressed'}`).join(' ')}; ${T.skill_pilots.length} pilots (${st.closed} closed, ${st.failed} failed kept visible), adoption ${st.rate}%`);
}
