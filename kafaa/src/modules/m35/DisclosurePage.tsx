// FS60 /workforce/disclosure (workforce_strategy R/W/A): the quarterly ISO 30414 skills and capability disclosure pack (SIMULATED).
// Every value comes from rpc.saveDisclosure / computeDisclosure (computed from training records, the learning record store, FS30 credits,
// FS09 rungs and the FS50 board; people counts under 10 suppressed), never typed. Each metric line carries the owner narrative and the
// variance explanation (EN/AR, written by an HR analyst or the HR director) and publishes only when a second person, the HR director,
// approves it (rpc.approveDisclosure: maker-checker, audit + ledger). Approved lines are frozen. Export: CSV, JSON and the print view.
import { useState } from 'react';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import {
  Page, Section, Card, Async, EmptyState, StatTile, Callout, SimChip, StatusPill, Stepper, WhyThis, BenchmarkChips, ConfirmDialog,
} from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import {
  FIRST_PERIOD, MIN_GROUP, approveProblem, lineState, metricReasons, periodClosed, prevPeriod, quarterOf, type Approval, type MetricValue, type Narrative,
} from './disclosure';
import { EquityCells, ExportButtons, LineStatePill, NarrativeEditor, VarianceChip, useHc, usePeople, usePersonName, useValueText, type HcData } from './fs60ui';
import type { Row } from './ui';

export default function DisclosurePage() {
  const t = useT();
  const hc = useHc();
  return (
    <Page title={t('m35.routes.workforce-disclosure.title')} intro={t('m35.hc.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS60" /><SimChip /></div>}
      actions={<div className="flex flex-wrap gap-2"><L to="/workforce/disclosure/metrics" className="btn-outline btn-sm no-underline" data-testid="m35-hc-library-link">{t('m35.hc.toLibrary')}</L></div>}>
      <Async state={hc} isEmpty={(d) => d.metrics.length === 0} empty={<EmptyState title={t('m35.hc.noMetrics')} />}>{(d) => <Workbench d={d} />}</Async>
    </Page>
  );
}

/** Ended quarters from 2025-Q1 that have no disclosure yet (newest first). */
function preparable(existing: string[], today: string): string[] {
  const out: string[] = [];
  for (let p = prevPeriod(quarterOf(today)); p >= FIRST_PERIOD; p = prevPeriod(p)) if (periodClosed(p, today) && !existing.includes(p)) out.push(p);
  return out.slice(0, 4);
}

function Workbench({ d }: { d: HcData }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const name = usePersonName(people.data);
  const periods = d.disclosures.map((x) => x.period as string);
  const [sel, setSel] = useState<string>(() => (d.disclosures.find((x) => x.status === 'draft') ?? d.disclosures[0])?.period ?? '');
  const row = d.disclosures.find((x) => x.period === sel) ?? d.disclosures[0];
  const canPrepare = s.can('workforce_strategy', ['W', 'A']);
  const canApprove = s.can('workforce_strategy', ['A']);
  const me = s.identity.personId ?? '';
  const toPrepare = preparable(periods, todayIso());
  const [prep, setPrep] = useState<string | null>(null);
  const [mat, setMat] = useState(false);
  const metrics = d.metrics.filter((m) => m.status === 'active');
  const ids = metrics.map((m) => m.id as string);
  return (
    <div className="space-y-6" data-testid="m35-hc">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-[12.5px]">
          <span className="caps block">{t('m35.hc.period')}</span>
          <select className="input w-auto min-w-0 max-w-full" value={row?.period ?? ''} onChange={(e) => setSel(e.target.value)} data-testid="m35-hc-period">
            {d.disclosures.map((x) => <option key={x.id} value={x.period}>{x.period} · {t(`m35.hc.status.${x.status}`)}</option>)}
          </select>
        </label>
        {canPrepare && toPrepare.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {toPrepare.map((p) => <button key={p} type="button" className="btn-outline btn-sm" onClick={() => setPrep(p)} data-testid="m35-hc-prepare">{t('m35.hc.prepare', { p })}</button>)}
          </div>
        )}
        {row && <div className="ms-auto flex flex-wrap gap-2 print:hidden"><ExportButtons row={row} metrics={metrics} /></div>}
      </div>
      {prep && (
        <ConfirmDialog open onClose={() => setPrep(null)} title={t('m35.hc.prepare', { p: prep })} consequence={t('m35.hc.prepareConsequence')} actingAs={t('m35.hc.actingPreparer')} confirmLabel={t('m35.hc.prepareConfirm')}
          onConfirm={async () => { const r = await run(() => repo.rpc.saveDisclosure({ period: prep })); if (r.ok) { setSel(prep); setPrep(null); } }} />
      )}
      {!row ? <EmptyState title={t('m35.hc.none')} /> : (
        <Disclosure row={row} metrics={metrics} ids={ids} me={me} canPrepare={canPrepare} canApprove={canApprove} name={name} onMateriality={() => setMat(true)} />
      )}
      {row && mat && <MaterialityEditor row={row} onClose={() => setMat(false)} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m35.hc.how.title')}>{t('m35.hc.how.body', { n: f.num(MIN_GROUP) })}</Callout>
        <Callout tone="sim" title={t('m35.hc.notAssurance.title')}>{t('m35.hc.notAssurance.body')}</Callout>
      </div>
    </div>
  );
}

function Disclosure({ row, metrics, ids, me, canPrepare, canApprove, name, onMateriality }: {
  row: Row; metrics: Row[]; ids: string[]; me: string; canPrepare: boolean; canApprove: boolean; name: (id: string | null | undefined) => string; onMateriality: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const vals = (row.metric_values?.metrics ?? []) as MetricValue[];
  const nar = (row.narratives ?? {}) as Record<string, Narrative>;
  const apr = (row.approvals ?? {}) as Record<string, Approval>;
  const states = ids.map((m) => lineState(nar, apr, m));
  const approved = states.filter((x) => x === 'approved').length;
  const ready = states.filter((x) => x === 'ready').length;
  const missing = states.filter((x) => x === 'missing').length;
  const published = row.status === 'published';
  const draft = !published;
  const approvable = ids.filter((m) => !approveProblem(row, m, me));
  const [bulk, setBulk] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const step = published ? 4 : approved > 0 ? 3 : ready > 0 ? 2 : 1;
  return (
    <div className="space-y-6" data-testid="m35-hc-disclosure" data-period={row.period} data-status={row.status}>
      <Card>
        <div className="space-y-4">
          <Stepper steps={[{ id: 'c', label: t('m35.hc.step.computed') }, { id: 'n', label: t('m35.hc.step.narratives') }, { id: 'a', label: t('m35.hc.step.approval') }, { id: 'p', label: t('m35.hc.step.published') }]} current={step} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="m35-hc-tiles">
            <StatTile label={t('m35.hc.tile.status')} value={t(`m35.hc.status.${row.status}`)} sub={published ? t('m35.hc.tile.publishedBy', { who: name(row.published_by), date: f.date(row.published_at) }) : t('m35.hc.tile.draftSub')} tone={published ? 'ok' : 'info'} />
            <StatTile label={t('m35.hc.tile.approved')} value={`${f.num(approved)} / ${f.num(ids.length)}`} sub={t('m35.hc.tile.approvedSub')} tone="ok" />
            <StatTile label={t('m35.hc.tile.ready')} value={f.num(ready)} sub={t('m35.hc.tile.readySub')} tone="info" />
            <StatTile label={t('m35.hc.tile.missing')} value={f.num(missing)} sub={t('m35.hc.tile.missingSub')} tone={missing ? 'bad' : undefined} />
            <StatTile label={t('m35.hc.tile.headcount')} value={row.metric_values?.headcount == null ? t('common.suppressedShort') : f.num(row.metric_values.headcount)} sub={t('m35.hc.tile.computedOn', { date: f.date(row.computed_on) })} sim />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            <span>{t('m35.hc.preparedBy', { who: name(row.prepared_by), date: f.date(row.created_at) })}</span>
            <span className="num rounded bg-sunken px-1.5 py-0.5 text-[11.5px]">{row.method}</span>
            <span>{t('m35.hc.window', { start: f.date(row.metric_values?.start), end: f.date(row.metric_values?.end) })}</span>
            {draft && canPrepare && <button type="button" className="btn-ghost btn-sm" onClick={() => setRefresh(true)} data-testid="m35-hc-refresh">{t('m35.hc.refresh')}</button>}
            {draft && canApprove && approvable.length > 1 && <button type="button" className="btn-primary btn-sm" onClick={() => setBulk(true)} data-testid="m35-hc-approve-all">{t('m35.hc.approveAll', { n: f.num(approvable.length) })}</button>}
          </div>
        </div>
      </Card>
      <Section title={t('m35.hc.materiality')} actions={draft && canPrepare ? <button type="button" className="btn-outline btn-sm" onClick={onMateriality} data-testid="m35-hc-materiality-edit">{t('m35.hc.materialityEdit')}</button> : undefined}>
        {row.materiality_en ? <p className="text-[13.5px] leading-relaxed" data-testid="m35-hc-materiality">{lang === 'ar' ? row.materiality_ar : row.materiality_en}</p>
          : <EmptyState title={t('m35.hc.noMateriality')} />}
      </Section>
      <Section title={t('m35.hc.lines')} description={t('m35.hc.linesIntro')}>
        <ol className="space-y-3" data-testid="m35-hc-lines">
          {metrics.map((m, i) => {
            const v = vals.find((x) => x.metric_id === m.id);
            return v ? <MetricLine key={m.id} idx={i} row={row} metric={m} v={v} state={states[ids.indexOf(m.id)]} narrative={nar[m.id] ?? null} approval={apr[m.id] ?? null} me={me}
              canPrepare={canPrepare && draft} canApprove={canApprove && draft} name={name} /> : null;
          })}
        </ol>
      </Section>
      {bulk && (
        <ConfirmDialog open onClose={() => setBulk(false)} title={t('m35.hc.approveAll', { n: f.num(approvable.length) })} consequence={t('m35.hc.approveConsequence')} actingAs={t('m35.actingDirector')} confirmLabel={t('m35.hc.approve')}
          onConfirm={async () => { const r = await run(() => repo.rpc.approveDisclosure(row.id, approvable)); if (r.ok) setBulk(false); }}>
          <ul className="list-disc ps-4 text-[13px]">{approvable.map((m) => <li key={m}>{metrics.find((x) => x.id === m)?.[lang === 'ar' ? 'name_ar' : 'name_en']}</li>)}</ul>
        </ConfirmDialog>
      )}
      {refresh && (
        <ConfirmDialog open onClose={() => setRefresh(false)} title={t('m35.hc.refresh')} consequence={t('m35.hc.refreshConsequence')} actingAs={t('m35.hc.actingPreparer')} confirmLabel={t('m35.hc.refresh')}
          onConfirm={async () => { const r = await run(() => repo.rpc.saveDisclosure({ period: row.period })); if (r.ok) setRefresh(false); }} />
      )}
    </div>
  );
}

function MetricLine({ idx, row, metric, v, state, narrative, approval, me, canPrepare, canApprove, name }: {
  idx: number; row: Row; metric: Row; v: MetricValue; state: string; narrative: Narrative | null; approval: Approval | null; me: string; canPrepare: boolean; canApprove: boolean;
  name: (id: string | null | undefined) => string;
}) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const vt = useValueText();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const problem = approveProblem(row, metric.id, me);
  return (
    <li className="card break-inside-avoid p-4" data-testid="m35-hc-line" data-metric={metric.id} data-state={state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-ink-3">{f.num(idx + 1)}.</span>
            <h3 className="text-[15px] font-semibold">{pick(metric, 'name')}</h3>
            <LineStatePill state={state} />
            <StatusPill tone="neutral">{t(`m35.hc.basis.${v.basis}`)}</StatusPill>
          </div>
          <p className="text-[12.5px] text-ink-2">{pick(metric, 'definition')}</p>
        </div>
        <div className="text-end">
          <div className="num text-[26px] font-semibold leading-tight" data-testid="m35-hc-value" data-value={v.value ?? ''} data-suppressed={String(v.suppressed)}><bdi dir="ltr">{vt(v.unit, v.value)}</bdi></div>
          <VarianceChip m={v} better={metric.better} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          {narrative ? (
            <>
              <p className="text-[13.5px] leading-relaxed" data-testid="m35-hc-narrative">{lang === 'ar' ? narrative.narrative_ar : narrative.narrative_en}</p>
              <p className="text-[12.5px] text-ink-2"><b>{t('m35.hc.varianceLabel')}</b> {lang === 'ar' ? narrative.variance_ar : narrative.variance_en}</p>
              <p className="text-[11.5px] text-ink-3">{t('m35.hc.writtenBy', { who: name(narrative.by), date: f.date(narrative.at) })}</p>
            </>
          ) : <p className="text-[13px] text-ink-3" data-testid="m35-hc-no-narrative">{t('m35.hc.noNarrative')}</p>}
          {approval && <p className="text-[12px] text-ok" data-testid="m35-hc-approval">{t('m35.hc.approvedBy', { who: name(approval.by), date: f.date(approval.at) })}</p>}
        </div>
        <div className="space-y-2 text-[12.5px]">
          <details>
            <summary className="cursor-pointer font-medium">{t('m35.hc.formula')}</summary>
            <p className="mt-1 text-ink-2">{pick(metric, 'formula')}</p>
            <p className="mt-1 text-ink-3">{t('m35.hc.source')}: {pick(metric, 'source')}</p>
            <p className="text-ink-3">{t('m35.hc.owner')}: {pick(metric, 'owner')}</p>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <WhyThis reasons={metricReasons(v)} testId={`m35-hc-why-${idx}`} label={t('m35.hc.whyValue')} />
            {v.count_kind === 'register_rows' && <span className="text-ink-3">{t('m35.hc.rowsNote', { on: f.num(v.num ?? 0), den: f.num(v.den ?? 0), ex: f.num(v.excluded) })}</span>}
          </div>
        </div>
      </div>
      {v.cells.length > 0 && <EquityCells v={v} />}
      {(canPrepare || canApprove) && state !== 'approved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {canPrepare && <button type="button" className="btn-outline btn-sm" onClick={() => setEdit(true)} data-testid="m35-hc-edit">{narrative ? t('m35.hc.editLine') : t('m35.hc.writeLine')}</button>}
          {canApprove && (
            <>
              <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m35-hc-approve" data-problem={problem ?? ''}>{t('m35.hc.approve')}</button>
              {problem && <span className="text-[12px] text-ink-3" data-testid="m35-hc-approve-why">{t(`m35.hc.blocked.${problem}`)}</span>}
            </>
          )}
        </div>
      )}
      {edit && <NarrativeEditor period={row.period} metric={metric} current={narrative} onClose={() => setEdit(false)} />}
      {confirm && (
        <ConfirmDialog open onClose={() => setConfirm(false)} title={t('m35.hc.approveTitle', { name: pick(metric, 'name') })} consequence={t('m35.hc.approveConsequence')} actingAs={t('m35.actingDirector')} confirmLabel={t('m35.hc.approve')}
          onConfirm={async () => { const r = await run(() => repo.rpc.approveDisclosure(row.id, [metric.id])); if (r.ok) setConfirm(false); }} />
      )}
    </li>
  );
}

function MaterialityEditor({ row, onClose }: { row: Row; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [en, setEn] = useState<string>(row.materiality_en ?? '');
  const [ar, setAr] = useState<string>(row.materiality_ar ?? '');
  const ok = en.trim().length >= 40 && ar.trim().length >= 40 && /[؀-ۿ]/.test(ar);
  return (
    <ConfirmDialog open onClose={onClose} title={t('m35.hc.materiality')} consequence={t('m35.hc.materialityConsequence')} actingAs={t('m35.hc.actingPreparer')} confirmLabel={t('m35.hc.saveLine')}
      onConfirm={async () => { if (!ok) return; const r = await run(() => repo.rpc.saveDisclosure({ period: row.period, materiality_en: en, materiality_ar: ar })); if (r.ok) onClose(); }}>
      <div className="space-y-3" data-testid="m35-hc-materiality-form">
        <label className="block space-y-1 text-[12.5px]"><span className="font-medium">{t('m35.hc.materialityEn')}</span><textarea className="input min-h-[96px] w-full" value={en} onChange={(e) => setEn(e.target.value)} /></label>
        <label className="block space-y-1 text-[12.5px]" dir="rtl" lang="ar"><span className="font-medium">{t('m35.hc.materialityAr')}</span><textarea className="input min-h-[96px] w-full" value={ar} onChange={(e) => setAr(e.target.value)} /></label>
        {!ok && <p className="text-[12.5px] text-ink-3">{t('m35.hc.problem.materiality')}</p>}
      </div>
    </ConfirmDialog>
  );
}
