// F38 /team/ojt: practice readiness for the people in my scope (line managers, instructors, evaluators). One row per person and
// task they have practised: supervised performances against the N needed, the latest preceptor "ready", open acknowledgements and
// evaluation requests, with <WhyThis>. Read only: practice is never a qualification sign-off, and acknowledgements stay with the
// named preceptor. Rows come from ojt_logs and ojt_eval_requests under row-level security (qual_records Scope).
import { useMemo, useState } from 'react';
import { Page, Async, Card, DataTable, EmptyState, Grid, StatTile, WhyThis, SelectField } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { readiness, readinessReasons, type LogRow } from './ojt';
import { PracticeNotice, ReadyRing, useOjtData, type OjtData } from './ojtUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
interface Line { key: string; person_id: string; name: string; task: Row; r: ReturnType<typeof readiness>; last: string; open: Row | null }

export default function TeamOjtPage() {
  const t = useT();
  const s = useSession();
  const q = useOjtData(s.identity.personId);
  return (
    <Page title={t('m02.routes.team-ojt.title')} eyebrow={t('m02.ojt.eyebrow')} intro={t('m02.ojt.team.intro')} wide>
      <PracticeNotice />
      <Async state={q}>{(d) => <Team d={d} />}</Async>
    </Page>
  );
}

function Team({ d }: { d: OjtData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [std, setStd] = useState('');
  const nm = (en: string, ar?: string | null) => pick({ name_en: en, name_ar: ar || en }, 'name');
  const lines = useMemo(() => {
    const byKey = new Map<string, LogRow[]>();
    for (const l of d.logs) {
      if (l.person_id === d.me) continue;
      const k = `${l.person_id}|${l.task_id}`;
      byKey.set(k, [...(byKey.get(k) ?? []), l]);
    }
    const out: Line[] = [];
    for (const [k, logs] of byKey) {
      const task = d.tasks.find((x) => x.id === logs[0].task_id);
      if (!task) continue;
      const r = readiness(task, logs);
      const open = d.requests.find((x) => x.person_id === logs[0].person_id && x.task_id === task.id && x.status === 'requested') ?? null;
      out.push({ key: k, person_id: logs[0].person_id, name: nm(logs[0].person_name ?? '', (logs[0] as Row).person_name_ar), task, r, last: logs.map((l) => l.on_date).sort().at(-1) ?? '', open });
    }
    return out.sort((a, b) => (a.name === b.name ? (a.task.code < b.task.code ? -1 : 1) : a.name < b.name ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  const stds = useMemo(() => [...new Set(lines.map((l) => l.task.standard_id))].map((id) => d.standards.find((x) => x.id === id)).filter(Boolean) as Row[], [lines, d.standards]);
  const shown = std ? lines.filter((l) => l.task.standard_id === std) : lines;
  const people = new Set(lines.map((l) => l.person_id)).size;
  const pendingAck = d.logs.filter((l) => l.person_id !== d.me && l.status === 'pending_ack').length;
  const openReq = d.requests.filter((r) => r.person_id !== d.me && r.status === 'requested');
  if (!lines.length) return <EmptyState icon="users" title={t('m02.ojt.team.empty')}>{t('m02.ojt.team.emptyBody')}</EmptyState>;
  return (
    <div className="space-y-5" data-testid="m02-ojt-team">
      <Grid cols={4}>
        <StatTile label={t('m02.ojt.team.people')} value={f.num(people)} sub={t('m02.ojt.team.peopleSub')} />
        <StatTile label={t('m02.ojt.team.ready')} value={f.num(lines.filter((l) => l.r.ready).length)} sub={t('m02.ojt.team.readySub')} tone="ok" />
        <StatTile label={t('m02.ojt.team.pendingAck')} value={f.num(pendingAck)} sub={t('m02.ojt.team.pendingAckSub')} tone="info" />
        <StatTile label={t('m02.ojt.team.openReq')} value={f.num(openReq.length)} sub={t('m02.ojt.team.openReqSub')} />
      </Grid>
      <div className="max-w-sm">
        <SelectField label={t('m02.ojt.standards')} name="std" value={std} onChange={setStd} placeholder={t('m02.ojt.team.allStandards')} options={stds.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'title')}` }))} />
      </div>
      <DataTable<Line> rows={shown} rowKey={(l) => l.key} csvName="ojt-readiness" caption={t('m02.ojt.team.caption')}
        initialSort={{ key: 'name', dir: 'asc' }}
        columns={[
          { key: 'name', header: t('m02.ojt.team.col.person'), value: (l) => l.name, sortable: true },
          { key: 'task', header: t('m02.ojt.team.col.task'), value: (l) => l.task.code, sortable: true, render: (l) => <span><span className="num font-semibold">{l.task.code}</span> <span className="text-ink-3">{pick(l.task, 'statement')}</span></span> },
          { key: 'supervised', header: t('m02.ojt.supervised'), value: (l) => `${Math.min(l.r.supervised, l.r.needed)}/${l.r.needed}`, sortable: true, render: (l) => <ReadyRing r={l.r} size={40} /> },
          { key: 'pending', header: t('m02.ojt.team.col.pending'), value: (l) => l.r.pending, sortable: true },
          { key: 'last', header: t('m02.ojt.team.col.last'), value: (l) => l.last, sortable: true, render: (l) => <span className="num">{l.last ? f.date(l.last) : '—'}</span> },
          { key: 'request', header: t('m02.ojt.team.col.request'), value: (l) => (l.open ? 'requested' : ''), render: (l) => (l.open ? <span className="text-info">{t('m02.ojt.team.requestedTo', { name: nm(l.open.evaluator_name, l.open.evaluator_name_ar) })}</span> : <span className="text-ink-3">—</span>) },
          { key: 'why', header: t('m02.ojt.team.col.why'), csv: false, render: (l) => <WhyThis reasons={readinessReasons(l.r)} testId="m02-ojt-team-why" /> },
        ]} />
      {openReq.length > 0 && (
        <Card title={t('m02.ojt.team.requests')}>
          <ul className="divide-y divide-line text-[13px]" data-testid="m02-ojt-team-requests">
            {openReq.map((r) => {
              const tk = d.tasks.find((x) => x.id === r.task_id);
              return <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5"><span className="font-semibold">{nm(r.person_name, r.person_name_ar)}</span><span className="num text-ink-3">{tk?.code}</span><span>{t('m02.ojt.team.requestedTo', { name: nm(r.evaluator_name, r.evaluator_name_ar) })}</span><span className="num text-ink-3">{f.date(String(r.requested_at).slice(0, 10))}</span>{r.evaluator_person_id === d.me && <L to="/my/ojt?tab=evaluate" className="link">{t('m02.ojt.team.toEvaluate')}</L>}</li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
