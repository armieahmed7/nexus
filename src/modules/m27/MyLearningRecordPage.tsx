// M27 /my/learning-record (F30): my learning record store. Every xAPI statement Kafa'a holds about me (course completions,
// refresher answers, opportunities, rotations, shadowing, JPMs, mentoring, knowledge assets), as a timeline with provenance,
// my learning mix, and the JSON lines download (own data right, rpc.exportStatements: audited, no ledger).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Icon, downloadText } from '../../ui';
import { useT, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { toJsonLines, SOURCES, type Source, type StatementRow } from './xapi';
import { EmittersTable, LearningMix, LrsMirrorNote, StatementDrawer, StatementTimeline, normRow } from './lrsUi';

export default function MyLearningRecordPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.person?.id ?? s.identity.personId;
  const q = useQuery('xapi_statements', async () => {
    if (!me) return [] as StatementRow[];
    const rows = (await repo.list('xapi_statements', { filter: { actor_person_id: me }, order: [['occurred_at', 'desc'], ['id', 'asc']] })) as unknown as StatementRow[];
    return rows.map(normRow);
  }, [me]);
  return (
    <Page title={t('m27.routes.my-learning-record.title')} eyebrow={t('m27.common.eyebrow')} intro={t('m27.my.intro')} actions={<ExportButton count={q.data?.length ?? 0} />} wide>
      <Callout tone="info" title={t('m27.my.privacyTitle')}>{t('m27.my.privacy')}</Callout>
      <Async state={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('m27.my.empty')}>{t('m27.my.emptyBody')} <L to="/learn">{t('m27.my.browse')}</L></EmptyState>}>
        {(rows) => <Body rows={rows} who={s.person ? (s.person.display_name ?? '') : ''} />}
      </Async>
      <Section title={t('m27.my.whatTitle')} description={t('m27.my.whatBody')}>
        <Card><EmittersTable /></Card>
      </Section>
      <LrsMirrorNote />
    </Page>
  );
}

function Body({ rows }: { rows: StatementRow[]; who: string }) {
  const t = useT();
  const f = useFormat();
  const [src, setSrc] = useState<'' | Source>('');
  const [open, setOpen] = useState<StatementRow | null>(null);
  const present = useMemo(() => SOURCES.filter((x) => rows.some((r) => r.source === x)), [rows]);
  const shown = src ? rows.filter((r) => r.source === src) : rows;
  return (
    <>
      <LearningMix rows={rows} />
      <Section title={t('m27.my.timelineTitle')} description={t('m27.my.timelineBody')}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t('m27.filter.source')} data-testid="m27-source-filter">
          <button type="button" className={src === '' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={src === ''} onClick={() => setSrc('')}>{t('m27.filter.all')} · {f.num(rows.length)}</button>
          {present.map((x) => (
            <button key={x} type="button" className={src === x ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={src === x} onClick={() => setSrc(x)}>
              {t(`m27.source.${x}`)} · {f.num(rows.filter((r) => r.source === x).length)}
            </button>
          ))}
        </div>
        <StatementTimeline rows={shown} onOpen={setOpen} />
      </Section>
      <StatementDrawer row={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ExportButton({ count }: { count: number }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await act(() => repo.rpc.exportStatements());
      if (r.ok && r.data) {
        const who = s.person?.id ?? 'me';
        downloadText(`kafaa-xapi-${who}.jsonl`, toJsonLines(r.data.rows.map(normRow)), 'application/x-ndjson;charset=utf-8');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn-primary" onClick={run} disabled={busy || count === 0} data-testid="m27-export">
      <Icon name="download" size={14} /> {t('m27.my.export')}
    </button>
  );
}
