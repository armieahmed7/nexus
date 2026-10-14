// Regulation and source references ("FANR-REG-17 Art. 4", "SR2024 p.51", "ENEC talent pipeline") are stored in English in
// jsonb such as job_roles.entry_routes[].rule_ref and in rule_ref columns without an _ar twin. On Arabic pages they render
// through localizeRef: document codes (FANR-REG-17, SSG-75, SR2024, ENEC, GPO) stay as written, which is normal in Arabic
// text; the words around them ("Art.", "p.", "V2", known phrases and parentheticals, month names) become Arabic. The wording
// follows the Arabic already used in career_paths.rule_ref_ar and job_roles.regulation_ref_ar. Text that already contains
// Arabic, and anything not recognised, is returned unchanged, so this never loses information.
import type { Lang } from './index';

const ARABIC = /[؀-ۿ]/;

// Whole references and leading phrases (applied first, longest first).
const PHRASES: [RegExp, string][] = [
  [/^ENEC GPO release\b/, 'بيان ENEC عن برنامج GPO'],
  [/^ENEC talent pipeline$/, 'مسار المواهب في ENEC'],
  [/^FANR radiation protection regulations$/, 'لوائح الهيئة الاتحادية للرقابة النووية للوقاية من الإشعاع'],
  [/\bIAEA safeguards agreement\b/, 'اتفاق الضمانات مع الوكالة الدولية للطاقة الذرية'],
];

// Parenthetical notes that recur on rule references (career paths, reporting obligations).
const NOTES: Record<string, string> = {
  'LO: high-school diploma': 'المشغّل الميداني: شهادة الثانوية العامة',
  'SRO Qualified Instructor': 'مدرّب مؤهل ككبير مشغّلي المفاعل',
  'licensee qualification': 'تأهيل المرخَّص له',
  'holds SRO certificate': 'يحمل شهادة كبير مشغّلي المفاعل',
  'chemistry training': 'التدريب في الكيمياء',
  'nuclear material accounting': 'محاسبة المواد النووية',
  'adds cyber security': 'يضيف الأمن السيبراني',
  '60 days before programme start': 'قبل 60 يوماً من بدء البرنامج',
  '60 days ahead': 'قبل 60 يوماً',
  'every 6 months': 'كل 6 أشهر',
  'within 3 working days': 'خلال 3 أيام عمل',
};

const MONTHS: Record<string, string> = {
  jan: 'يناير', feb: 'فبراير', mar: 'مارس', apr: 'أبريل', may: 'مايو', jun: 'يونيو',
  jul: 'يوليو', aug: 'أغسطس', sep: 'سبتمبر', oct: 'أكتوبر', nov: 'نوفمبر', dec: 'ديسمبر',
};

const NUM = String.raw`\d+(?:\.\d+)*[a-z]?`;
const LIST = new RegExp(String.raw`(${NUM}(?:\s*(?:,|and|&)\s*${NUM})*)`);
const splitList = (list: string) => list.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean);
// Arabic list joining as in the existing data: "المواد 4 و8 و10".
const joinAr = (xs: string[]) => xs[0] + xs.slice(1).map((x) => ` و${x}`).join('');

/** Arabic rendering of a regulation/source reference; identity for English or for text that is already Arabic. */
export function localizeRef(ref: string | null | undefined, lang: Lang): string {
  const s0 = String(ref ?? '');
  if (lang !== 'ar' || !s0.trim() || ARABIC.test(s0)) return s0;
  let s = s0.trim();
  for (const [re, ar] of PHRASES) s = s.replace(re, ar);
  // Parenthetical notes: translate the known ones, keep the rest verbatim.
  s = s.replace(/\(([^()]+)\)/g, (m, inner: string) => (NOTES[inner.trim()] ? `(${NOTES[inner.trim()]})` : m));
  // IAEA guides: "IAEA SSG-75 §3.17" -> "دليل الوكالة الدولية للطاقة الذرية SSG-75، البند 3.17".
  s = s.replace(/\bIAEA\s+([A-Z]+-\d+)\s*(?=§)/g, 'دليل الوكالة الدولية للطاقة الذرية $1، ');
  s = s.replace(/\bIAEA\s+([A-Z]+-\d+)\b/g, 'دليل الوكالة الدولية للطاقة الذرية $1');
  s = s.replace(/§\s*([\d.]+(?:\s*[-–]\s*[\d.]+)?)/g, (_m, r: string) => (/[-–]/.test(r) ? `البنود ${r.replace(/\s+/g, '')}` : `البند ${r}`));
  // Articles: "Art. 4" -> "المادة 4"; "Art. 4, 8, 10" / "Arts. 4 and 8" -> "المواد 4 و8 و10".
  s = s.replace(new RegExp(String.raw`\bArts?\.?\s*${LIST.source}`, 'g'), (_m, list: string) => {
    const xs = splitList(list);
    return xs.length === 1 ? `المادة ${xs[0]}` : `المواد ${joinAr(xs)}`;
  });
  // Pages: "p.51" / "pp. 3-5" -> "ص 51" / "ص 3-5".
  s = s.replace(/\bpp?\.\s*(\d+(?:\s*[-–]\s*\d+)?)/g, (_m, p: string) => `ص ${p.replace(/\s+/g, '')}`);
  // Versions: "REG-08 V2" -> "REG-08 الإصدار 2".
  s = s.replace(/\bV(\d+(?:\.\d+)?)\b/g, 'الإصدار $1');
  // Months: "Aug 2025" -> "أغسطس 2025".
  s = s.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\b/g, (_m, mo: string, y: string) => `${MONTHS[mo.slice(0, 3).toLowerCase()]} ${y}`);
  // "SR2024 p.51" reads "SR2024، ص 51" in Arabic.
  s = s.replace(/^(SR\d{4})\s+(ص )/, '$1، $2');
  s = s.replace(/;\s*/g, '؛ ');
  return s;
}
