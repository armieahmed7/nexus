// F33 (wave 5 · w5e2) seed: the contractor and supplier skills passport (M09). Synthetic people and synthetic engagements only.
//   people                   23 more synthetic contractor staff at the three synthetic suppliers (Al Noor 12, Gulf Hydro-Valve 9,
//                            Dhafra 10 plus the k-contractor persona), with ENEC role profiles (maintenance, QA/QC, radiation protection).
//   certificates/enrolments  supplier academy completions (the M09 academy shape: completed enrolment + SA-CERT certificate), one expired.
//   equivalency_requests     six more ENEC equivalency decisions and requests (equivalent, training required with a mapping, open).
//   contractor_engagements   SIMULATED mirror of past ENEC engagements (outage support, maintenance windows) with supervisor sign-offs.
//   contract_role_targets    the ENEC role profiles each supplier is contracted for, with headcount bands.
//   task_skill_links         the task → skill map behind the equivalency pre-check (TASK_LINKS).
//   skill_evidence           contractorEvidence() for every contractor person (certificates, equivalency decisions, engagements); existing
//                            contractors keep their onboarding self-ratings (the exact F01 fallback rows), so no seeded row disappears.
// finalize (after F01 derives the states): person_skills and skill_evidence rows of contractor people carry org_id and contractor = true
// (the F33 read rules), every other row org_id null and contractor false (kafaa_cp_stamp).
import { contractorEvidence, contractorOrgOf, taskLinkRows } from '../../../src/modules/m09/contractor.ts';

// id, name_en, name_ar, initials, role, discipline, tier (number of past engagements)
const NEW_PEOPLE = [
  ['c-alnoor-04', 'Imran Qureshi', 'عمران قريشي', 'IQ', 'maintenance-technician-engineer', 'elec', 3],
  ['c-alnoor-05', 'Hessa Al Dhaheri', 'حصة الظاهري', 'HD', 'quality-assurance-qc', 'qa', 2],
  ['c-alnoor-06', 'Mohammed Al Nuaimi', 'محمد النعيمي', 'MN', 'maintenance-technician-engineer', 'mech', 2],
  ['c-alnoor-07', 'Ravi Pillai', 'رافي بيلاي', 'RP', 'maintenance-technician-engineer', 'mech', 1],
  ['c-alnoor-08', 'Omar Haddad', 'عمر حداد', 'OH', 'maintenance-technician-engineer', 'elec', 2],
  ['c-alnoor-09', 'Joseph Mensah', 'جوزيف منساه', 'JM', 'maintenance-technician-engineer', 'mech', 3],
  ['c-alnoor-10', 'Khalid Al Shamsi', 'خالد الشامسي', 'KS', 'maintenance-technician-engineer', 'mech', 1],
  ['c-alnoor-11', 'Ana Reyes', 'آنا رييس', 'AR', 'quality-assurance-qc', 'qa', 1],
  ['c-alnoor-12', 'Yousef Al Hammadi', 'يوسف الحمادي', 'YH', 'maintenance-technician-engineer', 'elec', 1],
  ['c-gulf-03', 'Tariq Mahmood', 'طارق محمود', 'TM', 'maintenance-technician-engineer', 'mech', 3],
  ['c-gulf-04', 'Salem Al Mazrouei', 'سالم المزروعي', 'SM', 'maintenance-technician-engineer', 'mech', 2],
  ['c-gulf-05', 'Priya Nair', 'بريا ناير', 'PN', 'quality-assurance-qc', 'qa', 2],
  ['c-gulf-06', 'Mustafa Kaya', 'مصطفى كايا', 'MK', 'maintenance-technician-engineer', 'mech', 1],
  ['c-gulf-07', 'Abdulla Al Romaithi', 'عبدالله الرميثي', 'AR', 'maintenance-technician-engineer', 'mech', 2],
  ['c-gulf-08', 'Kofi Boateng', 'كوفي بواتينغ', 'KB', 'maintenance-technician-engineer', 'elec', 1],
  ['c-gulf-09', 'Layla Al Suwaidi', 'ليلى السويدي', 'LS', 'quality-assurance-qc', 'qa', 1],
  ['c-dhafra-04', 'Ahmed Al Mansoori', 'أحمد المنصوري', 'AM', 'radiation-protection-technician', 'rp', 3],
  ['c-dhafra-05', 'Bilal Rana', 'بلال رانا', 'BR', 'maintenance-technician-engineer', 'mech', 2],
  ['c-dhafra-06', 'Noura Al Kaabi', 'نورة الكعبي', 'NK', 'radiation-protection-technician', 'rp', 2],
  ['c-dhafra-07', 'George Thomas', 'جورج توماس', 'GT', 'maintenance-technician-engineer', 'mech', 1],
  ['c-dhafra-08', 'Hamdan Al Falasi', 'حمدان الفلاسي', 'HF', 'radiation-protection-technician', 'rp', 1],
  ['c-dhafra-09', 'Sanjay Verma', 'سانجاي فيرما', 'SV', 'maintenance-technician-engineer', 'elec', 2],
  ['c-dhafra-10', 'Fatima Al Hosani', 'فاطمة الحوسني', 'FH', 'radiation-protection-technician', 'rp', 1],
];
// Existing contractor staff: discipline and tier for their synthetic work history.
const EXISTING = [
  ['c-alnoor-01', 'mech', 3], ['c-alnoor-02', 'mech', 2], ['c-alnoor-03', 'qa', 1], ['c-gulf-01', 'elec', 2], ['c-gulf-02', 'mech', 1],
  ['c-dhafra-01', 'mech', 1], ['c-dhafra-02', 'rp', 2], ['c-dhafra-03', 'mech', 1],
];
// Synthetic ENEC engagements (no real outage dates or scopes).
const ENG = [
  ['RFO-U1-2025', '2025-03-02', '2025-04-20', 'Unit 1 refuelling outage support (synthetic)', 'دعم انقطاع إعادة التزود بالوقود في الوحدة 1 (اصطناعي)'],
  ['RFO-U2-2025', '2025-09-14', '2025-11-02', 'Unit 2 refuelling outage support (synthetic)', 'دعم انقطاع إعادة التزود بالوقود في الوحدة 2 (اصطناعي)'],
  ['MCM-U3-2026', '2026-02-08', '2026-03-12', 'Unit 3 mid-cycle maintenance window (synthetic)', 'نافذة صيانة منتصف الدورة في الوحدة 3 (اصطناعي)'],
  ['RFO-U4-2026', '2026-09-06', null, 'Unit 4 refuelling outage support (synthetic)', 'دعم انقطاع إعادة التزود بالوقود في الوحدة 4 (اصطناعي)'],
];
const SUP = {
  mech: ['Maintenance supervisor (role card)', 'مشرف الصيانة (بطاقة دور)'], elec: ['Electrical maintenance supervisor (role card)', 'مشرف الصيانة الكهربائية (بطاقة دور)'],
  qa: ['QC supervisor (role card)', 'مشرف مراقبة الجودة (بطاقة دور)'], rp: ['RP supervisor (role card)', 'مشرف الوقاية من الإشعاع (بطاقة دور)'],
};
const ROLE = { mech: 'maintenance-technician-engineer', elec: 'maintenance-technician-engineer', qa: 'quality-assurance-qc', rp: 'radiation-protection-technician' };
// Skills an ENEC supervisor signs off per discipline: [skill, level at the first engagement, level from the second, level from the third]
const SIGN = {
  mech: [['sk-mp-01-mech', 2, 2, 3], ['sk-mp-01', 2, 2, 3], ['sk-hu-01-star', 1, 2, 2], ['sk-rp-01', 1, 1, 2], ['sk-co-01', 0, 2, 2]],
  elec: [['sk-mp-01-elec', 2, 2, 3], ['sk-mp-02', 1, 2, 2], ['sk-hu-01-star', 2, 2, 2], ['sk-pf-03-elec', 0, 1, 2], ['sk-rp-01', 1, 1, 1]],
  qa: [['sk-qa-01-inspect', 2, 2, 3], ['sk-qa-01', 2, 2, 3], ['sk-qa-02', 1, 2, 2], ['sk-hu-01', 1, 2, 2]],
  rp: [['sk-rp-02-survey', 2, 2, 3], ['sk-rp-02', 2, 2, 3], ['sk-rp-01', 2, 2, 2], ['sk-rp-01-dose', 1, 2, 2], ['sk-hu-02-brief', 0, 1, 2]],
};
// Supplier academy courses per discipline (all are qualifying, two-year certificates).
const ACADEMY = { mech: ['c-sa-nqa1-101', 'c-sa-sc-104'], elec: ['c-sa-nqa1-101', 'c-sa-sc-104'], qa: ['c-sa-nqa1-101', 'c-sa-cfsi-102', 'c-sa-cgd-103', 'c-sa-def-107'], rp: ['c-sa-sc-104', 'c-sa-def-107'] };
const ORG_OF = (id) => (id.startsWith('c-alnoor') ? 'org-alnoor' : id.startsWith('c-gulf') ? 'org-gulfhydro' : 'org-dhafra');

const hist = (at, action, status, role, note) => ({ at, action, status, by_role: role, note });

export default function build(T, ctx) {
  const DEMO = ctx.DEMO_TODAY;
  const before = new Set(T.people.map((p) => p.id));
  const orgKind = (o) => T.organisations.find((x) => x.id === o)?.kind;

  // ── people
  for (const [id, en, ar, ini, role] of NEW_PEOPLE) {
    T.people.push({
      id, persona_id: null, display_name: en, display_name_ar: ar, initials: ini, kind: 'contractor', entity_id: null, org_id: ORG_OF(id), job_role_id: role,
      job_family_id: null, team_id: null, crew: null, unit: null, level: 'professional', nationality_flag: 'unknown', gender: null, language: 'en',
      digits: 'latn', hire_date: null, status: 'active', manager_id: null, synthetic: true, notes: 'Contractor staff (synthetic)',
    });
  }
  const discipline = new Map([...NEW_PEOPLE.map((p) => [p[0], [p[5], p[6]]]), ...EXISTING.map(([id, d, t]) => [id, [d, t]])]);

  // ── supplier academy certificates (with their completed enrolments), the M09 academy shape
  let certNo = Math.max(...T.certificates.filter((c) => /^SA-CERT-\d+$/.test(c.id)).map((c) => Number(c.id.slice(8))));
  const hasCert = new Set(T.certificates.map((c) => `${c.person_id}:${c.course_id}`));
  const enrolled = new Set(T.enrolments.map((e) => `${e.person_id}:${e.course_id}`));
  let k = 0;
  for (const [pid, [d]] of discipline) {
    for (const course of ACADEMY[d]) {
      if (hasCert.has(`${pid}:${course}`) || enrolled.has(`${pid}:${course}`)) continue;
      k++;
      const id = `SA-CERT-${String(++certNo).padStart(5, '0')}`;
      const month = String(((k * 5) % 11) + 1).padStart(2, '0');
      const day = String(((k * 7) % 25) + 2).padStart(2, '0');
      const expired = pid === 'c-gulf-06' && course === 'c-sa-sc-104';
      const issued = expired ? '2024-03-10' : `${k % 3 === 0 ? 2025 : 2026}-${k % 3 === 0 ? month : String(((k * 5) % 8) + 1).padStart(2, '0')}-${day}`;
      const validTo = `${Number(issued.slice(0, 4)) + 2}${issued.slice(4)}`;
      const p = T.people.find((x) => x.id === pid);
      T.enrolments.push({
        id: `en-cp-${id.toLowerCase()}`, person_id: pid, course_id: course, session_id: null, org_id: p.org_id, status: 'completed', source: 'partner_admin', assigned_by: null,
        due_on: issued, enrolled_at: `${issued}T06:00:00Z`, progress_pct: 100, completed_at: `${issued}T08:00:00Z`, score: 76 + ((k * 3) % 20), certificate_no: id,
        evaluation_id: null, attendance: null, waitlisted_at: null, decided_by: null, decision_note: null,
      });
      T.certificates.push({ id, person_id: pid, org_id: p.org_id, holder_initials: p.initials, course_id: course, issued_on: issued, valid_to: validTo, status: expired ? 'expired' : 'valid', enrolment_id: `en-cp-${id.toLowerCase()}`, issued_by: null });
    }
  }

  // ── engagements (SIMULATED work-history mirror) for every contractor with a discipline, and the k-contractor persona
  const engagements = [];
  for (const [pid, [d, tier]] of discipline) {
    const p = T.people.find((x) => x.id === pid);
    const slots = tier >= 3 ? [0, 1, 2] : tier === 2 ? [1, 2] : [2];
    slots.forEach((e, n) => {
      const [code, from, to, en, ar] = ENG[e];
      engagements.push({
        id: `ce-${pid}-${n + 1}`, person_id: pid, org_id: p.org_id, ref_code: `ENG-${code}`, title_en: en, title_ar: ar, role_id: ROLE[d], started_on: from, ended_on: to,
        status: 'signed_off', supervisor_role_en: SUP[d][0], supervisor_role_ar: SUP[d][1], source: 'mirror', created_at: `${to}T12:00:00Z`,
        skills: SIGN[d].map(([s, l1, l2, l3]) => ({ skill_id: s, level: n === 0 ? l1 : n === 1 ? l2 : l3 })).filter((x) => x.level > 0),
      });
    });
    if (tier >= 2) {
      const [code, from, , en, ar] = ENG[3];
      engagements.push({ id: `ce-${pid}-${slots.length + 1}`, person_id: pid, org_id: p.org_id, ref_code: `ENG-${code}`, title_en: en, title_ar: ar, role_id: ROLE[d], started_on: from, ended_on: null, status: 'in_progress', supervisor_role_en: SUP[d][0], supervisor_role_ar: SUP[d][1], source: 'mirror', created_at: `${from}T12:00:00Z`, skills: [] });
    }
  }
  const kc = 'p-k-contractor';
  engagements.push(
    { id: `ce-${kc}-1`, person_id: kc, org_id: 'org-dhafra', ref_code: 'ENG-RFO-U1-2025', title_en: ENG[0][3], title_ar: ENG[0][4], role_id: 'maintenance-technician-engineer', started_on: ENG[0][1], ended_on: ENG[0][2], status: 'signed_off', supervisor_role_en: SUP.mech[0], supervisor_role_ar: SUP.mech[1], source: 'mirror', created_at: `${ENG[0][2]}T12:00:00Z`, skills: [{ skill_id: 'sk-mp-01', level: 1 }, { skill_id: 'sk-hu-01-star', level: 2 }, { skill_id: 'sk-rp-01', level: 1 }] },
    { id: `ce-${kc}-2`, person_id: kc, org_id: 'org-dhafra', ref_code: 'ENG-RFO-U2-2025', title_en: ENG[1][3], title_ar: ENG[1][4], role_id: 'maintenance-technician-engineer', started_on: ENG[1][1], ended_on: ENG[1][2], status: 'signed_off', supervisor_role_en: SUP.mech[0], supervisor_role_ar: SUP.mech[1], source: 'mirror', created_at: `${ENG[1][2]}T12:00:00Z`, skills: [{ skill_id: 'sk-mp-01', level: 2 }, { skill_id: 'sk-mp-01-mech', level: 2 }, { skill_id: 'sk-hu-01', level: 2 }] },
    { id: `ce-${kc}-3`, person_id: kc, org_id: 'org-dhafra', ref_code: 'ENG-RFO-U4-2026', title_en: ENG[3][3], title_ar: ENG[3][4], role_id: 'maintenance-technician-engineer', started_on: ENG[3][1], ended_on: null, status: 'in_progress', supervisor_role_en: SUP.mech[0], supervisor_role_ar: SUP.mech[1], source: 'mirror', created_at: `${ENG[3][1]}T12:00:00Z`, skills: [] },
  );
  T.contractor_engagements = engagements.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ── more ENEC equivalency decisions and requests (decided rows carry a full evaluator mapping, as decideEquivalency requires)
  const tasks = (std) => T.task_items.filter((t) => t.standard_id === std).sort((a, b) => a.sort - b.sort);
  const ev2 = [{ name: 'Training certificate (redacted)', kind: 'certificate' }, { name: 'Employer reference', kind: 'reference' }];
  const eq = (id, pid, label, std, status, by, decider, decidedAt, note, covered, admin) => {
    const map = status === 'submitted' ? [] : tasks(std).map((t) => ({ task_id: t.id, covered: covered ? covered.includes(t.id) : true, evidence: covered && !covered.includes(t.id) ? [] : [0, 1], note: covered && !covered.includes(t.id) ? 'Not evidenced' : 'Observed or evidenced' }));
    const h = [hist('2026-09-21T08:00:00Z', 'submit', 'submitted', 'partner_admin', '2 evidence items')];
    if (status !== 'submitted') h.push(hist('2026-09-25T08:00:00Z', 'map', 'under_review', 'instructor', 'Evidence mapped to the task list'));
    if (decidedAt) h.push(hist(decidedAt, 'decide', status, 'instructor', note));
    T.equivalency_requests.push({
      id, org_id: ORG_OF(pid), person_id: pid, person_label: label, standard_id: std, evidence: ev2, status, decision_note: decidedAt ? note : null,
      decider_role: decidedAt ? 'Instructor / evaluator' : null, decided_by: decidedAt ? by : null, decided_at: decidedAt, submitted_at: '2026-09-21T08:00:00Z',
      mapping: map, history: h, submitted_by: admin,
    });
  };
  eq('eq-8', 'c-alnoor-04', 'Contractor technician A-04', 'qs-elec', 'equivalent', 'p-head-sq', true, '2026-09-30T08:00:00Z', 'Evidence maps to every task; insulation test observed.', null, 'p-alnoor-gm');
  eq('eq-9', 'c-gulf-03', 'Contractor technician G-03', 'qs-mech', 'equivalent', 'p-sq-lead', true, '2026-10-01T08:00:00Z', 'Evidence maps to every task; FME controls observed.', null, 'p-gulfhydro-qa');
  eq('eq-10', 'c-dhafra-04', 'RP contractor D-04', 'qs-rp', 'equivalent', 'p-rp-lead', true, '2026-09-29T08:00:00Z', 'Survey and RWP tasks evidenced by two outage sign-offs.', null, 'p-k-contractor');
  eq('eq-11', 'c-alnoor-05', 'Contractor inspector A-05', 'qs-qa', 'training_required', 'p-head-sq', true, '2026-10-03T08:00:00Z', 'Audit planning evidenced; no evidence of leading an audit team.', ['qs-qa-t1'], 'p-alnoor-gm');
  eq('eq-12', 'c-dhafra-05', 'Outage contractor D-05', 'qs-get', 'equivalent', 'p-training-mgr', true, '2026-09-27T08:00:00Z', 'GET equivalent: site induction and HU refresher evidenced.', null, 'p-k-contractor');
  eq('eq-13', 'c-gulf-04', 'Contractor technician G-04', 'qs-mech', 'under_review', null, false, null, null, ['qs-mech-t2', 'qs-mech-t4'], 'p-gulfhydro-qa');

  // ── contracted ENEC role profiles
  const crt = (org, role, band, ref, en, ar) => ({ id: `crt-${org}-${role}`, org_id: org, role_id: role, headcount_band: band, contract_ref: ref, scope_en: en, scope_ar: ar, valid_from: '2026-01-01', valid_to: '2027-12-31', active: true, set_by: 'p-k-admin', updated_at: '2026-09-01T08:00:00Z' });
  T.contract_role_targets = [
    crt('org-alnoor', 'maintenance-technician-engineer', '10-24', 'SYN-ALN-OS-2026', 'Mechanical and electrical outage support (synthetic contract)', 'دعم ميكانيكي وكهربائي أثناء الانقطاعات (عقد اصطناعي)'),
    crt('org-alnoor', 'quality-assurance-qc', '1-4', 'SYN-ALN-QC-2026', 'Receiving inspection and QC support (synthetic contract)', 'دعم فحص الاستلام ومراقبة الجودة (عقد اصطناعي)'),
    crt('org-gulfhydro', 'maintenance-technician-engineer', '5-9', 'SYN-GHV-VS-2026', 'Valve maintenance services (synthetic contract)', 'خدمات صيانة الصمامات (عقد اصطناعي)'),
    crt('org-gulfhydro', 'quality-assurance-qc', '1-4', 'SYN-GHV-QC-2026', 'Valve QC inspection (synthetic contract)', 'فحص جودة الصمامات (عقد اصطناعي)'),
    crt('org-dhafra', 'maintenance-technician-engineer', '5-9', 'SYN-DIS-OS-2026', 'Outage maintenance labour (synthetic contract)', 'عمالة صيانة الانقطاعات (عقد اصطناعي)'),
    crt('org-dhafra', 'radiation-protection-technician', '1-4', 'SYN-DIS-RP-2026', 'RP technician support during outages (synthetic contract)', 'دعم فنيي الوقاية من الإشعاع أثناء الانقطاعات (عقد اصطناعي)'),
  ];
  T.task_skill_links = taskLinkRows(T.task_items);

  // ── passport evidence for every contractor person, plus the onboarding self-ratings existing contractors already had
  const world = {
    skills: T.skills, comps: T.competencies, courses: T.courses, standards: T.qual_standards, roleComps: T.role_competencies,
    certificates: T.certificates, equivalency: T.equivalency_requests, engagements: T.contractor_engagements,
  };
  for (const p of T.people) {
    if (!contractorOrgOf(p, orgKind)) continue;
    const rows = contractorEvidence(p.id, world, DEMO);
    if (!rows.length) continue;
    for (const e of rows) T.skill_evidence.push({ ...e, recorded_by: null });
    if (before.has(p.id) && !T.skill_evidence.some((e) => e.person_id === p.id && e.kind === 'rating')) {
      const on = String(p.hire_date ?? '2026-01-01').slice(0, 10);
      for (const [s, l] of [['sk-qa-01', 2], ['sk-sc-01', 1]])
        T.skill_evidence.push({ id: `se:rating:${p.id}:${s}`, person_id: p.id, skill_id: s, kind: 'rating', ref_table: 'people', ref_id: p.id, level: l, basis: 'claimed', status: 'current', observed_on: on, note: 'Self-rated at onboarding (synthetic profile)', recorded_by: p.id, active: true });
    }
  }
}

/** After F01 derived the states: stamp org scope on contractor rows (kafaa_cp_stamp). */
export function finalize(T) {
  const orgKind = new Map(T.organisations.map((o) => [o.id, o.kind]));
  const org = new Map(T.people.map((p) => [p.id, contractorOrgOf(p, (o) => orgKind.get(o))]));
  for (const t of ['person_skills', 'skill_evidence']) T[t] = T[t].map((r) => { const o = org.get(r.person_id) ?? null; return { ...r, org_id: o, contractor: o != null }; });
}
export const FINALIZE_LAST = true;
