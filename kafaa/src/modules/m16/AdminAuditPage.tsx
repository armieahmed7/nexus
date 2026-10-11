// M16 · /admin/audit: search the append-only, hash-chained audit log (admin and auditor read only). There is no edit or
// delete control anywhere: the database trigger rejects UPDATE and DELETE, and "Verify chain" recomputes every hash
// (rpc.auditVerify). Each entry shows whether it also reached the NEXUS evidence ledger.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useFormat, useLang, useT } from '../../i18n';
import { ROLE_LABELS, type PlatformRole } from '../../auth/policy';
import { Async, Callout, DataTable, Drawer, FilterBar, Icon, KeyValue, Page, StatusPill, TextField, useFilters, type Column } from '../../ui';
import type { AuditEventsRow } from '../../data/types';
import { Metric } from './parts';

export default function AdminAuditPage() {
  const t = useT();
  const lang = useLang();
  // Kafa'a platform roles have labels; other actor roles (NEXUS role titles, "system") are shown as recorded.
  const roleName = (r: string) => ROLE_LABELS[r as PlatformRole]?.[lang] ?? r;
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery('audit_events', () => repo.list('audit_events', { order: [['seq', 'desc']] }));
  const [flt, setFlt] = useFilters({ q: '', outcome: '', table: '', role: '', ledger: '', from: '', to: '' }, true);
  const [open, setOpen] = useState<AuditEventsRow | null>(null);
  const [verify, setVerify] = useState<{ ok: boolean; message: string; entries?: number } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const all = q.data ?? [];
  const tables = useMemo(() => [...new Set(all.map((a) => a.entity_table).filter(Boolean) as string[])].sort(), [all]);
  const roles = useMemo(() => [...new Set(all.map((a) => a.actor_role).filter(Boolean) as string[])].sort(), [all]);
  const rows = all.filter(
    (a) =>
      (!flt.outcome || a.outcome === flt.outcome) &&
      (!flt.table || a.entity_table === flt.table) &&
      (!flt.role || a.actor_role === flt.role) &&
      (!flt.ledger || a.ledger_status === flt.ledger) &&
      (!flt.from || a.ts.slice(0, 10) >= flt.from) &&
      (!flt.to || a.ts.slice(0, 10) <= flt.to) &&
      (!flt.q || `${a.action} ${a.entity_id ?? ''} ${a.actor_person_id ?? ''} ${a.reason ?? ''}`.toLowerCase().includes(flt.q.toLowerCase())),
  );
  const runVerify = async () => {
    setVerifying(true);
    try {
      const r = await repo.rpc.auditVerify();
      setVerify({ ok: r.ok, message: r.message, entries: r.data?.entries });
    } finally {
      setVerifying(false);
    }
  };
  const cols: Column<AuditEventsRow>[] = [
    { key: 'seq', header: '#', value: (a) => a.seq, sortable: true, align: 'end' },
    { key: 'ts', header: t('m16.audit.when'), value: (a) => a.ts, sortable: true, render: (a) => f.dateTime(a.ts) },
    { key: 'action', header: t('m16.audit.action'), value: (a) => a.action, render: (a) => <code className="ltr text-[12px]">{a.action}</code> },
    { key: 'entity', header: t('m16.audit.entity'), value: (a) => `${a.entity_table ?? ''}:${a.entity_id ?? ''}`, render: (a) => <span className="ltr text-[12px]">{a.entity_table ?? '—'}{a.entity_id ? ` · ${a.entity_id}` : ''}</span> },
    { key: 'actor', header: t('m16.audit.actor'), value: (a) => `${a.actor_person_id ?? 'anonymous'} ${a.actor_role ?? ''}`, render: (a) => <span className="text-[12.5px]"><span className="ltr">{a.actor_person_id ?? t('m16.audit.anonymous')}</span>{a.actor_role && <span className="text-ink-3"> · {roleName(a.actor_role)}</span>}</span> },
    { key: 'outcome', header: t('m16.audit.outcome'), value: (a) => a.outcome, render: (a) => <StatusPill status={a.outcome === 'ok' ? 'ok' : a.outcome === 'refused' ? 'declined' : 'error'}>{t(`m16.audit.out.${a.outcome}`)}</StatusPill> },
    { key: 'ledger', header: t('m16.audit.ledger'), value: (a) => a.ledger_status, render: (a) => <StatusPill tone={a.ledger_status === 'written' ? 'ok' : a.ledger_status === 'skipped' ? 'sim' : 'neutral'}>{t(`m16.audit.ls.${a.ledger_status}`)}</StatusPill> },
  ];
  return (
    <Page
      title={t('m16.routes.admin-audit.title')}
      intro={t('m16.audit.intro')}
      actions={
        <button className="btn-outline" onClick={runVerify} disabled={verifying} data-testid="m16-audit-verify">
          <Icon name="shield" />
          {verifying ? t('common.working') : t('m16.audit.verify')}
        </button>
      }
      wide
    >
      {verify && (
        <Callout tone={verify.ok ? 'ok' : 'bad'} title={verify.ok ? t('m16.audit.chainOk', { n: f.num(verify.entries ?? 0) }) : t('m16.audit.chainBad')}>
          {verify.message}
        </Callout>
      )}
      <Callout tone="info">{t('m16.audit.appendOnly')}</Callout>
      <Async state={q}>
        {(d) => (
          <div className="grid gap-3 sm:grid-cols-4" data-testid="m16-audit-metrics">
            <Metric label={t('m16.audit.mEntries')} value={f.num(d.length)} />
            <Metric label={t('m16.audit.mRefused')} value={f.num(d.filter((a) => a.outcome === 'refused').length)} tone="sim" />
            <Metric label={t('m16.audit.mLedger')} value={f.num(d.filter((a) => a.ledger_status === 'written').length)} tone="ok" />
            <Metric label={t('m16.audit.mLast')} value={d[0] ? f.date(d[0].ts) : '—'} />
          </div>
        )}
      </Async>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'outcome', label: t('m16.audit.outcome'), options: ['ok', 'refused', 'error'].map((x) => ({ value: x, label: t(`m16.audit.out.${x}`) })) },
          { key: 'table', label: t('m16.audit.entity'), options: tables.map((x) => ({ value: x, label: x })) },
          { key: 'role', label: t('m16.audit.role'), options: roles.map((x) => ({ value: x, label: roleName(x) })) },
          { key: 'ledger', label: t('m16.audit.ledger'), options: ['written', 'skipped', 'not_applicable'].map((x) => ({ value: x, label: t(`m16.audit.ls.${x}`) })) },
        ]}
        extra={
          <div className="flex items-end gap-2">
            <TextField label={t('m16.audit.from')} value={flt.from} onChange={(v) => setFlt({ from: v })} name="from" hint="YYYY-MM-DD" />
            <TextField label={t('m16.audit.to')} value={flt.to} onChange={(v) => setFlt({ to: v })} name="to" hint="YYYY-MM-DD" />
          </div>
        }
      />
      <Async state={q}>
        {() => (
          <div data-testid="m16-audit-table">
            <DataTable rows={rows} rowKey={(a) => a.id} columns={cols} csvName="kafaa-audit" onRowClick={setOpen} pageSize={50} initialSort={{ key: 'seq', dir: 'desc' }} />
          </div>
        )}
      </Async>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? t('m16.audit.entry', { n: open.seq }) : ''}>
        {open && (
          <div className="space-y-3" data-testid="m16-audit-detail">
            <KeyValue
              items={[
                [t('m16.audit.when'), f.dateTime(open.ts)],
                [t('m16.audit.action'), <code key="a" className="ltr">{open.action}</code>],
                [t('m16.audit.entity'), <span key="e" className="ltr">{open.entity_table ?? '—'} {open.entity_id ?? ''}</span>],
                [t('m16.audit.actor'), <span key="p" className="ltr">{open.actor_person_id ?? t('m16.audit.anonymous')}</span>],
                [t('m16.audit.role'), open.actor_role ? roleName(open.actor_role) : '—'],
                [t('m16.audit.outcome'), t(`m16.audit.out.${open.outcome}`)],
                [t('m16.audit.reason'), open.reason ?? '—'],
                [t('m16.audit.ledger'), `${t(`m16.audit.ls.${open.ledger_status}`)}${open.ledger_seq ? ` · #${open.ledger_seq}` : ''}`],
                [t('m16.audit.request'), <code key="r" className="ltr text-[11.5px]">{open.request_id ?? '—'}</code>],
              ]}
            />
            <div className="rounded-card border border-line p-3">
              <div className="caps mb-1">{t('m16.audit.hashes')}</div>
              <dl className="grid gap-1 text-[11.5px]">
                {(['before_hash', 'after_hash', 'prev_hash', 'hash'] as const).map((k) => (
                  <div key={k}>
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="ltr break-all font-mono">{open[k] ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-[12px] text-ink-3">{t('m16.audit.noEdit')}</p>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
