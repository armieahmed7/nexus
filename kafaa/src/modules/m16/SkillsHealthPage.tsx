// /admin/skills-health (M16 · FS54): catalogue health. Staleness (definitions past their review date or due within 90 days, by owner)
// and the orphan-rate audit (live skills that no course, pathway, assessment or role uses), computed by rpc.taxonomyHealth from the
// catalogue (SQL kafaa_fs63_health = taxonomyHealth; "taught by" = TAUGHT_BY, shared with FS57). Every number drills down to its skills;
// a stale or orphaned skill links straight to a change proposal.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BarChart, BenchmarkChips, Callout, Card, DataTable, Donut, EmptyState, Icon, Page, StatTile, StatusPill, type Column } from '../../ui';
import { TAUGHT_BY, type SkillHealth, type SkillLite } from './taxonomyGov';
import { MethodologyBanner } from './MethodologyBanner';

type Filter = 'all' | 'overdue' | 'due_soon' | 'orphan' | 'untaught' | 'no_course' | 'no_assessment' | 'no_role';
const FILTERS: Filter[] = ['all', 'overdue', 'due_soon', 'orphan', 'untaught', 'no_course', 'no_assessment', 'no_role'];
const match = (f: Filter, h: SkillHealth) => f === 'all' || (f === 'overdue' && h.review === 'overdue') || (f === 'due_soon' && h.review === 'due_soon') || (f === 'orphan' && h.orphan)
  || (f === 'untaught' && !h.taught) || (f === 'no_course' && !h.course) || (f === 'no_assessment' && !h.assessment) || (f === 'no_role' && !h.role);

export default function SkillsHealthPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['skills', 'courses', 'course_skill_links', 'pathways', 'skill_changes'], async () => ({
    health: await repo.rpc.taxonomyHealth(),
    skills: (await repo.list('skills')) as unknown as SkillLite[],
  }), []);
  return (
    <Page title={t('m16.routes.admin-skills-health.title')} eyebrow={<BenchmarkChips feature="FS54" />} intro={t('m16.gov.hl.intro')} wide>
      <Async state={q} isEmpty={() => false}>
        {(d) => <Health health={d.health} skills={d.skills} />}
      </Async>
    </Page>
  );
}

function Health({ health, skills }: { health: { summary: import('./taxonomyGov').HealthSummary; skills: SkillHealth[] }; skills: SkillLite[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const [filter, setFilter] = useState<Filter>('overdue');
  const sm = health.summary;
  const byId = useMemo(() => new Map(skills.map((x) => [x.id, x])), [skills]);
  const rows = health.skills.filter((h) => match(filter, h)).map((h) => ({ ...h, skill: byId.get(h.skill_id) }));
  const owners = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of health.skills) if (h.review === 'overdue' || h.review === 'due_soon') { const o = byId.get(h.skill_id)?.owner_role ?? 'nuclear_training'; m.set(o, (m.get(o) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: t(`fs.owner.${k}`), value: v }));
  }, [health, byId, t]);
  const canPropose = s.can('skills_taxonomy', ['W']);
  const tick = (ok: boolean, label: string) => <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${ok ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`} role="img" aria-label={`${label}: ${ok ? t('m16.gov.hl.yes') : t('m16.gov.hl.no')}`}><Icon name={ok ? 'check' : 'close'} size={11} /></span>;
  type R = (typeof rows)[number];
  const cols: Column<R>[] = [
    { key: 'skill', header: t('m16.gov.hl.col.skill'), value: (r) => r.skill?.code ?? r.skill_id, sortable: true, render: (r) => <span className="min-w-0"><span className="font-mono text-[11px] text-ink-3" dir="ltr">{r.skill?.code}</span> <L to={`/skills/${r.skill_id}`} className="link">{pick(r.skill, 'name')}</L></span> },
    { key: 'owner', header: t('m16.gov.hl.col.owner'), value: (r) => r.skill?.owner_role ?? '', render: (r) => <span className="text-[12.5px]">{t(`fs.owner.${r.skill?.owner_role ?? 'nuclear_training'}`)}</span> },
    { key: 'review', header: t('m16.gov.hl.col.review'), value: (r) => r.skill?.review_due ?? '', sortable: true, render: (r) => <span className="flex flex-wrap items-center gap-1.5"><span>{f.date(r.skill?.review_due)}</span>{r.review !== 'ok' && <StatusPill tone={r.review === 'overdue' ? 'bad' : r.review === 'due_soon' ? 'sim' : 'neutral'}>{t(`m16.gov.hl.review.${r.review}`)}{r.days_overdue != null ? ` · ${t('m16.gov.hl.days', { n: f.num(r.days_overdue) })}` : ''}</StatusPill>}</span> },
    { key: 'course', header: t('m16.gov.hl.col.course'), value: (r) => (r.course ? 1 : 0), render: (r) => tick(r.course, t('m16.gov.hl.col.course')) },
    { key: 'pathway', header: t('m16.gov.hl.col.pathway'), value: (r) => (r.pathway ? 1 : 0), render: (r) => tick(r.pathway, t('m16.gov.hl.col.pathway')) },
    { key: 'external', header: t('m16.gov.hl.col.external'), value: (r) => (r.external ? 1 : 0), render: (r) => tick(r.external, t('m16.gov.hl.col.external')) },
    { key: 'assessment', header: t('m16.gov.hl.col.assessment'), value: (r) => (r.assessment ? 1 : 0), render: (r) => tick(r.assessment, t('m16.gov.hl.col.assessment')) },
    { key: 'role', header: t('m16.gov.hl.col.role'), value: (r) => (r.role ? 1 : 0), render: (r) => tick(r.role, t('m16.gov.hl.col.role')) },
    ...(canPropose ? [{ key: 'act', header: '', value: () => '', render: (r: R) => <L to={`/skills/changes/propose?skill=${r.skill_id}&kind=${r.orphan ? 'retire' : 'relevel'}`} className="link text-[12px]">{t('m16.gov.hl.propose')}</L> } as Column<R>] : []),
  ];
  const taught = health.skills.filter((h) => h.taught).length;
  return (
    <div className="space-y-5">
      <MethodologyBanner dashboard="skills_health" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" data-testid="m16-health-tiles">
        <StatTile label={t('m16.gov.hl.tile.live')} value={f.num(sm.live)} sub={t('m16.gov.hl.tile.liveSub', { n: f.num(sm.skills - sm.live) })} />
        <StatTile label={t('m16.gov.hl.tile.overdue')} value={f.num(sm.overdue)} tone={sm.overdue ? 'bad' : 'ok'} sub={t('m16.gov.hl.tile.rate', { pct: f.pct((sm.stale_rate ?? 0) * 100) })} />
        <StatTile label={t('m16.gov.hl.tile.dueSoon')} value={f.num(sm.due_soon)} tone={sm.due_soon ? 'sim' : undefined} />
        <StatTile label={t('m16.gov.hl.tile.orphans')} value={f.pct((sm.orphan_rate ?? 0) * 100)} tone={sm.orphans ? 'bad' : 'ok'} sub={t('m16.gov.hl.tile.orphansSub', { n: f.num(sm.orphans) })} />
        <StatTile label={t('m16.gov.hl.tile.untaught')} value={f.num(sm.untaught)} tone={sm.untaught ? 'sim' : 'ok'} />
        <StatTile label={t('m16.gov.hl.tile.noRole')} value={f.num(sm.no_role)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('m16.gov.hl.coverTitle')}>
          <Donut title={t('m16.gov.hl.coverTitle')} data={[
            { label: t('m16.gov.hl.cover.taughtRole'), value: health.skills.filter((h) => h.taught && h.role).length, tone: 'ok' },
            { label: t('m16.gov.hl.cover.taughtOnly'), value: health.skills.filter((h) => h.taught && !h.role).length, tone: 'accent' },
            { label: t('m16.gov.hl.cover.roleOnly'), value: health.skills.filter((h) => !h.taught && h.role).length, tone: 'sim' },
            { label: t('m16.gov.hl.cover.orphan'), value: sm.orphans, tone: 'bad' },
          ]} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m16.gov.hl.coverNote', { n: f.num(taught), total: f.num(sm.live) })}</p>
        </Card>
        <Card title={t('m16.gov.hl.ownerTitle')}>{owners.length ? <BarChart title={t('m16.gov.hl.ownerTitle')} data={owners} /> : <p className="text-[13px] text-ink-3">{t('m16.gov.hl.ownerNone')}</p>}</Card>
        <Card title={t('m16.gov.hl.taughtTitle')}>
          <dl className="space-y-2 text-[12.5px]" data-testid="m16-taught-by">
            {(Object.keys(TAUGHT_BY) as (keyof typeof TAUGHT_BY)[]).map((k) => (
              <div key={k}><dt className="caps">{t(`m16.gov.hl.col.${k}`)}</dt><dd className="text-ink-2">{t(`m16.gov.hl.taught.${k}`)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-[11.5px] text-ink-3">{t('m16.gov.hl.taughtShared')}</p>
        </Card>
      </div>
      <section aria-labelledby="m16-drill">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 id="m16-drill" className="text-[17px] font-semibold">{t('m16.gov.hl.drillTitle')}</h2>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('m16.gov.hl.drillTitle')} data-testid="m16-health-filters">
            {FILTERS.map((k) => {
              const n = health.skills.filter((h) => match(k, h)).length;
              return <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} onClick={() => setFilter(k)} data-filter={k} data-n={n}>{t(`m16.gov.hl.filter.${k}`)} · {f.num(n)}</button>;
            })}
          </div>
        </div>
        {rows.length === 0 ? <EmptyState icon="check" title={t('m16.gov.hl.drillNone')} /> : <div data-testid="m16-health-table" data-filter={filter}><DataTable rows={rows} rowKey={(r) => r.skill_id} columns={cols} csvName={`kafaa-skills-health-${filter}`} /></div>}
      </section>
      <Callout title={t('m16.gov.hl.whyTitle')}>{t('m16.gov.hl.whyBody')}</Callout>
    </div>
  );
}
