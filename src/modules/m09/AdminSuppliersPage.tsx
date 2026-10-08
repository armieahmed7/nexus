// M09 /admin/suppliers: ENEC-side review of supplier onboarding files. Evidence first (each document accepted or rejected
// with a note, the ICV plan reviewed or returned), then the case decision: approve, return with a note, or hand off to ENEC's
// supplier registration (the NEXUS partner lens). Every action is an audited RPC behind a confirmation. Auditors read only.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Callout, Async, EmptyState, Grid, StatTile, DataTable, Drawer, Tabs, ConfirmDialog, FilterBar, useFilters, KeyValue, ProgressBar, type Column } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { DOC_CHECKLIST, READINESS_STEPS, SELF_ASSESSMENT_AREAS, readinessState, icvCheck, selfAssessmentScore, type IcvLever } from '../../domain/partners';
import { HistoryTimeline, MStatus, shortHash } from './shared';

type Case = RowOf<'partner_onboarding'>;
type Data = { cases: Case[]; orgs: RowOf<'organisations'>[]; steps: RowOf<'supplier_readiness'>[]; docs: RowOf<'supplier_documents'>[]; icv: RowOf<'icv_plans'>[] };

export default function AdminSuppliersPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['partner_onboarding', 'organisations', 'supplier_readiness', 'supplier_documents', 'icv_plans'], async (): Promise<Data> => {
    const [cases, orgs, steps, docs, icv] = await Promise.all([
      repo.list('partner_onboarding', { order: [['submitted_at', 'desc']] }),
      repo.list('organisations'),
      repo.list('supplier_readiness'),
      repo.list('supplier_documents'),
      repo.list('icv_plans'),
    ]);
    return { cases, orgs, steps, docs, icv };
  });
  return (
    <Page title={t('m09.routes.admin-suppliers.title')} intro={t('m09.adm.intro')} wide>
      <Callout tone="info" title={t('m09.sup.prepTitle')}>{t('m09.adm.prepBody')}</Callout>
      <Async state={q} isEmpty={(d) => d.cases.length === 0} empty={<EmptyState title={t('m09.adm.empty')} />}>{(d) => <Queue d={d} />}</Async>
    </Page>
  );
}

function Queue({ d }: { d: Data }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [flt, setFlt] = useFilters({ status: '', kind: '' }, true);
  const [open, setOpen] = useState<string | null>(null);
  const orgName = (id: string) => { const o = d.orgs.find((x) => x.id === id); return o ? pick(o, 'name') : id; };
  const state = (c: Case) => readinessState(d.steps.filter((s) => s.org_id === c.org_id), d.docs.filter((x) => x.org_id === c.org_id), d.icv.find((p) => p.org_id === c.org_id));
  const accepted = (c: Case) => DOC_CHECKLIST.filter((k) => k.required && d.docs.some((x) => x.org_id === c.org_id && x.doc_key === k.key && x.status === 'accepted')).length;
  const rows = d.cases.filter((c) => (!flt.status || c.status === flt.status) && (!flt.kind || c.kind === flt.kind));
  const required = DOC_CHECKLIST.filter((k) => k.required).length;
  const cols: Column<Case>[] = [
    { key: 'org', header: t('m09.adm.col.org'), value: (c) => orgName(c.org_id), sortable: true, render: (c) => <button className="link-plain text-start font-semibold text-accent" onClick={() => setOpen(c.id)} data-testid={`m09-adm-open-${c.id}`}>{orgName(c.org_id)}</button> },
    { key: 'kind', header: t('m09.adm.col.kind'), value: (c) => t(`m09.kind.${c.kind}`), sortable: true },
    { key: 'status', header: t('m09.onb.col.status'), value: (c) => c.status, render: (c) => <MStatus status={c.status} />, sortable: true },
    { key: 'ready', header: t('m09.adm.col.readiness'), value: (c) => (c.kind === 'supplier' ? state(c).pct : null), render: (c) => (c.kind === 'supplier' ? <div className="min-w-[110px]"><ProgressBar value={['approved', 'handed_off'].includes(c.status) ? 100 : state(c).pct} label={`${f.num(['approved', 'handed_off'].includes(c.status) ? 100 : state(c).pct)}%`} /></div> : '—'), sortable: true },
    { key: 'docs', header: t('m09.adm.col.accepted'), value: (c) => (c.kind === 'supplier' ? `${accepted(c)}/${required}` : '—') },
    { key: 'icv', header: t('m09.adm.col.icv'), value: (c) => d.icv.find((p) => p.org_id === c.org_id)?.status ?? '—', render: (c) => { const p = d.icv.find((x) => x.org_id === c.org_id); return p ? <MStatus status={p.status} /> : '—'; } },
    { key: 'sub', header: t('m09.onb.submitted'), value: (c) => c.submitted_at ?? '', render: (c) => (c.submitted_at ? f.date(c.submitted_at) : '—'), sortable: true },
  ];
  const n = (s: string) => d.cases.filter((c) => c.status === s).length;
  const current = d.cases.find((c) => c.id === open) ?? null;
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m09.adm.statAwaiting')} value={f.num(n('submitted'))} tone={n('submitted') ? 'info' : undefined} />
        <StatTile label={t('m09.adm.statProgress')} value={f.num(n('in_progress') + n('invited') + n('returned'))} />
        <StatTile label={t('m09.adm.statApproved')} value={f.num(n('approved'))} tone="ok" />
        <StatTile label={t('m09.adm.statHanded')} value={f.num(n('handed_off'))} />
      </Grid>
      <Section title={t('m09.adm.queue')}>
        <FilterBar value={flt} onChange={setFlt} fields={[
          { key: 'status', label: t('m09.onb.col.status'), options: ['invited', 'in_progress', 'submitted', 'approved', 'returned', 'handed_off'].map((s) => ({ value: s, label: t(`m09.status.${s}`) })) },
          { key: 'kind', label: t('m09.adm.col.kind'), options: ['supplier', 'university', 'international'].map((k) => ({ value: k, label: t(`m09.kind.${k}`) })) },
        ]} />
        <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} csvName="kafaa-supplier-onboarding" initialSort={{ key: 'sub', dir: 'desc' }} caption={t('m09.adm.queue')} />
      </Section>
      <Drawer open={!!current} onClose={() => setOpen(null)} title={current ? orgName(current.org_id) : ''}>
        {current && <CaseReview c={current} d={d} />}
      </Drawer>
    </>
  );
}

type Pending = { kind: 'doc'; id: string; decision: 'accepted' | 'rejected' } | { kind: 'icv'; id: string; decision: 'reviewed' | 'returned' } | { kind: 'case'; decision: 'approved' | 'returned' | 'handed_off' };

function CaseReview({ c, d }: { c: Case; d: Data }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canDecide = s.can('partner_org', ['A']);
  const [pending, setPending] = useState<Pending | null>(null);
  const steps = d.steps.filter((x) => x.org_id === c.org_id);
  const docs = d.docs.filter((x) => x.org_id === c.org_id);
  const icv = d.icv.find((p) => p.org_id === c.org_id) ?? null;
  const st = readinessState(steps, docs, icv);
  const openReq = DOC_CHECKLIST.filter((k) => k.required && !docs.some((x) => x.doc_key === k.key && x.status === 'accepted')).length;
  const sa = (steps.find((x) => x.step_key === 'self_assessment')?.self_assessment ?? {}) as Record<string, number>;
  const icvChk = icv ? icvCheck(icv) : null;
  const supplier = c.kind === 'supplier';
  const summary = c.summary as { ref?: string } | null;
  const docRows = useMemo(() => DOC_CHECKLIST.map((k) => ({ k, row: docs.find((x) => x.doc_key === k.key) ?? null })), [docs]);

  const confirmText = (): { title: string; body: string; reason: boolean; danger?: boolean } => {
    if (!pending) return { title: '', body: '', reason: false };
    if (pending.kind === 'doc') return pending.decision === 'accepted' ? { title: t('m09.adm.acceptDoc'), body: t('m09.adm.acceptDocBody'), reason: false } : { title: t('m09.adm.rejectDoc'), body: t('m09.adm.rejectDocBody'), reason: true, danger: true };
    if (pending.kind === 'icv') return pending.decision === 'reviewed' ? { title: t('m09.adm.icvReviewed'), body: t('m09.adm.icvReviewedBody'), reason: false } : { title: t('m09.adm.icvReturn'), body: t('m09.adm.icvReturnBody'), reason: true };
    return { title: t(`m09.adm.decide.${pending.decision}`), body: t(`m09.adm.decide.${pending.decision}Body`), reason: pending.decision === 'returned', danger: pending.decision === 'returned' };
  };
  const exec = async (reason: string) => {
    if (!pending) return;
    if (pending.kind === 'doc') await run(() => repo.rpc.reviewSupplierDocument(pending.id, pending.decision, reason));
    else if (pending.kind === 'icv') await run(() => repo.rpc.reviewIcvPlan(pending.id, pending.decision, reason));
    else await run(() => repo.rpc.decidePartnerOnboarding(c.id, pending.decision, reason));
  };
  const ct = confirmText();

  return (
    <div className="space-y-4" data-testid="m09-adm-case">
      <div className="flex flex-wrap items-center gap-2"><MStatus status={c.status} /><span className="num text-[12px] text-ink-3">{c.id}</span>{summary?.ref && <span className="num ltr text-[12px] text-ink-2">{summary.ref}</span>}</div>
      {!canDecide && <Callout tone="info" title={t('m09.adm.readOnlyTitle')}>{t('m09.adm.readOnlyBody')}</Callout>}
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          {['submitted', 'in_progress'].includes(c.status) && <button className="btn-primary btn-sm" onClick={() => setPending({ kind: 'case', decision: 'approved' })} disabled={supplier && (openReq > 0 || !st.ready)} title={supplier && (openReq > 0 || !st.ready) ? t('m09.adm.approveBlocked', { n: f.num(openReq) }) : undefined} data-testid="m09-adm-approve">{t('m09.adm.decide.approved')}</button>}
          {['submitted', 'in_progress'].includes(c.status) && <button className="btn-outline btn-sm" onClick={() => setPending({ kind: 'case', decision: 'returned' })} data-testid="m09-adm-return">{t('m09.adm.decide.returned')}</button>}
          {c.status === 'approved' && <button className="btn-primary btn-sm" onClick={() => setPending({ kind: 'case', decision: 'handed_off' })} data-testid="m09-adm-handoff">{t('m09.adm.decide.handed_off')}</button>}
          {supplier && ['submitted', 'in_progress'].includes(c.status) && (openReq > 0 || !st.ready) && <span className="self-center text-[12px] text-ink-3">{t('m09.adm.approveBlocked', { n: f.num(openReq) })}</span>}
        </div>
      )}
      {supplier ? (
        <Tabs tabs={[
          {
            id: 'readiness', label: t('m09.onb.tab.path'),
            content: (
              <div className="space-y-3">
                <ul className="space-y-1 text-[13px]">
                  {READINESS_STEPS.map((k) => {
                    const r = steps.find((x) => x.step_key === k);
                    return <li key={k} className="flex items-center justify-between gap-2 border-b border-line py-1"><span>{t(`m09.step.${k}`)}</span><MStatus status={k === 'handoff' ? (c.status === 'handed_off' ? 'done' : 'not_started') : (r?.status ?? 'not_started')} /></li>;
                  })}
                </ul>
                <Card title={t('m09.onb.tab.self')}>
                  <KeyValue items={[...SELF_ASSESSMENT_AREAS.map((a) => [t(`m09.self.${a}.title`), sa[a] ? `${f.num(sa[a])} / 4` : '—'] as [string, string]), [t('m09.onb.selfScore'), selfAssessmentScore(sa) == null ? '—' : f.num(selfAssessmentScore(sa))]]} />
                </Card>
              </div>
            ),
          },
          {
            id: 'docs', label: t('m09.onb.tab.documents'), badge: docs.filter((x) => x.status === 'uploaded').length || undefined,
            content: (
              <ul className="space-y-2" data-testid="m09-adm-docs">
                {docRows.map(({ k, row }) => (
                  <li key={k.key} className="rounded-btn border border-line p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{t(`m09.doc.${k.key}`)} {!k.required && <span className="text-[12px] font-normal text-ink-3">({t('m09.onb.optional')})</span>}</div>
                        <div className="text-[12px] text-ink-3">{row?.file_name ? <><span className="ltr">{row.file_name}</span> · SHA-256 <span className="num" title={row.sha256 ?? ''}>{shortHash(row.sha256)}</span>{row.uploaded_at ? ` · ${f.dateTime(row.uploaded_at)}` : ''}</> : t('m09.adm.notUploaded')}</div>
                        {row?.review_note && <div className={`text-[12px] ${row.status === 'rejected' ? 'text-bad' : 'text-ink-2'}`}>{row.review_note}</div>}
                      </div>
                      <MStatus status={row?.status ?? 'missing'} />
                    </div>
                    {canDecide && row && row.status !== 'missing' && (
                      <div className="mt-2 flex gap-2">
                        {row.status !== 'accepted' && <button className="btn-outline btn-sm" onClick={() => setPending({ kind: 'doc', id: row.id, decision: 'accepted' })} data-testid={`m09-adm-accept-${k.key}`}>{t('m09.adm.accept')}</button>}
                        {row.status !== 'rejected' && <button className="btn-ghost btn-sm text-bad" onClick={() => setPending({ kind: 'doc', id: row.id, decision: 'rejected' })}>{t('m09.adm.reject')}</button>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: 'icv', label: t('m09.adm.icvTab'),
            content: icv ? (
              <div className="space-y-3">
                <KeyValue items={[
                  [t('m09.icv.planStatus'), <MStatus key="s" status={icv.status} />],
                  [t('m09.icv.baseline'), f.num(icv.baseline)],
                  [t('m09.icv.target'), `${f.num(icv.target)} (${icv.target_year})`],
                  [t('m09.icv.levers'), icvChk ? `${f.num(icvChk.leverTotal)} / ${f.num(icvChk.gap)} ${icvChk.covered ? '✓' : ''}` : '—'],
                  [t('m09.icv.cert'), icvChk ? t(`m09.icv.certState.${icvChk.certificate}`) + (icv.certificate_valid_to ? ` · ${f.date(icv.certificate_valid_to)}` : '') : '—'],
                  [t('m09.icv.certFile'), icv.certificate_file ? `${icv.certificate_file} · ${shortHash(icv.certificate_sha256)}` : '—'],
                  [t('m09.icv.reviewNote'), icv.review_note || '—'],
                ]} />
                <ul className="space-y-1 text-[13px]">{((icv.levers as IcvLever[]) ?? []).map((l, i) => <li key={i} className="flex justify-between gap-2 border-b border-line py-1"><span>{l.lever}{l.en ? ` · ${l.en}` : ''}</span><span className="num">+{f.num(l.delta)}</span></li>)}</ul>
                {canDecide && icv.status === 'submitted' && (
                  <div className="flex gap-2">
                    <button className="btn-primary btn-sm" onClick={() => setPending({ kind: 'icv', id: icv.id, decision: 'reviewed' })} data-testid="m09-adm-icv-reviewed">{t('m09.adm.icvReviewed')}</button>
                    <button className="btn-outline btn-sm" onClick={() => setPending({ kind: 'icv', id: icv.id, decision: 'returned' })}>{t('m09.adm.icvReturn')}</button>
                  </div>
                )}
              </div>
            ) : <EmptyState title={t('m09.adm.noIcv')} />,
          },
          { id: 'history', label: t('m09.onb.history'), content: <HistoryTimeline history={c.history} /> },
        ]} />
      ) : (
        <Card title={t('m09.onb.history')}><HistoryTimeline history={c.history} /></Card>
      )}
      {summary?.ref && <p className="text-[12.5px] text-ink-2">{t('m09.adm.summaryNote', { ref: summary.ref })}</p>}
      <p className="text-[12px] text-ink-3">{t('m09.adm.auditNote')} <L to="/admin/audit">{t('m09.adm.auditLink')}</L></p>
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} title={ct.title} consequence={ct.body} actingAs={t('m09.adm.actingAdmin')} requireReason={ct.reason} reasonLabel={t('m09.adm.noteLabel')} danger={ct.danger} onConfirm={exec} />
    </div>
  );
}
