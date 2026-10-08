// M16 · /admin/integrations: connectors to the systems of record, their sync state against each connector's freshness
// threshold, record and error counts, and simulated sync runs (platform admin). A stale licence or medical mirror
// stops the portal showing "valid" (RULES.staleSyncHours), so staleness is shown first.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { translate, useFormat, useT } from '../../i18n';
import { Async, BarChart, Callout, Card, DataTable, Page, SimChip, StatusPill, type Column } from '../../ui';
import type { IntegrationsRow } from '../../data/types';
import { RULES } from '../../auth/policy';
import { syncState } from '../../domain/g5rules';
import { GatedConfirm, Metric } from './parts';

export default function AdminIntegrationsPage() {
  const t = useT();
  // Connector names, domains and notes are stored in English; show the seeded ones translated, and anything an admin
  // has since edited as written.
  const rowText = (i: IntegrationsRow, field: 'name' | 'domain' | 'notes') => {
    const key = `m16.int.rows.${i.id}.${field}`;
    const raw = String(i[field] ?? '');
    return translate('en', key) === raw ? t(key) : raw;
  };
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canRun = s.can('integrations', ['A']);
  const q = useQuery('integrations', () => repo.list('integrations', { order: [['name', 'asc']] }));
  const [act, setAct] = useState<{ i: IntegrationsRow; kind: 'sync' | 'disable' | 'enable' } | null>(null);
  const now = new Date();
  const hoursAgo = (ts: string) => Math.max(0, Math.round((now.getTime() - new Date(ts).getTime()) / 3_600_000));

  const doAction = (i: IntegrationsRow, kind: 'sync' | 'disable' | 'enable') => {
    if (kind === 'sync') return run(() => repo.update('integrations', i.id, { last_success: new Date().toISOString(), status: i.errors > 0 ? 'degraded' : 'ok' }), { success: t('m16.int.synced', { name: rowText(i, 'name') }) });
    if (kind === 'disable') return run(() => repo.update('integrations', i.id, { status: 'disabled' }), { success: t('m16.int.disabledToast') });
    return run(() => repo.update('integrations', i.id, { status: 'ok', last_success: new Date().toISOString() }), { success: t('m16.int.enabledToast') });
  };

  return (
    <Page title={t('m16.routes.admin-integrations.title')} intro={t('m16.int.intro')} actions={<SimChip label={t('m16.int.simulated')} />} wide>
      <Async state={q}>
        {(rows) => {
          const st = rows.map((i) => ({ i, st: syncState(i, now) }));
          const count = (k: string) => st.filter((x) => x.st === k).length;
          const staleLicensing = st.filter((x) => (x.st === 'stale' || x.st === 'error') && /licen|octs|occupational|medical/i.test(`${x.i.name} ${x.i.domain}`));
          const cols: Column<{ i: IntegrationsRow; st: string }>[] = [
            { key: 'name', header: t('m16.int.connector'), value: (x) => rowText(x.i, 'name'), sortable: true, render: (x) => <div><div className="font-semibold">{rowText(x.i, 'name')}</div><div className="text-[12px] text-ink-3">{x.i.system_kind}</div></div> },
            { key: 'domain', header: t('m16.int.domain'), value: (x) => rowText(x.i, 'domain') },
            { key: 'dir', header: t('m16.int.direction'), value: (x) => x.i.direction, render: (x) => t(`m16.int.dir.${x.i.direction}`) },
            { key: 'last', header: t('m16.int.lastSuccess'), value: (x) => x.i.last_success, sortable: true, render: (x) => <span title={f.dateTime(x.i.last_success)}>{t('m16.int.hoursAgo', { n: f.num(hoursAgo(x.i.last_success)) })}</span> },
            { key: 'threshold', header: t('m16.int.threshold'), value: (x) => x.i.threshold_hours, align: 'end', render: (x) => t('m16.int.hours', { n: x.i.threshold_hours }) },
            { key: 'records', header: t('m16.int.records'), value: (x) => x.i.records, align: 'end', render: (x) => f.num(x.i.records) },
            { key: 'errors', header: t('m16.int.errors'), value: (x) => x.i.errors, align: 'end', render: (x) => <span className={x.i.errors ? 'font-semibold text-bad' : ''}>{f.num(x.i.errors)}</span> },
            { key: 'schedule', header: t('m16.int.schedule'), value: (x) => x.i.schedule },
            { key: 'state', header: t('m16.int.state'), value: (x) => x.st, render: (x) => <StatusPill status={x.st}>{t(`m16.int.st.${x.st}`)}</StatusPill> },
            ...(canRun
              ? [{ key: 'act', header: '', csv: false, render: (x: { i: IntegrationsRow }) => (
                  <span className="flex gap-1">
                    {x.i.status !== 'disabled' && <button className="btn-outline btn-sm" onClick={() => setAct({ i: x.i, kind: 'sync' })} data-testid="m16-sync">{t('m16.int.runSync')}</button>}
                    <button className="btn-ghost btn-sm" onClick={() => setAct({ i: x.i, kind: x.i.status === 'disabled' ? 'enable' : 'disable' })}>{x.i.status === 'disabled' ? t('m16.int.enable') : t('m16.int.disable')}</button>
                  </span>
                ) } as Column<{ i: IntegrationsRow; st: string }>]
              : []),
          ];
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-5" data-testid="m16-int-metrics">
                <Metric label={t('m16.int.st.ok')} value={f.num(count('ok'))} tone="ok" />
                <Metric label={t('m16.int.st.degraded')} value={f.num(count('degraded'))} tone={count('degraded') ? 'sim' : undefined} />
                <Metric label={t('m16.int.st.stale')} value={f.num(count('stale'))} tone={count('stale') ? 'bad' : undefined} />
                <Metric label={t('m16.int.st.error')} value={f.num(count('error'))} tone={count('error') ? 'bad' : undefined} />
                <Metric label={t('m16.int.st.disabled')} value={f.num(count('disabled'))} />
              </div>
              {staleLicensing.length > 0 && (
                <Callout tone="bad" title={t('m16.int.staleTitle')}>
                  {t('m16.int.staleBody', { names: staleLicensing.map((x) => rowText(x.i, 'name')).join(', '), h: RULES.staleSyncHours })}
                </Callout>
              )}
              <div data-testid="m16-int-table">
                <DataTable rows={st} rowKey={(x) => x.i.id} columns={cols} csvName="kafaa-integrations" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title={t('m16.int.errorsTitle')}>
                  <BarChart title={t('m16.int.errorsTitle')} data={rows.filter((i) => i.errors > 0).map((i) => ({ label: rowText(i, 'name'), value: i.errors }))} />
                  {rows.every((i) => i.errors === 0) && <p className="text-[13px] text-ink-3">{t('m16.int.noErrors')}</p>}
                </Card>
                <Card title={t('m16.int.notesTitle')}>
                  <ul className="space-y-2 text-[13px]">
                    {rows.filter((i) => i.notes).map((i) => (
                      <li key={i.id}>
                        <span className="font-semibold">{rowText(i, 'name')}: </span>
                        <span className="text-ink-2">{rowText(i, 'notes')}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
              <p className="text-[12px] text-ink-3">{t('m16.int.footer')}</p>
            </div>
          );
        }}
      </Async>
      <GatedConfirm
        open={!!act}
        danger={act?.kind === 'disable'}
        onClose={() => setAct(null)}
        title={act ? t(`m16.int.confirm.${act.kind}`, { name: rowText(act.i, 'name') }) : ''}
        consequence={act ? t(`m16.int.consequence.${act.kind}`) : ''}
        actingAs={t('m16.hub.asAdmin')}
        onConfirm={() => act && doAction(act.i, act.kind)}
      />
    </Page>
  );
}
