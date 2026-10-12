// /knowledge/localisation (M24 · FS45, staff: knowledge R): the localisation countdown to 2030. For each programme or qualification step a
// partner still delivers or signs off (a SAMPLE plan, not an ENEC or partner commitment): the in-house instructor readiness computed from
// the F31 instructor pipeline (never entered), the target transfer date (no later than 31 Dec 2030), status, risk with reasons, and the
// countdown. Items past their target are flagged and listed on the F22 Handover 2030 board. The training manager updates status and, with
// a reason, the target date; SAT readers (instructors, training manager, auditors) see which instructors carry the readiness.
import { useMemo, useState } from 'react';
import { Page, Async, EmptyState, Callout, StatTile, BenchmarkChips, Icon, WhyThis, DataTable, ConfirmDialog, Card, BarChart, SimChip, SourceLink, Drawer, Modal } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { LOC_STATUSES, TARGET_MAX } from './localisation';
import { LocStatusPill, NGT310, ReadinessBar, RiskPill } from './fs44ui';
import { useKcLabels, useKcRefs } from './ui';
import type { LocBoard, LocBoardItem } from './backend/rpc';

export default function LocalisationPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['localisation_items', 'instructor_tracks', 'instructor_observations', 'teaching_hours'], async () => ({ v: await repo.rpc.localisationBoard().catch(() => null) }), [s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-localisation.title')} intro={t('m24.lz.intro')} wide eyebrow={<BenchmarkChips feature="FS45" />}>
      <Async state={q} isEmpty={(d) => !d.v} empty={<EmptyState icon="lock" title={t('m24.lz.noAccess')} />}>
        {(d) => <Board v={d.v!} reload={() => q.reload?.()} />}
      </Async>
    </Page>
  );
}

function Board({ v, reload }: { v: LocBoard; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const refs = useKcRefs();
  const lab = useKcLabels(refs.data);
  const [edit, setEdit] = useState<LocBoardItem | null>(null);
  const [people, setPeople] = useState<LocBoardItem | null>(null);
  const [filter, setFilter] = useState<string>('');
  const sm = v.summary;
  const overdue = v.items.filter((i) => i.risk.overdue);
  const rows = v.items.filter((i) => !filter || i.risk.level === filter);
  const canBoard = s.hasRole('manager', 'hr_analyst', 'hr_director', 'auditor');
  const canPipeline = s.can('sat', ['R', 'W', 'A']);
  const years = useMemo(() => sm.by_year.map((y) => ({ label: f.num(y.year, { useGrouping: false }), value: y.items })), [sm, f]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="card flex flex-col justify-center gap-1 p-5" data-testid="m24-lz-countdown" data-days={sm.days_to_2030}>
          <span className="caps">{t('m24.lz.countdown')}</span>
          <span className="num text-[44px] font-semibold leading-none text-accent">{f.num(Math.max(0, sm.days_to_2030))}</span>
          <span className="text-[13px] text-ink-2">{t('m24.lz.countdownSub', { date: f.date(TARGET_MAX) })}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="m24-lz-tiles">
          <StatTile label={t('m24.lz.tile.items')} value={f.num(sm.items)} sim />
          <StatTile label={t('m24.lz.tile.transferred')} value={`${f.num(sm.transferred)} / ${f.num(sm.items)}`} tone="ok" />
          <StatTile label={t('m24.lz.tile.overdue')} value={f.num(sm.overdue)} tone={sm.overdue ? 'bad' : 'ok'} />
          <StatTile label={t('m24.lz.tile.high')} value={f.num(sm.high)} tone={sm.high ? 'bad' : 'ok'} />
          <StatTile label={t('m24.lz.tile.medium')} value={f.num(sm.medium)} tone="sim" />
          <StatTile label={t('m24.lz.tile.avg')} value={f.pct(sm.avg_pct, 0)} sub={t('m24.lz.tile.avgSub')} />
        </div>
      </div>
      <Callout tone="sim" title={t('m24.lz.sample.title')}><span data-testid="m24-lz-sample">{t('m24.lz.sample.body')}</span> <SimChip label={t('m24.lz.sampleChip')} /></Callout>
      {overdue.length > 0 && (
        <Callout tone="bad" title={t('m24.lz.overdueTitle', { n: f.num(overdue.length) })}>
          <ul className="list-disc space-y-0.5 ps-4" data-testid="m24-lz-overdue">
            {overdue.map((i) => <li key={i.id} data-id={i.id}>{pick(i, 'title')} · {pick({ p_en: i.partner_en, p_ar: i.partner_ar }, 'p')} · {t('m24.lz.overdueBy', { n: f.num(-i.risk.days_left) })}</li>)}
          </ul>
          <p className="mt-2 text-[12.5px]">{t('m24.lz.overdueBoard')} {canBoard && <L to="/workforce/handover" className="link" data-testid="m24-lz-to-handover">{t('m24.lz.toHandover')}</L>}</p>
        </Callout>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('m24.lz.byYear')} className="lg:col-span-1"><BarChart title={t('m24.lz.byYear')} data={years} /></Card>
        <Card title={t('m24.lz.howTitle')} className="lg:col-span-2">
          <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2" data-testid="m24-lz-how">
            {['computed', 'weights', 'risk', 'transfer', 'protected'].map((k) => <li key={k}>{t(`m24.lz.how.${k}`)}</li>)}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
            {canPipeline && <L to="/training/instructors" className="link" data-testid="m24-lz-to-pipeline">{t('m24.lz.toPipeline')}</L>}
            <SourceLink href={NGT310.url} date={f.date(NGT310.as_of)}>{t('m24.lz.srcNgt310')}</SourceLink>
          </p>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('m24.lz.filterRisk')}>
        {['', 'overdue', 'high', 'medium', 'low', 'done'].map((k) => <button key={k || 'all'} className={`chip ${filter === k ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-sunken text-ink-2'}`} aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`m24-lz-filter-${k || 'all'}`}>{k ? t(`m24.lz.risk.${k}`) : t('m24.common.all')}</button>)}
      </div>
      <div data-testid="m24-lz-table">
        <DataTable rows={rows} rowKey={(i) => i.id} csvName="localisation-countdown" pageSize={25} initialSort={{ key: 'target', dir: 'asc' }} columns={[
          { key: 'item', header: t('m24.lz.col.item'), value: (i) => pick(i, 'title'), render: (i) => (
            <div className="min-w-[220px]" data-testid="m24-lz-row" data-id={i.id} data-risk={i.risk.level} data-overdue={i.risk.overdue ? 'yes' : 'no'}>
              <div className="font-semibold">{pick(i, 'title')}</div>
              <div className="text-[12px] text-ink-3">{i.programme_code ? `${i.programme_code} · ` : ''}{pick({ p_en: i.programme_en, p_ar: i.programme_ar }, 'p')}</div>
              <div className="text-[12px] text-ink-3">{i.standard_ids.map((x) => lab.standard(x).split(' · ')[0]).join(', ')}</div>
            </div>) },
          { key: 'partner', header: t('m24.lz.col.partner'), value: (i) => pick({ p_en: i.partner_en, p_ar: i.partner_ar }, 'p'), render: (i) => <div className="min-w-[150px]"><div>{pick({ p_en: i.partner_en, p_ar: i.partner_ar }, 'p')}</div><div className="text-[12px] text-ink-3">{t(`m24.lz.scope.${i.scope}`)}</div></div> },
          { key: 'target', header: t('m24.lz.col.target'), value: (i) => i.target_on, sortable: true, render: (i) => <div className="whitespace-nowrap"><div>{f.date(i.target_on)}</div><div className={`text-[12px] ${i.risk.overdue ? 'text-bad' : 'text-ink-3'}`}>{i.risk.level === 'done' ? t('m24.lz.transferredOn') : i.risk.overdue ? t('m24.lz.overdueBy', { n: f.num(-i.risk.days_left) }) : t('m24.lz.daysLeft', { n: f.num(i.risk.days_left) })}</div></div> },
          { key: 'status', header: t('m24.lz.col.status'), value: (i) => t(`m24.lz.status.${i.status}`), render: (i) => <LocStatusPill status={i.status} /> },
          { key: 'ready', header: t('m24.lz.col.readiness'), value: (i) => i.readiness.pct, sortable: true, render: (i) => <ReadinessBar pct={i.readiness.pct} ready={i.readiness.ready_now} need={i.readiness.needed} testId="m24-lz-ready" /> },
          { key: 'risk', header: t('m24.lz.col.risk'), value: (i) => t(`m24.lz.risk.${i.risk.level}`), render: (i) => <span className="flex items-center gap-1" data-testid="m24-lz-risk"><RiskPill level={i.risk.level} /><WhyThis testId="m24-lz-why" reasons={i.risk.reasons} /></span> },
          { key: 'act', header: '', csv: false, render: (i) => (
            <span className="flex flex-wrap gap-1">
              {v.can_see_people && <button className="btn-ghost btn-sm" onClick={() => setPeople(i)} data-testid="m24-lz-people"><Icon name="users" size={14} /> {t('m24.lz.instructors')}</button>}
              {v.can_edit && <button className="btn-outline btn-sm" onClick={() => setEdit(i)} data-testid="m24-lz-edit">{t('m24.lz.update')}</button>}
            </span>) },
        ]} />
      </div>
      {people && (
        <Drawer open onClose={() => setPeople(null)} title={t('m24.lz.instructorsFor', { title: pick(people, 'title') })}>
          <div className="space-y-3" data-testid="m24-lz-people-drawer">
            <ReadinessBar pct={people.readiness.pct} ready={people.readiness.ready_now} need={people.readiness.needed} />
            {(people.instructors ?? []).length === 0 ? <p className="text-[13px] text-ink-3">{t('m24.lz.noInstructors')}</p> : (
              <ul className="space-y-1.5 text-[13px]">
                {(people.instructors ?? []).map((x) => <li key={x.track_id} className="flex items-center justify-between gap-2" data-state={x.state}><span>{pick({ n_en: x.name, n_ar: x.name_ar }, 'n')}</span><span className="text-[12px] text-ink-3">{t(`m24.lz.state.${x.state}`)} · {t('m24.lz.weight', { n: f.num(x.tenths / 10, { maximumFractionDigits: 1 }) })}</span></li>)}
              </ul>
            )}
            <L to="/training/instructors" className="link text-[12.5px]">{t('m24.lz.toPipeline')}</L>
          </div>
        </Drawer>
      )}
      {edit && <EditStatus item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function EditStatus({ item, onClose, onSaved }: { item: LocBoardItem; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [status, setStatus] = useState(item.status);
  const [target, setTarget] = useState(item.target_on);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  return (
    <Modal open onClose={onClose} title={t('m24.lz.editTitle', { title: pick(item, 'title') })}
      footer={<div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={() => setConfirm(true)} data-testid="m24-lz-save">{t('m24.lz.save')}</button></div>}>
      <div className="space-y-3" data-testid="m24-lz-editor">
        <ReadinessBar pct={item.readiness.pct} ready={item.readiness.ready_now} need={item.readiness.needed} />
        <p className="text-[12.5px] text-ink-2">{t('m24.lz.editHelp')}</p>
        <label className="block"><span className="caps">{t('m24.lz.col.status')}</span>
          <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="m24-lz-status">{LOC_STATUSES.map((x) => <option key={x} value={x}>{t(`m24.lz.status.${x}`)}</option>)}</select></label>
        <label className="block"><span className="caps">{t('m24.lz.col.target')}</span>
          <input type="date" className="input mt-1" max={TARGET_MAX} min={item.baseline_on} value={target} onChange={(e) => setTarget(e.target.value)} data-testid="m24-lz-target" /></label>
        <label className="block"><span className="caps">{t('m24.lz.note')}</span>
          <textarea className="input mt-1" rows={3} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m24-lz-note" /></label>
        <p className="text-[12px] text-ink-3">{t('m24.lz.capNote', { date: f.date(TARGET_MAX) })}</p>
        {err && <div role="alert" className="rounded-md border border-bad/40 bg-bad-bg p-3 text-[13px] text-bad" data-testid="m24-lz-error" data-code={err.code}>{err.message}</div>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m24.lz.save')} actingAs={t('m24.lz.actingTm')}
        consequence={t('m24.lz.saveConsequence', { status: t(`m24.lz.status.${status}`), date: f.date(target) })}
        onConfirm={async () => { setConfirm(false); const r = await act(() => repo.rpc.setLocalisationStatus(item.id, { status, target_on: target, note })); if (r.ok) onSaved(); else setErr({ code: r.code, message: r.message }); }} />
    </Modal>
  );
}
