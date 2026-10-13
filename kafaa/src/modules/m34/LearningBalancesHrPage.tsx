// FS78 /workforce/learning-balances · Learning balances for HR (workforce_strategy R/W/A: HR analyst, HR director, admin, auditors). The
// published grant rule (base grant, mid-career top-up from years of service, never age), organisation totals, use by entity and job family
// (any group under 10 people is suppressed), and every request waiting for a decision. The HR authority (hr_director) can decide when the
// line manager cannot (maker-checker: never their own); everyone else reads. SIMULATED.
import { useMemo, useState } from 'react';
import { Async, BarChart, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, EmptyState, KeyValue, Page, Section, StatTile, Tabs, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { BASE_HOURS, MID_CAREER_YEARS, TOPUP_HOURS, balanceOf, balanceStats, checkDecide, type RequestLite } from './balance';
import { Fs91Footer, StudyStatus, isoToday, useCreditsOf, useFs91Act, type Row } from './fs91ui';

export default function LearningBalancesHrPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['learning_balances', 'study_time_requests'], async () => {
    const [bals, reqs, fams] = await Promise.all([
      repo.list('learning_balances', { order: [['person_id', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('study_time_requests', { order: [['created_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('job_families', {}).catch(() => []) as Promise<Row[]>,
    ]);
    return { bals, reqs, fams };
  }, []);
  return (
    <Page title={t('m34.routes.workforce-learning-balances.title')} eyebrow={t('m34.sb.hrEyebrow')} intro={t('m34.sb.hrIntro')} wide>
      <div data-testid="m34-sb-bench"><BenchmarkChips feature="FS78" /></div>
      <Async state={q}>{(d) => <Body d={d} />}</Async>
      <Fs91Footer />
    </Page>
  );
}

function Body({ d }: { d: { bals: Row[]; reqs: Row[]; fams: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const c = useCreditsOf();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const isHr = s.hasRole('hr_director');
  const repo = useRepo();
  const run = useFs91Act();
  const today = isoToday();
  const [dlg, setDlg] = useState<{ r: Row; d: 'approve' | 'decline' } | null>(null);
  const [by, setBy] = useState<'entity' | 'family'>('entity');
  const byPerson = useMemo(() => new Map(d.bals.map((b) => [b.person_id, b])), [d.bals]);
  const famName = (id: string) => pick(d.fams.find((x) => x.id === id), 'name') || id;
  const groupOf = (pid: string) => (by === 'entity' ? byPerson.get(pid)?.entity_id : byPerson.get(pid)?.job_family_id) ?? 'other';
  const stats = balanceStats(d.bals as never, groupOf, MIN_GROUP_SIZE);
  const label = (k: string) => (by === 'entity' ? t(`m34.sb.entity.${k}`) === `m34.sb.entity.${k}` ? k : t(`m34.sb.entity.${k}`) : famName(k));
  const tot = d.bals.reduce((a, b) => ({ g: a.g + Number(b.granted_hours), u: a.u + Number(b.used_hours), p: a.p + Number(b.pending_hours), top: a.top + (b.topup_hours > 0 ? 1 : 0) }), { g: 0, u: 0, p: 0, top: 0 });
  const waiting = d.reqs.filter((r) => r.status === 'requested');
  const decided = d.reqs.filter((r) => r.status !== 'requested');
  const name = (r: Row) => pick({ n_en: r.person_name, n_ar: r.person_name_ar }, 'n');
  const remainingOf = (r: Row) => { const b = byPerson.get(r.person_id); return b ? balanceOf(b as never, d.reqs as RequestLite[]).remaining_hours : 0; };
  const reqCols = (act: boolean): Column<Row>[] => [
    { key: 'who', header: t('m34.sb.colPerson'), value: (r) => name(r), sortable: true, render: (r) => <span className="font-semibold">{name(r)}</span> },
    { key: 'lm', header: t('m34.sb.colManager'), value: (r) => r.line_manager_name ?? '', render: (r) => r.line_manager_name || '—' },
    { key: 'item', header: t('m34.sb.colItem'), value: (r) => pick(r, 'resource_title'), sortable: true },
    { key: 'hours', header: t('m34.sb.colHours'), value: (r) => Number(r.hours), sortable: true, render: (r) => <span className="num">{t('m34.sb.hoursCredits', { h: f.num(r.hours), c: c(r.hours) })}</span> },
    { key: 'when', header: t('m34.sb.colWhen'), value: (r) => String(r.starts_on), sortable: true, render: (r) => <span className="whitespace-nowrap">{f.date(String(r.starts_on).slice(0, 10))}</span> },
    { key: 'status', header: t('m34.sb.colStatus'), value: (r) => r.status, render: (r) => <span className="flex flex-wrap gap-1"><StudyStatus status={r.status} />{r.decided_role === 'hr_director' && <span className="chip border-line bg-sunken text-ink-2">{t('m34.sb.byHr')}</span>}</span> },
    ...(act && isHr ? [{ key: 'act', header: '', value: () => '', render: (r: Row) => {
      const ok = checkDecide({ decision: 'approve' }, r as RequestLite, me, { today, hr: true, remaining: remainingOf(r) });
      return (
        <span className="flex flex-wrap gap-1">
          <button type="button" className="btn-outline btn-sm" disabled={ok !== 'ok'} title={ok !== 'ok' ? t(`m34.sbmsg.${ok}`) : undefined} onClick={() => setDlg({ r, d: 'approve' })} data-testid={`m34-sb-hr-approve-${r.id}`}>{t('m34.sb.approve')}</button>
          <button type="button" className="btn-ghost btn-sm" disabled={r.person_id === me} onClick={() => setDlg({ r, d: 'decline' })} data-testid={`m34-sb-hr-decline-${r.id}`}>{t('m34.sb.decline')}</button>
        </span>
      );
    } } as Column<Row>] : []),
  ];
  const statCols: Column<(typeof stats)[number]>[] = [
    { key: 'g', header: by === 'entity' ? t('m34.sb.colEntity') : t('m34.sb.colFamily'), value: (x) => label(x.key), sortable: true },
    { key: 'n', header: t('m34.sb.colPeople'), value: (x) => x.people ?? -1, render: (x) => (x.suppressed ? <span className="text-ink-3">{t('m34.sb.suppressed')}</span> : f.num(x.people)) },
    { key: 'granted', header: t('m34.sb.tGranted'), value: (x) => x.granted ?? -1, render: (x) => (x.suppressed ? '—' : c(x.granted)) },
    { key: 'used', header: t('m34.sb.tUsed'), value: (x) => x.used ?? -1, render: (x) => (x.suppressed ? '—' : c(x.used)) },
    { key: 'pct', header: t('m34.sb.colUsedPct'), value: (x) => x.usedPct ?? -1, render: (x) => (x.suppressed ? '—' : f.pct(x.usedPct, 0)) },
    { key: 'top', header: t('m34.sb.colTopups'), value: (x) => x.topup ?? -1, render: (x) => (x.suppressed ? '—' : f.num(x.topup)) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-sb-hr-tiles">
        <StatTile label={t('m34.sb.tPeople')} value={f.num(d.bals.length)} sub={t('m34.sb.tPeopleSub', { n: f.num(tot.top) })} sim />
        <StatTile label={t('m34.sb.tGranted')} value={t('m34.sb.credits', { c: c(tot.g) })} sub={t('m34.sb.hours', { h: f.num(tot.g) })} />
        <StatTile label={t('m34.sb.tUsed')} value={t('m34.sb.credits', { c: c(tot.u) })} sub={t('m34.sb.usedPct', { p: f.pct(tot.g ? (tot.u / tot.g) * 100 : 0, 0) })} tone="ok" />
        <StatTile label={t('m34.sb.tWaiting')} value={f.num(waiting.length)} sub={t('m34.sb.hours', { h: f.num(tot.p) })} tone="info" />
      </div>
      <Card title={t('m34.sb.ruleTitle')}>
        <div data-testid="m34-sb-rule">
          <KeyValue items={[
            [t('m34.sb.ruleBase'), t('m34.sb.ruleBaseV', { c: f.num(BASE_HOURS / 10), h: f.num(BASE_HOURS) })],
            [t('m34.sb.ruleTopup'), t('m34.sb.ruleTopupV', { c: f.num(TOPUP_HOURS / 10), y: f.num(MID_CAREER_YEARS) })],
            [t('m34.sb.ruleSpend'), t('m34.sb.ruleSpendV')],
            [t('m34.sb.ruleDecide'), t('m34.sb.ruleDecideV')],
          ]} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m34.sb.ruleNever')}</p>
        </div>
      </Card>
      <Section title={t('m34.sb.useTitle')} description={t('m34.sb.useDesc', { n: f.num(MIN_GROUP_SIZE) })}
        actions={<span className="flex gap-1"><button type="button" className={by === 'entity' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setBy('entity')}>{t('m34.sb.byEntity')}</button><button type="button" className={by === 'family' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setBy('family')} data-testid="m34-sb-by-family">{t('m34.sb.byFamily')}</button></span>}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div data-testid="m34-sb-stats"><DataTable rows={stats} columns={statCols} rowKey={(x) => x.key} pageSize={12} caption={t('m34.sb.useTitle')} searchable={false} /></div>
          {stats.some((x) => !x.suppressed) ? <BarChart title={t('m34.sb.chartTitle')} unit="%" max={100} data={stats.filter((x) => !x.suppressed).map((x) => ({ label: label(x.key), value: x.usedPct ?? 0 }))} /> : <EmptyState title={t('m34.sb.allSuppressed')} />}
        </div>
      </Section>
      <Section title={t('m34.sb.hrQueueTitle')}>
        {isHr ? <Callout tone="info" title={t('m34.sb.hrDecideTitle')}>{t('m34.sb.hrDecideBody')}</Callout> : <Callout tone="sim" title={t('m34.sb.readOnlyTitle')}>{t('m34.sb.readOnlyBody')}</Callout>}
        <div className="mt-3" data-testid="m34-sb-hr-queue">
          <Tabs tabs={[
            { id: 'waiting', label: t('m34.sb.tabWaiting'), badge: waiting.length || undefined, content: waiting.length ? <DataTable rows={waiting} columns={reqCols(true)} rowKey={(r) => r.id} pageSize={10} caption={t('m34.sb.tabWaiting')} /> : <EmptyState title={t('m34.sb.queueEmpty')} /> },
            { id: 'all', label: t('m34.sb.tabAll'), content: <DataTable rows={decided} columns={reqCols(false)} rowKey={(r) => r.id} pageSize={10} caption={t('m34.sb.tabAll')} csvName="kafaa-study-time.csv" /> },
          ]} />
        </div>
      </Section>
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} title={dlg?.d === 'approve' ? t('m34.sb.approveTitle') : t('m34.sb.declineTitle')}
        consequence={dlg ? (dlg.d === 'approve' ? t('m34.sb.approveBody', { name: name(dlg.r), h: f.num(dlg.r.hours), c: c(dlg.r.hours) }) : t('m34.sb.declineBody', { name: name(dlg.r) })) : ''}
        requireReason={dlg?.d === 'decline'} reasonLabel={t('m34.sb.declineReason')} actingAs={t('m34.sb.actingHr')}
        onConfirm={async (note) => { if (dlg) await run(() => repo.rpc.decideStudyTime({ id: dlg.r.id, decision: dlg.d, note }), dlg.d === 'approve' ? t('m34.sb.approved') : t('m34.sb.declined')); setDlg(null); }} />
    </div>
  );
}
