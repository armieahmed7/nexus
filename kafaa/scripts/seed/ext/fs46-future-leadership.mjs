// FS46 + FS47 + FS48 (future-skills wave E · E4, module M22) seed.
// FS46: the twelve leadership behaviours with anchors at every rating point and coach cards (form 2 = the eight F16 behaviours + four
//       future ones), and a form-2 360 cycle (2026-H2) for the Future Leaders 2026 cohort plus four academy participants. The F16 form-1
//       rows are untouched, so every earlier 360 result reads exactly as before.
// FS47: the Future Leaders track as a 12th academy programme (not nominable by managers: HR nominates), five INMA-pattern competencies,
//       seven external programmes (facts, dates and URLs from the research packs only), three cohorts (2025 pilot completed, 2026
//       running, 2027 open), HR nominations selected through the F16 decision (maker-checker) and participants' modules and projects.
// FS48: the three strands (mentor circles, visiting placements, sponsored study with a placement), circles and concept offers, opt-in
//       participants (open to anyone; gender is never read here except to pick synthetic women for the demo), memberships and
//       requests; three withdrawn participants whose choices were blanked (no trace in any ranking).
// The F13 mentoring engine card (F24) gains the two FS48 ranking functions (version 2), as the migration does on live.
// Synthetic people only; dates on or before the demo day.
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';
import { BEHAVIOUR_IDS_V2, FUTURE_BEHAVIOUR_IDS, validScores } from '../../../src/modules/m22/domain.ts';
import { FL_PROGRAMME_ID, flCohortFor, WFN_INTERESTS } from '../../../src/modules/m22/future.ts';
import { BEHAVIOUR_DEFS, FL_COHORTS, FL_COMPETENCIES, FL_EXTERNAL, FL_PROGRAMME_ROW, FS54_AS_OF, WFN_CIRCLES, WFN_OFFERS, WFN_PROGRAMMES } from '../../../src/modules/m22/fs54data.ts';

/** FNV-1a for stable synthetic picks. */
function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;
const hex = (s) => h32(s).toString(16).padStart(8, '0');

/** The mentoring card (F24) at version 2: FS48 circle and offer ranking (same text as the migration). */
export const FS48_CARD = {
  version: 2, last_changed_at: '2026-10-10T00:00:00Z',
  scoring_functions: ['src/modules/m04/match.ts#rankMentors', 'src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers'],
  extra_input: { key: 'wfn_participants', en: 'Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers', ar: 'المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة' },
  limitations_en: 'Only mentors who opted in and have capacity appear. Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.',
  limitations_ar: 'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية. تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.',
};

// FS02 adds the future skills in its FINALIZE_LAST finalize; the skill references are checked after it (file-name order).
export const FINALIZE_LAST = true;
export function finalize(T) {
  const skillIds = new Set(T.skills.map((s) => s.id));
  const refs = [...T.fl_competencies.flatMap((c) => Object.keys(c.skill_targets)), ...T.wfn_circles.flatMap((c) => c.skill_ids), ...FL_PROGRAMME_ROW.skill_ids];
  for (const s of refs) if (!skillIds.has(s)) throw new Error(`fs46-48: unknown skill ${s}`);
}

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const P = (id) => { const p = people.get(id); if (!p || p.kind !== 'staff' || p.status !== 'active') throw new Error(`fs46: ${id} is not active staff`); return p; };
  const nameAr = (p) => p.display_name_ar || p.display_name;
  const lm = (id) => lineManagerOf(id, T.people, T.role_assignments, today);

  // ───────────── FS47 programme row (12th academy programme) and FS46 behaviours
  if (T.leadership_programmes.some((g) => g.id === FL_PROGRAMME_ID)) throw new Error('fs46: programme already present');
  T.leadership_programmes.push({ ...FL_PROGRAMME_ROW });
  T.leadership_behaviours = BEHAVIOUR_DEFS.map((d) => ({
    id: d.id, form_from: d.form_from, sort: d.sort, trait_id: d.trait_id,
    title_en: d.title.en, title_ar: d.title.ar, short_en: d.short.en, short_ar: d.short.ar, statement_en: d.statement.en, statement_ar: d.statement.ar,
    framework_en: d.framework.en, framework_ar: d.framework.ar, anchors: d.anchors,
    coach: { tips: d.coach.tips, practice: d.coach.practice, watch: d.coach.watch }, links: d.links.map((l) => ({ to: l.to, label_en: l.label.en, label_ar: l.label.ar })),
    programme_ids: [...new Set([...T.leadership_programmes.filter((g) => (g.behaviour_ids ?? []).includes(d.id)).map((g) => g.id), ...d.programme_ids])].sort(),
    benchmark_ids: d.benchmark_ids, sources: d.sources,
  }));
  if (T.leadership_behaviours.map((x) => x.id).join() !== BEHAVIOUR_IDS_V2.join()) throw new Error('fs46: behaviour rows must follow form 2 order');

  // ───────────── FS47 reference rows
  T.fl_competencies = FL_COMPETENCIES.map((c) => ({
    id: c.id, code: c.code, sort: c.sort, title_en: c.title.en, title_ar: c.title.ar, summary_en: c.summary.en, summary_ar: c.summary.ar, area_en: c.area.en, area_ar: c.area.ar,
    descriptors: c.descriptors, skill_targets: c.skill_targets, route: c.route.map((x) => ({ kind: x.kind, ref: x.ref, title_en: x.title.en, title_ar: x.title.ar })), external_ids: c.external_ids, sources: c.sources,
  }));
  T.fl_external = FL_EXTERNAL.map((x) => ({ id: x.id, kind: x.kind, sort: x.sort, owner_en: x.owner.en, owner_ar: x.owner.ar, title_en: x.title.en, title_ar: x.title.ar, summary_en: x.summary.en, summary_ar: x.summary.ar, dates_en: x.dates.en, dates_ar: x.dates.ar, year_from: x.year_from, year_to: x.year_to, competency_ids: x.competency_ids, sources: x.sources }));
  T.fl_cohorts = FL_COHORTS.map((c) => ({
    id: c.id, code: c.code, year: c.year, status: c.status, seats: c.seats, starts_on: c.starts_on, ends_on: c.ends_on, title_en: c.title.en, title_ar: c.title.ar,
    modules: c.modules.map((m) => ({ id: m.id, title_en: m.title.en, title_ar: m.title.ar, format_en: m.format.en, format_ar: m.format.ar, weeks: m.weeks, competency_ids: m.competency_ids })),
    brief_en: c.brief.en, brief_ar: c.brief.ar, mentor_en: c.mentor.en, mentor_ar: c.mentor.ar, sort: c.sort,
  }));
  const MODS = FL_COHORTS[0].modules.map((m) => m.id);

  // ───────────── FS47 nominations (HR nominates; the HR authority or the training manager selects; maker-checker)
  const noms = [];
  const N = (k, pid, cycle, status, created, decided, reason, note = null) => {
    const p = P(pid);
    const by = k % 2 ? 'p-k-hr-analyst' : 'p-chco';
    const decider = by === 'p-chco' ? 'p-training-mgr' : 'p-chco';
    const nm = people.get(by);
    const history = [{ at: ts(created), status: 'nominated', by, note: null }];
    if (status !== 'nominated') history.push({ at: ts(decided, '11:00'), status: status === 'completed' ? 'approved' : status, by: decider, note });
    if (status === 'completed') history.push({ at: ts('2025-06-30', '15:00'), status: 'completed', by: decider, note: 'Future Leaders track completed' });
    noms.push({
      id: `ln-fl-${String(k).padStart(3, '0')}`, person_id: pid, programme_id: FL_PROGRAMME_ID, nominated_by: by, reason, cycle, status,
      person_name: p.display_name, person_name_ar: nameAr(p), person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
      nominator_name: nm.display_name, nominator_name_ar: nameAr(nm), decided_by: status === 'nominated' ? null : decider, decided_at: status === 'nominated' ? null : ts(decided, '11:00'),
      decision_note: note, history, created_at: ts(created), updated_at: ts(status === 'completed' ? '2025-06-30' : decided ?? created, status === 'completed' ? '15:00' : '11:00'),
    });
  };
  const REASONS = [
    'Leads cross-functional work with maturity and explains decisions to stakeholders outside the plant; ready for nuclear-management depth.',
    'Strong safety judgement and a habit of capturing knowledge for others; a candidate for the policy and regulatory modules.',
    'Has run complex schedules and budgets in their area; the track would broaden this to organisation-level project control.',
    'Represents the team well with partners and suppliers; ready to build stakeholder and international competence.',
  ];
  const PILOT = ['w-mnt-01', 'w-qa-02', 'w-chem-02', 'w-instr-01', 'w-eng-04', 'w-rp-02', 'p-work-control', 'w-ep-02'];
  const COHORT = ['p-qc-inspector', 'p-sq-lead', 'p-nse', 'p-cap-coord', 'w-eng-01', 'w-eng-02', 'w-mnt-03', 'w-chem-01', 'w-rp-01', 'w-sro-02', 'w-sro-03', 'w-ep-01'];
  const NEXT = ['w-ro-02', 'w-mnt-06', 'w-eng-03', 'p-outage-planner'];
  let k = 0;
  for (const [i, pid] of PILOT.entries()) N(++k, pid, '2024-H2', 'completed', `2024-08-1${i}`, `2024-09-0${1 + (i % 8)}`, REASONS[i % 4]);
  for (const [i, pid] of COHORT.entries()) N(++k, pid, '2026-H1', 'approved', `2026-05-${String(4 + i).padStart(2, '0')}`, `2026-06-${String(10 + i).padStart(2, '0')}`, REASONS[(i + 1) % 4]);
  N(++k, 'w-corp-01', '2026-H1', 'declined', '2026-05-20', '2026-06-24', REASONS[3], 'Not this cohort: complete the FAS front-line programme first, then renominate for 2027.');
  for (const [i, pid] of NEXT.entries()) N(++k, pid, '2026-H2', 'nominated', ['2026-09-22', '2026-09-25', '2026-09-28', '2026-10-01'][i], null, REASONS[i % 4]);
  T.leadership_nominations.push(...noms);
  for (const n of noms) if (!['flc-2025', 'flc-2026', 'flc-2027'].includes(flCohortFor(n.cycle))) throw new Error(`fs47: no cohort for ${n.id}`);

  // participants: pilot completed; 2026 cohort two months in (module 1 done by everyone, module 2 by about half)
  const PROJ = [
    ['Keeping senior control-room knowledge when experienced operators retire', 'How should succession and knowledge capture be paced so that retirements never thin a crew below its proven experience?', 'Shift Manager (role card)'],
    ['A public-communication playbook for planned outages', 'What should communities and partners hear, from whom and when, before and during a planned outage?', 'Communications Director (role card)'],
    ['Supplier quality expectations for factory-built modules (concept, no deployment decision implied)', 'Which supplier quality controls would have to move into the factory if modules were built off site?', 'Head of Supplier Quality (role card)'],
    ['Oversight rules for AI assistants in procedure reviews', 'When may a supervisor accept an AI-assisted review, and what must always be verified against the controlled source?', 'AI Governance Lead (role card)'],
    ['Cross-training chemistry and radiation protection technicians', 'Would a shared foundation year shorten time to independent work without weakening either discipline?', 'Chemistry Superintendent (role card)'],
    ['Reading safety-culture trends from field observations', 'Which observation signals give leaders an early, fair picture of safety culture in a team?', 'Nuclear Oversight Lead (role card)'],
    ['A mentoring model for first-line leaders in maintenance', 'How can new maintenance supervisors be mentored through their first year of leading crews?', 'Maintenance Manager (role card)'],
    ['Data quality rules for plant performance trending', 'What data quality rules must plant performance trends meet before leaders act on them?', 'Engineering Director (role card)'],
  ];
  const summary = (t) => `This paper looks at "${t}". It reviews current practice in our area, compares it with published international guidance and proposes three options with their risks, costs and the people they affect.`;
  T.fl_participants = [];
  for (const n of noms.filter((x) => x.status === 'completed' || x.status === 'approved')) {
    const pilot = n.status === 'completed';
    const i = T.fl_participants.length;
    const j = pilot ? i : i - PILOT.length;
    const mods = pilot ? MODS : MODS.filter((m, mi) => mi === 0 || (mi === 1 && h32(n.id) % 2 === 0));
    const projStatus = pilot ? 'accepted' : n.person_id === 'p-qc-inspector' ? 'draft' : ['none', 'draft', 'submitted', 'submitted', 'returned', 'draft', 'none', 'submitted', 'none', 'draft', 'none', 'submitted'][j % 12];
    const pr = PROJ[(i * 5) % PROJ.length];
    const has = projStatus !== 'none';
    const decided = pilot ? '2025-06-20' : projStatus === 'returned' ? '2026-10-06' : null;
    T.fl_participants.push({
      id: `flp:${n.id}`, nomination_id: n.id, person_id: n.person_id, cohort_id: flCohortFor(n.cycle), person_name: n.person_name, person_name_ar: n.person_name_ar, modules_done: mods,
      project_title: has ? pr[0] : null, project_question: has ? pr[1] : null, project_summary: has ? summary(pr[0]) : null, project_sponsor_role: has ? pr[2] : null,
      project_status: projStatus, project_submitted_on: pilot ? '2025-06-01' : ['submitted', 'returned'].includes(projStatus) ? '2026-10-01' : null,
      project_reviewed_by: decided ? (pilot ? 'p-training-mgr' : 'p-chco') : null, project_review_note: projStatus === 'returned' ? 'Please narrow the question to one decision the sponsor can take, and add one international comparison.' : null,
      project_decided_on: decided, status: pilot ? 'completed' : 'active', completed_on: pilot ? '2025-06-30' : null,
      history: pilot ? [{ at: ts('2025-06-20', '10:00'), status: 'project:accepted', by: 'p-training-mgr', note: null }] : [{ at: ts('2026-09-25', '10:00'), status: 'module:flm-safety', by: 'p-training-mgr', note: null }],
      updated_at: ts(pilot ? '2025-06-30' : '2026-10-06', '16:00'),
    });
  }

  // ───────────── FS46 form-2 360 (2026-H2): the 2026 cohort (part of module 6) and four academy participants
  const existing = new Set(T.leadership_360_requests.filter((q) => q.cycle === '2026-H2').map((q) => q.subject_id));
  const pool = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && !p.id.startsWith('p-k-') && p.job_family_id).sort((a, b) => (a.id < b.id ? -1 : 1));
  const pickRaters = (subject, n) => {
    const s = P(subject);
    const out = [];
    const mgr = lm(subject);
    if (mgr && mgr !== subject && !mgr.startsWith('p-k-')) out.push([mgr, 'manager']);
    const cand = pool.filter((p) => p.id !== subject && p.id !== 'p-sro').sort((a, b) => ((a.job_family_id === s.job_family_id ? 0 : 1) - (b.job_family_id === s.job_family_id ? 0 : 1)) || h32(`v2${subject}${a.id}`) - h32(`v2${subject}${b.id}`));
    for (const p of cand) { if (out.length >= n) break; if (!out.some(([id]) => id === p.id)) out.push([p.id, h32(`${subject}${p.id}`) % 4 === 0 ? 'report' : 'peer']); }
    return out;
  };
  const future = new Set(FUTURE_BEHAVIOUR_IDS);
  const scoreFor = (subject, rater, kind) => {
    const o = {};
    for (const bid of BEHAVIOUR_IDS_V2) {
      const base = future.has(bid) ? 2 + (h32(`${subject}|${bid}`) % 3) : 3 + (h32(`${subject}|${bid}`) % 2);
      const noise = [-1, 0, 0, 1][h32(`v2|${subject}|${rater}|${bid}`) % 4];
      const v = kind === 'self' ? base + (h32(`${subject}|${bid}|self2`) % 2) : base + noise;
      o[bid] = Math.max(1, Math.min(5, v));
    }
    if (!validScores(o, 2)) throw new Error('fs46: invalid seeded sheet');
    return o;
  };
  const reqs = [];
  const resps = [];
  const add = (subject, nRaters, nSubmitted, extra = []) => {
    if (existing.has(subject)) throw new Error(`fs46: ${subject} already has a 2026-H2 (form 1) cycle`);
    const s = P(subject);
    const ex = new Set(extra.map(([id]) => id));
    const raters = [...pickRaters(subject, nRaters + extra.length).filter(([id]) => !ex.has(id)).slice(0, nRaters - extra.length), ...extra];
    const all = [[subject, 'self'], ...raters];
    all.forEach(([rid, kind], i) => {
      const id = `l3q-2026-H2-${subject}-${rid}`;
      const inv = `2026-09-${String(21 + (h32(id) % 9)).padStart(2, '0')}`;
      const done = kind === 'self' ? h32(`${subject}self`) % 3 !== 0 : i - 1 < nSubmitted;
      const sub = `2026-10-0${1 + (h32(`${id}s`) % 7)}`;
      reqs.push({ id, cycle: '2026-H2', subject_id: subject, rater_id: rid, rater_kind: kind, status: done ? 'submitted' : 'invited', subject_name: s.display_name, subject_name_ar: nameAr(s), invited_at: ts(inv), submitted_at: done ? ts(sub, '15:00') : null, form_version: 2 });
      if (done) resps.push({ id: `l3-v2${hex(id)}${hex(`${id}|v2`)}`, cycle: '2026-H2', subject_id: subject, rater_kind: kind, scores: scoreFor(subject, rid, kind), submitted_at: ts(sub, '15:00'), open_read: false, form_version: 2 });
    });
  };
  COHORT.forEach((sid, i) => {
    const n = 6 + (h32(sid) % 3);
    const sub = sid === 'w-sro-03' ? 3 : sid === 'w-ep-01' ? 4 : n; // two participants still below the threshold
    const extra = sid === 'p-sq-lead' ? [['p-k-ro', 'peer']] : sid === 'w-eng-01' ? [['p-qc-inspector', 'peer']] : sid === 'p-cap-coord' ? [['p-nse', 'peer']] : [];
    add(sid, n, extra.length ? Math.min(sub, n - extra.length) : sub, extra);
  });
  for (const sid of ['w-ro-05', 'w-ro-07', 'w-ss-01', 'w-qa-02']) add(sid, 6, 6);
  T.leadership_360_requests.push(...reqs);
  T.leadership_360.push(...resps);
  T.leadership_360_requests.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.leadership_360.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const q of T.leadership_360_requests) q.form_version ??= 1;
  for (const x of T.leadership_360) x.form_version ??= 1;

  // ───────────── FS48 reference rows
  T.wfn_programmes = WFN_PROGRAMMES.map((x) => ({ id: x.id, strand: x.strand, sort: x.sort, title_en: x.title.en, title_ar: x.title.ar, summary_en: x.summary.en, summary_ar: x.summary.ar, pattern_en: x.pattern.en, pattern_ar: x.pattern.ar, fact_en: x.fact.en, fact_ar: x.fact.ar, sources: x.sources }));
  T.wfn_circles = WFN_CIRCLES.map((c) => ({ id: c.id, sort: c.sort, status: c.status, seats: c.seats, focus: c.focus, skill_ids: c.skill_ids, starts_on: c.starts_on, title_en: c.title.en, title_ar: c.title.ar, mentor_role_en: c.mentor_role.en, mentor_role_ar: c.mentor_role.ar, cadence_en: c.cadence.en, cadence_ar: c.cadence.ar }));
  T.wfn_offers = WFN_OFFERS.map((o) => ({ id: o.id, strand: o.strand, sort: o.sort, status: o.status, seats: o.seats, weeks: o.weeks, months: o.months, closes_on: o.closes_on, focus: o.focus, title_en: o.title.en, title_ar: o.title.ar, host_en: o.host.en, host_ar: o.host.ar, placement_en: o.placement.en, placement_ar: o.placement.ar }));
  for (const x of [...T.wfn_circles, ...T.wfn_offers]) for (const f of x.focus) if (!WFN_INTERESTS.includes(f)) throw new Error(`fs48: unknown area ${f}`);

  // ───────────── FS48 participants (opt-in; open to all, the demo network is mostly synthetic women plus allies who mentor)
  const women = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.gender === 'f').map((p) => p.id).sort();
  const allies = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.gender === 'm' && p.level === 'senior' && ['engineering', 'maintenance'].includes(p.job_family_id)).map((p) => p.id).sort().slice(0, 2);
  if (allies.length < 2 || women.length < 10) throw new Error('fs48: not enough synthetic staff for the demo network');
  const personas = ['p-qc-inspector', 'p-sq-lead', 'p-cap-coord', 'p-nse', 'p-buyer', 'p-fuel-pm', 'p-chem-sup'];
  const mentors = new Set(['p-fuel-pm', 'p-chem-sup', 'w-sro-02', ...allies]);
  const withdrawn = new Set(['w-lo-09', 'p-buyer', 'w-corp-02'].filter((id) => people.has(id)));
  const members = [...women, ...personas, ...allies];
  T.wfn_participants = members.map((pid, i) => {
    P(pid);
    const out = withdrawn.has(pid);
    const ints = WFN_INTERESTS.filter((_, j) => (h32(`${pid}|${j}`) % 3 === 0)).slice(0, 3);
    const interests = ints.length ? ints : [WFN_INTERESTS[h32(pid) % WFN_INTERESTS.length]];
    const strands = ['circles', ...(h32(`${pid}v`) % 2 ? ['visiting'] : []), ...(h32(`${pid}s`) % 3 === 0 ? ['sponsored'] : [])];
    return {
      id: `wp:${pid}`, person_id: pid, active: !out, interests: out ? [] : [...interests].sort(), strands: out ? [] : strands, mentor: out ? false : mentors.has(pid),
      joined_on: `2026-0${1 + (i % 8)}-1${i % 9}`, withdrawn_on: out ? '2026-09-30' : null, updated_at: ts(out ? '2026-09-30' : `2026-0${1 + (i % 8)}-1${i % 9}`),
    };
  }).sort((a, b) => (a.id < b.id ? -1 : 1));
  // persona choices for the demo
  const setP = (pid, patch) => Object.assign(T.wfn_participants.find((x) => x.person_id === pid), patch);
  setP('p-qc-inspector', { interests: ['ai_data', 'leadership'], strands: ['circles', 'visiting', 'sponsored'], mentor: false });
  setP('p-nse', { interests: ['advanced_reactor', 'project_delivery'], strands: ['circles', 'sponsored'], mentor: false });
  const active = T.wfn_participants.filter((x) => x.active).map((x) => x.person_id);

  // memberships: a mentor per circle, members by area; wc-smr is full; the pilot circle closed in 2025
  T.wfn_circle_members = [];
  const M = (cid, pid, role, active = true, joined = '2026-03-02', left = null) => T.wfn_circle_members.push({ id: `wcm:${cid}:${pid}`, circle_id: cid, person_id: pid, role, active, joined_on: joined, left_on: left });
  const mentorOf = { 'wc-ai': allies[0], 'wc-smr': 'p-fuel-pm', 'wc-lead': 'w-sro-02', 'wc-green': 'p-chem-sup', 'wc-project': allies[1] };
  for (const [cid, pid] of Object.entries(mentorOf)) M(cid, pid, 'mentor', true, WFN_CIRCLES.find((c) => c.id === cid).starts_on);
  const seats = new Map(WFN_CIRCLES.map((c) => [c.id, c.seats]));
  const used = new Map();
  const join = (cid, pid) => { if (mentors.has(pid) && Object.values(mentorOf).includes(pid)) return; const n = used.get(cid) ?? 0; if (n >= seats.get(cid)) return; used.set(cid, n + 1); M(cid, pid, 'member', true, `2026-0${3 + (h32(cid + pid) % 6)}-0${1 + (h32(pid) % 8)}`); };
  for (const pid of active.filter((x) => !['p-qc-inspector', 'p-nse'].includes(x))) {
    const p = T.wfn_participants.find((x) => x.person_id === pid);
    for (const c of WFN_CIRCLES.filter((c) => c.status === 'active' && c.focus.some((f) => p.interests.includes(f))).slice(0, 1)) join(c.id, pid);
  }
  join('wc-lead', 'p-qc-inspector');
  for (const pid of active) if ((used.get('wc-smr') ?? 0) < seats.get('wc-smr') && !T.wfn_circle_members.some((m) => m.person_id === pid && m.circle_id === 'wc-smr') && pid !== 'p-nse' && pid !== 'p-qc-inspector') join('wc-smr', pid);
  for (const pid of [...withdrawn]) M('wc-lead', pid, 'member', false, '2026-02-15', '2026-09-30');
  for (const pid of women.slice(0, 6)) M('wc-pilot-2025', pid, 'member', false, '2025-01-15', '2025-12-15');
  T.wfn_circle_members.sort((a, b) => (a.id < b.id ? -1 : 1));

  // requests: placements and sponsored study in every state; withdrawn participants' open requests are withdrawn
  T.wfn_requests = [];
  const R = (n, pid, offer, status, outcome = null, note = null) => {
    const p = P(pid);
    const created = `2026-0${4 + (n % 5)}-${String(2 + n).padStart(2, '0')}`;
    const decided = ['interested', 'withdrawn'].includes(status) ? null : new Date(Date.parse(`${created}T00:00:00Z`) + (14 + (n % 5) * 7) * 864e5).toISOString().slice(0, 10);
    const hist = [{ at: ts(created), status: 'interested', by: pid, note: null }];
    if (decided) for (const s of { shortlisted: ['shortlisted'], placed: ['shortlisted', 'placed'], completed: ['shortlisted', 'placed', 'completed'], declined: ['declined'] }[status]) hist.push({ at: ts(decided, '11:00'), status: s, by: 'p-training-mgr', note: s === 'declined' ? note : null });
    if (status === 'withdrawn') hist.push({ at: ts('2026-09-30', '12:00'), status: 'withdrawn', by: pid, note: null });
    T.wfn_requests.push({
      id: `wr-${String(n).padStart(3, '0')}`, offer_id: offer, person_id: pid, person_name: p.display_name, person_name_ar: nameAr(p),
      statement: 'I want to build this future skill on real work and bring it back to my team; my manager supports the time away.',
      status, outcome, decided_by: decided ? 'p-training-mgr' : null, decided_on: decided, note, history: hist, created_at: ts(created), updated_at: ts(status === 'withdrawn' ? '2026-09-30' : decided ?? created, '11:00'),
    });
  };
  const ws = women.filter((x) => !withdrawn.has(x));
  R(1, 'p-qc-inspector', 'wo-visit-twin', 'shortlisted');
  R(2, 'p-nse', 'wo-study-ntm', 'interested');
  R(3, ws[0], 'wo-visit-smr', 'interested');
  R(4, ws[1], 'wo-study-data', 'interested');
  R(5, ws[2], 'wo-visit-twin', 'shortlisted');
  R(6, ws[3], 'wo-study-h2', 'placed');
  R(7, ws[4], 'wo-study-ntm', 'placed');
  R(8, ws[5], 'wo-visit-hub', 'placed');
  R(9, ws[6], 'wo-visit-hub', 'completed', 'progressed');
  R(10, ws[7], 'wo-visit-hub', 'completed', 'progressed');
  R(11, ws[8], 'wo-visit-twin', 'completed', 'progressed');
  R(12, 'p-sq-lead', 'wo-visit-hub', 'completed', 'same_role');
  R(13, 'p-cap-coord', 'wo-study-data', 'completed', 'progressed');
  R(14, ws[1], 'wo-visit-hub', 'completed', 'same_role');
  R(15, ws[0], 'wo-study-h2', 'declined', null, 'This cohort is full; the next intake opens in 2027 and your request stays on file if you apply again.');
  R(16, 'p-buyer', 'wo-study-data', 'withdrawn');
  R(17, 'w-lo-09', 'wo-visit-smr', 'withdrawn');
  T.wfn_requests.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ───────────── F24 engine card: FS48 ranking on the F13 mentoring card (version 2)
  const card = (T.engine_cards ?? []).find((c) => c.id === 'mentoring');
  if (!card) throw new Error('fs48: mentoring engine card missing');
  Object.assign(card, { version: FS48_CARD.version, last_changed_at: FS48_CARD.last_changed_at, scoring_functions: FS48_CARD.scoring_functions, inputs_used: [...card.inputs_used.filter((x) => x.key !== 'wfn_participants'), FS48_CARD.extra_input], limitations_en: FS48_CARD.limitations_en, limitations_ar: FS48_CARD.limitations_ar });
  console.log(`fs46-48: 12 behaviours (4 future, anchors 1-5 EN/AR), ${reqs.length} form-2 360 requests / ${resps.length} responses (${COHORT.length + 4} subjects), FL ${noms.length} nominations, ${T.fl_participants.length} participants, ${T.fl_external.length} external programmes (as of ${FS54_AS_OF}); WiN ${T.wfn_participants.length} participants (${active.length} active), ${T.wfn_circle_members.length} memberships, ${T.wfn_requests.length} requests`);
}
