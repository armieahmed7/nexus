// [W1 · E2] F05 Career Navigator and F06 Career Roadmap seed: shortlists (kafaa_career_targets) for most synthetic staff, some
// shared with their line manager, and saved roadmap scenarios (kafaa_roadmaps) with their computed timelines for the demo
// personas and a set of operators and technicians. Synthetic people only; the timelines come from the same pure rules the page
// uses (src/modules/m18/roadmap.ts), so a seeded scenario renders exactly as a freshly built one.
import { careerFacts, reachableRoles } from '../../../src/modules/m18/career.ts';
import { buildRoadmap, routeOptions, DEFAULT_SCENARIO } from '../../../src/modules/m18/roadmap.ts';

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const TS = '2026-09-01T08:00:00Z';

/** Persona shortlists: [role, shared]. */
const PERSONA_TARGETS = {
  'p-k-ro': [['senior-reactor-operator', true], ['operations-support-work-control', true], ['human-performance-specialist', false]],
  'p-k-lo-trainee': [['reactor-operator', false], ['senior-reactor-operator', false]],
  'p-qc-inspector': [['procurement-engineer', true]],
  'p-nse': [['quality-assurance-qc', false]],
};
/** Persona roadmaps: [id, target, name, scenario overrides, shared]. */
const PERSONA_ROADMAPS = {
  'p-k-ro': [['rm-k-ro-sro', 'senior-reactor-operator', 'SRO at the next intake', {}, true], ['rm-k-ro-sro-rotation', 'senior-reactor-operator', 'SRO after a work-control rotation', { rotation: true, leadership: true }, true]],
  'p-k-lo-trainee': [['rm-k-lo-ro', 'reactor-operator', 'RO via COIT at the first eligible intake', {}, false], ['rm-k-lo-ro-later', 'reactor-operator', 'RO with COIT a year later', { delayQ: 4 }, false]],
  'p-qc-inspector': [['rm-qc-procurement', 'procurement-engineer', 'Supplier quality and procurement', { leadership: false }, true]],
};

function dataFor(T) {
  return {
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills ?? [], states: [],
    licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses,
    trainingRecords: T.training_records, enrolments: T.enrolments,
  };
}

/** Courses that close the role-to-role competency gap (shortest first), for the development blocks of seeded roadmaps. */
function gapCourses(T, from, to) {
  const have = new Map(T.role_competencies.filter((r) => r.role_id === from).map((r) => [r.competency_id, r.required_level]));
  const gaps = new Set(T.role_competencies.filter((r) => r.role_id === to && (have.get(r.competency_id) ?? 0) < r.required_level).map((r) => r.competency_id));
  return T.courses
    .filter((c) => c.audience === 'staff' && (c.competency_ids ?? []).some((k) => gaps.has(k)) && !c.programme_id?.startsWith('coit') && !c.programme_id?.startsWith('loit'))
    .sort((a, b) => (Number(a.duration_hours) || 999) - (Number(b.duration_hours) || 999) || (a.id < b.id ? -1 : 1))
    .slice(0, 2);
}

export default function build(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const D = dataFor(T);
  const roleById = new Map(T.job_roles.map((r) => [r.id, r]));
  const sources = T.sources.map((s) => ({ id: s.id, label: s.label, url: s.url }));
  const leadership = T.courses.find((c) => c.id === 'c-intilaqa') ?? null;
  T.career_targets = [];
  T.roadmaps = [];
  const addTarget = (person, role, rank, shared) => T.career_targets.push({
    id: `ct:${person}:${role}`, person_id: person, role_id: role, rank, shared, shared_person_id: shared ? person : null, active: true, note: null, created_at: TS, updated_at: TS,
  });
  const addRoadmap = (person, id, target, name, over, shared) => {
    const p = T.people.find((x) => x.id === person);
    if (!p?.job_role_id) return;
    const f = careerFacts(D, person, now);
    const path = routeOptions(T.career_paths, p.job_role_id, target)[0];
    if (!path) return;
    const scenario = { path: path.map((e) => e.id), ...DEFAULT_SCENARIO, ...over };
    const r = buildRoadmap({ now, roleId: p.job_role_id, monthsInRole: f.months_in_role, qualifiedInRole: f.qualified_in_role, edges: T.career_paths, roles: T.job_roles, programmes: T.programmes, sources, gapCourses: gapCourses(T, p.job_role_id, target), leadershipCourse: leadership }, scenario);
    T.roadmaps.push({ id, person_id: person, target_role_id: target, name, scenario, plan: r.blocks, earliest_on: r.earliest, end_on: r.end, shared, shared_person_id: shared ? person : null, active: true, sent_plan_id: null, sent_at: null, created_at: TS, updated_at: TS });
  };

  for (const [person, list] of Object.entries(PERSONA_TARGETS)) list.forEach(([role, shared], i) => addTarget(person, role, i + 1, shared));
  for (const [person, list] of Object.entries(PERSONA_ROADMAPS)) for (const [id, target, name, over, shared] of list) addRoadmap(person, id, target, name, over, shared);

  // Synthetic staff: about two in three keep a shortlist of reachable roles (vertical moves first); about half share it.
  const staff = T.people.filter((p) => p.kind === 'staff' && p.job_role_id && p.status === 'active' && p.synthetic && !PERSONA_TARGETS[p.id] && /^w-/.test(p.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  let roadmaps = 0;
  for (const p of staff) {
    const h = hash(p.id);
    if (h % 3 === 0) continue;
    const reach = [...reachableRoles(T.career_paths, p.job_role_id, 2)].filter(([r]) => !roleById.get(r)?.security_sensitive);
    if (!reach.length) continue;
    const typeOf = (r) => T.career_paths.find((e) => e.from_role_id === p.job_role_id && e.to_role_id === r)?.type ?? 'two_step';
    const order = { vertical: 0, lateral: 1, cross_functional: 2, two_step: 3 };
    const picks = reach.sort((a, b) => order[typeOf(a[0])] - order[typeOf(b[0])] || a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 1 + (h % 3)).map(([r]) => r);
    const shared = (h >> 3) % 2 === 0;
    picks.forEach((r, i) => addTarget(p.id, r, i + 1, shared));
    if (roadmaps < 14 && ['local-operator', 'reactor-operator', 'maintenance-technician-engineer', 'radiation-protection-technician', 'chemistry-technician', 'senior-reactor-operator'].includes(p.job_role_id)) {
      addRoadmap(p.id, `rm-${p.id}-${picks[0]}`, picks[0], 'Next step', { delayQ: (h >>> 5) % 3, rotation: (h >>> 7) % 4 === 0 }, shared);
      roadmaps++;
    }
  }
}
