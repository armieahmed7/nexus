// FS69 /training/equivalency/prearrival: ENEC evaluators (equivalency A) and auditors (R) see contractors' pre-arrival shares before
// mobilisation (no items here), open one to run the pre-check from the shared items, and record a share on a contractor's behalf with
// the reference of the contractor's signed consent (contractors have no Kafa'a sign-in on the live backend; the FS29 precedent).
import { useMemo, useState } from 'react';
import { Page, Card, Async, EmptyState, Drawer, ConfirmDialog, DataTable, Grid, StatTile, SelectField, BenchmarkChips, Callout } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, useNav, L } from '../../i18n';
import { useSession } from '../../auth/session';
import type { PrearrivalRow } from './backend/rpc';
import { GuidanceNote, PaStatus, ShareFormFields, SummaryLine, emptyShare, useBi, type ShareForm } from './fs75ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function PrearrivalQueuePage() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const bi = useBi();
  const nav = useNav();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canWrite = s.roles.includes('instructor') || s.roles.includes('training_manager');
  const list = useQuery(['prearrival_shares', 'record_shares'], () => repo.rpc.prearrivalShares(), []);
  const people = useQuery(['people'], () => (canWrite ? repo.rpc.prearrivalContractors() : Promise.resolve([])), [canWrite]);
  const stds = useQuery(['qual_standards'], async () => ((await repo.list('qual_standards', { order: [['code', 'asc']] })) as Row[]).filter((x) => x.status === 'current' && !x.security_restricted), []);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState('');
  const items = useQuery(['person_skills', 'badges'], () => (person ? repo.rpc.prearrivalItems(person) : Promise.resolve({ allowed: false, person: null, items: [] })), [person]);
  const [form, setForm] = useState<ShareForm>(emptyShare());
  const [confirm, setConfirm] = useState(false);
  const rows = list.data ?? [];
  const tiles = useMemo(() => ({
    active: rows.filter((r) => r.status === 'active').length, waiting: rows.filter((r) => r.status === 'active' && !r.check_summary).length,
    soon: rows.filter((r) => r.status === 'active' && Date.parse(`${r.mobilise_on}T00:00:00Z`) - Date.now() < 21 * 86_400_000).length, closed: rows.filter((r) => r.status !== 'active').length,
  }), [rows]);
  const pickPerson = (id: string) => {
    setPerson(id);
    const p = (people.data ?? []).find((x) => x.id === id);
    const std = (stds.data ?? []).find((x) => p?.job_role_id && (x.role_ids ?? []).includes(p.job_role_id));
    setForm(emptyShare(std?.id ?? stds.data?.[0]?.id ?? ''));
  };
  return (
    <Page title={t('m09.routes.training-equivalency-prearrival.title')} intro={t('m09.pa.introEval')} wide
      actions={<span className="flex flex-wrap gap-2">
        <L to="/training/equivalency" className="btn-ghost">{t('m09.cp.backEq')}</L>
        {canWrite && <button type="button" className="btn-primary" onClick={() => { setPerson(''); setForm(emptyShare()); setOpen(true); }} data-testid="m09-pa-behalf">{t('m09.pa.behalf')}</button>}
      </span>}>
      <BenchmarkChips feature="FS69" />
      <GuidanceNote />
      <Grid cols={4}>
        <StatTile label={t('m09.pa.tActive')} value={f.num(tiles.active)} />
        <StatTile label={t('m09.pa.tWaiting')} value={f.num(tiles.waiting)} tone={tiles.waiting ? 'info' : undefined} />
        <StatTile label={t('m09.pa.tSoon')} value={f.num(tiles.soon)} sub={t('m09.pa.tSoonSub')} />
        <StatTile label={t('m09.pa.tClosed')} value={f.num(tiles.closed)} />
      </Grid>
      <Async state={list} empty={<EmptyState title={t('m09.pa.emptyTitle')}>{t('m09.pa.emptyEval')}</EmptyState>}>
        {(d) => (
          <div data-testid="m09-pa-queue">
            <DataTable<PrearrivalRow>
              rows={d}
              rowKey={(r) => r.id}
              csvName="prearrival-shares"
              onRowClick={(r) => nav(`/training/equivalency/prearrival/${r.id}`)}
              columns={[
                { key: 'who', header: t('m09.pa.cWho'), value: (r) => `${r.initials} · ${r.org_name_en}`, render: (r) => <span><span className="font-medium">{r.initials}</span> <span className="text-ink-3">· {pick({ name_en: r.org_name_en, name_ar: r.org_name_ar }, 'name')}</span></span> },
                { key: 'std', header: t('m09.pa.cStandard'), value: (r) => r.standard_code, sortable: true },
                { key: 'mob', header: t('m09.pa.cMobilise'), value: (r) => r.mobilise_on, render: (r) => f.date(r.mobilise_on), sortable: true },
                { key: 'exp', header: t('m09.pa.cExpires'), value: (r) => r.expires_on, render: (r) => f.date(r.expires_on), sortable: true },
                { key: 'status', header: t('m09.pa.cStatus'), value: (r) => r.status, render: (r) => <PaStatus status={r.status} /> },
                { key: 'via', header: t('m09.pa.cVia'), value: (r) => r.created_via, render: (r) => t(`m09.pa.via.${r.created_via}`) },
                { key: 'check', header: t('m09.pa.cCheck'), value: (r) => r.check_summary?.outlook ?? '', render: (r) => <SummaryLine s={r.check_summary} />, csv: false },
                { key: 'open', header: '', csv: false, render: (r) => <L to={`/training/equivalency/prearrival/${r.id}`} className="btn-ghost btn-sm" data-testid="m09-pa-open">{t('m09.pa.open')}</L> },
              ]}
            />
          </div>
        )}
      </Async>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('m09.pa.behalfTitle')}
        footer={<button type="button" className="btn-primary" disabled={!person || !form.items.length || !form.consent_ref.trim() || !form.consents.items || !form.consents.preview || !form.consents.share} onClick={() => setConfirm(true)} data-testid="m09-pa-behalf-submit">{t('m09.pa.create')}</button>}>
        <div className="space-y-4">
          <Callout tone="info" title={t('m09.pa.behalfNoteTitle')}>{t('m09.pa.behalfNote')}</Callout>
          <SelectField label={t('m09.pa.fContractor')} name="person" value={person} onChange={pickPerson} required placeholder={t('common.choose')}
            options={(people.data ?? []).map((p) => ({ value: p.id, label: `${p.initials} · ${bi({ en: p.org_name_en, ar: p.org_name_ar })} · ${p.ref}` }))} />
          {person && (
            <Async state={items} isEmpty={(d) => !d.allowed}>
              {(d) => <ShareFormFields items={d.items} standards={stds.data ?? []} form={form} set={setForm} onBehalf />}
            </Async>
          )}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m09.pa.behalfConfirmTitle')} confirmLabel={t('m09.pa.create')}
        consequence={t('m09.pa.behalfConfirmBody', { n: String(form.items.length), ref: form.consent_ref, date: form.expires_on })}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.createPrearrivalShare({ ...form, person_id: person }));
          setConfirm(false);
          if (r.ok) { setOpen(false); nav(`/training/equivalency/prearrival/${r.data!.id}`); }
        }} />
    </Page>
  );
}
