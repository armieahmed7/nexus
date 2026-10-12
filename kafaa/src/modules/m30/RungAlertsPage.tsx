// /workforce/rung-alerts (M30 · FS81 ladder-rung protection, role level). For every Mastery Builder role (published FS11 map with the
// SkillsFuture "Mastery Builder" archetype): the junior tasks that FS06 moves to tools by the horizon (from the rungs below it on the
// career ladder and its own routine tasks) and the synthetic practice a training plan must add: approved F28 simulator scenarios for
// the role's position and F38 OJT repetitions, each with "Why this?". Names no person. Readers: training manager (transformation W),
// HR director (A), HR analysts (Agg).
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { Async, Card, EmptyState, Grid, Page, StatTile } from '../../ui';
import { HorizonToggle, useRoleParams } from './ui';
import type { RungAlert } from './transition';
import { RungAlertPanel, TpEyebrow, useTpRefs } from './ui.fs81';

type Wrap = { rows: RungAlert[] | null };

export default function RungAlertsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const p = useRoleParams();
  const refs = useTpRefs();
  const q = useQuery<Wrap>(['jta_tasks', 'sim_scenarios', 'role_transformations', 'jta_task_skills'], async () => ({ rows: await repo.rpc.rungAlerts(p.horizon) }), [p.horizon]);
  return (
    <Page title={t('m30.routes.workforce-rung-alerts.title')} intro={t('m30.ra.intro')} eyebrow={<TpEyebrow />} wide
      actions={<L to="/my/role-2030" className="btn-outline no-underline">{t('m30.ra.toMaps')}</L>}>
      <div className="space-y-5">
        <HorizonToggle value={p.horizon} onChange={(h) => p.set('h', h === '2030' ? null : h)} />
        <Async state={q}>{(d) => (!d.rows ? <EmptyState title={t('m30.tp.hr.noAccess')} /> : (
          <div className="space-y-5">
            <Grid cols={4}>
              <StatTile label={t('m30.ra.tile.roles')} value={f.num(d.rows.length)} sub={t('m30.ra.tile.rolesSub')} />
              <StatTile label={t('m30.ra.tile.firing')} value={<span data-testid="m30-ra-firing">{f.num(d.rows.filter((a) => a.fires).length)}</span>} tone="sim" />
              <StatTile label={t('m30.ra.tile.tasks')} value={f.num(new Set(d.rows.flatMap((a) => a.tasks.map((x) => x.task_id))).size)} sub={t('m30.ra.tile.tasksSub', { h: t(`m30.horizon.${p.horizon}`) })} />
              <StatTile label={t('m30.ra.tile.sims')} value={f.num(new Set(d.rows.flatMap((a) => a.tasks.flatMap((x) => x.options.filter((o) => o.kind === 'simulator').map((o) => o.ref_id)))).size)} sub={t('m30.ra.tile.simsSub')} />
            </Grid>
            <ul className="space-y-4" data-testid="m30-ra-list">
              {d.rows.map((a) => (
                <li key={a.role_id ?? 'none'}>
                  <Card title={pick(refs.data?.roleById.get(a.role_id ?? ''), 'title') || a.role_id} eyebrow={a.fires ? t('m30.ra.eyebrowFires', { n: f.num(a.tasks.length) }) : t('m30.ra.eyebrowNone')}>
                    <RungAlertPanel alert={a} refs={refs.data} mode="role" />
                  </Card>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ink-3">{t('m30.ra.note')}</p>
          </div>
        ))}</Async>
      </div>
    </Page>
  );
}
