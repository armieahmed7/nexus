// F32 (wave 5 · w5e1) seed: stackable micro-credential definitions and awards.
// build(): 14 definition rows (11 published, one superseded version, one draft, one retired), with criteria over F01 evidence.
// finalize() (FINALIZE_LAST, after f01 derives every skill state): awards for synthetic staff and personas from the real evidence,
// signed with the server issuer key (key-1) exactly as kafaa_mc_issue signs them. Awards here write no F01 `credential` evidence
// (it would change earlier waves' derived snapshots); the first award or renewal made in the app writes it.
import { readFileSync } from 'node:fs';
import { signingBytes, withProof } from '../../../src/modules/m17/issuer.ts';
import { edSign, fromHex, sha256, toHex, utf8 } from '../../../src/modules/m17/badgeCrypto.ts';
import { addDays, addMonths, alignedSkills, awardView, buildMicrocredCredential, componentsOf, eligibility, evidenceSnapshot, latestAward, validateDef } from '../../../src/modules/m17/microcred.ts';

export const FINALIZE_LAST = true;
const MIGRATION = 'supabase/migrations/20261009111001_kafaa_w1e1_passport.sql';
const serverSeed = () => {
  const m = readFileSync(MIGRATION, 'utf8').match(/kafaa_badge_issuer_seed\(\)[\s\S]*?'\\x([0-9a-f]{64})'::bytea/);
  if (!m) throw new Error(`f32: issuer seed not found in ${MIGRATION}`);
  return fromHex(m[1]);
};
const h = (s) => parseInt(toHex(sha256(utf8(`kafaa-f32:${s}`))).slice(0, 8), 16);
const slugFor = (id) => `mc${toHex(sha256(utf8(`kafaa-seed-mc:${id}`))).slice(0, 12)}`;
const ts = (d, hh = 9) => `${d}T${String(hh).padStart(2, '0')}:00:00Z`;

const C = (key, kind, ref, label_en, label_ar, min_level = null) => ({ key, kind, ref, min_level: kind === 'skill' ? min_level ?? 2 : null, label_en, label_ar });
const ROLES_OPS = ['local-operator', 'reactor-operator', 'senior-reactor-operator', 'shift-supervisor'];
// [code, version, status, kind, area, level, title_en, title_ar, summary_en, summary_ar, criteria, stacks_into, alignment, role_ids, validity, hours, effective, change_reason]
const DEFS = [
  ['MC-HU-PRAC', 1, 'current', 'micro', 'human_performance', 'practitioner', 'Human performance tools practitioner', 'ممارس أدوات الأداء البشري',
    'Uses the core human performance tools (self-checking, peer-checking, pre-job briefs) on real work and can show it.', 'يستخدم أدوات الأداء البشري الأساسية (التحقق الذاتي، تحقق الزميل، الإحاطة قبل العمل) في العمل الفعلي ويستطيع إثبات ذلك.',
    [C('course', 'course', 'c-hu', 'Completed HU-101 Human performance core tools (inside its 24-month validity)', 'إكمال دورة HU-101 أدوات الأداء البشري الأساسية (ضمن صلاحيتها البالغة 24 شهرًا)'),
     C('check', 'assessment', 'form-l2-post-c-hu', 'Passed the HU-101 knowledge check after the course', 'اجتياز اختبار المعرفة لدورة HU-101 بعد الدورة'),
     C('brief', 'skill', 'sk-hu-02-brief', 'Pre-job briefs and post-job reviews at level 2 or above (verified, evidenced or validated)', 'الإحاطة قبل العمل والمراجعة بعده بمستوى 2 فأعلى (موثّق أو مُثبت أو مُصادق عليه)', 2)],
    'MC-HP-CHAMPION', [{ skill_id: 'sk-hu-01-star', level: 2 }, { skill_id: 'sk-hu-02-brief', level: 2 }], [...ROLES_OPS, 'maintenance-technician-engineer', 'operations-support-work-control'], 24, 16, '2025-06-01', 'First published'],
  ['MC-SCWE', 1, 'current', 'micro', 'human_performance', 'foundation', 'Speak-up and safety-conscious work environment', 'التحدث بحرية وبيئة العمل الواعية بالسلامة',
    'Knows the routes for raising concerns and practises a questioning attitude in daily work.', 'يعرف قنوات إثارة المخاوف ويمارس الموقف التساؤلي في العمل اليومي.',
    [C('course', 'course', 'c-scwe', 'Completed SCWE-101 Safety-conscious work environment', 'إكمال دورة SCWE-101 بيئة العمل الواعية بالسلامة'),
     C('check', 'assessment', 'form-l2-post-c-scwe', 'Passed the SCWE-101 knowledge check after the course', 'اجتياز اختبار المعرفة لدورة SCWE-101 بعد الدورة')],
    'MC-HP-CHAMPION', [{ skill_id: 'sk-sc-01', level: 2 }], [], 24, 6, '2025-06-01', 'First published'],
  ['MC-OE-REVIEW', 1, 'current', 'micro', 'safety', 'practitioner', 'Operating experience reviewer', 'مراجع الخبرة التشغيلية',
    'Has reviewed industry operating experience with a team and turned it into lessons for the station.', 'راجع الخبرة التشغيلية في القطاع مع فريق وحوّلها إلى دروس للمحطة.',
    [C('oe', 'opportunity', 'kind:oe_review', 'Completed an operating experience review opportunity (marketplace)', 'إكمال فرصة لمراجعة الخبرة التشغيلية (السوق الداخلي)'),
     C('course', 'course', 'c-hu', 'Completed HU-101 Human performance core tools', 'إكمال دورة HU-101 أدوات الأداء البشري الأساسية')],
    'MC-HP-CHAMPION', [{ skill_id: 'sk-ns-01', level: 1 }, { skill_id: 'sk-sc-01', level: 1 }], ['shift-supervisor', 'senior-reactor-operator', 'nuclear-oversight-npi'], 24, 20, '2025-06-01', 'First published'],
  ['MC-HP-CHAMPION', 1, 'current', 'stack', 'human_performance', 'advanced', 'Human performance champion', 'رائد الأداء البشري',
    'Stacked credential: practitioner in the human performance tools, speak-up culture and operating experience review.', 'اعتماد مركّب: ممارس لأدوات الأداء البشري وثقافة التحدث بحرية ومراجعة الخبرة التشغيلية.',
    [], null, [{ skill_id: 'sk-hu-01', level: 2 }, { skill_id: 'sk-sc-02', level: 1 }], ['shift-supervisor', 'operations-support-work-control', 'nuclear-oversight-npi'], 36, null, '2025-06-01', 'First published'],
  ['MC-DATA-FOUND', 1, 'current', 'micro', 'digital', 'foundation', 'Plant data foundations', 'أساسيات بيانات المحطة',
    'Reads plant and work data with care and uses it to follow system health.', 'يقرأ بيانات المحطة والعمل بعناية ويستخدمها لمتابعة سلامة الأنظمة.',
    [C('data', 'skill', 'sk-da-01', 'Digital tools and data literacy at level 2 or above (validated or evidenced)', 'الأدوات الرقمية ومحو الأمية في البيانات بمستوى 2 فأعلى (مُصادق عليه أو مُثبت)', 2),
     C('health', 'skill', 'sk-en-02', 'System health monitoring at level 1 or above', 'مراقبة سلامة الأنظمة بمستوى 1 فأعلى', 1)],
    'MC-DIGITAL-PLANT', [{ skill_id: 'sk-da-01', level: 2 }], ['systems-design-plant-engineer', 'quality-assurance-qc', 'operations-support-work-control'], 24, 12, '2024-06-01', 'First published'],
  ['MC-DATA-ANALYSIS', 1, 'superseded', 'micro', 'digital', 'practitioner', 'Data analysis and visualisation', 'تحليل البيانات وتصويرها',
    'Turns plant or training data into a clear chart and a conclusion others can check.', 'يحوّل بيانات المحطة أو التدريب إلى رسم واضح واستنتاج يمكن للآخرين التحقق منه.',
    [C('analysis', 'skill', 'sk-da-01-analysis', 'Data analysis and visualisation at level 1 or above', 'تحليل البيانات وتصويرها بمستوى 1 فأعلى', 1),
     C('sample', 'manual', '', 'A data-analysis work sample reviewed by a training manager', 'نموذج عمل في تحليل البيانات يراجعه مدير التدريب')],
    'MC-DIGITAL-PLANT', [{ skill_id: 'sk-da-01-analysis', level: 1 }], ['systems-design-plant-engineer'], 24, 20, '2025-09-01', 'First published'],
  ['MC-DATA-ANALYSIS', 2, 'current', 'micro', 'digital', 'practitioner', 'Data analysis and visualisation', 'تحليل البيانات وتصويرها',
    'Turns plant or training data into a clear chart and a conclusion others can check; the work sample is reviewed.', 'يحوّل بيانات المحطة أو التدريب إلى رسم واضح واستنتاج يمكن للآخرين التحقق منه، مع مراجعة نموذج العمل.',
    [C('analysis', 'skill', 'sk-da-01-analysis', 'Data analysis and visualisation at level 2 or above', 'تحليل البيانات وتصويرها بمستوى 2 فأعلى', 2),
     C('sample', 'manual', '', 'A data-analysis work sample reviewed by a training manager', 'نموذج عمل في تحليل البيانات يراجعه مدير التدريب')],
    'MC-DIGITAL-PLANT', [{ skill_id: 'sk-da-01-analysis', level: 2 }], ['systems-design-plant-engineer', 'quality-assurance-qc'], 24, 24, '2026-03-01', 'Level 2 now required; work sample review kept'],
  ['MC-AI-LIT', 1, 'current', 'micro', 'digital', 'foundation', 'Governed AI literacy', 'محو الأمية في الذكاء الاصطناعي المُحكَم',
    'Uses AI tools inside the governance rules and checks AI outputs before relying on them.', 'يستخدم أدوات الذكاء الاصطناعي ضمن قواعد الحوكمة ويتحقق من مخرجاتها قبل الاعتماد عليها.',
    [C('course', 'course', 'c-ai-gov', 'Completed DA-101 Governed use of AI at work', 'إكمال دورة DA-101 الاستخدام المُحكَم للذكاء الاصطناعي في العمل'),
     C('review', 'skill', 'sk-da-02', 'Governed use of AI at level 1 or above', 'الاستخدام المُحكَم للذكاء الاصطناعي بمستوى 1 فأعلى', 1)],
    'MC-DIGITAL-PLANT', [{ skill_id: 'sk-da-02', level: 2 }, { skill_id: 'sk-da-02-review', level: 1 }], [], 24, 8, '2025-09-01', 'First published'],
  ['MC-DIGITAL-PLANT', 1, 'current', 'stack', 'digital', 'advanced', 'Digital plant foundations', 'أسس المحطة الرقمية',
    'Stacked credential: plant data foundations, data analysis and governed AI literacy.', 'اعتماد مركّب: أساسيات بيانات المحطة وتحليل البيانات ومحو الأمية في الذكاء الاصطناعي المُحكَم.',
    [], null, [{ skill_id: 'sk-da-01', level: 2 }], ['systems-design-plant-engineer', 'operations-support-work-control'], 36, null, '2025-09-01', 'First published'],
  ['MC-OUTAGE-PLAN', 1, 'current', 'micro', 'maintenance', 'practitioner', 'Outage work planning', 'تخطيط أعمال الانقطاع',
    'Plans outage work packages with risk-graded pre-job briefs, from walkdown to schedule.', 'يخطط حزم أعمال الانقطاع مع إحاطات قبل العمل متدرجة حسب المخاطر، من جولة التفقد إلى الجدول الزمني.',
    [C('planning', 'skill', 'sk-mp-01-outage', 'Outage work planning and scheduling at level 2 or above', 'تخطيط أعمال الانقطاع وجدولتها بمستوى 2 فأعلى', 2),
     C('brief', 'skill', 'sk-hu-02-brief', 'Pre-job briefs and post-job reviews at level 2 or above', 'الإحاطة قبل العمل والمراجعة بعده بمستوى 2 فأعلى', 2)],
    'MC-OUTAGE-PRO', [{ skill_id: 'sk-mp-01-outage', level: 2 }], ['outage-manager-planner', 'operations-support-work-control', 'maintenance-technician-engineer'], 24, 30, '2024-06-01', 'First published'],
  ['MC-OUTAGE-SUPPORT', 1, 'current', 'micro', 'maintenance', 'foundation', 'Outage support experience', 'خبرة دعم أعمال الانقطاع',
    'Has supported a refuelling outage on the floor and applies the human performance tools while doing it.', 'دعم انقطاعًا لإعادة التزود بالوقود ميدانيًا ويطبّق أدوات الأداء البشري أثناء ذلك.',
    [C('outage', 'opportunity', 'kind:outage_support', 'Completed an outage support opportunity (marketplace)', 'إكمال فرصة لدعم الانقطاع (السوق الداخلي)'),
     C('course', 'course', 'c-hu', 'Completed HU-101 Human performance core tools', 'إكمال دورة HU-101 أدوات الأداء البشري الأساسية')],
    'MC-OUTAGE-PRO', [{ skill_id: 'sk-mp-01', level: 1 }], ['local-operator', 'reactor-operator', 'maintenance-technician-engineer'], 24, 40, '2025-06-01', 'First published'],
  ['MC-OUTAGE-PRO', 1, 'current', 'stack', 'maintenance', 'advanced', 'Outage professional', 'محترف أعمال الانقطاع',
    'Stacked credential: outage work planning and hands-on outage support experience.', 'اعتماد مركّب: تخطيط أعمال الانقطاع وخبرة دعم الانقطاع الميدانية.',
    [], null, [{ skill_id: 'sk-mp-01-outage', level: 2 }], ['outage-manager-planner', 'operations-support-work-control'], 36, null, '2025-06-01', 'First published'],
  ['MC-PROJECT', 1, 'current', 'micro', 'project', 'practitioner', 'Project controls essentials', 'أساسيات ضبط المشاريع',
    'Plans, tracks and reports a small station project with an agreed brief.', 'يخطط لمشروع صغير في المحطة ويتابعه ويبلّغ عنه وفق موجز متفق عليه.',
    [C('controls', 'skill', 'sk-en-01-project', "Project controls and owner's engineering at level 2 or above", 'ضبط المشاريع وهندسة المالك بمستوى 2 فأعلى', 2),
     C('brief', 'manual', '', 'Project brief and close-out reviewed by a training manager', 'موجز المشروع وتقرير إغلاقه يراجعهما مدير التدريب')],
    null, [{ skill_id: 'sk-en-01-project', level: 2 }], ['outage-manager-planner', 'systems-design-plant-engineer'], 36, 24, '2024-06-01', 'First published'],
  ['MC-COACH', 1, 'current', 'micro', 'leadership', 'practitioner', 'Coaching on shift', 'التوجيه أثناء الوردية',
    'Gives timely, specific coaching and feedback to colleagues during shift work.', 'يقدّم توجيهًا وملاحظات محددة وفي وقتها للزملاء أثناء العمل في الوردية.',
    [C('coach', 'skill', 'sk-ld-01-coach', 'Coaching and feedback at level 2 or above', 'التوجيه والملاحظات بمستوى 2 فأعلى', 2),
     C('lead', 'skill', 'sk-ld-01', 'Leading effective teams at level 2 or above', 'قيادة فرق فعّالة بمستوى 2 فأعلى', 2)],
    null, [{ skill_id: 'sk-ld-01-coach', level: 2 }], ['shift-supervisor', 'senior-reactor-operator', 'nuclear-training-instructor'], 24, 12, '2024-06-01', 'First published'],
  ['MC-TWINS', 1, 'draft', 'micro', 'digital', 'advanced', 'Digital twins explorer', 'مستكشف التوائم الرقمية',
    'Has worked on a digital twin study and can explain what a plant data model can and cannot show.', 'عمل على دراسة توأم رقمي ويستطيع شرح ما يمكن لنموذج بيانات المحطة إظهاره وما لا يمكنه.',
    [C('twins', 'skill', 'sk-da-01-twins', 'Digital twins and plant data models at level 2 or above', 'التوائم الرقمية ونماذج بيانات المحطة بمستوى 2 فأعلى', 2),
     C('study', 'opportunity', 'opp-digital-twin-study', 'Completed the digital twin feasibility study (marketplace)', 'إكمال دراسة جدوى التوأم الرقمي (السوق الداخلي)')],
    null, [{ skill_id: 'sk-da-01-twins', level: 2 }], ['systems-design-plant-engineer'], 24, 40, null, 'Draft for review'],
  ['MC-SHIFT-COMMS', 1, 'retired', 'micro', 'operations', 'foundation', 'Shift turnover communications', 'التواصل عند تسليم الوردية',
    'Retired: folded into the operations continuing training cycle.', 'أُوقف: دُمج في دورة التدريب المستمر للعمليات.',
    [C('comms', 'skill', 'sk-co-02', 'Shift turnover and communications at level 2 or above', 'تسليم الوردية والتواصل بمستوى 2 فأعلى', 2)],
    null, [{ skill_id: 'sk-co-02', level: 1 }], ROLES_OPS, 24, 4, '2024-09-01', 'Retired: covered by LOCT/COCT'],
];

export default function build(T) {
  T.microcred_defs = DEFS.map(([code, version, status, kind, area, level, title_en, title_ar, summary_en, summary_ar, criteria, stacks_into, alignment, role_ids, validity_months, hours, effective, change_reason], i) => ({
    id: `mcd-${code.toLowerCase()}-v${version}`, code, version, kind, area, level, title_en, title_ar, summary_en, summary_ar, criteria, stacks_into, alignment, role_ids, validity_months, hours,
    status, effective_date: effective, supersedes_id: version > 1 ? `mcd-${code.toLowerCase()}-v${version - 1}` : null, change_reason, sort: (i + 1) * 10,
    updated_by: 'p-training-mgr', updated_at: ts(effective ?? '2026-10-01'), published_by: status === 'draft' ? null : 'p-training-mgr', published_at: status === 'draft' ? null : ts(effective ?? '2026-10-01'),
  }));
  T.microcred_awards = [];
  // every published definition passes the same validation the RPC applies (copy check, no security or mirror criteria)
  const w = { defs: T.microcred_defs, courses: T.courses, forms: T.assessment_forms, opportunities: T.opportunities, skills: T.skills, competencies: T.competencies, job_roles: T.job_roles, qual_standards: T.qual_standards };
  for (const d of T.microcred_defs) {
    const v = validateDef({ ...d, stacks_into: d.stacks_into ?? null }, { ...w, defs: T.microcred_defs.filter((x) => x.id !== d.id) });
    if (v.code !== 'ok') throw new Error(`f32: definition ${d.id} fails validation: ${v.code}`);
  }
}

// Personas whose stories are fixed (issue dates after their evidence). Everything else follows the deterministic spread below.
const FIXED = {
  'p-k-ro': [['MC-HU-PRAC', '2025-12-20'], ['MC-SCWE', '2026-05-20'], ['MC-OE-REVIEW', '2026-08-04'], ['MC-HP-CHAMPION', '2026-08-11']],
  'p-sro': [['MC-HU-PRAC', '2025-12-29'], ['MC-SCWE', '2026-05-27']],
  // stacked credential whose planning component has since expired: "renewal due" until the component is renewed
  'w-lo-02': [['MC-OUTAGE-PLAN', '2024-09-16'], ['MC-HU-PRAC', '2026-01-05'], ['MC-OUTAGE-SUPPORT', '2026-06-05'], ['MC-OUTAGE-PRO', '2026-06-12']],
  // coaching credential inside the 60-day renewal window; the coaching skill is still validated, so it can be renewed now
  'w-sro-05': [['MC-COACH', '2024-11-24']],
};
const PENDING = [['p-sro', 'MC-PROJECT', '2026-10-02']];
// left unawarded on purpose (live demo: earn it in the app): qc-inspector MC-DATA-FOUND
const HOLD = new Set(['p-qc-inspector:MC-DATA-FOUND', 'p-training-mgr:MC-COACH']);

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const seed = serverSeed();
  const defs = T.microcred_defs;
  const awards = T.microcred_awards;
  const base = { defs, awards, courses: T.courses, training_records: T.training_records, attempts: T.attempts, opportunities: T.opportunities, opportunity_applications: T.opportunity_applications, person_skills: T.person_skills };
  const people = new Map(T.people.map((p) => [p.id, p]));
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();
  const current = defs.filter((d) => d.status === 'current');
  const micro = current.filter((d) => d.kind === 'micro').sort((a, b) => (a.code < b.code ? -1 : 1));
  const stacks = current.filter((d) => d.kind === 'stack').sort((a, b) => (a.code < b.code ? -1 : 1));
  const evDate = (e) => e.criteria.flatMap((c) => c.evidence.map((x) => x.date)).filter(Boolean).sort().pop() ?? null;

  const issue = (def, pid, issued, approvedBy = null) => {
    const id = `mca-${pid}-${def.code.toLowerCase()}-${issued.replace(/-/g, '')}`;
    const e = eligibility(def, pid, { ...base, today: issued });
    const slug = slugFor(id);
    const skills = alignedSkills(def, T.skills, T.competencies);
    const comps = e.components.map((c) => ({ slug: awards.find((a) => a.id === c.award_id)?.public_slug ?? '', code: c.code, title_en: c.title_en }));
    const validTo = addMonths(issued, def.validity_months);
    const cred = buildMicrocredCredential({ slug, def, holderInitials: people.get(pid)?.initials || '—', issuedOn: issued, validTo, alignment: skills, components: comps, keyId: 'key-1' });
    const prev = latestAward(awards, pid, def.code);
    if (prev) prev.status = 'superseded';
    awards.push({
      id, def_id: def.id, def_code: def.code, def_version: def.version, person_id: pid, holder_initials: people.get(pid)?.initials || '—', status: 'awarded', requested_at: ts(issued, 8),
      issued_on: issued, valid_to: validTo, evidence: evidenceSnapshot(e, approvedBy, issued), component_award_ids: e.components.map((c) => c.award_id).filter(Boolean),
      credential: withProof(cred, edSign(signingBytes(cred), seed)), key_id: 'key-1', public_slug: slug, renewed_from: prev?.id ?? null,
      decided_by: approvedBy, decided_at: approvedBy ? ts(issued, 11) : null, decision_note: approvedBy ? 'Work sample reviewed against the criteria; meets the level.' : null,
      revoked_at: null, revoke_reason: null, created_at: ts(issued, 8),
    });
  };

  // personas first (fixed stories)
  for (const [pid, list] of Object.entries(FIXED)) for (const [code, on] of list) issue(current.find((d) => d.code === code), pid, on);
  // the spread: micro-credentials for every staff member whose evidence met (or once met) the criteria
  for (const pid of staff) {
    if (FIXED[pid]) continue;
    for (const def of micro) {
      if (HOLD.has(`${pid}:${def.code}`)) continue;
      const now = eligibility(def, pid, { ...base, today });
      const lapsedOnly = now.criteria.every((c) => c.kind === 'manual' || c.met || c.status === 'lapsed') && now.criteria.some((c) => c.status === 'lapsed');
      if (!now.auto_met && !lapsedOnly) continue;
      const k = h(`${pid}:${def.code}`);
      if (k % 10 >= 7) continue; // eligible but not yet claimed
      const last = evDate(now);
      // dated evidence (course, assessment, opportunity): a few days after it; skill states only: spread since the definition was published
      let issued = last ? addDays(last < (def.effective_date ?? '') ? def.effective_date : last, 3 + (k % 40)) : addDays(def.effective_date ?? '2025-06-01', 10 + (k % 760));
      if (issued > today) issued = addDays(today, -(5 + (k % 60)));
      const by = now.manual > 0 ? 'p-training-mgr' : null;
      if (now.manual > 0 && k % 10 >= 5) continue;
      issue(def, pid, issued, by);
      // an expired award renewed before it lapsed for some holders (renewal chain: the old award is superseded)
      const vt = addMonths(issued, def.validity_months);
      if (vt < today && (k >> 4) % 2 === 0) issue(def, pid, addDays(vt, -20), by);
    }
  }
  // stacks: awarded a week after the last component when every component was valid on that day
  for (const pid of [...Object.keys(FIXED).filter((p) => p !== 'p-k-ro'), ...staff.filter((p) => !FIXED[p])]) {
    for (const def of stacks) {
      if (latestAward(awards, pid, def.code)) continue;
      const comps = componentsOf(defs, def.code).map((cd) => latestAward(awards, pid, cd.code));
      if (!comps.length || comps.some((a) => !a)) continue;
      const on = addDays(comps.map((a) => a.issued_on).sort().pop(), 7);
      if (on > today || comps.some((a) => a.valid_to < on)) continue;
      if (h(`${pid}:${def.code}`) % 10 >= 8) continue;
      issue(def, pid, on);
    }
  }
  // requests waiting for a training manager (manual criteria)
  for (const [pid, code, on] of PENDING) {
    const def = current.find((d) => d.code === code);
    const e = eligibility(def, pid, { ...base, today });
    if (!e.auto_met) throw new Error(`f32: pending request ${pid} ${code} is not eligible`);
    const id = `mca-${pid}-${code.toLowerCase()}-req`;
    awards.push({
      id, def_id: def.id, def_code: def.code, def_version: def.version, person_id: pid, holder_initials: people.get(pid)?.initials || '—', status: 'pending_approval', requested_at: ts(on, 10),
      issued_on: null, valid_to: null, evidence: evidenceSnapshot(e, null, on), component_award_ids: [], credential: {}, key_id: null, public_slug: null, renewed_from: null,
      decided_by: null, decided_at: null, decision_note: null, revoked_at: null, revoke_reason: null, created_at: ts(on, 10),
    });
    T.notifications.push({ id: `nt-mc-${id}-p-training-mgr`, person_id: 'p-training-mgr', kind: 'microcred', title_en: `Micro-credential to confirm: ${code}`, title_ar: `اعتماد مصغّر بانتظار التأكيد: ${code}`,
      body_en: null, body_ar: null, link: '/admin/frameworks?tab=microcredentials', severity: 'info', created_at: ts(on, 10), read_at: null });
  }
  // one withdrawn award (holder changed role) and one declined request, for the history views
  const wd = awards.find((a) => a.status === 'awarded' && a.def_code === 'MC-SCWE' && !FIXED[a.person_id] && !awards.some((x) => x.component_award_ids.includes(a.id)));
  if (wd) Object.assign(wd, { status: 'revoked', revoked_at: ts(addDays(wd.issued_on, 30) < addDays(today, -5) ? addDays(wd.issued_on, 30) : addDays(today, -5), 12), revoke_reason: 'Withdrawn by the holder after a change of role.' });
  const dc = staff.find((p) => !FIXED[p] && eligibility(current.find((d) => d.code === 'MC-PROJECT'), p, { ...base, today }).auto_met && !latestAward(awards, p, 'MC-PROJECT'));
  if (dc) {
    const def = current.find((d) => d.code === 'MC-PROJECT');
    const e = eligibility(def, dc, { ...base, today });
    awards.push({
      id: `mca-${dc}-mc-project-req`, def_id: def.id, def_code: def.code, def_version: def.version, person_id: dc, holder_initials: people.get(dc)?.initials || '—', status: 'declined', requested_at: ts('2026-08-18', 10),
      issued_on: null, valid_to: null, evidence: evidenceSnapshot(e, null, '2026-08-18'), component_award_ids: [], credential: {}, key_id: null, public_slug: null, renewed_from: null,
      decided_by: 'p-training-mgr', decided_at: ts('2026-08-20', 14), decision_note: 'The project brief is still open: resubmit after the close-out review.', revoked_at: null, revoke_reason: null, created_at: ts('2026-08-18', 10),
    });
  }
  awards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // sanity: every awarded stack lists valid components at issue; statuses as of today are a mix
  const mix = new Set(awards.map((a) => awardView(a, today, awards).status));
  for (const s of ['active', 'renewal_due', 'expired', 'pending_approval', 'superseded']) if (!mix.has(s)) console.warn(`f32: no ${s} award in the seed`);
}
