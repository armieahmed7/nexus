// FS58 + FS59 (future-skills wave F · E5, M33 Human Skills Studio) seed: adaptive problem-solving practice and the role-play library.
// build():    nothing (content needs FS02 skills and FS25 core skills, which FINALIZE_LAST builders finish).
// finalize(): FINALIZE_LAST and, by file name, after fs02/fs25/fs36/fs38/fs44/fs49 and before the fsqa builders:
//   FS58: 7 PIAAC-style scenarios (6 published, 1 draft; every one with at least one mid-task change, one where the change does not
//         matter), simulated practice runs for active staff (2026-Q1 to 2026-Q4, scored with the server's rules: judgeStage / scoreAps;
//         a few open and abandoned runs). Practice never writes skill evidence and never gates anything.
//   FS59: 7 ENEC-authored role-play scenarios (6 published, one per kind, 1 draft) with the rubric published in EN and AR and an example
//         answer per turn in both languages (the builder fails if an example misses a criterion of its turn); simulated sessions whose
//         ticks come from evaluating synthetic answers with the server's rubric (evaluateTurn / summarise); answers are never stored.
//         Review requests to named reviewers (requested, validated, declined, withdrawn); validated sessions write F01 evidence
//         `se:roleplay:<session>:<skill>` (kind rating, basis validated, ref_table roleplay_sessions, level 1-2) on FS02 future skills only,
//         so the original 71-skill states stay unchanged (checked); the states of the people concerned are re-derived and the F36
//         digests, F23 snapshots and F35 outlooks rebuilt from the final states, as fs44 does.
// Synthetic people only (role cards and synthetic workers); every situation is fictional and generic, with no plant-security content and
// no real events; sources are the research-pack benchmarks (OECD PIAAC, IAEA-TECDOC-1917, skills-platform role-play mechanics).
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { apsScenarioProblem, changeCount, judgeStage, personSeed, pickScenario, quarterOf, responseOf, scoreAps } from '../../../src/modules/m33/aps.ts';
import { eligibleReviewers, evaluateTurn, evidenceId, evidenceSkills, rpScenarioProblem, speakUpTopic, summarise } from '../../../src/modules/m33/roleplay.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const SRC = {
  piaac: { label: 'OECD Survey of Adult Skills (PIAAC), Cycle 2 database: adaptive problem solving', url: 'https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html', as_of: AS_OF, benchmark_id: 'OECD-PIAAC' },
  cso: { label: 'CSO Ireland · PIAAC 2023 key findings (publishes the OECD averages)', url: 'https://www.cso.ie/en/releasesandpublications/ep/p-piaac/programmefortheinternationalassessmentofadultcompetenciespiaac2023/keyfindings', as_of: AS_OF, benchmark_id: 'OECD-PIAAC' },
  iaea: { label: 'IAEA-TECDOC-1917 · Assessing behavioural competencies of employees in nuclear facilities', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf', as_of: AS_OF, benchmark_id: 'IAEA-1917' },
  linkedin: { label: 'LinkedIn Learning · Role play with AI coach', url: 'https://training.talent.linkedin.com/introducing-role-play-with-ai-coach', as_of: AS_OF, benchmark_id: 'SKILLS-TECH' },
  udemy: { label: 'Udemy · AI-powered role play for business and communication skills (custom scenarios)', url: 'https://about.udemy.com/press-releases/udemy-launches-ai-powered-role-play-to-coach-professionals-on-business-and-communication-skills/', as_of: AS_OF, benchmark_id: 'SKILLS-TECH' },
};

// ═══════════════════════════════════════════ FS58 scenarios
const O = (en, ar, eff, note_en, note_ar, keep) => ({ en, ar, eff, note_en, note_ar, ...(keep ? { keep: true } : {}) });
const C = (en, ar, relevant) => ({ en, ar, relevant });
const ST = (id, kind, info_en, info_ar, question_en, question_ar, options, cues, debrief_en, debrief_ar) => ({ id, kind, info_en, info_ar, question_en, question_ar, options, cues, debrief_en, debrief_ar });
const Q_PLAN = ['What do you do first?', 'ما أول ما تفعله؟'];
const Q_NOW = ['What do you do now?', 'ماذا تفعل الآن؟'];

export const APS = [
  {
    id: 'aps-os-001', code: 'APS-OS-001', theme: 'outage_schedule', difficulty: 2, est_minutes: 12, status: 'published', sort: 1,
    core_skill_ids: ['cs-adaptability', 'cs-problem'], skill_ids: ['sk-fs-tr-resilience', 'sk-fs-tr-analytical'],
    title_en: 'The crane that arrives late', title_ar: 'الرافعة التي تتأخر',
    summary_en: 'A 12-hour maintenance window on a non-safety cooling-water pump: the crane slips, then a part does not fit.',
    summary_ar: 'نافذة صيانة مدتها 12 ساعة لمضخة مياه تبريد غير مرتبطة بالسلامة: تتأخر الرافعة ثم لا تناسب قطعة غيار.',
    context_en: 'You coordinate a planned 12-hour window (06:00-18:00) to replace the motor of a non-safety cooling-water pump. The plan: mobile crane at 07:00, motor lift at 08:00, coupling and guard fitted by 14:00, post-maintenance test at 16:00. The situation is synthetic.',
    context_ar: 'تنسّق نافذة مخططة مدتها 12 ساعة (06:00-18:00) لاستبدال محرك مضخة مياه تبريد غير مرتبطة بالسلامة. الخطة: رافعة متنقلة الساعة 07:00، رفع المحرك الساعة 08:00، تركيب الوصلة والواقي بحلول 14:00، واختبار ما بعد الصيانة الساعة 16:00. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'It is the day before the window. The crane is booked, the lifting plan is still waiting for approval, and the crew has not been briefed on what happens if the crane is late.',
        'إنه اليوم السابق للنافذة. الرافعة محجوزة، وخطة الرفع ما زالت بانتظار الاعتماد، ولم يُطلَع الطاقم على ما يحدث إذا تأخرت الرافعة.', ...Q_PLAN, [
          O('Get the lifting plan approved today, reconfirm the crane, and brief the crew on a hold point and fallback tasks if the crane is late.', 'أعتمد خطة الرفع اليوم، وأعيد تأكيد الرافعة، وأُطلع الطاقم على نقطة توقف ومهام بديلة إذا تأخرت الرافعة.', 3,
            'Removes the known risks before the window opens and gives the crew a plan B.', 'يزيل المخاطر المعروفة قبل فتح النافذة ويمنح الطاقم خطة بديلة.'),
          O('Start dismantling at 05:00 tomorrow to gain time, even before the lifting plan is approved.', 'أبدأ التفكيك الساعة 05:00 غداً لكسب الوقت حتى قبل اعتماد خطة الرفع.', 0,
            'Starts work outside the approved plan and window: speed is not worth an uncontrolled start.', 'يبدأ العمل خارج الخطة والنافذة المعتمدتين: السرعة لا تبرر بداية غير منضبطة.'),
          O('Ask the insulation contractor to come early so the crew is never idle.', 'أطلب من مقاول العزل الحضور مبكراً حتى لا يبقى الطاقم دون عمل.', 1,
            'Fills time but leaves the lifting plan and the crane risk open.', 'يملأ الوقت لكنه يترك خطة الرفع ومخاطر الرافعة دون معالجة.'),
          O('Keep the plan as written and deal with problems as they come.', 'أُبقي الخطة كما هي وأتعامل مع المشكلات عند ظهورها.', 1,
            'A plan with no fallback turns every slip into an improvised decision.', 'الخطة بلا بديل تحوّل كل تأخير إلى قرار مرتجل.'),
        ], [
          C('The lifting plan is still waiting for approval.', 'خطة الرفع ما زالت بانتظار الاعتماد.', true),
          C('The crane is booked for 07:00.', 'الرافعة محجوزة للساعة 07:00.', true),
          C('The canteen opens at 06:30.', 'يفتح المقصف الساعة 06:30.', false),
          C('The car park will be resurfaced next week.', 'سيُعاد رصف موقف السيارات الأسبوع القادم.', false),
        ],
        'Adaptive problem solving starts before anything changes: name the weak points of the plan (an unapproved lift, a single crane) and agree what the crew does if they fail.',
        'يبدأ حل المشكلات التكيّفي قبل أن يتغير شيء: حدّد نقاط ضعف الخطة (رفع غير معتمد ورافعة واحدة) واتفق مع الطاقم على ما يفعله إذا تعثرت.'),
      ST('crane', 'change', '06:40. The crane operator calls: the crane is held at another job and will arrive at 11:00, four hours late. The isolation checks and the scaffolding do not need the crane. The test team can stay until 19:00.',
        '06:40. يتصل مشغل الرافعة: الرافعة محتجزة في عمل آخر وستصل الساعة 11:00، أي بتأخير أربع ساعات. فحوص العزل والسقالات لا تحتاج إلى الرافعة. ويمكن لفريق الاختبار البقاء حتى 19:00.', ...Q_NOW, [
          O('Keep the original sequence and wait for the crane.', 'أُبقي التسلسل الأصلي وأنتظر الرافعة.', 1, 'Four idle hours push every later step past the window.', 'أربع ساعات من الانتظار تدفع كل الخطوات اللاحقة إلى ما بعد النافذة.', true),
          O('Re-sequence: do the isolation checks and scaffolding now, move the lift to 11:00, and tell the planner and the test team the new times.', 'أعيد الترتيب: أنفذ فحوص العزل والسقالات الآن، وأنقل الرفع إلى 11:00، وأُبلغ المخطط وفريق الاختبار بالمواعيد الجديدة.', 3,
            'Uses the facts that changed and the ones that did not; everyone affected hears the new plan.', 'يستفيد مما تغيّر ومما لم يتغيّر، ويعرف كل المعنيين الخطة الجديدة.'),
          O('Lift the motor with a forklift instead.', 'أرفع المحرك برافعة شوكية بدلاً من ذلك.', 0, 'An unplanned lifting method is a new hazard, not a fix.', 'طريقة رفع غير مخططة خطر جديد وليست حلاً.'),
          O('Cancel the job and give the window back.', 'ألغي العمل وأعيد النافذة.', 1, 'Too early: the window can still close safely with a new sequence.', 'مبكر جداً: ما زال يمكن إغلاق النافذة بأمان بتسلسل جديد.'),
        ], [
          C('The crane now arrives at 11:00.', 'الرافعة ستصل الآن الساعة 11:00.', true),
          C('Isolation checks and scaffolding do not need the crane.', 'فحوص العزل والسقالات لا تحتاج إلى الرافعة.', true),
          C('The test team can stay until 19:00.', 'يمكن لفريق الاختبار البقاء حتى 19:00.', true),
          C('The crane operator is new to the company.', 'مشغل الرافعة جديد في الشركة.', false),
        ],
        'The change matters, so the plan changes: move the independent tasks forward and tell everyone whose time moves. Waiting is a decision too, and here it costs the window.',
        'التغيير مهم، لذلك تتغير الخطة: قدّم المهام المستقلة وأبلغ كل من يتغير توقيته. الانتظار قرار أيضاً، وهنا يكلّف النافذة.'),
      ST('guard', 'change', '13:30. The motor is in place, but the new coupling guard is the wrong size. A correct guard can be made by 17:30. The window ends at 18:00; the test needs one hour.',
        '13:30. المحرك في مكانه، لكن واقي الوصلة الجديد بمقاس خاطئ. يمكن تصنيع واقٍ صحيح بحلول 17:30. تنتهي النافذة الساعة 18:00 ويحتاج الاختبار إلى ساعة.', ...Q_NOW, [
          O('Run the test at 16:00 without the guard.', 'أجري الاختبار الساعة 16:00 دون الواقي.', 0, 'Testing rotating equipment without its guard trades safety for the schedule.', 'اختبار معدات دوّارة دون واقيها يقايض السلامة بالجدول.'),
          O('Fit the old guard quietly so the test can run on time.', 'أركّب الواقي القديم دون إبلاغ أحد ليجري الاختبار في موعده.', 0, 'An undocumented change hides a configuration question from the people who own it.', 'تغيير غير موثّق يخفي مسألة تهيئة عن أصحاب القرار فيها.'),
          O('Bring the facts to the outage manager now: guard ready 17:30, test needs an hour, window ends 18:00; propose a one-hour extension or a test early tomorrow.', 'أعرض الحقائق على مدير الصيانة الدورية الآن: الواقي جاهز 17:30، والاختبار يحتاج ساعة، والنافذة تنتهي 18:00؛ وأقترح تمديداً لساعة أو اختباراً صباح الغد.', 3,
            'The numbers no longer fit the window, so the decision goes to its owner early, with options.', 'الأرقام لم تعد تتسع في النافذة، فيذهب القرار إلى صاحبه مبكراً ومعه خيارات.'),
          O('Keep the 16:00 test in the plan and hope the workshop is faster.', 'أُبقي اختبار 16:00 في الخطة وآمل أن تُنجز الورشة العمل أسرع.', 1, 'Hope is not a plan: the window problem stays hidden until 17:30.', 'الأمل ليس خطة: مشكلة النافذة تبقى مخفية حتى 17:30.', true),
        ], [
          C('The correct guard is ready at 17:30.', 'الواقي الصحيح جاهز الساعة 17:30.', true),
          C('The test needs one hour and the window ends at 18:00.', 'يحتاج الاختبار إلى ساعة وتنتهي النافذة الساعة 18:00.', true),
          C('The new motor is painted a different colour.', 'المحرك الجديد مطلي بلون مختلف.', false),
          C('The morning briefing ran ten minutes long.', 'استغرقت إحاطة الصباح عشر دقائق إضافية.', false),
        ],
        'When the facts no longer fit the plan, say so early and bring options. The worst answers keep the schedule by quietly dropping a safety feature.',
        'عندما لا تعود الحقائق متسقة مع الخطة، قل ذلك مبكراً واطرح خيارات. أسوأ الإجابات تحافظ على الجدول بالتخلي بصمت عن وسيلة أمان.'),
    ],
  },
  {
    id: 'aps-cd-001', code: 'APS-CD-001', theme: 'conflicting_data', difficulty: 2, est_minutes: 10, status: 'published', sort: 2,
    core_skill_ids: ['cs-questioning', 'cs-problem'], skill_ids: ['sk-fs-tr-analytical', 'sk-fs-ai-plantdata'],
    title_en: 'Two readings that disagree', title_ar: 'قراءتان متعارضتان',
    summary_en: 'A sample result and an online analyser disagree; then a recalibration record turns up.',
    summary_ar: 'نتيجة عينة ومحلل آلي يختلفان، ثم يظهر سجل معايرة.',
    context_en: 'You prepare the morning summary of water-chemistry trends for a non-safety auxiliary system. The online analyser and the laboratory sample normally agree within 5%. The situation is synthetic.',
    context_ar: 'تُعدّ ملخص الصباح لاتجاهات كيمياء المياه لنظام مساعد غير مرتبط بالسلامة. يتفق المحلل الآلي وعينة المختبر عادة ضمن 5%. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'This morning the online analyser reads 40% higher than yesterday, but the laboratory sample taken at the same time is unchanged. The summary goes to the shift at 09:00.',
        'هذا الصباح يقرأ المحلل الآلي أعلى بنسبة 40% من الأمس، لكن عينة المختبر المأخوذة في الوقت نفسه لم تتغير. يُرسل الملخص إلى النوبة الساعة 09:00.', ...Q_PLAN, [
          O('Report the analyser value as the trend; it is the official online instrument.', 'أبلغ عن قيمة المحلل بوصفها الاتجاه؛ فهو الجهاز الآلي الرسمي.', 0, 'Picks one source without explaining a disagreement eight times wider than normal.', 'يختار مصدراً واحداً دون تفسير خلاف أوسع بثماني مرات من المعتاد.'),
          O('Show both values in the summary, flag the disagreement as unresolved, and ask for a check of the analyser and a repeat sample.', 'أعرض القيمتين في الملخص، وأشير إلى الخلاف بوصفه غير محسوم، وأطلب فحص المحلل وأخذ عينة مكررة.', 3,
            'Keeps the uncertainty visible and starts the checks that will resolve it.', 'يُبقي عدم اليقين ظاهراً ويبدأ الفحوص التي ستحسمه.'),
          O('Average the two values and report the average.', 'أحسب متوسط القيمتين وأبلغ عنه.', 0, 'An average of two disagreeing readings is a number nobody measured.', 'متوسط قراءتين متعارضتين رقم لم يقِسه أحد.'),
          O('Leave the parameter out of the summary until it is sorted.', 'أحذف المؤشر من الملخص حتى يُحسم.', 1, 'Hides a question the shift should know about.', 'يخفي سؤالاً ينبغي أن تعرفه النوبة.'),
        ], [
          C('The two sources normally agree within 5%.', 'يتفق المصدران عادة ضمن 5%.', true),
          C('The analyser jumped 40% while the sample did not move.', 'قفز المحلل 40% بينما لم تتحرك العينة.', true),
          C('The summary template changed font last month.', 'تغيّر خط قالب الملخص الشهر الماضي.', false),
          C('The laboratory is in a different building.', 'المختبر في مبنى مختلف.', false),
        ],
        'When sources disagree far beyond their normal spread, report the disagreement itself and start the checks. Averaging or picking a favourite hides the problem.',
        'عندما يختلف مصدران بأكثر بكثير من تباينهما المعتاد، أبلغ عن الخلاف نفسه وابدأ الفحوص. حساب المتوسط أو تفضيل مصدر يخفي المشكلة.'),
      ST('calib', 'change', '08:20. Instrument maintenance tells you the analyser was recalibrated at 06:00 with a new reagent batch. The repeat laboratory sample at 08:00 matches the first sample.',
        '08:20. تخبرك صيانة الأجهزة بأن المحلل أُعيدت معايرته الساعة 06:00 بدفعة كاشف جديدة. وعينة المختبر المكررة الساعة 08:00 تطابق العينة الأولى.', ...Q_NOW, [
          O('Treat the laboratory value as the best estimate, mark the analyser suspect since the 06:00 recalibration, and ask instrument maintenance to verify the reagent batch.', 'أعدّ قيمة المختبر أفضل تقدير، وأصنّف المحلل مشكوكاً فيه منذ معايرة 06:00، وأطلب من صيانة الأجهزة التحقق من دفعة الكاشف.', 3,
            'The new facts point to the instrument change; the summary says so and the check is assigned.', 'الحقائق الجديدة تشير إلى تغيير الجهاز؛ ويذكر الملخص ذلك ويُكلَّف أحد بالفحص.'),
          O('Keep the summary as you drafted it: both values, unresolved.', 'أُبقي الملخص كما كتبته: القيمتان، دون حسم.', 1, 'You now know more; leaving it "unresolved" wastes the new evidence.', 'أنت تعرف الآن أكثر؛ وترك المسألة "دون حسم" يهدر الدليل الجديد.', true),
          O('Report the analyser value again: it was just calibrated, so it must be right.', 'أعيد الإبلاغ عن قيمة المحلل: لقد عوير للتو فلا بد أنه صحيح.', 0, 'A fresh calibration is exactly when a reagent or setup error appears.', 'المعايرة الحديثة هي بالضبط الوقت الذي يظهر فيه خطأ كاشف أو إعداد.'),
          O('Close the question: the laboratory is always right.', 'أغلق المسألة: المختبر دائماً على حق.', 1, 'Right answer for today, wrong rule: the analyser still needs its check.', 'إجابة صحيحة اليوم وقاعدة خاطئة: المحلل ما زال بحاجة إلى فحصه.'),
        ], [
          C('The analyser was recalibrated at 06:00 with a new reagent batch.', 'أُعيدت معايرة المحلل الساعة 06:00 بدفعة كاشف جديدة.', true),
          C('The repeat sample matches the first sample.', 'العينة المكررة تطابق العينة الأولى.', true),
          C('Instrument maintenance moved to a new office.', 'انتقلت صيانة الأجهزة إلى مكتب جديد.', false),
          C('Yesterday\'s summary was sent at 09:05.', 'أُرسل ملخص الأمس الساعة 09:05.', false),
        ],
        'New information should move your conclusion. A recalibration just before the jump and a repeat sample that agrees with the first both point to the instrument.',
        'ينبغي أن تُغيّر المعلومات الجديدة استنتاجك. معايرة قبل القفزة مباشرة وعينة مكررة تطابق الأولى تشيران كلتاهما إلى الجهاز.'),
      ST('font', 'change', '08:50. The shift supervisor asks you to use the new summary template from today; it only changes the layout, not the content.',
        '08:50. يطلب منك مشرف النوبة استخدام قالب الملخص الجديد بدءاً من اليوم؛ وهو يغيّر الشكل فقط لا المحتوى.', ...Q_NOW, [
          O('Rewrite your conclusions to fit the new template\'s headings.', 'أعيد صياغة استنتاجاتي لتناسب عناوين القالب الجديد.', 1, 'The layout changed, not the facts; rewriting risks losing the key point.', 'تغيّر الشكل لا الحقائق؛ وإعادة الصياغة قد تُضيع النقطة الأساسية.'),
          O('Move the same content into the new template and send it at 09:00, with the analyser flag at the top.', 'أنقل المحتوى نفسه إلى القالب الجديد وأرسله الساعة 09:00 مع إشارة المحلل في الأعلى.', 3,
            'Not every change needs a new plan: this one changes the format only.', 'ليس كل تغيير يحتاج خطة جديدة: هذا التغيير يمس الشكل فقط.', true),
          O('Delay the summary until you have learned the new template.', 'أؤخر الملخص حتى أتعلم القالب الجديد.', 0, 'The shift loses the analyser warning for a layout change.', 'تخسر النوبة تحذير المحلل بسبب تغيير في الشكل.'),
          O('Send the old template today and switch tomorrow, telling the supervisor why.', 'أرسل القالب القديم اليوم وأنتقل غداً، وأشرح السبب للمشرف.', 2, 'Reasonable, but the switch was cheap and the request was for today.', 'معقول، لكن الانتقال كان سهلاً والطلب كان لليوم.'),
        ], [
          C('The new template changes layout only.', 'القالب الجديد يغيّر الشكل فقط.', true),
          C('The summary is due at 09:00.', 'موعد الملخص الساعة 09:00.', true),
          C('The template was designed by another department.', 'صمّم القالب قسم آخر.', false),
          C('The supervisor prefers a larger font.', 'يفضّل المشرف خطاً أكبر.', false),
        ],
        'This change does not affect the problem, so the plan stays: same content, new layout, on time. Over-reacting to a minor change is a common adaptive-problem-solving error.',
        'هذا التغيير لا يمس المشكلة، لذلك تبقى الخطة: المحتوى نفسه بشكل جديد وفي الموعد. المبالغة في الاستجابة لتغيير بسيط خطأ شائع في حل المشكلات التكيّفي.'),
    ],
  },
  {
    id: 'aps-sd-001', code: 'APS-SD-001', theme: 'supply_delay', difficulty: 1, est_minutes: 8, status: 'published', sort: 3,
    core_skill_ids: ['cs-adaptability', 'cs-systems'], skill_ids: ['sk-fs-tr-systems', 'sk-fs-tr-resilience'],
    title_en: 'The spare part that is stuck in customs', title_ar: 'قطعة الغيار العالقة في الجمارك',
    summary_en: 'A planned bearing replacement depends on a part that is delayed, then an alternative supplier appears.',
    summary_ar: 'استبدال محمل مخطط يعتمد على قطعة متأخرة، ثم يظهر مورد بديل.',
    context_en: 'You plan the replacement of a worn bearing on a ventilation fan in an office building on site (non-safety). The fan still runs but its vibration trend is rising slowly. The part was due on Monday. The situation is synthetic.',
    context_ar: 'تخطط لاستبدال محمل متآكل في مروحة تهوية بمبنى مكاتب في الموقع (غير مرتبط بالسلامة). ما زالت المروحة تعمل لكن اتجاه اهتزازها يرتفع ببطء. كان موعد وصول القطعة يوم الاثنين. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'The work is booked for Tuesday. The bearing is ordered from the usual supplier; nobody has checked its delivery status this week.',
        'العمل محجوز ليوم الثلاثاء. المحمل مطلوب من المورد المعتاد، ولم يتحقق أحد من حالة التسليم هذا الأسبوع.', ...Q_PLAN, [
          O('Check the delivery status now and agree a vibration limit at which the fan is stopped if the part is late.', 'أتحقق من حالة التسليم الآن وأتفق على حد اهتزاز تُوقف المروحة عنده إذا تأخرت القطعة.', 3, 'Confirms the dependency and sets a safe trigger in advance.', 'يؤكد الاعتماد على القطعة ويضع مسبقاً معياراً آمناً للتصرف.'),
          O('Assume the part arrives Monday as usual.', 'أفترض أن القطعة ستصل يوم الاثنين كالمعتاد.', 1, 'The plan rests on a fact nobody checked.', 'تقوم الخطة على حقيقة لم يتحقق منها أحد.'),
          O('Stop the fan today to protect it.', 'أوقف المروحة اليوم لحمايتها.', 1, 'Premature: the trend is rising slowly and the building needs ventilation.', 'سابق لأوانه: الاتجاه يرتفع ببطء والمبنى يحتاج إلى التهوية.'),
          O('Order a second bearing from another supplier just in case.', 'أطلب محملاً ثانياً من مورد آخر احتياطاً.', 2, 'Hedges the risk but skips checking the first order.', 'يتحوّط من المخاطرة لكنه يتجاوز التحقق من الطلب الأول.'),
        ], [
          C('Nobody has checked the delivery status this week.', 'لم يتحقق أحد من حالة التسليم هذا الأسبوع.', true),
          C('The vibration trend is rising slowly.', 'اتجاه الاهتزاز يرتفع ببطء.', true),
          C('The fan was painted last year.', 'طُليت المروحة العام الماضي.', false),
          C('The office building has two entrances.', 'لمبنى المكاتب مدخلان.', false),
        ],
        'Check the facts the plan depends on and agree in advance what would make you change it (here, a vibration limit).',
        'تحقق من الحقائق التي تعتمد عليها الخطة واتفق مسبقاً على ما يجعلك تغيّرها (هنا حد للاهتزاز).'),
      ST('customs', 'change', 'Monday. The supplier says the bearing is held in customs for at least ten days. An approved alternative supplier can deliver an equivalent bearing on Wednesday. The vibration is still below the agreed limit.',
        'الاثنين. يقول المورد إن المحمل محتجز في الجمارك عشرة أيام على الأقل. ويستطيع مورد بديل معتمد تسليم محمل مكافئ يوم الأربعاء. وما زال الاهتزاز دون الحد المتفق عليه.', ...Q_NOW, [
          O('Wait for the original part.', 'أنتظر القطعة الأصلية.', 1, 'Ten more days of a rising trend, when an approved option exists.', 'عشرة أيام أخرى من اتجاه متصاعد مع وجود خيار معتمد.', true),
          O('Order from the approved alternative, move the job to Thursday, keep monitoring against the limit, and tell the building owner.', 'أطلب من المورد البديل المعتمد، وأنقل العمل إلى الخميس، وأواصل المراقبة مقارنة بالحد، وأُبلغ مالك المبنى.', 3,
            'Re-plans around the new fact with an approved source and keeps the safety trigger in place.', 'يعيد التخطيط حول الحقيقة الجديدة بمصدر معتمد ويُبقي معيار السلامة قائماً.'),
          O('Buy a bearing from a local shop that is not on the approved list.', 'أشتري محملاً من متجر محلي غير مدرج في القائمة المعتمدة.', 0, 'Speed by bypassing supplier approval creates a quality risk.', 'السرعة بتجاوز اعتماد الموردين تخلق خطراً على الجودة.'),
          O('Stop the fan now until any part arrives.', 'أوقف المروحة الآن حتى تصل أي قطعة.', 1, 'The vibration is below the limit; stopping now has a cost and no benefit yet.', 'الاهتزاز دون الحد؛ والإيقاف الآن له كلفة دون فائدة بعد.'),
        ], [
          C('The original part is held for ten days or more.', 'القطعة الأصلية محتجزة عشرة أيام أو أكثر.', true),
          C('An approved alternative can deliver on Wednesday.', 'يستطيع مورد بديل معتمد التسليم يوم الأربعاء.', true),
          C('Vibration is still below the agreed limit.', 'الاهتزاز ما زال دون الحد المتفق عليه.', true),
          C('The supplier\'s sales contact changed.', 'تغيّر مسؤول المبيعات لدى المورد.', false),
        ],
        'The delay changes the plan; the safety trigger does not. Approved alternatives are part of adaptive planning; unapproved shortcuts are not.',
        'التأخير يغيّر الخطة، أما معيار السلامة فلا يتغير. البدائل المعتمدة جزء من التخطيط التكيّفي، أما الطرق المختصرة غير المعتمدة فلا.'),
    ],
  },
  {
    id: 'aps-sc-001', code: 'APS-SC-001', theme: 'staffing_change', difficulty: 2, est_minutes: 10, status: 'published', sort: 4,
    core_skill_ids: ['cs-adaptability', 'cs-conservative'], skill_ids: ['sk-fs-tr-resilience', 'sk-fs-tr-leadership'],
    title_en: 'Two people short on a training day', title_ar: 'نقص شخصين في يوم تدريب',
    summary_en: 'A classroom day for twelve trainees loses its second instructor, then the simulator slot moves.',
    summary_ar: 'يوم تدريب صفي لاثني عشر متدرباً يفقد مدربه الثاني، ثم يتغير موعد المحاكي.',
    context_en: 'You run a training day for twelve trainees: a classroom session in the morning with two instructors, and a practical session on a part-task trainer in the afternoon. The situation is synthetic.',
    context_ar: 'تدير يوم تدريب لاثني عشر متدرباً: جلسة صفية صباحاً بمدربين اثنين، وجلسة عملية على جهاز تدريب جزئي بعد الظهر. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'The day is planned in two groups of six. The second instructor is confirmed. The part-task trainer is booked from 13:00 to 17:00.',
        'اليوم مخطط على مجموعتين من ستة متدربين. المدرب الثاني مؤكد. جهاز التدريب الجزئي محجوز من 13:00 إلى 17:00.', ...Q_PLAN, [
          O('Confirm rooms and the trainer booking and prepare a one-instructor version of the afternoon in case someone drops out.', 'أؤكد القاعات وحجز الجهاز وأُعدّ نسخة من جلسة بعد الظهر لمدرب واحد تحسباً لغياب أحد.', 3, 'A cheap fallback for the most fragile part of the day.', 'بديل قليل الكلفة للجزء الأضعف من اليوم.'),
          O('Nothing extra: the plan is confirmed.', 'لا شيء إضافي: الخطة مؤكدة.', 1, 'Confirmed is not the same as robust.', 'المؤكد لا يعني المتين.'),
          O('Cut the practical session to save effort.', 'أختصر الجلسة العملية لتوفير الجهد.', 0, 'Removes the part of the day that builds the skill.', 'يحذف الجزء من اليوم الذي يبني المهارة.'),
        ], [
          C('The afternoon needs two instructors for two groups.', 'تحتاج جلسة بعد الظهر إلى مدربين لمجموعتين.', true),
          C('The part-task trainer is booked 13:00-17:00.', 'جهاز التدريب الجزئي محجوز 13:00-17:00.', true),
          C('The trainees come from three departments.', 'يأتي المتدربون من ثلاثة أقسام.', false),
        ],
        'Robust plans have a cheap fallback for their most fragile part.', 'الخطط المتينة لديها بديل قليل الكلفة لأضعف أجزائها.'),
      ST('sick', 'change', '07:30. The second instructor calls in sick. A qualified colleague can join at 13:00 but not in the morning.',
        '07:30. يتصل المدرب الثاني معتذراً بسبب المرض. يمكن لزميل مؤهل الانضمام الساعة 13:00 لكن ليس صباحاً.', ...Q_NOW, [
          O('Run the morning classroom as one group of twelve with one instructor, and the afternoon practical in two groups with the colleague.', 'أدير الجلسة الصفية صباحاً مجموعةً واحدة من اثني عشر مع مدرب واحد، والجلسة العملية بعد الظهر بمجموعتين مع الزميل.', 3,
            'Moves the shortage to where it hurts least: a classroom can take twelve, a practical cannot.', 'ينقل النقص إلى حيث يضر أقل: الصف يتسع لاثني عشر، أما الجلسة العملية فلا.'),
          O('Keep two groups in the morning; one group studies alone.', 'أُبقي مجموعتين صباحاً وتدرس إحداهما وحدها.', 1, 'Half the trainees get no instruction.', 'نصف المتدربين لا يحصلون على تدريب.', true),
          O('Cancel the whole day.', 'ألغي اليوم بأكمله.', 0, 'Throws away a day that can still run well.', 'يهدر يوماً ما زال يمكن أن ينجح.'),
          O('Ask a non-qualified colleague to supervise the practical.', 'أطلب من زميل غير مؤهل الإشراف على الجلسة العملية.', 0, 'Practical training needs a qualified instructor.', 'التدريب العملي يحتاج إلى مدرب مؤهل.'),
        ], [
          C('A qualified colleague is free from 13:00.', 'زميل مؤهل متاح من الساعة 13:00.', true),
          C('The morning is classroom only.', 'الصباح جلسة صفية فقط.', true),
          C('The sick instructor usually teaches on Tuesdays.', 'يدرّس المدرب المريض عادة أيام الثلاثاء.', false),
        ],
        'Re-allocate the scarce resource to the activity that needs it most, and keep the qualification rule intact.', 'أعد توزيع المورد الشحيح على النشاط الأحوج إليه، وحافظ على قاعدة التأهيل.'),
      ST('slot', 'change', '11:00. Engineering needs the part-task trainer from 15:00 for an urgent check. You keep it 13:00-15:00 only.',
        '11:00. يحتاج قسم الهندسة إلى جهاز التدريب الجزئي من الساعة 15:00 لفحص عاجل. يبقى لك من 13:00 إلى 15:00 فقط.', ...Q_NOW, [
          O('Run both practical groups at 90 minutes each, back to back, on a shortened exercise, and book the missing practice for next week.', 'أدير المجموعتين العمليتين 90 دقيقة لكل منهما متتاليتين على تمرين مختصر، وأحجز التدريب الناقص للأسبوع القادم.', 2,
            'Workable, but 2 x 90 minutes does not fit in two hours.', 'قابل للتنفيذ، لكن 2 × 90 دقيقة لا تتسع في ساعتين.'),
          O('Run both groups in parallel 13:00-15:00 with both instructors on the core exercise, and book the remaining exercise for next week.', 'أدير المجموعتين بالتوازي 13:00-15:00 مع المدربين على التمرين الأساسي، وأحجز التمرين المتبقي للأسبوع القادم.', 3,
            'Fits the new two hours and protects the core exercise; the rest is rebooked.', 'يتسع في الساعتين الجديدتين ويحمي التمرين الأساسي؛ ويُعاد حجز الباقي.'),
          O('Refuse to give the trainer up.', 'أرفض التخلي عن الجهاز.', 0, 'An urgent engineering check outranks a training slot.', 'الفحص الهندسي العاجل يتقدم على موعد تدريب.', true),
          O('Skip the practical today.', 'ألغي الجلسة العملية اليوم.', 1, 'Two good hours are still available.', 'ما زالت هناك ساعتان مفيدتان.'),
        ], [
          C('You now have the trainer 13:00-15:00.', 'أصبح الجهاز متاحاً لك 13:00-15:00.', true),
          C('Both instructors are available in the afternoon.', 'المدربان متاحان بعد الظهر.', true),
          C('Engineering requested the slot by e-mail.', 'طلب قسم الهندسة الموعد بالبريد الإلكتروني.', false),
          C('The trainees had lunch at 12:00.', 'تناول المتدربون الغداء الساعة 12:00.', false),
        ],
        'Check that the new plan really fits the new constraint; then protect what matters most and rebook the rest.', 'تحقق من أن الخطة الجديدة تتسع فعلاً للقيد الجديد، ثم احمِ الأهم وأعد حجز الباقي.'),
    ],
  },
  {
    id: 'aps-pr-001', code: 'APS-PR-001', theme: 'procedure_revision', difficulty: 3, est_minutes: 14, status: 'published', sort: 5,
    core_skill_ids: ['cs-procedure', 'cs-adaptability', 'cs-conservative'], skill_ids: ['sk-fs-tr-dependable', 'sk-fs-tr-analytical'],
    title_en: 'A procedure revision issued mid-job', title_ar: 'مراجعة إجراء تصدر أثناء العمل',
    summary_en: 'A routine calibration task: a new revision of the procedure is issued halfway through, then the difference turns out to be small.',
    summary_ar: 'مهمة معايرة روتينية: تصدر مراجعة جديدة للإجراء في منتصف العمل، ثم يتبين أن الفرق صغير.',
    context_en: 'You lead a routine calibration of non-safety temperature transmitters in a workshop, following a controlled procedure (synthetic revision C). Steps 1-6 of 12 are done. The situation is synthetic.',
    context_ar: 'تقود معايرة روتينية لمرسلات حرارة غير مرتبطة بالسلامة في ورشة، باتباع إجراء مضبوط (المراجعة الافتراضية C). أُنجزت الخطوات 1-6 من 12. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'Before restarting after the break, you plan the afternoon: steps 7-12, then the records. The work package was printed this morning.',
        'قبل الاستئناف بعد الاستراحة تخطط لفترة ما بعد الظهر: الخطوات 7-12 ثم السجلات. طُبعت حزمة العمل هذا الصباح.', ...Q_PLAN, [
          O('Check that the printed procedure is still the current revision before continuing.', 'أتحقق من أن الإجراء المطبوع ما زال المراجعة السارية قبل المتابعة.', 3, 'A quick check that keeps the whole afternoon valid.', 'فحص سريع يُبقي فترة ما بعد الظهر كلها صحيحة.'),
          O('Carry on: it was printed this morning.', 'أتابع: لقد طُبع هذا الصباح.', 1, 'Usually fine, but nobody checked.', 'غالباً لا بأس، لكن أحداً لم يتحقق.'),
          O('Skip to the records to finish early.', 'أنتقل إلى السجلات لأنتهي مبكراً.', 0, 'Records before the work is done are false records.', 'السجلات قبل إنجاز العمل سجلات غير صحيحة.'),
        ], [
          C('The work package was printed this morning.', 'طُبعت حزمة العمل هذا الصباح.', true),
          C('Six of twelve steps are complete.', 'أُنجزت ست خطوات من اثنتي عشرة.', true),
          C('The workshop radio is broken.', 'مذياع الورشة معطل.', false),
          C('Two transmitters are a newer model.', 'مرسلان من طراز أحدث.', false),
        ],
        'A controlled procedure is only as good as its revision status.', 'قيمة الإجراء المضبوط مرهونة بحالة مراجعته.'),
      ST('revd', 'change', 'Document control shows revision D was issued at 11:00, after you printed C. You do not yet know what changed.',
        'يُظهر نظام ضبط الوثائق أن المراجعة D صدرت الساعة 11:00 بعد أن طبعت C. ولا تعرف بعد ما الذي تغيّر.', ...Q_NOW, [
          O('Continue on revision C and check later.', 'أتابع على المراجعة C وأتحقق لاحقاً.', 0, 'Working to a superseded procedure without knowing the change.', 'العمل وفق إجراء ملغى دون معرفة التغيير.', true),
          O('Pause at a safe point, get revision D, compare it with C for steps 1-12, and ask the procedure owner if completed steps are affected.', 'أتوقف عند نقطة آمنة، وأحصل على المراجعة D، وأقارنها بـ C للخطوات 1-12، وأسأل مالك الإجراء إن كانت الخطوات المنجزة متأثرة.', 3,
            'Stops on uncertainty, finds the facts, and asks the owner about work already done.', 'يتوقف عند عدم اليقين ويجمع الحقائق ويسأل المالك عن العمل المنجز.'),
          O('Restart from step 1 on revision D without checking what changed.', 'أعيد البدء من الخطوة 1 على المراجعة D دون التحقق مما تغيّر.', 2, 'Safe but possibly wasteful; knowing the change first is better.', 'آمن لكنه قد يهدر الجهد؛ ومعرفة التغيير أولاً أفضل.'),
          O('Finish on C because you started on C.', 'أُكمل على C لأنني بدأت عليها.', 0, 'Starting on a revision is not permission to finish on it.', 'البدء على مراجعة لا يعني الإذن بالانتهاء عليها.'),
        ], [
          C('Revision D was issued after you printed C.', 'صدرت المراجعة D بعد طباعة C.', true),
          C('You do not know yet what changed.', 'لا تعرف بعد ما الذي تغيّر.', true),
          C('Revision D was written by a different engineer.', 'كتب المراجعة D مهندس مختلف.', false),
          C('The printer is low on toner.', 'حبر الطابعة منخفض.', false),
        ],
        'When the basis of the work changes and you do not know how, pause, find out, and ask the owner. Neither ignoring nor guessing is adaptive.',
        'عندما يتغير أساس العمل ولا تعرف كيف، توقف واستعلم واسأل المالك. لا التجاهل ولا التخمين تكيّف.'),
      ST('diff', 'change', 'Revision D only corrects a typing error in the title of step 11. Steps 1-10 and 12 are unchanged; the procedure owner confirms completed steps stand.',
        'تصحح المراجعة D خطأً مطبعياً في عنوان الخطوة 11 فقط. الخطوات 1-10 و12 لم تتغير، ويؤكد مالك الإجراء أن الخطوات المنجزة سارية.', ...Q_NOW, [
          O('Continue from step 7 on revision D, note the revision change in the record, and carry on.', 'أتابع من الخطوة 7 على المراجعة D، وأدوّن تغيير المراجعة في السجل، وأواصل.', 3,
            'The change is minor and confirmed; the record shows exactly what happened.', 'التغيير بسيط ومؤكد؛ ويُظهر السجل ما حدث بالضبط.', true),
          O('Restart everything on revision D anyway.', 'أعيد كل شيء على المراجعة D على أي حال.', 1, 'Over-reaction: the owner confirmed the completed steps stand.', 'مبالغة: أكد المالك أن الخطوات المنجزة سارية.'),
          O('Go back to revision C since nothing important changed.', 'أعود إلى المراجعة C لأنه لم يتغير شيء مهم.', 0, 'You must work to the current revision even when the change is small.', 'يجب العمل وفق المراجعة السارية حتى إن كان التغيير صغيراً.'),
          O('Stop the job and wait for a meeting about the revision.', 'أوقف العمل وأنتظر اجتماعاً بشأن المراجعة.', 1, 'Nothing is left to resolve.', 'لم يبق ما يحتاج إلى حسم.'),
        ], [
          C('Only the title of step 11 changed.', 'تغيّر عنوان الخطوة 11 فقط.', true),
          C('The procedure owner confirmed completed steps stand.', 'أكد مالك الإجراء أن الخطوات المنجزة سارية.', true),
          C('Revision D has a new cover page.', 'للمراجعة D صفحة غلاف جديدة.', false),
        ],
        'Once the facts are clear, the right response to a small change is a small adjustment, recorded honestly.', 'بعد اتضاح الحقائق، الاستجابة الصحيحة لتغيير صغير تعديل صغير يُسجَّل بأمانة.'),
    ],
  },
  {
    id: 'aps-dt-001', code: 'APS-DT-001', theme: 'digital_tool_outage', difficulty: 2, est_minutes: 10, status: 'published', sort: 6,
    core_skill_ids: ['cs-digital-judgement', 'cs-adaptability'], skill_ids: ['sk-fs-ai-verify', 'sk-fs-tr-resilience'],
    title_en: 'The work-management system goes down', title_ar: 'تعطل نظام إدارة العمل',
    summary_en: 'The electronic work-management tool fails during morning planning; then an AI assistant offers a ready-made schedule.',
    summary_ar: 'تتعطل أداة إدارة العمل الإلكترونية أثناء تخطيط الصباح، ثم يقترح مساعد ذكاء اصطناعي جدولاً جاهزاً.',
    context_en: 'You prepare the daily plan for a small maintenance team (non-safety buildings and workshops). The plan normally comes from the electronic work-management system. The situation is synthetic.',
    context_ar: 'تُعدّ الخطة اليومية لفريق صيانة صغير (مبانٍ وورش غير مرتبطة بالسلامة). تأتي الخطة عادة من نظام إدارة العمل الإلكتروني. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', '06:45. The team meets at 07:15. You have yesterday\'s printed plan and access to the system.',
        '06:45. يجتمع الفريق الساعة 07:15. لديك خطة الأمس المطبوعة وإمكانية الدخول إلى النظام.', ...Q_PLAN, [
          O('Export today\'s plan and open work orders now, so a copy exists if the system has problems.', 'أصدّر خطة اليوم وأوامر العمل المفتوحة الآن لتتوفر نسخة إذا واجه النظام مشكلات.', 3, 'A minute of preparation removes a single point of failure.', 'دقيقة من التحضير تزيل نقطة الإخفاق الوحيدة.'),
          O('Plan directly from yesterday\'s printout.', 'أخطط مباشرة من مطبوعة الأمس.', 1, 'Misses everything that changed overnight.', 'يفوته كل ما تغيّر خلال الليل.'),
          O('Wait until the meeting to open the system.', 'أنتظر حتى الاجتماع لأفتح النظام.', 1, 'Leaves no time to react if something is wrong.', 'لا يترك وقتاً للتصرف إذا كان هناك خلل.'),
        ], [
          C('The plan normally comes only from the system.', 'تأتي الخطة عادة من النظام فقط.', true),
          C('Yesterday\'s printout is out of date.', 'مطبوعة الأمس قديمة.', true),
          C('The meeting room was repainted.', 'أُعيد طلاء غرفة الاجتماعات.', false),
        ],
        'Notice single points of failure and keep a fallback copy of what the day depends on.', 'لاحظ نقاط الإخفاق الوحيدة واحتفظ بنسخة احتياطية مما يعتمد عليه اليوم.'),
      ST('down', 'change', '07:05. The system is down; IT expects two hours. You exported the plan at 06:50, but two urgent work orders were raised overnight after the export.',
        '07:05. النظام متعطل، ويتوقع قسم تقنية المعلومات ساعتين. صدّرت الخطة الساعة 06:50، لكن أمري عمل عاجلين أُنشئا خلال الليل بعد التصدير.', ...Q_NOW, [
          O('Run the meeting from the export, phone the shift desk for the two urgent orders, and record any work done on paper for later entry.', 'أدير الاجتماع من النسخة المصدّرة، وأتصل بمكتب النوبة لمعرفة الأمرين العاجلين، وأسجل أي عمل منجز ورقياً لإدخاله لاحقاً.', 3,
            'Uses the fallback, closes the gap it has, and keeps records complete.', 'يستخدم البديل ويسد ثغرته ويحافظ على اكتمال السجلات.'),
          O('Cancel the meeting until the system is back.', 'ألغي الاجتماع حتى يعود النظام.', 0, 'Two idle hours and the urgent orders wait.', 'ساعتان من التعطل والأوامر العاجلة تنتظر.', true),
          O('Use the export as it is.', 'أستخدم النسخة المصدّرة كما هي.', 1, 'Misses the two urgent orders raised after the export.', 'يفوته الأمران العاجلان اللذان أُنشئا بعد التصدير.'),
          O('Let everyone pick jobs they remember.', 'أترك كل واحد يختار الأعمال التي يتذكرها.', 0, 'No plan and no record.', 'لا خطة ولا سجل.'),
        ], [
          C('Two urgent orders came in after the export.', 'وصل أمران عاجلان بعد التصدير.', true),
          C('The system should be back in about two hours.', 'يُتوقع عودة النظام خلال ساعتين تقريباً.', true),
          C('IT is located in another building.', 'قسم تقنية المعلومات في مبنى آخر.', false),
          C('The export was printed in colour.', 'طُبعت النسخة المصدّرة بالألوان.', false),
        ],
        'A fallback has gaps; find them and close them, and keep the record so the system can be updated later.', 'للبديل ثغرات؛ اكتشفها وسدّها، واحتفظ بالسجل لتحديث النظام لاحقاً.'),
      ST('ai', 'change', '07:40. A colleague pastes the export into an approved AI assistant, which returns a neat schedule that drops one of the urgent orders and assigns a job to someone on leave.',
        '07:40. يلصق زميل النسخة المصدّرة في مساعد ذكاء اصطناعي معتمد، فيعيد جدولاً مرتباً يُسقط أحد الأمرين العاجلين ويُسند عملاً إلى شخص في إجازة.', ...Q_NOW, [
          O('Use the AI schedule; it is tidier than yours.', 'أستخدم جدول الذكاء الاصطناعي فهو أكثر ترتيباً من جدولي.', 0, 'Tidy is not correct: it drops urgent work and uses absent staff.', 'الترتيب ليس صحة: فهو يُسقط عملاً عاجلاً ويستخدم موظفاً غائباً.'),
          O('Keep your plan, and check the AI schedule against the urgent orders and the attendance list before using any part of it.', 'أُبقي خطتي، وأتحقق من جدول الذكاء الاصطناعي مقارنة بالأوامر العاجلة وقائمة الحضور قبل استخدام أي جزء منه.', 3,
            'The AI output is a draft to verify, not a decision; two errors are already visible.', 'مخرجات الذكاء الاصطناعي مسودة للتحقق وليست قراراً؛ وهناك خطآن ظاهران بالفعل.', true),
          O('Forbid the colleague from using AI tools.', 'أمنع الزميل من استخدام أدوات الذكاء الاصطناعي.', 1, 'The tool is approved; the issue is verification, not use.', 'الأداة معتمدة؛ والمشكلة في التحقق لا في الاستخدام.'),
          O('Fix the two errors and adopt the AI schedule without further checks.', 'أصحح الخطأين وأعتمد جدول الذكاء الاصطناعي دون فحوص أخرى.', 2, 'Better, but where there are two errors, check for more.', 'أفضل، لكن حيث يوجد خطآن ابحث عن المزيد.'),
        ], [
          C('The AI schedule drops one urgent order.', 'جدول الذكاء الاصطناعي يُسقط أمراً عاجلاً.', true),
          C('It assigns a job to someone on leave.', 'يُسند عملاً إلى شخص في إجازة.', true),
          C('The AI assistant is on the approved list.', 'مساعد الذكاء الاصطناعي مدرج في القائمة المعتمدة.', true),
          C('The colleague types faster than you.', 'يكتب الزميل أسرع منك.', false),
        ],
        'An approved tool can still be wrong. Verify AI output against the facts you hold before it replaces your plan.', 'الأداة المعتمدة قد تخطئ أيضاً. تحقق من مخرجات الذكاء الاصطناعي مقارنة بالحقائق التي لديك قبل أن تحل محل خطتك.'),
    ],
  },
  {
    id: 'aps-wl-001', code: 'APS-WL-001', theme: 'weather_logistics', difficulty: 2, est_minutes: 10, status: 'draft', sort: 7,
    core_skill_ids: ['cs-adaptability', 'cs-systems'], skill_ids: ['sk-fs-tr-systems', 'sk-fs-tr-resilience'],
    title_en: 'Sandstorm on contractor arrival day', title_ar: 'عاصفة رملية في يوم وصول المقاولين',
    summary_en: 'Draft: a contractor team is due on site when a sandstorm warning is issued; then the road reopens early.',
    summary_ar: 'مسودة: فريق مقاول يُنتظر وصوله إلى الموقع حين يصدر تحذير من عاصفة رملية، ثم يُعاد فتح الطريق مبكراً.',
    context_en: 'You host a contractor team arriving by bus for a week of scaffolding work in a non-safety area. The situation is synthetic.',
    context_ar: 'تستضيف فريق مقاول يصل بالحافلة لأسبوع من أعمال السقالات في منطقة غير مرتبطة بالسلامة. الموقف افتراضي.',
    stages: [
      ST('plan', 'initial', 'The bus arrives at 08:00; site induction is at 09:00; work starts at 11:00.', 'تصل الحافلة الساعة 08:00، والتعريف بالموقع الساعة 09:00، ويبدأ العمل الساعة 11:00.', ...Q_PLAN, [
        O('Confirm the induction room, the escort and a call tree in case of travel problems.', 'أؤكد قاعة التعريف والمرافق وسلسلة اتصال تحسباً لمشكلات السفر.', 3, 'Cheap preparation for the likely failure.', 'تحضير قليل الكلفة للإخفاق المحتمل.'),
        O('Nothing extra.', 'لا شيء إضافي.', 1, 'No plan B for travel.', 'لا خطة بديلة للسفر.'),
        O('Start work at 08:00 without induction.', 'أبدأ العمل الساعة 08:00 دون تعريف.', 0, 'Induction is not optional.', 'التعريف ليس اختيارياً.'),
      ], [
        C('Everyone arrives on one bus.', 'يصل الجميع في حافلة واحدة.', true),
        C('Induction comes before work.', 'التعريف يسبق العمل.', true),
        C('The bus is blue.', 'الحافلة زرقاء.', false),
      ], 'Prepare for the obvious single point of failure.', 'استعد لنقطة الإخفاق الوحيدة الواضحة.'),
      ST('storm', 'change', '07:00. A sandstorm warning closes the access road until 12:00.', '07:00. يُغلق تحذير من عاصفة رملية طريق الوصول حتى الساعة 12:00.', ...Q_NOW, [
        O('Hold the bus at the hotel, move induction to 13:00 and work to the next day.', 'أُبقي الحافلة في الفندق، وأنقل التعريف إلى 13:00 والعمل إلى اليوم التالي.', 3, 'Safe and realistic re-plan.', 'إعادة تخطيط آمنة وواقعية.'),
        O('Keep the plan; the bus will find a way.', 'أُبقي الخطة؛ ستجد الحافلة طريقاً.', 0, 'Unsafe travel.', 'سفر غير آمن.', true),
        O('Cancel the week.', 'ألغي الأسبوع.', 1, 'Too much for a half-day delay.', 'أكثر من اللازم لتأخير نصف يوم.'),
      ], [
        C('The road is closed until 12:00.', 'الطريق مغلق حتى 12:00.', true),
        C('The team is still at the hotel.', 'ما زال الفريق في الفندق.', true),
        C('The forecast was issued by e-mail.', 'صدر التحذير بالبريد الإلكتروني.', false),
      ], 'Move the plan around the new constraint, not through it.', 'حرّك الخطة حول القيد الجديد لا عبره.'),
    ],
  },
].map((s) => ({ ...s, sources: [SRC.piaac, SRC.cso, SRC.iaea], version: 1, updated_by: 'p-training-mgr', updated_at: '2026-09-28T09:00:00Z' }));

// ═══════════════════════════════════════════ FS59 role-play library
const K = (id, label_en, label_ar, desc_en, desc_ar, tip_en, tip_ar, check) => ({ id, label_en, label_ar, desc_en, desc_ar, tip_en, tip_ar, check });
const cues = (list, min) => ({ type: 'cues', cues: list, ...(min ? { min } : {}) });
const QUESTION = K('check_understanding', 'Checks understanding with a question', 'يتحقق من الفهم بسؤال', 'Ends with a real question (a ? or ؟) that invites the other person to respond.',
  'ينتهي بسؤال حقيقي (؟ أو ?) يدعو الطرف الآخر إلى الرد.', 'Ask one open question before you move on.', 'اطرح سؤالاً مفتوحاً واحداً قبل أن تنتقل.', { type: 'question' });
const T_ = (id, prompt_en, prompt_ar, hint_en, hint_ar, example_en, example_ar, criteria) => ({ id, prompt_en, prompt_ar, hint_en, hint_ar, example_en, example_ar, criteria });

export const ROLEPLAY = [
  {
    id: 'rp-pb-01', code: 'RP-PB-01', kind: 'pre_job_brief', level: 1, pass_pct: 70, est_minutes: 12, status: 'published', sort: 1,
    core_skill_ids: ['cs-peer-check', 'cs-procedure'], skill_ids: ['sk-fs-tr-dependable', 'sk-fs-tr-leadership'],
    title_en: 'Pre-job brief for a valve repacking', title_ar: 'إحاطة ما قبل العمل لإعادة حشو صمام',
    summary_en: 'Lead a short pre-job brief: the job, what could go wrong, the critical step and when to stop.',
    summary_ar: 'قد إحاطة قصيرة قبل العمل: المهمة وما قد يسوء والخطوة الحرجة ومتى نتوقف.',
    setting_en: 'You are the work lead for a two-person crew repacking the gland of a manual valve on a non-safety water line (synthetic work package WP-4471). The crew is at the job site; the permit is signed.',
    setting_ar: 'أنت قائد العمل لطاقم من شخصين يعيد حشو صمام يدوي على خط مياه غير مرتبط بالسلامة (حزمة العمل الافتراضية WP-4471). الطاقم في موقع العمل والتصريح موقّع.',
    counterpart_en: 'A crew member (role card)', counterpart_ar: 'عضو في الطاقم (بطاقة دور)', role_en: 'Work lead', role_ar: 'قائد العمل',
    rubric: [
      K('scope', 'Names the job', 'يحدد المهمة', 'Says what the job is (the task, the valve, the work package).', 'يذكر ما هي المهمة (العمل والصمام وحزمة العمل).',
        'Start with one sentence on what we are doing and where.', 'ابدأ بجملة واحدة عما نفعله وأين.', cues(['scope', 'task', 'job', 'work package', 'valve', 'repack*', 'نطاق', 'المهمة', 'مهمة', 'العمل', 'حزمة العمل', 'الصمام'])),
      K('hazards', 'Names what could go wrong', 'يحدد ما قد يسوء', 'Names a hazard or error trap (stored energy, pressure, heat).', 'يذكر خطراً أو فخ خطأ (طاقة مخزنة أو ضغط أو حرارة).',
        'Name the one hazard that would hurt someone today.', 'سمِّ الخطر الذي قد يؤذي أحداً اليوم.', cues(['hazard*', 'risk*', 'what could go wrong', 'error-likely', 'trap*', 'stored energy', 'pressur*', 'hot', 'خطر*', 'الخطر*', 'مخاطر*', 'المخاطر*', 'الضغط', 'ضغط', 'ساخن*', 'الطاقة المخزنة'])),
      K('stop', 'Says when we stop', 'يحدد متى نتوقف', 'States a stop or hold condition (stop, time out, hold point, when in doubt).', 'يذكر شرطاً للتوقف أو الانتظار (توقف أو نقطة توقف أو عند الشك).',
        'Tell the crew what makes us stop and who we call.', 'أخبر الطاقم بما يجعلنا نتوقف وبمن نتصل.', cues(['stop*', 'time out', 'pause*', 'hold point', 'when in doubt', 'توقف*', 'نتوقف', 'نوقف', 'نقطة توقف', 'عند الشك'])),
      K('critical_step', 'Names the critical step', 'يحدد الخطوة الحرجة', 'Identifies the critical or irreversible step (for example confirming isolation).', 'يحدد الخطوة الحرجة أو التي لا رجعة فيها (مثل التأكد من العزل).',
        'Say which step cannot be undone and why.', 'قل أي خطوة لا يمكن التراجع عنها ولماذا.', cues(['critical step', 'critical', 'irreversible', 'point of no return', 'isolation', 'isolat*', 'الخطوة الحرجة', 'خطوة حرجة', 'حرج*', 'العزل', 'عزل'])),
      K('peer_check', 'Agrees a verification', 'يتفق على التحقق', 'Agrees a peer check, independent verification or three-way communication.', 'يتفق على فحص الزميل أو التحقق المستقل أو التواصل الثلاثي.',
        'Agree who checks the critical step and how.', 'اتفق على من يتحقق من الخطوة الحرجة وكيف.', cues(['peer check*', 'second check', 'independent verif*', 'three-way', 'read back', 'repeat back', 'فحص الزميل', 'التحقق المستقل', 'التحقق المزدوج', 'التواصل الثلاثي'])),
      K('acknowledge', 'Welcomes the question', 'يرحب بالسؤال', 'Thanks the person or acknowledges the catch before answering.', 'يشكر الشخص أو يقدّر ملاحظته قبل الإجابة.',
        'Thank people for questions; it keeps them coming.', 'اشكر الناس على أسئلتهم؛ فذلك يشجعهم على طرحها.', cues(['good catch', 'thank*', 'glad you', 'well spotted', 'right to ask', 'شكرا', 'ملاحظة جيدة', 'أحسنت', 'سؤال في محله'])),
      K('roles', 'Gives each person a role', 'يحدد دور كل شخص', 'Says who does what (you will, I will, your role).', 'يحدد من يفعل ماذا (ستقوم، سأقوم، دورك).',
        'Close with who does what.', 'اختم بتحديد من يفعل ماذا.', cues(['i will', 'you will', 'your role', 'my role', 'responsib*', 'سأقوم', 'ستقوم', 'دورك', 'دوري', 'مسؤول*'])),
      QUESTION,
    ],
    turns: [
      T_('brief', 'We are ready when you are. What is the job today, and what could go wrong?', 'نحن جاهزون متى شئت. ما مهمة اليوم، وما الذي قد يسوء؟',
        'Cover the job, the main hazard and what makes us stop.', 'غطِّ المهمة والخطر الرئيسي وما يجعلنا نتوقف.',
        'Today\'s job is to repack the gland on valve V-12 under work package WP-4471. The main hazard is stored energy: the line must be isolated, drained and at zero pressure before anyone loosens a bolt, and the valve body may still be hot. If anything does not match the package, we stop and call the work control desk.',
        'مهمة اليوم هي إعادة حشو الصمام V-12 وفق حزمة العمل WP-4471. الخطر الرئيسي هو الطاقة المخزنة: يجب عزل الخط وتصريفه وأن يكون الضغط صفراً قبل فك أي مسمار، وقد يكون جسم الصمام ساخناً. إذا لم يطابق أي شيء الحزمة نتوقف ونتصل بمكتب التحكم في العمل.',
        ['scope', 'hazards', 'stop']),
      T_('critical', 'Which step do you want us to watch most closely, and how will we check it?', 'أي خطوة تريدنا أن نراقبها عن كثب، وكيف سنتحقق منها؟',
        'Name the step that cannot be undone and the check you agree on.', 'سمِّ الخطوة التي لا يمكن التراجع عنها والفحص الذي تتفقون عليه.',
        'The critical step is confirming isolation before we open the gland: once it is open there is no going back. We will do a peer check on the isolation points against the permit, and use three-way communication when we confirm zero pressure.',
        'الخطوة الحرجة هي التأكد من العزل قبل فتح الحشوة، فبعد فتحها لا رجوع. سنجري فحص الزميل لنقاط العزل مقابل التصريح، ونستخدم التواصل الثلاثي عند تأكيد انعدام الضغط.',
        ['critical_step', 'peer_check']),
      T_('question', 'Quick question: the drawing in the package is revision B but the tag on the valve says revision C. Does that matter?', 'سؤال سريع: المخطط في الحزمة مراجعته B لكن الملصق على الصمام يقول المراجعة C. هل هذا مهم؟',
        'Welcome the question, decide, and check what they saw.', 'رحّب بالسؤال واتخذ القرار وتحقق مما رآه.',
        'Good catch, thank you for raising it. Yes, it matters: we stop here until work control confirms which revision is correct. Can you show me exactly where the tag and the drawing differ?',
        'ملاحظة جيدة، شكراً لأنك طرحتها. نعم هذا مهم: نتوقف هنا حتى يؤكد مكتب التحكم في العمل المراجعة الصحيحة. هل يمكنك أن تريني أين يختلف الملصق عن المخطط؟',
        ['acknowledge', 'stop', 'check_understanding']),
      T_('close', 'Anything else before we start?', 'هل هناك شيء آخر قبل أن نبدأ؟',
        'Give each person a role and invite last questions.', 'حدد دور كل شخص وادعُ إلى الأسئلة الأخيرة.',
        'You will do the isolation checks and I will hold the permit and the procedure; the second technician is the peer checker. Is everyone clear on their role, and does anyone have a question before we start?',
        'ستقوم أنت بفحوص العزل وسأمسك أنا التصريح والإجراء، والفني الثاني هو من يجري فحص الزميل. هل الجميع واضح بشأن دوره، وهل لدى أحد سؤال قبل أن نبدأ؟',
        ['roles', 'check_understanding']),
    ],
  },
  {
    id: 'rp-st-01', code: 'RP-ST-01', kind: 'shift_turnover', level: 1, pass_pct: 70, est_minutes: 10, status: 'published', sort: 2,
    core_skill_ids: ['cs-comm-stress', 'cs-peer-check'], skill_ids: ['sk-fs-tr-dependable', 'sk-fs-tr-empathy'],
    title_en: 'Shift turnover with an open issue', title_ar: 'تسليم نوبة مع مسألة مفتوحة',
    summary_en: 'Hand over an area with a rising trend and an open work order, then confirm the read-back.',
    summary_ar: 'سلّم منطقة فيها اتجاه متصاعد وأمر عمل مفتوح، ثم أكد قراءة الاستلام.',
    setting_en: 'You are finishing a day shift as the area supervisor for building ventilation and chilled water (non-safety). The incoming supervisor has ten minutes for the turnover.',
    setting_ar: 'تنهي نوبة نهارية بصفتك مشرف منطقة التهوية والمياه المبردة في المباني (غير مرتبطة بالسلامة). لدى المشرف المستلم عشر دقائق للتسليم.',
    counterpart_en: 'The incoming supervisor (role card)', counterpart_ar: 'المشرف المستلم (بطاقة دور)', role_en: 'Outgoing supervisor', role_ar: 'المشرف المسلِّم',
    rubric: [
      K('status', 'Gives the status', 'يقدم الحالة', 'States equipment status (running, available, in or out of service).', 'يذكر حالة المعدات (تعمل، متاحة، في الخدمة أو خارجها).',
        'Lead with what is running and what is not.', 'ابدأ بما يعمل وما لا يعمل.', cues(['status', 'in service', 'out of service', 'running', 'available', 'condition', 'حالة', 'الحالة', 'في الخدمة', 'خارج الخدمة', 'يعمل', 'متاح'])),
      K('open_items', 'Names open items', 'يحدد البنود المفتوحة', 'Mentions what is still open or pending.', 'يذكر ما يزال مفتوحاً أو معلقاً.',
        'List what is not finished.', 'اذكر ما لم ينتهِ بعد.', cues(['open', 'pending', 'outstanding', 'in progress', 'not yet', 'مفتوح*', 'معلق*', 'قيد التنفيذ', 'لم ينته*'])),
      K('numbers', 'Uses numbers and times', 'يستخدم الأرقام والأوقات', 'Includes at least one number (a time, a value or a count).', 'يتضمن رقماً واحداً على الأقل (وقتاً أو قيمة أو عدداً).',
        'Give the time or value, not "soon" or "high".', 'اذكر الوقت أو القيمة لا "قريباً" أو "مرتفع".', { type: 'digit' }),
      K('abnormal', 'Flags what is abnormal', 'ينبه إلى غير الطبيعي', 'Names an abnormal or degraded condition, a trend or an alarm.', 'يذكر حالة غير طبيعية أو متدهورة أو اتجاهاً أو إنذاراً.',
        'Say what is drifting, even if it is still within limits.', 'قل ما ينحرف حتى لو كان ضمن الحدود.', cues(['abnormal', 'degraded', 'trend*', 'alarm*', 'limit*', 'higher than', 'lower than', 'غير طبيعي*', 'متدهور*', 'اتجاه*', 'إنذار*', 'الحد', 'حد'])),
      K('action', 'Says what is being done', 'يذكر ما يجري فعله', 'Says what action is in place (a work order, monitoring, a next step).', 'يذكر الإجراء القائم (أمر عمل أو مراقبة أو خطوة تالية).',
        'Pair every issue with its action and owner.', 'اربط كل مسألة بإجرائها ومسؤولها.', cues(['action', 'work order', 'raised', 'next step', 'monitor*', 'i have', 'we have', 'إجراء', 'الإجراء', 'أمر عمل', 'راقب*', 'المراقبة', 'نراقب'])),
      K('priority', 'Sets the first priority', 'يحدد الأولوية الأولى', 'Says what to do first or before something else.', 'يحدد ما يُفعل أولاً أو قبل غيره.',
        'Tell them the one thing to do first.', 'أخبره بالشيء الوحيد الذي يُفعل أولاً.', cues(['first', 'priority', 'before', 'urgent', 'أولا', 'أولوية', 'الأولوية', 'قبل', 'عاجل'])),
      K('confirm', 'Confirms the read-back', 'يؤكد قراءة الاستلام', 'Confirms or corrects the incoming supervisor\'s read-back.', 'يؤكد قراءة المشرف المستلم أو يصححها.',
        'Say "correct" or correct it; never let a wrong read-back pass.', 'قل "صحيح" أو صحّحها؛ ولا تترك قراءة خاطئة تمر.', cues(['correct', 'that is right', 'confirm*', 'agreed', 'yes', 'صحيح', 'أؤكد', 'نعم', 'موافق'])),
      QUESTION,
    ],
    turns: [
      T_('status', 'I am taking over. What is the status of the area?', 'سأستلم الآن. ما حالة المنطقة؟', 'Status, open items and times.', 'الحالة والبنود المفتوحة والأوقات.',
        'Both supply fans are running and the standby chiller is available. One work order is still open on the east air handler, and the filter change is pending until 14:00.',
        'مروحتا الإمداد تعملان والمبرد الاحتياطي متاح. ما زال أمر عمل واحد مفتوحاً على وحدة مناولة الهواء الشرقية، وتغيير المرشح معلق حتى الساعة 14:00.',
        ['status', 'open_items', 'numbers']),
      T_('abnormal', 'Anything abnormal I should know about?', 'هل هناك شيء غير طبيعي ينبغي أن أعرفه؟', 'What is drifting and what is being done.', 'ما الذي ينحرف وما الذي يجري فعله.',
        'Yes: the vibration trend on fan B has been rising since Tuesday, still below the alarm limit. I raised a work order and asked the next shift to monitor it every four hours.',
        'نعم، اتجاه الاهتزاز في المروحة ب يرتفع منذ الثلاثاء وما زال دون حد الإنذار. أنشأت أمر عمل وطلبت من النوبة التالية المراقبة كل أربع ساعات.',
        ['abnormal', 'action']),
      T_('first', 'What do I need to do first?', 'ما أول ما عليّ فعله؟', 'One first priority, with a time.', 'أولوية أولى واحدة مع وقت.',
        'First, check the fan B reading at 10:00 and compare it with the limit. The filter change can wait until after the 14:00 delivery.',
        'أولاً، تحقق من قراءة المروحة ب الساعة 10:00 وقارنها بالحد. ويمكن تأجيل تغيير المرشح إلى ما بعد توريد الساعة 14:00.',
        ['priority', 'numbers']),
      T_('readback', 'Let me read back what I have: fans running, one open order, the fan B trend to check at 10:00.', 'دعني أقرأ ما لدي: المراوح تعمل، وأمر مفتوح واحد، واتجاه المروحة ب للتحقق الساعة 10:00.',
        'Confirm or correct, then invite questions.', 'أكّد أو صحّح ثم ادعُ إلى الأسئلة.',
        'That is correct. One thing to add: the chiller was swapped to standby at 05:00. Do you have any questions before I leave?',
        'صحيح. أضيف أمراً واحداً: نُقل المبرد إلى الاحتياط الساعة 05:00. هل لديك أي أسئلة قبل أن أغادر؟',
        ['confirm', 'check_understanding']),
    ],
  },
  {
    id: 'rp-rc-01', code: 'RP-RC-01', kind: 'raise_concern', level: 2, pass_pct: 70, est_minutes: 12, status: 'published', sort: 3,
    core_skill_ids: ['cs-speak-up', 'cs-questioning'], skill_ids: ['sk-fs-tr-leadership', 'sk-fs-tr-analytical'],
    title_en: 'Raising a concern to a busy senior', title_ar: 'رفع ملاحظة إلى مسؤول أعلى مشغول',
    summary_en: 'Practise raising a technical concern clearly and respectfully when the senior pushes back. For a real concern, use the speak-up channels.',
    summary_ar: 'تدرّب على رفع ملاحظة فنية بوضوح واحترام عندما يعترض المسؤول الأعلى. للمخاوف الحقيقية استخدم قنوات الإبلاغ.',
    setting_en: 'You noticed that the tag of a temporary modification on a non-safety cooling line shows a removal date that has passed. The section head is between meetings. The situation is fictional practice material.',
    setting_ar: 'لاحظت أن ملصق تعديل مؤقت على خط تبريد غير مرتبط بالسلامة يُظهر تاريخ إزالة قد انقضى. رئيس القسم بين اجتماعين. الموقف مادة تدريبية افتراضية.',
    counterpart_en: 'A section head (role card)', counterpart_ar: 'رئيس قسم (بطاقة دور)', role_en: 'Technician', role_ar: 'فني',
    rubric: [
      K('concern', 'States the concern plainly', 'يذكر الملاحظة بوضوح', 'Says there is a concern or problem in the first sentence.', 'يذكر في الجملة الأولى أن هناك ملاحظة أو مشكلة.',
        'Lead with "I have a concern about ..."', 'ابدأ بـ "لدي قلق بشأن ..."', cues(['concern*', 'worried', 'not right', 'issue', 'problem', 'قلق*', 'مخاوف', 'مشكلة', 'غير صحيح'])),
      K('facts', 'Gives the facts', 'يقدم الحقائق', 'Says what was seen or checked (the tag, the date).', 'يذكر ما رآه أو تحقق منه (الملصق والتاريخ).',
        'Say what you saw, where and when.', 'قل ما رأيته وأين ومتى.', cues(['i saw', 'i checked', 'i noticed', 'observed', 'tag', 'date', 'expired', 'رأيت', 'لاحظت', 'تحققت', 'الملصق', 'تاريخ'])),
      K('persist', 'Holds the point respectfully', 'يتمسك بالفكرة باحترام', 'Acknowledges the push-back and still holds the point (but, however, even so).', 'يقر بالاعتراض ويتمسك بالفكرة (لكن، ومع ذلك).',
        'Acknowledge, then say "but" and the reason.', 'أقرّ ثم قل "لكن" واذكر السبب.', cues(['even so', 'i understand but', 'however', 'respectfully', 'still think', 'but', 'مع ذلك', 'ومع ذلك', 'لكن', 'أتفهم'])),
      K('safety_reason', 'Gives the safety reason', 'يذكر سبب السلامة', 'Links the concern to safety, risk, configuration or the procedure.', 'يربط الملاحظة بالسلامة أو المخاطر أو التهيئة أو الإجراء.',
        'Say why it matters for safety, not only for the rules.', 'قل لماذا يهم ذلك للسلامة لا للقواعد فقط.', cues(['safety', 'risk', 'configuration', 'margin', 'procedure', 'السلامة', 'سلامة', 'المخاطر', 'خطر', 'الإجراء', 'التهيئة'])),
      K('specific_ask', 'Makes a specific ask', 'يقدم طلباً محدداً', 'Asks for a specific action (could you, I suggest, please).', 'يطلب إجراءً محدداً (هل يمكن، أقترح، أرجو).',
        'Ask for one concrete action.', 'اطلب إجراءً واحداً ملموساً.', cues(['could you', 'can we', 'i suggest', 'i propose', 'please', 'would you', 'أقترح', 'هل يمكن', 'أرجو', 'هل نستطيع'])),
      K('timing', 'Gives a time', 'يحدد وقتاً', 'Says by when (today, before the end of the shift, now).', 'يحدد متى (اليوم، قبل نهاية النوبة، الآن).',
        'Put a time on your ask.', 'ضع وقتاً لطلبك.', cues(['today', 'before', 'by the end', 'now', 'this shift', 'اليوم', 'قبل', 'الآن', 'هذه النوبة'])),
      K('escalate', 'Names the next step if refused', 'يحدد الخطوة التالية عند الرفض', 'Names the formal route if the answer is no (a condition report, the shift manager).', 'يذكر المسار الرسمي إذا كان الجواب لا (تقرير حالة أو مدير النوبة).',
        'Know your next step before you need it.', 'اعرف خطوتك التالية قبل أن تحتاج إليها.', cues(['escalat*', 'condition report', 'corrective action', 'next level', 'shift manager', 'تصعيد', 'أصعد', 'تقرير حالة', 'مدير النوبة', 'الإجراء التصحيحي'])),
      K('respect', 'Stays respectful', 'يحافظ على الاحترام', 'Thanks the person or shows respect for their role.', 'يشكر الشخص أو يُظهر احترامه لدوره.',
        'Thank them for their time, whatever the answer.', 'اشكره على وقته أياً كان الجواب.', cues(['respect*', 'thank*', 'appreciate', 'شكرا', 'أقدر', 'احترام', 'أحترم'])),
    ],
    turns: [
      T_('open', 'I have only got two minutes. What is it?', 'لدي دقيقتان فقط. ما الأمر؟', 'Say the concern and the facts in two sentences.', 'اذكر الملاحظة والحقائق في جملتين.',
        'I have a concern about the temporary modification on the cooling line. I checked the tag this morning: its removal date was 14 September, so it has expired.',
        'لدي قلق بشأن التعديل المؤقت على خط التبريد. تحققت من الملصق هذا الصباح: تاريخ إزالته كان 14 سبتمبر، أي أنه منتهٍ.',
        ['concern', 'facts']),
      T_('push', 'It has been like that for weeks. It is fine.', 'إنه كذلك منذ أسابيع. لا بأس.', 'Acknowledge, then hold the point with the safety reason.', 'أقرّ ثم تمسك بالفكرة مع سبب السلامة.',
        'I understand it looks fine, but an expired temporary modification means the configuration is no longer what the procedure assumes, and that is a safety margin question.',
        'أتفهم أنه يبدو سليماً، لكن انتهاء التعديل المؤقت يعني أن التهيئة لم تعد كما يفترضها الإجراء، وهذه مسألة تتعلق بهامش السلامة.',
        ['persist', 'safety_reason']),
      T_('ask', 'So what do you want me to do about it?', 'إذن ماذا تريدني أن أفعل حيال ذلك؟', 'One specific action and a time.', 'إجراء محدد واحد ووقت.',
        'Could you ask engineering to confirm today whether it can stay, and if not, plan its removal before the end of this shift?',
        'هل يمكن أن تطلب من الهندسة التأكد اليوم إن كان يمكن إبقاؤه، وإن لم يكن، التخطيط لإزالته قبل نهاية هذه النوبة؟',
        ['specific_ask', 'timing']),
      T_('refuse', 'And if I say no?', 'وإن قلت لا؟', 'The formal route, said respectfully.', 'المسار الرسمي، بأسلوب محترم.',
        'Then I would respect that it is your call, but I would raise a condition report so the question gets a documented answer. Thank you for hearing me out.',
        'عندها أحترم أن القرار لك، لكنني سأرفع تقرير حالة حتى يحصل السؤال على إجابة موثقة. شكراً لأنك استمعت إلي.',
        ['escalate', 'respect']),
    ],
  },
  {
    id: 'rp-ri-01', code: 'RP-RI-01', kind: 'regulator_interview', level: 2, pass_pct: 70, est_minutes: 15, status: 'published', sort: 4,
    core_skill_ids: ['cs-procedure', 'cs-accountability'], skill_ids: ['sk-fs-tr-analytical', 'sk-fs-tr-selfaware'],
    title_en: 'Inspection-style interview practice', title_ar: 'تمرين على مقابلة بأسلوب التفتيش',
    summary_en: 'Answer inspection-style questions about procedure use honestly and concretely. Practice only: Kafa\'a is not a regulator and this is not an inspection.',
    summary_ar: 'أجب عن أسئلة بأسلوب التفتيش حول استخدام الإجراءات بصدق ووضوح. تمرين فقط: كفاءة ليست جهة رقابية وهذا ليس تفتيشاً.',
    setting_en: 'A colleague plays an inspector asking how you work with procedures in your own area. Answer as you would in a real interview: concrete, first-hand and honest about what you do not know.',
    setting_ar: 'يؤدي زميل دور مفتش يسألك كيف تعمل بالإجراءات في منطقتك. أجب كما تفعل في مقابلة حقيقية: بوضوح ومن واقع تجربتك وبصدق بشأن ما لا تعرفه.',
    counterpart_en: 'A practice interviewer playing an inspector (role card)', counterpart_ar: 'محاور تدريبي يؤدي دور مفتش (بطاقة دور)', role_en: 'Interviewee', role_ar: 'الشخص الذي تجري مقابلته',
    rubric: [
      K('concrete', 'Describes what you actually do', 'يصف ما تفعله فعلاً', 'Describes a concrete check (the revision, document control, a controlled copy).', 'يصف فحصاً ملموساً (المراجعة، ضبط الوثائق، النسخة المعتمدة).',
        'Say what you do, step by step, not what people should do.', 'قل ما تفعله خطوة بخطوة لا ما ينبغي أن يفعله الناس.', cues(['i check', 'i verify', 'revision', 'document control', 'controlled copy', 'current', 'أتحقق', 'المراجعة', 'النسخة المعتمدة', 'ضبط الوثائق', 'السارية'])),
      K('length', 'Answers in enough depth', 'يجيب بعمق كافٍ', 'Between 15 and 180 words: enough to be specific, short enough to stay clear.', 'بين 15 و180 كلمة: ما يكفي للتحديد ويبقى واضحاً.',
        'Two or three sentences usually work best.', 'جملتان أو ثلاث تكفي عادة.', { type: 'length', min: 15, max: 180 }),
      K('stop', 'Stops when it cannot be followed', 'يتوقف عند تعذر الاتباع', 'Says they stop or pause at a safe point.', 'يذكر أنه يتوقف عند نقطة آمنة.',
        'Say that you stop first.', 'قل إنك تتوقف أولاً.', cues(['stop*', 'pause*', 'hold', 'أتوقف', 'توقف*', 'نتوقف'])),
      K('escalate', 'Involves the right person', 'يُشرك الشخص المناسب', 'Names who they tell (the supervisor, the procedure owner, a change request).', 'يذكر من يُبلغ (المشرف أو مالك الإجراء أو طلب تغيير).',
        'Name the person or route, not just "someone".', 'سمِّ الشخص أو المسار لا "أحداً ما".', cues(['supervisor', 'shift manager', 'procedure owner', 'raise', 'change request', 'المشرف', 'مالك الإجراء', 'أبلغ', 'طلب تغيير'])),
      K('no_workaround', 'Rules out workarounds', 'يستبعد الالتفاف', 'Says they would not work around or improvise.', 'يذكر أنه لن يلتف على الإجراء أو يرتجل.',
        'Say clearly what you would never do.', 'قل بوضوح ما لن تفعله أبداً.', cues(['never', 'do not', 'would not', 'wouldn t', 'لن', 'أبدا', 'لا أعمل'])),
      K('example', 'Gives a real example', 'يقدم مثالاً حقيقياً', 'Sets the scene of an example (when, during, last year).', 'يحدد سياق مثال (عندما، خلال، العام الماضي).',
        'Start with when and where it happened.', 'ابدأ بمتى وأين حدث ذلك.', cues(['when', 'during', 'last year', 'once', 'last month', 'عندما', 'خلال', 'العام الماضي', 'مرة'])),
      K('result', 'Says what came of it', 'يذكر ما نتج عنه', 'Says the result or what was learned.', 'يذكر النتيجة أو ما تعلمه.',
        'End the example with its outcome.', 'اختم المثال بنتيجته.', cues(['result', 'outcome', 'learned', 'learnt', 'as a result', 'النتيجة', 'نتيجة', 'تعلمت'])),
      K('honest', 'Is honest about limits', 'يتحلى بالصدق بشأن حدود معرفته', 'Admits not knowing and says how they will find out.', 'يعترف بعدم المعرفة ويذكر كيف سيعرف.',
        'Never guess: say you will find out.', 'لا تخمّن أبداً: قل إنك ستتحقق.', cues(['i do not know', 'i don t know', 'not sure', 'find out', 'come back', 'follow up', 'لا أعرف', 'لست متأكد*', 'سأتحقق', 'سأعود'])),
    ],
    turns: [
      T_('revision', 'Walk me through how you know you are using the current revision of a procedure.', 'اشرح لي كيف تعرف أنك تستخدم المراجعة السارية من الإجراء.',
        'Describe your own check, concretely.', 'صف فحصك أنت بشكل ملموس.',
        'Before I start any task I check the revision number on my copy against the document control system, and I only work from a controlled copy printed that day. If the numbers differ, I get the current revision before I begin.',
        'قبل أن أبدأ أي مهمة أتحقق من رقم المراجعة في نسختي مقارنة بنظام ضبط الوثائق، ولا أعمل إلا من النسخة المعتمدة المطبوعة في اليوم نفسه. وإذا اختلف الرقمان أحصل على المراجعة السارية قبل أن أبدأ.',
        ['concrete', 'length']),
      T_('cannot', 'What do you do if the procedure cannot be followed as written?', 'ماذا تفعل إذا تعذر اتباع الإجراء كما هو مكتوب؟',
        'Stop, tell the right person, no workaround.', 'توقف وأبلغ الشخص المناسب ولا التفاف.',
        'I stop at a safe point and tell my supervisor, who contacts the procedure owner. I would never work around a step or improvise, even under time pressure.',
        'أتوقف عند نقطة آمنة وأبلغ المشرف الذي يتواصل مع مالك الإجراء. لن أتجاوز أي خطوة أو أرتجل أبداً، حتى تحت ضغط الوقت.',
        ['stop', 'escalate', 'no_workaround']),
      T_('example', 'Give me an example from your own work.', 'أعطني مثالاً من عملك.', 'When it happened, what you did, what came of it.', 'متى حدث وماذا فعلت وما الذي نتج.',
        'Last year, during a calibration, I found a step that referred to a tool we no longer use. I stopped and raised it; as a result the procedure was corrected within a week.',
        'خلال معايرة في العام الماضي وجدت خطوة تشير إلى أداة لم نعد نستخدمها. توقفت وأبلغت عنها، وكانت النتيجة تصحيح الإجراء خلال أسبوع.',
        ['example', 'result']),
      T_('unknown', 'Is there anything you do not know the answer to?', 'هل هناك شيء لا تعرف إجابته؟', 'Be honest and say how you will find out.', 'كن صادقاً وقل كيف ستعرف.',
        'I am not sure how often the document control system is audited, so I would not guess. I will find out from the procedure owner and come back to you today.',
        'لست متأكداً من عدد مرات تدقيق نظام ضبط الوثائق، لذلك لن أخمّن. سأتحقق من مالك الإجراء وأعود إليك اليوم.',
        ['honest', 'length']),
    ],
  },
  {
    id: 'rp-kt-01', code: 'RP-KT-01', kind: 'knowledge_transfer', level: 1, pass_pct: 60, est_minutes: 15, status: 'published', sort: 5,
    core_skill_ids: ['cs-cross-cultural', 'cs-developing'], skill_ids: ['sk-fs-tr-crosscultural', 'sk-fs-tr-empathy'],
    title_en: 'Knowledge-transfer session with a vendor expert', title_ar: 'جلسة نقل معرفة مع خبير من المورد',
    summary_en: 'Lead a session with a visiting expert in English, check your understanding and capture the know-how for your team in Arabic.',
    summary_ar: 'قد جلسة مع خبير زائر باللغة الإنجليزية، وتحقق من فهمك، ووثّق المعرفة لفريقك بالعربية.',
    setting_en: 'An expert from a partner vendor (synthetic) explains how their team inspects pump seals. You lead the session and will train your own team afterwards.',
    setting_ar: 'يشرح خبير من مورد شريك (افتراضي) كيف يفحص فريقه موانع التسرب في المضخات. تقود الجلسة وستدرّب فريقك بعدها.',
    counterpart_en: 'A visiting vendor expert (role card)', counterpart_ar: 'خبير زائر من المورد (بطاقة دور)', role_en: 'Session lead', role_ar: 'قائد الجلسة',
    rubric: [
      K('goal', 'Sets the goal', 'يحدد الهدف', 'States the goal or agenda of the session.', 'يذكر هدف الجلسة أو جدولها.',
        'Open with what you want to be able to do afterwards.', 'ابدأ بما تريد أن تستطيع فعله بعد الجلسة.', cues(['goal', 'objective', 'agenda', 'today we', 'purpose', 'aim', 'الهدف', 'جدول', 'هدفنا', 'الغرض'])),
      K('needs', 'Says what you need most', 'يذكر ما تحتاجه أكثر', 'Says what the team needs most from the expert.', 'يذكر ما يحتاجه الفريق أكثر من الخبير.',
        'Point the expert at the part that matters to you.', 'وجّه الخبير إلى الجزء الذي يهمك.', cues(['we need', 'we want', 'i would like', 'focus on', 'most useful', 'نحتاج', 'نريد', 'أود', 'نركز'])),
      K('paraphrase', 'Checks by paraphrasing', 'يتحقق بإعادة الصياغة', 'Restates the point in their own words (if I understand, in other words).', 'يعيد صياغة الفكرة بكلماته (إذا فهمت، بمعنى).',
        'Say it back in your words.', 'أعد قولها بكلماتك.', cues(['so you mean', 'if i understand', 'in other words', 'to check', 'so what you are saying', 'let me repeat', 'إذا فهمت', 'بمعنى', 'أي أن', 'دعني أعيد'])),
      QUESTION,
      K('context', 'Relates it to your context', 'يربطها بسياقك', 'Notes how your own plant or procedure differs.', 'يلاحظ كيف تختلف محطتك أو إجراءاتك.',
        'Ask yourself what is different here.', 'اسأل نفسك ما المختلف هنا.', cues(['our plant', 'here', 'our procedure', 'differ*', 'locally', 'في محطتنا', 'لدينا', 'هنا', 'يختلف', 'تختلف'])),
      K('capture', 'Captures the knowledge', 'يوثق المعرفة', 'Says how the knowledge will be written down or recorded.', 'يذكر كيف ستُدوّن المعرفة أو تُسجل.',
        'Agree how it will be captured before the expert leaves.', 'اتفق على طريقة التوثيق قبل مغادرة الخبير.', cues(['write', 'record*', 'capture', 'document*', 'knowledge asset', 'note*', 'نوثق', 'أسجل', 'توثيق', 'سنوثق', 'نسجل'])),
      K('summary', 'Summarises the key points', 'يلخص النقاط الرئيسية', 'Summarises the key points at the end.', 'يلخص النقاط الرئيسية في النهاية.',
        'Close with three key points.', 'اختم بثلاث نقاط رئيسية.', cues(['summary', 'to summarise', 'key points', 'three points', 'in short', 'الخلاصة', 'النقاط الرئيسية', 'باختصار'])),
      K('next', 'Agrees the follow-up', 'يتفق على المتابعة', 'Agrees what happens next (send notes, a next session).', 'يتفق على ما يحدث بعد ذلك (إرسال الملاحظات أو جلسة قادمة).',
        'End with who sends what, and when.', 'اختم بمن يرسل ماذا ومتى.', cues(['next session', 'follow-up', 'follow up', 'send', 'share', 'الجلسة القادمة', 'متابعة', 'سأرسل', 'نشارك'])),
    ],
    turns: [
      T_('open', 'Shall I just start explaining how we inspect the pump seals?', 'هل أبدأ مباشرة في شرح طريقة فحصنا لموانع التسرب؟', 'Set the goal and say what you need.', 'حدد الهدف وقل ما تحتاجه.',
        'Thank you for coming. Before you start, our goal today is to understand your seal inspection method well enough to train our own team. We need most detail on the acceptance limits and the common mistakes.',
        'شكراً لحضورك. قبل أن تبدأ، الهدف اليوم أن نفهم طريقتك في فحص موانع التسرب بما يكفي لتدريب فريقنا. نحتاج إلى أكبر قدر من التفاصيل عن حدود القبول والأخطاء الشائعة.',
        ['goal', 'needs']),
      T_('check', 'So the wear groove is measured at four points, and anything over the limit is rejected. Clear so far?', 'إذن يُقاس أخدود التآكل عند أربع نقاط، ويُرفض كل ما يتجاوز الحد. هل الأمر واضح حتى الآن؟',
        'Paraphrase and check with a question.', 'أعد الصياغة وتحقق بسؤال.',
        'Yes. If I understand correctly, you measure at four points around the face and reject the seal if any single point is over the limit, not the average. Is that right?',
        'نعم. إذا فهمت جيداً، تقيسون عند أربع نقاط حول الوجه وترفضون مانع التسرب إذا تجاوزت أي نقطة واحدة الحد، وليس المتوسط. هل هذا صحيح؟',
        ['paraphrase', 'check_understanding']),
      T_('context', 'That is how we do it at our plant.', 'هكذا نفعل ذلك في محطتنا.', 'Relate it to your own procedure and capture it.', 'اربطه بإجراءاتك ووثّقه.',
        'That is useful. Our procedure here uses a different gauge, so I will note where the steps differ and we will record your method as a knowledge asset for review.',
        'هذا مفيد. يستخدم الإجراء لدينا مقياساً مختلفاً، لذلك سأدوّن مواضع الاختلاف. سنوثق طريقتك أصلاً معرفياً للمراجعة.',
        ['context', 'capture']),
      T_('close', 'Anything else?', 'هل هناك شيء آخر؟', 'Summarise and agree the follow-up.', 'لخّص واتفق على المتابعة.',
        'Let me summarise the key points: four measuring points, reject on any single point, and record the gauge used. I will send the notes to you for checking before our next session.',
        'دعني أذكر النقاط الرئيسية: أربع نقاط قياس، والرفض عند أي نقطة واحدة، وتسجيل المقياس المستخدم. سأرسل الملاحظات إليك للتحقق قبل الجلسة القادمة.',
        ['summary', 'next']),
    ],
  },
  {
    id: 'rp-ai-01', code: 'RP-AI-01', kind: 'ai_peer_coaching', level: 2, pass_pct: 70, est_minutes: 12, status: 'published', sort: 6,
    core_skill_ids: ['cs-digital-judgement', 'cs-developing'], skill_ids: ['sk-fs-ai-verify', 'sk-fs-tr-empathy'],
    title_en: 'Coaching a peer on an AI output', title_ar: 'توجيه زميل بشأن مخرجات ذكاء اصطناعي',
    summary_en: 'A colleague pasted an AI-drafted summary into a report without checking it. Coach them to verify and disclose, without blame.',
    summary_ar: 'ألصق زميل ملخصاً صاغه الذكاء الاصطناعي في تقرير دون التحقق منه. وجّهه إلى التحقق والإفصاح دون لوم.',
    setting_en: 'Your colleague used an approved AI assistant to summarise a year of work orders for a pump and pasted the summary into a quarterly report. You noticed one date that looks wrong.',
    setting_ar: 'استخدم زميلك مساعد ذكاء اصطناعي معتمداً لتلخيص أوامر العمل لمضخة على مدى عام، وألصق الملخص في تقرير ربع سنوي. لاحظت تاريخاً يبدو خاطئاً.',
    counterpart_en: 'A colleague (role card)', counterpart_ar: 'زميل (بطاقة دور)', role_en: 'Peer coach', role_ar: 'زميل موجِّه',
    rubric: [
      K('tone', 'Opens without blame', 'يبدأ دون لوم', 'Acknowledges the effort first (I understand, a good start).', 'يقدّر الجهد أولاً (أتفهم، بداية جيدة).',
        'Start with what was useful.', 'ابدأ بما كان مفيداً.', cues(['i understand', 'good start', 'i see why', 'fair', 'useful', 'أتفهم', 'بداية جيدة', 'مفيد'])),
      K('verify', 'Asks for verification', 'يطلب التحقق', 'Says the output must be checked against the source or original records.', 'يذكر أنه يجب التحقق من المخرجات مقابل المصدر أو السجلات الأصلية.',
        'Name the source to check against.', 'سمِّ المصدر الذي يُتحقق منه.', cues(['verif*', 'check*', 'source*', 'original', 'controlled', 'تحقق', 'نتحقق', 'المصدر', 'الأصلية', 'السجلات'])),
      K('specifics', 'Names what to check', 'يحدد ما يُتحقق منه', 'Names the details to check (dates, numbers, tag numbers, references).', 'يحدد التفاصيل التي يُتحقق منها (التواريخ والأرقام والمراجع).',
        'Point at the details AI gets wrong most.', 'أشر إلى التفاصيل التي يخطئ فيها الذكاء الاصطناعي أكثر.', cues(['dates', 'numbers', 'names', 'tag numbers', 'references', 'figures', 'التواريخ', 'الأرقام', 'المراجع'])),
      K('method', 'Gives a method', 'يقدم طريقة', 'Says how to check (compare, against, side by side, line by line).', 'يذكر طريقة التحقق (قارن، مقابل، سطراً بسطر).',
        'Give a simple method they can repeat.', 'قدّم طريقة بسيطة يمكن تكرارها.', cues(['compare', 'against', 'side by side', 'cross-check', 'line by line', 'قارن', 'نقارن', 'مقابل', 'سطرا بسطر'])),
      K('transparency', 'Asks for disclosure', 'يطلب الإفصاح', 'Says the use of AI should be stated or mentioned.', 'يذكر أنه ينبغي ذكر استخدام الذكاء الاصطناعي أو توضيحه.',
        'Say the report should say an AI tool drafted it.', 'قل إن التقرير يجب أن يذكر أن أداة ذكاء اصطناعي صاغته.', cues(['disclose', 'mention', 'label', 'say that', 'state', 'الإفصاح', 'نذكر', 'اذكر', 'توضيح'])),
      K('policy', 'Points to the guidance', 'يشير إلى الإرشادات', 'Refers to the approved-tool guidance or policy.', 'يشير إلى إرشادات الأدوات المعتمدة أو السياسة.',
        'Point to the guidance, not your opinion.', 'أشر إلى الإرشادات لا إلى رأيك.', cues(['approved', 'policy', 'guidance', 'rule', 'المعتمدة', 'السياسة', 'الإرشادات'])),
      K('plan', 'Agrees a habit for next time', 'يتفق على عادة للمرة القادمة', 'Agrees what to do next time.', 'يتفق على ما يُفعل في المرة القادمة.',
        'End with one habit for next time.', 'اختم بعادة واحدة للمرة القادمة.', cues(['next time', 'from now on', 'in future', 'habit', 'المرة القادمة', 'مستقبلا', 'من الآن'])),
      QUESTION,
    ],
    turns: [
      T_('open', 'The AI tool wrote the summary of the work-order history. It is probably right, is it not?', 'كتبت أداة الذكاء الاصطناعي ملخص سجل أوامر العمل. هو صحيح على الأرجح، أليس كذلك؟',
        'Acknowledge the effort, then ask for verification.', 'قدّر الجهد ثم اطلب التحقق.',
        'I understand, it reads well and it is a good start. But a summary like this has to be checked against the original work orders before it goes into a report.',
        'أتفهم ذلك، فهو مكتوب بشكل جيد وبداية جيدة. لكن ملخصاً كهذا يجب أن نتحقق منه مقابل أوامر العمل الأصلية قبل أن يدخل في تقرير.',
        ['tone', 'verify']),
      T_('what', 'What exactly should I check?', 'ما الذي يجب أن أتحقق منه بالضبط؟', 'The details and a method.', 'التفاصيل والطريقة.',
        'Start with the dates, the tag numbers and the references to procedures: compare each one against the work-order records, side by side.',
        'تحقق أولاً من التواريخ والأرقام ومراجع الإجراءات، ثم قارن كل واحد منها مقابل سجلات أوامر العمل.',
        ['specifics', 'method']),
      T_('disclose', 'Do I have to tell anyone that AI drafted it?', 'هل عليّ أن أخبر أحداً بأن الذكاء الاصطناعي صاغه؟', 'Disclosure, and the guidance behind it.', 'الإفصاح والإرشادات التي تستند إليه.',
        'Yes. The guidance for approved AI tools says we state when a draft came from AI, so mention it in the report and say that you verified it.',
        'نعم. تنص الإرشادات الخاصة بأدوات الذكاء الاصطناعي المعتمدة على أن نذكر متى جاءت المسودة من الذكاء الاصطناعي، فاذكر ذلك في التقرير ووضّح أنك تحققت منها.',
        ['transparency', 'policy']),
      T_('next', 'OK. What would you do next time?', 'حسناً. ماذا ستفعل في المرة القادمة؟', 'One habit, then check they agree.', 'عادة واحدة ثم تأكد من موافقته.',
        'Next time, make the comparison a habit: draft with the tool, then check every number before you share it. Does that work for you?',
        'في المرة القادمة اجعل المقارنة عادة: اكتب المسودة بالأداة ثم تحقق من كل رقم قبل مشاركتها. هل يناسبك ذلك؟',
        ['plan', 'check_understanding']),
    ],
  },
];
// The draft: a second knowledge-transfer scenario (the training manager has not published it yet).
ROLEPLAY.push({
  ...ROLEPLAY.find((s) => s.id === 'rp-kt-01'), id: 'rp-kt-02', code: 'RP-KT-02', status: 'draft', sort: 7, est_minutes: 20,
  title_en: 'Passing on your know-how before a rotation', title_ar: 'نقل خبرتك قبل الانتقال إلى مهمة أخرى',
  summary_en: 'Draft: you are leaving for a rotation; run a session that hands your know-how to the colleague who replaces you.',
  summary_ar: 'مسودة: ستنتقل إلى مهمة أخرى؛ أدر جلسة تنقل فيها خبرتك إلى الزميل الذي سيحل محلك.',
  setting_en: 'You start a six-month rotation next month. Your replacement joins you for a handover session on the inspection routines you run.',
  setting_ar: 'تبدأ الشهر القادم مهمة لمدة ستة أشهر. ينضم إليك من سيحل محلك في جلسة تسليم لروتينات الفحص التي تديرها.',
  counterpart_en: 'Your replacement (role card)', counterpart_ar: 'الزميل البديل (بطاقة دور)',
});
const RP_ALL = ROLEPLAY.map((s) => ({ ...s, listed: s.status === 'published', sources: [SRC.linkedin, SRC.udemy, SRC.iaea], version: 1, updated_by: 'p-training-mgr', updated_at: '2026-09-29T09:00:00Z' }));

// ═══════════════════════════════════════════ simulation (same rules as the server)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const u01 = (s) => (h32(s) % 10000) / 10000;
const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const ts = (d, hh, mm = 0) => `${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
const LAST_DAY = '2026-10-07';
const DEMO_APS = ['p-k-ro', 'p-nse', 'p-qc-inspector', 'p-sro', 'p-outage-planner'];
const DEMO_RP = ['p-k-ro', 'p-nse', 'p-qc-inspector', 'p-sro', 'p-buyer'];
const FRESH = new Set(['p-k-lo-trainee']);

function simulateAps(T) {
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();
  const pub = APS.filter((s) => s.status === 'published');
  const who = staff.filter((id) => !FRESH.has(id) && (DEMO_APS.includes(id) || h32(`aps:${id}`) % 100 < 50));
  const rows = [];
  let n = 0;
  for (const pid of who) {
    const ability = 0.3 + 0.6 * u01(`apsA:${pid}`);
    const runs = pid === 'p-qc-inspector' ? 3 : pid === 'p-k-ro' ? 2 : 1 + (h32(`apsN:${pid}`) % 4);
    const days = Array.from({ length: runs }, (_, k) => h32(`apsD:${pid}:${k}`) % 268).sort((a, b) => a - b);
    const done = new Map();
    for (let k = 0; k < runs; k++) {
      const day = addDays('2026-01-12', days[k]) > LAST_DAY ? LAST_DAY : addDays('2026-01-12', days[k]);
      const attemptNo = rows.filter((r) => r.person_id === pid).length + 1;
      const chosen = h32(`apsC:${pid}:${k}`) % 10 < 3 ? pub[h32(`apsS:${pid}:${k}`) % pub.length].id : null;
      const sid = chosen ?? pickScenario(pub, done, attemptNo, personSeed(pid));
      const sc = APS.find((s) => s.id === sid);
      const learn = Math.min(0.95, ability + 0.12 * k);
      const responses = [];
      for (const [si, st] of sc.stages.entries()) {
        const best = st.options.findIndex((o) => o.eff === 3);
        const r = u01(`apsO:${pid}:${k}:${si}`);
        const choice = r < learn ? best : (best + 1 + (h32(`apsW:${pid}:${k}:${si}`) % (st.options.length - 1))) % st.options.length;
        const picks = st.cues.map((c, ci) => ({ c, ci, ok: u01(`apsP:${pid}:${k}:${si}:${ci}`) < 0.55 + 0.4 * learn })).filter((x) => (x.ok ? x.c.relevant : !x.c.relevant)).map((x) => x.ci);
        responses.push(responseOf(judgeStage(st, choice, picks)));
      }
      const open = (pid === 'p-nse' && k === runs - 1) || (h32(`apsOpen:${pid}`) % 40 === 0 && k === runs - 1);
      const abandoned = !open && h32(`apsAb:${pid}:${k}`) % 37 === 0;
      const id = `aps-a-${String(++n).padStart(4, '0')}`;
      const base = { id, person_id: pid, scenario_id: sid, scenario_version: 1, attempt_no: attemptNo, period: quarterOf(day), stage_ids: sc.stages.map((s) => s.id), started_at: ts(day, 9, h32(id) % 50) };
      if (open || abandoned) {
        rows.push({ ...base, status: open ? 'in_progress' : 'abandoned', responses: responses.slice(0, 1), points: null, max_points: null, score: null, band: null, dims: {}, reasons: [], completed_at: null });
        continue;
      }
      const s = scoreAps(responses);
      rows.push({ ...base, status: 'completed', responses, points: s.points, max_points: s.max_points, score: s.score, band: s.band, dims: s.dims, reasons: s.reasons, completed_at: ts(day, 9, 20 + (h32(id) % 30)) });
      done.set(sid, (done.get(sid) ?? 0) + 1);
    }
  }
  return rows;
}

const sentences = (t) => t.split(/(?<=[.!?؟])\s+/).filter(Boolean);
function answerFor(turn, lang, quality) {
  const parts = sentences(lang === 'ar' ? turn.example_ar : turn.example_en);
  if (quality === 'high' || parts.length === 1) return parts.join(' ');
  if (quality === 'mid') return parts.slice(0, Math.max(1, parts.length - 1)).join(' ');
  return parts[0];
}
const REVIEW_CTX = [
  ['Practised with my supervisor playing the other person during a quiet hour on shift.', 'تدربت مع مشرفي الذي أدى دور الطرف الآخر خلال ساعة هادئة في النوبة.'],
  ['Ran it twice with a colleague; the second run is this one.', 'أجريته مرتين مع زميل، وهذه هي المرة الثانية.'],
  ['Practised before a real turnover this week; my lead observed.', 'تدربت قبل تسليم حقيقي هذا الأسبوع، وراقبني قائد الفريق.'],
];
function simulateRoleplay(T) {
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
  const lang = new Map(staff.map((p) => [p.id, p.language === 'ar' ? 'ar' : 'en']));
  const pub = RP_ALL.filter((s) => s.status === 'published');
  const who = staff.map((p) => p.id).sort().filter((id) => !FRESH.has(id) && (DEMO_RP.includes(id) || h32(`rp:${id}`) % 100 < 42));
  const sessions = [];
  let n = 0;
  const make = (pid, sc, day, quality, opts = {}) => {
    const l = opts.lang ?? lang.get(pid) ?? 'en';
    const id = `rp-s-${String(++n).padStart(4, '0')}`;
    const upto = opts.turns ?? sc.turns.length;
    const turns = sc.turns.slice(0, upto).map((t, i) => {
      const q = typeof quality === 'function' ? quality(i) : quality;
      const text = answerFor(t, l, q);
      if (speakUpTopic(text)) throw new Error(`fs58: seeded answer for ${sc.id}/${t.id} reads as a speak-up topic`);
      return { ...evaluateTurn(t, sc.rubric, text), at: ts(day, 10, 5 + i * 3) };
    });
    const row = {
      id, person_id: pid, scenario_id: sc.id, scenario_version: 1, period: quarterOf(day), status: upto < sc.turns.length ? 'in_progress' : 'completed', turns,
      passed: null, total: null, pct: null, ready: false, reasons: [], started_at: ts(day, 10, 0), completed_at: null, review_status: 'none', reviewer_id: null, review_context: null,
      requested_at: null, reviewed_by: null, reviewed_at: null, review_note: null, level: 0, evidence_ids: [],
    };
    if (row.status === 'completed') {
      const s = summarise(turns, sc.rubric, sc.pass_pct);
      Object.assign(row, { passed: s.passed, total: s.total, pct: s.pct, ready: s.ready, reasons: s.reasons, completed_at: ts(day, 10, 5 + sc.turns.length * 3) });
    }
    sessions.push(row);
    return row;
  };
  const sc = (id) => RP_ALL.find((s) => s.id === id);
  // ── demo personas (fixed stories)
  const krRc = make('p-k-ro', sc('rp-rc-01'), '2026-09-14', 'high', { lang: 'en' });
  make('p-k-ro', sc('rp-pb-01'), '2026-09-30', 'high', { lang: 'en' });
  const nseSt = make('p-nse', sc('rp-st-01'), '2026-10-01', 'high', { lang: 'en' });
  const qcA = make('p-qc-inspector', sc('rp-ai-01'), '2026-08-20', (i) => (i === 3 ? 'low' : 'high'), { lang: 'en' });
  const qcB = make('p-qc-inspector', sc('rp-ai-01'), '2026-09-10', 'high', { lang: 'en' });
  make('p-sro', sc('rp-kt-01'), '2026-09-22', 'low', { lang: 'en' });
  make('p-buyer', sc('rp-pb-01'), '2026-10-06', 'high', { turns: 2, lang: 'en' });
  // ── everyone else
  for (const pid of who.filter((id) => !DEMO_RP.includes(id))) {
    const k = 1 + (h32(`rpN:${pid}`) % 3);
    const ability = u01(`rpA:${pid}`);
    for (let j = 0; j < k; j++) {
      const s = pub[h32(`rpS:${pid}:${j}`) % pub.length];
      const day = addDays('2026-02-02', h32(`rpD:${pid}:${j}`) % 248);
      const qual = (i) => { const r = u01(`rpQ:${pid}:${j}:${i}`) + 0.25 * ability; return r > 0.75 ? 'high' : r > 0.4 ? 'mid' : 'low'; };
      const open = h32(`rpOpen:${pid}:${j}`) % 45 === 0;
      make(pid, s, day > LAST_DAY ? LAST_DAY : day, qual, open ? { turns: 1 + (h32(`rpT:${pid}`) % 2) } : {});
    }
  }
  // ── reviews: named reviewers (instructors, training manager, HR authority), never the person
  const reviewersOf = (pid) => eligibleReviewers(T.people, T.role_assignments, pid);
  const decide = (s, status, reviewer, note) => {
    const done = s.completed_at.slice(0, 10);
    const req = addDays(done, 1) > '2026-10-08' ? '2026-10-08' : addDays(done, 1);
    const rev = addDays(req, 3) > '2026-10-08' ? '2026-10-08' : addDays(req, 3);
    s.review_status = status; s.reviewer_id = reviewer; s.requested_at = ts(req, 8, 30);
    s.review_context = REVIEW_CTX[h32(s.id) % REVIEW_CTX.length][lang.get(s.person_id) === 'ar' ? 1 : 0];
    if (status === 'validated' || status === 'declined') { s.reviewed_by = reviewer; s.reviewed_at = ts(rev, 13, 0); s.review_note = note ?? null; }
  };
  decide(krRc, 'validated', 'p-training-mgr', 'Observed on shift: clear, specific and respectful.');
  decide(nseSt, 'requested', 'p-training-mgr');
  decide(qcA, 'withdrawn', 'p-k-instructor');
  qcA.review_status = 'withdrawn';
  decide(qcB, 'validated', 'p-k-instructor', null);
  const pool = sessions.filter((s) => s.status === 'completed' && s.ready && s.review_status === 'none' && !DEMO_RP.includes(s.person_id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const plan = [...Array(11).fill('validated'), 'requested', 'requested', 'requested', 'declined', 'declined'];
  for (const [i, status] of plan.entries()) {
    const s = pool[(i * 7) % pool.length];
    if (!s || s.review_status !== 'none') continue;
    const rv = reviewersOf(s.person_id);
    const prefer = status === 'requested' ? ['p-training-mgr', 'p-k-instructor', 'p-sq-lead'][i % 3] : rv[h32(`rv:${s.id}`) % rv.length];
    const reviewer = rv.includes(prefer) ? prefer : rv[0];
    decide(s, status, reviewer, status === 'declined' ? 'Please practise once more with an observer before I validate this; the turnover read-back was not confirmed.' : null);
  }
  // ── evidence for validated sessions (FS02 future skills only)
  const skills = new Map(T.skills.map((s) => [s.id, { id: s.id, area: s.area, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const evidence = [];
  const notes = [];
  for (const s of sessions) {
    const scn = sc(s.scenario_id);
    if (s.review_status === 'validated') {
      const lvl = Math.max(1, Math.min(2, scn.level));
      const on = s.reviewed_at.slice(0, 10);
      s.level = lvl;
      for (const sk of evidenceSkills(scn.skill_ids, skills)) {
        const id = evidenceId(s.id, sk);
        evidence.push({ id, person_id: s.person_id, skill_id: sk, kind: 'rating', ref_table: 'roleplay_sessions', ref_id: s.id, level: lvl, basis: 'validated', status: 'current',
          observed_on: on, note: `Validated role-play feedback (${scn.code}, ${s.passed} of ${s.total} criteria)`, recorded_by: s.reviewed_by, active: true, created_at: ts(on, 13, 0) });
        s.evidence_ids.push(id);
      }
      notes.push({ id: `nt-rp-${s.id}-validated`, person_id: s.person_id, kind: 'roleplay', title_en: `Role-play feedback validated: ${scn.title_en}`, title_ar: `اعتُمدت ملاحظات تمرين لعب الأدوار: ${scn.title_ar}`,
        body_en: null, body_ar: null, link: '/my/skills', severity: 'ok', created_at: s.reviewed_at, read_at: null });
    }
    if (s.review_status === 'requested') {
      notes.push({ id: `nt-rp-${s.id}-req-${s.reviewer_id}`, person_id: s.reviewer_id, kind: 'roleplay', title_en: `Role-play feedback to review: ${scn.title_en}`, title_ar: `ملاحظات تمرين لعب أدوار بانتظار مراجعتك: ${scn.title_ar}`,
        body_en: null, body_ar: null, link: '/training/role-play?tab=reviews', severity: 'info', created_at: s.requested_at, read_at: null });
    }
    if (s.review_status === 'declined') {
      notes.push({ id: `nt-rp-${s.id}-declined`, person_id: s.person_id, kind: 'roleplay', title_en: `Role-play feedback not validated yet: ${scn.title_en}`, title_ar: `لم تُعتمد ملاحظات تمرين لعب الأدوار بعد: ${scn.title_ar}`,
        body_en: null, body_ar: null, link: '/my/role-play?tab=history', severity: 'warn', created_at: s.reviewed_at, read_at: null });
    }
  }
  return { sessions, evidence, notes };
}

export default function build() { /* rows are built in finalize (FS02 skills and FS25 core skills are FINALIZE_LAST builders) */ }

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const coreIds = T.core_skills.filter((c) => (c.status ?? 'active') === 'active').map((c) => c.id);
  const skillIds = T.skills.filter((s) => s.lifecycle !== 'obsolete').map((s) => s.id);
  for (const s of APS) {
    const p = apsScenarioProblem(s, { coreSkillIds: coreIds, skillIds });
    if (p) throw new Error(`fs58: scenario ${s.id} fails the bank rule (${p})`);
    if (changeCount(s) < 1) throw new Error(`fs58: scenario ${s.id} has no mid-task change`);
  }
  const skills = new Map(T.skills.map((s) => [s.id, { id: s.id, area: s.area, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const evIds = evidenceSkills([...skills.keys()], skills);
  for (const s of RP_ALL) {
    const p = rpScenarioProblem(s, { coreSkillIds: coreIds, evidenceSkillIds: evIds });
    if (p) throw new Error(`fs59: scenario ${s.id} fails the library rule (${p})`);
    for (const t of s.turns) for (const lang of ['en', 'ar']) {
      const r = evaluateTurn(t, s.rubric, lang === 'ar' ? t.example_ar : t.example_en);
      const miss = r.criteria.filter((c) => !c.pass).map((c) => c.id);
      if (miss.length) throw new Error(`fs59: the ${lang} example of ${s.id}/${t.id} misses ${miss.join(', ')}`);
      if (speakUpTopic(lang === 'ar' ? t.example_ar : t.example_en)) throw new Error(`fs59: the ${lang} example of ${s.id}/${t.id} reads as a speak-up topic`);
    }
  }
  T.aps_scenarios = APS.map((s) => ({ ...s }));
  T.aps_attempts = simulateAps(T);
  T.roleplay_scenarios = RP_ALL;
  const rp = simulateRoleplay(T);
  T.roleplay_sessions = rp.sessions;
  T.notifications = [...T.notifications, ...rp.notes];
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  for (const e of rp.evidence) if (!fsSkills.has(e.skill_id)) throw new Error(`fs59: seeded evidence ${e.id} names ${e.skill_id}, not an FS02 future skill`);
  if (rp.evidence.some((e) => e.level > 2 || e.level < 1)) throw new Error('fs59: evidence outside levels 1-2');
  const before71 = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...rp.evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const people = new Set(rp.evidence.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => people.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = byId.get(s.id);
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before71.has(s.id) && before71.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs59: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests, F23 snapshots and F35 outlooks read the final states: rebuild them the way fs44 does.
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((x) => !oldNotices.has(x.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  let snapshots = 0;
  for (const m of T.alumni ?? []) {
    if (!people.has(m.person_id)) continue;
    const snap = snapshotFrom(T.person_skills.filter((s) => s.person_id === m.person_id), T.skills);
    if (JSON.stringify(snap) !== JSON.stringify(m.skill_snapshot)) { m.skill_snapshot = snap; snapshots++; }
  }
  let outlooksChanged = 0;
  if (T.skill_outlooks?.length) {
    const inp = inputFromTables((t) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = outlookFor(inp, o.params);
      if (r.code !== 'ok') throw new Error(`fs58: outlook ${o.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(o.results)) outlooksChanged++;
      o.params = r.result.params; o.results = r.result;
    }
  }
  const aps = T.aps_attempts;
  const rs = T.roleplay_sessions;
  const by = (xs, k) => xs.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {});
  console.log(`fs58/59: ${APS.filter((s) => s.status === 'published').length} published APS scenarios (+${APS.filter((s) => s.status !== 'published').length} draft), ${aps.length} runs by ${new Set(aps.map((a) => a.person_id)).size} staff ${JSON.stringify(by(aps, 'status'))}; `
    + `${RP_ALL.filter((s) => s.status === 'published').length} published role-play scenarios (+${RP_ALL.filter((s) => s.status !== 'published').length} draft), ${rs.length} sessions by ${new Set(rs.map((s) => s.person_id)).size} staff, reviews ${JSON.stringify(by(rs, 'review_status'))}, `
    + `${rp.evidence.length} evidence rows (level <= 2), ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks recomputed (${outlooksChanged} changed); ${snapshots} F23 snapshots refreshed`);
}
