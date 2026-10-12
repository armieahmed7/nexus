// FS69 /partner/workforce/prearrival. A contractor chooses which passport items an ENEC evaluator may see before mobilisation (an FS32
// share link with the three consent gates), names the qualification standard and the mobilisation date, sees the evaluator's check
// summary and revokes at any time. A partner admin sees their organisation's pre-arrival shares (no items). Pages never import a backend.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Drawer, ConfirmDialog, Callout, BenchmarkChips, Grid, StatTile } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import type { PrearrivalRow } from './backend/rpc';
import { GuidanceNote, PaStatus, ShareFormFields, SummaryLine, emptyShare, type ShareForm } from './fs75ui';
import { NotAuthority } from './passportUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function PrearrivalPage() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const list = useQuery(['prearrival_shares', 'record_shares'], () => repo.rpc.prearrivalShares(), [me]);
  const mine = useQuery(['person_skills', 'badges', 'record_shares'], () => repo.rpc.prearrivalItems(null), [me]);
  const stds = useQuery(['qual_standards'], async () => ((await repo.list('qual_standards', { order: [['code', 'asc']] })) as Row[]).filter((x) => x.status === 'current' && !x.security_restricted), []);
  const links = useQuery(['record_shares'], async () => (me ? ((await repo.list('record_shares' as never, { filter: { person_id: me } } as never)) as Row[]) : []), [me]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ShareForm>(emptyShare());
  const [confirm, setConfirm] = useState(false);
  const [revoke, setRevoke] = useState<PrearrivalRow | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const isContractor = !!mine.data?.allowed;
  const roleStds = (stds.data ?? []).filter((x) => mine.data?.person?.job_role_id && (x.role_ids ?? []).includes(mine.data.person.job_role_id));
  const startNew = () => { setForm(emptyShare(roleStds[0]?.id ?? stds.data?.[0]?.id ?? '')); setOpen(true); };
  const tokenOf = (shareId: string) => (links.data ?? []).find((x) => x.id === shareId)?.token as string | undefined;
  const rows = list.data ?? [];
  return (
    <Page title={t('m09.routes.partner-prearrival.title')} intro={t(isContractor ? 'm09.pa.introSelf' : 'm09.pa.introAdmin')}
      actions={isContractor ? <button type="button" className="btn-primary" onClick={startNew} data-testid="m09-pa-new">{t('m09.pa.new')}</button> : <L to="/partner/workforce/passport" className="btn-ghost">{t('m09.cp.back')}</L>}>
      <BenchmarkChips feature="FS69" />
      <NotAuthority />
      <GuidanceNote />
      {created && <Callout tone="ok" title={t('m09.pa.createdTitle')}><span data-testid="m09-pa-created">{t('m09.pa.createdBody')}</span> <L to={`/verify/record/${created}`} className="underline">{t('m09.pa.verifyLink')}</L></Callout>}
      <Grid cols={3}>
        <StatTile label={t('m09.pa.tActive')} value={f.num(rows.filter((r) => r.status === 'active').length)} />
        <StatTile label={t('m09.pa.tChecked')} value={f.num(rows.filter((r) => r.check_summary).length)} />
        <StatTile label={t('m09.pa.tClosed')} value={f.num(rows.filter((r) => r.status !== 'active').length)} />
      </Grid>
      <Async state={list} empty={<EmptyState title={t('m09.pa.emptyTitle')}>{t(isContractor ? 'm09.pa.emptySelf' : 'm09.pa.emptyAdmin')}</EmptyState>}>
        {(d) => (
          <ul className="space-y-3" data-testid="m09-pa-list">
            {d.map((r) => {
              const tok = r.person_id === me ? tokenOf(r.share_id) : undefined;
              return (
                <li key={r.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3" data-testid="m09-pa-row" data-status={r.status}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.label}</span><PaStatus status={r.status} />
                          <span className="chip border-line bg-sunken text-ink-2">{t(`m09.pa.via.${r.created_via}`)}</span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-2">
                          {t('m09.pa.rowLine', { code: r.standard_code, title: pick({ title_en: r.standard_title_en, title_ar: r.standard_title_ar }, 'title'), mob: f.date(r.mobilise_on), exp: f.date(r.expires_on), n: f.num(r.item_count) })}
                        </p>
                        {r.person_id !== me && <p className="text-[12px] text-ink-3">{t('m09.pa.holder', { initials: r.initials })}</p>}
                        <div className="mt-2"><SummaryLine s={r.check_summary} checkedAt={r.checked_at} /></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tok && r.status === 'active' && <L to={`/verify/record/${tok}`} className="btn-ghost" data-testid="m09-pa-open-link">{t('m09.pa.verifyLink')}</L>}
                        {r.person_id === me && r.status === 'active' && <button type="button" className="btn-outline" onClick={() => setRevoke(r)} data-testid="m09-pa-revoke">{t('m09.pa.revoke')}</button>}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('m09.pa.newTitle')}
        footer={<button type="button" className="btn-primary" disabled={!form.items.length || !form.consents.items || !form.consents.preview || !form.consents.share} onClick={() => setConfirm(true)} data-testid="m09-pa-submit">{t('m09.pa.create')}</button>}>
        <ShareFormFields items={mine.data?.items ?? []} standards={stds.data ?? []} form={form} set={setForm} onBehalf={false} />
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m09.pa.confirmTitle')} confirmLabel={t('m09.pa.create')}
        consequence={t('m09.pa.confirmBody', { n: String(form.items.length), date: form.expires_on })}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.createPrearrivalShare({ ...form, person_id: null, consent_ref: null }));
          setConfirm(false);
          if (r.ok) { setOpen(false); setCreated(r.data!.token); }
        }} />
      <ConfirmDialog open={!!revoke} onClose={() => setRevoke(null)} title={t('m09.pa.revokeTitle')} confirmLabel={t('m09.pa.revoke')} danger consequence={t('m09.pa.revokeBody')}
        onConfirm={async () => { if (revoke) await run(() => repo.rpc.revokePrearrivalShare(revoke.id, null)); setRevoke(null); }} />
    </Page>
  );
}
