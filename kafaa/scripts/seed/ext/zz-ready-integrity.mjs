// [Readiness fixes 2026-10-13] Seed changes from the readiness review of the live site, so a fresh build equals live once the approval-gated
// data parts of docs/kafaa/ref/live_apply/ready/data_update/ are applied. Runs as a FINALIZE_LAST finalizer after zz-audit2-integrity and
// changes only the columns named below:
//  1. Arabic for English-only data shown on Arabic pages (finding 6): job_roles.regulation_ref_ar, career_paths.rule_ref_ar,
//     programmes.population_note_ar / conflict_note_ar, talent_programmes.conflict_note_ar, facts.conflict_note_ar, vacancies.location_ar.
//     Pages render them with pick(); a missing translation throws here, so a new English note cannot ship without its Arabic.
//     Live: data_update/01_kafaa_ready_ar_values_p1.sql (guarded UPDATEs generated from these maps by scripts/verify-ready-bundle.mjs --write-data).
// Finding 8 (four staff personas without a job role) is deliberately NOT changed here: a persona's job role feeds the seeded demand
// snapshots, F35 outlooks, FS51 forecasts and opportunity match scores, which the seed stores as released results (and live holds as
// such); assigning roles would need those snapshots regenerated on live as well. Left for the owner (PR notes).
export const FINALIZE_LAST = true;

/** English -> Arabic, per column. Keys must equal the English text exactly. */
export const AR = {
  'job_roles.regulation_ref': {
    'FANR radiation protection regulations': 'لوائح الهيئة الاتحادية للرقابة النووية للوقاية من الإشعاع',
    'FANR-REG-08 V2': 'FANR-REG-08 الإصدار 2',
    'FANR-REG-08 V2 (adds cyber security)': 'FANR-REG-08 الإصدار 2 (يضيف الأمن السيبراني)',
    'FANR-REG-10 (nuclear material accounting)': 'FANR-REG-10 (محاسبة المواد النووية)',
    'FANR-REG-10; IAEA safeguards agreement': 'FANR-REG-10؛ اتفاق الضمانات مع الوكالة الدولية للطاقة الذرية',
    'FANR-REG-12 Art. 23': 'FANR-REG-12 المادة 23',
    'FANR-REG-16 Art. 22': 'FANR-REG-16 المادة 22',
    'FANR-REG-16 Art. 9 (chemistry training)': 'FANR-REG-16 المادة 9 (التدريب في الكيمياء)',
    'FANR-REG-17 (holds SRO certificate)': 'FANR-REG-17 (يحمل شهادة كبير مشغّلي المفاعل)',
    'FANR-REG-17 (SRO-qualified instructor requalification)': 'FANR-REG-17 (إعادة تأهيل المدرّب المؤهل ككبير مشغّلي المفاعل)',
    'FANR-REG-17 Art. 12 (licensee qualification)': 'FANR-REG-17 المادة 12 (تأهيل المرخَّص له)',
    'FANR-REG-17 Art. 4, 7, 8, 10, 11': 'FANR-REG-17 المواد 4 و7 و8 و10 و11',
    'FANR-REG-17 Art. 4, 8, 10, 11': 'FANR-REG-17 المواد 4 و8 و10 و11',
  },
  'career_paths.rule_ref': {
    'ENEC GPO release (Aug 2025)': 'بيان ENEC عن برنامج GPO (أغسطس 2025)',
    'ENEC talent pipeline': 'مسار المواهب في ENEC',
    'FANR-REG-12 Art. 23': 'FANR-REG-12 المادة 23',
    'FANR-REG-17 Art. 1 (SRO Qualified Instructor)': 'FANR-REG-17 المادة 1 (مدرّب مؤهل ككبير مشغّلي المفاعل)',
    'FANR-REG-17 Art. 4': 'FANR-REG-17 المادة 4',
    'FANR-REG-17 Art. 4 (LO: high-school diploma)': 'FANR-REG-17 المادة 4 (المشغّل الميداني: شهادة الثانوية العامة)',
    'FANR-REG-17 Art. 4, 7, 10': 'FANR-REG-17 المواد 4 و7 و10',
    'IAEA SSG-75 §3.17': 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البند 3.17',
    'IAEA SSG-75 §3.28-3.34': 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البنود 3.28-3.34',
  },
  'programmes.population_note': {
    'certified operators, 2024': 'مشغّلًا معتمدًا، 2024',
    'completed YTD 2024': 'أكملوا البرنامج منذ بداية 2024',
    'completions, 2024': 'إتمامًا، 2024',
    'engineers in initial + continuing, 2024': 'مهندسًا في التدريب الأولي والمستمر، 2024',
    'leaders, 2024': 'قائدًا، 2024',
    'local operators, 2024': 'مشغّلًا ميدانيًا، 2024',
    'operators, 2024': 'مشغّلًا، 2024',
    'people in GET, 2024': 'شخصًا في برنامج التدريب الهندسي العام (GET)، 2024',
    'people, 2024': 'شخصًا، 2024',
    'senior leaders, 2024': 'من كبار القادة، 2024',
    'staff in initial + continuing, 2024': 'موظفًا في التدريب الأولي والمستمر، 2024',
    'trainees in initial + continuing, 2024': 'متدربًا في التدريب الأولي والمستمر، 2024',
    'trainees, 2024': 'متدربًا، 2024',
  },
  'programmes.conflict_note': {
    'COCT: 6 weeks (SR2024) vs about 5 weeks (CNS).': 'COCT: ‏6 أسابيع (SR2024) مقابل نحو 5 أسابيع (CNS).',
    'COCT/LOCT: 6 weeks (SR2024) vs about 5 weeks (CNS).': 'COCT/LOCT: ‏6 أسابيع (SR2024) مقابل نحو 5 أسابيع (CNS).',
    'COIT length: 91 weeks (SR2024) vs 82 weeks (CNS report).': 'مدة COIT: ‏91 أسبوعًا (SR2024) مقابل 82 أسبوعًا (تقرير CNS).',
    'Number of full-scope simulators: 2 at the STC or 4 in total (sources differ).': 'عدد أجهزة المحاكاة الكاملة: 2 في مركز التدريب على المحاكاة أو 4 إجمالًا (تختلف المصادر).',
  },
  'talent_programmes.conflict_note': {
    'DNT start: 2023 (launch release) or 2024 (graduation release); first cohort 20 (SR2024) or 30 recruited (CNS).': 'بداية برنامج DNT: ‏2023 (بيان الإطلاق) أو 2024 (بيان التخرج)؛ الدفعة الأولى 20 (SR2024) أو 30 تم توظيفهم (CNS).',
    'GDP length: 18-36 months (careers page) vs 12-30 months (Aug 2025 GPO release).': 'مدة برنامج GDP: ‏18-36 شهرًا (صفحة الوظائف) مقابل 12-30 شهرًا (بيان GPO، أغسطس 2025).',
    'Signing date: 6 May (ENEC) vs 14 May (Abu Dhabi Media Office) vs 27 May 2026 (WNN).': 'تاريخ التوقيع: 6 مايو (ENEC) مقابل 14 مايو (المكتب الإعلامي لأبوظبي) مقابل 27 مايو 2026 (WNN).',
  },
  'facts.conflict_note': {
    'IAEA: 21.8% nuclear share of 2024 generation.': 'الوكالة الدولية للطاقة الذرية: بلغت حصة الطاقة النووية 21.8% من توليد الكهرباء في 2024.',
    'Press releases say "over 3,000 people, 60% Emirati"; the audited 2024 GRI data say 2,979 and 54.7%.': 'تذكر البيانات الصحفية "أكثر من 3,000 موظف، 60% منهم إماراتيون"؛ وتذكر بيانات GRI المدققة لعام 2024 الرقمين 2,979 و54.7%.',
  },
  'vacancies.location': {
    'Abu Dhabi': 'أبوظبي',
    'Barakah, Al Dhafra': 'براكة، منطقة الظفرة',
  },
};

export default function build() {}

export function finalize(T) {
  for (const [key, map] of Object.entries(AR)) {
    const [table, col] = key.split('.');
    for (const r of T[table] ?? []) {
      const en = r[col];
      if (en == null || en === '') { r[`${col}_ar`] = null; continue; }
      const ar = map[en];
      if (!ar) throw new Error(`zz-ready-integrity: no Arabic for ${key} of ${r.id}: ${en}`);
      r[`${col}_ar`] = ar;
    }
  }
}
