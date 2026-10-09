// F14 (wave 2 · E3) seed: knowledge refreshers. Synthetic people only.
//  - 20 more OPEN PRACTICE-BANK items (approved, public, generic fundamentals) on four competencies that operators' and EP roles
//    need (thermodynamics, procedure use, reactivity management, emergency response), so topic weighting has something to weigh.
//    Generic teaching questions only: no exam content, no secure-bank items, no plant security arrangements.
//  - Leitner refresher states for the demo personas (k-ro, sro, qc-inspector, outage-planner) and a deterministic population of
//    w-* staff, replayed through the same schedule as both backends (src/modules/m19/refresh.ts applyAnswer), so the instructor
//    view has item difficulty cells at or above 10 people and others that are suppressed
//  - cadence preferences (daily, weekly or paused). No streaks, points or rankings anywhere.
// Ids are stable: it-rf-*, rs:<person>:<item>, rp:<person>.
import { applyAnswer, addDaysIso } from '../../../src/modules/m19/refresh.ts';

function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [id, competency, topic_en, difficulty, stem_en, stem_ar, options [[en, ar] x4], answer index, rationale_en, rationale_ar]
const ITEMS = [
  ['it-rf-thermo-01', 'pf-02', 'Thermodynamics', 'easy', 'Heat passes from the fuel cladding to the reactor coolant mainly by:', 'تنتقل الحرارة من غلاف الوقود إلى مبرّد المفاعل أساساً بواسطة:',
    [['Thermal radiation', 'الإشعاع الحراري'], ['Forced convection', 'الحمل القسري'], ['Sublimation', 'التسامي'], ['Magnetic induction', 'الحث المغناطيسي']], 1,
    'Pumped coolant flowing past the cladding carries the heat away by forced convection.', 'يحمل المبرّد المدفوع بالمضخات الحرارةَ بعيداً عن الغلاف بالحمل القسري.'],
  ['it-rf-thermo-02', 'pf-02', 'Thermodynamics', 'easy', 'When the pressure of water is raised, its boiling point:', 'عند رفع ضغط الماء فإن درجة غليانه:',
    [['Rises', 'ترتفع'], ['Falls', 'تنخفض'], ['Stays the same', 'تبقى كما هي'], ['Drops to zero', 'تهبط إلى الصفر']], 0,
    'A pressurised water reactor keeps its primary coolant at high pressure so it stays liquid at high temperature.', 'يحافظ مفاعل الماء المضغوط على مبرّده الأولي عند ضغط مرتفع ليبقى سائلاً عند درجات حرارة عالية.'],
  ['it-rf-thermo-03', 'pf-02', 'Thermodynamics', 'medium', 'Subcooling margin describes:', 'يصف هامش التبريد دون الإشباع:',
    [['How far the coolant temperature is below saturation at the current pressure', 'مقدار انخفاض حرارة المبرّد عن حرارة الإشباع عند الضغط الحالي'], ['The coolant flow rate', 'معدل تدفق المبرّد'], ['How much hotter the fuel is than the coolant', 'مقدار زيادة حرارة الوقود على حرارة المبرّد'], ['The pressure of the secondary side', 'ضغط الجانب الثانوي']], 0,
    'A positive subcooling margin means the coolant is liquid with room to spare before it would boil.', 'يعني هامش التبريد الموجب أن المبرّد سائل مع متسع قبل أن يبلغ الغليان.'],
  ['it-rf-thermo-04', 'pf-02', 'Thermodynamics', 'medium', 'In a pressurised water reactor steam generator, primary and secondary water:', 'في مولّد البخار لمفاعل الماء المضغوط، فإن الماء الأولي والثانوي:',
    [['Mix together', 'يختلطان معاً'], ['Are separated by tube walls and exchange heat only', 'يفصل بينهما جدار الأنابيب ويتبادلان الحرارة فقط'], ['Both boil', 'يغليان كلاهما'], ['Flow in the same pipe', 'يجريان في الأنبوب نفسه']], 1,
    'The tubes are a boundary: heat crosses them, water does not.', 'الأنابيب حدٌّ فاصل: تعبرها الحرارة ولا يعبرها الماء.'],
  ['it-rf-thermo-05', 'pf-02', 'Thermodynamics', 'hard', 'Natural circulation in a coolant loop relies on:', 'يعتمد الدوران الطبيعي في حلقة التبريد على:',
    [['Pumps running at low speed', 'تشغيل المضخات بسرعة منخفضة'], ['Density differences between hot and cold water, with the heat sink above the heat source', 'فرق الكثافة بين الماء الساخن والبارد مع وجود المصرف الحراري أعلى من مصدر الحرارة'], ['Gravity draining the loop', 'تصريف الحلقة بالجاذبية'], ['Steam injection', 'حقن البخار']], 1,
    'Warmer, lighter water rises from the core and cooler, denser water sinks back, so flow continues without pumps.', 'يرتفع الماء الأدفأ والأخف من القلب ويهبط الماء الأبرد والأكثف عائداً، فيستمر التدفق دون مضخات.'],
  ['it-rf-proc-01', 'co-01', 'Procedure use', 'easy', 'Place-keeping in a procedure means:', 'تعني متابعة الموضع في الإجراء:',
    [['Marking steps as they are completed so none is skipped or repeated', 'تعليم الخطوات عند إنجازها كي لا تُتخطى خطوة أو تُكرر'], ['Keeping the procedure in its place in the control room', 'إبقاء الإجراء في مكانه في غرفة التحكم'], ['Reading the procedure once before starting', 'قراءة الإجراء مرة واحدة قبل البدء'], ['Memorising the steps', 'حفظ الخطوات عن ظهر قلب']], 0,
    'Place-keeping is a human performance tool that prevents omitted or repeated steps.', 'متابعة الموضع أداة من أدوات الأداء البشري تمنع إغفال الخطوات أو تكرارها.'],
  ['it-rf-proc-02', 'co-01', 'Procedure use', 'easy', 'If a procedure step cannot be performed as written, you should:', 'إذا تعذّر تنفيذ خطوة في الإجراء كما هي مكتوبة، فعليك:',
    [['Improvise the closest equivalent', 'ارتجال أقرب بديل'], ['Skip it and continue', 'تخطيها والمتابعة'], ['Stop and get guidance before continuing', 'التوقف وطلب التوجيه قبل المتابعة'], ['Finish the rest and report later', 'إكمال الباقي والإبلاغ لاحقاً']], 2,
    'Stop when unsure: the procedure is changed or a decision is made by the right people before work continues.', 'توقف عند الشك: يُعدَّل الإجراء أو يتخذ الأشخاص المعنيون القرار قبل متابعة العمل.'],
  ['it-rf-proc-03', 'co-01', 'Procedure use', 'medium', 'A "continuous use" procedure is one where:', 'الإجراء "المستمر الاستخدام" هو الذي:',
    [['Each step is read and performed in order with the procedure in hand', 'تُقرأ فيه كل خطوة وتُنفذ بالترتيب والإجراء في اليد'], ['The user may work from memory', 'يمكن للمستخدم العمل فيه من الذاكرة'], ['It is used for reference only', 'يُستخدم مرجعاً فقط'], ['Steps can be done in any order', 'يمكن تنفيذ خطواته بأي ترتيب']], 0,
    'Use categories set how closely a procedure must be followed; continuous use means step by step, in hand.', 'تحدد فئات الاستخدام مدى التقيد بالإجراء؛ والاستخدام المستمر يعني خطوة بخطوة والإجراء في اليد.'],
  ['it-rf-proc-04', 'co-01', 'Procedure use', 'medium', 'Before using a procedure, first confirm that:', 'قبل استخدام إجراء، تحقّق أولاً من أنه:',
    [['It is the current approved revision', 'المراجعة المعتمدة الحالية'], ['It is the shortest version', 'النسخة الأقصر'], ['A colleague has used it before', 'استخدمه زميل من قبل'], ['It has no notes or cautions', 'لا يحتوي على ملاحظات أو تحذيرات']], 0,
    'Working from a superseded revision is a common error precursor.', 'العمل بمراجعة ملغاة من المؤشرات الشائعة على وقوع الخطأ.'],
  ['it-rf-proc-05', 'co-01', 'Procedure use', 'hard', 'Notes and cautions placed before a step are there to:', 'الملاحظات والتحذيرات الواردة قبل الخطوة غرضها:',
    [['Fill space on the page', 'ملء الصفحة'], ['Give information needed before the step is done, such as hazards or conditions', 'تقديم معلومات لازمة قبل تنفيذ الخطوة مثل المخاطر أو الشروط'], ['Replace the step', 'أن تحل محل الخطوة'], ['Apply to supervisors only', 'أن تخص المشرفين فقط']], 1,
    'Read notes and cautions before the step they precede; they often hold the reason the step is written as it is.', 'اقرأ الملاحظات والتحذيرات قبل الخطوة التي تسبقها؛ فهي غالباً تحمل سبب كتابة الخطوة بهذا الشكل.'],
  ['it-rf-react-01', 'co-03', 'Reactivity management', 'easy', 'Reactivity management is about:', 'تتعلق إدارة التفاعلية بـ:',
    [['Controlling changes to the reactor\'s neutron population deliberately and conservatively', 'التحكم المتعمد والمتحفظ في التغيرات على عدد النيوترونات في المفاعل'], ['Managing staff rosters', 'إدارة جداول الموظفين'], ['Tracking chemical stock', 'تتبع مخزون المواد الكيميائية'], ['Scheduling outages', 'جدولة الانقطاعات']], 0,
    'Every action that can change reactivity is planned, briefed and monitored.', 'كل إجراء قد يغيّر التفاعلية يُخطط له ويُشرح مسبقاً ويُراقب.'],
  ['it-rf-react-02', 'co-03', 'Reactivity management', 'easy', 'Before a planned reactivity change, crews normally:', 'قبل تغيير مخطط في التفاعلية، يقوم الطاقم عادةً بـ:',
    [['Hold a brief covering the expected response and stop criteria', 'عقد إحاطة تغطي الاستجابة المتوقعة ومعايير التوقف'], ['Skip the brief to save time', 'تخطي الإحاطة لتوفير الوقت'], ['Change several parameters at once', 'تغيير عدة معاملات دفعة واحدة'], ['Wait for an alarm', 'انتظار إنذار']], 0,
    'Knowing the expected response in advance is what makes an unexpected one visible.', 'معرفة الاستجابة المتوقعة مسبقاً هي ما يجعل أي استجابة غير متوقعة ظاهرة.'],
  ['it-rf-react-03', 'co-03', 'Reactivity management', 'medium', 'Raising the boron concentration in pressurised water reactor coolant generally:', 'رفع تركيز البورون في مبرّد مفاعل الماء المضغوط عموماً:',
    [['Adds positive reactivity', 'يضيف تفاعلية موجبة'], ['Adds negative reactivity', 'يضيف تفاعلية سالبة'], ['Has no effect', 'ليس له أثر'], ['Raises turbine speed', 'يرفع سرعة التوربين']], 1,
    'Boron absorbs neutrons, so more boron means fewer fissions.', 'يمتص البورون النيوترونات، فزيادة البورون تعني انشطارات أقل.'],
  ['it-rf-react-04', 'co-03', 'Reactivity management', 'medium', 'If the reactor does not respond as expected to a reactivity change, the conservative action is to:', 'إذا لم يستجب المفاعل كما هو متوقع لتغيير في التفاعلية، فالإجراء المتحفظ هو:',
    [['Continue faster', 'المتابعة بسرعة أكبر'], ['Stop, stabilise the plant and understand why', 'التوقف وتثبيت المحطة وفهم السبب'], ['Ignore it if the change is small', 'تجاهله إن كان التغيير صغيراً'], ['Repeat the change', 'تكرار التغيير']], 1,
    'Conservative decision-making: when in doubt, place the plant in a known, stable condition.', 'اتخاذ القرار المتحفظ: عند الشك، ضع المحطة في حالة معروفة ومستقرة.'],
  ['it-rf-react-05', 'co-03', 'Reactivity management', 'hard', 'After a reduction in reactor power, xenon-135 first:', 'بعد خفض قدرة المفاعل، فإن الزينون-135 في البداية:',
    [['Decreases immediately', 'ينخفض فوراً'], ['Builds up for several hours, adding negative reactivity', 'يتراكم لعدة ساعات مضيفاً تفاعلية سالبة'], ['Has no effect', 'ليس له أثر'], ['Becomes a fuel', 'يصبح وقوداً']], 1,
    'Xenon keeps being produced from iodine decay while fewer neutrons burn it away, so it peaks some hours later.', 'يستمر إنتاج الزينون من تحلل اليود بينما تقل النيوترونات التي تستهلكه، فيبلغ ذروته بعد عدة ساعات.'],
  ['it-rf-ep-01', 'ep-01', 'Emergency response', 'easy', 'The public guidance "Go In, Stay In, Listen In" advises people to:', 'ترشد التوجيهات العامة "ادخل، ابقَ في الداخل، استمع" الناسَ إلى:',
    [['Go indoors, stay indoors and follow official information', 'الدخول إلى المباني والبقاء فيها ومتابعة المعلومات الرسمية'], ['Leave the area at once by car', 'مغادرة المنطقة فوراً بالسيارة'], ['Gather outside', 'التجمع في الخارج'], ['Call the plant directly', 'الاتصال بالمحطة مباشرة']], 0,
    'Sheltering indoors and listening to the authorities is the first protective action asked of the public.', 'الاحتماء داخل المباني والاستماع إلى السلطات هو أول إجراء وقائي يُطلب من الجمهور.'],
  ['it-rf-ep-02', 'ep-01', 'Emergency response', 'easy', 'In the emergency response organisation, each position:', 'في منظمة الاستجابة للطوارئ، لكل منصب:',
    [['Has a defined role, qualification and responsibilities', 'دور ومؤهل ومسؤوليات محددة'], ['Is filled by whoever arrives first', 'من يصل أولاً'], ['Needs no training', 'لا يحتاج إلى تدريب'], ['Is the same as the normal job', 'نفس الوظيفة المعتادة']], 0,
    'ERO positions are staffed by people qualified for that position, with alternates.', 'يشغل مناصب منظمة الاستجابة أشخاص مؤهلون لها، مع بدلاء.'],
  ['it-rf-ep-03', 'ep-01', 'Emergency response', 'medium', 'Emergency drills and exercises are held to:', 'تُجرى تمارين الطوارئ والتدريبات العملية من أجل:',
    [['Practise roles, test procedures and find improvements', 'التمرّن على الأدوار واختبار الإجراءات وإيجاد التحسينات'], ['Replace training', 'الاستغناء عن التدريب'], ['Avoid real emergencies', 'تجنب الطوارئ الحقيقية'], ['Test the weather', 'اختبار الطقس']], 0,
    'Drills build proficiency and their critiques feed corrective actions.', 'تبني التمارين الكفاءة وتغذي مراجعاتها الإجراءات التصحيحية.'],
  ['it-rf-ep-04', 'ep-01', 'Emergency response', 'medium', 'When an emergency is declared, staff without an emergency role should:', 'عند إعلان حالة طوارئ، على الموظفين الذين ليس لهم دور في الطوارئ:',
    [['Follow site instructions and announcements', 'اتباع تعليمات الموقع وإعلاناته'], ['Go to the control room', 'التوجه إلى غرفة التحكم'], ['Leave without instructions', 'المغادرة دون تعليمات'], ['Call friends for information', 'الاتصال بالأصدقاء لمعرفة الأخبار']], 0,
    'Clear announcements keep people safe and keep responders free to do their jobs.', 'تحافظ الإعلانات الواضحة على سلامة الناس وتتيح للمستجيبين أداء مهامهم.'],
  ['it-rf-ep-05', 'ep-01', 'Emergency response', 'hard', 'Notifications to off-site authorities during an emergency must be:', 'يجب أن تكون الإخطارات الموجهة إلى السلطات خارج الموقع أثناء الطوارئ:',
    [['Timely and accurate, through the agreed channels', 'في وقتها ودقيقة وعبر القنوات المتفق عليها'], ['Delayed until the event is over', 'مؤجلة حتى انتهاء الحدث'], ['Made by any employee', 'صادرة عن أي موظف'], ['Posted on social media first', 'منشورة على وسائل التواصل أولاً']], 0,
    'Notification is a designated ERO duty with set time limits and set channels.', 'الإخطار مهمة محددة في منظمة الاستجابة ولها مهل وقنوات محددة.'],
];
const REF = 'Generic nuclear fundamentals (open practice bank)';
const P_CORRECT = { easy: 0.8, medium: 0.62, hard: 0.45 };
// items with a striking difficulty, so the instructor view shows a flag on each side
const TWEAK = { 'it-rf-ep-01': 0.97, 'it-rf-react-05': 0.22 };

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  T.refresh_state ??= [];
  T.refresh_prefs ??= [];
  for (const [id, comp, topic, difficulty, stem_en, stem_ar, opts, ans, rat_en, rat_ar] of ITEMS) {
    if (T.items.some((i) => i.id === id)) continue;
    const ids = ['a', 'b', 'c', 'd'];
    T.items.push({ id, bank: 'practice', is_practice: true, competency_id: comp, task_id: null, topic, difficulty, reference: REF, current_version: 1, status: 'approved',
      writer_person_id: null, reviewer_person_id: null, approver_person_id: null, p_value: null, discrimination: null });
    T.item_versions.push({ id: `${id}-v1`, item_id: id, version: 1, is_practice: true, stem_en, stem_ar, options: opts.map(([en, ar], k) => ({ id: ids[k], en, ar })), answer: ids[ans],
      rationale_en: rat_en, rationale_ar: rat_ar, created_at: `${today}T00:00:00Z`, author_person_id: null, change_note: null });
  }
  const pool = T.items.filter((i) => i.bank === 'practice' && i.is_practice && i.status === 'approved' && i.competency_id).sort((a, b) => (a.id < b.id ? -1 : 1));
  const states = new Map();
  // replay answers through the shared schedule; `days` = days before today, oldest first
  const replay = (person, itemId, answers) => {
    const it = pool.find((i) => i.id === itemId);
    if (!it) throw new Error(`f14: not a practice item ${itemId}`);
    let st;
    for (const [daysAgo, ok] of answers) {
      const day = addDaysIso(today, -daysAgo);
      const n = applyAnswer(st, ok, day);
      st = { id: `rs:${person}:${itemId}`, person_id: person, item_id: itemId, competency_id: it.competency_id, box: n.box, due_on: n.due_on, last_result: n.last_result,
        last_at: `${day}T07:30:00Z`, attempts: n.attempts, correct: n.correct, created_at: st?.created_at ?? `${day}T07:30:00Z` };
    }
    states.set(st.id, st);
  };

  // ── curated demo personas (all answers before Monday 5 Oct, so this week's quota is still open)
  const curated = {
    'p-k-ro': [['it-basics-01', [[40, true], [37, true], [30, true]]], ['it-basics-02', [[40, false], [38, true]]], ['it-basics-03', [[38, true], [35, true]]], ['it-hu-01', [[33, true]]],
      ['it-rf-react-01', [[20, true], [17, true]]], ['it-rf-react-03', [[20, false]]], ['it-rf-proc-01', [[18, true], [15, true], [8, true]]], ['it-rf-proc-02', [[18, true]]], ['it-rf-thermo-01', [[12, false], [11, true]]]],
    'p-sro': [['it-rf-react-02', [[30, true], [27, true], [20, true], [9, true]]], ['it-rf-react-04', [[25, true], [22, true]]], ['it-rf-proc-03', [[16, false]]], ['it-basics-04', [[14, true]]]],
    'p-qc-inspector': [['it-hu-02', [[21, true], [18, true]]], ['it-hu-03', [[21, false], [20, true]]], ['it-rf-proc-04', [[12, true]]]],
    'p-outage-planner': [['it-hu-01', [[15, true]]], ['it-rf-proc-02', [[15, false], [14, true]]]],
  };
  for (const [person, list] of Object.entries(curated)) {
    if (!T.people.some((p) => p.id === person)) continue;
    for (const [item, answers] of list) if (pool.some((i) => i.id === item)) replay(person, item, answers);
  }
  const prefs = { 'p-k-ro': 'weekly', 'p-sro': 'daily', 'p-qc-inspector': 'weekly', 'p-outage-planner': 'weekly' };

  // ── synthetic population (w-* staff, never security or cyber)
  const R = rng('f14-population');
  const people = T.people.filter((p) => p.kind === 'staff' && p.status !== 'leaver' && p.id.startsWith('w-') && !['security', 'cyber'].includes(p.job_family_id)).map((p) => p.id).sort();
  const crowd = people.filter(() => R() < 0.85);
  for (const person of crowd) {
    const n = 8 + Math.floor(R() * 14);
    const deck = [...pool];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const picks = deck.slice(0, n).sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const it of picks) {
      const p = TWEAK[it.id] ?? P_CORRECT[it.difficulty] ?? 0.65;
      const k = 1 + Math.floor(R() * 3);
      let ago = 50 + Math.floor(R() * 40);
      const answers = [];
      for (let j = 0; j < k && ago > 3; j++) { answers.push([ago, R() < p]); ago -= 3 + Math.floor(R() * 12); }
      replay(person, it.id, answers);
    }
    prefs[person] = R() < 0.2 ? 'daily' : R() < 0.9 ? 'weekly' : 'paused';
  }
  T.refresh_state.push(...[...states.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
  for (const [person, cadence] of Object.entries(prefs).sort()) T.refresh_prefs.push({ id: `rp:${person}`, person_id: person, cadence, updated_at: `${addDaysIso(today, -30)}T08:00:00Z` });
}
