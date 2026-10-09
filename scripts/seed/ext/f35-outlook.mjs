// F35 (wave 5 · w5e4) seed: saved skills supply-and-demand outlooks (SIMULATED) for the M07 outlook page.
// Built in finalize after F01 has derived skill states (FINALIZE_LAST), with the same pure rules the RPCs use
// (src/modules/m07/outlook.ts: inputFromTables + outlookFor), so every stored result equals what kafaa_compute_outlook returns
// for the stored parameters on the seeded data (checked by scripts/validate/w5e4-outlook.mjs).
// Five outlooks: the released baseline (HR director), two HR analyst drafts (two more units from 2032; a reskilling push),
// an HR director draft (faster ADVANCE adoption) and a withdrawn stress test. Release summaries are qualitative: no headcount
// or site wording (M11 publicTextIsClean). Results are aggregate only; families under 10 measured people are suppressed.
import { BASELINE, inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { publicTextIsClean } from '../../../src/domain/future.ts';

export const FINALIZE_LAST = true;

const OUTLOOKS = [
  {
    id: 'so-baseline-2035', name: 'Baseline skills outlook to 2035 (SIMULATED)', by: 'p-chco', status: 'released',
    params: { ...BASELINE }, created: '2026-09-22T07:30:00Z', released: '2026-10-01T09:00:00Z',
    summary_en: 'Baseline assumptions: current fleet, KHNP support stepping down to the OSSA end in 2030, the seeded training pipeline and today\'s skill states. Operations, safety and quality open a shortfall as known retirements and the handover land; reskilling and the DNT intake narrow it but do not close it. SIMULATED: a planning aid, not a forecast.',
    summary_ar: 'افتراضات الأساس: الأسطول الحالي، وتراجع دعم كيبكو حتى نهاية اتفاقية الدعم في 2030، ومسار التدريب الحالي، وحالات المهارات اليوم. تظهر فجوة في العمليات والسلامة والجودة مع حالات التقاعد المعروفة ومرحلة التسليم؛ ويقلّصها إعادة التأهيل ودفعات الدبلوم دون أن يسدّاها. محاكاة: أداة تخطيط وليست توقعاً.',
  },
  {
    id: 'so-two-units-2032', name: 'Two more APR-1400 units from 2032 (SIMULATED)', by: 'p-k-hr-analyst', status: 'draft',
    params: { ...BASELINE, scenario_id: 'scn-1' }, created: '2026-09-29T10:15:00Z',
  },
  {
    id: 'so-reskill-push', name: 'Reskilling push in digital and maintenance (SIMULATED)', by: 'p-k-hr-analyst', status: 'draft',
    params: { ...BASELINE, reskill_overrides: { digital: 30, maintenance: 25 }, pipeline_factor: 1.2 }, created: '2026-10-03T08:00:00Z',
  },
  {
    id: 'so-advance-fast', name: 'Faster ADVANCE adoption from 2028 (SIMULATED)', by: 'p-chco', status: 'draft',
    params: { ...BASELINE, adv_factor: 1.4, adv_start: 2028, horizon: 2036 }, created: '2026-10-05T12:40:00Z',
  },
  {
    id: 'so-attrition-stress', name: 'Attrition stress test (SIMULATED)', by: 'p-chco', status: 'withdrawn',
    params: { ...BASELINE, attrition_pct: 7, klra_weight: 1.3, ossa_end: 2029 }, created: '2026-09-15T06:50:00Z', released: '2026-09-18T07:00:00Z',
    summary_en: 'Stress test: higher general attrition, a heavier share of known departures and KHNP support ending a year early. Every family in scope falls short before the horizon. SIMULATED.',
    summary_ar: 'اختبار ضغط: معدل دوران أعلى، وحصة أكبر من حالات المغادرة المعروفة، وانتهاء دعم كيبكو قبل عام من موعده. كل الفئات ضمن النطاق تقع في عجز قبل نهاية الأفق. محاكاة.',
    withdrawn_reason: 'Superseded by the baseline outlook released on 1 October 2026',
  },
];

export default function build() {}

export function finalize(T) {
  T.skill_outlooks = T.skill_outlooks ?? [];
  const inp = inputFromTables((t) => T[t] ?? []);
  for (const o of OUTLOOKS) {
    const r = outlookFor(inp, o.params);
    if (r.code !== 'ok') throw new Error(`f35 seed: ${o.id} ${r.code}`);
    if (o.summary_en && !publicTextIsClean([o.name, o.summary_en, o.summary_ar])) throw new Error(`f35 seed: ${o.id} release text is not clean`);
    const ts = o.released ?? o.created;
    T.skill_outlooks.push({
      id: o.id, name: o.name, params: r.result.params, results: r.result, status: o.status,
      summary_en: o.summary_en ?? '', summary_ar: o.summary_ar ?? '', created_by: o.by, created_at: o.created, updated_at: ts, computed_at: ts,
      released_by: o.released ? 'p-chco' : null, released_at: o.released ?? null, withdrawn_reason: o.withdrawn_reason ?? null, simulated: true,
    });
  }
}
