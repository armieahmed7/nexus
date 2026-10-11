// /leadership/future-leaders/manage (M22 · FS47): the HR and programme desk of the Future Leaders track. HR (HR analyst or HR
// director) nominates through rpc.nominateFutureLeader; the HR authority or the training manager selects through the F16 decision
// (rpc.decideNomination, maker-checker, audit and ledger rows); the training manager records modules; the training manager or the
// HR authority reviews policy projects (never their own); statistics are aggregate-only with every count under 10 suppressed.
// Readiness of nominees comes as numbers from rpc.flReadiness (audited) and is explained with "Why this?".
import { useMemo, useState } from 'react';
import { Page, Section, Async, EmptyState, Callout, WhyThis, BenchmarkChips, Tabs, Modal, SelectField, ConfirmDialog, StatTile, Grid, Icon, DataTable, ProgressBar, type Column } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { flReasons, type FlReadiness } from './future';
import { useFutureLeaders, type FlData } from './FutureLeadersPage';
import { useLabels, NomPill } from './ui';
import { Cell, CohortPill, ProjectPill } from './fsui';

type Nom = RowOf<'leadership_nominations'>;
type Part = RowOf<'fl_participants'>;

export default function FutureLeadersManagePage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const q = useFutureLeaders();
  const stats = useQuery(['leadership_nominations', 'fl_participants'], () => repo.rpc.futureLeadersStats(), [me]);
  const canNominate = s.hasRole('hr_analyst', 'hr_director');
  const decider = s.can('talent_review', ['A']) || s.hasRole('training_manager');
  const tm = s.hasRole('training_manager');
  return (
    <Page title={t('m22.routes.leadership-future-leaders-manage.title')} intro={t('m22.flm.intro')} eyebrow={<L to="/leadership/future-leaders">{t('m22.flm.back')}</L>} wide>
      <div className="space-y-6">
        <BenchmarkChips feature="FS47" />
        <Async state={q}>
          {(d) => (
            <Tabs tabs={[
              { id: 'noms', label: t('m22.flm.tabNoms'), content: <Noms d={d} me={me} canNominate={canNominate} decider={decider} /> },
              { id: 'ready', label: t('m22.flm.tabReady'), content: <Ready d={d} /> },
              { id: 'roster', label: t('m22.flm.tabRoster'), content: <Roster d={d} me={me} tm={tm} reviewer={decider} /> },
              { id: 'stats', label: t('m22.flm.tabStats'), content: <Async state={stats} isEmpty={(x) => !x} empty={<EmptyState icon="lock" title={t('m22.flm.noStats')} />}>{(x) => <Stats st={x!} d={d} />}</Async> },
            ]} />
          )}
        </Async>
        <Callout title={t('m22.flm.rulesTitle')}>{t('m22.flm.rulesBody')}</Callout>
      </div>
    </Page>
  );
}

function Noms({ d, me, canNominate, decider }: { d: FlData; me: string | null; canNominate: boolean; decider: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState<{ n: Nom; decision: 'approved' | 'declined' } | null>(null);
  return (
    <div className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-ink-2">{t('m22.flm.nomsBody')}</p>
        {canNominate && <button className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m22-fl-nominate"><Icon name="plus" size={14} />{t('m22.flm.nominate')}</button>}
      </div>
      {d.noms.length === 0 ? <EmptyState icon="users" title={t('m22.flm.nomsEmpty')} /> : (
        <ul className="space-y-2" data-testid="m22-fl-noms">
          {d.noms.map((n) => {
            const blocked = n.nominated_by === me ? 'maker' : n.person_id === me ? 'self' : null;
            return (
              <li key={n.id} className="card p-3" data-testid="m22-fl-nom">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name')}</div>
                    <div className="text-[12.5px] text-ink-2">{t('m22.fl.cycle', { cycle: n.cycle })} · {t('m22.nom.by', { name: pick({ name_en: n.nominator_name, name_ar: n.nominator_name_ar }, 'name'), date: f.date(n.created_at) })}</div>
                  </div>
                  <NomPill status={n.status} />
                </div>
                <p className="mt-1 text-[13px]">“{n.reason}”</p>
                {n.status === 'nominated' && decider && (blocked ? <p className="mt-1 text-[12.5px] text-sim">{t(blocked === 'maker' ? 'm22.nom.blockedMaker' : 'm22.nom.blockedSelf')}</p> : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-primary btn-sm" onClick={() => setAct({ n, decision: 'approved' })} data-testid="m22-fl-select"><Icon name="check" size={14} />{t('m22.flm.select')}</button>
                    <button className="btn-outline btn-sm" onClick={() => setAct({ n, decision: 'declined' })}>{t('m22.nom.decline')}</button>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      <NominateFl open={open} onClose={() => setOpen(false)} me={me} />
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} danger={act?.decision === 'declined'} requireReason={act?.decision === 'declined'} reasonLabel={t('m22.nom.declineReason')}
        title={act?.decision === 'approved' ? t('m22.flm.selectTitle') : t('m22.nom.declineTitle')} consequence={t(act?.decision === 'approved' ? 'm22.flm.selectBody' : 'm22.nom.declineBody')}
        confirmLabel={act?.decision === 'approved' ? t('m22.flm.select') : t('m22.nom.decline')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.decideNomination(act.n.id, act.decision, reason)); }} />
    </div>
  );
}

function NominateFl({ open, onClose, me }: { open: boolean; onClose: () => void; me: string | null }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = useQuery(['people'], () => repo.list('people', { filter: { kind: 'staff', status: 'active' }, order: [['display_name', 'asc']] }).catch(() => []), [me]);
  const [person, setPerson] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = person && reason.trim().length >= 10 && reason.trim().length <= 500;
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={t('m22.flm.nominateTitle')}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || busy} data-testid="m22-fl-nominate-confirm" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.nominateFutureLeader(person, reason.trim())); if (r.ok) { setPerson(''); setReason(''); onClose(); } } finally { setBusy(false); }
        }}><Icon name="check" size={14} />{busy ? t('common.working') : t('m22.nominate.send')}</button>
      </>}>
      <div className="space-y-3">
        <SelectField label={t('m22.nominate.person')} name="fl-person" value={person} onChange={setPerson} placeholder={t('common.choose')}
          options={(people.data ?? []).filter((p) => p.id !== me).map((p) => ({ value: p.id, label: pick({ name_en: p.display_name, name_ar: p.display_name_ar || p.display_name }, 'name') }))} />
        <label className="block">
          <span className="caps">{t('m22.nominate.reason')}</span>
          <textarea className="input mt-1" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="m22-fl-nominate-reason" />
          <span className="text-[12px] text-ink-3">{t('m22.flm.reasonHint')}</span>
        </label>
        <Callout title={t('m22.nominate.makerChecker')}>{t('m22.flm.makerCheckerBody')}</Callout>
      </div>
    </Modal>
  );
}

function Ready({ d }: { d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const lab = useLabels(d.skills);
  const ids = useMemo(() => [...new Set(d.noms.filter((n) => n.status !== 'declined').map((n) => n.person_id))].sort(), [d.noms]);
  const rd = useQuery(['person_skills', 'leadership_nominations'], () => (ids.length ? repo.rpc.flReadiness(ids) : Promise.resolve([] as FlReadiness[])), [ids.join(',')]);
  const name = (pid: string) => { const n = d.noms.find((x) => x.person_id === pid); return n ? pick({ name_en: n.person_name, name_ar: n.person_name_ar }, 'name') : pid; };
  return (
    <div className="space-y-3 pt-4">
      <p className="text-[13.5px] text-ink-2">{t('m22.flm.readyBody')}</p>
      <Async state={rd} isEmpty={(x) => x.length === 0} empty={<EmptyState icon="users" title={t('m22.flm.readyEmpty')} />}>
        {(rows) => (
          <ul className="space-y-2" data-testid="m22-fl-ready-list">
            {[...rows].sort((a, b) => b.score - a.score || (a.person_id < b.person_id ? -1 : 1)).map((x) => (
              <li key={x.person_id} className="card grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_160px_60px_auto]">
                <span className="font-semibold">{name(x.person_id)}</span>
                <ProgressBar value={x.score * 100} label={t('m22.fl.readyTitle')} />
                <span className="num">{f.pct(x.score, 0)}</span>
                <WhyThis reasons={flReasons(x, d.comps, lab.skillBi)} testId="m22-why-fl-nominee" />
              </li>
            ))}
          </ul>
        )}
      </Async>
      <p className="text-[12px] text-ink-3">{t('m22.flm.readyNote')}</p>
    </div>
  );
}

function Roster({ d, me, tm, reviewer }: { d: FlData; me: string | null; tm: boolean; reviewer: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [rev, setRev] = useState<{ p: Part; decision: 'accept' | 'return' } | null>(null);
  const [view, setView] = useState<Part | null>(null);
  if (!d.parts.length) return <div className="pt-4"><EmptyState icon="users" title={t('m22.flm.rosterEmpty')} /></div>;
  return (
    <div className="space-y-6 pt-4">
      {d.cohorts.map((c) => {
        const parts = d.parts.filter((p) => p.cohort_id === c.id);
        if (!parts.length) return null;
        const modules = (c.modules ?? []) as { id: string; title_en: string; title_ar: string }[];
        const cols: Column<Part>[] = [
          { key: 'person', header: t('m22.nom.colPerson'), value: (p) => pick({ name_en: p.person_name, name_ar: p.person_name_ar }, 'name'), sortable: true },
          ...modules.map((m, i) => ({
            key: m.id, header: t('m22.flm.moduleN', { n: i + 1 }), value: (p: Part) => (p.modules_done.includes(m.id) ? 1 : 0),
            render: (p: Part) => {
              const done = p.modules_done.includes(m.id);
              return tm && c.status === 'running' && p.status === 'active'
                ? <input type="checkbox" checked={done} aria-label={t('m22.flm.moduleAria', { module: pick(m, 'title'), person: pick({ name_en: p.person_name, name_ar: p.person_name_ar }, 'name') })} onChange={(e) => run(() => repo.rpc.recordFlModule(p.nomination_id, m.id, e.target.checked))} data-testid="m22-fl-module-toggle" />
                : <Icon name={done ? 'check' : 'close'} size={13} className={done ? 'text-ok' : 'text-ink-3'} />;
            },
          })),
          { key: 'project', header: t('m22.flm.colProject'), value: (p) => p.project_status, render: (p) => <ProjectPill status={p.project_status} />, sortable: true },
          { key: 'actions', header: t('m22.flm.colActions'), value: () => '', render: (p) => (
            <span className="flex flex-wrap gap-1.5">
              {p.project_title && <button className="btn-ghost btn-sm" onClick={() => setView(p)}>{t('m22.flm.read')}</button>}
              {reviewer && p.project_status === 'submitted' && p.person_id !== me && <>
                <button className="btn-primary btn-sm" onClick={() => setRev({ p, decision: 'accept' })} data-testid="m22-fl-accept">{t('m22.flm.accept')}</button>
                <button className="btn-outline btn-sm" onClick={() => setRev({ p, decision: 'return' })}>{t('m22.flm.return')}</button>
              </>}
            </span>
          ) },
        ];
        return (
          <Section key={c.id} title={pick(c, 'title')} actions={<CohortPill status={c.status} />} description={t('m22.fl.cohortDates', { from: f.date(c.starts_on), to: f.date(c.ends_on), seats: f.num(c.seats) })}>
            <DataTable rows={parts} columns={cols} rowKey={(p) => p.id} caption={pick(c, 'title')} csvName={`future-leaders-${c.code}.csv`} />
          </Section>
        );
      })}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.project_title ?? ''} size="lg">
        {view && <div className="space-y-2 text-[13.5px]" data-testid="m22-fl-project-view">
          <p><span className="caps me-1">{t('m22.fl.pQuestion')}</span>{view.project_question}</p>
          <p>{view.project_summary}</p>
          <p className="text-ink-2"><span className="caps me-1">{t('m22.fl.pSponsor')}</span>{view.project_sponsor_role}</p>
          {view.project_review_note && <Callout title={t('m22.fl.reviewNote')}>{view.project_review_note}</Callout>}
        </div>}
      </Modal>
      <ConfirmDialog open={!!rev} onClose={() => setRev(null)} requireReason={rev?.decision === 'return'} reasonLabel={t('m22.flm.returnNote')}
        title={rev?.decision === 'accept' ? t('m22.flm.acceptTitle') : t('m22.flm.returnTitle')} consequence={t(rev?.decision === 'accept' ? 'm22.flm.acceptBody' : 'm22.flm.returnBody')}
        confirmLabel={rev?.decision === 'accept' ? t('m22.flm.accept') : t('m22.flm.return')}
        onConfirm={async (note) => { if (rev) await run(() => repo.rpc.reviewPolicyProject(rev.p.nomination_id, rev.decision, note)); }} />
    </div>
  );
}

function Stats({ st, d }: { st: NonNullable<Awaited<ReturnType<ReturnType<typeof useRepo>['rpc']['futureLeadersStats']>>>; d: FlData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const num = (v: number) => f.num(v);
  return (
    <div className="space-y-6 pt-4" data-testid="m22-fl-stats">
      <Section title={t('m22.flm.statsNoms')} description={t('m22.flm.statsSub')}>
        <Grid cols={4}>
          {st.nominations.map((x) => <StatTile key={x.status} label={t(`m22.nomStatus.${x.status}`)} value={x.suppressed ? t('common.suppressedShort') : f.num(x.n!)} sub={x.suppressed ? t('common.suppressed') : undefined} />)}
        </Grid>
      </Section>
      {st.cohorts.map((c) => {
        const cohort = d.cohorts.find((x) => x.id === c.id);
        const mods = (cohort?.modules ?? []) as { id: string; title_en: string; title_ar: string }[];
        return (
          <Section key={c.id} title={cohort ? pick(cohort, 'title') : c.id}>
            <Grid cols={3}>
              <StatTile label={t('m22.flm.participants')} value={<Cell n={c.participants} fmt={num} />} sub={c.suppressed ? t('common.suppressed') : undefined} />
              <StatTile label={t('m22.flm.completed')} value={<Cell n={c.completed} fmt={num} />} sub={c.completed_suppressed ? t('common.suppressed') : undefined} />
              <StatTile label={t('m22.flm.projectsAccepted')} value={<Cell n={c.projects.find((p) => p.status === 'accepted')?.n ?? null} fmt={num} />} />
            </Grid>
            <ul className="mt-3 grid grid-cols-1 gap-1 text-[12.5px] sm:grid-cols-2">
              {c.modules.map((m) => { const mm = mods.find((x) => x.id === m.id); return <li key={m.id} className="flex justify-between gap-2 border-b border-line py-1"><span>{mm ? pick(mm, 'title') : m.id}</span><span className="num"><Cell n={m.done} fmt={num} /></span></li>; })}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
