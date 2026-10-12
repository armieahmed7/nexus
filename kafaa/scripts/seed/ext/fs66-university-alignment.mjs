// FS66 University programme alignment + FS67 Fellowships and sponsored placements (future-skills wave G · E4, M10) seed.
// finalize() (FINALIZE_LAST; by file name after every f* and fs01-fs65 builder, before the fsqa builders):
//   - programme_alignments: nine SAMPLE university programmes (illustrative mappings, not actual ENEC endorsements of real degrees) in
//     every state: endorsed (one lapsed), submitted for review (Khalifa University's BSc, the main endorsement demo; one submitted on
//     behalf of KINGS by the partnerships admin), returned and draft. Endorsed rows carry the coverage snapshot the FS57 rule gives on the
//     final role profiles (fsqa1 re-points 2030 requirements to FS02 skills after this file runs, so the snapshot reads them through the
//     same idempotent remapRequirements, read-only) and pass the three computed criteria (the builder fails otherwise).
//   - programme_graduates: six graduate hires recorded by the HR director (role card). None carries evidence in the seed: four wait for the
//     endorsement of a submitted programme (k-graduate among them) and two graduated outside their programme's endorsement window. So the
//     F01 states (and the pinned F01 digest of the 71 established skills) are unchanged; the evidence appears when a framework owner
//     endorses the submitted programme (both backends write it at that moment).
//   - fellowships + fellowship_milestones: 42 fellowships (22 NEST-style, 20 sponsored study with placement) hosted by published research
//     challenges or ADVANCE technology studies (planning assumption, no deployment decision implied), each with a supervisor role card and
//     five milestones from the kind's template. Outcomes are honest, not tuned: completions, withdrawals, overdue milestones, and live work
//     with milestones waiting for sign-off. Demo: p-training-mgr signs off ap-122's graduation (completing it), k-university submits
//     ap-125's year results, k-graduate submits the overdue research plan of the Arabic-first content fellowship.
// Synthetic people only (role cards and the synthetic applicant pool); no evidence or person rows are added.
import { programmeCoverage, autoCriteria, addYears } from '../../../src/modules/m10/alignment.ts';
import { milestonePlan, fellowshipId, isComplete } from '../../../src/modules/m10/fellowship.ts';
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { remapRequirements } from './fsqa1-integration.mjs';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-11';
const HR = 'p-chco';
const UNI = 'p-k-university';
const PARTNERS = 'p-ai-governance';
const ADMIN = 'p-k-admin';

const sk = (skill_id, level, ...modules) => ({ skill_id, level, modules });
/** [id, org, code, title_en, title_ar, degree, nqf, field_en, field_ar, roles, skills, placement, status, submitted_by, submitted_on, decided_by, decided_on, note, covers_from] */
export const PROGRAMMES = [
  ['ua-ku-bsc-nuc', 'ku', 'BSC-NE', 'BSc in Nuclear Engineering (sample programme)', 'بكالوريوس الهندسة النووية (برنامج نموذجي)', 'bachelor', 7, 'Nuclear engineering', 'الهندسة النووية',
    ['reactor-engineer-core-physicist', 'systems-design-plant-engineer', 'shift-technical-advisor'],
    [sk('sk-pf-01', 2, 'Nuclear physics I', 'Nuclear physics II'), sk('sk-pf-01-core', 2, 'Reactor theory and kinetics'), sk('sk-pf-02', 2, 'Thermodynamics', 'Heat transfer', 'Fluid mechanics'),
      sk('sk-pf-03', 1, 'Nuclear power plant systems'), sk('sk-ns-01', 2, 'Nuclear reactor safety'), sk('sk-ns-01-psa', 1, 'Reliability and risk analysis'), sk('sk-rp-01', 2, 'Radiation protection and shielding'),
      sk('sk-en-01', 1, 'Engineering design project'), sk('sk-en-02', 1, 'Plant performance laboratory'), sk('sk-da-01', 2, 'Computational methods for engineers'), sk('sk-da-01-analysis', 2, 'Engineering data analysis'),
      sk('sk-da-01-scripting', 2, 'Programming for engineers'), sk('sk-fs-ai-verify', 1, 'AI tools in engineering practice'), sk('sk-fs-tr-analytical', 2, 'Senior capstone project'), sk('sk-fs-adv-smr', 1, 'Advanced reactor concepts (elective)')],
    true, 'submitted', UNI, '2026-09-28', null, null, null, null],
  ['ua-ku-msc-data', 'ku', 'MSC-DSE', 'MSc in Data Science for Energy Systems (sample programme)', 'ماجستير علم البيانات لأنظمة الطاقة (برنامج نموذجي)', 'master', 9, 'Data science', 'علم البيانات',
    ['systems-design-plant-engineer', 'reactor-engineer-core-physicist'],
    [sk('sk-da-01', 2, 'Foundations of data science'), sk('sk-da-01-analysis', 2, 'Statistical learning', 'Visual analytics'), sk('sk-da-01-scripting', 2, 'Scientific programming'), sk('sk-da-01-twins', 2, 'Digital twins of energy systems'),
      sk('sk-da-02', 2, 'Responsible AI'), sk('sk-da-02-review', 1, 'Model validation seminar'), sk('sk-en-02', 1, 'Condition monitoring'), sk('sk-en-02-perf', 2, 'Performance analytics for plants'),
      sk('sk-fs-ai-dataeng', 2, 'Data engineering'), sk('sk-fs-ai-plantdata', 2, 'Sensor data quality'), sk('sk-fs-ai-verify', 2, 'Verifying machine-learning outputs'), sk('sk-fs-ai-twin', 1, 'Twin validation project'), sk('sk-fs-tr-analytical', 2, 'Research thesis')],
    true, 'endorsed', UNI, '2025-03-10', PARTNERS, '2025-04-20', 'Every mapped skill names its modules and is assessed; the thesis is done with an industry partner; accreditation reference on file. Endorsed for graduates from 2024.', '2024-01-01'],
  ['ua-ku-msc-nem', 'ku', 'MSC-NEM', 'MSc in Nuclear Engineering Management (sample programme)', 'ماجستير إدارة الهندسة النووية (برنامج نموذجي)', 'master', 9, 'Engineering management', 'إدارة الهندسة',
    ['nuclear-oversight-npi', 'regulatory-affairs-licensing-engineer'],
    [sk('sk-ns-02', 2, 'Licensing basis and regulation'), sk('sk-ns-02-licensing', 1, 'Regulatory submissions workshop'), sk('sk-sc-01', 2, 'Nuclear safety culture'), sk('sk-ld-02', 1, 'Decision-making under uncertainty'),
      sk('sk-en-01-project', 2, 'Project controls'), sk('sk-fs-tr-leadership', 2, 'Leading technical organisations')],
    false, 'draft', null, null, null, null, null, null],
  ['ua-adpoly-dip-ic', 'adpoly', 'DIP-IC', 'Diploma in Instrumentation and Control Technology (sample programme)', 'دبلوم تقنية الأجهزة والتحكم (برنامج نموذجي)', 'diploma', 5, 'Instrumentation and control', 'الأجهزة والتحكم',
    ['maintenance-technician-engineer'],
    [sk('sk-mp-02', 2, 'Calibration practice', 'Test equipment'), sk('sk-mp-02-dic', 2, 'Digital control systems'), sk('sk-mp-01', 1, 'Maintenance work practice'), sk('sk-mp-01-elec', 2, 'Electrical machines and protection'),
      sk('sk-hu-01', 1, 'Human performance in the workshop'), sk('sk-qa-01', 1, 'Quality in maintenance'), sk('sk-rp-01', 1, 'Radiation safety basics'), sk('sk-en-02-perf', 1, 'Trend monitoring'),
      sk('sk-fs-dp-dic', 2, 'Digital I&C platforms'), sk('sk-fs-dp-robotics', 1, 'Remote inspection lab')],
    true, 'endorsed', PARTNERS, '2024-04-02', ADMIN, '2024-05-12', 'Strong hands-on calibration and digital I&C content with a 12-week plant placement; assessment by practical test.', '2023-01-01'],
  ['ua-adpoly-bsc-est', 'adpoly', 'BSC-EST', 'BSc in Energy Systems Technology (sample programme)', 'بكالوريوس تقنية أنظمة الطاقة (برنامج نموذجي)', 'bachelor', 7, 'Energy systems', 'أنظمة الطاقة',
    ['local-operator'],
    [sk('sk-pf-02', 1, 'Applied thermodynamics'), sk('sk-fs-gr-grid', 2, 'Power systems and grids'), sk('sk-fs-gr-ghg', 1, 'Energy and emissions'), sk('sk-da-01', 1, 'Energy data')],
    true, 'returned', PARTNERS, '2026-07-14', ADMIN, '2026-08-03', 'Coverage of the local operator profile is below the threshold: map the plant systems and procedure modules before resubmitting.', null],
  ['ua-iat-cert-dpo', 'iat', 'CERT-DPO', 'Certificate in Digital Plant Operations (sample programme)', 'شهادة عمليات المحطة الرقمية (برنامج نموذجي)', 'certificate', 4, 'Plant operations', 'عمليات المحطات',
    ['operations-support-work-control', 'local-operator'],
    [sk('sk-co-01', 1, 'Procedure use'), sk('sk-co-01-rounds', 2, 'Field rounds practice'), sk('sk-hu-01', 1, 'Human performance tools'), sk('sk-hu-02', 1, 'Pre-job briefs'), sk('sk-mp-01', 1, 'Work packages'),
      sk('sk-da-01', 2, 'Plant data literacy'), sk('sk-fs-dp-rounds', 2, 'Digital operator rounds'), sk('sk-fs-dp-ework', 2, 'Electronic work packages')],
    true, 'endorsed', PARTNERS, '2025-10-06', ADMIN, '2025-11-03', 'Clear outcomes for digital rounds and electronic work packages; the plant placement is assessed by a mentor checklist.', '2024-01-01'],
  ['ua-kings-msc-npp', 'kings', 'MSC-NPPE', 'MSc in Nuclear Power Plant Engineering (sample programme)', 'ماجستير هندسة محطات الطاقة النووية (برنامج نموذجي)', 'master', 9, 'Nuclear power plant engineering', 'هندسة محطات الطاقة النووية',
    ['shift-technical-advisor', 'systems-design-plant-engineer'],
    [sk('sk-pf-01', 2, 'Reactor physics'), sk('sk-pf-02', 2, 'Thermal hydraulics'), sk('sk-pf-03', 2, 'APR-1400 systems'), sk('sk-pf-03-rcs', 2, 'Reactor coolant system design'), sk('sk-ns-01', 2, 'Safety analysis'),
      sk('sk-en-01', 2, 'Design control'), sk('sk-en-02', 2, 'System health'), sk('sk-da-01-analysis', 1, 'Plant data analysis')],
    true, 'submitted', PARTNERS, '2026-10-02', null, null, null, null],
  ['ua-kaist-msc-ai', 'kaist', 'MSC-AIPO', 'MSc in AI for Plant Operations (sample programme)', 'ماجستير الذكاء الاصطناعي لعمليات المحطات (برنامج نموذجي)', 'master', 9, 'Artificial intelligence', 'الذكاء الاصطناعي',
    ['systems-design-plant-engineer'],
    [sk('sk-da-01', 2, 'Machine learning'), sk('sk-da-01-analysis', 2, 'Time-series analytics'), sk('sk-da-01-scripting', 2, 'Programming for AI'), sk('sk-da-02', 2, 'AI governance'), sk('sk-en-02', 2, 'Predictive maintenance'),
      sk('sk-ns-01', 1, 'Safety of AI in plants'), sk('sk-fs-ai-verify', 2, 'Verification of AI outputs'), sk('sk-fs-ai-anomaly', 2, 'Anomaly detection')],
    true, 'endorsed', PARTNERS, '2023-01-16', ADMIN, '2023-02-20', 'Endorsed for three years; the programme must renew before February 2026.', '2022-01-01'],
  ['ua-psu-bsc-nuc', 'penn-state', 'BSC-NUCE', 'BSc in Nuclear Engineering (sample programme)', 'بكالوريوس الهندسة النووية (برنامج نموذجي)', 'bachelor', 7, 'Nuclear engineering', 'الهندسة النووية',
    ['reactor-engineer-core-physicist', 'nuclear-fuel-specialist'],
    [sk('sk-pf-01', 2, 'Nuclear physics'), sk('sk-pf-01-core', 2, 'Reactor core design'), sk('sk-pf-01-advfuel', 1, 'Nuclear materials'), sk('sk-pf-02', 2, 'Thermal sciences'), sk('sk-ns-02', 1, 'Nuclear regulation'),
      sk('sk-qa-01', 1, 'Engineering quality'), sk('sk-da-01-analysis', 2, 'Numerical methods'), sk('sk-da-01-scripting', 2, 'Computational reactor physics'), sk('sk-fs-ai-verify', 1, 'AI in engineering seminar')],
    true, 'endorsed', PARTNERS, '2025-08-11', ADMIN, '2025-09-15', 'Reactor physics and computation are strong; the summer placement at the plant is mandatory for sponsored students.', '2024-01-01'],
];

/** [person, programme, graduated_on, hired_on] (recorded by the HR director; no evidence in the seed, see the header) */
export const GRADUATES = [
  ['p-k-graduate', 'ua-ku-bsc-nuc', '2026-06-30', '2026-09-01'],
  ['ap-011', 'ua-ku-bsc-nuc', '2026-06-30', '2026-09-15'],
  ['ap-027', 'ua-ku-bsc-nuc', '2025-06-30', '2026-08-01'],
  ['ap-045', 'ua-kings-msc-npp', '2026-02-28', '2026-09-01'],
  ['ap-061', 'ua-adpoly-dip-ic', '2022-06-30', '2026-08-15'],
  ['ap-078', 'ua-kaist-msc-ai', '2026-06-20', '2026-09-20'],
];

/** NEST-style fellowships: [fellow, university|null, host, supervisor, starts_on, span days, outcome] */
const NEST = [
  ['w-lo-02', null, 'rc-1', 'p-training-mgr', '2022-09-01', 365, 'complete'],
  ['ap-101', 'ku', 'tech-htgr', 'p-nse', '2022-10-01', 540, 'complete'],
  ['w-eng-05', null, 'tech-bwr', 'p-fuel-pm', '2022-11-01', 365, 'complete'],
  ['ap-102', 'kaist', 'tech-micro', 'p-sme-reviewer', '2023-01-15', 365, 'complete'],
  ['w-chem-02', null, 'rc-3', 'p-head-sustainability', '2023-02-01', 365, 'complete'],
  ['w-rp-03', null, 'rc-2', 'p-rp-lead', '2023-03-01', 365, 'withdrawn@2'],
  ['ap-103', 'ku', 'rc-1', 'p-k-instructor', '2023-04-01', 540, 'complete'],
  ['w-mnt-07', null, 'tech-msr', 'p-nse', '2023-05-01', 365, 'complete'],
  ['w-lo-03', null, 'rc-1', 'p-training-mgr', '2023-09-01', 365, 'complete'],
  ['ap-104', 'ku', 'tech-fast', 'p-fuel-pm', '2023-10-01', 540, 'overdue@4'],
  ['w-eng-04', null, 'tech-htgr', 'p-sme-reviewer', '2024-01-15', 365, 'complete'],
  ['w-chem-03', null, 'rc-3', 'p-sustainability-lead', '2024-03-01', 365, 'complete'],
  ['ap-105', 'kaist', 'tech-bwr', 'p-nse', '2024-05-01', 365, 'complete'],
  ['w-mnt-08', null, 'rc-2', 'p-rp-lead', '2024-09-01', 365, 'complete'],
  ['w-lo-06', null, 'rc-1', 'p-k-instructor', '2024-10-01', 540, 'withdrawn@1'],
  ['ap-106', 'ku', 'tech-micro', 'p-sme-reviewer', '2025-01-15', 365, 'complete'],
  ['w-eng-03', null, 'tech-msr', 'p-fuel-pm', '2025-03-01', 540, 'overdue@3'],
  ['w-lo-07', null, 'rc-3', 'p-head-sustainability', '2025-09-01', 540, 'active'],
  ['ap-107', 'ku', 'tech-htgr', 'p-nse', '2025-10-01', 540, 'active_submitted'],
  ['w-rp-02', null, 'rc-2', 'p-rp-lead', '2026-02-01', 365, 'active'],
  ['p-k-graduate', null, 'rc-1', 'p-training-mgr', '2026-07-01', 365, 'active_planned_due'],
  ['w-lo-10', null, 'tech-bwr', 'p-fuel-pm', '2026-09-01', 365, 'active'],
];
/** Sponsored study with placement (two years): [fellow, university, host, supervisor, starts_on, outcome] */
const SPONSORED = [
  ['ap-111', 'ku', 'rc-1', 'p-training-mgr', '2022-09-01', 'complete'],
  ['ap-112', 'ku', 'rc-3', 'p-head-sustainability', '2022-09-01', 'complete'],
  ['ap-113', 'kings', 'tech-bwr', 'p-nse', '2022-09-15', 'complete'],
  ['ap-114', 'penn-state', 'tech-htgr', 'p-fuel-pm', '2022-09-15', 'withdrawn@2'],
  ['ap-115', 'kaist', 'tech-micro', 'p-sme-reviewer', '2023-02-01', 'complete'],
  ['ap-116', 'ku', 'rc-2', 'p-rp-lead', '2023-09-01', 'complete'],
  ['ap-117', 'ku', 'rc-1', 'p-k-instructor', '2023-09-01', 'complete'],
  ['ap-118', 'kings', 'tech-msr', 'p-nse', '2023-09-15', 'complete'],
  ['ap-119', 'texas-am', 'tech-fast', 'p-fuel-pm', '2023-09-15', 'overdue@4'],
  ['ap-120', 'penn-state', 'rc-3', 'p-sustainability-lead', '2024-01-15', 'complete'],
  ['ap-121', 'ku', 'tech-htgr', 'p-nse', '2024-09-01', 'complete'],
  ['ap-122', 'kaist', 'rc-1', 'p-training-mgr', '2024-09-01', 'active_submitted'],
  ['ap-123', 'ku', 'rc-2', 'p-rp-lead', '2024-09-15', 'complete'],
  ['ap-124', 'kings', 'tech-micro', 'p-sme-reviewer', '2025-01-15', 'active'],
  ['ap-125', 'ku', 'rc-1', 'p-training-mgr', '2025-09-01', 'active_univ_due'],
  ['ap-126', 'texas-am', 'tech-bwr', 'p-fuel-pm', '2025-09-15', 'active'],
  ['ap-127', 'penn-state', 'rc-3', 'p-head-sustainability', '2025-09-15', 'active'],
  ['ap-128', 'ku', 'tech-msr', 'p-nse', '2026-01-15', 'active'],
  ['ap-129', 'kaist', 'rc-2', 'p-rp-lead', '2026-09-01', 'active'],
  ['ap-130', 'ku', 'rc-1', 'p-k-instructor', '2026-09-01', 'active'],
];

const dayNo = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const addDays = (iso, n) => new Date((dayNo(iso) + n) * 86400000).toISOString().slice(0, 10);
const minD = (a, b) => (a < b ? a : b);
const ts = (d, hh = '09') => `${d}T${hh}:00:00Z`;

function fellowshipTitles(kind, host, T) {
  const rc = T.research_challenges.find((r) => r.id === host);
  const tech = T.adv_technologies.find((t) => t.id === host);
  const name = rc ? { en: rc.title_en, ar: rc.title_ar } : { en: `${tech.family_en} study`, ar: `دراسة ${tech.family_ar}` };
  if (kind === 'nest_fellowship') return { title_en: `NEST-style fellowship: ${name.en}`, title_ar: `زمالة على نمط NEST: ${name.ar}` };
  return { title_en: `Sponsored master's study with ENEC placement: ${name.en}`, title_ar: `دراسة ماجستير مموّلة مع تدريب ميداني في المؤسسة: ${name.ar}` };
}
function placementText(kind, host) {
  const adv = host.startsWith('tech-');
  if (kind === 'nest_fellowship') return adv
    ? { en: 'Research inside the ADVANCE technology study team (planning assumption, no deployment decision implied).', ar: 'بحث ضمن فريق دراسة تقنية ADVANCE (افتراض تخطيطي، ولا يعني أي قرار نشر).' }
    : { en: 'Research inside the screened research challenge team, with a shared deliverable.', ar: 'بحث ضمن فريق تحدي البحث الذي اجتاز الفحص، مع مُخرج مشترك.' };
  return adv
    ? { en: 'Six-month placement with the ADVANCE study team in the second year (planning assumption, no deployment decision implied).', ar: 'تدريب ميداني لستة أشهر مع فريق دراسة ADVANCE في السنة الثانية (افتراض تخطيطي، ولا يعني أي قرار نشر).' }
    : { en: 'Six-month placement with the research challenge team in the second year.', ar: 'تدريب ميداني لستة أشهر مع فريق تحدي البحث في السنة الثانية.' };
}

function buildFellowship(T, kind, [fellow, uni, host, sup, starts, span, outcome]) {
  const people = new Map(T.people.map((p) => [p.id, p]));
  const P = people.get(fellow), S = people.get(sup);
  if (!P || !S) throw new Error(`fs66 seed: unknown person ${fellow} or ${sup}`);
  const ends = addDays(starts, span);
  const id = fellowshipId(starts, fellow);
  const plan = milestonePlan(id, kind, starts, ends);
  const [mode, kArg] = outcome.split('@');
  const k = kArg ? Number(kArg) : null;
  const ms = plan.map((m) => ({
    ...m, fellowship_id: id, fellow_person_id: fellow, university_org_id: uni, supervisor_person_id: sup, status: 'planned', submitted_by: null, submitted_at: null, note: '',
    signed_by: null, signed_at: null, return_note: null, updated_at: ts(AS_OF),
  }));
  const submitter = (m) => (m.owner === 'university' && uni === 'ku' ? UNI : fellow);
  const submit = (m) => { m.status = 'submitted'; m.submitted_by = submitter(m); m.submitted_at = ts(minD(addDays(m.due_on, -2), AS_OF)); m.updated_at = m.submitted_at; };
  const sign = (m) => { submit(m); m.status = 'signed_off'; m.signed_by = sup; m.signed_at = ts(minD(addDays(m.due_on, 5), AS_OF), '11'); m.updated_at = m.signed_at; };
  let status = 'active', completed_on = null, withdrawn_on = null, withdraw_reason = null;
  if (mode === 'complete') { ms.forEach(sign); status = 'completed'; completed_on = ms.map((m) => m.signed_at.slice(0, 10)).sort().at(-1); }
  else if (mode === 'withdrawn') {
    ms.slice(0, k).forEach(sign);
    status = 'withdrawn'; withdrawn_on = addDays(ms[k].due_on, -10);
    withdraw_reason = kind === 'nest_fellowship' ? 'The fellow moved to a full-time operations role before the midpoint.' : 'The student changed programme and left the sponsored study.';
  } else if (mode === 'overdue') ms.slice(0, k).forEach(sign);
  else {
    const past = ms.filter((m) => m.due_on <= AS_OF);
    past.forEach((m) => (m.due_on <= addDays(AS_OF, -10) ? sign(m) : submit(m)));
    const last = past.at(-1);
    if (mode === 'active_submitted' && last) { last.status = 'planned'; submit(last); last.signed_by = null; last.signed_at = null; }
    if (mode === 'active_planned_due' && last) Object.assign(last, { status: 'planned', submitted_by: null, submitted_at: null, signed_by: null, signed_at: null, updated_at: ts(AS_OF) });
    if (mode === 'active_univ_due') {
      const y = ms.find((m) => m.kind === 'year_results');
      Object.assign(y, { status: 'planned', submitted_by: null, submitted_at: null, signed_by: null, signed_at: null, updated_at: ts(AS_OF) });
    }
  }
  if (isComplete(ms) !== (status === 'completed')) throw new Error(`fs66 seed: ${id} completion does not follow its milestones`);
  const t = fellowshipTitles(kind, host, T), pl = placementText(kind, host);
  return {
    row: {
      id, kind, ...t, fellow_person_id: fellow, fellow_initials: P.initials ?? '', university_org_id: uni, host_kind: host.startsWith('tech-') ? 'advance_study' : 'research_challenge', host_ref: host,
      supervisor_person_id: sup, supervisor_name_en: S.display_name, supervisor_name_ar: S.display_name_ar || S.display_name, starts_on: starts, ends_on: ends,
      placement_en: pl.en, placement_ar: pl.ar, status, completed_on, withdrawn_on, withdraw_reason, sample: true, created_by: HR, created_at: ts(addDays(starts, -30)), updated_at: ts(AS_OF),
    },
    ms,
  };
}

export default function build() {}

export function finalize(T) {
  // final role profiles (fsqa1 re-points 2030/2035 requirements after this file; read through the same idempotent remap, T unchanged)
  const versions = (T.role_profile_versions ?? []).map((v) => (v.horizon !== 'now' && (v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? { ...v, requirements: remapRequirements(v.requirements) } : v));
  const w = { skills: T.skills, competencies: T.competencies, job_roles: T.job_roles, role_profile_versions: versions, skill_alignments: T.skill_alignments ?? [], organisations: T.organisations };

  T.programme_alignments = PROGRAMMES.map(([id, org, code, title_en, title_ar, degree, nqf, field_en, field_ar, roles, skills, placement, status, subBy, subOn, decBy, decOn, note, covers]) => {
    const p = { skills: [...skills].sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1)), target_role_ids: roles };
    const history = [{ at: ts(addDays(subOn ?? '2026-09-20', -20)), by: subBy ?? UNI, action: 'saved', version: 1 }];
    if (subOn) history.push({ at: ts(subOn), by: subBy, action: 'submitted', version: 1 });
    if (decOn) history.push({ at: ts(decOn, '13'), by: decBy, action: status === 'returned' ? 'returned' : 'endorsed', version: 1 });
    const endorsed = status === 'endorsed';
    if (endorsed) {
      const auto = autoCriteria(p, w);
      if (!auto.outcomes || !auto.coverage || !auto.crosswalk) throw new Error(`fs66 seed: endorsed ${id} fails a computed criterion ${JSON.stringify(auto)}`);
    }
    return {
      id, university_org_id: org, code, title_en, title_ar, degree, nqf_level: nqf, field_en, field_ar,
      summary_en: `Sample mapping of a ${degree} programme to ENEC skills for the demo; not an actual ENEC endorsement.`,
      summary_ar: 'مواءمة نموذجية لبرنامج جامعي مع مهارات المؤسسة لأغراض العرض؛ وليست اعتماداً فعلياً من المؤسسة.',
      target_role_ids: roles, skills: p.skills, placement, accreditation_ref: placement ? 'National programme accreditation reference on file (sample)' : '',
      status, version: 1, submitted_by: subBy, submitted_at: subOn ? ts(subOn) : null, decided_by: decBy, decided_at: decOn ? ts(decOn, '13') : null, decision_note: note,
      criteria: endorsed ? { outcomes: true, coverage: true, crosswalk: true, assessment: true, placement: true, accreditation: true } : {},
      covers_from: endorsed ? covers : null, valid_to: endorsed ? addYears(decOn, 3) : null, coverage_snapshot: endorsed ? programmeCoverage(p, w) : null,
      history, sample: true, created_by: subBy ?? UNI, updated_at: ts(decOn ?? subOn ?? '2026-09-01'),
    };
  });
  const progs = new Map(T.programme_alignments.map((p) => [p.id, p]));
  T.programme_graduates = GRADUATES.map(([person, pid, grad, hired]) => {
    const p = progs.get(pid);
    const cov = p.status === 'endorsed' && grad >= p.covers_from && grad <= p.valid_to;
    if (cov) throw new Error(`fs66 seed: graduate ${person} of ${pid} would need evidence (keep the seed evidence-free)`);
    return { id: `pg-${pid}-${person}`, person_id: person, programme_id: pid, university_org_id: p.university_org_id, graduated_on: grad, hired_on: hired,
      status: p.status === 'endorsed' ? 'not_covered' : 'awaiting_endorsement', evidence_ids: [], evidence_on: null, recorded_by: HR, recorded_at: ts(hired, '10'), updated_at: ts(hired, '10') };
  });

  const fws = [], mss = [];
  for (const r of NEST) { const x = buildFellowship(T, 'nest_fellowship', r); fws.push(x.row); mss.push(...x.ms); }
  for (const [f, u, h, s, st, o] of SPONSORED) { const x = buildFellowship(T, 'sponsored_study', [f, u, h, s, st, 730, o]); fws.push(x.row); mss.push(...x.ms); }
  T.fellowships = fws.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.fellowship_milestones = mss.sort((a, b) => (a.id < b.id ? -1 : 1));
}
