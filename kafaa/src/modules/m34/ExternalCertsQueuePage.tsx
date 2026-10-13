// FS79 /recognition/certificates · External certificate verification (recognition A: instructors, the training manager, the HR director;
// R: auditors). Waiting, verified, closed. A verifier who is not the holder checks the issuer's link or registry (or, for ENEC
// certificates, the ENEC assessment) and verifies, rejects with a reason, or later revokes; the mapping preview shows which crosswalk entries
// are reviewed (they map) and which are not (they never map). rpc.verifyExternalCert; verification writes evidence and a ledger row.
import { useMemo, useState } from 'react';
import { Async, BenchmarkChips, Callout, ConfirmDialog, DataTable, Drawer, EmptyState, Page, RadioGroup, Section, StatTile, Tabs, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { METHODS, checkVerify, issuerTier, trustTier, type AlignmentLite, type CertLite } from './extcerts';
import { NotAuthority } from './ui';
import { CertStatus, TierLegend, TrustTierBadge, isoToday, useFs91Act, type Row } from './fs91ui';
import { CertCard } from './MyExternalCertsPage';

export default function ExternalCertsQueuePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['external_certs', 'skill_alignments'], async () => {
    const [certs, als, skills] = await Promise.all([
      repo.list('external_certs', { order: [['updated_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('skill_alignments', {}).catch(() => []) as Promise<Row[]>,
      repo.list('skills', {}).catch(() => []) as Promise<Row[]>,
    ]);
    return { certs, als, skills };
  }, []);
  return (
    <Page title={t('m34.routes.external-certs-queue.title')} eyebrow={t('m34.xc.qEyebrow')} intro={t('m34.xc.qIntro')} wide>
      <div data-testid="m34-xc-bench"><BenchmarkChips feature="FS79" /></div>
      <NotAuthority />
      <Async state={q}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: { certs: Row[]; als: Row[]; skills: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const verifier = s.can('recognition', ['A']);
  const [open, setOpen] = useState<Row | null>(null);
  const alMap = useMemo(() => new Map(d.als.map((a) => [a.id, a as AlignmentLite])), [d.als]);
  const skMap = useMemo(() => new Map(d.skills.map((k) => [k.id, k])), [d.skills]);
  const waiting = d.certs.filter((c) => c.status === 'submitted');
  const verified = d.certs.filter((c) => c.status === 'verified');
  const closed = d.certs.filter((c) => ['rejected', 'withdrawn', 'revoked'].includes(c.status));
  const cols: Column<Row>[] = [
    { key: 'who', header: t('m34.xc.colHolder'), value: (c) => c.person_name, sortable: true, render: (c) => <span>{c.person_name}{c.person_id === me && <span className="ms-1 text-[12px] text-sim">({t('m34.xc.yours')})</span>}</span> },
    { key: 'title', header: t('m34.xc.colTitle'), value: (c) => c.title, sortable: true, render: (c) => <button type="button" className="text-start font-semibold text-accent hover:underline" onClick={() => setOpen(c)} data-testid={`m34-xc-open-${c.id}`}>{c.title}</button> },
    { key: 'issuer', header: t('m34.xc.colIssuer'), value: (c) => c.issuer, render: (c) => <span className="text-[13px]">{c.issuer}<span className="block text-[12px] text-ink-3">{t(`m34.xc.kind.${c.issuer_kind}`)}</span></span> },
    { key: 'tier', header: t('m34.xc.colTier'), value: (c) => trustTier(c as CertLite), render: (c) => <TrustTierBadge cert={c as CertLite} /> },
    { key: 'would', header: t('m34.xc.colWould'), value: (c) => issuerTier(c as CertLite), render: (c) => (c.status === 'submitted' ? <span className="text-[12px] text-ink-2">{t(`m34.xc.tier.${issuerTier(c as CertLite)}`)}</span> : '—') },
    { key: 'status', header: t('m34.xc.colStatus'), value: (c) => c.status, render: (c) => <CertStatus status={c.status} /> },
    { key: 'on', header: t('m34.xc.colOn'), value: (c) => String(c.updated_at ?? ''), sortable: true, render: (c) => f.date(String(c.updated_at ?? c.created_at).slice(0, 10)) },
  ];
  const table = (rows: Row[]) => (rows.length ? <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} pageSize={10} caption={t('m34.routes.external-certs-queue.title')} csvName="kafaa-external-certificates.csv" /> : <EmptyState title={t('m34.xc.qEmpty')} />);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-xc-q-tiles">
        <StatTile label={t('m34.xc.tWaiting')} value={f.num(waiting.length)} sub={t('m34.xc.tWaitingSub')} tone="info" />
        <StatTile label={t('m34.xc.tVerified')} value={f.num(verified.length)} sub={t('m34.xc.tEvidence', { n: f.num(verified.reduce((a, c) => a + (c.evidence_ids ?? []).length, 0)) })} tone="ok" />
        <StatTile label={t('m34.xc.tClosed')} value={f.num(closed.length)} sub={t('m34.xc.tClosedSub', { r: f.num(closed.filter((c) => c.status === 'rejected').length), v: f.num(closed.filter((c) => c.status === 'revoked').length) })} />
        <StatTile label={t('m34.xc.tUnreviewed')} value={f.num(waiting.reduce((a, c) => a + (c.alignment_ids ?? []).filter((x: string) => { const al = alMap.get(x); return !(al && al.status === 'published' && al.reviewed_by && al.reviewed_on); }).length, 0))} sub={t('m34.xc.tUnreviewedSub')} tone="sim" />
      </div>
      <Callout tone="info" title={t('m34.xc.mcTitle')}>{t('m34.xc.mcBody')}</Callout>
      <Section title={t('m34.xc.tiersTitle')}><TierLegend /></Section>
      <Section title={t('m34.xc.qListTitle')}>
        <div data-testid="m34-xc-queue">
          <Tabs tabs={[
            { id: 'waiting', label: t('m34.xc.tabWaiting'), badge: waiting.length || undefined, content: table(waiting) },
            { id: 'verified', label: t('m34.xc.tabVerified'), content: table(verified) },
            { id: 'closed', label: t('m34.xc.tabClosed'), content: table(closed) },
            { id: 'all', label: t('m34.xc.tabAll'), content: table(d.certs) },
          ]} />
        </div>
      </Section>
      {open && <Decide c={d.certs.find((x) => x.id === open.id) ?? open} me={me} verifier={verifier} alMap={alMap} skMap={skMap} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Decide({ c, me, verifier, alMap, skMap, onClose }: { c: Row; me: string; verifier: boolean; alMap: Map<string, AlignmentLite>; skMap: Map<string, Row>; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useFs91Act();
  const today = isoToday();
  const enec = issuerTier(c as CertLite) === 'enec_assessed';
  const [method, setMethod] = useState<string>(enec ? 'enec_assessment' : 'issuer_url');
  const [dlg, setDlg] = useState<'verify' | 'reject' | 'revoke' | null>(null);
  const codeOf = (d: string, note = 'x'.repeat(10)) => checkVerify({ decision: d, method, note }, c as CertLite, me, today);
  const methods = METHODS.filter((m) => (m === 'enec_assessment') === enec);
  return (
    <Drawer open onClose={onClose} title={c.title}>
      <div className="space-y-3" data-testid="m34-xc-decide">
        <CertCard c={c} alMap={alMap} skMap={skMap} />
        {!verifier ? <Callout tone="sim" title={t('m34.xc.readOnlyTitle')}>{t('m34.xc.readOnlyBody')}</Callout>
          : c.person_id === me ? <div data-testid="m34-xc-mc"><Callout tone="bad" title={t('m34.xc.ownTitle')}>{t('m34.xcmsg.self')}</Callout></div>
          : c.status === 'submitted' ? (
            <div className="space-y-3">
              <RadioGroup label={t('m34.xc.fMethod')} name="method" value={method} onChange={setMethod} options={methods.map((m) => ({ value: m, label: t(`m34.xc.method.${m}`) }))} />
              {codeOf('verify') !== 'ok' && <Callout tone="bad" title={t('m34.xc.failTitle')}>{t(`m34.xcmsg.${codeOf('verify')}`)}</Callout>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" disabled={codeOf('verify') !== 'ok'} onClick={() => setDlg('verify')} data-testid="m34-xc-verify">{t('m34.xc.verify')}</button>
                <button type="button" className="btn-outline" onClick={() => setDlg('reject')} data-testid="m34-xc-reject">{t('m34.xc.reject')}</button>
              </div>
            </div>
          ) : c.status === 'verified' ? <button type="button" className="btn-outline" onClick={() => setDlg('revoke')} data-testid="m34-xc-revoke">{t('m34.xc.revoke')}</button> : null}
      </div>
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} title={dlg ? t(`m34.xc.${dlg}Title`) : ''} consequence={dlg ? t(`m34.xc.${dlg}Body`) : ''}
        requireReason={dlg === 'reject' || dlg === 'revoke'} reasonLabel={t('m34.xc.reason')} actingAs={t('m34.xc.actingVerifier')}
        onConfirm={async (note) => { if (dlg) { const r = await run(() => repo.rpc.verifyExternalCert({ id: c.id, decision: dlg, method, note }), t(`m34.xc.${dlg}Done`)); if (r.ok) onClose(); } setDlg(null); }} />
    </Drawer>
  );
}
