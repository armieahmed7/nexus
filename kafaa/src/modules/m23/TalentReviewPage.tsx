// /talent/review (M23 · F18): the talent review hub. Review cycles the caller may see (HR director: all; line managers and the HR
// business partner: cycles with people in their scope), with their stage, progress in the caller's view and the next step.
// Confidential: data comes only through rpc.talentCycles. Employees see their agreed priorities at /my/development-priorities.
import { Page, Section, Card, Async, EmptyState, Callout, Grid, StatTile, ProgressBar, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CyclePill, CycleSteps, ConfidentialNote, unwrap, useCatalogue, useLabels } from './ui';
import type { CycleSummary } from './backend/rpc';

export default function TalentReviewPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['review_cycles', 'review_placements'], () => unwrap<CycleSummary[]>(repo.rpc.talentCycles()), []);
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  const hr = s.can('talent_review', ['Agg', 'R', 'A']);
  const isA = s.can('talent_review', ['A']);
  return (
    <Page title={t('m23.routes.talent-review.title')} intro={t('m23.hub.intro')} wide
      actions={
        <span className="flex flex-wrap gap-2">
          <L to="/talent/review/pool" className="btn-outline btn-sm" data-testid="m23-to-pool"><Icon name="sparkle" size={14} />{t('m23.routes.talent-review-pool.title')}</L>
          {hr && <L to="/talent/review/insights" className="btn-outline btn-sm" data-testid="m23-to-insights"><Icon name="chart" size={14} />{t('m23.routes.talent-review-insights.title')}</L>}
          <L to="/talent/succession" className="btn-ghost btn-sm"><Icon name="users" size={14} />{t('m23.routes.talent-succession.title')}</L>
        </span>
      }>
      <ConfidentialNote />
      <Callout title={t('m23.hub.howTitle')}>{t(isA ? 'm23.hub.howDirector' : hr ? 'm23.hub.howHr' : 'm23.hub.howManager')}</Callout>
      <Async state={q} empty={<EmptyState icon="users" title={t('m23.hub.none')}>{t('m23.hub.noneBody')}</EmptyState>} isEmpty={(d) => d.length === 0}>
        {(cycles) => {
          const open = cycles.filter((c) => c.status === 'open');
          const todo = open.reduce((n, c) => n + (c.in_view - c.placed_in_view), 0);
          return (
            <>
              <Grid cols={4}>
                <StatTile label={t('m23.hub.cycles')} value={cycles.length} />
                <StatTile label={t('m23.hub.inView')} value={cycles.reduce((n, c) => n + c.in_view, 0)} sub={t('m23.hub.inViewSub')} />
                <StatTile label={t('m23.hub.toPlace')} value={todo} tone={todo ? 'info' : 'ok'} sub={t('m23.hub.toPlaceSub')} />
                <StatTile label={t('m23.hub.inCalibration')} value={cycles.filter((c) => c.status === 'calibration').length} tone="sim" />
              </Grid>
              <Section title={t('m23.hub.list')}>
                <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m23-cycles">
                  {cycles.map((c) => <CycleCard key={c.id} c={c} families={c.family_ids.map((x) => lab.family(x)).join(' · ')} />)}
                </ul>
              </Section>
            </>
          );
        }}
      </Async>
    </Page>
  );
}

function CycleCard({ c, families }: { c: CycleSummary; families: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const pct = c.in_view ? (c.placed_in_view / c.in_view) * 100 : 0;
  return (
    <li>
      <Card className="h-full" eyebrow={<span className="num">{c.code} · {c.period}</span>} title={pick(c, 'title')} actions={<CyclePill status={c.status} />}>
        <div className="space-y-3 text-[13px]" data-testid="m23-cycle-card" data-status={c.status}>
          <div className="text-ink-2">{families}</div>
          <CycleSteps status={c.status} />
          <div>
            <div className="mb-1 flex justify-between text-[12.5px]"><span>{t('m23.hub.placed', { n: f.num(c.placed_in_view), of: f.num(c.in_view) })}</span><span className="text-ink-3">{t('m23.hub.members', { n: f.num(c.members) })}</span></div>
            <ProgressBar value={pct} tone={pct >= 100 ? 'ok' : 'accent'} label={t('m23.hub.progress')} />
          </div>
          <div className="text-[12px] text-ink-3">
            {c.status === 'locked' ? t('m23.hub.lockedOn', { date: f.date(c.locked_at) }) : c.status === 'calibration' ? (c.calibrated_at ? t('m23.hub.calibratedOn', { date: f.date(c.calibrated_at) }) : t('m23.hub.calibrating')) : t('m23.hub.dueOn', { date: f.date(c.due_on) })}
          </div>
          <div className="flex flex-wrap gap-2">
            <L to={`/talent/review/${c.id}`} className="btn-primary btn-sm" data-testid="m23-open-cycle">{t('m23.hub.open')}</L>
            {c.status !== 'open' || c.placed_in_view > 0 ? <L to={`/talent/review/${c.id}/calibration`} className="btn-outline btn-sm">{t('m23.routes.talent-review-calibration.title')}</L> : null}
          </div>
        </div>
      </Card>
    </li>
  );
}
