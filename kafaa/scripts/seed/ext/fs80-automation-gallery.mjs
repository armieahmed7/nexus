// FS80 (future-skills wave I · E2, M29) seed: the automation and agent gallery with builder credit.
// The gallery opened in August 2026 (after the FS20 capstones): credited builders already hold the automation-design skill from their
// capstone (so the credit raises a level, never adds a new holder) and every credit is dated after their first evidence, so FS72
// suggestions and FS70 published lists stay as stored (checked at the end of finalize).
// build():    16 synthetic gallery entries (metadata only: purpose, data used, accountable owner, human check, how to use, the FS36 register row)
//             in every status: 10 approved, 2 submitted (AI governance queue), 1 returned (for the `nse` role card), 1 draft, 1 rejected, 1 retired.
//             Every entry passes automationProblem (no code, scripts, links or credentials; no plant-security or certification wording) and
//             every decision passes decisionProblem (maker-checker: AI governance never decides an entry it built or owns).
// finalize(): FINALIZE_LAST (runs after fs36 drills and fs70+ builders, before fsqa*): records adoptions by active staff whose FS09 rung reaches
//             the entry's minimum (never the builder, once per person, dated after the approval and before 2026-10-08), sets each counter,
//             writes the builder credit (F01 `ojt` evidence, basis validated, ref_table automations, level 2 from the first adopter and 3 from
//             REUSE_AT) for approved and retired entries with adopters, re-derives those builders' states, and fails the build if any entry
//             breaks the rules (counter = adoptions, evidence only after approval and first adoption, every entry on a register row).
// Synthetic people only; the AI systems are the FS36 register's synthetic examples. Nothing here runs: these are descriptions.
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { aiRung } from '../../../src/modules/m29/fluency.ts';
import { isStaff } from '../../../src/modules/m29/fitness.ts';
import { inferSuggestions, ssgWorldFromTables } from '../../../src/modules/m28/suggestions.ts';
import { BUILDER_SKILL, REUSE_AT, automationProblem, builderEvidenceId, builderLevel, decisionProblem } from '../../../src/modules/m29/automations.ts';

export const FINALIZE_LAST = true;
export const DECIDER = 'p-ai-governance';
export const DECIDER_2 = 'p-k-admin';

const E = (en, ar) => ({ en, ar });
/** Gallery entries. adopt: how many adopters the seed records (capped by who qualifies); decided: the decision date. */
export const ENTRIES = [
  {
    id: 'atm-procedure-revision-digest', kind: 'workflow', system: 'ais-doc-search', builder: 'w-qa-01', owner: 'p-head-sq', status: 'approved', min_rung: 1, classes: ['controlled_docs', 'internal'],
    submitted: '2026-08-04', decided: '2026-08-11', adopt: 14, sort: 1,
    title: E('Procedure revision digest', 'ملخص مراجعات الإجراءات'),
    purpose: E('Each Monday the document search assistant lists the controlled procedures revised last week that my work packages cite, with the revision and a one-line summary of what changed.',
      'كل يوم اثنين يسرد مساعد البحث في الوثائق الإجراءات المضبوطة التي رُوجعت في الأسبوع الماضي وتستشهد بها حزم عملي، مع رقم المراجعة وملخص من سطر واحد لما تغيّر.'),
    data: E('Controlled-document index and revision notes (read only); my saved list of procedure numbers.', 'فهرس الوثائق المضبوطة وملاحظات المراجعة (للقراءة فقط)، وقائمتي المحفوظة بأرقام الإجراءات.'),
    oversight: E('The reader opens the controlled copy before using any step; the summary is never quoted as the procedure.', 'يفتح القارئ النسخة المضبوطة قبل استخدام أي خطوة، ولا يُقتبس الملخص على أنه الإجراء.'),
    benefit: E('About 20 minutes saved per inspector each week (SIMULATED estimate); fewer work packages started on a superseded revision.', 'توفير نحو 20 دقيقة لكل مفتش أسبوعياً (تقدير محاكى)، وعدد أقل من حزم العمل التي تبدأ بمراجعة ملغاة.'),
    how: E('Save the procedure numbers you use in the document search assistant, choose "weekly revision digest" and pick Monday. Read the digest, then open each controlled copy.',
      'احفظ أرقام الإجراءات التي تستخدمها في مساعد البحث في الوثائق، واختر «ملخص المراجعات الأسبوعي» وحدد يوم الاثنين. اقرأ الملخص ثم افتح كل نسخة مضبوطة.'),
  },
  {
    id: 'atm-shift-turnover-brief', kind: 'template', system: 'ais-meeting-notes', builder: 'w-ro-01', owner: 'p-sro', status: 'approved', min_rung: 1, classes: ['internal'],
    submitted: '2026-08-05', decided: '2026-08-12', adopt: 11, sort: 2,
    title: E('Shift turnover brief template', 'قالب موجز تسليم المناوبة'),
    purpose: E('A structured note the meeting summariser fills from the turnover discussion: plant status, open work, limiting conditions to watch and questions for the next crew.',
      'ملاحظة منظمة يملؤها ملخّص الاجتماعات من نقاش التسليم: حالة المحطة، والأعمال المفتوحة، والشروط المقيِّدة الواجب مراقبتها، وأسئلة للطاقم التالي.'),
    data: E('The spoken turnover discussion in the meeting room (internal); no logs or plant data are read.', 'نقاش التسليم المنطوق في غرفة الاجتماعات (داخلي)؛ لا تُقرأ أي سجلات أو بيانات للمحطة.'),
    oversight: E('The off-going shift supervisor reads and corrects the note before signing the turnover; the official log stays the record.', 'يقرأ مشرف المناوبة المغادر الملاحظة ويصححها قبل توقيع التسليم، ويبقى السجل الرسمي هو المرجع.'),
    benefit: E('A turnover note in the same order every shift, so the oncoming crew finds limiting conditions first.', 'ملاحظة تسليم بالترتيب نفسه في كل مناوبة، فيجد الطاقم القادم الشروط المقيِّدة أولاً.'),
    how: E('Start the meeting summariser, choose the "shift turnover" template, hold the turnover as usual, then review the note line by line before signing.',
      'شغّل ملخّص الاجتماعات واختر قالب «تسليم المناوبة»، وأجرِ التسليم كالمعتاد، ثم راجع الملاحظة سطراً بسطر قبل التوقيع.'),
  },
  {
    id: 'atm-training-feedback-themes', kind: 'report', system: 'ais-meeting-notes', builder: 'w-instr-01', owner: 'p-training-mgr', status: 'approved', min_rung: 1, classes: ['internal'],
    submitted: '2026-08-02', decided: '2026-08-06', adopt: 9, sort: 3,
    title: E('Course feedback themes', 'محاور ملاحظات الدورات'),
    purpose: E('Groups the free-text comments of a course evaluation into themes with counts, so the instructor sees what to change before the next run.',
      'يجمع التعليقات النصية في تقييم الدورة في محاور مع أعدادها، ليرى المدرّب ما يجب تغييره قبل الدورة التالية.'),
    data: E('Anonymous course evaluation comments (internal); names are never part of the input.', 'تعليقات تقييم الدورات المجهولة (داخلية)؛ ولا تدخل الأسماء في المدخلات أبداً.'),
    oversight: E('The instructor checks each theme against three of the original comments before acting on it.', 'يتحقق المدرّب من كل محور مقابل ثلاثة من التعليقات الأصلية قبل التصرف بناءً عليه.'),
    benefit: E('Evaluation comments read in minutes instead of an afternoon; changes to the course are traced to themes.', 'قراءة تعليقات التقييم في دقائق بدلاً من فترة ما بعد الظهر، وربط تغييرات الدورة بالمحاور.'),
    how: E('Export the comments of one course run, paste them into the summariser with the "feedback themes" template, and read the themes beside the comments.',
      'صدّر تعليقات دورة واحدة، والصقها في الملخّص مع قالب «محاور الملاحظات»، واقرأ المحاور بجوار التعليقات.'),
  },
  {
    id: 'atm-outage-lookahead', kind: 'report', system: 'ais-outage-optimiser', builder: 'p-outage-planner', owner: 'p-outage-manager', status: 'approved', min_rung: 2, classes: ['internal'],
    submitted: '2026-08-10', decided: '2026-08-18', adopt: 7, sort: 4,
    title: E('Outage look-ahead summary', 'ملخص النظرة المستقبلية للإيقاف'),
    purpose: E('A two-week look-ahead from the outage schedule optimiser pilot: activities whose float is shrinking and the crews they depend on, as a briefing page for the daily outage meeting.',
      'نظرة لأسبوعين من تجربة محسّن جدول الإيقاف: الأنشطة التي يتقلص هامشها والطواقم التي تعتمد عليها، كصفحة إحاطة لاجتماع الإيقاف اليومي.'),
    data: E('SIMULATED outage schedule from the optimiser pilot (internal); no live plant data.', 'جدول إيقاف محاكى من تجربة المحسّن (داخلي)؛ لا بيانات حية للمحطة.'),
    oversight: E('The outage planner confirms every flagged activity with the work-control lead before it is briefed.', 'يؤكد مخطط الإيقاف كل نشاط مُعلَّم مع قائد التحكم في العمل قبل عرضه في الإحاطة.'),
    benefit: E('The daily meeting starts with the five activities most at risk (SIMULATED pilot).', 'يبدأ الاجتماع اليومي بالأنشطة الخمسة الأكثر عرضة للخطر (تجربة محاكاة).'),
    how: E('Open the optimiser pilot, choose "look-ahead summary", set two weeks and print the page for the meeting; mark each flag as confirmed or not.',
      'افتح تجربة المحسّن واختر «ملخص النظرة المستقبلية» وحدد أسبوعين واطبع الصفحة للاجتماع، وعلّم كل إشارة بأنها مؤكدة أو لا.'),
  },
  {
    id: 'atm-dalil-course-finder', kind: 'agent', system: 'ais-dalil', builder: 'w-eng-01', owner: 'p-training-mgr', status: 'approved', min_rung: 1, classes: ['public', 'internal'],
    submitted: '2026-08-13', decided: '2026-08-21', adopt: 6, sort: 5,
    title: E('Dalil course-finder prompt pack', 'حزمة أسئلة دليل للبحث عن الدورات'),
    purpose: E('Five tested questions to ask Dalil when a supervisor needs a course for a skill gap, each with what a good answer cites.',
      'خمسة أسئلة مجرّبة تُطرح على دليل عندما يحتاج المشرف دورة لفجوة مهارة، مع ما يجب أن تستشهد به الإجابة الجيدة لكل منها.'),
    data: E('Kafa\'a public and staff course catalogue through Dalil (retrieval only).', 'كتالوج دورات كفاءة العام وللموظفين عبر دليل (استرجاع فقط).'),
    oversight: E('The supervisor opens the cited course page before booking; an answer without a citation is not used.', 'يفتح المشرف صفحة الدورة المستشهد بها قبل الحجز، ولا تُستخدم إجابة بلا استشهاد.'),
    benefit: E('Supervisors find a matching course on the first try more often.', 'يجد المشرفون دورة مناسبة من المحاولة الأولى في أغلب الأحيان.'),
    how: E('Copy one of the five questions into Dalil, replace the skill name, and check the citation list under the answer.', 'انسخ أحد الأسئلة الخمسة إلى دليل، واستبدل اسم المهارة، وتحقق من قائمة الاستشهادات أسفل الإجابة.'),
  },
  {
    id: 'atm-cap-action-digest', kind: 'workflow', system: 'ais-doc-search', builder: 'p-cap-coord', owner: 'p-cap-chair', status: 'approved', min_rung: 1, classes: ['internal'],
    submitted: '2026-08-17', decided: '2026-08-25', adopt: 4, sort: 6,
    title: E('Corrective-action status digest', 'ملخص حالة الإجراءات التصحيحية'),
    purpose: E('A fortnightly list of open corrective actions whose due date is within 30 days, grouped by owner department, for the review panel coordinator.',
      'قائمة كل أسبوعين بالإجراءات التصحيحية المفتوحة التي يحل موعدها خلال 30 يوماً، مجمعة حسب الإدارة المالكة، لمنسق لجنة المراجعة.'),
    data: E('Corrective-action register extract (internal, SIMULATED in this demo).', 'مستخرج سجل الإجراءات التصحيحية (داخلي، ومحاكى في هذا العرض).'),
    oversight: E('The coordinator checks each due date in the register before sending reminders.', 'يتحقق المنسق من كل موعد في السجل قبل إرسال التذكيرات.'),
    benefit: E('Reminders go out before actions fall due instead of after.', 'تُرسل التذكيرات قبل حلول موعد الإجراءات لا بعده.'),
    how: E('In the document search assistant choose "action digest", select the 30-day window and the departments you coordinate.', 'في مساعد البحث في الوثائق اختر «ملخص الإجراءات»، وحدد نافذة 30 يوماً والإدارات التي تنسق معها.'),
  },
  {
    id: 'atm-requisition-spec-check', kind: 'template', system: 'ais-drafting', builder: 'p-nse', owner: 'p-cpo', status: 'approved', min_rung: 1, classes: ['internal', 'controlled_docs'],
    submitted: '2026-09-22', decided: '2026-09-30', adopt: 0, sort: 7,
    title: E('Requisition specification checklist', 'قائمة تحقق مواصفات طلب الشراء'),
    purpose: E('A drafting template that turns a purchase requisition into a bilingual checklist of the quality and technical clauses the specification must carry.',
      'قالب صياغة يحوّل طلب الشراء إلى قائمة تحقق ثنائية اللغة بالبنود الفنية وبنود الجودة التي يجب أن تتضمنها المواصفة.'),
    data: E('The requisition text and the standard clause library (internal).', 'نص طلب الشراء ومكتبة البنود القياسية (داخلية).'),
    oversight: E('The specification engineer ticks every clause against the requisition; the checklist never replaces the engineering review.', 'يؤشر مهندس المواصفات على كل بند مقابل طلب الشراء، ولا تحل القائمة محل المراجعة الهندسية أبداً.'),
    benefit: E('Fewer requisitions returned for a missing clause.', 'عدد أقل من طلبات الشراء المعادة بسبب بند ناقص.'),
    how: E('Open the drafting assistant, choose the "requisition checklist" template, paste the requisition text and review each clause.', 'افتح مساعد الصياغة واختر قالب «قائمة تحقق طلب الشراء» والصق نص الطلب وراجع كل بند.'),
  },
  {
    id: 'atm-chem-trend-notes', kind: 'agent', system: 'ais-pdm-advisor', builder: 'w-chem-01', owner: 'p-chem-sup', status: 'approved', min_rung: 2, classes: ['internal'],
    submitted: '2026-08-14', decided: '2026-08-26', adopt: 2, sort: 8,
    title: E('Chemistry trend note drafter', 'صائغ ملاحظات اتجاهات الكيمياء'),
    purpose: E('Drafts the weekly chemistry trend note from the SIMULATED advisor\'s trend flags: which parameters moved, against which administrative limit, and the sample to repeat.',
      'يصوغ ملاحظة اتجاهات الكيمياء الأسبوعية من إشارات الاتجاه في المستشار المحاكى: المعايير التي تحركت، ومقابل أي حد إداري، والعينة الواجب تكرارها.'),
    data: E('SIMULATED trend flags from the predictive-maintenance advisor (internal).', 'إشارات اتجاه محاكاة من مستشار الصيانة التنبؤية (داخلية).'),
    oversight: E('The chemistry supervisor compares each flag with the laboratory result before the note is issued.', 'يقارن مشرف الكيمياء كل إشارة بنتيجة المختبر قبل إصدار الملاحظة.'),
    benefit: E('The trend note is ready on Monday morning (SIMULATED pilot).', 'تكون ملاحظة الاتجاهات جاهزة صباح الاثنين (تجربة محاكاة).'),
    how: E('Ask the advisor for "trend note draft", pick the week, then edit the draft with the laboratory results beside it.', 'اطلب من المستشار «مسودة ملاحظة الاتجاهات» واختر الأسبوع ثم حرر المسودة ونتائج المختبر بجوارها.'),
  },
  {
    id: 'atm-rp-briefing-outline', kind: 'template', system: 'ais-drafting', builder: 'w-rp-01', owner: 'p-rp-lead', status: 'approved', min_rung: 1, classes: ['internal'],
    submitted: '2026-07-28', decided: '2026-08-04', adopt: 1, sort: 9,
    title: E('Radiological work briefing outline', 'مخطط إحاطة العمل الإشعاعي'),
    purpose: E('A bilingual outline for the pre-job radiological briefing: work area conditions, dose plan, stop-work points and questions to the crew.',
      'مخطط ثنائي اللغة للإحاطة الإشعاعية قبل العمل: ظروف منطقة العمل، وخطة الجرعة، ونقاط إيقاف العمل، وأسئلة للطاقم.'),
    data: E('The work permit summary typed by the technician (internal); no dosimetry records are read.', 'ملخص تصريح العمل الذي يكتبه الفني (داخلي)؛ لا تُقرأ سجلات قياس الجرعات.'),
    oversight: E('The radiation protection technician gives the briefing and checks the dose plan against the permit.', 'يقدّم فني الوقاية الإشعاعية الإحاطة ويتحقق من خطة الجرعة مقابل التصريح.'),
    benefit: E('Every briefing covers the same points in both languages.', 'تغطي كل إحاطة النقاط نفسها باللغتين.'),
    how: E('Choose the "radiological briefing" template in the drafting assistant and type the permit summary; print the outline for the crew.', 'اختر قالب «الإحاطة الإشعاعية» في مساعد الصياغة واكتب ملخص التصريح، واطبع المخطط للطاقم.'),
  },
  {
    id: 'atm-bilingual-notice', kind: 'template', system: 'ais-drafting', builder: 'p-sustainability-lead', owner: 'p-head-sustainability', status: 'approved', min_rung: 1, classes: ['public'],
    submitted: '2026-09-07', decided: '2026-09-15', adopt: 0, sort: 10,
    title: E('Bilingual site notice drafter', 'صائغ الإشعارات ثنائية اللغة'),
    purpose: E('Drafts short site notices (road closures, event reminders) in Arabic and English from one paragraph, in the plain-language style guide.',
      'يصوغ إشعارات قصيرة في الموقع (إغلاق طرق، تذكير بفعاليات) بالعربية والإنجليزية من فقرة واحدة، وفق دليل الأسلوب المبسّط.'),
    data: E('The paragraph the author types (public information only).', 'الفقرة التي يكتبها المؤلف (معلومات عامة فقط).'),
    oversight: E('A bilingual reviewer reads both versions before the notice is posted.', 'يقرأ مراجع ثنائي اللغة النسختين قبل نشر الإشعار.'),
    benefit: E('Notices posted in both languages on the same day.', 'نشر الإشعارات باللغتين في اليوم نفسه.'),
    how: E('Choose "site notice" in the drafting assistant, type the paragraph, and send both versions to a reviewer.', 'اختر «إشعار الموقع» في مساعد الصياغة، واكتب الفقرة، وأرسل النسختين إلى مراجع.'),
  },
  {
    id: 'atm-eng-change-impact', kind: 'workflow', system: 'ais-doc-search', builder: 'p-sme-reviewer', owner: 'p-work-control', status: 'submitted', min_rung: 2, classes: ['controlled_docs', 'internal'],
    submitted: '2026-10-06', sort: 11,
    title: E('Engineering change impact checklist', 'قائمة تحقق أثر التغيير الهندسي'),
    purpose: E('Lists the procedures, drawings and training material that cite a component before an engineering change is approved, as a checklist for the reviewer.',
      'يسرد الإجراءات والرسومات والمواد التدريبية التي تستشهد بمكوّن قبل اعتماد التغيير الهندسي، كقائمة تحقق للمراجع.'),
    data: E('Controlled-document index (read only) and the component tag the reviewer enters.', 'فهرس الوثائق المضبوطة (للقراءة فقط) ورمز المكوّن الذي يدخله المراجع.'),
    oversight: E('The change reviewer confirms each listed document and adds any the search missed.', 'يؤكد مراجع التغيير كل وثيقة مدرجة ويضيف ما فات البحث.'),
    benefit: E('Fewer documents missed when a change is implemented.', 'عدد أقل من الوثائق المنسية عند تنفيذ التغيير.'),
    how: E('In the document search assistant choose "change impact", enter the component tag and export the checklist to the change package.', 'في مساعد البحث في الوثائق اختر «أثر التغيير» وأدخل رمز المكوّن وصدّر القائمة إلى حزمة التغيير.'),
  },
  {
    id: 'atm-fuel-shipment-letter', kind: 'template', system: 'ais-drafting', builder: 'p-fuel-pm', owner: 'p-fuel-pm', status: 'submitted', min_rung: 1, classes: ['internal'],
    submitted: '2026-10-07', sort: 12,
    title: E('Fuel delivery cover letter drafter', 'صائغ خطاب تغطية توريد الوقود'),
    purpose: E('Drafts the bilingual cover letter that accompanies a fuel delivery document set, from the delivery number and the list of attachments.',
      'يصوغ خطاب التغطية ثنائي اللغة المرافق لمجموعة وثائق توريد الوقود، من رقم التوريد وقائمة المرفقات.'),
    data: E('Delivery number and attachment titles typed by the project manager (internal).', 'رقم التوريد وعناوين المرفقات التي يكتبها مدير المشروع (داخلية).'),
    oversight: E('The project manager signs the letter after checking every attachment title.', 'يوقّع مدير المشروع الخطاب بعد التحقق من عنوان كل مرفق.'),
    benefit: E('Cover letters prepared in minutes in both languages.', 'إعداد خطابات التغطية في دقائق باللغتين.'),
    how: E('Choose the "delivery cover letter" template, type the delivery number and attachments, and review before signing.', 'اختر قالب «خطاب تغطية التوريد» واكتب رقم التوريد والمرفقات وراجع قبل التوقيع.'),
  },
  {
    id: 'atm-supplier-followup-agent', kind: 'agent', system: 'ais-meeting-notes', builder: 'p-nse', owner: 'p-cpo', status: 'returned', min_rung: 2, classes: ['internal', 'personal'],
    submitted: '2026-09-21', decided: '2026-09-28', sort: 13,
    note: 'Name the person who checks each email before it is sent, and take supplier contact details out of the data used.',
    title: E('Supplier follow-up email agent', 'وكيل رسائل متابعة الموردين'),
    purpose: E('Drafts follow-up emails to suppliers from the action list of a supplier meeting.', 'يصوغ رسائل متابعة للموردين من قائمة إجراءات اجتماع الموردين.'),
    data: E('Meeting action list and supplier contact details.', 'قائمة إجراءات الاجتماع وبيانات اتصال الموردين.'),
    oversight: E('Emails are reviewed.', 'تُراجع الرسائل.'),
    benefit: E('Follow-ups sent the same day.', 'إرسال المتابعات في اليوم نفسه.'),
    how: E('Run it after each supplier meeting.', 'شغّله بعد كل اجتماع مع الموردين.'),
  },
  {
    id: 'atm-oe-lesson-quiz', kind: 'template', system: 'ais-drafting', builder: 'p-k-instructor', owner: 'p-training-mgr', status: 'draft', min_rung: 1, classes: ['internal'],
    sort: 14,
    title: E('Operating-experience lesson quiz', 'اختبار دروس الخبرة التشغيلية'),
    purpose: E('Turns an operating-experience lesson into five discussion questions for a crew briefing.', 'يحوّل درساً من الخبرة التشغيلية إلى خمسة أسئلة نقاش لإحاطة الطاقم.'),
    data: E('The published lesson text (internal).', 'نص الدرس المنشور (داخلي).'),
    oversight: E('The instructor edits the questions before the briefing.', 'يحرر المدرّب الأسئلة قبل الإحاطة.'),
    benefit: E('Briefings that ask the crew to think, not only listen.', 'إحاطات تدعو الطاقم إلى التفكير لا الاستماع فقط.'),
    how: E('Paste the lesson into the drafting assistant with the "lesson quiz" template.', 'الصق الدرس في مساعد الصياغة مع قالب «اختبار الدرس».'),
  },
  {
    id: 'atm-auto-close-orders', kind: 'agent', system: 'ais-outage-optimiser', builder: 'w-mnt-01', owner: 'p-outage-manager', status: 'rejected', min_rung: 2, classes: ['internal'],
    submitted: '2026-07-01', decided: '2026-07-10', sort: 15,
    note: 'Closing work orders without a person checking them is outside the approved use of the optimiser pilot (decision support only).',
    title: E('Work order close-out agent', 'وكيل إغلاق أوامر العمل'),
    purpose: E('Closes work orders the optimiser pilot marks as complete at the end of a shift.', 'يغلق أوامر العمل التي تعلّمها تجربة المحسّن بأنها مكتملة في نهاية المناوبة.'),
    data: E('SIMULATED outage schedule and work order status (internal).', 'جدول إيقاف محاكى وحالة أوامر العمل (داخلية).'),
    oversight: E('A weekly sample is checked.', 'تُفحص عينة أسبوعية.'),
    benefit: E('Less end-of-shift administration.', 'أعمال إدارية أقل في نهاية المناوبة.'),
    how: E('Enable it in the optimiser pilot settings.', 'فعّله في إعدادات تجربة المحسّن.'),
  },
  {
    id: 'atm-general-faq-bot', kind: 'agent', system: 'ais-chat-pilot', builder: 'w-corp-01', owner: 'p-chco', status: 'retired', min_rung: 1, classes: ['public', 'internal'],
    submitted: '2026-08-03', decided: '2026-08-07', retired: '2026-09-30', adopt: 5, sort: 16,
    note: 'Retired with the general chat assistant pilot; Dalil answers these questions with citations.',
    title: E('HR policy FAQ prompts', 'أسئلة شائعة عن سياسات الموارد البشرية'),
    purpose: E('Prompts for the general chat pilot that answered common questions about leave and allowances from the published HR policy.', 'أسئلة لتجربة المحادثة العامة أجابت عن الأسئلة الشائعة حول الإجازات والبدلات من سياسة الموارد البشرية المنشورة.'),
    data: E('Published HR policy pages (internal).', 'صفحات سياسة الموارد البشرية المنشورة (داخلية).'),
    oversight: E('Answers pointed to the policy page; HR reviewed a monthly sample.', 'أحالت الإجابات إلى صفحة السياسة، وراجعت الموارد البشرية عينة شهرية.'),
    benefit: E('Fewer routine questions to HR while the pilot ran.', 'أسئلة روتينية أقل للموارد البشرية خلال التجربة.'),
    how: E('No longer in use: ask Dalil instead.', 'لم يعد مستخدماً: اسأل دليل بدلاً من ذلك.'),
  },
];

const ts = (d, hh = '09') => `${d}T${hh}:00:00Z`;
const inputOf = (e) => ({
  id: e.id, title_en: e.title.en, title_ar: e.title.ar, kind: e.kind, purpose_en: e.purpose.en, purpose_ar: e.purpose.ar, data_used_en: e.data.en, data_used_ar: e.data.ar,
  data_classes: e.classes, system_id: e.system, owner_person_id: e.owner, oversight_en: e.oversight.en, oversight_ar: e.oversight.ar, benefit_en: e.benefit.en, benefit_ar: e.benefit.ar,
  how_en: e.how.en, how_ar: e.how.ar, min_rung: e.min_rung, action: e.status === 'draft' ? 'draft' : 'submit',
});

export default function build(T) {
  const people = new Map(T.people.map((p) => [p.id, p]));
  const staff = T.people.filter((p) => isStaff(p)).map((p) => p.id);
  const sysAt = (e) => T.ai_systems.map((s) => ({ id: s.id, status: e.status === 'retired' && s.id === e.system ? 'published' : s.status })); // the retired pilot was published when the entry was submitted
  T.automations = [];
  T.automation_adoptions = [];
  for (const e of ENTRIES) {
    const b = people.get(e.builder);
    if (!b || !isStaff(b)) throw new Error(`fs80: builder ${e.builder} is not active staff`);
    const p = automationProblem(inputOf(e), { systems: sysAt(e), staff });
    if (p) throw new Error(`fs80: entry ${e.id} fails the gallery check (${p})`);
    const decider = e.builder === DECIDER || e.owner === DECIDER ? DECIDER_2 : DECIDER;
    const history = [{ at: ts(e.submitted ?? '2026-10-02', '08'), by: e.builder, action: 'draft', version: 1, note: '' }];
    let version = 1;
    if (e.status !== 'draft') history.push({ at: ts(e.submitted), by: e.builder, action: 'submit', version, note: '' });
    let decided = null;
    if (['approved', 'returned', 'rejected', 'retired'].includes(e.status)) {
      const d = e.status === 'returned' ? 'return' : e.status === 'rejected' ? 'reject' : 'approve';
      const note = d === 'approve' ? 'Approved: the human check is named and the data stays inside the register entry\'s approved use.' : e.note;
      const dp = decisionProblem({ status: 'submitted', builder_person_id: e.builder, owner_person_id: e.owner }, d, note, decider);
      if (dp) throw new Error(`fs80: decision on ${e.id} fails (${dp})`);
      history.push({ at: ts(e.decided, '11'), by: decider, action: d, version, note });
      decided = { by: decider, at: ts(e.decided, '11'), note };
    }
    if (e.status === 'retired') {
      const dp = decisionProblem({ status: 'approved', builder_person_id: e.builder, owner_person_id: e.owner }, 'retire', e.note, decider);
      if (dp) throw new Error(`fs80: retirement of ${e.id} fails (${dp})`);
      history.push({ at: ts(e.retired, '11'), by: decider, action: 'retire', version, note: e.note });
      decided = { by: decider, at: ts(e.retired, '11'), note: e.note };
    }
    T.automations.push({
      id: e.id, title_en: e.title.en, title_ar: e.title.ar, kind: e.kind, purpose_en: e.purpose.en, purpose_ar: e.purpose.ar, data_used_en: e.data.en, data_used_ar: e.data.ar,
      data_classes: e.classes, system_id: e.system, builder_person_id: e.builder, owner_person_id: e.owner, builder_en: b.display_name, builder_ar: b.display_name_ar,
      owner_en: people.get(e.owner).display_name, owner_ar: people.get(e.owner).display_name_ar, family_id: b.job_family_id ?? null,
      oversight_en: e.oversight.en, oversight_ar: e.oversight.ar, benefit_en: e.benefit.en, benefit_ar: e.benefit.ar, how_en: e.how.en, how_ar: e.how.ar, min_rung: e.min_rung,
      status: e.status, listed: e.status === 'approved', version, metadata_only: true, adoption_count: 0, first_adopted_on: null, builder_level: 0,
      submitted_at: e.status === 'draft' ? null : ts(e.submitted), decided_by: decided?.by ?? null, decided_at: decided?.at ?? null, decision_note: decided?.note ?? '',
      history, open_read: false, created_at: ts(e.submitted ?? '2026-10-02', '08'), updated_at: decided?.at ?? ts(e.submitted ?? '2026-10-02', '08'),
    });
  }
}

// ───────────── Adoptions and builder credit (finalize)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const day = (iso, add) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + add); return d.toISOString().slice(0, 10); };
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** Demo personas kept free of seeded adoptions (they adopt live in the journeys). */
export const FRESH = new Set(['p-k-ro', 'p-sro', 'p-ai-governance', 'p-k-admin']);
/** Demo personas with a seeded adoption: [person, entry]. */
export const PERSONA_ADOPTIONS = [['p-nse', 'atm-procedure-revision-digest'], ['p-qc-inspector', 'atm-cap-action-digest'], ['p-outage-planner', 'atm-shift-turnover-brief'], ['p-sq-lead', 'atm-training-feedback-themes']];
export const LAST_ADOPTION = '2026-10-07';

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const by = new Map();
  for (const s of T.person_skills) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const rungOf = (pid) => aiRung(pid, T.ai_rungs, T.ai_skill_tracks, by.get(pid) ?? []).rung;
  const staff = T.people.filter((p) => isStaff(p)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const evidence = [];
  const adoptions = [];
  for (const a of T.automations) {
    const e = ENTRIES.find((x) => x.id === a.id);
    if (!e.adopt || !(a.status === 'approved' || a.status === 'retired')) continue;
    const from = day(e.decided, 2);
    const until = e.retired ? day(e.retired, -1) : LAST_ADOPTION;
    const forced = PERSONA_ADOPTIONS.filter(([, id]) => id === a.id).map(([p]) => p);
    const pool = staff.filter((p) => p.id !== a.builder_person_id && !FRESH.has(p.id) && !forced.includes(p.id) && rungOf(p.id) >= a.min_rung && !PERSONA_ADOPTIONS.some(([pp]) => pp === p.id))
      .sort((x, y) => rnd(`atm:${a.id}:${x.id}`) - rnd(`atm:${a.id}:${y.id}`));
    const who = [...forced.filter((p) => rungOf(p) >= a.min_rung && p !== a.builder_person_id), ...pool.map((p) => p.id)].slice(0, e.adopt);
    const span = Math.max(1, days(from, until));
    const dates = who.map((p, i) => day(from, Math.min(span, Math.floor(span * ((i + rnd(`atm:d:${a.id}:${p}`)) / who.length) ** 1.4)))).sort();
    who.forEach((p, i) => {
      const person = T.people.find((x) => x.id === p);
      adoptions.push({ id: `aad-${a.id.replace(/^atm-/, '')}-${String(i + 1).padStart(2, '0')}`, automation_id: a.id, person_id: p, family_id: person.job_family_id ?? null, adopted_on: dates[i],
        note: '', open_read: false, created_at: ts(dates[i], '10') });
    });
    const n = who.length;
    a.adoption_count = n;
    a.first_adopted_on = n ? dates[0] : null;
    const level = builderLevel(a.status, n);
    a.builder_level = level;
    if (level > 0) {
      const on = level >= 3 ? dates[REUSE_AT - 1] : dates[0];
      evidence.push({ id: builderEvidenceId(a.id), person_id: a.builder_person_id, skill_id: BUILDER_SKILL, kind: 'ojt', ref_table: 'automations', ref_id: a.id, level, basis: 'validated', status: 'current',
        observed_on: on, note: `Automation gallery ${a.id}: approved, ${n} adopter${n === 1 ? '' : 's'}`, recorded_by: a.decided_by, active: true, created_at: ts(on, '10') });
    }
  }
  T.automation_adoptions = adoptions.sort((x, y) => (x.id < y.id ? -1 : 1));
  // Acceptance (FS80): evidence only after approval and first adoption; counter = adoptions; every entry on a register row; metadata only.
  const sysIds = new Set(T.ai_systems.map((s) => s.id));
  for (const a of T.automations) {
    if (!sysIds.has(a.system_id)) throw new Error(`fs80: ${a.id} has no AI-system register row`);
    if (a.adoption_count !== adoptions.filter((x) => x.automation_id === a.id).length) throw new Error(`fs80: ${a.id} counter differs from its adoptions`);
    if (!a.metadata_only) throw new Error(`fs80: ${a.id} is not metadata only`);
    const ev = evidence.find((x) => x.ref_id === a.id);
    if (ev && (!['approved', 'retired'].includes(a.status) || a.adoption_count < 1 || ev.observed_on < a.first_adopted_on || ev.observed_on < String(a.decided_at).slice(0, 10) && a.status === 'approved')) throw new Error(`fs80: ${a.id} evidence before approval and first adoption`);
    if (adoptions.some((x) => x.automation_id === a.id && (x.person_id === a.builder_person_id || x.adopted_on < String(a.history.find((h) => h.action === 'approve')?.at ?? '9999').slice(0, 10)))) throw new Error(`fs80: ${a.id} adopted by its builder or before approval`);
  }
  // Recorded F01 evidence for the builders, then re-derive their states (engineering-track skill: FS09 rungs do not move).
  const before = new Map(T.people.filter((p) => isStaff(p)).map((p) => [p.id, rungOf(p.id)]));
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const builders = new Set(evidence.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => builders.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const ids = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  let changed = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = ids.get(s.id);
    if (!cur) { if (s.skill_id !== BUILDER_SKILL) throw new Error(`fs80: unexpected new state ${s.id}`); T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    const k = (x) => JSON.stringify([x.level, x.confidence, x.basis, x.evidence_count, x.confidence_band, x.conf_low, x.conf_high, x.active]);
    if (k(cur) !== k(patch)) { if (s.skill_id !== BUILDER_SKILL) throw new Error(`fs80: state ${s.id} of another skill changed`); changed++; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const by2 = new Map();
  for (const s of T.person_skills) if (s.active) (by2.get(s.person_id) ?? by2.set(s.person_id, []).get(s.person_id)).push(s);
  for (const [pid, r] of before) if (aiRung(pid, T.ai_rungs, T.ai_skill_tracks, by2.get(pid) ?? []).rung !== r) throw new Error(`fs80: builder credit moved the FS09 rung of ${pid}`);
  // No ripple into stored outputs of earlier builders: FS72 open suggestions (refreshed 2026-10-11) stay equal to the rule on the final
  // states (credited builders already hold the skill). FS70 published lists are unaffected because every credit is dated after the
  // builder's first evidence on the skill (checked on the final seed by scripts/validate/fs81-skill-signals.mjs; fsqa1 remaps role
  // profiles after this builder, so the FS70 rule cannot be evaluated here).
  const w = ssgWorldFromTables((t) => T[t] ?? []);
  const open = (T.skill_suggestions ?? []).filter((r) => r.status === 'open');
  for (const p of T.people.filter((x) => isStaff(x))) {
    const c = inferSuggestions(w, p.id, '2026-10-11');
    const o = open.filter((r) => r.person_id === p.id);
    if (c.length !== o.length || o.some((r) => { const x = c.find((y) => y.skill_id === r.skill_id); return !x || x.score !== r.score || x.level !== r.level || JSON.stringify(x.sources) !== JSON.stringify(r.sources); }))
      throw new Error(`fs80: builder credit would change the stored FS72 suggestions of ${p.id}`);
  }
  const st = T.automations.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {});
  console.log(`fs80: ${T.automations.length} gallery entries (${Object.entries(st).map(([k, v]) => `${v} ${k}`).join(', ')}), ${adoptions.length} adoptions, ${evidence.length} builder credits (${evidence.filter((e) => e.level === 3).length} at level 3), ${added} new and ${changed} changed ${BUILDER_SKILL} states; FS09 rungs and FS72 suggestions unchanged`);
}
