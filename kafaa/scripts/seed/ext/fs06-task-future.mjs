// FS06 Task layer with AI exposure and change horizon (FS wave A · E5, module M26) seed. Runs after f27 (file order), so the F27
// task inventory exists. For every non-restricted JTA task: the OECD capability needs (1-4 dimensions, levels 1-5), a change
// horizon, a technology driver, the derived exposure (exposureOf, the same rule as SQL) and task-to-skill links (qualification-card
// tasks reuse the F33 task_skill_links map; job-analysis tasks are linked by the SAT analyst; future skills for the change).
// Restricted (security) tasks get nothing. Also: the AI capability reference levels per dimension and horizon (SIMULATED planning
// assumption on the OECD five-level scale, not OECD ratings), sourced benchmark figures (SSG, OECD, O*NET) shown beside the
// results, SAT analysts designated by the training manager, and a short SAT change-log history of future edits.
// Synthetic people and role cards only.
import { HORIZONS, TASK_DIMS, canonNeeds, exposureOf, futureSummary, futureSummaryLine } from '../../../src/modules/m26/future.ts';

const TM = 'p-training-mgr';
const ANALYST = 'p-sq-lead';
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;
const READ_ON = '2026-10-10';
const SSG = 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf';
const OECD = 'https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report';
const ONET = 'https://onetcenter.org/bright.html';

// AI capability reached per dimension at each horizon (SIMULATED planning assumption on the OECD 1-5 scale).
const LEVELS = {
  language: [3, 4, 4, 'Drafting, summarising and checking procedure-based text and logs', 'صياغة النصوص المستندة إلى الإجراءات والسجلات وتلخيصها ومراجعتها'],
  social: [2, 2, 3, 'Structured exchanges only; crew coordination stays with people', 'تبادلات منظمة فقط؛ يبقى تنسيق الطاقم مع الأشخاص'],
  problem_solving: [2, 3, 3, 'Well-bounded diagnosis against known cases and procedures', 'تشخيص محدد ضمن حالات وإجراءات معروفة'],
  creativity: [2, 3, 3, 'Drafting options and scenarios for a person to judge', 'صياغة خيارات وسيناريوهات ليحكم عليها شخص'],
  metacognition: [1, 2, 2, 'Little reliable self-checking; a qualified person keeps the judgement', 'قدرة محدودة على التحقق الذاتي؛ يبقى الحكم لشخص مؤهل'],
  learning_memory: [3, 3, 4, 'Retrieval from controlled documents and plant history', 'الاسترجاع من الوثائق المضبوطة وتاريخ المحطة'],
  vision: [3, 4, 4, 'Reading gauges, images and drawings; anomaly spotting', 'قراءة المقاييس والصور والمخططات ورصد الحالات الشاذة'],
  manipulation: [2, 2, 3, 'Simple handling; dexterous field work stays manual until later', 'مناولة بسيطة؛ يبقى العمل الميداني الدقيق يدوياً حتى وقت لاحق'],
  robotic: [1, 2, 3, 'Remote and crawler inspection platforms mature over the decade', 'تنضج منصات الفحص عن بُعد والزاحفة خلال العقد'],
};

// Archetypes: [needs, driver, horizon]
const A = {
  doc: [{ language: 2, learning_memory: 2 }, 'ai_assist', '2030'],
  docTech: [{ language: 3, learning_memory: 3, problem_solving: 3 }, 'ai_assist', '2030'],
  analyse: [{ problem_solving: 3, learning_memory: 3, language: 2 }, 'ai_assist', '2030'],
  analyseAct: [{ problem_solving: 3, learning_memory: 3, metacognition: 3 }, 'ai_assist', '2030'],
  inspect: [{ vision: 3, manipulation: 2 }, 'robotics', '2030'],
  inspectHands: [{ vision: 3, manipulation: 3, robotic: 3 }, 'robotics', '2035'],
  handsOp: [{ manipulation: 3, problem_solving: 3, metacognition: 3 }, 'digital_ic', '2030'],
  hands: [{ manipulation: 4, vision: 3, problem_solving: 3 }, 'robotics', '2035'],
  handsHeavy: [{ manipulation: 5, problem_solving: 4, vision: 3 }, 'robotics', '2035'],
  test: [{ manipulation: 3, learning_memory: 2, problem_solving: 2 }, 'digital_ic', '2030'],
  emerg: [{ metacognition: 4, problem_solving: 4, social: 3 }, 'digital_ic', 'now'],
  emergField: [{ manipulation: 3, metacognition: 4, problem_solving: 4 }, 'none', 'now'],
  emergTeam: [{ social: 4, metacognition: 3, problem_solving: 3 }, 'none', 'now'],
  control: [{ problem_solving: 4, metacognition: 4, learning_memory: 4 }, 'digital_ic', 'now'],
  lead: [{ social: 4, metacognition: 5, problem_solving: 4 }, 'none', 'now'],
  decide: [{ metacognition: 5, problem_solving: 4, social: 3 }, 'none', 'now'],
  turnover: [{ language: 3, social: 3, learning_memory: 3 }, 'ai_assist', '2030'],
  comms: [{ social: 4, metacognition: 3 }, 'none', 'now'],
  brief: [{ social: 4, language: 3, metacognition: 3 }, 'ai_assist', '2030'],
  respond: [{ social: 3, problem_solving: 3, language: 2 }, 'digital_ic', '2030'],
  techspec: [{ learning_memory: 4, problem_solving: 4, metacognition: 4 }, 'smr_design', '2035'],
  review: [{ language: 3, learning_memory: 3, problem_solving: 3 }, 'ai_assist', '2030'],
  admin: [{ learning_memory: 3, problem_solving: 3, social: 3 }, 'ai_assist', '2030'],
  fme: [{ vision: 3, metacognition: 3 }, 'robotics', '2030'],
  safetyHands: [{ manipulation: 3, metacognition: 4 }, 'none', 'now'],
  sample: [{ manipulation: 3, vision: 2, metacognition: 3 }, 'robotics', '2035'],
  lab: [{ manipulation: 2, learning_memory: 2 }, 'digital_ic', '2030'],
  labHands: [{ manipulation: 3, learning_memory: 2 }, 'robotics', '2035'],
  calc: [{ problem_solving: 3, learning_memory: 3 }, 'digital_twin', '2030'],
  radBoundary: [{ manipulation: 3, metacognition: 3, vision: 3 }, 'robotics', '2035'],
  healthReport: [{ problem_solving: 3, learning_memory: 3, language: 3 }, 'digital_twin', '2030'],
  engEval: [{ problem_solving: 4, learning_memory: 4, metacognition: 3 }, 'digital_twin', '2035'],
  engComm: [{ problem_solving: 4, social: 3, metacognition: 4 }, 'none', 'now'],
  engPlan: [{ problem_solving: 3, learning_memory: 3, language: 3 }, 'smr_design', '2035'],
  engUrgent: [{ problem_solving: 4, metacognition: 4, creativity: 3 }, 'digital_twin', '2030'],
  walkdown: [{ vision: 3, language: 3 }, 'robotics', '2030'],
  learn: [{ learning_memory: 3, social: 3 }, 'ai_assist', 'now'],
  checklist: [{ learning_memory: 2, vision: 2 }, 'digital_ic', 'now'],
  drillPlan: [{ creativity: 3, problem_solving: 3, social: 3 }, 'digital_twin', '2030'],
  phys: [{ manipulation: 4, metacognition: 3 }, 'none', 'now'],
  assess: [{ problem_solving: 3, learning_memory: 3, metacognition: 3 }, 'ai_assist', '2030'],
  instrDesign: [{ language: 3, creativity: 3, learning_memory: 3 }, 'ai_assist', '2030'],
  teach: [{ social: 4, language: 3, metacognition: 3 }, 'ai_assist', 'now'],
  evalJpm: [{ metacognition: 4, social: 3, problem_solving: 3 }, 'none', 'now'],
  debrief: [{ social: 4, metacognition: 4, language: 3 }, 'digital_twin', '2030'],
  auditLead: [{ social: 4, metacognition: 4, language: 3 }, 'ai_assist', '2030'],
  inspectQc: [{ vision: 3, learning_memory: 3 }, 'digital_ic', '2030'],
  nde: [{ vision: 4, manipulation: 3, metacognition: 3 }, 'robotics', '2035'],
  drawings: [{ vision: 3, problem_solving: 3, learning_memory: 3 }, 'digital_twin', '2030'],
  verify: [{ metacognition: 4, vision: 3 }, 'none', 'now'],
  schedule: [{ problem_solving: 3, learning_memory: 3, language: 2 }, 'ai_assist', '2030'],
  radCtl: [{ metacognition: 3, vision: 2 }, 'digital_ic', 'now'],
  exam: [{ learning_memory: 4, problem_solving: 3 }, 'none', 'now'],
};
const BY_CODE = {
  'LO-WS-TB-T1': 'inspect', 'LO-WS-TB-T2': 'handsOp', 'LO-WS-TB-T3': 'verify', 'LO-WS-TB-T4': 'respond', 'LO-WS-TB-T5': 'comms',
  'LO-WS-AUX-T1': 'inspect', 'LO-WS-AUX-T2': 'handsOp', 'LO-WS-AUX-T3': 'radCtl', 'LO-WS-AUX-T4': 'doc',
  'LO-J01': 'inspect', 'LO-J02': 'hands', 'LO-J03': 'emergField', 'LO-J04': 'doc',
  'RO-QC-T1': 'control', 'RO-QC-T2': 'emerg', 'RO-QC-T3': 'control', 'RO-QC-T4': 'turnover', 'RO-QC-T5': 'exam',
  'RO-J01': 'emerg', 'RO-J02': 'review', 'RO-J03': 'doc', 'RO-J04': 'emerg',
  'SRO-QC-T1': 'lead', 'SRO-QC-T2': 'techspec', 'SRO-QC-T3': 'brief', 'SRO-QC-T4': 'decide',
  'SRO-J01': 'drawings', 'SRO-J02': 'emerg', 'SRO-J03': 'review',
  'SS-J01': 'turnover', 'SS-J02': 'decide', 'SS-J03': 'lead', 'SS-J04': 'admin',
  'MNT-MECH-T1': 'hands', 'MNT-MECH-T2': 'hands', 'MNT-MECH-T3': 'fme', 'MNT-MECH-T4': 'doc',
  'MNT-ELEC-T1': 'test', 'MNT-ELEC-T2': 'safetyHands', 'MNT-ELEC-T3': 'hands',
  'MNT-IC-T1': 'test', 'MNT-IC-T2': 'test', 'MNT-IC-T3': 'checklist',
  'MTE-J01': 'handsHeavy', 'MTE-J02': 'inspectHands', 'MTE-J03': 'test', 'MTE-J04': 'doc',
  'RP-TECH-T1': 'inspectHands', 'RP-TECH-T2': 'docTech', 'RP-TECH-T3': 'test', 'RP-TECH-T4': 'brief',
  'RPT-J01': 'radBoundary', 'RPT-J02': 'calc', 'RPT-J03': 'emergField',
  'CHEM-TECH-T1': 'sample', 'CHEM-TECH-T2': 'lab', 'CHEM-TECH-T3': 'analyse',
  'CT-J01': 'test', 'CT-J02': 'labHands', 'CT-J03': 'analyseAct',
  'ENG-SYS-T1': 'healthReport', 'ENG-SYS-T2': 'engEval', 'ENG-SYS-T3': 'engComm',
  'SDPE-J01': 'engEval', 'SDPE-J02': 'walkdown', 'SDPE-J03': 'engPlan', 'SDPE-J04': 'engUrgent',
  'EP-ERO-T1': 'learn', 'EP-ERO-T2': 'emergTeam', 'EPC-J01': 'checklist', 'EPC-J02': 'drillPlan',
  'FIRE-BRIG-T1': 'phys', 'FIRE-BRIG-T2': 'emergTeam', 'FP-J01': 'inspect', 'FP-J02': 'lead', 'FP-J03': 'assess',
  'INSTR-QUAL-T1': 'instrDesign', 'INSTR-QUAL-T2': 'teach', 'INSTR-QUAL-T3': 'evalJpm',
  'NTI-J01': 'debrief', 'NTI-J02': 'instrDesign', 'NTI-J03': 'analyse',
  'QA-AUDITOR-T1': 'docTech', 'QA-AUDITOR-T2': 'auditLead', 'QAQ-J01': 'inspectQc', 'QAQ-J02': 'docTech', 'QAQ-J03': 'nde',
  'WC-CLEAR-T1': 'drawings', 'WC-CLEAR-T2': 'verify', 'OSWC-J01': 'schedule', 'OSWC-J02': 'assess',
};
// current skills for job-analysis tasks (qualification-card tasks reuse the F33 map): role defaults + keyword matches
const ROLE_SKILLS = {
  'local-operator': [['sk-co-01-rounds', 2], ['sk-co-01', 2]], 'reactor-operator': [['sk-co-01-eop', 3], ['sk-pf-03', 2]],
  'senior-reactor-operator': [['sk-ld-02-decide', 3], ['sk-ns-02-techspec', 3]], 'shift-supervisor': [['sk-ld-01', 3], ['sk-co-02', 3]],
  'maintenance-technician-engineer': [['sk-mp-01', 2], ['sk-mp-01-mech', 3]], 'radiation-protection-technician': [['sk-rp-02-survey', 3], ['sk-rp-02', 2]],
  'chemistry-technician': [['sk-ch-01', 2], ['sk-ch-02-labqa', 2]], 'systems-design-plant-engineer': [['sk-en-02', 2], ['sk-en-01', 2]],
  'emergency-preparedness-coordinator': [['sk-ep-01', 2], ['sk-ep-02', 2]], 'fire-protection': [['sk-ep-02-fire', 3], ['sk-hu-01', 2]],
  'nuclear-training-instructor': [['sk-ld-01-instruct', 3], ['sk-ld-01-coach', 2]], 'quality-assurance-qc': [['sk-qa-01-inspect', 3], ['sk-qa-01', 2]],
  'operations-support-work-control': [['sk-mp-01-outage', 2], ['sk-hu-02', 2]],
};
const KEYWORDS = [
  [/diesel generator/i, 'sk-pf-03-elec', 2], [/chemistry|sample|reagent|analyser/i, 'sk-ch-01', 2], [/dose|ALARA/i, 'sk-rp-01-dose', 2], [/JPM|exam item/i, 'sk-ld-01-instruct', 3],
  [/statistic|trend/i, 'sk-da-01-analysis', 2], [/torque|seal|heat exchanger/i, 'sk-mp-01-mech', 3], [/contamination/i, 'sk-rp-02-survey', 3], [/control rod|loss of off-site/i, 'sk-co-03', 2],
  [/safety injection|surveillance/i, 'sk-pf-03-eccs', 2], [/clearance|tagging/i, 'sk-hu-01-star', 2], [/emergency event|notifications/i, 'sk-ep-02', 2], [/limiting condition/i, 'sk-ns-02-techspec', 3],
  [/transient|crew/i, 'sk-ld-02-decide', 3], [/ageing|in-service|walk-down|technical evaluation/i, 'sk-en-02-perf', 2], [/drill/i, 'sk-ep-02', 2], [/fire/i, 'sk-ep-02-fire', 2],
  [/receipt inspection|nonconformance|NDE|penetrant/i, 'sk-qa-02', 2], [/risk screening|schedule work/i, 'sk-mp-01-outage', 2], [/overtime|fatigue/i, 'sk-sc-02', 2], [/debrief/i, 'sk-ld-01-coach', 3],
];
// the skill the change brings (kind future), per driver; human-core tasks keep their current skills
const FUTURE_SKILL = { ai_assist: ['sk-da-02-review', 2], digital_twin: ['sk-da-01-twins', 2], robotics: ['sk-mp-01-remote', 2], digital_ic: ['sk-mp-02-dic', 2], smr_design: ['sk-pf-02-advcool', 1] };

// history of future edits (SAT change log, area future): [code, days before, by, before-archetype or patch]
const HISTORY = [
  ['RP-TECH-T1', '2026-09-18', ANALYST, { change_horizon: '2030' }, 'Moved to 2035: crawler survey platforms not yet qualified for contaminated areas'],
  ['ENG-SYS-T1', '2026-09-22', ANALYST, { tech_driver: 'ai_assist' }, 'Driver changed to digital twin: the system health report will draw on the plant data model'],
  ['SRO-QC-T2', '2026-09-24', TM, { change_horizon: '2030', tech_driver: 'ai_assist' }, 'Re-rated for the advanced-reactor horizon: technical specifications change with passive designs (planning assumption)'],
  ['MTE-J02', '2026-09-29', ANALYST, { needs: { vision: 3, manipulation: 4 } }, 'Manipulation need lowered after the remote-inspection trial review (SIMULATED)'],
  ['OSWC-J02', '2026-10-01', ANALYST, { needs: { problem_solving: 3, learning_memory: 3 } }, 'Metacognition added: risk screening needs a person to challenge the tool output'],
  ['INSTR-QUAL-T3', '2026-10-02', TM, { needs: { vision: 3, metacognition: 4 } }, 'Rated as human core: evaluating a JPM rests on the evaluator judgement'],
  ['CHEM-TECH-T3', '2026-10-05', ANALYST, {}, 'Confirmed after the chemistry SME review; no change to the rating'],
];

export default function build(T) {
  const tasks = T.jta_tasks ?? [];
  const skills = new Map((T.skills ?? []).map((s) => [s.id, s]));
  T.ai_capability_levels = [];
  let k = 0;
  for (const d of TASK_DIMS) {
    const [n, a, b, en, ar] = LEVELS[d];
    HORIZONS.forEach((h, i) => T.ai_capability_levels.push({
      id: `acl-${d}-${h}`, dimension: d, horizon: h, level: [n, a, b][i],
      basis_en: `${en} (planning assumption, ${h === 'now' ? 'today' : h})`, basis_ar: `${ar} (افتراض تخطيطي، ${h === 'now' ? 'اليوم' : h})`,
      simulated: true, sources: [{ label: 'OECD AI Capability Indicators (scale and dimensions)', url: OECD, as_of: READ_ON }], sort: ++k,
    }));
  }
  const levels = T.ai_capability_levels;
  const fig = (id, benchmark, en, ar, value, unit, url, noteEn, noteAr) => ({ id, benchmark_id: benchmark, label_en: en, label_ar: ar, value, unit, note_en: noteEn, note_ar: noteAr, sources: [{ url, as_of: READ_ON }], as_of: READ_ON });
  T.ai_exposure_refs = [
    fig('ref-ssg-tasks-aided', 'SSG-SF', 'Share of key work tasks that can be significantly aided by AI with today\'s technology (Singapore)', 'نسبة مهام العمل الرئيسية التي يمكن للذكاء الاصطناعي أن يساعد فيها بشكل كبير بتقنيات اليوم (سنغافورة)', 24, '%', SSG,
      'SkillsFuture Singapore study 1 (2025); a different method from this exposure rule, shown as a reference line only', 'دراسة سكلز فيوتشر سنغافورة الأولى (2025)؛ منهجية مختلفة عن قاعدة التعرض هذه، تُعرض كخط مرجعي فقط'),
    fig('ref-ssg-tasks', 'SSG-SF', 'Key work tasks analysed for AI potential (Singapore)', 'مهام العمل الرئيسية التي حُللت لإمكانات الذكاء الاصطناعي (سنغافورة)', 37000, 'tasks', SSG, 'About 37,000 tasks across about 2,000 job roles', 'نحو 37,000 مهمة في نحو 2,000 دور وظيفي'),
    fig('ref-ssg-roles', 'SSG-SF', 'Job roles covered by the task study (Singapore)', 'الأدوار الوظيفية التي شملتها دراسة المهام (سنغافورة)', 2000, 'roles', SSG, '', ''),
    fig('ref-oecd-dims', 'OECD-AICI', 'OECD AI capability dimensions', 'أبعاد قدرات الذكاء الاصطناعي لدى منظمة التعاون الاقتصادي والتنمية', 10, 'dimensions', OECD, 'Nine are rated for work tasks; consciousness is not a task requirement', 'تُقيَّم تسعة منها للمهام؛ الوعي ليس متطلباً للمهام'),
    fig('ref-oecd-levels', 'OECD-AICI', 'Levels on the OECD capability scale', 'مستويات مقياس القدرات لدى المنظمة', 5, 'levels', OECD, '', ''),
    fig('ref-onet-growth', 'ONET', 'O*NET Bright Outlook growth threshold (2025-2035 projection)', 'عتبة النمو في تصنيف O*NET للتوقعات المشرقة (توقعات 2025-2035)', 5, '%', ONET, 'Published thresholds are what make a badge trusted; Kafa\'a publishes its driver-badge threshold the same way', 'العتبات المنشورة هي ما يجعل الشارة موثوقة؛ وتنشر كفاءة عتبة شارة المحرّك بالطريقة نفسها'),
  ].map((r, i) => ({ ...r, sort: i + 1 }));

  const tsl = T.task_skill_links ?? [];
  T.jta_task_skills = [];
  let rated = 0;
  for (const t of tasks) {
    if (t.restricted) { Object.assign(t, { ai_capability_needed: null, exposure: null, change_horizon: null, tech_driver: null, future_by: null, future_on: null }); continue; }
    const arch = A[BY_CODE[t.code]];
    if (!arch) throw new Error(`fs06: no archetype for ${t.code}`);
    const needs = canonNeeds(arch[0]);
    const ex = exposureOf({ needs, change_horizon: arch[2], critical: !!t.critical, restricted: false }, levels);
    const by = ['MNT', 'MTE', 'RP', 'RPT', 'CHEM', 'CT', 'QA', 'QAQ'].some((p) => t.code.startsWith(p)) ? ANALYST : TM;
    Object.assign(t, { ai_capability_needed: needs, exposure: ex.exposure, change_horizon: arch[2], tech_driver: arch[1], future_by: by, future_on: by === TM ? '2026-09-12' : '2026-09-16' });
    rated++;
    // skills
    const cur = [];
    if (t.task_item_id) for (const l of tsl.filter((x) => x.task_id === t.task_item_id).sort((a, b) => a.sort - b.sort)) cur.push([l.skill_id, l.need_level, 'qual_map']);
    else {
      for (const [s, lv] of ROLE_SKILLS[t.role_id] ?? []) cur.push([s, lv, 'analyst']);
      for (const [re, s, lv] of KEYWORDS) if (re.test(t.title_en)) cur.push([s, lv, 'analyst']);
    }
    const seen = new Set();
    const rows = [];
    for (const [s, lv, src] of cur) { if (seen.has(s) || !skills.has(s) || skills.get(s).area === 'security') continue; seen.add(s); rows.push({ s, lv, kind: 'current', src }); }
    const fut = ex.exposure !== 'human_core' ? FUTURE_SKILL[arch[1]] : null;
    if (fut && !seen.has(fut[0])) rows.push({ s: fut[0], lv: fut[1], kind: 'future', src: 'analyst' });
    rows.slice(0, 6).forEach((r, i) => T.jta_task_skills.push({ id: `jts:${t.id}:${r.s}`, task_id: t.id, skill_id: r.s, level: r.lv, kind: r.kind, source: r.src, active: true, linked_by: r.src === 'qual_map' ? null : by, linked_at: ts(by === TM ? '2026-09-12' : '2026-09-16'), sort: i + 1 }));
  }

  // SAT analysts: the training manager designated one instructor; a second designation was withdrawn
  const person = new Map((T.people ?? []).map((p) => [p.id, p]));
  const nm = (id) => ({ en: person.get(id)?.display_name ?? '', ar: person.get(id)?.display_name_ar || person.get(id)?.display_name || '' });
  T.sat_analysts = [
    { id: `sa-${ANALYST}`, person_id: ANALYST, active: true, name: nm(ANALYST).en, name_ar: nm(ANALYST).ar, designated_by: TM, designated_on: '2026-09-01', history: [{ at: ts('2026-09-01'), by: TM, active: true }] },
    { id: 'sa-p-head-sq', person_id: 'p-head-sq', active: false, name: nm('p-head-sq').en, name_ar: nm('p-head-sq').ar, designated_by: TM, designated_on: '2026-09-30',
      history: [{ at: ts('2026-09-01'), by: TM, active: true }, { at: ts('2026-09-30'), by: TM, active: false }] },
  ];

  // SAT change log: a short history of future edits (closed at once, no review items)
  const byCode = new Map(tasks.map((t) => [t.code, t]));
  const snap = (t, patch = {}) => {
    const s = { needs: t.ai_capability_needed, exposure: t.exposure, change_horizon: t.change_horizon, tech_driver: t.tech_driver, skills: T.jta_task_skills.filter((x) => x.task_id === t.id).map((x) => `${x.skill_id}:${x.level}:${x.kind}`), title_en: t.title_en, title_ar: t.title_ar, ...patch };
    if (patch.needs || patch.change_horizon) s.exposure = exposureOf({ needs: canonNeeds(s.needs), change_horizon: s.change_horizon, critical: !!t.critical, restricted: false }, levels).exposure;
    if (patch.needs) s.needs = canonNeeds(patch.needs);
    return s;
  };
  T.sat_changes = T.sat_changes ?? [];
  HISTORY.forEach(([code, day, by, patch, summary], i) => {
    const t = byCode.get(code);
    if (!t) throw new Error(`fs06: history task ${code} missing`);
    const n = nm(by);
    T.sat_changes.push({
      id: `sc-fx-${String(i + 1).padStart(3, '0')}`, task_id: t.id, role_id: t.role_id, kind: 'modified', trigger: 'task_change', area: 'future',
      summary: summary || futureSummaryLine(t), before: snap(t, patch), after: snap(t), impact: {}, status: 'closed',
      opened_by: by, opened_by_name: n.en, opened_by_name_ar: n.ar, opened_at: ts(day, '10:30'), closed_at: ts(day, '10:30'),
    });
    t.future_on = day; t.future_by = by;
  });
  const s = futureSummary(tasks);
  if (rated !== tasks.filter((t) => !t.restricted).length) throw new Error('fs06: not every non-restricted task is rated');
  if (process.env.FS06_REPORT) console.log('fs06', JSON.stringify(s));
}
