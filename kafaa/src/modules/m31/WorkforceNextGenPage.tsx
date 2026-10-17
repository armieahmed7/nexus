// FS38 /workforce/next-gen (workforce_strategy Agg or R): HR view of SMR delta readiness. Per ADVANCE technology family: the people
// whose role has a published delta, how many are delta-ready (readiness at or above the line) and the average readiness; then a job
// family x technology heatmap. Computed server-side (rpc.nextGenMatrix, SQL kafaa_smr_matrix_core); every cell under 10 people is
// suppressed. Planning assumption: no deployment decision implied; never a headcount plan.
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, Heatmap, BenchmarkChips, BenchmarkLine, WhyThis, SimChip } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, techDesigns, useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import type { NextGenMatrix } from './backend/rpc';
import { NoDeployNote, useNgRef, type RefData } from './ui';

export default function WorkforceNextGenPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useNgRef();
  const q = useQuery(['smr_deltas', 'person_skills'], () => repo.rpc.nextGenMatrix(), []);
  return (
    <Page title={t('m31.routes.workforce-next-gen.title')} intro={t('m31.wf.intro')} wide
      eyebrow={<span className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><SimChip label={t('m31.ng.planningChip')} /><BenchmarkChips feature="FS38" /></span>}
      actions={<L to="/careers/next-gen" className="btn-outline btn-sm no-underline">{t('m31.wf.toPublic')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(m) => (m ? <Body d={d} m={m} /> : <EmptyState title={t('m31.wf.noAccess')} />)}</Async>}</Async>
    </Page>
  );
}

function Body({ d, m }: { d: RefData; m: NextGenMatrix }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const shown = m.techs.filter((x) => x.n != null);
  const fams = [...new Set(m.families.map((x) => x.family_id))].sort();
  const cell = (fam: string, tech: string) => m.families.find((x) => x.family_id === fam && x.tech_id === tech);
  return (
    <div className="space-y-6" data-testid="m31-wf">
      <Callout tone="info" title={t('m31.wf.howTitle')}>{t('m31.wf.howBody', { line: f.pct(m.ready_pct_line, 0), min: f.num(MIN_GROUP_SIZE) })}</Callout>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m31-wf-tiles">
        <StatTile label={t('m31.wf.tile.people')} value={m.people == null ? t('m31.wf.suppressed') : f.num(m.people)} sub={t('m31.wf.tile.peopleSub')} />
        <StatTile label={t('m31.wf.tile.techs')} value={`${f.num(shown.length)} / ${f.num(m.techs.length)}`} sub={t('m31.wf.tile.techsSub')} />
        <StatTile label={t('m31.wf.tile.deltas')} value={f.num(m.techs.reduce((s, x) => s + x.deltas, 0))} sub={t('m31.wf.tile.deltasSub')} />
        <StatTile label={t('m31.wf.tile.asOf')} value={f.date(m.as_of)} />
      </div>
      <Section title={t('m31.wf.techTitle')} description={t('m31.wf.techDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m31-wf-techs">
          {m.techs.map((x) => {
            const tech = d.techById.get(x.tech_id);
            return (
              <li key={x.tech_id} data-tech={x.tech_id} data-suppressed={x.n == null ? 'yes' : 'no'}>
                <Card title={tech ? pick(tech, 'family') : x.tech_id} eyebrow={techDesigns(t, tech?.designs)}>
                  {x.n == null ? <p className="text-[13px] text-ink-3">{t('m31.wf.cellSuppressed', { min: f.num(MIN_GROUP_SIZE) })}</p> : (
                    <div className="space-y-2">
                      <p className="text-[13px]">{t('m31.wf.techLine', { ready: f.num(x.ready), n: f.num(x.n), deltas: f.num(x.deltas) })}</p>
                      <BenchmarkLine value={x.ready_pct} max={100} unit="pct" label={t('m31.wf.readyShare')} compact lines={[{ kind: 'target', label: t('m31.wf.half'), value: 50 }]} />
                      <p className="text-[12px] text-ink-3">{t('m31.wf.avg', { pct: f.pct(x.avg_pct, 1) })}</p>
                      <WhyThis testId="m31-wf-why" reasons={[
                        { code: 'fs38_hr_n', key: 'm31.wf.reason.n', vars: { n: x.n!, deltas: x.deltas } },
                        { code: 'fs38_hr_ready', key: 'm31.wf.reason.ready', vars: { ready: x.ready!, line: m.ready_pct_line } },
                        { code: 'fs38_hr_min', key: 'm31.wf.reason.min', vars: { min: MIN_GROUP_SIZE } },
                      ]} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title={t('m31.wf.heatTitle')} description={t('m31.wf.heatDesc', { min: f.num(MIN_GROUP_SIZE) })}>
        {fams.length === 0 ? <EmptyState title={t('m31.wf.noFamilies')} /> : (
          <div data-testid="m31-wf-heat">
            <Heatmap title={t('m31.wf.heatTitle')} rows={fams} cols={d.techs.map((x) => x.id)}
              rowLabel={(r) => (d.families.get(r) ? pick(d.families.get(r), 'name') : r)} colLabel={(c) => (d.techById.get(c) ? pick(d.techById.get(c), 'family') : c)}
              value={(r, c) => { const x = cell(r, c); if (!x) return { v: null }; if (x.n == null) return { v: null, suppressed: true }; return { v: x.ready_pct, label: f.pct(x.ready_pct, 0), tone: Number(x.ready_pct) >= 50 ? 'ok' : 'info' }; }} />
          </div>
        )}
      </Section>
      <NoDeployNote />
    </div>
  );
}
