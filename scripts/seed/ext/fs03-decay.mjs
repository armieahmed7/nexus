// FS03 (future-skills wave A · E2, M17) seed: honest skill states.
// build():    the per-class half-lives in engine_settings (skills: half_life_fast 18, half_life_months 36 = standard, half_life_slow 60)
//             and the three public decay-class reference rows (sourced rationale; figures live in these rows, never in copy).
// finalize(): FINALIZE_LAST and, by file name, after every f* builder (so after F32 has made its awards):
//             1. back-fills F01 `credential` evidence for every seeded micro-credential award (the W5 open item): one row per aligned
//                skill, id se:credential:<award>:<skill>, basis evidenced, level <= 2, observed on the issue date, active only while the
//                award is `awarded` (superseded and revoked awards keep an inactive row, exactly as kafaa_mc_issue / revoke leave them);
//             2. re-derives every person's skill state with the decay model, updating rows in place (F33's org stamps are kept), so
//                rpc.recomputeSkills on the seed changes nothing (idempotent) and SQL kafaa_skill_states_v2 equals the seed.
import { decayModelFrom, deriveStates, evidenceId, AREA_DECAY_CLASS, DEFAULT_HALF_LIFE_MONTHS } from '../../../src/domain/skills.ts';
import { alignedSkills } from '../../../src/modules/m17/microcred.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const WEF = { label: 'World Economic Forum · The Future of Jobs Report 2025, chapter 3: Skills outlook', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/' };
const WEF_STORY = { label: 'World Economic Forum · Future of Jobs Report 2025: the jobs of the future and the skills you need to get them', url: 'https://www.weforum.org/stories/2025/01/future-of-jobs-report-2025-jobs-of-the-future-and-the-skills-you-need-to-get-them' };
const DEGREED = { label: 'Degreed · Peer ratings: your 360-degree view of skills', url: 'https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/' };
const SKILLS_ENGLAND = { label: 'Skills England · Assessment of priority skills to 2030 (12 Aug 2025, updated 5 Nov 2025)', url: 'https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030' };
const areasOf = (cls) => Object.entries(AREA_DECAY_CLASS).filter(([, c]) => c === cls).map(([a]) => a);
const STANDARD_AREAS = ['operations', 'maintenance', 'radiation_chemistry', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'project'];

export const DECAY_CLASS_ROWS = [
  {
    id: 'fast', sort: 1, default_months: DEFAULT_HALF_LIFE_MONTHS.fast, areas: areasOf('fast'), as_of: AS_OF,
    name_en: 'Fast-changing', name_ar: 'سريعة التغيّر',
    summary_en: 'Digital, data and AI skills. Tools and ways of working change within a few years, so evidence ages quickly and needs refreshing more often.',
    summary_ar: 'مهارات الرقمنة والبيانات والذكاء الاصطناعي. تتغير الأدوات وطرق العمل خلال سنوات قليلة، لذلك تتقادم الأدلة بسرعة وتحتاج إلى تجديد أكثر.',
    examples_en: 'Data analysis and visualisation, scripting, digital twins, reviewing AI outputs under governance',
    examples_ar: 'تحليل البيانات وتصويرها، والبرمجة النصية، والتوائم الرقمية، ومراجعة مخرجات الذكاء الاصطناعي ضمن الحوكمة',
    facts: [
      { benchmark: 'WEF-FOJ', value: '39%', label_en: "of workers' core skills are expected to change by 2030 (44% in the 2023 edition). The report's wording is \"change\", not \"become obsolete\".", label_ar: 'من المهارات الأساسية للعاملين يُتوقع أن تتغير بحلول 2030 (44% في إصدار 2023). يستخدم التقرير كلمة "تتغير" لا "تصبح متقادمة".', source: WEF_STORY.label, url: WEF_STORY.url, as_of: AS_OF },
      { benchmark: 'WEF-FOJ', value: '#1', label_en: 'AI and big data is the fastest-growing skill to 2030, ahead of networks and cybersecurity, and technological literacy.', label_ar: 'الذكاء الاصطناعي والبيانات الضخمة هي المهارة الأسرع نمواً حتى 2030، تليها الشبكات والأمن السيبراني، ثم الإلمام التقني.', source: WEF.label, url: WEF.url, as_of: AS_OF },
    ],
    sources: [WEF, WEF_STORY],
  },
  {
    id: 'standard', sort: 2, default_months: DEFAULT_HALF_LIFE_MONTHS.standard, areas: STANDARD_AREAS, as_of: AS_OF,
    name_en: 'Standard', name_ar: 'قياسية',
    summary_en: 'Most operational, maintenance, quality, human-performance and leadership skills. Practised regularly and re-evidenced through training, work and check-ins.',
    summary_ar: 'معظم مهارات التشغيل والصيانة والجودة والأداء البشري والقيادة. تُمارس بانتظام ويُعاد إثباتها من خلال التدريب والعمل وتقييمات المهارات.',
    examples_en: 'Field rounds, pre-job briefs, inspection planning, coaching and feedback',
    examples_ar: 'الجولات الميدانية، وإحاطات ما قبل العمل، وتخطيط الفحص، والتوجيه وتقديم الملاحظات',
    facts: [
      { benchmark: 'SKILLS-TECH', value: null, label_en: 'Self ratings, manager ratings, skill reviews and peer ratings are kept as separate signals with their own provenance, instead of one collapsed number.', label_ar: 'تُحفظ التقييمات الذاتية وتقييمات المدير ومراجعات المهارات وتقييمات الزملاء كإشارات منفصلة لكل منها مصدرها، بدلاً من رقم واحد مدمج.', source: DEGREED.label, url: DEGREED.url, as_of: AS_OF },
    ],
    sources: [DEGREED],
  },
  {
    id: 'slow', sort: 3, default_months: DEFAULT_HALF_LIFE_MONTHS.slow, areas: areasOf('slow'), as_of: AS_OF,
    name_en: 'Slow-changing', name_ar: 'بطيئة التغيّر',
    summary_en: 'Foundational plant science, engineering and nuclear safety. The physics does not change, and requalification keeps it evidenced; evidence still ages, only more slowly.',
    summary_ar: 'العلوم الأساسية للمحطة والهندسة والأمان النووي. لا تتغير الفيزياء، وتحافظ إعادة التأهيل على إثباتها؛ ومع ذلك تتقادم الأدلة ولكن بوتيرة أبطأ.',
    examples_en: 'Core physics and reactivity, reactor coolant and safety systems, design changes, technical specifications',
    examples_ar: 'فيزياء القلب والتفاعلية، وأنظمة تبريد المفاعل والسلامة، وتغييرات التصميم، والمواصفات الفنية',
    facts: [
      { benchmark: 'FORECAST', value: null, label_en: 'Skills England publishes its 2030 estimates with the caution that all estimates of future employment are highly uncertain, and flags when a change of method breaks comparison with earlier years.', label_ar: 'تنشر هيئة المهارات في إنجلترا تقديراتها لعام 2030 مع التنبيه إلى أن جميع تقديرات التوظيف المستقبلي غير مؤكدة إلى حد كبير، وتنبّه عندما يمنع تغيير المنهجية المقارنة مع السنوات السابقة.', source: SKILLS_ENGLAND.label, url: SKILLS_ENGLAND.url, as_of: AS_OF },
    ],
    sources: [SKILLS_ENGLAND],
  },
];

export default function build(T) {
  const s = (T.engine_settings ?? []).find((r) => r.id === 'skills');
  if (s) s.weights = { ...s.weights, half_life_fast: DEFAULT_HALF_LIFE_MONTHS.fast, half_life_slow: DEFAULT_HALF_LIFE_MONTHS.slow };
  // The deployment baseline of the skills change log (F24) describes the same defaults.
  const base = (T.engine_changes ?? []).find((c) => c.id === 'ec:skills:001');
  if (s && base) base.weights_after = { ...s.weights };
  T.skill_decay_classes = DECAY_CLASS_ROWS.map((r) => ({ ...r }));
}

/** Credential evidence for the seeded micro-credential awards that wrote none (W5 open item). */
export function backfillAwardEvidence(T) {
  const have = new Set(T.skill_evidence.map((e) => e.id));
  const defs = new Map(T.microcred_defs.map((d) => [d.id, d]));
  const out = [];
  for (const a of [...T.microcred_awards].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!['awarded', 'superseded', 'revoked'].includes(a.status) || !a.issued_on) continue;
    const def = defs.get(a.def_id);
    if (!def) continue;
    for (const s of alignedSkills(def, T.skills, T.competencies)) {
      const id = evidenceId('credential', a.id, s.id);
      if (have.has(id)) continue;
      have.add(id);
      out.push({
        id, person_id: a.person_id, skill_id: s.id, kind: 'credential', ref_table: 'microcred_awards', ref_id: a.id, level: s.level, basis: 'evidenced', status: 'current',
        observed_on: String(a.issued_on).slice(0, 10), note: null, recorded_by: a.decided_by ?? a.person_id, active: a.status === 'awarded',
      });
    }
  }
  return out;
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const added = backfillAwardEvidence(T);
  T.skill_evidence = [...T.skill_evidence, ...added].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const states = deriveStates(T.skill_evidence, now, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  const seen = new Set();
  let changed = 0;
  for (const s of states) {
    seen.add(s.id);
    const cur = byId.get(s.id);
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); changed++; continue; }
    if (cur.level !== s.level || cur.confidence !== s.confidence || cur.basis !== s.basis || JSON.stringify(cur.reasons) !== JSON.stringify(s.reasons)) changed++;
    Object.assign(cur, patch);
  }
  for (const p of T.person_skills) if (!seen.has(p.id) && p.active) Object.assign(p, { active: false, level: 0, confidence: 0, basis: 'none', reasons: [], evidence_count: 0, confidence_band: 'low', conf_low: 0, conf_high: 0 });
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // F36 built the seeded digests from the earlier states (its finalizer runs before this one): rebuild them from the final states
  // with F36's own finalizer, replacing the digest notifications it made, so the seeded digests still equal a recompute.
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  console.log(`fs03: ${added.length} credential evidence rows back-filled for micro-credential awards; ${changed} skill states changed by the final derivation`);
}
