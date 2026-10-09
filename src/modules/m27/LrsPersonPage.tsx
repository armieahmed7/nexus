// M27 /training/lrs/people/:personId (F30): one person's learning timeline for an instructor or manager in scope (or an auditor).
// rpc.queryStatements refuses people outside scope (not_in_scope, audited) and audits every read it allows.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Async, EmptyState, Callout, StatusPill } from '../../ui';
import { useT, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import type { StatementRow } from './xapi';
import type { StatementPage } from './backend/rpc';
import { LearningMix, LrsMirrorNote, StatementDrawer, StatementTimeline, normRow, usePersonName } from './lrsUi';

type Loaded = { ok: true; page: StatementPage } | { ok: false; code: string; message: string };

export default function LrsPersonPage() {
  const t = useT();
  const repo = useRepo();
  const { personId = '' } = useParams();
  const q = useQuery('xapi_statements', async (): Promise<Loaded> => {
    const r = await repo.rpc.queryStatements({ actor: personId, limit: 1000 });
    if (!r.ok || !r.data) return { ok: false, code: r.code, message: r.message };
    return { ok: true, page: { ...r.data, rows: r.data.rows.map(normRow) } };
  }, [personId]);
  return (
    <Page title={t('m27.routes.training-lrs-person.title')} eyebrow={t('m27.common.eyebrow')} intro={t('m27.person.intro')} wide>
      <Async state={q}>
        {(d) => (d.ok ? <Body page={d.page} personId={personId} /> : (
          <Callout tone="bad" title={d.code === 'not_in_scope' ? t('m27.person.outTitle') : t('m27.person.errorTitle')}>
            <span data-testid="m27-person-refused">{d.code === 'not_in_scope' ? t('m27.person.out') : d.message}</span> <L to="/training/lrs">{t('m27.person.back')}</L>
          </Callout>
        ))}
      </Async>
      <LrsMirrorNote />
    </Page>
  );
}

function Body({ page, personId }: { page: StatementPage; personId: string }) {
  const t = useT();
  const who = usePersonName(page.people);
  const [open, setOpen] = useState<StatementRow | null>(null);
  const p = page.people.find((x) => x.id === personId);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="m27-person">
        <h2 className="text-[18px] font-semibold">{p ? who(personId) : personId}</h2>
        <StatusPill tone="neutral"><bdi dir="ltr">{personId}</bdi></StatusPill>
        <StatusPill tone="info">{t('m27.person.audited')}</StatusPill>
      </div>
      {page.rows.length === 0 ? (
        <EmptyState title={t('m27.person.empty')} />
      ) : (
        <>
          <LearningMix rows={page.rows} />
          <Section title={t('m27.person.timeline')}>
            <StatementTimeline rows={page.rows} onOpen={setOpen} />
          </Section>
        </>
      )}
      <StatementDrawer row={open} who={who(personId)} onClose={() => setOpen(null)} />
    </>
  );
}
