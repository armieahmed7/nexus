// FS39 browser plant-literacy explainer: static, deterministic scenario definitions bundled with the page (no fetch, no RPC, no storage
// while you walk through them). A schematic of how heat becomes steam and electricity and how the three fundamental safety functions
// (control the reaction, cool the fuel, contain radioactivity) work, with guided what-if steps in the style of NuScale's E2 Center outreach.
// Every value is an illustrative index from 0 to 100 (SIMULATED), never a plant parameter: no temperatures, pressures, setpoints or
// flows of any real plant. Import-free.

export type Lvl = 0 | 1 | 2 | 3; // off, low, medium, high (drives the schematic colours)
export interface PlantState {
  /** illustrative indices 0-100 (SIMULATED) */
  power: number;
  heat: number;
  steam: number;
  output: number;
  /** component states for the schematic */
  rods: 'out' | 'in';
  pumps: 'running' | 'coasting' | 'natural';
  feed: 'normal' | 'emergency' | 'passive';
  grid: 'connected' | 'lost';
  turbine: 'online' | 'tripped';
  backup: 'standby' | 'running' | 'not_needed';
  sink: 'condenser' | 'atmosphere_valves' | 'passive_pool';
}
export type FnState = 'normal' | 'acting' | 'passive';
export interface SafetyFns { control: FnState; cool: FnState; contain: FnState }
export interface Question { q_en: string; q_ar: string; options: { en: string; ar: string }[]; correct: number; explain_en: string; explain_ar: string }
export interface Step { id: string; title_en: string; title_ar: string; body_en: string; body_ar: string; state: PlantState; fns: SafetyFns; focus: string[]; question?: Question }
export interface Scenario { id: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; minutes: number; link?: 'next_gen'; steps: Step[] }

const N: SafetyFns = { control: 'normal', cool: 'normal', contain: 'normal' };
const RUN: PlantState = { power: 100, heat: 100, steam: 100, output: 100, rods: 'out', pumps: 'running', feed: 'normal', grid: 'connected', turbine: 'online', backup: 'standby', sink: 'condenser' };

export const SCENARIOS: Scenario[] = [
  {
    id: 'heat-to-grid', minutes: 6,
    title_en: 'From heat to the grid', title_ar: 'من الحرارة إلى الشبكة',
    summary_en: 'Follow the energy from the reactor core to the electricity grid and back to the sea.', summary_ar: 'تتبّع الطاقة من قلب المفاعل إلى شبكة الكهرباء ثم إلى البحر.',
    steps: [
      {
        id: 'core', focus: ['core'], state: RUN, fns: N,
        title_en: 'Fission makes heat', title_ar: 'الانشطار يولّد الحرارة',
        body_en: 'In the reactor core, uranium nuclei split and release heat. Water flowing through the core carries the heat away. In a pressurised water reactor such as Barakah\'s APR-1400 units this primary water is kept under pressure so that it stays liquid.',
        body_ar: 'في قلب المفاعل تنشطر أنوية اليورانيوم وتطلق حرارة، ويحمل الماء المتدفق عبر القلب هذه الحرارة بعيداً. وفي مفاعلات الماء المضغوط مثل وحدات APR-1400 في براكة يُحفظ هذا الماء الأولي تحت الضغط كي يبقى سائلاً.',
        question: {
          q_en: 'What carries the heat away from the fuel?', q_ar: 'ما الذي يحمل الحرارة بعيداً عن الوقود؟',
          options: [{ en: 'Water flowing through the core', ar: 'الماء المتدفق عبر القلب' }, { en: 'Air blown over the fuel', ar: 'هواء يُنفخ فوق الوقود' }, { en: 'The control rods', ar: 'قضبان التحكم' }],
          correct: 0, explain_en: 'The primary water is both the coolant and the way heat leaves the core.', explain_ar: 'الماء الأولي هو المبرّد والوسيلة التي تخرج بها الحرارة من القلب.',
        },
      },
      {
        id: 'sg', focus: ['primary', 'sg'], state: RUN, fns: N,
        title_en: 'Two loops that never mix', title_ar: 'دائرتان لا تختلطان',
        body_en: 'The hot primary water passes through many tubes in the steam generator. Their heat boils separate secondary water on the outside of the tubes. The two loops exchange heat but never mix, which keeps radioactivity inside the primary loop.',
        body_ar: 'يمر الماء الأولي الساخن عبر أنابيب كثيرة في مولّد البخار، فتغلي حرارتُه ماءً ثانوياً منفصلاً خارج الأنابيب. تتبادل الدائرتان الحرارة دون أن تختلطا، وهذا يُبقي النشاط الإشعاعي داخل الدائرة الأولية.',
        question: {
          q_en: 'Why are the primary and secondary loops kept separate?', q_ar: 'لماذا تبقى الدائرتان الأولية والثانوية منفصلتين؟',
          options: [{ en: 'To keep radioactivity inside the primary loop', ar: 'لإبقاء النشاط الإشعاعي داخل الدائرة الأولية' }, { en: 'To make the turbine spin faster', ar: 'لجعل التوربين يدور أسرع' }, { en: 'Because seawater is too salty', ar: 'لأن مياه البحر شديدة الملوحة' }],
          correct: 0, explain_en: 'The steam that reaches the turbine never touched the fuel: one of several barriers that contain radioactivity.', explain_ar: 'البخار الذي يصل إلى التوربين لم يلامس الوقود قط، وهذا أحد الحواجز العديدة لاحتواء النشاط الإشعاعي.',
        },
      },
      {
        id: 'turbine', focus: ['turbine', 'generator'], state: RUN, fns: N,
        title_en: 'Steam turns the turbine', title_ar: 'البخار يدير التوربين',
        body_en: 'Steam drives the turbine, which turns the generator. The generator sends electricity to the grid through the plant\'s transformers. From here on, the plant works much like any other steam power station.',
        body_ar: 'يدير البخار التوربين الذي يدير المولّد الكهربائي، فيرسل المولّد الكهرباء إلى الشبكة عبر محولات المحطة. ومن هذه النقطة تعمل المحطة كأي محطة بخارية أخرى.',
      },
      {
        id: 'condenser', focus: ['condenser', 'sea'], state: RUN, fns: N,
        title_en: 'The condenser closes the loop', title_ar: 'المكثّف يُغلق الدائرة',
        body_en: 'After the turbine, the steam is cooled back into water in the condenser by seawater flowing through separate tubes, then pumped back to the steam generator. Most of the heat made in the core leaves the plant here, as in every thermal power station.',
        body_ar: 'بعد التوربين يُبرَّد البخار في المكثّف بمياه البحر التي تجري في أنابيب منفصلة فيعود ماءً، ثم يُضخ مجدداً إلى مولّد البخار. ويخرج معظم الحرارة المتولدة في القلب من المحطة هنا كما في كل محطة حرارية.',
        question: {
          q_en: 'Where does most of the heat made in the core end up?', q_ar: 'أين ينتهي معظم الحرارة المتولدة في القلب؟',
          options: [{ en: 'In the electricity grid', ar: 'في شبكة الكهرباء' }, { en: 'In the sea, through the condenser', ar: 'في البحر عبر المكثّف' }, { en: 'Stored in the containment', ar: 'مخزّنة داخل مبنى الاحتواء' }],
          correct: 1, explain_en: 'Only part of the heat becomes electricity; the rest is rejected to the sea through the condenser.', explain_ar: 'يتحول جزء فقط من الحرارة إلى كهرباء، أما الباقي فيُطرح إلى البحر عبر المكثّف.',
        },
      },
    ],
  },
  {
    id: 'turbine-trip', minutes: 6,
    title_en: 'What if the turbine trips?', title_ar: 'ماذا لو توقف التوربين فجأة؟',
    summary_en: 'The steam suddenly has nowhere to go. See how the plant controls the reaction and keeps removing heat.', summary_ar: 'فجأة لا يجد البخار طريقاً. شاهد كيف تتحكم المحطة في التفاعل وتواصل إزالة الحرارة.',
    steps: [
      {
        id: 'trip', focus: ['turbine'], state: { ...RUN, turbine: 'tripped', output: 0, steam: 60 }, fns: N,
        title_en: 'The turbine stops', title_ar: 'التوربين يتوقف',
        body_en: 'A fault trips the turbine and the generator stops sending power to the grid. The reactor is still making full heat, but the steam that took it away no longer has a path through the turbine.',
        body_ar: 'يتسبب عطل في إيقاف التوربين فيتوقف المولّد عن إرسال الكهرباء إلى الشبكة. ما زال المفاعل يولّد كامل حرارته، لكن البخار الذي كان يحملها لم يعد يجد طريقاً عبر التوربين.',
        question: {
          q_en: 'What must happen first to the heat still being made?', q_ar: 'ما الذي يجب أن يحدث أولاً للحرارة التي ما زالت تتولد؟',
          options: [{ en: 'Nothing: the plant can store it', ar: 'لا شيء، فالمحطة تستطيع تخزينها' }, { en: 'The reaction is reduced and the heat is sent somewhere else', ar: 'يُخفَّض التفاعل وتُوجَّه الحرارة إلى مكان آخر' }, { en: 'Restart the turbine at once', ar: 'إعادة تشغيل التوربين فوراً' }],
          correct: 1, explain_en: 'Heat that is not removed builds up, so the plant both reduces the reaction and keeps a heat path open.', explain_ar: 'الحرارة التي لا تُزال تتراكم، لذلك تخفّض المحطة التفاعل وتُبقي مساراً مفتوحاً لإزالة الحرارة.',
        },
      },
      {
        id: 'rods', focus: ['core', 'rods'], state: { ...RUN, turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 30, steam: 30 }, fns: { control: 'acting', cool: 'normal', contain: 'normal' },
        title_en: 'Control the reaction', title_ar: 'التحكم في التفاعل',
        body_en: 'Protection systems insert the control rods into the core. They absorb neutrons and stop the chain reaction within seconds. This is the first safety function: control the reaction.',
        body_ar: 'تُدخل أنظمة الحماية قضبان التحكم في القلب، فتمتص النيوترونات وتوقف التفاعل المتسلسل خلال ثوانٍ. وهذه هي وظيفة السلامة الأولى: التحكم في التفاعل.',
      },
      {
        id: 'decay', focus: ['core', 'sg', 'condenser'], state: { ...RUN, turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 12, steam: 12, sink: 'condenser' }, fns: { control: 'normal', cool: 'acting', contain: 'normal' },
        title_en: 'Heat keeps coming: decay heat', title_ar: 'الحرارة مستمرة: حرارة الاضمحلال',
        body_en: 'Even with the chain reaction stopped, the radioactive products in the fuel keep giving off heat for hours and days. Steam now bypasses the turbine to the condenser, and the feedwater keeps the steam generators supplied. This is the second safety function: cool the fuel.',
        body_ar: 'حتى بعد توقف التفاعل المتسلسل، تواصل النواتج المشعة في الوقود إطلاق الحرارة لساعات وأيام. يتجاوز البخار الآن التوربين إلى المكثّف، ويواصل ماء التغذية إمداد مولّدات البخار. وهذه هي وظيفة السلامة الثانية: تبريد الوقود.',
        question: {
          q_en: 'Once the rods are in, can cooling stop?', q_ar: 'بعد إدخال القضبان، هل يمكن إيقاف التبريد؟',
          options: [{ en: 'Yes, the fuel is cold at once', ar: 'نعم، يبرد الوقود فوراً' }, { en: 'No, decay heat still has to be removed', ar: 'لا، فحرارة الاضمحلال ما زالت بحاجة إلى إزالة' }],
          correct: 1, explain_en: 'Decay heat falls over time but never to zero quickly, so cooling has to continue.', explain_ar: 'تنخفض حرارة الاضمحلال مع الوقت لكنها لا تصل إلى الصفر بسرعة، لذلك يجب أن يستمر التبريد.',
        },
      },
      {
        id: 'contain', focus: ['containment'], state: { ...RUN, turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 10, steam: 10 }, fns: { control: 'normal', cool: 'normal', contain: 'normal' },
        title_en: 'Barriers stay closed', title_ar: 'الحواجز تبقى مغلقة',
        body_en: 'The third safety function, contain radioactivity, relies on barriers in series: the fuel itself, its cladding, the primary loop and the containment building. In this event all of them stay intact, so the plant is stable and the crew follows procedures to a safe shutdown state.',
        body_ar: 'تعتمد وظيفة السلامة الثالثة، احتواء النشاط الإشعاعي، على حواجز متتالية: الوقود نفسه وغلافه والدائرة الأولية ومبنى الاحتواء. في هذا الحدث تبقى جميعها سليمة، فتستقر المحطة ويتبع الطاقم الإجراءات حتى حالة الإيقاف الآمن.',
      },
    ],
  },
  {
    id: 'loss-of-power', minutes: 7,
    title_en: 'What if off-site power is lost?', title_ar: 'ماذا لو انقطعت الكهرباء الخارجية؟',
    summary_en: 'The grid connection is lost. See how backup power and emergency feedwater keep the fuel cool.', summary_ar: 'ينقطع الاتصال بالشبكة. شاهد كيف تحافظ الطاقة الاحتياطية وماء التغذية الطارئ على تبريد الوقود.',
    steps: [
      {
        id: 'lost', focus: ['grid'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 12, steam: 12, pumps: 'coasting', feed: 'normal' }, fns: { control: 'acting', cool: 'acting', contain: 'normal' },
        title_en: 'The grid connection drops', title_ar: 'ينقطع الاتصال بالشبكة',
        body_en: 'A grid fault cuts the plant off from off-site power. The reactor trips automatically: control rods drop in. The large pumps that circulate the primary water lose power and slow down.',
        body_ar: 'يقطع عطل في الشبكة المحطة عن الكهرباء الخارجية، فيتوقف المفاعل تلقائياً وتسقط قضبان التحكم. وتفقد المضخات الكبيرة التي تُدوّر الماء الأولي الكهرباء فتتباطأ.',
        question: {
          q_en: 'Which safety function is most at risk now?', q_ar: 'أي وظيفة سلامة هي الأكثر عرضة للخطر الآن؟',
          options: [{ en: 'Control the reaction', ar: 'التحكم في التفاعل' }, { en: 'Cool the fuel', ar: 'تبريد الوقود' }, { en: 'Contain radioactivity', ar: 'احتواء النشاط الإشعاعي' }],
          correct: 1, explain_en: 'The rods have stopped the reaction, but the pumps and normal feedwater need electricity to keep removing decay heat.', explain_ar: 'أوقفت القضبان التفاعل، لكن المضخات وماء التغذية العادي تحتاج إلى الكهرباء لمواصلة إزالة حرارة الاضمحلال.',
        },
      },
      {
        id: 'natural', focus: ['primary'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 10, steam: 10, pumps: 'natural', feed: 'normal' }, fns: { control: 'normal', cool: 'acting', contain: 'normal' },
        title_en: 'Natural circulation', title_ar: 'الدوران الطبيعي',
        body_en: 'Hot water rises and cooler water sinks. With the core low and the steam generators high, this alone keeps the primary water moving slowly and carrying decay heat: natural circulation.',
        body_ar: 'يرتفع الماء الساخن وينزل الماء الأبرد. وبوجود القلب في الأسفل ومولّدات البخار في الأعلى، يكفي ذلك وحده لإبقاء الماء الأولي متحركاً ببطء حاملاً حرارة الاضمحلال: إنه الدوران الطبيعي.',
      },
      {
        id: 'backup', focus: ['backup', 'feed'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 9, steam: 9, pumps: 'natural', feed: 'emergency', backup: 'running', sink: 'atmosphere_valves' }, fns: { control: 'normal', cool: 'acting', contain: 'normal' },
        title_en: 'Backup power and emergency feedwater', title_ar: 'الطاقة الاحتياطية وماء التغذية الطارئ',
        body_en: 'Emergency diesel generators start and power the safety systems. Emergency feedwater keeps the steam generators supplied, and the steam is released through relief valves because the condenser is not available. Redundant trains mean one failure does not stop cooling.',
        body_ar: 'تعمل مولدات الديزل الطارئة وتغذي أنظمة السلامة بالكهرباء. ويواصل ماء التغذية الطارئ إمداد مولّدات البخار، ويُطلق البخار عبر صمامات التنفيس لأن المكثّف غير متاح. وتعني المسارات المكررة أن عطلاً واحداً لا يوقف التبريد.',
        question: {
          q_en: 'Why are safety systems built as several independent trains?', q_ar: 'لماذا تُبنى أنظمة السلامة على شكل عدة مسارات مستقلة؟',
          options: [{ en: 'So that one failure does not stop the safety function', ar: 'حتى لا يوقف عطل واحد وظيفة السلامة' }, { en: 'To produce more electricity', ar: 'لإنتاج مزيد من الكهرباء' }, { en: 'To make maintenance unnecessary', ar: 'لجعل الصيانة غير ضرورية' }],
          correct: 0, explain_en: 'Redundancy is part of defence in depth: no single failure removes a safety function.', explain_ar: 'التكرار جزء من الدفاع في العمق: لا يُسقط عطل واحد وظيفة سلامة.',
        },
      },
      {
        id: 'stable', focus: ['containment', 'core'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 6, steam: 6, pumps: 'natural', feed: 'emergency', backup: 'running', sink: 'atmosphere_valves' }, fns: { control: 'normal', cool: 'normal', contain: 'normal' },
        title_en: 'Stable until the grid returns', title_ar: 'استقرار حتى عودة الشبكة',
        body_en: 'With the reaction controlled, the fuel cooled and the barriers intact, the plant stays stable on backup power. When the grid returns, normal systems take over again under procedure.',
        body_ar: 'مع التحكم في التفاعل وتبريد الوقود وسلامة الحواجز، تبقى المحطة مستقرة على الطاقة الاحتياطية. وعندما تعود الشبكة تتولى الأنظمة العادية المهمة مجدداً وفق الإجراءات.',
      },
    ],
  },
  {
    id: 'passive', minutes: 6, link: 'next_gen',
    title_en: 'The same event on a passive design', title_ar: 'الحدث نفسه في تصميم خامل',
    summary_en: 'Many small modular reactor concepts rely on natural forces for cooling. Compare them with the event you just walked through.', summary_ar: 'تعتمد مفاهيم كثيرة للمفاعلات المعيارية الصغيرة على القوى الطبيعية في التبريد. قارنها بالحدث الذي مررت به للتو.',
    steps: [
      {
        id: 'p-lost', focus: ['grid'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 12, steam: 12, pumps: 'natural', feed: 'passive', backup: 'not_needed', sink: 'passive_pool' }, fns: { control: 'acting', cool: 'passive', contain: 'normal' },
        title_en: 'Power is lost: no pumps needed', title_ar: 'انقطاع الكهرباء: لا حاجة إلى مضخات',
        body_en: 'In passive designs studied for small modular reactors, the same loss of power is met without pumps or diesel generators for a defined period. The reaction is stopped as before; cooling relies on gravity and natural circulation.',
        body_ar: 'في التصاميم الخاملة التي تُدرس للمفاعلات المعيارية الصغيرة، يُواجَه انقطاع الكهرباء نفسه دون مضخات أو مولدات ديزل لفترة محددة. يتوقف التفاعل كما في السابق، ويعتمد التبريد على الجاذبية والدوران الطبيعي.',
        question: {
          q_en: 'What does a passive safety system rely on?', q_ar: 'علامَ يعتمد نظام السلامة الخامل؟',
          options: [{ en: 'Natural forces such as gravity and natural circulation', ar: 'القوى الطبيعية مثل الجاذبية والدوران الطبيعي' }, { en: 'Larger diesel generators', ar: 'مولدات ديزل أكبر' }, { en: 'Operators pumping water by hand', ar: 'مشغلون يضخون الماء يدوياً' }],
          correct: 0, explain_en: 'Passive systems work without AC power or operator action for a period, which changes what operators and maintainers do.', explain_ar: 'تعمل الأنظمة الخاملة دون كهرباء متناوبة أو تدخل من المشغلين لفترة، وهذا يغيّر ما يفعله المشغلون وفنيو الصيانة.',
        },
      },
      {
        id: 'p-pool', focus: ['containment', 'core'], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 8, steam: 8, pumps: 'natural', feed: 'passive', backup: 'not_needed', sink: 'passive_pool' }, fns: { control: 'normal', cool: 'passive', contain: 'normal' },
        title_en: 'Heat goes to a large water pool', title_ar: 'الحرارة تذهب إلى حوض ماء كبير',
        body_en: 'Decay heat is carried by natural circulation to a large body of water or to the air around the containment. Operators monitor rather than start systems: the job shifts from running equipment to watching that natural processes work as designed.',
        body_ar: 'تُنقل حرارة الاضمحلال بالدوران الطبيعي إلى كتلة ماء كبيرة أو إلى الهواء المحيط بمبنى الاحتواء. يراقب المشغلون بدلاً من تشغيل الأنظمة، فينتقل العمل من تشغيل المعدات إلى التأكد من أن العمليات الطبيعية تعمل كما صُممت.',
      },
      {
        id: 'p-you', focus: [], state: { ...RUN, grid: 'lost', turbine: 'tripped', output: 0, rods: 'in', power: 6, heat: 6, steam: 6, pumps: 'natural', feed: 'passive', backup: 'not_needed', sink: 'passive_pool' }, fns: N,
        title_en: 'What it means for your role', title_ar: 'ماذا يعني ذلك لدورك',
        body_en: 'This is a planning concept, and no deployment decision is implied. If you want to see what a passive, multi-module or factory-built fleet would change in your own role, open the SMR delta overlay.',
        body_ar: 'هذا مفهوم تخطيطي ولا يعني أي قرار بالنشر. وإذا أردت أن ترى ما الذي قد يغيّره أسطول خامل أو متعدد الوحدات أو مصنّع في المصنع في دورك، فافتح طبقة الفروق للمفاعلات المعيارية الصغيرة.',
      },
    ],
  },
];

/** The steps of a scenario with a bounded index (pure helper for the player). */
export function stepAt(scenarioId: string, i: number): { scenario: Scenario | null; step: Step | null; index: number; last: boolean } {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? null;
  if (!scenario) return { scenario: null, step: null, index: 0, last: true };
  const index = Math.max(0, Math.min(scenario.steps.length - 1, Math.floor(i)));
  return { scenario, step: scenario.steps[index], index, last: index === scenario.steps.length - 1 };
}

/** Local quiz tally (never stored): correct answers out of the questions asked so far. */
export function quizScore(answers: Record<string, number>): { asked: number; right: number } {
  let asked = 0;
  let right = 0;
  for (const s of SCENARIOS) for (const st of s.steps) {
    if (!st.question) continue;
    const a = answers[`${s.id}:${st.id}`];
    if (a == null) continue;
    asked++;
    if (a === st.question.correct) right++;
  }
  return { asked, right };
}

/** Illustrative level of an index for the schematic colours (0 off, 1 low, 2 medium, 3 high). */
export const lvl = (n: number): Lvl => (n <= 0 ? 0 : n < 15 ? 1 : n < 60 ? 2 : 3);
