// /communities/women-in-nuclear/programme (M22 · FS48): the programme view of women in future nuclear skills. HR (HR analyst,
// HR director) and auditors see aggregates only (rpc.wfnStats): network counts, request outcomes and the pipeline share of women per
// programme, every cell under 10 suppressed and a gender comparison suppressed whole when either group is under 10. The training
// manager owns the programme and also gets the request desk (rpc.wfnDesk): shortlist, place (ledger row), complete with an outcome,
// or decline with a note. Nobody gets a list of participants; nothing here ranks anyone.
import { useState } from 'react';
import { Page, Section, Async, EmptyState, Callout, BenchmarkChips, Tabs, StatTile, Grid, DataTable, ConfirmDialog, Modal, RadioGroup, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { WfnDeskRow, WfnStats } from './backend/rpc';
import { Cell, RequestPill } from './fsui';

export default function WomenInNuclearProgrammePage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const stats = useQuery(['wfn_participants', 'wfn_circle_members', 'wfn_requests', 'leadership_nominations'], () => repo.rpc.wfnStats(), [me]);
  const owner = s.hasRole('training_manager');
  const statsTab = { id: 'stats', label: t('m22.wfnp.tabStats'), content: <Async state={stats} isEmpty={(x) => !x} empty={<EmptyState icon="lock" title={t('m22.wfnp.noStats')} />}>{(x) => <Stats st={x!} />}</Async> };
  return (
    <Page title={t('m22.routes.communities-women-programme.title')} intro={t('m22.wfnp.intro')} eyebrow={<L to="/communities/women-in-nuclear">{t('m22.wfnp.back')}</L>} wide>
      <div className="space-y-6">
        <BenchmarkChips feature="FS48" />
        <Tabs key={owner ? 'owner' : 'hr'} tabs={owner ? [statsTab, { id: 'desk', label: t('m22.wfnp.tabDesk'), content: <Desk /> }] : [statsTab]} />
        <Callout title={t('m22.wfnp.rulesTitle')}>{t('m22.wfnp.rulesBody')}</Callout>
      </div>
    </Page>
  );
}

function Stats({ st }: { st: WfnStats }) {
  const t = useT();
  const f = useFormat();
  const num = (v: number) => f.num(v);
  const pct = (v: number) => f.pct(v, 0);
  const n = st.network;
  return (
    <div className="space-y-6 pt-4" data-testid="m22-wfn-stats">
      <Section title={t('m22.wfnp.network')} description={t('m22.wfnp.networkSub')}>
        <Grid cols={4}>
          <StatTile label={t('m22.wfnp.participants')} value={<Cell n={n.participants} fmt={num} />} />
          <StatTile label={t('m22.wfnp.mentors')} value={<Cell n={n.mentors} fmt={num} />} />
          <StatTile label={t('m22.wfnp.circleMembers')} value={<Cell n={n.circle_members} fmt={num} />} />
          <StatTile label={t('m22.wfnp.requestsTotal')} value={<Cell n={n.requests_total} fmt={num} />} />
        </Grid>
      </Section>
      <Section title={t('m22.wfnp.requests')}>
        <Grid cols={4}>
          {n.requests.map((r) => <StatTile key={r.status} label={t(`m22.wfn.req.${r.status}`)} value={<Cell n={r.n} fmt={num} />} sub={r.suppressed ? t('common.suppressed') : undefined} />)}
        </Grid>
        <Grid cols={2}>
          <StatTile label={t('m22.wfnp.completion')} value={<Cell n={n.completion.rate} fmt={pct} />} sub={n.completion.suppressed ? t('common.suppressed') : t('m22.wfnp.completionSub', { done: num(n.completion.completed ?? 0), base: num(n.completion.base ?? 0) })} />
          <StatTile label={t('m22.wfnp.progression')} value={<Cell n={n.progression.rate} fmt={pct} />} sub={n.progression.suppressed ? t('common.suppressed') : t('m22.wfnp.progressionSub')} />
        </Grid>
      </Section>
      <Section title={t('m22.wfnp.pipeline')} description={t('m22.wfnp.pipelineSub')}>
        <table className="w-full text-[13px]" data-testid="m22-wfn-pipeline">
          <caption className="sr-only">{t('m22.wfnp.pipeline')}</caption>
          <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m22.wfnp.colProgramme')}</th><th scope="col" className="text-end">{t('m22.wfnp.colWomen')}</th><th scope="col" className="text-end">{t('m22.wfnp.colMen')}</th><th scope="col" className="text-end">{t('m22.wfnp.colShare')}</th></tr></thead>
          <tbody>
            {st.pipeline.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <th scope="row" className="py-1.5 text-start font-normal">{t(`m22.wfnp.row.${r.id}`)}</th>
                <td className="num text-end"><Cell n={r.women} fmt={num} /></td>
                <td className="num text-end"><Cell n={r.men} fmt={num} /></td>
                <td className="num text-end"><Cell n={r.share} fmt={pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[12px] text-ink-3">{t('m22.wfnp.pipelineNote')}</p>
      </Section>
    </div>
  );
}

function Desk() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const me = useSession().identity.personId;
  const desk = useQuery(['wfn_requests'], () => repo.rpc.wfnDesk(), [me]);
  const [act, setAct] = useState<{ r: WfnDeskRow; decision: 'shortlist' | 'place' | 'decline' } | null>(null);
  const [done, setDone] = useState<WfnDeskRow | null>(null);
  const [outcome, setOutcome] = useState<'progressed' | 'same_role'>('progressed');
  const cols: Column<WfnDeskRow>[] = [
    { key: 'offer', header: t('m22.wfnp.colOffer'), value: (r) => pick({ title_en: r.offer_title_en, title_ar: r.offer_title_ar }, 'title'), sortable: true },
    { key: 'strand', header: t('m22.wfnp.colStrand'), value: (r) => t(`m22.wfn.strand.${r.strand}`), sortable: true },
    { key: 'person', header: t('m22.nom.colPerson'), value: (r) => pick({ name_en: r.person_name, name_ar: r.person_name_ar }, 'name'), sortable: true },
    { key: 'statement', header: t('m22.wfn.statement'), value: (r) => r.statement, render: (r) => <span className="line-clamp-2 text-[12.5px]">{r.statement}</span> },
    { key: 'status', header: t('m22.nom.colStatus'), value: (r) => r.status, render: (r) => <RequestPill status={r.status} />, sortable: true },
    { key: 'updated', header: t('m22.nom.colUpdated'), value: (r) => r.updated_at, render: (r) => f.date(r.updated_at), sortable: true },
    { key: 'actions', header: t('m22.flm.colActions'), value: () => '', render: (r) => (
      <span className="flex flex-wrap gap-1.5">
        {r.status === 'interested' && <button className="btn-primary btn-sm" onClick={() => setAct({ r, decision: 'shortlist' })} data-testid="m22-wfn-shortlist">{t('m22.wfnp.shortlist')}</button>}
        {r.status === 'shortlisted' && <button className="btn-primary btn-sm" onClick={() => setAct({ r, decision: 'place' })} data-testid="m22-wfn-place">{t('m22.wfnp.place')}</button>}
        {r.status === 'placed' && <button className="btn-primary btn-sm" onClick={() => { setDone(r); setOutcome('progressed'); }} data-testid="m22-wfn-complete">{t('m22.wfnp.complete')}</button>}
        {(r.status === 'interested' || r.status === 'shortlisted') && <button className="btn-outline btn-sm" onClick={() => setAct({ r, decision: 'decline' })}>{t('m22.nom.decline')}</button>}
      </span>
    ) },
  ];
  return (
    <div className="space-y-3 pt-4">
      <p className="text-[13.5px] text-ink-2">{t('m22.wfnp.deskBody')}</p>
      <Async state={desk} isEmpty={(x) => x.length === 0} empty={<EmptyState icon="check" title={t('m22.wfnp.deskEmpty')} />}>
        {(rows) => <div data-testid="m22-wfn-desk"><DataTable rows={rows} columns={cols} rowKey={(r) => r.id} caption={t('m22.wfnp.tabDesk')} initialSort={{ key: 'updated', dir: 'desc' }} /></div>}
      </Async>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} danger={act?.decision === 'decline'} requireReason={act?.decision === 'decline'} reasonLabel={t('m22.wfnp.declineNote')}
        title={act ? t(`m22.wfnp.${act.decision}Title`) : ''} consequence={act ? t(`m22.wfnp.${act.decision}Body`) : ''} confirmLabel={act ? t(`m22.wfnp.${act.decision}`) : ''}
        onConfirm={async (note) => { if (act) await run(() => repo.rpc.decideWfnRequest(act.r.id, act.decision, note)); }} />
      <Modal open={!!done} onClose={() => setDone(null)} title={t('m22.wfnp.completeTitle')}
        footer={<>
          <button className="btn-outline" onClick={() => setDone(null)}>{t('common.cancel')}</button>
          <button className="btn-primary" data-testid="m22-wfn-complete-confirm" onClick={async () => { if (!done) return; const r = await run(() => repo.rpc.decideWfnRequest(done.id, 'complete', '', outcome)); if (r.ok) setDone(null); }}>{t('m22.wfnp.complete')}</button>
        </>}>
        <RadioGroup label={t('m22.wfnp.outcome')} name="wfn-outcome" value={outcome} onChange={(v) => setOutcome(v as 'progressed' | 'same_role')}
          options={[{ value: 'progressed', label: t('m22.wfn.outcome.progressed') }, { value: 'same_role', label: t('m22.wfn.outcome.same_role') }]} />
      </Modal>
    </div>
  );
}
