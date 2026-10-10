// F16 + F17 (wave 2 · E5, module M22) seed: Enterprise Nuclear Leadership Academy programmes (published facts from the 10th CNS
// national report, each with its source and as-of date), synthetic nominations, a completed and an open leadership-behaviours 360
// cycle (aggregates only on screen), seven communities of practice with stewards, members, moderated Q&A threads, expert finder
// opt-ins (people at level 3 or above only), in-app expert requests and a knowledge-sharing session catalogue (synthetic titles and
// recording references on the topics the CNS report lists). Synthetic people only (w-* / p-* rows); no contact details anywhere.
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';
import { BEHAVIOUR_IDS, hasContactDetails, postGuard } from '../../../src/modules/m22/domain.ts';
import { gatherEvidence, deriveStates, decayModelFrom } from '../../../src/domain/skills.ts';

const AS_OF = '2026-10-08';
/** FNV-1a for stable synthetic picks. */
function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const reg = new Map(T.sources.map((s) => [s.id, s]));
  const cns = (() => { const r = reg.get('cns10'); if (!r) throw new Error('f16: source cns10 missing'); return [{ id: 'cns10', label: r.label, url: r.url, as_of: r.accessed ?? AS_OF }]; })();
  const people = new Map(T.people.map((p) => [p.id, p]));
  const P = (id) => { const p = people.get(id); if (!p) throw new Error(`f16: unknown person ${id}`); return p; };
  const nameAr = (p) => p.display_name_ar || p.display_name;
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');

  // ───────────── F16 programmes (CNS 10th RM national report, Art. 11, Enterprise Nuclear Leadership Academy)
  const G = (id, code, kind, steps, mandatory_steps, required_tracks, skill_ids, behaviour_ids, nominable, course_id, duration_days, completions, completions_year, sort, t) => ({
    id, code, kind, steps, mandatory_steps, required_tracks, skill_ids, behaviour_ids, nominable, course_id, duration_days, completions, completions_year, sort,
    link_route: t.link ?? null, sources: cns,
    title_en: t.en, title_ar: t.ar, summary_en: t.sen, summary_ar: t.sar, audience_en: t.aen, audience_ar: t.aar, duration_en: t.den, duration_ar: t.dar, fact_en: t.fen, fact_ar: t.far,
  });
  T.leadership_programmes = [
    G('prog-intilaqa', 'INTILAQA', 'course', ['first_line'], ['first_line'], ['shift'], ['sk-ld-01', 'sk-ld-01-coach', 'sk-sc-02', 'sk-hu-02-brief'], ['b-safety-values', 'b-communication', 'b-respect'], true, 'c-intilaqa', 4, 285, 2024, 10, {
      en: 'INTILAQA: first-line leadership', ar: 'انطلاقة: قيادة الخط الأول',
      sen: 'The mandatory first-line leadership programme that introduces new leaders to the foundational skills needed to lead their teams effectively in the nuclear environment.',
      sar: 'برنامج قيادة الخط الأول الإلزامي الذي يعرّف القادة الجدد بالمهارات الأساسية اللازمة لقيادة فرقهم بفعالية في البيئة النووية.',
      aen: 'New first-line leaders (mandatory). Reactor operators and senior reactor operators take it as Leading Effective Teams (LET).', aar: 'قادة الخط الأول الجدد (إلزامي). يلتحق به مشغلو المفاعل والمشغلون الأوائل بصيغة قيادة الفرق الفعّالة (LET).',
      den: '4 days', dar: '4 أيام', fen: 'Completed by 285 leaders in 2024 (per source).', far: 'أكمله 285 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-let', 'LET', 'course', ['first_line'], [], ['shift'], ['sk-ld-01', 'sk-ld-01-coach', 'sk-ld-02', 'sk-sc-02'], ['b-safety-values', 'b-decisions', 'b-communication'], true, 'c-intilaqa', null, null, null, 20, {
      en: 'Leading Effective Teams (LET)', ar: 'قيادة الفرق الفعّالة (LET)',
      sen: 'The INTILAQA first-line leadership content as delivered to reactor operators and senior reactor operators, who lead crews in the control room.',
      sar: 'محتوى برنامج انطلاقة لقيادة الخط الأول كما يُقدَّم لمشغلي المفاعل والمشغلين الأوائل الذين يقودون الطواقم في غرفة التحكم.',
      aen: 'Reactor operators and senior reactor operators (shift supervisor track: required).', aar: 'مشغلو المفاعل والمشغلون الأوائل (مسار مشرف الوردية: إلزامي).',
      den: 'INTILAQA format', dar: 'بصيغة برنامج انطلاقة', fen: 'ROs and SROs are trained through LET (per source).', far: 'يتدرب مشغلو المفاعل والمشغلون الأوائل عبر برنامج LET (وفق المصدر).',
    }),
    G('prog-estadad', 'ESTADAD', 'programme', ['ic', 'first_line'], [], [], ['sk-ld-01', 'sk-ld-02', 'sk-ld-02-decide', 'sk-sc-01'], ['b-accountability', 'b-learning', 'b-communication'], true, 'c-estadad', 8, 62, 2024, 30, {
      en: 'ESTADAD: high-potential development', ar: 'استعداد: تطوير أصحاب الإمكانات العالية',
      sen: 'A professional development initiative that equips high-potential nuclear safety contributors with skills for leadership and continuous improvement: self-management, accountability, change management, effective communication and a strategic mindset.',
      sar: 'مبادرة للتطوير المهني تزوّد أصحاب الإمكانات العالية من المساهمين في السلامة النووية بمهارات القيادة والتحسين المستمر: إدارة الذات والمساءلة وإدارة التغيير والتواصل الفعّال والتفكير الاستراتيجي.',
      aen: 'High-potential individual contributors, by nomination.', aar: 'المساهمون الأفراد أصحاب الإمكانات العالية، بالترشيح.',
      den: '8 days', dar: '8 أيام', fen: 'Completed by 62 leaders in 2024 (per source).', far: 'أكمله 62 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-hipo-coaching', 'HIPO-COACH', 'coaching', ['ic'], [], [], ['sk-ld-01-coach', 'sk-sc-01'], ['b-learning', 'b-accountability'], false, null, null, 90, 2024, 40, {
      en: 'Coaching for high-potential employees', ar: 'الإرشاد لأصحاب الإمكانات العالية',
      sen: 'Coaching embedded in ESTADAD for high-potential employees identified by senior leaders in the 9-box review, to encourage reflection, collaboration and collective growth.',
      sar: 'إرشاد ضمن برنامج استعداد للموظفين أصحاب الإمكانات العالية الذين يحددهم كبار القادة في مراجعة المصفوفة التساعية، لتشجيع التأمل والتعاون والنمو الجماعي.',
      aen: 'High-potential individual contributors identified in the 9-box review (not by application).', aar: 'المساهمون الأفراد أصحاب الإمكانات العالية المحددون في مراجعة المصفوفة التساعية (ليس بالتقديم).',
      den: 'Part of ESTADAD', dar: 'جزء من برنامج استعداد', fen: 'Over 90 employees took part across four ESTADAD cohorts in 2024 (per source).', far: 'شارك أكثر من 90 موظفاً عبر أربع دفعات من برنامج استعداد في 2024 (وفق المصدر).',
    }),
    G('prog-fas', 'FAS', 'programme', ['first_line'], [], [], ['sk-sc-02', 'sk-ld-02'], ['b-safety-values', 'b-concerns'], true, null, 2, 419, 2024, 50, {
      en: 'Foundational Alignment Session (FAS)', ar: 'جلسة المواءمة التأسيسية (FAS)',
      sen: 'Two one-day sessions that make sure front-line leaders are fully informed of leadership gaps in the nuclear field and discuss how to tackle them as nuclear business leaders.',
      sar: 'جلستان مدة كل منهما يوم واحد لضمان اطلاع قادة الخط الأمامي على فجوات القيادة في المجال النووي ومناقشة سبل معالجتها بصفتهم قادة أعمال نووية.',
      aen: 'Front-line leaders.', aar: 'قادة الخط الأمامي.',
      den: 'Two one-day sessions', dar: 'جلستان مدة كل منهما يوم واحد', fen: 'Completed by 419 leaders in 2024 (per source).', far: 'أكمله 419 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-cld', 'CLD', 'programme', ['manager', 'director'], [], [], ['sk-ld-01', 'sk-sc-02'], ['b-safety-values', 'b-learning'], true, null, 2, 326, 2024, 60, {
      en: 'Continuous Leadership Development (CLD)', ar: 'التطوير القيادي المستمر (CLD)',
      sen: 'Two one-day sessions for managers and directors on leadership gaps in the nuclear field and how to tackle them.',
      sar: 'جلستان مدة كل منهما يوم واحد للمديرين وكبار المديرين حول فجوات القيادة في المجال النووي وسبل معالجتها.',
      aen: 'Managers and directors.', aar: 'المديرون وكبار المديرين.',
      den: 'Two one-day sessions', dar: 'جلستان مدة كل منهما يوم واحد', fen: 'Completed by 326 leaders in 2024 (per source).', far: 'أكمله 326 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-one', 'ONE', 'programme', ['manager', 'director'], [], [], ['sk-ld-01', 'sk-ld-01-coach', 'sk-ld-02', 'sk-sc-02'], ['b-safety-values', 'b-respect', 'b-learning'], true, null, 15, 52, 2024, 70, {
      en: 'Onwards to Nuclear Excellence (ONE)', ar: 'نحو التميز النووي (ONE)',
      sen: 'A transformational programme for nominated managers and directors that aims to improve station performance, employee engagement and nuclear safety through collaboration, a growth mindset, neuroscience and leadership roles.',
      sar: 'برنامج تحوّلي للمديرين وكبار المديرين المرشحين يهدف إلى تحسين أداء المحطة وتفاعل الموظفين والسلامة النووية من خلال التعاون وعقلية النمو وعلم الأعصاب والأدوار القيادية.',
      aen: 'Nominated managers and directors.', aar: 'المديرون وكبار المديرين المرشحون.',
      den: '3 weeks', dar: '3 أسابيع', fen: 'Completed by 52 leaders in 2024 (per source).', far: 'أكمله 52 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-masterclass', 'MASTERCLASS', 'programme', ['director', 'executive'], [], [], ['sk-sc-02', 'sk-ld-02'], ['b-safety-values', 'b-respect'], true, null, null, 32, 2024, 80, {
      en: 'Executive leadership master classes', ar: 'الدروس المتقدمة للقيادة التنفيذية',
      sen: 'Master classes for executive leaders on organisational culture and the behaviours needed to fulfil the organisation\'s vision.',
      sar: 'دروس متقدمة للقادة التنفيذيين حول ثقافة المؤسسة والسلوكيات اللازمة لتحقيق رؤيتها.',
      aen: 'Executive leadership.', aar: 'القيادة التنفيذية.',
      den: 'Master class series', dar: 'سلسلة دروس متقدمة', fen: 'Completed by 32 leaders in 2024 (per source).', far: 'أكملها 32 قائداً في 2024 (وفق المصدر).',
    }),
    G('prog-inpo', 'INPO', 'external', ['manager', 'director', 'executive'], [], [], ['sk-ld-02', 'sk-sc-02', 'sk-ld-02-decide'], ['b-safety-values', 'b-decisions'], true, null, null, 19, 2024, 90, {
      en: 'INPO leadership courses (Atlanta)', ar: 'دورات القيادة لدى معهد INPO (أتلانتا)',
      sen: 'Seven nuclear-specific leadership courses of various lengths at the Institute of Nuclear Power Operations in Atlanta, for nominated leaders, aligned with industry best practice for nuclear safety and operational excellence.',
      sar: 'سبع دورات قيادية متخصصة في المجال النووي بمدد مختلفة لدى معهد عمليات الطاقة النووية (INPO) في أتلانتا، للقادة المرشحين، وفق أفضل ممارسات القطاع في السلامة النووية والتميز التشغيلي.',
      aen: 'Nominated leaders.', aar: 'القادة المرشحون.',
      den: 'Various lengths', dar: 'مدد مختلفة', fen: '19 leaders completed these courses in 2024 (per source).', far: 'أكمل 19 قائداً هذه الدورات في 2024 (وفق المصدر).',
    }),
    G('prog-exec-coaching', 'EXEC-COACH', 'coaching', ['director', 'executive'], [], [], ['sk-ld-01-coach', 'sk-ld-02'], ['b-accountability', 'b-decisions'], true, null, null, 15, null, 100, {
      en: 'Executive Coaching Program', ar: 'برنامج الإرشاد التنفيذي',
      sen: 'Personalised coaching for mid-level and executive managers with external certified coaches, to prepare them for strategic roles.',
      sar: 'إرشاد مخصص للمديرين في المستويين المتوسط والتنفيذي مع مرشدين خارجيين معتمدين، لإعدادهم للأدوار الاستراتيجية.',
      aen: 'Mid-level and executive managers (chiefs, VPs and directors).', aar: 'المديرون في المستويين المتوسط والتنفيذي (الرؤساء ونواب الرئيس والمديرون).',
      den: 'Ongoing coaching sessions', dar: 'جلسات إرشاد مستمرة', fen: '15 senior leaders take part; over 55 sessions since Q4 2024, as of March 2025 (per source).', far: 'يشارك 15 من كبار القادة؛ وعُقدت أكثر من 55 جلسة منذ الربع الأخير من 2024 حتى مارس 2025 (وفق المصدر).',
    }),
    G('prog-mentoring', 'LEAD-MENTOR', 'mentoring', ['ic', 'first_line'], [], [], ['sk-ld-01-coach', 'sk-sc-01'], ['b-learning', 'b-concerns'], false, null, null, null, null, 110, {
      en: 'Leadership mentoring programme', ar: 'برنامج الإرشاد القيادي',
      sen: 'Pairs senior leaders with emerging talent to transfer knowledge, organisational values and expertise. Request a mentor in Kafa\'a mentoring.',
      sar: 'يجمع كبار القادة مع المواهب الصاعدة لنقل المعرفة وقيم المؤسسة والخبرة. اطلب مرشداً من صفحة الإرشاد في كفاءة.',
      aen: 'Emerging talent and first-line leaders.', aar: 'المواهب الصاعدة وقادة الخط الأول.',
      den: 'Mentoring agreement', dar: 'اتفاقية إرشاد', fen: 'Part of the coaching and mentoring programmes for top talent (per source).', far: 'جزء من برامج الإرشاد والتوجيه لأفضل المواهب (وفق المصدر).', link: '/my/mentoring',
    }),
  ];

  // ───────────── F16 nominations (synthetic). The nominator is always the nominee's line manager (lineManagerOf, as in M20).
  const lm = (id) => lineManagerOf(id, T.people, T.role_assignments, today);
  const prog = new Map(T.leadership_programmes.map((g) => [g.id, g]));
  const noms = [];
  const N = (n, person, programme, status, cycle, decider, reason, note = null, by = null) => {
    const nominator = by ?? lm(person);
    if (!nominator || nominator === person) throw new Error(`f16: no line manager for ${person}`);
    const p = P(person), m = P(nominator);
    const created = cycle.endsWith('H1') ? `${cycle.slice(0, 4)}-0${2 + (n % 3)}-1${n % 9}` : `${cycle.slice(0, 4)}-${['08', '09', '10'][n % 3]}-0${1 + (n % 7)}`;
    const createdOn = created > today ? today : created;
    const decidedOn = status === 'nominated' ? null : createdOn < today ? `${createdOn.slice(0, 8)}2${n % 8}` : today;
    const d = decidedOn && decidedOn > today ? today : decidedOn;
    const history = [{ at: ts(createdOn), status: 'nominated', by: nominator, note: null }];
    if (status !== 'nominated') history.push({ at: ts(d, '11:00'), status: status === 'completed' ? 'approved' : status, by: decider, note });
    if (status === 'completed') history.push({ at: ts(d, '15:00'), status: 'completed', by: decider, note: 'Programme completed (training record)' });
    noms.push({
      id: `ln-${String(n).padStart(3, '0')}`, person_id: person, programme_id: programme, nominated_by: nominator, reason, cycle, status,
      person_name: p.display_name, person_name_ar: nameAr(p), person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
      nominator_name: m.display_name, nominator_name_ar: nameAr(m), decided_by: status === 'nominated' ? null : decider, decided_at: status === 'nominated' ? null : ts(d, '11:00'),
      decision_note: note, history, created_at: ts(createdOn), updated_at: ts(d ?? createdOn, '11:00'),
    });
    if (!prog.has(programme)) throw new Error(`f16: unknown programme ${programme}`);
  };
  N(1, 'p-k-ro', 'prog-let', 'nominated', '2026-H2', null, 'Ready to lead a control-room team: steady turnover practice and strong peer checks on crew B.');
  N(2, 'w-ro-01', 'prog-let', 'approved', '2026-H1', 'p-training-mgr', 'Acts as the crew B mentor for new operators; next step is LET before SRO candidacy.');
  N(3, 'w-sro-01', 'prog-fas', 'approved', '2026-H1', 'p-chco', 'Leads the crew in my absence; FAS will align him with the front-line leadership priorities.');
  N(4, 'w-sro-04', 'prog-estadad', 'nominated', '2026-H2', null, 'Consistently raises improvement ideas and coaches newer ROs; a strong ESTADAD candidate.');
  N(5, 'p-qc-inspector', 'prog-estadad', 'approved', '2026-H1', 'p-chco', 'Leads inspection walkdowns with contractors and keeps a questioning attitude under schedule pressure.');
  N(6, 'p-sq-lead', 'prog-intilaqa', 'nominated', '2026-H2', null, 'Moving into a supplier quality team lead role this year; INTILAQA is the first step.');
  N(7, 'p-outage-planner', 'prog-estadad', 'nominated', '2026-H2', null, 'Ran the last outage schedule reviews with maturity; ready to grow leadership skills.');
  N(8, 'p-sro', 'prog-one', 'approved', '2026-H1', 'p-chco', 'Shift supervisor with a strong crew record; ONE will broaden station-level leadership.');
  N(9, 'p-work-control', 'prog-fas', 'completed', '2025-H2', 'p-chco', 'New work control lead; FAS for alignment with front-line leadership priorities.');
  N(10, 'w-ro-03', 'prog-one', 'declined', '2026-H1', 'p-chco', 'Strong performer; wants to lead a wider team.', 'ONE is for managers and directors: complete LET and FAS first, then renominate.');
  // synthetic cohort: line managers nominating people in their scope
  const auto = [
    ['w-ro-02', 'prog-let', 'approved'], ['w-ro-04', 'prog-let', 'nominated'], ['w-ro-05', 'prog-let', 'approved'], ['w-ro-06', 'prog-let', 'nominated'], ['w-ro-07', 'prog-let', 'approved'],
    ['w-sro-02', 'prog-fas', 'completed'], ['w-sro-03', 'prog-fas', 'approved'], ['w-sro-05', 'prog-estadad', 'nominated'], ['w-ss-01', 'prog-cld', 'approved'], ['w-ss-02', 'prog-cld', 'completed'],
    ['w-mnt-01', 'prog-intilaqa', 'approved'], ['w-mnt-02', 'prog-fas', 'nominated'], ['w-mnt-03', 'prog-estadad', 'approved'], ['w-chem-01', 'prog-estadad', 'nominated'], ['w-chem-02', 'prog-intilaqa', 'approved'],
    ['w-rp-01', 'prog-estadad', 'completed'], ['w-rp-02', 'prog-intilaqa', 'nominated'], ['w-qa-01', 'prog-estadad', 'declined'], ['w-qa-02', 'prog-intilaqa', 'approved'], ['w-ep-01', 'prog-estadad', 'nominated'],
    ['w-eng-01', 'prog-fas', 'completed'], ['w-eng-02', 'prog-estadad', 'nominated'], ['w-instr-01', 'prog-fas', 'approved'], ['w-fire-01', 'prog-intilaqa', 'declined'],
  ];
  const REASONS = [
    'Shows good judgement on the job and supports newer colleagues; ready for structured leadership development.',
    'Takes ownership of team improvements and communicates clearly in pre-job briefs.',
    'Steps up when the lead is away; this programme fits the next career step.',
    'Raises concerns early and helps others do the same; a natural first-line leader.',
  ];
  auto.forEach(([pid, g, status], i) => {
    if (!people.has(pid) || !lm(pid)) return;
    const n = 11 + i;
    const cycle = status === 'nominated' ? '2026-H2' : status === 'completed' ? '2025-H2' : '2026-H1';
    const decider = n % 2 ? 'p-chco' : 'p-training-mgr';
    N(n, pid, g, status, cycle, decider, REASONS[h32(pid) % REASONS.length], status === 'declined' ? 'Not this cycle: priority places went to the shift crews; renominate next half-year.' : null);
  });
  T.leadership_nominations = noms;

  // ───────────── F16 leadership behaviours 360 (synthetic). Completed cycle 2026-H1; open cycle 2026-H2.
  const reqs = [];
  const resps = [];
  const pick = (subject, n) => {
    const s = P(subject);
    const pool = staff.filter((p) => p.id !== subject && !p.id.startsWith('p-k-') && p.job_family_id).sort((a, b) => {
      const sa = a.job_family_id === s.job_family_id ? 0 : 1, sb = b.job_family_id === s.job_family_id ? 0 : 1;
      return sa - sb || h32(subject + a.id) - h32(subject + b.id);
    });
    const out = [];
    const mgr = lm(subject);
    if (mgr && mgr !== subject) out.push([mgr, 'manager']);
    for (const p of pool) {
      if (out.length >= n) break;
      if (out.some(([id]) => id === p.id)) continue;
      out.push([p.id, h32(subject + p.id) % 4 === 0 ? 'report' : 'peer']);
    }
    return out;
  };
  const scoreFor = (subject, rater, kind, cycle) => {
    const o = {};
    for (const b of BEHAVIOUR_IDS) {
      const base = 3 + (h32(`${subject}|${b}`) % 2);
      const noise = [-1, 0, 0, 1][h32(`${cycle}|${subject}|${rater}|${b}`) % 4];
      const v = kind === 'self' ? base + (h32(`${subject}|${b}|self`) % 3 === 0 ? 1 : 0) : base + noise;
      o[b] = Math.max(1, Math.min(5, v));
    }
    return o;
  };
  const add360 = (cycle, subject, nRaters, nSubmitted, withSelf = true, extra = []) => {
    const s = P(subject);
    const ex = new Set(extra.map(([id]) => id));
    const raters = [...pick(subject, nRaters + extra.length).filter(([id]) => !ex.has(id)).slice(0, nRaters - extra.length), ...extra];
    const day = cycle.endsWith('H1') ? '2026-03-1' : '2026-09-2';
    const all = withSelf ? [[subject, 'self'], ...raters] : raters;
    all.forEach(([rid, kind], i) => {
      const id = `l3q-${cycle}-${subject}-${rid}`;
      const submitted = kind === 'self' ? withSelf && cycle.endsWith('H1') : i - (withSelf ? 1 : 0) < nSubmitted;
      const inv = `${day}${h32(id) % 9}`;
      reqs.push({ id, cycle, subject_id: subject, rater_id: rid, rater_kind: kind, status: submitted ? 'submitted' : 'invited', subject_name: s.display_name, subject_name_ar: nameAr(s), invited_at: ts(inv), submitted_at: submitted ? ts(inv, '16:00') : null });
      if (submitted) resps.push({ id: `l3-${(h32(id) >>> 0).toString(16).padStart(8, '0')}${(h32(`${id}|r`) >>> 0).toString(16).padStart(8, '0')}`, cycle, subject_id: subject, rater_kind: kind, scores: scoreFor(subject, rid, kind, cycle), submitted_at: ts(inv, '16:00'), open_read: false });
    });
  };
  // completed cycle: 12 senior, 11 professional, 5 leadership, 3 entry subjects (HR cells: senior and professional shown, others suppressed)
  const H1 = '2026-H1';
  const bySeniority = (lv, ids) => ids.filter((id) => people.has(id) && people.get(id).level === lv);
  const senior = bySeniority('senior', ['w-sro-01', 'w-sro-02', 'w-sro-03', 'w-sro-04', 'w-sro-05', 'p-work-control', 'p-chem-sup', 'p-rp-lead', 'p-sme-reviewer', 'w-mnt-01', 'w-mnt-02', 'w-eng-01', 'w-instr-01', 'p-outage-manager']);
  const prof = bySeniority('professional', ['p-qc-inspector', 'p-sq-lead', 'w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04', 'w-mnt-03', 'w-chem-01', 'w-rp-01', 'w-eng-02', 'w-qa-01', 'w-ep-01']);
  const lead = bySeniority('leadership', ['p-sro', 'w-ss-01', 'w-ss-02', 'p-ops-ceo', 'p-dra']);
  const entry = bySeniority('entry', ['w-lo-01', 'w-lo-02', 'w-lo-03']);
  [...senior, ...prof, ...lead, ...entry].forEach((sid, i) => {
    const n = 5 + ((h32(sid) + i) % 4);
    add360(H1, sid, n, sid === 'w-ro-04' ? 4 : n); // w-ro-04 stays below the threshold: "not enough responses"
  });
  // open cycle 2026-H2: k-ro waits for responses (3 of 6), outage-planner (2 of 6); personas have invitations to answer
  add360('2026-H2', 'p-k-ro', 6, 3, true, [['p-sro', 'manager']]);
  add360('2026-H2', 'p-outage-planner', 6, 2, true);
  add360('2026-H2', 'w-sro-01', 6, 4, true, [['p-k-ro', 'peer'], ['p-training-mgr', 'peer']]);
  add360('2026-H2', 'w-ro-08', 5, 1, true, [['p-sro', 'manager'], ['p-qc-inspector', 'peer']]);
  // self rows for the open cycle stay "invited" until the subject rates themselves
  T.leadership_360_requests = reqs.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.leadership_360 = resps.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ───────────── F17 communities of practice
  const C = (id, code, discipline, sort, skill_ids, t) => ({ id, code, discipline, sort, skill_ids, open: true, name_en: t.en, name_ar: t.ar, charter_en: t.cen, charter_ar: t.car, steward_role_en: t.sen, steward_role_ar: t.sar });
  T.communities = [
    C('cop-ops', 'COP-OPS', 'operations', 10, ['sk-co-01', 'sk-co-02', 'sk-co-03', 'sk-pf-03'], { en: 'Operations', ar: 'العمليات', cen: 'Share good operating practice, turnover habits and learning from simulator and plant experience across the crews. Careers and learning only: no plant procedures, setpoints or security details.', car: 'تبادل الممارسات التشغيلية الجيدة وعادات تسليم الوردية والتعلم من خبرات المحاكي والمحطة بين الطواقم. للمهن والتعلم فقط: لا إجراءات تشغيل ولا نقاط ضبط ولا تفاصيل أمنية.', sen: 'Shift Supervisor (role card)', sar: 'مشرف الوردية (بطاقة دور)' }),
    C('cop-maint', 'COP-MNT', 'maintenance', 20, ['sk-mp-01', 'sk-mp-02', 'sk-mp-02-dic'], { en: 'Maintenance', ar: 'الصيانة', cen: 'Work package quality, troubleshooting skills, digital I&C learning and outage lessons learned for maintenance and work control.', car: 'جودة حزم العمل ومهارات تحري الأعطال وتعلم أجهزة القياس والتحكم الرقمية والدروس المستفادة من فترات الإيقاف للصيانة والتحكم في الأعمال.', sen: 'Work Control Lead (role card)', sar: 'قائد التحكم في الأعمال (بطاقة دور)' }),
    C('cop-chem', 'COP-CHEM', 'chemistry', 30, ['sk-ch-01', 'sk-ch-02'], { en: 'Chemistry', ar: 'الكيمياء', cen: 'Sampling practice, water chemistry learning and on-the-job tips for chemistry technicians and engineers.', car: 'ممارسات أخذ العينات وتعلم كيمياء المياه ونصائح التدريب أثناء العمل لفنيي ومهندسي الكيمياء.', sen: 'Chemistry Supervisor (role card)', sar: 'مشرف الكيمياء (بطاقة دور)' }),
    C('cop-rp', 'COP-RP', 'radiation_protection', 40, ['sk-rp-01', 'sk-rp-02'], { en: 'Radiation protection', ar: 'الوقاية من الإشعاع', cen: 'ALARA culture, survey technique learning and coaching new joiners on dose awareness.', car: 'ثقافة ALARA وتعلم تقنيات المسح وإرشاد المنضمين الجدد حول الوعي بالجرعات.', sen: 'Radiation Protection Lead (role card)', sar: 'قائد الوقاية من الإشعاع (بطاقة دور)' }),
    C('cop-eng', 'COP-ENG', 'engineering', 50, ['sk-en-01', 'sk-en-02', 'sk-ns-01'], { en: 'Engineering', ar: 'الهندسة', cen: 'Configuration management, design basis learning, system health and reactor physics refreshers.', car: 'إدارة التهيئة وتعلم أساس التصميم وصحة الأنظمة ومراجعات فيزياء المفاعلات.', sen: 'Senior Systems Engineer (role card)', sar: 'مهندس أنظمة أول (بطاقة دور)' }),
    C('cop-digital', 'COP-DAI', 'digital_ai', 60, ['sk-da-01', 'sk-da-02'], { en: 'Digital and AI', ar: 'الرقمنة والذكاء الاصطناعي', cen: 'Data skills, trending and the governed use of AI tools at work: what to check, what to record and what never to share.', car: 'مهارات البيانات وتحليل الاتجاهات والاستخدام المحكوم لأدوات الذكاء الاصطناعي في العمل: ما يجب التحقق منه وتوثيقه وما لا يجوز مشاركته أبداً.', sen: 'AI Governance Lead (role card)', sar: 'قائد حوكمة الذكاء الاصطناعي (بطاقة دور)' }),
    C('cop-hp', 'COP-HP', 'human_performance', 70, ['sk-hu-01', 'sk-hu-02', 'sk-sc-01', 'sk-sc-02'], { en: 'Human performance', ar: 'الأداء البشري', cen: 'Human performance tools in practice, pre-job briefs, questioning attitude and safety culture conversations across every discipline.', car: 'أدوات الأداء البشري في الممارسة والإحاطات قبل العمل والموقف التساؤلي وحوارات ثقافة السلامة في جميع التخصصات.', sen: 'Training Manager (role card)', sar: 'مدير التدريب (بطاقة دور)' }),
  ];
  const FAMILY_COP = { operations: 'cop-ops', maintenance: 'cop-maint', chemistry: 'cop-chem', 'radiation-protection': 'cop-rp', engineering: 'cop-eng', 'nuclear-fuel': 'cop-eng', quality: 'cop-hp', oversight: 'cop-hp', training: 'cop-hp', cyber: 'cop-digital', 'emergency-preparedness': 'cop-hp', 'fire-protection': 'cop-maint' };
  const STEWARDS = { 'cop-ops': ['p-sro', 'w-ss-01'], 'cop-maint': ['p-work-control', 'w-mnt-01'], 'cop-chem': ['p-chem-sup'], 'cop-rp': ['p-rp-lead'], 'cop-eng': ['p-sme-reviewer'], 'cop-digital': ['p-ai-governance'], 'cop-hp': ['p-training-mgr'] };
  const members = new Map();
  const M = (cid, pid, role = 'member', joined = '2025-11-02') => {
    const id = `cm:${cid}:${pid}`;
    const p = P(pid);
    if (members.has(id)) { if (role === 'steward') members.get(id).role = 'steward'; return; }
    members.set(id, { id, community_id: cid, person_id: pid, role, active: true, person_name: p.display_name, person_name_ar: nameAr(p), person_role_id: p.job_role_id ?? null, joined_at: ts(joined), updated_at: ts(joined) });
  };
  for (const [cid, ids] of Object.entries(STEWARDS)) for (const pid of ids) M(cid, pid, 'steward', '2025-09-15');
  for (const p of staff) {
    if (p.id === 'p-outage-planner' || p.id === 'p-qc-inspector') continue; // left for the join demo (qc-inspector joins below)
    const cid = FAMILY_COP[p.job_family_id];
    if (cid) M(cid, p.id, 'member', `2025-1${h32(p.id) % 3}-0${1 + (h32(p.id) % 9)}`);
    if (h32(`${p.id}|hp`) % 3 === 0 && cid !== 'cop-hp' && cid) M('cop-hp', p.id);
    if (h32(`${p.id}|dai`) % 4 === 0 && cid !== 'cop-digital' && cid) M('cop-digital', p.id);
  }
  M('cop-hp', 'p-k-ro', 'member', '2026-01-12');
  M('cop-hp', 'w-sro-03'); M('cop-hp', 'w-sro-05'); M('cop-digital', 'w-mnt-02');
  M('cop-eng', 'p-qc-inspector', 'member', '2026-02-03');
  M('cop-digital', 'p-chco', 'member', '2026-03-01');
  T.community_members = [...members.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  // threads and posts: [community, title, lang, author, [[author, body, status?, note?], ...], day]
  const threads = [];
  const posts = [];
  const TH = (n, cid, title, lang, day, items, skill_ids = []) => {
    const tid = `th-${String(n).padStart(3, '0')}`;
    const ps = items.map(([author, body, status = 'published', note = null, mod = null], i) => {
      const a = P(author);
      if (!members.has(`cm:${cid}:${author}`)) throw new Error(`f17: ${author} is not a member of ${cid}`);
      const created = ts(day, `${String(8 + i * 2).padStart(2, '0')}:${String(10 + ((h32(tid) + i * 7) % 49)).padStart(2, '0')}`);
      return { id: `po-${String(n).padStart(3, '0')}-${i + 1}`, thread_id: tid, community_id: cid, author_id: author, author_name: a.display_name, author_name_ar: nameAr(a), body, lang: /[؀-ۿ]/.test(body) ? 'ar' : 'en', status, visible: status === 'published', moderated_by: mod, moderated_at: mod ? ts(day, '18:00') : null, moderation_note: note, created_at: created };
    });
    const first = ps[0];
    const a = P(first.author_id);
    const pub = ps.filter((p) => p.status === 'published');
    threads.push({ id: tid, community_id: cid, title, lang, author_id: first.author_id, author_name: a.display_name, author_name_ar: nameAr(a), first_post_id: first.id, status: 'open', visible: first.status === 'published', reply_count: pub.filter((p) => p.id !== first.id).length, last_post_at: pub.map((p) => p.created_at).sort().pop() ?? first.created_at, skill_ids, created_at: first.created_at });
    posts.push(...ps);
  };
  TH(1, 'cop-ops', 'Structuring turnover notes for a 12-hour shift', 'en', '2026-09-14', [
    ['w-sro-01', 'How do you structure your turnover notes so the oncoming crew gets the plant picture in the first five minutes? I start with plant status, then equipment out of service, then work in progress, then anything unusual I noticed.'],
    ['p-sro', 'Good order. I add a short "what would worry me" line at the end: it is often the most useful part of the turnover and it invites questions.'],
    ['w-ro-01', 'We started reading the narrative log aloud at the board walkdown. It slowed us down by two minutes and caught two open items last month.'],
    ['p-k-ro', 'Helpful. I will try the "what would worry me" line on my next nights and report back here.'],
  ], ['sk-co-02']);
  TH(2, 'cop-ops', 'نصائح للاستعداد لتدريب المحاكي المستمر', 'ar', '2026-09-21', [
    ['w-ro-02', 'كيف تستعدون لأسبوع تدريب المحاكي المستمر؟ أراجع الأحداث التشغيلية الأخيرة وأتدرب على أسلوب التواصل الثلاثي مع زملائي قبل الأسبوع.'],
    ['w-sro-02', 'أنصح بمراجعة الدروس المستفادة من جلسة المحاكي السابقة ومناقشتها مع الطاقم. التركيز على العمل الجماعي يصنع الفرق.'],
    ['w-ss-01', 'وتذكروا أن الهدف هو التعلم وليس الدرجة. اطرحوا الأسئلة على المدربين خلال المراجعة بعد كل سيناريو.'],
  ], ['sk-co-02', 'sk-hu-01']);
  TH(3, 'cop-ops', 'Self-checking habits during long surveillances', 'en', '2026-10-06', [
    ['w-lo-04', 'First post here. During long surveillances I lose focus after about an hour. What simple habits help you keep self-checking (STAR) sharp until the end?', 'held'],
  ], ['sk-hu-01-star']);
  TH(4, 'cop-maint', 'Work package quality: lessons from the last outage', 'en', '2026-08-30', [
    ['p-work-control', 'Three themes from our outage critique: missing isolation boundaries on the package cover sheet, late parts staging, and unclear hold points. What one change would help most in your area?'],
    ['w-mnt-01', 'A walkdown of the package with the planner two days before the window. We caught most of our hold point issues that way.'],
    ['w-mnt-04', 'Agree. A short checklist on the cover sheet for hold points would also help new technicians.'],
    ['w-mnt-06', 'Agree. A short checklist on the cover sheet for hold points would also help new technicians.', 'hidden', 'Duplicate of the reply above; keeping the thread readable.', 'p-work-control'],
  ], ['sk-mp-01']);
  TH(5, 'cop-maint', 'Getting started with digital I&C troubleshooting courses', 'en', '2026-07-19', [
    ['w-mnt-05', 'Which courses would you take first to move from analogue to digital I&C troubleshooting? I have the basics and want a structured path.'],
    ['w-mnt-02', 'The vendor platform fundamentals first, then the plant data trending module. The Learning Coach suggested the same order for me.'],
  ], ['sk-mp-02-dic']);
  TH(6, 'cop-chem', 'On-the-job tips for new chemistry technicians: sampling rounds', 'en', '2026-09-03', [
    ['p-chem-sup', 'For new technicians: plan your sampling round, label before you sample, and log as you go rather than at the end. What else would you add?'],
    ['w-chem-01', 'Ask for a peer check on the first few rounds. Nobody minds, and it builds good habits.'],
    ['w-chem-03', 'Keep a personal notebook of the questions you had each week; it makes your OJT sign-off conversations much easier.'],
  ], ['sk-ch-01']);
  TH(7, 'cop-chem', 'قراءات مقترحة حول كيمياء المياه في المفاعلات', 'ar', '2026-06-22', [
    ['w-chem-02', 'ما هي القراءات التي تنصحون بها للمبتدئين في كيمياء المياه للمفاعلات؟ أبحث عن مصادر عامة ومبسطة.'],
    ['p-chem-sup', 'ابدأ بمواد التدريب الأولي في الكتالوج ثم إرشادات الصناعة المنشورة للعموم. وسأشارك قائمة في جلسة تبادل المعرفة القادمة.'],
  ], ['sk-ch-02']);
  TH(8, 'cop-rp', 'Explaining dose budgets to new joiners', 'en', '2026-08-11', [
    ['p-rp-lead', 'How do you explain dose budgets to new joiners without numbers overwhelming them? I use the idea of a shared team budget that we all protect.'],
    ['w-rp-02', 'I show how good planning reduced time in the area on a past job. A real example sticks better than the rules.'],
    ['w-rp-04', 'Pairing them with an experienced technician for the first jobs works well for us.'],
  ], ['sk-rp-01']);
  TH(9, 'cop-eng', 'Configuration management: checking a drawing revision', 'en', '2026-09-09', [
    ['p-sme-reviewer', 'Reminder for newer engineers: always confirm you are using the current revision before you rely on a drawing. How do you build that check into your routine?'],
    ['w-eng-03', 'I check the revision before every review meeting and note it in my review comments.'],
    ['p-qc-inspector', 'From the quality side: noting the revision in the record saves a lot of follow-up questions later.'],
  ], ['sk-en-01']);
  TH(10, 'cop-eng', 'Resources for reactor physics refreshers', 'en', '2026-05-28', [
    ['w-eng-02', 'Looking for refresher material on reactor physics fundamentals for engineers outside the core team. Any favourites?'],
    ['w-eng-01', 'The fundamentals course in the catalogue plus the public IAEA training material are a good start.'],
  ], ['sk-ns-01']);
  TH(11, 'cop-digital', 'Python for trending plant data: starter resources', 'en', '2026-09-25', [
    ['p-ai-governance', 'Starter path for staff who want to trend data with Python: a basics course, then a guided project on a sample (synthetic) data set. Share what worked for you.'],
    ['w-cyb-01', 'Start with notebooks and plotting before anything clever. Small wins keep you going.'],
    ['p-chco', 'Great to see this. Data skills are a priority in our development plans.'],
  ], ['sk-da-01']);
  TH(12, 'cop-digital', 'Using AI summaries responsibly: what do you check?', 'en', '2026-10-01', [
    ['p-ai-governance', 'Before you rely on an AI-generated summary at work, what do you check? I start with: does it cite a source I can open, and does it match the source?'],
    ['w-mnt-02', 'I never paste anything restricted into a tool, and I keep a note of what I relied on.'],
  ], ['sk-da-02']);
  TH(13, 'cop-hp', 'STAR in practice: share an example from this week', 'en', '2026-09-30', [
    ['p-training-mgr', 'Share a short example from this week where Stop, Think, Act, Review made a difference. Small examples are the most useful.'],
    ['w-qa-01', 'Stopped before signing a record when a serial number looked wrong. It was a typo in the package, now corrected.'],
    ['p-k-ro', 'Paused before a component manipulation when the label was faded. Verified with the peer checker before acting.'],
  ], ['sk-hu-01', 'sk-hu-01-star']);
  TH(14, 'cop-hp', 'Pre-job briefs graded to risk: what does "graded" look like?', 'en', '2026-08-18', [
    ['w-instr-01', 'How do you decide how deep a pre-job brief goes? We use a simple risk screen: first-time evolution, unusual conditions, or a previous event triggers the full brief.'],
    ['w-sro-03', 'Same in operations. A short brief for routine work still covers the critical steps and the stop criteria.'],
  ], ['sk-hu-02-brief']);
  TH(15, 'cop-hp', 'ثقافة السلامة: كيف تشجع فريقك على طرح الأسئلة؟', 'ar', '2026-07-07', [
    ['p-training-mgr', 'ما الذي تفعله لتشجيع فريقك على طرح الأسئلة دون تردد؟ أبدأ اجتماعاتي بسؤال مفتوح وأشكر من يطرح ملاحظة.'],
    ['w-sro-05', 'عندما يعترف القائد بخطئه أمام الفريق يصبح الجميع أكثر استعداداً للحديث.'],
    ['w-ep-02', 'نخصص دقيقتين في نهاية الإحاطة لأي سؤال، مهما كان بسيطاً.'],
  ], ['sk-sc-01']);
  T.threads = threads;
  T.posts = posts;
  // every seeded post and title passes the posting rules
  for (const x of [...threads.map((t) => t.title), ...posts.map((p) => p.body)]) {
    if (postGuard(x, T.refusal_policies ?? []) || hasContactDetails(x)) throw new Error(`f17: seeded text fails the posting rules: ${x.slice(0, 60)}`);
  }

  // knowledge-sharing sessions (synthetic titles and recording references on the CNS-listed topics)
  const KS = (n, cid, topic, held_on, minutes, kw, t) => ({
    id: `ks-${String(n).padStart(2, '0')}`, community_id: cid, topic, held_on, status: held_on > today ? 'upcoming' : 'held', duration_min: minutes,
    recording_ref: held_on > today ? null : `KS-REC-${held_on.slice(0, 4)}-${String(n).padStart(3, '0')}`, keywords: kw, skill_ids: t.skills ?? [], synthetic: true, sources: cns,
    title_en: t.en, title_ar: t.ar, summary_en: t.sen, summary_ar: t.sar, presenter_role_en: t.pen, presenter_role_ar: t.par,
  });
  T.ks_sessions = [
    KS(1, 'cop-ops', 'proficiency', '2025-03-12', 60, ['proficiency', 'watch', 'الكفاءة'], { en: 'Keeping proficiency between watches', ar: 'الحفاظ على الكفاءة بين المناوبات', sen: 'How licensed operators plan proficiency watches and use the simulator to stay sharp between cycles.', sar: 'كيف يخطط المشغلون المرخصون لمناوبات الكفاءة ويستخدمون المحاكي للحفاظ على جاهزيتهم بين الدورات.', pen: 'Shift Supervisor (role card)', par: 'مشرف الوردية (بطاقة دور)', skills: ['sk-co-01'] }),
    KS(2, 'cop-maint', 'outage_lessons', '2025-05-20', 75, ['outage', 'lessons learned', 'الدروس المستفادة', 'فترة الإيقاف'], { en: 'Outage lessons learned: work packages and parts', ar: 'الدروس المستفادة من فترة الإيقاف: حزم العمل وقطع الغيار', sen: 'What went well and what to improve in package preparation, parts staging and hold points.', sar: 'ما نجح وما يجب تحسينه في إعداد حزم العمل وتجهيز قطع الغيار ونقاط التوقف.', pen: 'Outage Manager (role card)', par: 'مدير فترات الإيقاف (بطاقة دور)', skills: ['sk-mp-01', 'sk-mp-01-outage'] }),
    KS(3, null, 'project_management', '2025-06-17', 60, ['project', 'schedule', 'إدارة المشاريع'], { en: 'Project management basics for technical leads', ar: 'أساسيات إدارة المشاريع للقادة الفنيين', sen: 'Scope, schedule and risk registers in plain terms, with examples from plant improvement projects.', sar: 'النطاق والجدول الزمني وسجلات المخاطر بلغة بسيطة مع أمثلة من مشاريع تحسين المحطة.', pen: 'Project Engineer (role card)', par: 'مهندس مشاريع (بطاقة دور)' }),
    KS(4, 'cop-digital', 'ai', '2025-09-24', 60, ['ai', 'artificial intelligence', 'الذكاء الاصطناعي', 'governance'], { en: 'Artificial intelligence at work: governed use', ar: 'الذكاء الاصطناعي في العمل: استخدام محكوم', sen: 'What AI tools are good for, what to check before relying on an output, and what must never be shared.', sar: 'فيمَ تفيد أدوات الذكاء الاصطناعي، وما الذي يجب التحقق منه قبل الاعتماد على مخرجاتها، وما لا يجوز مشاركته أبداً.', pen: 'AI Governance Lead (role card)', par: 'قائد حوكمة الذكاء الاصطناعي (بطاقة دور)', skills: ['sk-da-02'] }),
    KS(5, 'cop-ops', 'mcr_overview', '2025-10-15', 90, ['main control room', 'mcr', 'simulator', 'غرفة التحكم الرئيسية', 'المحاكي'], { en: 'Overview of main control room operations in a simulated environment', ar: 'نظرة عامة على عمليات غرفة التحكم الرئيسية في بيئة محاكاة', sen: 'A guided tour of how a crew works together in the main control room, run on the training simulator for non-operations staff.', sar: 'جولة إرشادية حول كيفية عمل الطاقم معاً في غرفة التحكم الرئيسية، تُقدَّم على محاكي التدريب لموظفي الأقسام غير التشغيلية.', pen: 'Senior Reactor Operator Instructor (role card)', par: 'مدرب مشغل مفاعل أول (بطاقة دور)', skills: ['sk-co-02'] }),
    KS(6, 'cop-rp', 'radiation_safety', '2025-11-19', 60, ['radiation', 'alara', 'dose', 'الوقاية من الإشعاع', 'الجرعة'], { en: 'Radiation safety refresher for all staff', ar: 'تذكير بالسلامة الإشعاعية لجميع الموظفين', sen: 'ALARA in everyday terms: time, distance and shielding, and how good planning keeps doses low.', sar: 'مبدأ ALARA بلغة يومية: الوقت والمسافة والتدريع، وكيف يحافظ التخطيط الجيد على انخفاض الجرعات.', pen: 'Radiation Protection Lead (role card)', par: 'قائد الوقاية من الإشعاع (بطاقة دور)', skills: ['sk-rp-01'] }),
    KS(7, 'cop-digital', 'data_analytics', '2026-01-21', 60, ['data analytics', 'trending', 'python', 'تحليل البيانات'], { en: 'Data analytics: trending equipment health', ar: 'تحليل البيانات: رصد اتجاهات صحة المعدات', sen: 'Simple trending techniques that help engineers and technicians spot early signs of equipment degradation.', sar: 'تقنيات بسيطة لرصد الاتجاهات تساعد المهندسين والفنيين على اكتشاف العلامات المبكرة لتدهور المعدات.', pen: 'Data Analyst (role card)', par: 'محلل بيانات (بطاقة دور)', skills: ['sk-da-01'] }),
    KS(8, 'cop-hp', 'human_performance', '2026-02-18', 45, ['star', 'self-checking', 'human performance', 'الأداء البشري', 'التحقق الذاتي'], { en: 'Human performance tools: self-checking that sticks', ar: 'أدوات الأداء البشري: تحقق ذاتي يدوم', sen: 'Practical ways to make STAR and peer checking habits rather than steps you remember under pressure.', sar: 'طرق عملية لجعل أسلوب STAR والتحقق المتبادل عادة لا خطوات نتذكرها تحت الضغط.', pen: 'Human Performance Specialist (role card)', par: 'أخصائي الأداء البشري (بطاقة دور)', skills: ['sk-hu-01', 'sk-hu-01-star'] }),
    KS(9, 'cop-chem', 'chemistry', '2026-03-25', 60, ['chemistry', 'sampling', 'الكيمياء', 'العينات'], { en: 'Sampling practice for new chemistry technicians', ar: 'ممارسات أخذ العينات لفنيي الكيمياء الجدد', sen: 'Planning a sampling round, labelling and logging as you go, and asking for a peer check early.', sar: 'التخطيط لجولة أخذ العينات والتوسيم والتوثيق أثناء العمل وطلب التحقق المتبادل مبكراً.', pen: 'Chemistry Supervisor (role card)', par: 'مشرف الكيمياء (بطاقة دور)', skills: ['sk-ch-01'] }),
    KS(10, 'cop-ops', 'proficiency', '2026-04-22', 60, ['turnover', 'shift', 'تسليم الوردية'], { en: 'Shift turnover that works', ar: 'تسليم وردية فعّال', sen: 'Structured turnover, narrative logs and the questions that help the oncoming crew build the plant picture.', sar: 'تسليم منظم للوردية وسجلات سردية وأسئلة تساعد الطاقم القادم على تكوين صورة المحطة.', pen: 'Shift Supervisor (role card)', par: 'مشرف الوردية (بطاقة دور)', skills: ['sk-co-02'] }),
    KS(11, 'cop-maint', 'maintenance', '2026-05-27', 60, ['digital i&c', 'troubleshooting', 'أجهزة القياس والتحكم'], { en: 'From analogue to digital I&C troubleshooting', ar: 'من تحري أعطال الأجهزة التناظرية إلى الرقمية', sen: 'How experienced technicians adapted their troubleshooting approach to digital instrumentation and control.', sar: 'كيف كيّف الفنيون ذوو الخبرة نهجهم في تحري الأعطال مع أجهزة القياس والتحكم الرقمية.', pen: 'Maintenance Technician Lead (role card)', par: 'قائد فنيي الصيانة (بطاقة دور)', skills: ['sk-mp-02-dic'] }),
    KS(12, 'cop-eng', 'proficiency', '2026-06-24', 60, ['configuration', 'design basis', 'إدارة التهيئة'], { en: 'Configuration management for new engineers', ar: 'إدارة التهيئة للمهندسين الجدد', sen: 'Why revision control and design basis matter, with everyday habits that prevent errors.', sar: 'لماذا يهم التحكم في المراجعات وأساس التصميم، مع عادات يومية تمنع الأخطاء.', pen: 'Senior Systems Engineer (role card)', par: 'مهندس أنظمة أول (بطاقة دور)', skills: ['sk-en-01'] }),
    KS(13, 'cop-ops', 'outage_lessons', '2026-10-21', 60, ['outage', 'lessons learned', 'operations', 'فترة الإيقاف'], { en: 'Outage lessons learned for operations crews', ar: 'الدروس المستفادة من فترة الإيقاف لطواقم العمليات', sen: 'Upcoming: what the last outage taught operations crews about coordination with maintenance and work control.', sar: 'قادمة: ما تعلمته طواقم العمليات من فترة الإيقاف الأخيرة حول التنسيق مع الصيانة والتحكم في الأعمال.', pen: 'Shift Supervisor (role card)', par: 'مشرف الوردية (بطاقة دور)', skills: ['sk-co-01'] }),
    KS(14, 'cop-digital', 'ai', '2026-11-11', 60, ['ai', 'search', 'الذكاء الاصطناعي'], { en: 'AI search over procedures: what is allowed', ar: 'البحث بالذكاء الاصطناعي في الوثائق: ما المسموح', sen: 'Upcoming: governed use of AI search tools for learning content, and what stays out of scope.', sar: 'قادمة: الاستخدام المحكوم لأدوات البحث بالذكاء الاصطناعي في محتوى التعلم، وما يبقى خارج النطاق.', pen: 'AI Governance Lead (role card)', par: 'قائد حوكمة الذكاء الاصطناعي (بطاقة دور)', skills: ['sk-da-02'] }),
    KS(15, 'cop-hp', 'human_performance', '2026-11-25', 45, ['leadership', 'questioning attitude', 'القيادة', 'الموقف التساؤلي'], { en: 'Leaders and the questioning attitude', ar: 'القادة والموقف التساؤلي', sen: 'Upcoming: how first-line leaders encourage people to raise questions, linked to the leadership academy.', sar: 'قادمة: كيف يشجع قادة الخط الأول الأشخاص على طرح الأسئلة، بالارتباط مع أكاديمية القيادة.', pen: 'Training Manager (role card)', par: 'مدير التدريب (بطاقة دور)', skills: ['sk-sc-01', 'sk-ld-01'] }),
    KS(16, 'cop-rp', 'radiation_safety', '2026-12-09', 60, ['radiation', 'survey', 'المسح الإشعاعي'], { en: 'Survey technique clinic', ar: 'ورشة تقنيات المسح الإشعاعي', sen: 'Upcoming: hands-on tips for survey technique, with time for questions from new technicians.', sar: 'قادمة: نصائح عملية لتقنيات المسح مع وقت لأسئلة الفنيين الجدد.', pen: 'Radiation Protection Lead (role card)', par: 'قائد الوقاية من الإشعاع (بطاقة دور)', skills: ['sk-rp-02-survey'] }),
  ];
}

/** After the other builders (and before F01 derives states): expert opt-ins for people whose derived level is >= 3, and requests. */
export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const src = {
    skills: T.skills, competencies: T.competencies, role_competencies: T.role_competencies, qual_standards: T.qual_standards, qual_records: T.qual_records,
    training_records: T.training_records, courses: T.courses, attempts: T.attempts, assessment_forms: T.assessment_forms, jpm_results: T.jpm_results, jpms: T.jpms,
  };
  const derived = gatherEvidence(src, { person: null, now });
  const recorded = (T.skill_evidence ?? []).filter((e) => ['rating', 'ojt', 'credential'].includes(e.kind));
  const states = deriveStates([...derived, ...recorded], now, decayModelFrom(T.engine_settings, T.skills)); // FS03: per-class half-lives
  const lv = new Map(states.map((s) => [`${s.person_id}:${s.skill_id}`, s]));
  const skill = new Map(T.skills.map((s) => [s.id, s]));
  const people = new Map(T.people.map((p) => [p.id, p]));
  const nameAr = (p) => p.display_name_ar || p.display_name;
  const OPT = [
    ['p-sro', ['sk-co-02', 'sk-co-03', 'sk-ld-02'], true, 'Shift turnover, reactivity management and conservative decisions'],
    ['p-chem-sup', ['sk-ch-01', 'sk-ch-02'], true, 'Sampling practice and water chemistry for new technicians'],
    ['p-rp-lead', ['sk-rp-01', 'sk-rp-02-survey'], true, 'ALARA coaching and survey technique'],
    ['p-sme-reviewer', ['sk-en-01', 'sk-en-02'], true, 'Configuration management and design reviews'],
    ['p-training-mgr', ['sk-hu-01', 'sk-ld-01-instruct'], true, 'Human performance tools and instructional delivery'],
    ['p-work-control', ['sk-mp-01', 'sk-hu-02'], true, 'Work packages and pre-job briefs'],
    ['p-head-sq', ['sk-qa-01', 'sk-qa-02'], true, 'Inspection planning and supplier quality'],
    ['p-ep-manager', ['sk-ep-01', 'sk-ep-02'], true, 'Emergency preparedness drills (careers and learning only)'],
    ['w-sro-01', ['sk-co-02', 'sk-pf-03'], true, 'Turnover practice and plant systems refreshers'],
    ['w-ro-03', ['sk-co-01', 'sk-hu-02-brief'], true, 'Rounds and pre-job briefs'],
    ['w-mnt-02', ['sk-mp-02-dic', 'sk-mp-01-outage'], true, 'Digital I&C troubleshooting'],
    ['w-mnt-05', ['sk-mp-02-dic'], true, 'Digital I&C maintenance'],
    ['w-chem-01', ['sk-ch-01-primary'], true, 'Primary chemistry sampling'],
    ['w-rp-01', ['sk-rp-01', 'sk-rp-02'], true, 'Dose planning'],
    ['w-eng-01', ['sk-en-01', 'sk-ns-01'], true, 'Design basis and reactor physics'],
    ['w-eng-04', ['sk-en-02'], false, ''],
    ['w-qa-01', ['sk-qa-01-inspect'], true, 'Inspection technique'],
    ['w-ep-01', ['sk-ep-01-ero'], true, 'Emergency response organisation learning'],
    ['w-instr-01', ['sk-ld-01-instruct', 'sk-co-01'], true, 'Instructional delivery and operator fundamentals'],
    ['w-fire-01', ['sk-ep-02-fire'], true, 'Fire protection learning paths'],
    ['w-lo-01', ['sk-co-01-rounds'], false, ''],
    ['p-qc-inspector', ['sk-qa-01'], true, 'Inspection records that stand up to review'],
  ];
  T.expert_optin = OPT.flatMap(([pid, skills, visible, headline]) => {
    const p = people.get(pid);
    if (!p) return [];
    const ok = skills.filter((s) => (lv.get(`${pid}:${s}`)?.level ?? 0) >= 3 && skill.get(s)?.area !== 'security');
    if (!ok.length) return [];
    return [{ id: `eo:${pid}`, person_id: pid, skill_ids: [...ok].sort(), visible, headline, person_name: p.display_name, person_name_ar: nameAr(p), role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null, team_id: p.team_id ?? null, updated_at: `${now}T08:00:00Z` }];
  }).sort((a, b) => (a.id < b.id ? -1 : 1));
  const opt = new Map(T.expert_optin.map((o) => [o.person_id, o]));
  const R = (n, requester, expert, sk, message, status, reply, day) => {
    const o = opt.get(expert);
    if (!o || !o.visible || !o.skill_ids.includes(sk)) throw new Error(`f17: expert request ${n} targets a skill ${expert} did not list`);
    const a = people.get(requester), e = people.get(expert);
    return { id: `er-${String(n).padStart(3, '0')}`, expert_id: expert, requester_id: requester, skill_id: sk, message, status, reply, requester_name: a.display_name, requester_name_ar: nameAr(a), expert_name: e.display_name, expert_name_ar: nameAr(e), created_at: `${day}T10:00:00Z`, answered_at: status === 'sent' ? null : `${day}T15:30:00Z` };
  };
  T.expert_requests = [
    R(1, 'p-k-ro', 'w-sro-01', 'sk-co-02', 'Could we spend 20 minutes on how you structure turnover notes? I want to improve mine before my LET course.', 'accepted', 'Happy to. Find me after the Tuesday crew brief.', '2026-09-16'),
    R(2, 'p-qc-inspector', 'p-sme-reviewer', 'sk-en-01', 'I would like to understand how engineering checks a drawing revision before a design review. Could you walk me through it?', 'sent', null, '2026-10-05'),
    R(3, 'p-outage-planner', 'w-mnt-02', 'sk-mp-02-dic', 'Planning the next outage scope with digital I&C work. Could you share how you estimate troubleshooting time?', 'declined', 'Out on a course this month; please ask the maintenance community.', '2026-09-28'),
    R(4, 'w-chem-03', 'p-chem-sup', 'sk-ch-02', 'Could you recommend public reading on water chemistry fundamentals for my development plan?', 'accepted', 'Yes: I will bring a list to the next knowledge-sharing session.', '2026-09-10'),
  ];
  for (const x of [...T.expert_requests.map((r) => r.message), ...T.expert_requests.map((r) => r.reply ?? ''), ...T.expert_optin.map((o) => o.headline)]) {
    if (postGuard(x, T.refusal_policies ?? []) || hasContactDetails(x)) throw new Error(`f17: seeded text fails the posting rules: ${x.slice(0, 60)}`);
  }
}
