// M07 /workforce/critical-roles: bench depth for licensed and scarce roles against an HR target. Counts only, never names.
// HR sets targets through rpc.setBenchTarget (reason required, audited, ledger).
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Grid, Card, Async, EmptyState, Callout, BarChart, DataTable, StatusPill, ConfirmDialog, StatTile, SimChip, TextField } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { benchStatus } from './metrics';
import { DefLink, ExportButton, PeriodSelect, useWatermarkedExport } from './shared';

export default function WorkforceCriticalRolesPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const exportCsv = useWatermarkedExport();
  const canSet = s.hasRole('hr_analyst', 'hr_director');
  const q = useQuery(['critical_roles', 'job_roles'], async () => {
    const [rows, roles] = await Promise.all([repo.list('critical_roles'), repo.list('job_roles')]);
    return { rows, roles };
  });
  const periods = useMemo(() => [...new Set((q.data?.rows ?? []).map((r) => r.period))].sort(), [q.data]);
  const [period, setPeriod] = useState('');
  const cur = period || periods.at(-1) || '';
  const prevP = periods[periods.indexOf(cur) - 1];
  const rows = useMemo(() => {
    const d = q.data;
    if (!d) return [];
    return d.rows
      .filter((r) => r.period === cur)
      .map((r) => {
        const prev = d.rows.find((x) => x.role_id === r.role_id && x.period === prevP);
        return { ...r, name: pick(d.roles.find((x) => x.id === r.role_id), 'title') || r.role_id, status: benchStatus(r), coverage: Math.round((r.qualified / Math.max(1, r.target_bench)) * 100), delta: prev ? r.qualified - prev.qualified : null };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [q.data, cur, prevP, pick]);
  const [edit, setEdit] = useState<(typeof rows)[number] | null>(null);
  const [target, setTarget] = useState('');
  const atRisk = rows.filter((r) => r.status !== 'met').length;

  return (
    <Page title={t('m07.routes.workforce-critical-roles.title')} intro={t('m07.cr.intro')} wide>
      <Callout tone="info" title={t('m07.cr.countsTitle')}>{t('m07.cr.countsBody')}</Callout>
      <Async state={q} empty={<EmptyState title={t('m07.noData')} />} isEmpty={(d) => d.rows.length === 0}>
        {() => (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <PeriodSelect periods={periods} value={cur} onChange={setPeriod} />
              <span className="flex items-center gap-2"><DefLink metric="bench_depth" /><SimChip label={t('common.sample')} /></span>
            </div>
            <Grid cols={3}>
              <StatTile label={t('m07.cr.roles')} value={f.num(rows.length)} />
              <StatTile label={t('m07.cr.belowTarget')} value={f.num(atRisk)} tone={atRisk ? 'bad' : 'ok'} />
              <StatTile label={t('m07.cr.totalQualified')} value={f.num(rows.reduce((n, r) => n + r.qualified, 0))} sub={t('m07.cr.againstTarget', { n: f.num(rows.reduce((n, r) => n + r.target_bench, 0)) })} />
            </Grid>
            <Card title={t('m07.cr.chartTitle')}>
              <div className="space-y-3" data-testid="m07-bench-chart">
                {rows.map((r) => (
                  <div key={r.id}>
                    <BarChart title={r.name} data={[{ label: r.name, value: r.qualified, tone: r.status === 'met' ? 'ok' : r.status === 'at_risk' ? 'sim' : 'bad' }]} target={r.target_bench} max={Math.max(r.target_bench, r.qualified) * 1.1} />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{t('m07.cr.chartNote')}</p>
            </Card>
            <div data-testid="m07-bench-table">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                searchable={false}
                toolbar={<ExportButton onClick={() => exportCsv(`bench-depth-${cur}`, ['role', 'period', 'target', 'qualified', 'in_training', 'pipeline', 'coverage_pct', 'status'], rows.map((r) => [r.name, r.period, r.target_bench, r.qualified, r.in_training, r.pipeline, r.coverage, r.status]))} />}
                columns={[
                  { key: 'role', header: t('m07.cr.role'), value: (r) => r.name, sortable: true, render: (r) => <L to={`/careers/roles/${r.role_id}`}>{r.name}</L> },
                  { key: 'target', header: t('m07.cr.target'), value: (r) => r.target_bench, sortable: true, align: 'end' },
                  { key: 'q', header: t('m07.cr.qualified'), value: (r) => r.qualified, sortable: true, align: 'end', render: (r) => <span className="num">{f.num(r.qualified)}{r.delta != null && r.delta !== 0 && <span className="ms-1 text-[11px] text-ink-3">({r.delta > 0 ? '+' : ''}{f.num(r.delta)})</span>}</span> },
                  { key: 'tr', header: t('m07.cr.inTraining'), value: (r) => r.in_training, sortable: true, align: 'end' },
                  { key: 'pl', header: t('m07.cr.pipeline'), value: (r) => r.pipeline, sortable: true, align: 'end' },
                  { key: 'cov', header: t('m07.cr.coverage'), value: (r) => r.coverage, sortable: true, align: 'end', render: (r) => <span className="num">{f.num(r.coverage)}%</span> },
                  { key: 'status', header: t('m07.cr.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status === 'met' ? 'met' : r.status === 'at_risk' ? 'at_risk' : 'critical'}>{t(`m07.cr.st.${r.status}`)}</StatusPill> },
                  ...(canSet
                    ? [{ key: 'act', header: '', csv: false, render: (r: (typeof rows)[number]) => <button className="btn-ghost btn-sm" onClick={() => { setEdit(r); setTarget(String(r.target_bench)); }} data-testid="m07-set-target">{t('m07.cr.setTarget')}</button> }]
                    : []),
                ]}
              />
            </div>
          </>
        )}
      </Async>
      {edit && (
        <ConfirmDialog
          open={!!edit}
          requireReason
          reasonLabel={t('m07.cr.reason')}
          onClose={() => setEdit(null)}
          title={t('m07.cr.setTargetTitle', { role: edit.name })}
          consequence={t('m07.cr.setTargetBody')}
          actingAs={t('m07.cr.asHr')}
          confirmLabel={t('m07.cr.save')}
          onConfirm={async (reason) => {
            // The RPC validates the target (whole number 0-1000) and the reason, and its message is shown on refusal.
            await run(() => repo.rpc.setBenchTarget(edit.id, Number(target), reason));
          }}
        >
          <div className="grid grid-cols-1 gap-3">
            <TextField label={t('m07.cr.newTarget')} name="target" type="number" value={target} onChange={setTarget} required error={target !== '' && (!Number.isInteger(Number(target)) || Number(target) < 0) ? 'common.validation.format' : null} />
            <p className="text-[12px] text-ink-3">{t('m07.cr.reasonHint')}</p>
          </div>
        </ConfirmDialog>
      )}
    </Page>
  );
}
