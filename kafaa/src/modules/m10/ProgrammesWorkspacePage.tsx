// FS66 /partner/university/programmes: the university's own programme alignments (RLS: a partner university reads only its own rows).
// Map a programme to ENEC skills and levels (each skill names its modules), see the coverage the FS57 rule gives for the target roles
// (now and 2030) and the computed endorsement criteria live, save drafts, submit for an INMA-style review (rpc.saveProgramme), and read
// the decision. Every row is a SAMPLE in the demo, not an actual ENEC endorsement.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Async, BenchmarkChips, Callout, EmptyState, Grid, Icon, Page, SimChip, StatTile } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { displayStatus, programmeCoverage } from './alignment';
import { ProgrammeCard, ProgrammeEditor, useUaWorld } from './ua';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function ProgrammesWorkspacePage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const org = useSession().identity.orgId ?? '';
  const w = useUaWorld();
  const q = useQuery(['programme_alignments'], () => repo.list('programme_alignments', { order: [['code', 'asc']] }));
  const [edit, setEdit] = useState<{ row: Row | null } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Page title={t('m10.routes.partner-university-programmes.title')} intro={t('m10.ua.ws.intro')} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/partner/university" className="btn-outline btn-sm"><Icon name="back" className="rtl:-scale-x-100" />{t('m10.ua.ws.back')}</L>
        <button type="button" className="btn-primary btn-sm" onClick={() => setEdit({ row: null })} data-testid="m10-ua-new"><Icon name="plus" size={14} />{t('m10.ua.ws.new')}</button></div>}>
      <BenchmarkChips feature="FS66" />
      <Callout tone="sim" title={t('m10.ua.sampleTitle')}>{t('m10.ua.sampleBody')}</Callout>
      <Async state={{ ...q, data: q.data && w.data ? { rows: q.data as Row[], w: w.data } : undefined, loading: q.loading || w.loading, error: q.error ?? w.error }}>
        {({ rows, w: world }) => {
          const st = (s: string) => rows.filter((p) => displayStatus(p, today) === s).length;
          const best = Math.max(0, ...rows.map((p) => programmeCoverage(p, world).best ?? 0));
          return (
            <div className="space-y-4">
              <Grid cols={4}>
                <StatTile label={t('m10.ua.ws.programmes')} value={f.num(rows.length)} sim />
                <StatTile label={t('m10.ua.status.endorsed')} value={f.num(st('endorsed'))} tone="ok" />
                <StatTile label={t('m10.ua.status.submitted')} value={f.num(st('submitted'))} tone="info" />
                <StatTile label={t('m10.ua.cov.best')} value={f.num(best)} sub={t('m10.ua.ws.bestSub')} />
              </Grid>
              {rows.length === 0 ? (
                <EmptyState title={t('m10.ua.ws.none')}>{t('m10.ua.ws.noneBody')}</EmptyState>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m10-ua-list">
                  {rows.map((p) => (
                    <ProgrammeCard key={p.id} p={p} w={world} action={
                      <div className="flex flex-wrap gap-2">
                        <L to={`/universities/programmes/${p.id}`} className="btn-outline btn-sm">{t('m10.ua.open')}</L>
                        {p.status !== 'submitted' && <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit({ row: p })} data-testid={`m10-ua-edit-${p.id}`}>{p.status === 'endorsed' ? t('m10.ua.ws.revise') : t('m10.ua.ws.edit')}</button>}
                      </div>
                    } />
                  ))}
                </div>
              )}
              <p className="text-[12px] text-ink-3"><SimChip label={t('m10.ua.sampleChip')} /> {t('m10.ua.ws.note')}</p>
              {edit && <ProgrammeEditor open onClose={() => setEdit(null)} row={edit.row} org={org} w={world} />}
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
