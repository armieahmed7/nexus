// M08 · ECP referral log (ECP officer only). Metadata only: channel, category, anonymous flag, status, priority,
// closure outcome and the ECP system reference. The concern itself, and anything identifying the person raising it,
// stays in the ECP system and never enters Kafa'a. Logging and triage go through RPCs (audited; triage on the ledger).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, useT } from '../../i18n';
import { Async, BarChart, Callout, Card, CheckboxField, DataTable, Donut, Drawer, FilterBar, Icon, KeyValue, Modal, Page, RadioGroup, SelectField, StatusPill, TextField, Timeline, required, useFilters, useForm, type Column } from '../../ui';
import type { ConcernCasesRow } from '../../data/types';
import { allowedConcernNext, CONCERN_OUTCOMES, triageDue, triageOverdue } from '../../domain/g5rules';
import { todayIso } from '../../domain/rules';
import { GatedConfirm, Metric } from '../m16/parts';

const CHANNELS = ['ecp_office', 'intranet', 'phone', 'email', 'unit_rep', 'r2p_referral'];
const CATEGORIES = ['nuclear_safety', 'quality', 'hird', 'other'];
const PRIORITIES = ['routine', 'priority', 'urgent'];

export default function AdminEcpPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const cases = useQuery('concern_cases', () => repo.list('concern_cases', { order: [['received_on', 'desc']] }));
  const [flt, setFlt] = useFilters({ status: '', category: '', channel: '', anon: '' }, true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const rows = (cases.data ?? []).filter((c) => (!flt.status || (flt.status === 'open' ? c.status !== 'closed' : c.status === flt.status)) && (!flt.category || c.category === flt.category) && (!flt.channel || c.channel === flt.channel) && (!flt.anon || String(c.anonymous) === flt.anon));
  const open = (cases.data ?? []).find((c) => c.id === openId) ?? null;
  const today = todayIso();
  const stats = useMemo(() => {
    const all = cases.data ?? [];
    const openRows = all.filter((c) => c.status !== 'closed');
    return {
      open: openRows.length,
      awaiting: all.filter((c) => c.status === 'received').length,
      overdue: all.filter((c) => triageOverdue(c, today)).length,
      anonymous: all.length ? Math.round((all.filter((c) => c.anonymous).length * 100) / all.length) : 0,
      byCat: CATEGORIES.map((k) => ({ label: t(`m08.ecp.cat.${k}`), value: all.filter((c) => c.category === k).length })),
      byChan: CHANNELS.map((k) => ({ label: t(`m08.ecp.chan.${k}`), value: all.filter((c) => c.channel === k).length })),
    };
  }, [cases.data, t, today]);

  const cols: Column<ConcernCasesRow>[] = [
    { key: 'ref', header: t('m08.ecp.ref'), value: (r) => r.ref_no, sortable: true, render: (r) => <button className="num font-semibold text-eyebrow hover:underline" onClick={() => setOpenId(r.id)}>{r.ref_no}</button> },
    { key: 'received', header: t('m08.ecp.received'), value: (r) => r.received_on, sortable: true, render: (r) => f.date(r.received_on) },
    { key: 'channel', header: t('m08.ecp.channel'), value: (r) => t(`m08.ecp.chan.${r.channel}`) },
    { key: 'category', header: t('m08.ecp.category'), value: (r) => t(`m08.ecp.cat.${r.category}`) },
    { key: 'anon', header: t('m08.ecp.anonymous'), value: (r) => (r.anonymous ? t('common.yes') : t('common.no')), render: (r) => (r.anonymous ? <StatusPill tone="info">{t('m08.ecp.anon')}</StatusPill> : <span className="text-ink-3">{t('m08.ecp.named')}</span>) },
    { key: 'priority', header: t('m08.ecp.priority'), value: (r) => r.priority, render: (r) => <StatusPill tone={r.priority === 'urgent' ? 'bad' : r.priority === 'priority' ? 'sim' : 'neutral'}>{t(`m08.ecp.prio.${r.priority}`)}</StatusPill> },
    { key: 'status', header: t('m08.ecp.status'), value: (r) => r.status, sortable: true, render: (r) => <span className="inline-flex flex-wrap gap-1"><StatusPill tone={r.status === 'closed' ? 'neutral' : r.status === 'received' ? 'info' : 'sim'}>{t(`m08.ecp.st.${r.status}`)}</StatusPill>{triageOverdue(r, today) && <StatusPill tone="bad">{t('m08.ecp.overdue')}</StatusPill>}</span> },
    { key: 'sysref', header: t('m08.ecp.sysRef'), value: (r) => r.ecp_system_ref, render: (r) => <code className="ltr text-[12px]">{r.ecp_system_ref}</code> },
  ];

  return (
    <Page title={t('m08.routes.admin-ecp.title')} intro={t('m08.ecp.intro')} actions={<button className="btn-primary" onClick={() => setLogging(true)} data-testid="m08-ecp-log"><Icon name="plus" />{t('m08.ecp.log')}</button>}>
      <Callout tone="info" title={t('m08.ecp.privacyTitle')}>{t('m08.ecp.privacyBody')}</Callout>
      <Async state={cases}>
        {() => (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label={t('m08.ecp.mOpen')} value={f.num(stats.open)} />
              <Metric label={t('m08.ecp.mAwaiting')} value={f.num(stats.awaiting)} tone={stats.awaiting ? 'info' : undefined} />
              <Metric label={t('m08.ecp.mOverdue')} value={f.num(stats.overdue)} tone={stats.overdue ? 'bad' : 'ok'} sub={t('m08.ecp.targetNote')} />
              <Metric label={t('m08.ecp.mAnon')} value={f.pct(stats.anonymous, 0)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card title={t('m08.ecp.byCategory')}>
                <Donut title={t('m08.ecp.byCategory')} data={stats.byCat} center={f.num((cases.data ?? []).length)} />
              </Card>
              <Card title={t('m08.ecp.byChannel')}>
                <BarChart title={t('m08.ecp.byChannel')} data={stats.byChan} />
              </Card>
            </div>
            <FilterBar
              value={flt}
              onChange={setFlt}
              fields={[
                { key: 'status', label: t('m08.ecp.status'), options: [{ value: 'open', label: t('m08.ecp.allOpen') }, ...['received', 'triaged', 'investigating', 'referred', 'closed'].map((x) => ({ value: x, label: t(`m08.ecp.st.${x}`) }))] },
                { key: 'category', label: t('m08.ecp.category'), options: CATEGORIES.map((x) => ({ value: x, label: t(`m08.ecp.cat.${x}`) })) },
                { key: 'channel', label: t('m08.ecp.channel'), options: CHANNELS.map((x) => ({ value: x, label: t(`m08.ecp.chan.${x}`) })) },
                { key: 'anon', label: t('m08.ecp.anonymous'), options: [{ value: 'true', label: t('m08.ecp.anon') }, { value: 'false', label: t('m08.ecp.named') }] },
              ]}
            />
            <div data-testid="m08-ecp-table">
              <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} csvName="ecp-referrals-metadata" initialSort={{ key: 'received', dir: 'desc' }} />
            </div>
          </>
        )}
      </Async>
      <TriageDrawer row={open} onClose={() => setOpenId(null)} />
      <LogReferral open={logging} onClose={() => setLogging(false)} />
    </Page>
  );
}

function TriageDrawer({ row, onClose }: { row: ConcernCasesRow | null; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('routine');
  const [outcome, setOutcome] = useState('');
  const [confirm, setConfirm] = useState(false);
  const next = row ? allowedConcernNext(row.status).filter((x) => x !== row.status) : [];
  const reset = () => {
    setStatus('');
    setOutcome('');
    setPriority(row?.priority ?? 'routine');
  };
  return (
    <Drawer open={!!row} onClose={() => { reset(); onClose(); }} title={row ? row.ref_no : ''}>
      {row && (
        <div className="space-y-4" data-testid="m08-ecp-drawer">
          <KeyValue
            items={[
              [t('m08.ecp.received'), f.date(row.received_on, 'long')],
              [t('m08.ecp.triageBy'), row.status === 'received' ? <span className={triageOverdue(row) ? 'text-bad' : ''}>{f.date(triageDue(row.received_on))}</span> : row.triaged_at ? f.dateTime(row.triaged_at) : '—'],
              [t('m08.ecp.channel'), t(`m08.ecp.chan.${row.channel}`)],
              [t('m08.ecp.category'), t(`m08.ecp.cat.${row.category}`)],
              [t('m08.ecp.anonymous'), row.anonymous ? t('m08.ecp.anon') : t('m08.ecp.named')],
              [t('m08.ecp.sysRef'), <code key="r" className="ltr">{row.ecp_system_ref}</code>],
              [t('m08.ecp.status'), t(`m08.ecp.st.${row.status}`)],
              ...(row.status === 'closed' ? ([[t('m08.ecp.outcome'), row.outcome ? t(`m08.ecp.out.${row.outcome}`) : '—'], [t('m08.ecp.closedOn'), f.date(row.closed_on)]] as [string, string][]) : []),
            ]}
          />
          <Timeline
            items={[
              { id: 'r', when: f.date(row.received_on), title: t('m08.ecp.st.received'), tone: 'info' },
              ...(row.triaged_at ? [{ id: 't', when: f.dateTime(row.triaged_at), title: t('m08.ecp.st.triaged'), tone: 'sim' as const }] : []),
              ...(row.status !== 'received' && row.status !== 'triaged' ? [{ id: 's', when: '—', title: t(`m08.ecp.st.${row.status}`), tone: (row.status === 'closed' ? 'ok' : 'sim') as 'ok' | 'sim' }] : []),
            ]}
          />
          {row.status === 'closed' ? (
            <Callout tone="info">{t('m08.ecp.closedNote')}</Callout>
          ) : (
            <Card title={t('m08.ecp.triageTitle')}>
              <div className="space-y-3">
                <RadioGroup label={t('m08.ecp.nextStatus')} name="next" value={status} onChange={setStatus} options={next.map((x) => ({ value: x, label: t(`m08.ecp.st.${x}`) }))} />
                <SelectField label={t('m08.ecp.priority')} name="priority" value={priority || row.priority} onChange={setPriority} options={PRIORITIES.map((x) => ({ value: x, label: t(`m08.ecp.prio.${x}`) }))} />
                {status === 'closed' && <SelectField label={t('m08.ecp.outcome')} name="outcome" required value={outcome} onChange={setOutcome} options={CONCERN_OUTCOMES.map((x) => ({ value: x, label: t(`m08.ecp.out.${x}`) }))} />}
                <button className="btn-primary" disabled={!status || (status === 'closed' && !outcome)} onClick={() => setConfirm(true)} data-testid="m08-ecp-triage">
                  {t('m08.ecp.record')}
                </button>
              </div>
            </Card>
          )}
          <GatedConfirm
            open={confirm}
            onClose={() => setConfirm(false)}
            title={t('m08.ecp.confirmTitle', { ref: row.ref_no })}
            consequence={t('m08.ecp.confirmBody', { from: t(`m08.ecp.st.${row.status}`), to: status ? t(`m08.ecp.st.${status}`) : '' })}
            actingAs={t('m08.ecp.actingAs')}
            onConfirm={async () => {
              const r = await run(() => repo.rpc.triageConcernV2(row.id, status, priority || row.priority, status === 'closed' ? outcome : null));
              if (r.ok) reset();
            }}
          />
        </div>
      )}
    </Drawer>
  );
}

function LogReferral({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [anonymous, setAnonymous] = useState(true);
  const form = useForm({ received_on: todayIso(), channel: '', category: '', priority: 'routine', ecp_system_ref: '' }, { received_on: [required()], channel: [required()], category: [required()], ecp_system_ref: [required()] });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('m08.ecp.log')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting}
            data-testid="m08-ecp-log-save"
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.rpc.logConcernReferral({ ...v, anonymous }));
              if (r.ok) {
                form.reset();
                setAnonymous(true);
                onClose();
              }
            })}
          >
            {t('m08.ecp.logSave')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Callout tone="sim" title={t('m08.ecp.noTextTitle')}>{t('m08.ecp.noTextBody')}</Callout>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m08.ecp.received')} type="date" required {...form.field('received_on')} />
          <SelectField label={t('m08.ecp.channel')} required options={CHANNELS.map((x) => ({ value: x, label: t(`m08.ecp.chan.${x}`) }))} {...form.field('channel')} />
          <SelectField label={t('m08.ecp.category')} required options={CATEGORIES.map((x) => ({ value: x, label: t(`m08.ecp.cat.${x}`) }))} {...form.field('category')} />
          <SelectField label={t('m08.ecp.priority')} options={PRIORITIES.map((x) => ({ value: x, label: t(`m08.ecp.prio.${x}`) }))} {...form.field('priority')} />
        </div>
        <TextField label={t('m08.ecp.sysRef')} required {...form.field('ecp_system_ref')} hint={t('m08.ecp.sysRefHint')} />
        <CheckboxField label={t('m08.ecp.anonLabel')} hint={t('m08.ecp.anonHint')} checked={anonymous} onChange={setAnonymous} />
      </div>
    </Modal>
  );
}
