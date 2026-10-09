// /leadership/nominations (M22 · F16): line managers nominate people they manage; the HR authority (CHCO office) or the training
// manager approves or declines. Maker-checker: the nominator and the nominee never decide (the RPC refuses, the UI explains).
import { useState } from 'react';
import { Page, Section, Async, EmptyState, Callout, ConfirmDialog, DataTable, Icon, Tabs, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useLeadership, useLabels, NomPill, type LeadData, type Nomination } from './ui';
import { NominateModal } from './NominateModal';

export default function NominationsPage() {
  const t = useT();
  const { q, me, session } = useLeadership();
  const decider = session.can('talent_review', ['A']) || session.hasRole('training_manager');
  const manager = session.hasRole('manager');
  return (
    <Page title={t('m22.routes.leadership-nominations.title')} intro={t('m22.nom.intro')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide>
      <Async state={q}>
        {(d) => {
          const tabs = [
            ...(decider ? [{ id: 'queue', label: t('m22.nom.queue'), badge: <span className="chip border-info-line bg-info-bg text-info">{d.nominations.filter((n) => n.status === 'nominated').length}</span>, content: <Queue d={d} me={me} /> }] : []),
            ...(manager ? [{ id: 'team', label: t('m22.nom.team'), content: <Team d={d} me={me} /> }] : []),
            { id: 'all', label: t('m22.nom.all'), content: <All d={d} /> },
          ];
          return <Tabs key={tabs.map((x) => x.id).join('|')} tabs={tabs} />;
        }}
      </Async>
    </Page>
  );
}

function Queue({ d, me }: { d: LeadData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const lab = useLabels(d.skills, d.roles);
  const [act, setAct] = useState<{ n: Nomination; decision: 'approved' | 'declined' } | null>(null);
  const open = d.nominations.filter((n) => n.status === 'nominated');
  if (!open.length) return <div className="pt-4"><EmptyState icon="check" title={t('m22.nom.queueEmpty')} /></div>;
  return (
    <div className="space-y-3 pt-4">
      <Callout title={t('m22.nominate.makerChecker')}>{t('m22.nom.queueNote')}</Callout>
      <ul className="space-y-3" data-testid="m22-nom-queue">
        {open.map((n) => {
          const g = d.programmes.find((x) => x.id === n.programme_id);
          const blocked = n.nominated_by === me ? 'maker' : n.person_id === me ? 'self' : null;
          return (
            <li key={n.id} className="card p-4" data-testid="m22-nom-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name')} <span className="text-ink-3">· {lab.role(n.person_role_id)}</span></div>
                  <div className="text-[12.5px] text-ink-2">{g ? pick(g, 'title') : n.programme_id} · {t('m22.nom.by', { name: pick({ name_en: n.nominator_name, name_ar: n.nominator_name_ar }, 'name'), date: f.date(n.created_at) })}</div>
                </div>
                <NomPill status={n.status} />
              </div>
              <p className="mt-2 text-[13.5px]">“{n.reason}”</p>
              {blocked ? <p className="mt-2 text-[12.5px] text-sim">{t(blocked === 'maker' ? 'm22.nom.blockedMaker' : 'm22.nom.blockedSelf')}</p> : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary btn-sm" onClick={() => setAct({ n, decision: 'approved' })} data-testid="m22-nom-approve"><Icon name="check" size={14} />{t('m22.nom.approve')}</button>
                  <button className="btn-outline btn-sm" onClick={() => setAct({ n, decision: 'declined' })} data-testid="m22-nom-decline">{t('m22.nom.decline')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} danger={act?.decision === 'declined'} requireReason={act?.decision === 'declined'} reasonLabel={t('m22.nom.declineReason')}
        title={act?.decision === 'approved' ? t('m22.nom.approveTitle') : t('m22.nom.declineTitle')} consequence={t(act?.decision === 'approved' ? 'm22.nom.approveBody' : 'm22.nom.declineBody')}
        confirmLabel={act?.decision === 'approved' ? t('m22.nom.approve') : t('m22.nom.decline')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.decideNomination(act.n.id, act.decision, reason)); }} />
    </div>
  );
}

function Team({ d, me }: { d: LeadData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [open, setOpen] = useState(false);
  const mine = d.nominations.filter((n) => n.nominated_by === me);
  return (
    <div className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-ink-2">{t('m22.nom.teamBody')}</p>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m22-nominate"><Icon name="plus" size={14} />{t('m22.programme.nominate')}</button>
      </div>
      {mine.length === 0 ? <EmptyState icon="users" title={t('m22.nom.teamEmpty')} /> : (
        <ul className="space-y-2" data-testid="m22-nom-team">
          {mine.map((n) => {
            const g = d.programmes.find((x) => x.id === n.programme_id);
            return (
              <li key={n.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-semibold">{pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name')}</div>
                  <div className="text-[12.5px] text-ink-2">{g ? pick(g, 'title') : n.programme_id} · {f.date(n.created_at)}{n.decision_note ? ` · ${n.decision_note}` : ''}</div>
                </div>
                <NomPill status={n.status} />
              </li>
            );
          })}
        </ul>
      )}
      <NominateModal open={open} onClose={() => setOpen(false)} programmes={d.programmes} />
    </div>
  );
}

function All({ d }: { d: LeadData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const progTitle = (id: string) => { const g = d.programmes.find((x) => x.id === id); return g ? pick(g, 'title') : id; };
  const cols: Column<Nomination>[] = [
    { key: 'person', header: t('m22.nom.colPerson'), value: (n) => pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name'), sortable: true },
    { key: 'programme', header: t('m22.nom.colProgramme'), value: (n) => progTitle(n.programme_id), sortable: true },
    { key: 'cycle', header: t('m22.nom.colCycle'), value: (n) => n.cycle, sortable: true },
    { key: 'by', header: t('m22.nom.colBy'), value: (n) => pick({ name_en: n.nominator_name, name_ar: n.nominator_name_ar }, 'name'), sortable: true },
    { key: 'status', header: t('m22.nom.colStatus'), value: (n) => t(`m22.nomStatus.${n.status}`), render: (n) => <NomPill status={n.status} />, sortable: true },
    { key: 'updated', header: t('m22.nom.colUpdated'), value: (n) => n.updated_at, render: (n) => f.date(n.updated_at), sortable: true },
  ];
  return (
    <div className="pt-4">
      <Section description={t('m22.nom.allSub')}>
        <DataTable rows={d.nominations} columns={cols} rowKey={(n) => n.id} csvName="leadership-nominations.csv" initialSort={{ key: 'updated', dir: 'desc' }} caption={t('m22.nom.all')} empty={<EmptyState icon="users" title={t('m22.nom.allEmpty')} />} />
      </Section>
    </div>
  );
}
