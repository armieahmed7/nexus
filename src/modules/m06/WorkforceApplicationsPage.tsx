// M06 HR funnel (/workforce/applications): counts only with small cells suppressed (rpc.applicationFunnel) for HR analysts;
// the HR authority (CHCO office) also screens applications and records ENEC HR decisions as evidence (rpc.decideApplication).
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ApplicationsRow } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Card, Async, EmptyState, Callout, Tabs, Funnel, Heatmap, DataTable, Drawer, Timeline, KeyValue, StatusPill, ConfirmDialog, SelectField, TextArea, FilterBar, useFilters, Grid, StatTile, downloadText, Icon } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { todayIso } from '../../domain/rules';
import { csvWatermark } from '../m07/metrics';
import { ALL_STAGES, APP_FLOW, isClosed, nextStages } from './shared';

type Cell = { programme_id: string; stage: string; n: number | null; suppressed: boolean };

export default function WorkforceApplicationsPage() {
  const t = useT();
  const s = useSession();
  const canDecide = s.can('applications', ['A']);
  const canReadRows = s.can('applications', ['A', 'R']);
  const tabs = [
    { id: 'funnel', label: t('m06.hr.tabFunnel'), content: <FunnelTab /> },
    ...(canReadRows ? [{ id: 'queue', label: t('m06.hr.tabQueue'), content: <QueueTab canDecide={canDecide} /> }, { id: 'retention', label: t('m06.hr.tabRetention'), content: <RetentionTab /> }] : []),
  ];
  return (
    <Page title={t('m06.routes.workforce-applications.title')} intro={t('m06.hr.intro')} wide>
      <Callout tone="info" title={t('m06.hr.noAutoTitle')}>{t('m06.hr.noAutoBody')}</Callout>
      <Tabs tabs={tabs} />
    </Page>
  );
}

function useProgrammes() {
  const repo = useRepo();
  return useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
}

function FunnelTab() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const progs = useProgrammes();
  const cells = useQuery(['applications', 'application_events'], () => repo.rpc.applicationFunnel());
  const [prog, setProg] = useState('dnt');
  const stages = ['interest', ...APP_FLOW, 'unsuccessful', 'withdrawn'];
  const name = (id: string) => pick(progs.data?.find((p) => p.id === id), 'name') || id;
  return (
    <Async state={cells} empty={<EmptyState title={t('m06.hr.noData')} />}>
      {(rows: Cell[]) => {
        const progIds = Array.from(new Set(rows.map((r) => r.programme_id)));
        const cell = (p: string, st: string) => rows.find((r) => r.programme_id === p && r.stage === st);
        const visibleTotal = rows.filter((r) => !r.suppressed).reduce((n, r) => n + (r.n ?? 0), 0);
        const suppressedCells = rows.filter((r) => r.suppressed).length;
        const exportCsv = () => {
          const head = ['programme', 'stage', 'count'].join(',');
          const lines = rows.map((r) => [r.programme_id, r.stage, r.suppressed ? `suppressed (<${MIN_GROUP_SIZE})` : String(r.n)].map((x) => `"${x}"`).join(','));
          downloadText(`application-funnel-${todayIso()}.csv`, [csvWatermark(s.persona ? (s.persona.title_en) : 'unknown', todayIso()), head, ...lines].join('\r\n'));
        };
        return (
          <div className="space-y-4">
            <Grid cols={3}>
              <StatTile label={t('m06.hr.visibleTotal')} value={f.num(visibleTotal)} sub={t('m06.hr.visibleTotalSub')} />
              <StatTile label={t('m06.hr.suppressedCells')} value={f.num(suppressedCells)} sub={t('m06.hr.suppressedCellsSub', { n: MIN_GROUP_SIZE })} />
              <StatTile label={t('m06.hr.programmes')} value={f.num(progIds.length)} />
            </Grid>
            <Card
              title={t('m06.hr.funnelTitle')}
              actions={
                <label className="flex items-center gap-2 text-[13px]">
                  <span className="caps">{t('m06.hr.programme')}</span>
                  <select className="input h-8 min-w-[200px]" value={prog} onChange={(e) => setProg(e.target.value)} data-testid="m06-funnel-programme">
                    {progIds.map((p) => (
                      <option key={p} value={p}>{name(p)}</option>
                    ))}
                  </select>
                </label>
              }
            >
              <div data-testid="m06-funnel">
                <Funnel
                  title={t('m06.hr.funnelTitle')}
                  stages={stages.filter((st) => cell(prog, st)).map((st) => {
                    const c = cell(prog, st)!;
                    return { label: t(`m06.appStage.${st}`), value: c.n, suppressed: c.suppressed };
                  })}
                />
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{t('m06.hr.funnelNote', { n: MIN_GROUP_SIZE })}</p>
            </Card>
            <Card title={t('m06.hr.matrixTitle')} actions={<button className="btn-outline btn-sm" onClick={exportCsv} data-testid="m06-funnel-csv"><Icon name="download" size={14} />{t('common.exportCsv')}</button>}>
              <Heatmap
                title={t('m06.hr.matrixTitle')}
                rows={progIds}
                cols={stages}
                rowLabel={name}
                colLabel={(c) => t(`m06.appStage.${c}`)}
                value={(r, c) => {
                  const x = cell(r, c);
                  if (!x) return { v: null, tone: 'neutral', label: '0' };
                  return { v: x.n, suppressed: x.suppressed };
                }}
              />
              <p className="mt-2 text-[12px] text-ink-3">{t('m06.hr.matrixNote')}</p>
            </Card>
          </div>
        );
      }}
    </Async>
  );
}

function QueueTab({ canDecide }: { canDecide: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const progs = useProgrammes();
  const [flt, setFlt] = useFilters({ programme: '', stage: '', open: 'open' });
  const apps = useQuery('applications', () => repo.list('applications', { order: [['updated_at', 'desc']] }));
  const [sel, setSel] = useState<ApplicationsRow | null>(null);
  const rows = useMemo(
    () => (apps.data ?? []).filter((a) => (!flt.programme || a.programme_id === flt.programme) && (!flt.stage || a.stage === flt.stage) && (flt.open !== 'open' || !isClosed(a.stage))),
    [apps.data, flt],
  );
  const name = (id: string) => pick(progs.data?.find((p) => p.id === id), 'name') || id;
  return (
    <div className="space-y-3">
      <FilterBar
        value={flt}
        onChange={setFlt}
        fields={[
          { key: 'programme', label: t('m06.hr.programme'), options: (progs.data ?? []).filter((p) => p.apply_mode === 'in_kafaa').map((p) => ({ value: p.id, label: pick(p, 'name') })) },
          { key: 'stage', label: t('m06.hr.stage'), options: ALL_STAGES.map((s) => ({ value: s, label: t(`m06.appStage.${s}`) })) },
          { key: 'open', label: t('m06.hr.show'), options: [{ value: 'open', label: t('m06.hr.openOnly') }] },
        ]}
      />
      <Async state={apps} empty={<EmptyState title={t('m06.hr.noApps')} />}>
        {() => (
          <div data-testid="m06-queue">
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={setSel}
              initialSort={{ key: 'updated', dir: 'desc' }}
              columns={[
                { key: 'ref', header: t('m06.hr.ref'), value: (r) => r.id, sortable: true, render: (r) => <span className="num">{r.id}</span> },
                { key: 'programme', header: t('m06.hr.programme'), value: (r) => name(r.programme_id), sortable: true },
                { key: 'stage', header: t('m06.hr.stage'), value: (r) => r.stage, sortable: true, render: (r) => <StatusPill status={r.stage}>{t(`m06.appStage.${r.stage}`)}</StatusPill> },
                { key: 'submitted', header: t('m06.hr.submitted'), value: (r) => r.submitted_at, sortable: true, render: (r) => f.date(r.submitted_at) },
                { key: 'updated', header: t('m06.hr.updated'), value: (r) => r.updated_at, sortable: true, render: (r) => f.date(r.updated_at) },
                { key: 'nat', header: t('m06.hr.nationality'), value: (r) => r.nationality_flag, render: (r) => t(`m06.natFlag.${r.nationality_flag}`) },
              ]}
            />
          </div>
        )}
      </Async>
      <ApplicationDrawer app={sel} onClose={() => setSel(null)} canDecide={canDecide} programmeName={sel ? name(sel.programme_id) : ''} />
    </div>
  );
}

function ApplicationDrawer({ app, onClose, canDecide, programmeName }: { app: ApplicationsRow | null; onClose: () => void; canDecide: boolean; programmeName: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [stage, setStage] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const events = useQuery('application_events', () => (app ? repo.list('application_events', { filter: { application_id: app.id }, order: [['ts', 'asc']] }) : Promise.resolve([])), [app?.id]);
  if (!app) return null;
  const answers = (app.answers ?? {}) as Record<string, string>;
  const options = nextStages(app.stage);
  return (
    <Drawer open={!!app} onClose={onClose} title={t('m06.hr.drawerTitle', { id: app.id })}>
      <div className="space-y-4">
        <KeyValue
          items={[
            [t('m06.hr.programme'), programmeName],
            [t('m06.hr.stage'), <StatusPill key="s" status={app.stage}>{t(`m06.appStage.${app.stage}`)}</StatusPill>],
            [t('m06.hr.submitted'), f.dateTime(app.submitted_at)],
            [t('m06.hr.nationality'), t(`m06.natFlag.${app.nationality_flag}`)],
            [t('m06.apply.stageLabel'), answers.stage_finder ? t(`m06.finder.${answers.stage_finder}`) : '—'],
            [t('m06.apply.eduLabel'), answers.education ? t(`m06.edu.${answers.education}`) : '—'],
            [t('m06.apply.whyLabel'), answers.motivation || '—'],
            ...(app.delete_after ? ([[t('m06.hr.deleteAfter'), f.date(app.delete_after)]] as [string, string][]) : []),
          ]}
        />
        <Callout tone="info">{t('m06.hr.minimumNote')}</Callout>
        <div>
          <div className="caps mb-2">{t('m06.hr.history')}</div>
          <Async state={events} empty={<p className="text-ink-3">{t('m06.my.noHistory')}</p>}>
            {(evs) => <Timeline items={evs.map((e) => ({ id: e.id, when: f.dateTime(e.ts), title: t(`m06.appStage.${e.stage}`), detail: `${pick(e, 'note')}${e.by_role ? ` · ${e.by_role}` : ''}` }))} />}
          </Async>
        </div>
        {canDecide && options.length > 0 && (
          <form
            className="space-y-3 rounded-card border border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (stage && note.trim().length >= 5) setConfirm(true);
            }}
            data-testid="m06-decision-form"
          >
            <div className="font-semibold">{t('m06.hr.recordTitle')}</div>
            <SelectField label={t('m06.hr.nextStage')} name="stage" value={stage} onChange={setStage} required options={options.map((s) => ({ value: s, label: t(`m06.appStage.${s}`) }))} />
            <TextArea label={t('m06.hr.note')} name="note" value={note} onChange={setNote} hint={t('m06.hr.noteHint')} required error={note && note.trim().length < 5 ? 'common.validation.minLen:5' : null} />
            <button className="btn-primary" type="submit" disabled={!stage || note.trim().length < 5} data-testid="m06-decide">
              {t('m06.hr.record')}
            </button>
          </form>
        )}
        {!canDecide && <p className="text-[12.5px] text-ink-3">{t('m06.hr.readOnly')}</p>}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        danger={stage === 'unsuccessful'}
        title={t('m06.hr.confirmTitle')}
        consequence={t('m06.hr.confirmBody', { id: app.id, stage: stage ? t(`m06.appStage.${stage}`) : '' })}
        actingAs={t('m06.hr.actingAs')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.decideApplication(app.id, stage, note.trim()));
          if (r.ok) {
            setStage('');
            setNote('');
            onClose();
          }
        }}
      />
    </Drawer>
  );
}

function RetentionTab() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const apps = useQuery('applications', () => repo.list('applications'));
  return (
    <Async state={apps} empty={<EmptyState title={t('m06.hr.noApps')} />}>
      {(rows) => {
        const due = rows.filter((a) => a.delete_after);
        const byMonth = new Map<string, number>();
        for (const a of due) byMonth.set(a.delete_after!.slice(0, 7), (byMonth.get(a.delete_after!.slice(0, 7)) ?? 0) + 1);
        const months = [...byMonth.entries()].sort();
        const overdue = due.filter((a) => a.delete_after! < todayIso()).length;
        return (
          <div className="space-y-4">
            <Callout tone="info" title={t('m06.hr.retentionTitle')}>{t('m06.hr.retentionBody')}</Callout>
            <Grid cols={3}>
              <StatTile label={t('m06.hr.scheduled')} value={f.num(due.length)} />
              <StatTile label={t('m06.hr.overdue')} value={f.num(overdue)} tone={overdue ? 'bad' : 'ok'} />
              <StatTile label={t('m06.hr.open')} value={f.num(rows.filter((a) => !isClosed(a.stage)).length)} />
            </Grid>
            <Card title={t('m06.hr.byMonth')}>
              {months.length === 0 ? (
                <p className="text-ink-3">{t('m06.hr.noneScheduled')}</p>
              ) : (
                <table className="table-base w-full text-[13px]">
                  <thead><tr><th className="text-start">{t('m06.hr.month')}</th><th className="text-end">{t('m06.hr.records')}</th></tr></thead>
                  <tbody>
                    {months.map(([m, n]) => (
                      <tr key={m}><td className="num">{new Intl.DateTimeFormat(f.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))}</td><td className="num text-end">{f.num(n)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        );
      }}
    </Async>
  );
}
