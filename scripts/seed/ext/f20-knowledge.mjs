// F20 + F21 (wave 3 · E2, module M24) seed: the KLRA position register (synthetic HR feed: retirement and contract-end BANDS
// only, never a birth date or an age; KHNP OSSA cover positions; the F11 single-point-of-failure snapshot from the derived skill
// states), two quarters of assessments (2026-Q3 closed, 2026-Q4 current with a few positions still to assess), mitigation
// actions (some done, some open, some overdue, a few closed-quarter high rows without an action that read "overdue"), the
// thresholds row, and the knowledge capture studio: SME profiles, structured capture interviews (planned, held, transcribed,
// cancelled; transcripts are synthetic text), knowledge assets (published after a technical review and a security and content
// check by two different people, one in review with a technical pass, one waiting, a draft and a withdrawn asset), reviews
// and "used by" rows. Synthetic people only; every text passes the M22 posting blocker and the contact-details check.
import { postGuard, hasContactDetails } from '../../../src/modules/m22/domain.ts';
import { proposeFactors, departmentOf, EXCLUDED_FAMILIES, quarterOfIso } from '../../../src/modules/m24/klra.ts';
import { enrich } from '../../../src/modules/m24/enrich.ts';
import { assetText, wordCount } from '../../../src/modules/m24/capture.ts';

export const FINALIZE_LAST = true; // needs the derived person_skills (F11 single points of failure)

function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;
const COUNTED = ['verified', 'evidenced', 'validated'];
const REPLACE_MONTHS = {
  'shift-supervisor': 84, 'senior-reactor-operator': 72, 'reactor-operator': 48, 'local-operator': 24, 'shift-technical-advisor': 60, 'operations-support-work-control': 18,
  'outage-manager-planner': 30, 'maintenance-technician-engineer': 24, 'systems-design-plant-engineer': 36, 'reactor-engineer-core-physicist': 48, 'nuclear-fuel-specialist': 36,
  'radiation-protection-technician': 24, 'chemistry-technician': 18, 'emergency-preparedness-coordinator': 18, 'fire-protection': 12, 'nuclear-training-instructor': 36,
  'quality-assurance-qc': 12, 'nuclear-oversight-npi': 24, 'regulatory-affairs-licensing-engineer': 24, 'procurement-engineer': 9, 'corporate-professional': 6, 'ecp-officer': 9,
};

export default function build() {}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const Q = quarterOfIso(today); // 2026-Q4
  const QP = '2026-Q3';
  const people = new Map(T.people.map((p) => [p.id, p]));
  const P = (id) => { const p = people.get(id); if (!p) throw new Error(`f20: unknown person ${id}`); return p; };
  const nm = (id) => { const p = P(id); return { en: p.display_name, ar: p.display_name_ar || p.display_name }; };
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const secComps = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const isSecSkill = (id) => { const s = skills.get(id); return !s || s.area === 'security' || secComps.has(s.competency_id); };
  const stdByRole = new Map();
  for (const q of T.qual_standards) for (const r of q.role_ids ?? []) if (!q.security_restricted) stdByRole.set(r, [...(stdByRole.get(r) ?? []), q.id]);
  const oeByStd = new Map();
  for (const o of T.oe_lessons) for (const s of o.affected_standard_ids ?? []) oeByStd.set(s, (oeByStd.get(s) ?? 0) + 1);
  const checkText = (where, text) => {
    const c = postGuard(text, T.refusal_policies);
    if (c) throw new Error(`f20: ${where} trips the ${c} blocker`);
    if (hasContactDetails(text)) throw new Error(`f20: ${where} contains contact details`);
  };

  // ───────────── F11 single points of failure: in each team (or family when no team), skills held at key level by exactly one person
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
  const groupOf = (p) => (p.team_id ? `team:${p.team_id}` : p.job_family_id ? `family:${p.job_family_id}` : null);
  const groups = new Map();
  for (const p of staff) { const g = groupOf(p); if (g) groups.set(g, [...(groups.get(g) ?? []), p.id]); }
  const states = new Map();
  for (const s of T.person_skills) if (s.active && COUNTED.includes(s.basis)) states.set(`${s.person_id}|${s.skill_id}`, s.level);
  const spof = new Map();
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    for (const sk of T.skills) {
      if (isSecSkill(sk.id)) continue;
      const holders = members.filter((m) => (states.get(`${m}|${sk.id}`) ?? 0) >= sk.key_level);
      if (holders.length === 1) spof.set(holders[0], [...(spof.get(holders[0]) ?? []), sk.id]);
    }
  }

  // ───────────── KLRA position register (synthetic HR feed bands)
  const positions = [];
  const crit = (roleId, level) => {
    const r = roles.get(roleId);
    if (r?.critical) return 'critical';
    if (r?.regulated) return 'regulated';
    if (roleId && stdByRole.has(roleId)) return 'qualified';
    return level === 'leadership' ? 'regulated' : 'general';
  };
  const codifiedBase = (roleId, seed) => {
    const stds = stdByRole.get(roleId) ?? [];
    const oe = stds.reduce((a, s) => a + (oeByStd.get(s) ?? 0), 0);
    return Math.min(70, (stds.length ? 30 : 10) + Math.min(20, oe * 10) + (seed % 21));
  };
  for (const p of [...T.people].filter((x) => (x.kind === 'staff' && x.status === 'active') || (x.kind === 'contractor' && x.job_family_id)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!p.job_family_id || EXCLUDED_FAMILIES.includes(p.job_family_id)) continue;
    const hv = h32(`klra:${p.id}`);
    const r = hv % 100;
    const contractor = p.kind === 'contractor';
    const lvl = p.level ?? 'professional';
    const retirement_band = contractor ? 'na' : lvl === 'entry' ? '5_plus' : lvl === 'leadership' || lvl === 'senior' ? (r < 26 ? 'within_2' : r < 52 ? '2_5' : '5_plus') : r < 9 ? 'within_2' : r < 34 ? '2_5' : '5_plus';
    let contract_kind = 'permanent', contract_end_band = 'none';
    if (contractor) { contract_kind = 'fixed_term'; contract_end_band = (hv >> 8) % 3 === 0 ? 'within_1' : (hv >> 8) % 3 === 1 ? '1_2' : '2_5'; }
    else if (['corporate', 'supply-chain'].includes(p.job_family_id) && (hv >> 4) % 5 === 0) { contract_kind = 'fixed_term'; contract_end_band = (hv >> 9) % 2 ? 'within_1' : '1_2'; }
    else if (lvl !== 'entry' && (hv >> 6) % 17 === 0) { contract_kind = 'secondment'; contract_end_band = (hv >> 10) % 2 ? '1_2' : 'within_1'; }
    const role = roles.get(p.job_role_id);
    positions.push({
      id: `pos-${p.id}`, person_id: p.id, role_id: p.job_role_id ?? null, family_id: p.job_family_id, entity_id: p.entity_id ?? null, team_id: p.team_id ?? null, crew: p.crew ?? null,
      department: departmentOf(p.job_family_id), kind: contractor ? 'contractor' : 'staff',
      title_en: role ? `${role.title_en}${p.crew ? ` · Crew ${p.crew}` : ''}` : p.display_name.replace(/ \(role card\)$/, ''),
      title_ar: role ? `${role.title_ar}${p.crew ? ` · الطاقم ${p.crew}` : ''}` : (p.display_name_ar || p.display_name).replace(/ \(بطاقة دور\)$/, ''),
      holder_en: p.display_name, holder_ar: p.display_name_ar || p.display_name,
      retirement_band, contract_kind, contract_end_band, criticality: contractor ? (role?.critical ? 'qualified' : 'general') : crit(p.job_role_id, lvl),
      spof_skill_ids: (spof.get(p.id) ?? []).slice(0, 6), codified_base: contractor ? 20 + (hv % 25) : codifiedBase(p.job_role_id, hv),
      replace_months: REPLACE_MONTHS[p.job_role_id] ?? (lvl === 'leadership' ? 36 : lvl === 'senior' ? 18 : 9), feed_as_of: '2026-09-30', synthetic: true, active: true, open_read: false,
    });
  }
  // KHNP OSSA cover positions: experts supporting operations until the programme ends in 2030 (no person row; synthetic)
  const OSSA = [
    ['shift-supervisor', 'Shift operations advisor', 'مستشار عمليات الوردية', ['sk-co-01', 'sk-pf-03-rcs'], 5],
    ['shift-supervisor', 'Shift operations advisor', 'مستشار عمليات الوردية', ['sk-co-02'], 8],
    ['senior-reactor-operator', 'Control room operations advisor', 'مستشار عمليات غرفة التحكم', ['sk-pf-01-core', 'sk-co-01'], 6],
    ['senior-reactor-operator', 'Control room operations advisor', 'مستشار عمليات غرفة التحكم', ['sk-co-03'], 12],
    ['shift-technical-advisor', 'Shift technical advisor', 'المستشار الفني للوردية', ['sk-pf-02', 'sk-pf-01-core'], 4],
    ['shift-technical-advisor', 'Shift technical advisor', 'المستشار الفني للوردية', ['sk-pf-03'], 10],
    ['shift-technical-advisor', 'Shift technical advisor', 'المستشار الفني للوردية', ['sk-pf-02-advcool', 'sk-pf-01'], 9],
    ['outage-manager-planner', 'Outage scheduling advisor', 'مستشار جدولة الانقطاع', ['sk-mp-01-outage'], 15],
    ['outage-manager-planner', 'Outage execution advisor', 'مستشار تنفيذ الانقطاع', ['sk-mp-01-outage', 'sk-mp-01-mech'], 7],
    ['maintenance-technician-engineer', 'Rotating equipment specialist', 'أخصائي المعدات الدوّارة', ['sk-mp-01-mech', 'sk-mp-01-elec'], 8],
    ['maintenance-technician-engineer', 'Valve and actuator specialist', 'أخصائي الصمامات والمشغلات', ['sk-mp-01-mech'], 14],
    ['systems-design-plant-engineer', 'System engineering advisor', 'مستشار هندسة الأنظمة', ['sk-en-01', 'sk-en-02'], 6],
    ['systems-design-plant-engineer', 'Design basis advisor', 'مستشار أساس التصميم', ['sk-en-02'], 11],
    ['reactor-engineer-core-physicist', 'Core design and fuel management advisor', 'مستشار تصميم القلب وإدارة الوقود', ['sk-pf-01-core', 'sk-pf-01-advfuel'], 5],
    ['chemistry-technician', 'Primary chemistry advisor', 'مستشار كيمياء الدائرة الأولية', ['sk-ch-01'], 13],
    ['radiation-protection-technician', 'Radiological work planning advisor', 'مستشار تخطيط الأعمال الإشعاعية', ['sk-rp-01'], 12],
  ];
  OSSA.forEach(([roleId, en, ar, sk, cod], i) => {
    const role = roles.get(roleId);
    if (!role) throw new Error(`f20: unknown role ${roleId}`);
    const n = String(i + 1).padStart(2, '0');
    positions.push({
      id: `pos-ossa-${n}`, person_id: null, role_id: roleId, family_id: role.family_id, entity_id: 'enec-ops', team_id: null, crew: null, department: departmentOf(role.family_id), kind: 'ossa',
      title_en: `KHNP OSSA cover · ${en}`, title_ar: `تغطية OSSA من KHNP · ${ar}`, holder_en: `KHNP OSSA expert ${n} (synthetic)`, holder_ar: `خبير OSSA من KHNP رقم ${n} (اصطناعي)`,
      retirement_band: 'na', contract_kind: 'ossa', contract_end_band: '2_5', criticality: role.critical ? 'critical' : 'regulated',
      spof_skill_ids: sk.filter((s) => skills.has(s) && !isSecSkill(s)), codified_base: cod, replace_months: Math.max(48, REPLACE_MONTHS[roleId] ?? 48), feed_as_of: '2026-09-30', synthetic: true, active: true, open_read: false,
    });
  });
  for (const p of positions) checkText(`position ${p.id}`, `${p.title_en} ${p.title_ar}`);
  T.klra_positions = positions;

  // ───────────── F21 capture studio: SME profiles, sessions, assets, reviews, uses
  const SME = (person, kind, band, listed, sk, headline, availability = 'available') => {
    const p = P(person);
    return { id: `sme:${person}`, person_id: person, kind, skill_ids: sk.filter((s) => skills.has(s) && !isSecSkill(s)), availability, departing_band: band, listed, headline, person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null, updated_at: ts('2026-09-15') };
  };
  T.sme_profiles = [
    SME('p-sme-reviewer', 'staff', 'unspecified', true, ['sk-en-01', 'sk-en-02'], 'Design basis and configuration control: happy to explain why the margins are where they are'),
    SME('w-mnt-01', 'retiring', 'within_2', true, ['sk-mp-01-mech', 'sk-mp-01-elec'], 'Thirty years on redundant equipment; ask me about train separation and peer checks'),
    SME('w-sro-02', 'retiring', 'within_2', true, ['sk-co-01', 'sk-co-02'], 'Control room operations and alarm response'),
    SME('w-ss-01', 'retiring', 'within_2', true, ['sk-co-01', 'sk-co-03'], 'Shift supervision, turnover and procedure use under pressure', 'limited'),
    SME('w-rp-02', 'staff', '2_5', true, ['sk-rp-01'], 'Contamination control and tool release'),
    SME('w-mnt-02', 'rotating', '2_5', true, ['sk-mp-01-mech', 'sk-mp-01-outage'], 'Foreign material exclusion and outage work packages'),
    SME('w-qa-01', 'staff', '5_plus', true, ['sk-qa-01'], 'Receiving inspection and material certificates'),
    SME('w-chem-01', 'staff', '2_5', true, ['sk-ch-01'], 'Secondary chemistry trends and steam generator care'),
    SME('w-eng-05', 'staff', '5_plus', false, ['sk-pf-01-core', 'sk-pf-01']),
    SME('w-ss-02', 'retiring', 'within_2', true, ['sk-co-01', 'sk-co-03'], 'Shift turnover and crew coordination', 'limited'),
    SME('w-ep-01', 'staff', '5_plus', false, ['sk-ep-01']),
    SME('w-eng-01', 'retiring', 'within_2', false, ['sk-en-01']),
    SME('w-sro-01', 'staff', '2_5', false, ['sk-co-01']),
    SME('w-fire-01', 'staff', '5_plus', true, ['sk-ep-02-fire'], 'Fire brigade drills and hot work'),
    SME('w-rp-04', 'staff', 'within_2', false, ['sk-rp-01']),
    SME('w-corp-01', 'staff', 'unspecified', false, ['sk-ld-01']),
  ];
  for (const s of T.sme_profiles) { if (!s.skill_ids.length) throw new Error(`f20: SME ${s.id} has no valid skill`); checkText(`sme ${s.id}`, s.headline); }

  const TR = {
    trains: `We had two redundant trains of the component cooling pumps opened for work in the same week, and the work packages looked almost identical. The labels on the pump skids were faded on train B, so the only real defence was the second check. My rule of thumb: before you put a hand on redundant equipment, stop at the local panel, read the component number aloud, and have your partner read it from the work order, not from memory. The time it costs is less than a minute. The time it saves is a forced outage or worse. We also learned to stage the tools on the correct train the day before, so the physical setup itself points you to the right place. When a newcomer asks why we are slow, I tell them the peer check is the job, not a delay to the job. Look at the operating experience on the wrong-train event; it is the same story every time: a confident person, a familiar layout, and one missing check.`,
    alarms: `Standing alarms are the quiet problem in the control room. When an alarm stays lit for weeks, the crew stops seeing it, and then the real signal hides behind it. What I teach: every standing alarm has an owner, a work order and a date. At turnover we read the standing list out loud and ask what has changed since yesterday. If you cannot explain why an alarm is lit, treat it as new. The board is telling you something about the plant or about the instrument, and both matter. We also keep a short list of the alarms that tend to come in pairs, because when only one of the pair appears, that is usually an instrument problem rather than a process problem. The simulator is the place to practise this: we load a scenario with three nuisance alarms and one real one, and we watch who finds the real one first.`,
    pressure: `Time pressure is when steps get skipped. In the turbine building, the procedure is long and the evolution is familiar, which is exactly the trap. My practice is place-keeping on paper every time, even for the tenth repetition: circle the step, slash it when done. If somebody calls you away, you mark where you stopped and you restart from the last completed step with a peer, not from where you think you were. As a shift supervisor I would rather hold an evolution for ten minutes than recover from a missed step. The words I use with the crew are simple: if you feel rushed, say it, and we stop. Nobody has ever been criticised on my shift for stopping. The operating experience on skipped steps shows that the people involved were experienced and confident; that is why the habit matters more than the knowledge.`,
    tools: `Tools leaving the radiologically controlled area are the most common way contamination travels. The rule is simple: every tool is surveyed before release, and anything with crevices gets a second survey after wiping. Hollow handles, ratchets and cable reels are the usual hiding places. We keep a separate set of tools inside the controlled area for the jobs we repeat, so that less moves across the boundary at all. When a job is planned, I ask the planner which tools will come out at the end and plan the survey time into the schedule, because a rushed survey at the end of a shift is where mistakes happen. If a survey reading is borderline, bag it, tag it and ask; do not average it away. The lesson from industry is that the contaminated tool was always one that someone assumed had been checked.`,
    fme: `Foreign material exclusion is about the open system, not the size of the job. Every time a system is opened, the boundary gets a log, a cover and a person responsible for it. During an outage we have dozens of open systems at once, and the worst finds come from the small jobs that nobody thought needed a full plan. My habits: tether small tools, count items in and out, and do the close-out inspection with a light and a mirror, not a glance. When something is missing from the count, we stop and search before closing, even if it is a washer. Work packages should say clearly which boundary class applies, so the crew does not have to decide in the field. Outage lessons show that foreign material was found later in pumps and valves; the cost of looking for ten more minutes is always smaller.`,
    certs: `At receiving inspection the paperwork can look perfect and still be wrong. The certificate has to match the item in front of you: heat number, material grade, size and quantity. I check the stamping on the item first and only then read the certificate, so the paper does not lead my eye. Missing or mismatched heat numbers are the most common finding, and the supplier is usually cooperative once we show them exactly what does not match. Commercial grade items need the critical characteristics to be verified, not assumed. When in doubt, hold the item in the quarantine area and raise a nonconformance; never accept on a promise that the corrected certificate will follow. The supplier courses on counterfeit and suspect items are worth taking before your first year of inspections.`,
    chemistry: `Steam generator blowdown trends tell you about the health of the secondary side long before a limit is reached. I look at sodium, chloride and sulfate together, and I look at the shape of the trend rather than a single sample. A slow rise across several days usually points to condenser in-leakage, and the earlier you catch it, the smaller the clean-up. When a sample looks odd, take a confirmatory sample before you call the shift, but do not wait for the next routine sample. Keep the sample lines flushed for the full time, because a short flush gives you yesterday's chemistry. New technicians should learn the normal pattern of each unit; the units are not identical, and what is normal on one can be early warning on the other.`,
    physics: `Reading the startup curve is a skill you build over many startups. The inverse count rate plot tells you how close you are to criticality, and the shape of it tells you whether the estimate is trustworthy. I always compare the predicted critical position with what the curve is doing and ask why if they differ by more than the expected band. Reactivity monitoring is a team sport: the reactor engineer, the operator at the controls and the shift supervisor should be saying the same numbers aloud. If the numbers start to drift from the prediction, slow down and recalculate rather than push on. Core physics tests after refuelling are where newcomers learn the most, so put them beside an experienced engineer for at least two cycles.`,
    turnover: `تسليم الوردية هو اللحظة التي تنتقل فيها المعرفة من طاقم إلى طاقم، وأي معلومة لا تُقال في هذه اللحظة قد تضيع. قاعدتي أن يكون التسليم وجهاً لوجه أمام اللوحات، وأن نقرأ قائمة الإنذارات القائمة والأعمال المفتوحة بصوت مسموع. أطلب من المشغل القادم أن يعيد بكلماته ما فهمه عن حالة المحطة، فإذا لم يستطع شرح أمر ما، نتوقف ونوضحه قبل التوقيع. المعلومات المكتوبة مهمة، لكن السياق لا يُكتب دائماً: لماذا أجّلنا عملاً معيناً، ومن ينتظر ماذا. أنصح المشرفين الجدد بأن يخصصوا وقتاً كافياً للتسليم حتى في الأيام الهادئة، لأن العادة تُبنى في الأيام الهادئة وتُختبر في الأيام الصعبة.`,
    drill: `In an emergency drill the controller is looking for communication, not heroics. The first thing I watch is whether the crew repeats back the messages and whether the log keeps up with events. Good teams announce what they are about to do before they do it, so everyone can catch a mistake. I also watch how the team handles the second injected problem, because the first one is usually well rehearsed. After the drill, the critique should start with what the team saw, not with what the controller saw. This approach has been replaced by the updated drill guide, which now covers the same points with the new scenario set.`,
  };
  for (const [k, v] of Object.entries(TR)) checkText(`transcript ${k}`, v);

  const S = (id, sme, iv, template, title, status, planned, held, tr, skillIds, stds, extra = {}) => {
    const a = nm(sme), b = nm(iv);
    const history = [{ at: ts(planned < today ? addDays(planned, -14) : '2026-10-01'), status: 'planned', by: extra.created_by ?? iv, note: null }];
    if (held) history.push({ at: ts(held, '15:00'), status: 'held', by: iv, note: null });
    if (status === 'transcribed') history.push({ at: ts(addDays(held, 2), '10:00'), status: 'transcribed', by: iv, note: null });
    if (status === 'cancelled') history.push({ at: ts('2026-09-20'), status: 'cancelled', by: iv, note: null });
    return {
      id, sme_id: sme, interviewer_id: iv, created_by: extra.created_by ?? iv, template, title, lang: extra.lang ?? 'en', status, planned_on: planned, held_on: held, duration_min: 60,
      skill_ids: skillIds.filter((s) => skills.has(s) && !isSecSkill(s)), standard_ids: stds, position_id: `pos-${sme}`, action_id: extra.action_id ?? null,
      transcript: tr ?? '', transcript_words: tr ? wordCount(tr) : 0, notes: extra.notes ?? '', asset_id: extra.asset_id ?? null,
      sme_name: a.en, sme_name_ar: a.ar, interviewer_name: b.en, interviewer_name_ar: b.ar, history, created_at: history[0].at, updated_at: history[history.length - 1].at,
    };
  };
  function addDays(d, n) { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  const sessions = [
    S('cs-001', 'w-mnt-01', 'p-head-sq', 'war_stories', 'Redundant trains and the second check', 'transcribed', '2026-06-10', '2026-06-10', TR.trains, ['sk-mp-01-mech', 'sk-hu-01'], ['qs-mech'], { asset_id: 'kas-001' }),
    S('cs-002', 'w-sro-02', 'p-k-instructor', 'rules_of_thumb', 'Standing alarms: what the board is really telling you', 'transcribed', '2026-06-24', '2026-06-24', TR.alarms, ['sk-co-01'], ['qs-ro', 'qs-sro'], { asset_id: 'kas-002' }),
    S('cs-003', 'w-ss-01', 'p-sro', 'critical_decisions', 'Procedure use under time pressure', 'transcribed', '2026-07-08', '2026-07-08', TR.pressure, ['sk-hu-01', 'sk-co-03'], ['qs-lo-turbine'], { asset_id: 'kas-003' }),
    S('cs-004', 'w-rp-02', 'p-rp-lead', 'rules_of_thumb', 'Releasing tools from the controlled area', 'transcribed', '2026-07-15', '2026-07-15', TR.tools, ['sk-rp-01'], ['qs-rp'], { asset_id: 'kas-004' }),
    S('cs-005', 'w-mnt-02', 'p-head-sq', 'rules_of_thumb', 'Foreign material exclusion in a busy outage', 'transcribed', '2026-07-29', '2026-07-29', TR.fme, ['sk-mp-01-mech'], ['qs-mech'], { asset_id: 'kas-005' }),
    S('cs-006', 'w-qa-01', 'p-sq-lead', 'documents', 'Receiving inspection: when the certificate does not match', 'transcribed', '2026-08-12', '2026-08-12', TR.certs, ['sk-qa-01'], ['qs-qa'], { asset_id: 'kas-006' }),
    S('cs-007', 'w-chem-01', 'p-chem-sup', 'rules_of_thumb', 'Reading the blowdown trend', 'transcribed', '2026-09-02', '2026-09-02', TR.chemistry, ['sk-ch-01'], ['qs-chem'], { asset_id: 'kas-007' }),
    S('cs-008', 'w-eng-05', 'p-k-instructor', 'rules_of_thumb', 'What the startup curve tells you', 'transcribed', '2026-09-16', '2026-09-16', TR.physics, ['sk-pf-01-core'], ['qs-sro'], { asset_id: 'kas-008' }),
    S('cs-009', 'w-ss-02', 'p-sro', 'critical_decisions', 'تسليم الوردية: ما لا يُكتب في السجل', 'transcribed', '2026-09-23', '2026-09-23', TR.turnover, ['sk-co-01'], ['qs-ro'], { asset_id: 'kas-009', lang: 'ar' }),
    S('cs-010', 'w-ep-01', 'p-ep-manager', 'war_stories', 'What the drill controller looks for', 'transcribed', '2026-05-20', '2026-05-20', TR.drill, ['sk-ep-01'], ['qs-ero'], { asset_id: 'kas-010' }),
    S('cs-011', 'p-sme-reviewer', 'p-head-sq', 'documents', 'Design basis documents I rely on', 'planned', '2026-10-20', null, null, ['sk-en-02'], ['qs-eng']),
    S('cs-012', 'w-sro-01', 'p-sro', 'critical_decisions', 'Crew B: decisions during power changes', 'planned', '2026-10-27', null, null, ['sk-co-01'], ['qs-sro'], { action_id: 'ka-seed-q4-w-sro-01-capture', created_by: 'p-sro' }),
    S('cs-013', 'w-eng-01', 'p-training-mgr', 'who_to_ask', 'System engineering: who to ask and why', 'held', '2026-10-06', '2026-10-06', null, ['sk-en-01'], ['qs-eng'], { notes: 'Transcript being typed up from the interview notes.' }),
    S('cs-014', 'w-fire-01', 'p-ep-manager', 'rules_of_thumb', 'Hot work and fire watches', 'planned', '2026-11-03', null, null, ['sk-ep-02-fire'], ['qs-fire']),
    S('cs-015', 'w-corp-01', 'p-training-mgr', 'who_to_ask', 'Onboarding contacts by role', 'cancelled', '2026-09-22', null, null, ['sk-ld-01'], []),
    S('cs-016', 'w-rp-04', 'p-rp-lead', 'war_stories', 'Radiological work planning lessons', 'planned', '2026-10-22', null, null, ['sk-rp-01'], ['qs-rp'], { action_id: 'ka-seed-q4-w-rp-04-capture' }),
  ];
  for (const s of sessions) { checkText(`session ${s.id}`, `${s.title} ${s.notes}`); s.standard_ids = s.standard_ids.filter((q) => T.qual_standards.some((x) => x.id === q && !x.security_restricted)); }
  T.capture_sessions = sessions;

  // enrichment references (same documents as the session workspace)
  const courseSec = (c) => (c.competency_ids ?? []).some((id) => secComps.has(id));
  const refs = {
    skills: T.skills.filter((s) => !isSecSkill(s.id)).map((s) => ({ id: s.id, text: `${s.name_en} ${s.description_en ?? ''} ${s.name_ar}` })),
    oe: T.oe_lessons.filter((o) => o.status === 'published').map((o) => ({ id: o.id, text: `${o.title_en} ${o.summary_en} ${o.lesson_en} ${o.title_ar}` })),
    courses: T.courses.filter((c) => !courseSec(c)).map((c) => ({ id: c.id, text: `${c.title_en} ${c.summary_en ?? ''} ${c.title_ar}` })),
  };
  const A = (id, sess, author, fam, status, t, opts = {}) => {
    const s = sessions.find((x) => x.id === sess) ?? null;
    const sme = s ? s.sme_id : author;
    const body = opts.body ?? s.transcript;
    const en = enrich(body, refs);
    const accept = new Set(opts.accept ?? []);
    const decided = ['published', 'withdrawn'].includes(status) || opts.technicalPass;
    const suggestions = en.suggestions.map((x) => ({ ...x, decision: decided ? (accept.has(x.ref) ? 'accepted' : 'rejected') : 'pending' }));
    const acc = (k) => suggestions.filter((x) => x.kind === k && x.decision === 'accepted').map((x) => x.ref);
    if (process.env.F20_DEBUG) console.log(id, JSON.stringify(suggestions.map((x) => [x.ref, x.score, x.terms.join("|")]))); for (const r of accept) if (!suggestions.some((x) => x.ref === r)) throw new Error(`f20: ${id} accepts ${r}, which enrichment does not suggest (${suggestions.map((x) => x.ref).join(',')})`);
    const a = nm(author), b = nm(sme);
    const submitted = opts.submitted ?? (s ? addDays(s.held_on, 5) : '2026-08-20');
    return {
      id, title_en: t.en, title_ar: t.ar, summary_en: t.sen, summary_ar: t.sar, body, body_lang: s?.lang ?? 'en', key_points: t.kp,
      skill_ids: [...new Set([...(s?.skill_ids ?? opts.skills ?? []), ...acc('skill')])], standard_ids: s?.standard_ids ?? opts.standards ?? [], requal_standard_ids: opts.requal ?? [],
      oe_ids: acc('oe'), course_ids: acc('course'), system_family: fam, status, published: status === 'published', reviewers: [], suggestions,
      author_id: author, sme_id: sme, source_session_id: s?.id ?? null, position_id: `pos-${sme}`, author_name: a.en, author_name_ar: a.ar, sme_name: b.en, sme_name_ar: b.ar, template: s?.template ?? null,
      used_by: 0, version: 1, submitted_at: status === 'draft' ? null : ts(submitted, '11:00'), published_at: null, published_by: null, withdrawn_at: null, withdrawn_reason: null,
      created_at: ts(s ? addDays(s.held_on, 3) : '2026-08-18', '10:00'), updated_at: ts(submitted, '11:00'),
    };
  };
  const assets = [
    A('kas-001', 'cs-001', 'p-head-sq', 'maintenance', 'published', {
      en: 'Working on redundant trains: the second check', ar: 'العمل على المسارات الاحتياطية: التحقق الثاني',
      sen: 'Why a peer check at the local panel is the real defence when two redundant trains are open for work, and how to set up the job so the layout points to the right train.',
      sar: 'لماذا يُعد التحقق من الزميل عند اللوحة المحلية الدفاع الحقيقي حين يُفتح مساران احتياطيان للعمل، وكيف يُهيأ العمل بحيث يدل المكان على المسار الصحيح.',
      kp: [
        { en: 'Read the component number aloud at the local panel; your partner reads it from the work order.', ar: 'اقرأ رقم المكوّن بصوت مسموع عند اللوحة المحلية، ويقرأه زميلك من أمر العمل.' },
        { en: 'Stage tools on the correct train the day before.', ar: 'جهّز الأدوات على المسار الصحيح في اليوم السابق.' },
        { en: 'The peer check is the job, not a delay to the job.', ar: 'التحقق من الزميل جزء من العمل وليس تأخيراً له.' },
      ],
    }, { accept: ['oe-1', 'sk-mp-01'], requal: ['qs-mech'] }),
    A('kas-002', 'cs-002', 'p-k-instructor', 'human_performance', 'published', {
      en: 'Standing alarms: owner, work order and date', ar: 'الإنذارات القائمة: مالك وأمر عمل وتاريخ',
      sen: 'A control room practice for standing alarms: each has an owner, a work order and a date, the list is read aloud at turnover, and unexplained alarms are treated as new.',
      sar: 'ممارسة في غرفة التحكم للإنذارات القائمة: لكل إنذار مالك وأمر عمل وتاريخ، وتُقرأ القائمة بصوت مسموع عند التسليم، ويُعامل الإنذار غير المفسَّر كإنذار جديد.',
      kp: [
        { en: 'Every standing alarm has an owner, a work order and a date.', ar: 'لكل إنذار قائم مالك وأمر عمل وتاريخ.' },
        { en: 'Read the standing list aloud at turnover and ask what changed.', ar: 'اقرأ قائمة الإنذارات القائمة بصوت مسموع عند التسليم واسأل عما تغيّر.' },
        { en: 'If you cannot explain why an alarm is lit, treat it as new.', ar: 'إذا لم تستطع تفسير سبب إنذار مضاء فعامله كإنذار جديد.' },
      ],
    }, { accept: ['oe-3'] }),
    A('kas-003', 'cs-003', 'p-sro', 'human_performance', 'published', {
      en: 'Place-keeping when the evolution feels familiar', ar: 'تتبّع الخطوات حين يبدو الإجراء مألوفاً',
      sen: 'How a shift supervisor keeps procedure use safe under time pressure: place-keeping on paper every time, restarting with a peer after an interruption, and stopping when anyone feels rushed.',
      sar: 'كيف يحافظ مشرف الوردية على سلامة استخدام الإجراءات تحت ضغط الوقت: تتبّع الخطوات ورقياً في كل مرة، والاستئناف مع زميل بعد أي انقطاع، والتوقف عندما يشعر أي شخص بالاستعجال.',
      kp: [
        { en: 'Circle the step, slash it when done, every time.', ar: 'ضع دائرة حول الخطوة واشطبها عند إنجازها، في كل مرة.' },
        { en: 'After an interruption, restart from the last completed step with a peer.', ar: 'بعد أي انقطاع، استأنف من آخر خطوة منجزة مع زميل.' },
        { en: 'If you feel rushed, say it, and the crew stops.', ar: 'إذا شعرت بالاستعجال فقل ذلك، ويتوقف الطاقم.' },
      ],
    }, { accept: ['oe-2'] }),
    A('kas-004', 'cs-004', 'p-rp-lead', 'radiation_protection', 'published', {
      en: 'Releasing tools from the controlled area', ar: 'إخراج الأدوات من المنطقة المراقبة',
      sen: 'Practical contamination control for tools: survey every tool before release, second survey for tools with crevices, keep a dedicated tool set inside and plan survey time into the job.',
      sar: 'ضبط عملي للتلوث في الأدوات: مسح كل أداة قبل إخراجها، ومسح ثانٍ للأدوات ذات الشقوق، والاحتفاظ بمجموعة أدوات مخصصة في الداخل، وتخطيط وقت المسح ضمن العمل.',
      kp: [
        { en: 'Hollow handles, ratchets and cable reels are the usual hiding places.', ar: 'المقابض المجوفة ومفاتيح السقاطة وبكرات الكابلات هي الأماكن المعتادة لاختباء التلوث.' },
        { en: 'Plan survey time into the schedule; rushed surveys cause mistakes.', ar: 'خطط لوقت المسح ضمن الجدول؛ فالمسح المستعجل يسبب الأخطاء.' },
        { en: 'A borderline reading is bagged, tagged and asked about, never averaged away.', ar: 'القراءة الحدّية تُعبّأ وتُوسم ويُسأل عنها، ولا يُلجأ إلى متوسطها.' },
      ],
    }, { accept: ['oe-5', 'sk-rp-02-survey'] }),
    A('kas-005', 'cs-005', 'p-head-sq', 'outage', 'published', {
      en: 'Foreign material exclusion in a busy outage', ar: 'منع المواد الغريبة خلال انقطاع مزدحم',
      sen: 'Habits that keep open systems clean when dozens are open at once: boundary logs and covers, tethered tools, counts in and out, and a close-out inspection with a light and a mirror.',
      sar: 'عادات تحافظ على نظافة الأنظمة المفتوحة حين يُفتح العشرات منها في وقت واحد: سجلات الحدود والأغطية، وربط الأدوات، والعدّ عند الدخول والخروج، والفحص النهائي بمصباح ومرآة.',
      kp: [
        { en: 'Every open system gets a log, a cover and a person responsible.', ar: 'لكل نظام مفتوح سجل وغطاء وشخص مسؤول.' },
        { en: 'When the count is short, stop and search before closing.', ar: 'عند نقص العدد، توقف وابحث قبل الإغلاق.' },
        { en: 'Work packages state the boundary class, so the crew does not decide in the field.', ar: 'تحدد حزم العمل فئة الحدود حتى لا يقرر الطاقم ذلك في الموقع.' },
      ],
    }, { accept: ['oe-4'] }),
    A('kas-006', 'cs-006', 'p-sq-lead', 'maintenance', 'published', {
      en: 'Receiving inspection: item first, certificate second', ar: 'فحص الاستلام: الصنف أولاً ثم الشهادة',
      sen: 'How an inspector avoids being led by the paperwork: read the stamping on the item first, then match heat number, grade, size and quantity, and hold anything that does not match.',
      sar: 'كيف يتجنب المفتش أن تقوده الأوراق: اقرأ الختم على الصنف أولاً، ثم طابق رقم الصهر والدرجة والمقاس والكمية، واحجز أي صنف لا يتطابق.',
      kp: [
        { en: 'Check the stamping on the item before reading the certificate.', ar: 'افحص الختم على الصنف قبل قراءة الشهادة.' },
        { en: 'Missing or mismatched heat numbers are the most common finding.', ar: 'أرقام الصهر المفقودة أو غير المتطابقة هي الملاحظة الأكثر شيوعاً.' },
        { en: 'Never accept on a promise that a corrected certificate will follow.', ar: 'لا تقبل بناءً على وعد بأن الشهادة المصححة ستصل لاحقاً.' },
      ],
    }, { accept: ['oe-6', 'sk-qa-02-cgd', 'c-sa-cgd-103', 'c-sa-cfsi-102'] }),
    A('kas-007', 'cs-007', 'p-chem-sup', 'chemistry', 'review', {
      en: 'Reading the steam generator blowdown trend', ar: 'قراءة اتجاه تصريف مولد البخار',
      sen: 'What the shape of the sodium, chloride and sulfate trends says about the secondary side, when to take a confirmatory sample and why each unit has its own normal.',
      sar: 'ما الذي يكشفه شكل اتجاهات الصوديوم والكلوريد والكبريتات عن الدائرة الثانوية، ومتى تؤخذ عينة تأكيدية، ولماذا لكل وحدة نمطها الطبيعي.',
      kp: [
        { en: 'Read sodium, chloride and sulfate together and look at the shape of the trend.', ar: 'اقرأ الصوديوم والكلوريد والكبريتات معاً وانظر إلى شكل الاتجاه.' },
        { en: 'A slow rise over several days usually points to condenser in-leakage.', ar: 'الارتفاع البطيء على مدى أيام يشير عادة إلى تسرب في المكثف.' },
        { en: 'Flush sample lines for the full time.', ar: 'اغسل خطوط العينات للمدة الكاملة.' },
      ],
    }, { technicalPass: true, accept: [] }),
    A('kas-008', 'cs-008', 'p-k-instructor', 'reactor_core', 'review', {
      en: 'What the startup curve tells you', ar: 'ما الذي يخبرك به منحنى بدء التشغيل',
      sen: 'Using the inverse count rate plot during startup: compare it with the predicted critical position, say the numbers aloud as a team and slow down to recalculate when they drift.',
      sar: 'استخدام منحنى معدل العد العكسي أثناء بدء التشغيل: قارنه بالموضع الحرج المتوقع، ورددوا الأرقام بصوت مسموع كفريق، وتمهّلوا لإعادة الحساب عند الانحراف.',
      kp: [
        { en: 'Compare the predicted critical position with the curve and ask why they differ.', ar: 'قارن الموضع الحرج المتوقع بالمنحنى واسأل عن سبب الاختلاف.' },
        { en: 'Reactivity monitoring is a team activity: say the numbers aloud.', ar: 'مراقبة التفاعلية نشاط جماعي: ردد الأرقام بصوت مسموع.' },
      ],
    }, { submitted: '2026-10-05' }),
    A('kas-009', 'cs-009', 'p-sro', 'human_performance', 'draft', {
      en: 'Shift turnover: what the log does not say', ar: 'تسليم الوردية: ما لا يُكتب في السجل',
      sen: 'Face-to-face turnover at the boards, reading the standing alarms and open work aloud, and asking the incoming operator to explain the plant state in their own words.',
      sar: 'التسليم وجهاً لوجه أمام اللوحات، وقراءة الإنذارات القائمة والأعمال المفتوحة بصوت مسموع، والطلب من المشغل القادم شرح حالة المحطة بكلماته.',
      kp: [
        { en: 'Turnover happens face to face at the boards.', ar: 'يتم التسليم وجهاً لوجه أمام اللوحات.' },
        { en: 'The incoming operator explains the plant state in their own words.', ar: 'يشرح المشغل القادم حالة المحطة بكلماته.' },
      ],
    }),
    A('kas-010', 'cs-010', 'p-ep-manager', 'emergency_preparedness', 'withdrawn', {
      en: 'What the drill controller looks for', ar: 'ما الذي يبحث عنه مراقب التمرين',
      sen: 'Communication over heroics in emergency drills: repeat-backs, a log that keeps up, announcing actions before taking them and a critique that starts with what the team saw.',
      sar: 'التواصل قبل البطولات في تمارين الطوارئ: التكرار للتأكيد، وسجل يواكب الأحداث، والإعلان عن الإجراءات قبل تنفيذها، ونقد يبدأ بما رآه الفريق.',
      kp: [{ en: 'Watch how the team handles the second injected problem.', ar: 'راقب كيف يتعامل الفريق مع المشكلة الثانية المضافة.' }],
    }),
    A('kas-011', null, 'p-sme-reviewer', 'primary', 'published', {
      en: 'Design basis: why the margins are where they are', ar: 'أساس التصميم: لماذا الهوامش حيث هي',
      sen: 'An engineer explains how design margins are set from the design basis, why changes go through configuration control, and which questions to ask before proposing a modification.',
      sar: 'يشرح مهندس كيف تُحدَّد هوامش التصميم من أساس التصميم، ولماذا تمر التغييرات عبر ضبط التهيئة، وما الأسئلة التي تُطرح قبل اقتراح أي تعديل.',
      kp: [
        { en: 'Every margin traces back to a design basis document; find it before you change anything.', ar: 'كل هامش يعود إلى وثيقة أساس تصميم؛ اعثر عليها قبل تغيير أي شيء.' },
        { en: 'Configuration control protects the people who come after you.', ar: 'ضبط التهيئة يحمي من يأتون بعدك.' },
      ],
    }, {
      body: 'Design margins are not arbitrary. Each one traces back to the design basis: the events the plant must withstand and the assumptions in the safety analysis. When someone proposes a change, the first question is which design basis document sets the margin, and the second is what analysis would need to be redone. Configuration control exists so that the plant as built, the documents and the analysis stay in agreement. A modification that is small in the field can be large on paper, and the paper is what the next engineer will rely on. Before proposing a modification, talk to the system engineer, read the design basis and the calculation, and write down your assumptions so that a reviewer can check them.',
      skills: ['sk-en-02', 'sk-en-01'], standards: ['qs-eng'], accept: ['sk-en-01-mods', 'c-eng-init'], submitted: '2026-08-20',
    }),
  ];
  for (const a of assets) checkText(`asset ${a.id}`, assetText(a));
  // reviews: technical by an interviewer, security and content check by the KM owner (training manager); never the author or SME
  const REVIEW = {
    'kas-001': ['p-rp-lead', '2026-06-20'], 'kas-002': ['p-head-sq', '2026-07-03'], 'kas-003': ['p-k-instructor', '2026-07-17'], 'kas-004': ['p-ep-manager', '2026-07-24'],
    'kas-005': ['p-sq-lead', '2026-08-06'], 'kas-006': ['p-head-sq', '2026-08-21'], 'kas-007': ['p-rp-lead', '2026-09-12'], 'kas-010': ['p-head-sq', '2026-05-29'], 'kas-011': ['p-head-sq', '2026-08-26'],
  };
  const reviews = [];
  const RV = (asset, reviewer, kind, day, note) => {
    const n = nm(reviewer);
    const a = assets.find((x) => x.id === asset);
    if (reviewer === a.author_id || reviewer === a.sme_id) throw new Error(`f20: ${reviewer} reviews own asset ${asset}`);
    const decisions = kind === 'technical' ? Object.fromEntries(a.suggestions.map((s) => [`${s.kind}:${s.ref}`, s.decision])) : {};
    reviews.push({
      id: `arv-${asset}-${kind}`, asset_id: asset, asset_author_id: a.author_id, reviewer_id: reviewer, kind, outcome: 'pass', note,
      checks: kind === 'technical' ? { accurate: true, deidentified: false, no_security: false } : { accurate: false, deidentified: true, no_security: true }, decisions,
      reviewer_name: n.en, reviewer_name_ar: n.ar, superseded: false, version: 1, created_at: ts(day, '14:00'),
    });
  };
  for (const [asset, [rev, day]] of Object.entries(REVIEW)) {
    const a = assets.find((x) => x.id === asset);
    RV(asset, rev, 'technical', day, 'Accurate and useful; suggestions decided.');
    if (a.status !== 'review') {
      RV(asset, 'p-training-mgr', 'security', addDays(day, 1), 'De-identified; no security, safeguards or cyber details.');
      a.reviewers = [rev, 'p-training-mgr'];
      a.published_at = ts(addDays(day, 2), '09:00');
      a.published_by = 'p-training-mgr';
      a.updated_at = a.published_at;
    }
  }
  const w = assets.find((x) => x.id === 'kas-010');
  w.published = false; w.withdrawn_at = ts('2026-09-30', '12:00'); w.withdrawn_reason = 'Replaced by the updated drill guide and scenario set'; w.updated_at = w.withdrawn_at;
  // "used by": kas-001 by 14 colleagues (shown), the others by fewer than 10 (hidden)
  const users = staff.filter((p) => p.id.startsWith('w-') && !EXCLUDED_FAMILIES.includes(p.job_family_id)).map((p) => p.id).sort();
  const uses = [];
  const USE = { 'kas-001': 14, 'kas-002': 11, 'kas-003': 6, 'kas-004': 4, 'kas-005': 8, 'kas-006': 3, 'kas-011': 5 };
  for (const [asset, n] of Object.entries(USE)) {
    const pool = [...users].sort((x, y) => h32(`${asset}:${x}`) - h32(`${asset}:${y}`)).slice(0, n);
    for (const p of pool) uses.push({ id: `au:${asset}:${p}`, asset_id: asset, person_id: p, used_on: addDays('2026-09-01', h32(`${asset}${p}`) % 35) });
    assets.find((x) => x.id === asset).used_by = n;
  }
  T.knowledge_assets = assets;
  T.asset_reviews = reviews;
  T.asset_uses = uses;

  // ───────────── assessments: 2026-Q3 (closed) and 2026-Q4 (current; a few positions still to assess)
  const posById = new Map(positions.map((p) => [p.id, p]));
  const assetsBefore = (posId, iso) => assets.filter((a) => a.position_id === posId && a.published_at && a.published_at.slice(0, 10) <= iso).length;
  const ASSESSORS = { operations: 'p-ops-ceo', rp_chem_ep: 'p-rp-lead' };
  const assessments = [];
  const ADJUST = { 'pos-w-ss-02': [5, 5, 'Shift supervisor with unique crew coordination knowledge; position factor raised after the turnover review.'], 'pos-p-fuel-pm': [3, 4, 'Single fuel specialist in the department; replacement takes years, so the position factor is raised.'] };
  const mk = (period, pos, day, assessor, assets_) => {
    const prop = proposeFactors(pos, assets_);
    const adj = period === Q ? ADJUST[pos.id] : null;
    const a = adj ? adj[0] : prop.attrition, p = adj ? adj[1] : prop.position;
    const n = nm(assessor);
    const reasons = a === prop.attrition && p === prop.position ? prop.reasons : [...prop.reasons, { code: 'adjusted', key: 'm24.reasons.adjusted', vars: { pa: prop.attrition, pp: prop.position, a, p } }];
    return {
      id: `klra:${period}:${pos.id}`, period, position_id: pos.id, person_id: pos.person_id, department: pos.department, attrition_factor: a, position_factor: p, total: a * p,
      proposed_attrition: prop.attrition, proposed_position: prop.position, adjusted: !!adj, note: adj ? adj[2] : null, reasons, drivers: prop.drivers,
      assessed_by: assessor, assessed_by_name: n.en, assessed_by_name_ar: n.ar, assessed_at: ts(day, '10:00'), open_read: false,
    };
  };
  const PENDING_Q4 = new Set(['pos-p-k-editor', 'pos-p-head-sustainability', 'pos-w-corp-02', 'pos-w-sc-01', 'pos-c-alnoor-03', 'pos-p-k-hr-analyst', 'pos-w-qa-02', 'pos-w-fire-02']);
  positions.forEach((pos, i) => {
    const assessor = ASSESSORS[pos.department] && i % 2 === 0 ? ASSESSORS[pos.department] : 'p-training-mgr';
    assessments.push(mk(QP, pos, addDays('2026-07-06', i % 20), 'p-training-mgr', assetsBefore(pos.id, '2026-07-06')));
    if (!PENDING_Q4.has(pos.id)) assessments.push(mk(Q, pos, addDays('2026-10-01', i % 7), assessor, assetsBefore(pos.id, '2026-10-01')));
  });
  T.klra_assessments = assessments;

  // ───────────── mitigation actions
  const actions = [];
  const KINDS = ['capture', 'mentoring', 'successor', 'documentation', 'cross_training'];
  const OWNER = { capture: 'km_owner', mentoring: 'line_manager', successor: 'hr', documentation: 'sme', cross_training: 'training' };
  const act = (a, kind, status, due, created, extra = {}) => actions.push({
    id: extra.id ?? `ka-seed-${a.period === Q ? 'q4' : 'q3'}-${a.position_id.replace(/^pos-/, '')}-${kind}`, assessment_id: a.id, position_id: a.position_id, person_id: a.person_id, period: a.period, kind, owner_role: OWNER[kind],
    due_on: due, status, note: extra.note ?? '', ref_table: extra.ref_table ?? null, ref_id: extra.ref_id ?? null, outcome: status === 'done' ? extra.outcome ?? 'Completed' : status === 'cancelled' ? 'No longer needed' : null,
    created_by: extra.by ?? 'p-training-mgr', created_at: ts(created, '12:00'), closed_by: ['done', 'cancelled'].includes(status) ? extra.by ?? 'p-training-mgr' : null, closed_at: ['done', 'cancelled'].includes(status) ? ts(addDays(due, -3), '12:00') : null, open_read: false,
  });
  const high = (period) => assessments.filter((a) => a.period === period && a.total >= 16).sort((x, y) => (x.position_id < y.position_id ? -1 : 1));
  // Q3: most high rows were mitigated (done or still running); three were not and read "overdue"
  high(QP).forEach((a, i) => {
    if (i % 7 === 3) return; // no action before the quarter closed -> overdue
    const k1 = KINDS[i % KINDS.length];
    act(a, k1, i % 3 === 0 ? 'in_progress' : 'done', addDays('2026-09-15', i % 10), addDays('2026-07-10', i % 10));
    if (i % 4 === 0) act(a, KINDS[(i + 2) % KINDS.length], 'done', addDays('2026-09-25', i % 5), addDays('2026-07-15', i % 10));
  });
  // Q4: about two thirds planned so far (a few already past their due date); the rest still "needed" before 31 Dec
  high(Q).forEach((a, i) => {
    if (a.position_id === 'pos-w-sro-01') { act(a, 'capture', 'in_progress', '2026-11-15', '2026-10-05', { ref_table: 'capture_sessions', ref_id: 'cs-012', by: 'p-sro', note: 'Capture interview with the crew B SRO before the rotation.' }); return; }
    if (a.position_id === 'pos-w-rp-04') { act(a, 'capture', 'in_progress', '2026-11-30', '2026-10-06', { ref_table: 'capture_sessions', ref_id: 'cs-016', by: 'p-rp-lead' }); return; }
    if (i % 3 === 2) return;
    const k = KINDS[(i + 1) % KINDS.length];
    act(a, k, 'planned', i % 5 === 1 ? '2026-10-05' : addDays('2026-11-10', i * 3 % 40), addDays('2026-10-02', i % 5));
  });
  // capture actions referenced by the planned sessions must exist (positions may have moved band): create them when missing
  for (const s of sessions.filter((x) => x.action_id)) {
    if (!actions.some((x) => x.id === s.action_id)) {
      const a = assessments.find((x) => x.id === `klra:${Q}:${s.position_id}`);
      if (!a) throw new Error(`f20: no Q4 assessment for ${s.position_id}`);
      act(a, 'capture', 'in_progress', '2026-11-30', '2026-10-05', { id: s.action_id, ref_table: 'capture_sessions', ref_id: s.id, by: s.created_by });
    }
  }
  T.klra_actions = actions;
  T.klra_settings = [{ id: 'default', high_threshold: 16, medium_threshold: 8, updated_by: 'p-training-mgr', updated_at: ts('2026-07-01', '08:00'), history: [{ at: ts('2026-07-01', '08:00'), by: 'p-training-mgr', high: 16, medium: 8 }], open_read: false }];
  for (const x of actions) if (!posById.has(x.position_id)) throw new Error(`f20: action for unknown position ${x.position_id}`);
}
