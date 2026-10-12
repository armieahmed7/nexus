// FS41 /workforce/clean-energy (skills_profile Agg): CleanEnergyComp across the workforce. Share of active
// staff at L1 or above and at their job family's target, by level, area and family (rpc.cecStats; SQL kafaa_cec_stats_core = cecStats).
// Every count or share naming fewer than 10 people is suppressed; no person is listed; security, safeguards and cyber are never broken out.
import { Page, Section, Async, Callout, EmptyState, StatTile, BenchmarkChips, BarChart, DataTable, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { CecStats } from './cec';
import { LevelPill, useCecRef, type CecRef, type Row } from './ui';

export default function WorkforceCleanEnergyPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useCecRef();
  const q = useQuery(['person_skills', 'cec_competences', 'cec_role_targets'], () => repo.rpc.cecStats(), []);
  return (
    <Page title={t('m32.routes.workforce-clean-energy.title')} intro={t('m32.wf.intro')} wide eyebrow={<BenchmarkChips feature="FS41" />}
      actions={<L to="/skills/clean-energy" className="btn-outline btn-sm no-underline">{t('m32.my.framework')}</L>}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={(x) => !x} empty={<EmptyState title={t('m32.wf.none')} />}>{(s) => (s ? <Stats s={s} d={d} /> : null)}</Async>}</Async>
    </Page>
  );
}

function Stats({ s, d }: { s: CecStats; d: CecRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const sup = t('common.suppressedShort');
  const cell = (v: number | null, pct = false) => (v == null ? <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{sup}</span> : <span className="num">{pct ? f.pct(v) : f.num(v)}</span>);
  const fam = (id: string) => { const x = d.families.find((y: Row) => y.id === id); return x ? pick(x, 'name') : id; };
  const cols: Column<CecStats['by_family'][number]>[] = [
    { key: 'family', header: t('m32.targets.family'), value: (r) => fam(r.family_id), render: (r) => <span className="font-semibold">{fam(r.family_id)}</span>, sortable: true },
    { key: 'target', header: t('m32.targets.level'), value: (r) => r.target ?? 0, render: (r) => (r.target == null ? '—' : <LevelPill level={r.target} />) },
    { key: 'n', header: t('m32.wf.col.staff'), align: 'end', value: (r) => r.n ?? -1, render: (r) => cell(r.n) },
    { key: 'met', header: t('m32.wf.col.met'), align: 'end', value: (r) => r.pct_met ?? -1, render: (r) => cell(r.pct_met, true) },
  ];
  return (
    <div className="space-y-6" data-testid="m32-wf">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m32-wf-tiles">
        <StatTile label={t('m32.wf.tile.staff')} value={f.num(s.staff)} sub={t('m32.wf.tile.staffSub')} />
        <StatTile label={t('m32.wf.tile.l1')} value={s.pct_l1 == null ? sup : f.pct(s.pct_l1)} sub={t('m32.wf.tile.l1Sub')} tone="ok" />
        <StatTile label={t('m32.wf.tile.met')} value={s.pct_met == null ? sup : f.pct(s.pct_met)} sub={t('m32.wf.tile.metSub')} tone="info" />
        <StatTile label={t('m32.wf.tile.families')} value={f.num(s.by_family.length)} sub={t('m32.wf.tile.familiesSub')} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m32.wf.areaTitle')} description={t('m32.wf.areaIntro')}>
          <div data-testid="m32-wf-areas"><BarChart title={t('m32.wf.areaTitle')} unit="%" max={100} data={s.by_area.map((a) => ({ label: t(`m32.area.${a.area}`), value: a.pct_l1, suppressed: a.pct_l1 == null }))} /></div>
        </Section>
        <Section title={t('m32.wf.levelTitle')} description={t('m32.wf.levelIntro')}>
          <div data-testid="m32-wf-levels"><BarChart title={t('m32.wf.levelTitle')} data={s.by_level.map((l) => ({ label: t(`m32.level.${l.level}`), value: l.n, suppressed: l.n == null }))} /></div>
        </Section>
      </div>
      <Section title={t('m32.wf.famTitle')} description={t('m32.wf.famIntro')}>
        <div className="overflow-x-auto" data-testid="m32-wf-families"><DataTable rows={s.by_family} columns={cols} rowKey={(r) => r.family_id} searchable={false} pageSize={20} caption={t('m32.wf.famTitle')} dense /></div>
      </Section>
      <Callout tone="info" title={t('m32.wf.how.title')}>{t('m32.wf.how.body')}</Callout>
    </div>
  );
}
