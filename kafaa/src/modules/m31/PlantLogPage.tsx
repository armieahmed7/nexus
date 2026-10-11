// FS39 /my/plant-log (skills_profile Own): my reference-plant log. I log a reference-plant visit, a simulator observation or a visit to
// a partner's reference plant (date, hours, a short note without contact details) and name the host who was there (an ENEC instructor,
// training manager or line manager, never myself). The host confirms or declines on the "To confirm" tab (maker-checker). Only a
// confirmed visit writes F01 evidence for technology literacy (kind ojt, basis validated, level 1, or 2 once 12 confirmed hours span two
// kinds); logged, declined and withdrawn visits write none. RPCs: plantHosts, logVisit, confirmVisit, withdrawVisit.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, StatTile, StatusPill, Tabs, Modal, ConfirmDialog, WhyThis, BenchmarkChips, BenchmarkLine, SelectField, TextField, TextArea, RadioGroup, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { L, useFormat, usePick, useT } from '../../i18n';
import { L2_HOURS, MAX_HOURS, MIN_HOURS, VISIT_KINDS, logSummary, visitProblem, type VisitInput } from './literacy';
import type { PlantHost } from './backend/rpc';
import type { Reason } from '../../domain/engines/types';
import { SimNote, type Row } from './ui';

function useLog(personId: string | null) {
  const repo = useRepo();
  return useQuery(['plant_visits', 'skill_evidence'], async () => {
    const none = '__none__';
    const [mine, hosting, hosts] = await Promise.all([
      (repo.list('plant_visits', { filter: { person_id: personId ?? none }, order: [['visit_on', 'desc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('plant_visits', { filter: { host_person_id: personId ?? none }, order: [['visit_on', 'desc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      repo.rpc.plantHosts().catch(() => [] as PlantHost[]),
    ]);
    const visitorIds = [...new Set(hosting.map((v) => v.person_id as string))];
    const visitors = await Promise.all(visitorIds.map((id) => (repo.get('people', id) as Promise<Row | null>).catch(() => null)));
    return { mine, hosting, hosts, visitors: new Map(visitorIds.map((id, i) => [id, visitors[i]])) };
  }, [personId]);
}

export default function PlantLogPage() {
  const t = useT();
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const q = useLog(s.identity.personId);
  const tab = sp.get('tab') === 'host' ? 'host' : 'mine';
  return (
    <Page title={t('m31.routes.my-plant-log.title')} intro={t('m31.pv.intro')} wide eyebrow={<BenchmarkChips feature="FS39" />}
      actions={<L to="/learn/plant-literacy" className="btn-outline btn-sm no-underline">{t('m31.pv.toExplainer')}</L>}>
      <Async state={q}>{(d) => (
        <Tabs value={tab} onChange={(id) => { const n = new URLSearchParams(sp); if (id === 'host') n.set('tab', 'host'); else n.delete('tab'); setSp(n, { replace: true }); }}
          tabs={[
            { id: 'mine', label: <span data-testid="m31-pv-tab-mine">{t('m31.pv.tab.mine')}</span>, content: <Mine visits={d.mine} hosts={d.hosts} /> },
            { id: 'host', label: <span data-testid="m31-pv-tab-host">{t('m31.pv.tab.host')} {d.hosting.filter((v) => v.status === 'logged').length > 0 && <span className="num ms-1 rounded-full bg-[rgb(var(--accent))] px-1.5 text-[11px] text-white">{d.hosting.filter((v) => v.status === 'logged').length}</span>}</span>, content: <Hosting visits={d.hosting} visitors={d.visitors} /> },
          ]} />
      )}</Async>
    </Page>
  );
}

function Mine({ visits, hosts }: { visits: Row[]; hosts: PlantHost[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const sum = logSummary(visits as never);
  const hostName = (id: string) => { const h = hosts.find((x) => x.person_id === id); return h ? pick(h as unknown as Row, 'name') : id; };
  const reasons: Reason[] = [
    { code: 'fs39_confirmed', key: 'm31.pv.reason.confirmed', vars: { n: sum.confirmed, hours: sum.hours } },
    { code: 'fs39_kinds', key: 'm31.pv.reason.kinds', vars: { kinds: sum.kinds } },
    { code: sum.level === 2 ? 'fs39_level2' : 'fs39_level1', key: sum.level === 2 ? 'm31.pv.reason.level2' : sum.level === 1 ? 'm31.pv.reason.level1' : 'm31.pv.reason.level0', vars: { need: L2_HOURS, left: sum.toL2 } },
    { code: 'fs39_pending', key: 'm31.pv.reason.pending', vars: { n: sum.pending } },
  ];
  return (
    <div className="space-y-5 pt-2" data-testid="m31-pv-mine">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m31-pv-tiles">
        <StatTile label={t('m31.pv.tile.confirmed')} value={f.num(sum.confirmed)} tone="ok" sub={t('m31.pv.tile.hours', { n: f.num(sum.hours) })} />
        <StatTile label={t('m31.pv.tile.pending')} value={f.num(sum.pending)} sub={t('m31.pv.tile.pendingSub')} />
        <StatTile label={t('m31.pv.tile.kinds')} value={`${f.num(sum.kinds)} / ${f.num(VISIT_KINDS.length)}`} />
        <StatTile label={t('m31.pv.tile.level')} value={sum.level ? t('m31.pv.levelN', { n: f.num(sum.level) }) : '—'} sub={t('m31.pv.tile.levelSub')} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <BenchmarkLine value={Math.min(L2_HOURS, sum.hours)} max={L2_HOURS} unit="count" label={t('m31.pv.toL2', { n: f.num(L2_HOURS) })} lines={[{ kind: 'target', label: t('m31.pv.l2Line'), value: L2_HOURS }]} />
            <WhyThis reasons={reasons} testId="m31-pv-why" />
          </div>
          <button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="m31-pv-log"><Icon name="plus" size={14} /> {t('m31.pv.log')}</button>
        </div>
      </Card>
      <Callout tone="info" title={t('m31.pv.rulesTitle')}>{t('m31.pv.rulesBody')}</Callout>
      {visits.length === 0 ? <EmptyState title={t('m31.pv.none')}>{t('m31.pv.noneBody')}</EmptyState> : (
        <ul className="space-y-2" data-testid="m31-pv-list">
          {visits.map((v) => (
            <li key={v.id} className="card flex flex-wrap items-start justify-between gap-3 p-3" data-testid="m31-pv-row" data-id={v.id} data-status={v.status}>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t(`m31.pv.kind.${v.kind}`)}</span><StatusPill tone={tone(v.status)}>{t(`m31.pv.st.${v.status}`)}</StatusPill>
                  {v.status === 'confirmed' && <span className="chip border-accent/30 bg-accent-soft normal-case tracking-normal text-eyebrow" data-testid="m31-pv-evidence">{t('m31.pv.evidence', { n: f.num(v.level) })}</span>}</div>
                <p className="text-[12.5px] text-ink-2">{t('m31.pv.line', { date: f.date(v.visit_on), hours: f.num(Number(v.hours)), host: hostName(v.host_person_id) })}</p>
                {v.note && <p className="text-[12.5px] text-ink-3">{v.note}</p>}
                {v.status === 'declined' && v.decline_reason && <p className="text-[12.5px] text-bad">{t('m31.pv.declinedBecause', { reason: v.decline_reason })}</p>}
              </div>
              {v.status === 'logged' && <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(v)} data-testid="m31-pv-withdraw">{t('m31.pv.withdraw')}</button>}
            </li>
          ))}
        </ul>
      )}
      <SimNote>{t('m31.pv.syntheticNote')}</SimNote>
      {open && <LogModal hosts={hosts} onClose={() => setOpen(false)} />}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m31.pv.withdrawTitle')} consequence={t('m31.pv.withdrawBody')} danger
        onConfirm={async () => { if (withdraw) await act(() => repo.rpc.withdrawVisit(withdraw.id)); setWithdraw(null); }} />
    </div>
  );
}

const tone = (s: string) => (s === 'confirmed' ? 'ok' : s === 'logged' ? 'info' : s === 'declined' ? 'bad' : 'neutral');

function LogModal({ hosts, onClose }: { hosts: PlantHost[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [v, setV] = useState({ kind: 'reference_plant', host_person_id: '', visit_on: today, hours: '4', note: '' });
  const [confirm, setConfirm] = useState(false);
  const input: VisitInput = { kind: v.kind, host_person_id: v.host_person_id, visit_on: v.visit_on, hours: Number(v.hours), note: v.note };
  const problem = useMemo(() => (v.host_person_id ? visitProblem(input, today) : 'host'), [v, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const host = hosts.find((h) => h.person_id === v.host_person_id);
  return (
    <Modal open onClose={onClose} title={t('m31.pv.logTitle')} size="lg"
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[12.5px] ${problem ? 'text-bad' : 'text-ok'}`} role="status" data-testid="m31-pv-check" data-problem={problem ?? ''}>{problem ? t(`m31.pv.problem.${problem}`) : t('m31.pv.ready')}</span>
        <div className="flex gap-2"><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m31-pv-submit">{t('m31.pv.send')}</button></div>
      </div>}>
      <div className="space-y-3" data-testid="m31-pv-form">
        <RadioGroup label={t('m31.pv.kindLabel')} name="kind" value={v.kind} onChange={(k) => setV({ ...v, kind: k })} options={VISIT_KINDS.map((k) => ({ value: k, label: <span><strong>{t(`m31.pv.kind.${k}`)}</strong> <span className="text-ink-3">{t(`m31.pv.kindHelp.${k}`)}</span></span> }))} />
        <SelectField label={t('m31.pv.hostLabel')} name="host" value={v.host_person_id} onChange={(h) => setV({ ...v, host_person_id: h })} hint={t('m31.pv.hostHint')}
          options={hosts.map((h) => ({ value: h.person_id, label: `${pick(h as unknown as Row, 'name')} · ${t(`m31.pv.hostRole.${h.role}`)}` }))} />
        {hosts.length === 0 && <p className="text-[12.5px] text-ink-3">{t('m31.pv.noHosts')}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m31.pv.dateLabel')} name="visit_on" type="date" value={v.visit_on} onChange={(x) => setV({ ...v, visit_on: x })} hint={t('m31.pv.dateHint')} />
          <TextField label={t('m31.pv.hoursLabel')} name="hours" type="number" value={v.hours} onChange={(x) => setV({ ...v, hours: x })} hint={t('m31.pv.hoursHint', { min: MIN_HOURS, max: MAX_HOURS })} />
        </div>
        <TextArea label={t('m31.pv.noteLabel')} name="note" rows={3} value={v.note} onChange={(x) => setV({ ...v, note: x })} hint={t('m31.pv.noteHint')} />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m31.pv.confirmTitle')}
        consequence={t('m31.pv.confirmBody', { host: host ? pick(host as unknown as Row, 'name') : '' })}
        onConfirm={async () => { const r = await act(() => repo.rpc.logVisit(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </Modal>
  );
}

function Hosting({ visits, visitors }: { visits: Row[]; visitors: Map<string, Row | null> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [decide, setDecide] = useState<{ v: Row; decision: 'confirm' | 'decline' } | null>(null);
  const pending = visits.filter((v) => v.status === 'logged');
  const done = visits.filter((v) => v.status !== 'logged');
  const who = (id: string) => (visitors.get(id) ? pick(visitors.get(id)!, 'display_name') || visitors.get(id)!.display_name : t('m31.pv.aColleague'));
  const Item = ({ v, actions }: { v: Row; actions?: boolean }) => (
    <li className="card flex flex-wrap items-start justify-between gap-3 p-3" data-testid="m31-pv-host-row" data-id={v.id} data-status={v.status}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{who(v.person_id)}</span><span className="text-[12.5px] text-ink-2">{t(`m31.pv.kind.${v.kind}`)}</span><StatusPill tone={tone(v.status)}>{t(`m31.pv.st.${v.status}`)}</StatusPill></div>
        <p className="text-[12.5px] text-ink-2">{t('m31.pv.hostLine', { date: f.date(v.visit_on), hours: f.num(Number(v.hours)) })}</p>
        {v.note && <p className="text-[12.5px] text-ink-3">{v.note}</p>}
      </div>
      {actions && (
        <div className="flex gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => setDecide({ v, decision: 'confirm' })} data-testid="m31-pv-confirm">{t('m31.pv.confirm')}</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => setDecide({ v, decision: 'decline' })} data-testid="m31-pv-decline">{t('m31.pv.decline')}</button>
        </div>
      )}
    </li>
  );
  return (
    <div className="space-y-5 pt-2" data-testid="m31-pv-host">
      <Callout tone="info" title={t('m31.pv.hostTitle')}>{t('m31.pv.hostBody')}</Callout>
      {pending.length === 0 ? <EmptyState title={t('m31.pv.hostNone')} /> : <ul className="space-y-2">{pending.map((v) => <Item key={v.id} v={v} actions />)}</ul>}
      {done.length > 0 && <Card title={t('m31.pv.hostDone')}><ul className="space-y-2">{done.map((v) => <Item key={v.id} v={v} />)}</ul></Card>}
      <ConfirmDialog open={!!decide} onClose={() => setDecide(null)} requireReason={decide?.decision === 'decline'} reasonLabel={t('m31.pv.declineReason')}
        title={decide?.decision === 'decline' ? t('m31.pv.declineTitle') : t('m31.pv.confirmVisitTitle')} danger={decide?.decision === 'decline'}
        consequence={decide?.decision === 'decline' ? t('m31.pv.declineBody') : t('m31.pv.confirmVisitBody')}
        onConfirm={async (reason) => { if (decide) await act(() => repo.rpc.confirmVisit({ visit_id: decide.v.id, decision: decide.decision, reason: reason || null })); setDecide(null); }} />
    </div>
  );
}
