// M35 page helpers for FS wave G · E1 (FS60 disclosure pack, FS61 skills pilots). Data hooks, value formatting, pills, the narrative editor,
// the pilot editor and the evaluator's sign-off form. Pages only; the rules live in disclosure.ts and pilots.ts.
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { BarChart, ConfirmDialog, Icon, Modal, SelectField, StatusPill, TextArea, TextField, downloadText, toCsv, type Column, type PillTone } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { NARRATIVE, VARIANCE, buildPack, lineProblem, packRows, type MetricValue, type Narrative } from './disclosure';
import { ADOPTIONS, FAILED_ALLOWED, METRIC_UNITS, RESULTS, groupShown, pilotProblem, signoffProblem, type Adoption, type PilotInput, type PilotMetric, type SignoffInput } from './pilots';
import type { Row } from './ui';

// ───────────── data
export interface HcData { metrics: Row[]; disclosures: Row[] }
export function useHc() {
  const repo = useRepo();
  return useQuery(['hc_metrics', 'hc_disclosures'], async (): Promise<HcData> => {
    const [metrics, disclosures] = await Promise.all([
      repo.list('hc_metrics', { order: [['sort', 'asc']] } as never) as Promise<Row[]>,
      repo.list('hc_disclosures', { order: [['period', 'desc']] } as never) as Promise<Row[]>,
    ]);
    return { metrics, disclosures };
  });
}
/** Staff role cards by id (names for owners, preparers, approvers and evaluators; failed reads give an empty map). */
export function usePeople() {
  const repo = useRepo();
  return useQuery('people', async () => {
    const rows = await (repo.list('people', { filter: { kind: 'staff' } } as never) as Promise<Row[]>).catch(() => [] as Row[]);
    return new Map(rows.map((p) => [p.id as string, p]));
  });
}
export function usePersonName(people: Map<string, Row> | undefined) {
  const pick = usePick();
  const t = useT();
  return (id: string | null | undefined) => {
    if (!id) return '—';
    const p = people?.get(id);
    return p ? pick({ name_en: p.display_name, name_ar: p.display_name_ar || p.display_name }, 'name') : t('m35.hc.roleCard');
  };
}

// ───────────── values
export function useValueText() {
  const f = useFormat();
  const t = useT();
  return (unit: string, v: number | null | undefined, signed = false) => {
    if (v == null) return t('common.suppressedShort');
    const sign = signed && v > 0 ? '+' : '';
    const digits = unit === 'credits' ? 2 : 1;
    const n = f.num(v, { maximumFractionDigits: digits, minimumFractionDigits: unit === 'credits' ? 2 : 0 });
    return unit === 'pct' ? `${sign}${n}%` : unit === 'pp' ? `${sign}${n} ${t('m35.hc.unitShort.pp')}` : `${sign}${n} ${t(`m35.hc.unitShort.${unit}`)}`;
  };
}
/** Variance chip: arrow and colour follow whether a rise is good for the metric. */
export function VarianceChip({ m, better }: { m: MetricValue; better: string }) {
  const t = useT();
  const vt = useValueText();
  if (m.variance == null || m.prev_period == null) return <span className="text-[12px] text-ink-3" data-testid="m35-hc-variance" data-variance="">{t('m35.hc.noPrev')}</span>;
  const good = m.variance === 0 ? null : (m.variance > 0) === (better !== 'down');
  const tone: PillTone = good == null ? 'neutral' : good ? 'ok' : 'bad';
  const arrow = m.variance === 0 ? '→' : m.variance > 0 ? '▲' : '▼';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[12px]" data-testid="m35-hc-variance" data-variance={m.variance}>
      <StatusPill tone={tone}><span aria-hidden="true">{arrow}</span> <bdi dir="ltr">{vt(m.unit, m.variance, true)}</bdi></StatusPill>
      <span className="text-ink-3">{t('m35.hc.vsPrev', { p: m.prev_period })}</span>
    </span>
  );
}
export const LINE_TONE: Record<string, PillTone> = { approved: 'ok', ready: 'info', missing: 'reserved' };
export function LineStatePill({ state }: { state: string }) {
  const t = useT();
  return <StatusPill tone={LINE_TONE[state] ?? 'neutral'}><span data-testid="m35-hc-line-state" data-state={state}>{t(`m35.hc.line.${state}`)}</span></StatusPill>;
}
export const PILOT_TONE: Record<string, PillTone> = { draft: 'neutral', running: 'info', evaluating: 'accent', closed: 'ok' };
export function PilotStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={PILOT_TONE[status] ?? 'neutral'}><span data-testid="m35-sp-status" data-status={status}>{t(`m35.sp.status.${status}`)}</span></StatusPill>;
}
export const RESULT_TONE: Record<string, PillTone> = { success: 'ok', mixed: 'reserved', failed: 'bad' };
export function ResultPill({ result }: { result: string | null | undefined }) {
  const t = useT();
  if (!result) return <span className="text-[12px] text-ink-3">{t('m35.sp.noResult')}</span>;
  return <StatusPill tone={RESULT_TONE[result] ?? 'neutral'}><span data-testid="m35-sp-result" data-result={result}>{t(`m35.sp.result.${result}`)}</span></StatusPill>;
}
export const ADOPTION_TONE: Record<string, PillTone> = { adopted: 'ok', expanded: 'ok', further_funded: 'info', not_adopted: 'neutral' };
export function AdoptionPill({ adoption }: { adoption: string | null | undefined }) {
  const t = useT();
  if (!adoption) return <span className="text-[12px] text-ink-3">{t('m35.sp.adoptionPending')}</span>;
  return <StatusPill tone={ADOPTION_TONE[adoption] ?? 'neutral'}><span data-testid="m35-sp-adoption" data-adoption={adoption}>{t(`m35.sp.adoption.${adoption}`)}</span></StatusPill>;
}
/** A group size (people): shown from 10, else "suppressed". */
export function GroupN({ n }: { n: number | null | undefined }) {
  const t = useT();
  const f = useFormat();
  if (n == null) return <span className="text-ink-3">—</span>;
  const s = groupShown(n);
  return s == null ? <span className="text-ink-3" data-suppressed="true">{t('common.suppressedShort')}</span> : <span className="num">{f.num(s)}</span>;
}
export function MetricUnit({ m, v }: { m: PilotMetric; v: number | null | undefined }) {
  const f = useFormat();
  const t = useT();
  if (v == null) return <span className="text-ink-3">—</span>;
  return <span className="num">{f.num(v, { maximumFractionDigits: 1 })}{m.unit === 'pct' ? '%' : m.unit === 'count' ? '' : ` ${t(`m35.sp.unitShort.${m.unit}`)}`}</span>;
}

// ───────────── FS60 narrative editor (HR analyst / HR director; saveDisclosure with one line)
export function NarrativeEditor({ period, metric, current, onClose }: { period: string; metric: Row; current?: Narrative | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [ne, setNe] = useState(current?.narrative_en ?? '');
  const [na, setNa] = useState(current?.narrative_ar ?? '');
  const [ve, setVe] = useState(current?.variance_en ?? '');
  const [va, setVa] = useState(current?.variance_ar ?? '');
  const line = { metric_id: metric.id as string, narrative_en: ne, narrative_ar: na, variance_en: ve, variance_ar: va };
  const problem = lineProblem(line, [metric.id]);
  return (
    <ConfirmDialog open onClose={onClose} title={t('m35.hc.editTitle', { name: pick(metric, 'name') })} consequence={t('m35.hc.editConsequence')} actingAs={t('m35.hc.actingPreparer')}
      confirmLabel={t('m35.hc.saveLine')}
      onConfirm={async () => {
        if (problem) return;
        const r = await run(() => repo.rpc.saveDisclosure({ period, lines: [line] }));
        if (r.ok) onClose();
      }}>
      <div className="space-y-3" data-testid="m35-hc-editor">
        <TextArea name="m35-hc-ne" label={t('m35.hc.narrativeEn')} value={ne} onChange={setNe} rows={3} hint={t('m35.hc.lenHint', { lo: NARRATIVE[0], hi: NARRATIVE[1] })} />
        <div dir="rtl" lang="ar"><TextArea name="m35-hc-na" label={t('m35.hc.narrativeAr')} value={na} onChange={setNa} rows={3} /></div>
        <TextArea name="m35-hc-ve" label={t('m35.hc.varianceEn')} value={ve} onChange={setVe} rows={2} hint={t('m35.hc.lenHint', { lo: VARIANCE[0], hi: VARIANCE[1] })} />
        <div dir="rtl" lang="ar"><TextArea name="m35-hc-va" label={t('m35.hc.varianceAr')} value={va} onChange={setVa} rows={2} /></div>
        {problem && <p className="text-[12.5px] text-ink-3" data-testid="m35-hc-editor-problem" data-problem={problem}>{t(`m35.hc.problem.${problem}`)}</p>}
      </div>
    </ConfirmDialog>
  );
}

// ───────────── FS61 pilot editor (workforce_strategy W/A)
const blankMetric = (): PilotMetric => ({ key: '', label_en: '', label_ar: '', unit: 'pct', baseline: 0, target: 0 });
export function PilotEditor({ row, staff, skills, me, onClose }: { row?: Row | null; staff: Row[]; skills: Row[]; me: string; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [x, setX] = useState<PilotInput>(() => row ? {
    id: row.id, title_en: row.title_en, title_ar: row.title_ar, hypothesis_en: row.hypothesis_en, hypothesis_ar: row.hypothesis_ar, comparison_en: row.comparison_en, comparison_ar: row.comparison_ar,
    pilot_n: row.pilot_n ?? null, comparison_n: row.comparison_n ?? null, owner_person_id: row.owner_person_id, evaluator_person_id: row.evaluator_person_id,
    metrics: ((row.metrics ?? []) as PilotMetric[]).map(({ key, label_en, label_ar, unit, baseline, target }) => ({ key, label_en, label_ar, unit, baseline: Number(baseline), target: Number(target) })),
    skill_ids: [...(row.skill_ids ?? [])], start_on: String(row.start_on).slice(0, 10), end_on: String(row.end_on).slice(0, 10), status: row.status === 'running' ? 'running' : 'draft',
  } : { id: 'sp-', title_en: '', title_ar: '', hypothesis_en: '', hypothesis_ar: '', comparison_en: '', comparison_ar: '', pilot_n: null, comparison_n: null, owner_person_id: '', evaluator_person_id: '',
    metrics: [blankMetric()], skill_ids: [], start_on: '2026-11-01', end_on: '2027-04-30', status: 'draft' });
  const set = (patch: Partial<PilotInput>) => setX((o) => ({ ...o, ...patch }));
  const setM = (i: number, patch: Partial<PilotMetric>) => set({ metrics: x.metrics.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const ctx = useMemo(() => ({ staff: staff.map((p) => p.id as string), skills: skills.map((s) => s.id as string), creator: (row?.created_by as string) ?? me }), [staff, skills, row, me]);
  const problem = pilotProblem(x, ctx, !row) ?? (row?.status === 'running' && x.status === 'draft' ? 'status' : null);
  const people = staff.map((p) => ({ value: p.id as string, label: pick({ name_en: p.display_name, name_ar: p.display_name_ar || p.display_name }, 'name') })).sort((a, b) => a.label.localeCompare(b.label));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const [open, setOpen] = useState(false);
  return (
    <Modal open onClose={onClose} title={row ? t('m35.spe.editTitle') : t('m35.spe.newTitle')} size="lg"
      footer={<div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setOpen(true)} data-testid="m35-spe-save">{t('m35.spe.save')}</button>
      </div>}>
      <div className="space-y-3" data-testid="m35-spe">
        {!row && <TextField name="m35-spe-id" label={t('m35.spe.id')} value={x.id ?? ''} onChange={(v) => set({ id: v })} hint={t('m35.spe.idHint')} />}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField name="m35-spe-te" label={t('m35.spe.titleEn')} value={x.title_en} onChange={(v) => set({ title_en: v })} />
          <div dir="rtl" lang="ar"><TextField name="m35-spe-ta" label={t('m35.spe.titleAr')} value={x.title_ar} onChange={(v) => set({ title_ar: v })} /></div>
          <TextArea name="m35-spe-he" label={t('m35.spe.hypothesisEn')} value={x.hypothesis_en} onChange={(v) => set({ hypothesis_en: v })} rows={3} />
          <div dir="rtl" lang="ar"><TextArea name="m35-spe-ha" label={t('m35.spe.hypothesisAr')} value={x.hypothesis_ar} onChange={(v) => set({ hypothesis_ar: v })} rows={3} /></div>
          <TextArea name="m35-spe-ce" label={t('m35.spe.comparisonEn')} value={x.comparison_en} onChange={(v) => set({ comparison_en: v })} rows={2} />
          <div dir="rtl" lang="ar"><TextArea name="m35-spe-ca" label={t('m35.spe.comparisonAr')} value={x.comparison_ar} onChange={(v) => set({ comparison_ar: v })} rows={2} /></div>
          <SelectField name="m35-spe-owner" label={t('m35.spe.owner')} value={x.owner_person_id} onChange={(v) => set({ owner_person_id: v })} options={people} placeholder={t('m35.spe.choose')} />
          <SelectField name="m35-spe-eval" label={t('m35.spe.evaluator')} value={x.evaluator_person_id} onChange={(v) => set({ evaluator_person_id: v })} options={people} placeholder={t('m35.spe.choose')} hint={t('m35.spe.evaluatorHint')} />
          <TextField name="m35-spe-pn" type="number" label={t('m35.spe.pilotN')} value={x.pilot_n == null ? '' : String(x.pilot_n)} onChange={(v) => set({ pilot_n: num(v) })} />
          <TextField name="m35-spe-cn" type="number" label={t('m35.spe.comparisonN')} value={x.comparison_n == null ? '' : String(x.comparison_n)} onChange={(v) => set({ comparison_n: num(v) })} />
          <TextField name="m35-spe-start" type="date" label={t('m35.spe.start')} value={x.start_on} onChange={(v) => set({ start_on: v })} />
          <TextField name="m35-spe-end" type="date" label={t('m35.spe.end')} value={x.end_on} onChange={(v) => set({ end_on: v })} />
          <SelectField name="m35-spe-skill" label={t('m35.spe.skill')} value="" onChange={(v) => v && !x.skill_ids.includes(v) && set({ skill_ids: [...x.skill_ids, v] })}
            options={skills.filter((s) => s.lifecycle !== 'obsolete' && s.area !== 'security').map((s) => ({ value: s.id as string, label: pick(s, 'name') }))} placeholder={t('m35.spe.addSkill')} />
          <SelectField name="m35-spe-status" label={t('m35.spe.status')} value={x.status} onChange={(v) => set({ status: v as 'draft' | 'running' })}
            options={(['draft', 'running'] as const).map((s) => ({ value: s, label: t(`m35.sp.status.${s}`) }))} />
        </div>
        {x.skill_ids.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {x.skill_ids.map((s) => <li key={s}><button type="button" className="btn-outline btn-sm" onClick={() => set({ skill_ids: x.skill_ids.filter((k) => k !== s) })} aria-label={t('m35.spe.removeSkill')}>{pick(skills.find((k) => k.id === s) ?? { name_en: s, name_ar: s }, 'name')} ×</button></li>)}
          </ul>
        )}
        <fieldset className="space-y-2">
          <legend className="caps">{t('m35.spe.metrics')}</legend>
          {x.metrics.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-card border border-line p-2 md:grid-cols-6" data-testid="m35-spe-metric">
              <TextField name={`m35-spe-mk-${i}`} label={t('m35.spe.mKey')} value={m.key} onChange={(v) => setM(i, { key: v })} />
              <TextField name={`m35-spe-mle-${i}`} label={t('m35.spe.mLabelEn')} value={m.label_en} onChange={(v) => setM(i, { label_en: v })} />
              <div dir="rtl" lang="ar"><TextField name={`m35-spe-mla-${i}`} label={t('m35.spe.mLabelAr')} value={m.label_ar} onChange={(v) => setM(i, { label_ar: v })} /></div>
              <SelectField name={`m35-spe-mu-${i}`} label={t('m35.spe.mUnit')} value={m.unit} onChange={(v) => setM(i, { unit: v })} options={METRIC_UNITS.map((u) => ({ value: u, label: t(`m35.sp.unit.${u}`) }))} />
              <TextField name={`m35-spe-mb-${i}`} type="number" label={t('m35.spe.mBaseline')} value={String(m.baseline)} onChange={(v) => setM(i, { baseline: Number(v) })} />
              <TextField name={`m35-spe-mt-${i}`} type="number" label={t('m35.spe.mTarget')} value={String(m.target)} onChange={(v) => setM(i, { target: Number(v) })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {x.metrics.length < 5 && <button type="button" className="btn-outline btn-sm" onClick={() => set({ metrics: [...x.metrics, blankMetric()] })}>{t('m35.spe.addMetric')}</button>}
            {x.metrics.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => set({ metrics: x.metrics.slice(0, -1) })}>{t('m35.spe.removeMetric')}</button>}
          </div>
        </fieldset>
        {problem && <p className="text-[12.5px] text-ink-3" data-testid="m35-spe-problem" data-problem={problem}>{t(`m35.spe.problem.${problem}`)}</p>}
      </div>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={row ? t('m35.spe.editTitle') : t('m35.spe.newTitle')} consequence={t('m35.spe.consequence')} actingAs={t('m35.hc.actingPreparer')}
        confirmLabel={t('m35.spe.save')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.savePilot(x));
          setOpen(false);
          if (r.ok) onClose();
        }} />
    </Modal>
  );
}

// ───────────── FS61 the evaluator's sign-off (the named evaluator only; status running)
export function SignoffForm({ pilot, onDone }: { pilot: Row; onDone?: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const metrics = (pilot.metrics ?? []) as PilotMetric[];
  const [x, setX] = useState<SignoffInput>({ result: 'success', recommendation: 'adopted', result_en: '', result_ar: '', lessons_en: '', lessons_ar: '',
    metric_results: metrics.map((m) => ({ key: m.key, pilot: Number(m.baseline), comparison: null })) });
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<SignoffInput>) => setX((o) => ({ ...o, ...patch }));
  const problem = signoffProblem(x, metrics.map((m) => m.key));
  const recs = x.result === 'failed' ? FAILED_ALLOWED : ADOPTIONS;
  return (
    <div className="space-y-3 rounded-card border border-line p-3" data-testid="m35-sso" data-pilot={pilot.id}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField name={`m35-sso-r-${pilot.id}`} label={t('m35.sso.result')} value={x.result} onChange={(v) => set({ result: v as SignoffInput['result'], recommendation: v === 'failed' ? 'not_adopted' : x.recommendation })}
          options={RESULTS.map((r) => ({ value: r, label: t(`m35.sp.result.${r}`) }))} />
        <SelectField name={`m35-sso-a-${pilot.id}`} label={t('m35.sso.recommendation')} value={x.recommendation} onChange={(v) => set({ recommendation: v as Adoption })}
          options={recs.map((r) => ({ value: r, label: t(`m35.sp.adoption.${r}`) }))} />
        <TextArea name={`m35-sso-se-${pilot.id}`} label={t('m35.sso.summaryEn')} value={x.result_en} onChange={(v) => set({ result_en: v })} rows={3} />
        <div dir="rtl" lang="ar"><TextArea name={`m35-sso-sa-${pilot.id}`} label={t('m35.sso.summaryAr')} value={x.result_ar} onChange={(v) => set({ result_ar: v })} rows={3} /></div>
        <TextArea name={`m35-sso-le-${pilot.id}`} label={t('m35.sso.lessonsEn')} value={x.lessons_en} onChange={(v) => set({ lessons_en: v })} rows={2} />
        <div dir="rtl" lang="ar"><TextArea name={`m35-sso-la-${pilot.id}`} label={t('m35.sso.lessonsAr')} value={x.lessons_ar} onChange={(v) => set({ lessons_ar: v })} rows={2} /></div>
      </div>
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div key={m.key} className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <p className="col-span-2 self-center text-[13px] font-medium md:col-span-1">{pick(m as unknown as Row, 'label')}</p>
            <TextField name={`m35-sso-p-${pilot.id}-${i}`} type="number" label={t('m35.sso.pilotValue')} value={String(x.metric_results[i]?.pilot ?? '')}
              onChange={(v) => set({ metric_results: x.metric_results.map((r, k) => (k === i ? { ...r, pilot: Number(v) } : r)) })} />
            <TextField name={`m35-sso-c-${pilot.id}-${i}`} type="number" label={t('m35.sso.comparisonValue')} value={x.metric_results[i]?.comparison == null ? '' : String(x.metric_results[i].comparison)}
              onChange={(v) => set({ metric_results: x.metric_results.map((r, k) => (k === i ? { ...r, comparison: v.trim() === '' ? null : Number(v) } : r)) })} />
          </div>
        ))}
      </div>
      {problem && <p className="text-[12.5px] text-ink-3" data-testid="m35-sso-problem" data-problem={problem}>{t(`m35.sso.problem.${problem}`)}</p>}
      <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setOpen(true)} data-testid="m35-sso-submit">{t('m35.sso.submit')}</button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t('m35.sso.title', { name: pick(pilot, 'title') })} consequence={t('m35.sso.consequence')} actingAs={t('m35.sso.actingEvaluator')}
        confirmLabel={t('m35.sso.submit')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.signoffPilot(pilot.id, x));
          setOpen(false);
          if (r.ok) onDone?.();
        }} />
    </div>
  );
}

/** A labelled block of bilingual text (shows the current language). */
export function Para({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h3 className="caps mb-1">{label}</h3>
      <p className="text-[13.5px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}

/** Participation equity by site, shift and grade: shares trained this year; groups under 10 suppressed (no nationality, no gender). */
export function EquityCells({ v }: { v: MetricValue }) {
  const t = useT();
  const f = useFormat();
  const label = (dim: string, key: string) => (key === 'none' || key === 'day' ? t(`m35.hc.dimNone.${dim}`) : dim === 'grade' ? t(`m35.hc.grade.${key}`) : dim === 'shift' ? t('m35.hc.crew', { c: key }) : key);
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m35-hc-equity">
      {(['site', 'shift', 'grade'] as const).map((dim) => {
        const cs = v.cells.filter((c) => c.dim === dim);
        return (
          <div key={dim} className="rounded-card border border-line p-3">
            <h4 className="caps mb-2">{t(`m35.hc.dim.${dim}`)}</h4>
            <BarChart title={t(`m35.hc.dim.${dim}`)} unit="%" max={100} data={cs.map((c) => ({ label: label(dim, c.key), value: c.pct, suppressed: c.pct == null }))} />
            <ul className="mt-2 space-y-0.5 text-[11.5px] text-ink-3">
              {cs.map((c) => <li key={c.key} data-testid="m35-hc-cell" data-n={c.n ?? ''}>{label(dim, c.key)}: {c.n == null ? t('m35.hc.cellSuppressed') : t('m35.hc.cellNot', { n: c.not_trained == null ? t('common.suppressedShort') : f.num(c.not_trained), of: f.num(c.n) })}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** CSV, JSON and the print view of the selected quarter (SIMULATED; unapproved lines carry no value). */
export function ExportButtons({ row, metrics }: { row: Row; metrics: Row[] }) {
  const t = useT();
  const pack = useMemo(() => buildPack(row, metrics), [row, metrics]);
  const rows = packRows(pack);
  const cols: Column<Record<string, string | number | null>>[] = Object.keys(rows[0] ?? { period: '' }).map((k) => ({ key: k, header: k, value: (r) => r[k] ?? '' }));
  return (
    <>
      <button type="button" className="btn-outline btn-sm" data-testid="m35-hc-csv" onClick={() => downloadText(`kafaa-iso30414-skills-${pack.period}-SIMULATED.csv`, toCsv(rows, cols))}><Icon name="download" size={14} /> {t('m35.hc.csv')}</button>
      <button type="button" className="btn-outline btn-sm" data-testid="m35-hc-json" onClick={() => downloadText(`kafaa-iso30414-skills-${pack.period}-SIMULATED.json`, JSON.stringify(pack, null, 2), 'application/json')}><Icon name="download" size={14} /> {t('m35.hc.json')}</button>
      <L to={`/workforce/disclosure/${row.period}/pack`} className="btn-primary btn-sm no-underline" data-testid="m35-hc-print-link">{t('m35.hc.printView')}</L>
    </>
  );
}
