// F24 (wave 3 · E5) Recommendation transparency, opt-out and fairness monitor (module M16).
//  - engine_cards: one model/engine card per recommendation surface (inputs used and never used, weights, owner, oversight,
//    limitations, the scoring functions behind it, sources). Owners are role cards; no real names.
//  - engine_changes: one "baseline at deployment" row per F02 surface (the wave-0 defaults); later changes come from the RPCs.
//  - reco_optouts: synthetic w-* staff who opted out of a surface (coach above the suppression threshold, the others below).
//  - fairness_snapshots (finalize, after F01 derives skill states): ten weekly snapshots computed by fairnessSnapshot() as of
//    each week, exactly what kafaa_run_fairness_snapshot would have stored (PGlite proves SQL = TS).
import { fairnessSnapshot, weeklyDates } from '../../../src/modules/m16/fairness.ts';

export const FINALIZE_LAST = true; // after f01-skills.mjs (states) and f12-conversations.mjs, by file name
const AS_OF = '2026-10-09';
const SRC = {
  cfr: { label: 'US 29 CFR 1607.4(D) · Uniform Guidelines on Employee Selection Procedures: the four-fifths rule', url: 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4', as_of: AS_OF },
  pdpl: { label: 'UAE Government portal · Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)', url: 'https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws', as_of: AS_OF },
  nist: { label: 'NIST · AI Risk Management Framework (AI RMF 1.0)', url: 'https://www.nist.gov/itl/ai-risk-management-framework', as_of: AS_OF },
};
const EXCLUDED = ['gender', 'nationality_flag', 'age'];
const I = (key, en, ar) => ({ key, en, ar });
const IN = {
  skills: I('person_skills', 'My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)', 'مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)'),
  roleReq: I('role_competencies', 'The competency levels each role requires (core, important, useful)', 'مستويات الكفاءة التي يتطلبها كل دور (أساسية، مهمة، مفيدة)'),
  paths: I('career_paths', 'Published career paths and entry routes, with their conditions (FANR-REG-17 for licensed roles)', 'المسارات المهنية المنشورة وطرق الالتحاق وشروطها (FANR-REG-17 للأدوار المرخّصة)'),
  quals: I('qual_records', 'Current qualification and licence records (mirrors of the licensee systems)', 'سجلات المؤهلات والتراخيص الحالية (نسخ مطابقة لأنظمة المرخَّص له)'),
  tenure: I('time_in_role', 'Months in my current role (from licence, qualification or hire date)', 'عدد الأشهر في دوري الحالي (من الترخيص أو المؤهل أو تاريخ التعيين)'),
  training: I('training_records', 'Courses I completed or am enrolled in', 'الدورات التي أكملتها أو المسجّل فيها'),
  targets: I('career_targets', 'My shortlisted target roles and weekly learning goal (only if I set them)', 'الأدوار المستهدفة في قائمتي المختصرة وهدف التعلّم الأسبوعي (إن حدّدتها فقط)'),
  feedback: I('coach_feedback', 'Suggestions I saved or dismissed', 'الاقتراحات التي حفظتها أو أخفيتها'),
  agreed: I('career_conversations', 'Courses agreed in my career conversation (if I agreed)', 'الدورات المتفق عليها في محادثتي المهنية (إن وافقت)'),
  opp: I('opportunities', 'Each opportunity: skills needed, skills gained, eligible job families', 'كل فرصة: المهارات المطلوبة والمهارات المكتسبة والعائلات الوظيفية المؤهلة'),
  family: I('job_family', 'My job family (eligibility only)', 'عائلتي الوظيفية (للأهلية فقط)'),
  evidence: I('skill_evidence', 'Evidence rows behind each skill, their date and recency', 'سجلات الأدلة وراء كل مهارة وتاريخها وحداثتها'),
  mentors: I('mentors', 'Mentor profiles: skills offered, mentoring types, capacity', 'ملفات المرشدين: المهارات المعروضة وأنواع الإرشاد والطاقة الاستيعابية'),
  reporting: I('reporting_line', 'My reporting line (so my own line manager is never suggested)', 'تسلسلي الإداري (حتى لا يُقترح مديري المباشر أبداً)'),
  programmes: I('rotation_templates', 'Rotation programmes: objectives, families, duration', 'برامج التناوب: الأهداف والعائلات والمدة'),
  hosts: I('shadow_hosts', 'Opted-in shadowing hosts and the skills they offer', 'المضيفون الذين اختاروا الاستضافة والمهارات التي يقدمونها'),
  experts: I('expert_optin', 'Experts who opted in: skills at level 3 or above, availability', 'الخبراء الذين اختاروا الظهور: مهارات بالمستوى 3 فأعلى، والتوفر'),
  adv: I('adv_skills', 'ADVANCE-era skills and bridges from today\'s skills (public sources)', 'مهارات عصر ADVANCE والجسور من مهارات اليوم (مصادر عامة)'),
};
const card = (id, sort, engine_surface, module, route, feature, title_en, title_ar, purpose_en, purpose_ar, owner_en, owner_ar, inputs, fns, weight_keys, output_en, output_ar, oversight_en, oversight_ar, limitations_en, limitations_ar, opt_out) => ({
  id, sort, engine_surface, module, route, feature, title_en, title_ar, purpose_en, purpose_ar, owner_en, owner_ar, inputs_used: inputs, inputs_excluded: EXCLUDED, scoring_functions: fns, weight_keys,
  output_en, output_ar, oversight_en, oversight_ar, limitations_en, limitations_ar, opt_out, version: 1, last_changed_at: '2026-10-08T00:00:00Z', last_change_id: `ec:${engine_surface}:001`,
  sources: [SRC.cfr, SRC.pdpl, SRC.nist],
});

/** FNV-1a for stable synthetic picks. */
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }

export default function build(T) {
  T.engine_cards = [
    card('navigator', 1, 'recommend', 'M18', '/my/career', 'F05 · F06', 'Career Navigator', 'مستكشف المسار المهني',
      'Shows the roles I can reach from my current role and how ready I am for each, with the gaps and the gates.',
      'يعرض الأدوار التي يمكنني بلوغها من دوري الحالي ومدى جاهزيتي لكل منها، مع الفجوات والشروط.',
      'Head of Talent and Careers (role card)', 'رئيس المواهب والمسارات المهنية (بطاقة دور)',
      [IN.skills, IN.roleReq, IN.paths, IN.quals, IN.tenure, IN.training],
      ['src/modules/m18/career.ts#careerReadiness', 'src/modules/m18/career.ts#reachableRoles', 'src/domain/engines/rank.ts#careerMoves', 'src/domain/engines/rank.ts#readiness', 'sql:kafaa_career_readiness_compute'],
      ['core', 'important', 'useful'],
      'Readiness % per role (weighted competency coverage), a band (ready now, ready in N months, stretch) and the entry-route gates, shown separately.',
      'نسبة الجاهزية لكل دور (تغطية مرجّحة للكفاءات)، وفئة (جاهز الآن، جاهز خلال N شهراً، طموح)، وشروط طرق الالتحاق معروضة منفصلة.',
      'Indicative guidance only. Moves are decided by line managers and HR; licensed roles follow the FANR licensing process. A gate that is not met always blocks "ready now".',
      'إرشاد استرشادي فقط. يقرّر المديرون المباشرون والموارد البشرية التنقلات؛ وتتبع الأدوار المرخّصة إجراءات الترخيص لدى الهيئة الاتحادية للرقابة النووية. أي شرط غير مستوفى يمنع دائماً تصنيف "جاهز الآن".',
      'Covers only skills Kafa\'a holds evidence for; it does not measure performance, potential or motivation. Security roles show the path only.',
      'يغطي فقط المهارات التي لدى كفاءة أدلة عليها؛ ولا يقيس الأداء أو الإمكانات أو الدافعية. تعرض أدوار الأمن المسار فقط.', true),
    card('coach', 2, 'recommend', 'M19', '/my/coach', 'F07', 'Learning Coach', 'مدرّب التعلّم',
      'Ranks five to eight learning actions a month that close the gaps to my current and target roles.',
      'يرتّب من خمسة إلى ثمانية إجراءات تعلّم شهرياً تسدّ الفجوات نحو دوري الحالي والأدوار المستهدفة.',
      'Training Manager (role card)', 'مدير التدريب (بطاقة دور)',
      [IN.skills, IN.roleReq, IN.training, IN.quals, IN.targets, IN.feedback, IN.agreed],
      ['src/modules/m19/coach.ts#buildCoachFeed', 'src/modules/m19/inputs.ts#coachInputFrom', 'src/domain/engines/rank.ts#coursesForGaps', 'src/domain/engines/rank.ts#byGapClosure'],
      ['current_role', 'target_role', 'core', 'important', 'useful'],
      'A monthly list of courses, practice, on-the-job tasks, mentors and opportunities, each with its reasons; expiring qualifications are pinned first.',
      'قائمة شهرية بالدورات والتدريب العملي ومهام العمل والمرشدين والفرص، ولكل منها أسبابه؛ وتُثبَّت المؤهلات التي توشك على الانتهاء في الأعلى.',
      'Suggestions only: enrolment always needs my confirmation and, where required, my manager\'s approval. Mandatory curriculum is assigned by the training system, not the coach.',
      'اقتراحات فقط: يتطلب التسجيل دائماً تأكيدي، وموافقة مديري حيث يلزم. يُسند المنهج الإلزامي من نظام التدريب لا من المدرّب.',
      'Effort estimates come from catalogue durations; courses without competency tags cannot be ranked and appear in the catalogue only.',
      'تقديرات الجهد مأخوذة من مدد الكتالوج؛ ولا يمكن ترتيب الدورات غير المرتبطة بكفاءات فتظهر في الكتالوج فقط.', true),
    card('marketplace', 3, 'match', 'M20', '/opportunities', 'F08', 'Opportunity marketplace', 'سوق الفرص',
      'Orders gigs, projects, outage support and shadowing by how well they fit my skills and help my development.',
      'يرتّب المهام القصيرة والمشاريع ودعم فترات الصيانة والمرافقة بحسب ملاءمتها لمهاراتي وفائدتها لتطوري.',
      'Head of Talent and Careers (role card)', 'رئيس المواهب والمسارات المهنية (بطاقة دور)',
      [IN.skills, IN.opp, IN.roleReq, IN.targets, IN.family],
      ['src/modules/m20/match.ts#matchOpportunities'],
      ['skills', 'development', 'target'],
      'A match score (skills fit, development value, target-role value) and reasons per opportunity. The "Emirati development priority" flag is shown on the card and never changes the score.',
      'درجة مطابقة (ملاءمة المهارات، والقيمة التطويرية، والقيمة للدور المستهدف) وأسباب لكل فرصة. تظهر علامة "أولوية تطوير الكوادر الإماراتية" على البطاقة ولا تغيّر الدرجة أبداً.',
      'Selection is made by the posting manager after my line manager releases me; the score never selects anyone.',
      'يتم الاختيار من قبل المدير الناشر بعد موافقة مديري المباشر على إتاحتي؛ ولا تختار الدرجة أحداً أبداً.',
      'Opportunities without skill tags show an open fit. Skills learned outside Kafa\'a count only once evidenced or validated.',
      'تظهر الفرص غير المرتبطة بمهارات بملاءمة مفتوحة. ولا تُحتسب المهارات المكتسبة خارج كفاءة إلا بعد إثباتها أو اعتمادها.', true),
    card('talent_evidence', 4, 'skills', 'M23', '/talent/review', 'F18', 'Talent review evidence panel', 'لوحة أدلة مراجعة المواهب',
      'Summarises skills breadth and growth, validated check-ins and completed opportunities for a manager placing someone in talent review.',
      'يلخّص اتساع المهارات ونموها وتقييمات المهارات المعتمدة والفرص المنجزة للمدير عند وضع الموظف في مراجعة المواهب.',
      'HR authority, CHCO office (role card)', 'سلطة الموارد البشرية، مكتب الرئيس التنفيذي لرأس المال البشري (بطاقة دور)',
      [IN.skills, IN.evidence, IN.quals, IN.training],
      ['src/domain/skills.ts#deriveStates', 'src/domain/skills.ts#gatherEvidence', 'sql:kafaa_skill_states_compute', 'sql:kafaa_skill_evidence_derive'],
      ['half_life_months'],
      'An evidence summary beside the manager\'s placement. It never places anyone on the grid and never ranks people.',
      'ملخص أدلة إلى جانب تصنيف المدير. لا يضع أحداً على الشبكة ولا يرتّب الأشخاص أبداً.',
      'Placements are made by managers, calibrated with HR and locked by the HR director (maker-checker). Employees can ask for a correction of any evidence row.',
      'يضع المديرون التصنيفات، وتُعاير مع الموارد البشرية، ويقفلها مدير الموارد البشرية (مبدأ المُعِدّ والمُدقِّق). ويمكن للموظفين طلب تصحيح أي سجل دليل.',
      'Evidence older than the half-life weighs less; work outside Kafa\'a is invisible until recorded. Not a measure of potential on its own.',
      'تقلّ أهمية الأدلة الأقدم من نصف العمر؛ ولا يظهر العمل خارج كفاءة حتى يُسجَّل. وهو ليس مقياساً للإمكانات بمفرده.', false),
    card('mentoring', 5, 'match', 'M04', '/my/mentoring', 'F13', 'Mentor matching', 'مطابقة المرشدين',
      'Suggests mentors whose offered skills and mentoring types fit what I want to learn.',
      'يقترح مرشدين تتوافق مهاراتهم وأنواع الإرشاد لديهم مع ما أريد تعلّمه.',
      'Training Manager (role card)', 'مدير التدريب (بطاقة دور)',
      [IN.mentors, IN.skills, IN.reporting],
      ['src/modules/m04/match.ts#rankMentors'],
      ['skills', 'development', 'target'],
      'A short list of mentors with reasons; my own line manager is never suggested.',
      'قائمة قصيرة بالمرشدين مع الأسباب؛ ولا يُقترح مديري المباشر أبداً.',
      'The mentor decides whether to accept; the agreement is set by both people.',
      'يقرّر المرشد قبول الطلب أو رفضه؛ ويحدّد الطرفان الاتفاق معاً.',
      'Only mentors who opted in and have capacity appear.',
      'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية.', false),
    card('rotations', 6, 'match', 'M20', '/opportunities/rotations', 'F15', 'Rotations and shadowing suggestions', 'اقتراحات التناوب والمرافقة',
      'Orders rotation programmes and shadowing hosts by the gaps they close for my role and targets.',
      'يرتّب برامج التناوب ومضيفي المرافقة بحسب الفجوات التي تسدّها لدوري وأهدافي.',
      'Head of Talent and Careers (role card)', 'رئيس المواهب والمسارات المهنية (بطاقة دور)',
      [IN.programmes, IN.hosts, IN.skills, IN.roleReq, IN.family],
      ['src/modules/m20/rotationMatch.ts#rankProgrammes', 'src/modules/m20/rotationMatch.ts#rankHosts'],
      ['skills', 'development', 'target'],
      'Ranked programmes and hosts with reasons. Enrolment is by programme owners; shadowing needs the host\'s and my manager\'s agreement.',
      'برامج ومضيفون مرتبون مع الأسباب. يتم التسجيل من قبل مالكي البرامج؛ وتتطلب المرافقة موافقة المضيف ومديري.',
      'Programme owners enrol people; sign-off is maker-checker.',
      'يسجّل مالكو البرامج المشاركين؛ ويخضع الاعتماد لمبدأ المُعِدّ والمُدقِّق.',
      'Security, safeguards and cyber areas are never suggested.',
      'لا تُقترح أبداً مجالات الأمن والضمانات والأمن السيبراني.', false),
    card('experts', 7, 'match', 'M22', '/communities/experts', 'F17', 'Expert finder', 'الباحث عن الخبراء',
      'Lists colleagues who opted in as experts for a skill, strongest evidence first.',
      'يعرض الزملاء الذين اختاروا الظهور كخبراء في مهارة ما، بدءاً بأقوى الأدلة.',
      'Knowledge management lead (role card)', 'مسؤول إدارة المعرفة (بطاقة دور)',
      [IN.experts, IN.skills],
      ['src/modules/m22/domain.ts#rankExperts'],
      [],
      'A list of opted-in experts with their level and why they appear. No contact details.',
      'قائمة بالخبراء الذين اختاروا الظهور مع مستواهم وسبب ظهورهم. دون بيانات اتصال.',
      'Experts choose to appear and can withdraw at any time; requests go through Kafa\'a.',
      'يختار الخبراء الظهور ويمكنهم الانسحاب في أي وقت؛ وتمر الطلبات عبر كفاءة.',
      'Only level 3 or above and only people who opted in.',
      'المستوى 3 فأعلى فقط، ولمن اختار الظهور فقط.', false),
    card('future', 8, 'recommend', 'M21', '/my/future', 'F09', 'Future Me readiness', 'جاهزية مستقبلي',
      'Estimates my readiness for ADVANCE-era technologies and ranks the skill bridges and resources that would help most.',
      'يقدّر جاهزيتي لتقنيات عصر ADVANCE ويرتّب جسور المهارات والموارد الأكثر فائدة.',
      'Future workforce lead (role card)', 'مسؤول القوى العاملة المستقبلية (بطاقة دور)',
      [IN.skills, IN.adv, IN.paths],
      ['src/modules/m21/future.ts#readinessIndex', 'src/modules/m21/future.ts#rankBridges', 'src/modules/m21/future.ts#rankFutureRoles', 'src/modules/m21/future.ts#rankResources'],
      ['core', 'important', 'useful'],
      'A readiness index per technology family and ranked bridges, roles and resources, each with reasons. Labelled as a concept, not a plan.',
      'مؤشر جاهزية لكل عائلة تقنية وجسور وأدوار وموارد مرتبة، لكل منها أسبابه. موسوم كمفهوم لا كخطة.',
      'Exploration only; it creates no plan or commitment unless I add a goal.',
      'للاستكشاف فقط؛ لا ينشئ خطة أو التزاماً إلا إذا أضفت هدفاً.',
      'Future roles are concepts from public sources, with no headcount or sites.',
      'الأدوار المستقبلية مفاهيم من مصادر عامة، دون أعداد موظفين أو مواقع.', false),
  ];

  // Baseline of each F02 surface at deployment (no audit row: it predates the change log). Later rows come from the RPCs.
  T.engine_changes = (T.engine_settings ?? []).map((s) => ({
    id: `ec:${s.surface}:001`, surface: s.surface, engine_before: null, engine_after: s.engine, weights_before: {}, weights_after: s.weights,
    rationale: 'Baseline at deployment: the wave-0 defaults (F02).', card_ids: T.engine_cards.filter((c) => c.engine_surface === s.surface).map((c) => c.id).sort(),
    changed_by: null, changed_by_role: null, changed_at: '2026-10-08T00:00:00Z', audit_seq: null, ledger_seq: null,
  }));

  // Opt-outs: synthetic staff only (never a persona), stable picks.
  const pool = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.id.startsWith('w-') && p.job_role_id).map((p) => p.id).sort((a, b) => h32(`f24:${a}`) - h32(`f24:${b}`));
  const REASONS = ['I prefer to browse the full catalogue myself.', 'I am not looking to move roles this year.', 'I already agreed a plan with my manager.', null];
  const plan = [['coach', 12, 0], ['navigator', 4, 12], ['marketplace', 3, 16]];
  T.reco_optouts = [];
  for (const [surface, n, from] of plan)
    for (const [i, pid] of pool.slice(from, from + n).entries()) {
      const day = String(1 + ((h32(`${surface}:${pid}`) % 27))).padStart(2, '0');
      T.reco_optouts.push({ id: `ro:${pid}:${surface}`, person_id: pid, surface, opted_out: true, reason: REASONS[i % REASONS.length], created_at: `2026-09-${day}T08:00:00Z`, updated_at: `2026-09-${day}T08:00:00Z` });
    }
}

/** Ten weekly fairness snapshots, computed after every builder ran and skill states were derived. */
export function finalize(T, ctx) {
  const d = {
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
    licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments,
    weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
    optouts: T.reco_optouts, applications: T.opportunity_applications, mentoring: T.mentoring_requests, nominations: T.leadership_nominations, placements: T.review_placements ?? null,
  };
  T.fairness_snapshots = [];
  for (const day of weeklyDates(ctx.DEMO_TODAY, 10))
    for (const r of fairnessSnapshot(d, day)) T.fairness_snapshots.push({ ...r, run_by: 'p-ai-governance', created_at: `${day}T06:00:00Z` });
}
