// F23 (wave 3 · w3e4) seed: the alumni and expert reserve. Synthetic members of the new person kind `alumni` (retired or moved-on
// ENEC staff, kept only in kafaa_alumni with no people row), `partner_alumni` (ended KHNP, KEPCO and Doosan secondments) and
// `pre_departure` (staff who consented early: the sme-reviewer and k-instructor personas and one senior instructor), plus the one
// seeded leaver (w-mnt-08) whose snapshot is frozen from F01. Manager reserve requests in every state (two waiting for HR),
// engagements in every state, five consented synthetic stories (one unlisted after its alumnus withdrew) and one withdrawn member
// awaiting erasure. No contact data anywhere. Counters use the same recount() as both backends (src/modules/m20/reserve.ts).
import { addMonths, bandOf, recount, snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true; // after f01-skills.mjs finalize (name order inside the "last" group): person_skills exist for the snapshots

const QUALIFIED_ROLES = new Set(['senior-reactor-operator', 'shift-supervisor', 'reactor-operator', 'local-operator', 'shift-technical-advisor', 'nuclear-training-instructor']);
/** Synthetic frozen snapshot for a departed member: the former role's competencies (core skill at the required level, +1 for long
 *  service, max 4) and up to four specialised skills of those competencies (one level below). Never a security-area skill. */
function synthSnapshot(T, roleId, years, extra = []) {
  const rcs = T.role_competencies.filter((r) => r.role_id === roleId);
  const skills = T.skills.filter((s) => s.area !== 'security');
  const out = new Map();
  for (const rc of rcs) {
    const core = skills.find((s) => s.core && s.competency_id === rc.competency_id);
    if (core) out.set(core.id, { skill_id: core.id, level: Math.min(4, rc.required_level + (years >= 12 ? 1 : 0)), basis: QUALIFIED_ROLES.has(roleId) ? 'verified' : 'evidenced' });
  }
  const spec = skills.filter((s) => !s.core && rcs.some((r) => r.competency_id === s.competency_id)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, 4);
  for (const s of spec) {
    const rc = rcs.find((r) => r.competency_id === s.competency_id);
    out.set(s.id, { skill_id: s.id, level: Math.max(1, Math.min(4, rc.required_level - 1 + (years >= 12 ? 1 : 0))), basis: 'evidenced' });
  }
  for (const [id, level] of extra) if (skills.some((s) => s.id === id)) out.set(id, { skill_id: id, level, basis: 'evidenced' });
  return snapshotFrom([...out.values()].map((x) => ({ ...x, active: true })), T.skills);
}

// [id, name_en, name_ar, kind, role, org, departed_on, reason, years, availability, hours, prefs, finder, headline_en, headline_ar, extra skills]
const DEPARTED = [
  ['alm-ops-01', 'Saeed Al Hammadi', 'سعيد الحمادي', 'alumni', 'shift-supervisor', 'enec-ops', '2025-06-30', 'retired', 14, 'open', 12, ['mentor', 'capture_interview', 'instructor'], true,
    'Former shift manager: first-cycle startups and outage command at Barakah', 'مدير وردية سابق: بدء التشغيل للدورة الأولى وقيادة الانقطاعات في براكة', [['sk-co-03-startup', 4], ['sk-ld-02-decide', 4]]],
  ['alm-ops-02', 'Hamad Al Nuaimi', 'حمد النعيمي', 'alumni', 'senior-reactor-operator', 'enec-ops', '2024-03-31', 'retired', 12, 'limited', 6, ['instructor', 'mentor'], true,
    'SRO for twelve years; simulator scenario author', 'كبير مشغلي مفاعل لاثني عشر عاماً؛ مؤلف سيناريوهات المحاكي', [['sk-co-01-eop', 4]]],
  ['alm-ops-03', 'Rashid Al Kaabi', 'راشد الكعبي', 'alumni', 'shift-technical-advisor', 'enec-ops', '2023-09-30', 'retired', 11, 'outage_only', 20, ['reviewer', 'capture_interview'], false,
    null, null, [['sk-ns-01-psa', 3]]],
  ['alm-eng-01', 'Graham Whitfield', 'غراهام ويتفيلد', 'alumni', 'systems-design-plant-engineer', 'enec-ops', '2022-12-31', 'retired', 9, 'limited', 8, ['reviewer', 'mentor'], true,
    'Design-change reviewer for secondary systems', 'مراجع تعديلات التصميم للأنظمة الثانوية', [['sk-en-01-mods', 4], ['sk-pf-03-steam', 3]]],
  ['alm-eng-02', 'Aisha Al Shamsi', 'عائشة الشامسي', 'alumni', 'reactor-engineer-core-physicist', 'enec-ops', '2026-02-28', 'moved_on', 8, 'open', 10, ['mentor', 'reviewer'], true,
    'Core physicist; reload design and startup physics testing', 'فيزيائية قلب المفاعل؛ تصميم إعادة التحميل واختبارات فيزياء بدء التشغيل', [['sk-pf-01-core', 4]]],
  ['alm-mnt-01', 'Mohammed Al Blooshi', 'محمد البلوشي', 'alumni', 'maintenance-technician-engineer', 'enec-ops', '2024-08-31', 'retired', 13, 'outage_only', 24, ['instructor', 'capture_interview'], true,
    'Valve and pump maintenance lead through four refuelling outages', 'قائد صيانة الصمامات والمضخات خلال أربعة انقطاعات لإعادة التزود بالوقود', [['sk-mp-01-mech', 4], ['sk-mp-01-outage', 3]]],
  ['alm-rp-01', 'Rajesh Pillai', 'راجيش بيلاي', 'alumni', 'radiation-protection-technician', 'enec-ops', '2021-05-31', 'retired', 10, 'limited', 4, ['capture_interview', 'reviewer'], false,
    null, null, [['sk-rp-01-dose', 4]]],
  ['alm-chem-01', 'Fatima Al Mansoori', 'فاطمة المنصوري', 'alumni', 'chemistry-technician', 'enec-ops', '2025-12-31', 'moved_on', 7, 'open', 8, ['mentor', 'instructor'], true,
    'Primary and secondary chemistry control; laboratory QA', 'التحكم الكيميائي في الدائرتين الأولية والثانوية؛ ضمان جودة المختبر', [['sk-ch-01-primary', 3]]],
  ['alm-qa-01', 'Omar Al Zaabi', 'عمر الزعابي', 'alumni', 'quality-assurance-qc', 'enec-ops', '2023-03-31', 'retired', 12, 'limited', 6, ['reviewer'], false, null, null, []],
  ['alm-lic-01', 'Khalfan Al Muhairi', 'خلفان المهيري', 'alumni', 'regulatory-affairs-licensing-engineer', 'enec-ops', '2022-06-30', 'retired', 13, 'limited', 6, ['reviewer', 'capture_interview', 'mentor'], true,
    'Licensing engineer for the Unit 1 to 4 operating licences', 'مهندس ترخيص لرخص تشغيل الوحدات من 1 إلى 4', [['sk-ns-02-licensing', 4], ['sk-ns-01-psa', 3]]],
  ['alm-trn-01', 'Maryam Al Suwaidi', 'مريم السويدي', 'alumni', 'nuclear-training-instructor', 'enec-ops', '2024-12-31', 'moved_on', 9, 'open', 16, ['instructor', 'mentor'], true,
    'Simulator instructor; SRO certification classes', 'مدربة المحاكي؛ دورات اعتماد كبار مشغلي المفاعل', [['sk-ld-01-instruct', 4]]],
  ['alm-ep-01', 'Sultan Al Dhaheri', 'سلطان الظاهري', 'alumni', 'emergency-preparedness-coordinator', 'enec-ops', '2020-09-30', 'retired', 12, 'paused', 0, ['capture_interview'], false, null, null, []],
  ['alm-hp-01', 'Noura Al Hosani', 'نورة الحوسني', 'alumni', 'human-performance-specialist', 'enec-ops', '2025-03-31', 'moved_on', 8, 'open', 10, ['mentor', 'instructor', 'reviewer'], true,
    'Human-performance coach for first-line supervisors', 'مدربة الأداء البشري للمشرفين المباشرين', [['sk-ld-01-coach', 3]]],
  ['alm-out-01', 'Abdulla Al Romaithi', 'عبدالله الرميثي', 'alumni', 'outage-manager-planner', 'enec-ops', '2024-05-31', 'retired', 11, 'outage_only', 30, ['mentor', 'capture_interview'], true,
    'Outage manager for the first refuelling outages of Units 1 and 2', 'مدير الانقطاعات لأول انقطاعات إعادة التزود بالوقود في الوحدتين 1 و2', [['sk-mp-01-outage', 4], ['sk-en-01-project', 3]]],
  ['alm-fuel-01', 'Victor Okafor', 'فيكتور أوكافور', 'alumni', 'nuclear-fuel-specialist', 'enec-ops', '2023-11-30', 'retired', 10, 'limited', 6, ['reviewer', 'capture_interview'], false, null, null, [['sk-pf-03-fuel', 3]]],
  ['alm-khnp-01', 'Park Jae-won', 'بارك جاي وون', 'partner_alumni', 'senior-reactor-operator', 'khnp', '2025-09-30', 'secondment_ended', 8, 'limited', 8, ['instructor', 'mentor', 'capture_interview'], true,
    'KHNP secondee: APR-1400 operations mentor for Barakah crews', 'معار من الشركة الكورية: موجّه تشغيل لمفاعلات APR-1400 لأطقم براكة', [['sk-co-01-eop', 4], ['sk-pf-03-rcs', 4]]],
  ['alm-khnp-02', 'Kim Min-seo', 'كيم مين سو', 'partner_alumni', 'reactor-engineer-core-physicist', 'khnp', '2024-12-31', 'secondment_ended', 6, 'open', 10, ['reviewer', 'mentor'], true,
    'APR-1400 core design reviewer (ended secondment)', 'مراجعة تصميم قلب مفاعل APR-1400 (انتهت الإعارة)', [['sk-pf-01-core', 4]]],
  ['alm-kps-01', 'Choi Dong-hyun', 'تشوي دونغ هيون', 'partner_alumni', 'maintenance-technician-engineer', 'kepco-kps', '2026-04-30', 'secondment_ended', 7, 'outage_only', 30, ['instructor', 'capture_interview'], false, null, null, [['sk-mp-02-dic', 3]]],
  ['alm-kec-01', 'Yoon Seo-jin', 'يون سو جين', 'partner_alumni', 'systems-design-plant-engineer', 'kepco-ec', '2023-06-30', 'secondment_ended', 9, 'limited', 6, ['reviewer'], false, null, null, []],
  ['alm-dsn-01', 'Han Ji-ho', 'هان جي هو', 'partner_alumni', 'quality-assurance-qc', 'doosan', '2025-01-31', 'secondment_ended', 5, 'limited', 4, ['reviewer', 'instructor'], false, null, null, [['sk-qa-02-cgd', 3]]],
  ['alm-ops-04', 'Yousef Al Marri', 'يوسف المري', 'alumni', 'local-operator', 'enec-ops', '2024-01-31', 'retired', 10, 'limited', 6, ['mentor'], false, null, null, []],
];
// Members who consented while still employed (snapshot frozen from their F01 state at consent): [person, consent_on, availability, hours, prefs, finder, headline_en, headline_ar]
const PRE = [
  ['p-sme-reviewer', '2026-09-15', 'open', 8, ['reviewer', 'capture_interview', 'mentor'], true, 'Plant engineering SME; happy to review design changes after I retire', 'خبير هندسة المحطة؛ يسعدني مراجعة تعديلات التصميم بعد التقاعد'],
  ['p-k-instructor', '2026-09-28', 'limited', 6, ['instructor', 'mentor'], false, null, null],
  ['w-instr-01', '2026-08-31', 'limited', 8, ['instructor', 'capture_interview'], true, 'Senior simulator instructor; retiring in 2027', 'كبير مدربي المحاكي؛ يتقاعد في 2027'],
];

const at = (d, hh = '09:00:00') => `${d}T${hh}Z`;
const H = (d, status, by, note = null, hh) => ({ at: at(d, hh), status, by, note });

// [id, poster, engagement, title_en, title_ar, summary_en, summary_ar, skills, hours, seats, location, start, end, status, created, hr: [by, date, note] | null]
const REQUESTS = [
  ['rr-cap-startup', 'p-ops-ceo', 'capture_interview', 'Capture interview: first-cycle startup lessons for the Unit 4 crews', 'مقابلة توثيق: دروس بدء التشغيل للدورة الأولى لأطقم الوحدة 4',
    'Two recorded sessions with a retired shift manager on the decisions, surprises and rules of thumb from the first-cycle startups, so the Unit 4 crews and the knowledge base keep them.',
    'جلستان مسجلتان مع مدير وردية متقاعد حول القرارات والمفاجآت والقواعد العملية من بدء التشغيل للدورة الأولى، لتحتفظ بها أطقم الوحدة 4 وقاعدة المعرفة.',
    ['sk-co-03-startup', 'sk-co-01-eop', 'sk-pf-03-rcs'], 16, 2, 'office', '2026-10-20', '2026-12-15', 'open', '2026-09-28', ['p-chco', '2026-10-02', 'Fits the KHNP handover capture window']],
  ['rr-mentor-outage', 'p-outage-manager', 'mentor', 'Outage mentoring for two new outage planners (Unit 3 refuelling)', 'إرشاد في الانقطاعات لمخططَين جديدين (إعادة تزويد الوحدة 3 بالوقود)',
    'Fortnightly mentoring for two outage planners through the Unit 3 refuelling outage: critical path, work-package readiness and pre-job briefs.',
    'إرشاد كل أسبوعين لمخططَي انقطاعات خلال انقطاع إعادة تزويد الوحدة 3 بالوقود: المسار الحرج وجاهزية حزم العمل وإحاطات ما قبل العمل.',
    ['sk-mp-01-outage', 'sk-hu-02-brief', 'sk-en-01-project'], 24, 1, 'site_non_protected', '2026-11-01', '2027-02-28', 'open', '2026-09-30', ['p-chco', '2026-10-03', null]],
  ['rr-review-chem', 'p-chem-sup', 'reviewer', 'Independent review of the secondary-chemistry control programme', 'مراجعة مستقلة لبرنامج التحكم الكيميائي في الدائرة الثانوية',
    'An experienced chemist reviews the secondary-chemistry control limits, sampling plan and laboratory QA against industry guidelines and writes a short findings note.',
    'يراجع كيميائي متمرس حدود التحكم الكيميائي في الدائرة الثانوية وخطة أخذ العينات وضمان جودة المختبر مقابل الإرشادات الصناعية ويكتب مذكرة نتائج قصيرة.',
    ['sk-ch-01', 'sk-ch-02-labqa', 'sk-ch-02'], 20, 1, 'remote', '2026-10-26', '2026-12-31', 'open', '2026-10-01', ['p-chco', '2026-10-05', null]],
  ['rr-instr-alara', 'p-rp-lead', 'instructor', 'Guest instructor: ALARA job planning workshop for RP technicians', 'مدرب ضيف: ورشة تخطيط الأعمال وفق مبدأ ALARA لفنيي الوقاية من الإشعاع',
    'A one-day workshop, delivered twice, on dose estimates, survey maps and ALARA reviews for high-dose outage work, using de-identified examples.',
    'ورشة ليوم واحد تُقدَّم مرتين حول تقدير الجرعات وخرائط المسح ومراجعات ALARA لأعمال الانقطاع عالية الجرعة باستخدام أمثلة مجهولة الهوية.',
    ['sk-rp-01-dose', 'sk-rp-02-survey'], 12, 1, 'office', '2026-11-10', '2026-11-30', 'open', '2026-09-20', ['p-k-hr-analyst', '2026-09-24', null]],
  ['rr-review-psa', 'p-dra', 'reviewer', 'Second-line review of a PSA model update for a licensing submission', 'مراجعة من خط ثانٍ لتحديث نموذج تقييم المخاطر الاحتمالي لتقديم ترخيصي',
    'Review the changed fault trees and the applicability statement of a PSA model update before the licensing submission; comments go to the licensing engineer.',
    'مراجعة أشجار الأعطال المعدلة وبيان الانطباق لتحديث نموذج تقييم المخاطر الاحتمالي قبل التقديم الترخيصي؛ تُرسل الملاحظات إلى مهندس الترخيص.',
    ['sk-ns-01-psa', 'sk-ns-02-licensing'], 30, 1, 'remote', '2026-06-01', '2026-08-31', 'filled', '2026-05-12', ['p-chco', '2026-05-15', null]],
  ['rr-mentor-hp', 'p-training-mgr', 'mentor', 'Human-performance coaching for new first-line supervisors', 'تدريب الأداء البشري للمشرفين المباشرين الجدد',
    'Observe and coach new first-line supervisors on pre-job briefs, STAR and post-job critiques over one quarter; two coaches.',
    'ملاحظة المشرفين المباشرين الجدد وتدريبهم على إحاطات ما قبل العمل وأسلوب STAR ومراجعات ما بعد العمل خلال ربع سنة؛ مدربان.',
    ['sk-hu-01-star', 'sk-hu-02-brief', 'sk-ld-01-coach'], 18, 2, 'site_non_protected', '2026-04-01', '2026-06-30', 'filled', '2026-03-10', ['p-chco', '2026-03-12', null]],
  ['rr-cap-fuel', 'p-work-control', 'capture_interview', 'Capture interview: fuel-handling machine lessons before the 2030 handover', 'مقابلة توثيق: دروس آلة مناولة الوقود قبل التسليم في 2030',
    'A structured interview on the fuel-handling machine: recurring faults, work-arounds and the documents the experts rely on, for the knowledge base.',
    'مقابلة منظمة حول آلة مناولة الوقود: الأعطال المتكررة والحلول البديلة والوثائق التي يعتمد عليها الخبراء، لقاعدة المعرفة.',
    ['sk-pf-03-fuel', 'sk-mp-01-mech'], 10, 1, 'office', '2026-11-15', '2026-12-20', 'pending_hr', '2026-10-06', null],
  ['rr-instr-eop', 'p-sro', 'instructor', 'Simulator guest instructor for emergency operating procedure drills', 'مدرب ضيف على المحاكي لتمارين إجراءات التشغيل الطارئة',
    'Co-instruct four simulator sessions on emergency operating procedures with the training team, focusing on crew communication and procedure transitions.',
    'المشاركة في تدريب أربع جلسات على المحاكي حول إجراءات التشغيل الطارئة مع فريق التدريب، مع التركيز على تواصل الطاقم والانتقال بين الإجراءات.',
    ['sk-co-01-eop', 'sk-pf-03-eccs'], 32, 2, 'office', '2026-12-01', '2027-01-31', 'pending_hr', '2026-10-07', null],
  ['rr-review-cgd', 'p-head-sq', 'reviewer', 'Review of a commercial-grade dedication package backlog', 'مراجعة متراكمات حزم اعتماد المكونات التجارية',
    'Review twelve open commercial-grade dedication packages for critical characteristics and acceptance methods.',
    'مراجعة اثنتي عشرة حزمة مفتوحة لاعتماد المكونات التجارية من حيث الخصائص الحرجة وطرق القبول.',
    ['sk-qa-02-cgd', 'sk-qa-01-inspect'], 40, 1, 'office', '2026-10-15', '2026-12-31', 'declined', '2026-09-25', ['p-chco', '2026-09-29', 'Covered by the supplier-quality rotation; post it in the marketplace instead']],
  ['rr-mentor-valves', 'p-ops-ceo', 'mentor', 'Maintenance craft mentoring: valve diagnostics for I&C technicians', 'إرشاد مهني في الصيانة: تشخيص الصمامات لفنيي الأجهزة والتحكم',
    'Pair an experienced maintenance engineer with I&C technicians for valve diagnostics during the spring outage.',
    'إقران مهندس صيانة متمرس بفنيي الأجهزة والتحكم لتشخيص الصمامات خلال انقطاع الربيع.',
    ['sk-mp-02-dic', 'sk-mp-01-elec'], 20, 1, 'site_non_protected', '2026-05-01', '2026-07-31', 'closed', '2026-04-08', ['p-chco', '2026-04-10', null]],
  ['rr-cap-drills', 'p-ep-manager', 'capture_interview', 'Capture interview: emergency drill scenario design', 'مقابلة توثيق: تصميم سيناريوهات تمارين الطوارئ',
    'A short structured interview on how full-scale emergency drill scenarios were designed and evaluated, for the drill team.',
    'مقابلة منظمة قصيرة حول كيفية تصميم سيناريوهات تمارين الطوارئ الشاملة وتقييمها، لفريق التمارين.',
    ['sk-ep-01-ero', 'sk-ep-01'], 8, 1, 'remote', '2026-10-28', '2026-11-30', 'open', '2026-09-22', ['p-chco', '2026-09-26', null]],
];
// [request, member, status, history[[date, status, by, note]], note, hr: [by, date, note] | null, outcome]
const ENGAGEMENTS = [
  ['rr-cap-startup', 'alm-ops-01', 'handed_to_hr', [['2026-10-03', 'interested', 'alm', 'I led two of the first-cycle startups and kept notes'], ['2026-10-05', 'handed_to_hr', 'p-chco', 'Handed to HR for a short advisory engagement']], 'I led two of the first-cycle startups and kept notes', ['p-chco', '2026-10-05', 'Handed to HR for a short advisory engagement'], null],
  ['rr-cap-startup', 'alm-khnp-01', 'interested', [['2026-10-04', 'interested', 'alm', 'Happy to add the KHNP crew view of the startup tests']], 'Happy to add the KHNP crew view of the startup tests', null, null],
  ['rr-cap-startup', 'alm-ops-02', 'invited', [['2026-10-06', 'invited', 'p-chco', 'Your simulator scenarios match this request']], null, null, null],
  ['rr-mentor-outage', 'alm-out-01', 'interested', [['2026-10-04', 'interested', 'alm', 'Available for the whole Unit 3 outage']], 'Available for the whole Unit 3 outage', null, null],
  ['rr-mentor-outage', 'alm-ops-04', 'withdrawn', [['2026-08-01', 'interested', 'alm', null], ['2026-08-20', 'withdrawn', 'alm', 'Consent withdrawn']], null, null, null],
  ['rr-review-chem', 'alm-chem-01', 'interested', [['2026-10-06', 'interested', 'alm', 'I wrote the original sampling plan']], 'I wrote the original sampling plan', null, null],
  ['rr-review-chem', 'alm:p-sme-reviewer', 'interested', [['2026-10-07', 'interested', 'alm', 'Can review the engineering side of the limits']], 'Can review the engineering side of the limits', null, null],
  ['rr-instr-alara', 'alm-rp-01', 'interested', [['2026-09-26', 'interested', 'alm', null]], null, null, null],
  ['rr-review-psa', 'alm-lic-01', 'completed', [['2026-05-18', 'interested', 'alm', null], ['2026-05-20', 'handed_to_hr', 'p-chco', null], ['2026-08-28', 'completed', 'p-dra', 'Fourteen comments; two changed the applicability statement']], null, ['p-chco', '2026-05-20', null], 'Fourteen comments; two changed the applicability statement'],
  ['rr-mentor-hp', 'alm-hp-01', 'completed', [['2026-03-14', 'interested', 'alm', null], ['2026-03-16', 'handed_to_hr', 'p-chco', null], ['2026-06-30', 'completed', 'p-training-mgr', 'Six supervisors coached; brief quality up in observations']], null, ['p-chco', '2026-03-16', null], 'Six supervisors coached; brief quality up in observations'],
  ['rr-mentor-hp', 'alm-trn-01', 'completed', [['2026-03-15', 'interested', 'alm', null], ['2026-03-16', 'handed_to_hr', 'p-chco', null], ['2026-06-30', 'completed', 'p-training-mgr', 'Coached the night-shift supervisors']], null, ['p-chco', '2026-03-16', null], 'Coached the night-shift supervisors'],
  ['rr-mentor-valves', 'alm-kps-01', 'completed', [['2026-04-12', 'interested', 'alm', null], ['2026-04-14', 'handed_to_hr', 'p-chco', null], ['2026-07-30', 'completed', 'p-ops-ceo', 'Three technicians now run diagnostics unaided']], null, ['p-chco', '2026-04-14', null], 'Three technicians now run diagnostics unaided'],
  ['rr-mentor-valves', 'alm-mnt-01', 'declined', [['2026-04-12', 'interested', 'alm', null], ['2026-04-14', 'declined', 'p-chco', 'One place only; kept for the next outage']], null, ['p-chco', '2026-04-14', 'One place only; kept for the next outage'], null],
  ['rr-cap-drills', 'alm-ep-01', 'declined', [['2026-09-27', 'invited', 'p-chco', null], ['2026-09-30', 'declined', 'p-chco', 'Availability paused; invite again in 2027']], null, ['p-chco', '2026-09-30', 'Availability paused; invite again in 2027'], null],
];
// [id, member, engagement, title_en, title_ar, body_en, body_ar, quote_en, quote_ar, author_en, author_ar, consent_on, published_on, listed]
const STORIES = [
  ['as-startup', 'alm-ops-01', 'capture_interview', 'Two hours that saved a week of startup testing', 'ساعتان وفّرتا أسبوعاً من اختبارات بدء التشغيل',
    'A retired shift manager walked the Unit 4 crews through the decisions behind the first-cycle startup tests. The recorded session now sits in the knowledge base next to the procedures it explains.',
    'شرح مدير وردية متقاعد لأطقم الوحدة 4 القرارات التي قامت عليها اختبارات بدء التشغيل للدورة الأولى. الجلسة المسجلة موجودة الآن في قاعدة المعرفة بجانب الإجراءات التي تشرحها.',
    'The procedure tells you what to do. I could tell them why we wrote it that way.', 'الإجراء يخبرك بما تفعل. أما أنا فاستطعت أن أخبرهم لماذا كتبناه بهذه الطريقة.',
    'Former shift manager, 14 years at Barakah (synthetic alumnus)', 'مدير وردية سابق، 14 عاماً في براكة (خبير سابق افتراضي)', '2026-07-01', '2026-07-15', true],
  ['as-khnp', 'alm-khnp-01', 'instructor', 'From secondee to guest instructor', 'من معار إلى مدرب ضيف',
    'After his KHNP secondment ended, an APR-1400 operator stayed in the reserve and co-taught emergency procedure drills on the simulator, pairing with a Barakah instructor each time.',
    'بعد انتهاء إعارته من الشركة الكورية، بقي مشغل مفاعل APR-1400 في الاحتياطي وشارك في تدريب تمارين إجراءات الطوارئ على المحاكي، مع مدرب من براكة في كل مرة.',
    'The crews were already good. We worked on the moments between procedures.', 'كانت الأطقم جيدة أصلاً. عملنا على اللحظات الفاصلة بين الإجراءات.',
    'Former KHNP secondee, senior reactor operator (synthetic alumnus)', 'معار سابق من الشركة الكورية، كبير مشغلي مفاعل (خبير سابق افتراضي)', '2026-08-10', '2026-08-25', true],
  ['as-psa', 'alm-lic-01', 'reviewer', 'A second pair of eyes on a licensing submission', 'عين ثانية على تقديم ترخيصي',
    'A retired licensing engineer reviewed a PSA model update over the summer. Two of his fourteen comments changed the applicability statement before submission.',
    'راجع مهندس ترخيص متقاعد تحديثاً لنموذج تقييم المخاطر الاحتمالي خلال الصيف. غيّرت ملاحظتان من ملاحظاته الأربع عشرة بيان الانطباق قبل التقديم.',
    'I knew where the old assumptions were buried.', 'كنت أعرف أين دُفنت الافتراضات القديمة.',
    'Former licensing engineer, 13 years (synthetic alumnus)', 'مهندس ترخيص سابق، 13 عاماً (خبير سابق افتراضي)', '2026-09-01', '2026-09-10', true],
  ['as-hp', 'alm-hp-01', 'mentor', 'Coaching supervisors on the brief, not the form', 'تدريب المشرفين على الإحاطة لا على النموذج',
    'Two reserve coaches spent a quarter with new first-line supervisors. Observed pre-job briefs became shorter and asked better questions.',
    'أمضى مدربان من الاحتياطي ربع سنة مع المشرفين المباشرين الجدد. أصبحت إحاطات ما قبل العمل التي جرت ملاحظتها أقصر وطرحت أسئلة أفضل.',
    'A good brief is a conversation. We practised the conversation.', 'الإحاطة الجيدة حوار. تدربنا على الحوار.',
    'Former human-performance specialist (synthetic alumna)', 'أخصائية أداء بشري سابقة (خبيرة سابقة افتراضية)', '2026-07-05', '2026-07-20', true],
  ['as-rounds', 'alm-ops-04', 'mentor', 'Field rounds, the long way', 'الجولات الميدانية بالطريق الطويل',
    'A retired local operator mentored two new operators on field rounds. This story was unlisted when he withdrew his consent.',
    'أرشد مشغل محلي متقاعد مشغلَين جديدين في الجولات الميدانية. أُلغي نشر هذه القصة عندما سحب موافقته.',
    null, null, 'Former local operator (synthetic alumnus)', 'مشغل محلي سابق (خبير سابق افتراضي)', '2026-05-01', '2026-05-10', false],
];

export default function build() {}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  const fam = (roleId) => roles.get(roleId)?.family_id ?? null;
  T.alumni ||= [];
  for (const [id, name, name_ar, kind, role, org, departed, reason, years, avail, hours, prefs, finder, hEn, hAr, extra] of DEPARTED) {
    const withdrawn = id === 'alm-ops-04';
    T.alumni.push({
      id, person_id: null, kind, name, name_ar, former_role_id: role, former_family_id: fam(role), former_org: org, departed_on: departed, departure_reason: reason,
      departed_band: bandOf(departed, today), years_service: years, skill_snapshot: synthSnapshot(T, role, years, extra), snapshot_on: departed,
      availability: avail, hours_month: hours, engagement_prefs: prefs, finder_optin: finder && !withdrawn, finder_visible: finder && !withdrawn, headline_en: hEn, headline_ar: hAr,
      consent_on: addMonths(departed, 1), consent_version: '1', status: withdrawn ? 'withdrawn' : 'active', withdrawn_on: withdrawn ? '2026-08-20' : null, erase_after: withdrawn ? addMonths('2026-08-20', 6) : null,
      created_at: at(addMonths(departed, 1)), updated_at: at(withdrawn ? '2026-08-20' : addMonths(departed, 1)),
    });
  }
  // The seeded leaver: departed this year; the snapshot is frozen from their F01 skill state.
  const lv = people.get('w-mnt-08');
  if (!lv || lv.status !== 'leaver') throw new Error('f23: w-mnt-08 is expected to be the seeded leaver');
  const states = (pid) => T.person_skills.filter((s) => s.person_id === pid);
  T.alumni.push({
    id: 'alm-mnt-08', person_id: lv.id, kind: 'alumni', name: lv.display_name, name_ar: lv.display_name_ar || lv.display_name, former_role_id: lv.job_role_id, former_family_id: lv.job_family_id,
    former_org: lv.org_id, departed_on: '2026-06-30', departure_reason: 'moved_on', departed_band: bandOf('2026-06-30', today), years_service: 2,
    skill_snapshot: snapshotFrom(states(lv.id), T.skills), snapshot_on: '2026-06-30', availability: 'limited', hours_month: 6, engagement_prefs: ['instructor'],
    finder_optin: false, finder_visible: false, headline_en: null, headline_ar: null, consent_on: '2026-06-30', consent_version: '1', status: 'active', withdrawn_on: null, erase_after: null,
    created_at: at('2026-06-30'), updated_at: at('2026-06-30'),
  });
  for (const [pid, consent, avail, hours, prefs, finder, hEn, hAr] of PRE) {
    const p = people.get(pid);
    if (!p || p.kind !== 'staff' || p.status === 'leaver' || ['security', 'cyber', 'safeguards'].includes(p.job_family_id)) throw new Error(`f23: ${pid} is not eligible staff`);
    T.alumni.push({
      id: `alm:${pid}`, person_id: pid, kind: 'pre_departure', name: p.display_name, name_ar: p.display_name_ar || p.display_name, former_role_id: p.job_role_id ?? null, former_family_id: p.job_family_id ?? null,
      former_org: p.org_id ?? null, departed_on: null, departure_reason: 'planned', departed_band: 'departing',
      years_service: p.hire_date ? Math.floor((Date.parse(`${consent}T00:00:00Z`) - Date.parse(`${p.hire_date}T00:00:00Z`)) / 86_400_000 / 365) : null,
      skill_snapshot: snapshotFrom(states(pid), T.skills), snapshot_on: consent, availability: avail, hours_month: hours, engagement_prefs: prefs,
      finder_optin: finder, finder_visible: finder, headline_en: hEn, headline_ar: hAr, consent_on: consent, consent_version: '1', status: 'active', withdrawn_on: null, erase_after: null,
      created_at: at(consent), updated_at: at(consent),
    });
  }
  const members = new Map(T.alumni.map((m) => [m.id, m]));

  T.reserve_requests ||= [];
  for (const [id, poster, engagement, tEn, tAr, sEn, sAr, skills, hours, seats, loc, start, end, status, created, hrd] of REQUESTS) {
    const p = people.get(poster);
    if (!p) throw new Error(`f23: unknown poster ${poster}`);
    for (const s of skills) if (!T.skills.some((k) => k.id === s && k.area !== 'security')) throw new Error(`f23: bad skill ${s}`);
    const jr = p.job_role_id ? roles.get(p.job_role_id) : null;
    const jf = T.job_families.find((f) => f.id === p.job_family_id);
    T.reserve_requests.push({
      id, posted_by: poster, poster_name: p.display_name, poster_name_ar: p.display_name_ar || p.display_name, family_id: p.job_family_id ?? null,
      host_team_en: jr ? `${jr.title_en} team` : jf ? `${jf.name_en} team` : 'Team', host_team_ar: jr ? `فريق ${jr.title_ar}` : jf ? `فريق ${jf.name_ar}` : 'الفريق',
      engagement, title_en: tEn, title_ar: tAr, summary_en: sEn, summary_ar: sAr, skills_needed: skills, hours_total: hours, seats, seats_taken: 0, interest_count: 0,
      location_type: loc, start_on: start, end_on: end, status, hr_by: hrd?.[0] ?? null, hr_at: hrd ? at(hrd[1], '10:00:00') : null, hr_note: hrd?.[2] ?? null,
      open_read: false, created_at: at(created, '08:00:00'), updated_at: at(hrd?.[1] ?? created, '10:00:00'),
    });
  }
  const reqs = new Map(T.reserve_requests.map((r) => [r.id, r]));
  T.reserve_engagements ||= [];
  for (const [rid, mid, status, hist, note, hrd, outcome] of ENGAGEMENTS) {
    const r = reqs.get(rid);
    const m = members.get(mid);
    if (!r || !m) throw new Error(`f23: bad engagement ${rid}/${mid}`);
    const withdrawn = m.status === 'withdrawn';
    const last = hist[hist.length - 1][0];
    T.reserve_engagements.push({
      id: `re:${rid}:${mid}`, request_id: rid, alumni_id: mid, person_id: m.person_id, poster_id: r.posted_by,
      poster_read_id: status === 'handed_to_hr' || status === 'completed' ? r.posted_by : null, status, engagement: r.engagement,
      alumni_name: withdrawn ? '' : m.name, alumni_name_ar: withdrawn ? '' : m.name_ar, note, hr_by: hrd?.[0] ?? null, hr_at: hrd ? at(hrd[1], '11:00:00') : null, hr_note: hrd?.[2] ?? null,
      outcome_note: outcome, completed_at: status === 'completed' ? at(last, '15:00:00') : null,
      history: hist.map(([d, s, by, n]) => H(d, s, by === 'alm' ? m.person_id : by, n, s === 'interested' ? '08:30:00' : '11:00:00')),
      open_read: false, created_at: at(hist[0][0], '08:30:00'), updated_at: at(last, status === 'completed' ? '15:00:00' : '11:00:00'),
    });
  }
  for (const r of T.reserve_requests) Object.assign(r, recount(r, T.reserve_engagements.filter((e) => e.request_id === r.id)));
  T.alumni_stories ||= [];
  STORIES.forEach(([id, mid, engagement, tEn, tAr, bEn, bAr, qEn, qAr, aEn, aAr, consent, published, listed], i) => {
    if (!members.has(mid)) throw new Error(`f23: story ${id} has no member`);
    T.alumni_stories.push({ id, alumni_id: mid, engagement, title_en: tEn, title_ar: tAr, body_en: bEn, body_ar: bAr, quote_en: qEn, quote_ar: qAr, author_en: aEn, author_ar: aAr, consent_on: consent, published_on: published, synthetic: true, listed, sort: i });
  });
}
