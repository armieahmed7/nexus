// F22 (wave 3 · w3e3) seed: the Handover 2030 board's SAMPLE plan. Two as-of periods (2026-Q2, 2026-Q3), each with
//   external_cover    positions held by KHNP OSSA experts (and a few contractor positions) per covered role and plan year
//                     2026-2030; about 400 positions in 2026, in line with the ~400 KHNP experts a year the OSSA provides
//                     until 2030 (WNN / ENEC, source ids enec-khnp-ossa and enec-global-oe). Counts only; no people.
//   handover_cohorts  trainees in COIT, LOIT, GPO, DNT and discipline cohorts earmarked to replace that cover, with a projected
//                     ready date from the programme length (SIMULATED). For every critical role, the earmarked trainees never
//                     exceed that role's critical_roles in_training + pipeline for the period (unit-tested).
// No security, safeguards or cyber role carries cover. Synthetic aggregates only; named successors are not seeded here
// (they come from F19 succession slates or, until a role has a slate, from F05 shortlists of the demo tenant).

const PERIODS = ['2026-Q2', '2026-Q3'];
const YEARS = [2026, 2027, 2028, 2029, 2030];
// Share of the 2026 cover still in place each plan year, by function (operations hands over fastest).
const PROFILE = {
  operations: [1, 0.75, 0.5, 0.25, 0.1],
  maintenance: [1, 0.9, 0.75, 0.5, 0.25],
  engineering: [1, 0.85, 0.7, 0.45, 0.2],
  outage: [1, 0.9, 0.7, 0.45, 0.2],
  default: [1, 0.8, 0.6, 0.35, 0.15],
};
const CONTRACTOR = [1, 1, 0.8, 0.6, 0.4];
// 2026 positions with KHNP OSSA cover (2026-Q3 plan) and contractor cover, per role.
const COVER = {
  'senior-reactor-operator': [46, 0],
  'shift-supervisor': [18, 0],
  'reactor-operator': [22, 0],
  'shift-technical-advisor': [14, 0],
  'operations-support-work-control': [12, 0],
  'maintenance-technician-engineer': [66, 12],
  'systems-design-plant-engineer': [44, 8],
  'reactor-engineer-core-physicist': [16, 0],
  'outage-manager-planner': [24, 6],
  'radiation-protection-technician': [20, 0],
  'chemistry-technician': [18, 0],
  'nuclear-fuel-specialist': [12, 0],
  'nuclear-training-instructor': [26, 0],
  'quality-assurance-qc': [14, 0],
  'regulatory-affairs-licensing-engineer': [6, 0],
  'emergency-preparedness-coordinator': [8, 0],
  'nuclear-oversight-npi': [8, 0],
  'human-performance-specialist': [4, 0],
};
// Cohorts earmarked for handover (2026-Q3). q2: false = planned after 2026-Q2.
const C = (role, route, prog, tp, en, ar, starts, ready, n, em, q2 = true) => ({ role, route, prog, tp, en, ar, starts, ready, n, em, q2 });
const COHORTS = [
  C('reactor-operator', 'coit', 'coit', null, 'COIT class 2024 (RO): licensed, awaiting placement', 'دفعة التدريب الأولي للمعتمدين 2024 (مشغّل مفاعل): مرخّصون بانتظار التعيين', '2024-03-01', '2026-06-30', 12, 10),
  C('senior-reactor-operator', 'coit', 'coit', null, 'SRO upgrade class 2024: licensed, awaiting placement', 'دفعة الترقية إلى مشغّل أول 2024: مرخّصون بانتظار التعيين', '2024-09-01', '2026-08-31', 6, 4, false),
  C('maintenance-technician-engineer', 'discipline', 'maint-init', null, 'Maintenance initial training 2025 intake: qualified', 'التدريب الأولي للصيانة: دفعة 2025 (مؤهلون)', '2025-06-01', '2026-08-31', 10, 8),
  C('reactor-operator', 'coit', 'coit', null, 'COIT class 2025 (RO): exams', 'دفعة التدريب الأولي للمعتمدين 2025 (مشغّل مفاعل): الاختبارات', '2025-03-01', '2027-03-31', 14, 11),
  C('reactor-operator', 'coit', 'coit', null, 'COIT class 2027 (RO)', 'دفعة التدريب الأولي للمعتمدين 2027 (مشغّل مفاعل)', '2027-01-10', '2028-09-30', 16, 13, false),
  C('reactor-operator', 'dnt', null, 'dnt', 'DNT 2026 cohort: Local Operator, then RO', 'دفعة دبلوم التكنولوجيا النووية 2026: مشغّل محلي ثم مشغّل مفاعل', '2026-07-01', '2031-06-30', 20, 20),
  C('senior-reactor-operator', 'coit', 'coit', null, 'SRO upgrade class 2026 (licensed ROs)', 'دفعة الترقية إلى مشغّل أول 2026 (مشغّلو مفاعل مرخّصون)', '2026-04-01', '2028-02-29', 18, 12),
  C('senior-reactor-operator', 'gpo', null, 'gpo', 'GPO 2025 cohort: Local Operator to SRO', 'دفعة مشغّل المحطة للخريجين 2025: من مشغّل محلي إلى مشغّل أول', '2025-09-01', '2029-09-30', 12, 12),
  C('shift-supervisor', 'discipline', 'intilaqa', null, 'Shift supervisor development 2026 (INTILAQA)', 'تطوير مشرفي الورديات 2026 (انطلاقة)', '2026-01-15', '2027-12-31', 8, 6),
  C('shift-supervisor', 'discipline', 'intilaqa', null, 'Shift supervisor development 2027 (INTILAQA)', 'تطوير مشرفي الورديات 2027 (انطلاقة)', '2027-01-15', '2029-03-31', 7, 6, false),
  C('shift-technical-advisor', 'discipline', 'eng-init', null, 'STA qualification for engineers', 'تأهيل المستشار الفني للوردية للمهندسين', '2026-09-01', '2028-06-30', 9, 7),
  C('operations-support-work-control', 'loit', 'loit', null, 'LOIT 2026 cohort: work control', 'دفعة التدريب الأولي للمشغّلين المحليين 2026: التحكم بالأعمال', '2026-02-01', '2027-06-30', 10, 8),
  C('maintenance-technician-engineer', 'discipline', 'maint-init', null, 'Maintenance initial training 2026 intake', 'التدريب الأولي للصيانة: دفعة 2026', '2026-06-01', '2027-06-30', 22, 18),
  C('maintenance-technician-engineer', 'discipline', 'maint-init', null, 'Maintenance initial training 2027 intake', 'التدريب الأولي للصيانة: دفعة 2027', '2027-06-01', '2028-06-30', 20, 17),
  C('maintenance-technician-engineer', 'discipline', 'maint-init', null, 'Maintenance initial training 2028 intake', 'التدريب الأولي للصيانة: دفعة 2028', '2028-06-01', '2029-06-30', 14, 12, false),
  C('systems-design-plant-engineer', 'discipline', 'eng-init', null, 'Engineering initial training 2026', 'التدريب الهندسي الأولي 2026', '2026-08-01', '2027-03-31', 16, 13),
  C('systems-design-plant-engineer', 'discipline', null, 'gdp', 'GDP 2025 engineering cohort', 'دفعة برنامج تطوير الخريجين 2025 (الهندسة)', '2025-10-01', '2028-03-31', 12, 12),
  C('systems-design-plant-engineer', 'discipline', 'eng-init', null, 'Engineering initial training 2027', 'التدريب الهندسي الأولي 2027', '2027-08-01', '2028-12-31', 10, 8, false),
  C('reactor-engineer-core-physicist', 'discipline', 'eng-init', null, 'Reactor engineering qualification', 'تأهيل هندسة المفاعل', '2026-10-01', '2028-09-30', 6, 5),
  C('outage-manager-planner', 'discipline', null, null, 'Outage planner development 2026', 'تطوير مخططي الانقطاعات 2026', '2026-05-01', '2028-06-30', 10, 7),
  C('outage-manager-planner', 'discipline', null, null, 'Outage planner development 2027', 'تطوير مخططي الانقطاعات 2027', '2027-05-01', '2029-06-30', 8, 6, false),
  C('radiation-protection-technician', 'discipline', 'rp-init', null, 'Radiation protection initial training 2026', 'التدريب الأولي للوقاية من الإشعاع 2026', '2026-03-01', '2027-04-30', 12, 10),
  C('radiation-protection-technician', 'discipline', 'rp-init', null, 'Radiation protection initial training 2027', 'التدريب الأولي للوقاية من الإشعاع 2027', '2027-03-01', '2028-04-30', 10, 9),
  C('chemistry-technician', 'discipline', 'chem-init', null, 'Chemistry initial training 2026', 'التدريب الأولي للكيمياء 2026', '2026-10-01', '2027-05-31', 8, 7),
  C('chemistry-technician', 'discipline', 'chem-init', null, 'Chemistry initial training 2027', 'التدريب الأولي للكيمياء 2027', '2027-10-01', '2028-05-31', 6, 5, false),
  C('nuclear-fuel-specialist', 'discipline', null, null, 'Nuclear fuel specialist development', 'تطوير أخصائيي الوقود النووي', '2026-06-01', '2028-09-30', 6, 5),
  C('nuclear-training-instructor', 'discipline', 'instr-qual', null, 'Instructor qualification 2026', 'تأهيل المدربين 2026', '2026-01-10', '2027-06-30', 8, 7),
  C('nuclear-training-instructor', 'discipline', 'instr-qual', null, 'Instructor qualification 2027', 'تأهيل المدربين 2027', '2027-01-10', '2028-06-30', 6, 5, false),
  C('quality-assurance-qc', 'discipline', null, null, 'QA/QC inspector development 2026', 'تطوير مفتشي ضمان الجودة 2026', '2026-03-01', '2027-09-30', 8, 6),
  C('quality-assurance-qc', 'discipline', null, null, 'QA/QC inspector development 2027', 'تطوير مفتشي ضمان الجودة 2027', '2027-03-01', '2028-09-30', 6, 5, false),
  C('regulatory-affairs-licensing-engineer', 'discipline', null, null, 'Licensing engineer development', 'تطوير مهندسي الترخيص', '2026-04-01', '2027-12-31', 4, 4),
  C('emergency-preparedness-coordinator', 'discipline', null, null, 'Emergency preparedness coordinator development', 'تطوير منسقي التأهب للطوارئ', '2026-05-01', '2028-03-31', 5, 4),
  C('nuclear-oversight-npi', 'discipline', null, null, 'Nuclear oversight assessor development', 'تطوير مقيّمي الرقابة النووية', '2026-06-01', '2028-06-30', 5, 4),
];
const SOURCE = 'Demo tenant (SAMPLE) · handover plan modelled on the ENEC–KHNP OSSA (about 400 experts a year until 2030; sources enec-khnp-ossa, enec-global-oe)';
const COHORT_SOURCE = 'Demo tenant (SAMPLE) · ready date SIMULATED from the programme length (M04 programmes, M06 talent programmes)';
const slug = (p) => p.toLowerCase().replace('-', '');

export default function build(T) {
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  T.external_cover = [];
  T.handover_cohorts = [];
  for (const period of PERIODS) {
    const bump = period === '2026-Q2' ? 1.03 : 1; // the earlier plan carried slightly more cover
    for (const [roleId, [ossa, contractor]] of Object.entries(COVER)) {
      const role = roles.get(roleId);
      if (!role) throw new Error(`f22: unknown role ${roleId}`);
      const prof = PROFILE[role.family_id] ?? PROFILE.default;
      YEARS.forEach((y, i) => {
        T.external_cover.push({ id: `xc-${slug(period)}-${roleId}-${y}-khnp`, period, role_id: roleId, function: role.family_id, year: y, partner: 'khnp_ossa', cover_count: Math.round(ossa * bump * prof[i]), source: SOURCE, sample: true });
        if (contractor) T.external_cover.push({ id: `xc-${slug(period)}-${roleId}-${y}-contractor`, period, role_id: roleId, function: role.family_id, year: y, partner: 'contractor', cover_count: Math.round(contractor * CONTRACTOR[i]), source: SOURCE, sample: true });
      });
    }
    let n = 0;
    for (const c of COHORTS) {
      if (period === '2026-Q2' && !c.q2) continue;
      n += 1;
      T.handover_cohorts.push({
        id: `hc-${slug(period)}-${String(n).padStart(2, '0')}-${c.role}`, period, role_id: c.role, route: c.route, programme_id: c.prog, talent_programme_id: c.tp,
        label_en: c.en, label_ar: c.ar, starts_on: c.starts, ready_on: c.ready, trainees: c.n, emirati: c.em, source: COHORT_SOURCE, sample: true,
      });
    }
  }
}
