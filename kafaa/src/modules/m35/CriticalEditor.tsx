// FS50 register editor (drawer): add or edit a critical future skill. HR analysts draft; the HR director adopts, edits adopted rows or
// retires (the server enforces it too). The same check as the RPCs (criticalProblem) runs before the confirmation; progress is never typed.
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { ConfirmDialog, Drawer, RadioGroup, SelectField, TextArea, CheckboxField, Callout } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { CS_STATUSES, DECISIONS, KPI_KINDS, KPI_RANGE, OWNER_FUNCTIONS, criticalProblem, type CriticalCtx, type CriticalInput, type Kpi, type KpiKind, type Target } from './critical';
import type { M35Ref, Row } from './ui';

interface Draft { skill_id: string; owner_function: string; owner_person_id: string; target_level: number; targets: Target[]; kpis: Kpi[]; decision: string; rationale_en: string; rationale_ar: string; gap_plan_ids: string[]; status: string }
const blank: Draft = { skill_id: '', owner_function: '', owner_person_id: '', target_level: 2, targets: [{ year: 2026, pe: 0 }, { year: 2030, pe: 0 }], kpis: [{ kind: 'holders_pe', target: 0 }], decision: 'build', rationale_en: '', rationale_ar: '', gap_plan_ids: [], status: 'draft' };

export function CriticalEditor({ open, onClose, row, taken, refData }: { open: boolean; onClose: () => void; row?: Row | null; taken: string[]; refData: M35Ref }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const isA = s.can('workforce_strategy', ['A']);
  const [d, setD] = useState<Draft>(() => (row ? {
    skill_id: row.skill_id, owner_function: row.owner_function, owner_person_id: row.owner_person_id, target_level: Number(row.target_level), targets: (row.targets ?? []).map((x: Target) => ({ ...x })),
    kpis: (row.kpis ?? []).map((x: Kpi) => ({ ...x })), decision: row.decision, rationale_en: row.rationale_en, rationale_ar: row.rationale_ar, gap_plan_ids: [...(row.gap_plan_ids ?? [])], status: row.status,
  } : blank));
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const skills = useMemo(() => [...refData.skills.values()].filter((x) => x.area !== 'security' && x.lifecycle !== 'obsolete' && (x.id === row?.skill_id || !taken.includes(x.id)))
    .sort((a, b) => String(pick(a, 'name')).localeCompare(String(pick(b, 'name')))), [refData, taken, row, pick]);
  const owners = useMemo(() => [...refData.people.values()].filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => String(a.display_name).localeCompare(String(b.display_name))), [refData]);
  const plans = refData.plans.filter((g) => g.sk_id === d.skill_id);
  const ctx: CriticalCtx = useMemo(() => ({
    skills: Object.fromEntries([...refData.skills.values()].map((x) => [x.id, { area: x.area ?? null, lifecycle: x.lifecycle ?? null }])),
    owners: owners.map((p) => p.id as string), plans: Object.fromEntries(refData.plans.map((g) => [g.id, { sk_id: g.sk_id ?? null }])),
  }), [refData, owners]);
  const input = { ...(row ? { id: row.id } : {}), ...d } as unknown as CriticalInput;
  const problem = criticalProblem(input, ctx);
  const needsA = d.status !== 'draft' || (!!row && row.status !== 'draft');
  const blocked = !!problem || (needsA && !isA);
  const kpiOf = (k: KpiKind) => d.kpis.find((x) => x.kind === k);
  const toggleKpi = (k: KpiKind, on: boolean) => set('kpis', on ? [...d.kpis, { kind: k, target: 0 }] : d.kpis.filter((x) => x.kind !== k));
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? NaN : Number(v));
  return (
    <>
      <Drawer open={open} onClose={onClose} title={row ? t('m35.cse.editTitle') : t('m35.cse.newTitle')}
        footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary btn-sm" disabled={blocked} onClick={() => setConfirm(true)} data-testid="m35-cse-save">{t('m35.cse.save')}</button>
        </div>}>
        <div className="space-y-4" data-testid="m35-cse">
          <SelectField name="m35-cse-1" label={t('m35.cse.skill')} value={d.skill_id} disabled={!!row} onChange={(v) => setD((x) => ({ ...x, skill_id: v, gap_plan_ids: [] }))}
            options={skills.map((x) => ({ value: x.id, label: pick(x, 'name') }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="m35-cse-2" label={t('m35.cse.ownerFunction')} value={d.owner_function} onChange={(v) => set('owner_function', v)} options={OWNER_FUNCTIONS.map((o) => ({ value: o, label: t(`fs.owner.${o}`) }))} />
            <SelectField name="m35-cse-3" label={t('m35.cse.ownerPerson')} value={d.owner_person_id} onChange={(v) => set('owner_person_id', v)}
              options={owners.map((p) => ({ value: p.id, label: pick({ name_en: p.display_name, name_ar: p.display_name_ar ?? p.display_name }, 'name') }))} />
          </div>
          <SelectField name="m35-cse-4" label={t('m35.cse.level')} value={String(d.target_level)} onChange={(v) => set('target_level', Number(v))} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: t(`m35.level.${l}`) }))} />
          <fieldset className="space-y-2" data-testid="m35-cse-targets">
            <legend className="text-[13px] font-semibold">{t('m35.cse.targets')}</legend>
            <p className="text-[12px] text-ink-3">{t('m35.cse.targetsHint')}</p>
            {d.targets.map((x, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-[12px]">{t('m35.cse.year')}
                  <input className="input w-24" type="number" min={2026} max={2035} value={Number.isFinite(x.year) ? x.year : ''} onChange={(e) => set('targets', d.targets.map((y, j) => (j === i ? { ...y, year: num(e.target.value) } : y)))} />
                </label>
                <label className="flex flex-col text-[12px]">{t('m35.cse.pe')}
                  <input className="input w-28" type="number" min={0} max={5000} value={Number.isFinite(x.pe) ? x.pe : ''} onChange={(e) => set('targets', d.targets.map((y, j) => (j === i ? { ...y, pe: num(e.target.value) } : y)))} />
                </label>
                <button type="button" className="btn-ghost btn-sm" disabled={d.targets.length <= 1} onClick={() => set('targets', d.targets.filter((_, j) => j !== i))}>{t('m35.cse.removeTarget')}</button>
              </div>
            ))}
            <button type="button" className="btn-outline btn-sm" disabled={d.targets.length >= 6} onClick={() => set('targets', [...d.targets, { year: Math.min(2035, (d.targets.at(-1)?.year ?? 2025) + 1), pe: d.targets.at(-1)?.pe ?? 0 }])}>{t('m35.cse.addTarget')}</button>
          </fieldset>
          <fieldset className="space-y-2" data-testid="m35-cse-kpis">
            <legend className="text-[13px] font-semibold">{t('m35.cse.kpis')}</legend>
            {KPI_KINDS.map((k) => {
              const cur = kpiOf(k);
              return (
                <div key={k} className="flex flex-wrap items-center gap-3">
                  <CheckboxField label={t(`m35.kpi.${k}`)} checked={!!cur} onChange={(on) => toggleKpi(k, on)} hint={t(`m35.kpiHint.${k}`)} />
                  {cur && <input className="input w-24" type="number" min={KPI_RANGE[k][0]} max={KPI_RANGE[k][1]} aria-label={t('m35.cse.kpiTarget', { kpi: t(`m35.kpi.${k}`) })} value={Number.isFinite(cur.target) ? cur.target : ''}
                    onChange={(e) => set('kpis', d.kpis.map((x) => (x.kind === k ? { ...x, target: num(e.target.value) } : x)))} />}
                </div>
              );
            })}
          </fieldset>
          <RadioGroup label={t('m35.cse.decision')} name="m35-decision" value={d.decision} onChange={(v) => set('decision', v)} options={DECISIONS.map((x) => ({ value: x, label: <span><b>{t(`m35.decision.${x}`)}</b> · <span className="text-ink-3">{t(`m35.decisionHint.${x}`)}</span></span> }))} />
          <TextArea name="m35-cse-5" label={t('m35.cse.rationaleEn')} value={d.rationale_en} onChange={(v) => set('rationale_en', v)} rows={3} hint={t('m35.cse.chars', { n: f.num(d.rationale_en.trim().length) })} />
          <div dir="rtl" lang="ar"><TextArea name="m35-cse-6" label={t('m35.cse.rationaleAr')} value={d.rationale_ar} onChange={(v) => set('rationale_ar', v)} rows={3} hint={t('m35.cse.chars', { n: f.num(d.rationale_ar.trim().length) })} /></div>
          <fieldset className="space-y-1.5" data-testid="m35-cse-plans">
            <legend className="text-[13px] font-semibold">{t('m35.cse.plans')}</legend>
            {plans.length ? plans.map((g) => (
              <CheckboxField key={g.id} label={`${g.id} · ${t(`m35.planAction.${g.action}`)} · ${g.target_quarter}`} hint={g.note ?? ''} checked={d.gap_plan_ids.includes(g.id)}
                onChange={(on) => set('gap_plan_ids', on ? [...d.gap_plan_ids, g.id] : d.gap_plan_ids.filter((x) => x !== g.id))} />
            )) : <p className="text-[12.5px] text-ink-3">{t('m35.cse.noPlans')}</p>}
          </fieldset>
          <SelectField name="m35-cse-7" label={t('m35.cse.status')} value={d.status} onChange={(v) => set('status', v)} options={CS_STATUSES.filter((x) => x === 'draft' || isA).map((x) => ({ value: x, label: t(`m35.status.${x}`) }))}
            hint={isA ? t('m35.cse.statusHintA') : t('m35.cse.statusHintW')} />
          {problem && <Callout tone="info" title={t('m35.cse.problemTitle')}><span data-testid="m35-cse-problem" data-problem={problem}>{t(`m35.cse.problem.${problem}`)}</span></Callout>}
          {!problem && needsA && !isA && <Callout tone="info" title={t('m35.cse.problemTitle')}>{t('m35.cse.needsA')}</Callout>}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={row ? t('m35.cse.confirmEdit') : t('m35.cse.confirmNew')}
        consequence={d.status === 'active' && row?.status !== 'active' ? t('m35.cse.consequenceAdopt') : d.status === 'retired' ? t('m35.cse.consequenceRetire') : t('m35.cse.consequence')}
        actingAs={isA ? t('m35.actingDirector') : t('m35.actingAnalyst')} confirmLabel={t('m35.cse.save')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.saveCriticalSkill(input));
          if (r.ok) { setConfirm(false); onClose(); }
        }} />
    </>
  );
}
