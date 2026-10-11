// [FS wave D · E4] FS34 Transferable-skills translator + FS35 Career Health check (M18).
//  - occupation_templates: 12 source occupations outside nuclear (oil and gas, power, process, aviation, defence, utilities), each
//    an ESCO v1.2 occupation concept (URI, code, ISCO group, EN and AR preferred labels copied from the ESCO API on 2026-10-11,
//    fs34-esco.data.json). Each lists the Kafa'a skills it brings with a typical level for an experienced practitioner (a
//    template assumption, stated on the page), every skill tied to an essential or optional ESCO skill of that occupation; the
//    tie is "exact" when the FS08 crosswalk already aligns the Kafa'a skill to that same ESCO concept, else "related".
//  - health_snapshots: synthetic Career Health history for the staff personas (k-ro has three: two that ended in a career
//    conversation, the latest charted), computed with careerHealth() on the seeded records as of each snapshot date.
// Runs as a FINALIZE_LAST finalizer ("fs34" sorts after fs08, whose finalizer builds skill_alignments). The FS11 map uses the
// role profiles after the fsqa1 FS02 remap (same function as fs15), so snapshots match the final profiles in any order.
import { readFileSync } from 'node:fs';
import { templateProblems, translate } from '../../../src/modules/m18/translate.ts';
import { careerHealth } from '../../../src/modules/m18/careerHealth.ts';
import { transformRole } from '../../../src/modules/m30/transform.ts';
import { remapRequirements } from './fsqa1-integration.mjs';
import { FUTURE_SKILL_EQUIVALENT as EQ } from '../../../src/domain/taxonomy.ts';

export const FINALIZE_LAST = true;
const READ_ON = '2026-10-11';
const ESCO = JSON.parse(readFileSync(new URL('./fs34-esco.data.json', import.meta.url), 'utf8')).occupations;
const escoPage = (uri) => `https://esco.ec.europa.eu/en/classification/occupation?uri=${uri}`;

// [key, industry, title_en, title_ar, summary_en, summary_ar, [[skill_id, level, ESCO skill label (EN, verbatim)], ...]]
export const TEMPLATES = [
  ['oil-refinery-cro', 'oil_gas', 'Oil refinery control room operator', 'مشغّل غرفة التحكم في مصفاة نفط',
    'Runs a refinery unit from the control room: monitoring, shift handovers, emergency procedures and safety compliance.',
    'يدير وحدة في المصفاة من غرفة التحكم: المراقبة وتسليم المناوبات وإجراءات الطوارئ والامتثال لاشتراطات السلامة.',
    [['sk-co-02', 3, 'conduct inter-shift communication'], ['sk-co-01', 3, 'ensure compliance with safety legislation'], ['sk-co-01-eop', 3, 'manage emergency procedures'],
      ['sk-co-01-rounds', 3, 'monitor equipment condition'], ['sk-pf-02', 2, 'crude oil distillation processes'], ['sk-en-02', 2, 'troubleshoot'], ['sk-hu-01', 2, 'ensure compliance with safety legislation'],
      ['sk-ep-02', 2, 'manage emergency procedures'], ['sk-da-01-remote', 2, 'coordinate remote communications'], ['sk-fs-tr-dependable', 3, 'write production reports']]],
  ['gas-plant-cro', 'oil_gas', 'Gas processing plant control room operator', 'مشغّل غرفة التحكم في محطة معالجة الغاز',
    'Operates gas processing from the control room: equipment monitoring, communications, emergency procedures and production reporting.',
    'يشغّل معالجة الغاز من غرفة التحكم: مراقبة المعدات والاتصالات وإجراءات الطوارئ وتقارير الإنتاج.',
    [['sk-co-02', 3, 'conduct inter-shift communication'], ['sk-co-01-eop', 3, 'manage emergency procedures'], ['sk-co-01', 3, 'ensure compliance with safety legislation'],
      ['sk-co-01-rounds', 3, 'monitor equipment condition'], ['sk-pf-02', 2, 'gas dehydration processes'], ['sk-en-02', 2, 'troubleshoot'], ['sk-hu-01', 2, 'ensure compliance with safety legislation'],
      ['sk-da-01-remote', 2, 'coordinate remote communications'], ['sk-mp-01', 1, 'mechanics']]],
  ['power-plant-cro', 'power', 'Power plant control room operator', 'مشغّل غرفة التحكم في محطة توليد الكهرباء',
    'Controls a thermal power station from the control room: generators, electrical contingencies, remote equipment and shift communications.',
    'يتحكم في محطة توليد حرارية من غرفة التحكم: المولدات وحالات الطوارئ الكهربائية والمعدات عن بُعد واتصالات المناوبات.',
    [['sk-pf-02', 3, 'maintain power plant machinery'], ['sk-pf-03-elec', 2, 'respond to electrical power contingencies'], ['sk-pf-03-steam', 2, 'monitor electric generators'],
      ['sk-co-01', 3, 'ensure compliance with safety legislation'], ['sk-co-01-eop', 3, 'manage emergency procedures'], ['sk-co-02', 3, 'conduct inter-shift communication'],
      ['sk-co-01-rounds', 3, 'monitor equipment condition'], ['sk-mp-01-remote', 2, 'use remote control equipment'], ['sk-fs-ai-automation', 1, 'automation technology'],
      ['sk-hu-01', 2, 'electrical power safety regulations'], ['sk-ld-02-decide', 2, 'react to events in time-critical environments']]],
  ['chem-plant-cro', 'process', 'Chemical plant control room operator', 'مشغّل غرفة التحكم في مصنع كيميائي',
    'Controls chemical production remotely: plant monitoring, hazard reporting, incident reports and training colleagues.',
    'يتحكم في الإنتاج الكيميائي عن بُعد: مراقبة المصنع والإبلاغ عن المخاطر وتقارير الحوادث وتدريب الزملاء.',
    [['sk-co-01-rounds', 3, 'monitor plant production'], ['sk-da-01-remote', 2, 'control production flow remotely'], ['sk-co-02', 3, 'use communication equipment'],
      ['sk-en-02-perf', 2, 'optimise production processes parameters'], ['sk-qa-01', 2, 'good manufacturing practices'], ['sk-hu-02-brief', 2, 'report on possible equipment hazards'],
      ['sk-ld-01-instruct', 2, 'train employees'], ['sk-sc-01', 2, 'create incident reports'], ['sk-mp-01', 1, 'control minor maintenance'], ['sk-da-01', 2, 'manage data']]],
  ['aircraft-mt', 'aviation', 'Aircraft maintenance technician', 'فني صيانة الطائرات',
    'Maintains airframes, engines and systems to manufacturer documentation and aviation safety rules, with inspections and records.',
    'يصون هياكل الطائرات والمحركات والأنظمة وفق وثائق الشركة المصنّعة وقواعد سلامة الطيران، مع الفحوصات والسجلات.',
    [['sk-mp-01', 3, 'repair engines'], ['sk-mp-01-mech', 3, 'disassemble engines'], ['sk-mp-01-elec', 2, 'install electrical and electronic equipment'],
      ['sk-mp-02', 2, 'operate precision measuring equipment'], ['sk-qa-01-inspect', 2, 'inspect aircraft for airworthiness'], ['sk-co-01', 3, 'use technical documentation'],
      ['sk-hu-01', 3, 'manage health and safety standards'], ['sk-fs-dp-ework', 2, 'use computerised maintenance management systems'], ['sk-qa-01', 2, 'common aviation safety regulations'],
      ['sk-fs-tr-dependable', 3, 'follow manufacturer guidelines in use of airport equipment']]],
  ['avionics-tech', 'aviation', 'Avionics technician', 'فني إلكترونيات الطيران',
    'Installs, tests, calibrates and troubleshoots aircraft electrical and electronic systems.',
    'يركّب الأنظمة الكهربائية والإلكترونية للطائرات ويختبرها ويعايرها ويحدد أعطالها.',
    [['sk-mp-02', 3, 'calibrate electronic instruments'], ['sk-mp-01-elec', 3, 'maintain electrical equipment'], ['sk-fs-dp-dic', 2, 'electronics principles'],
      ['sk-en-02', 2, 'troubleshoot'], ['sk-mp-01', 2, 'keep records of work progress'], ['sk-hu-01', 2, 'apply health and safety standards'], ['sk-qa-01', 2, 'common aviation safety regulations'],
      ['sk-co-01', 2, 'follow procedures to control substances hazardous to health'], ['sk-fs-tr-techlit', 2, 'test electronic units']]],
  ['military-engineer', 'defence', 'Military engineering technician', 'فني هندسة عسكرية',
    'Maintains, tests and assures engineering equipment in the armed forces: quality control, risk analysis, emergency procedures and team leadership.',
    'يصون المعدات الهندسية ويختبرها ويضمن جودتها في القوات المسلحة: مراقبة الجودة وتحليل المخاطر وإجراءات الطوارئ وقيادة الفرق.',
    [['sk-qa-01-inspect', 2, 'oversee quality control'], ['sk-qa-01', 2, 'quality assurance procedures'], ['sk-en-01-mods', 2, 'design engineering components'],
      ['sk-ns-01-psa', 2, 'perform risk analysis'], ['sk-mp-01-elec', 2, 'maintain electrical equipment'], ['sk-mp-01', 3, 'perform maintenance on installed equipment'],
      ['sk-co-01-eop', 2, 'manage emergency procedures'], ['sk-mp-02', 2, 'calibrate electronic instruments'], ['sk-da-01-analysis', 2, 'perform data analysis'],
      ['sk-fs-dp-dic', 1, 'control systems'], ['sk-ld-01', 3, 'supervise the maintenance of military equipment'], ['sk-ld-02-decide', 3, 'decision support systems'], ['sk-en-01-project', 2, 'project management']]],
  ['instrument-tech', 'process', 'Instrumentation engineering technician', 'فني هندسة الأجهزة والقياس',
    'Builds, tests, calibrates and maintains instrumentation and control equipment in process plants.',
    'يجمّع أجهزة القياس والتحكم في المصانع ويختبرها ويعايرها ويصونها.',
    [['sk-mp-02', 3, 'calibrate electronic instruments'], ['sk-mp-01-remote', 2, 'use remote control equipment'], ['sk-fs-ai-automation', 2, 'automation technology'],
      ['sk-fs-dp-dic', 2, 'instrumentation equipment'], ['sk-mp-01', 3, 'conduct routine machinery checks'], ['sk-en-02', 2, 'test instrumentation equipment'],
      ['sk-qa-01-inspect', 2, 'inspect quality of products'], ['sk-hu-01', 2, 'wear appropriate protective gear'], ['sk-da-01', 2, 'statistical analysis system software'], ['sk-co-01', 2, 'ensure conformity to specifications']]],
  ['electrical-tech', 'power', 'Electrical engineering technician', 'فني الهندسة الكهربائية',
    'Tests, maintains and inspects electrical equipment and generators, working from drawings with engineers.',
    'يختبر المعدات الكهربائية والمولدات ويصونها ويفحصها، انطلاقاً من المخططات وبالتعاون مع المهندسين.',
    [['sk-mp-01-elec', 3, 'maintain electrical equipment'], ['sk-mp-02', 2, 'measure electrical characteristics'], ['sk-pf-03-elec', 2, 'electric generators'],
      ['sk-en-01', 2, 'adjust engineering designs'], ['sk-qa-01-inspect', 2, 'inspect quality of products'], ['sk-mp-01', 2, 'perform test run'], ['sk-hu-01', 2, 'electrical power safety regulations'],
      ['sk-pf-01', 1, 'nuclear energy'], ['sk-da-01', 1, 'record test data']]],
  ['desalination-tech', 'utilities', 'Desalination technician', 'فني تحلية المياه',
    'Runs and maintains desalination and water treatment plant: sampling, water testing, control systems and shift communications.',
    'يشغّل محطات تحلية المياه ومعالجتها ويصونها: أخذ العينات وفحص المياه وأنظمة التحكم واتصالات المناوبات.',
    [['sk-ch-01', 2, 'perform water treatment procedures'], ['sk-ch-01-primary', 2, 'collect samples'], ['sk-ch-02-labqa', 2, 'perform water testing procedures'],
      ['sk-co-02', 3, 'conduct inter-shift communication'], ['sk-en-02', 2, 'troubleshoot'], ['sk-da-01-remote', 2, 'manage desalination control system'], ['sk-hu-01', 2, 'apply health and safety standards'],
      ['sk-fs-tr-environment', 2, 'environmental legislation'], ['sk-ld-01-instruct', 2, 'train employees'], ['sk-mp-01', 2, 'perform minor repairs to equipment']]],
  ['hse-officer', 'oil_gas', 'Health and safety officer', 'مسؤول الصحة والسلامة',
    'Assesses and communicates workplace risk, audits compliance and teaches people about occupational and emergency hazards.',
    'يقيّم مخاطر بيئة العمل ويبلّغ عنها، ويدقق الامتثال، ويعرّف العاملين بالمخاطر المهنية ومخاطر الطوارئ.',
    [['sk-hu-02', 3, 'draw up risk assessment'], ['sk-hu-02-brief', 3, 'communicate health and safety measures'], ['sk-ns-01-psa', 2, 'perform risk analysis'],
      ['sk-sc-01', 3, 'advise on risk management'], ['sk-qa-01', 2, 'audit techniques'], ['sk-fs-tr-environment', 3, 'ensure compliance with environmental legislation'],
      ['sk-ld-01-coach', 2, 'educate employees on occupational hazards'], ['sk-ep-01', 2, 'educate on emergency management'], ['sk-hu-01', 3, 'health, safety and hygiene legislation']]],
  ['ndt-specialist', 'process', 'Non-destructive testing specialist', 'أخصائي الاختبارات غير الإتلافية',
    'Inspects structures and components with non-destructive methods (ultrasonic, penetrant, radiographic) and reports the findings.',
    'يفحص المنشآت والمكونات بطرق غير إتلافية (بالموجات فوق الصوتية والصبغات النافذة والتصوير الإشعاعي) ويبلّغ عن النتائج.',
    [['sk-qa-01-inspect', 3, 'use non-destructive testing equipment'], ['sk-qa-01', 2, 'quality standards'], ['sk-mp-02', 3, 'calibrate electronic instruments'],
      ['sk-ch-02-labqa', 2, 'analyse test data'], ['sk-rp-01', 1, 'make radiographic images'], ['sk-da-01', 2, 'record test data'], ['sk-co-01', 2, 'keep records of work progress'],
      ['sk-ld-01-instruct', 2, 'train employees'], ['sk-fs-tr-dependable', 3, 'report test findings']]],
];

export function buildTemplates(T) {
  const skillIds = new Set(T.skills.map((s) => s.id));
  const exact = new Set((T.skill_alignments ?? []).filter((a) => a.framework === 'esco' && a.status === 'published').map((a) => `${a.skill_id}|${a.external_code}`));
  return TEMPLATES.map(([key, industry, title_en, title_ar, summary_en, summary_ar, skills], i) => {
    const o = ESCO[key];
    if (!o) throw new Error(`fs34 seed: no ESCO data for ${key}`);
    const rows = skills.map(([skill_id, level, label]) => {
      const e = o.skills.find((s) => s.en === label);
      if (!e || !e.ar) throw new Error(`fs34 seed: ${key}: "${label}" is not an ESCO skill of ${o.label_en} (or has no Arabic label)`);
      const rel = e.rel;
      return {
        skill_id, level, esco_uri: e.uri, esco_label_en: e.en, esco_label_ar: e.ar, esco_relation: rel, match: exact.has(`${skill_id}|${e.uri}`) ? 'exact' : 'related',
        why_en: `ESCO ${rel} ${/knowledge/.test(e.uri) ? 'knowledge' : 'skill'} of this occupation: "${e.en}"`,
        why_ar: `${rel === 'essential' ? 'مهارة أساسية' : 'مهارة اختيارية'} لهذه المهنة في ESCO: «${e.ar}»`,
      };
    });
    const t = {
      id: `occ-${key}`, esco_uri: o.uri, esco_code: o.code, isco_code: o.isco, title_en, title_ar, esco_label_en: o.label_en, esco_label_ar: o.label_ar, industry, summary_en, summary_ar,
      skills: rows, sources: [{ label: `ESCO v1.2 · Occupation: ${o.label_en} (${o.code})`, url: escoPage(o.uri), as_of: READ_ON }],
      benchmark_ids: ['ESCO', 'UK-NUC', 'SMR-WF'], as_of: READ_ON, status: 'published', listed: true, sort: i + 1,
    };
    const p = templateProblems(t, skillIds);
    if (p.length) throw new Error(`fs34 seed: template ${t.id}: ${p.join(', ')}`);
    return t;
  });
}

/** The tables translate() reads, from the seed. */
export function trDataOf(T) {
  const w = T.engine_settings.find((s) => s.id === 'recommend')?.weights ?? {};
  return { roles: T.job_roles, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, courses: T.courses, links: T.course_skill_links ?? [], packs: T.course_pack_items ?? [], edges: T.career_paths,
    weights: Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v === 'number')) };
}

/** The health-check inputs for one person from the seed (FS11 map on the final, remapped role profiles). */
export function healthDataOf(T, personId) {
  const p = T.people.find((x) => x.id === personId);
  const mine = (rows) => (rows ?? []).filter((r) => r.person_id === personId);
  const versions = (T.role_profile_versions ?? []).map((v) => (v.horizon !== 'now' && (v.requirements ?? []).some((r) => r.kind === 'skill' && EQ[r.ref_id]) ? { ...v, requirements: remapRequirements(v.requirements) } : v));
  const role = T.job_roles.find((r) => r.id === p?.job_role_id);
  const map = role && (role.lifecycle ?? 'current') === 'current' ? transformRole({ role, map: (T.role_transformations ?? []).find((x) => x.role_id === role.id) ?? null, versions, tasks: T.jta_tasks ?? [], taskSkills: T.jta_task_skills ?? [], levels: T.ai_capability_levels ?? [], skills: T.skills, courses: T.courses, mine: mine(T.person_skills), horizon: '2030' }) : null;
  const w = T.engine_settings.find((s) => s.id === 'recommend')?.weights ?? {};
  return { person: { id: personId, job_role_id: p?.job_role_id ?? null }, roles: T.job_roles, roleComps: T.role_competencies, skills: T.skills, states: mine(T.person_skills), training: mine(T.training_records), external: mine(T.external_completions), pathways: mine(T.pathway_enrolments),
    weights: Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v === 'number')), map };
}

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
/** Snapshot dates per persona: k-ro has three; other staff personas one or two (deterministic). */
const KRO = [
  ['2025-09-22', { actions: ['refresh', 'learn', 'conversation'], note: 'Refresh my emergency procedure skills before requalification and talk about the SRO route.', review_on: '2026-03-31', focus_role_id: 'senior-reactor-operator' }, 'cc-p-k-ro-2025-h2'],
  ['2026-03-30', { actions: ['bridge', 'explore', 'conversation'], note: 'Start the AI output verification course; look at work control as a lateral option.', review_on: '2026-09-30', focus_role_id: 'senior-reactor-operator' }, 'cc-p-k-ro-2026-h1-1'],
  ['2026-09-28', { actions: ['bridge', 'broaden'], note: 'Digital I&C fundamentals this quarter; book the next conversation once the course is done.', review_on: '2027-03-31', focus_role_id: 'senior-reactor-operator' }, null],
];

export default function build() {}

export function finalize(T) {
  T.occupation_templates = buildTemplates(T);
  // sanity: every template translates into at least one role with a route
  const D = trDataOf(T);
  for (const t of T.occupation_templates) {
    const r = translate(D, t.skills.map((s) => ({ skill_id: s.skill_id, level: s.level })), t.industry);
    if (!r.results.length || !r.results.every((x) => x.reasons.length >= 3)) throw new Error(`fs34 seed: ${t.id} translates into no role`);
  }
  // FS35 snapshots
  const out = [];
  const staff = T.people.filter((p) => p.persona_id && p.kind === 'staff' && p.job_role_id && p.status === 'active').sort((a, b) => (a.id < b.id ? -1 : 1));
  const snap = (p, date, plan, conv, n) => {
    const res = careerHealth(healthDataOf(T, p.id), date);
    const step = conv ? 'executed' : plan.actions.length ? 'charted' : 'assessed';
    out.push({ id: `hs-${p.id}-${n}`, person_id: p.id, taken_at: `${date}T09:${String(10 + n).padStart(2, '0')}:00Z`, as_of: date, role_id: res.role_id, components: res.components, good: res.good, watch: res.watch, act: res.act,
      plan, step, conversation_id: conv, updated_at: `${date}T09:${String(20 + n).padStart(2, '0')}:00Z` });
  };
  for (const p of staff) {
    if (p.id === 'p-k-ro') { KRO.forEach(([d, plan, conv], i) => snap(p, d, plan, conv && T.career_conversations.some((c) => c.id === conv && c.person_id === p.id && c.prep_submitted_at) ? conv : null, i + 1)); continue; }
    const h = hash(p.id);
    const n = 1 + (h % 2);
    for (let i = 0; i < n; i++) {
      const month = ['2026-02-16', '2026-05-18', '2026-08-24'][(h >>> (4 + i)) % 3 + 0] ?? '2026-05-18';
      const date = i === 0 ? month : '2026-09-21';
      const plan = i === n - 1 && (h & 1) ? { actions: ['learn', 'explore'], note: '', review_on: '2027-03-31', focus_role_id: null } : { actions: [], note: '', review_on: null, focus_role_id: null };
      snap(p, date, plan, null, i + 1);
    }
  }
  T.health_snapshots = out.sort((a, b) => (a.id < b.id ? -1 : 1));
  const kro = out.filter((s) => s.person_id === 'p-k-ro');
  console.log(`fs34/35: ${T.occupation_templates.length} ESCO-aligned occupation templates (${T.occupation_templates.flatMap((t) => t.skills).filter((s) => s.match === 'exact').length} exact ESCO ties), ${out.length} health snapshots for ${new Set(out.map((s) => s.person_id)).size} staff (k-ro: ${kro.map((s) => `${s.as_of} ${s.good}/5 ${s.step}`).join(', ')})`);
}
