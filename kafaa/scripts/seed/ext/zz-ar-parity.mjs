// [Arabic parity 2026-10-17] Arabic for English-only training-session locations (kafaa_sessions.location_ar), so /ar/learn/course/<id>,
// /ar/training/* and /ar/my/learning show the place in Arabic. Runs as a FINALIZE_LAST finalizer and changes only sessions.location_ar.
// Pages render pick(session, 'location'), which falls back to the English value when the Arabic one is empty (a session a trainer
// schedules later without an Arabic location). A seeded location without an Arabic value throws here, so one cannot ship untranslated.
// Live: supabase/migrations/20261017120001_kafaa_ar_parity_session_location.sql adds the column and fills it with these same values
// (tests/unit/ar-parity.test.ts checks the two agree).
export const FINALIZE_LAST = true;

/** English -> Arabic, per column. Keys must equal the stored English text exactly. */
export const AR = {
  'sessions.location': {
    'Abu Dhabi': 'أبوظبي',
    'Abu Dhabi (supplier academy)': 'أبوظبي (أكاديمية الموردين)',
    Barakah: 'براكة',
    'Barakah training centre': 'مركز التدريب في براكة',
    'E-learning': 'تعلم إلكتروني',
    'Operator Training Center': 'مركز تدريب المشغّلين',
    'Simulator Training Center': 'مركز التدريب على المحاكاة',
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
      if (!ar) throw new Error(`zz-ar-parity: no Arabic for ${key} of ${r.id}: ${en}`);
      r[`${col}_ar`] = ar;
    }
  }
}
