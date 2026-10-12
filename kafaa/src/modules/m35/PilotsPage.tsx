// FS61 /workforce/pilots (workforce_strategy Agg/R/W/A): the skills pilots registry. Every workforce experiment with its hypothesis,
// comparison group, named independent evaluator (role card), metrics, result (failures included) and adoption status, plus the adoption
// rate computed from the statuses against the Future Skills Centre reference read from kafaa_benchmarks (rpc.pilotStats). HR analysts and
// the HR director register pilots (rpc.savePilot); closing needs the evaluator's sign-off (see the pilot page).
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Section, Async, EmptyState, StatTile, Callout, SimChip, BenchmarkChips, DataTable, type Column } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { STATUSES } from './pilots';
import { AdoptionPill, PilotEditor, PilotStatusPill, ResultPill, usePeople, usePersonName } from './fs60ui';
import { AdoptionKpi, usePilots } from './pilotsUi';
import type { Row } from './ui';

export default function PilotsPage() {
  const t = useT();
  const s = useSession();
  const q = usePilots();
  const [editing, setEditing] = useState(false);
  const canEdit = s.can('workforce_strategy', ['W', 'A']);
  return (
    <Page title={t('m35.routes.workforce-pilots.title')} intro={t('m35.sp.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS61" /><SimChip /></div>}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/skills/pilots" className="btn-outline btn-sm no-underline">{t('m35.sp.toStaff')}</L>
        {canEdit && <button type="button" className="btn-primary btn-sm" onClick={() => setEditing(true)} data-testid="m35-sp-add">{t('m35.sp.add')}</button>}
      </div>}>
      <Async state={q}>{(d) => <Registry pilots={d.pilots} stats={d.stats} />}</Async>
      {editing && <EditorHost onClose={() => setEditing(false)} />}
    </Page>
  );
}

export function EditorHost({ row, onClose }: { row?: Row | null; onClose: () => void }) {
  const repo = useRepo();
  const s = useSession();
  const ref = useQuery(['people', 'skills'], async () => {
    const [people, skills] = await Promise.all([repo.list('people', { filter: { kind: 'staff', status: 'active' } } as never) as Promise<Row[]>, repo.list('skills') as Promise<Row[]>]);
    return { people, skills };
  });
  if (!ref.data) return null;
  return <PilotEditor row={row} staff={ref.data.people} skills={ref.data.skills} me={s.identity.personId ?? ''} onClose={onClose} />;
}

function Registry({ pilots, stats }: { pilots: Row[]; stats: import('./backend/rpc').PilotStats }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const people = usePeople();
  const name = usePersonName(people.data);
  const [status, setStatus] = useState<string>('all');
  const [result, setResult] = useState<string>('all');
  const shown = useMemo(() => pilots.filter((p) => (status === 'all' || p.status === status) && (result === 'all' || p.result === result)), [pilots, status, result]);
  const cols: Column<Row>[] = [
    { key: 'title', header: t('m35.sp.col.pilot'), value: (p) => pick(p, 'title'), sortable: true,
      render: (p) => <div className="min-w-0"><L to={`/workforce/pilots/${p.id}`} className="font-semibold" data-testid="m35-sp-link">{pick(p, 'title')}</L><span className="block text-[11.5px] text-ink-3">{t('m35.sp.window', { a: f.date(p.start_on), b: f.date(p.end_on) })}</span></div> },
    { key: 'status', header: t('m35.sp.col.status'), value: (p) => p.status, render: (p) => <PilotStatusPill status={p.status} /> },
    { key: 'result', header: t('m35.sp.col.result'), value: (p) => p.result ?? '', render: (p) => <ResultPill result={p.result} /> },
    { key: 'adoption', header: t('m35.sp.col.adoption'), value: (p) => p.adoption ?? '', render: (p) => <AdoptionPill adoption={p.adoption} /> },
    { key: 'evaluator', header: t('m35.sp.col.evaluator'), value: (p) => name(p.evaluator_person_id), render: (p) => <span className="text-[12.5px]">{name(p.evaluator_person_id)}</span> },
    { key: 'owner', header: t('m35.sp.col.owner'), value: (p) => name(p.owner_person_id), render: (p) => <span className="text-[12.5px] text-ink-2">{name(p.owner_person_id)}</span> },
  ];
  return (
    <div className="space-y-6" data-testid="m35-sp">
      <AdoptionKpi s={stats} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="m35-sp-tiles">
        <StatTile label={t('m35.sp.tile.closed')} value={f.num(stats.closed)} sub={t('m35.sp.tile.closedSub', { s: f.num(stats.success), m: f.num(stats.mixed) })} />
        <StatTile label={t('m35.sp.tile.failed')} value={f.num(stats.failed)} sub={t('m35.sp.tile.failedSub')} tone="bad" />
        <StatTile label={t('m35.sp.tile.evaluating')} value={f.num(stats.evaluating)} sub={t('m35.sp.tile.evaluatingSub')} tone="info" />
        <StatTile label={t('m35.sp.tile.running')} value={f.num(stats.running)} sub={t('m35.sp.tile.runningSub')} />
        <StatTile label={t('m35.sp.tile.draft')} value={f.num(stats.draft)} sub={t('m35.sp.tile.draftSub')} />
      </div>
      <Section title={t('m35.sp.registry')} description={t('m35.sp.registryIntro')}>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={t('m35.sp.filter')}>
          {(['all', ...STATUSES] as string[]).map((k) => (
            <button key={k} type="button" className={`btn-sm ${status === k ? 'btn-primary' : 'btn-outline'}`} aria-pressed={status === k} onClick={() => setStatus(k)} data-testid={`m35-sp-filter-${k}`}>{k === 'all' ? t('m35.sp.all') : t(`m35.sp.status.${k}`)}</button>
          ))}
          <select className="input w-auto min-w-0 max-w-full" value={result} onChange={(e) => setResult(e.target.value)} aria-label={t('m35.sp.col.result')} data-testid="m35-sp-filter-result">
            <option value="all">{t('m35.sp.allResults')}</option>
            {['success', 'mixed', 'failed'].map((r) => <option key={r} value={r}>{t(`m35.sp.result.${r}`)}</option>)}
          </select>
        </div>
        {shown.length ? (
          <div className="overflow-x-auto" data-testid="m35-sp-registry">
            <DataTable rows={shown} columns={cols} rowKey={(p) => p.id} searchable={false} pageSize={20} caption={t('m35.sp.registry')} csvName="skills-pilots-SIMULATED" />
          </div>
        ) : <EmptyState title={t('m35.sp.none')} />}
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m35.sp.how.title')}>{t('m35.sp.how.body')}</Callout>
        <Callout tone="sim" title={t('m35.sp.failures.title')}>{t('m35.sp.failures.body')}</Callout>
      </div>
    </div>
  );
}
