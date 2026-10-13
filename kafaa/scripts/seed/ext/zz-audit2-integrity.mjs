// [Audit2 2026-10-13] Final-audit fixes to the seed, so a fresh build equals live after the 2026-10-13 data clean-up and the audit2
// bundle (docs/kafaa/ref/live_apply/audit2/). Runs as the very last FINALIZE_LAST finalizer (file name 'zz-'), after every builder has
// derived its own rows, and changes only the rows named below:
//  1. One open enrolment per person and course (finding 10). Three role-rule assignments duplicated a later enrolment on the same course
//     (en-133/en-166, en-140/en-164, en-173/en-244). The superseded row is cancelled with the note the live clean-up wrote, which the
//     partial unique index kafaa_enrolments_open_person_course_uniq (20261013100009_kafaa_audit2_enrolment_open_unique.sql) now enforces.
//  2. Arabic role notes (finding 15): kafaa_job_roles.basis_note_ar for the 16 roles with an English basis_note (rendered with pick()).
//     Live gets the same values from the separate, approval-gated part audit2/data_update/01_kafaa_audit2_role_notes_ar_values_p1.sql.
export const FINALIZE_LAST = true;

/** Statuses of an enrolment that is still open (same list as rules.ts OPEN_ENROL and the SQL index predicate). */
export const OPEN_ENROL = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];
const RANK = { in_progress: 6, enrolled: 5, approved: 4, waitlisted: 3, requested: 2, assigned: 1 };

/** English basis note -> Arabic (finding 15). Keys must equal the English text exactly. */
export const BASIS_NOTE_AR = {
  'Barakah title and structure unconfirmed; follows IAEA SSG-75.': 'المسمى والهيكل في براكة غير مؤكدين؛ يتبع دليل الوكالة الدولية للطاقة الذرية SSG-75.',
  'A separate STA role at Barakah is unconfirmed; follows IAEA SSG-75.': 'وجود دور مستقل للمستشار الفني للوردية في براكة غير مؤكد؛ يتبع دليل الوكالة الدولية للطاقة الذرية SSG-75.',
  'Nuclear Fuel Design track detail from search digests only.': 'تفاصيل مسار تصميم الوقود النووي مأخوذة من ملخصات البحث فقط.',
  "Career path only; no security detail is held in Kafa'a.": 'المسار المهني فقط؛ لا تحتفظ كفاءة بأي تفاصيل أمنية.',
  'Administrative Assistant vacancies are open only to UAE nationals (enec.ae careers).': 'وظائف المساعد الإداري متاحة للمواطنين الإماراتيين فقط (صفحة الوظائف على enec.ae).',
  'Concept role for planning: no vacancy, no deployment decision implied.': 'دور مفاهيمي للتخطيط: لا توجد وظيفة شاغرة، ولا يعني ذلك أي قرار بالنشر.',
};

export default function build() {}

export function finalize(T) {
  // 1. duplicate open enrolments: keep the most advanced (then the latest id), cancel the rest
  const groups = new Map();
  for (const e of T.enrolments) {
    if (!OPEN_ENROL.includes(e.status)) continue;
    const k = `${e.person_id}|${e.course_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => RANK[b.status] - RANK[a.status] || (a.id < b.id ? 1 : -1));
    const keep = rows[0];
    for (const e of rows.slice(1)) Object.assign(e, { status: 'cancelled', decision_note: `Duplicate enrolment closed in data clean-up 2026-10-13 (kept ${keep.id})` });
  }
  // 2. Arabic basis notes
  for (const r of T.job_roles) {
    if (!r.basis_note) { r.basis_note_ar = null; continue; }
    const ar = BASIS_NOTE_AR[r.basis_note];
    if (!ar) throw new Error(`zz-audit2-integrity: no Arabic basis note for role ${r.id}: ${r.basis_note}`);
    r.basis_note_ar = ar;
  }
}
