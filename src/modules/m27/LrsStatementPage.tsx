// M27 /training/lrs/statements/:statementId (F30): one stored statement with its provenance and the xAPI 2.0 JSON
// (permalink from the explorer, the person timeline and My learning record). Readable by the person, scope and auditors.
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout } from '../../ui';
import { useT, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { LrsMirrorNote, StatementDetail, normRow, usePersonName } from './lrsUi';
import type { StatementPage } from './backend/rpc';

export default function LrsStatementPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const { statementId = '' } = useParams();
  const q = useQuery('xapi_statements', async (): Promise<StatementPage | { error: string }> => {
    const r = await repo.rpc.queryStatements({ id: statementId, limit: 1 });
    if (!r.ok || !r.data) return { error: r.message };
    return { ...r.data, rows: r.data.rows.map(normRow) };
  }, [statementId]);
  return (
    <Page title={t('m27.routes.training-lrs-statement.title')} eyebrow={t('m27.common.eyebrow')} intro={t('m27.stmt.intro')} wide>
      <Async state={q}>
        {(d) => ('error' in d ? <Callout tone="bad" title={t('m27.stmt.errorTitle')}>{d.error}</Callout> : d.rows.length === 0 ? (
          <EmptyState title={t('m27.stmt.notFound')}>{t('m27.stmt.notFoundBody')}</EmptyState>
        ) : (
          <Body page={d} />
        ))}
      </Async>
      <p className="text-[13px]">
        {s.can('lrs', ['Scope', 'R', 'Agg']) ? <L to="/training/lrs">{t('m27.stmt.backExplorer')}</L> : <L to="/my/learning-record">{t('m27.stmt.backMine')}</L>}
      </p>
      <LrsMirrorNote />
    </Page>
  );
}

function Body({ page }: { page: StatementPage }) {
  const who = usePersonName(page.people);
  const row = page.rows[0];
  return <Card><StatementDetail row={row} who={who(row.actor_person_id)} /></Card>;
}
