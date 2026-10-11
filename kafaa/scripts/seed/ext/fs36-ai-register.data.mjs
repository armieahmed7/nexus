// FS36 + FS37 seed data (no default export: build-seed imports every .mjs in this folder; only fs36-ai-register.mjs builds rows).
// Every system and drill is a SYNTHETIC example; procedures carry SYN- codes and the "SYNTHETIC" marker; no plant, OT or security content.
export const AS_OF = '2026-10-10';
export const AILIT = { label: 'European Commission · Living repository of AI-literacy practices (EU AI Act Article 4)', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices' };
export const UAEAI = { label: 'Khaleej Times · Abu Dhabi to train 23,000 government employees in AI by 2027', url: 'https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027' };
export const IAEAAI = { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence' };
export const ADNOC = { label: 'ADNOC Sustainability Report 2025 · AI upskilling', url: 'https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42' };

const OPS = ['operations', 'maintenance', 'outage', 'chemistry', 'radiation-protection', 'fire-protection'];
const TECH = ['maintenance', 'engineering', 'nuclear-fuel', 'quality'];
const SUPPORT = ['corporate', 'supply-chain', 'training', 'emergency-preparedness', 'licensing', 'oversight'];
const M = {
  ladder: { kind: 'ladder', ref: null, title_en: 'AI fluency ladder: the rung each group needs', title_ar: 'سلّم الطلاقة في الذكاء الاصطناعي: الدرجة التي تحتاجها كل مجموعة' },
  check: { kind: 'check', ref: null, title_en: 'Quarterly AI and digital fitness check', title_ar: 'فحص اللياقة الرقمية والذكاء الاصطناعي الفصلي' },
  course: { kind: 'course', ref: 'c-ai-gov', title_en: 'Governed use of AI tools (course)', title_ar: 'الاستخدام المحوكم لأدوات الذكاء الاصطناعي (دورة)' },
  drills: { kind: 'drill', ref: null, title_en: 'Sandbox drills: catch a wrong AI output', title_ar: 'تمارين البيئة التجريبية: اكتشاف مخرجات الذكاء الاصطناعي الخاطئة' },
};
const G = (label_en, label_ar, family_ids, side, required_rung, required_cells, rationale_en, rationale_ar) =>
  ({ label_en, label_ar, family_ids: family_ids === 'all' ? [] : family_ids, all_staff: family_ids === 'all', side, required_rung, required_cells, rationale_en, rationale_ar });

// id, EN/AR name, EN/AR purpose, ai_role, use_class, maturity, simulated, owner person, EN/AR oversight, measures, groups, status, review_due
export const SYSTEMS = [
  {
    id: 'ais-doc-search', name_en: 'Controlled-document search assistant', name_ar: 'مساعد البحث في الوثائق المضبوطة',
    purpose_en: 'Finds the controlled procedure, standard or lesson that answers a question and links to it. It answers from approved documents only.',
    purpose_ar: 'يعثر على الإجراء أو المعيار أو الدرس المضبوط الذي يجيب عن سؤال ويربط به. يجيب من الوثائق المعتمدة فقط.',
    ai_role: 'deployer', use_class: 'information', maturity: 'partial', simulated: true, owner: 'p-ai-governance',
    oversight_en: 'Staff act only on the controlled document itself, never on the assistant\'s wording.', oversight_ar: 'يعمل الموظفون وفق الوثيقة المضبوطة نفسها فقط، وليس وفق صياغة المساعد أبداً.',
    measures: [M.ladder, M.check, M.drills, M.course],
    groups: [
      G('All staff', 'جميع الموظفين', 'all', 'deployer', 1, [], 'Everyone may search; Aware is enough to use an answer that points to a document.', 'يمكن للجميع البحث؛ ودرجة الواعي كافية لاستخدام إجابة تشير إلى وثيقة.'),
      G('Operations and maintenance crews', 'طواقم التشغيل والصيانة', OPS, 'deployer', 2, [], 'Field crews use answers next to the plant, so they verify at Practitioner level.', 'تستخدم الطواقم الميدانية الإجابات بجوار المحطة، لذا تتحقق بمستوى الممارِس.'),
    ],
    status: 'published', review_due: '2027-03-31', sort: 1,
  },
  {
    id: 'ais-pdm-advisor', name_en: 'Predictive-maintenance advisor (SIMULATED)', name_ar: 'مستشار الصيانة التنبؤية (محاكاة)',
    purpose_en: 'Ranks equipment by the likelihood of degradation from simulated condition data and suggests which checks to bring forward.',
    purpose_ar: 'يرتب المعدات حسب احتمال تدهورها من بيانات حالة محاكاة ويقترح الفحوص التي يُستحسن تقديمها.',
    ai_role: 'deployer', use_class: 'decision_support', maturity: 'partial', simulated: true, owner: 'p-sme-reviewer',
    oversight_en: 'A system engineer reviews every suggestion against independent indications before any work order changes.', oversight_ar: 'يراجع مهندس الأنظمة كل اقتراح مقابل مؤشرات مستقلة قبل تغيير أي أمر عمل.',
    measures: [M.ladder, M.check, M.drills],
    groups: [
      G('Maintenance and engineering', 'الصيانة والهندسة', TECH, 'deployer', 2, ['air:3:ethics'], 'They act on its ranking, so they must challenge outputs at Builder depth.', 'يتصرفون بناءً على ترتيبه، لذا يجب أن يطعنوا في المخرجات بعمق درجة البنّاء.'),
      G('Operators', 'المشغلون', ['operations'], 'deployer', 2, [], 'Operators see the advisor\'s flags on rounds and confirm them with plant indications.', 'يرى المشغلون تنبيهات المستشار خلال الجولات ويؤكدونها بمؤشرات المحطة.'),
    ],
    status: 'published', review_due: '2027-01-31', sort: 2,
  },
  {
    id: 'ais-dalil', name_en: 'Dalil, Kafa\'a\'s governed guide', name_ar: 'دليل، المرشد المحوكم في كفاءة',
    purpose_en: 'Answers career and learning questions from Kafa\'a\'s own published content, with sources, refusals and a hand-off to people.',
    purpose_ar: 'يجيب عن أسئلة المسار المهني والتعلم من محتوى كفاءة المنشور، مع المصادر والرفض والإحالة إلى الأشخاص.',
    ai_role: 'provider', use_class: 'information', maturity: 'partial', simulated: true, owner: 'p-ai-governance',
    oversight_en: 'Retrieval only, no language model; every answer cites its source and the kill switch removes it within a minute.', oversight_ar: 'استرجاع فقط دون نموذج لغوي؛ تستشهد كل إجابة بمصدرها ويزيله مفتاح الإيقاف خلال دقيقة.',
    measures: [M.ladder, M.check],
    groups: [
      G('All staff (users)', 'جميع الموظفين (المستخدمون)', 'all', 'deployer', 1, [], 'Users read cited answers; Aware covers knowing it can be wrong.', 'يقرأ المستخدمون إجابات موثقة؛ ودرجة الواعي تغطي معرفة أنها قد تخطئ.'),
      G('Dalil builders (digital team)', 'بناة دليل (الفريق الرقمي)', ['cyber'], 'provider', 3, [], 'Provider side: they configure retrieval, refusals and evaluation, so Builder is required.', 'جانب المزوّد: يضبطون الاسترجاع والرفض والتقييم، لذا تلزم درجة البنّاء.'),
      G('Content editors', 'محررو المحتوى', ['training'], 'provider', 2, ['air:3:ethics'], 'Provider side: editors decide what Dalil may say, so they verify at Builder depth.', 'جانب المزوّد: يقرر المحررون ما يجوز لدليل قوله، لذا يتحققون بعمق درجة البنّاء.'),
    ],
    status: 'published', review_due: '2026-12-31', sort: 3,
  },
  {
    id: 'ais-meeting-notes', name_en: 'Meeting summariser', name_ar: 'ملخِّص الاجتماعات',
    purpose_en: 'Drafts minutes and action lists from meeting notes for internal, non-technical meetings.',
    purpose_ar: 'يصوغ مسودات المحاضر وقوائم الإجراءات من ملاحظات الاجتماعات الداخلية غير الفنية.',
    ai_role: 'deployer', use_class: 'information', maturity: 'partial', simulated: true, owner: 'p-chco',
    oversight_en: 'The meeting owner checks and corrects every draft before it is shared; no plant or personal data goes in.', oversight_ar: 'يتحقق صاحب الاجتماع من كل مسودة ويصححها قبل مشاركتها؛ ولا تُدخل أي بيانات عن المحطة أو بيانات شخصية.',
    measures: [M.ladder, M.check, M.course],
    groups: [G('Corporate and support functions', 'الوظائف المؤسسية والمساندة', SUPPORT, 'deployer', 2, [], 'Drafts are shared widely, so users need Practitioner habits: check, correct, protect data.', 'تُشارك المسودات على نطاق واسع، لذا يحتاج المستخدمون عادات الممارِس: التحقق والتصحيح وحماية البيانات.')],
    status: 'published', review_due: '2027-02-28', sort: 4,
  },
  {
    id: 'ais-outage-optimiser', name_en: 'Outage schedule optimiser (pilot, SIMULATED)', name_ar: 'محسِّن جدول الإيقاف (تجريبي، محاكاة)',
    purpose_en: 'Proposes re-sequenced outage activities from simulated durations and dependencies for the planners to assess.',
    purpose_ar: 'يقترح إعادة ترتيب أنشطة الإيقاف من مدد واعتماديات محاكاة ليقيّمها المخططون.',
    ai_role: 'deployer', use_class: 'decision_support', maturity: 'planned', simulated: true, owner: 'p-outage-manager',
    oversight_en: 'Planners accept or reject each proposal; the approved schedule changes only through the outage control process.', oversight_ar: 'يقبل المخططون كل اقتراح أو يرفضونه؛ ولا يتغير الجدول المعتمد إلا عبر عملية ضبط الإيقاف.',
    measures: [M.ladder, M.drills],
    groups: [G('Outage and work control', 'الإيقاف وضبط الأعمال', ['outage', 'operations', 'maintenance'], 'deployer', 2, ['air:3:design'], 'Planners judge whether the input data is fit for the decision: Builder-depth data judgement.', 'يحكم المخططون على صلاحية بيانات الإدخال للقرار: حكم على البيانات بعمق درجة البنّاء.')],
    status: 'published', review_due: '2027-04-30', sort: 5,
  },
  {
    id: 'ais-drafting', name_en: 'Arabic-English drafting assistant', name_ar: 'مساعد الصياغة العربية والإنجليزية',
    purpose_en: 'Suggests wording and translations for internal letters and notices; the author stays responsible for the text.',
    purpose_ar: 'يقترح صياغات وترجمات للخطابات والإشعارات الداخلية؛ ويبقى الكاتب مسؤولاً عن النص.',
    ai_role: 'deployer', use_class: 'information', maturity: 'full', simulated: true, owner: 'p-k-editor',
    oversight_en: 'Authors review every suggestion; controlled documents are never translated with it.', oversight_ar: 'يراجع الكتّاب كل اقتراح؛ ولا تُترجم الوثائق المضبوطة به أبداً.',
    measures: [M.ladder, M.check, M.course],
    groups: [G('All staff', 'جميع الموظفين', 'all', 'deployer', 1, [], 'Low-risk drafting help: Aware is enough, with the author checking every word.', 'مساعدة صياغة منخفضة المخاطر: درجة الواعي كافية، مع تحقق الكاتب من كل كلمة.')],
    status: 'published', review_due: '2027-06-30', sort: 6,
  },
  {
    id: 'ais-chem-triage', name_en: 'Chemistry anomaly triage assistant (draft, SIMULATED)', name_ar: 'مساعد فرز الشذوذ الكيميائي (مسودة، محاكاة)',
    purpose_en: 'Would group simulated chemistry trend alerts and point to the sampling procedure; under assessment.',
    purpose_ar: 'سيجمع تنبيهات اتجاهات كيميائية محاكاة ويشير إلى إجراء أخذ العينات؛ قيد التقييم.',
    ai_role: 'deployer', use_class: 'decision_support', maturity: 'planned', simulated: true, owner: 'p-chem-sup',
    oversight_en: 'The chemistry supervisor confirms every alert with an independent sample before any action.', oversight_ar: 'يؤكد مشرف الكيمياء كل تنبيه بعينة مستقلة قبل أي إجراء.',
    measures: [M.ladder],
    groups: [G('Chemistry and radiation protection', 'الكيمياء والوقاية من الإشعاع', ['chemistry', 'radiation-protection'], 'deployer', 2, ['air:3:design'], 'Triage needs Builder-depth judgement of data quality.', 'يحتاج الفرز حكماً على جودة البيانات بعمق درجة البنّاء.')],
    status: 'draft', review_due: null, sort: 7,
  },
  {
    id: 'ais-chat-pilot', name_en: 'General chat assistant pilot (retired)', name_ar: 'تجربة مساعد المحادثة العام (متوقفة)',
    purpose_en: 'An early pilot of a general chat tool, retired because answers could not be tied to controlled sources.',
    purpose_ar: 'تجربة مبكرة لأداة محادثة عامة، أوقفت لأن الإجابات لم يمكن ربطها بمصادر مضبوطة.',
    ai_role: 'deployer', use_class: 'information', maturity: 'planned', simulated: true, owner: 'p-ai-governance',
    oversight_en: 'Retired; kept in the register for the audit trail.', oversight_ar: 'متوقفة؛ محفوظة في السجل لأغراض مسار التدقيق.',
    measures: [M.ladder],
    groups: [G('Pilot users', 'مستخدمو التجربة', ['corporate'], 'deployer', 1, [], 'Pilot group only.', 'مجموعة التجربة فقط.')],
    status: 'retired', review_due: null, sort: 8,
  },
];

// ───────────── FS37 drills
const P = {
  use: (code) => ({
    q_en: 'Which document do you work from for this task?', q_ar: 'ما الوثيقة التي تعمل بموجبها في هذه المهمة؟',
    options: [
      { en: `The controlled procedure ${code}`, ar: `الإجراء المضبوط ${code}` },
      { en: 'The AI summary, because it is shorter', ar: 'ملخص الذكاء الاصطناعي، لأنه أقصر' },
      { en: 'Either one; they say the same thing', ar: 'أيٌّ منهما؛ فكلاهما يقول الشيء نفسه' },
    ],
    explain_en: 'The controlled procedure governs the work. An AI summary is never a substitute for it.', explain_ar: 'الإجراء المضبوط هو الذي يحكم العمل. وملخص الذكاء الاصطناعي ليس بديلاً عنه أبداً.', critical: true,
  }),
  record: {
    q_en: 'You found discrepancies. What do you do with them?', q_ar: 'وجدت تناقضات. ماذا تفعل بها؟',
    options: [
      { en: 'Record them and report them to the system owner through the AI feedback route', ar: 'أسجلها وأبلغ بها مالك النظام عبر قناة ملاحظات الذكاء الاصطناعي' },
      { en: 'Correct the summary myself and share the corrected version', ar: 'أصحح الملخص بنفسي وأشارك النسخة المصححة' },
      { en: 'Nothing; the summary is only an aid', ar: 'لا شيء؛ فالملخص مجرد أداة مساعدة' },
    ],
    explain_en: 'Reporting lets the owner fix or restrict the tool; a privately corrected copy becomes an uncontrolled document.', explain_ar: 'الإبلاغ يتيح للمالك إصلاح الأداة أو تقييدها؛ والنسخة المصححة شخصياً تصبح وثيقة غير مضبوطة.', critical: false,
  },
  challenge: {
    q_en: 'A colleague says the assistant is usually right and time is short. What do you say?', q_ar: 'يقول زميل إن المساعد محق عادةً وإن الوقت ضيق. ماذا تقول؟',
    options: [
      { en: 'We follow the procedure and check before we act', ar: 'نتبع الإجراء ونتحقق قبل أن نتصرف' },
      { en: 'Use the summary this once', ar: 'لنستخدم الملخص هذه المرة فقط' },
      { en: 'Ask the assistant again until two answers agree', ar: 'نسأل المساعد مجدداً حتى تتفق إجابتان' },
    ],
    explain_en: 'Time pressure is when verification matters most; asking the tool again does not make it a source.', explain_ar: 'ضغط الوقت هو حين يكون التحقق أهم ما يكون؛ وسؤال الأداة مجدداً لا يجعلها مصدراً.', critical: true,
  },
  scope: {
    q_en: 'Should this tool be used for this kind of task again?', q_ar: 'هل ينبغي استخدام هذه الأداة لهذا النوع من المهام مرة أخرى؟',
    options: [
      { en: 'Only within its approved-use class, with verification against the controlled document', ar: 'فقط ضمن فئة الاستخدام المعتمدة لها، مع التحقق مقابل الوثيقة المضبوطة' },
      { en: 'Yes, freely: it saves time', ar: 'نعم، بحرية: فهي توفر الوقت' },
      { en: 'No AI tool should ever be used again', ar: 'لا ينبغي استخدام أي أداة ذكاء اصطناعي مرة أخرى' },
    ],
    explain_en: 'The register sets each tool\'s approved use; the system owner decides on restrictions, not the individual user.', explain_ar: 'يحدد السجل الاستخدام المعتمد لكل أداة؛ ومالك النظام هو من يقرر القيود، لا المستخدم الفرد.', critical: false,
  },
};
/** Protocol steps (questions shown to the taker) and the key, with the right option rotated per drill so it is not always first. */
export function protocolFor(code, rot) {
  const steps = [['p-use', P.use(code)], ['p-record', P.record], ['p-challenge', P.challenge], ['p-scope', P.scope]];
  const protocol = [];
  const key = [];
  steps.forEach(([id, s], i) => {
    const k = (rot + i) % s.options.length;
    const opts = [...s.options.slice(s.options.length - k), ...s.options.slice(0, s.options.length - k)]; // right answer (index 0) moves to index k
    protocol.push({ id, q_en: s.q_en, q_ar: s.q_ar, options: opts });
    key.push({ id, correct: k, critical: s.critical, explain_en: s.explain_en, explain_ar: s.explain_ar });
  });
  return { protocol, key };
}

const S = (id, en, ar) => ({ id, text_en: en, text_ar: ar });
const E = (segment_id, kind, step_n, en, ar) => ({ segment_id, kind, step_n, explain_en: en, explain_ar: ar });
const TOOL = { tool_en: 'Procedure assistant (SIMULATED AI output)', tool_ar: 'مساعد الإجراءات (مخرجات ذكاء اصطناعي محاكاة)' };

export const DRILLS = [
  {
    id: 'ad-valve-lineup', title_en: 'Pump return to service: valve line-up', title_ar: 'إعادة المضخة إلى الخدمة: ترتيب الصمامات',
    summary_en: 'Check an AI summary of a valve line-up before a pump goes back into service.', summary_ar: 'تحقق من ملخص ذكاء اصطناعي لترتيب الصمامات قبل إعادة مضخة إلى الخدمة.',
    scenario_en: 'You are the field operator returning cooling water pump B to service after maintenance. The procedure assistant produced this summary of SYN-OP-114. Compare it with the controlled procedure, flag every segment that is wrong and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'أنت المشغل الميداني الذي يعيد مضخة مياه التبريد (ب) إلى الخدمة بعد الصيانة. أعدّ مساعد الإجراءات هذا الملخص للإجراء SYN-OP-114. قارنه بالإجراء المضبوط، وحدد كل جزء خاطئ وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 1, level: 1, est_minutes: 8, status: 'published', rot: 0,
    doc: { code: 'SYN-OP-114', revision: '4', title_en: 'Component cooling water pump B: valve line-up for return to service (SYNTHETIC)', title_ar: 'مضخة مياه تبريد المكونات (ب): ترتيب الصمامات للعودة إلى الخدمة (اصطناعي)', steps: [
      'Confirm the work order is closed and the clearance is released by the shift supervisor.|تأكد من إغلاق أمر العمل ومن رفع العزل من قبل مشرف الوردية.',
      'Verify pump B suction valve CCW-V112 is OPEN.|تحقق من أن صمام السحب CCW-V112 للمضخة (ب) مفتوح.',
      'Verify pump B discharge valve CCW-V114 is CLOSED.|تحقق من أن صمام الطرد CCW-V114 للمضخة (ب) مغلق.',
      'Vent the pump casing at CCW-V118 until water flows steadily without air.|نفِّس غلاف المضخة عند CCW-V118 حتى يتدفق الماء بثبات دون هواء.',
      'Start pump B and confirm discharge pressure between 6.2 and 6.8 bar.|شغّل المضخة (ب) وتأكد من أن ضغط الطرد بين 6.2 و6.8 بار.',
      'Slowly open discharge valve CCW-V114 over at least 30 seconds.|افتح صمام الطرد CCW-V114 ببطء على مدى 30 ثانية على الأقل.',
      'An independent verifier confirms the final valve positions and initials the line-up sheet.|يؤكد مُحقق مستقل الأوضاع النهائية للصمامات ويوقّع بالأحرف الأولى على ورقة الترتيب.',
    ] },
    segments: [
      S('s1', 'The work order must be closed and the clearance released before you start.', 'يجب إغلاق أمر العمل ورفع العزل قبل أن تبدأ.'),
      S('s2', 'Open suction valve CCW-V112 and discharge valve CCW-V114, then start pump B.', 'افتح صمام السحب CCW-V112 وصمام الطرد CCW-V114، ثم شغّل المضخة (ب).'),
      S('s3', 'Vent the pump casing at CCW-V118 until water flows without air.', 'نفِّس غلاف المضخة عند CCW-V118 حتى يتدفق الماء دون هواء.'),
      S('s4', 'Expected discharge pressure is 8.2 to 8.8 bar.', 'ضغط الطرد المتوقع من 8.2 إلى 8.8 بار.'),
      S('s5', 'Line-up complete; no further verification is needed.', 'اكتمل الترتيب؛ لا حاجة إلى تحقق إضافي.'),
      S('s6', 'Summary generated from SYN-OP-114 revision 4.', 'أُعد الملخص من الإجراء SYN-OP-114 المراجعة 4.'),
    ],
    errors: [
      E('s2', 'wrong_order', 3, 'The discharge valve stays closed until the pump is running, then opens slowly (steps 3, 5 and 6).', 'يبقى صمام الطرد مغلقاً حتى تعمل المضخة، ثم يُفتح ببطء (الخطوات 3 و5 و6).'),
      E('s4', 'wrong_value', 5, 'The procedure range is 6.2 to 6.8 bar.', 'النطاق في الإجراء من 6.2 إلى 6.8 بار.'),
      E('s5', 'omitted_step', 7, 'Step 7 requires an independent verifier to confirm the line-up.', 'تتطلب الخطوة 7 مُحققاً مستقلاً يؤكد الترتيب.'),
    ],
    pass_pct: 70,
  },
  {
    id: 'ad-feedwater-sample', title_en: 'Feedwater grab sample', title_ar: 'أخذ عينة مياه التغذية',
    summary_en: 'Catch the errors in an AI summary of a chemistry sampling procedure.', summary_ar: 'اكتشف الأخطاء في ملخص ذكاء اصطناعي لإجراء أخذ عينات كيميائية.',
    scenario_en: 'You are the chemistry technician on day shift. Before sampling, you asked the procedure assistant to summarise SYN-CH-207. Compare the summary with the controlled procedure, flag the wrong segments and name each kind of error, then follow the challenge protocol.',
    scenario_ar: 'أنت فني الكيمياء في الوردية النهارية. قبل أخذ العينة طلبت من مساعد الإجراءات تلخيص الإجراء SYN-CH-207. قارن الملخص بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع كل خطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 2, level: 2, est_minutes: 10, status: 'published', rot: 1,
    doc: { code: 'SYN-CH-207', revision: '2', title_en: 'Feedwater grab sample for dissolved oxygen (SYNTHETIC)', title_ar: 'عينة مياه التغذية لقياس الأكسجين المذاب (اصطناعي)', steps: [
      'Wear the protective equipment on the job card: gloves and safety glasses.|ارتدِ معدات الوقاية المذكورة في بطاقة العمل: القفازات ونظارات السلامة.',
      'Flush sample line SL-07 for at least 5 minutes before collecting.|اشطف خط العينات SL-07 لمدة 5 دقائق على الأقل قبل الجمع.',
      'Fill the sample bottle from the bottom without bubbles and cap it at once.|املأ زجاجة العينة من الأسفل دون فقاعات وأغلقها فوراً.',
      'Analyse dissolved oxygen within 15 minutes of sampling.|حلّل الأكسجين المذاب خلال 15 دقيقة من أخذ العينة.',
      'Record the result in the chemistry log with the sample time.|سجّل النتيجة في سجل الكيمياء مع وقت أخذ العينة.',
      'If dissolved oxygen is above 10 ppb, inform the chemistry supervisor and repeat the sample.|إذا تجاوز الأكسجين المذاب 10 أجزاء في المليار، أبلغ مشرف الكيمياء وأعد أخذ العينة.',
    ] },
    segments: [
      S('s1', 'Wear gloves and safety glasses.', 'ارتدِ القفازات ونظارات السلامة.'),
      S('s2', 'Flush sample line SL-07 for at least 1 minute.', 'اشطف خط العينات SL-07 لمدة دقيقة واحدة على الأقل.'),
      S('s3', 'Fill the bottle from the bottom without bubbles and cap it.', 'املأ الزجاجة من الأسفل دون فقاعات وأغلقها.'),
      S('s4', 'Add a pH buffer to the bottle to stabilise the sample before analysis.', 'أضف محلولاً منظماً للأس الهيدروجيني إلى الزجاجة لتثبيت العينة قبل التحليل.'),
      S('s5', 'Analyse dissolved oxygen within 15 minutes and log the result with the sample time.', 'حلّل الأكسجين المذاب خلال 15 دقيقة وسجّل النتيجة مع وقت أخذ العينة.'),
      S('s6', 'Readings above 10 ppb are typical after start-up and can be ignored.', 'القراءات فوق 10 أجزاء في المليار معتادة بعد بدء التشغيل ويمكن تجاهلها.'),
      S('s7', 'Summary based on SYN-CH-207 revision 1.', 'ملخص مبني على الإجراء SYN-CH-207 المراجعة 1.'),
    ],
    errors: [
      E('s2', 'wrong_value', 2, 'The line is flushed for at least 5 minutes, not 1.', 'يُشطف الخط 5 دقائق على الأقل وليس دقيقة واحدة.'),
      E('s4', 'invented', null, 'The procedure adds nothing to the bottle; this step is invented and would spoil the sample.', 'لا يضيف الإجراء شيئاً إلى الزجاجة؛ هذه خطوة مختلقة وستفسد العينة.'),
      E('s6', 'overreach', 6, 'Step 6 says the opposite: above 10 ppb, inform the supervisor and repeat the sample.', 'تقول الخطوة 6 العكس: فوق 10 أجزاء في المليار أبلغ المشرف وأعد أخذ العينة.'),
      E('s7', 'stale_revision', null, 'The controlled procedure is revision 2; the summary cites an old revision.', 'الإجراء المضبوط هو المراجعة 2؛ والملخص يستشهد بمراجعة قديمة.'),
    ],
    pass_pct: 70,
  },
  {
    id: 'ad-rwp-briefing', title_en: 'Pre-job briefing under a radiation work permit', title_ar: 'إحاطة ما قبل العمل بموجب تصريح العمل الإشعاعي',
    summary_en: 'Check an AI summary of a pre-job briefing checklist.', summary_ar: 'تحقق من ملخص ذكاء اصطناعي لقائمة تحقق إحاطة ما قبل العمل.',
    scenario_en: 'You lead a short job under a radiation work permit. The procedure assistant summarised the briefing procedure SYN-RP-031 for you. Compare it with the controlled procedure, flag the wrong segments and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'تقود عملاً قصيراً بموجب تصريح عمل إشعاعي. لخّص لك مساعد الإجراءات إجراء الإحاطة SYN-RP-031. قارنه بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 1, level: 1, est_minutes: 7, status: 'published', rot: 2,
    doc: { code: 'SYN-RP-031', revision: '3', title_en: 'Pre-job briefing for work under a radiation work permit (SYNTHETIC)', title_ar: 'إحاطة ما قبل العمل بموجب تصريح العمل الإشعاعي (اصطناعي)', steps: [
      'Read the radiation work permit and confirm the task matches its scope.|اقرأ تصريح العمل الإشعاعي وتأكد من تطابق المهمة مع نطاقه.',
      'Review the survey map and the expected dose rates for the work area.|راجع خريطة المسح ومعدلات الجرعة المتوقعة في منطقة العمل.',
      'Confirm each worker\'s dosimeter alarm set points from the permit.|أكّد نقاط إنذار مقياس الجرعة لكل عامل من التصريح.',
      'Agree stop-work conditions: a dosimeter alarm, an unexpected dose rate or a change of scope.|اتفقوا على شروط إيقاف العمل: إنذار مقياس الجرعة أو معدل جرعة غير متوقع أو تغيّر النطاق.',
      'Agree the exit route and the contamination control point.|اتفقوا على طريق الخروج ونقطة التحكم في التلوث.',
      'Record attendance on the briefing sheet.|سجّل الحضور في ورقة الإحاطة.',
    ] },
    segments: [
      S('s1', 'Check that the task matches the scope of the radiation work permit.', 'تحقق من تطابق المهمة مع نطاق تصريح العمل الإشعاعي.'),
      S('s2', 'Review the survey map and the expected dose rates.', 'راجع خريطة المسح ومعدلات الجرعة المتوقعة.'),
      S('s3', 'Confirm each dosimeter\'s alarm set points from the permit.', 'أكّد نقاط إنذار كل مقياس جرعة من التصريح.'),
      S('s4', 'Go to the work area; stop work only if the supervisor tells you to.', 'توجّه إلى منطقة العمل؛ ولا توقف العمل إلا إذا طلب منك المشرف ذلك.'),
      S('s5', 'Agree the exit route and the contamination control point.', 'اتفقوا على طريق الخروج ونقطة التحكم في التلوث.'),
      S('s6', 'Attendance only needs recording for jobs longer than one hour.', 'لا يلزم تسجيل الحضور إلا للأعمال التي تزيد على ساعة.'),
    ],
    errors: [
      E('s4', 'omitted_step', 4, 'Step 4 sets stop-work conditions everyone agrees; anyone stops work when one occurs.', 'تحدد الخطوة 4 شروط إيقاف العمل التي يتفق عليها الجميع؛ ويوقف أي شخص العمل عند حدوث أحدها.'),
      E('s6', 'invented', 6, 'The procedure has no one-hour exception: attendance is always recorded.', 'لا يتضمن الإجراء استثناء الساعة الواحدة: يُسجل الحضور دائماً.'),
    ],
    pass_pct: 70,
  },
  {
    id: 'ad-mov-pm', title_en: 'Motor-operated valve preventive maintenance', title_ar: 'الصيانة الوقائية لصمام يعمل بمحرك',
    summary_en: 'Four errors hide in an AI summary of an actuator maintenance procedure.', summary_ar: 'أربعة أخطاء مخفية في ملخص ذكاء اصطناعي لإجراء صيانة مشغّل صمام.',
    scenario_en: 'You are the maintenance technician on an annual actuator job. The procedure assistant summarised SYN-MT-412 for your work package. Compare it with the controlled procedure, flag the wrong segments and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'أنت فني الصيانة في مهمة سنوية لمشغّل صمام. لخّص مساعد الإجراءات الإجراء SYN-MT-412 لحزمة عملك. قارنه بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 2, level: 2, est_minutes: 10, status: 'published', rot: 0,
    doc: { code: 'SYN-MT-412', revision: '5', title_en: 'Motor-operated valve actuator: annual preventive maintenance (SYNTHETIC)', title_ar: 'مشغّل صمام يعمل بمحرك: الصيانة الوقائية السنوية (اصطناعي)', steps: [
      'Confirm the clearance is in place and the actuator is isolated from its power supply.|تأكد من سريان العزل ومن فصل المشغّل عن مصدر طاقته.',
      'Inspect the gearbox grease; replace it if it is contaminated.|افحص شحم صندوق التروس؛ واستبدله إذا كان ملوثاً.',
      'Check the torque switch setting against the valve data sheet value of 120 Nm.|افحص ضبط مفتاح العزم مقابل قيمة ورقة بيانات الصمام البالغة 120 نيوتن متر.',
      'Inspect limit switch contacts and wiring terminations.|افحص نقاط تلامس مفاتيح الحد ونهايات الأسلاك.',
      'Restore power under the clearance release, then perform a full stroke test.|أعد الطاقة وفق رفع العزل، ثم نفّذ اختبار شوط كامل.',
      'Record the stroke time; it must be within 10% of the 14-second baseline.|سجّل زمن الشوط؛ ويجب أن يكون ضمن 10% من خط الأساس البالغ 14 ثانية.',
      'Report any out-of-tolerance result to the system engineer before closing the work order.|أبلغ مهندس النظام بأي نتيجة خارج التفاوت قبل إغلاق أمر العمل.',
    ] },
    segments: [
      S('s1', 'Make sure the actuator is isolated under the clearance.', 'تأكد من عزل المشغّل وفق العزل.'),
      S('s2', 'Check the gearbox grease and replace it if contaminated.', 'افحص شحم صندوق التروس واستبدله إذا كان ملوثاً.'),
      S('s3', 'Set the torque switch to 150 Nm to give extra margin.', 'اضبط مفتاح العزم على 150 نيوتن متر لإضافة هامش.'),
      S('s4', 'Inspect the limit switch contacts and wiring.', 'افحص نقاط تلامس مفاتيح الحد والأسلاك.'),
      S('s5', 'Perform the stroke test, then restore power.', 'نفّذ اختبار الشوط، ثم أعد الطاقة.'),
      S('s6', 'A stroke time of up to 20 seconds is acceptable.', 'زمن الشوط حتى 20 ثانية مقبول.'),
      S('s7', 'Note any out-of-tolerance result in the work order and close it.', 'دوّن أي نتيجة خارج التفاوت في أمر العمل وأغلقه.'),
    ],
    errors: [
      E('s3', 'wrong_value', 3, 'The setting is checked against 120 Nm from the data sheet; "extra margin" is not in the procedure.', 'يُفحص الضبط مقابل 120 نيوتن متر من ورقة البيانات؛ و"الهامش الإضافي" ليس في الإجراء.'),
      E('s5', 'wrong_order', 5, 'Power is restored first, then the stroke test is performed.', 'تُعاد الطاقة أولاً، ثم يُنفذ اختبار الشوط.'),
      E('s6', 'wrong_value', 6, 'Within 10% of 14 seconds means 12.6 to 15.4 seconds.', 'ضمن 10% من 14 ثانية يعني من 12.6 إلى 15.4 ثانية.'),
      E('s7', 'omitted_step', 7, 'The system engineer must be told before the work order closes.', 'يجب إبلاغ مهندس النظام قبل إغلاق أمر العمل.'),
    ],
    pass_pct: 70,
  },
  {
    id: 'ad-requisition-qa', title_en: 'Quality requirements in a purchase requisition', title_ar: 'متطلبات الجودة في طلب الشراء',
    summary_en: 'An AI summary of a requisition review reaches a conclusion it cannot support.', summary_ar: 'ملخص ذكاء اصطناعي لمراجعة طلب شراء يصل إلى استنتاج لا يستطيع دعمه.',
    scenario_en: 'You are preparing a requisition for a safety-related spare part. The procedure assistant summarised the review procedure SYN-SC-019. Compare it with the controlled procedure, flag the wrong segments and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'تُعد طلب شراء لقطعة غيار متعلقة بالسلامة. لخّص مساعد الإجراءات إجراء المراجعة SYN-SC-019. قارنه بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 1, level: 1, est_minutes: 7, status: 'published', rot: 1,
    doc: { code: 'SYN-SC-019', revision: '2', title_en: 'Purchase requisition review for safety-related spare parts (SYNTHETIC)', title_ar: 'مراجعة طلب شراء قطع الغيار المتعلقة بالسلامة (اصطناعي)', steps: [
      'Confirm the item\'s quality classification on the bill of materials.|أكّد تصنيف الجودة للصنف في قائمة المواد.',
      'For safety-related items, include quality requirements clause QR-3.|للأصناف المتعلقة بالسلامة، أدرج بند متطلبات الجودة QR-3.',
      'Require a certificate of conformance from the supplier with each delivery.|اطلب شهادة مطابقة من المورد مع كل توريد.',
      'Check that the supplier is on the approved suppliers list for this item class.|تحقق من أن المورد مدرج في قائمة الموردين المعتمدين لفئة هذا الصنف.',
      'Send the requisition to Quality for review before release.|أرسل طلب الشراء إلى إدارة الجودة للمراجعة قبل إصداره.',
    ] },
    segments: [
      S('s1', 'Confirm the quality classification on the bill of materials.', 'أكّد تصنيف الجودة في قائمة المواد.'),
      S('s2', 'Include clause QR-3 for safety-related items.', 'أدرج البند QR-3 للأصناف المتعلقة بالسلامة.'),
      S('s3', 'The certificate of conformance is optional for repeat orders.', 'شهادة المطابقة اختيارية للطلبات المتكررة.'),
      S('s4', 'Any supplier with a valid trade licence can be used.', 'يمكن استخدام أي مورد لديه رخصة تجارية سارية.'),
      S('s5', 'Send the requisition to Quality for review before release.', 'أرسل طلب الشراء إلى إدارة الجودة للمراجعة قبل إصداره.'),
      S('s6', 'This requisition meets all quality requirements.', 'يستوفي طلب الشراء هذا جميع متطلبات الجودة.'),
    ],
    errors: [
      E('s3', 'invented', 3, 'There is no repeat-order exception: every delivery needs a certificate of conformance.', 'لا يوجد استثناء للطلبات المتكررة: يحتاج كل توريد إلى شهادة مطابقة.'),
      E('s4', 'omitted_step', 4, 'Step 4 limits the order to suppliers on the approved list for the item class.', 'تقصر الخطوة 4 الطلب على الموردين المدرجين في القائمة المعتمدة لفئة الصنف.'),
      E('s6', 'overreach', 5, 'Only the Quality review decides whether requirements are met; the assistant cannot conclude this.', 'مراجعة الجودة وحدها تقرر استيفاء المتطلبات؛ ولا يستطيع المساعد استنتاج ذلك.'),
    ],
    pass_pct: 70,
  },
  {
    id: 'ad-shift-turnover', title_en: 'Shift turnover checklist', title_ar: 'قائمة تسليم الوردية',
    summary_en: 'The hardest drill: four subtle errors in an AI turnover checklist, including a false all-clear.', summary_ar: 'أصعب تمرين: أربعة أخطاء دقيقة في قائمة تسليم أعدها الذكاء الاصطناعي، منها تطمين زائف.',
    scenario_en: 'You are the on-coming control room operator. The procedure assistant turned SYN-OP-009 into a turnover checklist. Compare it with the controlled procedure, flag the wrong segments and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'أنت مشغل غرفة التحكم القادم للوردية. حوّل مساعد الإجراءات الإجراء SYN-OP-009 إلى قائمة تسليم. قارنها بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 3, level: 2, est_minutes: 12, status: 'published', rot: 2,
    doc: { code: 'SYN-OP-009', revision: '7', title_en: 'Shift turnover: control room review (SYNTHETIC)', title_ar: 'تسليم الوردية: مراجعة غرفة التحكم (اصطناعي)', steps: [
      'Review the narrative log for the last 12 hours.|راجع السجل السردي لآخر 12 ساعة.',
      'Review equipment out of service and its compensatory actions.|راجع المعدات خارج الخدمة والإجراءات التعويضية الخاصة بها.',
      'Review open limiting conditions for operation and their completion times.|راجع شروط التشغيل المقيِّدة المفتوحة وأوقات إنجازها.',
      'Review planned work and tests for the coming shift.|راجع الأعمال والاختبارات المخطط لها للوردية القادمة.',
      'Walk down the control boards with the off-going operator.|تفقّد لوحات التحكم مع المشغل المغادر.',
      'Accept the shift only after all your questions are answered.|لا تستلم الوردية إلا بعد الإجابة عن جميع أسئلتك.',
    ] },
    segments: [
      S('s1', 'Review the narrative log for the last 12 hours.', 'راجع السجل السردي لآخر 12 ساعة.'),
      S('s2', 'Review the equipment that is out of service.', 'راجع المعدات خارج الخدمة.'),
      S('s3', 'Open limiting conditions for operation can be reviewed after you accept the shift.', 'يمكن مراجعة شروط التشغيل المقيِّدة المفتوحة بعد استلام الوردية.'),
      S('s4', 'Review planned work and tests for the coming shift.', 'راجع الأعمال والاختبارات المخطط لها للوردية القادمة.'),
      S('s5', 'A control board walkdown is optional when the log is clear.', 'تفقّد لوحات التحكم اختياري عندما يكون السجل خالياً.'),
      S('s6', 'You can accept the shift: the assistant has confirmed the plant is stable.', 'يمكنك استلام الوردية: فقد أكد المساعد أن المحطة مستقرة.'),
      S('s7', 'Based on SYN-OP-009 revision 7.', 'مبني على الإجراء SYN-OP-009 المراجعة 7.'),
    ],
    errors: [
      E('s2', 'omitted_step', 2, 'The compensatory actions for out-of-service equipment have been dropped.', 'أُسقطت الإجراءات التعويضية الخاصة بالمعدات خارج الخدمة.'),
      E('s3', 'wrong_order', 3, 'Open limiting conditions are reviewed before you accept the shift.', 'تُراجع شروط التشغيل المقيِّدة المفتوحة قبل استلام الوردية.'),
      E('s5', 'invented', 5, 'The walkdown is always required; the "clear log" exception is invented.', 'التفقد مطلوب دائماً؛ واستثناء "السجل الخالي" مختلق.'),
      E('s6', 'overreach', 6, 'The assistant cannot confirm plant status; you accept only when your own questions are answered.', 'لا يستطيع المساعد تأكيد حالة المحطة؛ ولا تستلم إلا عند الإجابة عن أسئلتك أنت.'),
    ],
    pass_pct: 75,
  },
  {
    id: 'ad-outage-scope', title_en: 'Outage scope change (draft)', title_ar: 'تغيير نطاق الإيقاف (مسودة)',
    summary_en: 'Draft drill under review by the training manager.', summary_ar: 'تمرين مسودة قيد مراجعة مدير التدريب.',
    scenario_en: 'You plan work in an outage window. The procedure assistant summarised SYN-OM-055. Compare it with the controlled procedure, flag the wrong segments and name the kind of error, then follow the challenge protocol.',
    scenario_ar: 'تخطط لأعمال ضمن نافذة إيقاف. لخّص مساعد الإجراءات الإجراء SYN-OM-055. قارنه بالإجراء المضبوط، وحدد الأجزاء الخاطئة وسمِّ نوع الخطأ، ثم اتبع بروتوكول الطعن.',
    difficulty: 2, level: 2, est_minutes: 8, status: 'draft', rot: 1,
    doc: { code: 'SYN-OM-055', revision: '1', title_en: 'Outage work package: scope change control (SYNTHETIC)', title_ar: 'حزمة أعمال الإيقاف: ضبط تغيير النطاق (اصطناعي)', steps: [
      'Compare the requested change with the approved work package scope.|قارن التغيير المطلوب بنطاق حزمة العمل المعتمدة.',
      'Raise a scope change request for any added task.|ارفع طلب تغيير نطاق لأي مهمة مضافة.',
      'Obtain the outage manager\'s approval before work starts on the added task.|احصل على موافقة مدير الإيقاف قبل بدء العمل في المهمة المضافة.',
      'Update the schedule and inform the affected crews.|حدّث الجدول وأبلغ الطواقم المتأثرة.',
    ] },
    segments: [
      S('s1', 'Compare the change with the approved scope.', 'قارن التغيير بالنطاق المعتمد.'),
      S('s2', 'Small added tasks can start without a scope change request.', 'يمكن بدء المهام المضافة الصغيرة دون طلب تغيير نطاق.'),
      S('s3', 'Update the schedule and inform crews, then obtain approval.', 'حدّث الجدول وأبلغ الطواقم، ثم احصل على الموافقة.'),
      S('s4', 'Based on SYN-OM-055 revision 1.', 'مبني على الإجراء SYN-OM-055 المراجعة 1.'),
    ],
    errors: [
      E('s2', 'invented', 2, 'Every added task needs a scope change request; there is no size exception.', 'تحتاج كل مهمة مضافة إلى طلب تغيير نطاق؛ ولا يوجد استثناء للحجم.'),
      E('s3', 'wrong_order', 3, 'Approval comes before work starts; the schedule update follows.', 'تأتي الموافقة قبل بدء العمل؛ ثم يلي ذلك تحديث الجدول.'),
    ],
    pass_pct: 70,
  },
];
