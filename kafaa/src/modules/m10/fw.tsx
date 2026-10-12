// FS67 Fellowships and sponsored placements: shared UI parts. Completion rate is always the headline: an award count is rendered only by
// CompletionPair, which always shows the completion rate (or "suppressed") beside it. Rules: ./fellowship.ts.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { ConfirmDialog, DataTable, Icon, StatusPill, TextArea, type PillTone } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { FW_MIN, isOverdue, type FwStats, type StatCell } from './fellowship';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useFwStats(allowed: boolean) {
  const repo = useRepo();
  return useQuery(['fellowships', 'fellowship_milestones'], async () => {
    if (!allowed) return null;
    const r = await repo.rpc.fellowshipStats();
    return r.ok && r.data ? r.data : null; // null: no aggregate grant (a fellow without a staff role); the page explains it
  }, [allowed]);
}

/** The completion rate with the award count beside it. Never renders an award count on its own. */
export function CompletionPair({ cell, big }: { cell: StatCell; big?: boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" data-testid="m10-fw-pair">
      <span data-testid="m10-fw-rate" className={big ? 'num text-[30px] font-semibold' : 'num font-semibold'}>{cell.rate == null ? t('m10.fw.suppressed', { n: FW_MIN }) : f.pct(cell.rate, 0)}</span>
      <span className="text-[12.5px] text-ink-3" data-testid="m10-fw-awarded">
        {cell.rate == null ? t('m10.fw.awardedSuppressed') : t('m10.fw.awardedLine', { awarded: cell.awarded == null ? t('m10.fw.lt', { n: FW_MIN }) : f.num(cell.awarded), due: f.num(cell.due ?? 0) })}
      </span>
    </div>
  );
}

export function StatsTable({ title, cells, label }: { title: string; cells: StatCell[]; label: (k: string) => string }) {
  const t = useT();
  return (
    <div className="rounded-card border border-line p-3" data-testid="m10-fw-breakdown">
      <div className="caps mb-2">{title}</div>
      <ul className="space-y-2">
        {cells.map((c) => (
          <li key={c.key} className="flex flex-wrap items-baseline justify-between gap-2" data-testid={`m10-fw-cell-${c.key}`} data-suppressed={c.suppressed ? 'yes' : 'no'}>
            <span className="text-[13.5px]">{label(c.key)}</span>
            {c.suppressed ? <StatusPill tone="sim">{t('m10.fw.suppressed', { n: FW_MIN })}</StatusPill> : <CompletionPair cell={c} />}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] text-ink-3">{t('m10.fw.cellNote', { n: FW_MIN })}</p>
    </div>
  );
}

export function useFwLabels() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['research_challenges', 'adv_technologies', 'organisations'], async () => {
    const [rc, adv, orgs] = await Promise.all([repo.list('research_challenges'), repo.list('adv_technologies'), repo.list('organisations')]);
    return { rc: rc as Row[], adv: adv as Row[], orgs: orgs as Row[] };
  });
  return {
    ready: !!q.data,
    host: (f: Row) => {
      if (f.host_kind === 'research_challenge') return pick(q.data?.rc.find((r) => r.id === f.host_ref), 'title') || f.host_ref;
      const a = q.data?.adv.find((x) => x.id === f.host_ref);
      return a ? `${pick(a, 'family')} · ${t('m10.fw.advance')}` : f.host_ref;
    },
    org: (id: string | null | undefined) => (id ? pick(q.data?.orgs.find((o) => o.id === id), 'name') || id : t('m10.fw.enecOnly')),
    key: (k: string) => (k === 'enec' ? t('m10.fw.enecOnly') : k === 'all' ? t('m10.fw.all') : pick(q.data?.orgs.find((o) => o.id === k), 'name') || t(`m10.fw.k.${k}`)),
  };
}

const FW_TONE: Record<string, PillTone> = { active: 'info', completed: 'ok', withdrawn: 'neutral' };
export function FwStatusPill({ f }: { f: Row }) {
  const t = useT();
  return <StatusPill tone={FW_TONE[f.status]}><span data-testid="m10-fw-status">{t(`m10.fw.st.${f.status}`)}</span></StatusPill>;
}

/** Milestones with the actions the signed-in person may take (the backend still decides). */
export function MilestoneList({ f, ms, me, hr, uniOrg }: { f: Row; ms: Row[]; me: string | null; hr: boolean; uniOrg: string | null }) {
  const t = useT();
  const fm = useFormat();
  const repo = useRepo();
  const run = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [ask, setAsk] = useState<{ m: Row; action: 'submit' | 'sign_off' | 'return' } | null>(null);
  const [note, setNote] = useState('');
  const sorted = [...ms].sort((a, b) => a.n - b.n);
  const canSubmit = (m: Row) => f.status === 'active' && m.status === 'planned' && (me === f.fellow_person_id || (m.owner === 'university' && !!uniOrg && uniOrg === f.university_org_id));
  const canSign = (m: Row) => f.status === 'active' && m.status === 'submitted' && (hr || me === f.supervisor_person_id);
  return (
    <div data-testid="m10-fw-milestones">
      <DataTable rows={sorted} rowKey={(m) => m.id} searchable={false} pageSize={10} columns={[
        { key: 'n', header: '#', value: (m) => m.n, render: (m) => <span className="num">{fm.num(m.n)}</span> },
        { key: 'kind', header: t('m10.fw.ms.milestone'), value: (m) => t(`m10.fw.ms.k.${m.kind}`), render: (m) => <span>{t(`m10.fw.ms.k.${m.kind}`)} <span className="chip border-line bg-sunken text-[11px] text-ink-2">{t(`m10.fw.ms.owner.${m.owner}`)}</span></span> },
        { key: 'due', header: t('m10.fw.ms.due'), value: (m) => m.due_on, render: (m) => <span>{fm.date(m.due_on)} {isOverdue(m, f, today) && <StatusPill tone="bad">{t('m10.fw.ms.overdue')}</StatusPill>}</span> },
        { key: 'status', header: t('m10.fw.ms.status'), value: (m) => m.status, render: (m) => <StatusPill tone={m.status === 'signed_off' ? 'ok' : m.status === 'submitted' ? 'info' : 'neutral'}><span data-testid={`m10-fw-ms-status-${m.n}`} data-status={m.status}>{t(`m10.fw.ms.st.${m.status}`)}</span></StatusPill> },
        { key: 'act', header: t('m10.fw.ms.action'), csv: false, render: (m) => (
          <span className="flex flex-wrap gap-1">
            {canSubmit(m) && <button type="button" className="btn-primary btn-sm" onClick={() => { setNote(''); setAsk({ m, action: 'submit' }); }} data-testid={`m10-fw-submit-${m.n}`}>{t('m10.fw.ms.submit')}</button>}
            {canSign(m) && m.submitted_by !== me && <button type="button" className="btn-primary btn-sm" onClick={() => { setNote(''); setAsk({ m, action: 'sign_off' }); }} data-testid={`m10-fw-sign-${m.n}`}><Icon name="check" size={14} />{t('m10.fw.ms.signOff')}</button>}
            {canSign(m) && <button type="button" className="btn-outline btn-sm" onClick={() => { setNote(''); setAsk({ m, action: 'return' }); }} data-testid={`m10-fw-return-${m.n}`}>{t('m10.fw.ms.return')}</button>}
            {m.return_note && m.status === 'planned' && <span className="text-[12px] text-ink-3">{t('m10.fw.ms.returned')}: {m.return_note}</span>}
          </span>
        ) },
      ]} />
      <ConfirmDialog open={!!ask} onClose={() => setAsk(null)} title={ask ? t(`m10.fw.ms.${ask.action === 'sign_off' ? 'signOff' : ask.action}`) : ''}
        consequence={ask ? t(`m10.fw.ms.consequence.${ask.action}`) : ''} confirmLabel={ask ? t(`m10.fw.ms.${ask.action === 'sign_off' ? 'signOff' : ask.action}`) : ''}
        onConfirm={async () => { if (ask) await run(() => repo.rpc.updateMilestone(ask.m.id, ask.action, note)); setAsk(null); }}>
        {ask && ask.action !== 'sign_off' && <TextArea label={t('m10.fw.ms.note')} name="note" value={note} onChange={setNote} rows={3} hint={ask.action === 'return' ? t('m10.fw.ms.noteHint') : undefined} />}
      </ConfirmDialog>
    </div>
  );
}

export type { FwStats };
