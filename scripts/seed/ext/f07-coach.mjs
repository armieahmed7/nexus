// F07 (wave 1 · E3) seed: Learning Coach feedback and weekly goals. Synthetic only.
//  - curated rows for the demo personas k-ro (local) and sro (NEXUS role card): a weekly goal, one saved and one dismissed
//    suggestion, so the Saved and Hidden tabs and the "feedback" reasons show on first sign-in
//  - a synthetic population of feedback signals from active staff workers (w-*), so the HR insights page has cells at or
//    above the minimum group size (10) and others that are suppressed
// Loaded by scripts/build-seed.mjs (scripts/seed/ext/*.mjs, sorted). Ids are stable: cf:<person>:<kind>:<item>, lg:<person>.

const feedbackId = (p, k, i) => `cf:${p}:${k}:${i}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Deterministic PRNG (mulberry32) seeded per person, so the seed is byte-identical on every build.
function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  T.coach_feedback ??= [];
  T.learning_goals ??= [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  const courses = new Map(T.courses.map((c) => [c.id, c]));
  const rows = new Map();
  const add = (person, kind, item, signal, daysAgo, comps = []) => {
    if (!people.has(person)) return;
    const at = addDays(today, -daysAgo);
    const id = feedbackId(person, kind, item);
    rows.set(id, { id, person_id: person, item_kind: kind, item_id: item, signal, competency_ids: comps, at: `${at}T09:00:00Z`, hidden_until: signal === 'dismissed' ? addDays(at, 90) : null });
  };
  const goals = new Map();
  const goal = (person, hours, focus = []) => people.has(person) && goals.set(person, { id: `lg:${person}`, person_id: person, hours_per_week: hours, focus_role_ids: focus, updated_at: `${addDays(today, -20)}T08:00:00Z` });

  // ── curated demo rows
  goal('p-k-ro', 4);
  add('p-k-ro', 'mentor', 'mt-1', 'saved', 6, ['pf-03', 'co-01']);
  add('p-k-ro', 'course', 'c-exec-sim', 'dismissed', 12, courses.get('c-exec-sim')?.competency_ids ?? []);
  goal('p-sro', 3);
  add('p-sro', 'reading', 'oe-3', 'saved', 3);
  goal('p-k-lo-trainee', 6, ['reactor-operator']);

  // ── synthetic population (active staff workers only; personas excluded)
  const items = {
    course: T.courses.filter((c) => c.audience === 'staff' && !c.initial).map((c) => c.id),
    practice: T.assessment_forms.filter((f) => f.is_practice && f.kind === 'practice' && f.status === 'approved').map((f) => f.id),
    ojt: T.task_items.filter((t) => !T.qual_standards.find((s) => s.id === t.standard_id)?.security_restricted && ['ojt', 'jpm', 'simulator'].includes(t.method)).map((t) => t.id),
    mentor: T.mentors.map((m) => m.id),
    reading: T.oe_lessons.map((l) => l.id),
  };
  const kinds = ['course', 'course', 'course', 'practice', 'practice', 'ojt', 'ojt', 'mentor', 'mentor', 'reading', 'reading'];
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.id.startsWith('w-')).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const p of staff) {
    const r = rng(`f07:${p.id}`);
    if (r() < 0.12) continue; // most people have used the coach
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const kind = kinds[Math.floor(r() * kinds.length)];
      const list = items[kind];
      if (!list.length) continue;
      const item = list[Math.floor(r() * list.length)];
      const x = r();
      const signal = x < 0.45 ? 'saved' : x < 0.7 ? (kind === 'course' ? 'enrolled' : 'saved') : 'dismissed';
      const comps = kind === 'course' ? courses.get(item)?.competency_ids ?? [] : [];
      add(p.id, kind, item, signal, 2 + Math.floor(r() * 60), comps);
    }
    if (r() < 0.45) goal(p.id, [1, 1.5, 2, 2, 3, 3, 4, 5, 6][Math.floor(r() * 9)]);
  }
  T.coach_feedback.push(...[...rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
  T.learning_goals.push(...[...goals.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
}
