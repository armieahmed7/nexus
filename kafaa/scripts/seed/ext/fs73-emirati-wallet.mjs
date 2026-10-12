// FS73 Emirati pipeline by competency + FS74 Future Skills Wallet target (future-skills wave H · E2, M37 National Alignment).
// finalize() (FINALIZE_LAST; "fs73" sorts after fs62 (national tags and links, which it adds to) and before the fsqa* integration builders):
//   pipeline_mirror   SIMULATED, de-identified HR mirror of hires into the FS73 critical and future roles (pipelineRoles: current roles
//                     that are critical or whose FS16 outlook is "growing"; never concept or security-sensitive roles): role, nationality
//                     group, hire date (2016 to 2026), leave date and authorisation date for regulated roles. No person id and no name: it
//                     stands in for the HR system Kafa'a does not connect to, and only the suppressed FS73 aggregate reads it.
//   wallet_targets    the FS74 leadership setting: 60 % of staff with the complete core-five wallet by 2027-12-31 (handover Appendix B
//                     demo value; settled decision), set by the HR director role card, with its sources from the research pack.
//   tag_links         (M37, FS62 hand-off) the wallet target tagged to the Jahiz strategy and to the National AI Strategy 2031.
//   plan_activities   (M04, additive) the first open wallet item of p-k-ro and p-nse already sits in their open development plan, so the
//                     "goals and evidence travel together" link shows on the wallet page.
// Seeds are honest, not tuned: the wallet counter is computed from the existing evidence (few staff hold all five today, so the
// headline count is suppressed and the items carry the story). Synthetic data only; the builder fails on any broken rule.
import { pipelineRoles, addMonths, emiratiPipeline, pipelineWorldFrom, EP_MIN } from '../../../src/modules/m37/pipeline.ts';
import { planEntries, planFor, targetProblem, walletCounter, walletStatus, walletWorld, WALLET_METRIC, WALLET_TARGET_ID } from '../../../src/modules/m37/wallet.ts';
import { linkProblem, targetView, worldFrom, typedTotalFree } from '../../../src/modules/m37/national.ts';

export const FINALIZE_LAST = true;
const MIRROR_TO = '2026-10-01'; // last HR mirror sync (before the seeded digests of 2026-10-08)
const SEEDED_AT = '2026-10-11T08:00:00Z';
const BY = 'p-chco'; // HR director (CHCO office) role card
const AS_OF = '2026-10-10'; // research pack read on this date (national_systems.md)

// [hires into the role since 2016, Emirati share, months from hire to authorisation for regulated roles]
const PLAN = {
  'local-operator': [96, 0.72, [10, 22]],
  'reactor-operator': [64, 0.66, [20, 36]],
  'senior-reactor-operator': [40, 0.6, [26, 44]],
  'shift-supervisor': [16, 0.55, [30, 54]],
  'shift-technical-advisor': [18, 0.5, null],
  'operations-support-work-control': [30, 0.6, null],
  'maintenance-technician-engineer': [110, 0.58, null],
  'reactor-engineer-core-physicist': [22, 0.45, null],
  'radiation-protection-technician': [46, 0.7, [10, 22]],
  'chemistry-technician': [34, 0.68, [10, 22]],
  'emergency-preparedness-coordinator': [20, 0.6, [12, 28]],
  'nuclear-training-instructor': [28, 0.5, [16, 32]],
  'nuclear-oversight-npi': [18, 0.55, null],
  'human-performance-specialist': [12, 0.5, null],
};
const LEAVE = { uae: 0.045, other: 0.085 }; // yearly leaving probability in the mirror

function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pad = (n) => String(n).padStart(2, '0');

export function buildMirror(T) {
  const roles = pipelineRoles({ job_roles: T.job_roles, role_outlook_labels: T.role_outlook_labels ?? [], succession_slates: T.succession_slates ?? [] });
  const out = [];
  for (const r of roles) {
    const [n, uaeShare, auth] = PLAN[r.role_id] ?? [20, 0.55, r.regulated ? [16, 32] : null];
    const rand = rng(`fs73:${r.role_id}`);
    for (let i = 1; i <= n; i++) {
      const y = 2016 + Math.floor(rand() * 11); // 2016 .. 2026
      const m = y === 2026 ? 1 + Math.floor(rand() * 8) : 1 + Math.floor(rand() * 12);
      const hired = `${y}-${pad(m)}-${pad(1 + Math.floor(rand() * 28))}`;
      const nat = rand() < uaeShare ? 'uae' : 'other';
      let left = null;
      for (let k = 1; ; k++) {
        const start = addMonths(hired, 12 * (k - 1));
        if (start > MIRROR_TO) break;
        if (rand() < LEAVE[nat]) { const d = addMonths(start, Math.floor(rand() * 12)); if (d > hired && d <= MIRROR_TO) left = d; break; }
      }
      let authorised = null;
      if (r.regulated && auth) {
        const d = addMonths(hired, auth[0] + Math.floor(rand() * (auth[1] - auth[0] + 1)));
        if (d <= MIRROR_TO && (!left || left > d) && rand() < 0.88) authorised = d;
      }
      out.push({ id: `epm-${r.role_id}-${String(i).padStart(3, '0')}`, role_id: r.role_id, nationality_flag: nat, hired_on: hired, left_on: left, authorised_on: authorised,
        source: 'SIMULATED HR mirror', simulated: true, open_read: false });
    }
  }
  return out;
}

const src = (label, url) => ({ label, url, as_of: AS_OF });
export const WALLET_TARGET = {
  id: WALLET_TARGET_ID, metric: WALLET_METRIC, pct: 60, due_on: '2027-12-31',
  note_en: 'Demo parameter set by leadership: share of staff holding the complete core-five Future Skills Wallet by the end of 2027. A leadership decision shown beside the measured counter, not a claim.',
  note_ar: 'معامل للعرض التوضيحي حددته القيادة: نسبة الموظفين الذين يحملون محفظة مهارات المستقبل الكاملة بمهاراتها الخمس الأساسية بنهاية 2027. قرار قيادي يُعرض بجانب العدّاد المقيس، وليس ادعاءً.',
  set_by: BY, set_by_role: 'hr_director', set_at: '2026-10-05T09:00:00Z', status: 'active', version: 1, history: [],
  benchmark_ids: ['JAHIZ', 'UAE-AI', 'UAE-PEERS'],
  sources: [
    src("WAM · Jahiz, UAE's digital platform for upskilling all federal government talents with future skills", 'https://wam.ae/en/details/1395303102696'),
    src('Khaleej Times · Abu Dhabi to train government employees in AI by 2027', 'https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027'),
  ],
};
const LINKS = [
  ['nt-jahiz', 'The core-five Future Skills Wallet is the whole-workforce future-skills goal, a dated leadership target in the spirit of Jahiz.',
    'محفظة مهارات المستقبل بمهاراتها الخمس الأساسية هي هدف مهارات المستقبل لجميع القوى العاملة، وهدف قيادي مؤرخ بروح منصة جاهز.'],
  ['nt-ai-2031', 'AI fluency at Practitioner level is one of the five wallet items, so the wallet target serves the AI strategy.',
    'الطلاقة في الذكاء الاصطناعي بمستوى ممارِس هي أحد عناصر المحفظة الخمسة، لذا يخدم هدف المحفظة استراتيجية الذكاء الاصطناعي.'],
];

export default function build() {}

export function finalize(T) {
  const today = new Date().toISOString().slice(0, 10);
  // FS73 mirror
  T.pipeline_mirror = buildMirror(T);
  const roles = pipelineRoles({ job_roles: T.job_roles, role_outlook_labels: T.role_outlook_labels ?? [], succession_slates: T.succession_slates ?? [] });
  if (roles.some((r) => T.job_roles.find((j) => j.id === r.role_id)?.lifecycle !== 'current')) throw new Error('fs73: a concept role entered the pipeline');
  const ep = emiratiPipeline(pipelineWorldFrom((t) => T[t] ?? []), 'all', today);
  const cells = [ep.total, ...ep.areas].flatMap((a) => [a.successors.emirati, a.successors.all, ...Object.values(a.successors.bands), ...a.ready_by.map((x) => x.n), a.progression.emirati, a.progression.all,
    ...a.progression.by_year.map((x) => x.n), ...a.retention.flatMap((x) => [x.cohort, x.retained])]);
  if (cells.some((v) => v != null && v < EP_MIN)) throw new Error('fs73: an unsuppressed cell under 10');
  // FS74 target + FS62 links
  T.wallet_targets = [WALLET_TARGET];
  const p = targetProblem({ pct: WALLET_TARGET.pct, due_on: WALLET_TARGET.due_on, note_en: WALLET_TARGET.note_en, note_ar: WALLET_TARGET.note_ar }, '2026-10-05');
  if (p) throw new Error(`fs74: wallet target ${p}`);
  const W = worldFrom((t) => T[t] ?? []);
  for (const [tagId, en, ar] of LINKS) {
    const l = { id: `tl:${tagId}:wallet_targets:${WALLET_TARGET_ID}`, tag_id: tagId, target_table: 'wallet_targets', target_id: WALLET_TARGET_ID, note_en: en, note_ar: ar, active: true,
      created_by: BY, created_at: SEEDED_AT, updated_by: BY, updated_at: SEEDED_AT };
    const v = targetView(W, l.target_table, l.target_id);
    const lp = linkProblem(l, W.tags.find((t) => t.id === tagId), { exists: v.exists, area: v.area });
    if (lp || !typedTotalFree([en, ar])) throw new Error(`fs74: link ${l.id} ${lp ?? 'typed_total'}`);
    if (!T.tag_links.some((x) => x.id === l.id)) T.tag_links.push(l);
  }
  // FS74 -> M04: the first open item of two demo people already in their open plan
  const ww = walletWorld((t) => T[t] ?? []);
  const added = [];
  for (const pid of ['p-k-ro', 'p-nse']) {
    const plan = planFor(T.dev_plans ?? [], pid);
    if (!plan) continue;
    const st = walletStatus(pid, ww.inputsFor(pid), today);
    const { add } = planEntries(st, pid, plan.id, (T.plan_activities ?? []).filter((a) => a.person_id === pid), WALLET_TARGET.due_on);
    if (add[0]) { T.plan_activities.push({ ...add[0], status: 'in_progress' }); added.push(add[0].id); }
  }
  const c = walletCounter(ww, today);
  console.log(`fs73: ${T.pipeline_mirror.length} SIMULATED mirror spells over ${roles.length} critical and future roles (${ep.areas.length} competency areas), Emirati successors ${ep.total.successors.emirati ?? '<10'}; fs74: wallet target ${WALLET_TARGET.pct}% by ${WALLET_TARGET.due_on}, complete wallets ${c.complete ?? '<10'} of ${c.staff}, ${LINKS.length} tag links, plan activities ${added.join(', ') || 'none'}`);
}
