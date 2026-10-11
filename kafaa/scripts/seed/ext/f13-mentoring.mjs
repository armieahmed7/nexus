// F13 (wave 2 · E3) seed: Mentoring 2.0. Synthetic people only (w-* workers and role cards), no real names.
//  - every mentor offer gets mentoring types and offered skills; 20 new opt-in mentors (role cards and w-* workers), six of them
//    subject-matter experts nominated by their own line manager, four KHNP-paired (Handover 2030 knowledge transfer)
//  - curated demo stories for the NEXUS role cards (live backend) and the Kafa'a-only personas (local backend):
//      qc-inspector  mentee in an active knowledge-transfer agreement with the SME sq-lead (an open claim the SME can validate)
//      sro           mentor: a request waiting, an agreement proposed to them, an active leadership pairing; also a past mentee
//      outage-planner a matched request with no agreement yet (propose one); their line manager is never suggested
//      k-ro          mentee in an active knowledge-transfer agreement with an SME engineer; k-instructor mentors w-lo-03
//  - a deterministic population of about 80 agreements in every state, with sessions, private notes and close-outs, so the
//    training manager's programme dashboard has cells at or above 10 pairs and others that are suppressed
// Matching rules hold in the data: nobody is paired with their own line manager (src/modules/m04/mentoring.ts, F08 rule),
// and open pairings never exceed a mentor's capacity. Ids are stable: mt-*, mr-f13-*, ma-<request>, ms-<agreement>-<n>.
import { lineManagerOf, addDaysIso, attainmentPct, sessionPlan, privateNoteId, agreementIdFor } from '../../../src/modules/m04/mentoring.ts';

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

// existing G2 mentor offers: [id, types, skills, khnp]
const EXISTING = {
  'mt-1': [['career', 'knowledge_transfer', 'peer_onboarding'], ['sk-co-01', 'sk-co-02', 'sk-co-03', 'sk-pf-02', 'sk-ld-01'], false],
  'mt-2': [['leadership', 'career'], ['sk-ld-01', 'sk-ld-02', 'sk-co-02', 'sk-hu-02'], true],
  'mt-3': [['knowledge_transfer', 'reverse', 'career'], ['sk-da-01-twins', 'sk-en-02', 'sk-en-01', 'sk-da-01-analysis'], false],
  'mt-4': [['knowledge_transfer', 'peer_onboarding'], ['sk-rp-02', 'sk-rp-01', 'sk-rp-02-survey'], false],
  'mt-5': [['career', 'leadership'], ['sk-ld-01', 'sk-sc-01', 'sk-da-01'], false],
};
// new offers: [id, person, role, types, skills, capacity, khnp, interests, bio_en, bio_ar]
const NEW = [
  ['mt-6', 'p-sro', 'shift-supervisor', ['leadership', 'career', 'knowledge_transfer'], ['sk-co-03', 'sk-ld-02', 'sk-co-02', 'sk-ns-02', 'sk-hu-02'], 3, true, ['leadership', 'operations'],
    'Shift supervisor and licensed SRO. Happy to talk about the step from RO to SRO, crew leadership and conservative decision-making.', 'مشرف وردية ومشغّل أول مرخّص. يسعدني الحديث عن الانتقال من مشغّل مفاعل إلى مشغّل أول، وقيادة الطاقم، واتخاذ القرار المتحفظ.'],
  ['mt-7', 'p-head-sq', 'quality-assurance-qc', ['leadership', 'career'], ['sk-qa-01', 'sk-qa-02', 'sk-ld-01', 'sk-sc-02'], 2, false, ['leadership', 'quality'],
    'Head of supply quality. Mentors emerging leaders on quality culture and leading inspection teams.', 'رئيس جودة الإمداد. يوجّه القادة الناشئين في ثقافة الجودة وقيادة فرق التفتيش.'],
  ['mt-8', 'p-sq-lead', 'quality-assurance-qc', ['knowledge_transfer', 'peer_onboarding'], ['sk-qa-02-cgd', 'sk-qa-02', 'sk-qa-01', 'sk-qa-01-inspect'], 3, false, ['quality', 'cgd'],
    'Supply quality lead. Passes on commercial-grade dedication know-how built up over many supplier audits.', 'قائد جودة الإمداد. ينقل خبرة الاعتماد للمواد التجارية التي تراكمت عبر كثير من تدقيقات الموردين.'],
  ['mt-9', 'p-rp-lead', 'radiation-protection-technician', ['knowledge_transfer', 'leadership'], ['sk-rp-01', 'sk-rp-02', 'sk-rp-01-dose'], 2, false, ['rp', 'alara'],
    'Radiation protection lead. Mentors technicians on ALARA planning and dose assessment.', 'قائد الوقاية من الإشعاع. يوجّه الفنيين في تخطيط ALARA وتقييم الجرعات.'],
  ['mt-10', 'p-chem-sup', 'chemistry-technician', ['knowledge_transfer'], ['sk-ch-01', 'sk-ch-02', 'sk-ch-01-primary'], 2, false, ['chemistry'],
    'Chemistry supervisor. Shares practical water-chemistry control and radiochemistry experience.', 'مشرف الكيمياء. يشارك خبرة عملية في التحكم بكيمياء المياه والكيمياء الإشعاعية.'],
  ['mt-11', 'p-ep-manager', 'emergency-preparedness-coordinator', ['career', 'peer_onboarding'], ['sk-ep-01', 'sk-ep-02'], 2, false, ['emergency preparedness'],
    'Emergency preparedness manager. Helps new joiners find their place in the emergency response organisation.', 'مدير الاستعداد للطوارئ. يساعد المنضمين الجدد على معرفة دورهم في منظمة الاستجابة للطوارئ.'],
  ['mt-12', 'p-outage-manager', 'outage-manager-planner', ['knowledge_transfer', 'career'], ['sk-mp-01', 'sk-mp-01-outage', 'sk-hu-02'], 3, true, ['outage'],
    'Outage manager working alongside KHNP colleagues. Mentors planners on refuelling outage sequencing.', 'مدير انقطاعات يعمل مع زملاء من KHNP. يوجّه المخططين في تسلسل انقطاعات إعادة التزوّد بالوقود.'],
  ['mt-13', 'p-sme-reviewer', 'systems-design-plant-engineer', ['knowledge_transfer', 'reverse'], ['sk-en-01', 'sk-en-01-mods', 'sk-ns-01-psa', 'sk-da-02-review'], 2, false, ['engineering', 'digital'],
    'Design reviewer. Mentors on configuration management, probabilistic safety insights and governed AI review.', 'مراجع تصميم. يوجّه في إدارة التهيئة ورؤى السلامة الاحتمالية والمراجعة المحكومة لمخرجات الذكاء الاصطناعي.'],
  ['mt-14', 'p-fuel-pm', 'nuclear-fuel-specialist', ['knowledge_transfer'], ['sk-pf-03-fuel', 'sk-pf-01-advfuel', 'sk-pf-01'], 2, false, ['fuel'],
    'Fuel project manager. Shares fuel handling and advanced fuel know-how.', 'مدير مشاريع الوقود. يشارك خبرة مناولة الوقود وأنواع الوقود المتقدمة.'],
  ['mt-15', 'p-ai-governance', null, ['reverse'], ['sk-da-02', 'sk-da-02-review', 'sk-da-01-analysis'], 4, false, ['digital', 'ai'],
    'AI governance lead. Reverse mentoring for leaders on the governed use of AI and data.', 'قائد حوكمة الذكاء الاصطناعي. إرشاد عكسي للقادة في الاستخدام المحكوم للذكاء الاصطناعي والبيانات.'],
  ['mt-16', 'w-eng-05', 'reactor-engineer-core-physicist', ['knowledge_transfer', 'career'], ['sk-pf-01', 'sk-pf-01-core', 'sk-co-03', 'sk-pf-02'], 3, false, ['reactor physics'],
    'Reactor engineer. Mentors operators on reactor theory and reactivity management.', 'مهندس مفاعل. يوجّه المشغّلين في نظرية المفاعل وإدارة التفاعلية.'],
  ['mt-17', 'w-instr-01', 'nuclear-training-instructor', ['peer_onboarding', 'career'], ['sk-hu-01', 'sk-co-01', 'sk-ld-01-instruct'], 3, false, ['onboarding'],
    'Instructor who buddies new joiners through their first months on site.', 'مدرب يرافق المنضمين الجدد خلال أشهرهم الأولى في الموقع.'],
  ['mt-18', 'w-instr-02', 'nuclear-training-instructor', ['peer_onboarding'], ['sk-pf-03', 'sk-hu-01', 'sk-ns-01'], 3, false, ['onboarding'],
    'Instructor. Peer onboarding for engineers and technicians new to the APR-1400.', 'مدرب. تأهيل الأقران للمهندسين والفنيين الجدد على APR-1400.'],
  ['mt-19', 'w-sro-01', 'senior-reactor-operator', ['career', 'knowledge_transfer'], ['sk-co-03', 'sk-ns-02', 'sk-co-01', 'sk-co-01-eop'], 3, true, ['operations', 'sro career'],
    'SRO paired with a KHNP shift colleague. Mentors ROs on technical specifications and reactivity management.', 'مشغّل أول يعمل مع زميل وردية من KHNP. يوجّه مشغّلي المفاعل في المواصفات الفنية وإدارة التفاعلية.'],
  ['mt-20', 'w-sro-02', 'senior-reactor-operator', ['peer_onboarding', 'career'], ['sk-co-02', 'sk-hu-01', 'sk-pf-03'], 2, false, ['operations'],
    'SRO. Helps local operators settle into shift life.', 'مشغّل أول. يساعد المشغّلين المحليين على التأقلم مع العمل بنظام الورديات.'],
  ['mt-21', 'w-mnt-01', 'maintenance-technician-engineer', ['knowledge_transfer', 'peer_onboarding'], ['sk-mp-01', 'sk-mp-01-mech', 'sk-mp-02'], 3, false, ['maintenance'],
    'Senior maintenance technician. Shares calibration and testing practice.', 'فني صيانة أول. يشارك ممارسات المعايرة والاختبار.'],
  ['mt-22', 'w-chem-01', 'chemistry-technician', ['peer_onboarding'], ['sk-ch-01', 'sk-ch-02'], 2, false, ['chemistry'],
    'Chemistry technician. Peer onboarding in the chemistry laboratory.', 'فني كيمياء. تأهيل الأقران في مختبر الكيمياء.'],
  ['mt-23', 'w-qa-01', 'quality-assurance-qc', ['reverse', 'peer_onboarding'], ['sk-da-01', 'sk-da-01-analysis', 'sk-qa-01'], 3, false, ['digital', 'quality'],
    'QA engineer. Reverse mentoring on data analysis and digital quality records.', 'مهندس ضمان جودة. إرشاد عكسي في تحليل البيانات وسجلات الجودة الرقمية.'],
  ['mt-24', 'w-ep-01', 'emergency-preparedness-coordinator', ['career'], ['sk-ep-01', 'sk-ep-02', 'sk-sc-01'], 2, false, ['emergency preparedness'],
    'Emergency preparedness coordinator. Career conversations about the EP path.', 'منسّق الاستعداد للطوارئ. محادثات مهنية عن مسار الاستعداد للطوارئ.'],
  ['mt-25', 'w-lo-01', 'local-operator', ['reverse'], ['sk-da-01-scripting', 'sk-da-01', 'sk-da-01-analysis'], 2, false, ['digital'],
    'Local operator and keen scripter. Reverse mentoring on everyday data tools.', 'مشغّل محلي ومهتم بالبرمجة النصية. إرشاد عكسي في أدوات البيانات اليومية.'],
];
// SME nominations by the mentor's own line manager (computed): [mentor, sme skills]
const SME = [['mt-1', ['sk-co-03', 'sk-pf-02']], ['mt-3', ['sk-en-02']], ['mt-4', ['sk-rp-02']], ['mt-8', ['sk-qa-02-cgd', 'sk-qa-02']], ['mt-13', ['sk-en-01', 'sk-ns-01-psa']], ['mt-16', ['sk-pf-01', 'sk-co-03']], ['mt-21', ['sk-mp-02']]];

const TOPICS = [
  ['Walked through a recent procedure revision and why it changed', 'Reviewed an operating-experience lesson together', 'Prepared for an upcoming simulator session', 'Discussed a work package from last week', 'Talked through a difficult shift turnover'],
  ['Mapped next steps on the development plan', 'Practised a pre-job brief', 'Shadowed a planning meeting', 'Discussed how decisions are escalated', 'Reviewed a system health report'],
];
const SHARED = ['Agreed to read the referenced OE lesson before next time.', 'Next session: bring two examples from the field.', 'Good progress on the first goal.', '', ''];
const PRIVATE = ['Remember to ask about the qualification route.', 'Felt more confident explaining this today.', 'Follow up on the escalation example.'];

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  T.mentoring_agreements ??= [];
  T.mentoring_sessions ??= [];
  T.mentoring_private_notes ??= [];
  T.notifications ??= [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const lm = (id) => lineManagerOf(id, T.people, T.role_assignments, today);
  const ts = (d, h = 9) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

  // ── mentor offers
  for (const m of T.mentors) {
    const e = EXISTING[m.id];
    Object.assign(m, { types: e?.[0] ?? ['career'], skill_ids: e?.[1] ?? [], khnp_paired: e?.[2] ?? false, sme: false, sme_skill_ids: [], sme_nominated_by: null, sme_nominated_on: null });
  }
  for (const [id, person, role, types, sk, cap, khnp, interests, bio_en, bio_ar] of NEW) {
    if (!people.has(person) || T.mentors.some((m) => m.id === id)) continue;
    T.mentors.push({ id, person_id: person, role_id: role, interests, capacity: cap, opt_in: true, bio_en, bio_ar, types, skill_ids: sk, khnp_paired: khnp, sme: false, sme_skill_ids: [], sme_nominated_by: null, sme_nominated_on: null });
  }
  const mentor = new Map(T.mentors.map((m) => [m.id, m]));
  for (const [id, sk] of SME) {
    const m = mentor.get(id);
    const by = m && lm(m.person_id);
    if (!m || !by) continue;
    Object.assign(m, { sme: true, sme_skill_ids: [...sk].sort(), sme_nominated_by: by, sme_nominated_on: addDaysIso(today, -40) });
  }
  for (const m of T.mentors) for (const s of [...m.skill_ids, ...m.sme_skill_ids]) if (!skills.has(s) || skills.get(s).area === 'security') throw new Error(`f13: bad mentor skill ${s}`);

  // existing G2 requests get a type
  for (const r of T.mentoring_requests) {
    r.mentoring_type ??= r.id === 'mr-2' ? 'peer_onboarding' : 'career';
    r.skill_ids ??= r.id === 'mr-1' ? ['sk-co-03', 'sk-ld-01'] : [];
  }

  const load = (mid) => T.mentoring_requests.filter((r) => r.mentor_id === mid && r.status === 'matched').length;
  const ok = (mentee, m) => people.has(mentee) && mentee !== m.person_id && lm(mentee) !== m.person_id;
  let seq = 0;
  const request = (mentee, mid, type, status, created, skillIds = [], message = '', checkCap = true) => {
    const m = mentor.get(mid);
    if (!m || !ok(mentee, m)) throw new Error(`f13: invalid pair ${mentee} -> ${mid}`);
    if (checkCap && status === 'matched' && load(mid) >= m.capacity) throw new Error(`f13: ${mid} over capacity`);
    const id = `mr-f13-${String(++seq).padStart(3, '0')}`;
    T.mentoring_requests.push({ id, person_id: mentee, mentor_id: mid, mentor_person_id: m.person_id, interest: type, message, status, created_at: ts(created),
      responded_at: status === 'requested' ? null : ts(addDaysIso(created, 2)), mentoring_type: type, skill_ids: skillIds });
    return T.mentoring_requests[T.mentoring_requests.length - 1];
  };
  const goalsOf = (m, n, rand, lvl = 3, texts = []) => {
    const pool = [...m.skill_ids];
    const out = [];
    while (out.length < n && pool.length) {
      const s = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      out.push({ skill_id: s, target_level: lvl, text: texts[out.length] ?? '' });
    }
    return out;
  };
  const rate = (goals, rand, bias = 0) => goals.map((g) => ({ skill_id: g.skill_id, rating: Math.max(1, Math.min(4, Math.round(2.6 + bias + rand() * 1.6 - 0.4))) }));
  // agreement + sessions: status proposed | active | closing | closed | declined
  const agree = (req, { status, starts, ends, cadence = 'fortnightly', goals, proposer, sessions = null, closeBy = [], rand, priv = [] }) => {
    const id = agreementIdFor(req.id);
    const a = {
      id, request_id: req.id, mentor_id: req.mentor_id, person_id: req.person_id, mentor_person_id: req.mentor_person_id, mentoring_type: req.mentoring_type, goals, cadence,
      starts_on: starts, ends_on: ends, status, proposed_by: proposer ?? req.person_id, proposed_at: ts(addDaysIso(starts, -5)), responded_at: status === 'proposed' ? null : ts(addDaysIso(starts, -3)),
      decline_note: status === 'declined' ? 'Could we start after the outage?' : null, mentee_ratings: null, mentor_ratings: null, mentee_note: null, mentor_note: null,
      mentee_closed_at: null, mentor_closed_at: null, closed_at: null, attainment_pct: null, validated_skill_ids: [], validated_claim_ids: [], updated_at: ts(today),
    };
    if (['active', 'closing', 'closed'].includes(status)) {
      const until = status === 'closed' ? ends : today;
      const plan = sessionPlan(cadence, starts, ends, until);
      const n = sessions ?? Math.max(1, plan.due - Math.floor(rand() * 2));
      const step = Math.max(1, Math.floor((Math.min(new Date(`${until}T00:00:00Z`).getTime(), new Date(`${ends}T00:00:00Z`).getTime()) - new Date(`${starts}T00:00:00Z`).getTime()) / 86_400_000 / Math.max(1, n)));
      for (let k = 0; k < n; k++) {
        const held = addDaysIso(starts, Math.min(k * step + 1, Math.max(0, Math.floor((new Date(`${until}T00:00:00Z`) - new Date(`${starts}T00:00:00Z`)) / 86_400_000))));
        const sid = `ms-${id}-${k + 1}`;
        const touched = goals.filter((_, gi) => (k + gi) % 2 === 0).map((g) => g.skill_id);
        const by = k % 2 ? a.mentor_person_id : a.person_id;
        T.mentoring_sessions.push({ id: sid, agreement_id: id, person_id: a.person_id, mentor_person_id: a.mentor_person_id, held_on: held, minutes: [45, 60, 60, 90][k % 4],
          skill_ids: (touched.length ? touched : [goals[0].skill_id]).sort(), topics: TOPICS[k % 2][Math.floor(rand() * 5)], note_shared: SHARED[Math.floor(rand() * SHARED.length)], logged_by: by, logged_at: ts(held, 15) });
        if (priv.includes(k) || rand() < 0.15) T.mentoring_private_notes.push({ id: privateNoteId(sid, by), session_id: sid, agreement_id: id, author_person_id: by, note: PRIVATE[Math.floor(rand() * PRIVATE.length)], updated_at: ts(held, 16) });
      }
    }
    if (status === 'closing' || status === 'closed') {
      const sides = status === 'closed' ? ['mentee', 'mentor'] : closeBy;
      for (const side of sides) {
        a[`${side}_ratings`] = rate(goals, rand, side === 'mentor' ? 0.1 : 0);
        a[`${side}_closed_at`] = ts(status === 'closed' ? addDaysIso(ends, side === 'mentee' ? 1 : 3) : addDaysIso(today, -2));
        a[`${side}_note`] = side === 'mentee' ? 'Thank you: the goals were clear and the sessions practical.' : 'Steady progress; keep practising the second goal on shift.';
      }
      if (status === 'closed') {
        a.closed_at = a.mentor_closed_at;
        a.attainment_pct = attainmentPct(a.mentee_ratings, a.mentor_ratings);
        req.status = 'closed';
      }
    }
    if (status === 'declined' || status === 'proposed') req.status = 'matched';
    T.mentoring_agreements.push(a);
    return a;
  };

  // ── curated stories
  const R = rng('f13-curated');
  // qc-inspector: knowledge transfer with the SME supply quality lead (sq-lead); an open claim the SME can validate at close-out
  const qcReq = request('p-qc-inspector', 'mt-8', 'knowledge_transfer', 'matched', '2026-07-20', ['sk-qa-02-cgd', 'sk-qa-02'], 'I would like to learn how dedication packages are judged before supplier audits.');
  agree(qcReq, { status: 'active', starts: '2026-08-03', ends: '2027-01-29', cadence: 'fortnightly', proposer: 'p-sq-lead', sessions: 4, rand: R, priv: [1, 2],
    goals: [{ skill_id: 'sk-qa-02-cgd', target_level: 3, text: 'Evaluate a dedication package end to end with the critical characteristics justified' }, { skill_id: 'sk-qa-02', target_level: 3, text: 'Explain CFSI warning signs to a supplier' }] });
  T.skill_claims ??= [];
  T.skill_evidence ??= [];
  if (!T.skill_claims.some((c) => c.id === 'scl-f13-qc-1')) {
    T.skill_claims.push({ id: 'scl-f13-qc-1', person_id: 'p-qc-inspector', skill_id: 'sk-qa-02-cgd', level: 3, note: 'Prepared two commercial-grade dedication evaluations with my mentor reviewing each step.', evidence_url: null, status: 'claimed', created_at: ts('2026-09-28'), decided_by: null, decided_at: null, decision_note: null });
    T.skill_evidence.push({ id: 'se:rating:scl-f13-qc-1:sk-qa-02-cgd', person_id: 'p-qc-inspector', skill_id: 'sk-qa-02-cgd', kind: 'rating', ref_table: 'skill_claims', ref_id: 'scl-f13-qc-1', level: 3, basis: 'claimed', status: 'current', observed_on: '2026-09-28', note: 'Prepared two commercial-grade dedication evaluations with my mentor reviewing each step.', recorded_by: 'p-qc-inspector', active: true, created_at: ts('2026-09-28') });
  }
  // qc-inspector also asked the systems engineer for career mentoring (waiting)
  request('p-qc-inspector', 'mt-3', 'career', 'requested', addDaysIso(today, -3), ['sk-en-02'], 'Interested in a move towards system engineering.');
  // sro as a mentor: a request waiting, a proposal to accept, an active leadership pairing (never their own crew B)
  request('w-lo-08', 'mt-6', 'career', 'requested', addDaysIso(today, -1), ['sk-co-03', 'sk-ns-02'], 'I am preparing for the RO route and would value your view.');
  const sroProp = request('w-ro-05', 'mt-6', 'knowledge_transfer', 'matched', addDaysIso(today, -12), ['sk-co-03']);
  agree(sroProp, { status: 'proposed', starts: addDaysIso(today, 7), ends: addDaysIso(today, 7 + 120), cadence: 'fortnightly', proposer: 'w-ro-05', rand: R,
    goals: [{ skill_id: 'sk-co-03', target_level: 3, text: 'Lead a reactivity manoeuvre brief in the simulator' }, { skill_id: 'sk-ns-02', target_level: 3, text: 'Apply LCO entry conditions without prompting' }] });
  const sroLead = request('w-sro-03', 'mt-6', 'leadership', 'matched', '2026-06-10', ['sk-ld-02']);
  agree(sroLead, { status: 'active', starts: '2026-06-22', ends: '2026-12-18', cadence: 'monthly', proposer: 'p-sro', sessions: 4, rand: R, goals: goalsOf(mentor.get('mt-6'), 2, R, 3, ['Run the crew brief for a planned evolution']) });
  // sro as a past mentee (closed, with ratings)
  const sroMentee = request('p-sro', 'mt-2', 'leadership', 'matched', '2025-11-02', ['sk-ld-01']);
  agree(sroMentee, { status: 'closed', starts: '2025-11-16', ends: '2026-05-15', cadence: 'monthly', proposer: 'w-ss-01', rand: R, goals: [{ skill_id: 'sk-ld-01', target_level: 3, text: 'Give structured feedback after every shift' }, { skill_id: 'sk-ld-02', target_level: 3, text: '' }] });
  // outage-planner: matched with an SRO (no agreement yet). Their line manager (outage manager) is never suggested.
  request('p-outage-planner', 'mt-19', 'career', 'matched', addDaysIso(today, -6), ['sk-ns-02'], 'Looking to understand how operations reads technical specifications during outages.');
  // nse: peer onboarding, closing (mentee already rated)
  const nseReq = request('p-nse', 'mt-18', 'peer_onboarding', 'matched', '2026-04-01');
  agree(nseReq, { status: 'closing', starts: '2026-04-13', ends: '2026-10-02', cadence: 'fortnightly', proposer: 'w-instr-02', rand: R, closeBy: ['mentee'], goals: goalsOf(mentor.get('mt-18'), 2, R, 2) });
  // buyer: reverse mentoring on data tools
  const buyerReq = request('p-buyer', 'mt-23', 'reverse', 'matched', '2026-08-20', ['sk-da-01-analysis']);
  agree(buyerReq, { status: 'active', starts: '2026-09-01', ends: '2026-12-31', cadence: 'weekly', proposer: 'p-buyer', rand: R, goals: [{ skill_id: 'sk-da-01-analysis', target_level: 2, text: 'Build a supplier lead-time trend on my own' }] });
  // k-ro (local): knowledge transfer with the SME reactor engineer
  const kroReq = request('p-k-ro', 'mt-16', 'knowledge_transfer', 'matched', '2026-07-01', ['sk-pf-01', 'sk-co-03']);
  agree(kroReq, { status: 'active', starts: '2026-07-13', ends: '2027-01-08', cadence: 'fortnightly', proposer: 'w-eng-05', sessions: 5, rand: R, priv: [0, 3],
    goals: [{ skill_id: 'sk-pf-01', target_level: 3, text: 'Explain xenon transients after a power change' }, { skill_id: 'sk-co-03', target_level: 3, text: 'Prepare reactivity plans for a start-up' }] });
  // k-instructor (local) mentors w-lo-03 (existing G2 match mr-2)
  const mr2 = T.mentoring_requests.find((r) => r.id === 'mr-2');
  if (mr2) agree(mr2, { status: 'active', starts: '2026-09-14', ends: '2027-03-12', cadence: 'fortnightly', proposer: 'p-k-instructor', rand: R, goals: [{ skill_id: 'sk-co-01', target_level: 3, text: 'Use place-keeping on every field procedure' }, { skill_id: 'sk-co-02', target_level: 2, text: '' }] });

  // ── synthetic population: closed history, active pairs, a few overdue, proposals and declines
  const P = rng('f13-population');
  const mentees = T.people.filter((p) => p.kind === 'staff' && p.status !== 'leaver' && !['security', 'cyber'].includes(p.job_family_id) && p.id.startsWith('w-')).map((p) => p.id).sort();
  // per type: [closed, active, overdue, closing, declined]
  const PLAN = { career: [9, 6, 1, 1, 1], knowledge_transfer: [11, 6, 2, 1, 0], leadership: [3, 2, 0, 0, 0], reverse: [2, 1, 0, 0, 0], peer_onboarding: [8, 4, 1, 1, 1] };
  const byType = (t) => [...mentor.values()].filter((m) => m.opt_in && m.types.includes(t)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const used = new Set(T.mentoring_agreements.map((a) => `${a.person_id}|${a.mentor_id}`));
  // demo mentors keep free places (the G2 test accepts mr-1 for mt-1; demo personas request mt-6/mt-8/mt-13/mt-16 live)
  const KEEP_FREE = new Set(['mt-1', 'mt-6', 'mt-8', 'mt-13', 'mt-16']);
  for (const [type, counts] of Object.entries(PLAN)) {
    const ms = byType(type);
    const states = [...Array(counts[0]).fill('closed'), ...Array(counts[1]).fill('active'), ...Array(counts[2]).fill('overdue'), ...Array(counts[3]).fill('closing'), ...Array(counts[4]).fill('declined')];
    states.forEach((st, k) => {
      for (let tries = 0; tries < 200; tries++) {
        const m = ms[(k + tries) % ms.length];
        const mentee = mentees[Math.floor(P() * mentees.length)];
        const key = `${mentee}|${m.id}`;
        const live = st !== 'closed';
        if (!ok(mentee, m) || used.has(key) || (live && (load(m.id) >= m.capacity || KEEP_FREE.has(m.id)))) continue;
        used.add(key);
        const len = [91, 120, 150, 182][Math.floor(P() * 4)];
        const startAgo = st === 'closed' ? 200 + Math.floor(P() * 160) : st === 'overdue' ? len + 10 + Math.floor(P() * 20) : st === 'closing' ? len - 5 : 20 + Math.floor(P() * Math.max(1, len - 40));
        const starts = addDaysIso(today, -startAgo);
        const ends = addDaysIso(starts, len);
        const req = request(mentee, m.id, type, 'matched', addDaysIso(starts, -14), [], '', live);
        const n = 1 + Math.floor(P() * Math.min(3, m.skill_ids.length));
        agree(req, { status: st === 'overdue' ? 'active' : st, starts: st === 'declined' ? addDaysIso(today, 10) : starts, ends: st === 'declined' ? addDaysIso(today, 130) : ends,
          cadence: ['weekly', 'fortnightly', 'fortnightly', 'monthly'][Math.floor(P() * 4)], proposer: P() < 0.5 ? m.person_id : mentee, rand: P, closeBy: [P() < 0.5 ? 'mentee' : 'mentor'],
          goals: goalsOf(m, n, P, 2 + Math.floor(P() * 2)) });
        break;
      }
    });
  }
  // a few pending requests from the population
  for (const [mentee, mid, type] of [['w-lo-04', 'mt-17', 'peer_onboarding'], ['w-mnt-05', 'mt-21', 'knowledge_transfer'], ['w-ro-07', 'mt-19', 'career'], ['w-chem-03', 'mt-10', 'knowledge_transfer']]) {
    const m = mentor.get(mid);
    if (m && ok(mentee, m) && !used.has(`${mentee}|${mid}`)) { used.add(`${mentee}|${mid}`); request(mentee, mid, type, 'requested', addDaysIso(today, -Math.floor(P() * 6) - 1), m.skill_ids.slice(0, 1)); }
  }

  // ── knowledge-transfer close-outs by SME mentors that validated a claim (history; feeds the programme's validation count)
  const smeClosed = T.mentoring_agreements.filter((a) => a.mentoring_type === 'knowledge_transfer' && a.status === 'closed' && mentor.get(a.mentor_id)?.sme).slice(0, 4);
  for (const a of smeClosed) {
    const m = mentor.get(a.mentor_id);
    const scope = m.sme_skill_ids.length ? m.sme_skill_ids : m.skill_ids;
    const std = new Set(T.qual_standards.map((s) => s.id));
    const g = a.goals.find((x) => scope.includes(x.skill_id) && !(skills.get(x.skill_id).evidence_keys ?? []).some((k) => std.has(k)));
    if (!g) continue;
    a.mentor_ratings = a.mentor_ratings.map((r) => (r.skill_id === g.skill_id ? { ...r, rating: Math.max(3, r.rating) } : r));
    a.attainment_pct = attainmentPct(a.mentee_ratings, a.mentor_ratings);
    const cid = `scl-f13-${a.id}`;
    const day = a.closed_at.slice(0, 10);
    T.skill_claims.push({ id: cid, person_id: a.person_id, skill_id: g.skill_id, level: Math.min(3, g.target_level), note: 'Claimed during knowledge-transfer mentoring.', evidence_url: null, status: 'validated',
      created_at: ts(addDaysIso(day, -20)), decided_by: a.mentor_person_id, decided_at: a.closed_at, decision_note: `Validated by the subject-matter expert mentor at the close-out of knowledge-transfer agreement ${a.id}` });
    T.skill_evidence.push({ id: `se:rating:${cid}:${g.skill_id}`, person_id: a.person_id, skill_id: g.skill_id, kind: 'rating', ref_table: 'skill_claims', ref_id: cid, level: Math.min(3, g.target_level), basis: 'validated',
      status: 'current', observed_on: addDaysIso(day, -20), note: 'Claimed during knowledge-transfer mentoring.', recorded_by: a.person_id, active: true, created_at: ts(addDaysIso(day, -20)) });
    a.validated_skill_ids = [g.skill_id];
    a.validated_claim_ids = [cid];
  }

  // ── notices for the demo personas
  const note = (id, person, en, ar, link, sev = 'info') => { if (people.has(person) && !T.notifications.some((n) => n.id === id)) T.notifications.push({ id, person_id: person, kind: 'mentoring', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity: sev, created_at: ts(addDaysIso(today, -1)), read_at: null }); };
  note('nt-f13-sro-req', 'p-sro', 'New mentoring request', 'طلب إرشاد جديد', '/my/mentoring');
  note('nt-f13-sro-prop', 'p-sro', 'Mentoring agreement proposed: please review', 'اقتراح اتفاقية إرشاد: يُرجى المراجعة', `/my/mentoring/${agreementIdFor(sroProp.id)}`);
  note('nt-f13-sq-sme', 'p-sq-lead', 'You are nominated as a subject-matter expert mentor', 'رُشّحت مرشداً خبيراً في الموضوع', '/my/mentoring', 'ok');
}
