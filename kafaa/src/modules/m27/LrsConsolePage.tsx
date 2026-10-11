// M27 /training/lrs/console (F30): the admin test console for rpc.storeStatement. Paste or pick an xAPI 2.0 statement about
// yourself, check it against the Kafa'a profile in the browser (the server re-checks people and secure content), and store it
// (append-only; refused with a schema error when invalid). Platform admins (integrations A) only.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Callout, ConfirmDialog, StatusPill, Async, EmptyState } from '../../ui';
import { useT, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { ACTIVITY_TYPE_IRI, EXT, VERB_IRI, XAPI_HOME, XAPI_VERSION, activityIri, validateStatement, isoTs, type SchemaError, type StatementRow } from './xapi';
import { LrsMirrorNote, ResultBits, VerbChip, normRow, useObjectName } from './lrsUi';

const TEMPLATES = ['valid', 'mbox', 'verb', 'response', 'item', 'future'] as const;
type Template = (typeof TEMPLATES)[number];

function template(kind: Template, me: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    actor: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: me } },
    verb: { id: VERB_IRI.attended, display: { 'en-US': 'attended', 'ar-AE': 'حضر' } },
    object: { objectType: 'Activity', id: activityIri('activity', 'lrs-console-demo'), definition: { name: { 'en-US': 'LRS console test session', 'ar-AE': 'جلسة اختبار لوحة سجلات التعلم' } } },
    result: { completion: true, duration: 'PT15M' },
    context: { platform: "Kafa'a", language: 'en', extensions: { [`${EXT}note`]: 'admin test console' } },
    timestamp: isoTs(new Date()),
    version: XAPI_VERSION,
  };
  if (kind === 'mbox') base.actor = { objectType: 'Agent', mbox: 'mailto:someone@example.com' };
  if (kind === 'verb') base.verb = { id: 'http://adlnet.gov/expapi/verbs/liked' };
  if (kind === 'response') base.result = { success: true, response: 'B' };
  if (kind === 'item') base.object = { objectType: 'Activity', id: activityIri('item', 'exam-question'), definition: { type: ACTIVITY_TYPE_IRI.refresher } };
  if (kind === 'future') base.timestamp = '2031-01-01T00:00:00Z';
  return base;
}

export default function LrsConsolePage() {
  const t = useT();
  const s = useSession();
  const me = s.person?.id ?? s.identity.personId ?? '';
  return (
    <Page title={t('m27.routes.training-lrs-console.title')} eyebrow={t('m27.common.eyebrow')} intro={t('m27.con.intro')} wide>
      <Callout tone="sim" title={t('m27.con.warnTitle')}>{t('m27.con.warn')}</Callout>
      {me ? <Console me={me} /> : <EmptyState title={t('m27.con.noPerson')} />}
      <LrsMirrorNote />
    </Page>
  );
}

function Console({ me }: { me: string }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const [kind, setKind] = useState<Template>('valid');
  const [text, setText] = useState(() => JSON.stringify(template('valid', me), null, 2));
  const [confirm, setConfirm] = useState(false);
  const [stored, setStored] = useState<string | null>(null);
  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(text) as unknown, error: null };
    } catch (e) {
      return { value: undefined, error: e instanceof Error ? e.message : String(e) };
    }
  }, [text]);
  const check = useMemo(() => (parsed.error ? null : validateStatement(parsed.value, { isPerson: () => true, secureItemIds: [], now: new Date() })), [parsed]);
  const pickTemplate = (k: Template) => {
    setKind(k);
    setText(JSON.stringify(template(k, me), null, 2));
    setStored(null);
  };
  const store = async () => {
    const r = await act(() => repo.rpc.storeStatement(parsed.value));
    if (r.ok && r.data) setStored(r.data.id);
  };
  return (
    <>
      <Section title={t('m27.con.templates')}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m27.con.templates')} data-testid="m27-templates">
          {TEMPLATES.map((k) => (
            <button key={k} type="button" className={kind === k ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={kind === k} onClick={() => pickTemplate(k)}>{t(`m27.con.tpl.${k}`)}</button>
          ))}
        </div>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={t('m27.con.editor')}>
          <label className="block">
            <span className="sr-only">{t('m27.con.editor')}</span>
            <textarea dir="ltr" className="input min-h-[360px] font-mono text-[12px]" value={text} onChange={(e) => { setText(e.target.value); setStored(null); }} spellCheck={false} data-testid="m27-console-json" />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!!parsed.error} onClick={() => setConfirm(true)} data-testid="m27-store">{t('m27.con.store')}</button>
            {stored && <L to={`/training/lrs/statements/${stored}`} className="text-[13px]" data-testid="m27-stored">{t('m27.con.storedLink')}</L>}
          </div>
        </Card>
        <Card title={t('m27.con.checkTitle')}>
          <div aria-live="polite" data-testid="m27-check">
            {parsed.error ? (
              <Callout tone="bad" title={t('m27.con.parseError')}><bdi dir="ltr" className="font-mono text-[12px]">{parsed.error}</bdi></Callout>
            ) : check && check.errors.length === 0 ? (
              <Callout tone="ok" title={t('m27.con.valid')}>{t('m27.con.validBody')}</Callout>
            ) : (
              <ErrorsList errors={check?.errors ?? []} />
            )}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m27.con.serverNote')}</p>
        </Card>
      </div>
      <MyConsoleStatements me={me} />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m27.con.confirmTitle')}
        consequence={t('m27.con.confirmBody')}
        actingAs={t('m27.con.actingAs')}
        confirmLabel={t('m27.con.store')}
        onConfirm={async () => { await store(); setConfirm(false); }}
      />
    </>
  );
}

function ErrorsList({ errors }: { errors: SchemaError[] }) {
  const t = useT();
  return (
    <div>
      <StatusPill tone="bad">{t('m27.con.errors', { n: errors.length })}</StatusPill>
      <ul className="mt-2 space-y-1.5 text-[13px]">
        {errors.map((e, i) => (
          <li key={`${e.path}-${e.code}-${i}`} className="flex flex-wrap items-baseline gap-2">
            <bdi dir="ltr" className="font-mono text-[12px] text-ink-3">{e.path}</bdi>
            <span>{t(`m27.err.${e.code}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MyConsoleStatements({ me }: { me: string }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const name = useObjectName();
  const q = useQuery('xapi_statements', async () => ((await repo.list('xapi_statements', { filter: { actor_person_id: me, source: 'console' }, order: [['stored_at', 'desc']] })) as unknown as StatementRow[]).map(normRow), [me]);
  return (
    <Section title={t('m27.con.mine')} description={t('m27.con.mineBody')}>
      <Async state={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('m27.con.mineEmpty')} />}>
        {(rows) => (
          <ul className="divide-y divide-line rounded-card border border-line" data-testid="m27-console-mine">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-[13px]">
                <span className="text-ink-3">{f.dateTime(r.stored_at)}</span>
                <VerbChip verb={r.verb} />
                <span className="font-semibold">{name(r)}</span>
                <ResultBits result={r.result} />
                <L to={`/training/lrs/statements/${r.id}`} className="ms-auto">{t('m27.detail.open')}</L>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Section>
  );
}
