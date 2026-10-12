// FS wave I · E4 seed (FS82 Rolling mobility micro-grants + FS83 UAE energy consortium trainee cohort, M36 Skills Ecosystem).
// FINALIZE_LAST: built after the FS02 catalogue (future skills) and the FS19/FS20 academies exist. Synthetic only: applicants are
// synthetic workers and role-card personas; partner trainees are pseudonymous codes; partner organisations are synthetic and labelled;
// every budget is SIMULATED (AED, demo figures) and every row is SAMPLE (`sample: true`). Every row passes the rules the RPCs use
// (src/modules/m36/{grants,consortium}.ts); the builder fails on any breach.
// Deliberately NO F01 skill evidence is seeded (the FS66/FS72 precedent): an accepted grant output and a confirmed visit write evidence
// only for ENEC staff, and every seeded confirmed visit or accepted output belongs to a partner trainee or a placement student (no Kafa'a
// skills profile). So no skill state, digest, signal list, suggestion or wallet changes; the evidence appears live when HR accepts an
// output (nse, sg. 2026-06 round) or a host confirms an ENEC trainee's visit (k-lo-trainee, w-lo-02, w-lo-09 ...). Seed dates <= 2026-10-11.
//  - grant_rounds (4): the pilot round to 10 Jun 2026, then contiguous bi-monthly rounds to 10 Aug, 10 Oct (closed, decisions due 24 Oct:
//    the HR director's demo) and 10 Dec 2026 (open since 11 Oct). The next round (to 10 Feb 2027) is the HR analyst's demo action.
//  - grant_applications (45): decided rounds with approvals, declines and withdrawals; outputs submitted, returned, overdue and due; two
//    placement students filed on their behalf by HR with consent references (outputs accepted, kept on the application).
//  - organisations (3, shared M09 table, additive): synthetic energy employers for the consortium (not publicly listed).
//  - consortium_cohorts (2), consortium_members (30), consortium_visits (45).
import { applicationProblem, costTotal, decisionProblem, eligibility, nextRoundSlot, outputProblem, roundPhase } from '../../../src/modules/m36/grants.ts';
import { consortiumOrg, enecTraineeEligible, memberDecisionProblem, partnerOf, traineeCode, visitLevel, visitProblem } from '../../../src/modules/m36/consortium.ts';

export const FINALIZE_LAST = true;
const SEED_DAY = '2026-10-11';

export const NEW_ORGS = [
  ['org-cx-grid', 'Sahel Grid Services (synthetic)', 'خدمات شبكة الساحل (افتراضي)', 'SGS', 'Synthetic grid operator in the FS83 consortium trainee cohort demo.', 'مشغّل شبكة افتراضي في عرض دفعة المتدربين المشتركة.'],
  ['org-cx-solar', 'Qamar Solar Operations (synthetic)', 'قمر لتشغيل الطاقة الشمسية (افتراضي)', 'QSO', 'Synthetic solar plant operator in the FS83 consortium trainee cohort demo.', 'مشغّل محطة طاقة شمسية افتراضي في عرض دفعة المتدربين المشتركة.'],
  ['org-cx-h2', 'Rimal Hydrogen and Heat Works (synthetic)', 'رمال لأعمال الهيدروجين والحرارة (افتراضي)', 'RHW', 'Synthetic hydrogen and process-heat producer in the FS83 consortium trainee cohort demo.', 'منتج افتراضي للهيدروجين والحرارة الصناعية في عرض دفعة المتدربين المشتركة.'],
].map(([id, en, ar, short, ren, rar]) => ({
  id, name_en: en, name_ar: ar, short, kind: 'partner', category: 'synthetic', categories: ['synthetic'], rel_types: ['consortium'], relationship_en: ren, relationship_ar: rar,
  status: 'active', dates: '', country: 'AE', binding: false, public_listed: false, synthetic: true, nexus_org_id: null, icv_score: null, sources: [], contact_route: null,
}));

// ═════════════ FS82
const ROUNDS = [
  { id: 'gr-2026-06', opens_on: '2026-05-01', closes_on: '2026-06-10', budget: 120000, max_award: 15000, by: 'p-chco', at: '2026-04-20T08:00:00Z', note: 'Pilot round: conferences, short courses, site visits and exchanges for early-career staff.' },
  { id: 'gr-2026-08', opens_on: '2026-06-11', closes_on: '2026-08-10', budget: 150000, max_award: 15000, by: 'p-k-hr-analyst', at: '2026-06-05T08:00:00Z', note: null },
  { id: 'gr-2026-10', opens_on: '2026-08-11', closes_on: '2026-10-10', budget: 120000, max_award: 15000, by: 'p-k-hr-analyst', at: '2026-08-04T08:00:00Z', note: null },
  { id: 'gr-2026-12', opens_on: '2026-10-11', closes_on: '2026-12-10', budget: 180000, max_award: 15000, by: 'p-k-hr-analyst', at: '2026-10-01T08:00:00Z', note: 'Includes the winter conference season.' },
];
// [kind, title, destination, skill, output, purpose]
const ACT = {
  smr: ['conference', 'Small modular reactor technology and licensing conference', 'International SMR conference, Europe (sample listing)', 'sk-fs-adv-smr', 'presentation',
    'Hear how operators prepare people for multi-module plants and bring back a short briefing for my team on what changes for operations.'],
  dic: ['short_course', 'Digital I&C fundamentals short course', 'University short course, Republic of Korea (sample listing)', 'sk-fs-dp-dic', 'report',
    'Build a working understanding of digital instrumentation and control so I can support the I&C modernisation studies in my section.'],
  outage: ['site_visit', 'Reference-plant outage observation', 'Partner nuclear plant during its refuelling outage (sample listing)', 'sk-fs-tr-techlit', 'report',
    'Observe how another operator plans and runs outage work, and compare their work-control practices with ours.'],
  exchange: ['exchange', 'Two-week engineering office exchange', 'Partner operator engineering office (sample listing)', 'sk-fs-tr-crosscultural', 'presentation',
    'Work alongside engineers of a partner operator for two weeks and present what we could adopt in design-change reviews.'],
  km: ['conference', 'Nuclear knowledge management symposium', 'Regional knowledge management symposium (sample listing)', 'sk-fs-tr-curiosity', 'presentation',
    'Learn how other plants keep expert knowledge when experienced staff retire and present one practice to the knowledge community.'],
  h2: ['short_course', 'Hydrogen and process heat short course', 'Partner university summer school (sample listing)', 'sk-fs-gr-h2heat', 'report',
    'Understand how nuclear heat could serve hydrogen and industrial users and what that means for plant interfaces.'],
  data: ['short_course', 'Data quality for plant records course', 'Professional body online course with a workshop day (sample listing)', 'sk-fs-ai-plantdata', 'report',
    'Learn practical data-quality checks for plant records and apply them to the condition-monitoring data I maintain.'],
  fab: ['site_visit', 'Module fabrication yard visit', 'Module fabrication yard of a reactor vendor (sample listing)', 'sk-fs-adv-factoryqa', 'report',
    'See factory fabrication quality controls first hand and compare them with our receipt inspection of supplied components.'],
  grid: ['conference', 'Grid flexibility and storage conference', 'Regional power-system conference (sample listing)', 'sk-fs-gr-grid', 'presentation',
    'Understand how flexible operation and storage change the demands on baseload plants and share the main points with operations.'],
  aiv: ['short_course', 'AI output verification for engineers', 'Engineering institute short course (sample listing)', 'sk-fs-ai-verify', 'report',
    'Learn structured ways to check and challenge AI-generated analysis before it is used in engineering work.'],
  twin: ['site_visit', 'Digital twin laboratory visit', 'University digital twin laboratory (sample listing)', 'sk-fs-ai-twin', 'report',
    'See how a digital twin is validated against plant data and report what a validation step would need at our site.'],
  lca: ['conference', 'Lifecycle carbon assessment forum', 'Energy sustainability forum (sample listing)', 'sk-fs-gr-lifecycle', 'presentation',
    'Learn lifecycle carbon methods used for low-carbon generation and present how they apply to plant activities.'],
  robot: ['short_course', 'Robotics and remote inspection course', 'Technical training centre course (sample listing)', 'sk-fs-dp-robotics', 'report',
    'Gain hands-on practice with remote inspection tools and report where they could reduce dose in routine inspections.'],
  esg: ['conference', 'ورشة إقليمية حول الإفصاح البيئي والاجتماعي والحوكمة في قطاع الطاقة', 'ورشة إقليمية لقطاع الطاقة (إعلان تجريبي)', 'sk-fs-gr-esg', 'presentation',
    'أرغب في فهم متطلبات الإفصاح البيئي والاجتماعي والحوكمي وكيف تنعكس على بيانات الاستدامة التي أعدّها لفريقي.'],
  sys: ['exchange', 'تبادل مهني مع مركز تدريب شريك على أجهزة المحاكاة', 'مركز تدريب شريك (إعلان تجريبي)', 'sk-fs-tr-systems', 'report',
    'أتعلم أساليب مدربي المحاكاة في مركز شريك وأكتب تقريراً عما يمكن تطبيقه في تدريب فرق التشغيل لدينا.'],
};
// [id, round, person, act, start, days, costs [transport, subsistence, registration], status, award, decided [at], note, output [state, at, by?], extra]
// output states: sub (submitted), ret (returned), acc (accepted, placement only), none
const APPS = [
  // ── pilot round to 10 Jun (12): 8 approved (2 placement students), 3 declined, 1 withdrawn
  ['ga-2026-06-01', 'gr-2026-06', 'p-nse', 'dic', '2026-07-06', 4, [3200, 2600, 4800], 'approved', 10600, '2026-06-20', null, ['sub', '2026-08-01T09:00:00Z']],
  ['ga-2026-06-02', 'gr-2026-06', 'w-ro-02', 'outage', '2026-07-13', 9, [4500, 6200, 0], 'approved', 10700, '2026-06-20', null, ['sub', '2026-08-18T09:00:00Z']],
  ['ga-2026-06-03', 'gr-2026-06', 'w-eng-03', 'smr', '2026-09-14', 3, [5200, 3100, 3500], 'approved', 11800, '2026-06-21', null, ['sub', '2026-09-30T09:00:00Z']],
  ['ga-2026-06-04', 'gr-2026-06', 'w-chem-02', 'h2', '2026-07-20', 4, [3900, 2400, 4100], 'approved', 10400, '2026-06-21', null, ['ret', '2026-08-10T09:00:00Z', 'Please add what you will change in your own work, with one example from the course.', '2026-08-25T09:00:00Z']],
  ['ga-2026-06-05', 'gr-2026-06', 'w-mnt-03', 'fab', '2026-08-10', 4, [4800, 2900, 0], 'approved', 7700, '2026-06-22', null, null],
  ['ga-2026-06-06', 'gr-2026-06', 'w-qa-01', 'data', '2026-07-27', 2, [600, 900, 2800], 'approved', 4300, '2026-06-22', null, ['sub', '2026-09-05T09:00:00Z']],
  ['ga-2026-06-07', 'gr-2026-06', 'a-04', 'twin', '2026-07-14', 2, [1800, 1200, 0], 'approved', 3000, '2026-06-23', null, ['acc', '2026-08-02T09:00:00Z', null, '2026-09-02T09:00:00Z'], { consent_ref: 'EP-CONSENT-2026-014' }],
  ['ga-2026-06-08', 'gr-2026-06', 'a-05', 'grid', '2026-07-21', 2, [2400, 1600, 1900], 'approved', 5900, '2026-06-23', null, ['acc', '2026-08-04T09:00:00Z', null, '2026-09-02T10:00:00Z'], { consent_ref: 'EP-CONSENT-2026-015' }],
  ['ga-2026-06-09', 'gr-2026-06', 'w-ro-05', 'exchange', '2026-08-02', 13, [5600, 8800, 0], 'declined', null, '2026-06-22', 'The pilot budget could not cover a two-week exchange; please apply again in a later round.', null],
  ['ga-2026-06-10', 'gr-2026-06', 'w-fire-01', 'km', '2026-09-07', 2, [4200, 2200, 3600], 'declined', null, '2026-06-22', 'The purpose does not yet link the symposium to your role; please add how you will use it.', null],
  ['ga-2026-06-11', 'gr-2026-06', 'w-rp-02', 'robot', '2026-08-17', 4, [1200, 2600, 5200], 'declined', null, '2026-06-23', 'A similar course is planned in-house this year; your training plan lists it.', null],
  ['ga-2026-06-12', 'gr-2026-06', 'w-ep-01', 'lca', '2026-09-21', 2, [4300, 1800, 2500], 'withdrawn', null, null, null, null],
  // ── round to 10 Aug (16): 10 approved, 4 declined, 2 withdrawn
  ['ga-2026-08-01', 'gr-2026-08', 'p-qc-inspector', 'smr', '2026-09-22', 3, [5100, 3400, 3500], 'approved', 12000, '2026-08-18', null, null],
  ['ga-2026-08-02', 'gr-2026-08', 'w-lo-04', 'outage', '2026-09-08', 4, [3300, 3100, 0], 'approved', 6400, '2026-08-18', null, ['sub', '2026-10-02T09:00:00Z']],
  ['ga-2026-08-03', 'gr-2026-08', 'w-eng-04', 'aiv', '2026-09-15', 4, [800, 1500, 4200], 'approved', 6500, '2026-08-18', null, ['sub', '2026-10-06T09:00:00Z']],
  ['ga-2026-08-04', 'gr-2026-08', 'w-chem-03', 'lca', '2026-09-28', 4, [4100, 2600, 2700], 'approved', 9400, '2026-08-19', null, null],
  ['ga-2026-08-05', 'gr-2026-08', 'w-mnt-05', 'robot', '2026-10-19', 4, [1300, 2500, 5400], 'approved', 9200, '2026-08-19', null, null],
  ['ga-2026-08-06', 'gr-2026-08', 'w-ro-07', 'grid', '2026-11-09', 2, [4600, 1900, 2800], 'approved', 9300, '2026-08-19', null, null],
  ['ga-2026-08-07', 'gr-2026-08', 'w-sc-01', 'esg', '2026-11-16', 2, [1500, 1200, 1600], 'approved', 4300, '2026-08-20', null, null],
  ['ga-2026-08-08', 'gr-2026-08', 'w-wc-01', 'exchange', '2026-11-29', 13, [5600, 8400, 0], 'approved', 14000, '2026-08-20', null, null],
  ['ga-2026-08-09', 'gr-2026-08', 'w-rp-04', 'twin', '2026-12-07', 2, [1900, 1300, 0], 'approved', 3200, '2026-08-20', null, null],
  ['ga-2026-08-10', 'gr-2026-08', 'p-outage-planner', 'km', '2026-12-14', 2, [4100, 2300, 3400], 'approved', 9000, '2026-08-21', 'Approved at 9,000 AED (the registration fee is covered by the organiser discount).', null],
  ['ga-2026-08-11', 'gr-2026-08', 'p-sme-reviewer', 'h2', '2026-10-05', 4, [4200, 2700, 4300], 'declined', null, '2026-08-21', 'Please link the course to a current task in your section and apply again.', null],
  ['ga-2026-08-12', 'gr-2026-08', 'w-eng-05', 'smr', '2026-11-02', 3, [5300, 3300, 3500], 'declined', null, '2026-08-21', 'Two colleagues from the same section attend this conference; please share their briefing.', null],
  ['ga-2026-08-13', 'gr-2026-08', 'w-ep-02', 'data', '2026-10-12', 2, [700, 900, 2900], 'declined', null, '2026-08-21', 'The course is available free of charge through the learning catalogue.', null],
  ['ga-2026-08-14', 'gr-2026-08', 'w-qa-02', 'fab', '2026-10-26', 4, [4700, 3000, 0], 'declined', null, '2026-08-21', 'The vendor visit is planned through the supplier quality programme instead.', null],
  ['ga-2026-08-15', 'gr-2026-08', 'w-mnt-02', 'dic', '2026-11-23', 4, [3300, 2700, 4900], 'withdrawn', null, null, null, null],
  ['ga-2026-08-16', 'gr-2026-08', 'w-corp-01', 'sys', '2026-10-04', 6, [2400, 3600, 0], 'withdrawn', null, null, null, null],
  // ── round to 10 Oct (closed 10 Oct; decisions due 24 Oct): 14 waiting + 1 withdrawn; requests exceed the SIMULATED budget
  ['ga-2026-10-01', 'gr-2026-10', 'p-buyer', 'fab', '2026-11-10', 3, [4600, 2800, 0], 'submitted', null, null, null, null],
  ['ga-2026-10-02', 'gr-2026-10', 'p-k-ro', 'outage', '2026-11-17', 6, [3800, 4600, 0], 'submitted', null, null, null, null],
  ['ga-2026-10-03', 'gr-2026-10', 'w-ro-01', 'smr', '2027-01-18', 3, [5400, 3500, 3600], 'submitted', null, null, null, null],
  ['ga-2026-10-04', 'gr-2026-10', 'w-ro-03', 'grid', '2026-12-01', 2, [4500, 2000, 2900], 'submitted', null, null, null, null],
  ['ga-2026-10-05', 'gr-2026-10', 'w-lo-01', 'twin', '2026-11-24', 2, [2000, 1300, 0], 'submitted', null, null, null, null],
  ['ga-2026-10-06', 'gr-2026-10', 'w-eng-02', 'aiv', '2026-12-07', 4, [900, 1600, 4300], 'submitted', null, null, null, null],
  ['ga-2026-10-07', 'gr-2026-10', 'w-chem-01', 'h2', '2027-02-08', 4, [4300, 2800, 4500], 'submitted', null, null, null, null],
  ['ga-2026-10-08', 'gr-2026-10', 'w-mnt-04', 'robot', '2027-01-11', 4, [1400, 2600, 5300], 'submitted', null, null, null, null],
  ['ga-2026-10-09', 'gr-2026-10', 'w-rp-01', 'exchange', '2027-02-15', 13, [6100, 8600, 0], 'submitted', null, null, null, null],
  ['ga-2026-10-10', 'gr-2026-10', 'w-ro-06', 'km', '2026-12-14', 2, [4200, 2300, 3400], 'submitted', null, null, null, null],
  ['ga-2026-10-11', 'gr-2026-10', 'w-sec-01', 'data', '2026-11-30', 2, [700, 1000, 2900], 'submitted', null, null, null, null],
  ['ga-2026-10-12', 'gr-2026-10', 'w-fire-02', 'lca', '2027-01-25', 2, [4300, 1900, 2600], 'submitted', null, null, null, null],
  ['ga-2026-10-13', 'gr-2026-10', 'w-corp-02', 'esg', '2026-12-08', 2, [1600, 1300, 1700], 'submitted', null, null, null, null],
  ['ga-2026-10-14', 'gr-2026-10', 'w-lo-08', 'dic', '2027-03-01', 4, [3400, 2700, 4900], 'submitted', null, null, null, null],
  ['ga-2026-10-15', 'gr-2026-10', 'w-ro-08', 'fab', '2026-12-15', 3, [4600, 2800, 0], 'withdrawn', null, null, null, null],
  // ── round to 10 Dec (open since 11 Oct): the first two applications
  ['ga-2026-12-01', 'gr-2026-12', 'p-outage-planner', 'twin', '2027-01-12', 2, [2000, 1300, 0], 'submitted', null, null, null, null],
  ['ga-2026-12-02', 'gr-2026-12', 'w-eng-05', 'smr', '2027-02-22', 3, [5300, 3300, 3500], 'submitted', null, null, null, null],
];

// ═════════════ FS83
const SRC = [
  { label: 'Fortum · Nordic Nuclear Trainee Programme (NNTP)', url: 'https://www.fortum.com/careers/NNTP', as_of: '2026-10-10', secondary: true },
  { label: 'WAM · EGA launches EGA Academy', url: 'https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy', as_of: '2026-10-10', secondary: false },
];
const partners = (seats) => [
  { org_id: 'enec-ops', code: 'EN', role: 'lead', name_en: 'ENEC (lead employer)', name_ar: 'مؤسسة الإمارات للطاقة النووية (الجهة الرائدة)', site_en: 'Barakah training centre', site_ar: 'مركز التدريب في براكة', visit_skill: 'sk-fs-tr-techlit', seats: seats[0], kafaa_access: true, synthetic: false },
  { org_id: 'org-cx-grid', code: 'SG', role: 'partner', name_en: 'Sahel Grid Services (synthetic)', name_ar: 'خدمات شبكة الساحل (افتراضي)', site_en: 'Grid control and dispatch centre', site_ar: 'مركز التحكم بالشبكة وتوزيع الأحمال', visit_skill: 'sk-fs-gr-grid', seats: seats[1], kafaa_access: false, synthetic: true },
  { org_id: 'org-cx-solar', code: 'QS', role: 'partner', name_en: 'Qamar Solar Operations (synthetic)', name_ar: 'قمر لتشغيل الطاقة الشمسية (افتراضي)', site_en: 'Solar plant operations', site_ar: 'تشغيل محطة الطاقة الشمسية', visit_skill: 'sk-fs-gr-lifecycle', seats: seats[2], kafaa_access: false, synthetic: true },
  { org_id: 'org-cx-h2', code: 'RH', role: 'partner', name_en: 'Rimal Hydrogen and Heat Works (synthetic)', name_ar: 'رمال لأعمال الهيدروجين والحرارة (افتراضي)', site_en: 'Hydrogen and process-heat pilot', site_ar: 'مشروع تجريبي للهيدروجين والحرارة الصناعية', visit_skill: 'sk-fs-gr-h2heat', seats: seats[3], kafaa_access: false, synthetic: true },
  { org_id: 'org-alnoor', code: 'AN', role: 'partner', name_en: 'Al Noor Precision Engineering LLC (synthetic)', name_ar: 'النور للهندسة الدقيقة (اصطناعية)', site_en: 'Precision machining and module fabrication workshop', site_ar: 'ورشة التشغيل الدقيق وتصنيع الوحدات', visit_skill: 'sk-fs-adv-factoryqa', seats: seats[4], kafaa_access: true, synthetic: true },
  { org_id: 'org-gulfhydro', code: 'GH', role: 'partner', name_en: 'Gulf Hydro-Valve Industries LLC (synthetic)', name_ar: 'الخليج للصمامات الهيدروليكية (اصطناعية)', site_en: 'Valve manufacturing and remote-inspection test bay', site_ar: 'تصنيع الصمامات ومنصة اختبار الفحص عن بُعد', visit_skill: 'sk-fs-dp-robotics', seats: seats[5], kafaa_access: true, synthetic: true },
];
const MENTORS = [
  ['mt-en-1', 'enec-ops', 'Senior reactor operator mentor (role card)', 'مرشد مشغّل مفاعل أول (بطاقة دور)'],
  ['mt-en-2', 'enec-ops', 'Training engineer mentor (role card)', 'مرشد مهندس تدريب (بطاقة دور)'],
  ['mt-sg-1', 'org-cx-grid', 'Grid control mentor (role card)', 'مرشد التحكم بالشبكة (بطاقة دور)'],
  ['mt-qs-1', 'org-cx-solar', 'Solar operations mentor (role card)', 'مرشد تشغيل الطاقة الشمسية (بطاقة دور)'],
  ['mt-rh-1', 'org-cx-h2', 'Process-heat engineer mentor (role card)', 'مرشد مهندس الحرارة الصناعية (بطاقة دور)'],
  ['mt-an-1', 'org-alnoor', 'Fabrication QA mentor (role card)', 'مرشد ضمان جودة التصنيع (بطاقة دور)'],
  ['mt-gh-1', 'org-gulfhydro', 'Valve test mentor (role card)', 'مرشد اختبار الصمامات (بطاقة دور)'],
].map(([id, org_id, label_en, label_ar]) => ({ id, org_id, label_en, label_ar }));
const mods = (y, list) => list.map(([id, host, s, e, en, ar, course]) => ({ id, host_org_id: host, starts_on: `${y[s[0]]}-${s[1]}`, ends_on: `${y[s[0]]}-${e}`, title_en: en, title_ar: ar, course_id: course }));
const MODULES = [
  ['m1', 'enec-ops', [0, '09-14'], '09-16', 'Nuclear plant fundamentals and safety culture', 'أساسيات المحطة النووية وثقافة السلامة', 'c-fs-plantlit-x'],
  ['m2', 'org-cx-grid', [0, '10-05'], '10-07', 'Grid integration and flexible operation', 'التكامل مع الشبكة والتشغيل المرن', 'c-fs-systems'],
  ['m3', 'org-cx-solar', [0, '11-16'], '11-18', 'Lifecycle carbon and GHG accounting', 'الكربون على امتداد دورة الحياة ومحاسبة الانبعاثات', 'c-fs-ghg'],
  ['m4', 'org-cx-h2', [1, '01-18'], '01-20', 'Hydrogen and process heat', 'الهيدروجين والحرارة الصناعية', 'c-fs-h2heat'],
  ['m5', 'org-alnoor', [1, '03-15'], '03-17', 'Factory fabrication QA for modular builds', 'ضمان الجودة في التصنيع بالمصنع للبناء المعياري', 'c-fs-factoryqa'],
  ['m6', 'org-gulfhydro', [1, '05-17'], '05-19', 'Remote inspection, robotics and the project showcase', 'الفحص عن بُعد والروبوتات وعرض المشروع', null],
];
const MODULES_27 = [
  ['m1', 'enec-ops', [0, '02-08'], '02-10', 'Nuclear plant fundamentals and safety culture', 'أساسيات المحطة النووية وثقافة السلامة', 'c-fs-plantlit-x'],
  ['m2', 'org-cx-solar', [0, '03-22'], '03-24', 'Lifecycle carbon and GHG accounting', 'الكربون على امتداد دورة الحياة ومحاسبة الانبعاثات', 'c-fs-ghg'],
  ['m3', 'org-cx-grid', [0, '05-10'], '05-12', 'Grid integration and flexible operation', 'التكامل مع الشبكة والتشغيل المرن', 'c-fs-systems'],
  ['m4', 'org-gulfhydro', [0, '06-21'], '06-23', 'Remote inspection and robotics', 'الفحص عن بُعد والروبوتات', null],
  ['m5', 'org-cx-h2', [0, '09-13'], '09-15', 'Hydrogen and process heat', 'الهيدروجين والحرارة الصناعية', 'c-fs-h2heat'],
  ['m6', 'org-alnoor', [0, '11-08'], '11-10', 'Factory fabrication QA and the project showcase', 'ضمان الجودة في التصنيع وعرض المشروع', 'c-fs-factoryqa'],
];
const COHORT_TEXT = {
  summary_en: 'Six energy employers grow one graduate pool instead of competing for it: shared three-day modules hosted in turn at each member\'s site, one joint project in mixed-employer teams, and a mentor from another employer. Partner organisations are synthetic; budgets are SIMULATED.',
  summary_ar: 'ستّ جهات عاملة في قطاع الطاقة تنمّي معاً قاعدة واحدة من الخريجين بدلاً من التنافس عليها: وحدات مشتركة مدة كل منها ثلاثة أيام تستضيفها كل جهة بالتناوب في موقعها، ومشروع مشترك في فرق مختلطة من جهات مختلفة، ومرشد من جهة أخرى. الجهات الشريكة افتراضية، والميزانيات مُحاكاة.',
  project_en: 'Run one SIMULATED 24-hour energy system with nuclear, solar, grid and hydrogen: each mixed-employer team works out what the operators at one site need to know about the others, and where a hand-off between sites could fail.',
  project_ar: 'تشغيل منظومة طاقة مُحاكاة على مدى 24 ساعة تضم الطاقة النووية والشمسية والشبكة والهيدروجين: يحدد كل فريق مختلط ما يحتاج المشغّلون في موقع واحد إلى معرفته عن المواقع الأخرى، وأين قد يتعثر التسليم بين المواقع.',
  deliverable_en: 'A team study with its assumptions and a short briefing to the consortium board at the final module. SIMULATED data only.',
  deliverable_ar: 'دراسة فريق تتضمن افتراضاتها وإحاطة قصيرة لمجلس الاتحاد في الوحدة الأخيرة. بيانات مُحاكاة فقط.',
};
const SKILLS = ['sk-fs-tr-techlit', 'sk-fs-gr-grid', 'sk-fs-gr-lifecycle', 'sk-fs-gr-h2heat', 'sk-fs-adv-factoryqa', 'sk-fs-dp-robotics', 'sk-fs-tr-crosscultural', 'sk-fs-tr-systems'];
const BUDGET = (k) => [['enec-ops', 360000], ['org-cx-grid', 120000], ['org-cx-solar', 120000], ['org-cx-h2', 120000], ['org-alnoor', 60000], ['org-gulfhydro', 60000]].map(([org_id, a]) => ({ org_id, amount: Math.round(a * k) }));
const COHORTS = [
  {
    id: 'cc-2026', code: 'UEC-2026', title_en: 'UAE Energy Trainee Cohort 2026–27', title_ar: 'دفعة متدربي الطاقة في الإمارات 2026–2027', intake_year: 2026, academy_id: 'ac-energy',
    nominations_close_on: '2026-07-15', starts_on: '2026-09-01', ends_on: '2027-06-30', partners: partners([6, 4, 4, 4, 3, 3]), modules: mods(['2026', '2027'], MODULES), sort: 1, budget: BUDGET(1),
  },
  {
    id: 'cc-2027', code: 'UEC-2027', title_en: 'UAE Energy Trainee Cohort 2027', title_ar: 'دفعة متدربي الطاقة في الإمارات 2027', intake_year: 2027, academy_id: 'ac-energy',
    nominations_close_on: '2026-12-15', starts_on: '2027-02-01', ends_on: '2027-11-30', partners: partners([8, 4, 4, 4, 3, 3]), modules: mods(['2027'], MODULES_27), sort: 2, budget: BUDGET(1.1),
  },
].map((c) => ({ ...c, ...COHORT_TEXT, mentors: MENTORS, skills: SKILLS, currency: 'AED', sources: SRC, simulated: true, synthetic: true, listed: true }));

const DISC = ['operations', 'mechanical', 'electrical', 'chemical', 'instrumentation', 'environmental', 'digital'];
// cc-2026 members: [org, person|null, discipline, mentor, team, status, decision note]
const MEMBERS_26 = [
  ['enec-ops', 'p-k-lo-trainee', 'operations', 'mt-sg-1', 'A'], ['enec-ops', 'w-lo-02', 'operations', 'mt-qs-1', 'B'], ['enec-ops', 'w-lo-03', 'operations', 'mt-rh-1', 'C'],
  ['enec-ops', 'w-lo-06', 'operations', 'mt-an-1', 'D'], ['enec-ops', 'w-lo-07', 'operations', 'mt-gh-1', 'A'], ['enec-ops', 'w-lo-09', 'instrumentation', 'mt-sg-1', 'B'],
  ['org-cx-grid', null, 'electrical', 'mt-en-1', 'C'], ['org-cx-grid', null, 'electrical', 'mt-en-2', 'D'], ['org-cx-grid', null, 'digital', 'mt-qs-1', 'A'], ['org-cx-grid', null, 'operations', 'mt-rh-1', 'B'],
  ['org-cx-solar', null, 'electrical', 'mt-en-1', 'C'], ['org-cx-solar', null, 'environmental', 'mt-sg-1', 'D'], ['org-cx-solar', null, 'mechanical', 'mt-an-1', 'A'], ['org-cx-solar', null, 'operations', 'mt-en-2', 'B'],
  ['org-cx-h2', null, 'chemical', 'mt-en-1', 'C'], ['org-cx-h2', null, 'chemical', 'mt-gh-1', 'D'],
  ['org-cx-h2', null, 'mechanical', null, null, 'declined', 'Mechanical places in this cohort are covered by the other employers; please nominate for the 2027 cohort.'],
  ['org-cx-h2', null, 'environmental', 'mt-qs-1', 'A'], ['org-cx-h2', null, 'operations', 'mt-en-2', 'B'],
  ['org-alnoor', null, 'mechanical', 'mt-en-1', 'C'], ['org-alnoor', null, 'mechanical', 'mt-gh-1', 'D'], ['org-alnoor', null, 'instrumentation', 'mt-sg-1', 'A'],
  ['org-gulfhydro', null, 'mechanical', 'mt-an-1', 'B'], ['org-gulfhydro', null, 'instrumentation', 'mt-en-2', 'C'], ['org-gulfhydro', null, 'digital', 'mt-rh-1', 'D'],
];
// cc-2027 (nominations open to 15 Dec): [org, person|null, discipline, by, at, status, mentor, team]
const MEMBERS_27 = [
  ['org-cx-grid', null, 'electrical', 'p-k-hr-analyst', '2026-10-05T09:00:00Z', 'nominated'],
  ['enec-ops', 'w-lo-10', 'operations', 'p-k-hr-analyst', '2026-10-06T09:00:00Z', 'nominated'],
  ['enec-ops', 'w-lo-01', 'operations', 'p-k-hr-analyst', '2026-10-06T09:30:00Z', 'accepted', 'mt-sg-1', 'A', '2026-10-09T10:00:00Z'],
  ['org-alnoor', null, 'mechanical', 'p-alnoor-gm', '2026-10-07T09:00:00Z', 'nominated'],
  ['org-gulfhydro', null, 'instrumentation', 'p-gulfhydro-qa', '2026-10-08T09:00:00Z', 'nominated'],
];
const NOMINATOR = { 'enec-ops': 'p-k-hr-analyst', 'org-cx-grid': 'p-k-hr-analyst', 'org-cx-solar': 'p-k-hr-analyst', 'org-cx-h2': 'p-k-hr-analyst', 'org-alnoor': 'p-alnoor-gm', 'org-gulfhydro': 'p-gulfhydro-qa' };

const add = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default function () {}

export function finalize(T) {
  const fail = (m) => { throw new Error(`fs82-grants-consortium: ${m}`); };
  const people = Object.fromEntries(T.people.map((p) => [p.id, p]));
  const skills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const scholars = new Set((T.scholars ?? []).filter((s) => s.status === 'in_study').map((s) => s.person_id));
  // ── organisations (shared M09 table, new rows only)
  for (const o of NEW_ORGS) { if (T.organisations.some((x) => x.id === o.id)) fail(`organisation ${o.id} exists`); T.organisations.push(o); }

  // ── rounds: contiguous bi-monthly slots
  T.grant_rounds = ROUNDS.map((r, i) => {
    const slot = nextRoundSlot(i === 0 ? null : ROUNDS[i - 1].closes_on, i === 0 ? r.opens_on : ROUNDS[i - 1].closes_on);
    if (i > 0 && (slot.opens_on !== r.opens_on || slot.closes_on !== r.closes_on)) fail(`round ${r.id} is not the next bi-monthly slot (${slot.opens_on}..${slot.closes_on})`);
    if (i === 0 && slot.closes_on !== r.closes_on) fail(`round ${r.id} deadline`);
    if (slot.id !== r.id) fail(`round id ${r.id} != ${slot.id}`);
    return { id: r.id, opens_on: r.opens_on, closes_on: r.closes_on, decide_by: add(r.closes_on, 14), budget: r.budget, max_award: r.max_award, currency: 'AED', note: r.note, simulated: true, created_by: r.by, created_at: r.at, sample: true };
  });
  const roundOf = Object.fromEntries(T.grant_rounds.map((r) => [r.id, r]));
  if (roundPhase(roundOf['gr-2026-10'], SEED_DAY) !== 'closed' || roundPhase(roundOf['gr-2026-12'], SEED_DAY) !== 'open') fail('round phases on the seed day');

  // ── applications
  T.grant_applications = [];
  for (const [id, rid, pid, act, start, days, costs, status, award, decidedOn, note, out, extra] of APPS) {
    const r = roundOf[rid];
    const [kind, title, destination, skill_id, output_kind, purpose] = ACT[act];
    const p = people[pid];
    const placement = scholars.has(pid);
    const created = [add(r.opens_on, Math.min(20, Number(id.slice(-2)) * 2)), r.closes_on, SEED_DAY].sort()[0];
    const el = eligibility(p, created, placement);
    if (!el.eligible) fail(`${id}: ${pid} not eligible`);
    if (placement && !extra?.consent_ref) fail(`${id}: placement without consent`);
    const lines = costs.map((a, i) => ({ item: ['transport', 'subsistence', 'registration'][i], amount: a })).filter((l) => l.amount > 0);
    const input = { kind, title, purpose, destination, starts_on: start, ends_on: add(start, days), costs: lines, skill_id, output_kind };
    const prob = applicationProblem(input, { closes_on: r.closes_on, max_award: r.max_award, skills });
    if (prob) fail(`${id}: application problem ${prob}`);
    const amount = costTotal(lines);
    const row = {
      id, round_id: rid, person_id: pid, initials: p.initials ?? '', job_role_id: p.job_role_id ?? null, years: el.years, basis: el.basis, ...input, amount, status, awarded: status === 'approved' ? award : null,
      decided_by: decidedOn ? 'p-chco' : null, decided_at: decidedOn ? `${decidedOn}T10:00:00Z` : null, decision_note: note,
      output_status: 'none', output: {}, output_reviewed_by: null, output_reviewed_at: null, output_note: null, evidence: [], profile_evidence: false,
      on_behalf: placement, consent_ref: placement ? extra.consent_ref : null, created_by: placement ? 'p-k-hr-analyst' : pid, created_at: `${created}T08:00:00Z`, updated_at: `${decidedOn ?? created}T10:00:00Z`, sample: true,
    };
    if (status === 'approved' || status === 'declined') {
      const committed = T.grant_applications.filter((x) => x.round_id === rid && x.status === 'approved').reduce((m, x) => m + x.awarded, 0);
      const dp = decisionProblem({ application_id: id, decision: status === 'approved' ? 'approve' : 'decline', award, note }, row, r, committed, decidedOn);
      if (dp) fail(`${id}: decision problem ${dp}`);
      if (pid === 'p-chco') fail(`${id}: the decider applied`);
    }
    if (out) {
      const [state, at, retNote, reviewedAt] = out;
      const day = at.slice(0, 10);
      const o = { kind: output_kind, title: `${title}: ${output_kind === 'presentation' ? 'briefing' : 'what I learned'}`, summary: `${purpose} Summary of the main points, what I will apply in my role, and one change I will propose to my section.`, submitted_by: row.created_by, submitted_at: at };
      if (outputProblem(o, row, day)) fail(`${id}: output problem ${outputProblem(o, row, day)}`);
      row.output = o;
      row.output_status = state === 'sub' ? 'submitted' : state === 'ret' ? 'returned' : 'accepted';
      if (state !== 'sub') { row.output_reviewed_by = placement ? 'p-chco' : 'p-k-hr-analyst'; row.output_reviewed_at = reviewedAt; row.output_note = retNote; }
      if (row.output_reviewed_by && (row.output_reviewed_by === o.submitted_by || row.output_reviewed_by === pid)) fail(`${id}: output reviewed by its submitter`);
      if (state === 'acc') {
        if (p.kind === 'staff') fail(`${id}: a seeded accepted output may not belong to staff (no seeded F01 evidence)`);
        row.evidence = [{ skill_id, level: output_kind === 'presentation' ? 2 : 1 }];
      }
      row.updated_at = reviewedAt ?? at;
    }
    T.grant_applications.push(row);
  }
  const ids = new Set();
  for (const a of T.grant_applications) {
    if (ids.has(a.id)) fail(`duplicate ${a.id}`);
    ids.add(a.id);
    if (T.grant_applications.some((x) => x !== a && x.round_id === a.round_id && x.person_id === a.person_id && x.status !== 'withdrawn' && a.status !== 'withdrawn')) fail(`two live applications for ${a.person_id} in ${a.round_id}`);
  }
  for (const r of T.grant_rounds) if (T.grant_applications.filter((a) => a.round_id === r.id && a.status === 'approved').reduce((m, a) => m + a.awarded, 0) > r.budget) fail(`${r.id} over budget`);

  // ── consortium
  T.consortium_cohorts = COHORTS;
  for (const c of COHORTS) {
    if (!T.academies.some((a) => a.id === c.academy_id)) fail(`academy ${c.academy_id}`);
    for (const m of c.modules) if (m.course_id && !T.courses.some((x) => x.id === m.course_id)) fail(`course ${m.course_id}`);
    for (const s of c.skills) if (!skills[s]) fail(`skill ${s}`);
    for (const p of c.partners) if (!T.organisations.some((o) => o.id === p.org_id) || !skills[p.visit_skill]) fail(`partner ${p.org_id}`);
  }
  const c26 = COHORTS[0], c27 = COHORTS[1];
  T.consortium_members = [];
  const counter = {};
  const mkCode = (c, org) => { const k = `${c.id}:${org}`; counter[k] = (counter[k] ?? 0) + 1; return traineeCode(c, org, counter[k]); };
  for (const [i, [org, person, discipline, mentor, team, status, note]] of MEMBERS_26.entries()) {
    const code = mkCode(c26, org);
    const st = status ?? 'accepted';
    const nomAt = `2026-06-${String(10 + (i % 15)).padStart(2, '0')}T09:00:00Z`;
    if (person && !enecTraineeEligible(people[person], nomAt.slice(0, 10))) fail(`${person} not an eligible ENEC trainee`);
    const m = { id: `cm-cc-2026-${code.toLowerCase()}`, cohort_id: 'cc-2026', org_id: person ? people[person].org_id : org, person_id: person, initials: person ? people[person].initials : null, trainee_code: code, discipline, status: st,
      nominated_by: NOMINATOR[org], nominated_at: nomAt, decided_by: 'p-chco', decided_at: '2026-07-20T10:00:00Z', decision_note: note ?? null, mentor_id: mentor ?? null, team: team ?? null, open_read: false, sample: true };
    const dp = memberDecisionProblem({ member_id: m.id, decision: st === 'accepted' ? 'accept' : 'decline', mentor_id: mentor, team, note }, m, c26);
    if (dp) fail(`${m.id}: decision problem ${dp}`);
    T.consortium_members.push(m);
  }
  for (const [org, person, discipline, by, at, status, mentor, team, decidedAt] of MEMBERS_27) {
    const code = mkCode(c27, org);
    if (person && !enecTraineeEligible(people[person], at.slice(0, 10))) fail(`${person} not an eligible ENEC trainee`);
    const m = { id: `cm-cc-2027-${code.toLowerCase()}`, cohort_id: 'cc-2027', org_id: person ? people[person].org_id : org, person_id: person, initials: person ? people[person].initials : null, trainee_code: code, discipline, status,
      nominated_by: by, nominated_at: at, decided_by: decidedAt ? 'p-chco' : null, decided_at: decidedAt ?? null, decision_note: null, mentor_id: mentor ?? null, team: team ?? null, open_read: false, sample: true };
    if (status === 'accepted' && memberDecisionProblem({ member_id: m.id, decision: 'accept', mentor_id: mentor, team }, m, c27)) fail(`${m.id}: decision`);
    T.consortium_members.push(m);
  }
  for (const c of COHORTS) for (const p of c.partners) {
    const active = T.consortium_members.filter((m) => m.cohort_id === c.id && consortiumOrg(c, m.org_id) === p.org_id && ['nominated', 'accepted'].includes(m.status)).length;
    if (active > p.seats) fail(`${c.id} ${p.org_id} seats ${active}/${p.seats}`);
  }
  if (DISC.length !== 7) fail('disciplines');

  // ── visits (cc-2026)
  const byCode = Object.fromEntries(T.consortium_members.filter((m) => m.cohort_id === 'cc-2026').map((m) => [m.trainee_code, m]));
  const V = [];
  const visit = (code, host, on, hours, module_id, via, by, status, dec) => V.push({ code, host, on, hours, module_id, via, by, status, dec });
  const partnerCodes = Object.keys(byCode).filter((k) => !k.startsWith('EN') && byCode[k].status === 'accepted');
  for (const k of partnerCodes) visit(k, 'enec-ops', '2026-09-14', 18, 'm1', 'programme', 'p-k-hr-analyst', 'confirmed', { by: 'p-chco', at: '2026-09-18T10:00:00Z', via: 'enec_host' });
  for (const k of partnerCodes.filter((x) => !x.startsWith('SG'))) visit(k, 'org-cx-grid', '2026-10-05', 18, 'm2', 'programme', 'p-k-hr-analyst', 'confirmed', { by: 'p-chco', at: '2026-10-09T10:00:00Z', via: 'on_behalf', ref: 'SGS-HOST-CONF-2026-10-07' });
  for (const k of Object.keys(byCode).filter((x) => x.startsWith('EN'))) visit(k, 'org-cx-grid', '2026-10-05', 18, 'm2', 'self', byCode[k].person_id, 'logged');
  visit('EN-26-02', 'org-alnoor', '2026-09-29', 6, null, 'programme', 'p-k-hr-analyst', 'logged');
  visit('EN-26-06', 'org-gulfhydro', '2026-10-01', 8, null, 'programme', 'p-k-hr-analyst', 'logged');
  visit('AN-26-01', 'org-gulfhydro', '2026-09-24', 6, null, 'employer', 'p-alnoor-gm', 'confirmed', { by: 'p-gulfhydro-qa', at: '2026-09-25T09:00:00Z', via: 'host' });
  visit('GH-26-02', 'org-alnoor', '2026-09-30', 6, null, 'employer', 'p-gulfhydro-qa', 'logged');
  visit('GH-26-01', 'org-alnoor', '2026-09-10', 6, null, 'employer', 'p-gulfhydro-qa', 'declined', { by: 'p-alnoor-gm', at: '2026-09-11T09:00:00Z', via: 'host', reason: 'Our site log shows no visit on that date; please check the date and log it again.' });
  visit('QS-26-02', 'enec-ops', '2026-09-21', 6, null, 'programme', 'p-k-hr-analyst', 'confirmed', { by: 'p-chco', at: '2026-09-22T09:00:00Z', via: 'enec_host' });
  visit('RH-26-01', 'org-cx-solar', '2026-10-02', 6, null, 'programme', 'p-k-hr-analyst', 'withdrawn');
  T.consortium_visits = [];
  V.forEach((x, i) => {
    const m = byCode[x.code];
    if (!m) fail(`visit for ${x.code}`);
    const day = x.dec ? x.dec.at.slice(0, 10) : x.on <= SEED_DAY ? add(x.on, x.module_id ? 3 : 1) : SEED_DAY;
    const vp = visitProblem({ member_id: m.id, host_org_id: x.host, visit_on: x.on, hours: x.hours, module_id: x.module_id }, c26, m, add(x.on, x.module_id ? 3 : 1));
    if (vp) fail(`visit ${x.code}@${x.host}: ${vp}`);
    if (x.dec?.by && (x.dec.by === x.by || x.dec.by === m.person_id)) fail(`visit ${x.code}: maker-checker`);
    const id = `cv-cc-2026-${String(i + 1).padStart(3, '0')}`;
    const row = {
      id, cohort_id: 'cc-2026', member_id: m.id, org_id: m.org_id, person_id: m.person_id, trainee_code: m.trainee_code, host_org_id: x.host, module_id: x.module_id, visit_on: x.on, hours: x.hours,
      note: '', skill_id: partnerOf(c26, x.host).visit_skill, status: x.status, logged_by: x.by, logged_via: x.via, confirmed_via: x.dec?.via ?? null, host_ref: x.dec?.ref ?? null,
      decided_by: x.dec?.by ?? null, decided_at: x.dec?.at ?? null, decline_reason: x.dec?.reason ?? null, level: 0, evidence: [], profile_evidence: false,
      created_at: `${add(x.on, x.module_id ? 3 : 1)}T08:00:00Z`, open_read: false, sample: true,
    };
    if (x.status === 'confirmed') {
      if (m.person_id) fail(`visit ${id}: a seeded confirmed visit may not belong to an ENEC trainee (no seeded F01 evidence)`);
      const before = T.consortium_visits.filter((y) => y.member_id === m.id && y.status === 'confirmed').map((y) => ({ host_org_id: y.host_org_id, hours: y.hours }));
      row.level = visitLevel(before, { host_org_id: x.host, hours: x.hours });
      row.evidence = [{ skill_id: row.skill_id, level: row.level }];
    }
    if (day > SEED_DAY) fail(`visit ${id} dated after the seed day`);
    T.consortium_visits.push(row);
  });
  const conf = T.consortium_visits.filter((v) => v.status === 'confirmed').length;
  console.log(`fs82/83: ${T.grant_rounds.length} grant rounds, ${T.grant_applications.length} applications (${T.grant_applications.filter((a) => a.status === 'approved').length} approved); `
    + `${COHORTS.length} consortium cohorts, ${T.consortium_members.length} members, ${T.consortium_visits.length} visits (${conf} confirmed, no F01 evidence); ${NEW_ORGS.length} synthetic partners added`);
}
