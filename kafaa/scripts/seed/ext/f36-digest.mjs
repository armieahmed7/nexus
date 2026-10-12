// F36 (wave 5 · E5) Personal weekly digest and nudges, and F37 (Dalil career mode) demo rows.
//  - digest_prefs: synthetic w-* staff with their own nudge settings (quiet hours, nudges off, muted kinds, monthly or fortnightly).
//    Role-card personas keep the defaults (weekly, no quiet hours) so every demo sign-in sees a digest.
//  - digest_runs + notifications (finalize, after F01 derives skill states): the last four weekly digests of every active staff
//    member on weekly digests (one current digest for monthly and fortnightly ones), computed by buildDigestItems() exactly as
//    kafaa_build_digest would have stored them (no coach hint: the coach item is the "must keep" fallback). Past digests are
//    marked read for about two in three people, so the admin open rate has data; the current one is unread.
//  - advisor_sessions / advisor_turns: three career-mode conversations (submode 'career') for the Dalil admin logs.
import { buildDigestItems, digestId, digestNotice, digestNoticeId, periodOf, prefsOf, addDays } from '../../../src/shell/digest/rules.ts';

export const FINALIZE_LAST = true; // after f01-skills.mjs (skill states) and the other finalizers, by file name

/** FNV-1a for stable synthetic picks. */
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }

const PREFS = [
  // quiet hours 22:00-06:00 (Abu Dhabi), weekly
  ...['w-ro-01', 'w-ro-03', 'w-ro-05', 'w-lo-02', 'w-lo-04', 'w-lo-06', 'w-mnt-01', 'w-mnt-03', 'w-rp-01', 'w-chem-01', 'w-eng-02', 'w-ep-01'].map((id) => ({ id, quiet_start: 22, quiet_end: 6 })),
  // nudges off
  ...['w-corp-01', 'w-qa-02', 'w-fire-02', 'w-mnt-07'].map((id) => ({ id, enabled: false })),
  // muted kinds
  { id: 'w-eng-04', muted_kinds: ['opportunity'] }, { id: 'w-eng-05', muted_kinds: ['refresher'] }, { id: 'w-chem-02', muted_kinds: ['opportunity', 'refresher'] },
  { id: 'w-rp-03', muted_kinds: ['conversation'] }, { id: 'w-lo-08', muted_kinds: ['mentoring'] }, { id: 'w-instr-02', muted_kinds: ['coach'] },
  // other frequencies
  { id: 'w-sro-04', frequency: 'monthly' }, { id: 'w-ss-02', frequency: 'monthly' }, { id: 'w-wc-01', frequency: 'monthly' }, { id: 'w-sc-01', frequency: 'fortnightly' }, { id: 'w-qa-01', frequency: 'fortnightly' },
];

export default function build(T, ctx) {
  const people = new Set(T.people.map((p) => p.id));
  T.digest_prefs = PREFS.filter((p) => people.has(p.id)).map((p) => ({
    id: `dp:${p.id}`, person_id: p.id, enabled: p.enabled ?? true, frequency: p.frequency ?? 'weekly', quiet_start: p.quiet_start ?? null, quiet_end: p.quiet_end ?? null,
    muted_kinds: [...(p.muted_kinds ?? [])].sort(), updated_at: '2026-09-20T06:00:00Z',
  }));
  // F37: career-mode conversations for the admin logs (synthetic staff; retention 30 days)
  const S = (id, person, at, turns) => {
    T.advisor_sessions.push({ id, person_id: person, mode: 'staff', submode: 'career', started_at: at, retention_until: addDays(at.slice(0, 10), 30), handoff: 'none', handoff_consent: false,
      turns: turns.length * 2, client_key: null, page_context: '/my/career', handoff_status: 'none', handoff_note: null, last_turn_at: at });
    turns.forEach(([q, a, intent, cites], i) => {
      T.advisor_turns.push({ id: `${id}-${2 * i + 1}`, session_id: id, person_id: person, speaker: 'user', text: q, citations: [], refused: false, refusal_category: null, ts: at, intent, confidence: null, redacted: false, mode: 'staff', submode: 'career' });
      T.advisor_turns.push({ id: `${id}-${2 * i + 2}`, session_id: id, person_id: person, speaker: 'dalil', text: a, citations: cites, refused: false, refusal_category: null, ts: at, intent, confidence: 1, redacted: false, mode: 'staff', submode: 'career' });
    });
  };
  const REG = { label: 'FANR-REG-17 Art. 4', url: 'https://www.fanr.gov.ae/en/Documents/FANR-REG17%20V.1%20EN%20-%20BOM%20Version%20Certified.PDF' };
  S('as-career-1', 'w-ro-02', '2026-10-06T07:30:00Z', [
    ['What do I need for SRO?', 'Senior Reactor Operator: your route is "24 months as RO at Barakah + SRO exams". Gates: 24 months as RO (met), SRO-level COIT content (to do), FANR SRO exams (to do), UAE security clearance (licensee check). Top gaps: Leadership and teamwork (2 to 3), Plant systems knowledge (3 to 4). Indicative only: ENEC and FANR decide.', 'career.gap_to_role',
      [REG, { label: 'Senior Reactor Operator', url: '/careers/roles/senior-reactor-operator' }, { label: 'My Skills Passport', url: '/my/skills' }]],
    ['When could I be SRO?', 'On the default roadmap your SRO certification falls in 2028-Q1 (indicative): the SRO programme starts at the next intake, then the FANR exams 90 days after it.', 'career.roadmap_date',
      [{ label: 'My career roadmap', url: '/my/career/roadmap' }, REG]],
  ]);
  S('as-career-2', 'w-lo-03', '2026-10-07T11:10:00Z', [
    ['Which opportunities fit me?', 'Three open opportunities match your skills: the outage support role in Unit 2 (82% match), the OE review project (76%) and the turbine shadowing week (71%).', 'career.opportunities',
      [{ label: 'Opportunity marketplace', url: '/opportunities' }]],
  ]);
  S('as-career-3', 'w-mnt-02', '2026-10-08T05:45:00Z', [
    ['Where can I go next?', 'From Maintenance Technician the closest moves are Maintenance Supervisor (ready in about 12 months) and Planning and Scheduling Engineer (stretch).', 'career.next_roles',
      [{ label: 'My Career Navigator', url: '/my/career' }]],
  ]);
  void ctx;
}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();
  const data = {
    people: T.people, qual_records: T.qual_records, qual_standards: T.qual_standards, licences: T.licences, skill_checkins: T.skill_checkins ?? [], skill_ratings: T.skill_ratings ?? [],
    mentoring_requests: T.mentoring_requests ?? [], mentoring_agreements: T.mentoring_agreements ?? [], mentoring_sessions: T.mentoring_sessions ?? [], opportunities: T.opportunities ?? [],
    opportunity_applications: T.opportunity_applications ?? [], career_conversations: T.career_conversations ?? [], refresh_state: T.refresh_state ?? [], refresh_prefs: T.refresh_prefs ?? [],
    enrolments: T.enrolments, courses: T.courses, person_skills: T.person_skills ?? [], skills: T.skills ?? [], role_competencies: T.role_competencies, career_paths: T.career_paths,
    career_targets: T.career_targets ?? [], engine_settings: T.engine_settings ?? [], reco_optouts: T.reco_optouts ?? [],
    ojt_logs: T.ojt_logs ?? [], ojt_eval_requests: T.ojt_eval_requests ?? [], // W5 integration (F38)
    plant_visits: T.plant_visits ?? [], // FS wave E integration (FS39 host confirmations)
  };
  T.digest_runs = [];
  const prefsBy = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
  for (const me of staff) {
    const prefs = prefsOf(prefsBy.get(me));
    if (!prefs.enabled) continue;
    const dates = prefs.frequency === 'weekly' ? [addDays(today, -21), addDays(today, -14), addDays(today, -7), today] : [today];
    for (const d of dates) {
      const period = periodOf(d, prefs.frequency);
      const items = buildDigestItems(data, me, d, prefs);
      const at = `${d}T03:00:00Z`; // 07:00 in Abu Dhabi
      let nid = null;
      if (items.length) {
        nid = digestNoticeId(me, period);
        const n = digestNotice(items, prefs.frequency);
        const read = d < today && h32(`${me}:${period}`) % 3 !== 0 ? `${addDays(d, 1 + (h32(period + me) % 3))}T05:00:00Z` : null;
        T.notifications.push({ id: nid, person_id: me, kind: 'digest', ...n, link: '/my#digest', created_at: at, read_at: read });
      }
      T.digest_runs.push({ id: digestId(me, period), person_id: me, period, frequency: prefs.frequency, as_of: d, items, item_count: items.length, notification_id: nid, coach_hint: false, built_at: at });
    }
  }
}
