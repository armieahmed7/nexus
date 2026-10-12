// FS68 / FS69 (fsGe5) shared UI: readiness bars and group tiles, pre-arrival status pills, the item picker with the three consent gates,
// and the pre-check result built from shared items only. Pages never import a backend.
import { useMemo, useState } from 'react';
import { Card, Callout, CheckboxField, ProgressRing, SelectField, StatusPill, TextField, WhyThis, type PillTone } from '../../ui';
import { useT, usePick, useFormat, useLang } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { BasisChip, LevelMeter } from '../m17/ui';
import type { RecordItem } from '../m17/learnerRecord';
import type { FrGroup, FrReq } from './futureReadiness';
import type { CheckSummary, PrearrivalCheck } from './prearrival';
import { OutlookPill, TaskPill } from './passportUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Bi = { en: string; ar: string };
export const useBi = () => { const lang = useLang(); return (b: Bi | null | undefined) => (b ? (lang === 'ar' && b.ar ? b.ar : b.en) : ''); };
export const plusDays = (d: number, from = todayIso()) => new Date(Date.parse(`${from}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

/** Met / bridge / new stacked bar for one future requirement (counts of contractors). */
export function SplitBar({ met, bridge, fresh, testId }: { met: number; bridge: number; fresh: number; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const n = met + bridge + fresh;
  const w = (x: number) => `${n ? (100 * x) / n : 0}%`;
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={t('m09.fr.splitAria', { met: f.num(met), bridge: f.num(bridge), fresh: f.num(fresh) })}>
        <span className="h-full bg-ok" style={{ width: w(met) }} />
        <span className="h-full bg-sim" style={{ width: w(bridge) }} />
        <span className="h-full bg-line-strong" style={{ width: w(fresh) }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-ink-3">
        <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-ok" />{t('m09.fr.legendMet', { n: f.num(met) })}</span>
        <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-sim" />{t('m09.fr.legendBridge', { n: f.num(bridge) })}</span>
        <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-line-strong" />{t('m09.fr.legendNew', { n: f.num(fresh) })}</span>
      </div>
    </div>
  );
}

export function GroupTile({ group, reqs, pct, bridge, suppressed }: { group: FrGroup; reqs: number; pct: number | null; bridge: number | null; suppressed: boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="card min-w-0 p-3" data-testid="m09-fr-group" data-group={group}>
      <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t(`m09.fr.group.${group}`)}</div>
      {!reqs ? <p className="mt-1 text-[12.5px] text-ink-3">{t('m09.fr.groupNone')}</p>
        : suppressed ? <p className="mt-1 text-[13px] font-medium text-ink-2">{t('common.suppressed')}</p>
          : (
            <div className="mt-1 flex items-center gap-3">
              <ProgressRing value={pct ?? 0} size={52} tone={(pct ?? 0) >= 60 ? 'ok' : 'accent'} />
              <div className="min-w-0 text-[12.5px] text-ink-2">
                <div>{t('m09.fr.groupMet', { pct: f.pct(pct, 0) })}</div>
                <div className="text-ink-3">{t('m09.fr.groupBridge', { pct: f.pct(bridge, 0) })}</div>
                <div className="text-ink-3">{t('m09.fr.groupReqs', { n: f.num(reqs) })}</div>
              </div>
            </div>
          )}
    </div>
  );
}

export function ReqRow({ r, suppressed }: { r: FrReq; suppressed: boolean }) {
  const t = useT();
  const bi = useBi();
  const f = useFormat();
  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-testid="m09-fr-req" data-ref={r.ref_id}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{bi(r.name)}</span>
          <span className="chip border-line bg-sunken text-ink-2">{t(`m09.fr.group.${r.group}`)}</span>
          <span className="chip border-line bg-sunken text-ink-2">{t(`m09.fr.importance.${r.importance}`)}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {r.now_level == null ? t('m09.fr.newIn2030', { level: f.num(r.level) }) : t('m09.fr.raisedIn2030', { from: f.num(r.now_level), level: f.num(r.level) })}
          {r.driver ? ` · ${t(`m09.fr.driver.${r.driver}`)}` : ''}
        </p>
      </div>
      <div className="min-w-0">
        {suppressed || r.met == null ? <span className="text-[12.5px] text-ink-3">{t('common.suppressed')}</span>
          : <SplitBar met={r.met} bridge={r.bridge ?? 0} fresh={r.fresh ?? 0} testId="m09-fr-split" />}
      </div>
    </li>
  );
}

export function PaStatus({ status }: { status: string }) {
  const t = useT();
  const tone: PillTone = status === 'active' ? 'ok' : status === 'expired' ? 'sim' : 'bad';
  return <StatusPill status={status} tone={tone}>{t(`m09.pa.status.${status}`)}</StatusPill>;
}

/** Compact view of a stored check summary (counts only). */
export function SummaryLine({ s, checkedAt }: { s: CheckSummary | null; checkedAt?: string | null }) {
  const t = useT();
  const f = useFormat();
  if (!s) return <span className="text-[12.5px] text-ink-3">{t('m09.pa.notChecked')}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m09-pa-summary" data-outlook={s.outlook}>
      <OutlookPill outlook={s.outlook} />
      {t('m09.pa.summary', { likely: f.num(s.likely), total: f.num(s.total), skills: f.num(s.skills_used), pct: f.pct(s.coverage, 0) })}
      {checkedAt && <span className="text-ink-3">{t('m09.pa.checkedOn', { date: f.date(checkedAt) })}</span>}
    </span>
  );
}

export function ItemLine({ it }: { it: RecordItem }) {
  const t = useT();
  const pick = usePick();
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <span className="chip border-line bg-sunken text-ink-2">{t(`m09.pa.kind.${it.kind}`)}</span>
      <span className="font-medium">{pick(it, 'title')}</span>
      {it.kind === 'skill' && it.level != null && <LevelMeter level={it.level} size="sm" />}
      {it.kind === 'skill' && <BasisChip basis={it.status} />}
      {it.kind === 'qual' && <span className="text-[12px] text-ink-3">{t(`m09.pa.qual.${it.status}`)}</span>}
    </span>
  );
}

export interface ShareForm { items: string[]; label: string; expires_on: string; mobilise_on: string; standard_id: string; consent_ref: string; consents: { items: boolean; preview: boolean; share: boolean } }
export const emptyShare = (std = ''): ShareForm => ({ items: [], label: '', expires_on: plusDays(45), mobilise_on: plusDays(30), standard_id: std, consent_ref: '', consents: { items: false, preview: false, share: false } });

/** Item picker + standard + dates + the three FS32 consent gates (and the consent reference when recorded on behalf). */
export function ShareFormFields({ items, standards, form, set, onBehalf }: { items: RecordItem[]; standards: Row[]; form: ShareForm; set: (f: ShareForm) => void; onBehalf: boolean }) {
  const t = useT();
  const pick = usePick();
  const chosen = new Set(form.items);
  const toggle = (ref: string, on: boolean) => set({ ...form, items: on ? [...form.items, ref] : form.items.filter((x) => x !== ref), consents: { ...form.consents, items: false, preview: false } });
  const preview = items.filter((i) => chosen.has(i.ref));
  return (
    <div className="space-y-4">
      <SelectField label={t('m09.pa.fStandard')} name="standard" value={form.standard_id} onChange={(v) => set({ ...form, standard_id: v })} required
        options={standards.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }))} />
      <fieldset className="space-y-2" data-testid="m09-pa-items">
        <legend className="text-[13px] font-semibold">{t('m09.pa.fItems')}</legend>
        <p className="text-[12px] text-ink-3">{t('m09.pa.fItemsHint')}</p>
        {!items.length ? <p className="text-[12.5px] text-ink-3">{t('m09.pa.noItems')}</p> : items.map((it) => (
          <CheckboxField key={it.ref} checked={chosen.has(it.ref)} onChange={(v) => toggle(it.ref, v)} label={<ItemLine it={it} />} />
        ))}
      </fieldset>
      <TextField label={t('m09.pa.fLabel')} name="label" value={form.label} onChange={(v) => set({ ...form, label: v })} required hint={t('m09.pa.fLabelHint')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField type="date" label={t('m09.pa.fMobilise')} name="mobilise" value={form.mobilise_on} onChange={(v) => set({ ...form, mobilise_on: v })} required />
        <TextField type="date" label={t('m09.pa.fExpires')} name="expires" value={form.expires_on} onChange={(v) => set({ ...form, expires_on: v })} required hint={t('m09.pa.fExpiresHint')} />
      </div>
      {onBehalf && <TextField label={t('m09.pa.fConsentRef')} name="consent_ref" value={form.consent_ref} onChange={(v) => set({ ...form, consent_ref: v })} required hint={t('m09.pa.fConsentRefHint')} />}
      <Card title={t('m09.pa.previewTitle')}>
        {!preview.length ? <p className="text-[12.5px] text-ink-3">{t('m09.pa.previewEmpty')}</p> : (
          <ul className="space-y-1.5" data-testid="m09-pa-preview">{preview.map((it) => <li key={it.ref}><ItemLine it={it} /></li>)}</ul>
        )}
        <p className="mt-2 text-[12px] text-ink-3">{t('m09.pa.previewNote')}</p>
      </Card>
      <fieldset className="space-y-2" data-testid="m09-pa-consents">
        <legend className="text-[13px] font-semibold">{onBehalf ? t('m09.pa.consentsBehalf') : t('m09.pa.consents')}</legend>
        <CheckboxField checked={form.consents.items} onChange={(v) => set({ ...form, consents: { ...form.consents, items: v } })} label={t(onBehalf ? 'm09.pa.cItemsBehalf' : 'm09.pa.cItems')} />
        <CheckboxField checked={form.consents.preview} onChange={(v) => set({ ...form, consents: { ...form.consents, preview: v } })} label={t(onBehalf ? 'm09.pa.cPreviewBehalf' : 'm09.pa.cPreview')} />
        <CheckboxField checked={form.consents.share} onChange={(v) => set({ ...form, consents: { ...form.consents, share: v } })} label={t(onBehalf ? 'm09.pa.cShareBehalf' : 'm09.pa.cShare', { date: form.expires_on })} />
      </fieldset>
    </div>
  );
}

/** The pre-check result from shared items only (tasks with reasons, course suggestions with reasons). */
export function PrecheckResult({ p, tasks, skills, courses, stdCode }: { p: PrearrivalCheck; tasks: Row[]; skills: Row[]; courses: Row[]; stdCode: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const taskBy = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const skillBy = useMemo(() => new Map(skills.map((x) => [x.id, x])), [skills]);
  const courseBy = useMemo(() => new Map(courses.map((x) => [x.id, x])), [courses]);
  return (
    <div className="space-y-4" data-testid="m09-pa-result" data-outlook={p.outlook}>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={p.coverage} size={72} tone={p.outlook === 'training_likely' ? 'bad' : p.coverage >= 80 ? 'ok' : 'accent'} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><OutlookPill outlook={p.outlook} /><span className="chip border-line bg-sunken text-ink-2">{t('m09.pa.fromShared', { n: f.num(p.skills_used) })}</span></div>
            <p className="mt-1 text-[13.5px] text-ink-2">{t(`m09.cp.outlookText.${p.outlook}`, { code: stdCode })}</p>
            <p className="mt-1 text-[12.5px] text-ink-3">{t('m09.cp.pcCounts', { likely: f.num(p.likely), partial: f.num(p.partial), gaps: f.num(p.gaps), total: f.num(p.total), critical: f.num(p.critical_gaps) })}</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">{t('m09.pa.noWrites')}</p>
      </Card>
      <Card title={t('m09.cp.pcTasks')} padded={false}>
        <ul className="divide-y divide-line" data-testid="m09-pa-tasks">
          {p.tasks.map((x) => {
            const task = taskBy.get(x.task_id);
            return (
              <li key={x.task_id} className="flex flex-wrap items-start gap-3 px-4 py-3" data-testid="m09-pa-task" data-status={x.status}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{task ? (lang === 'ar' && task.statement_ar ? task.statement_ar : task.statement_en) : x.task_id}</span>
                    {x.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m09.cp.critical')}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {x.links.map((l) => (
                      <span key={l.skill_id} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                        {pick(skillBy.get(l.skill_id), 'name') || l.skill_id} <LevelMeter level={l.have} required={l.need} size="sm" />
                        {l.basis !== 'none' ? <BasisChip basis={l.basis} /> : <span className="text-ink-3">{t('m09.pa.notShared')}</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="flex items-center gap-2"><TaskPill status={x.status} /><WhyThis reasons={x.reasons} testId="m09-pa-why" /></span>
              </li>
            );
          })}
        </ul>
      </Card>
      {p.suggestions.length > 0 && (
        <Card title={t('m09.pa.suggestTitle')} footer={t('m09.cp.pcSuggestNote')}>
          <ul className="space-y-2" data-testid="m09-pa-suggestions">
            {p.suggestions.map((g) => {
              const c = courseBy.get(g.id);
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><span className="font-medium">{c ? `${c.code} · ${pick(c, 'title')}` : g.id}</span> {c?.audience === 'supplier' ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m09.cp.academyChip')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m09.cp.enecChip')}</span>}</span>
                  <WhyThis reasons={g.reasons} testId="m09-pa-sug-why" />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function GuidanceNote() {
  const t = useT();
  return <Callout tone="info" title={t('m09.pa.guidanceTitle')}>{t('m09.pa.guidanceBody')}</Callout>;
}

export function useToggle(initial = false) { const [v, s] = useState(initial); return [v, () => s((x) => !x), s] as const; }
