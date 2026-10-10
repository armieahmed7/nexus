// FS09 + FS10 (future-skills wave B · E2, M29) seed: the AI fluency ladder and the AI and digital fitness check.
// build():    reference rows: the 16 ladder cells (4 rungs x 4 UNESCO dimensions, plant examples, literacy skills, learning), the skill
//             tracks (AI literacy vs AI engineering), a target for each of the 20 job families, the dated organisation target (a
//             leadership parameter for the demo), the nine check areas and a 54-item bilingual bank (2 per area and difficulty).
// finalize(): FINALIZE_LAST and, by file name, after fs02 (the FS02 skills exist) and fs03 (final states): simulates quarterly checks
//             2025-Q4 to 2026-Q4 for active staff with the same adaptive rules as the server (nextStep, pickItem, scoreAttempt), writes
//             their F01 `assessment` evidence (ref_table fitness_attempts, level <= 2; only the latest check's rows active), re-derives the states of the people concerned and
//             rebuilds the F36 digests from the final states (as fs03 does). Fails the build if a staff persona has no rung reason
//             pointing at evidence, if any evidence exceeds level 2, or if the original 71-skill states change.
// Synthetic people only; every figure on screen comes from a stored row with a source.
import { decayModelFrom, deriveStates, evidenceId } from '../../../src/domain/skills.ts';
import { aiRung, ladderProblems, cellId } from '../../../src/modules/m29/fluency.ts';
import { itemProblem, nextStep, pickItem, scoreAttempt, quarterOfDate } from '../../../src/modules/m29/fitness.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const UNESCO = { label: 'UNESCO · AI competency framework for students and teachers (2024), via the EU AI Office living repository of AI-literacy practices', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices' };
const DIGCOMP = { label: 'European Commission JRC · DigComp, the digital competence framework for citizens', url: 'https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en' };
const UAEAI = { label: 'Khaleej Times · Abu Dhabi to train 23,000 government employees in AI by 2027', url: 'https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027' };
const IAEA_AI = { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence' };

// ───────────── Skill tracks: literacy (everyone; raises the rung) vs engineering (specialists; shown apart)
export const TRACKS = [
  ['sk-fs-ai-use', 'literacy', 'Using approved AI tools well is literacy everyone needs.', 'استخدام أدوات الذكاء الاصطناعي المعتمدة بشكل جيد إلمام يحتاجه الجميع.'],
  ['sk-fs-ai-verify', 'literacy', 'Checking and challenging AI output is the core literacy skill in a nuclear plant.', 'التحقق من مخرجات الذكاء الاصطناعي والطعن فيها هو جوهر الإلمام في محطة نووية.'],
  ['sk-fs-ai-prompt', 'literacy', 'Asking AI tools clear, bounded questions is part of everyday use.', 'طرح أسئلة واضحة ومحددة على أدوات الذكاء الاصطناعي جزء من الاستخدام اليومي.'],
  ['sk-fs-ai-data-care', 'literacy', 'Knowing what data may and may not go into a tool protects people and the plant.', 'معرفة البيانات التي يجوز إدخالها في الأداة وتلك التي لا يجوز تحمي الأفراد والمحطة.'],
  ['sk-fs-ai-plantdata', 'literacy', 'Judging whether data is fit for a decision is literacy, not engineering.', 'الحكم على صلاحية البيانات لاتخاذ القرار إلمام وليس هندسة.'],
  ['sk-fs-ai-anomaly', 'literacy', 'Triaging AI alerts with independent indications is an operational literacy skill.', 'فرز تنبيهات الذكاء الاصطناعي بمؤشرات مستقلة مهارة إلمام تشغيلية.'],
  ['sk-fs-tr-techlit', 'literacy', 'Technological literacy (WEF core skill) underpins every rung.', 'الإلمام التقني (مهارة أساسية لدى المنتدى الاقتصادي العالمي) أساس كل درجة.'],
  ['sk-da-01', 'literacy', 'Digital tools and data literacy: the established foundation skill.', 'الإلمام بالأدوات الرقمية والبيانات: مهارة الأساس القائمة.'],
  ['sk-da-01-analysis', 'literacy', 'Reading and presenting data is part of using AI results responsibly.', 'قراءة البيانات وعرضها جزء من الاستخدام المسؤول لنتائج الذكاء الاصطناعي.'],
  ['sk-da-02', 'literacy', 'Governed use of AI: the established policy skill.', 'الاستخدام المحوكم للذكاء الاصطناعي: مهارة السياسات القائمة.'],
  ['sk-da-02-review', 'literacy', 'Reviewing AI outputs under governance is assurance literacy.', 'مراجعة مخرجات الذكاء الاصطناعي ضمن الحوكمة إلمام بالضمان.'],
  ['sk-fs-ai-dataeng', 'engineering', 'Building data pipelines is AI engineering for specialists; it never raises the literacy rung.', 'بناء مسارات البيانات هندسة ذكاء اصطناعي للمتخصصين؛ ولا يرفع درجة الإلمام أبداً.'],
  ['sk-fs-ai-automation', 'engineering', 'Designing automations is specialist engineering, shown apart from literacy.', 'تصميم الأتمتة هندسة تخصصية تُعرض بمعزل عن الإلمام.'],
  ['sk-da-01-scripting', 'engineering', 'Scripting is an engineering skill; useful, but not literacy.', 'البرمجة النصية مهارة هندسية؛ مفيدة لكنها ليست إلماماً.'],
  ['sk-da-01-twins', 'engineering', 'Building digital twins and plant data models is engineering work.', 'بناء التوائم الرقمية ونماذج بيانات المحطة عمل هندسي.'],
  ['sk-fs-ai-twin', 'engineering', 'Validating a digital twin is a specialist engineering task.', 'التحقق من صحة التوأم الرقمي مهمة هندسية تخصصية.'],
];

// ───────────── The ladder: 4 rungs x 4 UNESCO dimensions
const RUNGS = [
  { rung: 1, key: 'aware', en: 'Aware', ar: 'مُدرِك', essence_en: 'Knows what AI tools can and cannot do, uses only approved tools and keeps a person responsible.', essence_ar: 'يعرف ما تستطيعه أدوات الذكاء الاصطناعي وما لا تستطيعه، ويستخدم الأدوات المعتمدة فقط، ويُبقي الإنسان مسؤولاً.' },
  { rung: 2, key: 'practitioner', en: 'Practitioner', ar: 'ممارِس', essence_en: 'Uses approved AI tools in daily work and routinely checks what they produce.', essence_ar: 'يستخدم أدوات الذكاء الاصطناعي المعتمدة في عمله اليومي ويتحقق بانتظام مما تنتجه.' },
  { rung: 3, key: 'builder', en: 'Builder', ar: 'بانٍ', essence_en: 'Designs governed AI-assisted ways of working for a team, with review points built in.', essence_ar: 'يصمم طرق عمل محوكمة يساعدها الذكاء الاصطناعي لفريق كامل، مع نقاط مراجعة مدمجة.' },
  { rung: 4, key: 'assurer', en: 'Assurer', ar: 'ضامِن', essence_en: 'Gives assurance that AI use is safe: verifies, challenges and signs as the accountable person.', essence_ar: 'يقدّم الضمان بأن استخدام الذكاء الاصطناعي آمن: يتحقق ويطعن ويوقّع بصفته الشخص المسؤول.' },
];
const DIMS = ['mindset', 'ethics', 'techniques', 'design'];
const LIT = {
  mindset: ['sk-fs-ai-use', 'sk-fs-tr-techlit', 'sk-da-02'],
  ethics: ['sk-fs-ai-verify', 'sk-fs-ai-data-care', 'sk-da-02-review'],
  techniques: ['sk-fs-ai-prompt', 'sk-fs-ai-use', 'sk-da-01'],
  design: ['sk-fs-ai-plantdata', 'sk-fs-ai-anomaly', 'sk-da-01-analysis'],
};
const UPPER = {
  3: { mindset: [['sk-da-02', 'sk-fs-ai-use'], 3], ethics: [['sk-fs-ai-verify', 'sk-fs-ai-data-care'], 3], techniques: [['sk-fs-ai-prompt'], 3], design: [['sk-fs-ai-plantdata', 'sk-fs-ai-anomaly'], 3] },
  4: { mindset: [['sk-da-02'], 3], ethics: [['sk-fs-ai-verify', 'sk-da-02-review'], 4], techniques: [['sk-fs-ai-prompt', 'sk-fs-ai-anomaly'], 4], design: [['sk-fs-ai-plantdata', 'sk-fs-ai-anomaly'], 4] },
};
const CELL_TEXT = {
  '1:mindset': ['Knows AI tools can be wrong while sounding confident, and that the person using them stays accountable.', 'Reads the AI-use notice on an approved assistant and can say who owns the answer it drafts.',
    'يعرف أن أدوات الذكاء الاصطناعي قد تخطئ وهي تبدو واثقة، وأن من يستخدمها يبقى مسؤولاً.', 'يقرأ إشعار الاستخدام في المساعد المعتمد ويستطيع أن يحدد من يتحمل مسؤولية الإجابة التي يصوغها.'],
  '1:ethics': ['Keeps internal, personal and plant data out of public AI tools.', 'Declines to paste a work order into a public chatbot and uses the approved assistant instead.',
    'يُبقي البيانات الداخلية والشخصية وبيانات المحطة خارج أدوات الذكاء الاصطناعي العامة.', 'يمتنع عن لصق أمر عمل في روبوت محادثة عام ويستخدم المساعد المعتمد بدلاً من ذلك.'],
  '1:techniques': ['Uses an approved assistant for simple, low-risk tasks such as drafting a routine email.', 'Asks the approved document assistant where a lesson-learned report is filed.',
    'يستخدم مساعداً معتمداً لمهام بسيطة منخفضة المخاطر مثل صياغة بريد إلكتروني روتيني.', 'يسأل مساعد الوثائق المعتمد عن مكان حفظ تقرير الدروس المستفادة.'],
  '1:design': ['Knows an AI tool is only as good as its data and the situations it has seen.', 'Notices that a trend chart has a gap and asks before using it.',
    'يعرف أن أداة الذكاء الاصطناعي جيدة بقدر جودة بياناتها والمواقف التي شهدتها.', 'يلاحظ وجود فجوة في مخطط الاتجاه ويسأل قبل استخدامه.'],
  '2:mindset': ['Chooses when AI helps and when it does not, and says when a tool helped produce work.', 'Notes "drafted with the approved assistant, checked by me" on a shift summary.',
    'يختار متى يساعد الذكاء الاصطناعي ومتى لا يساعد، ويصرّح عندما تكون أداة قد ساعدت في إنجاز العمل.', 'يكتب "صيغ بالمساعد المعتمد وراجعته بنفسي" على ملخص المناوبة.'],
  '2:ethics': ['Checks every AI output that will be relied on against a controlled source before using it.', 'Verifies an AI-generated procedure summary against the controlled document before a pre-job brief.',
    'يتحقق من كل مخرج للذكاء الاصطناعي سيُعتمد عليه مقابل مصدر مضبوط قبل استخدامه.', 'يتحقق من ملخص إجراء أنشأه الذكاء الاصطناعي مقابل الوثيقة المضبوطة قبل إحاطة ما قبل العمل.'],
  '2:techniques': ['Writes clear, bounded prompts with context, audience and format, and opens the cited sources.', 'Asks the document assistant for the three latest revisions of a procedure and opens each citation.',
    'يكتب أوامر واضحة ومحددة تتضمن السياق والجمهور والصيغة، ويفتح المصادر المستشهد بها.', 'يطلب من مساعد الوثائق آخر ثلاث مراجعات لإجراء ما ويفتح كل استشهاد.'],
  '2:design': ['Judges whether data is fit for the decision: source, period, units, gaps.', 'Spots that two vibration logs use different units before comparing them.',
    'يحكم على صلاحية البيانات للقرار: المصدر والفترة والوحدات والفجوات.', 'يلاحظ أن سجلي الاهتزاز يستخدمان وحدات مختلفة قبل مقارنتهما.'],
  '3:mindset': ['Leads a team in deciding where AI helps, where it must not be used, and how people stay in charge.', 'Agrees with the crew which reports an assistant may draft and which stay fully manual.',
    'يقود الفريق في تحديد مواضع فائدة الذكاء الاصطناعي ومواضع حظره، وكيف يبقى الإنسان صاحب القرار.', 'يتفق مع الطاقم على التقارير التي يجوز للمساعد صياغتها وتلك التي تبقى يدوية بالكامل.'],
  '3:ethics': ['Builds checks into a team workflow so verification happens every time, with a record of who checked.', 'Adds a "checked against source by" field to an AI-assisted weekly report template.',
    'يدمج عمليات التحقق في سير عمل الفريق ليحدث التحقق في كل مرة، مع سجل لمن تحقق.', 'يضيف حقل "تم التحقق مقابل المصدر بواسطة" إلى قالب تقرير أسبوعي يساعده الذكاء الاصطناعي.'],
  '3:techniques': ['Builds governed prompts and simple agents with approved tools, reading only approved sources.', 'Sets up an approved assistant to gather weekly status from three reports, reviewed by a person before sending.',
    'يبني أوامر محوكمة ووكلاء بسيطين بالأدوات المعتمدة، يقرؤون المصادر المعتمدة فقط.', 'يُعدّ مساعداً معتمداً لجمع الحالة الأسبوعية من ثلاثة تقارير، يراجعها شخص قبل الإرسال.'],
  '3:design': ['Maps an AI-assisted process end to end, with the points where a person reviews and can stop it.', 'Draws the review and stop points into an AI-ranked work-order triage.',
    'يرسم عملية يساعدها الذكاء الاصطناعي من البداية إلى النهاية، مع النقاط التي يراجع فيها الإنسان ويستطيع إيقافها.', 'يرسم نقاط المراجعة والإيقاف في فرز أوامر العمل الذي يرتبه الذكاء الاصطناعي.'],
  '4:mindset': ['Sets expectations for others and challenges over-reliance on automation.', 'Coaches a crew that stopped checking an assistant\'s summaries and restores the checks.',
    'يضع التوقعات للآخرين ويتصدى للاعتماد المفرط على الأتمتة.', 'يوجّه طاقماً توقف عن مراجعة ملخصات المساعد ويعيد عمليات التحقق.'],
  '4:ethics': ['Verifies AI output independently and signs as the accountable person; raises conflicts through technical review.', 'Independently re-derives a figure in an AI-drafted report before signing it, and records the check.',
    'يتحقق من مخرجات الذكاء الاصطناعي بشكل مستقل ويوقّع بصفته المسؤول؛ ويرفع التعارضات عبر المراجعة الفنية.', 'يعيد اشتقاق رقم في تقرير صاغه الذكاء الاصطناعي بشكل مستقل قبل توقيعه، ويسجل التحقق.'],
  '4:techniques': ['Tests AI tools on known cases before use and triages AI alerts with independent indications.', 'Scores two document assistants on 30 questions with known answers and keeps the results.',
    'يختبر أدوات الذكاء الاصطناعي على حالات معروفة قبل الاستخدام ويفرز تنبيهاتها بمؤشرات مستقلة.', 'يقيّم مساعدَين للوثائق على 30 سؤالاً معروفة الإجابة ويحتفظ بالنتائج.'],
  '4:design': ['Monitors an AI-assisted process over time: errors, overrides and drift against agreed measures.', 'Reviews override and miss rates of a SIMULATED predictive-maintenance advisor each quarter.',
    'يراقب عملية يساعدها الذكاء الاصطناعي بمرور الوقت: الأخطاء والتجاوزات والانحراف مقابل مقاييس متفق عليها.', 'يراجع كل ربع سنة معدلات التجاوز والإخفاق لمستشار صيانة تنبؤية (محاكاة).'],
};
const LEARN = {
  check: { kind: 'check', ref: 'my-ai-fitness', title_en: 'Take the AI and digital fitness check', title_ar: 'أجرِ فحص اللياقة الرقمية والذكاء الاصطناعي' },
  course: { kind: 'course', ref: 'c-ai-gov', title_en: 'Governed use of AI at work', title_ar: 'الاستخدام المحوكم للذكاء الاصطناعي في العمل' },
  verify: { kind: 'practice', ref: null, title_en: 'Verify three AI-generated summaries against controlled documents with a qualified reviewer', title_ar: 'تحقق من ثلاثة ملخصات أنشأها الذكاء الاصطناعي مقابل وثائق مضبوطة مع مراجع مؤهل' },
  build: { kind: 'practice', ref: null, title_en: 'Build one governed AI-assisted team workflow with a mentor, with review points', title_ar: 'ابنِ سير عمل واحداً محوكماً لفريقك يساعده الذكاء الاصطناعي مع موجّه، بنقاط مراجعة' },
  assure: { kind: 'practice', ref: null, title_en: 'Run a quarterly review of an AI-assisted process: errors, overrides and drift', title_ar: 'أجرِ مراجعة ربع سنوية لعملية يساعدها الذكاء الاصطناعي: الأخطاء والتجاوزات والانحراف' },
};
export function rungRows() {
  const out = [];
  for (const r of RUNGS) for (const [di, d] of DIMS.entries()) {
    const [skills, lvl] = r.rung <= 2 ? [LIT[d], r.rung] : UPPER[r.rung][d];
    const tx = CELL_TEXT[`${r.rung}:${d}`];
    const learning = r.rung === 1 ? [LEARN.course, LEARN.check] : r.rung === 2 ? (d === 'ethics' ? [LEARN.check, LEARN.verify] : [LEARN.check, LEARN.course]) : r.rung === 3 ? [LEARN.build] : [LEARN.assure, LEARN.verify];
    out.push({
      id: cellId(r.rung, d), rung: r.rung, rung_key: r.key, dimension: d, name_en: r.en, name_ar: r.ar, essence_en: r.essence_en, essence_ar: r.essence_ar,
      descriptor_en: tx[0], example_en: tx[1], descriptor_ar: tx[2], example_ar: tx[3], skill_ids: skills, min_level: lvl, learning,
      sources: d === 'ethics' && r.rung >= 2 ? [UNESCO, IAEA_AI] : [UNESCO, DIGCOMP], sort: r.rung * 10 + di,
    });
  }
  return out;
}

// ───────────── Targets for the 20 job families
const T_PRAC_VERIFY = [2, ['air:4:ethics'], 60];
const TARGETS = {
  operations: [...T_PRAC_VERIFY, 'Operators work with AI-assisted indications and summaries: Practitioner, plus the verification cell of Assurer, because AI must be challenged, not obeyed.', 'يعمل المشغلون مع مؤشرات وملخصات يساعدها الذكاء الاصطناعي: ممارِس، مع خلية التحقق من درجة ضامِن، لأن الذكاء الاصطناعي يجب أن يُطعن فيه لا أن يُطاع.'],
  maintenance: [2, ['air:3:techniques'], 55, 'Maintenance uses digital work packages and AI-ranked work orders: Practitioner, plus building governed prompts.', 'تستخدم الصيانة حزم العمل الرقمية وأوامر العمل المرتبة بالذكاء الاصطناعي: ممارِس، مع بناء أوامر محوكمة.'],
  engineering: [3, [], 65, 'Engineers design AI-assisted analyses for teams: Builder.', 'يصمم المهندسون تحليلات يساعدها الذكاء الاصطناعي للفرق: بانٍ.'],
  'radiation-protection': [...T_PRAC_VERIFY, 'Dose and survey data feed AI tools; RP staff must verify every AI output they rely on: Practitioner plus verification.', 'تغذي بيانات الجرعات والمسوح أدوات الذكاء الاصطناعي؛ ويجب على موظفي الوقاية الإشعاعية التحقق من كل مخرج يعتمدون عليه: ممارِس مع التحقق.'],
  chemistry: [2, ['air:3:design'], 55, 'Chemistry trends feed condition monitoring: Practitioner, plus mapping review points in data-driven processes.', 'تغذي اتجاهات الكيمياء مراقبة الحالة: ممارِس، مع رسم نقاط المراجعة في العمليات المعتمدة على البيانات.'],
  'nuclear-fuel': [...T_PRAC_VERIFY, 'Fuel decisions rely on verified data: Practitioner plus verification.', 'تعتمد قرارات الوقود على بيانات متحقق منها: ممارِس مع التحقق.'],
  outage: [2, ['air:3:techniques'], 55, 'Outage planning uses AI-assisted scheduling and status gathering: Practitioner, plus building governed prompts.', 'يستخدم تخطيط الانقطاع الجدولة وجمع الحالة بمساعدة الذكاء الاصطناعي: ممارِس، مع بناء أوامر محوكمة.'],
  'emergency-preparedness': [...T_PRAC_VERIFY, 'In drills, AI summaries are checked against the emergency plan: Practitioner plus verification.', 'في التمارين تُراجع ملخصات الذكاء الاصطناعي مقابل خطة الطوارئ: ممارِس مع التحقق.'],
  security: [2, [], 50, 'Career-path level only: the same literacy expectation as all staff.', 'على مستوى المسار الوظيفي فقط: توقع الإلمام نفسه المطلوب من جميع الموظفين.'],
  cyber: [2, [], 50, 'Career-path level only: the same literacy expectation as all staff.', 'على مستوى المسار الوظيفي فقط: توقع الإلمام نفسه المطلوب من جميع الموظفين.'],
  safeguards: [2, [], 50, 'Career-path level only: the same literacy expectation as all staff.', 'على مستوى المسار الوظيفي فقط: توقع الإلمام نفسه المطلوب من جميع الموظفين.'],
  quality: [...T_PRAC_VERIFY, 'Quality staff check records that AI may have drafted: Practitioner plus verification.', 'يراجع موظفو الجودة سجلات ربما صاغها الذكاء الاصطناعي: ممارِس مع التحقق.'],
  oversight: [4, [], 75, 'Independent nuclear oversight gives assurance on how AI is used: Assurer.', 'تقدّم الرقابة النووية المستقلة الضمان بشأن طريقة استخدام الذكاء الاصطناعي: ضامِن.'],
  licensing: [...T_PRAC_VERIFY, 'Licensing submissions must never rest on unverified AI output: Practitioner plus verification.', 'يجب ألا تستند وثائق الترخيص أبداً إلى مخرجات ذكاء اصطناعي غير متحقق منها: ممارِس مع التحقق.'],
  training: [3, [], 65, 'Instructors design AI-assisted learning and check AI-drafted material: Builder.', 'يصمم المدربون تعلماً يساعده الذكاء الاصطناعي ويراجعون المواد التي يصوغها: بانٍ.'],
  'health-safety': [2, [], 50, 'Practitioner: daily use with checks.', 'ممارِس: استخدام يومي مع التحقق.'],
  environment: [2, [], 50, 'Practitioner: environmental data and reporting with checks.', 'ممارِس: بيانات بيئية وتقارير مع التحقق.'],
  'supply-chain': [2, ['air:3:techniques'], 55, 'Digital procurement uses AI-assisted search and drafting: Practitioner, plus building governed prompts.', 'تستخدم المشتريات الرقمية البحث والصياغة بمساعدة الذكاء الاصطناعي: ممارِس، مع بناء أوامر محوكمة.'],
  'fire-protection': [2, [], 50, 'Practitioner: daily use with checks.', 'ممارِس: استخدام يومي مع التحقق.'],
  corporate: [2, ['air:3:techniques'], 55, 'Corporate functions draft and analyse with approved assistants: Practitioner, plus building governed prompts.', 'تصوغ الوظائف المؤسسية وتحلل بالمساعدات المعتمدة: ممارِس، مع بناء أوامر محوكمة.'],
};

// ───────────── Fitness-check areas
export const AREAS = [
  ['fa-info', 'digcomp', 'DC1', 'Information and data literacy', 'محو الأمية المعلوماتية والبياناتية', 'Finding, judging and managing data and documents, including whether plant data is fit for a decision.', 'إيجاد البيانات والوثائق وتقييمها وإدارتها، بما في ذلك صلاحية بيانات المحطة لاتخاذ القرار.', 1, ['sk-fs-ai-plantdata'], 'design'],
  ['fa-comm', 'digcomp', 'DC2', 'Communication and collaboration', 'التواصل والتعاون', 'Working together through approved digital channels and saying when AI helped.', 'العمل معاً عبر القنوات الرقمية المعتمدة والإفصاح عن مساعدة الذكاء الاصطناعي.', 1, ['sk-fs-ai-use'], 'mindset'],
  ['fa-content', 'digcomp', 'DC3', 'Digital content creation', 'إنشاء المحتوى الرقمي', 'Creating and editing documents, sheets and job aids, with AI as a drafting aid.', 'إنشاء الوثائق والجداول وأدوات العمل وتحريرها، مع الذكاء الاصطناعي كأداة صياغة.', 1, ['sk-fs-ai-prompt'], 'techniques'],
  ['fa-safety', 'digcomp', 'DC4', 'Safety', 'السلامة', 'Protecting data, devices, wellbeing and the environment; cyber hygiene awareness. Weighted 1.5.', 'حماية البيانات والأجهزة والرفاه والبيئة؛ والوعي بالنظافة السيبرانية. وزن 1.5.', 1.5, ['sk-fs-ai-data-care', 'sk-fs-cy-phishing'], 'ethics'],
  ['fa-problem', 'digcomp', 'DC5', 'Problem solving', 'حل المشكلات', 'Solving technical problems and finding the right digital response. Weighted 1.5.', 'حل المشكلات التقنية وإيجاد الاستجابة الرقمية المناسبة. وزن 1.5.', 1.5, ['sk-fs-tr-techlit'], 'mindset'],
  ['fa-ai-mindset', 'ai', 'AI1', 'Human-centred mindset', 'عقلية محورها الإنسان', 'Keeping people accountable and knowing the limits of AI.', 'إبقاء الإنسان مسؤولاً ومعرفة حدود الذكاء الاصطناعي.', 1, ['sk-fs-ai-use'], 'mindset'],
  ['fa-ai-ethics', 'ai', 'AI2', 'Ethics and assurance', 'الأخلاقيات والضمان', 'Verifying AI output and challenging it when it conflicts with sources or judgement.', 'التحقق من مخرجات الذكاء الاصطناعي والطعن فيها عند تعارضها مع المصادر أو الحكم المهني.', 1, ['sk-fs-ai-verify'], 'ethics'],
  ['fa-ai-tech', 'ai', 'AI3', 'Techniques and applications', 'التقنيات والتطبيقات', 'Prompting, checking citations and choosing the right task for a tool.', 'كتابة الأوامر والتحقق من الاستشهادات واختيار المهمة المناسبة للأداة.', 1, ['sk-fs-ai-prompt'], 'techniques'],
  ['fa-ai-design', 'ai', 'AI4', 'System design', 'تصميم الأنظمة', 'Data quality, model limits and where people review and stop an AI-assisted process.', 'جودة البيانات وحدود النماذج ومواضع مراجعة الإنسان وإيقافه للعملية.', 1, ['sk-fs-ai-plantdata'], 'design'],
];

// ───────────── Item bank: [area, difficulty, stem_en, options_en (correct first), explain_en, stem_ar, options_ar (same order), explain_ar]
const ITEMS = [
  ['fa-info', 1, 'A colleague shares a chart of feedwater temperature. What should you check first before using it?', ['Where the data came from and the period it covers', 'Whether the colours match the plant style guide', 'How many people have already viewed it'], 'Source and period decide whether data is fit for the decision.',
    'شارك زميل مخططاً لدرجة حرارة مياه التغذية. ما أول ما يجب التحقق منه قبل استخدامه؟', ['مصدر البيانات والفترة التي تغطيها', 'تطابق الألوان مع دليل أسلوب المحطة', 'عدد الأشخاص الذين اطلعوا عليه'], 'المصدر والفترة يحددان صلاحية البيانات للقرار.'],
  ['fa-info', 1, 'Which file is the controlled version of a procedure?', ['The copy in the document management system with the current revision', 'The printout in the break room', 'The version attached to last month\'s email'], 'Only the document management system holds the current controlled revision.',
    'أي ملف هو النسخة المضبوطة من الإجراء؟', ['النسخة في نظام إدارة الوثائق بالمراجعة الحالية', 'النسخة المطبوعة في غرفة الاستراحة', 'النسخة المرفقة برسالة الشهر الماضي'], 'نظام إدارة الوثائق وحده يحفظ المراجعة المضبوطة الحالية.'],
  ['fa-info', 2, 'Two trend logs disagree on the same pump\'s vibration for the same hour. What is the best first step?', ['Check the sensor IDs, units and time stamps of both sources', 'Average the two values', 'Use the one that looks more normal'], 'Disagreement usually comes from different sensors, units or clocks.',
    'يختلف سجلا اتجاه في قراءة اهتزاز المضخة نفسها للساعة نفسها. ما أفضل خطوة أولى؟', ['التحقق من معرّفات الحساسات والوحدات والطوابع الزمنية في المصدرين', 'حساب متوسط القيمتين', 'استخدام القيمة التي تبدو طبيعية أكثر'], 'ينتج الاختلاف عادة عن حساسات أو وحدات أو ساعات مختلفة.'],
  ['fa-info', 2, 'A dashboard shows a flat line at exactly zero for six hours on a running system. The most likely explanation is:', ['Missing or frozen data, which should be flagged before analysis', 'The system was perfectly stable', 'A rounding setting in the chart'], 'A perfectly flat zero on a running system is a data-quality signal.',
    'تعرض لوحة معلومات خطاً مستوياً عند الصفر تماماً لست ساعات لنظام يعمل. التفسير الأرجح هو:', ['بيانات مفقودة أو متجمدة يجب الإشارة إليها قبل التحليل', 'كان النظام مستقراً تماماً', 'إعداد تقريب في المخطط'], 'الصفر المستوي تماماً لنظام يعمل إشارة إلى مشكلة في جودة البيانات.'],
  ['fa-info', 3, 'You compare outage durations across units. One unit records the start when the permit is issued, the others when the breaker opens. What do you do?', ['Align the definition, or adjust and note it, before comparing', 'Compare as is; the difference is small', 'Drop that unit from the comparison without saying so'], 'Comparisons need one definition; any adjustment must be stated.',
    'تقارن مدد الانقطاع بين الوحدات. تسجل إحداها البداية عند إصدار التصريح، والأخرى عند فتح القاطع. ماذا تفعل؟', ['توحيد التعريف، أو التعديل مع الإشارة إليه، قبل المقارنة', 'المقارنة كما هي؛ فالفرق صغير', 'استبعاد تلك الوحدة من المقارنة دون ذكر ذلك'], 'تحتاج المقارنات إلى تعريف واحد، ويجب ذكر أي تعديل.'],
  ['fa-info', 3, 'An AI search tool returns a summary with five references; you cannot find one of them in the document system. You should:', ['Treat the summary as unverified until every reference is traced or removed', 'Keep the summary because four of five references exist', 'Ask the tool to regenerate until all five look real'], 'One untraceable reference means the summary is not yet verified.',
    'تعيد أداة بحث بالذكاء الاصطناعي ملخصاً بخمسة مراجع، ولا تجد أحدها في نظام الوثائق. عليك:', ['اعتبار الملخص غير متحقق منه حتى يُتتبع كل مرجع أو يُحذف', 'الاحتفاظ بالملخص لأن أربعة من خمسة مراجع موجودة', 'طلب إعادة التوليد حتى تبدو المراجع الخمسة حقيقية'], 'مرجع واحد لا يمكن تتبعه يعني أن الملخص لم يُتحقق منه بعد.'],

  ['fa-comm', 1, 'Which channel is right for sharing a comment on a draft procedure with your team?', ['The approved collaboration space where the draft is controlled', 'A personal messaging app group', 'A personal cloud drive link'], 'Work drafts stay in approved, controlled spaces.',
    'ما القناة المناسبة لمشاركة تعليق على مسودة إجراء مع فريقك؟', ['مساحة التعاون المعتمدة حيث تُضبط المسودة', 'مجموعة في تطبيق مراسلة شخصي', 'رابط من مساحة تخزين سحابية شخصية'], 'تبقى مسودات العمل في المساحات المعتمدة والمضبوطة.'],
  ['fa-comm', 1, 'In a video meeting, a colleague\'s screen share shows a personnel list by mistake. The best response is:', ['Tell them politely so they can stop sharing', 'Take a screenshot for later', 'Say nothing'], 'A quick, polite word protects colleagues\' personal data.',
    'في اجتماع مرئي، تعرض شاشة زميل قائمة بالموظفين عن طريق الخطأ. أفضل تصرف هو:', ['إخباره بلطف ليوقف المشاركة', 'التقاط صورة للشاشة لوقت لاحق', 'عدم قول شيء'], 'كلمة لطيفة وسريعة تحمي البيانات الشخصية للزملاء.'],
  ['fa-comm', 2, 'You used an approved AI assistant to draft a meeting summary. Before sending it you should:', ['Check it against your notes and say that an assistant helped draft it', 'Send it as is; the assistant is approved', 'Remove the action owners to keep it short'], 'Check, then be open about AI help.',
    'استخدمت مساعداً معتمداً لصياغة ملخص اجتماع. قبل إرساله عليك:', ['مراجعته مقابل ملاحظاتك والإفصاح عن مساعدة المساعد في صياغته', 'إرساله كما هو؛ فالمساعد معتمد', 'حذف أسماء المسؤولين عن الإجراءات لاختصاره'], 'تحقق أولاً، ثم أفصح عن مساعدة الذكاء الاصطناعي.'],
  ['fa-comm', 2, 'A team works across two shifts. Which practice best keeps handover information reliable?', ['One shared, structured handover record that both shifts update', 'Each shift keeps its own notes and emails the other', 'Verbal handover only'], 'One structured record avoids gaps between versions.',
    'يعمل فريق على مناوبتين. أي ممارسة تحافظ على موثوقية معلومات التسليم؟', ['سجل تسليم واحد مشترك ومنظم تحدّثه المناوبتان', 'تحتفظ كل مناوبة بملاحظاتها وترسلها بالبريد للأخرى', 'التسليم الشفهي فقط'], 'السجل المنظم الواحد يمنع الفجوات بين النسخ.'],
  ['fa-comm', 3, 'A contractor asks you to share a large data set through a personal file-transfer website because the approved route is slow. You:', ['Use the approved route or ask IT for an approved alternative', 'Use the website once, since it is faster', 'Split the file across several personal emails'], 'Speed never justifies an unapproved channel for work data.',
    'يطلب منك مقاول مشاركة مجموعة بيانات كبيرة عبر موقع شخصي لنقل الملفات لأن المسار المعتمد بطيء. أنت:', ['تستخدم المسار المعتمد أو تطلب من تقنية المعلومات بديلاً معتمداً', 'تستخدم الموقع مرة واحدة لأنه أسرع', 'تقسم الملف على عدة رسائل بريد شخصية'], 'السرعة لا تبرر أبداً استخدام قناة غير معتمدة لبيانات العمل.'],
  ['fa-comm', 3, 'You lead a cross-team review in a shared document and comments conflict. Which approach works best?', ['Assign an owner per section, resolve comments in the thread and record the decision', 'Accept the most recent comment each time', 'Copy the document so each team edits its own version'], 'Owners and recorded decisions keep one controlled version.',
    'تقود مراجعة مشتركة بين فرق في وثيقة مشتركة وتتعارض التعليقات. أي نهج هو الأفضل؟', ['تعيين مسؤول لكل قسم وحل التعليقات في سلسلتها وتسجيل القرار', 'قبول أحدث تعليق في كل مرة', 'نسخ الوثيقة لتحرر كل فرقة نسختها'], 'المسؤولون والقرارات المسجلة تحافظ على نسخة مضبوطة واحدة.'],

  ['fa-content', 1, 'Which is the clearest file name for a shared document?', ['2026-10-07_Pump-P12_inspection-notes_v2', 'notes final FINAL (2)', 'document1'], 'Date, subject, content and version make a file easy to find.',
    'ما أوضح اسم لملف وثيقة مشتركة؟', ['2026-10-07_Pump-P12_inspection-notes_v2', 'notes final FINAL (2)', 'document1'], 'التاريخ والموضوع والمحتوى والإصدار تجعل العثور على الملف سهلاً.'],
  ['fa-content', 1, 'You want to reuse a diagram from an internal training deck. What should you do?', ['Check it is the current approved version and keep its reference', 'Redraw it from memory', 'Use any version you find'], 'Reuse the approved version and keep where it came from.',
    'تريد إعادة استخدام رسم من عرض تدريبي داخلي. ماذا تفعل؟', ['التأكد من أنه النسخة المعتمدة الحالية والاحتفاظ بمرجعه', 'إعادة رسمه من الذاكرة', 'استخدام أي نسخة تجدها'], 'أعد استخدام النسخة المعتمدة واحتفظ بمصدرها.'],
  ['fa-content', 2, 'Which prompt to an approved AI assistant is most likely to give a useful first draft?', ['Summarise the attached lesson-learned report in five bullet points for shift supervisors, keeping the original terms', 'Write something about lessons', 'Make this better'], 'Context, audience, format and source make a prompt useful.',
    'أي أمر للمساعد المعتمد يرجح أن يعطي مسودة أولى مفيدة؟', ['لخّص تقرير الدروس المستفادة المرفق في خمس نقاط لمشرفي المناوبات مع الإبقاء على المصطلحات الأصلية', 'اكتب شيئاً عن الدروس', 'اجعل هذا أفضل'], 'السياق والجمهور والصيغة والمصدر تجعل الأمر مفيداً.'],
  ['fa-content', 2, 'An AI tool drafted a training quiz. What must happen before it is used?', ['A qualified instructor reviews every question and answer against the source', 'Nothing, if the tool is approved', 'A colleague checks the spelling only'], 'Learning content is reviewed by a qualified person before use.',
    'صاغت أداة ذكاء اصطناعي اختباراً تدريبياً. ما الذي يجب أن يحدث قبل استخدامه؟', ['يراجع مدرب مؤهل كل سؤال وإجابة مقابل المصدر', 'لا شيء إذا كانت الأداة معتمدة', 'يراجع زميل الإملاء فقط'], 'يراجع شخص مؤهل المحتوى التعليمي قبل استخدامه.'],
  ['fa-content', 3, 'You build a spreadsheet that others will use to plan work. What makes it most trustworthy?', ['Inputs kept apart from formulas, locked formulas, a version note and a worked check', 'Bright colours for every cell', 'Hidden formulas so no one changes them'], 'Structure, protection, versioning and a check make a tool trustworthy.',
    'تبني جدول بيانات سيستخدمه آخرون لتخطيط العمل. ما الذي يجعله أكثر موثوقية؟', ['فصل المدخلات عن الصيغ وقفل الصيغ وملاحظة إصدار ومثال تحقق محلول', 'ألوان زاهية لكل خلية', 'صيغ مخفية حتى لا يغيرها أحد'], 'البنية والحماية والإصدار ومثال التحقق تجعل الأداة موثوقة.'],
  ['fa-content', 3, 'An AI assistant offers to write a step-by-step job aid from a procedure. The right use is:', ['Use it as a draft, verify each step against the controlled procedure and get it approved before use', 'Print it for the field team straight away', 'Use it only if the steps look shorter'], 'An AI draft becomes a job aid only after verification and approval.',
    'يعرض مساعد ذكاء اصطناعي كتابة أداة عمل خطوة بخطوة من إجراء. الاستخدام الصحيح هو:', ['استخدامها كمسودة والتحقق من كل خطوة مقابل الإجراء المضبوط واعتمادها قبل الاستخدام', 'طباعتها للفريق الميداني فوراً', 'استخدامها فقط إذا بدت الخطوات أقصر'], 'تصبح مسودة الذكاء الاصطناعي أداة عمل فقط بعد التحقق والاعتماد.'],

  ['fa-safety', 1, 'An email asks you to confirm your password through a link to keep your account active. You:', ['Do not click; report it with the phishing button', 'Click and check whether the page looks real', 'Reply asking whether it is genuine'], 'Report suspected phishing; never enter credentials from an email link.',
    'تطلب منك رسالة بريد تأكيد كلمة المرور عبر رابط للإبقاء على حسابك فعالاً. أنت:', ['لا تنقر؛ وتبلغ عنها بزر التصيد', 'تنقر وتتحقق إن كانت الصفحة تبدو حقيقية', 'ترد بسؤال عن صحتها'], 'أبلغ عن التصيد المشتبه به، ولا تدخل بيانات الدخول من رابط بريد أبداً.'],
  ['fa-safety', 1, 'You find an unlabelled USB stick in the car park. What do you do?', ['Hand it in without plugging it in, following the removable-media rule', 'Plug it into a spare computer to find the owner', 'Keep it for personal use'], 'Unknown removable media is never connected.',
    'تجد ذاكرة USB دون ملصق في موقف السيارات. ماذا تفعل؟', ['تسلمها دون توصيلها وفق قاعدة الوسائط القابلة للإزالة', 'توصلها بحاسوب احتياطي لمعرفة صاحبها', 'تحتفظ بها للاستخدام الشخصي'], 'لا تُوصل أبداً وسائط قابلة للإزالة مجهولة المصدر.'],
  ['fa-safety', 2, 'Which data should never be pasted into a public AI chatbot?', ['Any internal, personal or plant data', 'A public news headline', 'A general question about spreadsheet formulas'], 'Public tools may keep what you type; internal data stays in approved tools.',
    'أي بيانات يجب ألا تُلصق أبداً في روبوت محادثة عام؟', ['أي بيانات داخلية أو شخصية أو خاصة بالمحطة', 'عنوان خبر منشور', 'سؤال عام عن صيغ الجداول'], 'قد تحتفظ الأدوات العامة بما تكتبه؛ وتبقى البيانات الداخلية في الأدوات المعتمدة.'],
  ['fa-safety', 2, 'You have worked long hours at screens for many days and feel eye strain. The best step is:', ['Take regular breaks, adjust the display and raise the workload with your supervisor', 'Turn the brightness to maximum', 'Ignore it until the outage ends'], 'Digital wellbeing is part of DigComp safety.',
    'عملت ساعات طويلة أمام الشاشات لأيام عدة وتشعر بإجهاد العين. أفضل خطوة هي:', ['أخذ فترات راحة منتظمة وضبط الشاشة ومناقشة عبء العمل مع مشرفك', 'رفع السطوع إلى الحد الأقصى', 'تجاهل الأمر حتى ينتهي الانقطاع'], 'الرفاه الرقمي جزء من مجال السلامة في إطار الكفاءة الرقمية.'],
  ['fa-safety', 3, 'A message that seems to come from a senior manager asks you to buy gift cards urgently and keep it confidential. The strongest sign of fraud is:', ['Urgency plus secrecy plus an unusual payment request', 'The message is short', 'It arrived in the morning'], 'Urgency, secrecy and unusual payments together signal fraud.',
    'رسالة تبدو من مدير أول تطلب منك شراء بطاقات هدايا بشكل عاجل وإبقاء الأمر سراً. أقوى علامة على الاحتيال هي:', ['الاستعجال مع السرية مع طلب دفع غير معتاد', 'قصر الرسالة', 'وصولها صباحاً'], 'الاستعجال والسرية والدفع غير المعتاد معاً علامات احتيال.'],
  ['fa-safety', 3, 'Your team wants a shared spreadsheet of colleagues\' phone numbers and home addresses. What is the right approach?', ['Collect only what is needed, keep it in an approved restricted location and agree who can see it', 'Share it with everyone so it is easy to find', 'Keep it on a personal phone'], 'Minimise personal data and control who sees it.',
    'يريد فريقك جدولاً مشتركاً لأرقام هواتف الزملاء وعناوين منازلهم. ما النهج الصحيح؟', ['جمع ما يلزم فقط وحفظه في موقع معتمد مقيد والاتفاق على من يطلع عليه', 'مشاركته مع الجميع ليسهل العثور عليه', 'حفظه على هاتف شخصي'], 'قلل البيانات الشخصية واضبط من يطلع عليها.'],

  ['fa-problem', 1, 'A digital form keeps rejecting your entry. What is the best first step?', ['Read the error message and check the field format', 'Close it and use paper', 'Try random values until it accepts'], 'Error messages usually say what is wrong.',
    'يرفض نموذج رقمي إدخالك مراراً. ما أفضل خطوة أولى؟', ['قراءة رسالة الخطأ والتحقق من صيغة الحقل', 'إغلاقه واستخدام الورق', 'تجربة قيم عشوائية حتى يقبل'], 'رسائل الخطأ تخبرك عادة بما هو خاطئ.'],
  ['fa-problem', 1, 'You are not sure how to use a new feature of an approved tool. Where do you start?', ['The tool\'s approved help or a trained colleague', 'An unofficial video from an unknown site', 'Guess and hope'], 'Start from approved help and people who know the tool.',
    'لست متأكداً من كيفية استخدام ميزة جديدة في أداة معتمدة. من أين تبدأ؟', ['من التعليمات المعتمدة للأداة أو زميل مدرّب', 'من فيديو غير رسمي من موقع مجهول', 'التخمين والأمل'], 'ابدأ من التعليمات المعتمدة ومن الأشخاص الذين يعرفون الأداة.'],
  ['fa-problem', 2, 'A report generator gives a different total from your manual count. What do you do?', ['Reproduce the total on a small sample to find where they differ', 'Trust the generator', 'Trust your count and ignore the generator'], 'A small reproducible sample shows where the difference comes from.',
    'يعطي مولّد تقارير مجموعاً مختلفاً عن عدّك اليدوي. ماذا تفعل؟', ['إعادة حساب المجموع على عينة صغيرة لمعرفة موضع الاختلاف', 'الثقة بالمولّد', 'الثقة بعدّك وتجاهل المولّد'], 'العينة الصغيرة القابلة للتكرار تبين مصدر الاختلاف.'],
  ['fa-problem', 2, 'You do the same 20-minute copy-and-paste task every day. The best next step is:', ['Describe the task and ask whether an approved tool or automation already does it', 'Write a macro on your own computer and share it widely', 'Keep doing it; it is only 20 minutes'], 'Look for an approved solution before building your own.',
    'تؤدي مهمة النسخ واللصق نفسها لمدة 20 دقيقة يومياً. أفضل خطوة تالية هي:', ['وصف المهمة والسؤال عن أداة أو أتمتة معتمدة تؤديها بالفعل', 'كتابة ماكرو على حاسوبك ومشاركته على نطاق واسع', 'الاستمرار؛ فهي 20 دقيقة فقط'], 'ابحث عن حل معتمد قبل أن تبني حلك الخاص.'],
  ['fa-problem', 3, 'An AI anomaly alert flags a temperature rise that the operator log does not mention. Which response fits?', ['Treat it as a prompt to check: confirm with independent indications and report per procedure', 'Dismiss it because AI alerts are often wrong', 'Act on it directly because the AI saw it first'], 'AI alerts prompt a check; independent indications and procedures decide.',
    'ينبّه نظام ذكاء اصطناعي إلى ارتفاع في درجة الحرارة لا يذكره سجل المشغل. أي استجابة مناسبة؟', ['اعتباره دافعاً للتحقق: التأكيد بمؤشرات مستقلة والإبلاغ وفق الإجراء', 'تجاهله لأن تنبيهات الذكاء الاصطناعي تخطئ كثيراً', 'التصرف مباشرة لأن الذكاء الاصطناعي رآه أولاً'], 'تنبيهات الذكاء الاصطناعي دافع للتحقق؛ والمؤشرات المستقلة والإجراءات هي التي تحسم.'],
  ['fa-problem', 3, 'Half your crew struggles with the new electronic work-package system. Which approach is most effective?', ['Short hands-on sessions on real tasks plus a go-to colleague in each crew', 'Email the full user manual', 'Wait until people learn on their own'], 'Practice on real tasks with peer support closes digital gaps fastest.',
    'يواجه نصف طاقمك صعوبة مع نظام حزم العمل الإلكترونية الجديد. أي نهج هو الأكثر فاعلية؟', ['جلسات عملية قصيرة على مهام حقيقية مع زميل مرجعي في كل طاقم', 'إرسال دليل المستخدم كاملاً بالبريد', 'الانتظار حتى يتعلم الناس بأنفسهم'], 'الممارسة على مهام حقيقية مع دعم الزملاء تسد الفجوات الرقمية أسرع.'],

  ['fa-ai-mindset', 1, 'Who is accountable for a document you prepared with help from an approved AI assistant?', ['You are', 'The AI tool', 'The tool\'s supplier'], 'The person who uses the tool owns the result.',
    'من المسؤول عن وثيقة أعددتها بمساعدة مساعد ذكاء اصطناعي معتمد؟', ['أنت', 'أداة الذكاء الاصطناعي', 'مورد الأداة'], 'من يستخدم الأداة يتحمل مسؤولية النتيجة.'],
  ['fa-ai-mindset', 1, 'Which statement about AI tools at work is true?', ['They can be wrong while sounding confident', 'They are always right if approved', 'They understand plant conditions like an operator'], 'Confident wording is not evidence of correctness.',
    'أي عبارة عن أدوات الذكاء الاصطناعي في العمل صحيحة؟', ['قد تخطئ وهي تبدو واثقة', 'هي دائماً على صواب إذا كانت معتمدة', 'تفهم ظروف المحطة كما يفهمها المشغل'], 'الصياغة الواثقة ليست دليلاً على الصحة.'],
  ['fa-ai-mindset', 2, 'When is it appropriate to use an AI assistant at work?', ['For approved uses, with approved tools, keeping a person responsible for the result', 'Whenever it saves time', 'Only when nobody will notice'], 'Approved use, approved tool, accountable person.',
    'متى يكون استخدام مساعد ذكاء اصطناعي في العمل مناسباً؟', ['في الاستخدامات المعتمدة وبالأدوات المعتمدة مع بقاء شخص مسؤول عن النتيجة', 'كلما وفر الوقت', 'فقط عندما لا يلاحظ أحد'], 'استخدام معتمد وأداة معتمدة وشخص مسؤول.'],
  ['fa-ai-mindset', 2, 'A colleague relies on an AI summary instead of reading the procedure before a task. What is the risk?', ['Missing a step or a caution the summary left out', 'Nothing; the summary is shorter', 'The procedure becomes outdated'], 'Summaries can drop steps and cautions; the procedure governs the task.',
    'يعتمد زميل على ملخص بالذكاء الاصطناعي بدلاً من قراءة الإجراء قبل مهمة. ما الخطر؟', ['إغفال خطوة أو تحذير أسقطه الملخص', 'لا شيء؛ فالملخص أقصر', 'يصبح الإجراء قديماً'], 'قد تسقط الملخصات خطوات وتحذيرات؛ والإجراء هو الذي يحكم المهمة.'],
  ['fa-ai-mindset', 3, 'Your team proposes letting an AI tool prioritise maintenance work orders. Which question matters most first?', ['Who checks the ranking and can override it, and how errors will be detected', 'How fast the tool is', 'Whether the screen layout is modern'], 'Human oversight and error detection come before speed.',
    'يقترح فريقك ترك أداة ذكاء اصطناعي ترتب أولويات أوامر الصيانة. أي سؤال هو الأهم أولاً؟', ['من يراجع الترتيب ويستطيع تجاوزه، وكيف تُكتشف الأخطاء', 'مدى سرعة الأداة', 'حداثة تصميم الشاشة'], 'الإشراف البشري واكتشاف الأخطاء يأتيان قبل السرعة.'],
  ['fa-ai-mindset', 3, 'Over-reliance on automation shows up first as:', ['People no longer checking outputs they used to check', 'More meetings', 'Longer reports'], 'Dropped checks are the first sign of over-reliance.',
    'يظهر الاعتماد المفرط على الأتمتة أولاً في:', ['توقف الناس عن مراجعة مخرجات كانوا يراجعونها', 'زيادة الاجتماعات', 'إطالة التقارير'], 'التوقف عن التحقق أول علامة على الاعتماد المفرط.'],

  ['fa-ai-ethics', 1, 'An AI tool gives a figure you cannot find in any source. You should:', ['Not use it until you can verify it', 'Use it with a footnote', 'Round it and use it'], 'Unverified figures are not used.',
    'تعطي أداة ذكاء اصطناعي رقماً لا تجده في أي مصدر. عليك:', ['عدم استخدامه حتى تتمكن من التحقق منه', 'استخدامه مع حاشية', 'تقريبه واستخدامه'], 'لا تُستخدم الأرقام غير المتحقق منها.'],
  ['fa-ai-ethics', 1, 'Which is an example of AI output verification?', ['Checking an AI-generated procedure summary against the controlled document', 'Asking the same tool whether it is sure', 'Making the text shorter'], 'Verification compares the output with an independent controlled source.',
    'أي مما يلي مثال على التحقق من مخرجات الذكاء الاصطناعي؟', ['مراجعة ملخص إجراء أنشأه الذكاء الاصطناعي مقابل الوثيقة المضبوطة', 'سؤال الأداة نفسها إن كانت متأكدة', 'تقصير النص'], 'التحقق يقارن المخرج بمصدر مضبوط مستقل.'],
  ['fa-ai-ethics', 2, 'An AI-generated summary of a technical specification leaves out a limit value. What is the right action?', ['Correct it from the controlled source and report the omission to the tool owner', 'Leave it; summaries are approximate', 'Add the limit from memory'], 'Correct from the source and report so the tool can be improved.',
    'أغفل ملخص أنشأه الذكاء الاصطناعي لمواصفة فنية قيمة حدّية. ما الإجراء الصحيح؟', ['تصحيحه من المصدر المضبوط والإبلاغ عن الإغفال لمالك الأداة', 'تركه؛ فالملخصات تقريبية', 'إضافة القيمة من الذاكرة'], 'صحح من المصدر وأبلغ ليتسنى تحسين الأداة.'],
  ['fa-ai-ethics', 2, 'A screening tool ranks applicants. What should be checked before trusting it?', ['Whether its results differ unfairly between groups and whether people can challenge them', 'Whether it ranks quickly', 'Whether it uses colour'], 'Fairness and a route to challenge come first.',
    'ترتب أداة فرز المتقدمين. ما الذي يجب التحقق منه قبل الثقة بها؟', ['ما إذا كانت نتائجها تختلف بشكل غير عادل بين الفئات وما إذا كان بإمكان الناس الطعن فيها', 'سرعة الترتيب', 'استخدامها للألوان'], 'العدالة ومسار الطعن يأتيان أولاً.'],
  ['fa-ai-ethics', 3, 'You are asked to sign off a report partly drafted by AI. What gives the strongest assurance?', ['An independent check of each claim against sources, recorded with who checked what', 'The AI\'s confidence score', 'The report reads well'], 'Independent, recorded checks are assurance; fluency is not.',
    'يُطلب منك اعتماد تقرير صاغ الذكاء الاصطناعي جزءاً منه. ما الذي يعطي أقوى ضمان؟', ['تحقق مستقل من كل ادعاء مقابل المصادر مع تسجيل من تحقق من ماذا', 'درجة ثقة الذكاء الاصطناعي', 'سلاسة قراءة التقرير'], 'التحقق المستقل المسجل ضمان؛ أما السلاسة فليست كذلك.'],
  ['fa-ai-ethics', 3, 'An AI recommendation conflicts with a qualified engineer\'s judgement on a plant issue. The correct path is:', ['Raise and resolve it through the normal technical review; the qualified person decides', 'Follow the AI because it used more data', 'Pick whichever is cheaper'], 'Conflicts go through technical review; a qualified person decides.',
    'تتعارض توصية ذكاء اصطناعي مع حكم مهندس مؤهل في مسألة تخص المحطة. المسار الصحيح هو:', ['رفعها وحلها عبر المراجعة الفنية المعتادة؛ والشخص المؤهل هو من يقرر', 'اتباع الذكاء الاصطناعي لأنه استخدم بيانات أكثر', 'اختيار الأرخص'], 'تمر التعارضات عبر المراجعة الفنية، ويقرر الشخص المؤهل.'],

  ['fa-ai-tech', 1, 'What does "prompt" mean when using an AI assistant?', ['The instruction or question you give the tool', 'The tool\'s licence key', 'The final approved output'], 'A prompt is what you ask the tool to do.',
    'ماذا يعني "الأمر" عند استخدام مساعد ذكاء اصطناعي؟', ['التعليمات أو السؤال الذي تعطيه للأداة', 'مفتاح ترخيص الأداة', 'المخرج النهائي المعتمد'], 'الأمر هو ما تطلب من الأداة فعله.'],
  ['fa-ai-tech', 1, 'Which task suits an approved AI assistant best?', ['Drafting a first version of a routine email', 'Making a safety decision', 'Approving a work permit'], 'Low-risk drafting suits assistants; decisions stay with people.',
    'أي مهمة تناسب مساعداً معتمداً أكثر؟', ['صياغة نسخة أولى من بريد روتيني', 'اتخاذ قرار يخص السلامة', 'اعتماد تصريح عمل'], 'الصياغة منخفضة المخاطر تناسب المساعدات؛ وتبقى القرارات للبشر.'],
  ['fa-ai-tech', 2, 'To get a better answer from an AI assistant, you should:', ['Give context, the audience, the format and the source to use', 'Type in capital letters', 'Ask the same thing ten times'], 'Context, audience, format and source improve answers.',
    'للحصول على إجابة أفضل من مساعد ذكاء اصطناعي، عليك:', ['إعطاء السياق والجمهور والصيغة والمصدر المطلوب', 'الكتابة بأحرف كبيرة', 'طرح السؤال نفسه عشر مرات'], 'السياق والجمهور والصيغة والمصدر تحسّن الإجابات.'],
  ['fa-ai-tech', 2, 'An AI assistant searches approved documents. How do you check its answer quickly?', ['Open the cited passages and compare them with the answer', 'Ask it to rate its own answer', 'Check the answer\'s length'], 'Citations are there to be opened.',
    'يبحث مساعد ذكاء اصطناعي في الوثائق المعتمدة. كيف تتحقق من إجابته بسرعة؟', ['فتح المقاطع المستشهد بها ومقارنتها بالإجابة', 'طلب تقييمه لإجابته', 'التحقق من طول الإجابة'], 'الاستشهادات موجودة لكي تُفتح.'],
  ['fa-ai-tech', 3, 'You set up an AI agent to collect weekly status from several reports. Which control matters most?', ['It reads only approved sources and a person reviews the output before it is sent', 'It runs at night', 'It writes in a friendly tone'], 'Bounded sources and human review are the key controls.',
    'تُعدّ وكيل ذكاء اصطناعي لجمع الحالة الأسبوعية من عدة تقارير. أي ضابط هو الأهم؟', ['أن يقرأ المصادر المعتمدة فقط وأن يراجع شخص المخرج قبل إرساله', 'أن يعمل ليلاً', 'أن يكتب بأسلوب ودود'], 'المصادر المحددة والمراجعة البشرية هما الضابطان الأساسيان.'],
  ['fa-ai-tech', 3, 'When comparing two AI tools for document search, the most useful test is:', ['The same set of real questions with known answers, scored for correct citations', 'Which tool has the nicer interface', 'Which tool answers fastest'], 'Test on known cases and score what matters: correct citations.',
    'عند المقارنة بين أداتي ذكاء اصطناعي للبحث في الوثائق، أفيد اختبار هو:', ['المجموعة نفسها من الأسئلة الحقيقية المعروفة الإجابة، مع تقييم صحة الاستشهادات', 'أي أداة واجهتها أجمل', 'أي أداة تجيب أسرع'], 'اختبر على حالات معروفة وقيّم ما يهم: صحة الاستشهادات.'],

  ['fa-ai-design', 1, 'Why does an AI tool need good-quality data?', ['Poor data leads to poor or misleading outputs', 'It makes the screen faster', 'It does not matter'], 'Output quality follows data quality.',
    'لماذا تحتاج أداة الذكاء الاصطناعي إلى بيانات جيدة؟', ['البيانات الرديئة تؤدي إلى مخرجات رديئة أو مضللة', 'لأنها تسرّع الشاشة', 'لا يهم ذلك'], 'جودة المخرجات تتبع جودة البيانات.'],
  ['fa-ai-design', 1, 'Which is a limit of an AI model trained on past plant data?', ['It may not handle situations it has never seen', 'It cannot display numbers', 'It cannot run on computers'], 'Models know only the situations in their data.',
    'أي مما يلي حدّ من حدود نموذج ذكاء اصطناعي دُرّب على بيانات سابقة للمحطة؟', ['قد لا يتعامل مع مواقف لم يرها من قبل', 'لا يستطيع عرض الأرقام', 'لا يعمل على الحواسيب'], 'لا تعرف النماذج إلا المواقف الموجودة في بياناتها.'],
  ['fa-ai-design', 2, 'A predictive-maintenance model was trained before a pump was replaced with a new design. What should happen?', ['Check whether the model still fits the new pump before relying on it', 'Keep using it unchanged', 'Delete all the old data'], 'A changed asset can make a model invalid.',
    'دُرّب نموذج للصيانة التنبؤية قبل استبدال مضخة بتصميم جديد. ما الذي يجب أن يحدث؟', ['التحقق من ملاءمة النموذج للمضخة الجديدة قبل الاعتماد عليه', 'الاستمرار في استخدامه دون تغيير', 'حذف جميع البيانات القديمة'], 'قد يجعل تغيير الأصل النموذج غير صالح.'],
  ['fa-ai-design', 2, 'When describing a workflow in which AI helps, which element must be clear?', ['The points where a person reviews and can stop the process', 'The brand of the computer', 'The font of the output'], 'Review and stop points keep people in charge.',
    'عند وصف سير عمل يساعد فيه الذكاء الاصطناعي، أي عنصر يجب أن يكون واضحاً؟', ['النقاط التي يراجع فيها شخص ويستطيع إيقاف العملية', 'علامة الحاسوب التجارية', 'خط المخرجات'], 'نقاط المراجعة والإيقاف تُبقي البشر أصحاب القرار.'],
  ['fa-ai-design', 3, 'A team designs AI-assisted triage of condition-monitoring alerts. Which design choice best supports safety?', ['Alerts are ranked, but none is suppressed without a person\'s decision, and misses are tracked', 'Low-ranked alerts are deleted automatically', 'Only the AI sees the full list'], 'Ranking may help; suppression needs a person, and misses must be measured.',
    'يصمم فريق فرزاً لتنبيهات مراقبة الحالة يساعده الذكاء الاصطناعي. أي خيار تصميمي يدعم السلامة أكثر؟', ['ترتيب التنبيهات دون إخفاء أي منها إلا بقرار شخص، مع تتبع حالات الإخفاق', 'حذف التنبيهات منخفضة الترتيب تلقائياً', 'اطلاع الذكاء الاصطناعي وحده على القائمة الكاملة'], 'قد يساعد الترتيب، أما الإخفاء فيحتاج إلى شخص، ويجب قياس حالات الإخفاق.'],
  ['fa-ai-design', 3, 'How should the performance of an AI-assisted process be monitored over time?', ['Track errors, overrides and drift against agreed measures and review them periodically', 'Check it once at launch', 'Rely on user complaints'], 'Performance drifts; it is measured and reviewed on a schedule.',
    'كيف ينبغي مراقبة أداء عملية يساعدها الذكاء الاصطناعي بمرور الوقت؟', ['تتبع الأخطاء والتجاوزات والانحراف مقابل مقاييس متفق عليها ومراجعتها دورياً', 'التحقق منها مرة واحدة عند الإطلاق', 'الاعتماد على شكاوى المستخدمين'], 'ينحرف الأداء؛ لذا يُقاس ويُراجع وفق جدول.'],
];

export function itemRows() {
  const seen = {};
  return ITEMS.map(([area, d, sen, oen, een, sar, oar, ear], i) => {
    const k = `${area}:${d}`;
    seen[k] = (seen[k] ?? 0) + 1;
    const rot = i % oen.length; // the key moves: options rotated so the right answer is not always first
    const order = oen.map((_, j) => (j + rot) % oen.length);
    const id = `fi-${area.replace(/^fa-/, '')}-${d}${String.fromCharCode(96 + seen[k])}`;
    return {
      id, area_id: area, difficulty: d, stem_en: sen, stem_ar: sar, options_en: order.map((j) => oen[j]), options_ar: order.map((j) => oar[j]), correct: order.indexOf(0),
      explain_en: een, explain_ar: ear, status: 'active', version: 1, sort: seen[k], updated_by: 'p-training-mgr', updated_at: '2026-09-15T08:00:00Z',
    };
  });
}

export default function build(T) {
  T.ai_skill_tracks = TRACKS.map(([skill_id, track, en, ar], i) => ({ id: `ast-${skill_id}`, skill_id, track, rationale_en: en, rationale_ar: ar, sort: i + 1 }));
  T.ai_rungs = rungRows();
  T.ai_role_targets = (T.job_families ?? []).map((f, i) => {
    const t = TARGETS[f.id];
    if (!t) throw new Error(`fs09: no AI fluency target for family ${f.id}`);
    return { id: `art-${f.id}`, family_id: f.id, rung: t[0], plus_cells: t[1], fitness_target: t[2], rationale_en: t[3], rationale_ar: t[4], sort: i + 1 };
  });
  T.ai_org_targets = [{
    id: 'aot-practitioner-2027', metric: 'practitioner_or_above', pct: 60, due_on: '2027-12-31',
    basis_en: 'Demo parameter: 60% of staff at Practitioner or above by the end of 2027. A leadership decision shown beside the measured value, not a claim.',
    basis_ar: 'معامل للعرض التوضيحي: 60% من الموظفين في درجة ممارِس أو أعلى بنهاية 2027. قرار قيادي يُعرض بجانب القيمة المقيسة، وليس ادعاءً.',
    set_by_en: 'Leadership parameter (demo)', set_by_ar: 'معامل قيادي (عرض توضيحي)', benchmark_ids: ['UAE-AI'], sources: [UAEAI], as_of: AS_OF,
  }];
  T.fitness_areas = AREAS.map(([id, framework, code, en, ar, sen, sar, weight, skill_ids, dimension], i) => ({
    id, framework, code, name_en: en, name_ar: ar, summary_en: sen, summary_ar: sar, weight, skill_ids, dimension, sources: [framework === 'digcomp' ? DIGCOMP : UNESCO], sort: i + 1,
  }));
  T.fitness_items = itemRows();
  T.fitness_attempts = [];
  const areaIds = T.fitness_areas.map((a) => a.id);
  for (const it of T.fitness_items) {
    const p = itemProblem(it, areaIds);
    if (p) throw new Error(`fs09: item ${it.id} fails the item check (${p})`);
  }
}

// ───────────── Simulated quarterly checks (finalize)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const QUARTERS = [['2025-Q4', '2025-11-'], ['2026-Q1', '2026-02-'], ['2026-Q2', '2026-05-'], ['2026-Q3', '2026-08-']];
const FORCE_Q4 = ['p-sro'];
const STAFF_ROLES = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin'];

export function simulate(T, now) {
  const areas = T.fitness_areas.map((a) => ({ ...a, weight: Number(a.weight) }));
  const items = T.fitness_items;
  const personaIds = new Set(T.people.filter((x) => x.persona_id).map((x) => x.id));
  const roles = new Map();
  for (const r of T.role_assignments ?? []) if (r.status === 'active') (roles.get(r.person_id) ?? roles.set(r.person_id, new Set()).get(r.person_id)).add(r.role);
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && [...(roles.get(p.id) ?? [])].some((r) => STAFF_ROLES.includes(r)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const attempts = [];
  const evidence = [];
  for (const p of staff) {
    const persona = personaIds.has(p.id);
    const base = 0.08 + 0.5 * rnd(`theta:${p.id}`);
    const lead = p.id === 'p-k-ro';
    const plan = QUARTERS.map(([q], qi) => ({ q, qi, take: lead || (persona && qi === 3) || rnd(`take:${p.id}:${q}`) < 0.55 }));
    // a few people (non-personas, plus the demo persona in FORCE_Q4) already took this quarter's check
    const q4 = FORCE_Q4.includes(p.id) || (!persona && rnd(`q4:${p.id}`) < 0.2);
    if (q4) plan.push({ q: '2026-Q4', qi: 4, take: true });
    let no = 0;
    for (const { q, qi, take } of plan) {
      if (!take) continue;
      no++;
      const growth = lead ? 0.13 * qi : 0.03 * qi;
      const responses = [];
      for (;;) {
        const step = nextStep(areas, responses);
        if (!step) break;
        const item = pickItem(items, step, new Set(responses.map((r) => r.item_id)), no);
        if (!item) break;
        const mod = (rnd(`area:${p.id}:${step.area_id}`) - 0.5) * 0.3;
        const pr = Math.max(0.05, Math.min(0.95, base + mod + growth - (step.difficulty - 2) * 0.25 + (persona ? 0.05 : 0)));
        const correct = rnd(`ans:${p.id}:${q}:${item.id}`) < pr;
        const wrong = (item.correct + 1 + Math.floor(rnd(`w:${p.id}:${item.id}`) * (item.options_en.length - 1))) % item.options_en.length;
        responses.push({ item_id: item.id, area_id: item.area_id, difficulty: item.difficulty, choice: correct ? item.correct : wrong, correct });
      }
      const sc = scoreAttempt(areas, responses);
      const day = q === '2026-Q4' ? 1 + Math.floor(rnd(`d:${p.id}:${q}`) * 8) : 2 + Math.floor(rnd(`d:${p.id}:${q}`) * 26);
      const date = q === '2026-Q4' ? `2026-10-${String(day).padStart(2, '0')}` : `${QUARTERS[qi][1]}${String(day).padStart(2, '0')}`;
      if (quarterOfDate(date) !== q || date > now) throw new Error(`fs09: bad simulated date ${date} for ${q}`);
      const mm = 10 + Math.floor(rnd(`m:${p.id}:${q}`) * 40);
      const id = `fa-${p.id.replace(/^[pw]-/, '')}-${q.toLowerCase().replace('-', '')}`;
      attempts.push({
        id, person_id: p.id, period: q, attempt_no: no, status: 'completed', started_at: `${date}T09:${String(mm - 9).padStart(2, '0')}:00Z`, completed_at: `${date}T09:${String(mm).padStart(2, '0')}:00Z`,
        responses, current_item_id: null, item_count: responses.length, area_levels: sc.levels, score: sc.score, band: sc.band, reasons: sc.reasons, evidence: sc.evidence,
      });
      for (const e of sc.evidence) {
        evidence.push({
          id: evidenceId('assessment', id, e.skill_id), person_id: p.id, skill_id: e.skill_id, kind: 'assessment', ref_table: 'fitness_attempts', ref_id: id, level: e.level,
          basis: 'evidenced', status: 'current', observed_on: date, note: `AI and digital fitness check ${q}`, recorded_by: p.id, active: true, created_at: `${date}T09:${String(mm).padStart(2, '0')}:00Z`,
        });
      }
    }
  }
  // The latest check replaces the evidence of earlier ones (kept, inactive), exactly as kafaa_submit_fitness / submitFitness do.
  const latest = new Map();
  for (const a of attempts) { const c = latest.get(a.person_id); if (!c || a.completed_at > c.completed_at) latest.set(a.person_id, a); }
  for (const e of evidence) e.active = latest.get(e.person_id)?.id === e.ref_id;
  return { attempts, evidence };
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const probs = ladderProblems(T.ai_rungs, T.ai_skill_tracks);
  if (probs.length) throw new Error(`fs09: ladder problems: ${probs.join('; ')}`);
  const { attempts, evidence } = simulate(T, now);
  if (evidence.some((e) => e.level > 2)) throw new Error('fs09: fitness evidence above level 2');
  T.fitness_attempts = attempts;
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
  if (changed.length) throw new Error(`fs09: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests read the final states: rebuild them the same way fs03 does (they must equal a recompute).
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  const tested = new Set(attempts.map((a) => a.person_id));
  // F23 reserve members who are current staff carry a snapshot of their final F01 states (f23 builds it earlier): refresh it for
  // the members who took a fitness check, with the same rule.
  let snapshots = 0;
  for (const m of T.alumni ?? []) {
    if (!tested.has(m.person_id)) continue;
    const snap = snapshotFrom(T.person_skills.filter((s) => s.person_id === m.person_id), T.skills);
    if (JSON.stringify(snap) !== JSON.stringify(m.skill_snapshot)) { m.skill_snapshot = snap; snapshots++; }
  }
  // F35 stored outlooks read the final states as well (f35 finalizes before this file): recompute their results in place with
  // the same rule, so each stored result still equals what the server computes for its stored parameters.
  let outlooksChanged = 0;
  if (T.skill_outlooks?.length) {
    const inp = inputFromTables((t) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = outlookFor(inp, o.params);
      if (r.code !== 'ok') throw new Error(`fs09: outlook ${o.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(o.results)) outlooksChanged++;
      o.params = r.result.params; o.results = r.result;
    }
  }
  // Acceptance (FS09): every staff persona with ai_literacy Own sees a rung with a reason pointing at evidence.
  const by = new Map();
  for (const s of T.person_skills) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const missing = T.people.filter((p) => p.persona_id && p.kind === 'staff' && tested.has(p.id)).filter((p) => {
    const r = aiRung(p.id, T.ai_rungs, T.ai_skill_tracks, by.get(p.id) ?? []);
    return !r.reasons.some((x) => x.ref?.table === 'skill_evidence');
  });
  if (missing.length) throw new Error(`fs09: staff personas without an evidence-backed rung reason: ${missing.map((p) => p.persona_id).join(', ')}`);
  console.log(`fs09: ${attempts.length} fitness attempts for ${tested.size} staff, ${evidence.length} assessment evidence rows (level <= 2), ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks recomputed (${outlooksChanged} changed); ${snapshots} F23 member snapshots refreshed`);
}
