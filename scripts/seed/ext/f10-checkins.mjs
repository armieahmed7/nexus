// F10/F11 (wave 2 · w2e1) seed: skill check-ins with self, manager and peer ratings (open, decided, withdrawn), the
// validated rating evidence that decided check-ins wrote, team coverage targets and the crew profile.
// Loaded by scripts/build-seed.mjs after the wave-1 builders; f01's finalize derives the skill states afterwards, so the
// validated levels written here show in every passport, heatmap and calibration view.
// Everything is synthetic and deterministic (hash-based choices, no Math.random). Rater tendencies are built in so the
// calibration view has something to find: a few lenient and strict raters, and self-ratings that run about half a level high.
import { gatherEvidence } from '../../../src/domain/skills.ts';
import { securityComps } from '../../../src/modules/m17/badgeRules.ts';
import { addDaysIso, checkinBlock, checkinStatus, lineManagerOf, peerPool, ratingId, targetId, CREW_PROFILE } from '../../../src/modules/m17/checkins.ts';

const h32 = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const clamp = (x) => Math.max(1, Math.min(4, x));
const ts = (d, hh = 9) => `${d}T${String(hh).padStart(2, '0')}:00:00Z`;

// Skills people tend to ask about (filtered per person by checkinBlock: never security, never qualification-only).
const POOL = ['sk-hu-02', 'sk-sc-01', 'sk-rp-01', 'sk-da-01', 'sk-ld-01', 'sk-sc-02', 'sk-da-01-analysis', 'sk-hu-01', 'sk-en-01-project', 'sk-da-02', 'sk-ld-02', 'sk-ep-02', 'sk-da-01-scripting', 'sk-qa-01', 'sk-ns-01'];
// Systematic rater tendencies (deterministic): +1 lenient, -1 strict.
const BIAS = { 'w-ro-02': 1, 'w-sro-03': 1, 'w-mnt-04': 1, 'w-lo-07': -1, 'w-eng-02': -1, 'p-chem-sup': -1, 'w-lo-04': 1 };
const NOTES = [
  'Used it on shift this quarter and can walk you through the record.',
  'Led the pre-job brief for a medium-risk task and the post-job review.',
  'Raised two condition reports and followed them to closure.',
  'Built a small trend workbook for the crew from the plant data sandbox.',
  'Coached a new colleague through the task twice during the outage.',
  'Completed the module and applied it on a real work package.',
];
const EXAMPLES = [
  'Saw this in the last outage: clear, careful and well briefed.',
  'Did this alongside me on two night shifts; solid.',
  'Good, but still checks with a senior colleague on the harder cases.',
  'Strong: others in the crew ask for help with this.',
  'Seen once only; looked competent.',
];
const REASONS_ADJ = [
  'Good progress; one level lower until I see it on a higher-risk job.',
  'Evidence supports a higher level than you claimed: well done.',
  'Matches the training record; let us review again after the outage.',
];
const REASONS_NOT_YET = ['Not yet observed on the job: let us plan a task for you to show it.', 'Show me a completed example and we will revisit.'];

// Persona stories (the rest are generated). [subject, skills [id, self], peers, status, days ago, decision per skill?]
const STORIES = [
  // k-ro asks sro to validate the two claims from the passport; w-ro-01 answered, w-ro-02 has not yet (local backend demo).
  { id: 'chk-s-k-ro', person: 'p-k-ro', skills: [['sk-da-01', 2], ['sk-sc-02', 3]], peers: ['w-ro-01', 'w-ro-02'], status: 'open', ago: 4, answered: ['w-ro-01'] },
  // the shift supervisor's own check-in, validated by the operations lead (ops-ceo)
  { id: 'chk-s-sro', person: 'p-sro', skills: [['sk-da-01-analysis', 2], ['sk-en-01-project', 3]], peers: ['w-sro-01'], status: 'decided', ago: 40, decisions: [['validate'], ['validate']] },
  // qc-inspector: validated last quarter by head-sq (supabase demo persona)
  { id: 'chk-s-qc', person: 'p-qc-inspector', skills: [['sk-da-01', 2], ['sk-sc-01', 3]], peers: ['w-qa-02'], status: 'decided', ago: 63, decisions: [['validate'], ['adjust', 2, REASONS_ADJ[0]]] },
  // a QA colleague asks for a check-in (open; head-sq validates)
  { id: 'chk-s-qa-01', person: 'w-qa-01', skills: [['sk-hu-02', 3], ['sk-da-01', 2]], peers: ['w-qa-02'], status: 'open', ago: 3, answered: ['w-qa-02'] },
  // nse asks buyer as a peer (open; buyer's "Asked of me" demo and cpo's queue on the live backend: both are NEXUS role cards)
  { id: 'chk-s-nse', person: 'p-nse', skills: [['sk-qa-02', 3], ['sk-da-01-analysis', 2]], peers: ['p-buyer', 'w-sc-01'], status: 'open', ago: 2, answered: ['w-sc-01'], message: 'Two skills from the vendor audit programme' },
  // outage-planner: decided with one adjustment by outage-manager
  { id: 'chk-s-op', person: 'p-outage-planner', skills: [['sk-en-01-project', 3], ['sk-ld-01', 2]], peers: [], status: 'decided', ago: 25, decisions: [['adjust', 2, REASONS_ADJ[0]], ['validate']] },
  // k-lo-trainee: open, waiting for the operations lead
  { id: 'chk-s-lot', person: 'p-k-lo-trainee', skills: [['sk-hu-02', 2]], peers: ['w-lo-03'], status: 'open', ago: 9 },
];
// Generated subjects: synthetic workers across operations, maintenance, engineering, RP, chemistry, QA and training.
const GEN = (T) => T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && /^w-(ss|sro|ro|lo|wc|rp|chem|mnt|eng|instr|qa-02|ep|fire)-/.test(p.id)).map((p) => p.id).sort();

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  T.skill_checkins = [];
  T.skill_ratings = [];
  T.team_skill_targets = [];
  T.skill_evidence = T.skill_evidence ?? [];
  T.notifications = T.notifications ?? [];
  const people = T.people, asg = T.role_assignments;
  const sec = securityComps(T.competencies);
  const std = new Set(T.qual_standards.map((q) => q.id));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const derived = gatherEvidence({
    skills: T.skills, competencies: T.competencies, role_competencies: T.role_competencies, qual_standards: T.qual_standards, qual_records: T.qual_records,
    training_records: T.training_records, courses: T.courses, attempts: T.attempts, assessment_forms: T.assessment_forms, jpm_results: T.jpm_results, jpms: T.jpms,
  }, { person: null, now: today });
  const evidence = [...derived, ...T.skill_evidence];
  const evLevel = new Map();
  for (const e of evidence) if (e.kind !== 'rating' && e.active !== false) evLevel.set(`${e.person_id}|${e.skill_id}`, Math.max(evLevel.get(`${e.person_id}|${e.skill_id}`) ?? 0, e.level));
  const ev = (p, s) => evLevel.get(`${p}|${s}`) ?? null;
  const eligible = (p, s) => skills.has(s) && !checkinBlock(skills.get(s), { secComps: sec, standardIds: std, evidence, person: p });
  const notify = (id, person, en, ar, link, at, severity = 'info') => {
    if (T.notifications.some((n) => n.id === id)) return;
    T.notifications.push({ id, person_id: person, kind: 'skills', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: at, read_at: null });
  };

  function emit(st) {
    const person = st.person;
    const mgr = lineManagerOf(person, people, asg, today);
    if (!mgr) return;
    const items = st.skills.filter(([s]) => eligible(person, s)).slice(0, 5).map(([s, lvl], i) => ({ skill_id: s, self_level: lvl, note: NOTES[h32(`${st.id}${s}`) % NOTES.length] }));
    if (!items.length) return;
    const pool = new Set(peerPool(person, people, asg, today).peers.map((p) => p.id));
    const peers = st.peers.filter((p) => pool.has(p)).slice(0, 2);
    const reqOn = addDaysIso(today, -st.ago);
    const at = ts(reqOn, 8 + (h32(st.id) % 8));
    const c = { id: st.id, person_id: person, manager_id: mgr, peer_ids: peers, skills: items, message: st.message ?? null, status: 'open', requested_at: at, due_on: addDaysIso(reqOn, 14), decided_by: null, decided_at: null, decision_note: null };
    const rate = (rater, kind, s, level, example, status, when) => T.skill_ratings.push({ id: ratingId(st.id, rater, s), checkin_id: st.id, subject_id: person, rater_person_id: rater, rater_kind: kind, skill_id: s, level, example, status, requested_at: at, at: when });
    const decidedOn = addDaysIso(reqOn, 3 + (h32(st.id + 'd') % 8));
    const peerAt = ts(addDaysIso(reqOn, 1 + (h32(st.id + 'p') % 3)), 14);
    for (const it of items) {
      rate(person, 'self', it.skill_id, it.self_level, it.note, 'submitted', at);
      for (const p of peers) {
        const answered = st.status !== 'open' || (st.answered ?? []).includes(p);
        if (!answered) { rate(p, 'peer', it.skill_id, null, null, st.status === 'withdrawn' || st.status === 'decided' ? 'closed' : 'pending', null); continue; }
        if (h32(`${st.id}${p}${it.skill_id}`) % 9 === 0) { rate(p, 'peer', it.skill_id, null, null, 'not_observed', peerAt); continue; }
        const base = ev(person, it.skill_id) ?? it.self_level - 1;
        const noise = [0, 0, 0, 1, -1][h32(`${p}${it.skill_id}${st.id}`) % 5];
        rate(p, 'peer', it.skill_id, clamp(base + (BIAS[p] ?? 0) + (BIAS[p] ? 0 : noise)), EXAMPLES[h32(p + it.skill_id) % EXAMPLES.length], 'submitted', peerAt);
      }
    }
    if (st.status === 'open' || st.status === 'withdrawn') {
      for (const it of items) rate(mgr, 'manager', it.skill_id, null, null, st.status === 'open' ? 'pending' : 'closed', null);
      if (st.status === 'withdrawn') Object.assign(c, { status: 'withdrawn', decided_by: person, decided_at: ts(decidedOn, 11), decision_note: 'Withdrawn: I will ask again after the outage.' });
      else {
        notify(`nt-${st.id}-mgr`, mgr, 'Skill check-in to validate', 'تقييم مهارات بانتظار اعتمادك', '/team/skills/validate', at);
        for (const p of peers) if (!(st.answered ?? []).includes(p)) notify(`nt-${st.id}-${p}`, p, 'A colleague asked you to rate a skill', 'طلب منك زميل تقييم مهارة', '/my/skills/checkins', at);
      }
      T.skill_checkins.push(c);
      return;
    }
    // decided by the line manager
    const decAt = ts(decidedOn, 10);
    const out = items.map((it, i) => {
      let d = st.decisions?.[i];
      if (!d) {
        const e = ev(person, it.skill_id);
        const m = clamp((e ?? it.self_level) + (BIAS[mgr] ?? 0));
        if (e == null && it.self_level >= 3 && h32(st.id + it.skill_id) % 3 === 0) d = ['not_yet', null, REASONS_NOT_YET[h32(it.skill_id) % 2]];
        else if (m === it.self_level || (e == null && h32(st.id + it.skill_id) % 2 === 0)) d = ['validate'];
        else d = ['adjust', m, REASONS_ADJ[m > it.self_level ? 1 : h32(st.id) % 2 === 0 ? 0 : 2]];
      }
      const [outcome, lvl, why] = d;
      const final = outcome === 'validate' ? it.self_level : outcome === 'adjust' ? lvl : null;
      rate(mgr, 'manager', it.skill_id, final, why ?? (outcome === 'validate' ? 'Validated' : null), 'submitted', decAt);
      if (final != null) {
        const claim = (T.skill_claims ?? []).filter((x) => x.person_id === person && x.skill_id === it.skill_id && x.status === 'claimed').sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
        const note = why ?? `Validated in check-in ${st.id}`;
        if (claim) {
          Object.assign(claim, { status: final >= claim.level ? 'validated' : 'rejected', decided_by: mgr, decided_at: decAt, decision_note: `Check-in ${st.id}: level ${final}${why ? ` (${why})` : ''}` });
          const eid = `se:rating:${claim.id}:${it.skill_id}`;
          const row = T.skill_evidence.find((x) => x.id === eid);
          if (row) Object.assign(row, { level: final, basis: 'validated', status: 'current', observed_on: decidedOn, note, recorded_by: mgr, active: true });
        } else {
          T.skill_evidence.push({ id: `se:rating:${st.id}:${it.skill_id}`, person_id: person, skill_id: it.skill_id, kind: 'rating', ref_table: 'skill_checkins', ref_id: st.id, level: final, basis: 'validated', status: 'current', observed_on: decidedOn, note, recorded_by: mgr, active: true });
        }
      }
      return { ...it, outcome, final_level: final, reason: why ?? null };
    });
    Object.assign(c, { skills: out, status: checkinStatus(out), decided_by: mgr, decided_at: decAt, decision_note: null });
    T.skill_checkins.push(c);
  }

  for (const st of STORIES) emit(st);
  GEN(T).forEach((person, i) => {
    const pool = peerPool(person, people, asg, today).peers.map((p) => p.id);
    const picks = POOL.filter((s) => eligible(person, s));
    const k = 1 + (h32(person) % 3);
    const off = h32(person + 's') % Math.max(1, picks.length);
    const chosen = Array.from({ length: Math.min(k, picks.length) }, (_, j) => picks[(off + j * 3) % picks.length]).filter((s, j, a) => a.indexOf(s) === j);
    const selfBias = h32(person + 'b') % 2; // self-ratings run 0 or 1 level above independent evidence
    const sk = chosen.map((s) => [s, clamp((ev(person, s) ?? 2) + selfBias + (BIAS[person] ?? 0) * 0)]);
    const pk = pool.length ? [pool[h32(person + 'p1') % pool.length], pool[h32(person + 'p2') % pool.length]].filter((x, j, a) => a.indexOf(x) === j).slice(0, 1 + (h32(person) % 2)) : [];
    const mode = i % 7;
    const status = mode === 3 || mode === 6 ? 'open' : i % 13 === 7 ? 'withdrawn' : 'decided';
    emit({ id: `chk-s-${person.replace(/^w-/, '')}`, person, skills: sk, peers: pk, status, ago: status === 'open' ? 2 + (h32(person) % 20) : 15 + (h32(person) % 150), answered: status === 'open' ? pk.slice(0, h32(person + 'a') % 2) : [] });
    // a second, older check-in for every third person, so the calibration view has history
    if (i % 3 === 0) {
      const s2 = POOL.filter((s) => eligible(person, s) && !chosen.includes(s)).slice(0, 2).map((s) => [s, clamp((ev(person, s) ?? 2) + selfBias)]);
      if (s2.length) emit({ id: `chk-s-${person.replace(/^w-/, '')}-2`, person, skills: s2, peers: pk.slice(0, 1), status: 'decided', ago: 170 + (h32(person + '2') % 120) });
    }
  });

  // F11 targets: crew B (sro), the operations family (ops-ceo), RP, chemistry and QA teams, and the crew profile.
  const tgt = (team, skill, min_people, min_level, set_by, note = null, updated = '2026-09-15') =>
    T.team_skill_targets.push({ id: targetId(team, skill), team_id: team, skill_id: skill, min_people, min_level, note, active: true, set_by, updated_at: ts(updated) });
  tgt('team:ops-crew-b', 'sk-co-01-eop', 4, 3, 'p-sro', 'Every shift position covered on emergency procedures');
  tgt('team:ops-crew-b', 'sk-co-03-startup', 3, 3, 'p-sro');
  tgt('team:ops-crew-b', 'sk-ld-02-decide', 3, 3, 'p-sro');
  tgt('team:ops-crew-b', 'sk-pf-01-core', 2, 3, 'p-sro');
  tgt('team:ops-crew-b', 'sk-sc-02', 2, 3, 'p-sro', 'Two people able to lead safety-values conversations on shift');
  tgt('team:ops-crew-b', 'sk-da-01', 2, 2, 'p-sro', 'Data literacy for the new turnover dashboard');
  tgt('team:ops-crew-b', 'sk-pf-03-aux', 3, 2, 'p-sro');
  tgt('team:ops-crew-b', 'sk-hu-02', 4, 2, 'p-sro');
  tgt('family:operations', 'sk-co-01-eop', 12, 3, 'p-ops-ceo');
  tgt('family:operations', 'sk-ld-02-decide', 6, 3, 'p-ops-ceo');
  tgt('family:operations', 'sk-da-01', 6, 2, 'p-ops-ceo', 'Digital readiness for the plant data programme');
  tgt('family:operations', 'sk-sc-02', 5, 3, 'p-ops-ceo');
  tgt('team:rp', 'sk-rp-02-survey', 3, 3, 'p-rp-lead');
  tgt('team:rp', 'sk-rp-01-dose', 3, 2, 'p-rp-lead');
  tgt('team:chem', 'sk-ch-01-primary', 2, 4, 'p-chem-sup', 'Level-4 sampling cover for every outage window');
  tgt('team:chem', 'sk-da-01-analysis', 2, 3, 'p-chem-sup');
  tgt('team:qa', 'sk-qa-01-inspect', 2, 3, 'p-head-sq');
  tgt(CREW_PROFILE, 'sk-co-01-eop', 3, 3, 'p-training-mgr', 'Crew profile: emergency operating procedures');
  tgt(CREW_PROFILE, 'sk-co-03-startup', 2, 3, 'p-training-mgr');
  tgt(CREW_PROFILE, 'sk-pf-03-rcs', 3, 3, 'p-training-mgr');
  tgt(CREW_PROFILE, 'sk-ns-02-techspec', 2, 3, 'p-training-mgr');
  tgt(CREW_PROFILE, 'sk-ld-02-decide', 1, 3, 'p-training-mgr');
  tgt(CREW_PROFILE, 'sk-co-01-rounds', 2, 3, 'p-training-mgr');
  tgt(CREW_PROFILE, 'sk-pf-03-aux', 2, 2, 'p-training-mgr');
  T.skill_checkins.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.skill_ratings.sort((a, b) => (a.id < b.id ? -1 : 1));
}
