// M07 /observer: aggregate reports that ENEC has approved for release to the observer's organisation. Row-level rules mean an
// observer only ever receives released reports whose released_to_org_ids contains its organisation; auditors see every report.
import { useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Card, Async, EmptyState, Callout, StatusPill } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { ReportBody } from './WorkforcePage';
import { ExportButton, useWatermarkedExport } from './shared';

export default function ObserverPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const exportCsv = useWatermarkedExport();
  const reports = useQuery('observer_reports', () => repo.list('observer_reports', { order: [['approved_at', 'desc']] }));
  const orgs = useQuery('organisations', () => repo.list('organisations', { filter: { kind: 'observer_org' } }));
  const orgName = (id: string) => pick(orgs.data?.find((o) => o.id === id), 'name') || id;
  const auditor = s.hasRole('auditor');
  return (
    <Page title={t('m07.routes.observer.title')} intro={t('m07.obs.intro')}>
      <Callout tone="info" title={t('m07.obs.notRegTitle')}>{t('m07.obs.notRegBody')}</Callout>
      {auditor && <Callout tone="sim">{t('m07.obs.auditorNote')}</Callout>}
      <Async state={reports} empty={<EmptyState title={t('m07.obs.none')}>{t('m07.obs.noneBody')}</EmptyState>}>
        {(rows) => (
          <div className="space-y-4" data-testid="m07-observer-reports">
            {rows.map((r) => {
              const tiles = ((r.body ?? {}) as { tiles?: { k: string; v: string; src: string }[] }).tiles ?? [];
              return (
                <Card
                  key={r.id}
                  title={pick(r, 'title')}
                  eyebrow={r.period}
                  actions={
                    <span className="flex items-center gap-2">
                      <StatusPill status={r.status === 'pending_approval' ? 'pending' : r.status}>{t(`m07.releases.st.${r.status}`)}</StatusPill>
                      <ExportButton onClick={() => exportCsv(`observer-report-${r.id}`, ['report', 'period', 'indicator', 'value', 'source'], tiles.map((x) => [pick(r, 'title'), r.period, x.k, x.v, x.src]))} />
                    </span>
                  }
                  footer={r.approved_at ? t('m07.obs.approvedOn', { date: f.date(r.approved_at) }) : undefined}
                >
                  <ReportBody r={r} orgName={auditor ? orgName : undefined} />
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </Page>
  );
}
