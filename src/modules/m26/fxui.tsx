// FS06 page pieces (task layer with AI exposure and change horizon): the data hook over kafaa_task_future and the reference rows,
// exposure / horizon / driver chips, the OECD needs-versus-AI bars, the benchmark ties, the future editor (setTaskFuture) and
// the change-log diff. Pages never import backend/*.
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { SCHEMA } from '../../data/schema';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { BenchmarkChip, Drawer, Modal, SourceLink, StatusPill, WhyThis, SelectField, TextArea, type PillTone } from '../../ui';
import { DRIVERS, HORIZONS, MAX_DIMS, MAX_SKILLS, TASK_DIMS, aiLevel, exposureOf, type CapLevel, type Dim, type Driver, type Horizon, type Needs } from './future';
import type { FutureTask } from './backend/rpc';

// ───────────── data
export function useFutureData(roleId: string | null = null) {
  const repo = useRepo();
  return useQuery(['jta_tasks', 'jta_task_skills', 'sat_analysts', 'sat_changes', 'ai_capability_levels', 'ai_exposure_refs', 'skills', 'job_roles'], async () => {
    const [view, levels, refs, skills, roles] = await Promise.all([
      repo.rpc.taskFuture(roleId), repo.list('ai_capability_levels', { order: [['sort', 'asc']] }), repo.list('ai_exposure_refs', { order: [['sort', 'asc']] }),
      repo.list('skills', { order: [['sort', 'asc']] }).catch(() => [] as RowOf<'skills'>[]), repo.list('job_roles', { order: [['sort', 'asc']] }).catch(() => [] as RowOf<'job_roles'>[]),
    ]);
    return { view, levels: levels as unknown as CapLevel[] & RowOf<'ai_capability_levels'>[], refs, skills, roles };
  }, [roleId]);
}
export type FutureData = NonNullable<ReturnType<typeof useFutureData>['data']>;

// ───────────── chips
const EXPOSURE_TONE: Record<string, PillTone> = { augment: 'accent', automate_partly: 'sim', human_core: 'ok' };
export function ExposurePill({ exposure }: { exposure: string | null | undefined }) {
  const t = useT();
  if (!exposure) return <StatusPill tone="neutral" status="unrated">{t('m26.fx.unrated')}</StatusPill>;
  return <StatusPill tone={EXPOSURE_TONE[exposure] ?? 'neutral'} status={exposure}>{t(`m26.fx.exposure.${exposure}`)}</StatusPill>;
}
export function HorizonChip({ horizon }: { horizon: string | null | undefined }) {
  const t = useT();
  if (!horizon) return null;
  return <span className="chip border-line bg-sunken text-ink-2" data-testid="m26-fx-horizon">{t(`m26.fx.horizon.${horizon}`)}</span>;
}
export function DriverChip({ driver }: { driver: string | null | undefined }) {
  const t = useT();
  if (!driver) return null;
  return <span className="chip border-info-line bg-info-bg text-info">{t(`m26.fx.driver.${driver}`)}</span>;
}
/** The compact "Future" cell used in tables: exposure, horizon, driver and the rule's reasons. */
export function FutureCell({ task }: { task: Pick<FutureTask, 'exposure' | 'change_horizon' | 'tech_driver' | 'reasons'> | null | undefined }) {
  if (!task || !task.exposure) return <ExposurePill exposure={null} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="m26-fx-cell">
      <ExposurePill exposure={task.exposure} />
      <HorizonChip horizon={task.change_horizon} />
      <DriverChip driver={task.tech_driver} />
      <WhyThis reasons={task.reasons} testId="m26-fx-why" />
    </span>
  );
}

// ───────────── benchmark ties (FS01 shared <BenchmarkChip>s, rows from kafaa_benchmarks; each opens the registry drawer)
export function BenchTies({ ids }: { ids: string[] }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="m26-fx-bench">
      <span className="caps">{t('m26.fx.bench.label')}</span>
      {ids.map((id) => <BenchmarkChip key={id} id={id} />)}
    </span>
  );
}

/** A sourced reference figure (stored row) as a one-line comparison: "<ours> vs <label> <value>". */
export function RefFigure({ row, children }: { row: RowOf<'ai_exposure_refs'> | undefined; children?: ReactNode }) {
  const pick = usePick();
  const f = useFormat();
  if (!row) return null;
  const src = (row.sources as { url: string; as_of?: string }[])[0];
  return (
    <div className="rounded-card border border-line bg-sunken/60 p-3 text-[12.5px]" data-testid="m26-fx-ref">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="num text-[18px] font-semibold">{row.unit === '%' ? f.pct(Number(row.value), 0) : f.num(Number(row.value))}</span>
        <span className="text-ink-2">{pick(row, 'label')}</span>
      </div>
      {pick(row, 'note') && <p className="mt-1 text-ink-3">{pick(row, 'note')}</p>}
      {children}
      {src && <div className="mt-1"><SourceLink href={src.url} date={src.as_of ?? row.as_of}>{row.benchmark_id}</SourceLink></div>}
    </div>
  );
}

// ───────────── needs versus AI capability, per OECD dimension
export function NeedsBars({ needs, horizon, levels, testId = 'm26-fx-needs' }: { needs: Needs | null; horizon: string | null; levels: CapLevel[]; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  if (!needs || !horizon) return null;
  const dims = TASK_DIMS.filter((d) => needs[d] !== undefined);
  return (
    <ul className="space-y-2.5" data-testid={testId}>
      {dims.map((d) => {
        const need = needs[d] as number;
        const ai = aiLevel(levels, d, horizon);
        const covered = ai >= need;
        return (
          <li key={d}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-semibold">{t(`m26.fx.dim.${d}`)}</span>
              <span className={covered ? 'text-sim' : 'text-ok'}>{covered ? t('m26.fx.covered') : t('m26.fx.gap')}</span>
            </div>
            <div className="relative h-5 rounded bg-sunken" role="img" aria-label={t('m26.fx.barLabel', { dim: t(`m26.fx.dim.${d}`), need: f.num(need), ai: f.num(ai) })}>
              <div className="absolute inset-y-0 start-0 rounded bg-accent/30" style={{ width: `${(need / 5) * 100}%` }} />
              <div className={`absolute inset-y-0 w-0.5 ${covered ? 'bg-sim' : 'bg-ink-2'}`} style={lang === 'ar' ? { right: `calc(${(ai / 5) * 100}% - 1px)` } : { left: `calc(${(ai / 5) * 100}% - 1px)` }} />
              <div className="absolute inset-0 flex items-center justify-between px-2 text-[10.5px] text-ink-2">
                <span className="num">{t('m26.fx.needN', { n: f.num(need) })}</span>
                <span className="num">{t('m26.fx.aiN', { n: f.num(ai) })}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────── editor (setTaskFuture)
interface SkillRow { skill_id: string; level: number; kind: 'current' | 'future' }
export function FutureEditor({ open, task, data, onClose }: { open: boolean; task: FutureTask; data: FutureData; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [needs, setNeeds] = useState<Needs>(task.needs ?? {});
  const [h, setH] = useState<Horizon>((task.change_horizon ?? '2030') as Horizon);
  const [dr, setDr] = useState<Driver>((task.tech_driver ?? 'ai_assist') as Driver);
  const [skills, setSkills] = useState<SkillRow[]>(task.skills.map((s) => ({ skill_id: s.skill_id, level: s.level, kind: s.kind })));
  const [note, setNote] = useState('');
  const [add, setAdd] = useState('');
  const dims = Object.keys(needs) as Dim[];
  const preview = useMemo(() => exposureOf({ needs, change_horizon: h, critical: task.critical, restricted: false }, data.levels), [needs, h, task.critical, data.levels]);
  const skillOpts = data.skills.filter((s) => s.area !== 'security' && !skills.some((x) => x.skill_id === s.id)).map((s) => ({ value: s.id, label: pick(s, 'name') }));
  const valid = dims.length >= 1 && dims.length <= MAX_DIMS && skills.length >= 1 && skills.length <= MAX_SKILLS && note.length <= 500;
  const toggle = (d: Dim) => setNeeds((n) => { const x = { ...n }; if (x[d] !== undefined) delete x[d]; else if (Object.keys(x).length < MAX_DIMS) x[d] = 3; return x; });
  const save = async () => {
    const r = await run(() => repo.rpc.setTaskFuture({ task_id: task.id, needs, change_horizon: h, tech_driver: dr, skills, note }));
    if (r.ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('m26.fx.edit.title', { code: task.code })} footer={<>
      <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!valid} onClick={save} data-testid="m26-fx-save">{t('m26.common.save')}</button>
    </>}>
      <div className="space-y-4" data-testid="m26-fx-editor">
        <p className="text-[13px] text-ink-2">{t('m26.fx.edit.body')}</p>
        <fieldset>
          <legend className="mb-1 text-[12.5px] font-semibold">{t('m26.fx.edit.dims', { max: MAX_DIMS })}</legend>
          <div className="flex flex-wrap gap-1.5">
            {TASK_DIMS.map((d) => (
              <button key={d} type="button" aria-pressed={needs[d] !== undefined} onClick={() => toggle(d)} data-testid={`m26-fx-dim-${d}`}
                className={`btn-sm rounded-btn border ${needs[d] !== undefined ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink'}`}>{t(`m26.fx.dim.${d}`)}</button>
            ))}
          </div>
          {dims.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TASK_DIMS.filter((d) => needs[d] !== undefined).map((d) => (
                <label key={d} className="block text-[12.5px]">
                  <span className="caps">{t('m26.fx.edit.needFor', { dim: t(`m26.fx.dim.${d}`) })}</span>
                  <select className="input mt-1" value={needs[d]} onChange={(e) => setNeeds({ ...needs, [d]: Number(e.target.value) })} data-testid={`m26-fx-need-${d}`}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {t(`m26.fx.level.l${n}`)}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('m26.fx.edit.horizon')} name="horizon" value={h} onChange={(v) => setH(v as Horizon)} options={HORIZONS.map((x) => ({ value: x, label: t(`m26.fx.horizon.${x}`) }))} />
          <SelectField label={t('m26.fx.edit.driver')} name="driver" value={dr} onChange={(v) => setDr(v as Driver)} options={DRIVERS.map((x) => ({ value: x, label: t(`m26.fx.driver.${x}`) }))} />
        </div>
        <fieldset>
          <legend className="mb-1 text-[12.5px] font-semibold">{t('m26.fx.edit.skills', { max: MAX_SKILLS })}</legend>
          <ul className="space-y-1.5">
            {skills.map((s, i) => (
              <li key={s.skill_id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1">{pick(data.skills.find((x) => x.id === s.skill_id), 'name') || s.skill_id}</span>
                <select className="input w-24" aria-label={t('m26.fx.edit.level')} value={s.level} onChange={(e) => setSkills(skills.map((x, k) => (k === i ? { ...x, level: Number(e.target.value) } : x)))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{t('m26.fx.skillLevel', { n })}</option>)}
                </select>
                <select className="input w-32" aria-label={t('m26.fx.edit.kind')} value={s.kind} onChange={(e) => setSkills(skills.map((x, k) => (k === i ? { ...x, kind: e.target.value as 'current' | 'future' } : x)))}>
                  <option value="current">{t('m26.fx.kind.current')}</option>
                  <option value="future">{t('m26.fx.kind.future')}</option>
                </select>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setSkills(skills.filter((_, k) => k !== i))} aria-label={t('m26.fx.edit.remove')}>{t('m26.fx.edit.remove')}</button>
              </li>
            ))}
          </ul>
          {skills.length < MAX_SKILLS && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1"><SelectField label={t('m26.fx.edit.addSkill')} name="add_skill" value={add} onChange={setAdd} options={skillOpts} placeholder={t('m26.fx.edit.pickSkill')} /></div>
              <button type="button" className="btn-outline btn-sm" disabled={!add} onClick={() => { setSkills([...skills, { skill_id: add, level: 2, kind: 'current' }]); setAdd(''); }} data-testid="m26-fx-add-skill">{t('m26.fx.edit.add')}</button>
            </div>
          )}
        </fieldset>
        <TextArea label={t('m26.fx.edit.note')} name="note" value={note} onChange={setNote} rows={2} />
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-sunken/60 p-3 text-[13px]" aria-live="polite">
          <span className="font-semibold">{t('m26.fx.edit.preview')}</span>
          {preview ? <><ExposurePill exposure={preview.exposure} /><WhyThis reasons={preview.reasons} testId="m26-fx-preview-why" /></> : <span className="text-ink-3">{t('m26.fx.edit.pickDims')}</span>}
        </div>
      </div>
    </Modal>
  );
}

// ───────────── change-log diff for area = 'future'
interface Snap { needs: Needs | null; exposure: string | null; change_horizon: string | null; tech_driver: string | null; skills: string[] }
export function FutureDiff({ before, after }: { before: unknown; after: unknown }) {
  const t = useT();
  const f = useFormat();
  const b = (before ?? {}) as Partial<Snap>, a = (after ?? {}) as Partial<Snap>;
  const needsText = (n: Needs | null | undefined) => (n ? TASK_DIMS.filter((d) => n[d] !== undefined).map((d) => `${t(`m26.fx.dim.${d}`)} ${f.num(n[d] as number)}`).join(' · ') : '—');
  const rows: [string, ReactNode, ReactNode][] = [
    [t('m26.fx.col.exposure'), <ExposurePill key="b" exposure={b.exposure} />, <ExposurePill key="a" exposure={a.exposure} />],
    [t('m26.fx.col.horizon'), b.change_horizon ? t(`m26.fx.horizon.${b.change_horizon}`) : '—', a.change_horizon ? t(`m26.fx.horizon.${a.change_horizon}`) : '—'],
    [t('m26.fx.col.driver'), b.tech_driver ? t(`m26.fx.driver.${b.tech_driver}`) : '—', a.tech_driver ? t(`m26.fx.driver.${a.tech_driver}`) : '—'],
    [t('m26.fx.col.needs'), needsText(b.needs), needsText(a.needs)],
    [t('m26.fx.col.skills'), f.num((b.skills ?? []).length), f.num((a.skills ?? []).length)],
  ];
  return (
    <table className="mt-2 w-full text-[12.5px]" data-testid="m26-fx-diff">
      <thead><tr className="text-ink-3"><th className="text-start font-normal" scope="col">{t('m26.fx.diff.field')}</th><th className="text-start font-normal" scope="col">{t('m26.fx.diff.before')}</th><th className="text-start font-normal" scope="col">{t('m26.fx.diff.after')}</th></tr></thead>
      <tbody>{rows.map(([k, x, y]) => <tr key={k} className="border-t border-line align-top"><th scope="row" className="py-1 pe-2 text-start font-semibold">{k}</th><td className="py-1 pe-2">{x}</td><td className="py-1">{y}</td></tr>)}</tbody>
    </table>
  );
}
