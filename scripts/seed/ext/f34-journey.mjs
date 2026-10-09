// F34 (wave 5 · E3) Student-to-career journey seed: the 10-question interest explorer, the journey-board facts (each with a public
// source from the shared registry and an as-of date), synthetic saved journeys for the applicant pool (so the HR aggregate has
// cells above and below the suppression threshold of 10), and the starter portfolio (synthetic Mustaqbali starter credentials,
// experiences). Synthetic people only (p-k-*, a-*, ap-* applicant rows of the people table); no real names.
import { JOURNEY_ROUTES, ROUTE_FAMILIES, journeyId, journeyPayload, starterRow, prepKey, PREP_ITEMS, eligKey } from '../../../src/modules/m06/journey.ts';

/** Small deterministic hash (FNV-1a) for stable synthetic picks. */
function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}

const O = (id, en, ar, families, route = null) => ({ id, en, ar, families, ...(route ? { route } : {}) });
const Q = (n, prompt_en, prompt_ar, hint_en, hint_ar, options) => ({ id: `q${String(n).padStart(2, '0')}`, sort: n, prompt_en, prompt_ar, hint_en, hint_ar, options });

export const QUESTIONS = [
  Q(1, 'Which school subject do you enjoy most?', 'ما المادة الدراسية التي تستمتع بها أكثر؟', 'Pick the one you look forward to.', 'اختر المادة التي تنتظرها بشغف.', [
    O('a', 'Physics and maths', 'الفيزياء والرياضيات', ['engineering', 'operations', 'nuclear-fuel']),
    O('b', 'Chemistry and biology', 'الكيمياء والأحياء', ['chemistry', 'radiation-protection', 'environment']),
    O('c', 'Computing and technology', 'الحاسوب والتكنولوجيا', ['cyber', 'engineering']),
    O('d', 'Languages, business or social studies', 'اللغات أو إدارة الأعمال أو الدراسات الاجتماعية', ['corporate', 'licensing', 'supply-chain']),
  ]),
  Q(2, 'How do you like to work best?', 'كيف تفضّل أن تعمل؟', '', '', [
    O('a', 'With my hands and tools', 'بيديّ وبالأدوات', ['maintenance', 'fire-protection']),
    O('b', 'With screens, data and systems', 'مع الشاشات والبيانات والأنظمة', ['operations', 'cyber']),
    O('c', 'With people: helping, teaching, organising', 'مع الناس: المساعدة والتعليم والتنظيم', ['training', 'health-safety', 'corporate']),
    O('d', 'With ideas: designing and calculating', 'مع الأفكار: التصميم والحساب', ['engineering', 'nuclear-fuel']),
  ]),
  Q(3, 'Where would you most like to spend your working day?', 'أين تحب أن تقضي يوم عملك؟', '', '', [
    O('a', 'In a control room', 'في غرفة التحكم', ['operations']),
    O('b', 'In a workshop or out on the plant', 'في الورشة أو في أرجاء المحطة', ['maintenance', 'outage']),
    O('c', 'In a laboratory', 'في المختبر', ['chemistry', 'radiation-protection', 'environment']),
    O('d', 'In an office or meeting room', 'في مكتب أو قاعة اجتماعات', ['corporate', 'licensing', 'quality', 'supply-chain']),
  ]),
  Q(4, 'How do you feel about shift work (days and nights on a rota with a fixed team)?', 'ما رأيك في العمل بنظام المناوبات (نهاراً وليلاً ضمن فريق ثابت)؟', 'Operations crews keep the plant running around the clock.', 'تعمل فرق التشغيل على مدار الساعة للحفاظ على تشغيل المحطة.', [
    O('a', 'Sounds exciting', 'يبدو ممتعاً', ['operations', 'fire-protection']),
    O('b', 'I would rather work regular day hours', 'أفضّل العمل في ساعات النهار المعتادة', ['engineering', 'corporate', 'licensing']),
    O('c', 'Not sure yet', 'لست متأكداً بعد', []),
  ]),
  Q(5, 'How much do you enjoy following a precise procedure step by step?', 'إلى أي مدى تستمتع باتباع إجراء دقيق خطوة بخطوة؟', '', '', [
    O('a', 'I like it: checklists keep things right', 'أحب ذلك: قوائم التحقق تضمن صحة العمل', ['operations', 'quality', 'maintenance']),
    O('b', 'I like writing and improving the procedures', 'أحب كتابة الإجراءات وتحسينها', ['engineering', 'licensing', 'training']),
    O('c', 'I prefer open-ended problems', 'أفضّل المسائل المفتوحة', ['engineering', 'nuclear-fuel']),
  ]),
  Q(6, 'Which of these problems would you most like to solve?', 'أي من هذه المشكلات تحب أن تحلّها؟', '', '', [
    O('a', 'Why is this pump vibrating?', 'لماذا تهتز هذه المضخة؟', ['maintenance']),
    O('b', 'Is the cooling water chemistry right?', 'هل كيمياء مياه التبريد مضبوطة؟', ['chemistry']),
    O('c', 'How do we keep people\'s radiation dose low?', 'كيف نُبقي الجرعة الإشعاعية للعاملين منخفضة؟', ['radiation-protection', 'health-safety']),
    O('d', 'How do we plan a refuelling outage?', 'كيف نخطط لفترة إيقاف لإعادة التزود بالوقود؟', ['outage', 'supply-chain']),
  ]),
  Q(7, 'In an emergency drill, which part would you take?', 'في تمرين الطوارئ، ما الدور الذي تختاره؟', '', '', [
    O('a', 'Leading and coordinating the response', 'قيادة الاستجابة وتنسيقها', ['emergency-preparedness', 'operations']),
    O('b', 'Fighting the fire or giving first aid', 'مكافحة الحريق أو تقديم الإسعافات الأولية', ['fire-protection', 'health-safety']),
    O('c', 'Checking the systems and the data', 'فحص الأنظمة والبيانات', ['engineering', 'cyber']),
    O('d', 'Explaining what is happening to people', 'شرح ما يحدث للناس', ['corporate', 'training']),
  ]),
  Q(8, 'Which matters most to you?', 'ما الأهم بالنسبة إليك؟', '', '', [
    O('a', 'Protecting the environment and the community', 'حماية البيئة والمجتمع', ['environment', 'radiation-protection']),
    O('b', 'Making sure everything meets the rules', 'التأكد من أن كل شيء يلتزم بالقواعد', ['quality', 'licensing', 'oversight']),
    O('c', 'Keeping the lights on for the UAE', 'إبقاء الأنوار مضاءة في الإمارات', ['operations', 'maintenance']),
    O('d', 'Building the future of clean energy', 'بناء مستقبل الطاقة النظيفة', ['engineering', 'nuclear-fuel']),
  ]),
  Q(9, 'After school, how long would you like to study?', 'بعد المدرسة، كم من الوقت تحب أن تدرس؟', 'This only suggests a route; you can choose any route on the board.', 'هذا يقترح مساراً فقط، ويمكنك اختيار أي مسار على اللوحة.', [
    O('a', 'About two years, then start work (a diploma)', 'نحو سنتين ثم أبدأ العمل (دبلوم)', ['operations', 'maintenance'], 'dnt'),
    O('b', 'A four-year university degree', 'شهادة جامعية لمدة أربع سنوات', ['engineering'], 'energy-pioneers'),
    O('c', 'I already have, or will soon have, a degree', 'لديّ شهادة جامعية أو سأحصل عليها قريباً', [], 'gdp'),
    O('d', 'Not sure yet', 'لست متأكداً بعد', []),
  ]),
  Q(10, 'In a team, you are usually the one who...', 'في الفريق، عادةً ما تكون الشخص الذي...', '', '', [
    O('a', 'Takes the lead and organises', 'يتولى القيادة والتنظيم', ['operations', 'training', 'outage']),
    O('b', 'Becomes the expert on one thing', 'يصبح خبيراً في مجال واحد', ['engineering', 'chemistry', 'nuclear-fuel']),
    O('c', 'Checks the details others miss', 'يدقق في التفاصيل التي يغفلها الآخرون', ['quality', 'oversight', 'cyber']),
    O('d', 'Helps and teaches others', 'يساعد الآخرين ويعلّمهم', ['training', 'health-safety']),
  ]),
];

const F = (id, step, programme_id, role_id, text_en, text_ar, source_id, as_of, precision, sort) => ({ id, step, programme_id, role_id, text_en, text_ar, source_id, as_of, precision, sort });
export const FACTS = [
  F('jf-ex-1', 'explore', null, null, 'ENEC runs six talent pipeline programmes, and more than 2,000 UAE nationals have worked on Barakah.', 'تدير ENEC ستة برامج لاستقطاب المواهب، وقد عمل أكثر من 2,000 مواطن إماراتي في براكة.', 'enec-dnt-grad', '2026-06-17', 'day', 1),
  F('jf-ex-2', 'explore', null, null, 'ENEC publishes learning materials about nuclear energy for school students.', 'تنشر ENEC مواد تعليمية عن الطاقة النووية لطلاب المدارس.', 'enec-students', '2026-10-08', 'day', 2),
  F('jf-ex-3', 'explore', 'mawaheb', null, 'Another way in: the ENEC-DGE Mawaheb agreement (May 2026) aims to qualify at least 100 UAE nationals over five years.', 'طريق آخر: تهدف اتفاقية مواهب بين ENEC ودائرة التمكين الحكومي (مايو 2026) إلى تأهيل 100 مواطن على الأقل خلال خمس سنوات.', 'enec-dge', '2026-05-01', 'month', 3),
  F('jf-mq-1', 'mustaqbali', 'mustaqbali', null, 'Mustaqbali is a two-week STEM experience for high-school students.', 'برنامج مستقبلي تجربة في العلوم والتكنولوجيا والهندسة والرياضيات لمدة أسبوعين لطلاب المرحلة الثانوية.', 'sr2024', '2024-12-31', 'year', 1),
  F('jf-mq-2', 'mustaqbali', 'mustaqbali', null, '50 students took part in 2024.', 'شارك 50 طالباً في عام 2024.', 'sr2024', '2024-12-31', 'year', 2),
  F('jf-mq-3', 'mustaqbali', 'mustaqbali', null, 'It is open to UAE nationals in high school.', 'البرنامج متاح للطلاب المواطنين في المرحلة الثانوية.', 'cns10', '2026-03-01', 'month', 3),
  F('jf-dnt-1', 'route', 'dnt', null, 'Diploma in Nuclear Technology (DNT): 24 months, for UAE high-school graduates.', 'دبلوم التكنولوجيا النووية: 24 شهراً لخريجي الثانوية العامة من المواطنين.', 'enec-dnt-grad', '2026-06-17', 'day', 1),
  F('jf-dnt-2', 'route', 'dnt', null, 'The first national cohort of 20 graduated on 17 June 2026.', 'تخرجت أول دفعة وطنية من 20 طالباً في 17 يونيو 2026.', 'enec-dnt-grad', '2026-06-17', 'day', 2),
  F('jf-dnt-3', 'route', 'dnt', null, 'Graduates move into Local Operator or Maintenance Technician roles.', 'ينتقل الخريجون إلى وظائف المشغّل المحلي أو فني الصيانة.', 'enec-dnt-grad', '2026-06-17', 'day', 3),
  F('jf-dnt-4', 'route', 'dnt', null, 'A monthly stipend is paid during the programme.', 'تُصرف مكافأة شهرية خلال البرنامج.', 'enec-dnt-launch', '2023-08-01', 'month', 4),
  F('jf-ep-1', 'route', 'energy-pioneers', null, 'Energy Pioneers scholarships have run since 2009, and more than 500 UAE nationals have benefitted.', 'تُقدَّم منح رواد الطاقة منذ عام 2009، واستفاد منها أكثر من 500 مواطن إماراتي.', 'enec-talent', '2026-10-08', 'day', 1),
  F('jf-ep-2', 'route', 'energy-pioneers', null, 'Scholars study at partner universities in the UAE, the United States and Korea.', 'يدرس المبتعثون في جامعات شريكة في الإمارات والولايات المتحدة وكوريا.', 'enec-talent', '2026-10-08', 'day', 2),
  F('jf-ep-3', 'route', 'internships', null, 'While at university: 22 students did internships in 2024, selected through screening exams and interviews.', 'خلال الدراسة الجامعية: التحق 22 طالباً بالتدريب الداخلي في 2024 بعد اختبارات فرز ومقابلات.', 'sr2024', '2024-12-31', 'year', 3),
  F('jf-gdp-1', 'route', 'gdp', null, 'Graduate Development Program (GDP): 18 to 36 months of position-targeted development (careers page).', 'برنامج تطوير الخريجين: من 18 إلى 36 شهراً من التطوير الموجّه نحو وظيفة محددة (صفحة الوظائف).', 'enec-careers', '2026-10-08', 'day', 1),
  F('jf-gdp-2', 'route', 'gdp', null, '22 graduates joined the programme in 2024.', 'انضم 22 خريجاً إلى البرنامج في 2024.', 'sr2024', '2024-12-31', 'year', 2),
  F('jf-gpo-1', 'route', 'gpo', null, 'Graduate Plant Operator (GPO): engineering graduates start as Local Operators, with Senior Reactor Operator training after three years.', 'مشغّل المحطة للخريجين: يبدأ خريجو الهندسة مشغّلين محليين، ثم يتدربون ليصبحوا مشغّلي مفاعل أوائل بعد ثلاث سنوات.', 'enec-gpo', '2025-08-21', 'day', 1),
  F('jf-gpo-2', 'route', 'gpo', null, 'The programme was launched on 21 August 2025.', 'أُطلق البرنامج في 21 أغسطس 2025.', 'enec-gpo', '2025-08-21', 'day', 2),
  F('jf-fr-lo', 'first_role', null, 'local-operator', 'Local Operator is the entry role in operations; Reactor Operator and Senior Reactor Operator licences come later under FANR-REG-17.', 'المشغّل المحلي هو وظيفة الدخول في التشغيل، وتأتي رخصتا مشغّل المفاعل ومشغّل المفاعل الأول لاحقاً وفق اللائحة FANR-REG-17.', 'fanr-reg17', '2026-10-08', 'day', 1),
  F('jf-fr-mt', 'first_role', null, 'maintenance-technician-engineer', 'Maintenance staff keep learning: 907 maintenance trainees were in initial or continuing training in 2024.', 'يواصل فريق الصيانة التعلّم: كان 907 متدربين في الصيانة في التدريب الأولي أو المستمر خلال 2024.', 'sr2024', '2024-12-31', 'year', 2),
  F('jf-fr-eng', 'first_role', null, 'systems-design-plant-engineer', 'Engineers join through the scholarship and graduate programmes and train for a targeted position.', 'ينضم المهندسون عبر برامج المنح والخريجين ويتدربون على وظيفة مستهدفة.', 'enec-careers', '2026-10-08', 'day', 3),
];

/** Answer pattern biased towards a route's families; deterministic per person. */
function answersFor(pid, route) {
  const fams = new Set(ROUTE_FAMILIES[route] ?? []);
  const out = {};
  QUESTIONS.forEach((q, i) => {
    const r = h32(`${pid}:${q.id}`);
    if (r % 11 === 0) return; // some questions skipped
    if (q.id === 'q09') {
      const want = { dnt: 'a', 'energy-pioneers': 'b', gdp: 'c', gpo: 'c' }[route];
      out[q.id] = r % 5 === 0 ? 'd' : want ?? 'd';
      return;
    }
    const fitting = q.options.filter((o) => o.families.some((f) => fams.has(f)));
    const pool = fitting.length && r % 4 !== 0 ? fitting : q.options;
    out[q.id] = pool[(r >>> 3) % pool.length].id;
    void i;
  });
  return out;
}

export default function build(T, ctx) {
  const today = ctx?.DEMO_TODAY ?? '2026-10-08';
  T.journey_questions = QUESTIONS.map((q) => ({ ...q }));
  const reg = new Set(T.sources.map((s) => s.id));
  for (const f of FACTS) if (!reg.has(f.source_id)) throw new Error(`f34: unknown source ${f.source_id}`);
  T.journey_facts = FACTS.map((f) => ({ ...f }));

  const familySort = Object.fromEntries(T.job_families.map((f) => [f.id, f.sort]));
  const STAGE_OF = { mustaqbali: 'school', dnt: 'finishing_school', 'energy-pioneers': 'university', internships: 'university', gdp: 'graduate', gpo: 'graduate' };
  const journeys = [];
  const add = (pid, input, saved, cleared = null) => {
    const p = journeyPayload(T.journey_questions, input, familySort);
    journeys.push({ id: journeyId(pid), person_id: pid, stage: cleared ? null : p.stage, route: cleared ? null : p.route, interests: cleared ? {} : p.interests,
      milestones: cleared ? {} : p.milestones, saved_at: `${saved}T09:00:00Z`, updated_at: `${cleared ?? saved}T09:00:00Z`, cleared_at: cleared ? `${cleared}T09:00:00Z` : null, open_read: false });
  };

  // Demo personas: the Grade 12 student plans the DNT route (part of the checklist done); the graduate is on the GPO route.
  add('p-k-student', {
    stage: 'finishing_school', route: 'dnt',
    answers: { q01: 'a', q02: 'b', q03: 'a', q04: 'a', q05: 'a', q06: 'a', q07: 'a', q08: 'c', q09: 'a', q10: 'a' },
    checklist: { [prepKey('dnt', 'finish_g12')]: 'done', [prepKey('dnt', 'practice')]: 'done', [prepKey('dnt', 'family')]: 'done', [eligKey('dnt', 0)]: 'yes', [eligKey('dnt', 1)]: 'unsure' },
  }, '2026-09-28');
  add('p-k-graduate', {
    stage: 'graduate', route: 'gpo',
    answers: { q01: 'a', q02: 'd', q03: 'a', q04: 'a', q05: 'c', q06: 'a', q07: 'c', q08: 'd', q09: 'c', q10: 'b' },
    checklist: Object.fromEntries(PREP_ITEMS.gpo.slice(0, 3).map((i) => [prepKey('gpo', i), 'done'])),
  }, '2026-08-02');

  // Applicant pool: about two in three save a journey; stage and route follow their application where it maps to the board.
  const firstApp = new Map();
  for (const a of T.applications) if (!firstApp.has(a.person_id)) firstApp.set(a.person_id, a);
  const pool = T.people.filter((p) => p.kind === 'applicant' && !p.id.startsWith('p-k-')).map((p) => p.id).sort();
  for (const pid of pool) {
    const r = h32(`sj:${pid}`);
    if (r % 3 === 0) continue;
    const app = firstApp.get(pid);
    const prog = app?.programme_id;
    const stage = STAGE_OF[prog] ?? ['school', 'finishing_school', 'university', 'graduate'][r % 4];
    let route = JOURNEY_ROUTES.includes(prog) ? prog : prog === 'internships' ? 'energy-pioneers' : null;
    if (!route && stage === 'school' && r % 5 < 2) route = r % 2 ? 'dnt' : 'energy-pioneers';
    if (route && r % 9 === 0) route = null; // still undecided
    const items = route ? PREP_ITEMS[route] : [];
    const checklist = Object.fromEntries(items.filter((_, i) => (r >>> (i + 2)) % 3 === 0).map((i) => [prepKey(route, i), 'done']));
    const saved = new Date(Date.UTC(2026, 5 + (r % 4), 1 + (r % 27))).toISOString().slice(0, 10);
    const clearedOn = r % 37 === 0 ? '2026-10-01' : null;
    add(pid, { stage, route, answers: answersFor(pid, route ?? 'gdp'), checklist }, saved, clearedOn);
  }
  T.student_journeys = journeys;

  // Starter portfolio: credentials for 7 of the 10 accepted Mustaqbali participants (3 left for the HR director to issue),
  // the graduate's earlier Mustaqbali credential, and a few synthetic experiences.
  const accepted = [...new Set(T.applications.filter((a) => a.programme_id === 'mustaqbali' && a.stage === 'accepted').map((a) => a.person_id))].sort();
  const portfolio = accepted.slice(0, 7).map((pid) => ({ ...starterRow(pid, '2026-08-30'), created_at: '2026-08-30T10:00:00Z' }));
  portfolio.push({ ...starterRow('p-k-graduate', '2019-08-15'), created_at: '2019-08-15T10:00:00Z' });
  const X = (id, person_id, kind, title_en, title_ar, issuer_en, issuer_ar, issued_on, evidence_en, evidence_ar, programme_id = null) =>
    ({ id, person_id, kind, title_en, title_ar, issuer_en, issuer_ar, programme_id, microcred_def_id: null, status: 'issued', issued_on, evidence_en, evidence_ar, sample: true, open_read: false, created_at: `${issued_on}T10:00:00Z` });
  portfolio.push(
    X('spf-p-k-student-practice-basics', 'p-k-student', 'practice', 'Practice quiz: Nuclear energy basics', 'اختبار تدريبي: أساسيات الطاقة النووية', "Kafa'a practice bank", 'بنك التدريب في كفاءة', '2026-09-20', 'Completed the public practice quiz (practice only, no grade kept).', 'أكمل الاختبار التدريبي العام (للتدريب فقط، دون حفظ أي درجة).'),
    X('spf-p-k-student-openday', 'p-k-student', 'event', 'Science festival visit (sample)', 'زيارة مهرجان العلوم (تجريبي)', 'School trip (synthetic record)', 'رحلة مدرسية (سجل تجريبي)', '2025-11-22', 'Visited the energy stand with a school group.', 'زار جناح الطاقة مع مجموعة من المدرسة.'),
    X('spf-p-k-graduate-ep', 'p-k-graduate', 'experience', 'Energy Pioneers scholar, BSc Engineering', 'مبتعث رواد الطاقة، بكالوريوس الهندسة', 'Energy Pioneers (synthetic record)', 'رواد الطاقة (سجل تجريبي)', '2026-06-30', 'Sponsored degree at a partner university (graduated).', 'دراسة جامعية برعاية في جامعة شريكة (متخرج).', 'energy-pioneers'),
    X('spf-p-k-graduate-practice-radiation', 'p-k-graduate', 'practice', 'Practice quiz: Radiation and safety basics', 'اختبار تدريبي: أساسيات الإشعاع والسلامة', "Kafa'a practice bank", 'بنك التدريب في كفاءة', '2026-07-12', 'Completed the public practice quiz (practice only, no grade kept).', 'أكمل الاختبار التدريبي العام (للتدريب فقط، دون حفظ أي درجة).'),
  );
  T.student_portfolio = portfolio.sort((a, b) => (a.id < b.id ? -1 : 1));
  void today;
}
