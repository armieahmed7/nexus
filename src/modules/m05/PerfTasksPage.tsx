// FS22 /my/assessments/tasks (skills_profile Own): scenario performance tasks on SIMULATED plant data. Each card shows the role, the
// skills, the time, the credential it gates and my status; the rubric is always published before an attempt (task page).
import { Page, Async, Callout, EmptyState, BenchmarkChips, StatusPill, SimChip, Icon, StatTile } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { GateChips, SkillLinks, useFsRef, type FsRef, type Row } from './fsui';

export function taskStatus(attempts: Row[]): { key: string; tone: 'ok' | 'bad' | 'info' | 'sim' | 'neutral' | 'accent'; a: Row | null } {
  const latest = [...attempts].sort((x, y) => String(y.started_at).localeCompare(String(x.started_at)))[0] ?? null;
  if (!latest) return { key: 'none', tone: 'neutral', a: null };
  if (latest.status === 'in_progress') return { key: 'in_progress', tone: 'info', a: latest };
  if (latest.status === 'submitted') return { key: 'submitted', tone: 'sim', a: latest };
  if (latest.counts === false) return { key: 'voided', tone: 'bad', a: latest };
  return { key: latest.passed ? 'passed' : 'not_yet', tone: latest.passed ? 'ok' : 'accent', a: latest };
}

export default function PerfTasksPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['task_attempts'], async () => (await repo.list('task_attempts' as never, { filter: { person_id: s.identity.personId ?? '__none__' } } as never).catch(() => [])) as Row[], [s.identity.personId]);
  return (
    <Page title={t('m05.routes.my-perf-tasks.title')} intro={t('m05.pt.intro')} wide eyebrow={<BenchmarkChips feature="FS22" />}
      actions={<L to="/my/assessments/adaptive" className="btn-outline btn-sm no-underline"><Icon name="sparkle" size={14} /> {t('m05.pt.toAdaptive')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(attempts) => <Body d={d} attempts={attempts} />}</Async>}</Async>
    </Page>
  );
}

function Body({ d, attempts }: { d: FsRef; attempts: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const tasks = d.tasks.filter((x: Row) => x.status === 'active');
  if (!tasks.length) return <EmptyState title={t('m05.pt.none')} />;
  const st = tasks.map((x: Row) => taskStatus(attempts.filter((a) => a.task_id === x.id)));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m05.pt.tile.tasks')} value={f.num(tasks.length)} sub={t('m05.pt.tile.tasksSub')} sim />
        <StatTile label={t('m05.pt.tile.passed')} value={f.num(st.filter((x) => x.key === 'passed').length)} tone="ok" />
        <StatTile label={t('m05.pt.tile.waiting')} value={f.num(st.filter((x) => x.key === 'submitted').length)} sub={t('m05.pt.tile.waitingSub')} tone="info" />
        <StatTile label={t('m05.pt.tile.gating')} value={f.num(tasks.filter((x: Row) => (x.gates ?? []).length).length)} sub={t('m05.pt.tile.gatingSub')} />
      </div>
      <Callout tone="info" title={t('m05.pt.how.title')}>{t('m05.pt.how.body')}</Callout>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m05-pt-list">
        {tasks.map((x: Row, i: number) => (
          <article key={x.id} className="card flex flex-col gap-3 p-4" data-testid={`m05-pt-card-${x.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="caps text-eyebrow">{pick(x, 'role')}</p>
                <h3 className="text-[16px] font-semibold leading-snug">{pick(x, 'title')}</h3>
              </div>
              <StatusPill tone={st[i].tone}>{t(`m05.pt.status.${st[i].key}`)}</StatusPill>
            </div>
            <p className="text-[13.5px] text-ink-2">{pick(x, 'brief')}</p>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <SimChip label={t('m05.pt.simulated')} />
              <span><Icon name="calendar" size={12} /> {t('m05.pt.minutes', { n: f.num(x.minutes) })}</span>
              <span>{t('m05.pt.rubricLines', { n: f.num((x.rubric ?? []).length) })}</span>
            </div>
            <SkillLinks ids={x.skill_ids ?? []} d={d} />
            <GateChips codes={x.gates} d={d} />
            <div className="mt-auto flex justify-end">
              <L to={`/my/assessments/tasks/${x.id}`} className="btn-primary btn-sm no-underline" data-testid={`m05-pt-open-${x.id}`}>{st[i].key === 'none' ? t('m05.pt.open') : t('m05.pt.view')}</L>
            </div>
          </article>
        ))}
      </div>
      <Callout tone="sim" title={t('m05.pt.synthetic.title')}>{t('m05.pt.synthetic.body')}</Callout>
    </div>
  );
}
