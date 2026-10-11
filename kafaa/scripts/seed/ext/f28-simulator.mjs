// F28 (wave 4 · w4e3) seed: the simulator scenario library and its coverage (training scenarios only).
//   sim_objectives       28 generic training objectives (normal, abnormal, emergency, severe accident, team, LOCT field work),
//                        paraphrased from public IAEA simulator-training guidance; no plant-specific or exam content
//   sim_scenarios        24 scenarios (metadata only) in every status: approved, in review, draft and one retired; all pass the
//                        same content check as saveSimScenario (no exam, security, tags, setpoints or malfunction codes)
//   sim_cycles / items   the approved COCT 2025-2026 cycle (8 quarterly segments; two required objectives deliberately
//                        uncovered: their scenarios are still in review or draft), a draft COCT 2027-2028 plan and a submitted
//                        LOCT 2026-2027 plan for the training manager to approve
//   simulator_slots      past COCT slots, one per crew per executed segment (2025-Q1 to 2026-Q3)
//   crew_debriefs        one debrief per scenario run, instructor ratings of the four team competencies, crew self-ratings and
//   + members            bilingual notes; members are the crew in the slot whose position the scenario uses. These debriefs are
//                        history imported from the training records system (source 'import'): they carry no F01 evidence, so the
//                        seeded skill states (and everything derived from them in waves 1-3) stay unchanged. Debriefs recorded in
//                        Kafa'a (rpc.recordDebrief, source 'kafaa') write ojt evidence for the crew members present.
// Synthetic people only.
import { cycleCoverage, cycleItemId, crewRoster, debriefId, debriefMemberId, debriefStatements, validateScenario, validatePlan, contentIssue, DIMENSIONS } from '../../../src/modules/m04/scenarios.ts';

function rng(seedText) {
  let a = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) { a ^= seedText.charCodeAt(i); a = Math.imul(a, 0x01000193) >>> 0; }
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SRC = {
  tecdoc: { id: 'iaea-tecdoc-1963', label: 'IAEA-TECDOC-1963 (2021) Development, Use and Maintenance of NPP Simulators for the Training and Authorization of Personnel', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1963web.pdf' },
};
const OBJ = [
  // id, category, competency, programmes, en, ar
  ['n1', 'normal', 'co-03', ['coct'], 'Reactor start-up from hot standby to minimum load using normal operating procedures', 'بدء تشغيل المفاعل من وضع الاستعداد الساخن حتى الحمل الأدنى باستخدام إجراءات التشغيل العادية'],
  ['n2', 'normal', 'co-03', ['coct'], 'Planned power reduction and return to full power with reactivity management', 'خفض مخطط للقدرة ثم العودة إلى القدرة الكاملة مع إدارة التفاعلية'],
  ['n3', 'normal', 'co-02', ['coct', 'loct'], 'Shift turnover and crew briefing before a planned evolution', 'تسليم الوردية وإحاطة الطاقم قبل عملية مخططة'],
  ['n4', 'normal', 'ns-02', ['coct'], 'Surveillance test with a technical specification action statement entered', 'اختبار مراقبة مع الدخول في إجراء من المواصفات الفنية'],
  ['a1', 'abnormal', 'pf-03', ['coct'], 'Diagnose an instrument failure affecting an automatic control system', 'تشخيص عطل في جهاز قياس يؤثر على نظام تحكم آلي'],
  ['a2', 'abnormal', 'pf-03', ['coct', 'loct'], 'Respond to the loss of one main feedwater pump at power', 'الاستجابة لفقدان إحدى مضخات مياه التغذية الرئيسية أثناء التشغيل'],
  ['a3', 'abnormal', 'pf-03', ['coct'], 'Respond to a reactor coolant pump abnormality', 'الاستجابة لحالة غير طبيعية في مضخة مبرّد المفاعل'],
  ['a4', 'abnormal', 'ns-02', ['coct'], 'Respond to a small primary-to-secondary leak within technical specification limits', 'الاستجابة لتسرّب صغير من الدائرة الأولية إلى الثانوية ضمن حدود المواصفات الفنية'],
  ['a5', 'abnormal', 'pf-03', ['coct', 'loct'], 'Respond to the loss of an electrical bus', 'الاستجابة لفقدان قضيب توزيع كهربائي'],
  ['a6', 'abnormal', 'co-03', ['coct'], 'Respond to a control element malfunction', 'الاستجابة لخلل في أحد عناصر التحكم'],
  ['a7', 'abnormal', 'pf-03', ['coct', 'loct'], 'Respond to a loss of component cooling water', 'الاستجابة لفقدان مياه تبريد المكونات'],
  ['e1', 'emergency', 'co-01', ['coct'], 'Reactor trip and standard post-trip actions', 'إيقاف المفاعل الطارئ والإجراءات القياسية بعده'],
  ['e2', 'emergency', 'ns-01', ['coct'], 'Diagnose a loss-of-coolant accident and enter the emergency operating procedures', 'تشخيص حادث فقدان المبرّد والدخول في إجراءات التشغيل الطارئة'],
  ['e3', 'emergency', 'ns-01', ['coct'], 'Steam generator tube rupture: identify, isolate and cool down', 'تمزق أنبوب مولّد البخار: التحديد والعزل والتبريد'],
  ['e4', 'emergency', 'ns-01', ['coct'], 'Loss of all feedwater: restore a heat sink', 'فقدان كامل مياه التغذية: استعادة مصرف الحرارة'],
  ['e5', 'emergency', 'ns-01', ['coct', 'loct'], 'Station blackout: restore AC power and protect the core', 'انقطاع التيار الكامل عن المحطة: استعادة التيار المتردد وحماية القلب'],
  ['e6', 'emergency', 'co-03', ['coct'], 'Anticipated transient without reactor trip', 'عابر متوقَّع دون إيقاف المفاعل'],
  ['e7', 'emergency', 'ep-02', ['coct'], 'Emergency classification and notifications from the control room', 'تصنيف الطوارئ والإبلاغ من غرفة التحكم'],
  ['e8', 'emergency', 'ns-01', ['coct'], 'Excess steam demand event', 'حدث زيادة الطلب على البخار'],
  ['s1', 'severe_accident', 'ns-01', ['coct'], 'Transition from emergency operating procedures to severe accident guidelines', 'الانتقال من إجراءات التشغيل الطارئة إلى إرشادات الحوادث الجسيمة'],
  ['s2', 'severe_accident', 'ep-01', ['coct'], 'Evaluate severe accident strategies with the technical support centre', 'تقييم استراتيجيات الحوادث الجسيمة مع مركز الدعم الفني'],
  ['s3', 'severe_accident', 'ns-01', ['coct'], 'Protect containment integrity in a beyond-design-basis event', 'حماية سلامة الاحتواء في حدث يتجاوز أساس التصميم'],
  ['t1', 'team', 'co-02', ['coct', 'loct'], 'Three-way communication and clear crew briefings under stress', 'التواصل الثلاثي وإحاطات واضحة للطاقم تحت الضغط'],
  ['t2', 'team', 'ld-02', ['coct'], 'Conservative decision-making when plant conditions are uncertain', 'اتخاذ قرارات متحفظة عندما تكون ظروف المحطة غير مؤكدة'],
  ['t3', 'team', 'hu-01', ['coct', 'loct'], 'Peer checking and procedure place-keeping', 'التحقق المتبادل وتتبّع الموضع في الإجراءات'],
  ['t4', 'team', 'ld-01', ['coct'], 'Crew leadership: clear roles, command and control', 'قيادة الطاقم: أدوار واضحة وقيادة وتحكم'],
  ['l1', 'abnormal', 'co-01', ['loct'], 'Local operator field actions directed from the control room', 'إجراءات المشغّل المحلي الميدانية بتوجيه من غرفة التحكم'],
  ['l2', 'emergency', 'ep-02', ['loct'], 'Local operator response to a plant fire alarm with the fire brigade', 'استجابة المشغّل المحلي لإنذار حريق في المحطة مع فرقة الإطفاء'],
];
const P = (...x) => x;
const S = [
  // n, category, objectives, positions, minutes, fidelity, programmes, status, revision, author, editor, en title, ar title, en summary, ar summary, en events, ar events
  [1, 'normal', P('n1', 'n2', 'n3', 't1', 't3'), P('ss', 'sro', 'ro'), 240, 'full_scope', P('coct'), 'approved', 2, 'p-k-instructor', 'p-k-instructor',
    'Power ascension with a feedwater heater out of service', 'رفع القدرة مع خروج أحد مسخّنات مياه التغذية من الخدمة',
    'The crew takes the unit from minimum load towards full power with one feedwater heater isolated, coordinating reactivity changes and secondary-side limits.',
    'يرفع الطاقم الوحدة من الحمل الأدنى نحو القدرة الكاملة مع عزل أحد مسخّنات مياه التغذية، وينسّق تغييرات التفاعلية وحدود الدائرة الثانوية.',
    'A heater is isolated before the run starts; a slow controller drift appears later in the run.', 'يُعزل أحد المسخّنات قبل بدء الجلسة، ويظهر انحراف بطيء في أحد أجهزة التحكم لاحقاً.'],
  [2, 'normal', P('n2', 'n4', 't1'), P('ss', 'sro', 'ro', 'lo'), 180, 'full_scope', P('coct', 'loct'), 'approved', 1, 'w-instr-01', 'w-instr-01',
    'Planned load reduction for condenser work', 'خفض مخطط للحمل لأعمال المكثف',
    'A planned power reduction to allow work on the condenser, with a surveillance that requires a technical specification entry along the way.',
    'خفض مخطط للقدرة للسماح بأعمال على المكثف، مع اختبار مراقبة يتطلب الدخول في إحدى المواصفات الفنية خلال العملية.',
    'One surveillance result is out of tolerance and needs an operability call.', 'تأتي نتيجة أحد اختبارات المراقبة خارج حدود التفاوت وتحتاج إلى قرار بشأن قابلية التشغيل.'],
  [3, 'normal', P('n3', 'n4', 'a1', 't3'), P('ss', 'sro', 'ro'), 120, 'full_scope', P('coct'), 'approved', 1, 'p-k-instructor', 'p-k-instructor',
    'Shift turnover into a surveillance with an inoperable channel', 'تسليم وردية يليه اختبار مراقبة مع قناة غير قابلة للتشغيل',
    'The oncoming crew takes over mid-surveillance and finds one protection channel already declared inoperable.',
    'يتسلّم الطاقم القادم الوردية في منتصف اختبار مراقبة ويجد إحدى قنوات الحماية مُعلنة غير قابلة للتشغيل.',
    'A second indication becomes erratic during the test.', 'تصبح قراءة ثانية غير مستقرة أثناء الاختبار.'],
  [4, 'abnormal', P('a2', 't1', 't2'), P('ss', 'sro', 'ro', 'lo'), 120, 'full_scope', P('coct', 'loct'), 'approved', 2, 'w-instr-01', 'w-instr-01',
    'Loss of one main feedwater pump at full power', 'فقدان إحدى مضخات مياه التغذية الرئيسية عند القدرة الكاملة',
    'One main feedwater pump trips at full power; the crew stabilises the plant with the automatic runback and field support.',
    'تتوقف إحدى مضخات مياه التغذية الرئيسية عند القدرة الكاملة، ويثبّت الطاقم المحطة باستخدام الخفض الآلي والدعم الميداني.',
    'The runback is incomplete and needs operator action.', 'يكون الخفض الآلي غير مكتمل ويحتاج إلى تدخل المشغّل.'],
  [5, 'abnormal', P('a1', 'n2', 't3'), P('ss', 'sro', 'ro'), 90, 'full_scope', P('coct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Instrument channel failure during a power change', 'عطل في قناة قياس أثناء تغيير القدرة',
    'During a planned power change a level channel fails, affecting an automatic controller; the crew diagnoses and takes manual control.',
    'أثناء تغيير مخطط للقدرة تتعطل قناة قياس منسوب فتؤثر على جهاز تحكم آلي، فيشخّص الطاقم العطل ويتحول إلى التحكم اليدوي.',
    'The failure is gradual, not a step change.', 'يكون العطل تدريجياً وليس مفاجئاً.'],
  [6, 'abnormal', P('a3', 't2', 't4'), P('ss', 'sro', 'ro', 'sta'), 120, 'full_scope', P('coct'), 'approved', 1, 'p-k-instructor', 'p-k-instructor',
    'Reactor coolant pump seal degradation', 'تدهور موانع تسرّب مضخة مبرّد المفاعل',
    'Seal parameters on one reactor coolant pump degrade over time; the crew decides when to remove the pump from service.',
    'تتدهور مؤشرات موانع التسرّب في إحدى مضخات مبرّد المفاعل مع الوقت، ويقرر الطاقم متى يُخرج المضخة من الخدمة.',
    'Degradation accelerates after the first crew decision.', 'يتسارع التدهور بعد أول قرار للطاقم.'],
  [7, 'abnormal', P('a4', 'n4', 't2'), P('ss', 'sro', 'ro', 'sta'), 150, 'full_scope', P('coct'), 'approved', 1, 'w-instr-01', 'w-instr-01',
    'Small primary-to-secondary leak with a rising activity trend', 'تسرّب صغير من الأولية إلى الثانوية مع اتجاه متزايد للنشاط',
    'Radiation monitors show a slowly rising trend; the crew confirms the leak, applies the technical specifications and plans a controlled shutdown.',
    'تُظهر أجهزة رصد الإشعاع اتجاهاً متزايداً ببطء، فيؤكد الطاقم التسرّب ويطبّق المواصفات الفنية ويخطط لإيقاف مُتحكَّم به.',
    'The leak rate increases slowly over the session.', 'يزداد معدل التسرّب ببطء خلال الجلسة.'],
  [8, 'abnormal', P('a5', 't1', 't3'), P('ss', 'sro', 'ro', 'lo'), 120, 'full_scope', P('coct', 'loct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Loss of a non-safety electrical bus', 'فقدان قضيب توزيع كهربائي غير مرتبط بالأمان',
    'A non-safety bus de-energises; the crew identifies lost loads, restores equipment and coordinates field checks.',
    'ينقطع التيار عن قضيب توزيع غير مرتبط بالأمان، فيحدد الطاقم الأحمال المفقودة ويستعيد المعدات وينسّق الفحوص الميدانية.',
    'One standby pump does not start automatically.', 'لا تبدأ إحدى المضخات الاحتياطية العمل تلقائياً.'],
  [9, 'abnormal', P('a6', 'n2'), P('ss', 'sro', 'ro'), 90, 'full_scope', P('coct'), 'approved', 1, 'p-k-instructor', 'p-k-instructor',
    'Dropped control element at power', 'سقوط أحد عناصر التحكم أثناء التشغيل',
    'A single control element drops into the core at power; the crew responds, assesses power distribution and plans recovery.',
    'يسقط عنصر تحكم واحد داخل القلب أثناء التشغيل، فيستجيب الطاقم ويقيّم توزيع القدرة ويخطط للاستعادة.',
    'Recovery is possible only after a power reduction.', 'لا تكون الاستعادة ممكنة إلا بعد خفض القدرة.'],
  [10, 'abnormal', P('a7', 't3'), P('ss', 'sro', 'ro', 'lo'), 120, 'full_scope', P('coct', 'loct'), 'approved', 1, 'w-instr-01', 'w-instr-01',
    'Loss of component cooling water to one train', 'فقدان مياه تبريد المكونات لأحد المسارات',
    'Cooling water to one train is lost; the crew protects affected equipment and swaps to the standby train with field support.',
    'تُفقد مياه التبريد لأحد المسارات، فيحمي الطاقم المعدات المتأثرة وينتقل إلى المسار الاحتياطي بدعم ميداني.',
    'A heat exchanger outlet temperature keeps rising until the swap.', 'تستمر درجة حرارة مخرج أحد المبادلات الحرارية في الارتفاع حتى يتم التبديل.'],
  [11, 'emergency', P('e1', 't1'), P('ss', 'sro', 'ro'), 120, 'full_scope', P('coct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Reactor trip with a stuck control element', 'إيقاف المفاعل مع علوق أحد عناصر التحكم',
    'The reactor trips and one control element does not fully insert; the crew completes the standard post-trip actions and verifies shutdown margin.',
    'يتوقف المفاعل ولا يدخل أحد عناصر التحكم بالكامل، فيُكمل الطاقم الإجراءات القياسية بعد الإيقاف ويتحقق من هامش الإيقاف.',
    'An auxiliary feedwater train is slow to start.', 'يتأخر أحد مسارات مياه التغذية المساعدة في البدء.'],
  [12, 'emergency', P('e1', 'e2', 't2', 't4'), P('ss', 'sro', 'ro', 'sta'), 180, 'full_scope', P('coct'), 'approved', 2, 'p-k-instructor', 'p-k-instructor',
    'Small-break loss-of-coolant accident with one safety injection train unavailable', 'حادث فقدان مبرّد بكسر صغير مع عدم توفر أحد مسارات الحقن الآمن',
    'A small break in the primary system with one safety injection train out of service; the crew diagnoses the event and follows the emergency procedures.',
    'كسر صغير في الدائرة الأولية مع خروج أحد مسارات الحقن الآمن من الخدمة، ويشخّص الطاقم الحدث ويتّبع إجراءات الطوارئ.',
    'The break grows slightly during the first hour.', 'يتّسع الكسر قليلاً خلال الساعة الأولى.'],
  [13, 'emergency', P('e1', 'e3', 't1', 't4'), P('ss', 'sro', 'ro', 'sta'), 180, 'full_scope', P('coct'), 'approved', 1, 'w-instr-01', 'w-instr-01',
    'Steam generator tube rupture with a slow isolation', 'تمزق أنبوب مولّد البخار مع عزل بطيء',
    'A tube rupture in one steam generator; the crew identifies the affected generator, isolates it and cools down within the procedure limits.',
    'تمزق أنبوب في أحد مولّدات البخار، فيحدد الطاقم المولّد المتأثر ويعزله ويبرّد ضمن حدود الإجراء.',
    'One isolation valve closes slowly.', 'يُغلق أحد صمامات العزل ببطء.'],
  [14, 'emergency', P('e1', 'e4', 't2'), P('ss', 'sro', 'ro', 'sta'), 150, 'full_scope', P('coct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Loss of all feedwater after a turbine trip', 'فقدان كامل مياه التغذية بعد توقف التوربين',
    'After a turbine trip no feedwater source is available; the crew restores a heat sink and decides when to use the alternative cooling path.',
    'بعد توقف التوربين لا يتوفر أي مصدر لمياه التغذية، فيستعيد الطاقم مصرف الحرارة ويقرر متى يستخدم مسار التبريد البديل.',
    'The first restoration attempt does not succeed.', 'لا تنجح المحاولة الأولى للاستعادة.'],
  [15, 'emergency', P('e5', 'e7', 't4'), P('ss', 'sro', 'ro', 'sta', 'lo'), 240, 'full_scope', P('coct', 'loct'), 'approved', 1, 'p-k-instructor', 'p-k-instructor',
    'Station blackout with a delayed diesel generator start', 'انقطاع التيار الكامل مع تأخر بدء مولّد الديزل',
    'All AC power is lost and the emergency diesel generators are delayed; the crew protects the core, classifies the event and restores power with field teams.',
    'يُفقد التيار المتردد بالكامل ويتأخر بدء مولّدات الديزل الطارئة، فيحمي الطاقم القلب ويصنّف الحدث ويستعيد التيار مع الفرق الميدانية.',
    'One diesel generator starts only after local action.', 'لا يبدأ أحد مولّدات الديزل إلا بعد تدخل محلي.'],
  [16, 'emergency', P('e6', 'a2', 't2'), P('ss', 'sro', 'ro', 'sta'), 120, 'full_scope', P('coct'), 'in_review', 1, 'p-k-instructor', 'p-k-instructor',
    'Anticipated transient without reactor trip during a feedwater transient', 'عابر متوقَّع دون إيقاف المفاعل أثناء عابر في مياه التغذية',
    'A feedwater transient where the automatic reactor trip does not occur; the crew takes the manual and alternative shutdown actions.',
    'عابر في مياه التغذية لا يحدث معه الإيقاف الآلي للمفاعل، فيتخذ الطاقم إجراءات الإيقاف اليدوية والبديلة.',
    'The first manual action is only partly effective.', 'يكون الإجراء اليدوي الأول فعالاً جزئياً فقط.'],
  [17, 'emergency', P('e8', 'e1', 'e7'), P('ss', 'sro', 'ro', 'sta'), 150, 'full_scope', P('coct'), 'approved', 1, 'w-instr-01', 'w-instr-01',
    'Main steam line break inside containment', 'كسر في خط البخار الرئيسي داخل الاحتواء',
    'A steam line break inside containment leads to an excess steam demand event; the crew isolates the break, controls cooldown and makes the emergency classification.',
    'يؤدي كسر في خط البخار داخل الاحتواء إلى حدث زيادة في الطلب على البخار، فيعزل الطاقم الكسر ويتحكم في التبريد ويصنّف حالة الطوارئ.',
    'Containment pressure rises faster than expected.', 'يرتفع ضغط الاحتواء أسرع من المتوقع.'],
  [18, 'severe_accident', P('s1', 's2', 't4'), P('ss', 'sro', 'ro', 'sta'), 240, 'full_scope', P('coct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Core exit temperatures rising: transition to severe accident guidelines', 'ارتفاع درجات حرارة مخرج القلب: الانتقال إلى إرشادات الحوادث الجسيمة',
    'Core cooling degrades beyond the emergency procedures; the crew recognises the transition criteria and works with the technical support centre on strategies.',
    'يتدهور تبريد القلب بما يتجاوز إجراءات الطوارئ، فيتعرّف الطاقم على معايير الانتقال ويعمل مع مركز الدعم الفني على الاستراتيجيات.',
    'Communication with the support centre is delayed at first.', 'يتأخر التواصل مع مركز الدعم في البداية.'],
  [19, 'severe_accident', P('s3', 's2', 'e5'), P('ss', 'sro', 'ro', 'sta'), 240, 'full_scope', P('coct'), 'draft', 1, 'p-k-instructor', 'p-k-instructor',
    'Containment protection after a prolonged station blackout', 'حماية الاحتواء بعد انقطاع مطوّل للتيار عن المحطة',
    'After a prolonged loss of AC power, the crew and the technical support centre choose and carry out containment protection strategies.',
    'بعد فقدان مطوّل للتيار المتردد، يختار الطاقم ومركز الدعم الفني استراتيجيات حماية الاحتواء وينفّذانها.',
    'Some portable equipment arrives late.', 'تصل بعض المعدات المتنقلة متأخرة.'],
  [20, 'abnormal', P('l2', 'l1', 't1'), P('ss', 'lo'), 90, 'limited_scope', P('loct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Fire alarm in the turbine building with field response', 'إنذار حريق في مبنى التوربين مع استجابة ميدانية',
    'A fire alarm in the turbine building; local operators confirm conditions, support the fire brigade and carry out actions directed by the control room.',
    'إنذار حريق في مبنى التوربين، يتحقق المشغّلون المحليون من الظروف ويدعمون فرقة الإطفاء وينفّذون الإجراءات بتوجيه من غرفة التحكم.',
    'Smoke spreads to an adjacent area.', 'ينتشر الدخان إلى منطقة مجاورة.'],
  [21, 'abnormal', P('l1', 'a5', 't3'), P('ro', 'lo'), 90, 'limited_scope', P('loct'), 'approved', 1, 'w-instr-02', 'w-instr-02',
    'Field support for the loss of an electrical bus', 'الدعم الميداني عند فقدان قضيب توزيع كهربائي',
    'Local operators restore equipment in the field after a bus is lost, using peer checks and place-keeping while the control room directs the recovery.',
    'يستعيد المشغّلون المحليون المعدات ميدانياً بعد فقدان قضيب توزيع، مع التحقق المتبادل وتتبّع الموضع بينما توجّه غرفة التحكم الاستعادة.',
    'One breaker needs a second attempt.', 'يحتاج أحد القواطع إلى محاولة ثانية.'],
  [22, 'abnormal', P('t1', 't2', 't3', 't4', 'a1'), P('ss', 'sro', 'ro', 'sta'), 120, 'full_scope', P('coct'), 'approved', 3, 'w-instr-01', 'w-instr-01',
    'Crew resource management: degraded indications', 'إدارة موارد الطاقم: قراءات متدهورة',
    'Several indications degrade at once; the scenario focuses on crew roles, communication and conservative decisions rather than on one malfunction.',
    'تتدهور عدة قراءات في وقت واحد، ويركز السيناريو على أدوار الطاقم والتواصل والقرارات المتحفظة بدلاً من عطل واحد.',
    'Two indications disagree; one is wrong.', 'تتعارض قراءتان، إحداهما خاطئة.'],
  [23, 'abnormal', P('a2'), P('ss', 'sro', 'ro'), 60, 'desktop', P('coct'), 'retired', 2, 'w-instr-02', 'w-instr-02',
    'Legacy turbine runback (superseded)', 'خفض حمل التوربين القديم (استُبدل)',
    'An older turbine runback scenario kept for history; replaced by the loss of one main feedwater pump scenario.',
    'سيناريو قديم لخفض حمل التوربين محفوظ للسجل، واستُبدل بسيناريو فقدان إحدى مضخات مياه التغذية الرئيسية.',
    '', ''],
  [24, 'emergency', P('e7', 't1'), P('ss', 'sro', 'sta'), 90, 'full_scope', P('coct'), 'in_review', 1, 'w-instr-01', 'w-instr-01',
    'Emergency classification under time pressure', 'تصنيف الطوارئ تحت ضغط الوقت',
    'Plant conditions change quickly; the shift supervisor and the shift technical advisor must classify the event and complete notifications on time.',
    'تتغير ظروف المحطة بسرعة، ويجب على مشرف الوردية والمستشار الفني للوردية تصنيف الحدث وإتمام الإبلاغ في الوقت المحدد.',
    'A second change in conditions arrives during the notification.', 'يحدث تغير ثانٍ في الظروف أثناء الإبلاغ.'],
];
const COCT_REQ = Object.fromEntries(OBJ.filter((o) => o[3].includes('coct') && !o[0].startsWith('l')).map((o) => [`so-${o[0]}`, 1]));
Object.assign(COCT_REQ, { 'so-e1': 2, 'so-e2': 2, 'so-e3': 2, 'so-t1': 3, 'so-t4': 2 });
const COCT_COMPS = ['co-01', 'co-02', 'co-03', 'ep-01', 'ep-02', 'hu-01', 'ld-01', 'ld-02', 'ns-01', 'ns-02', 'pf-03'];
const PLAN_2526 = { 1: [1, 4, 12], 2: [13, 8, 22], 3: [2, 14, 6], 4: [18, 5, 11], 5: [12, 7, 9], 6: [15, 13, 3], 7: [17, 10, 22], 8: [11, 18, 1] };
const PLAN_2728 = { 1: [12, 4], 2: [13, 1] };
const PLAN_LOCT = { 1: [20, 4], 2: [21, 8], 3: [10, 15], 4: [20, 2] };
const LOCT_REQ = { 'so-l1': 2, 'so-l2': 1, 'so-a2': 1, 'so-a5': 1, 'so-a7': 1, 'so-e5': 1, 'so-t1': 1, 'so-t3': 1 };
const LOCT_COMPS = ['co-01', 'co-02', 'ep-02', 'hu-01', 'ns-01', 'pf-03'];
const CREWS = ['A', 'B', 'C', 'D', 'E'];
// Team-competency tendencies per crew (instructor scale 1-5): crew B strong, crew C has the local operator trainee, crew E weaker diagnosis.
const BASE = { A: [4, 4, 3, 4], B: [4, 4, 4, 4], C: [3, 4, 3, 3], D: [4, 3, 3, 4], E: [3, 3, 2, 3] };
const NOTES = {
  communication: {
    s: ['Clear three-way communication throughout the transient.', 'تواصل ثلاثي واضح طوال العابر.'],
    i: ['Repeat-backs were missed when the pace picked up; slow down and close the loop.', 'فاتت إعادة التأكيد عند تسارع الأحداث؛ يجب الإبطاء وإغلاق حلقة التواصل.'],
  },
  procedure_use: {
    s: ['Good place-keeping and peer checks on every step.', 'تتبّع جيد للموضع وتحقق متبادل في كل خطوة.'],
    i: ['Two steps were done from memory; keep the procedure in hand and mark place.', 'نُفّذت خطوتان من الذاكرة؛ يجب إبقاء الإجراء في اليد وتحديد الموضع.'],
  },
  diagnosis: {
    s: ['The crew identified the event early from trends, not from one alarm.', 'تعرّف الطاقم على الحدث مبكراً من الاتجاهات وليس من إنذار واحد.'],
    i: ['The crew fixed on the first alarm; check a second indication before acting.', 'تمسّك الطاقم بالإنذار الأول؛ يجب التحقق من قراءة ثانية قبل التصرف.'],
  },
  leadership: {
    s: ['The shift supervisor held a clear focus brief and kept command.', 'عقد مشرف الوردية إحاطة تركيز واضحة وحافظ على القيادة.'],
    i: ['Roles blurred during the recovery; the supervisor should step back to oversight.', 'اختلطت الأدوار أثناء الاستعادة؛ على المشرف العودة إلى دور الإشراف.'],
  },
};
const CRITIQUE = [
  ['We rushed the first diagnosis. Next time we take a short pause to agree on the plant state.', 'استعجلنا التشخيص الأول. في المرة القادمة نأخذ وقفة قصيرة للاتفاق على حالة المحطة.'],
  ['Our briefings worked well; we want to practise the hand-off to the field team.', 'نجحت إحاطاتنا؛ نريد التدرّب على التسليم للفريق الميداني.'],
  ['We agree with the instructor: we lost the big picture for a few minutes.', 'نتفق مع المدرّب: فقدنا الصورة الكاملة لبضع دقائق.'],
  ['Good teamwork, but we were slow to call for help from the support centre.', 'عمل جماعي جيد، لكننا تأخرنا في طلب المساعدة من مركز الدعم.'],
];
const INSTRUCTORS = ['p-k-instructor', 'w-instr-01', 'w-instr-02'];

/** Quarter k (1-based from 2025-Q1): the date of crew j's simulator day, moved off the weekend. */
function slotDate(k, j) {
  const y = 2025 + Math.floor((k - 1) / 4);
  const q = (k - 1) % 4;
  const d = new Date(Date.UTC(y, q * 3, 15 + j * 9));
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function build(T, ctx) {
  const objectives = OBJ.map(([k, category, competency_id, programmes, en, ar], i) => ({
    id: `so-${k}`, code: `SO-${k.toUpperCase()}`, title_en: en, title_ar: ar, category, competency_id, programmes, active: true, sort: i + 1, sources: [SRC.tecdoc],
  }));
  T.sim_objectives = objectives;
  const objMap = new Map(objectives.map((o) => [o.id, o]));
  const comps = new Set(T.competencies.map((c) => c.id));
  const at = (d, h = 6) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

  // ── scenarios: every seeded row passes the same validator as saveSimScenario
  T.sim_scenarios = S.map(([n, category, objs, positions, minutes, fidelity, programmes, status, revision, author, editor, ten, tar, sen, sar, een, ear]) => {
    const v = validateScenario({ purpose: 'training', title_en: ten, title_ar: tar, summary_en: sen, summary_ar: sar, events_en: een, events_ar: ear, category, objective_ids: objs.map((o) => `so-${o}`), positions, duration_min: minutes, fidelity, programmes }, { objectives: objMap, competencies: comps });
    if (!v.ok) throw new Error(`f28 seed: scenario ${n} fails validation: ${v.code} ${v.key}`);
    const created = `2024-${String(1 + (n % 9)).padStart(2, '0')}-${String(3 + n).padStart(2, '0')}`;
    const approved = status === 'approved' || status === 'retired';
    const history = [{ at: at(created), by: author, action: 'created', revision: 1, status: 'draft' }];
    for (let r = 2; r <= revision; r++) history.push({ at: at(created, 6 + r), by: editor, action: 'revised', revision: r, status: 'in_review' });
    if (approved) history.push({ at: at(created, 11), by: 'p-training-mgr', action: 'approve', revision, status: 'approved', note: null });
    if (status === 'retired') history.push({ at: at('2025-06-30'), by: 'p-training-mgr', action: 'retire', revision, status: 'retired', note: 'Superseded by SCN-004 (loss of one main feedwater pump).' });
    if (status === 'in_review') history.push({ at: '2026-10-01T09:00:00Z', by: editor, action: 'edited', revision, status: 'in_review' });
    return {
      id: `scn-${String(n).padStart(3, '0')}`, code: `SCN-${String(n).padStart(3, '0')}`, ...v.value, purpose: 'training', status, revision, author_person_id: author, last_edited_by: editor,
      submitted_at: status === 'in_review' ? '2026-10-01T09:00:00Z' : null, approved_by: approved ? 'p-training-mgr' : null, approved_at: approved ? at(created, 11) : null,
      review_note: status === 'retired' ? 'Superseded by SCN-004 (loss of one main feedwater pump).' : null, last_run_on: null, run_count: 0, history,
      sources: [SRC.tecdoc, { id: 'enec-training-facilities', label: 'ENEC · Training facilities', url: 'https://www.enec.ae/discover/how-nuclear-energy-works/who-operates-the-plant-/training-facilities/' }],
      created_at: at(created), updated_at: history[history.length - 1].at,
    };
  });
  const scMap = new Map(T.sim_scenarios.map((s) => [s.id, s]));
  const sid = (n) => `scn-${String(n).padStart(3, '0')}`;

  // ── cycles and plans (validated with validatePlan)
  const reqs = (o) => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)).map(([objective_id, min_runs]) => ({ objective_id, min_runs }));
  const sources = [{ id: 'sr2024', label: 'ENEC Sustainability Report 2024 (GRI data)', url: 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf' }, SRC.tecdoc];
  T.sim_cycles = [
    { id: 'cyc-coct-2025-26', programme: 'coct', label_en: 'COCT 2025-2026 simulator cycle', label_ar: 'دورة المحاكي للتدريب المستمر للمشغّلين المعتمدين 2025-2026', starts_on: '2025-01-01', ends_on: '2026-12-31', segments: 8,
      requirements: reqs(COCT_REQ), required_competency_ids: COCT_COMPS, status: 'approved', planned_by: 'p-k-instructor', planned_at: '2024-11-20T08:00:00Z', approved_by: 'p-training-mgr', approved_at: '2024-12-15T08:00:00Z',
      gap_note: 'ATWS and containment-protection scenarios are still in review or draft; covered by classroom sessions until approved.', sources },
    { id: 'cyc-coct-2027-28', programme: 'coct', label_en: 'COCT 2027-2028 simulator cycle', label_ar: 'دورة المحاكي للتدريب المستمر للمشغّلين المعتمدين 2027-2028', starts_on: '2027-01-01', ends_on: '2028-12-31', segments: 8,
      requirements: reqs(COCT_REQ), required_competency_ids: COCT_COMPS, status: 'draft', planned_by: 'w-instr-01', planned_at: '2026-09-28T08:00:00Z', approved_by: null, approved_at: null, gap_note: null, sources },
    { id: 'cyc-loct-2026-27', programme: 'loct', label_en: 'LOCT 2026-2027 field and simulator cycle', label_ar: 'دورة التدريب المستمر للمشغّلين المحليين 2026-2027', starts_on: '2026-01-01', ends_on: '2027-12-31', segments: 4,
      requirements: reqs(LOCT_REQ), required_competency_ids: LOCT_COMPS, status: 'submitted', planned_by: 'w-instr-02', planned_at: '2026-10-02T08:00:00Z', approved_by: null, approved_at: null, gap_note: null, sources },
  ];
  T.sim_cycle_items = [];
  for (const [cycleId, plan, by] of [['cyc-coct-2025-26', PLAN_2526, 'p-k-instructor'], ['cyc-coct-2027-28', PLAN_2728, 'w-instr-01'], ['cyc-loct-2026-27', PLAN_LOCT, 'w-instr-02']]) {
    const c = T.sim_cycles.find((x) => x.id === cycleId);
    const list = Object.entries(plan).flatMap(([seg, ns]) => ns.map((n) => ({ scenario_id: sid(n), segment: Number(seg) })));
    const v = validatePlan(list, c, scMap);
    if (!v.ok) throw new Error(`f28 seed: plan ${cycleId} invalid: ${v.code} ${v.key}`);
    for (const i of v.value) T.sim_cycle_items.push({ id: cycleItemId(cycleId, i.scenario_id, i.segment), cycle_id: cycleId, scenario_id: i.scenario_id, segment: i.segment, active: true, added_by: by, added_at: c.planned_at });
  }

  // ── executed COCT segments 1..7: one past slot per crew, a debrief per planned scenario
  T.crew_debriefs = [];
  T.crew_debrief_members = [];
  const people = T.people;
  for (let k = 1; k <= 7; k++) {
    CREWS.forEach((crew, j) => {
      const day = slotDate(k, j);
      if (day > ctx.DEMO_TODAY) return;
      const slot = { id: `sim-h${k}-${crew.toLowerCase()}`, simulator: j % 2 ? 'FSS-2' : 'FSS-1', starts_at: `${day}T07:00:00Z`, ends_at: `${day}T15:00:00Z`, crew, session_id: null, booking_kind: 'coct', priority: 1, status: 'booked', booked_by: 'p-k-instructor' };
      T.simulator_slots.push(slot);
      const roster = crewRoster(slot, people);
      PLAN_2526[k].forEach((n, si) => {
        const s = scMap.get(sid(n));
        const r = rng(`${slot.id}:${s.id}`);
        const id = debriefId(slot.id, s.id);
        const trend = k >= 5 ? 1 : 0;
        const ratings = Object.fromEntries(DIMENSIONS.map((d, di) => {
          const x = r();
          const v = BASE[crew][di] + (x < 0.18 ? -1 : x > 0.82 - trend * 0.1 ? 1 : 0);
          return [d, Math.max(1, Math.min(5, v))];
        }));
        const self = Object.fromEntries(DIMENSIONS.map((d) => { const x = r(); return [d, Math.max(1, Math.min(5, ratings[d] + (x < 0.15 ? -1 : x > 0.55 ? 1 : 0)))]; }));
        const members = roster.filter((m) => s.positions.includes(m.position)).map((m) => ({ ...m, id: debriefMemberId(id, m.person_id), present: r() > 0.08 }));
        if (!members.some((m) => m.present) && members.length) members[0].present = true;
        const instructor = INSTRUCTORS[(k + j + si) % INSTRUCTORS.length];
        const lowest = [...DIMENSIONS].sort((a, b) => ratings[a] - ratings[b] || DIMENSIONS.indexOf(a) - DIMENSIONS.indexOf(b))[0];
        const highest = [...DIMENSIONS].sort((a, b) => ratings[b] - ratings[a] || DIMENSIONS.indexOf(a) - DIMENSIONS.indexOf(b))[0];
        const crit = CRITIQUE[Math.floor(r() * CRITIQUE.length)];
        for (const m of members) {
          T.crew_debrief_members.push({ id: m.id, debrief_id: id, person_id: m.person_id, crew, position: m.position, present: m.present, scenario_id: s.id, held_on: day, evidence_ids: [] });
        }
        const texts = [NOTES[highest].s, NOTES[lowest].i, crit];
        for (const lang of [0, 1]) if (contentIssue(texts.map((t) => t[lang]))) throw new Error(`f28 seed: debrief text fails the content check (${id})`);
        const present = members.filter((m) => m.present).length;
        const header = { id, slot_id: slot.id, scenario_id: s.id, cycle_id: 'cyc-coct-2025-26', crew, held_on: day, ratings };
        T.crew_debriefs.push({
          ...header, simulator: slot.simulator, instructor_person_id: instructor, self_ratings: self,
          strengths_en: texts[0][0], strengths_ar: texts[0][1], improvements_en: texts[1][0], improvements_ar: texts[1][1], critique_en: texts[2][0], critique_ar: texts[2][1],
          present_count: present, absent_count: members.length - present, evidence_count: 0, xapi: debriefStatements(header, members), recorded_at: `${day}T16:00:00Z`, source: 'import',
        });
        s.last_run_on = !s.last_run_on || s.last_run_on < day ? day : s.last_run_on;
        s.run_count += 1;
      });
    });
  }
  // the latest crew-B debrief reached its crew as a notification
  const lastB = T.crew_debriefs.filter((d) => d.crew === 'B').sort((a, b) => (a.held_on < b.held_on ? 1 : -1))[0];
  for (const m of T.crew_debrief_members.filter((x) => x.debrief_id === lastB.id && x.present && x.person_id === 'p-sro')) {
    const s = scMap.get(lastB.scenario_id);
    T.notifications.push({ id: `nt-f28-${m.person_id}`, person_id: m.person_id, kind: 'simulator', title_en: `Simulator debrief recorded: ${s.title_en}`, title_ar: `سُجّل استخلاص جلسة المحاكي: ${s.title_ar}`, body_en: null, body_ar: null, link: '/my/simulator', severity: 'info', created_at: `${lastB.held_on}T16:00:00Z`, read_at: null });
  }
  // sanity: the approved COCT cycle shows exactly the two intended gaps (ATWS in review, containment protection in draft)
  const c = T.sim_cycles[0];
  const cov = cycleCoverage(c, T.sim_cycle_items, scMap, T.crew_debriefs);
  const gaps = cov.rows.filter((x) => x.status !== 'covered').map((x) => x.objective_id).join(',');
  if (gaps !== 'so-e6,so-s3') throw new Error(`f28 seed: unexpected COCT 2025-26 gaps ${gaps}`);
}
