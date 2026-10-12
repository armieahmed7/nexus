// FS76 Dalil future-skills mode (future-skills wave H · E4, M13) seed.
//   - dalil_intents: the four future-skills intents from src/modules/m13/career/futureIntents.ts (all switched on; no change recorded yet).
//   - advisor_sessions / advisor_turns: three staff conversations in future-skills mode (career sessions: mode staff, submode career, the
//     intent tells future turns apart) and one anonymous public conversation (client key only, no person). Synthetic workers only.
//     Dated 2026-10-10, after the demo digest date and the last FS55 fairness snapshot (2026-10-08), so seeded digests and the
//     career_mode_used fairness rows stay unchanged.
//   - eval_runs: release r1.1, the first release gate with the FS76 set next to the public (F14) and career (F37) sets. Its numbers are the
//     result of running the three sets on the seed; tests/unit/fs84-dalil-future.test.ts re-runs them and fails if they differ.
import { FS76_EVAL, FUTURE_INTENTS } from '../../../src/modules/m13/career/futureIntents.ts';

const AT = '2026-10-10';
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export default function build(T, ctx) {
  T.dalil_intents = FUTURE_INTENTS.map((d) => ({
    id: d.id, kind: d.kind, audience: d.audience, feature: d.feature, title_en: d.title_en, title_ar: d.title_ar, summary_en: d.summary_en, summary_ar: d.summary_ar,
    examples_en: d.examples_en, examples_ar: d.examples_ar, cites: d.cites, sources: d.sources, benchmark_ids: d.benchmark_ids, enabled: true, changed_role: null, changed_at: null, change_note: null, sort: d.sort,
  }));
  const people = new Set(T.people.map((p) => p.id));
  const S = (id, person, at, mode, submode, page, turns, clientKey = null) => {
    if (person && !people.has(person)) throw new Error(`fs76: unknown person ${person}`);
    T.advisor_sessions.push({ id, person_id: person, mode, submode, started_at: at, retention_until: addDays(at.slice(0, 10), 30), handoff: 'none', handoff_consent: false,
      turns: turns.length * 2, client_key: clientKey, page_context: page, handoff_status: 'none', handoff_note: null, last_turn_at: at });
    turns.forEach(([q, a, intent, cites], i) => {
      T.advisor_turns.push({ id: `${id}-${2 * i + 1}`, session_id: id, person_id: person, speaker: 'user', text: q, citations: [], refused: false, refusal_category: null, ts: at, intent, confidence: null, redacted: false, mode, submode });
      T.advisor_turns.push({ id: `${id}-${2 * i + 2}`, session_id: id, person_id: person, speaker: 'dalil', text: a, citations: cites, refused: false, refusal_category: null, ts: at, intent, confidence: 1, redacted: false, mode, submode });
    });
  };
  const tx = (role, label) => ({ label: `${label} · role transformation map`, url: `/careers/roles/${role}/transformation` });
  // Answer texts are what future-skills mode answers for these synthetic workers on the seed (EN, as logged); see tests/unit/fs84-dalil-future.test.ts.
  S('as-future-1', 'w-ro-03', `${AT}T06:40:00Z`, 'staff', 'career', '/my/role-2030', [
    ['How will my role change by 2030?', 'Reactor Operator (RO) in 2030 (Mastery Builder) is driven by AI assistance, Digital I&C, Digital twin, SMR and advanced-reactor design. The 2030 profile adds or raises 2 requirements. At your current levels you meet 90% of it: about 4 months of development at two months per level. Planning assumption, no deployment decision implied.', 'future.role_2030.personal',
      [{ label: 'My role in 2030', url: '/my/role-2030' }, tx('reactor-operator', 'Reactor Operator (RO)'), { label: 'Reactor Operator (RO)', url: '/careers/roles/reactor-operator' }]],
    ['Which pathway closes my gap?', 'These 3 pathways close your 2030 gaps first, ranked the same way as your Learning Coach. Indicative only: a planning view, never a decision about you.\nAdvanced fuel-cycle awareness: foundations\nFusion awareness: foundations\nMicroreactor and transportable unit concepts: foundations', 'future.pathway_gap.personal',
      [{ label: 'Advanced fuel-cycle awareness: foundations', url: '/learn/pathways/pw-adv-fuelcycle-l1' }, { label: 'Fusion awareness: foundations', url: '/learn/pathways/pw-adv-fusion-l1' }, { label: 'Microreactor and transportable unit concepts: foundations', url: '/learn/pathways/pw-adv-micro-l1' }, { label: 'My pathways', url: '/my/pathways' }, { label: 'Learning Coach', url: '/my/coach' }]],
  ]);
  S('as-future-2', 'w-lo-02', `${AT}T08:15:00Z`, 'staff', 'career', '/my/ai-fluency', [
    ['Which AI rung do I need?', 'Operations roles aim for Practitioner on the AI fluency ladder, plus Assurer · Ethics and assurance. Your evidence puts you at Practitioner. Still to evidence for the target: 1. Only evidenced skills count: self-ratings never move anyone up the ladder.', 'future.ai_rung.personal',
      [{ label: 'My AI fluency', url: '/my/ai-fluency' }, { label: 'AI fluency ladder', url: '/learn/ai-fluency' }]],
  ]);
  S('as-future-3', 'w-ro-05', `${AT}T10:05:00Z`, 'staff', 'career', '/skills/sk-fs-ai-twin', [
    ['What is the ESCO equivalent of digital twin validation?', 'Digital twin validation (FS-AI-08): Compares twin predictions with plant behaviour, records where the model is valid and flags when it drifts out of its range. Part of Digital tools and data literacy (DA-01). Published crosswalk rows by framework (1):\nESCO: a432ffcd "run simulations" (partial match, indicative)', 'future.skill_crosswalk.public',
      [{ label: 'Digital twin validation · skill page', url: '/skills/sk-fs-ai-twin' }, { label: 'International frameworks', url: '/skills/frameworks' }]],
    ['What do I need to become a digital twin engineer?', 'Digital twin engineer (concept) is a concept role. Against its 2030 profile you meet 13% (within about 24 months); 4 requirements are still above your levels. A concept role is a planning assumption: no vacancy, no deployment decision implied. This is indicative guidance from your records, not an eligibility decision: ENEC and FANR decide.', 'career.concept_gap',
      [{ label: 'Digital twin engineer (concept) (concept role)', url: '/careers/roles/fr-digital-twin' }, { label: 'My career roadmap', url: '/my/career/roadmap?role=fr-digital-twin' }, { label: 'My Skills Passport (evidence)', url: '/my/skills' }]],
  ]);
  S('as-future-4', null, `${AT}T12:30:00Z`, 'public', null, '/careers/roles/senior-reactor-operator', [
    ['How will the senior reactor operator role change by 2030?', 'Senior Reactor Operator (SRO), incl. unit supervisor: Tools take on more routine work; people keep command and control of the unit, crew direction and every safety decision. Planning assumption, no deployment decision implied.', 'future.role_2030.public',
      [tx('senior-reactor-operator', 'Senior Reactor Operator (SRO), incl. unit supervisor'), { label: 'Senior Reactor Operator (SRO), incl. unit supervisor', url: '/careers/roles/senior-reactor-operator' }]],
  ], 'anon-seed-fs76');

  const E = FS76_EVAL;
  const sum = (k) => E.public[k] + E.career[k] + E.future[k];
  const cite = (x) => Math.round((1000 * x.cited_correct) / Math.max(1, x.in_scope_total)) / 10;
  T.eval_runs.push({
    id: 'eval-2026-10-fs76', run_at: `${AT}T09:00:00Z`, release: 'r1.1', lang: 'both',
    in_scope_total: sum('in_scope_total'), cited_correct: sum('cited_correct'), refusal_total: sum('refusal_total'), refusal_correct: sum('refusal_correct'),
    security_total: sum('security_total'), security_correct: sum('security_correct'), pass: true,
    notes: `Release gate passed · career mode ${cite(E.career)}% cited · future skills mode ${cite(E.future)}% cited, security ${E.future.security_correct}/${E.future.security_total}, public answers clean ${E.future.public_clean}/${E.future.public_total}`,
    details: [], engine: 'retrieval-v1+career-v1+future-v1', run_by: 'p-ai-governance',
  });
  void ctx;
}
