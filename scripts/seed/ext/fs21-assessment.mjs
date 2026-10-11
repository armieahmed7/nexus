// FS21 + FS22 (future-skills wave C · E3, M05) seed: adaptive future-skills assessment, performance tasks and integrity reports.
// build():    six adaptive banks (AI literacy, plant data, digital twins, cyber hygiene, SMR fundamentals, CleanEnergyComp) with
//             bilingual items calibrated by difficulty (SIMULATED pilot p-values), four scenario performance tasks on SIMULATED
//             plant data with their published rubric and (training-staff-only) answer keys.
// finalize(): FINALIZE_LAST and, by file name, after fs09 (FS10 fitness evidence) and fs13/fs15: simulates adaptive attempts for active
//             staff with the server rules (adaptiveNext, scoreAdaptive in completion order for the percentile norm group), the
//             performance-task attempts (submitted, scored, resubmitted), the integrity reports of every gating attempt
//             (adaptiveIntegrity / taskIntegrity), the F01 `assessment` evidence (ref_tables adaptive_attempts / task_attempts;
//             recorded evidence), re-derives the states of the people concerned and rebuilds the F36 digests, F23 snapshots and
//             F35 outlooks the same way fs09 does. Fails the build if an item fails the item check, a safety-related bank is not
//             criterion-referenced, a gating attempt has no integrity report, or the original 71-skill states change.
// Synthetic people only; plant data is SIMULATED; every benchmark figure on screen comes from a stored, sourced row.
import { decayModelFrom, deriveStates, evidenceId } from '../../../src/domain/skills.ts';
import { adItemProblem, adaptiveNext, formOf, bankIsSafety, normGroup, normText, scoreAdaptive, levelOfDifficulty } from '../../../src/modules/m05/adaptive.ts';
import { adaptiveIntegrity, answerProblem, autoScores, dataIsSynthetic, scoreTask, taskIntegrity } from '../../../src/modules/m05/perf.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const SRC = {
  workera: { label: 'Workera · Skills intelligence platform (adaptive skills assessment)', url: 'https://workera.ai/skills-intelligence-platform' },
  piaac: { label: 'OECD · Survey of Adult Skills (PIAAC), Cycle 2 database', url: 'https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html' },
  ailit: { label: 'European Commission AI Office · Living repository of AI-literacy practices', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices' },
  iaeaai: { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence' },
  nss42: { label: 'IAEA · Computer security for nuclear facilities (NSS 42-G)', url: 'https://www.iaea.org/node/97473' },
  smr: { label: 'ANS Nuclear Newswire · Education and training to support the Canadian nuclear workforce (BWRX-300)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/' },
  greencomp: { label: 'European Commission JRC · GreenComp, the European sustainability competence framework', url: 'https://joint-research-centre.ec.europa.eu/greencomp' },
  techwolf: { label: 'TechWolf · Workday customer story (skills-based assessment)', url: 'https://www.techwolf.ai/customer-stories/workday' },
};

// ───────────── Banks
// [id, code, en, ar, summary_en, summary_ar, fs_area, skills, safety_related, mode, cut, gates, benchmarks, sources]
const BANKS = [
  ['ab-ai-literacy', 'AD-AI-LIT', 'AI literacy', 'الإلمام بالذكاء الاصطناعي',
    'Using approved AI tools well, checking and challenging what they produce, and knowing what data may go into them. Developmental: you see where you stand among colleagues.',
    'استخدام أدوات الذكاء الاصطناعي المعتمدة جيداً، والتحقق من مخرجاتها والاعتراض عليها، ومعرفة البيانات التي يجوز إدخالها. تطويري: ترى موقعك بين زملائك.',
    'ai_data', ['sk-fs-ai-use', 'sk-fs-ai-verify', 'sk-fs-ai-prompt', 'sk-fs-ai-data-care'], false, 'normative', 2, ['MC-AI-LIT'], ['SKILLS-TECH', 'OECD-PIAAC', 'AI-LIT'], ['workera', 'piaac', 'ailit']],
  ['ab-plant-data', 'AD-PLANT-DATA', 'Plant data literacy', 'الإلمام ببيانات المحطة',
    'Judging whether plant data is fit for a decision: quality flags, trends, noise and simple statistics. Developmental.',
    'الحكم على صلاحية بيانات المحطة لاتخاذ القرار: مؤشرات الجودة والاتجاهات والضوضاء والإحصاءات البسيطة. تطويري.',
    'ai_data', ['sk-fs-ai-plantdata', 'sk-fs-tr-analytical'], false, 'normative', 2, [], ['SKILLS-TECH', 'OECD-PIAAC'], ['workera', 'piaac']],
  ['ab-digital-twins', 'AD-TWINS', 'Digital twins and AI alerts', 'التوائم الرقمية وتنبيهات الذكاء الاصطناعي',
    'Validating a digital twin against the plant and triaging AI anomaly alerts with independent indications. Developmental.',
    'التحقق من التوأم الرقمي مقابل المحطة وفرز تنبيهات الشذوذ من الذكاء الاصطناعي بمؤشرات مستقلة. تطويري.',
    'ai_data', ['sk-fs-ai-twin', 'sk-fs-ai-anomaly'], false, 'normative', 2, ['MC-TWINS'], ['SKILLS-TECH', 'OECD-PIAAC', 'IAEA-AI'], ['workera', 'iaeaai']],
  ['ab-cyber-hygiene', 'AD-CYBER', 'Cyber hygiene for everyone', 'النظافة السيبرانية للجميع',
    'Awareness for all staff: suspicious messages, removable media, passwords and reporting. Safety-related: the result says whether you meet the standard, never a percentile.',
    'وعي لجميع الموظفين: الرسائل المريبة والوسائط القابلة للإزالة وكلمات المرور والإبلاغ. مرتبط بالسلامة: تقول النتيجة إن كنت تستوفي المعيار، ولا تُظهر نسبة مئوية أبداً.',
    'cyber_hygiene', ['sk-fs-cy-phishing', 'sk-fs-cy-media', 'sk-fs-cy-access', 'sk-fs-cy-report'], true, 'criterion', 2, [], ['SKILLS-TECH', 'OT-CYBER'], ['workera', 'nss42']],
  ['ab-smr', 'AD-SMR', 'SMR fundamentals', 'أساسيات المفاعلات المعيارية الصغيرة',
    'Concepts of small modular reactors and passive safety, for orientation only: no deployment decision is implied. Safety-related: meets the standard or not.',
    'مفاهيم المفاعلات المعيارية الصغيرة والسلامة الذاتية، للتعريف فقط: لا يُستنتج أي قرار بالنشر. مرتبط بالسلامة: يستوفي المعيار أو لا.',
    'advanced_reactor', ['sk-fs-adv-smr', 'sk-fs-adv-passive'], true, 'criterion', 2, [], ['SKILLS-TECH', 'SMR-WF'], ['workera', 'smr']],
  ['ab-clean-energy', 'AD-CEC', 'CleanEnergyComp foundations', 'أسس كفاءات الطاقة النظيفة',
    'Lifecycle carbon, greenhouse-gas accounting basics and honest disclosure, written with the GreenComp method. Developmental.',
    'الكربون عبر دورة الحياة، وأساسيات محاسبة غازات الدفيئة، والإفصاح الأمين، وفق منهجية GreenComp. تطويري.',
    'green_energy', ['sk-fs-gr-lifecycle', 'sk-fs-gr-ghg', 'sk-fs-gr-esg'], false, 'normative', 2, [], ['SKILLS-TECH', 'GREENCOMP'], ['workera', 'greencomp']],
];

// ───────────── Items: [level, facet, skill, offset, stem_en, options_en (first is right), explain_en, stem_ar, options_ar, explain_ar]
const ITEMS = {
  'ab-ai-literacy': [
    [1, 'use', 'sk-fs-ai-use', 0.15, 'Which of these is a good first use of the approved AI assistant?', ['Drafting a first version of a routine email', 'Approving a work permit', 'Deciding whether a pump is operable'], 'Low-risk drafting suits assistants; decisions stay with qualified people.',
      'أيٌّ مما يلي استخدام أول مناسب لمساعد الذكاء الاصطناعي المعتمد؟', ['صياغة مسودة أولى لبريد إلكتروني روتيني', 'اعتماد تصريح عمل', 'تقرير ما إذا كانت مضخة صالحة للتشغيل'], 'الصياغة منخفضة المخاطر تناسب المساعدات؛ أما القرارات فتبقى للأشخاص المؤهلين.'],
    [1, 'data', 'sk-fs-ai-data-care', 0.3, 'What may you paste into a public chatbot that ENEC has not approved?', ['Nothing from work: work content goes only into approved tools', 'A shift log once the names are removed', 'Procedure text marked internal'], 'Unapproved tools may keep and reuse what you type.',
      'ما الذي يجوز لصقه في روبوت محادثة عام لم تعتمده المؤسسة؟', ['لا شيء من العمل: محتوى العمل يُدخل في الأدوات المعتمدة فقط', 'سجل المناوبة بعد حذف الأسماء', 'نص إجراء مصنّف داخلياً'], 'قد تحتفظ الأدوات غير المعتمدة بما تكتبه وتعيد استخدامه.'],
    [1, 'verify', 'sk-fs-ai-verify', 0.5, 'An AI summary of a procedure leaves out a hold point. What do you do?', ['Go back to the approved procedure and report the gap', 'Follow the summary because it is shorter', 'Add the hold point from memory'], 'The approved procedure governs; summaries are aids.',
      'ملخص بالذكاء الاصطناعي لإجراء ما أغفل نقطة توقف. ماذا تفعل؟', ['أعود إلى الإجراء المعتمد وأبلغ عن النقص', 'أتبع الملخص لأنه أقصر', 'أضيف نقطة التوقف من الذاكرة'], 'الإجراء المعتمد هو المرجع؛ والملخصات وسائل مساعدة.'],
    [1, 'use', 'sk-fs-ai-prompt', 0.7, 'Which request to an AI assistant is clearest?', ['Summarise this four-page report in five bullet points for a shift briefing', 'Tell me about the report', 'Make it better'], 'Say the task, the length and the audience.',
      'أي طلب إلى مساعد الذكاء الاصطناعي هو الأوضح؟', ['لخّص هذا التقرير المكوّن من أربع صفحات في خمس نقاط لإحاطة المناوبة', 'أخبرني عن التقرير', 'اجعله أفضل'], 'حدّد المهمة والطول والجمهور.'],
    [1, 'verify', 'sk-fs-ai-verify', 0.85, 'Who is accountable for a document you drafted with AI help?', ['You, the author who checked and issued it', 'The AI tool vendor', 'Nobody, because the AI wrote it'], 'A person stays accountable for anything issued.',
      'من المسؤول عن وثيقة صغتها بمساعدة الذكاء الاصطناعي؟', ['أنت، المؤلف الذي راجعها وأصدرها', 'مورّد أداة الذكاء الاصطناعي', 'لا أحد، لأن الذكاء الاصطناعي كتبها'], 'يبقى الإنسان مسؤولاً عن كل ما يُصدر.'],
    [2, 'verify', 'sk-fs-ai-verify', 0.2, 'An AI tool gives a figure with no source. What is the best next step?', ['Find the source and check the figure against it', 'Use it; the tool is usually right', 'Round it and use it'], 'Unsourced figures are checked before use.',
      'أعطت أداة ذكاء اصطناعي رقماً بلا مصدر. ما أفضل خطوة تالية؟', ['أبحث عن المصدر وأتحقق من الرقم مقابله', 'أستخدمه؛ فالأداة محقة عادة', 'أقرّبه وأستخدمه'], 'الأرقام بلا مصدر تُراجع قبل الاستخدام.'],
    [2, 'data', 'sk-fs-ai-data-care', 0.35, 'A colleague wants to upload a spreadsheet of staff training records to an AI tool. What do you check first?', ['Whether the tool is approved for personal data and the upload is needed at all', 'Whether the file is under 10 MB', 'Whether the colleague is senior'], 'Personal data needs an approved tool and a real need.',
      'يريد زميل رفع جدول سجلات تدريب الموظفين إلى أداة ذكاء اصطناعي. ما الذي تتحقق منه أولاً؟', ['هل الأداة معتمدة للبيانات الشخصية وهل الرفع ضروري أصلاً', 'هل حجم الملف أقل من 10 ميغابايت', 'هل الزميل في منصب رفيع'], 'البيانات الشخصية تحتاج أداة معتمدة وحاجة حقيقية.'],
    [2, 'use', 'sk-fs-ai-prompt', 0.5, 'The AI answer mixes up two systems. How should you ask again?', ['Name the system, give the context and ask it to state its assumptions', 'Repeat the same question', 'Ask for a longer answer'], 'Context and stated assumptions make errors visible.',
      'خلطت إجابة الذكاء الاصطناعي بين نظامين. كيف تعيد السؤال؟', ['أسمّي النظام وأعطي السياق وأطلب منه ذكر افتراضاته', 'أكرر السؤال نفسه', 'أطلب إجابة أطول'], 'السياق والافتراضات المعلنة تكشف الأخطاء.'],
    [2, 'verify', 'sk-fs-ai-verify', 0.65, 'An AI translation of a work instruction into Arabic reads well. Before use you should…', ['Have a qualified bilingual reviewer check the technical terms against the source', 'Publish it because it reads well', 'Check only the first paragraph'], 'Fluent is not the same as correct for technical terms.',
      'ترجمة بالذكاء الاصطناعي لتعليمات عمل إلى العربية تبدو سليمة. قبل استخدامها عليك أن…', ['يراجع مختص ثنائي اللغة مؤهل المصطلحات الفنية مقابل الأصل', 'أنشرها لأنها تبدو سليمة', 'أراجع الفقرة الأولى فقط'], 'السلاسة لا تعني الدقة في المصطلحات الفنية.'],
    [2, 'use', 'sk-fs-ai-use', 0.8, 'When must AI-assisted content be labelled as such in your team?', ['Whenever the team\'s approved-use rules say so, for example in shared documents', 'Never', 'Only if it contains errors'], 'Follow the approved-use rules for labelling.',
      'متى يجب وسم المحتوى المُعدّ بمساعدة الذكاء الاصطناعي في فريقك؟', ['كلما نصّت قواعد الاستخدام المعتمدة للفريق على ذلك، مثلاً في الوثائق المشتركة', 'أبداً', 'فقط إذا احتوى على أخطاء'], 'اتبع قواعد الاستخدام المعتمدة في الوسم.'],
    [3, 'verify', 'sk-fs-ai-verify', 0.2, 'An AI tool ranks three maintenance work orders by risk and one ranking surprises you. What is the most useful check?', ['Compare its inputs for that order with the actual equipment history', 'Accept it because the model is trained', 'Ask it to rank again until it matches your view'], 'Check the inputs behind a surprising output.',
      'رتّبت أداة ذكاء اصطناعي ثلاثة أوامر صيانة حسب الخطورة وفاجأك أحد الترتيبات. ما أنفع تحقق؟', ['أقارن مدخلاتها لذلك الأمر بتاريخ المعدة الفعلي', 'أقبله لأن النموذج مدرَّب', 'أطلب الترتيب مجدداً حتى يوافق رأيي'], 'تحقق من المدخلات وراء المخرج المفاجئ.'],
    [3, 'data', 'sk-fs-ai-data-care', 0.35, 'Which data set is least suitable for building a team\'s AI helper?', ['Unreviewed draft procedures with known errors', 'Approved, current procedures', 'Published glossary terms'], 'Errors in the source become errors in the answers.',
      'أي مجموعة بيانات هي الأقل ملاءمة لبناء مساعد ذكاء اصطناعي للفريق؟', ['مسودات إجراءات غير مراجعة فيها أخطاء معروفة', 'إجراءات معتمدة وسارية', 'مصطلحات مسرد منشورة'], 'أخطاء المصدر تصبح أخطاء في الإجابات.'],
    [3, 'verify', 'sk-fs-ai-verify', 0.5, 'An assistant confidently cites a standard clause you cannot find. This is most likely…', ['A made-up reference that must not be used', 'A clause from a newer edition you should trust', 'Proof that the standard is out of date'], 'Assistants can invent references; verify before use.',
      'استشهد مساعد بثقة ببند من معيار لا تجده. الأرجح أن هذا…', ['مرجع مختلق لا يجوز استخدامه', 'بند من إصدار أحدث يجب الوثوق به', 'دليل على أن المعيار قديم'], 'قد تختلق المساعدات مراجع؛ تحقّق قبل الاستخدام.'],
    [3, 'use', 'sk-fs-ai-prompt', 0.65, 'To reduce errors when asking AI to compare two documents, you should…', ['Give both texts, ask for the differences quoted line by line, then check them', 'Ask for an overall opinion', 'Ask it to decide which one is right'], 'Quoted differences can be checked; opinions cannot.',
      'لتقليل الأخطاء عند طلب مقارنة وثيقتين من الذكاء الاصطناعي، عليك أن…', ['أعطي النصين وأطلب الفروق مقتبسة سطراً بسطر ثم أتحقق منها', 'أطلب رأياً عاماً', 'أطلب منه أن يقرر أيهما الصحيح'], 'الفروق المقتبسة يمكن التحقق منها؛ الآراء لا.'],
    [3, 'data', 'sk-fs-ai-data-care', 0.8, 'A supplier offers a free AI note-taker for meetings. Before use…', ['Check approval, where recordings are stored and who can reach them', 'Install it because it is free', 'Use it only for short meetings'], 'Recordings are data: approval and storage come first.',
      'يعرض مورّد أداة مجانية لتدوين الاجتماعات بالذكاء الاصطناعي. قبل الاستخدام…', ['أتحقق من الاعتماد ومكان حفظ التسجيلات ومن يمكنه الوصول إليها', 'أثبّتها لأنها مجانية', 'أستخدمها للاجتماعات القصيرة فقط'], 'التسجيلات بيانات: الاعتماد والتخزين أولاً.'],
    [4, 'verify', 'sk-fs-ai-verify', 0.15, 'A model was 95% accurate on its test data. Why might it still be unsafe to rely on for a rare plant event?', ['Rare events may be missing from the data it was tested on', 'Because 95% is always enough', 'Because accuracy can never change'], 'Test data rarely covers rare events.',
      'كانت دقة نموذج 95% على بيانات الاختبار. لماذا قد يظل الاعتماد عليه غير آمن في حدث نادر بالمحطة؟', ['قد تغيب الأحداث النادرة عن البيانات التي اختُبر عليها', 'لأن 95% كافية دائماً', 'لأن الدقة لا تتغير أبداً'], 'نادراً ما تغطي بيانات الاختبار الأحداث النادرة.'],
    [4, 'verify', 'sk-fs-ai-verify', 0.3, 'How should a team keep a person in charge of an AI-assisted review process?', ['Define review and stop points where a qualified person checks and can override', 'Let the AI approve low-value items silently', 'Review only when users complain'], 'Review and stop points keep people in charge.',
      'كيف يُبقي الفريق إنساناً مسؤولاً عن عملية مراجعة يساعدها الذكاء الاصطناعي؟', ['بتحديد نقاط مراجعة وإيقاف يتحقق فيها شخص مؤهل ويمكنه التجاوز', 'بترك الذكاء الاصطناعي يعتمد البنود منخفضة القيمة دون إشعار', 'بالمراجعة فقط عند شكوى المستخدمين'], 'نقاط المراجعة والإيقاف تُبقي الإنسان مسؤولاً.'],
    [4, 'data', 'sk-fs-ai-data-care', 0.5, 'Model outputs drift after a software update in the data feed. The best control is…', ['Monitor outputs against a reference set and re-validate after changes', 'Restart the tool', 'Ignore drift under 10%'], 'Changes in inputs need re-validation.',
      'انحرفت مخرجات نموذج بعد تحديث برمجي في تغذية البيانات. أفضل ضابط هو…', ['مراقبة المخرجات مقابل مجموعة مرجعية وإعادة التحقق بعد التغييرات', 'إعادة تشغيل الأداة', 'تجاهل الانحراف دون 10%'], 'تغيّر المدخلات يتطلب إعادة التحقق.'],
    [4, 'use', 'sk-fs-ai-use', 0.65, 'Which sign shows an AI use case is ready to grow beyond a pilot?', ['Measured benefits, known limits, an owner and a review process', 'Users like it', 'It was cheap'], 'Scale what is measured, owned and reviewed.',
      'أي علامة تُظهر أن حالة استخدام للذكاء الاصطناعي جاهزة للتوسع بعد التجربة؟', ['فوائد مقيسة وحدود معروفة ومالك وعملية مراجعة', 'إعجاب المستخدمين بها', 'أنها كانت رخيصة'], 'وسّع ما هو مقيس وله مالك ويُراجع.'],
    [4, 'verify', 'sk-fs-ai-verify', 0.85, 'In a challenge meeting an engineer disagrees with an AI recommendation but cannot yet prove it wrong. The right response is…', ['Record the challenge, pause reliance on the output and investigate', 'Follow the AI because data beats opinion', 'Ask the engineer to drop it'], 'A recorded challenge pauses reliance until resolved.',
      'في اجتماع مراجعة يخالف مهندس توصية من الذكاء الاصطناعي لكنه لا يستطيع إثبات خطئها بعد. الاستجابة الصحيحة هي…', ['تسجيل الاعتراض وتعليق الاعتماد على المخرج والتحقيق', 'اتباع الذكاء الاصطناعي لأن البيانات تغلب الرأي', 'الطلب من المهندس التخلي عن اعتراضه'], 'الاعتراض المسجّل يعلّق الاعتماد حتى يُحسم.'],
  ],
  'ab-plant-data': [
    [1, 'quality', 'sk-fs-ai-plantdata', 0.2, 'A reading shows a "bad quality" flag. What does that tell you?', ['The value may not be trustworthy and needs checking', 'The equipment has failed', 'The value is exact'], 'Quality flags describe the data, not the equipment.',
      'تظهر قراءة بعلامة "جودة رديئة". ماذا يعني ذلك؟', ['قد لا تكون القيمة موثوقة وتحتاج إلى تحقق', 'أن المعدة تعطلت', 'أن القيمة دقيقة'], 'علامات الجودة تصف البيانات لا المعدة.'],
    [1, 'trends', 'sk-fs-ai-plantdata', 0.45, 'Two redundant channels measure the same flow. One moves and the other does not. First thought?', ['One channel may be faulty; compare with other indications', 'The flow has changed', 'Average them'], 'Disagreeing redundant channels point to an instrument question first.',
      'قناتان احتياطيتان تقيسان التدفق نفسه. تتغير إحداهما ولا تتغير الأخرى. ما أول ما تفكر فيه؟', ['قد تكون إحدى القناتين معيبة؛ أقارن بمؤشرات أخرى', 'أن التدفق تغيّر', 'آخذ متوسطهما'], 'اختلاف القنوات الاحتياطية يشير أولاً إلى مسألة في الأداة.'],
    [1, 'stats', 'sk-fs-tr-analytical', 0.6, 'A temperature trend wobbles by ±0.1 °C around a steady value. This is most likely…', ['Normal measurement noise', 'A developing fault', 'A data loss'], 'Small random wobble around a steady value is noise.',
      'يتذبذب اتجاه درجة حرارة بمقدار ±0.1 درجة حول قيمة ثابتة. الأرجح أن هذا…', ['ضوضاء قياس طبيعية', 'عطل في طور النشوء', 'فقدان بيانات'], 'التذبذب العشوائي الصغير حول قيمة ثابتة ضوضاء.'],
    [1, 'quality', 'sk-fs-ai-plantdata', 0.8, 'A trend shows a perfectly flat line for six hours on a normally noisy signal. What might it mean?', ['The value may be frozen or not updating', 'The process is perfectly stable', 'The sensor was upgraded'], 'A flat line on a noisy signal often means stale data.',
      'يُظهر اتجاه خطاً مستوياً تماماً لست ساعات لإشارة عادة ما تكون متذبذبة. ماذا قد يعني ذلك؟', ['قد تكون القيمة مجمّدة أو لا تتحدث', 'أن العملية مستقرة تماماً', 'أن المستشعر رُقّي'], 'الخط المستوي لإشارة متذبذبة يعني غالباً بيانات قديمة.'],
    [2, 'stats', 'sk-fs-tr-analytical', 0.25, 'Which summary best describes a signal with one large spike among 100 steady readings?', ['The median, because the spike barely moves it', 'The mean, because it uses every value', 'The maximum'], 'The median resists single outliers.',
      'أي ملخص يصف أفضل إشارة فيها قفزة كبيرة واحدة بين 100 قراءة ثابتة؟', ['الوسيط، لأن القفزة بالكاد تحركه', 'المتوسط، لأنه يستخدم كل القيم', 'القيمة القصوى'], 'الوسيط يقاوم القيم الشاذة المنفردة.'],
    [2, 'trends', 'sk-fs-ai-plantdata', 0.4, 'A slow drift appears on one channel after a calibration. What is the most useful next check?', ['The calibration record and the agreement with redundant channels', 'The weather forecast', 'Nothing until it alarms'], 'Drift after calibration points to the calibration.',
      'ظهر انحراف بطيء في قناة بعد معايرتها. ما أنفع تحقق تالٍ؟', ['سجل المعايرة ومدى التوافق مع القنوات الاحتياطية', 'توقعات الطقس', 'لا شيء حتى يطلق إنذاراً'], 'الانحراف بعد المعايرة يشير إلى المعايرة.'],
    [2, 'quality', 'sk-fs-ai-plantdata', 0.55, 'Data from two systems disagree on the time of an event by exactly one hour. Likely cause?', ['A time-zone or clock setting difference', 'A real second event', 'A broken sensor'], 'Exact offsets often come from clocks, not the plant.',
      'تختلف بيانات نظامين في توقيت حدث بساعة واحدة بالضبط. ما السبب المرجح؟', ['اختلاف في المنطقة الزمنية أو ضبط الساعة', 'حدث ثانٍ حقيقي', 'مستشعر معطل'], 'الإزاحات الدقيقة تأتي غالباً من الساعات لا من المحطة.'],
    [2, 'stats', 'sk-fs-tr-analytical', 0.75, 'A chart\'s vertical axis starts at 99.5% instead of 0%. What should you keep in mind?', ['Small changes look large; read the actual values', 'The data is wrong', 'Nothing changes'], 'Truncated axes exaggerate change.',
      'يبدأ المحور الرأسي لرسم بياني عند 99.5% بدلاً من 0%. ما الذي يجب تذكره؟', ['التغيرات الصغيرة تبدو كبيرة؛ اقرأ القيم الفعلية', 'أن البيانات خاطئة', 'لا شيء يتغير'], 'المحاور المقتطعة تضخّم التغيّر.'],
    [3, 'trends', 'sk-fs-ai-plantdata', 0.2, 'A step change appears on all three redundant channels at the same moment. This points to…', ['A real process change (or a shared cause upstream of the channels)', 'Three independent sensor faults', 'Display rounding'], 'Common-mode changes are usually real or share a cause.',
      'ظهر تغيّر مفاجئ في القنوات الاحتياطية الثلاث في اللحظة نفسها. يشير هذا إلى…', ['تغيّر حقيقي في العملية (أو سبب مشترك قبل القنوات)', 'ثلاثة أعطال مستقلة في المستشعرات', 'تقريب في العرض'], 'التغيرات المشتركة حقيقية عادة أو لها سبب مشترك.'],
    [3, 'quality', 'sk-fs-ai-plantdata', 0.4, 'A data set for a performance review is missing every night shift. What is the main risk?', ['Bias: night conditions are not represented in the conclusions', 'The file is smaller', 'No risk if the mean is used'], 'Missing groups bias results, whatever the statistic.',
      'تنقص مجموعةَ بيانات لمراجعة أداء كلُّ المناوبات الليلية. ما الخطر الرئيسي؟', ['التحيز: ظروف الليل غير ممثلة في الاستنتاجات', 'أن الملف أصغر', 'لا خطر إذا استُخدم المتوسط'], 'غياب فئات يحيّز النتائج أياً كان المقياس.'],
    [3, 'stats', 'sk-fs-tr-analytical', 0.6, 'Two parameters rise together over a month. What can you conclude?', ['They are correlated; cause needs other evidence', 'One causes the other', 'Both sensors are faulty'], 'Correlation alone does not show cause.',
      'ارتفع معاملان معاً خلال شهر. ماذا تستنتج؟', ['أنهما مترابطان؛ والسببية تحتاج دليلاً آخر', 'أن أحدهما يسبب الآخر', 'أن المستشعرين معيبان'], 'الارتباط وحده لا يثبت السببية.'],
    [3, 'trends', 'sk-fs-ai-plantdata', 0.8, 'A signal\'s noise band doubles while its average stays the same. Worth noting because…', ['Rising noise can be an early sign of instrument or equipment degradation', 'Averages are all that matter', 'Noise is always harmless'], 'Changes in variability can precede faults.',
      'تضاعف نطاق الضوضاء في إشارة مع بقاء متوسطها ثابتاً. يستحق ذلك الانتباه لأن…', ['ازدياد الضوضاء قد يكون علامة مبكرة على تدهور الأداة أو المعدة', 'المتوسطات وحدها هي المهمة', 'الضوضاء غير ضارة دائماً'], 'تغيّر التباين قد يسبق الأعطال.'],
    [4, 'stats', 'sk-fs-tr-analytical', 0.2, 'An alarm threshold is set at mean + 3 standard deviations of normal data. What does that imply?', ['Rare false alarms, but slow drifts may go unnoticed for a long time', 'No false alarms ever', 'It catches every drift early'], 'Fixed thresholds trade false alarms against late detection.',
      'ضُبط حد الإنذار عند المتوسط زائد 3 انحرافات معيارية للبيانات الطبيعية. ماذا يعني ذلك؟', ['إنذارات كاذبة نادرة، لكن الانحرافات البطيئة قد تمر طويلاً دون ملاحظة', 'لا إنذارات كاذبة أبداً', 'أنه يكشف كل انحراف مبكراً'], 'الحدود الثابتة تقايض الإنذارات الكاذبة بالكشف المتأخر.'],
    [4, 'quality', 'sk-fs-ai-plantdata', 0.4, 'Data from a replaced sensor are merged with the old sensor\'s history. What must be recorded?', ['The change point, so analyses can treat the two periods separately', 'Nothing, the tag name is the same', 'Only the new sensor\'s serial number in a private note'], 'Instrument changes break comparability unless marked.',
      'دُمجت بيانات مستشعر بديل مع تاريخ المستشعر القديم. ما الذي يجب تسجيله؟', ['نقطة التغيير، ليتمكن التحليل من معاملة الفترتين بشكل منفصل', 'لا شيء، فاسم الوسم نفسه', 'الرقم التسلسلي للمستشعر الجديد في ملاحظة خاصة فقط'], 'تغيير الأدوات يكسر قابلية المقارنة ما لم يُعلَّم.'],
    [4, 'trends', 'sk-fs-ai-plantdata', 0.6, 'A seasonal pattern hides a slow upward drift in a cooling parameter. Best way to see the drift?', ['Compare with the same season last year or remove the seasonal pattern first', 'Look at a single day', 'Use a wider chart'], 'Remove known patterns to expose the trend.',
      'نمط موسمي يخفي انحرافاً تصاعدياً بطيئاً في معامل تبريد. ما أفضل طريقة لرؤية الانحراف؟', ['المقارنة بالموسم نفسه من العام الماضي أو إزالة النمط الموسمي أولاً', 'النظر إلى يوم واحد', 'استخدام رسم أعرض'], 'أزل الأنماط المعروفة لكشف الاتجاه.'],
    [4, 'stats', 'sk-fs-tr-analytical', 0.8, 'Ten checks each have a 5% chance of a false alarm. Roughly how likely is at least one false alarm in a run?', ['About 40%', 'About 5%', 'About 0.5%'], '1 − 0.95^10 is about 0.40.',
      'لكل من عشرة فحوص احتمال 5% لإنذار كاذب. ما احتمال وقوع إنذار كاذب واحد على الأقل في الدورة تقريباً؟', ['نحو 40%', 'نحو 5%', 'نحو 0.5%'], '1 − 0.95 أس 10 يساوي نحو 0.40.'],
  ],
  'ab-digital-twins': [
    [1, 'validation', 'sk-fs-ai-twin', 0.25, 'What is a digital twin in a plant context?', ['A model that mirrors equipment behaviour using plant data', 'A spare part kept in stores', 'A copy of the control room'], 'A twin is a data-driven model of real equipment.',
      'ما التوأم الرقمي في سياق المحطة؟', ['نموذج يحاكي سلوك المعدات باستخدام بيانات المحطة', 'قطعة غيار محفوظة في المخازن', 'نسخة من غرفة التحكم'], 'التوأم نموذج قائم على البيانات لمعدات حقيقية.'],
    [1, 'anomaly', 'sk-fs-ai-anomaly', 0.45, 'An AI tool raises an anomaly alert on a pump. What is the first step?', ['Look for independent indications before acting', 'Stop the pump at once', 'Dismiss it'], 'Alerts are prompts to check, not verdicts.',
      'أطلقت أداة ذكاء اصطناعي تنبيه شذوذ على مضخة. ما الخطوة الأولى؟', ['البحث عن مؤشرات مستقلة قبل التصرف', 'إيقاف المضخة فوراً', 'تجاهله'], 'التنبيهات دعوات للتحقق لا أحكام.'],
    [1, 'validation', 'sk-fs-ai-twin', 0.65, 'The twin and the plant disagree. Which is the reference?', ['The plant, measured with checked instruments', 'The twin', 'Whichever looks better'], 'Models are checked against reality, not the other way.',
      'يختلف التوأم عن المحطة. أيهما المرجع؟', ['المحطة، مقيسة بأدوات تم التحقق منها', 'التوأم', 'أيهما يبدو أفضل'], 'تُراجع النماذج مقابل الواقع لا العكس.'],
    [1, 'anomaly', 'sk-fs-ai-anomaly', 0.85, 'Most alerts on a new AI tool turn out to be false. What should happen?', ['Report it so the tool can be tuned; keep checking each alert meanwhile', 'Ignore all its alerts', 'Switch it off yourself'], 'Feed false alerts back; never stop checking.',
      'تبيّن أن معظم تنبيهات أداة ذكاء اصطناعي جديدة كاذبة. ما الذي يجب أن يحدث؟', ['الإبلاغ لضبط الأداة مع الاستمرار في فحص كل تنبيه', 'تجاهل جميع تنبيهاتها', 'إيقافها بنفسك'], 'أبلغ عن التنبيهات الكاذبة ولا تتوقف عن التحقق.'],
    [2, 'validation', 'sk-fs-ai-twin', 0.2, 'A twin matched the plant well for a year and now drifts after an outage. Likely reason?', ['Equipment or configuration changed during the outage and the model was not updated', 'The twin got tired', 'Data became more accurate'], 'Plant changes must reach the model.',
      'طابق توأم المحطة جيداً لعام ثم بدأ ينحرف بعد توقف للصيانة. ما السبب المرجح؟', ['تغيّرت معدات أو إعدادات أثناء التوقف ولم يُحدَّث النموذج', 'أن التوأم أُرهق', 'أن البيانات أصبحت أدق'], 'تغييرات المحطة يجب أن تصل إلى النموذج.'],
    [2, 'anomaly', 'sk-fs-ai-anomaly', 0.4, 'An alert comes from one reading that jumped and returned at once. Most likely?', ['A data glitch; check the signal quality and neighbouring readings', 'A major failure', 'A real but harmless event'], 'Single-point spikes are often data glitches.',
      'جاء تنبيه من قراءة واحدة قفزت ثم عادت فوراً. ما الأرجح؟', ['خلل في البيانات؛ أتحقق من جودة الإشارة والقراءات المجاورة', 'عطل كبير', 'حدث حقيقي لكنه غير ضار'], 'القفزات في نقطة واحدة غالباً خلل في البيانات.'],
    [2, 'validation', 'sk-fs-ai-twin', 0.6, 'How is a twin validated before it is trusted for a new use?', ['Compare its predictions with measured data over the conditions of that use', 'Ask the vendor', 'Check the graphics'], 'Validation is use-specific comparison with reality.',
      'كيف يُتحقق من توأم قبل الوثوق به في استخدام جديد؟', ['بمقارنة تنبؤاته بالبيانات المقيسة ضمن ظروف ذلك الاستخدام', 'بسؤال المورّد', 'بفحص الرسوم'], 'التحقق مقارنة بالواقع خاصة بكل استخدام.'],
    [2, 'anomaly', 'sk-fs-ai-anomaly', 0.8, 'An AI alert and an operator\'s round disagree about a leak. What next?', ['Treat it as unresolved and get a third, independent check', 'Trust the AI', 'Trust the round and close it'], 'Disagreement calls for an independent check.',
      'يختلف تنبيه الذكاء الاصطناعي وجولة المشغّل بشأن تسرّب. ما التالي؟', ['اعتباره غير محسوم والحصول على تحقق ثالث مستقل', 'الوثوق بالذكاء الاصطناعي', 'الوثوق بالجولة وإغلاقه'], 'الاختلاف يستدعي تحققاً مستقلاً.'],
    [3, 'validation', 'sk-fs-ai-twin', 0.25, 'The twin is "calibrated" by adjusting it until it matches the plant over a period that included a real fault. Problem?', ['The fault is now built into the model, so it will hide similar faults', 'None: matching is the goal', 'It makes the twin slower'], 'Never tune a model to absorb a real fault.',
      'عُوير التوأم بتعديله حتى طابق المحطة خلال فترة تضمنت عطلاً حقيقياً. ما المشكلة؟', ['صار العطل جزءاً من النموذج فسيخفي أعطالاً مشابهة', 'لا مشكلة: المطابقة هي الهدف', 'أنه يبطئ التوأم'], 'لا تضبط نموذجاً ليستوعب عطلاً حقيقياً.'],
    [3, 'anomaly', 'sk-fs-ai-anomaly', 0.45, 'Which evidence best confirms a bearing problem flagged by AI?', ['A rising bearing temperature trend plus a field check', 'The AI confidence score of 0.97', 'A second AI tool agreeing'], 'Independent physical evidence confirms; scores do not.',
      'أي دليل يؤكد أفضل مشكلة محمل نبّه إليها الذكاء الاصطناعي؟', ['اتجاه صاعد لحرارة المحمل مع فحص ميداني', 'درجة ثقة الذكاء الاصطناعي 0.97', 'موافقة أداة ذكاء اصطناعي ثانية'], 'الدليل الفيزيائي المستقل يؤكد؛ الدرجات لا تؤكد.'],
    [3, 'validation', 'sk-fs-ai-twin', 0.6, 'The twin\'s cooling-water input comes from a different sensor than the plant\'s own reading. Risk?', ['Twin and plant may diverge because they use different inputs, not because of a fault', 'No risk', 'The twin becomes more accurate'], 'Know which inputs a model uses.',
      'يأتي مدخل مياه التبريد للتوأم من مستشعر غير الذي تستخدمه قراءة المحطة. ما الخطر؟', ['قد يتباعد التوأم والمحطة لاختلاف المدخلات لا بسبب عطل', 'لا خطر', 'يصبح التوأم أدق'], 'اعرف المدخلات التي يستخدمها النموذج.'],
    [3, 'anomaly', 'sk-fs-ai-anomaly', 0.8, 'An AI tool stops raising alerts entirely after an update. What is the safe interpretation?', ['It may be broken; verify it still detects known test patterns', 'The plant is now perfect', 'Fewer alerts means better'], 'Silence can be a failure.',
      'توقفت أداة ذكاء اصطناعي عن إطلاق أي تنبيه بعد تحديث. ما التفسير الآمن؟', ['قد تكون معطلة؛ أتحقق أنها ما زالت تكشف أنماط الاختبار المعروفة', 'أن المحطة أصبحت مثالية', 'قلة التنبيهات أفضل'], 'الصمت قد يكون عطلاً.'],
    [4, 'validation', 'sk-fs-ai-twin', 0.2, 'Which practice keeps a twin trustworthy over years?', ['Version control, a change log tied to plant modifications, and periodic re-validation', 'Never changing it', 'Retraining it every night on all data'], 'Managed change keeps models honest.',
      'أي ممارسة تُبقي التوأم موثوقاً على مدى سنوات؟', ['إدارة الإصدارات وسجل تغييرات مرتبط بتعديلات المحطة وإعادة التحقق الدورية', 'عدم تغييره أبداً', 'إعادة تدريبه كل ليلة على كل البيانات'], 'التغيير المُدار يُبقي النماذج صادقة.'],
    [4, 'anomaly', 'sk-fs-ai-anomaly', 0.4, 'Two weeks of alerts show the AI flags most issues on one shift only. What should be examined?', ['Whether data or operating practice differs on that shift, before drawing conclusions about people', 'Which shift is careless', 'Nothing; the AI is objective'], 'Look for data and context differences first.',
      'تُظهر تنبيهات أسبوعين أن الذكاء الاصطناعي ينبّه إلى معظم المشكلات في مناوبة واحدة. ما الذي يجب فحصه؟', ['هل تختلف البيانات أو الممارسة التشغيلية في تلك المناوبة، قبل أي استنتاج عن الأشخاص', 'أي مناوبة مهملة', 'لا شيء؛ فالذكاء الاصطناعي موضوعي'], 'ابحث أولاً عن اختلافات البيانات والسياق.'],
    [4, 'validation', 'sk-fs-ai-twin', 0.6, 'Who should approve using a twin\'s output in an operating decision?', ['The accountable owner under a defined process, after validation for that use', 'Any user who trusts it', 'The model itself'], 'Use in decisions needs an owner and a process.',
      'من يجب أن يعتمد استخدام مخرجات توأم في قرار تشغيلي؟', ['المالك المسؤول ضمن عملية محددة بعد التحقق لذلك الاستخدام', 'أي مستخدم يثق به', 'النموذج نفسه'], 'الاستخدام في القرارات يحتاج مالكاً وعملية.'],
    [4, 'anomaly', 'sk-fs-ai-anomaly', 0.8, 'An AI alert would require a power reduction if acted on directly. What is the right path?', ['Follow the approved procedure: qualified staff confirm conditions and decide', 'Reduce power because the AI said so', 'Wait for the AI to raise a second alert'], 'Operating decisions stay with qualified people under procedures.',
      'تنبيه من الذكاء الاصطناعي يتطلب خفض القدرة إن نُفّذ مباشرة. ما المسار الصحيح؟', ['اتباع الإجراء المعتمد: يتحقق موظفون مؤهلون من الظروف ويقررون', 'خفض القدرة لأن الذكاء الاصطناعي قال ذلك', 'انتظار تنبيه ثانٍ من الذكاء الاصطناعي'], 'القرارات التشغيلية تبقى للمؤهلين ضمن الإجراءات.'],
  ],
  'ab-cyber-hygiene': [
    [1, 'phishing', 'sk-fs-cy-phishing', 0.2, 'An email urges you to "verify your account now" through a link. What do you do?', ['Do not click; report it with the report-phishing button', 'Click to check', 'Forward it to colleagues to ask'], 'Report suspicious messages; never test the link.',
      'رسالة بريد تحثّك على "تأكيد حسابك الآن" عبر رابط. ماذا تفعل؟', ['لا أنقر؛ أبلغ عنها بزر الإبلاغ عن التصيد', 'أنقر للتحقق', 'أعيد توجيهها للزملاء لأسألهم'], 'أبلغ عن الرسائل المريبة ولا تجرّب الرابط أبداً.'],
    [1, 'media', 'sk-fs-cy-media', 0.4, 'You find a USB stick in the car park. What do you do?', ['Hand it in unopened as the rules say', 'Plug it in to find the owner', 'Keep it'], 'Unknown media can carry malware.',
      'وجدت ذاكرة USB في موقف السيارات. ماذا تفعل؟', ['أسلّمها دون فتحها كما تنص القواعد', 'أوصلها بالحاسوب لأعرف صاحبها', 'أحتفظ بها'], 'الوسائط المجهولة قد تحمل برمجيات خبيثة.'],
    [1, 'access', 'sk-fs-cy-access', 0.6, 'Which password habit is safest?', ['A long passphrase used for one account only', 'The same strong password everywhere', 'A short password changed weekly'], 'Length and uniqueness matter most.',
      'أي عادة في كلمات المرور هي الأكثر أماناً؟', ['عبارة مرور طويلة تُستخدم لحساب واحد فقط', 'كلمة مرور قوية واحدة في كل مكان', 'كلمة مرور قصيرة تُغيَّر أسبوعياً'], 'الطول والتفرد هما الأهم.'],
    [1, 'report', 'sk-fs-cy-report', 0.8, 'You clicked a suspicious link by mistake. What now?', ['Report it straight away to the service desk', 'Wait to see if anything happens', 'Delete the email and say nothing'], 'Early reporting limits harm; nobody is blamed for reporting.',
      'نقرت رابطاً مريباً عن طريق الخطأ. ماذا الآن؟', ['أبلغ مكتب الخدمة فوراً', 'أنتظر لأرى إن حدث شيء', 'أحذف الرسالة ولا أقول شيئاً'], 'الإبلاغ المبكر يحدّ من الضرر؛ ولا يُلام أحد على الإبلاغ.'],
    [2, 'phishing', 'sk-fs-cy-phishing', 0.2, 'A message from "your manager" asks you to buy gift cards urgently and keep it quiet. Sign of…', ['A social-engineering scam', 'A normal request', 'A team reward'], 'Urgency plus secrecy is a classic lure.',
      'رسالة من "مديرك" تطلب شراء بطاقات هدايا بسرعة وكتمان الأمر. علامة على…', ['احتيال بالهندسة الاجتماعية', 'طلب عادي', 'مكافأة للفريق'], 'الاستعجال مع السرية طُعم معروف.'],
    [2, 'media', 'sk-fs-cy-media', 0.4, 'A contractor asks to plug a laptop into a plant workstation to copy a file. Your answer?', ['Only through the approved transfer process', 'Yes, if it is quick', 'Yes, if they are known'], 'Plant systems take files only through approved routes.',
      'يطلب مقاول توصيل حاسوبه بمحطة عمل في المحطة لنسخ ملف. ما ردك؟', ['فقط عبر عملية النقل المعتمدة', 'نعم إن كان الأمر سريعاً', 'نعم إن كان معروفاً'], 'أنظمة المحطة تستقبل الملفات عبر المسارات المعتمدة فقط.'],
    [2, 'access', 'sk-fs-cy-access', 0.6, 'A colleague asks to use your login while theirs is reset. What do you do?', ['Decline and help them reach the service desk', 'Share it for the shift', 'Type it in for them'], 'Accounts are personal; actions are traced to the holder.',
      'يطلب زميل استخدام بيانات دخولك ريثما يُعاد ضبط حسابه. ماذا تفعل؟', ['أعتذر وأساعده في التواصل مع مكتب الخدمة', 'أشاركها طوال المناوبة', 'أكتبها نيابة عنه'], 'الحسابات شخصية؛ والأفعال تُنسب إلى صاحبها.'],
    [2, 'report', 'sk-fs-cy-report', 0.8, 'A workstation behaves oddly: pop-ups and a slow mouse. Best action?', ['Stop using it and report it so specialists can check', 'Restart it and carry on', 'Install a cleaner you found online'], 'Report odd behaviour; do not self-treat.',
      'تتصرف محطة عمل بغرابة: نوافذ منبثقة وفأرة بطيئة. ما أفضل تصرف؟', ['أتوقف عن استخدامها وأبلغ ليتحقق المختصون', 'أعيد تشغيلها وأكمل', 'أثبّت أداة تنظيف وجدتها على الإنترنت'], 'أبلغ عن السلوك الغريب ولا تعالجه بنفسك.'],
    [3, 'phishing', 'sk-fs-cy-phishing', 0.25, 'A well-written email from a real supplier\'s address asks to change their bank details. What do you do?', ['Confirm by phone using a number from your records, not the email', 'Update them; the address is genuine', 'Reply asking if it is real'], 'Real accounts can be compromised; confirm out of band.',
      'رسالة مكتوبة بإتقان من عنوان مورّد حقيقي تطلب تغيير بياناته المصرفية. ماذا تفعل؟', ['أؤكد هاتفياً برقم من سجلاتنا لا من الرسالة', 'أحدّثها؛ فالعنوان حقيقي', 'أرد لأسأل إن كانت حقيقية'], 'قد تُخترق الحسابات الحقيقية؛ أكّد عبر قناة أخرى.'],
    [3, 'media', 'sk-fs-cy-media', 0.45, 'Why are personal phones kept away from some plant equipment?', ['They can carry or bridge infections and are not controlled devices', 'They are too heavy', 'They break easily'], 'Uncontrolled devices are a route in.',
      'لماذا تُبعد الهواتف الشخصية عن بعض معدات المحطة؟', ['لأنها قد تحمل عدوى أو تنقلها وليست أجهزة خاضعة للرقابة', 'لأنها ثقيلة', 'لأنها تنكسر بسهولة'], 'الأجهزة غير الخاضعة للرقابة طريق للدخول.'],
    [3, 'access', 'sk-fs-cy-access', 0.6, 'You get a sign-in approval request on your phone that you did not start. What do you do?', ['Deny it and report it: someone may have your password', 'Approve it to stop the prompts', 'Ignore it'], 'Unexpected approval prompts mean a password may be known.',
      'وصلك طلب موافقة على تسجيل دخول في هاتفك لم تبدأه. ماذا تفعل؟', ['أرفضه وأبلغ: قد يملك أحد كلمة مروري', 'أوافق لإيقاف الطلبات', 'أتجاهله'], 'طلبات الموافقة غير المتوقعة تعني أن كلمة المرور قد تكون معروفة.'],
    [3, 'report', 'sk-fs-cy-report', 0.8, 'You reported a suspicious email and later realise you also opened its attachment. What now?', ['Report again with the new detail at once', 'Say nothing; you already reported', 'Delete the attachment and move on'], 'New facts change the response; share them.',
      'أبلغت عن رسالة مريبة ثم أدركت أنك فتحت مرفقها أيضاً. ماذا الآن؟', ['أبلغ مجدداً بالتفصيل الجديد فوراً', 'لا أقول شيئاً؛ فقد أبلغت', 'أحذف المرفق وأتابع'], 'الحقائق الجديدة تغيّر الاستجابة؛ شاركها.'],
    [4, 'phishing', 'sk-fs-cy-phishing', 0.3, 'Several colleagues got the same odd message. What helps the response most?', ['Each person reports it, without forwarding it around', 'One person forwards it to everyone as a warning', 'Everyone deletes it quietly'], 'Reports show the spread; forwarding spreads the lure.',
      'تلقى عدة زملاء الرسالة الغريبة نفسها. ما الذي يساعد الاستجابة أكثر؟', ['أن يبلغ كل شخص عنها دون إعادة توجيهها', 'أن يعيد شخص توجيهها للجميع للتحذير', 'أن يحذفها الجميع بصمت'], 'البلاغات تُظهر الانتشار؛ وإعادة التوجيه تنشر الطُعم.'],
    [4, 'media', 'sk-fs-cy-media', 0.5, 'A vendor\'s service tool arrives for maintenance. Before it touches plant equipment…', ['It goes through the approved media and device check', 'It is used because the vendor is trusted', 'It is scanned at home by the engineer'], 'Every device takes the approved check, whoever owns it.',
      'وصلت أداة خدمة من مورّد لأعمال صيانة. قبل أن تلمس معدات المحطة…', ['تمر عبر فحص الوسائط والأجهزة المعتمد', 'تُستخدم لأن المورّد موثوق', 'يفحصها المهندس في منزله'], 'كل جهاز يخضع للفحص المعتمد أياً كان مالكه.'],
    [4, 'access', 'sk-fs-cy-access', 0.7, 'A team shares one generic login on a shared terminal "to save time". Main problem?', ['Actions cannot be traced to a person, and access cannot be removed for one leaver', 'It is slower', 'Nothing'], 'Shared logins break accountability.',
      'يتشارك فريق حساب دخول عاماً واحداً على جهاز مشترك "لتوفير الوقت". ما المشكلة الرئيسية؟', ['تعذّر نسبة الأفعال إلى شخص بعينه، وتعذّر سحب الوصول من مغادر واحد', 'أنه أبطأ', 'لا شيء'], 'الحسابات المشتركة تكسر المساءلة.'],
    [4, 'report', 'sk-fs-cy-report', 0.85, 'Why does early reporting matter even when you are not sure anything is wrong?', ['Specialists can link small signs into a pattern only if people report them', 'It counts towards targets', 'It does not matter'], 'Small reports join up into early warning.',
      'لماذا يهم الإبلاغ المبكر حتى عندما لا تكون متأكداً من وجود خطأ؟', ['لأن المختصين لا يربطون العلامات الصغيرة في نمط إلا إذا أبلغ الناس عنها', 'لأنه يُحتسب ضمن المستهدفات', 'لا يهم'], 'البلاغات الصغيرة تتجمع إنذاراً مبكراً.'],
  ],
  'ab-smr': [
    [1, 'design', 'sk-fs-adv-smr', 0.2, 'What does "modular" mean in small modular reactor?', ['Major parts are built in a factory and shipped as modules', 'The reactor can be taken apart by hand', 'It uses many small fuel pellets'], 'Factory fabrication of modules is the core idea.',
      'ماذا تعني كلمة "معياري" في المفاعل المعياري الصغير؟', ['تُصنع الأجزاء الرئيسية في مصنع وتُشحن على شكل وحدات', 'يمكن تفكيك المفاعل يدوياً', 'يستخدم كريات وقود صغيرة كثيرة'], 'تصنيع الوحدات في المصنع هو الفكرة الأساسية.'],
    [1, 'passive', 'sk-fs-adv-passive', 0.4, 'A passive safety system mainly relies on…', ['Natural forces such as gravity and natural circulation', 'Operators pressing buttons quickly', 'Large diesel pumps'], 'Passive systems work without pumps or operator action for a period.',
      'يعتمد نظام السلامة الذاتي أساساً على…', ['قوى طبيعية مثل الجاذبية والدوران الطبيعي', 'ضغط المشغلين على الأزرار بسرعة', 'مضخات ديزل كبيرة'], 'تعمل الأنظمة الذاتية دون مضخات أو تدخل المشغل لفترة.'],
    [1, 'design', 'sk-fs-adv-smr', 0.6, 'Compared with a large plant unit, an SMR unit typically has…', ['A smaller power output per unit', 'A larger power output per unit', 'No cooling system'], 'Small refers to output per unit.',
      'مقارنة بوحدة محطة كبيرة، تمتلك وحدة المفاعل المعياري الصغير عادة…', ['قدرة أصغر لكل وحدة', 'قدرة أكبر لكل وحدة', 'لا نظام تبريد'], 'الصغر يشير إلى القدرة لكل وحدة.'],
    [1, 'operations', 'sk-fs-adv-smr', 0.8, 'Learning about SMRs at ENEC today means…', ['Building awareness; no deployment decision is implied', 'A decision to build has been made', 'Current plant roles will end'], 'Orientation content implies no deployment decision.',
      'التعرف على المفاعلات المعيارية الصغيرة اليوم يعني…', ['بناء الوعي؛ ولا يُستنتج أي قرار بالنشر', 'أن قرار البناء قد اتُّخذ', 'أن أدوار المحطة الحالية ستنتهي'], 'محتوى التعريف لا يتضمن أي قرار بالنشر.'],
    [2, 'passive', 'sk-fs-adv-passive', 0.2, 'Natural circulation cooling works because…', ['Heated water rises and cooler water sinks, driving flow without pumps', 'Pumps run more slowly', 'Steam is cooled by fans'], 'Density differences drive the flow.',
      'يعمل التبريد بالدوران الطبيعي لأن…', ['الماء الساخن يصعد والأبرد يهبط فيدفع التدفق دون مضخات', 'المضخات تعمل ببطء أكبر', 'البخار يُبرَّد بالمراوح'], 'فروق الكثافة تدفع التدفق.'],
    [2, 'design', 'sk-fs-adv-smr', 0.4, 'Why does factory fabrication matter for quality?', ['Repeatable conditions and inspections make quality more consistent', 'Factories need no inspection', 'It removes the need for licensing'], 'Repeatable production supports consistent quality.',
      'لماذا يهم التصنيع في المصنع للجودة؟', ['الظروف والفحوص القابلة للتكرار تجعل الجودة أكثر اتساقاً', 'لأن المصانع لا تحتاج إلى فحص', 'لأنه يلغي الحاجة إلى الترخيص'], 'الإنتاج المتكرر يدعم جودة متسقة.'],
    [2, 'operations', 'sk-fs-adv-smr', 0.6, 'Several SMR modules may share one control room. What skill does that call for?', ['Keeping clear awareness of the state of each module', 'Faster typing', 'Less training'], 'Multi-module operation stresses situational awareness.',
      'قد تشترك عدة وحدات معيارية في غرفة تحكم واحدة. ما المهارة المطلوبة؟', ['الحفاظ على وعي واضح بحالة كل وحدة', 'الطباعة الأسرع', 'تدريب أقل'], 'تشغيل الوحدات المتعددة يتطلب وعياً ظرفياً عالياً.'],
    [2, 'passive', 'sk-fs-adv-passive', 0.8, 'A "grace period" in passive designs refers to…', ['The time the plant stays safe without operator action or power', 'Holiday leave for operators', 'The time to refuel'], 'Grace periods measure time without intervention.',
      'تشير "فترة السماح" في التصاميم الذاتية إلى…', ['الوقت الذي تبقى فيه المحطة آمنة دون تدخل المشغل أو الطاقة', 'إجازة المشغلين', 'وقت إعادة التزود بالوقود'], 'فترات السماح تقيس الوقت دون تدخل.'],
    [3, 'passive', 'sk-fs-adv-passive', 0.2, 'Which is a limit of passive systems that designers must address?', ['Small driving forces, so flow can be sensitive to conditions', 'They need constant power', 'They require many operators'], 'Weak natural driving forces need careful design.',
      'أي مما يلي حدّ للأنظمة الذاتية يجب على المصممين معالجته؟', ['قوى الدفع صغيرة، لذا قد يتأثر التدفق بالظروف', 'أنها تحتاج طاقة مستمرة', 'أنها تتطلب مشغلين كثيرين'], 'قوى الدفع الطبيعية الضعيفة تتطلب تصميماً دقيقاً.'],
    [3, 'design', 'sk-fs-adv-smr', 0.4, 'What existing APR-1400 skills transfer most directly to SMR operation?', ['Reactor physics fundamentals, procedures discipline and conservative decision-making', 'None at all', 'Only office skills'], 'Core nuclear skills transfer; new design details add on top.',
      'أي مهارات حالية في APR-1400 تنتقل مباشرة إلى تشغيل المفاعلات المعيارية الصغيرة؟', ['أساسيات فيزياء المفاعلات والانضباط بالإجراءات واتخاذ القرار المتحفظ', 'لا شيء إطلاقاً', 'المهارات المكتبية فقط'], 'المهارات النووية الأساسية تنتقل؛ وتضاف إليها تفاصيل التصميم الجديد.'],
    [3, 'operations', 'sk-fs-adv-smr', 0.6, 'Load-following with SMRs raises which operational question?', ['How frequent power changes affect fuel and components over time', 'Whether operators can sleep', 'Whether the grid exists'], 'Cycling has long-term effects that must be managed.',
      'يطرح تتبّع الحمل بالمفاعلات المعيارية الصغيرة أي سؤال تشغيلي؟', ['كيف تؤثر تغيرات القدرة المتكررة في الوقود والمكونات مع الوقت', 'هل يستطيع المشغلون النوم', 'هل الشبكة موجودة'], 'التغيير الدوري له آثار طويلة المدى تجب إدارتها.'],
    [3, 'passive', 'sk-fs-adv-passive', 0.8, 'Why are passive systems still tested and inspected?', ['Their performance depends on components and conditions that can degrade', 'Tests are a formality', 'They are not; passive means maintenance-free'], 'Passive is not maintenance-free.',
      'لماذا تُختبر الأنظمة الذاتية وتُفحص رغم ذلك؟', ['لأن أداءها يعتمد على مكونات وظروف قد تتدهور', 'لأن الاختبارات شكلية', 'لا تُختبر؛ فالذاتي يعني بلا صيانة'], 'الذاتي لا يعني بلا صيانة.'],
    [4, 'design', 'sk-fs-adv-smr', 0.2, 'Why do SMR designs still need a full safety case reviewed by the regulator?', ['New features must be shown to work in all analysed conditions; size alone proves nothing', 'They do not; small means safe', 'Only for exports'], 'Safety is demonstrated, not assumed from size.',
      'لماذا تحتاج تصاميم المفاعلات المعيارية الصغيرة إلى حالة سلامة كاملة يراجعها المنظِّم؟', ['يجب إثبات عمل الميزات الجديدة في كل الظروف المحللة؛ فالحجم وحده لا يثبت شيئاً', 'لا تحتاج؛ فالصغير آمن', 'للتصدير فقط'], 'السلامة تُثبت ولا تُفترض من الحجم.'],
    [4, 'operations', 'sk-fs-adv-smr', 0.4, 'Factory-built modules shift some quality work earlier. What does that mean for owners?', ['Owner oversight of the supplier\'s factory quality becomes a key skill', 'Owners need no quality staff', 'Site inspection becomes illegal'], 'Owner\'s engineering moves into the factory.',
      'تنقل الوحدات المصنّعة في المصنع جزءاً من أعمال الجودة إلى وقت أبكر. ماذا يعني ذلك للمالكين؟', ['تصبح رقابة المالك على جودة مصنع المورّد مهارة أساسية', 'لا يحتاج المالكون موظفي جودة', 'يصبح الفحص في الموقع ممنوعاً'], 'هندسة المالك تنتقل إلى المصنع.'],
    [4, 'passive', 'sk-fs-adv-passive', 0.6, 'A passive containment cooling claim is based on tests at a smaller scale. Key question?', ['Does the test scale represent full-size behaviour (scaling)?', 'Was the test filmed?', 'How many people attended?'], 'Scaling decides whether tests carry over.',
      'يستند ادعاء تبريد الاحتواء الذاتي إلى اختبارات بمقياس أصغر. ما السؤال الأساسي؟', ['هل يمثّل مقياس الاختبار سلوك الحجم الكامل (التحجيم)؟', 'هل صُوّر الاختبار؟', 'كم شخصاً حضر؟'], 'التحجيم يحدد ما إذا كانت الاختبارات تنطبق.'],
    [4, 'operations', 'sk-fs-adv-smr', 0.8, 'In a fleet of identical modules, a fault found on one module should lead to…', ['A check of the same feature on every module and an update of shared learning', 'A fix on that module only', 'Nothing if it was minor'], 'Standardisation shares both benefits and faults.',
      'في أسطول من وحدات متطابقة، يجب أن يؤدي عطل اكتُشف في وحدة واحدة إلى…', ['فحص الميزة نفسها في كل الوحدات وتحديث الدروس المشتركة', 'إصلاح تلك الوحدة فقط', 'لا شيء إن كان بسيطاً'], 'التوحيد يشارك المزايا والأعطال معاً.'],
  ],
  'ab-clean-energy': [
    [1, 'lifecycle', 'sk-fs-gr-lifecycle', 0.25, 'What does a lifecycle carbon assessment count?', ['Emissions from building, running and dismantling, not only operation', 'Only chimney emissions', 'Only the fuel price'], 'Lifecycle means cradle to grave.',
      'ماذا يحسب تقييم الكربون عبر دورة الحياة؟', ['الانبعاثات من البناء والتشغيل والتفكيك، لا التشغيل فقط', 'انبعاثات المدخنة فقط', 'سعر الوقود فقط'], 'دورة الحياة تعني من البداية إلى النهاية.'],
    [1, 'ghg', 'sk-fs-gr-ghg', 0.45, 'Burning diesel in the emergency generators during tests counts as…', ['Direct (Scope 1) emissions', 'Supplier (Scope 3) emissions', 'No emissions'], 'Fuel burned on site is Scope 1.',
      'يُحتسب حرق الديزل في مولدات الطوارئ أثناء الاختبارات على أنه…', ['انبعاثات مباشرة (النطاق 1)', 'انبعاثات الموردين (النطاق 3)', 'لا انبعاثات'], 'الوقود المحروق في الموقع من النطاق 1.'],
    [1, 'disclosure', 'sk-fs-gr-esg', 0.65, 'A sustainability figure in a report should always come with…', ['Its source, scope and date', 'A big font', 'A photo'], 'Every figure needs source, scope and date.',
      'يجب أن يرافق أي رقم استدامة في تقرير دائماً…', ['مصدره ونطاقه وتاريخه', 'خط كبير', 'صورة'], 'كل رقم يحتاج مصدراً ونطاقاً وتاريخاً.'],
    [1, 'ghg', 'sk-fs-gr-ghg', 0.85, 'Which gas is reported as CO2-equivalent together with carbon dioxide?', ['Sulphur hexafluoride (SF6) from switchgear', 'Oxygen', 'Nitrogen'], 'Potent gases like SF6 are converted to CO2e.',
      'أي غاز يُبلَّغ عنه بمكافئ ثاني أكسيد الكربون إلى جانب ثاني أكسيد الكربون؟', ['سادس فلوريد الكبريت (SF6) من المفاتيح الكهربائية', 'الأكسجين', 'النيتروجين'], 'الغازات القوية مثل SF6 تُحوَّل إلى مكافئ ثاني أكسيد الكربون.'],
    [2, 'lifecycle', 'sk-fs-gr-lifecycle', 0.2, 'For a nuclear plant, most lifecycle emissions come from…', ['Construction materials and the fuel cycle, not operation', 'Burning fuel in the reactor', 'Staff commuting only'], 'Operation emits little; materials and fuel cycle dominate.',
      'في المحطة النووية، تأتي معظم انبعاثات دورة الحياة من…', ['مواد البناء ودورة الوقود لا التشغيل', 'حرق الوقود في المفاعل', 'تنقل الموظفين فقط'], 'التشغيل يُصدر القليل؛ والمواد ودورة الوقود هي الغالبة.'],
    [2, 'ghg', 'sk-fs-gr-ghg', 0.4, 'An emission factor converts…', ['An activity amount (litres, kWh) into emissions', 'Emissions into money', 'Power into heat'], 'Activity × factor = emissions.',
      'يحوّل معامل الانبعاث…', ['كمية النشاط (لترات، كيلوواط ساعة) إلى انبعاثات', 'الانبعاثات إلى مال', 'القدرة إلى حرارة'], 'النشاط × المعامل = الانبعاثات.'],
    [2, 'disclosure', 'sk-fs-gr-esg', 0.6, 'A team wants to call a project "carbon neutral". What is needed first?', ['A measured footprint, a stated boundary and evidence for any offsets', 'A green logo', 'A press release'], 'Claims need measurement, boundaries and evidence.',
      'يريد فريق وصف مشروع بأنه "محايد كربونياً". ما المطلوب أولاً؟', ['بصمة مقيسة وحدود معلنة ودليل على أي تعويضات', 'شعار أخضر', 'بيان صحفي'], 'الادعاءات تحتاج قياساً وحدوداً ودليلاً.'],
    [2, 'lifecycle', 'sk-fs-gr-lifecycle', 0.8, 'Choosing refurbished over new equipment can lower lifecycle carbon because…', ['It avoids the emissions of making new material', 'Old equipment uses no power', 'It is always cheaper'], 'Avoided manufacturing is avoided emissions.',
      'قد يخفّض اختيار معدات مجددة بدل الجديدة كربون دورة الحياة لأن…', ['ذلك يتجنب انبعاثات صنع مواد جديدة', 'المعدات القديمة لا تستهلك طاقة', 'ذلك أرخص دائماً'], 'تجنّب التصنيع تجنّب للانبعاثات.'],
    [3, 'ghg', 'sk-fs-gr-ghg', 0.25, 'One month\'s fuel log is ten times higher than every other month. First step?', ['Query the entry with its owner before reporting the total', 'Report it as recorded', 'Delete it'], 'Outliers are queried, corrected with evidence and noted.',
      'سجل وقود شهر واحد أعلى بعشر مرات من كل الأشهر الأخرى. ما الخطوة الأولى؟', ['الاستفسار عن القيد من صاحبه قبل الإبلاغ عن المجموع', 'الإبلاغ عنه كما سُجّل', 'حذفه'], 'القيم الشاذة يُستفسر عنها وتصحح بالدليل ويُسجل ذلك.'],
    [3, 'disclosure', 'sk-fs-gr-esg', 0.45, 'Last year\'s figure is restated after an error is found. Good practice?', ['Show the restated figure, the reason and the effect', 'Quietly replace it', 'Keep the wrong figure for consistency'], 'Restatements are disclosed with reasons.',
      'أُعيد بيان رقم العام الماضي بعد اكتشاف خطأ. ما الممارسة الجيدة؟', ['عرض الرقم المعاد بيانه وسببه وأثره', 'استبدالُه بهدوء', 'إبقاء الرقم الخاطئ للاتساق'], 'إعادة البيان تُفصح مع الأسباب.'],
    [3, 'lifecycle', 'sk-fs-gr-lifecycle', 0.6, 'Two studies give very different lifecycle results for the same technology. Most likely reason?', ['Different boundaries, assumptions or data years', 'One is lying', 'The technology changed overnight'], 'Compare boundaries and assumptions before results.',
      'تعطي دراستان نتائج مختلفة جداً لدورة حياة التقنية نفسها. ما السبب الأرجح؟', ['اختلاف الحدود أو الافتراضات أو سنوات البيانات', 'أن إحداهما تكذب', 'أن التقنية تغيّرت فجأة'], 'قارن الحدود والافتراضات قبل النتائج.'],
    [3, 'ghg', 'sk-fs-gr-ghg', 0.8, 'Electricity bought from the grid for site offices is reported as…', ['Indirect energy (Scope 2) emissions', 'Direct (Scope 1) emissions', 'Not reported'], 'Purchased electricity is Scope 2.',
      'تُبلَّغ الكهرباء المشتراة من الشبكة لمكاتب الموقع على أنها…', ['انبعاثات طاقة غير مباشرة (النطاق 2)', 'انبعاثات مباشرة (النطاق 1)', 'لا يُبلَّغ عنها'], 'الكهرباء المشتراة من النطاق 2.'],
    [4, 'disclosure', 'sk-fs-gr-esg', 0.2, 'What separates a credible disclosure from greenwashing?', ['Verifiable data, clear boundaries and honest limitations', 'Positive language', 'Many photos'], 'Credibility rests on verifiable data and stated limits.',
      'ما الذي يميز الإفصاح الموثوق عن الغسل الأخضر؟', ['بيانات قابلة للتحقق وحدود واضحة وقيود معلنة بصدق', 'لغة إيجابية', 'صور كثيرة'], 'المصداقية تقوم على بيانات قابلة للتحقق وقيود معلنة.'],
    [4, 'lifecycle', 'sk-fs-gr-lifecycle', 0.4, 'Using a lifecycle study to compare plant options, which choice must be the same for both?', ['The functional unit (for example per MWh delivered) and boundaries', 'The report colour', 'The author'], 'Comparisons need the same functional unit.',
      'عند استخدام دراسة دورة حياة لمقارنة خيارات المحطة، ما الذي يجب أن يكون متماثلاً للخيارين؟', ['الوحدة الوظيفية (مثلاً لكل ميغاواط ساعة مُسلّمة) والحدود', 'لون التقرير', 'المؤلف'], 'المقارنات تحتاج الوحدة الوظيفية نفسها.'],
    [4, 'ghg', 'sk-fs-gr-ghg', 0.6, 'Why should uncertainty be stated with an emissions inventory?', ['Readers can judge how much a change is real or within error', 'It makes the report longer', 'It is never needed'], 'Uncertainty tells readers what changes mean.',
      'لماذا يجب ذكر عدم اليقين مع جرد الانبعاثات؟', ['ليحكم القراء إن كان التغير حقيقياً أم ضمن الخطأ', 'لأنه يطيل التقرير', 'لا حاجة إليه أبداً'], 'عدم اليقين يخبر القراء بمعنى التغيرات.'],
    [4, 'disclosure', 'sk-fs-gr-esg', 0.8, 'A manager asks you to leave a poor result out of a sustainability summary. The right response?', ['Explain that complete, balanced reporting is required and raise it if pressed', 'Leave it out', 'Change the number'], 'Balanced reporting includes poor results.',
      'يطلب منك مدير حذف نتيجة ضعيفة من ملخص الاستدامة. ما الرد الصحيح؟', ['أوضح أن الإبلاغ الكامل المتوازن مطلوب وأصعّد الأمر إن أصرّ', 'أحذفها', 'أغيّر الرقم'], 'الإبلاغ المتوازن يشمل النتائج الضعيفة.'],
  ],
};

function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;

export function bankRows() {
  return BANKS.map(([id, code, en, ar, sen, sar, fs_area, skill_ids, safety_related, mode, cut_level, gates, benchmark_ids, src], i) => ({
    id, code, name_en: en, name_ar: ar, summary_en: sen, summary_ar: sar, fs_area, skill_ids, safety_related, mode, cut_level, max_items: 20, min_items: 8, stable_window: 4,
    evidence_cap: 3, retake_days: 14, gates, benchmark_ids, sources: src.map((k) => ({ ...SRC[k], as_of: AS_OF })), status: 'active', version: 1, sort: i + 1,
    updated_by: 'p-training-mgr', updated_at: '2026-09-20T08:00:00Z',
  }));
}
export function itemRows() {
  const out = [];
  for (const [bank, list] of Object.entries(ITEMS)) {
    const seen = {};
    list.forEach(([level, facet, skill_id, off, sen, oen, een, sar, oar, ear], i) => {
      seen[level] = (seen[level] ?? 0) + 1;
      const rot = (i * 7 + level) % oen.length; // the key moves: options rotated so the right answer is not always first
      const order = oen.map((_, j) => (j + rot) % oen.length);
      const difficulty = Math.round((level + off) * 100) / 100;
      out.push({
        id: `ai-${bank.replace(/^ab-/, '')}-${level}${String.fromCharCode(96 + seen[level])}`, bank_id: bank, skill_id, facet, level, difficulty,
        stem_en: sen, stem_ar: sar, options_en: order.map((j) => oen[j]), options_ar: order.map((j) => oar[j]), correct: order.indexOf(0), explain_en: een, explain_ar: ear,
        p_value: Math.round(Math.max(0.12, Math.min(0.96, 0.97 - 0.19 * (difficulty - 1))) * 100) / 100, calib_n: 36 + Math.floor(rnd(`calib:${bank}:${i}`) * 60),
        status: 'active', version: 1, sort: i + 1, updated_by: 'p-training-mgr', updated_at: '2026-09-20T08:00:00Z',
      });
    });
  }
  return out;
}

// ───────────── Performance tasks (SIMULATED data; no plant, OT or simulator connection)
const noise = (k, i, a) => Math.round((rnd(`${k}:${i}`) - 0.5) * 2 * a * 100) / 100;
const series = (key, n, fn) => Array.from({ length: n }, (_, i) => Math.round(fn(i) * 100) / 100);
const RUBRIC = (anomalyEn, anomalyAr) => [
  { key: 'anomaly', label_en: 'Finds the anomaly', label_ar: 'يحدد الشذوذ', max: 3, mode: 'auto_anomaly', critical: false, levels: [
    { score: 3, en: anomalyEn, ar: anomalyAr },
    { score: 2, en: 'Marks the right signal within three readings of where the anomaly shows.', ar: 'يعلّم الإشارة الصحيحة على بعد ثلاث قراءات أو أقل من موضع ظهور الشذوذ.' },
    { score: 1, en: 'Marks the right signal at another point.', ar: 'يعلّم الإشارة الصحيحة في موضع آخر.' },
    { score: 0, en: 'Marks another signal.', ar: 'يعلّم إشارة أخرى.' }] },
  { key: 'quality', label_en: 'Checks the data before trusting it', label_ar: 'يتحقق من البيانات قبل الوثوق بها', max: 3, mode: 'assessor', critical: false, levels: [
    { score: 3, en: 'Names the checks made (redundant channels, quality status, recent work) and what each showed.', ar: 'يذكر التحققات التي أجراها (القنوات الاحتياطية، حالة الجودة، الأعمال الأخيرة) وما أظهره كل منها.' },
    { score: 2, en: 'Makes relevant checks but does not say what they showed.', ar: 'يجري تحققات ذات صلة لكنه لا يذكر ما أظهرته.' },
    { score: 1, en: 'Makes one check only.', ar: 'يجري تحققاً واحداً فقط.' },
    { score: 0, en: 'Trusts the data or the tool without any check.', ar: 'يثق بالبيانات أو الأداة دون أي تحقق.' }] },
  { key: 'decision', label_en: 'Chooses a safe, conservative action', label_ar: 'يختار إجراءً آمناً ومتحفظاً', max: 3, mode: 'auto_decision', critical: true, levels: [
    { score: 3, en: 'The safe, conservative action that keeps people informed and in charge.', ar: 'الإجراء الآمن المتحفظ الذي يُبقي الأشخاص على اطلاع وفي موقع القرار.' },
    { score: 1, en: 'An action that is not unsafe but is premature or disproportionate.', ar: 'إجراء غير خطر لكنه متسرّع أو غير متناسب.' },
    { score: 0, en: 'An unsafe action: this line is critical, so the task is not passed whatever the total.', ar: 'إجراء غير آمن: هذا البند حاسم، فلا تُجتاز المهمة أياً كان المجموع.' }] },
  { key: 'justify', label_en: 'Justifies the decision', label_ar: 'يبرر القرار', max: 3, mode: 'assessor', critical: false, levels: [
    { score: 3, en: 'Cites the evidence, states what is uncertain and challenges the tool or data where needed.', ar: 'يستشهد بالأدلة ويذكر مواضع عدم اليقين ويعترض على الأداة أو البيانات عند الحاجة.' },
    { score: 2, en: 'Cites evidence but does not state uncertainty.', ar: 'يستشهد بالأدلة لكنه لا يذكر عدم اليقين.' },
    { score: 1, en: 'Gives a reason without evidence.', ar: 'يعطي سبباً دون دليل.' },
    { score: 0, en: 'No real justification.', ar: 'لا يوجد تبرير فعلي.' }] },
];
const CHECKS = [
  { key: 'redundant', en: 'Compared redundant or related channels', ar: 'قارنت القنوات الاحتياطية أو ذات الصلة' },
  { key: 'status', en: 'Checked signal quality and instrument status', ar: 'تحققت من جودة الإشارة وحالة الأداة' },
  { key: 'history', en: 'Checked recent maintenance and calibration', ar: 'تحققت من الصيانة والمعايرة الأخيرة' },
  { key: 'procedure', en: 'Checked the procedure that applies', ar: 'تحققت من الإجراء المطبق' },
];
export function taskRows() {
  const N = 48;
  const T0 = '2026-09-14T06:00:00Z';
  const fw = (k, drift) => series(k, N, (i) => 99.2 + noise(k, i, 0.12) + (drift && i >= 30 ? 0.16 * (i - 29) : 0));
  const cw = series('cw', N, (i) => 31.0 + (i >= 24 ? Math.min(2.4, 0.2 * (i - 23)) : 0) + noise('cw', i, 0.08));
  const twin = cw.map((t, i) => Math.round((6.2 + 0.32 * (t - 31) + noise('tw', i, 0.03)) * 100) / 100);
  const meas = twin.map((v, i) => Math.round((v + noise('cm', i, 0.04) + (i >= 36 ? 0.09 * (i - 35) : 0)) * 100) / 100);
  const vib = series('vib', N, (i) => 2.1 + noise('vib', i, 0.15) + (i === 20 ? 4.6 : 0));
  const brg = series('brg', N, (i) => 58 + noise('brg', i, 0.3) + (i >= 28 ? 0.35 * (i - 27) : 0));
  const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const fuel = MONTHS.map((_, i) => (i === 7 ? 18400 : 1800 + Math.round(rnd(`fuel:${i}`) * 260)));
  const tests = MONTHS.map((_, i) => 4 + Math.floor(rnd(`tests:${i}`) * 2));
  const base = { evidence_level: 2, minutes: 20, min_minutes: 5, rubric_version: 1, pass_pct: 65, simulated: true, status: 'active', benchmark_ids: ['SKILLS-TECH', 'IAEA-AI'], checks: CHECKS };
  return [
    {
      ...base, id: 'pt-feedwater-drift', code: 'PT-DATA-01', sort: 1, fs_area: 'ai_data', skill_ids: ['sk-fs-ai-plantdata', 'sk-fs-tr-analytical'], gates: ['MC-DIGITAL-PLANT'],
      title_en: 'Plant data: the channel that drifts', title_ar: 'بيانات المحطة: القناة التي تنحرف',
      brief_en: 'You are reviewing twelve hours of feedwater flow from three redundant channels (SIMULATED). The shift wants to know whether the flow really changed. Mark where the anomaly shows, decide what to do and justify it.',
      brief_ar: 'تراجع اثنتي عشرة ساعة من تدفق مياه التغذية من ثلاث قنوات احتياطية (بيانات محاكاة). تريد المناوبة معرفة ما إذا كان التدفق قد تغيّر فعلاً. علّم موضع ظهور الشذوذ وقرّر ما تفعل وبرّر قرارك.',
      role_en: 'Performance engineer on day shift', role_ar: 'مهندس أداء في المناوبة النهارية',
      data: { t0: T0, step_min: 15, series: [
        { key: 'fw_a', label_en: 'Feedwater flow, channel A', label_ar: 'تدفق مياه التغذية، القناة A', unit: '%', values: fw('fwa', false) },
        { key: 'fw_b', label_en: 'Feedwater flow, channel B', label_ar: 'تدفق مياه التغذية، القناة B', unit: '%', values: fw('fwb', true) },
        { key: 'fw_c', label_en: 'Feedwater flow, channel C', label_ar: 'تدفق مياه التغذية، القناة C', unit: '%', values: fw('fwc', false) }] },
      decisions: [
        { key: 'average', en: 'Use the average of the three channels and carry on', ar: 'استخدام متوسط القنوات الثلاث والمتابعة' },
        { key: 'suspect', en: 'Treat channel B as suspect: rely on the two agreeing channels, raise a work request and tell the shift supervisor', ar: 'اعتبار القناة B مشكوكاً فيها: الاعتماد على القناتين المتوافقتين وفتح طلب عمل وإبلاغ مشرف المناوبة' },
        { key: 'recal', en: 'Recalibrate channel B yourself now', ar: 'معايرة القناة B بنفسك الآن' },
        { key: 'reduce', en: 'Ask for an immediate power reduction', ar: 'طلب خفض فوري للقدرة' }],
      rubric: RUBRIC('Marks channel B where its drift away from A and C shows.', 'يعلّم القناة B حيث يظهر انحرافها عن A وC.'),
      sources: [{ ...SRC.techwolf, as_of: AS_OF }, { ...SRC.iaeaai, as_of: AS_OF }],
    },
    {
      ...base, id: 'pt-twin-divergence', code: 'PT-TWIN-01', sort: 2, fs_area: 'ai_data', skill_ids: ['sk-fs-ai-twin', 'sk-fs-ai-anomaly'], gates: ['MC-TWINS'], evidence_level: 2,
      title_en: 'Digital twin: plant and model part ways', title_ar: 'التوأم الرقمي: المحطة والنموذج يفترقان',
      brief_en: 'The condenser twin predicts vacuum from the cooling-water temperature (SIMULATED). After the sea warmed, model and plant moved together; later they part ways. Find where the plant departs from the model, decide and justify.',
      brief_ar: 'يتنبأ توأم المكثف بالخلخلة من درجة حرارة مياه التبريد (بيانات محاكاة). بعد ارتفاع حرارة البحر تحرّك النموذج والمحطة معاً، ثم افترقا لاحقاً. حدّد موضع ابتعاد المحطة عن النموذج وقرّر وبرّر.',
      role_en: 'System engineer for the condenser', role_ar: 'مهندس نظام المكثف',
      data: { t0: T0, step_min: 15, series: [
        { key: 'cw_temp', label_en: 'Cooling-water inlet temperature', label_ar: 'حرارة مدخل مياه التبريد', unit: '°C', values: cw },
        { key: 'cv_twin', label_en: 'Condenser pressure, twin prediction', label_ar: 'ضغط المكثف، تنبؤ التوأم', unit: 'kPa', values: twin },
        { key: 'cv_meas', label_en: 'Condenser pressure, measured', label_ar: 'ضغط المكثف، مقيس', unit: 'kPa', values: meas }] },
      decisions: [
        { key: 'retune', en: 'Re-tune the twin until it matches the plant again', ar: 'إعادة ضبط التوأم حتى يطابق المحطة مجدداً' },
        { key: 'report', en: 'Treat the gap as a possible plant change: report it, ask for air in-leakage indications to be checked and keep the twin unchanged until reviewed', ar: 'اعتبار الفجوة تغيّراً محتملاً في المحطة: الإبلاغ عنها وطلب فحص مؤشرات تسرّب الهواء وإبقاء التوأم دون تغيير حتى المراجعة' },
        { key: 'ignore', en: 'Ignore it: the twin is often a little off', ar: 'تجاهلها: فالتوأم كثيراً ما يخطئ قليلاً' },
        { key: 'switch_off', en: 'Switch the twin off', ar: 'إيقاف التوأم' }],
      rubric: RUBRIC('Marks the measured pressure where it departs from the twin while the cooling water is steady.', 'يعلّم الضغط المقيس حيث يبتعد عن التوأم بينما مياه التبريد مستقرة.'),
      sources: [{ ...SRC.iaeaai, as_of: AS_OF }, { ...SRC.techwolf, as_of: AS_OF }],
    },
    {
      ...base, id: 'pt-ai-alert', code: 'PT-AI-01', sort: 3, fs_area: 'ai_data', skill_ids: ['sk-fs-ai-verify', 'sk-fs-ai-anomaly'], gates: ['MC-AI-LIT'], evidence_level: 2,
      title_en: 'Challenge an AI alert', title_ar: 'الاعتراض على تنبيه من الذكاء الاصطناعي',
      brief_en: 'An AI tool flags a vibration anomaly on a cooling pump (the flag is marked on the chart; SIMULATED). Decide whether the flag is the real story, mark the anomaly that matters and justify your decision.',
      brief_ar: 'نبّهت أداة ذكاء اصطناعي إلى شذوذ في اهتزاز مضخة تبريد (التنبيه معلّم على الرسم؛ بيانات محاكاة). قرّر إن كان التنبيه هو القصة الحقيقية، وعلّم الشذوذ المهم، وبرّر قرارك.',
      role_en: 'Equipment reliability engineer', role_ar: 'مهندس موثوقية المعدات',
      data: { t0: T0, step_min: 15, ai_flag: { series: 'vib', index: 20, label_en: 'AI tool: vibration anomaly (confidence 0.97)', label_ar: 'أداة الذكاء الاصطناعي: شذوذ في الاهتزاز (الثقة 0.97)' }, series: [
        { key: 'vib', label_en: 'Pump vibration', label_ar: 'اهتزاز المضخة', unit: 'mm/s', values: vib },
        { key: 'brg_temp', label_en: 'Pump bearing temperature', label_ar: 'حرارة محمل المضخة', unit: '°C', values: brg }] },
      decisions: [
        { key: 'accept', en: 'Accept the AI alert as the finding and close the bearing question', ar: 'قبول تنبيه الذكاء الاصطناعي نتيجةً وإغلاق مسألة المحمل' },
        { key: 'challenge', en: 'Challenge the alert: the spike is a single reading; report the rising bearing temperature and ask for a field check', ar: 'الاعتراض على التنبيه: القفزة قراءة واحدة؛ الإبلاغ عن ارتفاع حرارة المحمل وطلب فحص ميداني' },
        { key: 'wait', en: 'Wait for the AI tool to confirm with a second alert', ar: 'انتظار تأكيد أداة الذكاء الاصطناعي بتنبيه ثانٍ' },
        { key: 'stop', en: 'Stop the pump at once', ar: 'إيقاف المضخة فوراً' }],
      rubric: RUBRIC('Marks the bearing temperature where its steady rise begins, not the single vibration spike.', 'يعلّم حرارة المحمل حيث يبدأ ارتفاعها المطّرد، لا قفزة الاهتزاز المنفردة.'),
      sources: [{ ...SRC.iaeaai, as_of: AS_OF }, { ...SRC.techwolf, as_of: AS_OF }],
    },
    {
      ...base, id: 'pt-ghg-log', code: 'PT-GRN-01', sort: 4, fs_area: 'green_energy', skill_ids: ['sk-fs-gr-ghg', 'sk-fs-gr-esg'], gates: [], benchmark_ids: ['SKILLS-TECH', 'GREENCOMP'],
      title_en: 'Green: the fuel log that does not add up', title_ar: 'أخضر: سجل الوقود الذي لا يستقيم',
      brief_en: 'You prepare the emergency-generator fuel figures for the annual greenhouse-gas inventory (SIMULATED monthly data). Find the entry that does not fit, decide how to report and justify.',
      brief_ar: 'تُعدّ أرقام وقود مولدات الطوارئ لجرد غازات الدفيئة السنوي (بيانات شهرية محاكاة). جد القيد الذي لا يتسق، وقرّر كيف تبلّغ، وبرّر.',
      role_en: 'Sustainability analyst', role_ar: 'محلل استدامة',
      data: { t0: '2025-10-01T00:00:00Z', step_min: 43200, labels: MONTHS, series: [
        { key: 'edg_fuel', label_en: 'Diesel used in generator tests', label_ar: 'الديزل المستخدم في اختبارات المولدات', unit: 'L', values: fuel },
        { key: 'edg_tests', label_en: 'Generator test runs', label_ar: 'مرات تشغيل اختبار المولدات', unit: '', values: tests }] },
      decisions: [
        { key: 'as_is', en: 'Report the total as recorded', ar: 'الإبلاغ عن المجموع كما سُجّل' },
        { key: 'query', en: 'Query the May entry with its owner, correct it with evidence and note the change in the inventory', ar: 'الاستفسار عن قيد مايو من صاحبه وتصحيحه بالدليل وتسجيل التغيير في الجرد' },
        { key: 'delete', en: 'Delete the May entry', ar: 'حذف قيد مايو' },
        { key: 'average', en: 'Replace it with the average of the other months without a note', ar: 'استبدال المتوسط به للأشهر الأخرى دون ملاحظة' }],
      rubric: RUBRIC('Marks the fuel entry that is about ten times the others.', 'يعلّم قيد الوقود الذي يبلغ نحو عشرة أضعاف الآخرين.'),
      sources: [{ ...SRC.greencomp, as_of: AS_OF }, { ...SRC.techwolf, as_of: AS_OF }],
    },
  ];
}
export const KEYS = [
  { id: 'ptk-feedwater-drift', task_id: 'pt-feedwater-drift', series: 'fw_b', from_idx: 30, to_idx: 47, decision_points: [0, 3, 1, 1],
    notes_en: 'Channel B drifts upward from reading 30 while A and C agree; the conservative path relies on the agreeing channels and gets B checked.', notes_ar: 'تنحرف القناة B صعوداً من القراءة 30 بينما تتفق A وC؛ المسار المتحفظ يعتمد على القناتين المتفقتين ويطلب فحص B.' },
  { id: 'ptk-twin-divergence', task_id: 'pt-twin-divergence', series: 'cv_meas', from_idx: 36, to_idx: 47, decision_points: [0, 3, 0, 1],
    notes_en: 'The sea-temperature rise from reading 24 is real and the twin follows it; from reading 36 the measured pressure leaves the twin (possible air in-leakage). Re-tuning would hide a plant change.', notes_ar: 'ارتفاع حرارة البحر من القراءة 24 حقيقي ويتبعه التوأم؛ ومن القراءة 36 يبتعد الضغط المقيس عن التوأم (تسرّب هواء محتمل). إعادة الضبط تخفي تغيّراً في المحطة.' },
  { id: 'ptk-ai-alert', task_id: 'pt-ai-alert', series: 'brg_temp', from_idx: 28, to_idx: 47, decision_points: [0, 3, 1, 1],
    notes_en: 'The vibration flag at reading 20 is a single-point spike (data glitch); the bearing temperature rises steadily from reading 28.', notes_ar: 'تنبيه الاهتزاز عند القراءة 20 قفزة في نقطة واحدة (خلل بيانات)؛ وحرارة المحمل ترتفع باطّراد من القراءة 28.' },
  { id: 'ptk-ghg-log', task_id: 'pt-ghg-log', series: 'edg_fuel', from_idx: 7, to_idx: 7, decision_points: [0, 3, 0, 1],
    notes_en: 'May 2026 holds 18,400 L, about ten times the other months with a normal number of test runs: a likely entry error to query.', notes_ar: 'يحمل مايو 2026 18,400 لتر، أي نحو عشرة أضعاف الأشهر الأخرى مع عدد عادي من مرات التشغيل: خطأ إدخال محتمل يُستفسر عنه.' },
];

export default function build(T) {
  T.adaptive_banks = bankRows();
  T.adaptive_items = itemRows();
  T.performance_tasks = taskRows();
  T.perf_task_keys = KEYS.map((k) => ({ ...k }));
  T.adaptive_attempts = [];
  T.task_attempts = [];
  T.integrity_reports = [];
}

// ───────────── Simulated attempts (finalize)
const STAFF_ROLES = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin'];
const TAKE = { 'ab-ai-literacy': 0.62, 'ab-plant-data': 0.36, 'ab-digital-twins': 0.3, 'ab-cyber-hygiene': 0.6, 'ab-smr': 0.3, 'ab-clean-energy': 0.3 };
const ts = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const DAY = 86400000;
// demo stories: [person, bank, days ago of each attempt, ability, fast answers]
const STORIES = [
  ['p-k-ro', 'ab-ai-literacy', [70, 40], [2.2, 3.5], false], // improving: the second attempt shows the growth
  ['p-k-ro', 'ab-cyber-hygiene', [52], 3.4, false],
  ['p-k-ro', 'ab-digital-twins', [33], 2.3, false],
  ['p-sro', 'ab-ai-literacy', [25], 3.1, false],
  ['p-sro', 'ab-smr', [18], 3.0, false],
  ['p-buyer', 'ab-clean-energy', [21], 2.2, false],
  ['p-qc-inspector', 'ab-digital-twins', [58, 43, 29], 1.9, false], // three tries in 30 days: retakes flag on the third
  ['p-nse', 'ab-ai-literacy', [9], 3.6, true], // very fast answers: flagged for review
  ['p-sme-reviewer', 'ab-digital-twins', [12], 3.2, true],
];

export function simulate(T, now) {
  const banks = T.adaptive_banks.map((b) => ({ ...b }));
  const items = T.adaptive_items.map((i) => ({ ...i, level: Number(i.level), difficulty: Number(i.difficulty) }));
  const key = new Map(items.map((i) => [i.id, i]));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const roles = new Map();
  for (const r of T.role_assignments ?? []) if (r.status === 'active') (roles.get(r.person_id) ?? roles.set(r.person_id, new Set()).get(r.person_id)).add(r.role);
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && [...(roles.get(p.id) ?? [])].some((r) => STAFF_ROLES.includes(r))).sort((a, b) => (a.id < b.id ? -1 : 1));
  const staffIds = new Set(staff.map((p) => p.id));
  const nowMs = Date.parse(`${now}T00:00:00Z`);
  const plans = [];
  for (const [pid, bank, days, theta, fast] of STORIES) if (staffIds.has(pid)) days.forEach((d, i) => plans.push({ pid, bank, start: nowMs - d * DAY + 9 * 3600000 + Math.floor(rnd(`h:${pid}:${bank}:${d}`) * 6) * 3600000, theta: Array.isArray(theta) ? theta[i] : theta, fast }));
  const story = new Set(STORIES.map(([p, b]) => `${p}|${b}`));
  for (const p of staff) {
    if (['p-k-ro', 'p-sro', 'p-buyer'].includes(p.id)) continue; // personas keep the stories above (and banks still to try)
    for (const b of banks) {
      if (story.has(`${p.id}|${b.id}`) || rnd(`take:${p.id}:${b.id}`) >= TAKE[b.id]) continue;
      const d = 8 + Math.floor(rnd(`day:${p.id}:${b.id}`) * 110);
      const theta = 1.0 + 3.0 * rnd(`theta:${p.id}:${b.fs_area}`) * (0.75 + 0.25 * rnd(`t2:${p.id}`));
      plans.push({ pid: p.id, bank: b.id, start: nowMs - d * DAY + (7 + Math.floor(rnd(`hh:${p.id}:${b.id}`) * 8)) * 3600000, theta, fast: false });
      if (rnd(`retake:${p.id}:${b.id}`) < 0.12 && d > 40) plans.push({ pid: p.id, bank: b.id, start: nowMs - (d - 20) * DAY + 10 * 3600000, theta: theta + 0.35, fast: false });
    }
  }
  plans.sort((a, b) => a.start - b.start || (a.pid < b.pid ? -1 : 1));
  const attempts = [];
  const counter = new Map();
  for (const pl of plans) {
    const bank = banks.find((b) => b.id === pl.bank);
    const k = `${pl.pid}|${pl.bank}`;
    const no = (counter.get(k) ?? 0) + 1;
    counter.set(k, no);
    const form = formOf(pl.pid, no);
    const responses = [];
    let t = pl.start;
    let stop = null;
    for (;;) {
      const st = adaptiveNext(bank, items, responses, form);
      if (st.done) { stop = st.stop; break; }
      const it = key.get(st.item_id);
      const p = 1 / (1 + Math.exp(-2.2 * (pl.theta - it.difficulty + 0.6)));
      const correct = rnd(`ans:${pl.pid}:${it.id}:${no}`) < p;
      const wrong = (it.correct + 1 + Math.floor(rnd(`w:${pl.pid}:${it.id}`) * (it.options_en.length - 1))) % it.options_en.length;
      t += 1000 * (pl.fast && responses.length >= 2 ? 2 + Math.floor(rnd(`f:${pl.pid}:${it.id}`) * 3) : 14 + Math.floor(rnd(`s:${pl.pid}:${it.id}:${no}`) * 50));
      responses.push({ item_id: it.id, level: it.level, facet: it.facet, choice: correct ? it.correct : wrong, correct, at: ts(t) });
    }
    const id = `aa-${pl.bank.replace(/^ab-/, '')}-${pl.pid.replace(/^[pw]-/, '')}-${no}`;
    const safety = bankIsSafety(bank, skills);
    attempts.push({
      id, bank_id: bank.id, bank_version: 1, person_id: pl.pid, attempt_no: no, form, mode: safety ? 'criterion' : bank.mode, status: 'completed', started_at: ts(pl.start), completed_at: ts(t + 4000),
      responses, current_item_id: null, item_count: responses.length, stop, estimate: null, meets: null, percentile: null, norm_n: null, reasons: [], evidence: [],
      gating: (bank.gates ?? []).length > 0, integrity_id: null, counts: true, _safety: safety,
    });
  }
  // score in completion order: the percentile's norm group is what existed when each attempt completed
  attempts.sort((a, b) => (a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : a.id < b.id ? -1 : 1));
  for (const a of attempts) {
    const bank = banks.find((b) => b.id === a.bank_id);
    const sc = scoreAdaptive({ ...bank, mode: a.mode }, a._safety, a.responses, a.stop, normGroup(attempts.filter((x) => x.estimate != null), bank.id, a.person_id, a.completed_at));
    Object.assign(a, { estimate: sc.estimate, meets: sc.meets, percentile: sc.percentile, norm_n: sc.norm_n, reasons: sc.reasons, evidence: sc.evidence });
  }
  for (const a of attempts) delete a._safety;
  return { attempts, staff };
}

export function simulateTasks(T, now, staff) {
  const tasks = T.performance_tasks;
  const keys = new Map(T.perf_task_keys.map((k) => [k.task_id, k]));
  const nowMs = Date.parse(`${now}T00:00:00Z`);
  const assessors = ['p-training-mgr', 'p-k-instructor'];
  const plans = [
    ['p-k-ro', 'pt-feedwater-drift', 30, 'good', 'scored'], ['p-k-ro', 'pt-ai-alert', 3, 'good', 'submitted'],
    ['p-sro', 'pt-twin-divergence', 16, 'good', 'scored'], ['p-buyer', 'pt-ghg-log', 6, 'fair', 'submitted'],
    ['p-qc-inspector', 'pt-feedwater-drift', 11, 'poor', 'scored'], ['p-sme-reviewer', 'pt-twin-divergence', 4, 'good', 'resubmitted'],
    ['p-chem-sup', 'pt-ai-alert', 2, 'fair', 'submitted'], ['p-work-control', 'pt-feedwater-drift', 1, 'good', 'in_progress'],
  ];
  const used = new Set(plans.map(([p, t]) => `${p}|${t}`));
  for (const p of staff) {
    for (const tk of tasks) {
      if (used.has(`${p.id}|${tk.id}`) || ['p-k-ro', 'p-sro', 'p-buyer', 'p-training-mgr', 'p-k-instructor'].includes(p.id) || rnd(`pt:${p.id}:${tk.id}`) >= 0.07) continue;
      const q = rnd(`ptq:${p.id}:${tk.id}`);
      plans.push([p.id, tk.id, 6 + Math.floor(rnd(`ptd:${p.id}:${tk.id}`) * 80), q < 0.55 ? 'good' : q < 0.85 ? 'fair' : 'poor', rnd(`pts:${p.id}:${tk.id}`) < 0.82 ? 'scored' : 'submitted']);
    }
  }
  const out = [];
  const no = new Map();
  for (const [pid, tid, days, quality, state] of plans.sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : 1))) {
    if (!staff.some((s) => s.id === pid)) continue;
    const task = tasks.find((t) => t.id === tid);
    const key = keys.get(tid);
    const n = (no.get(`${pid}|${tid}`) ?? 0) + 1;
    no.set(`${pid}|${tid}`, n);
    const start = nowMs - days * DAY + (8 + Math.floor(rnd(`pth:${pid}:${tid}`) * 7)) * 3600000;
    const id = `ta-${tid.replace(/^pt-/, '')}-${pid.replace(/^[pw]-/, '')}-${n}`;
    const row = {
      id, task_id: tid, person_id: pid, attempt_no: n, rubric_version: task.rubric_version, status: 'in_progress', started_at: ts(start), submitted_at: null, answer: {}, resubmissions: 0,
      auto_scores: {}, scores: {}, total: null, max: null, passed: null, critical_failed: false, scored_by: null, scored_at: null, comment: null, gating: (task.gates ?? []).length > 0,
      integrity_id: null, evidence: [], counts: true,
    };
    if (state === 'in_progress') { out.push(row); continue; }
    const s = task.data.series;
    const right = quality === 'good' || (quality === 'fair' && rnd(`pta:${pid}:${tid}`) < 0.6);
    const series = right ? key.series : s.find((x) => x.key !== key.series).key;
    const index = right ? key.from_idx + Math.min(2, key.to_idx - key.from_idx) : Math.max(0, key.from_idx - 6);
    const best = key.decision_points.indexOf(3);
    const decision = quality === 'poor' ? key.decision_points.indexOf(0) : quality === 'fair' && rnd(`ptdc:${pid}:${tid}`) < 0.5 ? key.decision_points.indexOf(1) : best;
    const checks = quality === 'good' ? ['redundant', 'status', 'history'] : quality === 'fair' ? ['redundant'] : [];
    const justification = quality === 'good'
      ? 'The marked signal departs from the related channels while they stay steady, so I treat it as an instrument or plant change to confirm, not as settled; I keep people informed and get it checked.'
      : quality === 'fair' ? 'It looks different from the rest, so I would raise it with the shift and see.' : 'The tool and the total look fine to me, so no action is needed.';
    const answer = { series, index, decision, checks, justification };
    if (answerProblem(task, answer)) throw new Error(`fs22: simulated answer for ${id} fails the answer check (${answerProblem(task, answer)})`);
    const resub = state === 'resubmitted' ? 2 : 0;
    const submitted = start + (quality === 'poor' ? 4 : 11 + Math.floor(rnd(`ptm:${pid}:${tid}`) * 12)) * 60000 + resub * 7 * 60000;
    Object.assign(row, { status: 'submitted', submitted_at: ts(submitted), answer, auto_scores: autoScores(key, answer), resubmissions: resub });
    if (state === 'scored') {
      const manual = quality === 'good' ? { quality: 3, justify: 2 + (rnd(`ptj:${pid}`) < 0.5 ? 1 : 0) } : quality === 'fair' ? { quality: 1, justify: 1 } : { quality: 0, justify: 0 };
      const sc = scoreTask(task, row.auto_scores, manual);
      const by = assessors[h32(id) % 2];
      Object.assign(row, {
        status: 'scored', scores: manual, total: sc.total, max: sc.max, passed: sc.passed, critical_failed: sc.critical_failed, scored_by: by, scored_at: ts(submitted + 2 * DAY),
        comment: sc.passed ? 'Clear evidence and a conservative call; good challenge of the data.' : sc.critical_failed ? 'The chosen action is not safe; review the rubric decision line with your mentor.' : 'Name the checks you made and what they showed.',
        evidence: sc.passed ? [...task.skill_ids].sort().map((skill_id) => ({ skill_id, level: task.evidence_level })) : [],
      });
    }
    out.push(row);
  }
  return out;
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const banks = T.adaptive_banks;
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  // ── reference checks
  for (const b of banks) {
    for (const s of b.skill_ids) if (!skills.has(s) || !skills.get(s).fs_area) throw new Error(`fs21: bank ${b.id} names ${s}, not an FS02 future skill`);
    if (bankIsSafety(b, skills) && b.mode !== 'criterion') throw new Error(`fs21: safety-related bank ${b.id} must be criterion-referenced`);
  }
  const secureIds = new Set(T.items.filter((i) => i.bank === 'secure').map((i) => i.id));
  const stems = new Set();
  for (const v of T.item_versions) if (secureIds.has(v.item_id)) { stems.add(normText(v.stem_en)); stems.add(normText(v.stem_ar)); }
  for (const it of T.adaptive_items) {
    const p = adItemProblem(it, banks, stems);
    if (p) throw new Error(`fs21: item ${it.id} fails the item check (${p})`);
    if (levelOfDifficulty(it.difficulty) !== it.level) throw new Error(`fs21: item ${it.id} level does not match its difficulty`);
  }
  for (const b of banks) for (const l of [1, 2, 3, 4]) if (T.adaptive_items.filter((i) => i.bank_id === b.id && i.level === l).length < 2) throw new Error(`fs21: bank ${b.id} level ${l} has fewer than two items`);
  for (const t of T.performance_tasks) {
    if (!t.simulated || !dataIsSynthetic(t.data)) throw new Error(`fs22: task ${t.id} must be SIMULATED synthetic data`);
    if (!T.perf_task_keys.some((k) => k.task_id === t.id)) throw new Error(`fs22: task ${t.id} has no key`);
  }

  // ── attempts
  const { attempts, staff } = simulate(T, now);
  const tAttempts = simulateTasks(T, now, staff);
  // integrity reports for gating attempts (chronological, with every attempt as the server sees them)
  const reports = [];
  for (const a of attempts.filter((x) => x.gating)) {
    const ir = adaptiveIntegrity(a, attempts);
    const id = `ir-${a.id}`;
    reports.push({ id, kind: 'adaptive', attempt_id: a.id, person_id: a.person_id, ref_id: a.bank_id, gates: banks.find((b) => b.id === a.bank_id).gates, created_at: a.completed_at, ...ir, decision: null, reviewed_by: null, reviewed_at: null, review_note: null });
    a.integrity_id = id;
  }
  for (const a of tAttempts.filter((x) => x.gating && x.status !== 'in_progress')) {
    const task = T.performance_tasks.find((t) => t.id === a.task_id);
    const ir = taskIntegrity(a, task, tAttempts);
    const id = `ir-${a.id}`;
    reports.push({ id, kind: 'task', attempt_id: a.id, person_id: a.person_id, ref_id: a.task_id, gates: task.gates, created_at: a.submitted_at, ...ir, decision: null, reviewed_by: null, reviewed_at: null, review_note: null });
    a.integrity_id = id;
  }
  // two flagged reports already decided (one accepted, one voided), the rest wait for an assessor
  const flagged = reports.filter((r) => r.status === 'review').sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  if (flagged.length < 3) throw new Error(`fs22: expected at least three flagged integrity reports, got ${flagged.length}`);
  const acc = flagged[0];
  Object.assign(acc, { decision: 'accepted', reviewed_by: 'p-training-mgr', reviewed_at: ts(Date.parse(acc.created_at) + DAY), review_note: 'Spoke with the learner: answers were quick because the material was familiar; result stands.' });
  const voidR = flagged.find((r) => r.kind === 'adaptive' && r.flags.includes('fast_answers') && r.person_id !== 'p-nse') ?? flagged[1];
  if (voidR !== acc) {
    Object.assign(voidR, { decision: 'voided', reviewed_by: 'p-k-instructor', reviewed_at: ts(Date.parse(voidR.created_at) + DAY), review_note: 'Most answers were given in under five seconds; the attempt does not count. The learner may retake it.' });
    const va = attempts.find((a) => a.id === voidR.attempt_id) ?? tAttempts.find((a) => a.id === voidR.attempt_id);
    va.counts = false;
  }
  for (const a of [...attempts, ...tAttempts]) if (a.gating && a.status !== 'in_progress' && !a.integrity_id) throw new Error(`fs22: gating attempt ${a.id} has no integrity report`);

  // ── evidence (latest counting attempt per person and bank active; voided attempts withdrawn)
  const evidence = [];
  const latest = new Map();
  for (const a of attempts) {
    if (!a.counts) continue;
    const k = `${a.person_id}|${a.bank_id}`;
    const c = latest.get(k);
    if (!c || a.completed_at > c.completed_at) latest.set(k, a);
  }
  for (const a of attempts) for (const e of a.evidence) {
    const bank = banks.find((b) => b.id === a.bank_id);
    evidence.push({ id: evidenceId('assessment', a.id, e.skill_id), person_id: a.person_id, skill_id: e.skill_id, kind: 'assessment', ref_table: 'adaptive_attempts', ref_id: a.id, level: e.level, basis: 'evidenced', status: 'current',
      observed_on: a.completed_at.slice(0, 10), note: `Adaptive assessment ${bank.code}`, recorded_by: a.person_id, active: latest.get(`${a.person_id}|${a.bank_id}`)?.id === a.id, created_at: a.completed_at });
  }
  for (const a of tAttempts) for (const e of a.evidence) {
    const task = T.performance_tasks.find((t) => t.id === a.task_id);
    evidence.push({ id: evidenceId('assessment', a.id, e.skill_id), person_id: a.person_id, skill_id: e.skill_id, kind: 'assessment', ref_table: 'task_attempts', ref_id: a.id, level: e.level, basis: 'evidenced', status: 'current',
      observed_on: a.scored_at.slice(0, 10), note: `Performance task ${task.code}`, recorded_by: a.scored_by, active: a.counts !== false, created_at: a.scored_at });
  }
  if (evidence.some((e) => e.level > 3)) throw new Error('fs21: assessment evidence above level 3');
  T.adaptive_attempts = attempts;
  T.task_attempts = tAttempts.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.integrity_reports = reports.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ── states of the people concerned (same as fs09)
  const before71 = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const people = new Set(evidence.map((e) => e.person_id));
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
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before71.has(s.id) && before71.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs21: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
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
      if (r.code !== 'ok') throw new Error(`fs21: outlook ${o.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(o.results)) outlooksChanged++;
      o.params = r.result.params; o.results = r.result;
    }
  }
  const flaggedN = reports.filter((r) => r.status === 'review').length;
  console.log(`fs21/22: ${T.adaptive_items.length} items in ${banks.length} banks, ${attempts.length} adaptive attempts, ${tAttempts.length} task attempts, ${reports.length} integrity reports (${flaggedN} flagged), ${evidence.length} evidence rows, ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks ${outlooksChanged} changed; ${snapshots} F23 snapshots refreshed`);
}
