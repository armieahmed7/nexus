// /opportunities/rotations/board (M20 · F15): HR programme board. Aggregates only (rpc.rotationBoard): cohort progress, objectives
// met and check-ins; every cohort tile and family row with fewer than 10 people is suppressed; no names. Synthetic data, labelled.
import { Page, Section, Grid, Card, Async, StatTile, BarChart, Callout, SimChip, EmptyState, ProgressBar, Icon, Funnel } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ProgrammeChip } from './rotUi';
import type { CohortTile } from './rotation';

export default function RotationBoardPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['rotation_templates', 'rotation_cohorts', 'rotation_placements', 'shadow_requests', 'skill_evidence', 'job_families'], async () => {
    const [board, families] = await Promise.all([repo.rpc.rotationBoard(), repo.list('job_families')]);
    return { board, families };
  });
  return (
    <Page title={t('m20.routes.rotations-board.title')} intro={t('m20.rot.board.intro')} wide actions={<SimChip label={t('m20.rot.board.synthetic')} />}>
      <Async state={q} isEmpty={(d) => !d.board} empty={<EmptyState icon="lock" title={t('m20.rot.board.noAccess')} />}>
        {({ board: b, families }) => {
          if (!b) return null;
          const fam = (id: string) => pick(families.find((x) => x.id === id), 'name') || t('m20.common.unknownFamily');
          const sup = t('common.suppressed');
          const v = (n: number | null, pct = false) => (n == null ? sup : pct ? `${f.num(n)}%` : f.num(n));
          return (
            <div className="space-y-6" data-testid="m20-rot-board">
              <Grid cols={4}>
                <StatTile label={t('m20.rot.board.programmes')} value={f.num(b.totals.templates)} sub={t('m20.rot.board.cohorts', { n: f.num(b.totals.cohorts) })} />
                <StatTile label={t('m20.rot.board.participants')} value={v(b.totals.participants)} sub={t('m20.rot.board.placements', { n: v(b.totals.placements), s: v(b.totals.signed_off) })} />
                <StatTile label={t('m20.rot.board.met')} value={v(b.totals.met_pct, true)} tone="ok" sub={t('m20.rot.board.metSub', { m: v(b.totals.objectives_met), n: v(b.totals.objectives_total) })} />
                <StatTile label={t('m20.rot.board.evidence')} value={f.num(b.totals.evidence_rows)} sub={<L to="/my/skills">{t('m20.rot.board.evidenceSub')}</L>} />
              </Grid>
              <Section title={t('m20.rot.board.cohortsTitle')} description={t('m20.rot.board.cohortsSub', { n: f.num(b.min_group) })}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m20-rot-cohorts">
                  {b.cohorts.map((c) => <CohortCard key={c.cohort_id} c={c} />)}
                </div>
              </Section>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title={t('m20.rot.board.byFamily')} footer={t('m20.rot.board.byFamilySub', { n: f.num(b.min_group) })}>
                  <BarChart title={t('m20.rot.board.byFamily')} data={b.by_family.filter((r) => !r.suppressed).map((r) => ({ label: fam(r.family_id), value: r.placements ?? 0 }))} />
                  <div className="mt-3 overflow-x-auto">
                    <table className="table-base w-full" data-testid="m20-rot-family-table">
                      <thead><tr><th scope="col">{t('m20.rot.board.family')}</th><th scope="col" className="text-end">{t('m20.rot.board.colPeople')}</th><th scope="col" className="text-end">{t('m20.rot.board.colPlacements')}</th><th scope="col" className="text-end">{t('m20.rot.board.colSigned')}</th></tr></thead>
                      <tbody>
                        {b.by_family.map((r) => (
                          <tr key={r.family_id} data-suppressed={r.suppressed}>
                            <th scope="row" className="text-start font-normal">{fam(r.family_id)}</th>
                            {r.suppressed ? <td colSpan={3} className="text-end text-ink-3">{sup}</td> : <><td className="num text-end">{f.num(r.people!)}</td><td className="num text-end">{f.num(r.placements!)}</td><td className="num text-end">{f.num(r.signed_off!)}</td></>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card title={t('m20.rot.board.shadow')} footer={b.shadow.suppressed ? sup : t('m20.rot.board.shadowPeople', { n: f.num(b.shadow.people ?? 0) })}>
                  <Funnel title={t('m20.rot.board.shadow')} stages={[
                    { label: t('m20.rot.board.shRequests'), value: b.shadow.requests, suppressed: b.shadow.suppressed },
                    { label: t('m20.rot.shadowStatus.approved'), value: b.shadow.suppressed ? null : (b.shadow.approved ?? 0) + (b.shadow.completed ?? 0), suppressed: b.shadow.suppressed },
                    { label: t('m20.rot.shadowStatus.completed'), value: b.shadow.completed, suppressed: b.shadow.suppressed },
                  ]} />
                  {!b.shadow.suppressed && <p className="mt-2 text-[12.5px] text-ink-3">{t('m20.rot.board.shadowOpen', { r: f.num(b.shadow.requested ?? 0), d: f.num(b.shadow.declined ?? 0) })}</p>}
                </Card>
              </div>
              <Callout title={t('m20.rot.board.noteTitle')}>{t('m20.rot.board.noteBody')}</Callout>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function CohortCard({ c }: { c: CohortTile }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Card as="article" className={c.suppressed ? 'bg-sunken/40' : ''}>
      <div data-testid="m20-rot-cohort" data-suppressed={c.suppressed}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5"><ProgrammeChip programme={c.programme} /><span className="text-[12px] text-ink-3">{t('m20.rot.board.intake', { d: f.date(c.intake_on) })}</span></div>
        <h3 className="text-[15px] font-semibold"><L to={`/opportunities/rotations/programmes/${c.template_id}`} className="link-plain hover:underline">{pick(c, 'name')}</L></h3>
        {c.suppressed ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-3"><Icon name="lock" size={14} />{t('m20.rot.board.suppressed', { n: f.num(10) })}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-baseline justify-between"><span className="caps">{t('m20.rot.board.participants')}</span><span className="num text-[18px] font-semibold">{f.num(c.participants!)}</span></div>
            <div><div className="mb-1 flex justify-between text-[12.5px]"><span>{t('m20.rot.board.progress')}</span><span className="num">{f.num(c.signed_off!)}/{f.num(c.placements!)}</span></div><ProgressBar value={c.progress_pct ?? 0} label={t('m20.rot.board.progress')} /></div>
            <div><div className="mb-1 flex justify-between text-[12.5px]"><span>{t('m20.rot.board.met')}</span><span className="num">{c.met_pct == null ? '—' : `${f.num(c.met_pct)}%`}</span></div><ProgressBar value={c.met_pct ?? 0} tone="ok" label={t('m20.rot.board.met')} /></div>
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              <span className="chip border-info-line bg-info-bg text-info">{t('m20.rot.phase.in_progress')}: {f.num(c.in_progress!)}</span>
              <span className={`chip ${c.overdue ? 'border-bad-line bg-bad-bg text-bad' : 'border-line bg-sunken text-ink-2'}`}>{t('m20.rot.phase.overdue')}: {f.num(c.overdue!)}</span>
              <span className="chip border-line bg-sunken text-ink-2">{t('m20.rot.board.checkins', { d: f.num(c.checkins_done!), n: f.num(c.checkins_due!) })}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
